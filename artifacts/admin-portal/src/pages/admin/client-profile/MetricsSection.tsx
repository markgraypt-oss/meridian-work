import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import { Scale, Footprints, Moon, Zap, Dumbbell, Flame, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataPoint, WorkoutLog, NutritionDay, MetricKey, DrilldownDays } from "./types";
import { METRIC_ACCENT, DRILLDOWN_OPTIONS } from "./types";

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, colour }: { data: DataPoint[]; colour: string }) {
  if (data.length < 2) return null;
  const gradId = `sg${colour.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={colour} stopOpacity={0.25} />
            <stop offset="95%" stopColor={colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={colour} strokeWidth={1.5}
          fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Compute card headline + delta ────────────────────────────────────────────

interface CardStats { headline: string; unit: string; delta: number | null; positiveGood: boolean }

// Defensive numeric coercion: SQL aggregates (SUM/ROUND) can reach the client
// as strings depending on the pg type, and string arithmetic renders as NaN.
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

function computeStats(key: MetricKey, data: DataPoint[], workouts: WorkoutLog[]): CardStats {
  if (key === 'workouts') {
    const now     = new Date();
    const thisStart = startOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const thisCount = workouts.filter(w => w.date && parseISO(w.date) >= thisStart).length;
    const prevCount = workouts.filter(w => w.date && parseISO(w.date) >= prevStart && parseISO(w.date) < thisStart).length;
    return { headline: String(thisCount), unit: 'this month', delta: prevCount > 0 ? thisCount - prevCount : null, positiveGood: true };
  }

  if (!data.length) return { headline: '—', unit: '', delta: null, positiveGood: true };

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  let headline: string;
  let unit: string;

  if (key === 'bodyweight') {
    headline = num(sorted[sorted.length - 1].value).toFixed(1);
    unit = 'kg';
  } else if (key === 'readiness') {
    headline = Math.round(num(sorted[sorted.length - 1].value)).toString();
    unit = '/ 100';
  } else if (key === 'sleep') {
    const last7 = sorted.slice(-7).map(d => num(d.value));
    headline = (last7.reduce((a, b) => a + b, 0) / last7.length).toFixed(1);
    unit = 'h avg';
  } else if (key === 'steps') {
    const last7 = sorted.slice(-7).map(d => num(d.value));
    headline = Math.round(last7.reduce((a, b) => a + b, 0) / last7.length).toLocaleString();
    unit = 'avg / day';
  } else {
    const last7 = sorted.slice(-7).map(d => num(d.value));
    headline = Math.round(last7.reduce((a, b) => a + b, 0) / last7.length).toLocaleString();
    unit = 'kcal avg';
  }

  const last7  = sorted.slice(-7).map(d => num(d.value));
  const prev7  = sorted.slice(-14, -7).map(d => num(d.value));
  let delta: number | null = null;
  if (last7.length >= 3 && prev7.length >= 3) {
    const avgLast = last7.reduce((a, b) => a + b, 0) / last7.length;
    const avgPrev = prev7.reduce((a, b) => a + b, 0) / prev7.length;
    delta = avgLast - avgPrev;
  }

  return { headline, unit, delta, positiveGood: key !== 'bodyweight' };
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

const METRIC_ICONS: Record<MetricKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  bodyweight: Scale, steps: Footprints, sleep: Moon, readiness: Zap, calories: Flame, workouts: Dumbbell,
};
const METRIC_LABELS: Record<MetricKey, string> = {
  bodyweight: 'Bodyweight', steps: 'Daily steps', sleep: 'Sleep', readiness: 'Readiness', calories: 'Calories', workouts: 'Workouts',
};

function emptyText(key: MetricKey): string {
  if (key === 'bodyweight') return 'No weigh-ins yet.';
  if (key === 'workouts')   return 'No workouts logged yet.';
  if (key === 'calories')   return 'No calorie data yet.';
  return 'No data yet. Connect a wearable in the app.';
}

interface MetricCardProps {
  metricKey: MetricKey;
  data: DataPoint[] | null;
  workouts: WorkoutLog[];
  isLoading: boolean;
  onClick: () => void;
}

function MetricCard({ metricKey, data, workouts, isLoading, onClick }: MetricCardProps) {
  const colour  = METRIC_ACCENT[metricKey];
  const Icon    = METRIC_ICONS[metricKey];
  const label   = METRIC_LABELS[metricKey];
  const hasData = metricKey === 'workouts' ? workouts.length > 0 : (data?.length ?? 0) > 0;
  const isSparse = metricKey !== 'workouts' && (data?.length ?? 0) >= 1 && (data?.length ?? 0) <= 4;
  const stats   = hasData ? computeStats(metricKey, data ?? [], workouts) : null;

  const DeltaIcon = stats?.delta == null ? null : stats.delta > 0 ? TrendingUp : stats.delta < 0 ? TrendingDown : Minus;
  const deltaColour = stats?.delta == null || stats.delta === 0
    ? 'text-muted-foreground'
    : stats.positiveGood
      ? (stats.delta > 0 ? 'text-emerald-400' : 'text-red-400')
      : (stats.delta > 0 ? 'text-red-400' : 'text-emerald-400');

  return (
    <Card className="cursor-pointer hover:border-muted-foreground/40 transition-colors select-none" onClick={onClick}>
      <CardContent className="pt-4 pb-3 px-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Icon className="h-3.5 w-3.5" style={{ color: colour }} />
              {label}
            </div>
            {!hasData ? (
              <p className="text-xs text-muted-foreground py-4 leading-relaxed">{emptyText(metricKey)}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
                  <span className="text-2xl font-semibold tabular-nums leading-none">{stats!.headline}</span>
                  <span className="text-xs text-muted-foreground">{stats!.unit}</span>
                  {stats!.delta !== null && DeltaIcon && (
                    <span className={`flex items-center gap-0.5 text-xs ml-auto ${deltaColour}`}>
                      <DeltaIcon className="h-3 w-3" />
                      {Math.abs(stats!.delta).toFixed(metricKey === 'steps' ? 0 : 1)}
                    </span>
                  )}
                </div>
                {isSparse ? (
                  <p className="text-xs text-muted-foreground/60">Early data</p>
                ) : (
                  data && data.length >= 2 && <Sparkline data={data} colour={colour} />
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Drilldown Panel ──────────────────────────────────────────────────────────

interface DrilldownProps {
  userId: string;
  metric: MetricKey;
  onClose: () => void;
}

function DrilldownPanel({ userId, metric, onClose }: DrilldownProps) {
  const [days, setDays] = useState<DrilldownDays>(30);
  // How many windows back from "today" the chart is showing. 0 = the latest
  // window. Changing the range resets to the latest window.
  const [offset, setOffset] = useState(0);

  const endpoint = metric === 'calories' ? 'caloric-intake' : metric === 'workouts' ? 'workouts' : metric;
  // Fetch the full year once and slice the visible window client-side — this
  // is what makes the prev/next arrows instant instead of a refetch per step.
  const qParam   = metric === 'workouts' ? 'limit=200' : 'days=365';

  const { data: seriesRaw, isLoading } = useQuery<DataPoint[] | WorkoutLog[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/${endpoint}?${qParam}`],
  });

  const { data: nutritionRaw } = useQuery<NutritionDay[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/nutrition?days=365`],
    enabled: metric === 'calories',
  });

  const colour = METRIC_ACCENT[metric];
  const Icon   = METRIC_ICONS[metric];
  const label  = METRIC_LABELS[metric];

  // Workout-specific processing
  const workoutList = metric === 'workouts' ? (seriesRaw as WorkoutLog[] | undefined ?? []) : [];
  const fullSeries = metric !== 'workouts' ? (seriesRaw as DataPoint[] | undefined ?? []) : [];

  // ── Visible window ─────────────────────────────────────────────────────────
  const today = new Date();
  const windowEnd   = subDays(today, offset * days);
  const windowStart = subDays(windowEnd, days - 1);
  const startKey = format(windowStart, 'yyyy-MM-dd');
  const endKey   = format(windowEnd, 'yyyy-MM-dd');
  const series = fullSeries.filter(d => d.date >= startKey && d.date <= endKey);

  const hasOlder = fullSeries.some(d => d.date < startKey);
  const canGoBack    = hasOlder;                 // more data before this window
  const canGoForward = offset > 0;               // not already at the latest
  const sameYear = windowStart.getFullYear() === windowEnd.getFullYear();
  const windowLabel = `${format(windowStart, sameYear ? 'd MMM' : 'd MMM yy')} – ${format(windowEnd, 'd MMM')}`;

  // Stats row (windowed). Change needs 2+ points — render '—' otherwise, never
  // call toFixed on null (that exact null crashed the whole page to black).
  const values = series.map(d => num(d.value)).filter(v => !Number.isNaN(v));
  const rangeAvg  = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : null;
  const rangeHigh = values.length ? Math.max(...values) : null;
  const rangeLow  = values.length ? Math.min(...values) : null;
  const rangeChange = values.length >= 2 ? values[values.length - 1] - values[0] : null;

  const xFormatter = (d: string) => {
    try { return format(parseISO(d), 'd MMM'); } catch { return d; }
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: colour }} />
            {label}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Window navigation — step back/forward through time */}
            {metric !== 'workouts' && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoBack}
                  onClick={() => setOffset(o => o + 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums min-w-[110px] text-center">{windowLabel}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoForward}
                  onClick={() => setOffset(o => Math.max(0, o - 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {/* Range selector */}
            <div className="flex rounded-md border border-border overflow-hidden">
              {DRILLDOWN_OPTIONS.map(opt => (
                <button key={opt.days}
                  className={`px-2.5 py-1 text-xs transition-colors
                    ${days === opt.days ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => { setDays(opt.days as DrilldownDays); setOffset(0); }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : metric === 'workouts' ? (
          <WorkoutDrilldown workouts={workoutList} />
        ) : metric === 'calories' ? (
          <CaloriesDrilldown series={series}
            nutrition={(nutritionRaw ?? []).filter(n => n.date >= startKey && n.date <= endKey)}
            colour={colour} xFormatter={xFormatter} />
        ) : fullSeries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{emptyText(metric)}</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No data in this period — use the arrows to move through time.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`dd${colour.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colour} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colour} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="date" tickFormatter={xFormatter} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  labelFormatter={(l: string) => { try { return format(parseISO(l), 'd MMM yyyy'); } catch { return l; } }}
                  contentStyle={{ fontSize: 12, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}
                />
                {rangeAvg !== null && (
                  <ReferenceLine y={rangeAvg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                    label={{ value: 'Avg', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                )}
                <Area type="monotone" dataKey="value" stroke={colour} strokeWidth={2}
                  fill={`url(#dd${colour.replace('#', '')})`}
                  dot={series.length <= 14 ? { r: 3, fill: colour, strokeWidth: 0 } : false}
                  isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Stats row — every cell null-safe; '—' when the window can't support the stat */}
            {rangeAvg !== null && (
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/40">
                {[
                  { label: 'Average', value: rangeAvg.toFixed(1) },
                  { label: 'High',    value: rangeHigh !== null ? rangeHigh.toFixed(1) : '—' },
                  { label: 'Low',     value: rangeLow !== null ? rangeLow.toFixed(1) : '—' },
                  rangeChange !== null
                    ? { label: 'Change', value: (rangeChange >= 0 ? '+' : '') + rangeChange.toFixed(1), colour: rangeChange > 0 ? '#34d399' : rangeChange < 0 ? '#f87171' : undefined }
                    : { label: 'Change', value: '—', colour: undefined },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-lg font-semibold tabular-nums" style={s.colour ? { color: s.colour } : {}}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkoutDrilldown({ workouts }: { workouts: WorkoutLog[] }) {
  if (!workouts.length) return <p className="text-sm text-muted-foreground text-center py-12">No workouts logged yet.</p>;
  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left pb-2 font-medium">Date</th>
            <th className="text-left pb-2 font-medium">Workout</th>
            <th className="text-right pb-2 font-medium">Mins</th>
            <th className="text-right pb-2 font-medium">RPE</th>
          </tr>
        </thead>
        <tbody>
          {workouts.slice(0, 50).map(w => (
            <tr key={w.id} className="border-b border-border/40 last:border-0">
              <td className="py-1.5 text-muted-foreground whitespace-nowrap pr-3">{w.date?.slice(0, 10) ?? '—'}</td>
              <td className="py-1.5 max-w-[200px] truncate">{w.name ?? 'Workout'}</td>
              <td className="py-1.5 text-right">{w.durationMinutes ?? '—'}</td>
              <td className="py-1.5 text-right">{w.rating ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaloriesDrilldown({
  series, nutrition, colour, xFormatter,
}: { series: DataPoint[]; nutrition: NutritionDay[]; colour: string; xFormatter: (d: string) => string }) {
  if (!series.length && !nutrition.length) return <p className="text-sm text-muted-foreground text-center py-12">No calorie data yet.</p>;

  const displayData = series.length >= nutrition.length
    ? series.map(s => ({ date: s.date, value: num(s.value) }))
    : nutrition.map(n => ({ date: n.date, value: num(n.calories) }));
  const avgProt = nutrition.length ? Math.round(nutrition.reduce((a, b) => a + num(b.protein ?? 0), 0) / nutrition.length) : null;
  const avgCarb = nutrition.length ? Math.round(nutrition.reduce((a, b) => a + num(b.carbs ?? 0), 0) / nutrition.length) : null;
  const avgFat  = nutrition.length ? Math.round(nutrition.reduce((a, b) => a + num(b.fat ?? 0), 0) / nutrition.length) : null;
  const avgCals = displayData.length ? Math.round(displayData.reduce((a, b) => a + b.value, 0) / displayData.length) : null;

  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={displayData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis dataKey="date" tickFormatter={xFormatter} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
          <Tooltip
            labelFormatter={(l: string) => { try { return format(parseISO(l), 'd MMM yyyy'); } catch { return l; } }}
            formatter={(v: number) => [`${v.toLocaleString()} kcal`, 'Calories']}
            contentStyle={{ fontSize: 12, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}
          />
          {avgCals !== null && (
            <ReferenceLine y={avgCals} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
              label={{ value: 'Avg', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          )}
          <Bar dataKey="value" fill={colour} fillOpacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {(avgProt !== null || avgCarb !== null || avgFat !== null) && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/40">
          {[
            { label: 'Protein avg', value: avgProt !== null ? `${avgProt}g` : '—', colour: '#60a5fa' },
            { label: 'Carbs avg',   value: avgCarb !== null ? `${avgCarb}g` : '—', colour: '#fbbf24' },
            { label: 'Fat avg',     value: avgFat  !== null ? `${avgFat}g`  : '—', colour: '#f87171' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-semibold" style={{ color: s.colour }}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── MetricsSection ───────────────────────────────────────────────────────────

const METRIC_KEYS: MetricKey[] = ['bodyweight', 'steps', 'sleep', 'readiness', 'calories', 'workouts'];

interface MetricsSectionProps {
  userId: string;
  bodyweight: DataPoint[] | null;
  steps: DataPoint[] | null;
  sleep: DataPoint[] | null;
  readiness: DataPoint[] | null;
  calories: DataPoint[] | null;
  workouts: WorkoutLog[];
  isLoading: boolean;
}

export function MetricsSection({ userId, bodyweight, steps, sleep, readiness, calories, workouts, isLoading }: MetricsSectionProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  const dataMap: Record<MetricKey, DataPoint[] | null> = {
    bodyweight, steps, sleep, readiness, calories, workouts: null,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRIC_KEYS.map(mk => (
          <MetricCard key={mk} metricKey={mk}
            data={dataMap[mk]} workouts={workouts} isLoading={isLoading}
            onClick={() => setActiveMetric(activeMetric === mk ? null : mk)} />
        ))}
      </div>
      {activeMetric && (
        <DrilldownPanel userId={userId} metric={activeMetric} onClose={() => setActiveMetric(null)} />
      )}
    </div>
  );
}
