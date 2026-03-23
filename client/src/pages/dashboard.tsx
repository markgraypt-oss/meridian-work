import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Dumbbell, 
  Moon, 
  Flame, 
  ClipboardCheck, 
  TrendingUp,
  Calendar,
  Target,
  Brain,
  Check,
  Circle,
  Heart
} from "lucide-react";
import DateNavigator from "@/components/DateNavigator";
import CalendarPopup from "@/components/CalendarPopup";
import SmartDailyTiles from "@/components/SmartDailyTiles";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const { formatDate } = useFormattedDate();

  // Redirect to home if not authenticated
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

  const { data: latestProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress/latest"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: latestCheckIn, isLoading: checkInLoading } = useQuery({
    queryKey: ["/api/check-ins/latest"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch activities for the selected date
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: [`/api/calendar/activities?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`],
    enabled: isAuthenticated,
    retry: false,
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to load activities for this day",
        variant: "destructive",
      });
    },
  });
  
  // Extract activities for the selected date from grouped data
  // Create UTC midnight for the selected date to match server's UTC grouping
  const utcDate = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
  const dateKey = utcDate.toISOString().split('T')[0];
  const dailyActivities = activitiesData ? (activitiesData[dateKey] || []) : [];

  // Fetch habits for the selected date
  const { data: dailyHabits, isLoading: habitsLoading } = useQuery({
    queryKey: [`/api/habits?date=${selectedDate.toISOString()}`],
    enabled: isAuthenticated,
    retry: false,
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to load habits for this day",
        variant: "destructive",
      });
    },
  });

  // Fetch program timeline to check for active recovery plans
  const { data: timeline } = useQuery<any>({
    queryKey: ["/api/my-programs/timeline"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Get the first active recovery plan (if any)
  const activeRecoveryPlan = timeline?.activeRecoveryPlans?.[0] || null;

  if (isLoading || progressLoading || checkInLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const healthScore = latestProgress?.healthScore || 87;
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-[#0cc9a9]";
    return "text-red-600";
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Section */}
      <section className="gradient-primary text-white py-16">
        {/* Date Navigator */}
        <DateNavigator 
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onCalendarClick={() => setShowCalendarPopup(true)}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                Welcome back, {user?.firstName || "Executive"}
              </h1>
              <p className="text-xl mb-8 text-blue-100">
                Your personalized health and fitness command center designed for high-performing executives.
              </p>
              
              {/* Daily Health Score */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Today's Health Score</h3>
                  <Brain className="h-5 w-5 text-blue-200" />
                </div>
                <div className="flex items-center">
                  <div className="relative w-16 h-16 mr-4">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="rgba(255,255,255,0.2)" 
                        strokeWidth="2"
                      />
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="#10B981" 
                        strokeWidth="2" 
                        strokeDasharray={`${healthScore}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{healthScore}</span>
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm mb-1 ${getHealthScoreColor(healthScore)}`}>
                      {getHealthScoreLabel(healthScore)}
                    </div>
                    <div className="text-xs text-blue-200">
                      Sleep: {latestProgress?.sleepHours || 8.2}h | HRV: {latestProgress?.hrv || 45}ms | RHR: {latestProgress?.rhr || 52}bpm
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Executive fitness training" 
                className="rounded-xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Smart Daily Tiles - TOP PRIORITY SECTION */}
      <section className="py-8 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-dark mb-6">📋 Today's Smart Tasks</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-dark">💪 Today's Workout</p>
                    <p className="text-sm text-gray-600">HIIT Circuit - 30 min • 60% done</p>
                  </div>
                  <Button size="sm" className="bg-primary">Start</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-dark">🎯 Today's Habit</p>
                    <p className="text-sm text-gray-600">Drink 3L of water • Pending</p>
                  </div>
                  <Button size="sm" className="bg-primary">Start</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-dark">🫁 Breath Session</p>
                    <p className="text-sm text-gray-600">Box Breathing - 5 min • Pending</p>
                  </div>
                  <Button size="sm" className="bg-primary">Start</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-dark">🎬 Learn</p>
                    <p className="text-sm text-gray-600">Sleep Masterclass • 35% watched</p>
                  </div>
                  <Button size="sm" className="bg-primary">Continue</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-primary/20 md:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-neutral-dark">📊 Weekly Check-In</p>
                    <p className="text-sm text-gray-600">Time for your weekly progress check-in</p>
                  </div>
                  <Button size="sm" className="bg-primary">Start</Button>
                </div>
              </CardContent>
            </Card>

            {/* Recovery Plan Tile - Only shown if user has an active recovery plan */}
            {activeRecoveryPlan && (
              <Card className="bg-white border-2 border-primary/20" data-testid="card-recovery-plan">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-neutral-dark">
                        <Heart className="h-4 w-4 inline mr-1 text-red-500" />
                        Recovery Plan
                      </p>
                      <p className="text-sm text-gray-600">{activeRecoveryPlan.programTitle}</p>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-primary"
                      onClick={() => navigate(`/program-hub/${activeRecoveryPlan.id}`)}
                      data-testid="button-view-recovery-plan"
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* My Day Section */}
      <section className="py-12 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-neutral-dark mb-6">
            {selectedDate.toDateString() === new Date().toDateString() ? "My Day" : `Activities for ${formatDate(selectedDate, "full")}`}
          </h2>
          
          {/* Smart Daily Tiles - includes reassessment reminders */}
          <SmartDailyTiles selectedDate={selectedDate} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Scheduled Workouts & Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Dumbbell className="h-5 w-5 mr-2" />
                  Scheduled Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : dailyActivities && dailyActivities.length > 0 ? (
                  <div className="space-y-3">
                    {dailyActivities.map((activity: any, index: number) => {
                      // Build navigation path based on activity type
                      const getActivityPath = () => {
                        if (activity.type === 'completedWorkout') {
                          return `/training/workout/${activity.workoutId}?source=completed&logId=${activity.id}`;
                        }
                        if (activity.type === 'scheduledWorkout') {
                          return `/training/workout/${activity.workoutId}?source=calendar&date=${format(new Date(activity.scheduledDate), 'yyyy-MM-dd')}`;
                        }
                        return null;
                      };
                      const activityPath = getActivityPath();
                      
                      return (
                      <div 
                        key={index} 
                        className={`flex items-center p-3 bg-gray-50 rounded-lg ${activityPath ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                        onClick={() => activityPath && navigate(activityPath)}
                        data-testid={`activity-${activity.type}-${index}`}
                      >
                        <div className={`p-2 rounded-full mr-3 ${
                          activity.type === 'completedWorkout' ? 'bg-green-100' :
                          activity.type === 'workout' || activity.type === 'scheduledWorkout' ? 'bg-blue-100' :
                          activity.type === 'meal' ? 'bg-orange-100' :
                          activity.type === 'habit' ? 'bg-purple-100' :
                          activity.type === 'bodyStats' ? 'bg-green-100' :
                          'bg-gray-100'
                        }`}>
                          {activity.type === 'completedWorkout' ? <Check className="h-4 w-4 text-green-600" /> :
                           activity.type === 'workout' || activity.type === 'scheduledWorkout' ? <Dumbbell className="h-4 w-4 text-blue-600" /> :
                           activity.type === 'meal' ? <Calendar className="h-4 w-4 text-orange-600" /> :
                           activity.type === 'habit' ? <Target className="h-4 w-4 text-purple-600" /> :
                           <Calendar className="h-4 w-4 text-gray-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate">{activity.title || activity.name || activity.workoutName || 'Activity'}</p>
                          <p className="text-xs text-gray-600">
                            {activity.type === 'completedWorkout' ? 'Completed Workout' :
                             activity.type === 'workout' || activity.type === 'scheduledWorkout' ? 'Workout' :
                             activity.type === 'meal' ? 'Meal' :
                             activity.type === 'habit' ? 'Habit' :
                             activity.type}
                          </p>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8" data-testid="text-no-activities">
                    No scheduled activities for this day
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Habits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Habits
                </CardTitle>
              </CardHeader>
              <CardContent>
                {habitsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : dailyHabits && dailyHabits.length > 0 ? (
                  <div className="space-y-3">
                    {dailyHabits.map((habit: any) => (
                      <div key={habit.id} className="flex items-center p-3 bg-gray-50 rounded-lg" data-testid={`habit-${habit.id}`}>
                        <div className={`p-2 rounded-full mr-3 ${habit.completedOnDate ? 'bg-green-100' : 'bg-purple-100'}`}>
                          {habit.completedOnDate ? 
                            <Check className="h-4 w-4 text-green-600" /> :
                            <Circle className="h-4 w-4 text-purple-600" />
                          }
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${habit.completedOnDate ? 'line-through text-gray-500' : ''}`}>
                            {habit.title}
                          </p>
                          <p className="text-xs text-gray-600">{habit.category || 'Daily Habit'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8" data-testid="text-no-habits">
                    No habits for this day
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


      {/* Quick Stats */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Week</p>
                    <p className="text-2xl font-bold text-neutral-dark">
                      {latestProgress?.workoutsCompleted || 4}/5
                    </p>
                    <p className="text-xs text-secondary">Workouts Completed</p>
                  </div>
                  <div className="bg-secondary/10 p-3 rounded-full">
                    <Dumbbell className="h-5 w-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Sleep</p>
                    <p className="text-2xl font-bold text-neutral-dark">
                      {latestProgress?.sleepHours || 7.8}h
                    </p>
                    <p className="text-xs text-primary">Last 7 days</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Moon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Streak</p>
                    <p className="text-2xl font-bold text-neutral-dark">12</p>
                    <p className="text-xs text-orange-600">Days Active</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-full">
                    <Flame className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Check-ins</p>
                    <p className="text-2xl font-bold text-neutral-dark">3/4</p>
                    <p className="text-xs text-purple-600">This Month</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <ClipboardCheck className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-neutral-dark mb-2">Quick Actions</h2>
            <p className="text-gray-600">Get started with your health journey today</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/programs'}>
              <CardContent className="p-6 text-center">
                <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Start Programme</h3>
                <p className="text-sm text-gray-600">Begin a customized training program</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard'}>
              <CardContent className="p-6 text-center">
                <div className="bg-secondary/10 p-4 rounded-full w-fit mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold mb-2">Daily Check-in</h3>
                <p className="text-sm text-gray-600">Log how you're feeling today</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/body-map'}>
              <CardContent className="p-6 text-center">
                <div className="bg-orange-100 p-4 rounded-full w-fit mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">Body Map</h3>
                <p className="text-sm text-gray-600">Log pain points and track recovery</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/library'}>
              <CardContent className="p-6 text-center">
                <div className="bg-purple-100 p-4 rounded-full w-fit mx-auto mb-4">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Learn</h3>
                <p className="text-sm text-gray-600">Explore educational content</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Weekly Goal</span>
                      <span>80%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "80%" }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Nutrition Adherence</span>
                      <span>75%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "75%" }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Sleep Quality</span>
                      <span>90%</span>
                    </div>
                    <div className="flex h-2 w-full bg-border rounded-full overflow-hidden"><div className="h-full bg-[#0cc9a9] transition-all" style={{ width: "90%" }}></div></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary mr-3" />
                    <div>
                      <p className="font-medium text-sm">Complete Weekly Check-in</p>
                      <p className="text-xs text-gray-600">Due in 2 days</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 bg-green-50 rounded-lg">
                    <Dumbbell className="h-5 w-5 text-secondary mr-3" />
                    <div>
                      <p className="font-medium text-sm">Tomorrow's Workout</p>
                      <p className="text-xs text-gray-600">HIIT Circuit - 30 min</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-600 mr-3" />
                    <div>
                      <p className="font-medium text-sm">New Content Available</p>
                      <p className="text-xs text-gray-600">Stress Management Workshop</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <CalendarPopup 
        isOpen={showCalendarPopup}
        onClose={() => setShowCalendarPopup(false)}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />
    </div>
  );
}
