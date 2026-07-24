import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, startOfDay, isSameDay, addDays, subDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WorkoutScheduleCalendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: number;
  dayPosition: number;
  workoutName: string;
}

export function WorkoutScheduleCalendar({ 
  open, 
  onOpenChange, 
  enrollmentId,
  dayPosition,
  workoutName,
}: WorkoutScheduleCalendarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: scheduleData } = useQuery<{ scheduledDates: string[]; upcomingCount: number; extraDates?: string[] }>({
    queryKey: ['/api/my-programs', enrollmentId, 'workout-schedule', dayPosition],
    queryFn: async () => {
      const response = await fetch(`/api/my-programs/${enrollmentId}/workout-schedule?dayPosition=${dayPosition}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    },
    enabled: open && !!enrollmentId && !!dayPosition,
  });

  const scheduledDatesList = scheduleData?.scheduledDates || [];

  const scheduledDatesSet = useMemo(() => {
    return new Set(scheduledDatesList);
  }, [scheduledDatesList]);

  useEffect(() => {
    if (open) {
      if (scheduleData?.extraDates && scheduleData.extraDates.length > 0) {
        setSelectedDates(new Set(scheduleData.extraDates));
      } else {
        setSelectedDates(new Set());
      }
    }
  }, [open, scheduleData?.extraDates]);

  const saveMutation = useMutation({
    mutationFn: async (extraDates: string[]) => {
      const response = await apiRequest('POST', `/api/my-programs/${enrollmentId}/extra-sessions`, {
        dayPosition,
        extraDates,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs', enrollmentId, 'workout-schedule', dayPosition] });
      toast({ title: "Schedule updated", description: "Extra sessions have been saved." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save schedule.", variant: "destructive" });
    },
  });

  const handleDateTap = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (scheduledDatesSet.has(dateStr)) {
      return;
    }
    
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleSave = () => {
    saveMutation.mutate(Array.from(selectedDates));
  };

  const getScheduleInfo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isScheduled = scheduledDatesSet.has(dateStr);
    const isExtraSelected = selectedDates.has(dateStr);
    
    if (!isScheduled && !isExtraSelected) return { isScheduled: false, isExtra: false, hasPrev: false, hasNext: false };
    
    const prevDate = format(subDays(date, 1), 'yyyy-MM-dd');
    const nextDate = format(addDays(date, 1), 'yyyy-MM-dd');
    
    const hasPrev = scheduledDatesSet.has(prevDate) || selectedDates.has(prevDate);
    const hasNext = scheduledDatesSet.has(nextDate) || selectedDates.has(nextDate);
    
    return {
      isScheduled,
      isExtra: isExtraSelected,
      hasPrev: (isScheduled || isExtraSelected) && hasPrev,
      hasNext: (isScheduled || isExtraSelected) && hasNext,
    };
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
      setSelectedDates(new Set());
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
            week.map((day, dayIdx) => {
              const isCurrentMonth = day && isSameMonth(day, monthDate);
              const isPast = day && isBefore(day, today);
              const isToday = day && isSameDay(day, today);
              const scheduleInfo = day ? getScheduleInfo(day) : { isScheduled: false, isExtra: false, hasPrev: false, hasNext: false };
              const canTap = day && isCurrentMonth && !isPast && !scheduleInfo.isScheduled;
              
              return (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() => canTap && day && handleDateTap(day)}
                  className={`
                    h-10 flex items-center justify-center relative
                    ${!day ? "invisible" : ""}
                    ${canTap ? "cursor-pointer active:opacity-70" : ""}
                  `}
                >
                  {(scheduleInfo.isScheduled || scheduleInfo.isExtra) && scheduleInfo.hasPrev && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-8 bg-[#38bdf8]" />
                  )}
                  {(scheduleInfo.isScheduled || scheduleInfo.isExtra) && scheduleInfo.hasNext && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-8 bg-[#38bdf8]" />
                  )}
                  
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium relative z-10
                      ${!isCurrentMonth ? "text-muted-foreground/30" : ""}
                      ${scheduleInfo.isScheduled ? "bg-[#38bdf8] text-white" : ""}
                      ${scheduleInfo.isExtra ? "bg-[#38bdf8]/70 text-white border-2 border-dashed border-white" : ""}
                      ${isToday && !scheduleInfo.isScheduled && !scheduleInfo.isExtra ? "border-2 border-[#38bdf8] text-foreground" : ""}
                      ${!scheduleInfo.isScheduled && !scheduleInfo.isExtra && isCurrentMonth ? "text-foreground" : ""}
                      ${isPast && !scheduleInfo.isScheduled && !scheduleInfo.isExtra ? "text-muted-foreground/50" : ""}
                    `}
                  >
                    {day ? day.getDate() : ""}
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  const hasChanges = selectedDates.size > 0 || (scheduleData?.extraDates && scheduleData.extraDates.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style>{`
        [role="dialog"] > button:last-of-type {
          display: none !important;
        }
      `}</style>
      <DialogContent className="w-full h-full max-w-none max-h-none sm:max-w-lg sm:max-h-[90vh] p-0 rounded-none sm:rounded-lg flex flex-col bg-background" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Workout Schedule</DialogTitle>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-foreground font-normal"
          >
            Cancel
          </Button>
          <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="text-foreground font-normal"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
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
