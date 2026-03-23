import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Moon,
  Brain,
  Zap,
  Heart,
  Activity,
  Wine,
  Pill,
  Coffee,
  AlertCircle,
  Shield,
  Sparkles,
  Smartphone,
  Lock,
  Calendar,
  ChevronDown,
  Info,
  X,
  ExternalLink,
  Stethoscope,
  HeartHandshake,
  Dumbbell,
  Footprints,
  BedDouble,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { format } from "date-fns";

type TimeRange = "1m" | "3m" | "6m" | "1y";

interface BurnoutDriver {
  key: string;
  label: string;
  explanation: string;
  trend: "up" | "down" | "stable";
  weight: number;
}

interface BurnoutScoreData {
  id: number;
  score: number;
  trajectory: string;
  confidence: string;
  topDrivers: BurnoutDriver[];
  computedDate: string;
  checkInCount: number;
  dataSourceCount: number;
}

interface BurnoutSettingsData {
  recoveryModeEnabled: boolean;
  recoveryModeStartedAt: string | null;
  recoveryModeExpiresAt: string | null;
}

interface MonthlyLogEntry {
  id: number;
  score: number;
  trajectory: string;
  computedDate: string;
}

const trajectoryConfig: Record<string, { label: string; color: string; bgColor: string; dotColor: string; icon: typeof ArrowUp }> = {
  stable: { label: "Stable", color: "text-emerald-400/80", bgColor: "bg-emerald-500/8", dotColor: "bg-emerald-400/80", icon: ArrowRight },
  rising: { label: "Rising", color: "text-[#0cc9a9]/75", bgColor: "bg-[#0cc9a9]/8", dotColor: "bg-[#0cc9a9]/75", icon: ArrowUp },
  elevated: { label: "Elevated", color: "text-red-300/70", bgColor: "bg-red-500/6", dotColor: "bg-red-300/70", icon: TrendingUp },
  recovering: { label: "Recovering", color: "text-emerald-400/80", bgColor: "bg-emerald-500/8", dotColor: "bg-emerald-400/80", icon: TrendingDown },
};

const driverIcons: Record<string, typeof Moon> = {
  sleep: Moon,
  stress: Brain,
  energy: Zap,
  mood: Heart,
  clarity: Activity,
  booleans: AlertCircle,
  workoutConsistency: Dumbbell,
  painLoad: Stethoscope,
  sleepTracking: BedDouble,
  activity: Footprints,
  alcohol: Wine,
  headache: Pill,
  caffeine: Coffee,
  anxiety: AlertCircle,
  overwhelm: AlertCircle,
  fatigue: Zap,
  pain: Activity,
  sickness: Pill,
  emotional_instability: Heart,
  mindfulness_deficit: Brain,
  exercise_deficit: Activity,
};

function getDriverIcon(key: string) {
  return driverIcons[key] || Activity;
}

const trendStyleBase = { trendUpBg: "bg-[#0cc9a9]/8", trendUpText: "text-[#0cc9a9]/60", trendDownBg: "bg-emerald-500/10", trendDownText: "text-emerald-400/70", trendStableBg: "bg-zinc-500/8", trendStableText: "text-muted-foreground" };

const driverColors: Record<string, { iconBg: string; iconColor: string; trendUpBg: string; trendUpText: string; trendDownBg: string; trendDownText: string; trendStableBg: string; trendStableText: string }> = {
  sleep: { iconBg: "bg-indigo-500/15", iconColor: "text-indigo-400", ...trendStyleBase },
  stress: { iconBg: "bg-rose-500/15", iconColor: "text-rose-400", ...trendStyleBase },
  energy: { iconBg: "bg-[#0cc9a9]/15", iconColor: "text-[#0cc9a9]", ...trendStyleBase },
  mood: { iconBg: "bg-pink-500/15", iconColor: "text-pink-400", ...trendStyleBase },
  clarity: { iconBg: "bg-cyan-500/15", iconColor: "text-cyan-400", ...trendStyleBase },
  booleans: { iconBg: "bg-orange-500/15", iconColor: "text-orange-400", ...trendStyleBase },
  workoutConsistency: { iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400", ...trendStyleBase },
  painLoad: { iconBg: "bg-red-500/15", iconColor: "text-red-400", ...trendStyleBase },
  sleepTracking: { iconBg: "bg-violet-500/15", iconColor: "text-violet-400", ...trendStyleBase },
  activity: { iconBg: "bg-sky-500/15", iconColor: "text-sky-400", ...trendStyleBase },
};

const defaultDriverColor = driverColors.energy;

function getTrendLabel(trend: string): string {
  if (trend === "up") return "Worsening";
  if (trend === "down") return "Improving";
  return "Stable";
}

function getTrendIcon(trend: string) {
  if (trend === "up") return TrendingUp;
  if (trend === "down") return TrendingDown;
  return ArrowRight;
}

function getScoreLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score <= 20) return { label: "Optimal", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-500/10" };
  if (score <= 40) return { label: "Balanced", color: "text-teal-700 dark:text-teal-300", bgColor: "bg-teal-50 dark:bg-teal-500/10" };
  if (score <= 60) return { label: "Strained", color: "text-[#0cc9a9] dark:text-[#0cc9a9]", bgColor: "bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/10" };
  if (score <= 80) return { label: "Overloaded", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-500/10" };
  return { label: "Sustained Overload", color: "text-red-800/80 dark:text-red-300/60", bgColor: "bg-red-50 dark:bg-red-500/6" };
}

const scoringRanges = [
  { range: "0 - 20", label: "Optimal", color: "bg-emerald-400", desc: "Load and recovery are well balanced. No sustained strain detected." },
  { range: "21 - 40", label: "Balanced", color: "bg-teal-400", desc: "Workload is elevated but recovery is matching demand. Maintain strong boundaries." },
  { range: "41 - 60", label: "Strained", color: "bg-[#0cc9a9]", desc: "Pressure is increasing. Monitor recovery closely and address early drift." },
  { range: "61 - 80", label: "Overloaded", color: "bg-orange-400", desc: "Demand is consistently exceeding recovery capacity. Structured adjustments are recommended." },
  { range: "81 - 100", label: "Sustained Overload", color: "bg-red-400", desc: "Long-term imbalance detected. Prioritise recovery and workload alignment." },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const tConfig = trajectoryConfig[data.trajectory] || trajectoryConfig.stable;
  const TIcon = tConfig.icon;
  return (
    <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-[11px] text-muted-foreground font-medium">{format(new Date(data.date), "MMM d, yyyy")}</p>
      <p className="text-base font-bold text-foreground mt-0.5">Score: {data.score}</p>
      {data.trajectory && (
        <div className={`flex items-center gap-1 mt-1 ${tConfig.color}`}>
          <TIcon className="h-3 w-3" />
          <span className="text-[11px] font-medium">{tConfig.label}</span>
        </div>
      )}
    </div>
  );
}

export default function RecoveryBurnout() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [timeRange, setTimeRange] = useState<TimeRange>("3m");
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [showConfidenceInfo, setShowConfidenceInfo] = useState(false);

  const { data: currentScore, isLoading: scoreLoading } = useQuery<BurnoutScoreData>({
    queryKey: ["/api/burnout/current"],
  });

  const { data: settings } = useQuery<BurnoutSettingsData>({
    queryKey: ["/api/burnout/settings"],
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<BurnoutScoreData[]>({
    queryKey: ["/api/burnout/history", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/burnout/history?range=${timeRange}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const { data: monthlyLog } = useQuery<MonthlyLogEntry[]>({
    queryKey: ["/api/burnout/monthly-log"],
  });

  const { data: healthIntegrations } = useQuery<any[]>({
    queryKey: ["/api/health-integrations"],
  });

  const { data: companyBenefits = [] } = useQuery<{ id: number; title: string; description: string | null; category: string; link: string | null; contactInfo: string | null }[]>({
    queryKey: ["/api/user/company-benefits"],
  });

  const { data: levelExplanation } = useQuery<{ explanation: string | null }>({
    queryKey: ["/api/burnout/level-explanation"],
    enabled: !!currentScore,
  });

  const { data: aiInsight, isLoading: insightLoading } = useQuery<{ insight: string }>({
    queryKey: ["/api/burnout/insight", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/burnout/insight?range=${timeRange}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch insight");
      return res.json();
    },
    enabled: !!currentScore,
  });

  const recoveryModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/burnout/recovery-mode", { enabled });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/burnout/settings"] });
      toast({
        title: variables ? "Recovery Mode Activated" : "Recovery Mode Deactivated",
        description: variables
          ? "Your recommendations will prioritise recovery for the next 30 days."
          : "Recovery mode has been turned off.",
      });
    },
  });

  const enabled = settings?.recoveryModeEnabled;
  const isRisingOrElevated = currentScore?.trajectory === "rising" || currentScore?.trajectory === "elevated";

  const chartData = (historyData || []).map((d) => ({
    date: d.computedDate,
    score: d.score,
    trajectory: d.trajectory,
  }));

  const drivers = (currentScore?.topDrivers as BurnoutDriver[]) || [];


  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const hasConnectedHealth = healthIntegrations && healthIntegrations.some((h: any) => h.status === "connected");
  const tConfig = currentScore ? (trajectoryConfig[currentScore.trajectory] || trajectoryConfig.stable) : trajectoryConfig.stable;
  const TIcon = tConfig.icon;

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Burnout Early Warning" onBack={() => navigate("/recovery")} />

      <div className="px-5 pt-14 space-y-5 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Track your burnout trajectory using real-world recovery data, so you stay ahead of overload, not behind it.
        </p>

        {/* TOP PANEL - Burnout Index */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{
          border: '1px solid rgba(9, 181, 249, 0.15)',
          background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 100%)',
        }}>
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(135deg, rgba(9,181,249,0.08) 0%, rgba(9,181,249,0.03) 40%, rgba(9,181,249,0.06) 100%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to top right, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
          }} />
          <div className="absolute top-0 left-0 right-0 h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent, rgba(9,181,249,0.3), transparent)',
          }} />
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(9,181,249,0.08) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(9,181,249,0.06) 0%, transparent 70%)' }} />

          <div className="relative p-6">
            {scoreLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-14 w-28" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : currentScore ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
                    Burnout Index
                  </span>
                  {(() => {
                    const level = getScoreLevel(currentScore.score);
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${level.bgColor}`}>
                        <span className={`text-xs font-semibold ${level.color}`}>{level.label}</span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-bold text-foreground tabular-nums tracking-tight leading-none">
                      {currentScore.score}
                    </span>
                    <span className="text-lg text-muted-foreground font-medium">/ 100</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <TIcon className={`h-4 w-4 ${tConfig.color}`} />
                      <span className={`text-sm font-medium ${tConfig.color}`}>Trend: {tConfig.label}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      currentScore.confidence === "high" ? "bg-emerald-400" :
                      currentScore.confidence === "medium" ? "bg-[#0cc9a9]" : "bg-muted-foreground"
                    }`} />
                    <span className="text-sm text-muted-foreground capitalize font-medium">
                      {currentScore.confidence} confidence
                    </span>
                    <button
                      onClick={() => setShowConfidenceInfo(!showConfidenceInfo)}
                      className="p-0.5 rounded-full hover:bg-muted/60 transition-colors"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </button>
                    <span className="text-muted-foreground/40 mx-0.5">·</span>
                    <span className="text-sm text-muted-foreground/70">
                      {currentScore.dataSourceCount > 1
                        ? `${currentScore.checkInCount} check-ins + ${currentScore.dataSourceCount - 1} other sources`
                        : `${currentScore.checkInCount} check-ins analysed`
                      }
                    </span>
                  </div>
                  {showConfidenceInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowConfidenceInfo(false)}>
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                      <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">What does confidence mean?</h3>
                          <button onClick={() => setShowConfidenceInfo(false)} className="p-1 rounded-lg hover:bg-muted/60 transition-colors">
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Confidence reflects how reliable your score is based on the amount and variety of data available. More check-ins and additional data sources (workouts, sleep, steps, body map) improve accuracy.
                        </p>
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-start gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground shrink-0 mt-1" />
                            <div>
                              <span className="text-xs font-semibold text-foreground">Low</span>
                              <p className="text-xs text-muted-foreground">Limited data points or only 1 data source. Score is a rough estimate.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-[#0cc9a9] shrink-0 mt-1" />
                            <div>
                              <span className="text-xs font-semibold text-foreground">Medium</span>
                              <p className="text-xs text-muted-foreground">15+ data points across 2+ sources. Fairly reliable but still improving.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
                            <div>
                              <span className="text-xs font-semibold text-foreground">High</span>
                              <p className="text-xs text-muted-foreground">40+ data points across 3+ sources. Accurate and based on solid data.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentScore.confidence === "low" && (
                  <div className="flex items-start gap-2.5 bg-muted/40 rounded-xl p-3.5 border border-border/30">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Complete more daily check-ins, log workouts, and track sleep to improve accuracy.
                    </p>
                  </div>
                )}

                {levelExplanation?.explanation ? (
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#0cc9a9]/60 mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/70 leading-relaxed italic">
                      {levelExplanation.explanation}
                    </p>
                  </div>
                ) : drivers.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground/80 font-medium">Top driver:</span> {drivers[0]?.explanation}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-foreground mb-1">No data yet</p>
                <p className="text-xs text-muted-foreground mb-4">Complete your first daily check-in to see your Burnout Index.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => navigate("/")}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* SCORING GUIDE */}
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
          <button
            onClick={() => setShowScoringGuide(!showScoringGuide)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
                <Info className="h-3.5 w-3.5 text-[#0cc9a9]" />
              </div>
              <span className="text-sm font-semibold text-foreground">Understanding Your Score</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showScoringGuide ? "rotate-180" : ""}`} />
          </button>
          {showScoringGuide && (
            <div className="px-4 pb-4 space-y-2.5 border-t border-border/40 pt-3">
              {scoringRanges.map((r) => (
                <div key={r.range} className="flex items-start gap-3">
                  <div className="flex items-center gap-2 min-w-[100px] pt-0.5">
                    <div className={`h-2 w-2 rounded-full ${r.color} shrink-0`} />
                    <span className="text-xs font-semibold text-foreground tabular-nums">{r.range}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-foreground">{r.label}</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{r.desc}</p>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1">
                Your index is calculated from multiple data sources: daily check-ins, workout consistency, body map pain entries, sleep patterns, and daily activity. Higher scores indicate greater burnout risk.
              </p>
            </div>
          )}
        </div>

        {/* TIME RANGE SELECTOR + GRAPH */}
        {currentScore && (
          <>
            <div className="flex gap-2">
              {(["1m", "3m", "6m", "1y"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    timeRange === range
                      ? "bg-[#0cc9a9]/15 text-[#0cc9a9] border border-[#0cc9a9]/30"
                      : "bg-card text-muted-foreground border border-border/60 hover:text-foreground hover:border-border"
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-card border border-border/60 p-5">
              {historyLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : chartData.length > 1 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="burnoutGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0cc9a9" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#0cc9a9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => format(new Date(d), "MMM d")}
                        stroke="transparent"
                        tick={{ fill: "#52525b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="transparent"
                        tick={{ fill: "#52525b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#0cc9a9"
                        strokeWidth={2}
                        fill="url(#burnoutGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: "#0cc9a9", stroke: "#0e0e12", strokeWidth: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Not enough data to display trend yet.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* WHAT'S DRIVING THIS */}
        {drivers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-foreground tracking-tight">What's Driving This</h2>
            {drivers.map((driver) => {
              const Icon = getDriverIcon(driver.key);
              const colors = driverColors[driver.key] || defaultDriverColor;
              const TrendIcon = getTrendIcon(driver.trend);
              const trendBg = driver.trend === "up" ? colors.trendUpBg : driver.trend === "down" ? colors.trendDownBg : colors.trendStableBg;
              const trendText = driver.trend === "up" ? colors.trendUpText : driver.trend === "down" ? colors.trendDownText : colors.trendStableText;
              return (
                <div
                  key={driver.key}
                  className="rounded-2xl bg-card border border-border/60 p-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl ${colors.iconBg}`}>
                      <Icon className={`h-[18px] w-[18px] ${colors.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-foreground">{driver.label}</span>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${trendBg} ${trendText}`}>
                          <TrendIcon className="h-3 w-3" />
                          {getTrendLabel(driver.trend)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{driver.explanation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PERFORMANCE INSIGHT (AI) */}
        {currentScore && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
              <h2 className="text-base font-bold text-foreground tracking-tight">Performance Insight</h2>
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[#0cc9a9]/[0.03]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#0cc9a9]/20 via-transparent to-transparent" />
              <div className="relative p-5 border border-border/60 rounded-2xl">
                {insightLoading ? (
                  <div className="space-y-2.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : aiInsight?.insight ? (
                  <p className="text-sm text-foreground/80 leading-[1.7] whitespace-pre-line">
                    {aiInsight.insight}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Continue checking in daily to unlock personalised performance insights.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RECOVERY MODE - ACTIVATE */}
        {isRisingOrElevated && !enabled && (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-card" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#0cc9a9]/30 via-transparent to-transparent" />
            <div className="relative p-5 border border-[#0cc9a9]/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
                  <Shield className="h-4 w-4 text-[#0cc9a9]" />
                </div>
                <h2 className="text-base font-bold text-foreground">Activate Recovery Mode?</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Prioritise recovery for the next 30 days to stabilise your trajectory. Your AI coaches will adjust recommendations to focus on rest and restoration.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => recoveryModeMutation.mutate(true)}
                  disabled={recoveryModeMutation.isPending}
                  className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
                >
                  Activate Recovery Mode
                </Button>
                <Button
                  variant="ghost"
                  className="text-zinc-500 hover:text-zinc-400"
                >
                  Not now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* RECOVERY MODE ACTIVE */}
        {enabled && (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-card" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/30 via-transparent to-transparent" />
            <div className="relative p-5 border border-emerald-900/40 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <Shield className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Recovery Mode Active</p>
                    {settings?.recoveryModeExpiresAt && (
                      <p className="text-xs text-emerald-500/70 mt-0.5">
                        Expires {format(new Date(settings.recoveryModeExpiresAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/30 text-xs font-semibold"
                  onClick={() => recoveryModeMutation.mutate(false)}
                  disabled={recoveryModeMutation.isPending}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* IMPROVE ACCURACY */}
        {!hasConnectedHealth && (
          <div className="rounded-2xl bg-card border border-border/60 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#0cc9a9]/10">
                <Smartphone className="h-4 w-4 text-[#0cc9a9]" />
              </div>
              <h2 className="text-base font-bold text-foreground">Improve Accuracy</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect Apple Health or Google Health to enhance burnout trend detection with sleep, heart rate, and activity data.
            </p>
            <Button
              variant="outline"
              className="font-semibold"
              onClick={() => {
                toast({
                  title: "Health Integration",
                  description: "Health data connections will be available when the mobile app launches. Your intent has been registered.",
                });
                apiRequest("POST", "/api/health-integrations", { provider: "apple_health" });
              }}
            >
              Connect Health Data
            </Button>
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground/50">Your data remains private and under your control.</p>
            </div>
          </div>
        )}

        {/* MONTHLY TREND LOG */}
        {monthlyLog && monthlyLog.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-bold text-foreground">Monthly Trend Log</h2>
            </div>
            <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
              <div className="divide-y divide-border/40">
                {monthlyLog.map((entry) => {
                  const mtConfig = trajectoryConfig[entry.trajectory] || trajectoryConfig.stable;
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-sm text-foreground font-medium">
                        {format(new Date(entry.computedDate), "MMMM yyyy")}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold capitalize ${mtConfig.color}`}>
                          {mtConfig.label}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground tabular-nums w-8 text-right">
                          {entry.score}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Learn More</h2>
          <div
            className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/recovery/burnout-signs")}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 shrink-0">
              <Shield className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Spot the Signs of Burnout</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recognise the warning signs before they escalate</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 shrink-0" />
          </div>
          <div
            className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate("/recovery/burnout-talking")}
          >
            <div className="p-2.5 rounded-xl bg-[#0cc9a9]/10 shrink-0">
              <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Talking to Your Manager About Burnout</p>
              <p className="text-xs text-muted-foreground mt-0.5">How to have the conversation professionally</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 shrink-0" />
          </div>
        </div>

        {companyBenefits.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Your Company Support</h2>
            <p className="text-xs text-muted-foreground">Benefits and services provided by your employer</p>
            {companyBenefits.map((benefit) => {
              const categoryConfig: Record<string, { icon: typeof Stethoscope; color: string; bg: string }> = {
                "Physiotherapy": { icon: Stethoscope, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                "Therapy/Counselling": { icon: HeartHandshake, color: "text-purple-400", bg: "bg-purple-500/10" },
                "EAP": { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10" },
                "Mental Health": { icon: Brain, color: "text-pink-400", bg: "bg-pink-500/10" },
                "Fitness": { icon: Activity, color: "text-orange-400", bg: "bg-orange-500/10" },
                "Nutrition": { icon: Heart, color: "text-green-400", bg: "bg-green-500/10" },
                "Other": { icon: Sparkles, color: "text-gray-400", bg: "bg-gray-500/10" },
              };
              const config = categoryConfig[benefit.category] || categoryConfig["Other"];
              const IconComponent = config.icon;
              return (
                <div
                  key={benefit.id}
                  className="rounded-2xl bg-card border border-border/60 p-4 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${config.bg} shrink-0`}>
                      <IconComponent className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{benefit.category}</span>
                    </div>
                  </div>
                  {benefit.description && (
                    <p className="text-xs text-muted-foreground pl-[52px]">{benefit.description}</p>
                  )}
                  <div className="flex gap-3 pl-[52px]">
                    {benefit.link && (
                      <a href={benefit.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0cc9a9] flex items-center gap-1 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Visit
                      </a>
                    )}
                    {benefit.contactInfo && (
                      <span className="text-xs text-muted-foreground">{benefit.contactInfo}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
