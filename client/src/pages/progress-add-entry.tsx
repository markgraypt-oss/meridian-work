import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isBefore, startOfDay } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Step = "calendar" | "form";
type MeasurementSide = "left" | "right";

const centerlineMeasurements = [
  { key: "neck", label: "Neck", unit: "cm" },
  { key: "shoulders", label: "Shoulders", unit: "cm" },
  { key: "chest", label: "Chest", unit: "cm" },
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "hips", label: "Hips", unit: "cm" },
];

const bilateralMeasurements = [
  { key: "bicep", label: "Bicep", unit: "cm" },
  { key: "forearm", label: "Forearm", unit: "cm" },
  { key: "thigh", label: "Thigh", unit: "cm" },
  { key: "calf", label: "Calf", unit: "cm" },
];

const measurementFields = [...centerlineMeasurements, ...bilateralMeasurements];

export default function ProgressAddEntryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  
  // Check for date query parameter to skip directly to form
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const fromParam = urlParams.get('from');
  
  const [step, setStep] = useState<Step>(dateParam ? "form" : "calendar");
  const [selectedDate, setSelectedDate] = useState<Date | null>(dateParam ? new Date(dateParam) : null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [measurementSide, setMeasurementSide] = useState<MeasurementSide>("left");
  
  const [bodyWeight, setBodyWeight] = useState("");
  const [fatPercent, setFatPercent] = useState("");
  const [leftMeasurements, setLeftMeasurements] = useState<Record<string, string>>({});
  const [rightMeasurements, setRightMeasurements] = useState<Record<string, string>>({});
  const currentMonthRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "calendar" && currentMonthRef.current && scrollContainerRef.current && stickyHeaderRef.current) {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        const element = currentMonthRef.current;
        const stickyHeader = stickyHeaderRef.current;
        
        if (container && element && stickyHeader) {
          // Calculate the delta using bounding rects for accurate positioning
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const delta = elementRect.top - containerRect.top;
          
          // Small offset to position title just below the visible area top
          const totalOffset = 16;
          
          // Calculate scroll position to show month title below sticky header
          container.scrollTop = container.scrollTop + delta - totalOffset;
        }
      });
    }
  }, [step]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const promises = [];
      
      if (bodyWeight) {
        promises.push(
          apiRequest("POST", "/api/progress/bodyweight", {
            date: new Date(dateStr).toISOString(),
            weight: parseFloat(bodyWeight),
          })
        );
      }
      
      if (fatPercent) {
        promises.push(
          apiRequest("POST", "/api/progress/body-fat", {
            date: new Date(dateStr).toISOString(),
            percentage: parseFloat(fatPercent),
          })
        );
      }

      const leftData: Record<string, number> = {};
      const rightData: Record<string, number> = {};
      
      measurementFields.forEach(field => {
        if (leftMeasurements[field.key]) {
          leftData[field.key] = parseFloat(leftMeasurements[field.key]);
        }
        if (rightMeasurements[field.key]) {
          rightData[field.key] = parseFloat(rightMeasurements[field.key]);
        }
      });

      if (Object.keys(leftData).length > 0 || Object.keys(rightData).length > 0) {
        promises.push(
          apiRequest("POST", "/api/progress/measurements", {
            date: new Date(dateStr).toISOString(),
            leftSide: leftData,
            rightSide: rightData,
          })
        );
      }

      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/bodyweight"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/body-fat"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/measurements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Measurements saved successfully!" });
      // Navigate back to the source page if specified, otherwise default to bodyWeight
      navigate(fromParam || "/my-progress/bodyWeight");
    },
    onError: () => {
      toast({ title: "Failed to save measurements", variant: "destructive" });
    },
  });

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSelectConfirm = () => {
    if (selectedDate) {
      setStep("form");
    }
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleCancel = () => {
    // If coming from quick add (date param present), go back to source page
    // Otherwise, if on form step go back to calendar, else go to home
    if (dateParam) {
      navigate(fromParam || "/");
    } else if (step === "form") {
      setStep("calendar");
    } else {
      navigate("/");
    }
  };

  const renderMonth = (monthDate: Date, isCurrentMonth: boolean) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const today = startOfDay(new Date());
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div 
        key={monthDate.toISOString()} 
        className="mb-16"
        ref={isCurrentMonth ? currentMonthRef : null}
        style={isCurrentMonth ? { scrollMarginTop: '16px' } : undefined}
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          {format(monthDate, "MMMM yyyy")}
        </h3>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-xs text-muted-foreground font-medium text-center py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: adjustedStartDay }).map((_, i) => (
            <div key={`empty-${monthDate.toISOString()}-${i}`} className="h-10" />
          ))}
          {days.map(day => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const isPast = isBefore(startOfDay(day), today);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateSelect(day)}
                className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm transition-colors
                  ${isSelected ? "bg-[#0cc9a9] text-black" : ""}
                  ${isToday && !isSelected ? "border border-[#0cc9a9] text-foreground" : ""}
                  ${isPast && !isSelected && !isToday ? "text-muted-foreground" : ""}
                  ${!isSelected && !isToday && !isPast ? "text-foreground hover:bg-muted" : ""}
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const months: Date[] = [];
    
    for (let i = -6; i <= 6; i++) {
      months.push(addMonths(new Date(), i));
    }

    return (
      <div className="space-y-4">
        <div ref={stickyHeaderRef} className="sticky top-14 bg-background z-10 py-3">
          <div className="text-center text-muted-foreground text-sm">
            Tap days to schedule
          </div>
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="overflow-y-auto pb-24 pt-2 h-[calc(100vh-180px)]" 
          data-testid="calendar-scroll-container"
        >
          {months.map((month, index) => renderMonth(month, index === 6))}
        </div>
      </div>
    );
  };

  const renderForm = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-foreground">Body Weight</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.1"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="w-8 text-right bg-transparent border-0 p-0 h-auto text-foreground"
                placeholder="0"
                data-testid="input-body-weight"
              />
              <span className="text-muted-foreground text-sm">kg</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-foreground">Fat %</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.1"
                value={fatPercent}
                onChange={(e) => setFatPercent(e.target.value)}
                className="w-8 text-right bg-transparent border-0 p-0 h-auto text-foreground"
                placeholder="0"
                data-testid="input-fat-percent"
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>

        <Tabs value={measurementSide} onValueChange={(v) => setMeasurementSide(v as MeasurementSide)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="left" data-testid="tab-left-side">Left Side</TabsTrigger>
            <TabsTrigger value="right" data-testid="tab-right-side">Right Side</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 overflow-hidden">
            <div 
              className="flex transition-transform duration-1000 ease-out"
              style={{ transform: measurementSide === "left" ? "translateX(0)" : "translateX(-50%)", width: "200%" }}
            >
              {/* Left Side Content */}
              <div className="w-1/2 flex px-1">
                <div className="w-1/2 space-y-0">
                  {centerlineMeasurements.map(field => (
                    <div key={field.key} className="flex items-center justify-between py-3 border-b border-border">
                      <span className="text-foreground text-sm">{field.label}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          value={leftMeasurements[field.key] || ""}
                          onChange={(e) => setLeftMeasurements(prev => ({
                            ...prev,
                            [field.key]: e.target.value
                          }))}
                          className="w-8 text-right bg-transparent border-0 p-0 h-auto text-foreground text-sm"
                          placeholder="0"
                          data-testid={`input-left-${field.key}`}
                        />
                        <span className="text-muted-foreground text-sm">{field.unit}</span>
                      </div>
                    </div>
                  ))}
                  {bilateralMeasurements.map(field => (
                    <div key={field.key} className="flex items-center justify-between py-3 border-b border-border">
                      <span className="text-foreground text-sm">L {field.label}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          value={leftMeasurements[field.key] || ""}
                          onChange={(e) => setLeftMeasurements(prev => ({
                            ...prev,
                            [field.key]: e.target.value
                          }))}
                          className="w-8 text-right bg-transparent border-0 p-0 h-auto text-foreground text-sm"
                          placeholder="0"
                          data-testid={`input-left-${field.key}`}
                        />
                        <span className="text-muted-foreground text-sm">{field.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="w-1/2 flex items-start justify-center pt-2">
                  <svg viewBox="0 0 120 240" className="w-40 h-auto">
                    <defs>
                      <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
                      </linearGradient>
                    </defs>
                    
                    <g fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5">
                      <ellipse cx="60" cy="18" rx="14" ry="16" />
                      <path d="M46 34 C42 36, 38 40, 36 50 L34 70 C32 75, 24 78, 18 82 L10 90" />
                      <path d="M74 34 C78 36, 82 40, 84 50 L86 70 C88 75, 96 78, 102 82 L110 90" />
                      <path d="M46 34 L74 34" />
                      <path d="M40 50 C42 65, 44 80, 46 95 L48 110 C48 120, 46 130, 44 145 L42 165 C40 180, 38 195, 36 210 L34 225" />
                      <path d="M80 50 C78 65, 76 80, 74 95 L72 110 C72 120, 74 130, 76 145 L78 165 C80 180, 82 195, 84 210 L86 225" />
                      <path d="M40 50 L80 50" />
                      <path d="M44 95 L76 95" />
                    </g>
                    
                    <g stroke="#0cc9a9" strokeWidth="1" strokeDasharray="4,3" fill="none" opacity="0.8">
                      <path d="M30 28 C40 24, 80 24, 90 28" />
                      <circle cx="25" cy="28" r="2" fill="#0cc9a9" />
                      <circle cx="95" cy="28" r="2" fill="#0cc9a9" />
                      <path d="M25 42 C35 38, 85 38, 95 42" />
                      <circle cx="20" cy="42" r="2" fill="#0cc9a9" />
                      <circle cx="100" cy="42" r="2" fill="#0cc9a9" />
                      <path d="M28 58 C38 54, 82 54, 92 58" />
                      <circle cx="23" cy="58" r="2" fill="#0cc9a9" />
                      <circle cx="97" cy="58" r="2" fill="#0cc9a9" />
                      <path d="M12 85 C15 82, 20 80, 25 82" />
                      <circle cx="8" cy="85" r="2" fill="#0cc9a9" />
                      <path d="M10 92 C14 90, 18 89, 22 90" />
                      <circle cx="6" cy="92" r="2" fill="#0cc9a9" />
                      <path d="M32 78 C42 74, 78 74, 88 78" />
                      <circle cx="27" cy="78" r="2" fill="#0cc9a9" />
                      <circle cx="93" cy="78" r="2" fill="#0cc9a9" />
                      <path d="M34 105 C44 101, 76 101, 86 105" />
                      <circle cx="29" cy="105" r="2" fill="#0cc9a9" />
                      <circle cx="91" cy="105" r="2" fill="#0cc9a9" />
                      <path d="M30 155 C38 152, 50 152, 56 155" />
                      <circle cx="25" cy="155" r="2" fill="#0cc9a9" />
                      <path d="M28 195 C34 192, 44 192, 50 195" />
                      <circle cx="23" cy="195" r="2" fill="#0cc9a9" />
                    </g>
                  </svg>
                </div>
              </div>

              {/* Right Side Content */}
              <div className="w-1/2 flex px-1">
                <div className="w-1/2 flex items-start justify-center pt-2">
                  <svg viewBox="0 0 120 240" className="w-40 h-auto">
                    <defs>
                      <linearGradient id="bodyGradientRight" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
                      </linearGradient>
                    </defs>
                    
                    <g fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5">
                      <ellipse cx="60" cy="18" rx="14" ry="16" />
                      <path d="M46 34 C42 36, 38 40, 36 50 L34 70 C32 75, 24 78, 18 82 L10 90" />
                      <path d="M74 34 C78 36, 82 40, 84 50 L86 70 C88 75, 96 78, 102 82 L110 90" />
                      <path d="M46 34 L74 34" />
                      <path d="M40 50 C42 65, 44 80, 46 95 L48 110 C48 120, 46 130, 44 145 L42 165 C40 180, 38 195, 36 210 L34 225" />
                      <path d="M80 50 C78 65, 76 80, 74 95 L72 110 C72 120, 74 130, 76 145 L78 165 C80 180, 82 195, 84 210 L86 225" />
                      <path d="M40 50 L80 50" />
                      <path d="M44 95 L76 95" />
                    </g>
                    
                    <g stroke="#0cc9a9" strokeWidth="1" strokeDasharray="4,3" fill="none" opacity="0.8">
                      <path d="M12 85 C15 82, 20 80, 25 82" />
                      <circle cx="8" cy="85" r="2" fill="#0cc9a9" />
                      <path d="M95 85 C98 82, 103 80, 108 82" />
                      <circle cx="112" cy="85" r="2" fill="#0cc9a9" />
                      <path d="M10 92 C14 90, 18 89, 22 90" />
                      <circle cx="6" cy="92" r="2" fill="#0cc9a9" />
                      <path d="M98 92 C102 90, 106 89, 110 90" />
                      <circle cx="114" cy="92" r="2" fill="#0cc9a9" />
                      <path d="M30 155 C38 152, 50 152, 56 155" />
                      <circle cx="25" cy="155" r="2" fill="#0cc9a9" />
                      <path d="M64 155 C70 152, 82 152, 90 155" />
                      <circle cx="95" cy="155" r="2" fill="#0cc9a9" />
                      <path d="M28 195 C34 192, 44 192, 50 195" />
                      <circle cx="23" cy="195" r="2" fill="#0cc9a9" />
                      <path d="M70 195 C76 192, 86 192, 92 195" />
                      <circle cx="97" cy="195" r="2" fill="#0cc9a9" />
                    </g>
                  </svg>
                </div>
                
                <div className="w-1/2 space-y-0">
                  {bilateralMeasurements.map(field => (
                    <div key={field.key} className="flex items-center justify-between py-3 border-b border-border">
                      <span className="text-foreground text-sm">R {field.label}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          value={rightMeasurements[field.key] || ""}
                          onChange={(e) => setRightMeasurements(prev => ({
                            ...prev,
                            [field.key]: e.target.value
                          }))}
                          className="w-8 text-right bg-transparent border-0 p-0 h-auto text-foreground text-sm"
                          placeholder="0"
                          data-testid={`input-right-${field.key}`}
                        />
                        <span className="text-muted-foreground text-sm">{field.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-progress-add-entry">
      <header 
        className="sticky top-0 z-50 bg-background border-b border-border"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.06) 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
      >
        <div className="flex justify-between items-center h-14 px-4">
          <Button
            variant="ghost"
            className="text-foreground hover:bg-transparent p-0"
            onClick={handleCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          
          <h1 className="text-foreground text-lg font-semibold" data-testid="text-page-title">
            {step === "calendar" 
              ? "Calendar" 
              : selectedDate 
                ? (isSameDay(selectedDate, new Date()) ? "Today" : formatDate(selectedDate, "short"))
                : "Add Entry"}
          </h1>
          
          {step === "calendar" ? (
            <Button
              variant="ghost"
              className="text-[#0cc9a9] hover:bg-transparent p-0 font-medium"
              onClick={handleSelectConfirm}
              disabled={!selectedDate}
              data-testid="button-select"
            >
              Select
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-[#0cc9a9] hover:bg-transparent p-0 font-medium"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </header>

      <div className="p-4">
        {step === "calendar" ? renderCalendar() : renderForm()}
      </div>
    </div>
  );
}
