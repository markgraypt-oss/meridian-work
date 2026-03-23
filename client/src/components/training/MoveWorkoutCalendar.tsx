import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, startOfDay, isSameDay } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MoveWorkoutCalendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: number;
  week: number;
  day: number;
  position?: number;
  workoutName: string;
  currentDate: string;
}

export function MoveWorkoutCalendar({ 
  open, 
  onOpenChange, 
  enrollmentId,
  week,
  day,
  position,
  workoutName,
  currentDate,
}: MoveWorkoutCalendarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSelectedDate(currentDate);
    }
  }, [open, currentDate]);

  const moveWorkoutMutation = useMutation({
    mutationFn: async (newDate: string) => {
      const response = await apiRequest('POST', `/api/my-programs/${enrollmentId}/move-workout`, {
        week,
        day,
        position,
        originalDate: currentDate,
        newDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-extra-workout-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-workout'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/programme-workouts-range'] });
      toast({ title: "Workout moved", description: `Moved to ${format(new Date(selectedDate), 'd MMM yyyy')}` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move workout.", variant: "destructive" });
    },
  });

  const handleDateTap = (date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
  };

  const handleSave = () => {
    if (selectedDate !== currentDate) {
      moveWorkoutMutation.mutate(selectedDate);
    } else {
      onOpenChange(false);
    }
  };

  const months = useMemo(() => {
    const currentMonth = new Date();
    const result: Date[] = [];
    
    for (let i = 0; i < monthsToShow; i++) {
      result.push(addMonths(currentMonth, i));
    }
    
    return result;
  }, [monthsToShow]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setMonthsToShow(prev => prev + 3);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setMonthsToShow(6);
    }
  }, [open]);

  const renderCalendarMonth = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });
    
    const firstDayOfWeek = start.getDay();
    const emptyDays = Array(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1).fill(null);
    const allDays = [...emptyDays, ...days];
    
    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    const today = startOfDay(new Date());
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div key={format(monthDate, 'yyyy-MM')} className="mb-8">
        <h3 className="text-center text-lg font-semibold text-foreground mb-4">
          {format(monthDate, "MMMM yyyy")}
        </h3>
        
        <div className="grid grid-cols-7 gap-0 mb-2">
          {dayLabels.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {weeks.map((week, weekIdx) => (
            week.map((dayDate, dayIdx) => {
              const isCurrentMonth = dayDate && isSameMonth(dayDate, monthDate);
              const isPast = dayDate && isBefore(dayDate, today);
              const isToday = dayDate && isSameDay(dayDate, today);
              const isSelected = dayDate && format(dayDate, 'yyyy-MM-dd') === selectedDate;
              const canTap = dayDate && isCurrentMonth && !isPast;
              
              return (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() => canTap && dayDate && handleDateTap(dayDate)}
                  className={`
                    h-10 flex items-center justify-center relative
                    ${!dayDate ? "invisible" : ""}
                    ${canTap ? "cursor-pointer active:opacity-70" : ""}
                  `}
                >
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium relative z-10
                      ${!isCurrentMonth ? "text-muted-foreground/30" : ""}
                      ${isSelected ? "bg-[#38bdf8] text-white" : ""}
                      ${isToday && !isSelected ? "border-2 border-[#38bdf8] text-foreground" : ""}
                      ${!isSelected && isCurrentMonth ? "text-foreground" : ""}
                      ${isPast && !isSelected ? "text-muted-foreground/50" : ""}
                    `}
                  >
                    {dayDate ? dayDate.getDate() : ""}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[90vh] flex flex-col p-0 bg-background border-border">
        <DialogDescription className="sr-only">Select a new date for your workout</DialogDescription>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-foreground hover:bg-transparent p-0"
          >
            Cancel
          </Button>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Move Workout
          </DialogTitle>
          <Button
            variant="ghost"
            onClick={handleSave}
            disabled={moveWorkoutMutation.isPending}
            className="text-foreground hover:bg-transparent p-0"
          >
            {moveWorkoutMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {months.map(month => renderCalendarMonth(month))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
