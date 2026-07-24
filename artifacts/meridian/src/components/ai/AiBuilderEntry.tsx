import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, MessageSquarePlus, BookOpen, Info, Search, Copy, ArrowLeft, Check,
  Hotel, Plane, Zap, Wind, User, Dumbbell, Flame, Shield, Footprints, Briefcase,
  Heart, Home, RefreshCw, Activity, MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AiBuilderKind = "workout" | "programme";

export interface AiPromptListItem {
  id: number;
  kind: string;
  title: string;
  description: string;
  iconName: string | null;
  promptBody: string;
  prefill: any;
  sortOrder: number;
  isActive: boolean;
}

interface Props {
  kind: AiBuilderKind;
  title: string;
  subtitle: string;
  /** Renders the modal/wizard. Receives the picked prompt (if any) and an
   *  open/close handler. Parent owns the dialog so prefill can flow naturally. */
  renderBuilder: (args: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prompt: AiPromptListItem | null;
    /** Bumps every time the user starts a new session ("New chat" or "Use this
     *  prompt"). Pass to the builder as `key` to guarantee a clean reset of
     *  internal form state. */
    sessionKey: number;
  }) => React.ReactNode;
}

// Whitelist of safe lucide icon names admins may set on a prompt. Anything
// else falls back to Sparkles. Keeps bundle small + avoids dynamic imports.
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Hotel, Plane, Zap, Wind, User, Dumbbell, Flame, Shield, Footprints,
  Briefcase, Heart, Home, RefreshCw,
};

function PromptIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICON_MAP[name]) || Sparkles;
  return <Icon className={className} />;
}

/**
 * Shared, branded entry surface for the AI Workout Builder and AI Programme
 * Builder. Same look in both places: sparkle icon, "AI · Beta" badge, "How it
 * works" popover, and two CTAs — "New chat" (opens the builder empty) or
 * "Prompt library" (opens a searchable library; pick a prompt to view its
 * detail, copy its text, or use it to prefill the builder).
 */
interface PersonalisationSignal {
  key: "burnout" | "bodyMap" | "equipment";
  label: string;
  description: string;
  icon: LucideIcon;
}

function PersonalisationSignals({ kind }: { kind: AiBuilderKind }) {
  const { data: burnout } = useQuery<{ score?: number } | null>({
    queryKey: ["/api/burnout/current"],
    queryFn: async () => {
      const res = await fetch("/api/burnout/current", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bodyMapLogs } = useQuery<Array<{ severity: number }>>({
    queryKey: ["/api/body-map"],
    queryFn: async () => {
      const res = await fetch("/api/body-map", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: user } = useQuery<{ onboardingData?: { coaching?: { equipment?: string[] } } } | null>({
    queryKey: ["/api/auth/user"],
  });

  const signals: PersonalisationSignal[] = [];

  if (burnout && typeof burnout.score === "number") {
    signals.push({
      key: "burnout",
      label: "burnout",
      icon: Activity,
      description:
        kind === "workout"
          ? "Your latest burnout score tunes today's intensity. Higher burnout dials the session toward recovery and lower volume."
          : "Your latest burnout score shapes how aggressively the programme ramps load week over week.",
    });
  }

  const activeBodyMap = (bodyMapLogs || []).some(l => typeof l.severity === "number" && l.severity > 0);
  if (activeBodyMap) {
    signals.push({
      key: "bodyMap",
      label: "body map",
      icon: MapPin,
      description:
        "Active body-map flags steer the AI away from movements that aggravate your reported areas and bias toward safer alternatives.",
    });
  }

  const userEquipment = user?.onboardingData?.coaching?.equipment;
  if (Array.isArray(userEquipment) && userEquipment.length > 0) {
    signals.push({
      key: "equipment",
      label: "equipment",
      icon: Dumbbell,
      description:
        "Your saved equipment access from onboarding limits the AI to exercises you can actually perform with what you have.",
    });
  }

  if (signals.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="mt-3 flex flex-wrap items-center gap-1.5"
        data-testid={`ai-personalisation-signals-${kind}`}
      >
        <span className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mr-0.5">
          Personalised with
        </span>
        {signals.map((s) => {
          const Icon = s.icon;
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-[#0cc9a9]/50 bg-[#0cc9a9]/10 text-[#0cc9a9] text-[10px] font-medium cursor-help hover:bg-[#0cc9a9]/15"
                  data-testid={`pill-signal-${s.key}-${kind}`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {s.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{s.description}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export default function AiBuilderEntry({ kind, title, subtitle, renderBuilder }: Props) {
  const { toast } = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activePrompt, setActivePrompt] = useState<AiPromptListItem | null>(null);
  const [detailPrompt, setDetailPrompt] = useState<AiPromptListItem | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const { data: prompts = [], isLoading } = useQuery<AiPromptListItem[]>({
    queryKey: ["/api/ai/prompts", { kind }],
    queryFn: async () => {
      const res = await fetch(`/api/ai/prompts?kind=${encodeURIComponent(kind)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
    enabled: libraryOpen,
  });

  const filteredPrompts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.promptBody.toLowerCase().includes(q)
    );
  }, [prompts, search]);

  const startNewChat = () => {
    setActivePrompt(null);
    setSessionKey(k => k + 1);
    setBuilderOpen(true);
  };

  const usePrompt = (p: AiPromptListItem) => {
    setActivePrompt(p);
    setSessionKey(k => k + 1);
    setLibraryOpen(false);
    setDetailPrompt(null);
    setSearch("");
    setBuilderOpen(true);
  };

  const copyPromptText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied", description: "Prompt text copied to clipboard." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked the copy.", variant: "destructive" });
    }
  };

  return (
    <>
      <div
        className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-[#0a3a32] text-white p-4 shadow-md border border-white/10"
        data-testid={`ai-builder-entry-${kind}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0cc9a9]/15 ring-1 ring-[#0cc9a9]/40 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">{title}</h3>
                <Badge
                  variant="outline"
                  className="border-[#0cc9a9]/60 text-[#0cc9a9] bg-[#0cc9a9]/10 text-[10px] uppercase tracking-wide font-semibold"
                >
                  AI · Beta
                </Badge>
              </div>
              <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10 h-7 px-2"
                data-testid={`button-how-it-works-${kind}`}
              >
                <Info className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">How it works</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm" align="end">
              <p className="font-semibold mb-1">How the AI {kind === "workout" ? "Workout" : "Programme"} Builder works</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs text-muted-foreground">
                <li>Start a <strong>new chat</strong> or pick a <strong>prompt</strong> from the library.</li>
                <li>Tweak the brief (duration, equipment, focus, contraindications).</li>
                <li>Generate, edit the draft, then save.</li>
              </ol>
              <p className="text-[11px] text-muted-foreground mt-2">
                AI suggestions are a starting point. Always check against your own training judgement.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <PersonalisationSignals kind={kind} />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            onClick={startNewChat}
            className="bg-[#0cc9a9] hover:bg-[#0bb398] text-slate-900 font-semibold"
            data-testid={`button-new-chat-${kind}`}
          >
            <MessageSquarePlus className="h-4 w-4 mr-1.5" />
            New chat
          </Button>
          <Button
            onClick={() => setLibraryOpen(true)}
            variant="outline"
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
            data-testid={`button-prompt-library-${kind}`}
          >
            <BookOpen className="h-4 w-4 mr-1.5" />
            Prompt library
          </Button>
        </div>
      </div>

      <Dialog
        open={libraryOpen}
        onOpenChange={(v) => {
          setLibraryOpen(v);
          if (!v) { setDetailPrompt(null); setSearch(""); }
        }}
      >
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
          data-testid={`dialog-prompt-library-${kind}`}
        >
          {!detailPrompt ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
                  {kind === "workout" ? "Workout" : "Programme"} prompt library
                </DialogTitle>
                <DialogDescription>
                  Curated starting points for busy executives. Tap one to preview, copy, or use.
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${kind} prompts…`}
                  className="pl-8"
                  data-testid={`input-prompt-search-${kind}`}
                />
              </div>
              <ScrollArea className="flex-1 -mx-6 px-6">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Loading prompts…</div>
                ) : filteredPrompts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    {search ? "No prompts match your search." : "No prompts yet."}
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    {filteredPrompts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setDetailPrompt(p)}
                        className="w-full text-left rounded-lg border border-border hover:border-[#0cc9a9]/60 hover:bg-[#0cc9a9]/5 p-3 transition-colors"
                        data-testid={`prompt-card-${p.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-md bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]/30 flex items-center justify-center shrink-0">
                            <PromptIcon name={p.iconName} className="h-4 w-4 text-[#0cc9a9]" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{p.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 -ml-1"
                    onClick={() => setDetailPrompt(null)}
                    data-testid="button-prompt-back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle className="flex items-center gap-2">
                    <PromptIcon name={detailPrompt.iconName} className="h-4 w-4 text-[#0cc9a9]" />
                    {detailPrompt.title}
                  </DialogTitle>
                </div>
                <DialogDescription>{detailPrompt.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-3 py-1">
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap"
                       data-testid="prompt-detail-body">
                    {detailPrompt.promptBody}
                  </div>
                  {detailPrompt.prefill && Object.keys(detailPrompt.prefill).length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Prefill</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(detailPrompt.prefill).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-[10px] font-normal">
                            {k}: {String(v)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyPromptText(detailPrompt.promptBody)}
                  data-testid="button-prompt-copy"
                >
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  {copied ? "Copied" : "Copy text"}
                </Button>
                <Button
                  className="bg-[#0cc9a9] hover:bg-[#0bb398] text-slate-900 font-semibold"
                  onClick={() => usePrompt(detailPrompt)}
                  data-testid="button-prompt-use"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Use this prompt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {renderBuilder({ open: builderOpen, onOpenChange: setBuilderOpen, prompt: activePrompt, sessionKey })}
    </>
  );
}
