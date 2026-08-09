import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";
import type { WorkoutLog } from "./types";

interface CurrentEnrollment {
  id: number;
  programme?: { name?: string; totalWeeks?: number };
  programmeTitle?: string;
  currentWeek?: number;
  startDate?: string | null;
  endDate?: string | null;
  completedWorkouts?: number;
  totalWorkouts?: number;
}

interface Props {
  workouts: WorkoutLog[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: any;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'd MMM yyyy'); } catch { return d.slice(0, 10); }
}

export function TrainingPanel({ workouts, timeline }: Props) {
  const current = timeline?.current as CurrentEnrollment | null | undefined;
  const name = current?.programme?.name ?? current?.programmeTitle ?? null;
  const week = current?.currentWeek ?? null;
  const total = current?.programme?.totalWeeks ?? null;
  const completedWos = current?.completedWorkouts ?? null;
  const totalWos = current?.totalWorkouts ?? null;
  const progress = completedWos !== null && totalWos ? completedWos / totalWos : null;

  const recent = workouts
    .filter(w => w.date)
    .slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-orange-400" />
          Training
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {/* Current programme */}
        {name ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="font-medium text-sm">{name}</div>
            {week !== null && total !== null && (
              <div className="text-xs text-muted-foreground">Week {week} of {total}</div>
            )}
            {progress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{completedWos} of {totalWos} workouts completed</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-orange-400 transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="flex gap-4 text-xs text-muted-foreground">
              {current?.startDate && <span>Started {fmtDate(current.startDate)}</span>}
              {current?.endDate && <span>Ends {fmtDate(current.endDate)}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active programme.</p>
        )}

        {/* Recent workouts */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recent workouts</p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workouts logged yet.</p>
          ) : (
            <ol className="space-y-2">
              {recent.map(w => (
                <li key={w.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="truncate block">{w.name ?? 'Workout'}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(w.date)}</span>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground text-right">
                    {w.rating ? <span className="font-medium text-foreground">RPE {w.rating}</span> : null}
                    {w.durationMinutes ? <span className="block">{w.durationMinutes} min</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
