import { useMemo } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Scale, Dumbbell, ClipboardCheck, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataPoint, WorkoutLog, CheckInRecord, Photo } from "./types";

type FeedEvent =
  | { kind: 'weigh-in';  date: string; value: number; delta: number | null }
  | { kind: 'workout';   date: string; name: string; rating: number | null }
  | { kind: 'check-in';  date: string; mood: number | null; energy: number | null }
  | { kind: 'photos';    date: string; count: number };

function relDate(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr.slice(0, 10);
  }
}

export function ActivityFeed({
  bodyweight, workouts, checkIns, photos,
}: {
  bodyweight: DataPoint[];
  workouts: WorkoutLog[];
  checkIns: CheckInRecord[];
  photos: Photo[];
}) {
  const events = useMemo<FeedEvent[]>(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const list: FeedEvent[] = [];

    // Weigh-ins (include delta from previous entry)
    const sortedBW = [...bodyweight].sort((a, b) => a.date.localeCompare(b.date));
    sortedBW.forEach((pt, i) => {
      if (new Date(pt.date) < cutoff) return;
      const prev = i > 0 ? sortedBW[i - 1].value : null;
      list.push({
        kind:  'weigh-in',
        date:  pt.date,
        value: pt.value,
        delta: prev !== null ? parseFloat((pt.value - prev).toFixed(1)) : null,
      });
    });

    // Workouts
    workouts.forEach(w => {
      if (!w.date || new Date(w.date) < cutoff) return;
      list.push({ kind: 'workout', date: w.date, name: w.name ?? 'Workout', rating: w.rating });
    });

    // Check-ins
    checkIns.forEach(c => {
      if (new Date(c.date) < cutoff) return;
      list.push({ kind: 'check-in', date: c.date, mood: c.moodScore, energy: c.energyScore });
    });

    // Photos — group by photoSetId, one event per set
    const photoSets = new Map<string, Photo[]>();
    photos.forEach(p => {
      if (new Date(p.date) < cutoff) return;
      const arr = photoSets.get(p.photoSetId) ?? [];
      arr.push(p);
      photoSets.set(p.photoSetId, arr);
    });
    photoSets.forEach(set => {
      list.push({ kind: 'photos', date: set[0].date, count: set.length });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [bodyweight, workouts, checkIns, photos]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Activity (last 30 days)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
        ) : (
          // Fixed-height scroll region: the card stays compact no matter how
          // active the client is, instead of growing with every event.
          <ol className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {events.slice(0, 60).map((ev, i) => (
              <li key={i} className="flex items-start gap-3">
                <EventIcon ev={ev} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug"><EventText ev={ev} /></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{relDate(ev.date)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function EventIcon({ ev }: { ev: FeedEvent }) {
  const base = "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5";
  if (ev.kind === 'weigh-in')  return <div className={`${base} bg-blue-500/15`}><Scale className="h-3.5 w-3.5 text-blue-400" /></div>;
  if (ev.kind === 'workout')   return <div className={`${base} bg-orange-500/15`}><Dumbbell className="h-3.5 w-3.5 text-orange-400" /></div>;
  if (ev.kind === 'check-in')  return <div className={`${base} bg-violet-500/15`}><ClipboardCheck className="h-3.5 w-3.5 text-violet-400" /></div>;
  return <div className={`${base} bg-emerald-500/15`}><Camera className="h-3.5 w-3.5 text-emerald-400" /></div>;
}

function EventText({ ev }: { ev: FeedEvent }) {
  if (ev.kind === 'weigh-in') {
    const delta = ev.delta !== null
      ? <span className={`text-xs ml-1 ${ev.delta > 0 ? 'text-red-400' : ev.delta < 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          ({ev.delta > 0 ? '+' : ''}{ev.delta} kg)
        </span>
      : null;
    return <><span className="font-medium">Weighed in</span> at {ev.value} kg{delta}</>;
  }
  if (ev.kind === 'workout') {
    const rpe = ev.rating ? <span className="text-muted-foreground ml-1">· RPE {ev.rating}/10</span> : null;
    return <><span className="font-medium">Completed</span> {ev.name}{rpe}</>;
  }
  if (ev.kind === 'check-in') {
    const scores = (ev.mood || ev.energy)
      ? <span className="text-muted-foreground ml-1">· mood {ev.mood ?? '—'}, energy {ev.energy ?? '—'}</span>
      : null;
    return <><span className="font-medium">Check-in</span> submitted{scores}</>;
  }
  return <><span className="font-medium">Progress photos</span> uploaded ({ev.count} photo{ev.count > 1 ? 's' : ''})</>;
}
