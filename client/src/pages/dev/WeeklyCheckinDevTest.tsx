/**
 * Dev-only verification page for the weekly check-in V2 UI.
 *
 * Not linked from any production navigation. Route is registered only when
 * import.meta.env.DEV is true (Vite dev server), and the backing API endpoint
 * is gated behind NODE_ENV !== "production" on the server.
 *
 * Visit: /dev/weekly-checkin-test
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Dumbbell,
  Target,
  Repeat2,
  Moon,
  ScanLine,
  Salad,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// ── Minimal V2 types (mirrors weekly-checkin.tsx) ─────────────────────────────

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
  _v: 4;
  weekStart: string;
  weekEnd: string;
  hero: string;
  trajectoryLabel: TrajectoryLabel;
  cards: V2Cards;
  metrics: any;
}

type DevScenario = "connected" | "unconnected" | "sparse" | "claude_failure";

interface ScenarioResult {
  scenario: DevScenario;
  payload: V2Payload;
  durationMs: number;
}

// ── Sub-components (exact copies from weekly-checkin.tsx) ─────────────────────

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

function ScoreChip({ label, value, max = 5 }: { label: string; value: number | null; max?: number }) {
  if (value === null) return null;
  const pct = (value / max) * 100;
  const color = pct >= 70 ? "text-emerald-600 dark:text-emerald-400" : pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

const statusConfig: Record<"active" | "chronic" | "resolved", { color: string; label: string }> = {
  active: { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40", label: "Active" },
  chronic: { color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-300/40", label: "Ongoing" },
  resolved: { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40", label: "Resolved" },
};

function CheckinDetailV2({ payload }: { payload: V2Payload }) {
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

      {cards.howYouFelt && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" /> How you felt</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-around py-1">
              <ScoreChip label="Mood" value={cards.howYouFelt.avgMood} />
              <ScoreChip label="Energy" value={cards.howYouFelt.avgEnergy} />
              <ScoreChip label="Stress" value={cards.howYouFelt.avgStress} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>{cards.howYouFelt.checkInCount} check-in{cards.howYouFelt.checkInCount !== 1 ? "s" : ""} this week</span>
              {cards.howYouFelt.roughDaysCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">{cards.howYouFelt.roughDaysCount} rough day{cards.howYouFelt.roughDaysCount !== 1 ? "s" : ""}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {cards.howYouMoved && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Dumbbell className="h-4 w-4 text-blue-500" /> How you moved</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-bold tabular-nums">{cards.howYouMoved.sessionsCompleted}</span>
              {cards.howYouMoved.sessionsPlanned > 0 && <span className="text-muted-foreground text-sm mb-1">/ {cards.howYouMoved.sessionsPlanned} planned</span>}
              <span className="text-muted-foreground text-sm mb-1 ml-0.5">sessions</span>
            </div>
            {cards.howYouMoved.adherencePct !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Adherence</span><span className="font-medium">{cards.howYouMoved.adherencePct}%</span></div>
                <Progress value={cards.howYouMoved.adherencePct} className="h-1.5" />
              </div>
            )}
            {cards.howYouMoved.adherencePct === null && cards.howYouMoved.sessionsCompleted > 0 && (
              <p className="text-xs text-muted-foreground">No scheduled plan this week</p>
            )}
          </CardContent>
        </Card>
      )}

      {cards.goals && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-violet-500" /> Progress on goals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cards.goals.items.map((g, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium line-clamp-1">{g.title}</span>
                  {g.progressPct !== null && <span className="text-muted-foreground tabular-nums">{g.progressPct}%</span>}
                </div>
                {g.progressPct !== null && <Progress value={g.progressPct} className="h-1.5" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cards.habits && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Repeat2 className="h-4 w-4 text-teal-500" /> Habits</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {cards.habits.items.map((h, i) => {
              const pct = Math.round((h.completionsThisWeek / h.targetDaysThisWeek) * 100);
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium line-clamp-1">{h.title}</span>
                    <span className="text-muted-foreground tabular-nums">{h.completionsThisWeek}/{h.targetDaysThisWeek}d</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {cards.lifestyle && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-500" /> Lifestyle factors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cards.lifestyle.avgSleepHours !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg sleep</span>
                <span className="font-semibold">
                  {cards.lifestyle.avgSleepHours}h
                  {cards.lifestyle.sleepSource && <span className="ml-1.5 text-xs text-muted-foreground font-normal">via {cards.lifestyle.sleepSource}</span>}
                </span>
              </div>
            )}
            {cards.lifestyle.roughDaysCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rough days</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{cards.lifestyle.roughDaysCount} day{cards.lifestyle.roughDaysCount !== 1 ? "s" : ""}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {cards.bodyStatus && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ScanLine className="h-4 w-4 text-orange-500" /> Body status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {cards.bodyStatus.areas.map((a, i) => {
                const cfg = statusConfig[a.status];
                return (
                  <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                    {a.bodyPart}<span className="opacity-60">· {cfg.label}</span>
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {cards.patterns && (
        <Card className="border-[#0cc9a9]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0cc9a9]" /> Patterns we noticed
              {!cards.patterns.isAI && (
                <span className="ml-auto text-xs text-muted-foreground font-normal flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Summary mode
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed">{cards.patterns.narrative}</p>
            {cards.patterns.bulletPoints.length > 0 && (
              <ul className="space-y-2">
                {cards.patterns.bulletPoints.map((bp, i) => (
                  <li key={i} className="text-sm pl-3 border-l-2 border-[#0cc9a9]/50 text-muted-foreground leading-relaxed">{bp}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {cards.nutrition && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Salad className="h-4 w-4 text-green-500" /> Nutrition</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days tracked</span>
              <span className="font-semibold">{cards.nutrition.daysTracked} / 7</span>
            </div>
            <Progress value={Math.round((cards.nutrition.daysTracked / 7) * 100)} className="h-1.5" />
            <p className="text-xs text-muted-foreground pt-0.5">{cards.nutrition.mealsLogged} meal{cards.nutrition.mealsLogged !== 1 ? "s" : ""} logged</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Card presence audit ───────────────────────────────────────────────────────

const CARD_KEYS: Array<keyof V2Cards> = [
  "howYouFelt", "howYouMoved", "goals", "habits",
  "lifestyle", "bodyStatus", "patterns", "nutrition",
];
const CARD_LABELS: Record<keyof V2Cards, string> = {
  howYouFelt: "How you felt",
  howYouMoved: "How you moved",
  goals: "Goals",
  habits: "Habits",
  lifestyle: "Lifestyle",
  bodyStatus: "Body status",
  patterns: "Patterns (AI)",
  nutrition: "Nutrition",
};

function CardAudit({ cards }: { cards: V2Cards }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CARD_KEYS.map((k) => {
        const present = !!cards[k];
        const isAI = k === "patterns" ? (cards.patterns?.isAI ?? false) : undefined;
        return (
          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${present ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground line-through"}`}>
            {present ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {CARD_LABELS[k]}
            {k === "patterns" && present && (
              <span className={`ml-0.5 ${isAI ? "text-emerald-600" : "text-amber-600"}`}>
                {isAI ? "·AI" : "·fallback"}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Scenario config ───────────────────────────────────────────────────────────

const SCENARIOS: Array<{
  id: DevScenario;
  label: string;
  description: string;
  color: string;
}> = [
  {
    id: "connected",
    label: "Connected user",
    description: "Wearable sleep, 5 check-ins, goals, habits, nutrition 5/7 days, lower back body entry",
    color: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "unconnected",
    label: "Unconnected user",
    description: "Manual sleep only, 3 check-ins, 2 unscheduled sessions, no goals/habits/body/nutrition",
    color: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
  },
  {
    id: "sparse",
    label: "Sparse user",
    description: "Zero check-ins, no sessions, no sleep, no goals/habits/body/nutrition — only patterns renders",
    color: "bg-muted border-border hover:bg-muted/70",
  },
  {
    id: "claude_failure",
    label: "Claude failure",
    description: "Same data as connected, but AI call is skipped — should show Summary mode badge on patterns card",
    color: "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeeklyCheckinDevTest() {
  const [results, setResults] = useState<Partial<Record<DevScenario, ScenarioResult>>>({});
  const [loading, setLoading] = useState<Partial<Record<DevScenario, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<DevScenario, string>>>({});
  const [openJson, setOpenJson] = useState<Partial<Record<DevScenario, boolean>>>({});

  const run = async (scenario: DevScenario) => {
    setLoading((prev) => ({ ...prev, [scenario]: true }));
    setErrors((prev) => ({ ...prev, [scenario]: undefined }));
    const t0 = Date.now();
    try {
      const res = await apiRequest("POST", "/api/dev/weekly-checkin-test", { scenario });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const payload: V2Payload = await res.json();
      setResults((prev) => ({ ...prev, [scenario]: { scenario, payload, durationMs: Date.now() - t0 } }));
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [scenario]: e?.message || "Unknown error" }));
    } finally {
      setLoading((prev) => ({ ...prev, [scenario]: false }));
    }
  };

  const runAll = () => {
    for (const s of SCENARIOS) run(s.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 pt-8 pb-32">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold">Weekly check-in · dev verification</h1>
            <Badge variant="outline" className="text-amber-600 border-amber-600/40 bg-amber-500/10 text-xs">DEV ONLY</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Each scenario generates a synthetic V2 payload from in-memory fixtures — no DB reads, no writes, no real user data touched.
            The AI call is real for scenarios 1–3 (tests the live path). Scenario 4 forces the fallback.
          </p>
          <Button size="sm" className="mt-3" onClick={runAll}>Run all 4 scenarios</Button>
        </div>

        <div className="space-y-8">
          {SCENARIOS.map((sc) => {
            const result = results[sc.id];
            const isLoading = loading[sc.id];
            const error = errors[sc.id];
            const jsonOpen = openJson[sc.id];

            return (
              <div key={sc.id} className="space-y-3">
                <div className={`rounded-xl border p-4 transition-colors ${sc.color}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">{sc.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{sc.description}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading}
                      onClick={() => run(sc.id)}
                      className="shrink-0"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          Running…
                        </span>
                      ) : result ? "Re-run" : "Run"}
                    </Button>
                  </div>

                  {error && (
                    <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded px-3 py-2">
                      Error: {error}
                    </div>
                  )}

                  {isLoading && (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  )}

                  {result && !isLoading && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          Generated in {result.durationMs}ms ·
                          trajectoryLabel: <strong>{result.payload.trajectoryLabel}</strong>
                        </span>
                        <TrajectoryPill label={result.payload.trajectoryLabel} />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Cards rendered</div>
                        <CardAudit cards={result.payload.cards} />
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setOpenJson((prev) => ({ ...prev, [sc.id]: !jsonOpen }))}
                      >
                        {jsonOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {jsonOpen ? "Hide" : "Show"} raw JSON
                      </button>
                      {jsonOpen && (
                        <pre className="text-xs bg-muted/60 rounded p-3 overflow-auto max-h-80 border border-border">
                          {JSON.stringify(result.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {result && !isLoading && (
                  <div className="border rounded-xl p-4 bg-card">
                    <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                      Rendered UI — {sc.label}
                    </div>
                    <CheckinDetailV2 payload={result.payload} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
