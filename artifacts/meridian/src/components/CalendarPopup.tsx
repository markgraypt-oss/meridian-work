import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface CalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export default function CalendarPopup({ isOpen, onClose, selectedDate, onDateSelect }: CalendarPopupProps) {
  const [, navigate] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  // Sync currentMonth with selectedDate whenever it changes
  useEffect(() => {
    setCurrentMonth(new Date(selectedDate));
  }, [selectedDate]);

  if (!isOpen) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the week for the month
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Adjust for Monday start

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  const handleOpenFullCalendar = () => {
    onClose();
    navigate('/calendar');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="calendar-backdrop"
      />
      
      {/* Calendar Popup */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] rounded-lg shadow-2xl z-50 w-[90%] max-w-md p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <h2 className="text-white font-semibold text-lg" data-testid="text-month-year">
            {format(currentMonth, "MMMM").toUpperCase()}
          </h2>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="button-next-month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <div key={day} className="text-center text-xs text-gray-400 font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: emptyDays }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}
          
          {/* Days */}
          {daysInMonth.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square flex items-center justify-center rounded-full text-sm font-medium
                  transition-all
                  ${!isCurrentMonth ? 'text-gray-600 opacity-50' : ''}
                  ${isSelected ? 'bg-[#0cc9a9] text-black ring-2 ring-white' : ''}
                  ${isCurrentDay && !isSelected ? 'ring-2 ring-[#0cc9a9] text-[#0cc9a9]' : ''}
                  ${!isSelected && !isCurrentDay && isCurrentMonth ? 'text-white hover:bg-white/10' : ''}
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {/* Full Calendar Button */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <Button
            onClick={handleOpenFullCalendar}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black font-medium"
            data-testid="button-open-full-calendar"
          >
            <Calendar className="h-4 w-4 mr-2" />
            View Full Calendar
          </Button>
        </div>
      </div>
    </>
  );
}
