import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { localDateStr, todayLocalStr } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { 
  Target, 
  CheckCircle2, 
  Plus,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingUp,
  Scale,
  X,
  Check,
  Utensils,
  Clock
} from "lucide-react";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Goal, GoalMilestone, Habit, HabitTemplate } from "@shared/schema";
import { format, addWeeks } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import TopHeader from "@/components/TopHeader";
import { COMPANION_HABITS } from "./goals-habit-detail";
import { calculateWeightLossPlan, type WeightLossPlan, type PacingOption } from "@shared/weightLossCalculator";

const SUGGESTED_CUSTOM_GOALS = [
  {
    id: "functional-strength",
    title: "Improve Functional Strength",
    description: "Strengthen the core movement patterns your body relies on every day so you feel more powerful, stable and resilient."
  },
  {
    id: "cardiovascular-fitness",
    title: "Improve Cardiovascular Fitness",
    description: "Increase aerobic capacity so you recover faster, handle stress better and feel more energised."
  },
  {
    id: "move-better",
    title: "Move Better With Less Pain",
    description: "Improve mobility, control and joint health so your body feels smoother, looser and more capable."
  },
  {
    id: "daily-movement",
    title: "Increase Daily Movement",
    description: "Add more steps and movement breaks to boost energy, improve health markers and support easier fat control."
  },
  {
    id: "sleep-quality",
    title: "Improve Sleep Quality",
    description: "Build consistent routines that help you fall asleep faster, stay asleep longer and wake up with more energy."
  },
  {
    id: "stable-energy",
    title: "Eat With Stable Energy",
    description: "Structure balanced meals that keep appetite, mood and blood sugar stable throughout the day."
  },
  {
    id: "protein-target",
    title: "Hit a Daily Protein Target",
    description: "Reach a sustainable protein intake to support muscle, recovery and body composition."
  },
  {
    id: "hydration",
    title: "Stay Hydrated Consistently",
    description: "Create hydration habits that support focus, performance and overall wellbeing."
  },
  {
    id: "reduce-stress",
    title: "Reduce Stress Levels",
    description: "Use breath work and recovery strategies to keep energy high and improve emotional resilience."
  },
  {
    id: "train-consistently",
    title: "Train Consistently",
    description: "Create a weekly training rhythm that builds momentum and removes the stop start cycle."
  },
  {
    id: "desk-health",
    title: "Improve Desk Health",
    description: "Enhance posture, alignment and movement habits to minimise tension and feel better throughout the workday."
  },
  {
    id: "mental-health",
    title: "Support Better Mental Health",
    description: "Develop habits that build clarity, emotional control and a calmer day to day experience."
  },
  {
    id: "healthier-lifestyle",
    title: "Build a Healthier Lifestyle",
    description: "Integrate essential habits around movement, training, nutrition, sleep and recovery for long term wellbeing."
  }
];

export default function Goals() {
  const [, setLocation] = useLocation();
  const { formatDate } = useFormattedDate();
  // Read tab and goalId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || "current";
  const focusGoalId = urlParams.get('goalId') ? Number(urlParams.get('goalId')) : null;
  const backDestination = urlParams.get('from') || "/perform";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [highlightedGoalId, setHighlightedGoalId] = useState<number | null>(focusGoalId);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [viewProgressGoal, setViewProgressGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [completingGoal, setCompletingGoal] = useState<Goal | null>(null);
  const [updatingProgressGoal, setUpdatingProgressGoal] = useState<Goal | null>(null);
  const [sliderProgress, setSliderProgress] = useState(0);
  const [pastYearFilter, setPastYearFilter] = useState<number | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  // Scroll to and highlight a specific goal when arriving from the dashboard.
  // useScrollRestoration resets scroll at 50ms and 150ms on navigation,
  // so we must fire after both those timers (300ms+ is safe).
  useEffect(() => {
    if (!focusGoalId || isLoading) return;

    const scrollTimer = setTimeout(() => {
      const el = document.querySelector(`[data-testid="card-goal-${focusGoalId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 350);

    const highlightTimer = setTimeout(() => setHighlightedGoalId(null), 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  }, [focusGoalId, isLoading]);

  // Categorize goals into current, past, and upcoming
  const categorizeGoals = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = goals.filter(goal => {
      const startDate = new Date(goal.startDate || goal.createdAt);
      startDate.setHours(0, 0, 0, 0);
      return startDate > today;
    });

    const past = goals.filter(goal => {
      const startDate = new Date(goal.startDate || goal.createdAt);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return false;
      
      if (goal.isCompleted) return true;
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline < today;
      }
      return false;
    });

    const current = goals.filter(goal => {
      const startDate = new Date(goal.startDate || goal.createdAt);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return false;
      
      if (goal.isCompleted) return false;
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        deadline.setHours(0, 0, 0, 0);
        if (deadline < today) return false;
      }
      return true;
    });

    return { current, past, upcoming };
  };

  const categorizedGoals = categorizeGoals();

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      return await apiRequest("DELETE", `/api/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setDeletingGoal(null);
    },
  });

  const completeGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      return await apiRequest("PATCH", `/api/goals/${goalId}`, { isCompleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setCompletingGoal(null);
      setActiveTab("past");
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: number; progress: number }) => {
      return await apiRequest("PATCH", `/api/goals/${goalId}`, { progress });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setUpdatingProgressGoal(null);
    },
  });

  // When opening the progress slider, initialize with current progress
  useEffect(() => {
    if (updatingProgressGoal) {
      setSliderProgress(updatingProgressGoal.progress || 0);
    }
  }, [updatingProgressGoal]);

  const calculateProgress = (goal: Goal) => {
    if (!goal.targetValue || goal.targetValue === 0) return 0;
    if (!goal.currentValue) return 0;
    
    const startingValue = (goal as any).startingValue || goal.currentValue;
    
    // Determine if this is a weight loss goal (target < starting) or weight gain goal (target > starting)
    if (goal.targetValue < startingValue) {
      // Weight loss goal: progress = how much weight has been lost relative to total needed
      const totalToLose = startingValue - goal.targetValue;
      const actuallyLost = startingValue - goal.currentValue;
      if (actuallyLost <= 0) return 0; // Haven't lost any weight yet
      return Math.min((actuallyLost / totalToLose) * 100, 100);
    } else {
      // Weight gain goal or other goals: progress = current / target
      return Math.min((goal.currentValue / goal.targetValue) * 100, 100);
    }
  };

  const isGoalComplete = (goal: Goal) => {
    if (!goal.targetValue || !goal.currentValue) return false;
    const startingValue = (goal as any).startingValue || goal.currentValue;
    
    // For weight loss goals, complete when current <= target
    if (goal.targetValue < startingValue) {
      return goal.currentValue <= goal.targetValue;
    }
    // For weight gain goals, complete when current >= target
    return goal.currentValue >= goal.targetValue;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Goals" onBack={() => setLocation(backDestination)} />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="current" data-testid="tab-current">
                Current
              </TabsTrigger>
              <TabsTrigger value="scheduled" data-testid="tab-scheduled">
                Scheduled
              </TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">
                Past
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Current Goals</h2>
                <Button 
                  onClick={() => setLocation("/goals/new")}
                  size="sm"
                  data-testid="button-add-goal"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Goal
                </Button>
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : categorizedGoals.current.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No current goals</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {categorizedGoals.current.map((goal) => (
                    <GoalCard 
                      key={goal.id} 
                      goal={goal}
                      calculateProgress={calculateProgress}
                      isGoalComplete={isGoalComplete}
                      setEditingGoal={setEditingGoal}
                      setViewProgressGoal={setViewProgressGoal}
                      setDeletingGoal={setDeletingGoal}
                      setCompletingGoal={setCompletingGoal}
                      setUpdatingProgressGoal={setUpdatingProgressGoal}
                      isHighlighted={goal.id === highlightedGoalId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Scheduled Goals</h2>
                <Button 
                  onClick={() => setLocation("/goals/new")}
                  size="sm"
                  data-testid="button-add-goal"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Goal
                </Button>
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : categorizedGoals.upcoming.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No scheduled goals</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {categorizedGoals.upcoming.map((goal) => (
                    <GoalCard 
                      key={goal.id} 
                      goal={goal}
                      calculateProgress={calculateProgress}
                      isGoalComplete={isGoalComplete}
                      setEditingGoal={setEditingGoal}
                      setViewProgressGoal={setViewProgressGoal}
                      setDeletingGoal={setDeletingGoal}
                      setCompletingGoal={setCompletingGoal}
                      setUpdatingProgressGoal={setUpdatingProgressGoal}
                      isHighlighted={goal.id === highlightedGoalId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {(() => {
                const pastGoals = categorizedGoals.past;
                const pastYears = Array.from(new Set(
                  pastGoals.flatMap(g => {
                    const dates = [g.deadline, g.startDate, (g as any).completedAt].filter(Boolean);
                    return dates.map(d => new Date(d!).getFullYear());
                  })
                )).sort((a, b) => b - a);

                const filteredPast = pastYearFilter
                  ? pastGoals.filter(g => {
                      const dates = [g.deadline, g.startDate, (g as any).completedAt].filter(Boolean);
                      return dates.some(d => new Date(d!).getFullYear() === pastYearFilter);
                    })
                  : pastGoals;

                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-bold text-foreground">Past Goals</h2>
                      {pastYears.length > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPastYearFilter(null)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              pastYearFilter === null
                                ? "bg-[#0cc9a9] text-black"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            All
                          </button>
                          {pastYears.map(year => (
                            <button
                              key={year}
                              onClick={() => setPastYearFilter(year)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                pastYearFilter === year
                                  ? "bg-[#0cc9a9] text-black"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isLoading ? (
                      <>
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </>
                    ) : filteredPast.length === 0 ? (
                      <Card className="p-8 text-center border border-border">
                        <p className="text-muted-foreground text-base">
                          {pastGoals.length === 0 ? "No past goals yet" : `No goals from ${pastYearFilter}`}
                        </p>
                        {pastGoals.length === 0 && (
                          <p className="text-muted-foreground/60 text-sm mt-1">Completed or expired goals will appear here</p>
                        )}
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {filteredPast.map((goal) => (
                          <PastGoalCard
                            key={goal.id}
                            goal={goal}
                            calculateProgress={calculateProgress}
                            setDeletingGoal={setDeletingGoal}
                            isHighlighted={goal.id === highlightedGoalId}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Goal Dialog */}
      <AddGoalDialogInline 
        open={!!editingGoal} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingGoal(null);
          }
        }}
        editingGoal={editingGoal || undefined}
      />

      <AlertDialog open={!!deletingGoal} onOpenChange={(open) => !open && setDeletingGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGoal?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-goal">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGoal && deleteGoalMutation.mutate(deletingGoal.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-goal"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Goal Confirmation Dialog */}
      <AlertDialog open={!!completingGoal} onOpenChange={(open) => !open && setCompletingGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark "{completingGoal?.title}" as complete? This will move it to your past goals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-complete-goal">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completingGoal && completeGoalMutation.mutate(completingGoal.id)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-complete-goal"
            >
              {completeGoalMutation.isPending ? "Completing..." : "Complete Goal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Goal Progress Dialog */}
      {viewProgressGoal && (
        <Dialog open={!!viewProgressGoal} onOpenChange={(open) => !open && setViewProgressGoal(null)}>
          <DialogContent data-testid="dialog-goal-progress">
            <DialogHeader>
              <DialogTitle>{viewProgressGoal.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Progress</span>
                  <span className="font-semibold">{viewProgressGoal.currentValue} {viewProgressGoal.unit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold">{viewProgressGoal.targetValue} {viewProgressGoal.unit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{Math.round(calculateProgress(viewProgressGoal))}%</span>
                </div>
                <div className="flex h-3 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: `${Math.min(calculateProgress(viewProgressGoal), 100)}%` }}></div></div>
                {viewProgressGoal.deadline && (
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className="font-semibold">{formatDate(new Date(viewProgressGoal.deadline), "short")}</span>
                  </div>
                )}
                {viewProgressGoal.description && (
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground block mb-1">Description</span>
                    <p className="text-sm">{viewProgressGoal.description}</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Progress Update Slider Panel */}
      {updatingProgressGoal && (
        <div className="fixed inset-0 z-50" data-testid="panel-update-progress">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setUpdatingProgressGoal(null)}
          />
          
          {/* Bottom Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-6 pb-24 rounded-t-2xl">
            {/* Cancel and Update buttons */}
            <div className="flex justify-between items-center mb-6">
              <button 
                onClick={() => setUpdatingProgressGoal(null)}
                className="text-[#0cc9a9] font-medium"
                data-testid="button-cancel-progress"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (updatingProgressGoal) {
                    updateProgressMutation.mutate({ 
                      goalId: updatingProgressGoal.id, 
                      progress: sliderProgress 
                    });
                  }
                }}
                className="text-[#0cc9a9] font-medium"
                disabled={updateProgressMutation.isPending}
                data-testid="button-update-progress"
              >
                {updateProgressMutation.isPending ? "Updating..." : "Update"}
              </button>
            </div>
            
            {/* Goal title and percentage */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-foreground font-medium">{updatingProgressGoal.title}</span>
              <span className="text-muted-foreground">{sliderProgress}%</span>
            </div>
            
            {/* Slider */}
            <Slider
              value={[sliderProgress]}
              onValueChange={(values) => setSliderProgress(values[0])}
              max={100}
              min={0}
              step={1}
              className="w-full"
              data-testid="slider-progress"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PastGoalCard({ goal, calculateProgress, setDeletingGoal, isHighlighted }: { goal: Goal; calculateProgress: (goal: Goal) => number; setDeletingGoal: (goal: Goal) => void; isHighlighted?: boolean }) {
  const { formatDate } = useFormattedDate();

  const calories = goal.nutritionCalories || 0;
  const proteinGrams = goal.proteinGrams || Math.round((calories * (goal.proteinPercent || 0) / 100) / 4);
  const carbsGrams = goal.carbsGrams || Math.round((calories * (goal.carbPercent || 0) / 100) / 4);
  const fatGrams = goal.fatGrams || Math.round((calories * (goal.fatPercent || 0) / 100) / 9);

  const startingValue = (goal as any).startingValue || goal.currentValue || 0;

  const titleText = goal.type === 'nutrition'
    ? `${calories} kcal / day`
    : goal.title;

  return (
    <Card className={`p-4 bg-white dark:bg-card transition-all duration-300 ${isHighlighted ? "ring-2 ring-[#0cc9a9] shadow-lg" : ""}`} data-testid={`card-goal-${goal.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="font-semibold text-sm truncate">{titleText}</span>
          <Badge className="bg-green-100 text-green-800 text-xs shrink-0">Complete</Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDeletingGoal(goal)} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dates row */}
      {(goal.startDate || goal.deadline) && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {goal.startDate && <span>{formatDate(new Date(goal.startDate), "short")}</span>}
          {goal.startDate && goal.deadline && <span>→</span>}
          {goal.deadline && <span>{formatDate(new Date(goal.deadline), "short")}</span>}
        </div>
      )}

      {/* Goal-type specific compact info */}
      {goal.type === 'bodyweight' && (
        <div className="flex gap-2 mt-3">
          <div className="flex-1 text-center p-1.5 bg-muted/30 rounded text-xs">
            <span className="text-muted-foreground block">Start</span>
            <span className="font-semibold">{startingValue}{goal.unit}</span>
          </div>
          <div className="flex-1 text-center p-1.5 bg-muted/30 rounded text-xs">
            <span className="text-muted-foreground block">Final</span>
            <span className="font-semibold">{goal.currentValue}{goal.unit}</span>
          </div>
          <div className="flex-1 text-center p-1.5 bg-muted/30 rounded text-xs">
            <span className="text-muted-foreground block">Target</span>
            <span className="font-semibold">{goal.targetValue}{goal.unit}</span>
          </div>
        </div>
      )}

      {goal.type === 'nutrition' && (
        <div className="flex gap-3 mt-3 text-xs">
          <div className="flex-1 text-center p-1.5 bg-green-500/10 rounded">
            <span className="text-muted-foreground block">Protein</span>
            <span className="font-semibold text-green-600">{proteinGrams}g</span>
          </div>
          <div className="flex-1 text-center p-1.5 bg-blue-500/10 rounded">
            <span className="text-muted-foreground block">Carbs</span>
            <span className="font-semibold text-blue-600">{carbsGrams}g</span>
          </div>
          <div className="flex-1 text-center p-1.5 bg-orange-500/10 rounded">
            <span className="text-muted-foreground block">Fat</span>
            <span className="font-semibold text-orange-600">{fatGrams}g</span>
          </div>
        </div>
      )}

      {(goal.type === 'custom' || goal.type === 'template') && (
        <div className="mt-3 flex items-center gap-2">
          <Progress value={calculateProgress(goal)} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">{Math.round(calculateProgress(goal))}%</span>
        </div>
      )}
    </Card>
  );
}

interface GoalCardProps {
  goal: Goal;
  calculateProgress: (goal: Goal) => number;
  isGoalComplete: (goal: Goal) => boolean;
  setEditingGoal: (goal: Goal) => void;
  setViewProgressGoal: (goal: Goal) => void;
  setDeletingGoal: (goal: Goal) => void;
  setCompletingGoal: (goal: Goal) => void;
  setUpdatingProgressGoal: (goal: Goal) => void;
  isHighlighted?: boolean;
}

const HABIT_LINKED_TEMPLATES = ["30-day-alcohol-free", "30-day-stretch", "consistent-wake-time-30-days", "walk-450k-steps"];
const AUTO_TRACKED_TEMPLATES = ["36-workouts-90-days", "30-day-checkin-streak", "track-meals-4-weeks", "protein-30-days", "all-habits-14-days"];

function GoalCard({ goal, calculateProgress, isGoalComplete, setEditingGoal, setViewProgressGoal, setDeletingGoal, setCompletingGoal, setUpdatingProgressGoal, isHighlighted }: GoalCardProps) {
  const { formatDate } = useFormattedDate();
  const [, setLocation] = useLocation();
  const { data: milestones = [] } = useQuery<GoalMilestone[]>({
    queryKey: [`/api/goals/${goal.id}/milestones`],
    enabled: !!goal.id && goal.type !== 'custom',
  });

  const isTemplateGoal = !!(goal as any).templateId;
  const templateId = (goal as any).templateId as string | undefined;
  const isAutoTracked = templateId ? AUTO_TRACKED_TEMPLATES.includes(templateId) : false;
  const isCumulativeSteps = templateId === 'walk-450k-steps' && (goal as any).trackingMode === 'cumulative';
  const isHabitLinked = templateId ? HABIT_LINKED_TEMPLATES.includes(templateId) && !isCumulativeSteps : false;

  const companionHabitName = templateId ? COMPANION_HABITS[templateId] : undefined;
  const { data: userHabits = [] } = useQuery<Habit[]>({
    queryKey: ["/api/habits"],
    enabled: isHabitLinked,
  });
  const { data: habitTemplates = [] } = useQuery<HabitTemplate[]>({
    queryKey: ["/api/habit-templates"],
    enabled: isHabitLinked && !!companionHabitName,
  });
  const alreadyHasCompanion = companionHabitName
    ? userHabits.some(h => h.title.toLowerCase() === companionHabitName.toLowerCase())
    : true;
  const companionTemplate = companionHabitName
    ? habitTemplates.find(t => t.title.toLowerCase() === companionHabitName.toLowerCase())
    : undefined;

  const { data: templateProgress } = useQuery<{ current: number; target: number; label: string; percentage: number } | null>({
    queryKey: ["/api/goals", goal.id, "progress"],
    queryFn: () => fetch(`/api/goals/${goal.id}/progress`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    enabled: isTemplateGoal && !goal.isCompleted,
    refetchInterval: 60000,
  });

  const isCustomGoal = goal.type === 'custom';

  return (
    <Card className={`p-4 transition-all duration-300 ${isHighlighted ? "ring-2 ring-[#0cc9a9] shadow-lg" : ""}`} data-testid={`card-goal-${goal.id}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-start space-x-2 flex-1">
          {isGoalComplete(goal) ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          ) : goal.type === 'nutrition' ? (
            <Utensils className="h-5 w-5 text-primary mt-0.5" />
          ) : (
            <Target className="h-5 w-5 text-primary mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold" data-testid={`text-goal-title-${goal.id}`}>
              {goal.type === 'nutrition' 
                ? `Eat ${goal.nutritionCalories} Calories per day, with the following macro split`
                : goal.title}
            </h3>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isGoalComplete(goal) && (
            <Badge className="bg-green-100 text-green-800" data-testid={`badge-complete-${goal.id}`}>
              Complete
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid={`button-menu-goal-${goal.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Only show Edit Goal for non-completed goals */}
              {!isGoalComplete(goal) && (
                <>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (goal.type === 'nutrition') {
                        window.location.href = `/goals/nutrition/edit/${goal.id}`;
                      } else if (goal.type === 'bodyweight') {
                        window.location.href = `/goals/bodyweight/edit/${goal.id}`;
                      } else {
                        window.location.href = `/goals/custom/edit/${goal.id}`;
                      }
                    }} 
                    data-testid={`menu-edit-goal-${goal.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Goal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={() => setDeletingGoal(goal)} 
                className="text-red-600"
                data-testid={`menu-delete-goal-${goal.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Goal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3">
        {isCustomGoal ? (
          <>
            {/* Dates */}
            {(goal.startDate || goal.deadline) && (
              <div className="flex items-center gap-3 text-xs mb-2 ml-7">
                {goal.startDate && (
                  <span className="px-2.5 py-1 rounded-md bg-[#1a1f24] border border-border text-muted-foreground">
                    Start {formatDate(new Date(goal.startDate), "short")}
                  </span>
                )}
                {goal.deadline && (
                  <span className="px-2.5 py-1 rounded-md bg-[#1a1f24] border border-border text-muted-foreground">
                    Due {formatDate(new Date(goal.deadline), "short")}
                  </span>
                )}
              </div>
            )}
            
            {/* Template goal — live auto-tracked progress */}
            {isTemplateGoal && templateProgress ? (
              <div className="space-y-2 ml-7 mr-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    {templateProgress.label === "steps"
                      ? `${templateProgress.current.toLocaleString()} / ${templateProgress.target.toLocaleString()}`
                      : `${templateProgress.current} / ${templateProgress.target}`}
                    <span className="text-muted-foreground font-normal ml-1">{templateProgress.label}</span>
                  </span>
                  <span className="text-muted-foreground">{Math.round(templateProgress.percentage)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0cc9a9] transition-all"
                    style={{ width: `${templateProgress.percentage}%` }}
                  />
                </div>
              </div>
            ) : isTemplateGoal && !templateProgress ? (
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden ml-7">
                <div className="h-full bg-[#0cc9a9]" style={{ width: "0%" }} />
              </div>
            ) : (
              /* Non-template custom goal — manual slider */
              <div
                className={`ml-7 ${!goal.isCompleted ? 'cursor-pointer hover:bg-muted/30 py-2 rounded-lg transition-colors' : ''}`}
                onClick={() => !goal.isCompleted && setUpdatingProgressGoal(goal)}
                data-testid={`button-update-progress-${goal.id}`}
              >
                <div className="flex justify-end mb-1">
                  <span className="text-sm text-muted-foreground">{goal.progress || 0} %</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-[#0cc9a9] transition-all" style={{ width: `${goal.progress || 0}%` }} />
                </div>
                <div className="text-center mt-1">
                  <span className="text-sm text-muted-foreground">{goal.progress || 0}%</span>
                </div>
              </div>
            )}

            {/* Link Habit CTA / tracking status for habit-linked template goals */}
            {isHabitLinked && !goal.isCompleted && (
              alreadyHasCompanion ? (
                <div className="flex items-center gap-2 mt-1 pr-3 py-2 bg-muted/50 rounded-lg ml-7">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Tracked via <span className="font-medium text-foreground">"{companionHabitName}"</span> habit
                  </span>
                </div>
              ) : companionTemplate ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 border-[#0cc9a9] text-[#0cc9a9] hover:bg-[#0cc9a9]/10 ml-7"
                  onClick={() => setLocation(`/habit-detail/${companionTemplate.id}`)}
                >
                  Link "{companionHabitName}" habit to start tracking
                </Button>
              ) : null
            )}
          </>
        ) : goal.type === 'nutrition' ? (
          (() => {
            const calories = goal.nutritionCalories || 0;
            const proteinGrams = goal.proteinGrams || Math.round((calories * (goal.proteinPercent || 0) / 100) / 4);
            const carbsGrams = goal.carbsGrams || Math.round((calories * (goal.carbPercent || 0) / 100) / 4);
            const fatGrams = goal.fatGrams || Math.round((calories * (goal.fatPercent || 0) / 100) / 9);
            return (
              <>
                {/* Nutrition goal display - single horizontal bar with macro split */}
                <div className="space-y-2">
                  {/* Combined macro bar */}
                  <div className="h-4 w-full rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#0cc9a9] transition-all" 
                      style={{ width: `${goal.proteinPercent}%` }}
                    />
                    <div 
                      className="h-full bg-blue-500 transition-all" 
                      style={{ width: `${goal.carbPercent}%` }}
                    />
                    <div 
                      className="h-full bg-orange-500 transition-all" 
                      style={{ width: `${goal.fatPercent}%` }}
                    />
                  </div>

                  {/* Macro breakdown text - 3 columns aligned with bar segments */}
                  <div className="flex text-sm">
                    <div className="text-center" style={{ width: `${goal.proteinPercent}%` }}>
                      <div>
                        <span className="text-green-500 font-semibold">{goal.proteinPercent}%</span>
                        <span className="text-muted-foreground ml-1">{proteinGrams}g</span>
                      </div>
                      <div className="text-muted-foreground text-xs">Protein Goal</div>
                    </div>
                    <div className="text-center" style={{ width: `${goal.carbPercent}%` }}>
                      <div>
                        <span className="text-blue-500 font-semibold">{goal.carbPercent}%</span>
                        <span className="text-muted-foreground ml-1">{carbsGrams}g</span>
                      </div>
                      <div className="text-muted-foreground text-xs">Carbs Goal</div>
                    </div>
                    <div className="text-center" style={{ width: `${goal.fatPercent}%` }}>
                      <div>
                        <span className="text-orange-500 font-semibold">{goal.fatPercent}%</span>
                        <span className="text-muted-foreground ml-1">{fatGrams}g</span>
                      </div>
                      <div className="text-muted-foreground text-xs">Fat Goal</div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()
        ) : goal.type === 'bodyweight' ? (
          <>
            {/* Bodyweight goal display */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground block text-xs">Start</span>
                <span className="font-semibold">{(goal as any).startingValue || goal.currentValue}{goal.unit}</span>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground block text-xs">Current</span>
                <span className="font-semibold">{goal.currentValue}{goal.unit}</span>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground block text-xs">Target</span>
                <span className="font-semibold">{goal.targetValue}{goal.unit}</span>
              </div>
            </div>
            {(() => {
              const startingValue = (goal as any).startingValue || goal.currentValue || 0;
              const currentValue = goal.currentValue || 0;
              const targetValue = goal.targetValue || 0;
              const isWeightLoss = targetValue < startingValue;
              const weightChange = isWeightLoss 
                ? startingValue - currentValue 
                : currentValue - startingValue;
              const totalNeeded = isWeightLoss 
                ? startingValue - targetValue 
                : targetValue - startingValue;
              return (
                <div className="text-center text-sm p-2 bg-green-500/10 rounded border border-green-500/30">
                  <span className="text-green-600 font-semibold">
                    {weightChange > 0 ? (isWeightLoss ? `${weightChange.toFixed(1)}${goal.unit} lost` : `${weightChange.toFixed(1)}${goal.unit} gained`) : 'No change yet'}
                  </span>
                  <span className="text-muted-foreground text-xs ml-2">
                    ({totalNeeded > 0 ? `${(totalNeeded - Math.abs(weightChange)).toFixed(1)}${goal.unit} to go` : 'Goal reached!'})
                  </span>
                </div>
              );
            })()}
            <Progress 
              value={calculateProgress(goal)} 
              className="h-2"
              data-testid={`progress-goal-${goal.id}`}
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {Math.round(calculateProgress(goal))}% complete
              </span>
              {goal.deadline && (
                <span className="text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Due {formatDate(new Date(goal.deadline), "short")}
                </span>
              )}
            </div>

            {/* Milestones */}
            {milestones.length > 0 && (
              <div className="pt-2 space-y-2 border-t border-border mt-3">
                <span className="text-xs font-semibold text-muted-foreground block">Milestones</span>
                {milestones.map((milestone, index) => {
                  const dueDate = typeof milestone.dueDate === 'string' 
                    ? new Date(milestone.dueDate) 
                    : milestone.dueDate;
                  return (
                    <div key={milestone.id} className="text-sm p-2 bg-muted/30 rounded flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {index + 1}/{milestones.length}
                      </span>
                      <span className="text-foreground font-medium flex-1">{milestone.targetValue}{milestone.unit} by {format(dueDate, "dd/MM/yyyy")}</span>
                      <Checkbox
                        checked={milestone.completed || false}
                        disabled
                        className="h-5 w-5 border-border data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 pointer-events-none"
                        data-testid={`checkbox-milestone-${milestone.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Other goal types */}
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold" data-testid={`text-goal-progress-${goal.id}`}>
                {goal.currentValue} / {goal.targetValue} {goal.unit}
              </span>
            </div>
            <Progress 
              value={calculateProgress(goal)} 
              className="h-2"
              data-testid={`progress-goal-${goal.id}`}
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {Math.round(calculateProgress(goal))}% complete
              </span>
              {goal.deadline && (
                <span className="text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Due {formatDate(new Date(goal.deadline), "short")}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

const MACRO_PRESETS = {
  balanced: { protein: 30, carbs: 40, fat: 30, label: "Balanced", description: "30% protein, 40% carbs, 30% fat" },
  high_protein: { protein: 40, carbs: 30, fat: 30, label: "High Protein", description: "40% protein, 30% carbs, 30% fat" },
  low_carb: { protein: 35, carbs: 20, fat: 45, label: "Low Carb", description: "35% protein, 20% carbs, 45% fat" },
  low_fat: { protein: 35, carbs: 50, fat: 15, label: "Low Fat", description: "35% protein, 50% carbs, 15% fat" },
  custom: { protein: 33, carbs: 34, fat: 33, label: "Custom", description: "Set your own macro split" },
};

function AddGoalDialogInline({ 
  open, 
  onOpenChange, 
  editingGoal 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  editingGoal?: Goal;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [goalType, setGoalType] = useState<"bodyweight" | "custom">("bodyweight");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("kg");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<Array<{targetValue: string; dueDate: string; unit: string}>>([]);
  const [milestoneTarget, setMilestoneTarget] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneUnit, setMilestoneUnit] = useState("kg");
  const [selectedPace, setSelectedPace] = useState<"aggressive" | "moderate" | "lifestyleFriendly" | "ownPace" | null>(null);
  const [suggestedMilestones, setSuggestedMilestones] = useState<Array<{targetValue: string; dueDate: string; unit: string}>>([]);
  const [milestonesAccepted, setMilestonesAccepted] = useState<boolean | null>(null); // null = pending, true = accepted, false = declined
  const [editingMilestoneIdx, setEditingMilestoneIdx] = useState<number | null>(null);
  const [editMilestoneTarget, setEditMilestoneTarget] = useState("");
  const [editMilestoneDate, setEditMilestoneDate] = useState("");

  // Nutrition goal state
  const [nutritionStep, setNutritionStep] = useState(1); // 1 = calories, 2 = macro split, 3 = protein guidance
  const [nutritionCalories, setNutritionCalories] = useState("");
  const [macroPreset, setMacroPreset] = useState<keyof typeof MACRO_PRESETS>("balanced");
  const [proteinPercent, setProteinPercent] = useState(30);
  const [carbPercent, setCarbPercent] = useState(40);
  const [fatPercent, setFatPercent] = useState(30);
  
  // TDEE calculator state
  const [showTDEE, setShowTDEE] = useState(false);
  const [tdeeAge, setTdeeAge] = useState("");
  const [tdeeWeight, setTdeeWeight] = useState("");
  const [tdeeHeight, setTdeeHeight] = useState("");
  const [tdeeSex, setTdeeSex] = useState<"male" | "female">("male");
  const [tdeeActivity, setTdeeActivity] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  const [tdeeGoal, setTdeeGoal] = useState<"maintain" | "lose" | "gain">("maintain");

  // Helper function to generate milestones based on timeline
  const generateMilestones = (weeks: number, startWeight: number, targetWeight: number, selectedUnit: string) => {
    // Calculate number of milestones:
    // - Less than 8 weeks: 2 milestones
    // - 8-16 weeks: 3-4 milestones (every 3-4 weeks)
    // - 16-32 weeks: 4-8 milestones (every 4 weeks / monthly)
    // - 32+ weeks: 1 per month
    let numMilestones: number;
    if (weeks < 8) {
      numMilestones = 2;
    } else if (weeks <= 16) {
      numMilestones = Math.max(3, Math.ceil(weeks / 4));
    } else if (weeks <= 32) {
      numMilestones = Math.ceil(weeks / 4); // roughly monthly
    } else {
      numMilestones = Math.ceil(weeks / 4.33); // roughly monthly for longer periods
    }
    
    // Cap at 12 milestones max
    numMilestones = Math.min(numMilestones, 12);
    
    const weightToLose = startWeight - targetWeight;
    const weightPerMilestone = weightToLose / (numMilestones + 1); // +1 because final target is the goal itself
    const weeksPerMilestone = weeks / (numMilestones + 1);
    
    const newMilestones: Array<{targetValue: string; dueDate: string; unit: string}> = [];
    
    for (let i = 1; i <= numMilestones; i++) {
      const milestoneWeight = startWeight - (weightPerMilestone * i);
      const milestoneWeeks = Math.round(weeksPerMilestone * i);
      const milestoneDate = addWeeks(new Date(), milestoneWeeks);
      
      newMilestones.push({
        targetValue: milestoneWeight.toFixed(1),
        dueDate: format(milestoneDate, "yyyy-MM-dd"),
        unit: selectedUnit
      });
    }
    
    return newMilestones;
  };

  // Fetch latest bodyweight entry to pre-fill current weight
  const { data: latestBodyweight } = useQuery<{ weight: number; unit: string } | null>({
    queryKey: ["/api/progress/bodyweight/latest"],
    enabled: open && !editingGoal, // Only fetch when creating new goal
  });

  // Calculate weight loss plan when both weights are entered
  const weightLossPlan = (() => {
    const start = parseFloat(currentValue);
    const target = parseFloat(targetValue);
    if (!start || !target || start <= target) return null; // Only for weight loss
    return calculateWeightLossPlan(start, target);
  })();

  const { data: existingMilestones } = useQuery<GoalMilestone[]>({
    queryKey: ["/api/goals", editingGoal?.id, "milestones"],
    enabled: !!editingGoal?.id,
  });

  useEffect(() => {
    if (!open) return;
    
    if (editingGoal) {
      setGoalType((editingGoal.type as "bodyweight" | "custom" | "nutrition") || "bodyweight");
      setTitle(editingGoal.title || "");
      setDescription(editingGoal.description || "");
      setTargetValue(editingGoal.targetValue?.toString() || "");
      setCurrentValue(editingGoal.currentValue?.toString() || "");
      setUnit(editingGoal.unit || "kg");
      setStartDate(editingGoal.startDate ? localDateStr(new Date(editingGoal.startDate)) : "");
      setDeadline(editingGoal.deadline ? localDateStr(new Date(editingGoal.deadline)) : "");
      setMilestones([]);
      // Nutrition goal fields
      if (editingGoal.type === "nutrition") {
        setNutritionCalories((editingGoal as any).nutritionCalories?.toString() || "");
        setMacroPreset(((editingGoal as any).macroPreset as keyof typeof MACRO_PRESETS) || "balanced");
        setProteinPercent((editingGoal as any).proteinPercent || 30);
        setCarbPercent((editingGoal as any).carbPercent || 40);
        setFatPercent((editingGoal as any).fatPercent || 30);
      }
    } else {
      setGoalType("bodyweight");
      setTitle("");
      setDescription("");
      setTargetValue("");
      // Pre-fill current weight from latest bodyweight log if available
      if (latestBodyweight) {
        setCurrentValue(latestBodyweight.weight.toString());
        setUnit(latestBodyweight.unit || "kg");
      } else {
        setCurrentValue("");
        setUnit("kg");
      }
      // Set start date to today
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setDeadline("");
      setMilestones([]);
      setSelectedPace(null);
      setSuggestedMilestones([]);
      setMilestonesAccepted(null);
      setEditingMilestoneIdx(null);
      // Reset nutrition fields
      setNutritionStep(1);
      setNutritionCalories("");
      setMacroPreset("balanced");
      setProteinPercent(30);
      setCarbPercent(40);
      setFatPercent(30);
      setShowTDEE(false);
      setTdeeAge("");
      setTdeeWeight("");
      setTdeeHeight("");
      setTdeeSex("male");
      setTdeeActivity("moderate");
      setTdeeGoal("maintain");
    }
    setMilestoneTarget("");
    setMilestoneDate("");
    setMilestoneUnit("kg");
  }, [open, editingGoal?.id, latestBodyweight]);

  useEffect(() => {
    if (!open || !editingGoal || !existingMilestones || existingMilestones.length === 0) return;
    
    setMilestones(existingMilestones.map(m => {
      let dateStr = "";
      try {
        const d = new Date(m.dueDate);
        if (!isNaN(d.getTime())) {
          dateStr = localDateStr(d);
        }
      } catch {
        dateStr = "";
      }
      return {
        targetValue: m.targetValue?.toString() || "",
        dueDate: dateStr,
        unit: m.unit || "kg"
      };
    }).filter(m => m.dueDate));
  }, [existingMilestones]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingGoal) {
        return await apiRequest("PATCH", `/api/goals/${editingGoal.id}`, payload);
      }
      return await apiRequest("POST", "/api/goals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: editingGoal ? "Goal updated" : "Goal created",
        description: editingGoal ? "Your goal has been updated successfully" : "Your goal has been created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || (editingGoal ? "Failed to update goal" : "Failed to create goal"),
        variant: "destructive",
      });
    },
  });

  const handleAddMilestone = () => {
    if (milestoneTarget && milestoneDate) {
      setMilestones(prev => [...prev, { 
        targetValue: milestoneTarget, 
        dueDate: milestoneDate, 
        unit: milestoneUnit 
      }]);
      setMilestoneTarget("");
      setMilestoneDate("");
    }
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const payload: any = {
      type: goalType,
      title: goalType === "bodyweight" 
        ? `Reach ${targetValue}${unit}` 
        : title,
      description: description || null,
      startDate: startDate || null,
      deadline: deadline || null,
      milestones: milestones.map(m => ({
        targetValue: m.targetValue,
        dueDate: m.dueDate,
        unit: m.unit,
      })),
    };

    if (goalType === "bodyweight") {
      payload.targetValue = parseFloat(targetValue) || null;
      payload.currentValue = parseFloat(currentValue) || null;
      payload.unit = unit;
      if (!editingGoal) {
        payload.startingValue = parseFloat(currentValue) || null;
      }
    }

    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{editingGoal ? "Edit Goal" : "Add New Goal"}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] px-4">
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGoalType("bodyweight")}
                  className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition-all ${
                    goalType === "bodyweight"
                      ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  data-testid="button-goal-type-bodyweight"
                >
                  <Scale className="h-5 w-5" />
                  <span className="text-xs font-medium">Bodyweight</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/goals/nutrition/new");
                  }}
                  className="p-3 border rounded-lg flex flex-col items-center gap-1.5 transition-all border-border hover:border-muted-foreground"
                  data-testid="button-goal-type-nutrition"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-xs font-medium">Nutrition</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGoalType("custom")}
                  className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition-all ${
                    goalType === "custom"
                      ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  data-testid="button-goal-type-custom"
                >
                  <Target className="h-5 w-5" />
                  <span className="text-xs font-medium">Custom Goal</span>
                </button>
              </div>
            </div>

            {goalType === "bodyweight" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Current Weight</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      placeholder="80"
                      data-testid="input-current-weight"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger data-testid="select-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Target Weight</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="75"
                    data-testid="input-target-weight"
                  />
                </div>

                {/* Weight Loss Pacing Options */}
                {weightLossPlan && !editingGoal && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Choose Your Pace</Label>
                      <span className="text-xs text-muted-foreground">{weightLossPlan.totalToLose}{unit} to lose</span>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Aggressive */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPace("aggressive");
                          const weeks = Math.round(weightLossPlan.aggressive.weeksMidEstimate);
                          setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                          const start = parseFloat(currentValue);
                          const target = parseFloat(targetValue);
                          const generated = generateMilestones(weeks, start, target, unit);
                          setSuggestedMilestones(generated);
                          setMilestonesAccepted(null);
                          setMilestones([]);
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all ${
                          selectedPace === "aggressive"
                            ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        data-testid="pace-aggressive"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Aggressive</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Fast</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Weekly: {weightLossPlan.aggressive.weeklyMinKg}-{weightLossPlan.aggressive.weeklyMaxKg}{unit}</div>
                          <div>Monthly: ~{weightLossPlan.aggressive.monthlyMidKg}{unit}</div>
                          <div className="text-[#0cc9a9] font-medium">
                            Timeline: {weightLossPlan.aggressive.weeksMidEstimate} weeks ({weightLossPlan.aggressive.monthsMidEstimate} months)
                          </div>
                        </div>
                      </button>

                      {/* Moderate */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPace("moderate");
                          const weeks = Math.round(weightLossPlan.moderate.weeksMidEstimate);
                          setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                          const start = parseFloat(currentValue);
                          const target = parseFloat(targetValue);
                          const generated = generateMilestones(weeks, start, target, unit);
                          setSuggestedMilestones(generated);
                          setMilestonesAccepted(null);
                          setMilestones([]);
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all ${
                          selectedPace === "moderate"
                            ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        data-testid="pace-moderate"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Moderate</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-[#0cc9a9]/20 text-[#0cc9a9]">Balanced</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Weekly: {weightLossPlan.moderate.weeklyMinKg}-{weightLossPlan.moderate.weeklyMaxKg}{unit}</div>
                          <div>Monthly: ~{weightLossPlan.moderate.monthlyMidKg}{unit}</div>
                          <div className="text-[#0cc9a9] font-medium">
                            Timeline: {weightLossPlan.moderate.weeksMidEstimate} weeks ({weightLossPlan.moderate.monthsMidEstimate} months)
                          </div>
                        </div>
                      </button>

                      {/* Lifestyle Friendly */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPace("lifestyleFriendly");
                          const weeks = Math.round(weightLossPlan.lifestyleFriendly.weeksMidEstimate);
                          setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                          const start = parseFloat(currentValue);
                          const target = parseFloat(targetValue);
                          const generated = generateMilestones(weeks, start, target, unit);
                          setSuggestedMilestones(generated);
                          setMilestonesAccepted(null);
                          setMilestones([]);
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all ${
                          selectedPace === "lifestyleFriendly"
                            ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        data-testid="pace-lifestyle"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Lifestyle Friendly</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Sustainable</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Weekly: {weightLossPlan.lifestyleFriendly.weeklyMinKg}-{weightLossPlan.lifestyleFriendly.weeklyMaxKg}{unit}</div>
                          <div>Monthly: ~{weightLossPlan.lifestyleFriendly.monthlyMidKg}{unit}</div>
                          <div className="text-[#0cc9a9] font-medium">
                            Timeline: {weightLossPlan.lifestyleFriendly.weeksMidEstimate} weeks ({weightLossPlan.lifestyleFriendly.monthsMidEstimate} months)
                          </div>
                        </div>
                      </button>

                      {/* Own Pace */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPace("ownPace");
                          setDeadline(""); // Clear deadline so user can set their own
                          setMilestones([]); // Clear milestones so user can set their own
                          setSuggestedMilestones([]);
                          setMilestonesAccepted(null);
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all ${
                          selectedPace === "ownPace"
                            ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        data-testid="pace-own"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Go At Your Own Pace</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Flexible</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Set your own timeline without suggested targets
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Choose a Goal</Label>
                  <Select
                    value={SUGGESTED_CUSTOM_GOALS.find(g => g.title === title)?.id || "custom"}
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setTitle("");
                        setDescription("");
                      } else {
                        const goal = SUGGESTED_CUSTOM_GOALS.find(g => g.id === value);
                        if (goal) {
                          setTitle(goal.title);
                          setDescription(goal.description);
                        }
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-suggested-goal">
                      <SelectValue placeholder="Select a goal..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="custom">Write my own goal</SelectItem>
                      {SUGGESTED_CUSTOM_GOALS.map((goal) => (
                        <SelectItem key={goal.id} value={goal.id}>
                          {goal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Goal Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Run a marathon"
                    data-testid="input-goal-title"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about your goal..."
                rows={2}
                data-testid="textarea-description"
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '120px' }}>
                  <Label className="text-sm">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', marginTop: '6px' }}
                    data-testid="input-start-date"
                  />
                </div>
                <div style={{ width: '120px', marginLeft: '40px' }}>
                  <Label className="text-sm">Deadline</Label>
                  <Input
                    type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{ width: '100%', marginTop: '6px' }}
                  data-testid="input-deadline"
                />
              </div>
            </div>

            {/* Suggested Milestones Prompt */}
            {suggestedMilestones.length > 0 && milestonesAccepted === null && (
              <div className="space-y-3 pt-3 border-t border-[#0cc9a9]/30 bg-[#0cc9a9]/5 -mx-4 px-4 py-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-[#0cc9a9]">Suggested Milestones</Label>
                  <span className="text-xs text-muted-foreground">{suggestedMilestones.length} checkpoints</span>
                </div>
                
                <div className="space-y-1.5">
                  {suggestedMilestones.map((m, idx) => {
                    let displayDate = m.dueDate;
                    try {
                      const d = new Date(m.dueDate);
                      if (!isNaN(d.getTime())) {
                        displayDate = formatDate(d, "short");
                      }
                    } catch {
                      displayDate = m.dueDate;
                    }
                    
                    // Editing mode for this milestone
                    if (editingMilestoneIdx === idx) {
                      return (
                        <div key={idx} className="p-2 bg-muted/50 rounded space-y-2" data-testid={`suggested-milestone-edit-${idx}`}>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={editMilestoneTarget}
                              onChange={(e) => setEditMilestoneTarget(e.target.value)}
                              className="h-8 text-sm"
                              data-testid={`input-edit-milestone-target-${idx}`}
                            />
                            <Input
                              type="date"
                              value={editMilestoneDate}
                              onChange={(e) => setEditMilestoneDate(e.target.value)}
                              className="h-8 text-sm"
                              data-testid={`input-edit-milestone-date-${idx}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => {
                                const updated = [...suggestedMilestones];
                                updated[idx] = {
                                  ...updated[idx],
                                  targetValue: editMilestoneTarget,
                                  dueDate: editMilestoneDate
                                };
                                setSuggestedMilestones(updated);
                                setEditingMilestoneIdx(null);
                              }}
                              data-testid={`button-save-milestone-${idx}`}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs"
                              onClick={() => setEditingMilestoneIdx(null)}
                              data-testid={`button-cancel-edit-${idx}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                        data-testid={`suggested-milestone-${idx}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="bg-[#0cc9a9] text-black px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {idx + 1}
                          </span>
                          <span>{m.targetValue}{m.unit} by {displayDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-white"
                            onClick={() => {
                              setEditingMilestoneIdx(idx);
                              setEditMilestoneTarget(m.targetValue);
                              setEditMilestoneDate(m.dueDate);
                            }}
                            data-testid={`button-edit-milestone-${idx}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => {
                              const updated = suggestedMilestones.filter((_, i) => i !== idx);
                              setSuggestedMilestones(updated);
                              if (updated.length === 0) {
                                setMilestonesAccepted(false);
                              }
                            }}
                            data-testid={`button-remove-suggested-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                    onClick={() => {
                      setMilestones(suggestedMilestones);
                      setMilestonesAccepted(true);
                    }}
                    data-testid="button-accept-milestones"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept Milestones
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setMilestonesAccepted(false);
                      setSuggestedMilestones([]);
                    }}
                    data-testid="button-decline-milestones"
                  >
                    <X className="h-4 w-4 mr-1" />
                    No Thanks
                  </Button>
                </div>
              </div>
            )}

            {/* Milestones section - only for bodyweight goals */}
            {goalType === "bodyweight" && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Milestones (Optional)</Label>
                
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Target (e.g., 85)"
                      value={milestoneTarget}
                      onChange={(e) => setMilestoneTarget(e.target.value)}
                      data-testid="input-milestone-target"
                    />
                    <Select value={milestoneUnit} onValueChange={setMilestoneUnit}>
                      <SelectTrigger data-testid="select-milestone-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="lbs">lbs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="date"
                    value={milestoneDate}
                    onChange={(e) => setMilestoneDate(e.target.value)}
                    data-testid="input-milestone-date"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddMilestone}
                    disabled={!milestoneTarget || !milestoneDate}
                    className="w-full"
                    data-testid="button-add-milestone"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Milestone
                  </Button>
                </div>

                {milestones.length > 0 && (
                  <div className="space-y-1.5">
                    {milestones.map((m, idx) => {
                      let displayDate = m.dueDate;
                      try {
                        const d = new Date(m.dueDate);
                        if (!isNaN(d.getTime())) {
                          displayDate = formatDate(d, "short");
                        }
                      } catch {
                        displayDate = m.dueDate;
                      }
                      return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                        data-testid={`milestone-${idx}`}
                      >
                        <span>{m.targetValue} {m.unit} by {displayDate}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => handleRemoveMilestone(idx)}
                          data-testid={`button-remove-milestone-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!showTDEE && (
          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-submit-goal">
              {mutation.isPending ? "Saving..." : (editingGoal ? "Save Changes" : "Create Goal")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
