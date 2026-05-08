import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Sparkles, ThumbsUp, X, Trophy, AlertTriangle, History, Activity, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import type { ValueType, NameType, Payload } from "recharts/types/component/DefaultTooltipContent";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import WellnessInsightsSection from "@/components/wellness/WellnessInsightsSection";
import { format } from "date-fns";
import type { WeeklyCheckin } from "@shared/schema";

interface SuggestionPayload {
  id: string;
  title: string;
  body: string;
  category: string;
}

interface WeeklyPayload {
  weekStart: string;
  weekEnd: string;
  summary: { wins: string[]; concerns: string[]; burnoutTrajectory: string };
  metrics: {
    burnout: { score: number | null; trajectory: string | null; previousScore: number | null; delta: number | null };
    bodyMap: { activeCount: number; newCount: number; resolvedCount: number; topAreas: string[] };
    training: { sessionsCompleted: number; sessionsPlanned: number; sessionsMissed: number; adherencePct: number | null; totalVolumeKg: number; previousVolumeKg: number | null };
    nutrition: { mealsLogged: number; daysWithMeals: number; targetDays: number };
    checkIns: { count: number; avgMood: number | null; avgEnergy: number | null; avgStress: number | null };
  };
  suggestions: SuggestionPayload[];
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    training: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    recovery: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    nutrition: "bg-green-500/15 text-green-700 dark:text-green-300",
    mindset: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    sleep: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    general: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[category] || colors.general}`}>
      {category}
    </span>
  );
}

function CheckinDetail({ checkIn }: { checkIn: WeeklyCheckin }) {
  const { toast } = useToast();
  const payload = checkIn.payload as WeeklyPayload;
  const accepted = new Set(checkIn.acceptedSuggestions || []);
  const dismissed = new Set(checkIn.dismissedSuggestions || []);

  const mutation = useMutation({
    mutationFn: async ({ suggestionId, action }: { suggestionId: string; action: "accept" | "dismiss" | "reset" }) => {
      const res = await apiRequest("POST", `/api/weekly-checkins/${checkIn.id}/suggestion`, { suggestionId, action });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkins/current"] });
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-checkins/${checkIn.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkins"] });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save", description: err?.message || "Try again in a moment.", variant: "destructive" });
    },
  });

  const m = payload.metrics;
  const weekRange = `${format(new Date(payload.weekStart), "d MMM")} – ${format(new Date(payload.weekEnd), "d MMM yyyy")}`;

  return (
    <div className="space-y-4">
      <Card data-testid="card-weekly-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
            Week of {weekRange}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed" data-testid="text-burnout-trajectory">{payload.summary.burnoutTrajectory}</p>
          {payload.summary.wins.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-green-600" />Wins</h3>
              <ul className="space-y-1.5 text-sm">
                {payload.summary.wins.map((w, i) => (
                  <li key={i} className="pl-4 border-l-2 border-green-500/40" data-testid={`text-win-${i}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {payload.summary.concerns.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Worth watching</h3>
              <ul className="space-y-1.5 text-sm">
                {payload.summary.concerns.map((c, i) => (
                  <li key={i} className="pl-4 border-l-2 border-amber-500/40" data-testid={`text-concern-${i}`}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-weekly-metrics">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />By the numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricRow
            label="Burnout score"
            value={
              m.burnout.score !== null
                ? `${m.burnout.score}${m.burnout.delta !== null ? ` (${m.burnout.delta >= 0 ? "+" : ""}${m.burnout.delta} vs last week)` : ""}`
                : "Not enough data"
            }
          />
          <MetricRow label="Trajectory" value={m.burnout.trajectory || "—"} />
          <MetricRow label="Body-map active areas" value={`${m.bodyMap.activeCount} (${m.bodyMap.newCount} new, ${m.bodyMap.resolvedCount} resolved)`} />
          {m.bodyMap.topAreas.length > 0 && (
            <MetricRow label="Top areas" value={m.bodyMap.topAreas.join(", ")} />
          )}
          <MetricRow
            label="Training sessions"
            value={
              m.training.sessionsPlanned > 0
                ? `${m.training.sessionsCompleted} completed / ${m.training.sessionsPlanned} planned${m.training.sessionsMissed > 0 ? ` · ${m.training.sessionsMissed} missed` : ""}${m.training.adherencePct !== null ? ` (${m.training.adherencePct}%)` : ""}`
                : `${m.training.sessionsCompleted} completed (none scheduled)`
            }
          />
          <MetricRow
            label="Training volume"
            value={`${m.training.totalVolumeKg.toLocaleString()} kg`}
          />
          {m.training.previousVolumeKg !== null && (
            <MetricRow
              label="Volume change"
              value={`${(m.training.totalVolumeKg - m.training.previousVolumeKg).toLocaleString()} kg vs last week`}
            />
          )}
          <MetricRow
            label="Nutrition adherence"
            value={`${m.nutrition.daysWithMeals} / ${m.nutrition.targetDays} days logged · ${m.nutrition.mealsLogged} meal(s)`}
          />
          <MetricRow
            label="Daily check-ins"
            value={`${m.checkIns.count} · mood ${m.checkIns.avgMood ?? "—"} · energy ${m.checkIns.avgEnergy ?? "—"} · stress ${m.checkIns.avgStress ?? "—"}`}
          />
        </CardContent>
      </Card>

      <Card data-testid="card-weekly-suggestions">
        <CardHeader>
          <CardTitle className="text-base">Suggestions</CardTitle>
          <p className="text-xs text-muted-foreground">Advisory only — these won't change your programmes automatically.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload.suggestions.map((s) => {
            const isAccepted = accepted.has(s.id);
            const isDismissed = dismissed.has(s.id);
            return (
              <div
                key={s.id}
                className={`p-3 border rounded-lg ${
                  isAccepted ? "border-green-500/40 bg-green-500/5" : isDismissed ? "border-border bg-muted/30 opacity-60" : "border-border"
                }`}
                data-testid={`card-suggestion-${s.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm">{s.title}</h4>
                  <CategoryBadge category={s.category} />
                </div>
                <p className="text-sm text-muted-foreground mb-3">{s.body}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isAccepted ? "default" : "outline"}
                    onClick={() =>
                      mutation.mutate({
                        suggestionId: s.id,
                        action: isAccepted ? "reset" : "accept",
                      })
                    }
                    disabled={mutation.isPending}
                    data-testid={`button-accept-${s.id}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                    {isAccepted ? "Accepted" : "I'll try this"}
                  </Button>
                  <Button
                    size="sm"
                    variant={isDismissed ? "secondary" : "ghost"}
                    onClick={() =>
                      mutation.mutate({
                        suggestionId: s.id,
                        action: isDismissed ? "reset" : "dismiss",
                      })
                    }
                    disabled={mutation.isPending}
                    data-testid={`button-dismiss-${s.id}`}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {isDismissed ? "Dismissed" : "Not for me"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

interface TrendPoint {
  id: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  burnout: number | null;
  nutrition: number | null;
  volume: number;
}

interface ActiveDotProps {
  cx?: number;
  cy?: number;
  stroke?: string;
  payload?: TrendPoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<Payload<ValueType, NameType>>;
  onOpen: (id: number) => void;
}

function ChartTooltip({ active, payload, onOpen }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;

  const fmt = (name: NameType, value: ValueType | undefined) => {
    if (value === null || value === undefined) return "—";
    if (name === "Volume") return `${Number(value).toLocaleString()} kg`;
    if (name === "Burnout") return `${value}`;
    return `${value}%`;
  };

  return (
    <div
      className="rounded-md border border-border bg-popover text-popover-foreground shadow-md text-xs p-2 min-w-[180px]"
      data-testid={`tooltip-trend-${point.id}`}
    >
      <div className="font-medium mb-1">
        Week of {format(new Date(point.weekStart), "d MMM yyyy")}
      </div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="font-medium">{fmt(p.name as NameType, p.value as ValueType)}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 w-full text-left text-[#0cc9a9] hover:underline font-medium"
        onClick={() => onOpen(point.id)}
        data-testid={`button-open-trend-${point.id}`}
      >
        Open this week →
      </button>
    </div>
  );
}

function TrendsChart({ checkIns, onPointClick }: { checkIns: WeeklyCheckin[]; onPointClick: (id: number) => void }) {
  const renderActiveDot = (props: ActiveDotProps) => {
    const { cx, cy, stroke, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={stroke}
        stroke="var(--background)"
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onClick={() => {
          if (payload && typeof payload.id === "number") onPointClick(payload.id);
        }}
        data-testid={payload ? `trend-dot-${payload.id}` : undefined}
      />
    );
  };

  const data: TrendPoint[] = useMemo(() => {
    const byWeek = new Map<string, WeeklyCheckin>();
    for (const c of checkIns) {
      const key = new Date(c.weekStart).toISOString();
      const existing = byWeek.get(key);
      if (!existing || (c.id > existing.id)) byWeek.set(key, c);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
      .slice(-12)
      .map((c) => {
        const p = c.payload as WeeklyPayload;
        const m = p.metrics;
        const nutrition =
          m.nutrition.targetDays > 0
            ? Math.round((m.nutrition.daysWithMeals / m.nutrition.targetDays) * 100)
            : null;
        return {
          id: c.id,
          weekStart: p.weekStart,
          weekEnd: p.weekEnd,
          label: format(new Date(p.weekStart), "d MMM"),
          burnout: m.burnout.score,
          nutrition,
          volume: m.training.totalVolumeKg,
        };
      });
  }, [checkIns]);

  if (data.length < 2) return null;

  return (
    <Card className="mt-6" data-testid="card-weekly-trends">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Trends · last {data.length} week{data.length === 1 ? "" : "s"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Hover a point and tap "Open this week" to drill in.</p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full" data-testid="chart-weekly-trends">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <RTooltip
                wrapperStyle={{ pointerEvents: "auto", outline: "none" }}
                cursor={{ stroke: "var(--border)" }}
                content={<ChartTooltip onOpen={onPointClick} />}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="burnout"
                name="Burnout"
                stroke="var(--chart-1)"
                strokeWidth={2}
                connectNulls
                activeDot={renderActiveDot}
              />
              <Line
                yAxisId="vol"
                type="monotone"
                dataKey="volume"
                name="Volume"
                stroke="var(--chart-2)"
                strokeWidth={2}
                connectNulls
                activeDot={renderActiveDot}
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="nutrition"
                name="Nutrition adherence"
                stroke="var(--chart-4)"
                strokeWidth={2}
                connectNulls
                activeDot={renderActiveDot}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

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
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("/")} data-testid="button-back">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-2xl font-bold mb-1">Weekly check-in</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {matchedDetail ? "Past weekly summary" : "Your AI-generated summary for this week"}
        </p>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {!isLoading && checkIn && <CheckinDetail checkIn={checkIn} />}

        {!isLoading && allCheckIns.length >= 2 && (
          <TrendsChart checkIns={allCheckIns} onPointClick={(id) => navigate(`/weekly-checkin/${id}`)} />
        )}

        {!matchedDetail && <WellnessInsightsSection />}

        {!isLoading && !checkIn && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              We couldn't generate a summary. Please try again later.
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="mt-6" data-testid="card-weekly-history">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Past check-ins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map((h) => {
                const p = h.payload as WeeklyPayload;
                return (
                  <button
                    key={h.id}
                    className="w-full text-left p-3 border rounded-lg hover:bg-foreground/5 active:bg-foreground/10 transition-colors flex items-center justify-between"
                    onClick={() => navigate(`/weekly-checkin/${h.id}`)}
                    data-testid={`button-history-${h.id}`}
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {format(new Date(p.weekStart), "d MMM")} – {format(new Date(p.weekEnd), "d MMM yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {p.summary.burnoutTrajectory}
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-3">
                      {p.metrics.burnout.score !== null ? `BO ${p.metrics.burnout.score}` : "—"}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
