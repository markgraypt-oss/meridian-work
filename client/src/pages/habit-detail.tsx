import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { HabitTemplate, Goal } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BottomSheetPicker } from "@/components/ui/bottom-sheet-picker";
import palmImage from "@assets/j5eyhrdf_1771947062076.png";
import thumbImage from "@assets/1_1771954180973.png";
import cuppedHandImage from "@assets/2_1771954180973.png";
import fistImage from "@assets/3_1771954180973.png";

const ITEM_HEIGHT = 48;

function StepDial({ values, selected, onSelect, formatLabel }: {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  formatLabel: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = values.indexOf(selected);
    if (containerRef.current && idx >= 0) {
      containerRef.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (values[clamped] !== selected) {
      onSelect(values[clamped]);
      if (navigator.vibrate) navigator.vibrate(8);
    }
  };

  return (
    <div className="relative w-full" style={{ height: ITEM_HEIGHT * 5 }}>
      <div
        className="pointer-events-none absolute inset-x-3 z-10"
        style={{
          top: ITEM_HEIGHT * 2,
          height: ITEM_HEIGHT,
          borderRadius: 10,
          backgroundColor: 'hsla(48, 96%, 53%, 0.15)',
          borderTop: '2px solid hsl(48, 96%, 53%)',
          borderBottom: '2px solid hsl(48, 96%, 53%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 z-10 top-0"
        style={{ height: ITEM_HEIGHT * 2, background: 'linear-gradient(to bottom, hsl(220, 14%, 96%) 40%, transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 z-10 bottom-0"
        style={{ height: ITEM_HEIGHT * 2, background: 'linear-gradient(to top, hsl(220, 14%, 96%) 40%, transparent)' }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: ITEM_HEIGHT * 2 }} />
        {values.map((v) => (
          <div
            key={v}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
            className={`flex items-center justify-center text-xl font-semibold transition-colors ${v === selected ? 'text-foreground' : 'text-muted-foreground/30'}`}
          >
            {formatLabel(v)}
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT * 2 }} />
      </div>
    </div>
  );
}

const DAYS = [
  { short: 'M', full: 'Monday', index: 1 },
  { short: 'T', full: 'Tuesday', index: 2 },
  { short: 'W', full: 'Wednesday', index: 3 },
  { short: 'T', full: 'Thursday', index: 4 },
  { short: 'F', full: 'Friday', index: 5 },
  { short: 'S', full: 'Saturday', index: 6 },
  { short: 'S', full: 'Sunday', index: 0 },
];

export default function HabitDetail() {
  const params = useParams();
  const templateId = parseInt(params.id as string);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();

  const searchParams = new URLSearchParams(window.location.search);
  const fromGoals = searchParams.get("from") === "goals";
  const presetDays = searchParams.get("days") ? parseInt(searchParams.get("days")!) : null;
  const presetGoalId = searchParams.get("goalId") ? parseInt(searchParams.get("goalId")!) : null;

  const [showPortionGuide, setShowPortionGuide] = useState(true);
  const [portionSize, setPortionSize] = useState("2 palms");
  const [numberOfMeals, setNumberOfMeals] = useState("With each meal");
  const [carbsPortion, setCarbsPortion] = useState("2 hand cups");
  const [proteinPortion, setProteinPortion] = useState("2 palms");
  const [fatPortion, setFatPortion] = useState("2 thumbs");
  const [veggiesPortion, setVeggiesPortion] = useState("2 fists");
  const [stepThousands, setStepThousands] = useState(10);
  const [stepIncrement, setStepIncrement] = useState(0);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [tempThousands, setTempThousands] = useState(10);
  const [tempIncrement, setTempIncrement] = useState(0);
  const [startDate, setStartDate] = useState(new Date());
  const [duration, setDuration] = useState(3);
  const [durationUnit, setDurationUnit] = useState<'weeks' | 'days'>(presetDays ? 'days' : 'weeks');
  const [durationDays, setDurationDays] = useState(presetDays ?? 21);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(presetGoalId);

  const { data: template, isLoading } = useQuery<HabitTemplate>({
    queryKey: [`/api/habit-templates/${templateId}`],
  });

  useEffect(() => {
    if (template?.title) {
      const defaults: Record<string, string> = {
        "Eat protein": "2 palms",
        "Eat good fats": "2 thumbs",
        "Eat complex carbs": "2 cupped hands",
        "Eat vegetables": "2 fists",
      };
      if (defaults[template.title]) {
        setPortionSize(defaults[template.title]);
      }
    }
  }, [template?.title]);

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
  });

  const createHabitMutation = useMutation({
    mutationFn: async (habitData: any) => {
      return await apiRequest('POST', '/api/habits', habitData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Habit added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      setLocation(fromGoals ? '/goals' : '/habits');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add habit",
        variant: "destructive",
      });
    },
  });

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== dayIndex);
      }
      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  };

  const getDaysOfWeekString = () => {
    if (selectedDays.length === 7) return 'Everyday';
    return selectedDays
      .map(idx => DAYS.find(d => d.index === idx)?.full)
      .filter(Boolean)
      .join(',');
  };

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleAddHabit = () => {
    if (!template?.title) {
      toast({
        title: "Error",
        description: "Template data is incomplete",
        variant: "destructive",
      });
      return;
    }

    const habitData = {
      templateId: template.id!,
      title: template.title!,
      description: template.description || "",
      category: template.category || "",
      icon: template.icon || "",
      startDate: startDate,
      duration: durationUnit === 'weeks' ? duration : Math.max(1, Math.round(durationDays / 7)),
      daysOfWeek: getDaysOfWeekString(),
      goalId: selectedGoalId,
      settings: template.title === "Hit Your Step Count" ? {
        stepTarget: stepThousands * 1000 + stepIncrement,
      } : template.hasPortionGuide ? (
        template.title === "Follow portion guides" ? {
          showPortionGuide,
          numberOfMeals,
          carbsPortion,
          proteinPortion,
          fatPortion,
          veggiesPortion,
        } : {
          showPortionGuide,
          numberOfMeals,
          portionSize,
        }
      ) : null,
    };

    createHabitMutation.mutate(habitData);
  };

  const weekDurationOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => ({
    label: `${w} ${w === 1 ? 'week' : 'weeks'}`,
    value: w.toString(),
  }));

  const dayDurationOptions = [7, 14, 21, 28, 30, 42, 45, 60, 90].map(d => ({
    label: `${d} days`,
    value: d.toString(),
  }));

  const durationOptions = durationUnit === 'weeks' ? weekDurationOptions : dayDurationOptions;

  const mealOptions = [
    { label: "With each meal", value: "With each meal" },
    { label: "1 meal", value: "1 meal" },
    { label: "2 meals", value: "2 meals" },
    { label: "3 meals", value: "3 meals" },
    { label: "4 meals", value: "4 meals" },
    { label: "5 meals", value: "5 meals" },
  ];

  const palmOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'palm' : 'palms'}`, value: `${n} ${n === 1 ? 'palm' : 'palms'}` }));
  const handCupOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'hand cup' : 'hand cups'}`, value: `${n} ${n === 1 ? 'hand cup' : 'hand cups'}` }));
  const thumbOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'thumb' : 'thumbs'}`, value: `${n} ${n === 1 ? 'thumb' : 'thumbs'}` }));
  const fistOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'fist' : 'fists'}`, value: `${n} ${n === 1 ? 'fist' : 'fists'}` }));
  const cuppedHandOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'cupped hand' : 'cupped hands'}`, value: `${n} ${n === 1 ? 'cupped hand' : 'cupped hands'}` }));

  return (
    <div className="min-h-screen bg-background pb-20 -mt-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center px-4 py-4">
          <button 
            onClick={() => setLocation(fromGoals ? '/goals' : '/habit-selection')}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">{template.title}</h1>
          <Button
            onClick={handleAddHabit}
            disabled={createHabitMutation.isPending}
            className="bg-primary text-primary-foreground font-semibold px-4 rounded-full hover:bg-primary/90"
            data-testid="button-add-habit"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {template.description && (
          <div className="space-y-3">
            {template.description.split('\n\n').map((para, i) => (
              <p key={i} className="text-muted-foreground">{para}</p>
            ))}
          </div>
        )}

        {template.title === "Hit Your Step Count" && (
          <div className="space-y-3 border-t border-border pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Step Target</h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-foreground">Step target</span>
              <button
                onClick={() => {
                  setTempThousands(stepThousands);
                  setTempIncrement(stepIncrement);
                  setShowStepPicker(true);
                }}
                className="text-[#0cc9a9] font-medium text-base"
              >
                {(stepThousands * 1000 + stepIncrement).toLocaleString()} steps
              </button>
            </div>
          </div>
        )}

        {showStepPicker && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowStepPicker(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative w-full bg-background rounded-t-2xl pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <button
                  onClick={() => setShowStepPicker(false)}
                  className="text-muted-foreground text-base"
                >
                  Cancel
                </button>
                <span className="font-semibold text-foreground text-base">Daily Step Target</span>
                <button
                  onClick={() => {
                    setStepThousands(tempThousands);
                    setStepIncrement(tempIncrement);
                    setShowStepPicker(false);
                  }}
                  className="text-primary font-semibold text-base"
                >
                  Apply
                </button>
              </div>

              <div className="px-5 pt-4 pb-2 text-center">
                <span className="text-4xl font-bold text-foreground">
                  {(tempThousands * 1000 + tempIncrement).toLocaleString()}
                </span>
                <span className="text-xl text-muted-foreground ml-2">steps</span>
              </div>

              <div className="flex mt-2">
                <div className="flex-1">
                  <StepDial
                    values={Array.from({ length: 51 }, (_, i) => i)}
                    selected={tempThousands}
                    onSelect={setTempThousands}
                    formatLabel={(v) => `${v},000`}
                  />
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1">
                  <StepDial
                    values={[0, 250, 500, 750]}
                    selected={tempIncrement}
                    onSelect={setTempIncrement}
                    formatLabel={(v) => v === 0 ? '+0' : `+${v}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {template.title === "Follow portion guides" && (
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-foreground">Number of meals</span>
            <BottomSheetPicker
              value={numberOfMeals}
              options={mealOptions}
              onValueChange={setNumberOfMeals}
            />
          </div>
        )}

        {template.hasPortionGuide && (
          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hand/Fist Portion Guides</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-foreground">Show Hand/Fist Portion Guide</span>
              <Switch
                checked={showPortionGuide}
                onCheckedChange={setShowPortionGuide}
                data-testid="switch-portion-guide"
              />
            </div>

            {showPortionGuide && (
              <>
                {template.title === "Follow portion guides" ? (
                  <>
                    <div className="flex items-center justify-between w-[90%] mx-auto py-2">
                      <img src={palmImage} alt="Palm portion" className="w-[22%] aspect-square object-contain" />
                      <img src={cuppedHandImage} alt="Cupped hand portion" className="w-[22%] aspect-square object-contain" />
                      <img src={thumbImage} alt="Thumb portion" className="w-[22%] aspect-square object-contain" />
                      <img src={fistImage} alt="Fist portion" className="w-[22%] aspect-square object-contain" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      While tracking this habit, a hand/fist portion guide is displayed for guidance.
                    </p>

                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-foreground">Protein</span>
                      <BottomSheetPicker value={proteinPortion} options={palmOptions} onValueChange={setProteinPortion} />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-foreground">Carbs</span>
                      <BottomSheetPicker value={carbsPortion} options={handCupOptions} onValueChange={setCarbsPortion} />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-foreground">Fat</span>
                      <BottomSheetPicker value={fatPortion} options={thumbOptions} onValueChange={setFatPortion} />
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-foreground">Veggies</span>
                      <BottomSheetPicker value={veggiesPortion} options={fistOptions} onValueChange={setVeggiesPortion} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-muted rounded-lg p-4 flex items-start gap-4">
                      <div className="flex-shrink-0">
                      {template.title === "Eat protein" && (
                        <img src={palmImage} alt="Palm portion" className="w-16 h-16 object-contain" />
                      )}
                      {template.title === "Eat good fats" && (
                        <img src={thumbImage} alt="Thumb portion" className="w-16 h-16 object-contain" />
                      )}
                      {template.title === "Eat complex carbs" && (
                        <img src={cuppedHandImage} alt="Cupped hand portion" className="w-16 h-16 object-contain" />
                      )}
                      {template.title === "Eat vegetables" && (
                        <img src={fistImage} alt="Fist portion" className="w-16 h-16 object-contain" />
                      )}
                      {!["Eat protein", "Eat good fats", "Eat complex carbs", "Eat vegetables"].includes(template.title || "") && (
                        <img src={palmImage} alt="Portion guide" className="w-16 h-16 object-contain" />
                      )}
                      </div>
                      <p className="text-sm text-muted-foreground max-w-[75%]">
                        While tracking this habit, a hand/fist portion guide is displayed for guidance.
                      </p>
                    </div>

                    {template.title === "Eat protein" && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-foreground">Protein</span>
                        <BottomSheetPicker value={portionSize} options={palmOptions} onValueChange={setPortionSize} />
                      </div>
                    )}

                    {template.title === "Eat good fats" && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-foreground">Good Fats</span>
                        <BottomSheetPicker value={portionSize} options={thumbOptions} onValueChange={setPortionSize} />
                      </div>
                    )}

                    {template.title === "Eat complex carbs" && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-foreground">Complex Carbs</span>
                        <BottomSheetPicker value={portionSize} options={cuppedHandOptions} onValueChange={setPortionSize} />
                      </div>
                    )}

                    {template.title === "Eat vegetables" && (
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-foreground">Vegetables</span>
                        <BottomSheetPicker value={portionSize} options={fistOptions} onValueChange={setPortionSize} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border">When to Practice</h3>
          
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-foreground">Start Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-[#0cc9a9] hover:text-[#0cc9a9] hover:bg-muted font-normal"
                  data-testid="button-select-start-date"
                >
                  {formatDate(startDate, 'short')}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="py-2 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Duration</span>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setDurationUnit('weeks')}
                    className={`px-2.5 py-1 transition-colors ${durationUnit === 'weeks' ? 'bg-primary text-primary-foreground font-medium' : 'bg-background text-muted-foreground'}`}
                  >
                    Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationUnit('days')}
                    className={`px-2.5 py-1 transition-colors ${durationUnit === 'days' ? 'bg-primary text-primary-foreground font-medium' : 'bg-background text-muted-foreground'}`}
                  >
                    Days
                  </button>
                </div>
                <BottomSheetPicker
                  value={durationUnit === 'weeks' ? duration.toString() : durationDays.toString()}
                  options={durationOptions}
                  onValueChange={(val) => {
                    if (durationUnit === 'weeks') setDuration(parseInt(val));
                    else setDurationDays(parseInt(val));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="py-3 border-b border-border">
            <span className="text-foreground">Days of the week</span>
            <div className="flex gap-2 mt-2">
              {DAYS.map((day, idx) => {
                const isSelected = selectedDays.includes(day.index);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(day.index)}
                    className={`flex-1 h-10 rounded-lg font-medium transition-colors flex items-center justify-center relative ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    data-testid={`day-${day.full.toLowerCase()}`}
                  >
                    {day.short}
                    {isSelected && (
                      <Check className="h-3 w-3 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDays.length === 7 ? 'Everyday' : `${selectedDays.length} days per week`}
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What Will This Help You Achieve?</h3>
          
          <Select value={selectedGoalId?.toString() || "none"} onValueChange={(val) => setSelectedGoalId(val === "none" ? null : parseInt(val))}>
            <SelectTrigger className="bg-card border-border" data-testid="select-goal">
              <SelectValue placeholder="Select a goal (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific goal</SelectItem>
              {goals.filter(g => !g.isCompleted && (!g.deadline || new Date(g.deadline) >= new Date())).map((goal) => (
                <SelectItem key={goal.id} value={goal.id.toString()}>
                  {goal.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
        </div>
      </div>
    </div>
  );
}
