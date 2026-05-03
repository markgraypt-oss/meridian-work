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

function inputColor(value: number | null): string {
  if (value == null) return "#94a3b8";
  // Inputs are 0-10; reuse the same buckets as score (×10).
  return scoreColor(value * 10);
}

function Sparkline({
  data,
  width = 240,
  height = 48,
}: {
  data: Array<{ date: string; score: number | null }>;
  width?: number;
  height?: number;
}) {
  const points = data.filter((d) => d.score != null) as Array<{ date: string; score: number }>;
  if (points.length < 2) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Not enough data for a trendline yet.
      </div>
    );
  }
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((p) => height - (p.score / 100) * height);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={scoreColor(last.score)} strokeWidth={2} strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={scoreColor(last.score)} />
    </svg>
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
  const { data: history } = useQuery<HistoryResp>({
    queryKey: ["/api/daily-readiness/history", expanded ? 30 : 7],
    queryFn: async () => {
      const res = await fetch(`/api/daily-readiness/history?days=${expanded ? 30 : 7}`, {
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
          <div className="h-24 animate-pulse bg-muted/50 rounded" />
        </CardContent>
      </Card>
    );
  }
  if (!today || !today.enabled) return null;

  const stillBuilding = today.daysOfHistory < HISTORY_REQUIRED;
  // While building the baseline (<14 days of computed history) we hide the
  // numeric score even when today's inputs are sufficient — the baseline
  // context isn't trustworthy yet, so showing a number would be misleading.
  const showScore = today.score != null && !stillBuilding;
  const scoreColorHex = scoreColor(showScore ? today.score : null);
  // The reasons panel is always available — even when every input is
  // missing, that's exactly the state where the user most benefits from
  // seeing what to log next. Guard only against a missing payload shape.
  const canShowReasons = !!today.inputs && !!today.sources;

  return (
    <Card className="bg-card border-border" data-testid="card-daily-readiness">
      <CardContent className="py-5 space-y-4">
        <button
          type="button"
          onClick={() => canShowReasons && setShowReasons((v) => !v)}
          className={`flex items-start justify-between w-full text-left ${
            canShowReasons ? "cursor-pointer" : "cursor-default"
          }`}
          data-testid="button-readiness-card"
          aria-expanded={showReasons}
        >
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily Readiness</p>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Personal — not shared.</p>
          </div>
          {showScore && (
            <div className="text-right">
              <p className="text-3xl font-bold leading-none" style={{ color: scoreColorHex }} data-testid="text-readiness-score">
                {today.score}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">/ 100</p>
            </div>
          )}
        </button>

        {stillBuilding && (
          <p className="text-sm text-muted-foreground" data-testid="text-readiness-empty">
            Building your baseline — keep checking in. ({today.daysOfHistory}/{HISTORY_REQUIRED} days)
          </p>
        )}

        {!stillBuilding && today.score == null && (
          <p className="text-sm text-muted-foreground">
            Not enough signals today. Log a check-in to compute today's score.
          </p>
        )}

        {showScore && history?.history && history.history.length > 0 && (
          <Sparkline data={history.history} />
        )}

        {canShowReasons && (
          <button
            type="button"
            onClick={() => setShowReasons((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-readiness-why"
            aria-expanded={showReasons}
          >
            <HelpCircle className="h-3 w-3" />
            {showReasons ? "Hide reasons" : "Why?"}
          </button>
        )}

        {showReasons && canShowReasons && (
          <ReasonsPanel inputs={today.inputs} sources={today.sources} />
        )}

        {!stillBuilding && history?.history && history.history.length > 0 && (
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

        {expanded && history?.history && (
          <div className="grid grid-cols-10 gap-1 pt-1">
            {history.history.map((d) => (
              <div
                key={d.date}
                className="h-6 rounded-sm"
                style={{
                  backgroundColor: d.score != null ? scoreColor(d.score) : "var(--muted)",
                  opacity: d.score != null ? Math.max(0.3, d.score / 100) : 0.25,
                }}
                title={`${d.date}: ${d.score ?? "no data"}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
