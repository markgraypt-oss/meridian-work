import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { Goal, Habit } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BottomSheetPicker } from "@/components/ui/bottom-sheet-picker";

const DAYS = [
  { short: 'M', full: 'Monday', index: 1 },
  { short: 'T', full: 'Tuesday', index: 2 },
  { short: 'W', full: 'Wednesday', index: 3 },
  { short: 'T', full: 'Thursday', index: 4 },
  { short: 'F', full: 'Friday', index: 5 },
  { short: 'S', full: 'Saturday', index: 6 },
  { short: 'S', full: 'Sunday', index: 0 },
];


export default function HabitEdit() {
  const params = useParams();
  const habitId = parseInt(params.id as string);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [duration, setDuration] = useState(3);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [portionSize, setPortionSize] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const { data: habit, isLoading: habitLoading } = useQuery<Habit>({
    queryKey: ['/api/habits', habitId],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch habit');
      return res.json();
    },
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
  });

  useEffect(() => {
    if (habit && !isLoaded) {
      setTitle(habit.title || "");
      setDescription(habit.description || "");
      setStartDate(habit.startDate ? new Date(habit.startDate) : new Date());
      setDuration(habit.duration || 3);
      setSelectedGoalId(habit.goalId || null);
      
      const settings = habit.settings as any;
      if (settings?.portionSize) {
        setPortionSize(settings.portionSize);
      } else {
        const defaults: Record<string, string> = {
          "Eat protein": "2 palms",
          "Eat good fats": "2 thumbs",
          "Eat complex carbs": "2 cupped hands",
          "Eat vegetables": "2 fists",
        };
        if (defaults[habit.title]) setPortionSize(defaults[habit.title]);
      }

      if (habit.daysOfWeek) {
        if (habit.daysOfWeek === 'Everyday') {
          setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
        } else {
          const dayNames = habit.daysOfWeek.split(',');
          const dayIndices = dayNames.map(name => {
            const day = DAYS.find(d => d.full === name.trim());
            return day ? day.index : -1;
          }).filter(i => i !== -1);
          setSelectedDays(dayIndices.length > 0 ? dayIndices : [0, 1, 2, 3, 4, 5, 6]);
        }
      }
      setIsLoaded(true);
    }
  }, [habit, isLoaded]);

  const updateHabitMutation = useMutation({
    mutationFn: async (habitData: any) => {
      return await apiRequest('PATCH', `/api/habits/${habitId}`, habitData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Habit updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
      setLocation('/habits');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update habit",
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

  const PORTION_HABITS = ["Eat protein", "Eat good fats", "Eat complex carbs", "Eat vegetables"];
  const isPortionHabit = PORTION_HABITS.includes(title);

  const handleUpdateHabit = () => {
    const existingSettings = (habit?.settings as any) || {};
    const habitData: any = {
      duration,
      daysOfWeek: getDaysOfWeekString(),
      goalId: selectedGoalId,
    };

    if (isPortionHabit && portionSize) {
      habitData.settings = { ...existingSettings, portionSize };
    }

    updateHabitMutation.mutate(habitData);
  };

  if (habitLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const durationOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => ({
    label: `${w} ${w === 1 ? 'week' : 'weeks'}`,
    value: w.toString(),
  }));

  const palmOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'palm' : 'palms'}`, value: `${n} ${n === 1 ? 'palm' : 'palms'}` }));
  const thumbOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'thumb' : 'thumbs'}`, value: `${n} ${n === 1 ? 'thumb' : 'thumbs'}` }));
  const cuppedHandOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'cupped hand' : 'cupped hands'}`, value: `${n} ${n === 1 ? 'cupped hand' : 'cupped hands'}` }));
  const fistOptions = [1, 2, 3, 4].map(n => ({ label: `${n} ${n === 1 ? 'fist' : 'fists'}`, value: `${n} ${n === 1 ? 'fist' : 'fists'}` }));

  return (
    <div className="min-h-screen bg-background pb-20 -mt-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center px-4 py-4">
          <button 
            onClick={() => setLocation('/habits')}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">{habit?.title || 'Edit Habit'}</h1>
          <Button
            onClick={handleUpdateHabit}
            disabled={updateHabitMutation.isPending}
            variant="ghost"
            className="bg-primary text-primary-foreground font-semibold px-4 rounded-full hover:bg-primary/90"
            data-testid="button-update-habit"
          >
            Update
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Habit Name</label>
          <div className="bg-card border border-border rounded-md px-3 py-2 text-foreground">
            {title}
          </div>
        </div>

        {description && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <div className="bg-card border border-border rounded-md px-3 py-2 text-muted-foreground">
              {description}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border">When to Practice</h3>
          
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-foreground">Start Date</span>
            <span className="text-muted-foreground">
              {formatDate(startDate, 'short')}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-foreground">Duration</span>
            <BottomSheetPicker
              value={duration.toString()}
              options={durationOptions}
              onValueChange={(val) => setDuration(parseInt(val))}
            />
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

        {isPortionHabit && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border">Portion Guide</h3>

            {title === "Eat protein" && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground">Protein</span>
                <BottomSheetPicker value={portionSize} options={palmOptions} onValueChange={setPortionSize} />
              </div>
            )}

            {title === "Eat good fats" && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground">Good Fats</span>
                <BottomSheetPicker value={portionSize} options={thumbOptions} onValueChange={setPortionSize} />
              </div>
            )}

            {title === "Eat complex carbs" && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground">Complex Carbs</span>
                <BottomSheetPicker value={portionSize} options={cuppedHandOptions} onValueChange={setPortionSize} />
              </div>
            )}

            {title === "Eat vegetables" && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground">Vegetables</span>
                <BottomSheetPicker value={portionSize} options={fistOptions} onValueChange={setPortionSize} />
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link to Goal (Optional)</h3>
          <Select value={selectedGoalId?.toString() || "none"} onValueChange={(val) => setSelectedGoalId(val === "none" ? null : parseInt(val))}>
            <SelectTrigger className="bg-card border-border" data-testid="select-goal">
              <SelectValue placeholder="Select a goal" />
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
