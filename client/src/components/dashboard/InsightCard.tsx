import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, HeartPulse, Moon, Zap, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyCheckin {
  id: number;
  weekStart: string;
  payload: any;
}

interface HRVEntry {
  id: number;
  date: string;
  hrvMs: number;
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

interface DailyCheckIn {
  id: number;
  checkInDate: string;
  energyScore: number | null;
}

// ----- ISO-week helpers (Mon-Sun) -----
function getIsoWeekStart(d: Date): Date {
  const day = d.getDay(); // 0 = Sun, 1 = Mon
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function getLastCompletedWeek(today: Date): { start: Date; end: Date } {
  const thisWeekStart = getIsoWeekStart(today);
  const start = new Date(thisWeekStart);
  start.setDate(thisWeekStart.getDate() - 7);
  // End is the last instant before this week starts (Sun 23:59:59.999)
  const end = new Date(thisWeekStart.getTime() - 1);
  return { start, end };
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function inWindow(dateStr: string, range: { start: Date; end: Date }): boolean {
  const t = new Date(dateStr).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ----- Metric computations -----
function hrvSummary(entries: HRVEntry[] | undefined, range: { start: Date; end: Date }) {
  if (!entries) return null;
  const inRange = entries.filter((e) => inWindow(e.date, range)).map((e) => e.hrvMs);
  const baseline = entries
    .filter((e) => {
      const t = new Date(e.date).getTime();
      const baseStart = range.start.getTime() - 28 * 86400_000;
      return t >= baseStart && t < range.start.getTime();
    })
    .map((e) => e.hrvMs);
  const current = avg(inRange);
  const base = avg(baseline);
  if (current == null) return null;
  return {
    current: Math.round(current),
    delta: base != null ? Math.round(current - base) : null,
  };
}

function rhrSummary(entries: RHREntry[] | undefined, range: { start: Date; end: Date }) {
  if (!entries) return null;
  const inRange = entries.filter((e) => inWindow(e.date, range)).map((e) => e.bpm);
  const baseline = entries
    .filter((e) => {
      const t = new Date(e.date).getTime();
      const baseStart = range.start.getTime() - 28 * 86400_000;
      return t >= baseStart && t < range.start.getTime();
    })
    .map((e) => e.bpm);
  const current = avg(inRange);
  const base = avg(baseline);
  if (current == null) return null;
  return {
    current: Math.round(current),
    delta: base != null ? Math.round(current - base) : null,
  };
}

function sleepSummary(entries: SleepEntry[] | undefined, range: { start: Date; end: Date }) {
  if (!entries) return null;
  const inRange = entries
    .filter((e) => inWindow(e.date, range))
    .map((e) => e.durationMinutes)
    .filter((m) => m > 0);
  const v = avg(inRange);
  return v == null ? null : Math.round(v);
}

function energySummary(entries: DailyCheckIn[] | undefined, range: { start: Date; end: Date }) {
  if (!entries) return null;
  const inRange = entries
    .filter((e) => inWindow(e.checkInDate, range))
    .map((e) => e.energyScore)
    .filter((n): n is number => typeof n === "number");
  const v = avg(inRange);
  return v == null ? null : Math.round(v * 10) / 10;
}

// ----- Color helpers (recovery framing: higher = better, except RHR) -----
function colorHrv(delta: number | null): string {
  if (delta == null) return "#94a3b8";
  if (delta >= 3) return "#22c55e";
  if (delta <= -3) return "#ef4444";
  return "hsl(var(--foreground))";
}
function colorRhr(delta: number | null): string {
  if (delta == null) return "#94a3b8";
  if (delta <= -2) return "#22c55e"; // lower RHR is better
  if (delta >= 2) return "#ef4444";
  return "hsl(var(--foreground))";
}
function colorSleep(mins: number | null): string {
  if (mins == null) return "#94a3b8";
  if (mins >= 7 * 60 + 15) return "#22c55e";
  if (mins < 6 * 60 + 30) return "#ef4444";
  return "hsl(var(--foreground))";
}
function colorEnergy(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 4) return "#22c55e";
  if (score < 3) return "#ef4444";
  return "hsl(var(--foreground))";
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtSleep(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ----- Hero generation: derives sentence from the same 4 numbers shown below -----
function buildHero(args: {
  hrv: ReturnType<typeof hrvSummary>;
  rhr: ReturnType<typeof rhrSummary>;
  sleep: number | null;
  energy: number | null;
}): string {
  const { hrv, rhr, sleep, energy } = args;
  if (!hrv && !rhr && sleep == null && energy == null) {
    return "Not enough data from last week to summarise yet.";
  }
  // Lead with the most directional signal
  const signals: string[] = [];
  if (rhr) {
    if (rhr.delta != null && rhr.delta <= -2) {
      signals.push(`resting HR dropped ${Math.abs(rhr.delta)} bpm to ${rhr.current}`);
    } else if (rhr.delta != null && rhr.delta >= 2) {
      signals.push(`resting HR climbed ${rhr.delta} bpm to ${rhr.current}`);
    } else {
      signals.push(`resting HR held steady at ${rhr.current} bpm`);
    }
  }
  if (hrv) {
    if (hrv.delta != null && hrv.delta >= 3) {
      signals.push(`HRV improved ${signed(hrv.delta)} ms to ${hrv.current}`);
    } else if (hrv.delta != null && hrv.delta <= -3) {
      signals.push(`HRV dipped ${hrv.delta} ms to ${hrv.current}`);
    } else {
      signals.push(`HRV averaged ${hrv.current} ms`);
    }
  }
  if (sleep != null) {
    signals.push(`sleep averaged ${fmtSleep(sleep)}`);
  }
  if (energy != null) {
    const label = energy >= 4 ? "high" : energy < 3 ? "low" : "steady";
    signals.push(`energy felt ${label}`);
  }

  // Headline mood from RHR direction (the clearest recovery indicator)
  let lead = "Steady recovery week.";
  if (rhr?.delta != null && rhr.delta <= -2) lead = "Strong recovery week.";
  else if (rhr?.delta != null && rhr.delta >= 2) lead = "Body was working harder than usual.";

  return `${lead} ${capitalise(signals.join(", "))}.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----- Component -----
export default function InsightCard() {
  const [, navigate] = useLocation();

  const { data: checkins } = useQuery<WeeklyCheckin[]>({
    queryKey: ["/api/weekly-checkins"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  // Auto-create the last completed week's check-in on demand so the
  // "View Full Week" button always has a valid row to navigate to.
  const { data: lastCompleted } = useQuery<WeeklyCheckin>({
    queryKey: ["/api/weekly-checkins/last-completed"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: hrvEntries } = useQuery<HRVEntry[]>({
    queryKey: ["/api/progress/hrv"],
  });
  const { data: rhrEntries } = useQuery<RHREntry[]>({
    queryKey: ["/api/progress/resting-hr"],
  });
  const { data: sleepEntries } = useQuery<SleepEntry[]>({
    queryKey: ["/api/progress/sleep"],
  });
  const { data: dailyCheckins } = useQuery<DailyCheckIn[]>({
    queryKey: ["/api/check-ins/recent/30"],
  });

  const range = getLastCompletedWeek(new Date());

  const hrv = hrvSummary(hrvEntries, range);
  const rhr = rhrSummary(rhrEntries, range);
  const sleep = sleepSummary(sleepEntries, range);
  const energy = energySummary(dailyCheckins, range);

  const hero = buildHero({ hrv, rhr, sleep, energy });

  // Find the weekly check-in for last completed week. Only consider rows whose
  // weekStart is strictly before this week's Monday (i.e. fully completed),
  // then pick the most recent. This avoids landing on an in-progress current
  // week if one was accidentally created.
  const thisMonday = new Date(range.end.getTime() + 1); // = this week's Monday 00:00
  const completed = (checkins ?? [])
    .filter((c) => new Date(c.weekStart).getTime() < thisMonday.getTime())
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  // Fall back to the auto-created last-completed row when the list is empty
  // (e.g. after the startup migration deleted past-week snapshots).
  const targetCheckin = completed[0] ?? lastCompleted ?? null;
  const trendsUrl = targetCheckin ? `/weekly-checkin/${targetCheckin.id}` : null;

  const openCoach = () => {
    window.dispatchEvent(new Event("open-coach"));
  };

  return (
    <Card className="bg-card border-border" data-testid="card-insight">
      <CardContent className="py-5 space-y-4">
        {/* Header — explicit about the window so there's no ambiguity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Week at a Glance
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {shortDate(range.start)} – {shortDate(range.end)}
          </p>
        </div>

        {/* Dynamic hero sentence derived from the same numbers below */}
        <p className="text-sm text-foreground leading-relaxed" data-testid="text-insight-hero">
          {hero}
        </p>

        {/* 4 micro-metrics (Body Report framing) */}
        <div className="grid grid-cols-4 gap-2">
          {/* HRV */}
          <MetricTile
            icon={<Activity className="h-4 w-4 text-[#0cc9a9]" />}
            value={hrv ? `${hrv.current}` : "—"}
            unit={hrv ? "ms" : undefined}
            label="HRV"
            sub={hrv?.delta != null ? `${signed(hrv.delta)} vs 4w` : "7-day avg"}
            color={hrv ? colorHrv(hrv.delta) : undefined}
            testId="metric-hrv"
          />
          {/* RHR */}
          <MetricTile
            icon={<HeartPulse className="h-4 w-4 text-[#f472b6]" />}
            value={rhr ? `${rhr.current}` : "—"}
            unit={rhr ? "bpm" : undefined}
            label="Resting HR"
            sub={rhr?.delta != null ? `${signed(rhr.delta)} vs 4w` : "7-day avg"}
            color={rhr ? colorRhr(rhr.delta) : undefined}
            testId="metric-rhr"
          />
          {/* Sleep */}
          <MetricTile
            icon={<Moon className="h-4 w-4 text-[#818cf8]" />}
            value={sleep != null ? `${Math.floor(sleep / 60)}h ${sleep % 60}m` : "—"}
            label="Sleep"
            sub="7-day avg"
            color={colorSleep(sleep)}
            testId="metric-sleep"
          />
          {/* Energy */}
          <MetricTile
            icon={<Zap className="h-4 w-4 text-[#facc15]" />}
            value={energy != null ? energy.toFixed(1) : "—"}
            unit={energy != null ? "/5" : undefined}
            label="Energy"
            sub="7-day avg"
            color={colorEnergy(energy)}
            testId="metric-energy"
          />
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 border-border"
            onClick={openCoach}
            data-testid="button-ask-coach"
          >
            Ask Coach
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!trendsUrl}
            className="flex items-center gap-1 text-xs h-8 text-muted-foreground hover:text-foreground"
            onClick={() => trendsUrl && navigate(trendsUrl)}
            data-testid="button-view-week"
          >
            View Full Week
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile(props: {
  icon: React.ReactNode;
  value: string;
  unit?: string;
  label: string;
  sub: string;
  color?: string;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md bg-muted/40 p-2.5 gap-1"
      data-testid={props.testId}
    >
      {props.icon}
      <p
        className="text-base font-bold tabular-nums leading-none whitespace-nowrap"
        style={{ color: props.color ?? "hsl(var(--foreground))" }}
      >
        {props.value}
        {props.unit && (
          <span className="text-[10px] font-normal text-muted-foreground"> {props.unit}</span>
        )}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center leading-tight">
        {props.label}
      </p>
      <p className="text-[9px] text-muted-foreground text-center leading-tight">{props.sub}</p>
    </div>
  );
}
