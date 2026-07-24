import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Flame,
  Trophy,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  AlertTriangle
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Habit, HabitCompletion } from "@shared/schema";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import TopHeader from "@/components/TopHeader";

function formatDaysOfWeek(daysOfWeek: string | null | undefined): string {
  if (!daysOfWeek || daysOfWeek.toLowerCase() === 'everyday') return 'EVERYDAY';
  
  const days = daysOfWeek.split(',').map(d => d.trim());
  const daySet = new Set(days);

  if (daySet.size === 7) return 'EVERYDAY';
  
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weekend = ['Saturday', 'Sunday'];
  
  const isWeekdays = weekdays.every(d => daySet.has(d)) && weekend.every(d => !daySet.has(d)) && daySet.size === 5;
  const isWeekend = weekend.every(d => daySet.has(d)) && weekdays.every(d => !daySet.has(d)) && daySet.size === 2;
  
  if (isWeekdays) return 'MIDWEEK';
  if (isWeekend) return 'WEEKEND';
  
  const shortNames: Record<string, string> = {
    'Monday': 'Mon',
    'Tuesday': 'Tue',
    'Wednesday': 'Wed',
    'Thursday': 'Thur',
    'Friday': 'Fri',
    'Saturday': 'Sat',
    'Sunday': 'Sun',
  };
  
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  
  return sortedDays.map(d => shortNames[d] || d).join(', ').toUpperCase();
}

export default function Habits() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("current");
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [showHabitTip, setShowHabitTip] = useState(true);
  const { formatDate } = useFormattedDate();

  const { data: habits = [], isLoading: habitsLoading } = useQuery<Habit[]>({
    queryKey: ["/api/habits"],
  });

  // Categorize habits into current, past, and upcoming
  const categorizeHabits = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = habits.filter(habit => {
      const startDate = new Date(habit.startDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate > today;
    });

    const past = habits.filter(habit => {
      const startDate = new Date(habit.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return false;
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (habit.duration || 3) * 7);
      endDate.setHours(0, 0, 0, 0);
      return endDate < today;
    });

    const current = habits.filter(habit => {
      const startDate = new Date(habit.startDate);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) return false;
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (habit.duration || 3) * 7);
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today;
    });

    return { current, past, upcoming };
  };

  const categorizedHabits = categorizeHabits();

  const deleteHabitMutation = useMutation({
    mutationFn: async (habitId: number) => {
      return await apiRequest("DELETE", `/api/habits/${habitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      setDeletingHabit(null);
    },
  });

  if (habitsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading habits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Habits" onBack={() => setLocation("/perform")} />
      
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
                <h2 className="text-xl font-bold text-foreground">Current Habits</h2>
                <Button 
                  onClick={() => setLocation('/habit-selection')}
                  size="sm"
                  data-testid="button-add-habit"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit
                </Button>
              </div>

              {categorizedHabits.current.length >= 4 && showHabitTip && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-3 mb-4" style={{ border: '1.5px solid #0cc9a9', backgroundColor: 'rgba(250, 204, 21, 0.08)' }}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#0cc9a9' }} />
                  <p className="text-sm text-foreground flex-1 leading-snug">
                    You have a lot on. Research shows sticking to 3 habits or fewer and repeating them for 6+ weeks leads to lasting change.
                  </p>
                  <button
                    onClick={() => setLocation('/learn/mindset/video/447')}
                    className="text-sm font-medium flex-shrink-0 whitespace-nowrap"
                    style={{ color: '#0cc9a9' }}
                  >
                    Learn more
                  </button>
                </div>
              )}

              {categorizedHabits.current.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No current habits</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {categorizedHabits.current.map((habit) => (
                    <HabitCard 
                      key={habit.id}
                      habit={habit}
                      setLocation={setLocation}
                      setDeletingHabit={setDeletingHabit}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Scheduled Habits</h2>
                <Button 
                  onClick={() => setLocation('/habit-selection')}
                  size="sm"
                  data-testid="button-add-habit"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit
                </Button>
              </div>
              {categorizedHabits.upcoming.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No scheduled habits</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {categorizedHabits.upcoming.map((habit) => (
                    <HabitCard 
                      key={habit.id}
                      habit={habit}
                      setLocation={setLocation}
                      setDeletingHabit={setDeletingHabit}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground">Past Habits</h2>
              </div>
              {categorizedHabits.past.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No past habits</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {categorizedHabits.past.map((habit) => (
                    <HabitCard 
                      key={habit.id}
                      habit={habit}
                      setLocation={setLocation}
                      setDeletingHabit={setDeletingHabit}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>


      <AlertDialog open={!!deletingHabit} onOpenChange={(open) => !open && setDeletingHabit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Habit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingHabit?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-habit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingHabit && deleteHabitMutation.mutate(deletingHabit.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-habit"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}

interface HabitCardProps {
  habit: Habit;
  setLocation: (path: string) => void;
  setDeletingHabit: (habit: Habit) => void;
}

function HabitCard({ habit, setLocation, setDeletingHabit }: HabitCardProps) {
  const { formatDate } = useFormattedDate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const { data: completions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ['/api/habits', habit.id, 'completions'],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habit.id}/completions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch completions');
      return res.json();
    },
  });

  const { data: hydrationStats } = useQuery<{ percentage: number }>({
    queryKey: ['/api/hydration/today', todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/hydration/today?date=${todayStr}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch hydration');
      return res.json();
    },
    enabled: habit.templateId === 16,
  });

  const isHydrationHabit = habit.templateId === 16;
  const hydrationGoalReached = isHydrationHabit && (hydrationStats?.percentage || 0) >= 100;
  
  // Refetch data when hydration goal is reached (server auto-completes the habit)
  useEffect(() => {
    if (hydrationGoalReached) {
      queryClient.invalidateQueries({ queryKey: ['/api/habits', habit.id, 'completions'] });
      queryClient.invalidateQueries({ queryKey: [`/api/habits/${habit.id}/completions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
    }
  }, [hydrationGoalReached, habit.id]);
  
  const isCompletedToday = completions.some(c => {
    const completionDate = format(new Date(c.completedDate), 'yyyy-MM-dd');
    return completionDate === todayStr;
  }) || hydrationGoalReached;

  const completeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/habits/${habit.id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/habits', habit.id, 'completions'] });
      queryClient.invalidateQueries({ queryKey: [`/api/habits/${habit.id}/completions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/habits/${habit.id}/complete?date=${todayStr}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/habits', habit.id, 'completions'] });
      queryClient.invalidateQueries({ queryKey: [`/api/habits/${habit.id}/completions`] });
      queryClient.invalidateQueries({ queryKey: ['/api/habits'] });
    },
  });

  const handleToggleCompletion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isHydrationHabit) return;
    
    if (isCompletedToday) {
      uncompleteMutation.mutate();
    } else {
      completeMutation.mutate();
    }
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
      onClick={() => {
        setLocation(`/habit-progress/${habit.id}`);
      }}
      data-testid={`card-habit-${habit.id}`}
    >
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <div className="mr-3 flex-shrink-0">
            {isCompletedToday ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <Circle className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold" data-testid={`text-habit-title-${habit.id}`}>
              {habit.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 uppercase truncate">
              {formatDate(new Date(habit.startDate), 'short').toUpperCase()} - {formatDate(new Date(new Date(habit.startDate).getTime() + (habit.duration || 3) * 7 * 24 * 60 * 60 * 1000), 'short').toUpperCase()} ({formatDaysOfWeek(habit.daysOfWeek)})
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()} data-testid={`button-menu-habit-${habit.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              setLocation(`/habit-edit/${habit.id}`);
            }} data-testid={`menu-edit-habit-${habit.id}`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Habit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                setDeletingHabit(habit);
              }} 
              className="text-red-600"
              data-testid={`menu-delete-habit-${habit.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Habit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="border-t border-border px-4 py-3 flex">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Current streak</p>
          <p className="font-semibold text-foreground">
            {habit.currentStreak ?? 0} <span className="font-normal text-muted-foreground">{habit.currentStreak === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Longest streak</p>
          <p className="font-semibold text-foreground">
            {habit.longestStreak ?? 0} <span className="font-normal text-muted-foreground">{habit.longestStreak === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}

