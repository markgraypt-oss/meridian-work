import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles, Plus, ThumbsUp, ThumbsDown, Mic, Clock, X, ImagePlus, MessageSquarePlus, ArrowLeft, Trash2, ChevronRight } from "lucide-react";


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderFadingWords(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}><span className="coach-word-fade">{part.slice(2, -2)}</span></strong>;
    }
    const words = part.split(/(\s+)/);
    return words.map((word, j) => {
      if (/^\s+$/.test(word)) return word;
      return <span key={`${i}-${j}`} className="coach-word-fade">{word}</span>;
    });
  });
}

interface CoachChatProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CoachChat({ isOpen, onOpenChange }: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const greetingStateRef = useRef<'idle' | 'loading' | 'done'>('idle');
  const [greetingLoading, setGreetingLoading] = useState(false);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingMessageRef = useRef<HTMLDivElement>(null);
  const pendingSeedContextRef = useRef<string | null>(null);

  const getFeedbackKey = (msg: ChatMessage, idx: number) => `${idx}-${msg.content.slice(0, 50)}`;

  const submitFeedback = async (feedbackKey: string, rating: 'positive' | 'negative', aiMessage: string, userMessage?: string) => {
    if (feedbackGiven[feedbackKey]) return;
    setFeedbackGiven(prev => ({ ...prev, [feedbackKey]: rating }));
    try {
      await apiRequest('POST', '/api/ai-feedback', {
        feature: 'coach_chat',
        rating,
        aiMessage,
        userMessage,
      });
    } catch {}
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const lastDragY = useRef(0);
  const dragVelocity = useRef(0);
  const lastTimestamp = useRef(0);

  const sheetHeight = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400;
  const dismissThreshold = sheetHeight * 0.3;

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setDragY(0);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      greetingStateRef.current = 'idle';
      setGreetingLoading(false);
      setMessages([]);
      setActiveConversationId(null);
      setIsTyping(false);
      setDisplayedContent('');
      pendingSeedContextRef.current = null;
      if (typingRef.current) clearTimeout(typingRef.current);
    }
  }, [isOpen]);

  const closeSheet = useCallback(() => {
    setIsClosing(true);
    setDragY(sheetHeight);
    setTimeout(() => {
      onOpenChange(false);
      setIsClosing(false);
      setDragY(0);
    }, 300);
  }, [onOpenChange, sheetHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    lastDragY.current = 0;
    dragVelocity.current = 0;
    lastTimestamp.current = Date.now();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - dragStartY.current);
    const now = Date.now();
    const dt = now - lastTimestamp.current;
    if (dt > 0) {
      dragVelocity.current = (diff - lastDragY.current) / dt;
    }
    lastDragY.current = diff;
    lastTimestamp.current = now;
    setDragY(diff);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const shouldDismiss = dragY > dismissThreshold || dragVelocity.current > 0.5;
    if (shouldDismiss) {
      closeSheet();
    } else {
      setDragY(0);
    }
  }, [dragY, dismissThreshold, closeSheet]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    lastDragY.current = 0;
    dragVelocity.current = 0;
    lastTimestamp.current = Date.now();

    const handleMouseMove = (ev: MouseEvent) => {
      const diff = Math.max(0, ev.clientY - dragStartY.current);
      const now = Date.now();
      const dt = now - lastTimestamp.current;
      if (dt > 0) {
        dragVelocity.current = (diff - lastDragY.current) / dt;
      }
      lastDragY.current = diff;
      lastTimestamp.current = now;
      setDragY(diff);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const finalY = lastDragY.current;
      const shouldDismiss = finalY > dismissThreshold || dragVelocity.current > 0.5;
      if (shouldDismiss) {
        closeSheet();
      } else {
        setDragY(0);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [dismissThreshold, closeSheet]);

  const hasUserMessages = messages.some(m => m.role === 'user');
  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/coach/suggestions'],
    enabled: isOpen && !hasUserMessages,
  });

  const { data: conversationHistory = [], isLoading: historyLoading } = useQuery<Array<{
    id: number; title: string; createdAt: string; updatedAt: string;
  }>>({
    queryKey: ['/api/coach/conversations'],
    enabled: isOpen && showHistory,
  });

  const saveConversationMutation = useMutation({
    mutationFn: async ({ id, messages: msgs, title }: { id?: number | null; messages: ChatMessage[]; title?: string }) => {
      if (id) {
        return apiRequest('PUT', `/api/coach/conversations/${id}`, { messages: msgs, title });
      } else {
        return apiRequest('POST', '/api/coach/conversations', { messages: msgs, title });
      }
    },
    onSuccess: async (res) => {
      const data = await res.json();
      setActiveConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/coach/conversations'] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/coach/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/conversations'] });
    },
  });

  const startTypingEffect = useCallback((fullText: string) => {
    if (typingRef.current) clearTimeout(typingRef.current);
    setIsTyping(true);
    setDisplayedContent('');
    setRevealedWordCount(0);
    const words = fullText.split(/(\s+)/);
    let currentWordIdx = 0;

    const typeNextChunk = () => {
      currentWordIdx += 1;
      setRevealedWordCount(currentWordIdx);
      const shown = words.slice(0, currentWordIdx).join('');
      setDisplayedContent(shown);

      if (currentWordIdx < words.length) {
        typingRef.current = setTimeout(typeNextChunk, 45);
      } else {
        setIsTyping(false);
        setDisplayedContent('');
        setRevealedWordCount(0);
      }
    };

    typingRef.current = setTimeout(typeNextChunk, 100);
  }, []);

  // Consume any seed context handed in by another part of the app (e.g. the post-workout summary page)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = sessionStorage.getItem('coach-seed-context');
      if (!raw) return;
      const seed = JSON.parse(raw) as {
        summaryText?: string;
        openingMessage?: string;
      };
      if (seed?.summaryText) {
        pendingSeedContextRef.current = seed.summaryText;
      }
      const opening = seed?.openingMessage?.trim() || "Nice work finishing that session. What would you like to dig into?";
      greetingStateRef.current = 'done';
      setGreetingLoading(false);
      setMessages([{ role: 'assistant', content: opening }]);
      startTypingEffect(opening);
      sessionStorage.removeItem('coach-seed-context');
    } catch {
      sessionStorage.removeItem('coach-seed-context');
    }
  }, [isOpen, startTypingEffect]);

  useEffect(() => {
    if (!isOpen || greetingStateRef.current !== 'idle' || messages.length > 0 || activeConversationId) return;

    greetingStateRef.current = 'loading';
    setGreetingLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    fetch('/api/coach/proactive-greeting', { credentials: 'include', signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(data => {
        if (data.greeting && !controller.signal.aborted) {
          setMessages([{ role: 'assistant', content: data.greeting }]);
          startTypingEffect(data.greeting);
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        greetingStateRef.current = 'done';
        setGreetingLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, messages.length, activeConversationId, startTypingEffect]);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, []);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const seed = pendingSeedContextRef.current;
      pendingSeedContextRef.current = null;
      const messageToSend = seed
        ? `Context for this conversation (from the user's just-completed workout summary):\n${seed}\n\nUser question: ${message}`
        : message;
      const res = await apiRequest('POST', '/api/coach/chat', {
        message: messageToSend,
        conversationHistory: messages.slice(-10),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => {
        const updated = [...prev, { role: 'assistant' as const, content: data.response }];
        const title = updated.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New conversation';
        saveConversationMutation.mutate({ id: activeConversationId, messages: updated, title });
        return updated;
      });
      startTypingEffect(data.response);
    },
    onError: () => {
      const errorMsg = "Sorry, I wasn't able to respond right now. Please try again in a moment.";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      startTypingEffect(errorMsg);
    },
  });

  useEffect(() => {
    if (scrollRef.current && !isTyping) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isTyping && revealedWordCount === 1 && typingMessageRef.current) {
      typingMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isTyping, revealedWordCount]);

  useEffect(() => {
    if (isOpen && inputRef.current && messages.length > 0) {
      inputRef.current.focus();
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPlusMenu]);

  const sendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;
    const userMessage = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewConversation = () => {
    if (typingRef.current) clearTimeout(typingRef.current);
    setIsTyping(false);
    setDisplayedContent('');
    setMessages([]);
    setInput('');
    setShowPlusMenu(false);
    setActiveConversationId(null);
    setShowHistory(false);
    greetingStateRef.current = 'idle';
    setGreetingLoading(false);
  };

  const loadConversation = async (id: number) => {
    try {
      const res = await fetch(`/api/coach/conversations/${id}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages as ChatMessage[]);
      setActiveConversationId(data.id);
      setShowHistory(false);
      setFeedbackGiven({});
    } catch {}
  };

  const handleUploadImage = () => {
    setShowPlusMenu(false);
  };

  const suggestions = suggestionsData?.suggestions || [];

  if (!isOpen && !isClosing) return null;

  const overlayOpacity = isClosing ? 0 : isVisible ? Math.max(0, 0.5 - (dragY / sheetHeight) * 0.5) : 0;
  const translateY = isClosing ? sheetHeight : isVisible ? dragY : sheetHeight;
  const transition = isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease';

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{
          background: `rgba(0,0,0,${overlayOpacity})`,
          transition: isDragging ? 'none' : 'background 0.3s ease',
        }}
        onClick={closeSheet}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background flex flex-col border-0 shadow-2xl"
        style={{
          height: '50vh',
          transform: `translateY(${translateY}px)`,
          transition,
          willChange: 'transform',
        }}
      >
        <div
          className="flex justify-center pt-2 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.25)' }} />
        </div>

        <div className="flex items-center px-4 pb-3 border-b border-border/50">
          <div 
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #0cc9a9 0%, #0ab393 100%)' }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <div className="text-base font-semibold text-left leading-tight">Meridian Coach</div>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">Personalised guidance powered by your health data</p>
          </div>
          <button
            className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ml-2 transition-colors ${showHistory ? 'text-primary bg-primary/10' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
            title="Chat history"
            onClick={() => setShowHistory(!showHistory)}
          >
            <Clock className="h-6 w-6" />
          </button>
        </div>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">Conversation History</h3>
              <button
                onClick={handleNewConversation}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversationHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/60">No conversations yet</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Your chats will appear here</p>
              </div>
            ) : (
              <div className="px-4 pb-4">
                {(() => {
                  const grouped: Record<string, typeof conversationHistory> = {};
                  conversationHistory.forEach(conv => {
                    const d = new Date(conv.updatedAt);
                    const label = d.toLocaleDateString('en-GB', { weekday: 'short', month: 'long', day: 'numeric' }).toUpperCase();
                    if (!grouped[label]) grouped[label] = [];
                    grouped[label].push(conv);
                  });
                  return Object.entries(grouped).map(([dateLabel, convs]) => (
                    <div key={dateLabel} className="mb-4">
                      <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground/50 mb-2 px-1">{dateLabel}</p>
                      <div className="space-y-2">
                        {convs.map(conv => (
                          <div
                            key={conv.id}
                            className="group flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
                            style={{
                              background: activeConversationId === conv.id ? 'rgba(9, 181, 249, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                              border: activeConversationId === conv.id ? '1px solid rgba(9, 181, 249, 0.2)' : '1px solid rgba(0, 0, 0, 0.06)',
                            }}
                            onClick={() => loadConversation(conv.id)}
                          >
                            <div 
                              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(0, 0, 0, 0.05)' }}
                            >
                              <Sparkles className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{conv.title}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeConversationId === conv.id) handleNewConversation();
                                deleteConversationMutation.mutate(conv.id);
                              }}
                              className="p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground/30 hover:!text-destructive hover:!bg-destructive/10 transition-all shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 && !greetingLoading && (
            <div className="flex-1" />
          )}

          {greetingLoading && messages.length === 0 && (
            <div className="flex justify-start" style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
              <div 
                className="rounded-2xl px-4 py-3"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reviewing your health data...
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'fadeSlideIn 200ms ease-out' }}
            >
              {msg.role === 'assistant' ? (
                <div className="max-w-[88%] space-y-1.5" ref={isTyping && i === messages.length - 1 ? typingMessageRef : undefined}>
                  <div 
                    className="rounded-2xl px-4 py-3.5 text-base leading-relaxed"
                    style={{ 
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid rgba(0, 0, 0, 0.06)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div className="space-y-2">
                      {(isTyping && i === messages.length - 1 ? displayedContent : msg.content).split('\n').map((line, j) => {
                        const isCurrentlyTyping = isTyping && i === messages.length - 1;
                        const renderer = isCurrentlyTyping ? renderFadingWords : renderBold;
                        if (line.trim() === '') return <br key={j} />;
                        if (line.startsWith('- ') || line.startsWith('• ')) {
                          return <p key={j} className="pl-3 text-foreground/90">• {renderer(line.slice(2))}</p>;
                        }
                        return <p key={j} className="text-foreground/90">{renderer(line)}</p>;
                      })}
                      {isTyping && i === messages.length - 1 && (
                        <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  </div>
                  {!(isTyping && i === messages.length - 1) && (
                    <div className="flex items-center gap-1.5 pl-1">
                      {(() => {
                        const fbKey = getFeedbackKey(msg, i);
                        return (
                          <>
                            <button
                              onClick={() => submitFeedback(fbKey, 'positive', msg.content, messages[i - 1]?.content)}
                              className={`p-1 rounded-md transition-colors ${feedbackGiven[fbKey] === 'positive' ? 'text-green-500' : 'text-muted-foreground/40 hover:text-muted-foreground/70'}`}
                              disabled={!!feedbackGiven[fbKey]}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => submitFeedback(fbKey, 'negative', msg.content, messages[i - 1]?.content)}
                              className={`p-1 rounded-md transition-colors ${feedbackGiven[fbKey] === 'negative' ? 'text-red-500' : 'text-muted-foreground/40 hover:text-muted-foreground/70'}`}
                              disabled={!!feedbackGiven[fbKey]}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className="max-w-[75%] rounded-2xl px-4 py-2.5 text-base leading-relaxed text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, #0cc9a9 0%, #0ab393 100%)',
                    boxShadow: '0 1px 3px rgba(9, 181, 249, 0.2)',
                  }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          

          {chatMutation.isPending && (
            <div className="flex justify-start" style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
              <div 
                className="rounded-2xl px-4 py-3"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {!showHistory && suggestions.length > 0 && !hasUserMessages && !chatMutation.isPending && !isTyping && (
          <div className="border-t border-border/30 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 px-4 py-2 whitespace-nowrap" style={{ WebkitOverflowScrolling: 'touch' }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] text-foreground/70 transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: 'rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!showHistory && (
        <div className="border-t border-border/50 px-4 py-3 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 relative">
            <div className="relative" ref={plusMenuRef}>
              <button 
                className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-colors"
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                style={{
                  background: showPlusMenu ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                }}
              >
                {showPlusMenu ? <X className="h-5 w-5 text-foreground/70" /> : <Plus className="h-5 w-5 text-foreground/70" />}
              </button>

              {showPlusMenu && (
                <div 
                  className="absolute bottom-12 left-0 rounded-xl overflow-hidden z-50"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06)',
                    minWidth: '200px',
                  }}
                >
                  <button
                    onClick={handleNewConversation}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                    NEW CONVERSATION
                  </button>
                  <div className="h-px bg-border/50" />
                  <button
                    onClick={handleUploadImage}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    UPLOAD IMAGE
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Meridian Coach anything"
                className="w-full rounded-full border-0 text-sm h-10 pr-12 pl-4"
                style={{
                  background: 'rgba(0, 0, 0, 0.04)',
                }}
                disabled={chatMutation.isPending || isTyping}
              />
              {!input.trim() && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>

            {input.trim() && (
              <Button
                size="icon"
                className="rounded-full h-10 w-10 shrink-0 transition-all duration-150"
                style={{
                  background: 'linear-gradient(135deg, #0cc9a9 0%, #0ab393 100%)',
                }}
                onClick={() => sendMessage(input)}
                disabled={chatMutation.isPending || isTyping}
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            )}
          </div>
        </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
