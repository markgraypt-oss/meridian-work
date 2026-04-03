import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TopHeader from "@/components/TopHeader";
import WeekCalendarStrip from "@/components/WeekCalendarStrip";
import DailyCheckInDialog from "@/components/daily-check-in/DailyCheckInDialog";
import ViewCheckInCard from "@/components/daily-check-in/ViewCheckInCard";
import DashboardLearnCard from "@/components/DashboardLearnCard";
import DashboardHydrationCard from "@/components/DashboardHydrationCard";
import PathSelectionDialog from "@/components/PathSelectionDialog";
import MyProgressSection from "@/components/dashboard/MyProgressSection";
import CalendarPopup from "@/components/CalendarPopup";
import { format, isSameDay } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { 
  Circle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Calendar,
  Heart,
  Check,
  RefreshCw,
  Dumbbell,
  BarChart3,
  ChevronRight,
  X,
  Sparkles,
  ArrowRight,
  Activity
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Habit, Goal, CheckIn, UserPathAssignment, ReassessmentReminder } from "@shared/schema";

// Helper function to determine workout category tag based on workout name
function getWorkoutCategoryTag(workoutName: string): { label: string; bgColor: string } | null {
  const name = workoutName.toLowerCase();
  
  if (name.includes('corrective') || name.includes('correction')) {
    return { label: 'Corrective', bgColor: 'bg-orange-500' };
  }
  if (name.includes('yoga')) {
    return { label: 'Yoga', bgColor: 'bg-purple-500' };
  }
  if (name.includes('stretch') || name.includes('mobility')) {
    return { label: 'Stretching & Mobility', bgColor: 'bg-teal-500' };
  }
  
  return null;
}

interface NutritionData {
  goal: {
    calorieTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Circular progress component for nutrition metrics
function CircularProgress({ value, max, size = 56, strokeWidth = 4, color = "#0cc9a9" }: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
    </svg>
  );
}

// Nutrition goal card matching the reference design
function NutritionGoalCard({ goal, nutritionData }: {
  goal: Goal;
  nutritionData: NutritionData | undefined;
}) {
  const targets = {
    calories: goal.nutritionCalories || nutritionData?.goal?.calorieTarget || 2000,
    protein: goal.proteinGrams || nutritionData?.goal?.proteinTarget || 150,
    carbs: goal.carbsGrams || nutritionData?.goal?.carbsTarget || 200,
    fat: goal.fatGrams || nutritionData?.goal?.fatTarget || 65,
  };
  
  const rawCurrent = nutritionData?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const current = {
    calories: Math.round(rawCurrent.calories),
    protein: Math.round(rawCurrent.protein),
    carbs: Math.round(rawCurrent.carbs),
    fat: Math.round(rawCurrent.fat),
  };

  return (
    <Card 
      className="p-4"
      data-testid={`card-goal-${goal.id}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-foreground">Daily nutrition goal</span>
      </div>
      
      {/* Macro circles - larger, evenly spaced */}
      <div className="flex justify-around">
        {/* Calories */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <CircularProgress 
              value={current.calories} 
              max={targets.calories} 
              size={82} 
              strokeWidth={5}
              color="#0cc9a9"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-foreground">{current.calories}</span>
              <span className="text-[10px] text-muted-foreground">Calories</span>
            </div>
          </div>
          <span className="text-xs text-black font-medium -mt-1 px-2 py-0.5 rounded-full bg-[#0cc9a9] relative z-10">{targets.calories} Cal</span>
        </div>
        
        {/* Protein */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <CircularProgress 
              value={current.protein} 
              max={targets.protein} 
              size={82} 
              strokeWidth={5}
              color="#0cc9a9"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-foreground">{current.protein}g</span>
              <span className="text-[10px] text-muted-foreground">Protein</span>
            </div>
          </div>
          <span className="text-xs text-black font-medium -mt-1 px-2 py-0.5 rounded-full bg-[#0cc9a9] relative z-10">{targets.protein}g</span>
        </div>
        
        {/* Carbs */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <CircularProgress 
              value={current.carbs} 
              max={targets.carbs} 
              size={82} 
              strokeWidth={5}
              color="#0cc9a9"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-foreground">{current.carbs}g</span>
              <span className="text-[10px] text-muted-foreground">Carbs</span>
            </div>
          </div>
          <span className="text-xs text-black font-medium -mt-1 px-2 py-0.5 rounded-full bg-[#0cc9a9] relative z-10">{targets.carbs}g</span>
        </div>
        
        {/* Fat */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <CircularProgress 
              value={current.fat} 
              max={targets.fat} 
              size={82} 
              strokeWidth={5}
              color="#0cc9a9"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-foreground">{current.fat}g</span>
              <span className="text-[10px] text-muted-foreground">Fat</span>
            </div>
          </div>
          <span className="text-xs text-black font-medium -mt-1 px-2 py-0.5 rounded-full bg-[#0cc9a9] relative z-10">{targets.fat}g</span>
        </div>
      </div>
    </Card>
  );
}

function DashboardGoalCard({ goal, navigate, formatDate }: { goal: Goal; navigate: (path: string) => void; formatDate: (d: Date, fmt: string) => string }) {
  const isTemplateGoal = !!(goal as any).templateId;

  const { data: templateProgress } = useQuery<{ current: number; target: number; label: string; percentage: number } | null>({
    queryKey: ["/api/goals", goal.id, "progress"],
    queryFn: () => fetch(`/api/goals/${goal.id}/progress`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    enabled: isTemplateGoal && !goal.isCompleted,
    refetchInterval: 30000,
  });

  const isCustomGoal = goal.type === 'custom';
  const isCompletedBodyweightGoal = goal.isCompleted && goal.type === 'bodyweight';
  const targetTab = goal.isCompleted ? 'past' : 'current';

  let progressPercent = 0;
  let remainingText = "";

  if (isCompletedBodyweightGoal) {
    progressPercent = 100;
    remainingText = `${goal.currentValue}${goal.unit || 'kg'} - Goal Achieved!`;
  } else if (isTemplateGoal && templateProgress) {
    progressPercent = templateProgress.percentage;
  } else if (isCustomGoal) {
    progressPercent = goal.progress || 0;
  } else if (goal.currentValue && goal.targetValue) {
    const startingValue = (goal as any).startingValue || goal.currentValue;
    if (goal.targetValue < startingValue) {
      const totalToLose = startingValue - goal.targetValue;
      const actuallyLost = startingValue - goal.currentValue;
      progressPercent = actuallyLost > 0 ? Math.min((actuallyLost / totalToLose) * 100, 100) : 0;
    } else {
      progressPercent = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
    }
    const remaining = Math.abs(goal.currentValue - goal.targetValue);
    remainingText = `${goal.currentValue}${goal.unit || 'kg'} → ${goal.targetValue}${goal.unit || 'kg'} (${remaining.toFixed(1)}${goal.unit || 'kg'} remaining)`;
  }

  return (
    <Card
      className="p-4 hover:bg-foreground/5 transition-colors cursor-pointer"
      data-testid={`card-goal-${goal.id}`}
      onClick={() => navigate(`/goals?tab=${targetTab}&goalId=${goal.id}&from=/`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate" data-testid={`text-goal-title-${goal.id}`}>
            {goal.title}
          </h4>
        </div>
      </div>

      {/* Template goal — live progress */}
      {isTemplateGoal && templateProgress && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {templateProgress.current} / {templateProgress.target} {templateProgress.label}
            </span>
            <span className="font-semibold text-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-[#0cc9a9] h-full transition-all duration-300" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
          </div>
        </div>
      )}

      {/* Non-template custom goal — manual progress */}
      {isCustomGoal && !isTemplateGoal && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-[#0cc9a9] h-full transition-all duration-300" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
          </div>
        </div>
      )}

      {/* Bodyweight goal progress */}
      {!isCustomGoal && remainingText && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={isCompletedBodyweightGoal ? "text-green-500 font-medium" : "text-muted-foreground"}>{remainingText}</span>
            <span className={`font-semibold ${isCompletedBodyweightGoal ? "text-green-500" : "text-foreground"}`}>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className={"bg-[#0cc9a9] h-full transition-all duration-300"} style={{ width: `${Math.min(progressPercent, 100)}%` }} />
          </div>
        </div>
      )}

      {goal.deadline && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center">
          <Calendar className="h-3 w-3 mr-1" />
          Due {formatDate(new Date(goal.deadline), "short")}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const { formatDate } = useFormattedDate();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      window.history.replaceState({}, '', '/');
      return new Date(dateParam);
    }
    return new Date();
  });
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showPathSelection, setShowPathSelection] = useState(false);
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);


  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
    enabled: isAuthenticated,
  });

  const { data: habits = [], isLoading: habitsLoading } = useQuery<(Habit & { completedOnDate?: boolean })[]>({
    queryKey: ["/api/habits", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/habits?date=${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayCheckIn } = useQuery<CheckIn | null>({
    queryKey: ["/api/check-ins/date", todayDateStr],
    queryFn: async () => {
      const response = await fetch(`/api/check-ins/date/${todayDateStr}`, { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isAuthenticated && isSameDay(selectedDate, new Date()),
  });

  const { data: selectedDateCheckIn } = useQuery<CheckIn | null>({
    queryKey: ["/api/check-ins/date", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/check-ins/date/${dateStr}`, { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isAuthenticated && !isSameDay(selectedDate, new Date()),
  });


  interface TodayWorkout {
    id: string;
    enrollmentId?: number;
    week?: number;
    day?: number;
    workoutId?: number;
    workoutName: string;
    workoutType: string;
    category: string;
    programName?: string;
    isProgramme?: boolean;
    isScheduled?: boolean;
    isExtra?: boolean;
    isCompleted?: boolean;
    completedAt?: string;
    logId?: number;
  }

  const { data: todayWorkouts = [] } = useQuery<TodayWorkout[]>({
    queryKey: ["/api/today-workouts", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/today-workouts?date=${dateStr}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const todayWorkout = todayWorkouts.length > 0 ? todayWorkouts[0] : null;

  const { data: enrolledLearningPaths = [] } = useQuery<UserPathAssignment[]>({
    queryKey: ["/api/user-path-assignments"],
    enabled: isAuthenticated,
  });

  const { data: timeline } = useQuery<{
    activeRecoveryPlans?: Array<{ id: number; programTitle: string }>;
  }>({
    queryKey: ["/api/my-programs/timeline"],
    enabled: isAuthenticated,
  });

  const activeRecoveryPlan = timeline?.activeRecoveryPlans?.[0] || null;

  const { data: scheduledWorkouts = [] } = useQuery({
    queryKey: ["/api/scheduled-workouts", format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/scheduled-workouts?date=${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch scheduled workouts');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Reassessment reminders - date-aware for calendar navigation
  const { data: reassessmentReminders = [] } = useQuery<ReassessmentReminder[]>({
    queryKey: [`/api/reassessment-reminders/on-date?date=${format(selectedDate, 'yyyy-MM-dd')}`],
    enabled: isAuthenticated,
  });

  // Fetch activities for the selected date (includes completed workouts)
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const { data: activitiesData } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/calendar/activities", dateStr],
    queryFn: async () => {
      const response = await fetch(
        `/api/calendar/activities?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) return {};
      return response.json();
    },
    enabled: isAuthenticated,
  });
  
  // Extract completed workout logs for the selected date
  const completedWorkoutLogs = activitiesData?.[dateStr]?.filter(
    (activity: any) => activity.type === 'completedWorkout'
  ) || [];

  // Fetch nutrition data for the selected date
  const { data: nutritionData } = useQuery<NutritionData>({
    queryKey: ['/api/nutrition/today', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/nutrition/today?date=${dateStr}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch nutrition');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Auto-popup check-in if not done today
  useEffect(() => {
    if (isAuthenticated && !isLoading && isSameDay(selectedDate, new Date()) && !todayCheckIn && !showCheckIn) {
      const hasShownToday = localStorage.getItem('checkInPromptedToday');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (!hasShownToday || !hasShownToday.includes(today)) {
        setTimeout(() => {
          setShowCheckIn(true);
          localStorage.setItem('checkInPromptedToday', today);
        }, 1000);
      }
    }
  }, [isAuthenticated, isLoading, todayCheckIn, showCheckIn, selectedDate]);

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: number) => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return await apiRequest("POST", `/api/habits/${habitId}/complete?date=${dateStr}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Habit completed!",
        description: "Keep up the great work!",
      });
    },
  });

  const uncompleteHabitMutation = useMutation({
    mutationFn: async (habitId: number) => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return await apiRequest("DELETE", `/api/habits/${habitId}/complete?date=${dateStr}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Habit unmarked",
        description: "Habit completion removed for today.",
      });
    },
  });

  if (isLoading || habitsLoading || goalsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter habits for selected date
  const todaysHabits = habits.filter((habit) => {
    // Normalize dates to midnight for comparison (ignore time component)
    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);
    
    // Check if habit has started
    const habitStartDate = new Date(habit.startDate);
    habitStartDate.setHours(0, 0, 0, 0);
    if (selectedDateOnly < habitStartDate) return false;
    
    // Check if habit has ended (startDate + duration in weeks)
    if (habit.duration) {
      const habitEndDate = new Date(habitStartDate);
      habitEndDate.setDate(habitEndDate.getDate() + (habit.duration * 7));
      if (selectedDateOnly > habitEndDate) return false;
    }
    
    // Check if scheduled for this day of week
    const dayName = format(selectedDate, 'EEEE');
    
    // Handle "Everyday" or "everyday" (case-insensitive)
    if (!habit.daysOfWeek || 
        (typeof habit.daysOfWeek === 'string' && habit.daysOfWeek.toLowerCase() === 'everyday')) {
      return true;
    }
    
    // Handle array of days (like ["Monday", "Wednesday", "Friday"])
    if (Array.isArray(habit.daysOfWeek)) {
      return habit.daysOfWeek.includes(dayName);
    }
    
    // Handle comma-separated string (legacy support)
    if (typeof habit.daysOfWeek === 'string') {
      return habit.daysOfWeek.includes(dayName);
    }
    
    return false;
  });

  const handleCompleteHabit = (habitId: number) => {
    completeHabitMutation.mutate(habitId);
  };

  const handleToggleHabit = (habitId: number, isCompleted: boolean) => {
    if (isCompleted) {
      uncompleteHabitMutation.mutate(habitId);
    } else {
      handleCompleteHabit(habitId);
    }
  };

  // Check if selected date is in the future or past
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const selectedDateAtStart = new Date(selectedDate);
  selectedDateAtStart.setHours(0, 0, 0, 0);
  
  const isFutureDate = selectedDateAtStart > todayStart;
  const isPastDate = selectedDateAtStart < todayStart;
  const isToday = isSameDay(selectedDate, new Date());

  const isRestDayOrNoWorkout = !todayWorkout || todayWorkout.workoutName === "Rest Day";
  
  const tileConfig: Record<string, { title: string; description: string; route: string }> = {
    workout: { 
      title: isFutureDate ? "Scheduled Workout" : isPastDate ? "Completed Workout" : "Today's Workout", 
      description: todayWorkout ? todayWorkout.workoutName : "No workout scheduled", 
      route: "/training" 
    },
    breath: { 
      title: isFutureDate ? "Scheduled Breath Session" : isPastDate ? "Completed Breath Session" : "Breath Session", 
      description: isFutureDate ? "Scheduled breath session" : isPastDate ? "Completed breath session" : "Box Breathing - 5 min • Pending", 
      route: "/recovery/breath-work" 
    },
    learn: { 
      title: isFutureDate ? "Scheduled Lab" : isPastDate ? "The Lab" : "The Lab", 
      description: "View your enrolled learning paths", 
      route: "/education-lab" 
    },
    checkin: { 
      title: isFutureDate ? "Scheduled Check-In" : isPastDate ? "Previous Check-In" : "Daily Check-In", 
      description: isFutureDate ? "Scheduled check-in" : isPastDate ? "Review your daily check-in" : "Log how you're feeling today", 
      route: "" 
    },
  };

  const handleTileClick = (tileId: string) => {
    setSelectedTile(tileId);
  };

  const handleNavigateToSection = () => {
    // Handle workout navigation first
    if (selectedTile === 'workout') {
      if (todayWorkout?.enrollmentId && todayWorkout?.week && todayWorkout?.day) {
        // Programme workout - navigate to programme workout detail
        navigate(`/workout-detail/${todayWorkout.enrollmentId}/${todayWorkout.week}/${todayWorkout.day}`);
      } else if (todayWorkout?.workoutId) {
        // Scheduled individual workout - navigate to workout library detail
        navigate(`/training/workout/${todayWorkout.workoutId}`);
      } else {
        // Fallback to training hub if no workout data
        navigate('/training/main-programme');
      }
      setSelectedTile(null);
    } else if (selectedTile === 'learn' && enrolledLearningPaths.length > 0) {
      setShowPathSelection(true);
    } else if (selectedTile === 'checkin') {
      setShowCheckIn(true);
      setSelectedTile(null);
    } else if (selectedTile && tileConfig[selectedTile]) {
      navigate(tileConfig[selectedTile].route);
      setSelectedTile(null);
    }
  };

  const handleSelectLearningPath = (pathId: number) => {
    navigate(`/education-lab/path/${pathId}`);
    setShowPathSelection(false);
    setSelectedTile(null);
  };

  const getCompletionStatusForDate = (habit: Habit & { completedOnDate?: boolean }) => {
    // Use the completedOnDate field from the API response
    return habit.completedOnDate || false;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <DailyCheckInDialog 
        open={showCheckIn} 
        onOpenChange={setShowCheckIn}
        checkInToEdit={isSameDay(selectedDate, new Date()) ? (todayCheckIn || undefined) : (selectedDateCheckIn || undefined)}
      />

      <Dialog open={showPathSelection} onOpenChange={setShowPathSelection}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Select a Learning Path</DialogTitle>
            <DialogDescription className="sr-only">Choose a learning path to continue</DialogDescription>
          </DialogHeader>
          {enrolledLearningPaths && enrolledLearningPaths.length > 0 ? (
            <PathSelectionDialog 
              enrolledPaths={enrolledLearningPaths}
              onSelectPath={handleSelectLearningPath}
            />
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Loading your learning paths...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <CalendarPopup
        isOpen={showCalendarPopup}
        onClose={() => setShowCalendarPopup(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowCalendarPopup(false);
        }}
      />
      <TopHeader 
        showProfile={true}
        title={formatDate(selectedDate, "withDay")}
        showCalendarIcon={true}
        onTodayClick={() => setSelectedDate(new Date())}
        onOpenCalendar={() => navigate('/calendar')}
      />
      
      <div className="bg-background">
        <WeekCalendarStrip 
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>

      {/* Onboarding reminder banner */}
      {user && !user.isAdmin && !user.onboardingCompleted && !user.onboardingDismissed && (
        <div className="mx-4 mt-3 mb-1 relative overflow-hidden rounded-xl border border-[#0cc9a9]/30 bg-gradient-to-r from-[#0cc9a9]/10 to-[#0cc9a9]/5">
          <button
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/onboarding/dismiss");
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              } catch (e) {
                console.error("Failed to dismiss onboarding", e);
              }
            }}
            className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="p-4 pr-10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-[#0cc9a9]/20">
                <Sparkles className="h-5 w-5 text-[#0cc9a9]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">
                  {user.onboardingStep && user.onboardingStep > 0 ? "Continue setting up" : "Get the most out of the app"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user.onboardingStep && user.onboardingStep > 0
                    ? "Pick up where you left off to personalise your experience."
                    : "Complete a quick setup to personalise your training, nutrition, and recovery."}
                </p>
                <Button
                  onClick={() => navigate("/onboarding")}
                  size="sm"
                  className="mt-2.5 h-8 bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black text-xs font-medium"
                >
                  {user.onboardingStep && user.onboardingStep > 0 ? "Continue setup" : "Start setup"}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="p-4 pt-3">

        {/* Check-In Button (only when not completed) */}
        {isToday && !todayCheckIn && (
          <div className="mb-6">
            <Button 
              onClick={() => setShowCheckIn(true)}
              className="w-full py-6 text-base font-semibold"
              data-testid="button-open-check-in"
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete Daily Check-In
            </Button>
          </div>
        )}

        {/* Goals Section */}
        <div className="mb-8">
          <h3 className="mb-4">
            <span className="text-sm font-semibold bg-[#0cc9a9] text-black px-3 py-1 rounded-md uppercase tracking-wide">Goals</span>
          </h3>
          {(() => {
            // Use selectedDate for filtering (what day user is viewing)
            const viewingDate = new Date(selectedDate);
            viewingDate.setHours(0, 0, 0, 0);
            const currentGoals = goals.filter(goal => {
              // For completed bodyweight goals, ONLY show on the exact completion day
              if (goal.isCompleted && goal.type === 'bodyweight') {
                if (goal.completedAt) {
                  const completedDate = new Date(goal.completedAt);
                  completedDate.setHours(0, 0, 0, 0);
                  // Only show on the exact completion day
                  return viewingDate.getTime() === completedDate.getTime();
                }
                // If no completedAt but goal is completed, don't show (can't determine completion day)
                return false;
              }
              // For other completed goals, hide them
              if (goal.isCompleted) return false;
              if (goal.deadline) {
                const deadline = new Date(goal.deadline);
                deadline.setHours(0, 0, 0, 0);
                if (deadline < viewingDate) return false;
              }
              const startDate = new Date(goal.startDate || goal.createdAt);
              startDate.setHours(0, 0, 0, 0);
              if (startDate > viewingDate) return false;
              return true;
            }).sort((a, b) => {
              // Always put nutrition goals first
              if (a.type === 'nutrition' && b.type !== 'nutrition') return -1;
              if (b.type === 'nutrition' && a.type !== 'nutrition') return 1;
              return 0;
            });
            return currentGoals.length > 0 ? (
            <div className="space-y-3">
              {currentGoals.map((goal) => {
                if (goal.type === 'nutrition') {
                  return (
                    <NutritionGoalCard
                      key={goal.id}
                      goal={goal}
                      nutritionData={nutritionData}
                    />
                  );
                }
                return (
                  <DashboardGoalCard
                    key={goal.id}
                    goal={goal}
                    navigate={navigate}
                    formatDate={formatDate}
                  />
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No goals set yet</p>
            </Card>
          );
          })()}
        </div>

        {/* Habits Section */}
        <div className="mb-8">
          <h3 className="mb-4">
            <span className="text-sm font-semibold bg-[#0cc9a9] text-black px-3 py-1 rounded-md uppercase tracking-wide">Habits</span>
          </h3>
          {todaysHabits.length > 0 ? (
            <div className="space-y-3">
              {todaysHabits.map((habit) => {
                const isHydrationHabit = habit.templateId === 36;
                
                if (isHydrationHabit) {
                  return (
                    <DashboardHydrationCard
                      key={habit.id}
                      habitId={habit.id}
                      onChevronClick={() => navigate(`/habit-tracking/${habit.id}`)}
                      selectedDate={selectedDate}
                    />
                  );
                }
                
                const completed = getCompletionStatusForDate(habit);
                const settings = (habit.settings as any) || {};
                const habitRoute = `/habit-tracking/${habit.id}`;
                return (
                  <Card 
                    key={habit.id} 
                    className="p-4 flex items-center justify-between hover:bg-foreground/5 transition-colors cursor-pointer"
                    onClick={() => navigate(habitRoute)}
                    data-testid={`card-today-habit-${habit.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        {completed ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                        ) : (
                          <Circle className="h-6 w-6 text-gray-400 flex-shrink-0" />
                        )}
                        <h4 className="text-lg font-medium text-foreground truncate" data-testid={`text-today-habit-title-${habit.id}`}>
                          {habit.title}
                        </h4>
                      </div>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">
                        Habit
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0" />
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No habits scheduled for today</p>
            </Card>
          )}
        </div>

        {/* Activities Header - placed after habits, before activities */}
        <h2 className="mb-4" data-testid="text-home-title">
          <span className="text-sm font-semibold bg-[#0cc9a9] text-black px-3 py-1 rounded-md uppercase tracking-wide">
            {isFutureDate ? "Scheduled for this day" : isPastDate ? "Completed for this day" : "Things to do today"}
          </span>
        </h2>

        {/* Smart Daily Tiles */}
        <div className="mb-8">
          <div className="space-y-3">
            {/* Reassessment Reminder Tiles - shown first when there are active reminders */}
            {reassessmentReminders.map((reminder) => (
              <Card 
                key={reminder.id}
                className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-2 border-[#0cc9a9]/30" 
                onClick={() => navigate('/training/body-map')}
                data-testid={`card-reassessment-${reminder.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Circle className="h-6 w-6 text-[#0cc9a9] flex-shrink-0" />
                    <p className="text-lg font-medium text-foreground">
                      Reassess {reminder.bodyArea.charAt(0).toUpperCase() + reminder.bodyArea.slice(1)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reminder.status === 'due' ? 'Due today' : `Scheduled for ${formatDate(new Date(reminder.dueAt), 'monthDay')}`}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-[#0cc9a9] text-black">
                    Reassess
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
              </Card>
            ))}

            {/* Workout Cards - one per workout (only show if there are actual workouts, not rest days) */}
            {todayWorkouts.filter(w => w.workoutName !== 'Rest Day').map((workout, index) => {
                const handleWorkoutClick = () => {
                  // If workout is completed, navigate to logged workout view
                  if (workout.isCompleted && workout.logId) {
                    navigate(`/progress/workout/${workout.logId}?source=home`);
                    return;
                  }
                  
                  // Build calendar context params (shows date at top, hides upcoming count)
                  const dateStr = format(selectedDate, 'yyyy-MM-dd');
                  const calendarParams = `?source=calendar&date=${dateStr}`;
                  
                  if (workout.isProgramme && workout.enrollmentId && workout.week && workout.day) {
                    // Programme workout - navigate to workout detail
                    navigate(`/workout-detail/${workout.enrollmentId}/${workout.week}/${workout.day}${calendarParams}`);
                  } else if (workout.isExtra && workout.enrollmentId && workout.week && workout.day) {
                    // Extra session of a programme workout
                    navigate(`/workout-detail/${workout.enrollmentId}/${workout.week}/${workout.day}${calendarParams}`);
                  } else if (workout.isScheduled && workout.workoutId && workout.workoutId > 0) {
                    // Standalone workout from library
                    navigate(`/training/workout/${workout.workoutId}${calendarParams}`);
                  } else if (workout.isScheduled && workout.enrollmentId && workout.day) {
                    // Scheduled workout linked to programme (extra session stored in scheduled_workouts)
                    const week = workout.week || 1;
                    navigate(`/workout-detail/${workout.enrollmentId}/${week}/${workout.day}${calendarParams}`);
                  } else {
                    // Fallback to main programme
                    navigate('/training/main-programme');
                  }
                };
                
                return (
                  <Card 
                    key={workout.id}
                    className={`p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer ${workout.isCompleted ? 'border-green-500/30' : ''}`}
                    onClick={handleWorkoutClick}
                    data-testid={`card-workout-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        {workout.isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-6 w-6 text-blue-500 flex-shrink-0" />
                        )}
                        <p className="text-lg font-medium text-foreground truncate">
                          {workout.workoutName}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {workout.isCompleted ? 'Workout completed' : 'Complete your scheduled workout'}
                      </p>
                      {(() => {
                        const categoryTag = getWorkoutCategoryTag(workout.workoutName);
                        if (workout.isCompleted) {
                          return (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">
                              Completed
                            </span>
                          );
                        }
                        if (categoryTag) {
                          return (
                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${categoryTag.bgColor} text-white`}>
                              {categoryTag.label}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-500 text-white">
                            Workout
                          </span>
                        );
                      })()}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
                  </Card>
                );
              })}

            {/* Completed Workout Logs - show workouts completed on this date */}
            {completedWorkoutLogs.map((log: any) => {
              // Check if this completed log is already shown in todayWorkouts (to avoid duplicates)
              const isDuplicate = todayWorkouts.some(w => 
                w.isCompleted && w.workoutName === log.title
              );
              if (isDuplicate) return null;
              
              // All completed workout logs should navigate to the logged workout view
              const navigatePath = `/progress/workout/${log.id}?source=home`;
              
              return (
                <Card 
                  key={`completed-${log.id}`}
                  className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-green-500/30"
                  onClick={() => navigate(navigatePath)}
                  data-testid={`card-completed-workout-${log.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                      <p className="text-lg font-medium text-foreground truncate">
                        {log.title}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Workout completed
                    </p>
                    {(() => {
                      const categoryTag = getWorkoutCategoryTag(log.title || '');
                      return (
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${categoryTag ? categoryTag.bgColor : 'bg-green-500'} text-white`}>
                          {categoryTag ? categoryTag.label : 'Completed'}
                        </span>
                      );
                    })()}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
                </Card>
              );
            })}

            {activeRecoveryPlan && (
              <Card 
                className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-2 border-primary/20" 
                onClick={() => navigate(`/program-hub/${activeRecoveryPlan.id}`)}
                data-testid="card-recovery-plan"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Circle className="h-6 w-6 text-red-500 flex-shrink-0" />
                    <p className="text-lg font-medium text-foreground">Recovery Plan</p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">{activeRecoveryPlan.programTitle}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                    Recovery
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
              </Card>
            )}

            {/* Breath Session tile - hidden until scheduling feature is implemented */}


            <DashboardLearnCard 
              enrolledPaths={enrolledLearningPaths}
              onTileClick={handleTileClick}
              onShowPathSelection={() => setShowPathSelection(true)}
              selectedDate={selectedDate}
            />

            {todayWorkouts.filter(w => w.workoutName !== 'Rest Day').length === 0 && completedWorkoutLogs.length === 0 && !activeRecoveryPlan && enrolledLearningPaths.length === 0 && (
              <Card className="p-4">
                <p className="text-muted-foreground text-center text-sm">No workouts or learning paths set yet</p>
              </Card>
            )}

          </div>
        </div>

        {/* Check-In Card (when completed for selected date) */}
        {isToday && todayCheckIn && (
          <div className="mb-8">
            <ViewCheckInCard 
              checkIn={todayCheckIn} 
              onEdit={() => setShowCheckIn(true)}
            />
          </div>
        )}
        {!isToday && selectedDateCheckIn && (
          <div className="mb-8">
            <ViewCheckInCard 
              checkIn={selectedDateCheckIn}
              initialDate={selectedDate}
            />
          </div>
        )}

        {/* My Progress Section */}
        <MyProgressSection selectedDate={selectedDate} />
      </div>

      {/* Tile Details Modal */}
      <Dialog open={!!selectedTile} onOpenChange={() => setSelectedTile(null)}>
        <DialogContent className="sm:max-w-xs rounded-lg p-4 w-[calc(100%-2rem)]">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-center text-2xl font-bold">{selectedTile && tileConfig[selectedTile]?.title}</DialogTitle>
            <DialogDescription className="sr-only">View details for this activity</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-muted-foreground text-center text-2xl font-semibold">{selectedTile && tileConfig[selectedTile]?.description}</p>
          </div>
          <div className="flex justify-center pt-2">
            <Button size="sm" className="bg-primary" onClick={handleNavigateToSection} data-testid="button-modal-navigate">
              View Workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
