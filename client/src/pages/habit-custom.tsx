import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Check, Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { Goal, UserHabitLibraryEntry } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BottomSheetPicker } from "@/components/ui/bottom-sheet-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

const DAYS = [
  { short: 'M', full: 'Monday', index: 1 },
  { short: 'T', full: 'Tuesday', index: 2 },
  { short: 'W', full: 'Wednesday', index: 3 },
  { short: 'T', full: 'Thursday', index: 4 },
  { short: 'F', full: 'Friday', index: 5 },
  { short: 'S', full: 'Saturday', index: 6 },
  { short: 'S', full: 'Sunday', index: 0 },
];

const CATEGORIES = [
  { value: 'exercise', label: 'Exercise' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'mindfulness', label: 'Mindfulness' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

export default function HabitCustom() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const { hasUnsavedChanges, markDirty, markClean, handleNavigation, UnsavedChangesDialog } = useUnsavedChanges();

  const libraryId = new URLSearchParams(search).get('libraryId');
  const mode = new URLSearchParams(search).get('mode');
  const isEditMode = mode === 'edit';

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [startDate, setStartDate] = useState(new Date());
  const [duration, setDuration] = useState(3);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['/api/goals'],
  });

  const { data: libraryEntry } = useQuery<UserHabitLibraryEntry>({
    queryKey: ['/api/user-habit-library', libraryId],
    queryFn: async () => {
      const res = await fetch(`/api/user-habit-library`);
      const all: UserHabitLibraryEntry[] = await res.json();
      return all.find(e => e.id === parseInt(libraryId!))!;
    },
    enabled: !!libraryId,
  });

  useEffect(() => {
    if (libraryEntry) {
      setTitle(libraryEntry.title);
      setDescription(libraryEntry.description || "");
      if (libraryEntry.category) setCategory(libraryEntry.category);
    }
  }, [libraryEntry]);

  const saveToLibraryMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; category: string }) => {
      return await apiRequest('POST', '/api/user-habit-library', data);
    },
  });

  const updateLibraryEntryMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; category: string }) => {
      return await apiRequest('PUT', `/api/user-habit-library/${libraryId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-habit-library'] });
      markClean();
      toast({ title: "Saved", description: "Habit updated successfully" });
      setLocation('/habit-selection');
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update habit", variant: "destructive" });
    },
  });

  // Default values for comparison
  const defaultDays = [0, 1, 2, 3, 4, 5, 6];
  const defaultDuration = 3;
  const defaultCategory = 'other';
  const [initialStartDate] = useState(() => new Date());
  
  // Track form changes - detect any field changes from default values
  const startDateChanged = startDate.toDateString() !== initialStartDate.toDateString();
  const hasFormChanges = title.trim() !== '' || 
    description.trim() !== '' || 
    category !== defaultCategory ||
    selectedGoalId !== null ||
    duration !== defaultDuration ||
    startDateChanged ||
    JSON.stringify([...selectedDays].sort()) !== JSON.stringify(defaultDays);
  
  useEffect(() => {
    // In library read-only mode, never show the unsaved changes dialog
    if (libraryId && !isEditMode) {
      markClean();
      return;
    }
    if (hasFormChanges) {
      markDirty();
    } else {
      markClean();
    }
  }, [hasFormChanges, markDirty, markClean, libraryId, isEditMode]);

  const createHabitMutation = useMutation({
    mutationFn: async (habitData: any) => {
      const habit = await apiRequest('POST', '/api/habits', habitData);
      if (!libraryId) {
        saveToLibraryMutation.mutate({
          title: habitData.title,
          description: habitData.description || "",
          category: habitData.category,
        });
      }
      return habit;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setCategory("other");
      setStartDate(new Date());
      setDuration(3);
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setSelectedGoalId(null);
      markClean();
      toast({
        title: "Success",
        description: "Custom habit created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-habit-library'] });
      setLocation('/habits');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create habit",
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

  const handleAddHabit = () => {
    if (isEditMode) {
      if (!title.trim()) {
        toast({ title: "Error", description: "Please enter a habit name", variant: "destructive" });
        return;
      }
      updateLibraryEntryMutation.mutate({ title: title.trim(), description: description.trim(), category });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a habit name",
        variant: "destructive",
      });
      return;
    }

    const habitData = {
      title: title.trim(),
      description: description.trim(),
      category,
      icon: "📝",
      startDate,
      duration,
      daysOfWeek: getDaysOfWeekString(),
      goalId: selectedGoalId,
      isCustom: true,
    };

    createHabitMutation.mutate(habitData);
  };

  const canAdd = !!libraryId || title.trim().length > 0;

  return (
    <div className="min-h-screen bg-background pb-20 -mt-16">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center px-4 py-4">
          <button 
            onClick={() => handleNavigation('/habit-selection')}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">
            {isEditMode ? "Edit Habit" : libraryId && libraryEntry ? libraryEntry.title : "Custom Habit"}
          </h1>
          <Button
            onClick={handleAddHabit}
            disabled={!canAdd || createHabitMutation.isPending || updateLibraryEntryMutation.isPending}
            className="bg-primary text-primary-foreground font-semibold px-4 rounded-full hover:bg-primary/90"
            data-testid="button-add-habit"
          >
            {isEditMode ? "Save" : "Add"}
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Library read-only view: show description as text */}
        {libraryId && !isEditMode ? (
          description && (
            <div className="space-y-3">
              {description.split('\n\n').map((para, i) => (
                <p key={i} className="text-muted-foreground">{para}</p>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Habit Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Habit Name</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter habit name..."
                className="bg-card border-border"
                data-testid="input-habit-title"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Description (Optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="bg-card border-border"
                data-testid="input-habit-description"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-card border-border" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* When to Practice + Goal sections — hidden in edit mode */}
        {!isEditMode && (
          <>
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border">When to Practice</h3>

              {/* Start Date */}
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

              {/* Duration */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground">Duration</span>
                <BottomSheetPicker
                  value={duration.toString()}
                  options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => ({ label: `${w} ${w === 1 ? 'week' : 'weeks'}`, value: w.toString() }))}
                  onValueChange={(val) => setDuration(parseInt(val))}
                />
              </div>

              {/* Days of the Week */}
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

            {/* What Will This Help You Achieve? */}
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

              {selectedGoalId && (
                <div className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
                  <div className="text-primary text-sm">ℹ️</div>
                  <p className="text-sm text-foreground">
                    This habit will support your goal: <strong>{goals.find(g => g.id === selectedGoalId)?.title}</strong>
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <UnsavedChangesDialog />
    </div>
  );
}
