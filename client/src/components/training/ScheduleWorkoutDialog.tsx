import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, startOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScheduleWorkoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutId: number;
  workoutName: string;
}

export function ScheduleWorkoutDialog({ 
  open, 
  onOpenChange, 
  workoutId, 
  workoutName 
}: ScheduleWorkoutDialogProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Get date range for all displayed months
  const currentMonth = new Date();
  const nextMonth = addMonths(currentMonth, 1);
  const monthAfter = addMonths(currentMonth, 2);
  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(monthAfter), 'yyyy-MM-dd');

  // Fetch all scheduled workouts for the displayed months
  const { data: allScheduledWorkouts = [] } = useQuery<Array<{ scheduledDate: string; workoutName: string }>>({
    queryKey: ["/api/scheduled-workouts", "range", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/scheduled-workouts?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
    enabled: open,
  });

  // Create a map of dates with workouts for quick lookup
  const scheduledDatesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allScheduledWorkouts.forEach(workout => {
      const dateKey = workout.scheduledDate?.split('T')[0];
      if (dateKey) {
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(workout.workoutName);
      }
    });
    return map;
  }, [allScheduledWorkouts]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) {
        throw new Error("Please select a date");
      }
      
      // Send date as YYYY-MM-DD string to avoid timezone issues
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      return await apiRequest("POST", `/api/workouts/${workoutId}/schedule`, { 
        scheduledDate: dateString,
        workoutName: workoutName,
        workoutType: 'individual',
      });
    },
    onSuccess: () => {
      const dateString = format(selectedDate!, 'yyyy-MM-dd');
      toast({
        title: "Workout Scheduled",
        description: `${workoutName} has been scheduled for ${format(selectedDate!, 'PPPP')}.`,
      });
      // Invalidate caches to refresh dashboard and calendars
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/today-workout", dateString] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/activities"] });
      onOpenChange(false);
      setSelectedDate(new Date());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule workout",
        variant: "destructive",
      });
    },
  });

  const handleScheduleClick = () => {
    scheduleMutation.mutate();
  };

  const renderCalendarMonth = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });
    
    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = start.getDay();
    
    // Create array of empty cells for days before the month starts
    const emptyDays = Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill(null);
    
    const allDays = [...emptyDays, ...days];
    
    // Chunk into weeks
    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    const today = startOfDay(new Date());
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div key={monthDate.toString()} className="mb-8">
        <h3 className="text-center text-lg font-semibold text-foreground mb-4">
          {format(monthDate, "MMMM yyyy")}
        </h3>
        
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayLabels.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weeks.map((week, weekIdx) => (
            week.map((day, dayIdx) => {
              const isCurrentMonth = day && isSameMonth(day, monthDate);
              const isPast = day && isBefore(day, today);
              const isSelected = day && format(day, "yyyy-MM-dd") === format(selectedDate || new Date(), "yyyy-MM-dd");
              const dateKey = day ? format(day, "yyyy-MM-dd") : "";
              const hasWorkout = scheduledDatesMap.has(dateKey);
              const workoutNames = scheduledDatesMap.get(dateKey) || [];
              
              return (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() => day && !isPast && handleDateChange(day)}
                  disabled={!day || isPast}
                  title={hasWorkout ? `Scheduled: ${workoutNames.join(', ')}` : ''}
                  className={`
                    h-10 rounded text-sm font-medium transition-colors relative
                    ${!day ? "invisible" : ""}
                    ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/30"}
                    ${isPast ? "opacity-30 cursor-not-allowed" : ""}
                    ${isSelected ? "bg-primary text-white" : hasWorkout && !isPast ? "bg-primary/20 hover:bg-primary/30" : "hover:bg-muted"}
                  `}
                >
                  {day ? day.getDate() : ""}
                  {hasWorkout && !isPast && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </button>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <style>{`
          [role="dialog"] > button:last-of-type {
            display: none !important;
          }
        `}</style>
        <DialogContent className="w-full h-full max-w-none max-h-none sm:max-w-lg sm:max-h-[90vh] p-0 rounded-b-3xl sm:rounded-lg flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b p-4 flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-foreground text-base"
            >
              Cancel
            </Button>
            <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
            <Button
              onClick={handleScheduleClick}
              disabled={!selectedDate || scheduleMutation.isPending}
              className="bg-primary hover:opacity-90 text-white"
            >
              {scheduleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>

          {/* Calendar Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderCalendarMonth(currentMonth)}
            {renderCalendarMonth(nextMonth)}
            {renderCalendarMonth(monthAfter)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
