import { format, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onCalendarClick: () => void;
}

export default function DateNavigator({ selectedDate, onDateChange, onCalendarClick }: DateNavigatorProps) {
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevDay}
        className="h-8 w-8 text-white hover:bg-white/20"
        data-testid="button-prev-day"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <Button
        variant="ghost"
        onClick={onCalendarClick}
        className="text-white hover:bg-white/20 font-semibold px-6 h-8"
        data-testid="button-open-calendar"
      >
        {isToday(selectedDate) ? "TODAY" : format(selectedDate, "MMM d, yyyy")}
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextDay}
        className="h-8 w-8 text-white hover:bg-white/20"
        data-testid="button-next-day"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
