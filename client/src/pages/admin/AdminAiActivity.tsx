import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, Clock, DollarSign, ListChecks } from "lucide-react";

interface AiCallLog {
  id: number;
  userId: string | null;
  feature: string;
  provider: string | null;
  model: string | null;
  promptHash: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  validationOutcome: string | null;
  safetyFlags: string[] | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AiCallLogsResponse {
  logs: AiCallLog[];
  aggregates: {
    totalCalls: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
    byOutcome: Record<string, number>;
    byFeature: { feature: string; count: number; tokens: number; costUsd: number }[];
    byModel: { model: string; count: number; tokens: number; costUsd: number }[];
    safetyFlagCount: number;
  };
}

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  valid: "default",
  repaired: "secondary",
  no_schema: "outline",
  invalid: "destructive",
  error: "destructive",
  timeout: "destructive",
};

export default function AdminAiActivity() {
  const [feature, setFeature] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [model, setModel] = useState<string>("all");
  const [days, setDays] = useState<string>("7");

  const { data, isLoading } = useQuery<AiCallLogsResponse>({
    queryKey: ["/api/admin/ai-call-logs", feature, outcome, model, days],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feature !== "all") params.set("feature", feature);
      if (outcome !== "all") params.set("outcome", outcome);
      if (model !== "all") params.set("model", model);
      params.set("days", days);
      const res = await fetch(`/api/admin/ai-call-logs?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const featureOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.aggregates.byFeature || []).forEach((f) => set.add(f.feature));
    (data?.logs || []).forEach((l) => set.add(l.feature));
    return Array.from(set).sort();
  }, [data]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.aggregates.byModel || []).forEach((m) => set.add(m.model));
    (data?.logs || []).forEach((l) => { if (l.model) set.add(l.model); });
    return Array.from(set).sort();
  }, [data]);

  const aggregates = data?.aggregates;

  return (
    <div className="min-h-screen bg-background">
      <TopHeader />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            AI Activity
          </h1>
          <p className="text-muted-foreground mt-1">
            Every AI call routed through the shared wrapper. Filter by feature, validation outcome, or window.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-total-calls">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1"><ListChecks className="h-4 w-4" /> Total calls</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{aggregates?.totalCalls ?? 0}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-tokens">
            <CardHeader className="pb-2">
              <CardDescription>Total tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{(aggregates?.totalTokens ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-cost">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Est. cost</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${(aggregates?.estimatedCostUsd ?? 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per-model input/output rates from public pricing</p>
            </CardContent>
          </Card>
          <Card data-testid="card-latency">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" /> Avg latency</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{Math.round(aggregates?.avgLatencyMs ?? 0)} ms</p>
              {(aggregates?.safetyFlagCount ?? 0) > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {aggregates?.safetyFlagCount} safety flag(s)
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="feat">Feature</Label>
                <Select value={feature} onValueChange={setFeature}>
                  <SelectTrigger id="feat" data-testid="select-feature"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All features</SelectItem>
                    {featureOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" data-testid="select-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All models</SelectItem>
                    {modelOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="out">Validation outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger id="out" data-testid="select-outcome"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    <SelectItem value="valid">Valid</SelectItem>
                    <SelectItem value="repaired">Repaired</SelectItem>
                    <SelectItem value="no_schema">No schema</SelectItem>
                    <SelectItem value="invalid">Invalid</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="timeout">Timeout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="days">Window</Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger id="days" data-testid="select-days"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {aggregates && aggregates.byFeature.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">By feature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aggregates.byFeature.slice(0, 10).map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0" data-testid={`row-feature-${f.feature}`}>
                    <span className="font-medium">{f.feature}</span>
                    <span className="text-muted-foreground">{f.count} calls · {f.tokens.toLocaleString()} tokens · ${f.costUsd.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent calls</CardTitle>
            <CardDescription>{isLoading ? "Loading..." : `${data?.logs.length ?? 0} entries`}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left">
                    <th className="p-2">Time</th>
                    <th className="p-2">Feature</th>
                    <th className="p-2">Model</th>
                    <th className="p-2">Outcome</th>
                    <th className="p-2 text-right">Tokens</th>
                    <th className="p-2 text-right">Latency</th>
                    <th className="p-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.logs || []).map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30" data-testid={`row-log-${log.id}`}>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-2 font-medium">{log.feature}</td>
                      <td className="p-2 text-muted-foreground">{log.model || "-"}</td>
                      <td className="p-2">
                        <Badge variant={OUTCOME_VARIANT[log.validationOutcome || "no_schema"] || "outline"}>
                          {log.validationOutcome || "-"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">{log.totalTokens ?? 0}</td>
                      <td className="p-2 text-right">{log.latencyMs ?? 0}ms</td>
                      <td className="p-2">
                        {log.safetyFlags && log.safetyFlags.length > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {log.safetyFlags.join(", ")}
                          </span>
                        ) : log.errorMessage ? (
                          <span className="text-red-600 dark:text-red-400 text-xs truncate max-w-[200px] inline-block" title={log.errorMessage}>
                            {log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && (data?.logs.length ?? 0) === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No AI calls logged in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
