import { useEffect, useState, useRef, useMemo } from "react";
import { 
  addDays, 
  subDays,
  isSameDay, 
  format,
  isToday,
  differenceInDays
} from "date-fns";
import { cn } from "@/lib/utils";

interface WeekCalendarStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const BUFFER_DAYS = 90;
const VISIBLE_DAYS = 7;

function getDayLetter(date: Date): string {
  const dayOfWeek = date.getDay();
  return DAY_LETTERS[dayOfWeek];
}

function generateDays(centerDate: Date, bufferDays: number): Date[] {
  const days: Date[] = [];
  for (let i = -bufferDays; i <= bufferDays; i++) {
    days.push(addDays(centerDate, i));
  }
  return days;
}

export default function WeekCalendarStrip({ selectedDate, onDateChange }: WeekCalendarStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [centerDate, setCenterDate] = useState<Date>(selectedDate);
  const [containerWidth, setContainerWidth] = useState(0);

  const days = useMemo(() => generateDays(centerDate, BUFFER_DAYS), [centerDate]);
  
  const dayWidth = containerWidth / VISIBLE_DAYS;

  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const scrollToDate = (date: Date, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container || dayWidth === 0) return;

    const dayIndex = days.findIndex(d => isSameDay(d, date));
    if (dayIndex === -1) return;

    const scrollPosition = dayIndex * dayWidth;
    container.scrollTo({ left: scrollPosition, behavior });
  };

  useEffect(() => {
    if (dayWidth === 0) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const dayIndex = days.findIndex(d => isSameDay(d, selectedDate));
    if (dayIndex !== -1) {
      container.scrollLeft = dayIndex * dayWidth;
    }
  }, [dayWidth]);

  useEffect(() => {
    if (dayWidth === 0) return;
    
    const diff = Math.abs(differenceInDays(selectedDate, centerDate));
    if (diff > BUFFER_DAYS - 14) {
      setCenterDate(selectedDate);
    } else {
      scrollToDate(selectedDate);
    }
  }, [selectedDate, dayWidth]);

  const handleScroll = () => {
    if (dayWidth === 0) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const leftmostDayIndex = Math.round(scrollLeft / dayWidth);

    if (leftmostDayIndex < 14) {
      setCenterDate(subDays(centerDate, BUFFER_DAYS));
    } else if (leftmostDayIndex > days.length - 21) {
      setCenterDate(addDays(centerDate, BUFFER_DAYS));
    }
  };

  const handleDayClick = (day: Date) => {
    onDateChange(day);
    scrollToDate(day);
  };

  if (dayWidth === 0) {
    return (
      <div 
        ref={scrollContainerRef}
        className="w-full bg-background/50 backdrop-blur-sm border-b border-border/30 py-3 h-[76px]"
      />
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="w-full bg-background/50 backdrop-blur-sm border-b border-border/30 overflow-x-auto py-3"
      onScroll={handleScroll}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div 
        className="flex scrollbar-hide" 
        style={{ width: `${days.length * dayWidth}px` }}
      >
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);
          const dayLetter = getDayLetter(day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className="flex-none flex flex-col items-center justify-center h-16 transition-all"
              style={{ width: `${dayWidth}px` }}
              data-testid={`day-${format(day, 'yyyy-MM-dd')}`}
            >
              <span className={cn(
                "text-xs font-medium mb-1",
                isDayToday ? "text-[#0cc9a9] font-semibold" : "text-muted-foreground"
              )}>
                {dayLetter}
              </span>
              <span className={cn(
                "w-9 h-9 flex items-center justify-center rounded-full text-lg font-semibold transition-all",
                isSelected 
                  ? "bg-[#0cc9a9] text-black" 
                  : isDayToday
                  ? "text-[#0cc9a9]"
                  : "text-foreground hover:bg-muted"
              )}>
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
