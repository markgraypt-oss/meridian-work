import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import idealSeatedRef from "@assets/desk-references/ideal-seated.png";
import idealStandingRef from "@assets/desk-references/ideal-standing.png";
import { 
  Camera, 
  Upload, 
  Loader2, 
  Sparkles,
  Monitor,
  Armchair,
  ArrowUpDown,
  Check,
  ImageIcon,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Target,
  Volume2,
  Pause,
  Plus,
  Eye,
  RefreshCw,
  TrendingUp
} from "lucide-react";

type PositionType = "seated" | "standing" | "alternative";

interface AnalysisIssue {
  category: string;
  status: "good" | "needs_improvement" | "critical";
  observation: string;
  recommendation: string;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  confidence?: "visible" | "likely" | "unclear";
}

interface AnalysisResult {
  score: number;
  summary: string;
  issues: AnalysisIssue[];
  priorityFixes: string[];
  rawResponse?: string;
}

interface DeskScanRow {
  id: number;
  score: number | null;
  scanDate: string | null;
  createdAt: string | null;
  positionType: string;
}

interface DeskFixTask {
  id: number;
  scanId: number | null;
  category: string;
  observation: string;
  recommendation: string;
  status: 'todo' | 'done';
}

function getConfidenceLabel(c?: string) {
  if (c === 'visible') return { label: 'Clearly visible', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (c === 'likely') return { label: 'Likely', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (c === 'unclear') return { label: 'Hard to tell', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  return null;
}

function getStatusColor(status: string) {
  switch (status) {
    case "critical": return { dot: "bg-red-500", border: "border-red-500/40", badge: "bg-red-500/15 text-red-400 border-red-500/30", label: "High" };
    case "needs_improvement": return { dot: "bg-[#0cc9a9]", border: "border-[#0cc9a9]/40", badge: "bg-[#0cc9a9]/15 text-[#0cc9a9] border-[#0cc9a9]/30", label: "Medium" };
    case "good": return { dot: "bg-emerald-500", border: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Good" };
    default: return { dot: "bg-gray-500", border: "border-gray-500/40", badge: "bg-gray-500/15 text-gray-400 border-gray-500/30", label: "Info" };
  }
}

function ScoreRing({ score }: { score: number }) {
  const [animatedOffset, setAnimatedOffset] = useState<number | null>(null);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 10) * circumference;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAnimatedOffset(targetOffset);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetOffset]);

  const getStrokeColor = () => {
    if (score >= 8) return "#10b981";
    if (score >= 5) return "#0cc9a9";
    return "#ef4444";
  };

  return (
    <div className="relative w-[100px] h-[100px] flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={getStrokeColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset === null ? circumference : animatedOffset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
      </div>
    </div>
  );
}

export default function WorkdayDeskScan() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  
  const [positionType, setPositionType] = useState<PositionType>("seated");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [pendingAction, setPendingAction] = useState<"camera" | "upload" | null>(null);
  const [deskFeedback, setDeskFeedback] = useState<'positive' | 'negative' | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [scanId, setScanId] = useState<number | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const issueRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // History for "score over time" chart
  const { data: scanHistory = [] } = useQuery<DeskScanRow[]>({
    queryKey: ['/api/workday/scans'],
    enabled: isAuthenticated,
  });

  // Existing per-user fix tasks - to grey out "Add to my plan" buttons that
  // are already added.
  const { data: fixTasks = [] } = useQuery<DeskFixTask[]>({
    queryKey: ['/api/workday/desk-fix-tasks'],
    enabled: isAuthenticated,
  });

  const addedKey = (issue: AnalysisIssue) => `${issue.category}::${issue.observation}`;
  const addedSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of fixTasks) {
      if (scanId && t.scanId === scanId) s.add(`${t.category}::${t.observation}`);
    }
    return s;
  }, [fixTasks, scanId]);

  const addToPlanMutation = useMutation({
    mutationFn: async (issue: AnalysisIssue) => {
      const res = await apiRequest('POST', '/api/workday/desk-fix-tasks', {
        scanId,
        category: issue.category,
        observation: issue.observation,
        recommendation: issue.recommendation,
        status: 'todo',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workday/desk-fix-tasks'] });
      toast({ title: 'Added to your plan', description: 'Find it in your desk fix tasks.' });
    },
    onError: () => {
      toast({ title: "Couldn't add that one", description: 'Try again in a moment.', variant: 'destructive' });
    },
  });

  // Build chart data - oldest -> newest, only scans with a numeric score
  const chartData = useMemo(() => {
    return [...scanHistory]
      .filter(s => typeof s.score === 'number')
      .sort((a, b) => {
        const ad = new Date(a.scanDate || a.createdAt || 0).getTime();
        const bd = new Date(b.scanDate || b.createdAt || 0).getTime();
        return ad - bd;
      })
      .slice(-10)
      .map((s, i) => ({
        idx: i + 1,
        score: s.score,
        date: new Date(s.scanDate || s.createdAt || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      }));
  }, [scanHistory]);

  const audioUrlRef = useRef<string | null>(null);
  const revokeAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
  };

  const handlePlayAudio = async () => {
    if (!scanId) return;
    if (audioRef.current && audioState === 'playing') {
      audioRef.current.pause();
      setAudioState('paused');
      return;
    }
    if (audioRef.current && audioState === 'paused') {
      audioRef.current.play();
      setAudioState('playing');
      return;
    }
    try {
      setAudioState('loading');
      const res = await fetch(`/api/workday/scans/${scanId}/audio`, { credentials: 'include' });
      if (!res.ok) throw new Error('audio fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setAudioState('idle'); revokeAudio(); };
      audio.onerror = () => { setAudioState('idle'); revokeAudio(); };
      audioRef.current = audio;
      audioUrlRef.current = url;
      await audio.play();
      setAudioState('playing');
    } catch {
      setAudioState('idle');
      revokeAudio();
      toast({ title: "Couldn't load voice summary", description: 'Try again in a moment.', variant: 'destructive' });
    }
  };

  // Stop audio + free blob URL when scan changes / unmounts
  useEffect(() => {
    return () => {
      revokeAudio();
    };
  }, []);

  // Reset audio state when the scan changes (new analysis = new audio)
  useEffect(() => {
    revokeAudio();
    setAudioState('idle');
  }, [scanId]);

  const handleMarkerClick = (idx: number) => {
    setActiveMarker(idx);
    setExpandedIssue(idx);
    const el = issueRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setActiveMarker(null), 1500);
  };

  const handleRescan = () => {
    // Reset to the upload state so the user can pick another photo.
    setImagePreview(null);
    setAnalysis(null);
    setScanId(null);
    setExpandedIssue(null);
    revokeAudio();
    setAudioState('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitDeskFeedback = async (rating: 'positive' | 'negative') => {
    if (deskFeedback) return;
    setDeskFeedback(rating);
    try {
      await apiRequest('POST', '/api/ai-feedback', {
        feature: 'desk_analyzer',
        rating,
        aiMessage: analysis?.summary || '',
        context: { score: analysis?.score, positionType },
      });
    } catch {}
  };

  const analyzeMutation = useMutation({
    mutationFn: async (data: { imageBase64: string; positionType: string }): Promise<{ scanId: number; analysis: AnalysisResult }> => {
      const response = await apiRequest('POST', '/api/workday/analyze-desk', data);
      return response.json();
    },
    onSuccess: (data: { scanId: number; analysis: AnalysisResult }) => {
      setAnalysis(data.analysis);
      setScanId(data.scanId);
      queryClient.invalidateQueries({ queryKey: ['/api/workday/scans'] });
      toast({ 
        title: "Analysis complete!", 
        description: `Your desk scored ${data.analysis.score || 'N/A'}/10` 
      });
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Couldn't read that image. Try a clearer JPG or PNG.",
        variant: "destructive"
      });
    }
  });

  const downscaleImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onerror = () => reject(new Error("Could not decode image"));
        img.onload = () => {
          // Anthropic caps at 5 MB. Resize to max 1600px on the longest side
          // and re-encode as JPEG at 0.85 quality, which keeps plenty of detail
          // for ergonomic analysis while comfortably staying under the limit.
          const MAX_DIM = 1600;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width >= height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not supported"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await downscaleImage(file);
      setImagePreview(base64);
      setAnalysis(null);
    } catch {
      toast({
        title: "Couldn't load that image",
        description: "Try another photo.",
        variant: "destructive",
      });
    }
  };

  const handleAnalyze = () => {
    if (!imagePreview) {
      toast({ title: "Please upload an image first", variant: "destructive" });
      return;
    }
    analyzeMutation.mutate({ imageBase64: imagePreview, positionType });
  };

  const handleUploadClick = (action: "camera" | "upload") => {
    setPendingAction(action);
    setShowPhotoTips(true);
  };

  const handleProceedWithPhoto = () => {
    setShowPhotoTips(false);
    if (fileInputRef.current && pendingAction) {
      if (pendingAction === "camera") {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
    setPendingAction(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0cc9a9]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader 
        title="AI Desk Analyzer" 
        onBack={() => navigate("/recovery/desk-health")} 
      />
      
      <main className="px-4 pt-14 pb-4 space-y-6">
        <Card className="bg-gradient-to-br from-[#0cc9a9]/20 to-[#0cc9a9]/5 border-[#0cc9a9]/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
              <h2 className="font-semibold text-[#0cc9a9]">AI-Powered Analysis</h2>
            </div>
            <p className="text-sm text-foreground/80">
              Upload a photo of your desk setup and our AI will analyze your ergonomics, 
              providing personalized recommendations to reduce pain and improve productivity.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Select Your Position</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: "seated" as PositionType, label: "Seated", icon: Armchair },
              { type: "standing" as PositionType, label: "Standing", icon: ArrowUpDown },
              { type: "alternative" as PositionType, label: "Other", icon: Monitor },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setPositionType(type)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  positionType === type
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10"
                    : "border-border bg-card hover:border-gray-600"
                }`}
              >
                <Icon className={`h-6 w-6 ${positionType === type ? "text-[#0cc9a9]" : "text-muted-foreground"}`} />
                <span className={`text-sm ${positionType === type ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Desk preview"
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                  {/* Annotated markers overlay - only after analysis */}
                  {Array.isArray(analysis?.issues) && analysis!.issues.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none">
                      {analysis!.issues
                        .map((issue, idx) => ({ issue, idx }))
                        .filter(({ issue }) =>
                          issue && issue.bbox &&
                          typeof issue.bbox.x === 'number' && typeof issue.bbox.y === 'number' &&
                          typeof issue.bbox.w === 'number' && typeof issue.bbox.h === 'number' &&
                          issue.status !== 'good'
                        )
                        .map(({ issue, idx }) => {
                          const { x, y, w, h } = issue.bbox!;
                          const colors = getStatusColor(issue.status);
                          const isActive = activeMarker === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleMarkerClick(idx)}
                              className={`absolute pointer-events-auto rounded-md border-2 transition-all ${colors.border} ${isActive ? 'ring-4 ring-white/40 scale-105' : ''}`}
                              style={{
                                left: `${Math.max(0, Math.min(100, x))}%`,
                                top: `${Math.max(0, Math.min(100, y))}%`,
                                width: `${Math.max(2, Math.min(100 - x, w))}%`,
                                height: `${Math.max(2, Math.min(100 - y, h))}%`,
                                background: 'rgba(0,0,0,0.05)',
                              }}
                              data-testid={`marker-issue-${idx}`}
                              aria-label={`Jump to fix: ${issue.observation}`}
                            >
                              <span className={`absolute -top-3 -left-3 w-7 h-7 rounded-full ${colors.dot} text-white text-xs font-bold flex items-center justify-center shadow-lg border-2 border-background`}>
                                {idx + 1}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setImagePreview(null);
                      setAnalysis(null);
                      setScanId(null);
                    }}
                    className="absolute top-3 right-3"
                  >
                    Change
                  </Button>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze My Setup
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
                  <div className="flex flex-col items-center gap-3 mb-4">
                    <div className="p-4 rounded-full bg-[#0cc9a9]/10">
                      <Camera className="h-8 w-8 text-[#0cc9a9]" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Capture your full desk setup including monitor, chair, and keyboard
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#0cc9a9] text-[#0cc9a9] hover:bg-[#0cc9a9]/10"
                      onClick={() => handleUploadClick("upload")}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <Button
                      className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                      onClick={() => handleUploadClick("camera")}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {analysis && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-[#0cc9a9]" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">AI desk scan results</span>
                </div>

                <Card className="bg-background/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <ScoreRing score={analysis.score || 0} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[#0cc9a9]">
                          Ergonomic score: {analysis.score || 0}/10
                        </h3>
                        <p className="text-sm text-foreground/70 mt-1">
                          {analysis.summary}
                        </p>
                        {scanId && (
                          <button
                            onClick={handlePlayAudio}
                            disabled={audioState === 'loading'}
                            className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-[#0cc9a9]/15 text-[#0cc9a9] border border-[#0cc9a9]/30 hover:bg-[#0cc9a9]/25 transition-colors disabled:opacity-60"
                            data-testid="button-play-summary"
                          >
                            {audioState === 'loading' ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</>
                            ) : audioState === 'playing' ? (
                              <><Pause className="h-3.5 w-3.5" /> Pause summary</>
                            ) : (
                              <><Volume2 className="h-3.5 w-3.5" /> Play summary</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Score over time chart - shows trend if user has 2+ scored scans */}
                {chartData.length >= 2 && (
                  <div className="mt-4 p-3 rounded-lg bg-background/40 border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-[#0cc9a9]" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your score trend</span>
                    </div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#0e1114', border: '1px solid rgba(12,201,169,0.3)', borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: '#0cc9a9' }}
                          />
                          <Line type="monotone" dataKey="score" stroke="#0cc9a9" strokeWidth={2} dot={{ fill: '#0cc9a9', r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Last {chartData.length} scans
                    </p>
                  </div>
                )}
                {chartData.length === 1 && (
                  <div className="mt-4 p-3 rounded-lg bg-background/40 border border-border/40 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      First scan saved. Rescan after making a change to start tracking your trend.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground mr-1">Was this helpful?</span>
                  <button
                    onClick={() => submitDeskFeedback('positive')}
                    className={`p-1.5 rounded-md transition-colors ${deskFeedback === 'positive' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                    disabled={!!deskFeedback}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => submitDeskFeedback('negative')}
                    className={`p-1.5 rounded-md transition-colors ${deskFeedback === 'negative' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                    disabled={!!deskFeedback}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {Array.isArray(analysis.issues) && analysis.issues.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Priority Fixes
                </h3>
                {analysis.issues
                  .filter((i: any) => i && typeof i.observation === 'string' && typeof i.status === 'string')
                  .map((issue, originalIdx) => ({ issue, originalIdx }))
                  .sort((a, b) => {
                    const order = { critical: 0, needs_improvement: 1, good: 2 };
                    return (order[a.issue.status] ?? 3) - (order[b.issue.status] ?? 3);
                  })
                  .map(({ issue, originalIdx }) => {
                    const colors = getStatusColor(issue.status);
                    const isExpanded = expandedIssue === originalIdx;
                    const isExpandable = issue.status !== "good";
                    const conf = getConfidenceLabel(issue.confidence);
                    const isAdded = addedSet.has(addedKey(issue));
                    const hasMarker = !!issue.bbox && issue.status !== 'good';
                    return (
                      <Card
                        key={originalIdx}
                        ref={(el) => { issueRefs.current[originalIdx] = el; }}
                        className={`bg-card border ${colors.border} transition-all ${activeMarker === originalIdx ? 'ring-2 ring-[#0cc9a9]/60' : ''}`}
                      >
                        <CardContent className="p-0">
                          <div
                            role={isExpandable ? "button" : undefined}
                            tabIndex={isExpandable ? 0 : undefined}
                            onClick={() => isExpandable && setExpandedIssue(isExpanded ? null : originalIdx)}
                            onKeyDown={(e) => isExpandable && (e.key === "Enter" || e.key === " ") && setExpandedIssue(isExpanded ? null : originalIdx)}
                            className={`w-full p-4 text-left ${isExpandable ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              {hasMarker ? (
                                <span className={`w-6 h-6 rounded-full ${colors.dot} text-white text-xs font-bold flex items-center justify-center mt-0.5 flex-shrink-0`}>
                                  {originalIdx + 1}
                                </span>
                              ) : (
                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} mt-1.5 flex-shrink-0`} />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground/90 leading-relaxed">
                                  {issue.observation}
                                </p>
                                {conf && (
                                  <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${conf.cls}`}>
                                    {conf.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors.badge}`}>
                                  {colors.label}
                                </span>
                                {isExpandable && (
                                  isExpanded 
                                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && issue.status !== "good" && (
                            <div className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="ml-5 pl-3 border-l-2 border-[#0cc9a9]/30">
                                <p className="text-sm text-foreground/70 mb-3">
                                  {issue.recommendation}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-[#0cc9a9]/50 text-[#0cc9a9] hover:bg-[#0cc9a9]/10 hover:text-[#0cc9a9]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate("/recovery/desk-health/positions");
                                    }}
                                  >
                                    View fix
                                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isAdded || addToPlanMutation.isPending || !scanId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToPlanMutation.mutate(issue);
                                    }}
                                    className="border-[#0cc9a9]/50 text-[#0cc9a9] hover:bg-[#0cc9a9]/10 hover:text-[#0cc9a9] disabled:opacity-60"
                                    data-testid={`button-add-to-plan-${originalIdx}`}
                                  >
                                    {isAdded ? (
                                      <><Check className="h-3.5 w-3.5 mr-1.5" /> In your plan</>
                                    ) : (
                                      <><Plus className="h-3.5 w-3.5 mr-1.5" /> Add to my plan</>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}

            {analysis.rawResponse && !analysis.issues && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3">Analysis</h3>
                  <p className="text-foreground/80 whitespace-pre-wrap">{analysis.rawResponse}</p>
                </CardContent>
              </Card>
            )}

            {/* See an ideal setup - reference photo for current position */}
            {(positionType === 'seated' || positionType === 'standing') && (
              <Card className="bg-card border-border">
                <CardContent className="p-0">
                  <button
                    onClick={() => setShowReference(v => !v)}
                    className="w-full flex items-center justify-between p-4 text-left"
                    data-testid="button-toggle-reference"
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-[#0cc9a9]" />
                      <span className="text-sm font-medium text-foreground">See an ideal {positionType} setup</span>
                    </div>
                    {showReference ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showReference && (
                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="rounded-lg overflow-hidden bg-black/40">
                        <img
                          src={positionType === 'standing' ? idealStandingRef : idealSeatedRef}
                          alt={`Ideal ${positionType} desk setup`}
                          className="w-full h-auto"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Reference example. Yours doesn't have to match exactly.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fix one, rescan CTA - keeps the loop going */}
            <Card className="bg-gradient-to-br from-[#0cc9a9]/15 to-[#0cc9a9]/5 border-[#0cc9a9]/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-full bg-[#0cc9a9]/20 flex-shrink-0">
                    <RefreshCw className="h-4 w-4 text-[#0cc9a9]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Fixed one of these?</h4>
                    <p className="text-xs text-foreground/70 mt-0.5">
                      Rescan to see your score climb.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleRescan}
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
                  data-testid="button-rescan"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Rescan my desk
                </Button>
              </CardContent>
            </Card>

            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full border-[#0cc9a9]/50 text-[#0cc9a9] hover:bg-[#0cc9a9]/10 h-12"
                onClick={() => navigate("/recovery/desk-health/positions")}
              >
                Explore Working Positions
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Set up your ideal position rotation to stay comfortable all day
              </p>
            </div>
          </div>
        )}
      </main>

      <Dialog open={showPhotoTips} onOpenChange={setShowPhotoTips}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-[#0cc9a9]" />
              Photo Tips
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-8 flex items-center justify-center border-2 border-dashed border-gray-600">
              <div className="text-center">
                <Monitor className="h-16 w-16 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Example image placeholder</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground">For the best analysis, include:</h4>
              <ul className="space-y-2">
                {[
                  "Your monitor at its normal position",
                  "Keyboard and mouse visible",
                  "Your chair (back and armrests)",
                  "Overall desk layout clearly framed",
                  "Good lighting (avoid glare)"
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0cc9a9]/10 border border-[#0cc9a9] rounded-lg p-3">
              <p className="text-sm text-[#0cc9a9]">
                <strong>Tip:</strong> Stand back 3-4 feet to capture your entire setup in frame.
              </p>
            </div>

            <Button 
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
              onClick={handleProceedWithPhoto}
            >
              {pendingAction === "camera" ? (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Open Camera
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
