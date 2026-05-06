import { useEffect, useMemo, useRef, useState, Component, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import MuxPlayer from "@mux/mux-player-react";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Clock, Hash, Play, Pause, RotateCcw, X, CheckCircle2 } from "lucide-react";
import { getMuxThumbnailUrl } from "@/lib/mux";
import type { WorkdayMicroReset } from "@shared/schema";

type FilterKey = "all" | "neck" | "upper_back" | "lower_back" | "hips" | "wrists";

const TARGET_AREAS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "neck", label: "Neck" },
  { key: "upper_back", label: "Upper Back" },
  { key: "lower_back", label: "Lower Back" },
  { key: "hips", label: "Hips" },
  { key: "wrists", label: "Wrists" },
];

function getExerciseType(reset: WorkdayMicroReset): "timed" | "reps" {
  return (reset as any).exerciseType === "reps" ? "reps" : "timed";
}

class MuxPlayerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          <p className="text-sm text-gray-400">Video unavailable</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MicroResetCard({
  reset,
  onOpen,
}: {
  reset: WorkdayMicroReset;
  onOpen: () => void;
}) {
  const isReps = getExerciseType(reset) === "reps";
  const thumb = getMuxThumbnailUrl(reset.muxPlaybackId, { width: 200 }) || reset.imageUrl || null;

  return (
    <Card
      className="bg-card border-border overflow-hidden cursor-pointer hover:border-[#0cc9a9]/40 transition-colors"
      onClick={onOpen}
      data-testid={`card-micro-reset-${reset.id}`}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            {thumb ? (
              <img src={thumb} alt={reset.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Zap className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-[#0cc9a9] flex items-center justify-center shadow-lg">
                <Play className="h-4 w-4 text-black fill-black ml-0.5" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm truncate">{reset.name}</h3>
              <div className="flex items-center gap-1 text-muted-foreground text-[11px] flex-shrink-0">
                {isReps ? <Hash className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                <span>{reset.duration}{isReps ? "" : "s"}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className="self-start mb-1.5 text-[10px] px-1.5 py-0 capitalize border-border text-muted-foreground"
            >
              {reset.targetArea.replace(/_/g, " ")}
            </Badge>
            <p className="text-xs text-muted-foreground line-clamp-2">{reset.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MicroResetSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-3 flex gap-3">
        <Skeleton className="h-20 w-20 rounded-lg bg-gray-700" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-700" />
          <Skeleton className="h-3 w-20 bg-gray-700" />
          <Skeleton className="h-3 w-full bg-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TIME_STEP = 5;
const TIME_MIN = 5;
const TIME_MAX = 600;
const TIME_OPTIONS: number[] = (() => {
  const arr: number[] = [];
  for (let s = TIME_MIN; s <= TIME_MAX; s += TIME_STEP) arr.push(s);
  return arr;
})();
const ITEM_HEIGHT = 44;

function TimeWheel({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedRef = useRef<number>(value);

  // Sync external value -> scroll position
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = TIME_OPTIONS.indexOf(value);
    if (idx < 0) return;
    const targetTop = idx * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      el.scrollTo({ top: targetTop, behavior: "auto" });
    }
    lastEmittedRef.current = value;
  }, [value]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || disabled) return;
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(TIME_OPTIONS.length - 1, idx));
      const v = TIME_OPTIONS[clamped];
      // Snap to exact position
      const targetTop = clamped * ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - targetTop) > 1) {
        el.scrollTo({ top: targetTop, behavior: "smooth" });
      }
      if (v !== lastEmittedRef.current) {
        lastEmittedRef.current = v;
        onChange(v);
      }
    }, 90);
  };

  return (
    <div className="relative w-full">
      {/* Center selection band */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[44px] rounded-lg border border-[#0cc9a9]/40 bg-[#0cc9a9]/10"
        aria-hidden
      />
      {/* Top/bottom fades */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-card to-transparent z-10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent z-10"
        aria-hidden
      />

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`relative h-[132px] overflow-y-scroll no-scrollbar ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
        data-testid="wheel-time"
      >
        <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
        {/* Top spacer so first item can center */}
        <div style={{ height: ITEM_HEIGHT }} aria-hidden />
        {TIME_OPTIONS.map((s) => {
          const selected = s === value;
          return (
            <div
              key={s}
              style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
              className={`flex items-center justify-center text-lg tabular-nums transition-colors ${
                selected
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {s}s
            </div>
          );
        })}
        {/* Bottom spacer so last item can center */}
        <div style={{ height: ITEM_HEIGHT }} aria-hidden />
      </div>
    </div>
  );
}

function ResetTimer({ suggestedSeconds }: { suggestedSeconds: number }) {
  const initial = (() => {
    const snapped = Math.round(suggestedSeconds / TIME_STEP) * TIME_STEP;
    return Math.max(TIME_MIN, Math.min(TIME_MAX, snapped));
  })();
  const [target, setTarget] = useState<number>(initial);
  const [secondsLeft, setSecondsLeft] = useState<number>(initial);
  const [running, setRunning] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep countdown in sync with target while idle
  useEffect(() => {
    if (!running) setSecondsLeft(target);
  }, [target, running]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          setCompleted(true);
          tryChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const tryChime = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      o.start(now);
      o.stop(now + 0.65);
    } catch {}
  };

  const toggle = () => {
    if (completed) {
      setSecondsLeft(target);
      setCompleted(false);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  };

  const reset_ = () => {
    setRunning(false);
    setCompleted(false);
    setSecondsLeft(target);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-5">
      <div className="mb-4">
        <div className="text-sm text-muted-foreground mb-2 text-center">
          Scroll to set time
        </div>
        <TimeWheel
          value={target}
          onChange={(v) => {
            setTarget(v);
            setCompleted(false);
          }}
          disabled={running}
        />
      </div>

      <div
        className={`w-full rounded-xl py-6 text-center mb-3 ${
          completed
            ? "bg-[#0cc9a9]/15 border border-[#0cc9a9]/40"
            : "bg-muted/40 border border-border"
        }`}
      >
        <div
          className="text-5xl font-bold text-foreground tabular-nums"
          data-testid="value-countdown"
        >
          {formatTime(secondsLeft)}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {completed ? "Done!" : running ? "Hold steady" : "Ready"}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
          onClick={toggle}
          data-testid="button-timer-toggle"
        >
          {running ? (
            <>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </>
          ) : completed ? (
            <>
              <RotateCcw className="h-4 w-4 mr-1" />
              Again
            </>
          ) : secondsLeft < target ? (
            <>
              <Play className="h-4 w-4 mr-1 fill-current" />
              Resume
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1 fill-current" />
              Start
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-border"
          onClick={reset_}
          disabled={!running && secondsLeft === target}
          data-testid="button-timer-reset"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function DoItSheet({ reset, onClose }: { reset: WorkdayMicroReset; onClose: () => void }) {
  const isReps = getExerciseType(reset) === "reps";

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" data-testid={`sheet-do-${reset.id}`}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <button
          onClick={onClose}
          className="text-foreground hover:text-muted-foreground transition-colors"
          data-testid="button-close-do-sheet"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-base font-semibold text-foreground truncate px-2">{reset.name}</h2>
        <div className="w-6" />
      </div>

      <div className="pb-12">
        {/* Video */}
        <div className="bg-black">
          {reset.muxPlaybackId && reset.muxPlaybackId.length >= 10 ? (
            <div className="aspect-video w-full">
              <MuxPlayerErrorBoundary>
                <MuxPlayer
                  playbackId={reset.muxPlaybackId}
                  streamType="on-demand"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%" }}
                  poster={getMuxThumbnailUrl(reset.muxPlaybackId) || undefined}
                  data-testid="mux-player-micro-reset"
                />
              </MuxPlayerErrorBoundary>
            </div>
          ) : reset.imageUrl ? (
            <div className="aspect-video w-full overflow-hidden">
              <img src={reset.imageUrl} alt={reset.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-video w-full bg-gray-900 flex items-center justify-center">
              <Zap className="h-12 w-12 text-gray-600" />
            </div>
          )}
        </div>

        <div className="px-4 pt-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 capitalize border-border text-muted-foreground"
            >
              {reset.targetArea.replace(/_/g, " ")}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {isReps ? <Hash className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {reset.duration}{isReps ? " reps" : "s"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-5">{reset.description}</p>

          {!isReps && reset.duration > 0 && (
            <ResetTimer suggestedSeconds={reset.duration} />
          )}

          {/* Steps - always visible, like Working Positions setup tips */}
          {reset.steps && reset.steps.length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Steps
              </h4>
              <div className="space-y-1.5">
                {reset.steps.map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0cc9a9] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground/80">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-border"
            onClick={onClose}
            data-testid="button-finish"
          >
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WorkdayMicroResets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: resets = [], isLoading } = useQuery<WorkdayMicroReset[]>({
    queryKey: ["/api/workday/micro-resets"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const filtered = useMemo(() => {
    if (filter === "all") return resets;
    return resets.filter((r) => r.targetArea === filter);
  }, [resets, filter]);

  const openReset = openId != null ? resets.find((r) => r.id === openId) ?? null : null;

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0cc9a9]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Micro-Resets" onBack={() => navigate("/recovery/desk-health")} />

      <div className="px-4 pt-14 pb-4">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-6 w-6 text-[#0cc9a9]" />
            <h1 className="text-xl font-bold text-foreground">Quick Resets</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Short movements to refresh your body without leaving your desk.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-hide">
          {TARGET_AREAS.map((area) => {
            const active = filter === area.key;
            return (
              <button
                key={area.key}
                onClick={() => setFilter(area.key)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#0cc9a9] border-[#0cc9a9] text-white"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`filter-${area.key}`}
              >
                {area.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <MicroResetSkeleton />
            <MicroResetSkeleton />
            <MicroResetSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {resets.length === 0
                ? "No micro-resets available yet"
                : "No micro-resets match this filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((reset) => (
              <MicroResetCard key={reset.id} reset={reset} onOpen={() => setOpenId(reset.id)} />
            ))}
          </div>
        )}
      </div>

      {openReset && <DoItSheet reset={openReset} onClose={() => setOpenId(null)} />}
    </div>
  );
}
