import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { X, ChevronLeft, ChevronRight, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isAfter, parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { Habit, HabitCompletion } from "@shared/schema";

export default function HabitProgress() {
  const params = useParams();
  const habitId = parseInt(params.id as string);
  const [, navigate] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { formatDate } = useFormattedDate();

  const { data: habit, isLoading: habitLoading } = useQuery<Habit>({
    queryKey: [`/api/habits/${habitId}`],
  });

  const { data: completions = [], isLoading: completionsLoading } = useQuery<HabitCompletion[]>({
    queryKey: [`/api/habits/${habitId}/completions`],
  });

  if (habitLoading || completionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!habit) {
    return <div>Habit not found</div>;
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get completion dates
  const completionDates = completions.map(c => {
    const d = c.completedDate;
    if (d instanceof Date) return d;
    if (typeof d === 'string') return parseISO(d);
    return new Date(d as any);
  });

  // Calculate if a day was completed
  const isDayCompleted = (date: Date) => {
    return completionDates.some(compDate => isSameDay(compDate, date));
  };

  // Calculate if a day was missed (past day after habit start date, not completed, and supposed to be practiced)
  const isDayMissed = (date: Date) => {
    const today = startOfDay(new Date());
    const habitStartDate = startOfDay(new Date(habit.startDate));
    
    // Only mark as missed if:
    // 1. Date is in the past
    // 2. Date is after habit start date
    // 3. Not completed
    // 4. Not today or future
    if (isAfter(date, today) || isSameDay(date, today)) return false;
    if (isAfter(habitStartDate, date)) return false;
    if (isDayCompleted(date)) return false;

    // Check if day matches habit's daysOfWeek
    const dayName = format(date, 'EEEE');
    if (!habit.daysOfWeek || habit.daysOfWeek === 'Everyday') return true;
    return habit.daysOfWeek.includes(dayName);
  };

  // Calculate stats for current month (deduplicate by day)
  const uniqueCompletionDays = Array.from(
    new Set(completionDates.map(d => format(d, 'yyyy-MM-dd')))
  ).map(s => parseISO(s));
  const monthCompletions = uniqueCompletionDays.filter(date => isSameMonth(date, currentMonth));
  
  // Count all scheduled days in the full month (matching daysOfWeek)
  const scheduledDaysInMonth = daysInMonth.filter(date => {
    const dayName = format(date, 'EEEE');
    if (!habit.daysOfWeek || habit.daysOfWeek === 'Everyday') return true;
    return habit.daysOfWeek.includes(dayName);
  }).length;
  
  const monthCompletionPercentage = scheduledDaysInMonth > 0 
    ? Math.round((monthCompletions.length / scheduledDaysInMonth) * 100) 
    : 0;

  // Calculate longest streak using calendar days (ignoring time)
  // First get unique dates (in case of duplicate completions on same day)
  const uniqueDateStrings = Array.from(new Set(completionDates.map(d => format(d, 'yyyy-MM-dd'))));
  const sortedUniqueDates = uniqueDateStrings.map(s => parseISO(s)).sort((a, b) => a.getTime() - b.getTime());
  
  let longestStreak = 0;
  let currentStreak = 0;
  
  for (let i = 0; i < sortedUniqueDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const dayDiff = differenceInCalendarDays(sortedUniqueDates[i], sortedUniqueDates[i-1]);
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const totalCompleted = sortedUniqueDates.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with habit title */}
      <div className="bg-[#1a2234] h-14 flex items-center px-4">
        <button 
          onClick={() => navigate('/habits')}
          className="text-white"
          data-testid="button-close"
        >
          <X className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center text-white font-semibold text-lg truncate px-4">
          {habit.title}
        </h1>
        <div className="w-6" />
      </div>

      <div className="px-4 pt-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-center mb-3 relative">
          <div className="absolute left-0 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="text-foreground h-8 w-8"
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="text-foreground font-bold text-sm px-2 h-8"
              data-testid="button-today"
            >
              T
            </Button>
          </div>
          <h2 className="text-lg font-bold text-foreground">{format(currentMonth, 'MMM yyyy').toUpperCase()}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="text-foreground h-8 w-8 absolute right-0"
            data-testid="button-next-month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calendar */}
        <div className="mb-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}
            
            {/* Actual days */}
            {daysInMonth.map(day => {
              const completed = isDayCompleted(day);
              const missed = isDayMissed(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toString()}
                  className="h-9 flex items-center justify-center relative"
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                >
                  {completed ? (
                    <div className="bg-green-500 rounded-full w-7 h-7 flex items-center justify-center" data-testid="completed-indicator">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className={`text-sm font-medium ${isToday ? 'text-[#0cc9a9]' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                  )}
                  {isToday && !completed && (
                    <div className="absolute inset-1 rounded-full border border-[#0cc9a9]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-0">
          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <span className="text-muted-foreground">{format(currentMonth, 'MMMM')} completion</span>
            <span className="text-lg font-semibold text-foreground">{monthCompletionPercentage} <span className="text-sm text-muted-foreground">%</span></span>
          </div>

          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <span className="text-muted-foreground">Total completed</span>
            <span className="text-lg font-semibold text-foreground">{totalCompleted} <span className="text-sm text-muted-foreground">Days</span></span>
          </div>

          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <span className="text-muted-foreground">Longest streak</span>
            <span className="text-lg font-semibold text-foreground">{longestStreak} <span className="text-sm text-muted-foreground">Days</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
