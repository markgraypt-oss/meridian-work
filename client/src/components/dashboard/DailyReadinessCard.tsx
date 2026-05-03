import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface TodayResp {
  enabled: boolean;
  date: string;
  score: number | null;
  inputCount: number;
  daysOfHistory: number;
}

interface HistoryResp {
  enabled: boolean;
  history: Array<{ date: string; score: number | null; inputCount: number }>;
}

const HISTORY_REQUIRED = 14;

function scoreColor(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#0cc9a9";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
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

export default function DailyReadinessCard() {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <Card className="bg-card border-border" data-testid="card-daily-readiness">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start justify-between">
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
        </div>

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
