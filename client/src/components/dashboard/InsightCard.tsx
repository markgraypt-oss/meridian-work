import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus, Dumbbell, Heart, Moon, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyCheckin {
  id: number;
  weekStart: string;
  payload: any;
}

interface RHREntry {
  id: number;
  date: string;
  bpm: number;
  source: "wearable" | "manual";
}

interface SleepEntry {
  id: number;
  date: string;
  durationMinutes: number;
  sleepScore: number | null;
}

function rhrDelta(entries: RHREntry[]): { current: number; delta: number | null } | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const current = sorted[0].bpm;
  const now = new Date(sorted[0].date).getTime();
  const msPerDay = 86400_000;
  const older = sorted.filter((e) => {
    const age = (now - new Date(e.date).getTime()) / msPerDay;
    return age >= 14 && age <= 45;
  });
  if (older.length === 0) return { current, delta: null };
  const baseline = older.reduce((s, e) => s + e.bpm, 0) / older.length;
  return { current, delta: Math.round(current - baseline) };
}

function sleepAvg(entries: SleepEntry[]): number | null {
  const recent = entries.slice(0, 7).filter((e) => e.durationMinutes > 0);
  if (recent.length === 0) return null;
  return Math.round(recent.reduce((s, e) => s + e.durationMinutes, 0) / recent.length);
}

export default function InsightCard() {
  const [, navigate] = useLocation();

  const { data: checkins } = useQuery<WeeklyCheckin[]>({
    queryKey: ["/api/weekly-checkins"],
  });

  const { data: rhrEntries } = useQuery<RHREntry[]>({
    queryKey: ["/api/progress/resting-hr"],
  });

  const { data: sleepEntries } = useQuery<SleepEntry[]>({
    queryKey: ["/api/progress/sleep"],
  });

  // Pull the most recent completed weekly check-in with a V2 payload
  const latest = checkins
    ?.filter((c) => {
      const p = c.payload;
      return p && typeof p === "object" && typeof p.hero === "string";
    })
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0];

  const hero: string | null = latest?.payload?.hero ?? null;
  const sessionsCompleted: number | null =
    latest?.payload?.cards?.howYouMoved?.sessionsCompleted ?? null;

  const rhr = rhrEntries ? rhrDelta(rhrEntries) : null;
  const sleepMins = sleepEntries ? sleepAvg(sleepEntries) : null;

  const openCoach = () => {
    window.dispatchEvent(new Event("open-coach"));
  };

  return (
    <Card className="bg-card border-border" data-testid="card-insight">
      <CardContent className="py-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your Week at a Glance
          </p>
        </div>

        {/* AI Hero sentence */}
        {hero ? (
          <p className="text-sm text-foreground leading-relaxed">{hero}</p>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Complete a weekly check-in to see your personalised summary here.
          </p>
        )}

        {/* 3 micro-metrics */}
        <div className="grid grid-cols-3 gap-2">
          {/* Sessions */}
          <div className="flex flex-col items-center justify-center rounded-md bg-muted/40 p-2.5 gap-1">
            <Dumbbell className="h-4 w-4 text-[#0cc9a9]" />
            <p className="text-lg font-bold tabular-nums text-foreground leading-none">
              {sessionsCompleted != null ? sessionsCompleted : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
              Sessions this week
            </p>
          </div>

          {/* RHR trend */}
          <div className="flex flex-col items-center justify-center rounded-md bg-muted/40 p-2.5 gap-1">
            <Heart className="h-4 w-4 text-[#f472b6]" />
            {rhr ? (
              <>
                <div className="flex items-center gap-0.5">
                  {rhr.delta != null && rhr.delta < -1 ? (
                    <TrendingDown className="h-3 w-3 text-[#22c55e]" />
                  ) : rhr.delta != null && rhr.delta > 1 ? (
                    <TrendingUp className="h-3 w-3 text-[#ef4444]" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <p
                    className="text-lg font-bold tabular-nums leading-none"
                    style={{
                      color:
                        rhr.delta != null && rhr.delta < -1
                          ? "#22c55e"
                          : rhr.delta != null && rhr.delta > 1
                          ? "#ef4444"
                          : "hsl(var(--foreground))",
                    }}
                  >
                    {rhr.current}
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                  {rhr.delta != null
                    ? `${rhr.delta > 0 ? "+" : ""}${rhr.delta} bpm vs baseline`
                    : "Resting HR"}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-muted-foreground">—</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                  Resting HR
                </p>
              </>
            )}
          </div>

          {/* Sleep avg */}
          <div className="flex flex-col items-center justify-center rounded-md bg-muted/40 p-2.5 gap-1">
            <Moon className="h-4 w-4 text-[#818cf8]" />
            {sleepMins != null ? (
              <>
                <p className="text-lg font-bold tabular-nums text-foreground leading-none">
                  {Math.floor(sleepMins / 60)}
                  <span className="text-xs font-normal text-muted-foreground">h </span>
                  {sleepMins % 60}
                  <span className="text-xs font-normal text-muted-foreground">m</span>
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                  Avg sleep (7d)
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-muted-foreground">—</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
                  Avg sleep (7d)
                </p>
              </>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 border-border"
            onClick={openCoach}
          >
            Ask Coach
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-xs h-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/perform")}
          >
            View Trends
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
