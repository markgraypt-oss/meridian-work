import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Edit2, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { format, subDays, addDays, isSameDay, startOfDay, isAfter } from "date-fns";
import type { CheckIn } from "@shared/schema";

interface ViewCheckInCardProps {
  checkIn: CheckIn;
  onEdit?: () => void;
  initialDate?: Date;
}

const SLIDER_LABELS = {
  mood: { 1: "Very low", 2: "Low", 3: "OK", 4: "Good", 5: "Great" },
  energy: { 1: "Exhausted", 2: "Low", 3: "OK", 4: "Good", 5: "Energised" },
  stress: { 1: "Very calm", 2: "Calm", 3: "OK", 4: "Stressed", 5: "Very stressed" },
  sleep: { 1: "Terrible", 2: "Poor", 3: "OK", 4: "Good", 5: "Great" },
  clarity: { 1: "Very unclear", 2: "Foggy", 3: "OK", 4: "Clear", 5: "Sharp" },
};

const VISIBLE_DAYS = 7;
const PAST_DAYS_TO_SHOW = 60;

function generateDaysUpToToday(pastDays: number): Date[] {
  const today = startOfDay(new Date());
  const days: Date[] = [];
  for (let i = pastDays; i >= 0; i--) {
    days.push(subDays(today, i));
  }
  return days;
}

export default function ViewCheckInCard({ checkIn, onEdit, initialDate }: ViewCheckInCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfDay(initialDate || new Date()));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  const { data: allCheckIns = [] } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins"],
    enabled: isOpen,
  });

  const checkInDates = useMemo(() => new Set(
    allCheckIns.map(c => format(new Date(c.checkInDate!), 'yyyy-MM-dd'))
  ), [allCheckIns]);

  const selectedCheckIn = useMemo(() => {
    const checkInsForDate = allCheckIns.filter(c => isSameDay(new Date(c.checkInDate!), selectedDate));
    return checkInsForDate.reduce((latest, current) => 
      !latest || current.id > latest.id ? current : latest, 
      null as CheckIn | null
    );
  }, [allCheckIns, selectedDate]);

  const days = useMemo(() => generateDaysUpToToday(PAST_DAYS_TO_SHOW), []);

  // Scroll to end (today) whenever the panel opens — use RAF to guarantee layout is done
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const handlePrevDay = () => {
    setSelectedDate(prev => startOfDay(subDays(prev, 1)));
  };

  const handleNextDay = () => {
    const nextDay = startOfDay(addDays(selectedDate, 1));
    if (!isAfter(nextDay, today)) {
      setSelectedDate(nextDay);
    }
  };

  const handleOpen = () => {
    setSelectedDate(startOfDay(initialDate || new Date()));
    setIsOpen(true);
  };

  const isToday = isSameDay(selectedDate, today);

  const renderYesNo = (value: boolean | null | undefined, label: string) => (
    <div className="flex items-center justify-between mb-6">
      <span className="text-[15px] font-medium leading-loose text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-semibold px-2 py-0.5 rounded text-sm ${value === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</span>
        <span className={`font-semibold px-2 py-0.5 rounded text-sm ${value === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</span>
      </div>
    </div>
  );

  const renderSliderValue = (value: number | null | undefined, labels: Record<number, string>, question: string) => (
    <div className="flex items-center justify-between mb-6">
      <span className="text-[15px] font-medium leading-loose text-foreground">{question}</span>
      <span className="font-medium px-3 py-1 rounded bg-[#0cc9a9] text-black text-xs">
        {value !== null && value !== undefined ? labels[value as keyof typeof labels] : 'N/A'}
      </span>
    </div>
  );

  if (!isOpen) {
    return (
      <Button
        onClick={handleOpen}
        className="w-full py-6 text-base font-semibold bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
        data-testid="button-view-completed-check-in"
      >
        <CheckCircle2 className="mr-2 h-5 w-5" />
        Check-In Completed
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Check-Ins</h1>
          {selectedCheckIn && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setTimeout(() => onEdit?.(), 100);
              }}
              data-testid="button-edit-check-in"
            >
              <Edit2 className="h-5 w-5" />
            </Button>
          )}
          {(!selectedCheckIn || !onEdit) && <div className="w-10" />}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-2 mt-2 mb-4 bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-center gap-2 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevDay}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-6 w-6 stroke-[3]" />
            </Button>
            <span className="font-semibold text-base min-w-[100px] text-center">
              {isToday ? 'Today' : format(selectedDate, 'EEE, MMM d')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextDay}
              disabled={isToday}
              className="h-9 w-9 disabled:opacity-30"
            >
              <ChevronRight className="h-6 w-6 stroke-[3]" />
            </Button>
          </div>

          <div className="mx-4 mb-4 rounded-xl border border-[#0cc9a9] overflow-hidden">
            <div 
              ref={scrollContainerRef}
              className="flex overflow-x-auto scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasCheckIn = checkInDates.has(dateStr);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className="flex flex-col items-center py-3 transition-all flex-shrink-0"
                  style={{ width: `calc(100% / ${VISIBLE_DAYS})`, scrollSnapAlign: 'start' }}
                >
                  <span className="text-xs text-muted-foreground font-medium">
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-lg font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="h-5 flex items-center justify-center mt-1">
                    {hasCheckIn ? (
                      <div className="w-5 h-5 rounded-full bg-[#0cc9a9] flex items-center justify-center">
                        <Check className="h-3 w-3 text-black" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/40" />
                    )}
                  </div>
                </button>
              );
            })}
            </div>
          </div>

          <div className="p-4 pb-24">
          {selectedCheckIn ? (
            <div className="space-y-6">
              <div className="pt-2">
                {renderSliderValue(selectedCheckIn.moodScore, SLIDER_LABELS.mood, "How is your mood today?")}
                {renderSliderValue(selectedCheckIn.energyScore, SLIDER_LABELS.energy, "How is your energy today?")}
              </div>

              <div className="border-t border-border pt-6">
                {renderSliderValue(selectedCheckIn.stressScore, SLIDER_LABELS.stress, "How stressed do you feel today?")}
              </div>

              <div className="border-t border-border pt-6">
                {renderYesNo(selectedCheckIn.headache, "Suffered a headache yesterday?")}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[15px] font-medium leading-loose text-foreground">Consumed alcohol yesterday?</span>
                  <div className="flex items-center gap-2">
                    {selectedCheckIn.alcohol === true && selectedCheckIn.alcoholCount && (
                      <span className="text-xs text-muted-foreground">({selectedCheckIn.alcoholCount} {selectedCheckIn.alcoholCount === 1 ? 'drink' : 'drinks'})</span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold px-2 py-0.5 rounded text-sm ${selectedCheckIn.alcohol === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-sm ${selectedCheckIn.alcohol === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</span>
                    </div>
                  </div>
                </div>
                {renderYesNo(selectedCheckIn.emotionallyStable, "Feel mentally strong today?")}
                {renderYesNo(selectedCheckIn.anxious, "Felt nervous or anxious yesterday?")}
                {renderYesNo(selectedCheckIn.overwhelmed, "Felt overwhelmed yesterday?")}
                {renderYesNo(selectedCheckIn.exercisedYesterday, "Exercised yesterday?")}
                {renderYesNo(selectedCheckIn.caffeineAfter2pm, "Consumed caffeine after 2pm yesterday?")}
                {renderYesNo(selectedCheckIn.practicedMindfulness, "Practiced mindfulness yesterday?")}
              </div>

              {selectedCheckIn.fatigue !== null && selectedCheckIn.fatigue !== undefined && (
                <div className="border-t border-border pt-6">
                  {renderYesNo(selectedCheckIn.fatigue, "Have you been experiencing fatigue?")}
                </div>
              )}

              <div className="border-t border-border pt-6">
                {renderSliderValue(selectedCheckIn.sleepScore, SLIDER_LABELS.sleep, "How was your sleep last night?")}
                {renderSliderValue(selectedCheckIn.clarityScore, SLIDER_LABELS.clarity, "How clear does your mind feel today?")}
              </div>

              <div className="border-t border-border pt-6">
                {renderYesNo(selectedCheckIn.sick, "Feel sick or unwell?")}
                {renderYesNo(selectedCheckIn.painOrInjury, "Have pain or an injury?")}
              </div>

              {selectedCheckIn.notes && (
                <div className="border-t border-border pt-6">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
                  <p className="text-base text-foreground">{selectedCheckIn.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No check-in for this date</p>
            </div>
          )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
