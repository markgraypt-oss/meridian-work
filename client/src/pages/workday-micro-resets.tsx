import { useEffect, useMemo, useState, Component, ReactNode } from "react";
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
import { Zap, Clock, Hash, Play, X, CheckCircle2 } from "lucide-react";
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
