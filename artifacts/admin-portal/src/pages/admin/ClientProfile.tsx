import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, differenceInDays,
  parseISO, isToday,
} from "date-fns";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ComplianceStrip } from "./client-profile/ComplianceStrip";
import { MetricsSection } from "./client-profile/MetricsSection";
import { ActivityFeed } from "./client-profile/ActivityFeed";
import { TrainingPanel } from "./client-profile/TrainingPanel";
import { BodyPanel } from "./client-profile/BodyPanel";
import type { DataPoint, WorkoutLog, CheckInRecord, NutritionDay, Photo } from "./client-profile/types";

// ─── Circular adherence ring ──────────────────────────────────────────────────

function AdherenceRing({ pct }: { pct: number }) {
  const R = 16, circ = 2 * Math.PI * R;
  const dash = circ * Math.min(Math.max(pct, 0), 1);
  const colour = pct >= 0.8 ? '#34d399' : pct >= 0.5 ? '#fbbf24' : '#f87171';
  return (
    <div className="relative flex items-center justify-center h-11 w-11 shrink-0">
      <svg className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }} width="44" height="44">
        <circle cx="22" cy="22" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
        <circle cx="22" cy="22" r={R} fill="none" stroke={colour} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-[10px] font-semibold relative z-10">{Math.round(pct * 100)}%</span>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  name: string;
  email: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: any;
  workouts: WorkoutLog[];
  checkIns: CheckInRecord[];
  bodyweight: DataPoint[];
  sleep: DataPoint[];
  readiness: DataPoint[];
  steps: DataPoint[];
  isLoading: boolean;
  dataLoading: boolean;
  onBack: () => void;
}

// differenceInDays that can't leak NaN into the UI: returns null for any
// unparseable date instead of NaN ("Active NaN days ago").
function safeDaysSince(today: Date, dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const n = differenceInDays(today, parsed);
  return Number.isNaN(n) ? null : n;
}

function ClientHeader({ name, email, timeline, workouts, checkIns, bodyweight, sleep, readiness, steps, isLoading, dataLoading, onBack }: HeaderProps) {
  const initials = name
    ? name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  // Programme info from timeline
  const current = timeline?.current;
  const progName  = current?.programme?.name ?? current?.programmeTitle ?? null;
  const progWeek  = current?.currentWeek ?? null;
  const progTotal = current?.programme?.totalWeeks ?? null;
  const progLabel = progName
    ? `${progName}${progWeek && progTotal ? ` · Week ${progWeek} of ${progTotal}` : ''}`
    : 'No active programme';

  // Adherence ring: active days / days elapsed this week (Mon–today)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const daysSoFar = eachDayOfInterval({ start: weekStart, end: today });

  const workoutDatesThisWeek = new Set(
    workouts.map(w => w.date).filter((d): d is string => !!d && d >= format(weekStart, 'yyyy-MM-dd')),
  );
  const checkInDatesThisWeek = new Set(
    checkIns.filter(c => c.date >= format(weekStart, 'yyyy-MM-dd')).map(c => c.date),
  );
  const activeDays = daysSoFar.filter(d => {
    const ds = format(d, 'yyyy-MM-dd');
    return workoutDatesThisWeek.has(ds) || checkInDatesThisWeek.has(ds);
  }).length;
  const adherencePct = daysSoFar.length > 0 ? activeDays / daysSoFar.length : 0;

  // Last active: most recent date across all data
  const allDates: string[] = [
    ...workouts.map(w => w.date).filter(Boolean) as string[],
    ...checkIns.map(c => c.date),
    ...bodyweight.map(b => b.date),
    ...sleep.map(s => s.date),
    ...readiness.map(r => r.date),
  ];
  const latestDate = allDates.length ? allDates.sort().at(-1)! : null;
  const daysSinceActive = safeDaysSince(today, latestDate);
  const lastActiveLabel = latestDate && daysSinceActive !== null
    ? (isToday(parseISO(latestDate))
        ? 'Active today'
        : `Active ${daysSinceActive} days ago`)
    : null;

  // "On track" is a real claim about real activity — it must never show for a
  // client with no data at all, and never flash while the queries are loading.
  const hasAnyData =
    workouts.length > 0 || checkIns.length > 0 || bodyweight.length > 0 ||
    sleep.length > 0 || readiness.length > 0 || steps.length > 0;

  // Attention flags
  const flags: { label: string; level: 'amber' | 'red' }[] = [];

  // Check-in flag: most recent check-in > 5 days ago — or never checked in at
  // all despite having other data (a client the old logic showed as On track).
  if (checkIns.length > 0) {
    const daysSince = safeDaysSince(today, checkIns[0].date);
    if (daysSince !== null && daysSince > 5) {
      flags.push({ label: `No check-in for ${daysSince} days`, level: daysSince > 10 ? 'red' : 'amber' });
    }
  } else if (!dataLoading && hasAnyData) {
    flags.push({ label: 'Never checked in', level: 'amber' });
  }

  // Wearable flag: most recent sleep/readiness > 4 days ago (and older data exists)
  const sortedSleep = [...sleep].sort((a, b) => b.date.localeCompare(a.date));
  const sortedReadiness = [...readiness].sort((a, b) => b.date.localeCompare(a.date));
  const latestWearable = sortedSleep[0]?.date ?? sortedReadiness[0]?.date ?? null;
  if (latestWearable && (sleep.length > 1 || readiness.length > 1)) {
    const daysSince = safeDaysSince(today, latestWearable);
    if (daysSince !== null && daysSince > 4) {
      flags.push({ label: `No wearable data for ${daysSince} days`, level: 'amber' });
    }
  }

  const displayFlags = flags.slice(0, 3);

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">

        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
          {isLoading ? <Skeleton className="h-9 w-9 rounded-full" /> : initials}
        </div>

        {/* Name + programme */}
        <div className="min-w-0">
          {isLoading ? (
            <><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-48" /></>
          ) : (
            <>
              <div className="font-semibold text-sm leading-tight truncate">{name || '—'}</div>
              <div className="text-xs text-muted-foreground truncate">{progLabel}</div>
            </>
          )}
        </div>

        {/* Adherence ring */}
        <div className="flex items-center gap-2 ml-1">
          <AdherenceRing pct={adherencePct} />
          <div className="text-[10px] text-muted-foreground leading-tight">
            <div>This week</div>
            <div>adherence</div>
          </div>
        </div>

        {/* Attention flags */}
        <div className="flex gap-1.5 flex-wrap">
          {displayFlags.length === 0 ? (
            dataLoading ? null : hasAnyData ? (
              <Badge variant="outline"
                className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-[10px] py-0 gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" /> On track
              </Badge>
            ) : (
              <Badge variant="outline"
                className="text-muted-foreground border-border bg-muted/30 text-[10px] py-0 gap-1">
                No data yet
              </Badge>
            )
          ) : displayFlags.map((f, i) => (
            <Badge key={i} variant="outline"
              className={`text-[10px] py-0 gap-1 ${f.level === 'red'
                ? 'text-red-400 border-red-400/30 bg-red-400/10'
                : 'text-amber-400 border-amber-400/30 bg-amber-400/10'}`}>
              <AlertTriangle className="h-2.5 w-2.5" /> {f.label}
            </Badge>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {lastActiveLabel && (
            <span className="text-xs text-muted-foreground hidden sm:block">{lastActiveLabel}</span>
          )}
          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]">
            Access granted
          </Badge>
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 text-xs gap-1">
            <ArrowLeft className="h-3 w-3" />
            Clients
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();

  // Access status
  const { data: clientsData } = useQuery<{ clients: { clientUserId: string; name: string; email: string; status: string }[] }>({
    queryKey: ['/api/admin/coach-access/clients'],
  });

  const clientInfo = useMemo(
    () => clientsData?.clients.find(c => c.clientUserId === userId) ?? null,
    [clientsData, userId],
  );

  const isGranted = clientInfo?.status === 'granted';

  // All data fetched in parallel — enabled only when access is granted
  const { data: bodyweight = [], isLoading: bwLoading } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/bodyweight?days=90`],
    enabled: isGranted,
  });

  const { data: steps = [], isLoading: stepsLoading } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/steps?days=30`],
    enabled: isGranted,
  });

  const { data: sleep = [], isLoading: sleepLoading } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/sleep?days=30`],
    enabled: isGranted,
  });

  const { data: readiness = [], isLoading: readinessLoading } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/readiness?days=30`],
    enabled: isGranted,
  });

  const { data: calories = [], isLoading: calLoading } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/caloric-intake?days=30`],
    enabled: isGranted,
  });

  const { data: workouts = [], isLoading: woLoading } = useQuery<WorkoutLog[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/workouts?limit=100`],
    enabled: isGranted,
  });

  const { data: checkIns = [] } = useQuery<CheckInRecord[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/check-ins?days=60`],
    enabled: isGranted,
  });

  const { data: nutrition = [] } = useQuery<NutritionDay[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/nutrition?days=30`],
    enabled: isGranted,
  });

  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/photos`],
    enabled: isGranted,
  });

  const { data: timeline } = useQuery({
    queryKey: [`/api/admin/users/${userId}/timeline`],
    enabled: isGranted,
  });

  const isAnyLoading = bwLoading || stepsLoading || sleepLoading || readinessLoading || calLoading || woLoading;

  // ── Access denied ──────────────────────────────────────────────────────────
  if (clientsData && !isGranted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clients')} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium">Access not granted</p>
            <p className="text-sm text-muted-foreground">
              This client has not yet consented to share their data.
              Send an access request from the Clients page.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/clients')}>
              Go to Clients
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading shell ──────────────────────────────────────────────────────────
  if (!clientsData) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  // ── Full page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <ClientHeader
        name={clientInfo?.name ?? ''}
        email={clientInfo?.email ?? ''}
        timeline={timeline}
        workouts={workouts}
        checkIns={checkIns}
        bodyweight={bodyweight}
        sleep={sleep}
        readiness={readiness}
        steps={steps}
        isLoading={!clientsData}
        dataLoading={isAnyLoading}
        onBack={() => navigate('/admin/clients')}
      />

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* 2. Compliance strip */}
        <ComplianceStrip
          workouts={workouts}
          checkIns={checkIns}
          nutrition={nutrition}
          steps={steps}
        />

        {/* 3 + 4. Metrics grid + drilldown */}
        <MetricsSection
          userId={userId!}
          bodyweight={bodyweight}
          steps={steps}
          sleep={sleep}
          readiness={readiness}
          calories={calories}
          workouts={workouts}
          isLoading={isAnyLoading}
        />

        {/* 5. Activity feed + Training */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <ActivityFeed
            bodyweight={bodyweight}
            workouts={workouts}
            checkIns={checkIns}
            photos={photos}
          />
          <TrainingPanel timeline={timeline} />
        </div>

        {/* 6. Body panel */}
        <BodyPanel userId={userId!} />
      </div>
    </div>
  );
}
