import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Dumbbell } from "lucide-react";

// This panel is the PROGRAMME view: enrolment, progress, what's next.
// Individual workout history deliberately lives elsewhere (Activity feed +
// the Workouts metric drilldown) so the two never duplicate each other.

interface CurrentEnrollment {
  id: number;
  programme?: { name?: string; totalWeeks?: number };
  programmeTitle?: string;
  currentWeek?: number;
  startDate?: string | null;
  endDate?: string | null;
  completedWorkouts?: number;
  totalWorkouts?: number;
  nextWorkout?: { week: number; day: number; name: string; minutes: number } | null;
  weekProgress?: { total: number; done: number }[];
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: any;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'd MMM yyyy'); } catch { return d.slice(0, 10); }
}

export function TrainingPanel({ timeline }: Props) {
  const current = timeline?.current as CurrentEnrollment | null | undefined;
  const name = current?.programme?.name ?? current?.programmeTitle ?? null;
  const week = current?.currentWeek ?? null;
  const total = current?.programme?.totalWeeks ?? null;
  const completedWos = current?.completedWorkouts ?? null;
  const totalWos = current?.totalWorkouts ?? null;
  const progress = completedWos !== null && totalWos ? completedWos / totalWos : null;
  const next = current?.nextWorkout ?? null;
  const thisWeek = week !== null ? current?.weekProgress?.[week - 1] ?? null : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-orange-400" />
          Training
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {name ? (
          <>
            {/* Current programme */}
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

            {/* This week's sessions */}
            {thisWeek && thisWeek.total > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">This week</p>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: thisWeek.total }, (_, i) => (
                    <div key={i}
                      className={`h-2 flex-1 rounded-full ${i < thisWeek.done ? 'bg-orange-400' : 'bg-muted'}`} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                    {thisWeek.done}/{thisWeek.total} done
                  </span>
                </div>
              </div>
            )}

            {/* Up next */}
            {next && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Up next</p>
                <div className="rounded-lg border border-border/60 p-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{next.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Week {next.week} · Day {next.day} · ~{next.minutes} min
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No active programme.</p>
        )}
      </CardContent>
    </Card>
  );
}
