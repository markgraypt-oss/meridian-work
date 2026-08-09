import { useState, useMemo } from "react";
import {
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, format, isAfter, isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkoutLog, CheckInRecord, NutritionDay, DataPoint } from "./types";

interface Props {
  workouts: WorkoutLog[];
  checkIns: CheckInRecord[];
  nutrition: NutritionDay[];
  steps: DataPoint[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function Dot({ filled, future }: { filled: boolean; future: boolean }) {
  if (filled) return (
    <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-emerald-200" />
    </div>
  );
  if (future) return <div className="h-5 w-5 rounded-full border border-border/30" />;
  return <div className="h-5 w-5 rounded-full border border-border/60" />;
}

interface RowProps {
  label: string;
  dayStrings: string[];
  filledSet: Set<string>;
  today: Date;
  weekDays: Date[];
  hasAnyData: boolean;
  noDataMsg: string;
}

function Row({ label, dayStrings, filledSet, today, weekDays, hasAnyData, noDataMsg }: RowProps) {
  if (!hasAnyData) {
    return (
      <div className="flex items-center gap-3 py-1.5">
        <span className="w-20 text-xs text-muted-foreground/50 shrink-0">{label}</span>
        <span className="text-xs text-muted-foreground/40 italic">{noDataMsg}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-20 text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {weekDays.map((day, i) => (
          <Dot key={i} filled={filledSet.has(dayStrings[i])} future={isAfter(day, today)} />
        ))}
      </div>
    </div>
  );
}

export function ComplianceStrip({ workouts, checkIns, nutrition, steps }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();

  const weekStart = useMemo(
    () => addWeeks(startOfWeek(today, { weekStartsOn: 1 }), weekOffset),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekOffset],
  );

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart],
  );

  const dayStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));
  const dateRange = `${format(weekStart, 'd MMM')}–${format(weekDays[6], 'd MMM yyyy')}`;

  const workoutSet   = new Set(workouts.map(w => w.date).filter(Boolean) as string[]);
  const checkInSet   = new Set(checkIns.map(c => c.date));
  const nutritionSet = new Set(nutrition.map(n => n.date));
  const stepsSet     = new Set(steps.map(s => s.date));

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Weekly compliance</CardTitle>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">{dateRange}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setWeekOffset(o => o - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setWeekOffset(o => o + 1)}
              disabled={weekOffset >= 0}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {/* Day header */}
        <div className="flex items-center gap-3 pb-1.5 border-b border-border/40 mb-0.5">
          <div className="w-20" />
          <div className="flex gap-1.5">
            {weekDays.map((day, i) => (
              <div key={i}
                className={`h-5 w-5 flex items-center justify-center text-[10px] font-medium
                  ${isSameDay(day, today) ? 'text-primary font-bold' : 'text-muted-foreground/60'}`}>
                {DAY_LABELS[i]}
              </div>
            ))}
          </div>
        </div>

        <Row label="Workouts"   dayStrings={dayStrings} filledSet={workoutSet}   today={today} weekDays={weekDays} hasAnyData={workouts.length > 0}   noDataMsg="No workouts logged yet" />
        <Row label="Check-ins"  dayStrings={dayStrings} filledSet={checkInSet}   today={today} weekDays={weekDays} hasAnyData={checkIns.length > 0}   noDataMsg="No check-ins yet" />
        <Row label="Nutrition"  dayStrings={dayStrings} filledSet={nutritionSet} today={today} weekDays={weekDays} hasAnyData={nutrition.length > 0}   noDataMsg="No nutrition logging yet" />
        <Row label="Steps"      dayStrings={dayStrings} filledSet={stepsSet}     today={today} weekDays={weekDays} hasAnyData={steps.length > 0}       noDataMsg="No step data yet" />
      </CardContent>
    </Card>
  );
}
