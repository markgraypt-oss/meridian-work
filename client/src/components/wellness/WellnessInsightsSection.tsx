import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, TrendingUp, TrendingDown, Minus, Link2, Lightbulb, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Mode = "trends" | "correlations" | "recommendations";

interface TrendsData {
  overallTrend?: "improving" | "declining" | "stable" | "mixed";
  summary?: string;
  trends?: Array<{
    metric: string;
    direction: "up" | "down" | "stable";
    detail: string;
    severity: "positive" | "neutral" | "concerning";
  }>;
  bestMetric?: string;
  watchMetric?: string;
}

interface CorrelationsData {
  correlations?: Array<{
    finding: string;
    evidence: string;
    insight: string;
    actionable: string;
  }>;
  summary?: string;
}

interface RecommendationsData {
  recommendations?: Array<{
    title: string;
    type: "quick_win" | "habit_change" | "long_term";
    detail: string;
    reason: string;
    impact: string;
  }>;
  encouragement?: string;
}

type ResponseShape =
  | { mode: "trends"; data: TrendsData }
  | { mode: "correlations"; data: CorrelationsData }
  | { mode: "recommendations"; data: RecommendationsData };

function DirectionIcon({ direction }: { direction?: string }) {
  if (direction === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === "down") return <TrendingDown className="h-4 w-4 text-rose-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function severityClass(severity?: string) {
  if (severity === "positive") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (severity === "concerning") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return "bg-muted text-foreground";
}

interface Props {
  defaultMode?: Mode;
}

export default function WellnessInsightsSection({ defaultMode = "trends" }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [results, setResults] = useState<Partial<Record<Mode, ResponseShape["data"]>>>({});
  const [errors, setErrors] = useState<Partial<Record<Mode, string>>>({});

  const mutation = useMutation({
    mutationFn: async (m: Mode) => {
      const res = await apiRequest("POST", "/api/ai/check-in-insights", { mode: m });
      return (await res.json()) as ResponseShape;
    },
    onSuccess: (res) => {
      setResults((prev) => ({ ...prev, [res.mode]: res.data }));
      setErrors((prev) => ({ ...prev, [res.mode]: undefined }));
    },
    onError: (err: Error, m) => {
      setErrors((prev) => ({ ...prev, [m]: err.message || "Could not generate insights right now." }));
      toast({ title: "Could not generate insights", description: err.message, variant: "destructive" });
    },
  });

  const handleRun = (m: Mode) => {
    setMode(m);
    mutation.mutate(m);
  };

  const current = results[mode];
  const currentError = errors[mode];
  const isLoading = mutation.isPending && mutation.variables === mode;

  return (
    <Card id="wellness-insights" className="mt-6 border-2 border-[#0cc9a9]/30 scroll-mt-20" data-testid="card-wellness-insights">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0cc9a9]" /> Wellness insights
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI analysis of your check-ins, sleep, training, and nutrition.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends" data-testid="tab-trends">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Trends
            </TabsTrigger>
            <TabsTrigger value="correlations" data-testid="tab-correlations">
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Patterns
            </TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">
              <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Actions
            </TabsTrigger>
          </TabsList>

          {(["trends", "correlations", "recommendations"] as Mode[]).map((m) => (
            <TabsContent key={m} value={m} className="mt-4 space-y-3">
              {!results[m] && !errors[m] && !(isLoading && mode === m) && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    {m === "trends" && "See how your mood, energy, stress, sleep, and clarity have moved over the last 1-2 weeks."}
                    {m === "correlations" && "Find what's driving how you feel by linking habits to outcomes."}
                    {m === "recommendations" && "Get 3 specific actions for the week ahead, tied to your data."}
                  </p>
                  <Button
                    onClick={() => handleRun(m)}
                    className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                    data-testid={`button-generate-${m}`}
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Generate
                  </Button>
                </div>
              )}

              {isLoading && mode === m && (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}

              {errors[m] && !(isLoading && mode === m) && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p>{errors[m]}</p>
                    <Button variant="ghost" size="sm" className="mt-2 h-7" onClick={() => handleRun(m)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
                    </Button>
                  </div>
                </div>
              )}

              {results[m] && !(isLoading && mode === m) && (
                <>
                  {m === "trends" && <TrendsView data={results.trends as TrendsData} />}
                  {m === "correlations" && <CorrelationsView data={results.correlations as CorrelationsData} />}
                  {m === "recommendations" && <RecommendationsView data={results.recommendations as RecommendationsData} />}
                  <div className="flex justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleRun(m)} data-testid={`button-refresh-${m}`}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TrendsView({ data }: { data: TrendsData }) {
  if (!data || (!data.summary && !data.trends?.length)) {
    return <p className="text-sm text-muted-foreground">Not enough data to spot a trend yet. Keep logging check-ins.</p>;
  }
  return (
    <div className="space-y-3" data-testid="view-trends">
      {data.summary && (
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2 mb-1">
            {data.overallTrend && (
              <Badge variant="secondary" className="capitalize">{data.overallTrend}</Badge>
            )}
          </div>
          <p className="text-sm">{data.summary}</p>
        </div>
      )}
      {data.trends?.map((t, i) => (
        <div key={i} className={`rounded-lg p-3 ${severityClass(t.severity)}`} data-testid={`trend-${i}`}>
          <div className="flex items-center gap-2 mb-1">
            <DirectionIcon direction={t.direction} />
            <span className="text-sm font-medium capitalize">{t.metric}</span>
          </div>
          <p className="text-sm">{t.detail}</p>
        </div>
      ))}
      {(data.bestMetric || data.watchMetric) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {data.bestMetric && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
              <p className="text-xs text-muted-foreground">Strongest</p>
              <p className="text-sm font-medium capitalize">{data.bestMetric}</p>
            </div>
          )}
          {data.watchMetric && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
              <p className="text-xs text-muted-foreground">Watch</p>
              <p className="text-sm font-medium capitalize">{data.watchMetric}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CorrelationsView({ data }: { data: CorrelationsData }) {
  if (!data || !data.correlations?.length) {
    return <p className="text-sm text-muted-foreground">No clear patterns yet. More data will unlock these.</p>;
  }
  return (
    <div className="space-y-3" data-testid="view-correlations">
      {data.summary && (
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm">{data.summary}</p>
        </div>
      )}
      {data.correlations.map((c, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2" data-testid={`correlation-${i}`}>
          <p className="text-sm font-medium">{c.finding}</p>
          <p className="text-xs text-muted-foreground">{c.evidence}</p>
          <p className="text-sm">{c.insight}</p>
          <div className="rounded-md bg-[#0cc9a9]/10 border border-[#0cc9a9]/30 p-2">
            <p className="text-xs font-medium text-[#0cc9a9] mb-0.5">Try this</p>
            <p className="text-sm">{c.actionable}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationsView({ data }: { data: RecommendationsData }) {
  if (!data || !data.recommendations?.length) {
    return <p className="text-sm text-muted-foreground">No recommendations yet.</p>;
  }
  const typeLabel = (t: string) => {
    if (t === "quick_win") return "Quick win";
    if (t === "habit_change") return "This week";
    if (t === "long_term") return "Long term";
    return t;
  };
  return (
    <div className="space-y-3" data-testid="view-recommendations">
      {data.recommendations.map((r, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2" data-testid={`recommendation-${i}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium flex-1">{r.title}</p>
            <Badge variant="secondary" className="flex-shrink-0">{typeLabel(r.type)}</Badge>
          </div>
          <p className="text-sm">{r.detail}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground mb-0.5">Why</p>
              <p className="text-xs">{r.reason}</p>
            </div>
            <div className="rounded-md bg-[#0cc9a9]/10 p-2">
              <p className="text-xs text-muted-foreground mb-0.5">Impact</p>
              <p className="text-xs">{r.impact}</p>
            </div>
          </div>
        </div>
      ))}
      {data.encouragement && (
        <div className="rounded-lg bg-[#0cc9a9]/10 border border-[#0cc9a9]/30 p-3">
          <p className="text-sm italic">{data.encouragement}</p>
        </div>
      )}
    </div>
  );
}
