import { useState, useEffect } from "react";
import { localDateStr } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Apple, Moon, Brain, Droplet, ShieldCheck, Plus } from "lucide-react";
import type { Habit } from "@shared/schema";

interface AddHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingHabit?: Habit;
}

const PRESET_HABITS = [
  { title: "Morning Workout", icon: "dumbbell", category: "exercise", frequency: "daily" },
  { title: "Drink 8 Glasses of Water", icon: "droplet", category: "health", frequency: "daily" },
  { title: "Eat Protein at Breakfast", icon: "apple", category: "nutrition", frequency: "daily" },
  { title: "7+ Hours Sleep", icon: "moon", category: "sleep", frequency: "daily" },
  { title: "10-Minute Meditation", icon: "brain", category: "mindfulness", frequency: "daily" },
  { title: "Evening Stretch", icon: "dumbbell", category: "exercise", frequency: "daily" },
  {
    title: "Avoided Alcohol",
    icon: "shieldCheck",
    category: "health",
    frequency: "daily",
    description: "Choose to go alcohol-free today. Each day you avoid alcohol your sleep, recovery, and cognitive performance all benefit directly.",
  },
];

const ICON_MAP: Record<string, any> = {
  dumbbell: Dumbbell,
  apple: Apple,
  moon: Moon,
  brain: Brain,
  droplet: Droplet,
  shieldCheck: ShieldCheck,
};

export default function AddHabitDialog({ open, onOpenChange, editingHabit }: AddHabitDialogProps) {
  const [habitMode, setHabitMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [duration, setDuration] = useState(3);
  const [startDate, setStartDate] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    if (editingHabit) {
      setHabitMode("custom");
      setTitle(editingHabit.title || "");
      setDescription(editingHabit.description || "");
      setCategory(editingHabit.category || "");
      setFrequency(editingHabit.frequency || "daily");
      setDuration(editingHabit.duration || 3);
      setStartDate(editingHabit.startDate ? new Date(editingHabit.startDate) : new Date());
    } else {
      resetForm();
    }
  }, [editingHabit]);

  const createHabitMutation = useMutation({
    mutationFn: async (habitData: any) => {
      if (editingHabit) {
        return await apiRequest("PATCH", `/api/habits/${editingHabit.id}`, habitData);
      }
      return await apiRequest("POST", "/api/habits", habitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      toast({
        title: editingHabit ? "Habit updated" : "Habit created",
        description: editingHabit ? "Your habit has been updated successfully" : "Your habit has been added successfully",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: editingHabit ? "Failed to update habit" : "Failed to create habit",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setHabitMode("preset");
    setSelectedPreset(null);
    setTitle("");
    setDescription("");
    setCategory("");
    setFrequency("daily");
    setDuration(3);
    setStartDate(new Date());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let habitData;
    
    if (habitMode === "preset" && selectedPreset !== null) {
      const preset = PRESET_HABITS[selectedPreset];
      habitData = {
        title: preset.title,
        description: (preset as any).description || "",
        category: preset.category,
        frequency: preset.frequency,
        icon: preset.icon,
        isCustom: false,
      };
    } else {
      habitData = {
        title,
        description,
        category,
        frequency,
        duration,
        startDate: localDateStr(startDate),
        isCustom: true,
      };
    }

    createHabitMutation.mutate(habitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingHabit ? "Edit Habit" : "Add New Habit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Habit Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHabitMode("preset")}
                className={`p-4 border rounded-lg transition-colors ${
                  habitMode === "preset"
                    ? "border-primary bg-primary/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid="button-mode-preset"
              >
                <Dumbbell className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Preset</div>
              </button>
              <button
                type="button"
                onClick={() => setHabitMode("custom")}
                className={`p-4 border rounded-lg transition-colors ${
                  habitMode === "custom"
                    ? "border-primary bg-primary/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid="button-mode-custom"
              >
                <Plus className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Custom</div>
              </button>
            </div>
          </div>

          {habitMode === "preset" ? (
            <div className="space-y-2">
              <Label>Select a Habit</Label>
              <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                {PRESET_HABITS.map((habit, index) => {
                  const Icon = ICON_MAP[habit.icon];
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedPreset(index)}
                      className={`p-3 border rounded-lg text-left transition-colors flex items-center space-x-3 ${
                        selectedPreset === index
                          ? "border-primary bg-primary/10"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      data-testid={`button-preset-${index}`}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium">{habit.title}</div>
                        <div className="text-xs text-gray-500">
                          {habit.category} • {habit.frequency}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Habit Name</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Read for 30 minutes"
                  required
                  data-testid="input-habit-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about your habit..."
                  rows={2}
                  data-testid="input-habit-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exercise">Exercise</SelectItem>
                      <SelectItem value="nutrition">Nutrition</SelectItem>
                      <SelectItem value="sleep">Sleep</SelectItem>
                      <SelectItem value="mindfulness">Mindfulness</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger id="frequency" data-testid="select-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="3">3x/week</SelectItem>
                      <SelectItem value="5">5x/week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (weeks)</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger id="duration" data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 week</SelectItem>
                    <SelectItem value="2">2 weeks</SelectItem>
                    <SelectItem value="3">3 weeks</SelectItem>
                    <SelectItem value="4">4 weeks</SelectItem>
                    <SelectItem value="6">6 weeks</SelectItem>
                    <SelectItem value="8">8 weeks</SelectItem>
                    <SelectItem value="12">12 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createHabitMutation.isPending ||
                (habitMode === "preset" && selectedPreset === null && !editingHabit) ||
                (habitMode === "custom" && !title)
              }
              data-testid="button-create-habit"
            >
              {createHabitMutation.isPending 
                ? (editingHabit ? "Updating..." : "Creating...") 
                : (editingHabit ? "Update Habit" : "Create Habit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
