import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Moon,
  Activity,
  Zap,
  Utensils,
  Footprints,
  HeartPulse,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

type InputKey = "sleep" | "pain" | "energy" | "nutrition" | "movement" | "recovery";

type InputSource =
  | "wearable"
  | "check-in"
  | "body-map"
  | "sleep-log"
  | "meal-log"
  | "workout-log"
  | "step-log";

type InputsMap = Record<InputKey, number | null>;
type SourcesMap = Record<InputKey, InputSource | null>;

interface TodayResp {
  enabled: boolean;
  date: string;
  score: number | null;
  inputCount: number;
  daysOfHistory: number;
  inputs: InputsMap;
  sources: SourcesMap;
}

interface HistoryResp {
  enabled: boolean;
  history: Array<{ date: string; score: number | null; inputCount: number }>;
}

const HISTORY_REQUIRED = 14;

const INPUT_META: Record<
  InputKey,
  { label: string; Icon: typeof Moon; missingHint: string }
> = {
  sleep: { label: "Sleep", Icon: Moon, missingHint: "Sync a wearable or log last night's sleep." },
  pain: { label: "Pain", Icon: Activity, missingHint: "Mark pain on the body map to capture this." },
  energy: { label: "Energy", Icon: Zap, missingHint: "Complete today's check-in." },
  nutrition: { label: "Nutrition", Icon: Utensils, missingHint: "Log a meal to count toward today." },
  movement: { label: "Movement", Icon: Footprints, missingHint: "Log a workout or sync your steps." },
  recovery: { label: "Recovery", Icon: HeartPulse, missingHint: "Check in with your mood and stress." },
};

const SOURCE_LABEL: Record<InputSource, string> = {
  "wearable": "Wearable",
  "check-in": "Check-in",
  "body-map": "Body map",
  "sleep-log": "Sleep log",
  "meal-log": "Meal log",
  "workout-log": "Workout log",
  "step-log": "Step log",
};

const INPUT_ORDER: InputKey[] = ["sleep", "pain", "energy", "nutrition", "movement", "recovery"];

function scoreColor(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#0cc9a9";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number | null): string {
  if (score == null) return "—";
  if (score >= 85) return "Peak";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Steady";
  if (score >= 40) return "Recovering";
  return "Low";
}

function scoreCoachLine(score: number | null, topInput: InputKey | null): string {
  if (score == null) return "";
  const topLabel = topInput ? INPUT_META[topInput].label.toLowerCase() : null;
  if (score >= 85)
    return topLabel
      ? `Peak readiness — ${topLabel} is leading. Good day to push.`
      : "Peak readiness. Good day to push.";
  if (score >= 70)
    return topLabel
      ? `Strong day — ${topLabel} is your strength. Train as planned.`
      : "Strong day. Train as planned.";
  if (score >= 55)
    return "Steady. Keep intensity moderate and stay consistent.";
  if (score >= 40)
    return "Recovering. Favour mobility, walking, or light work today.";
  return "Low readiness. Prioritise sleep, food, and rest.";
}

function inputColor(value: number | null): string {
  if (value == null) return "#94a3b8";
  return scoreColor(value * 10);
}

function topInput(inputs: InputsMap): InputKey | null {
  let best: InputKey | null = null;
  let bestVal = -1;
  for (const k of INPUT_ORDER) {
    const v = inputs[k];
    if (v != null && v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

/** Big circular gauge ring with score inside, Whoop-style. */
function ScoreRing({ score, size = 168 }: { score: number | null; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  const color = scoreColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          opacity={0.35}
        />
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: "stroke-dasharray 600ms ease-out" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Meridian
        </p>
        {score == null ? (
          <p className="text-4xl font-bold text-muted-foreground mt-1">—</p>
        ) : (
          <p
            className="text-5xl font-bold leading-none mt-1 tabular-nums"
            style={{ color }}
            data-testid="text-readiness-score"
          >
            {score}
            <span className="text-xl ml-0.5" style={{ color }}>
              %
            </span>
          </p>
        )}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em] mt-2"
          style={{ color: scoreColor(score) }}
        >
          {scoreLabel(score)}
        </p>
      </div>
    </div>
  );
}

/** Full-width sparkline with area fill, dot on today, soft baseline. */
function Sparkline({
  data,
  height = 56,
}: {
  data: Array<{ date: string; score: number | null }>;
  height?: number;
}) {
  const points = data.filter((d) => d.score != null) as Array<{ date: string; score: number }>;
  if (points.length < 2) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Trendline appears once you have a few days of data.
      </div>
    );
  }
  // viewBox-based so the SVG scales to container width.
  const W = 300;
  const H = height;
  const padTop = 4;
  const padBot = 4;
  const usable = H - padTop - padBot;
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map((p) => padTop + usable - (p.score / 100) * usable);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L ${xs[xs.length - 1].toFixed(1)} ${H} L ${xs[0].toFixed(1)} ${H} Z`;
  const last = points[points.length - 1];
  const color = scoreColor(last.score);
  const gradId = `spark-grad-${Math.round(last.score)}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} className="block">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill={color} />
      </svg>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
        <span>{points.length} days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Color legend strip used under the heatmap. */
function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span>Low</span>
      <div
        className="h-2 flex-1 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #ef4444 0%, #f59e0b 35%, #0cc9a9 65%, #22c55e 100%)",
        }}
      />
      <span>High</span>
    </div>
  );
}

/** Weekly heatmap: rows = weeks, columns = Mon..Sun. Today gets a ring. */
function WeeklyHeatmap({
  history,
  todayKey,
}: {
  history: Array<{ date: string; score: number | null }>;
  todayKey: string;
}) {
  // Build a Mon..Sun grid going back N weeks. Use UTC date string parsing
  // to avoid TZ drift on the YYYY-MM-DD keys the API returns.
  const byDate = new Map(history.map((d) => [d.date, d]));
  const today = new Date(todayKey + "T12:00:00Z");
  // Find the Monday of this week (UTC).
  const dow = (today.getUTCDay() + 6) % 7; // 0 = Mon
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - dow);

  // 5 weeks ≈ 35 cells, covers a 30-day window with some padding.
  const weeks = 5;
  const rows: Array<Array<{ key: string; score: number | null; isFuture: boolean; isToday: boolean }>> = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const row: typeof rows[number] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(thisMonday);
      cell.setUTCDate(thisMonday.getUTCDate() - w * 7 + d);
      const key = cell.toISOString().slice(0, 10);
      const isFuture = cell.getTime() > today.getTime();
      const rec = byDate.get(key);
      row.push({
        key,
        score: rec?.score ?? null,
        isFuture,
        isToday: key === todayKey,
      });
    }
    rows.push(row);
  }

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {dayLabels.map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-medium uppercase text-muted-foreground text-center"
          >
            {d}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 gap-1.5">
          {row.map((cell) => {
            const empty = cell.isFuture || cell.score == null;
            return (
              <div
                key={cell.key}
                className={`aspect-square rounded-md ${cell.isToday ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card" : ""}`}
                style={{
                  backgroundColor: empty
                    ? "hsl(var(--muted))"
                    : scoreColor(cell.score),
                  opacity: cell.isFuture
                    ? 0.15
                    : cell.score != null
                    ? Math.max(0.45, cell.score / 100)
                    : 0.35,
                }}
                title={
                  cell.isFuture
                    ? cell.key
                    : `${cell.key}: ${cell.score != null ? `${cell.score} / 100` : "no data"}`
                }
                data-testid={`heatmap-cell-${cell.key}`}
              />
            );
          })}
        </div>
      ))}
      <HeatmapLegend />
    </div>
  );
}

function ReasonsPanel({ inputs, sources }: { inputs: InputsMap; sources: SourcesMap }) {
  const missingCount = INPUT_ORDER.filter((k) => inputs[k] == null).length;
  return (
    <div
      className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
      data-testid="panel-readiness-reasons"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What's driving today's score
        </p>
        {missingCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {missingCount} missing
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {INPUT_ORDER.map((key) => {
          const value = inputs[key];
          const source = sources[key];
          const meta = INPUT_META[key];
          const missing = value == null;
          const Icon = meta.Icon;
          return (
            <li
              key={key}
              className="flex items-center gap-2 text-sm"
              data-testid={`reason-row-${key}`}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: inputColor(value) }}
              />
              <span className="font-medium text-foreground w-20">{meta.label}</span>
              {missing ? (
                <>
                  <span
                    className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    data-testid={`reason-missing-${key}`}
                  >
                    Missing
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {meta.missingHint}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="font-mono text-sm tabular-nums"
                    style={{ color: inputColor(value) }}
                    data-testid={`reason-value-${key}`}
                  >
                    {value!.toFixed(1)}
                    <span className="text-muted-foreground text-xs">/10</span>
                  </span>
                  {source && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground ml-auto">
                      {SOURCE_LABEL[source]}
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {missingCount > 0 && (
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          Logging the missing items today will refine your score.
        </p>
      )}
    </div>
  );
}

export default function DailyReadinessCard() {
  const [expanded, setExpanded] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const { data: today, isLoading } = useQuery<TodayResp>({
    queryKey: ["/api/daily-readiness/today"],
  });
  // Always pull 30 days so the heatmap and the 7-day average have data
  // available regardless of whether the heatmap is currently expanded.
  const { data: history } = useQuery<HistoryResp>({
    queryKey: ["/api/daily-readiness/history", 30],
    queryFn: async () => {
      const res = await fetch(`/api/daily-readiness/history?days=30`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch readiness history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6">
          <div className="h-48 animate-pulse bg-muted/50 rounded" />
        </CardContent>
      </Card>
    );
  }
  if (!today || !today.enabled) return null;

  const stillBuilding = today.daysOfHistory < HISTORY_REQUIRED;
  const showScore = today.score != null && !stillBuilding;
  const canShowReasons = !!today.inputs && !!today.sources;

  // Compute a vs-7-day-average delta for the trend pill.
  const histAll = history?.history ?? [];
  const last7 = histAll.slice(-8, -1).filter((d) => d.score != null) as Array<{ score: number }>;
  const avg7 =
    last7.length > 0
      ? Math.round(last7.reduce((s, d) => s + d.score, 0) / last7.length)
      : null;
  const delta =
    showScore && today.score != null && avg7 != null ? today.score - avg7 : null;

  const lead = topInput(today.inputs);
  const coachLine = showScore ? scoreCoachLine(today.score, lead) : "";

  return (
    <Card className="bg-card border-border" data-testid="card-daily-readiness">
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Daily Readiness
            </p>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Beta
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Personal
          </p>
        </div>

        {/* Big ring */}
        {showScore ? (
          <div className="flex flex-col items-center">
            <ScoreRing score={today.score} />
            {coachLine && (
              <p
                className="text-sm text-foreground text-center mt-4 max-w-[280px]"
                data-testid="text-readiness-coach"
              >
                {coachLine}
              </p>
            )}
            {delta != null && (
              <div
                className="flex items-center gap-1.5 mt-3 text-xs"
                data-testid="text-readiness-delta"
              >
                {delta > 0 ? (
                  <ArrowUp className="h-3.5 w-3.5 text-[#22c55e]" />
                ) : delta < 0 ? (
                  <ArrowDown className="h-3.5 w-3.5 text-[#ef4444]" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className="font-semibold tabular-nums"
                  style={{
                    color:
                      delta > 0
                        ? "#22c55e"
                        : delta < 0
                        ? "#ef4444"
                        : "hsl(var(--muted-foreground))",
                  }}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
                <span className="text-muted-foreground">vs your 7-day average</span>
              </div>
            )}
          </div>
        ) : stillBuilding ? (
          <div className="flex flex-col items-center text-center py-2">
            <ScoreRing score={null} />
            <p className="text-sm text-muted-foreground mt-4 max-w-[280px]">
              Building your baseline. Keep checking in — your first score appears at{" "}
              {HISTORY_REQUIRED} days. ({today.daysOfHistory}/{HISTORY_REQUIRED})
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-2">
            <ScoreRing score={null} />
            <p className="text-sm text-muted-foreground mt-4 max-w-[280px]">
              Not enough signals today. Log a check-in or sync a wearable to compute
              today's score.
            </p>
          </div>
        )}

        {/* Sparkline trendline */}
        {showScore && histAll.length > 1 && (
          <div className="pt-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Trend
            </p>
            <Sparkline data={histAll.slice(-14)} />
          </div>
        )}

        {/* Why? toggle */}
        {canShowReasons && (
          <button
            type="button"
            onClick={() => setShowReasons((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-readiness-why"
            aria-expanded={showReasons}
          >
            <HelpCircle className="h-3 w-3" />
            {showReasons ? "Hide reasons" : "Why this score?"}
          </button>
        )}
        {showReasons && canShowReasons && (
          <ReasonsPanel inputs={today.inputs} sources={today.sources} />
        )}

        {/* 30-day heatmap toggle */}
        {!stillBuilding && histAll.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-readiness-toggle"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Hide 30-day history
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show 30-day history
              </>
            )}
          </button>
        )}

        {expanded && histAll.length > 0 && (
          <div className="pt-1">
            <WeeklyHeatmap history={histAll} todayKey={today.date} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
