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
import {
  Zap,
  Clock,
  Hash,
  Play,
  Pause,
  RotateCcw,
  Minus,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function DoItSheet({ reset, onClose }: { reset: WorkdayMicroReset; onClose: () => void }) {
  const isReps = getExerciseType(reset) === "reps";
  const stepSize = isReps ? 1 : 5;
  const minVal = 1;
  const maxVal = isReps ? 50 : 600;

  const initialTarget = reset.duration || (isReps ? 10 : 60);
  const [target, setTarget] = useState<number>(initialTarget);

  // Timer state (timed only)
  const [secondsLeft, setSecondsLeft] = useState<number>(initialTarget);
  const [running, setRunning] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);

  // Reps state
  const [count, setCount] = useState<number>(0);

  const [stepsOpen, setStepsOpen] = useState<boolean>(false);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Reset secondsLeft when target changes (only while not running and timed)
  useEffect(() => {
    if (!isReps && !running) setSecondsLeft(target);
  }, [target, running, isReps]);

  // Countdown
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isReps || !running) return;
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
  }, [running, isReps]);

  // Soft chime using WebAudio (no asset needed)
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

  const startOrPause = () => {
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

  const incCount = () => {
    setCount((c) => {
      const next = c + 1;
      if (next >= target) {
        setCompleted(true);
        tryChime();
      }
      return next;
    });
  };

  const decCount = () => {
    setCount((c) => Math.max(0, c - 1));
    if (completed) setCompleted(false);
  };

  const resetReps = () => {
    setCount(0);
    setCompleted(false);
  };

  const adjustTarget = (delta: number) => {
    setTarget((t) => Math.max(minVal, Math.min(maxVal, t + delta)));
    if (isReps) {
      setCount(0);
      setCompleted(false);
    }
  };

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
            <span className="text-xs text-muted-foreground">
              Suggested: {reset.duration}{isReps ? " reps" : "s"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{reset.description}</p>

          {/* Target picker */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {isReps ? "How many reps?" : "How long?"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border"
                  onClick={() => adjustTarget(-stepSize)}
                  disabled={target <= minVal || running}
                  data-testid="button-target-decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span
                  className="text-base font-semibold text-foreground min-w-[5rem] text-center"
                  data-testid="value-target"
                >
                  {target} {isReps ? "reps" : "s"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border"
                  onClick={() => adjustTarget(stepSize)}
                  disabled={target >= maxVal || running}
                  data-testid="button-target-increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Big readout */}
            {isReps ? (
              <button
                type="button"
                onClick={incCount}
                className={`w-full rounded-xl py-8 text-center transition-colors ${
                  completed
                    ? "bg-[#0cc9a9]/15 border border-[#0cc9a9]/40"
                    : "bg-muted/40 hover:bg-muted/60 border border-border"
                }`}
                data-testid="button-tap-count"
              >
                <div className="text-5xl font-bold text-foreground tabular-nums">
                  {count}
                  <span className="text-2xl text-muted-foreground"> / {target}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {completed ? "Done!" : "Tap to count"}
                </div>
              </button>
            ) : (
              <div
                className={`w-full rounded-xl py-8 text-center ${
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
            )}

            {/* Controls */}
            <div className="flex gap-2 mt-4">
              {isReps ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-border"
                    onClick={decCount}
                    disabled={count <= 0}
                    data-testid="button-rep-undo"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Undo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-border"
                    onClick={resetReps}
                    disabled={count === 0}
                    data-testid="button-rep-reset"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                    onClick={startOrPause}
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
                </>
              )}
            </div>

            {completed && (
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[#0cc9a9] text-sm font-medium">
                <Check className="h-4 w-4" />
                Nice work
              </div>
            )}
          </div>

          {/* Steps */}
          {reset.steps && reset.steps.length > 0 && (
            <div className="bg-card border border-border rounded-xl">
              <button
                type="button"
                onClick={() => setStepsOpen((o) => !o)}
                className="w-full flex items-center justify-between p-4 text-left"
                data-testid="button-toggle-steps"
              >
                <span className="text-sm font-medium text-foreground">Steps</span>
                {stepsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {stepsOpen && (
                <ol className="px-4 pb-4 space-y-2 list-decimal list-inside">
                  {reset.steps.map((step: string, index: number) => (
                    <li key={index} className="text-sm text-foreground/80 pl-1">
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4 border-border"
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
