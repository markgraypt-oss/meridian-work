import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  ChevronRight,
  Zap,
  Wind,
  Monitor,
  Armchair,
  RotateCcw,
  Brain,
  Headphones,
  BookHeart,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import type { WorkdayPosition, WorkdayMicroReset } from "@shared/schema";

interface WorkdayProfileData {
  rotationInterval: number | null;
  preferredPositions: string[] | null;
}

interface BurnoutScoreData {
  score: number;
  trajectory: string;
  confidence: string;
  topDrivers: { key: string; label: string; explanation: string; trend: string; weight: number }[];
  computedDate: string;
}

interface BurnoutSettingsData {
  recoveryModeEnabled: boolean;
}

function getScoreLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score <= 20) return { label: "Optimal", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-500/10" };
  if (score <= 40) return { label: "Balanced", color: "text-teal-700 dark:text-teal-300", bgColor: "bg-teal-50 dark:bg-teal-500/10" };
  if (score <= 60) return { label: "Strained", color: "text-[#0cc9a9] dark:text-[#0cc9a9]", bgColor: "bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/10" };
  if (score <= 80) return { label: "Overloaded", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-500/10" };
  return { label: "Sustained Overload", color: "text-red-800/80 dark:text-red-300/60", bgColor: "bg-red-50 dark:bg-red-500/6" };
}

function WorkdayWellnessCard({ onClick }: { onClick: () => void }) {
  const { data: positions } = useQuery<WorkdayPosition[]>({
    queryKey: ["/api/workday/positions"],
  });

  const { data: microResets } = useQuery<WorkdayMicroReset[]>({
    queryKey: ["/api/workday/micro-resets"],
  });

  const { data: profile } = useQuery<WorkdayProfileData | null>({
    queryKey: ["/api/workday/profile"],
  });

  const positionCount = positions?.length || 0;
  const resetCount = microResets?.filter(r => r.isActive)?.length || 0;
  const hasProfile = !!profile;
  const hasRotation = hasProfile && profile.rotationInterval && profile.rotationInterval > 0;
  const preferredCount = profile?.preferredPositions?.length || 0;

  function getNextAction(): { icon: typeof Armchair; text: string; subtext: string } {
    if (positionCount === 0) {
      return {
        icon: Armchair,
        text: "Explore working positions to get started",
        subtext: "Discover seated, standing, and movement options",
      };
    }
    if (!hasProfile || preferredCount === 0) {
      return {
        icon: RotateCcw,
        text: "Set up your position rotation schedule",
        subtext: `${positionCount} positions available to rotate between`,
      };
    }
    if (!hasRotation) {
      return {
        icon: RotateCcw,
        text: "Choose a rotation interval to stay comfortable",
        subtext: `${preferredCount} preferred position${preferredCount !== 1 ? "s" : ""} saved`,
      };
    }
    return {
      icon: Zap,
      text: `Try a 2-min micro-reset between rotations`,
      subtext: `${resetCount} reset${resetCount !== 1 ? "s" : ""} available · ${profile.rotationInterval}min rotation`,
    };
  }

  const action = getNextAction();
  const ActionIcon = action.icon;

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.98] bg-card border border-border/60 shadow-sm"
      onClick={onClick}
      data-testid="block-workday-wellness"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <Monitor className="h-5 w-5 text-purple-400" />
            </div>
            <span className="text-base font-bold text-foreground">Workday Wellness</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 mt-0.5">
              <ActionIcon className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{action.text}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{action.subtext}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Armchair className="h-3 w-3 text-purple-400/60" />
            <span className="tabular-nums font-medium text-foreground">{positionCount}</span> position{positionCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-orange-400/60" />
            <span className="tabular-nums font-medium text-foreground">{resetCount}</span> reset{resetCount !== 1 ? "s" : ""}
          </span>
          {hasRotation && (
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-3 w-3 text-teal-400/60" />
              <span className="tabular-nums font-medium text-foreground">{profile.rotationInterval}m</span> rotation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BurnoutEntryCard({ onClick }: { onClick: () => void }) {
  const { data: currentScore, isLoading } = useQuery<BurnoutScoreData>({
    queryKey: ["/api/burnout/current"],
  });

  const { data: settings } = useQuery<BurnoutSettingsData>({
    queryKey: ["/api/burnout/settings"],
  });

  const { data: historyData } = useQuery<BurnoutScoreData[]>({
    queryKey: ["/api/burnout/history", "3m"],
    queryFn: async () => {
      const res = await fetch("/api/burnout/history?range=3m", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const sparklineData = (historyData || []).map((d) => ({
    score: d.score,
  }));

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-5 cursor-pointer" onClick={onClick}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.98] bg-card border border-border/60 shadow-sm"
      onClick={onClick}
      data-testid="block-burnout-warning"
    >
      <div className="p-5">
        {currentScore ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
                  <Zap className="h-5 w-5 text-[#0cc9a9]" />
                </div>
                <span className="text-base font-bold text-foreground">Burnout Early Warning</span>
                {settings?.recoveryModeEnabled && (
                  <span className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 rounded-full px-2 py-0.5">
                    <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Recovery</span>
                  </span>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
                    {currentScore.score}
                  </span>
                  <span className="text-base text-muted-foreground font-medium">/ 100</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider font-medium">Burnout Index</div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                {(() => {
                  const level = getScoreLevel(currentScore.score);
                  return (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${level.bgColor}`}>
                      <span className={`text-sm font-semibold ${level.color}`}>{level.label}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {sparklineData.length > 2 && (
              <div className="h-12 -mx-1 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <defs>
                      <linearGradient id="sparkGradRecov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0cc9a9" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0cc9a9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#0cc9a9"
                      strokeWidth={1.5}
                      fill="url(#sparkGradRecov)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {currentScore.topDrivers && (currentScore.topDrivers as any[]).length > 0 && (
              <p className="text-xs text-muted-foreground truncate leading-relaxed">
                {(currentScore.topDrivers as any[])[0]?.explanation}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
                <Zap className="h-5 w-5 text-[#0cc9a9]" />
              </div>
              <div>
                <span className="text-base font-bold text-foreground block">Burnout Early Warning</span>
                <span className="text-sm text-muted-foreground">Check in daily to unlock insights</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

const mindfulnessFeatures = [
  {
    icon: Headphones,
    label: "Guided Meditations",
    tagline: "Find your calm",
    detail: "12 sessions available",
    color: "text-[#0cc9a9]",
    bgColor: "bg-[#0cc9a9]/10",
  },
  {
    icon: BookHeart,
    label: "Gratitude Journal",
    tagline: "Reflect & appreciate",
    detail: "Today: What made you smile?",
    color: "text-[#0cc9a9]",
    bgColor: "bg-[#0cc9a9]/10",
  },
  {
    icon: Waves,
    label: "Soundscapes",
    tagline: "Immerse & unwind",
    detail: "Rain, ocean, forest & more",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
  },
];

function MindfulnessCard({ onClick }: { onClick: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swiped = useRef(false);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % mindfulnessFeatures.length);
    }, 4000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
    resetTimer();
  }, [resetTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiped.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (swiped.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) {
        goTo((activeIndex + 1) % mindfulnessFeatures.length);
      } else {
        goTo((activeIndex - 1 + mindfulnessFeatures.length) % mindfulnessFeatures.length);
      }
    }
  }, [activeIndex, goTo]);

  const handleTouchEnd = useCallback(() => {
    swiped.current = false;
  }, []);

  const feature = mindfulnessFeatures[activeIndex];
  const FeatureIcon = feature.icon;

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.98] bg-card border border-border/60 shadow-sm"
      onClick={(e) => { if (!swiped.current) onClick(); }}
      data-testid="block-mindfulness"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
              <Brain className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <span className="text-base font-bold text-foreground">Mindfulness Tools</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>

        <div
          className={`relative min-h-[72px] rounded-xl p-4 transition-colors duration-500 ${feature.bgColor} touch-pan-y`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            key={activeIndex}
            className="animate-in fade-in duration-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <FeatureIcon className={`h-4 w-4 ${feature.color}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${feature.color}`}>{feature.label}</span>
                </div>
                <p className="text-[15px] font-bold text-foreground">{feature.tagline}</p>
                <p className="text-xs text-muted-foreground mt-2.5">{feature.detail}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-4">
          {mindfulnessFeatures.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-6 bg-[#0cc9a9]"
                  : "w-2 bg-gray-400/50 dark:bg-gray-500/50 hover:bg-gray-500/70"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BreathworkCard({ onClick }: { onClick: () => void }) {
  const { data: stats, isLoading } = useQuery<{ totalSessions: number; totalMinutes: number; currentStreak: number }>({
    queryKey: ["/api/breathwork/stats"],
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-5 cursor-pointer" onClick={onClick}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  const totalSessions = stats?.totalSessions || 0;
  const totalMinutes = stats?.totalMinutes || 0;
  const streak = stats?.currentStreak || 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all active:scale-[0.98] bg-card border border-border/60 shadow-sm"
      onClick={onClick}
      data-testid="block-breathwork"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
              <Wind className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <span className="text-base font-bold text-foreground">Breath Work Hub</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="relative min-h-[130px]">
          <div className="flex flex-col justify-center items-start gap-3.5 absolute left-0 top-1/2 -translate-y-1/2">
            <span className="inline-flex px-2.5 py-1 rounded-lg bg-[#0cc9a9]/10 w-auto">
              <span className="text-[11px] font-semibold text-[#0cc9a9] uppercase tracking-wider">Streak</span>
            </span>
            <span className="inline-flex px-2.5 py-1 rounded-lg bg-[#0cc9a9]/10 w-auto">
              <span className="text-[11px] font-semibold text-[#0cc9a9] uppercase tracking-wider">Sessions</span>
            </span>
            <span className="inline-flex px-2.5 py-1 rounded-lg bg-cyan-500/10 w-auto">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Total Time</span>
            </span>
          </div>

          <div className="flex flex-col justify-center items-center gap-3.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-lg font-bold text-foreground tabular-nums">{streak}<span className="text-xs font-medium text-muted-foreground ml-1">days</span></span>
            <span className="text-lg font-bold text-foreground tabular-nums">{totalSessions}</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{timeDisplay}</span>
          </div>

          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <div className="relative flex items-center justify-center w-[130px] h-[130px]">
              <div className="breath-orb-outer absolute w-[130px] h-[130px] rounded-full" />
              <div className="breath-orb-middle absolute w-[95px] h-[95px] rounded-full" />
              <div className="breath-orb-inner absolute w-[64px] h-[64px] rounded-full" />
              <div className="absolute flex flex-col items-center justify-center w-[64px] h-[64px]">
                <span className="text-[10px] text-[#0cc9a9] font-semibold uppercase tracking-[0.15em] breath-text-fade">Breathe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Recovery() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-5 pt-4 pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[28px] font-bold text-[#0cc9a9] tracking-tight mb-4">Recovery</h1>

          <div className="grid grid-cols-1 gap-4">
            <BurnoutEntryCard onClick={() => navigate("/recovery/burnout-tracker")} />
            <BreathworkCard onClick={() => navigate("/recovery/breath-work")} />

            <MindfulnessCard onClick={() => navigate("/recovery/mindfulness")} />

            <WorkdayWellnessCard onClick={() => navigate("/recovery/desk-health")} />
          </div>
        </div>
      </div>

    </div>
  );
}
