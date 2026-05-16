import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  Sparkles,
  Heart,
  Dumbbell,
  Target,
  Repeat2,
  Moon,
  ScanLine,
  Salad,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Activity,
  AlertCircle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import type { ValueType, NameType, Payload } from "recharts/types/component/DefaultTooltipContent";
import TopHeader from "@/components/TopHeader";
import { format } from "date-fns";
import type { WeeklyCheckin } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type TrajectoryLabel = "holding steady" | "trending up" | "declining" | "not enough data";

interface V2Cards {
  howYouFelt?: { checkInCount: number; avgMood: number | null; avgEnergy: number | null; avgStress: number | null; roughDaysCount: number };
  howYouMoved?: { sessionsCompleted: number; sessionsPlanned: number; adherencePct: number | null };
  goals?: { items: Array<{ title: string; progressPct: number | null; isCompleted: boolean }> };
  habits?: { items: Array<{ title: string; completionsThisWeek: number; targetDaysThisWeek: number }> };
  lifestyle?: { avgSleepHours: number | null; sleepSource: "wearable" | "manual" | null; roughDaysCount: number };
  bodyStatus?: { areas: Array<{ bodyPart: string; status: "active" | "chronic" | "resolved" }> };
  patterns?: { narrative: string; bulletPoints: string[]; isAI: boolean; generatedAt: string };
  nutrition?: { daysTracked: number; mealsLogged: number };
}

interface V2Payload {
  _v: 2;
  weekStart: string;
  weekEnd: string;
  hero: string;
  trajectoryLabel: TrajectoryLabel;
  cards: V2Cards;
  metrics: any;
}

function isV2(payload: any): payload is V2Payload {
  return payload?._v === 2;
}

// ─── Trajectory pill ──────────────────────────────────────────────────────────

function TrajectoryPill({ label }: { label: TrajectoryLabel }) {
  const map: Record<TrajectoryLabel, { color: string; Icon: React.FC<any> }> = {
    "trending up": { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: TrendingUp },
    "declining": { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: TrendingDown },
    "holding steady": { color: "bg-blue-500/15 text-blue-700 dark:text-blue-300", Icon: Minus },
    "not enough data": { color: "bg-muted text-muted-foreground", Icon: Activity },
  };
  const { color, Icon } = map[label] ?? map["not enough data"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

// ─── Score chip ───────────────────────────────────────────────────────────────

function ScoreChip({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  if (value === null) return null;
  const pct = (value / max) * 100;
  const color =
    pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
    pct >= 40 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── Card 1: How you felt ─────────────────────────────────────────────────────

function HowYouFeltCard({ data }: { data: NonNullable<V2Cards["howYouFelt"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" /> How you felt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-around py-1">
          <ScoreChip label="Mood" value={data.avgMood} />
          <ScoreChip label="Energy" value={data.avgEnergy} />
          <ScoreChip label="Stress" value={data.avgStress} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <span>{data.checkInCount} check-in{data.checkInCount !== 1 ? "s" : ""} this week</span>
          {data.roughDaysCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {data.roughDaysCount} rough day{data.roughDaysCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Card 2: How you moved ────────────────────────────────────────────────────

function HowYouMovedCard({ data }: { data: NonNullable<V2Cards["howYouMoved"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-blue-500" /> How you moved
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-1.5">
          <span className="text-3xl font-bold tabular-nums">{data.sessionsCompleted}</span>
          {data.sessionsPlanned > 0 && (
            <span className="text-muted-foreground text-sm mb-1">/ {data.sessionsPlanned} planned</span>
          )}
          <span className="text-muted-foreground text-sm mb-1 ml-0.5">sessions</span>
        </div>
        {data.adherencePct !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Adherence</span>
              <span className="font-medium">{data.adherencePct}%</span>
            </div>
            <Progress value={data.adherencePct} className="h-1.5" />
          </div>
        )}
        {data.adherencePct === null && data.sessionsCompleted > 0 && (
          <p className="text-xs text-muted-foreground">No scheduled plan this week</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Card 3: Goals ───────────────────────────────────────────────────────────

function GoalsCard({ data }: { data: NonNullable<V2Cards["goals"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-500" /> Progress on goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.items.map((g, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium line-clamp-1">{g.title}</span>
              {g.progressPct !== null && (
                <span className="text-muted-foreground tabular-nums">{g.progressPct}%</span>
              )}
            </div>
            {g.progressPct !== null && (
              <Progress value={g.progressPct} className="h-1.5" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Card 4: Habits ──────────────────────────────────────────────────────────

function HabitsCard({ data }: { data: NonNullable<V2Cards["habits"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Repeat2 className="h-4 w-4 text-teal-500" /> Habits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {data.items.map((h, i) => {
          const pct = Math.round((h.completionsThisWeek / h.targetDaysThisWeek) * 100);
          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium line-clamp-1">{h.title}</span>
                <span className="text-muted-foreground tabular-nums">
                  {h.completionsThisWeek}/{h.targetDaysThisWeek}d
                </span>
              </div>
              <Progress value={Math.min(pct, 100)} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Card 5: Lifestyle ───────────────────────────────────────────────────────

function LifestyleCard({ data }: { data: NonNullable<V2Cards["lifestyle"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-500" /> Lifestyle factors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.avgSleepHours !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg sleep</span>
            <span className="font-semibold">
              {data.avgSleepHours}h
              {data.sleepSource && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">via {data.sleepSource}</span>
              )}
            </span>
          </div>
        )}
        {data.roughDaysCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rough days</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {data.roughDaysCount} day{data.roughDaysCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Card 6: Body status ──────────────────────────────────────────────────────

const statusConfig: Record<"active" | "chronic" | "resolved", { color: string; label: string }> = {
  active: { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40", label: "Active" },
  chronic: { color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-300/40", label: "Ongoing" },
  resolved: { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40", label: "Resolved" },
};

function BodyStatusCard({ data }: { data: NonNullable<V2Cards["bodyStatus"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-orange-500" /> Body status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {data.areas.map((a, i) => {
            const cfg = statusConfig[a.status];
            return (
              <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                {a.bodyPart}
                <span className="opacity-60">· {cfg.label}</span>
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Card 7: Patterns (AI narrative) ─────────────────────────────────────────

function PatternsCard({ data }: { data: NonNullable<V2Cards["patterns"]> }) {
  return (
    <Card className="border-[#0cc9a9]/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0cc9a9]" /> Patterns we noticed
          {!data.isAI && (
            <span className="ml-auto text-xs text-muted-foreground font-normal flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Summary mode
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{data.narrative}</p>
        {data.bulletPoints.length > 0 && (
          <ul className="space-y-2">
            {data.bulletPoints.map((bp, i) => (
              <li key={i} className="text-sm pl-3 border-l-2 border-[#0cc9a9]/50 text-muted-foreground leading-relaxed">
                {bp}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Card 8: Nutrition ───────────────────────────────────────────────────────

function NutritionCard({ data }: { data: NonNullable<V2Cards["nutrition"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Salad className="h-4 w-4 text-green-500" /> Nutrition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Days tracked</span>
          <span className="font-semibold">{data.daysTracked} / 7</span>
        </div>
        <Progress value={Math.round((data.daysTracked / 7) * 100)} className="h-1.5" />
        <p className="text-xs text-muted-foreground pt-0.5">{data.mealsLogged} meal{data.mealsLogged !== 1 ? "s" : ""} logged</p>
      </CardContent>
    </Card>
  );
}

// ─── V2 detail view ──────────────────────────────────────────────────────────

function CheckinDetailV2({ checkIn }: { checkIn: WeeklyCheckin }) {
  const payload = checkIn.payload as V2Payload;
  const cards = payload.cards;
  const weekRange = `${format(new Date(payload.weekStart), "d MMM")} – ${format(new Date(payload.weekEnd), "d MMM yyyy")}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Week of {weekRange}</span>
          <TrajectoryPill label={payload.trajectoryLabel} />
        </div>
        <p className="text-base leading-relaxed font-medium">{payload.hero}</p>
      </div>

      {cards.howYouFelt && <HowYouFeltCard data={cards.howYouFelt} />}
      {cards.howYouMoved && <HowYouMovedCard data={cards.howYouMoved} />}
      {cards.goals && <GoalsCard data={cards.goals} />}
      {cards.habits && <HabitsCard data={cards.habits} />}
      {cards.lifestyle && <LifestyleCard data={cards.lifestyle} />}
      {cards.bodyStatus && <BodyStatusCard data={cards.bodyStatus} />}
      {cards.patterns && <PatternsCard data={cards.patterns} />}
      {cards.nutrition && <NutritionCard data={cards.nutrition} />}
    </div>
  );
}

// ─── V1 fallback (legacy history items) ──────────────────────────────────────

function CheckinDetailLegacy({ checkIn }: { checkIn: WeeklyCheckin }) {
  const p = checkIn.payload as any;
  const weekRange = `${format(new Date(p.weekStart), "d MMM")} – ${format(new Date(p.weekEnd), "d MMM yyyy")}`;
  return (
    <div className="space-y-4">
      <div className="py-2">
        <p className="text-xs text-muted-foreground mb-1">Week of {weekRange}</p>
        <p className="text-sm leading-relaxed">{p.summary?.burnoutTrajectory || "No summary available."}</p>
      </div>
      {p.summary?.wins?.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-1">
            {(p.summary.wins as string[]).map((w: string, i: number) => (
              <p key={i} className="text-sm pl-3 border-l-2 border-emerald-500/50">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Trends chart ─────────────────────────────────────────────────────────────

interface TrendPoint {
  id: number;
  weekStart: string;
  label: string;
  trainingAdherence: number | null;
  nutritionAdherence: number | null;
  avgMood: number | null;
}

interface ActiveDotProps { cx?: number; cy?: number; stroke?: string; payload?: TrendPoint }
interface ChartTooltipProps { active?: boolean; payload?: Array<Payload<ValueType, NameType>>; onOpen: (id: number) => void }

function ChartTooltip({ active, payload, onOpen }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md text-xs p-2 min-w-[160px]">
      <div className="font-medium mb-1">Week of {format(new Date(point.weekStart), "d MMM yyyy")}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium">
              {p.value !== null && p.value !== undefined
                ? p.name === "Mood" ? `${p.value}%` : `${p.value}%`
                : "—"}
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="mt-2 w-full text-left text-[#0cc9a9] hover:underline font-medium" onClick={() => onOpen(point.id)}>
        Open this week →
      </button>
    </div>
  );
}

function TrendsChart({ checkIns, onPointClick }: { checkIns: WeeklyCheckin[]; onPointClick: (id: number) => void }) {
  const data: TrendPoint[] = useMemo(() => {
    const byWeek = new Map<string, WeeklyCheckin>();
    for (const c of checkIns) {
      const key = new Date(c.weekStart).toISOString();
      const existing = byWeek.get(key);
      if (!existing || c.id > existing.id) byWeek.set(key, c);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
      .slice(-12)
      .map((c) => {
        const p = c.payload as any;
        const weekStart = p.weekStart as string;
        const m = p.metrics;
        if (isV2(p)) {
          return {
            id: c.id,
            weekStart,
            label: format(new Date(weekStart), "d MMM"),
            trainingAdherence: m?.training?.adherencePct ?? null,
            nutritionAdherence: m?.nutrition?.targetDays > 0 ? Math.round((m.nutrition.daysWithMeals / m.nutrition.targetDays) * 100) : null,
            avgMood: p.cards?.howYouFelt?.avgMood ? Math.round((p.cards.howYouFelt.avgMood / 10) * 100) : null,
          };
        }
        return {
          id: c.id,
          weekStart,
          label: format(new Date(weekStart), "d MMM"),
          trainingAdherence: m?.training?.adherencePct ?? null,
          nutritionAdherence: m?.nutrition?.targetDays > 0 ? Math.round((m.nutrition.daysWithMeals / m.nutrition.targetDays) * 100) : null,
          avgMood: null,
        };
      });
  }, [checkIns]);

  if (data.length < 2) return null;

  const renderActiveDot = (props: ActiveDotProps) => {
    const { cx, cy, stroke, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    return (
      <circle cx={cx} cy={cy} r={6} fill={stroke} stroke="var(--background)" strokeWidth={2}
        style={{ cursor: "pointer" }} onClick={() => { if (payload?.id) onPointClick(payload.id); }}
      />
    );
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Trends · last {data.length} week{data.length === 1 ? "" : "s"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Hover a point and tap "Open this week" to drill in.</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <RTooltip wrapperStyle={{ pointerEvents: "auto", outline: "none" }} cursor={{ stroke: "var(--border)" }} content={<ChartTooltip onOpen={onPointClick} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="trainingAdherence" name="Training" stroke="var(--chart-2)" strokeWidth={2} connectNulls activeDot={renderActiveDot} />
              <Line type="monotone" dataKey="nutritionAdherence" name="Nutrition" stroke="var(--chart-4)" strokeWidth={2} connectNulls activeDot={renderActiveDot} />
              <Line type="monotone" dataKey="avgMood" name="Mood" stroke="var(--chart-1)" strokeWidth={2} connectNulls activeDot={renderActiveDot} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History list ─────────────────────────────────────────────────────────────

function HistoryList({ history, onOpen }: { history: WeeklyCheckin[]; onOpen: (id: number) => void }) {
  if (history.length === 0) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Past check-ins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((h) => {
          const p = h.payload as any;
          const v2 = isV2(p);
          const weekStart = p.weekStart as string;
          const weekEnd = p.weekEnd as string;
          const subtitle = v2 ? (p as V2Payload).hero : (p.summary?.burnoutTrajectory ?? "");
          const label = v2 ? (
            <TrajectoryPill label={(p as V2Payload).trajectoryLabel} />
          ) : (
            <Badge variant="secondary">
              {p.metrics?.burnout?.score !== null && p.metrics?.burnout?.score !== undefined
                ? `BO ${p.metrics.burnout.score}` : "—"}
            </Badge>
          );
          return (
            <button key={h.id}
              className="w-full text-left p-3 border rounded-lg hover:bg-foreground/5 active:bg-foreground/10 transition-colors flex items-start justify-between gap-2"
              onClick={() => onOpen(h.id)}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {format(new Date(weekStart), "d MMM")} – {format(new Date(weekEnd), "d MMM yyyy")}
                </div>
                {subtitle && (
                  <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{subtitle}</div>
                )}
              </div>
              <div className="shrink-0 mt-0.5">{label}</div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeeklyCheckinPage() {
  const [, navigate] = useLocation();
  const [matchedDetail, params] = useRoute<{ id: string }>("/weekly-checkin/:id");
  const targetId = matchedDetail ? Number(params!.id) : null;

  const currentQuery = useQuery<WeeklyCheckin>({
    queryKey: ["/api/weekly-checkins/current"],
    enabled: !matchedDetail,
  });
  const detailQuery = useQuery<WeeklyCheckin>({
    queryKey: [`/api/weekly-checkins/${targetId}`],
    enabled: !!matchedDetail && Number.isFinite(targetId),
  });
  const historyQuery = useQuery<WeeklyCheckin[]>({
    queryKey: ["/api/weekly-checkins"],
  });

  const checkIn = matchedDetail ? detailQuery.data : currentQuery.data;
  const isLoading = matchedDetail ? detailQuery.isLoading : currentQuery.isLoading;

  const history = useMemo(() => {
    const list = historyQuery.data || [];
    return list.filter((h) => h.id !== checkIn?.id);
  }, [historyQuery.data, checkIn?.id]);

  const allCheckIns = useMemo(() => {
    const list = [...(historyQuery.data || [])];
    if (checkIn && !list.some((h) => h.id === checkIn.id)) list.push(checkIn);
    return list;
  }, [historyQuery.data, checkIn]);

  return (
    <div className="min-h-screen bg-background">
      <TopHeader />
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("/")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-2xl font-bold mb-1">Weekly check-in</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {matchedDetail ? "Past weekly summary" : "Your summary for this week"}
        </p>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {!isLoading && checkIn && (
          isV2(checkIn.payload) ? (
            <CheckinDetailV2 checkIn={checkIn} />
          ) : (
            <CheckinDetailLegacy checkIn={checkIn} />
          )
        )}

        {!isLoading && !checkIn && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              We couldn't generate a summary. Please try again later.
            </CardContent>
          </Card>
        )}

        {allCheckIns.length >= 2 && (
          <TrendsChart checkIns={allCheckIns} onPointClick={(id) => navigate(`/weekly-checkin/${id}`)} />
        )}

        <HistoryList history={history} onOpen={(id) => navigate(`/weekly-checkin/${id}`)} />
      </div>
    </div>
  );
}
