import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, isMonday, isSameMonth, isSameDay } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Utensils, Dumbbell, Image, Calendar as CalendarIcon, Activity, Scale, Loader2, MapPin, Check, X, Circle, RefreshCw } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import ActivityLogForm from "@/components/ActivityLogForm";
import WorkoutSelector from "@/components/calendar/WorkoutSelector";
import ActivitySelector from "@/components/calendar/ActivitySelector";
import type { ReassessmentReminder } from "@shared/schema";

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

interface DayActivities {
  date: Date;
  activities: any[];
}

type ActivityType = 'meal' | 'workout' | 'activity' | 'bodyStats' | 'photo';
type ViewType = 'menu' | 'workout' | 'activity' | 'meal' | 'bodyStats' | 'photo';

export default function Calendar() {
  const [, navigate] = useLocation();
  const { formatDate } = useFormattedDate();
  const [months, setMonths] = useState<Date[]>([new Date()]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentView, setCurrentView] = useState<ViewType | null>(null);
  const [isLoadingNextMonth, setIsLoadingNextMonth] = useState(false);
  const [isLoadingPrevMonth, setIsLoadingPrevMonth] = useState(false);
  const isLoadingRef = useRef(false);
  const prevScrollHeightRef = useRef<number>(0);

  // Check for quickAdd query parameter (legacy support)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quickAdd = params.get('quickAdd');
    
    if (quickAdd === 'true') {
      setSelectedDate(new Date());
      setCurrentView('menu');
      // Clean up the URL
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  // Calculate date range for all loaded months
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const rangeStart = startOfMonth(firstMonth);
  const rangeEnd = endOfMonth(lastMonth);

  // Fetch activities for entire date range in a single query
  const { data: activitiesData } = useQuery({
    queryKey: ['/api/calendar/activities', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/activities?startDate=${rangeStart.toISOString()}&endDate=${rangeEnd.toISOString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    },
  });

  // Fetch all reassessment reminders (scheduled and due)
  const { data: allReminders = [] } = useQuery<ReassessmentReminder[]>({
    queryKey: ['/api/reassessment-reminders/all'],
  });

  // Combine all days from all months
  const allDays: DayActivities[] = months.flatMap((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return daysInMonth.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayActivities = activitiesData?.[dateKey] || [];
      
      // Add reassessment reminders for this date
      const remindersForDay = allReminders.filter(reminder => {
        const reminderDate = new Date(reminder.dueAt);
        return isSameDay(reminderDate, date);
      }).map(reminder => ({
        type: 'reassessment' as const,
        id: `reminder-${reminder.id}`,
        title: `Reassess ${reminder.bodyArea.charAt(0).toUpperCase() + reminder.bodyArea.slice(1)}`,
        status: reminder.status,
        bodyArea: reminder.bodyArea,
        reminderId: reminder.id,
      }));
      
      return {
        date,
        activities: [...remindersForDay, ...dayActivities]
      };
    });
  });

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/?date=${dateStr}`);
  };

  const handleCloseOverlay = () => {
    setCurrentView(null);
    setSelectedDate(null);
  };

  // Infinite scroll - load next/previous month when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingRef.current || isLoadingNextMonth || isLoadingPrevMonth) return;
      
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 100;
      const scrolledToTop = scrollTop < 100;
      
      if (scrolledToBottom) {
        isLoadingRef.current = true;
        setIsLoadingNextMonth(true);
        
        setTimeout(() => {
          setMonths(prev => {
            const lastMonth = prev[prev.length - 1];
            const nextMonth = addMonths(lastMonth, 1);
            return [...prev, nextMonth];
          });
          
          setTimeout(() => {
            setIsLoadingNextMonth(false);
            isLoadingRef.current = false;
          }, 300);
        }, 600);
      } else if (scrolledToTop) {
        isLoadingRef.current = true;
        setIsLoadingPrevMonth(true);
        prevScrollHeightRef.current = scrollHeight;
        
        setTimeout(() => {
          setMonths(prev => {
            const firstMonth = prev[0];
            const prevMonth = subMonths(firstMonth, 1);
            return [prevMonth, ...prev];
          });
          
          setTimeout(() => {
            const newScrollHeight = document.documentElement.scrollHeight;
            const heightDiff = newScrollHeight - prevScrollHeightRef.current;
            window.scrollTo(0, scrollTop + heightDiff);
            
            setIsLoadingPrevMonth(false);
            isLoadingRef.current = false;
          }, 100);
        }, 600);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [months, isLoadingNextMonth, isLoadingPrevMonth]);

  // Scroll to today on initial load - wait for data to be ready
  useEffect(() => {
    if (!activitiesData) return;
    
    const today = new Date();
    const todayElement = document.querySelector(`[data-testid="day-${format(today, 'yyyy-MM-dd')}"]`);
    if (todayElement) {
      setTimeout(() => {
        todayElement.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 50);
    }
  }, [activitiesData]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'meal':
        return <Utensils className="h-4 w-4" />;
      case 'workout':
      case 'completedWorkout':
        return <Dumbbell className="h-4 w-4" />;
      case 'scheduledWorkout':
        return <Dumbbell className="h-4 w-4" />;
      case 'habit':
        return <Activity className="h-4 w-4" />;
      case 'photo':
        return <Image className="h-4 w-4" />;
      case 'appointment':
        return <CalendarIcon className="h-4 w-4" />;
      case 'bodyStats':
        return <Scale className="h-4 w-4" />;
      case 'reassessment':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivitySummary = (activity: any) => {
    switch (activity.type) {
      case 'meal':
        const macros = [];
        if (activity.calories) macros.push(`${activity.calories} Cals`);
        if (activity.protein) macros.push(`Protein ${activity.protein}g`);
        if (activity.carbs) macros.push(`Carbs ${activity.carbs}g`);
        if (activity.fat) macros.push(`Fat ${activity.fat}g`);
        return macros.join(', ');
      case 'workout':
        const details = [];
        if (activity.duration) details.push(`${activity.duration} min`);
        if (activity.exercisesCompleted) details.push(`${activity.exercisesCompleted} exercises`);
        return details.join(' • ');
      case 'completedWorkout':
        const completedDetails = [];
        if (activity.duration) completedDetails.push(`${Math.round(activity.duration / 60)} min`);
        if (activity.workoutRating) completedDetails.push(`Rating: ${activity.workoutRating}/10`);
        return completedDetails.length > 0 ? completedDetails.join(' • ') : 'Completed';
      case 'scheduledWorkout':
        return 'Complete your scheduled workout.';
      case 'habit':
        return '';
      case 'bodyStats':
        const stats = [];
        if (activity.weight) stats.push(`Weight: ${activity.weight}`);
        if (activity.bodyFat) stats.push(`BF: ${activity.bodyFat}%`);
        return stats.join(' • ');
      case 'appointment':
        return activity.description || activity.appointmentType || '';
      case 'photo':
        return activity.notes || `${activity.photoType} photo`;
      case 'reassessment':
        return activity.status === 'due' ? 'Due today' : 'Scheduled';
      default:
        return '';
    }
  };

  const getActivityBadgeColor = (activity: any) => {
    // Check for workout category tags based on workout name
    if (activity.type === 'scheduledWorkout' || activity.type === 'completedWorkout') {
      const workoutName = activity.title || activity.workoutName || '';
      const categoryTag = getWorkoutCategoryTag(workoutName);
      if (categoryTag) {
        return `${categoryTag.bgColor} text-foreground`;
      }
    }
    
    switch (activity.type) {
      case 'meal':
        return 'bg-orange-500 text-foreground';
      case 'workout':
      case 'completedWorkout':
        return 'bg-green-500 text-foreground';
      case 'scheduledWorkout':
        return 'bg-[#0cc9a9] text-black';
      case 'habit':
        return 'bg-purple-500 text-foreground';
      case 'photo':
        return 'bg-green-500 text-foreground';
      case 'appointment':
        return 'bg-pink-500 text-foreground';
      case 'bodyStats':
        return 'bg-teal-500 text-foreground';
      case 'goal':
        return 'bg-blue-500 text-foreground';
      case 'reassessment':
        return 'bg-[#0cc9a9] text-foreground';
      default:
        return 'bg-gray-500 text-foreground';
    }
  };

  const getActivityTagNameForActivity = (activity: any) => {
    // Check for workout category tags based on workout name
    if (activity.type === 'scheduledWorkout' || activity.type === 'completedWorkout') {
      const workoutName = activity.title || activity.workoutName || '';
      const categoryTag = getWorkoutCategoryTag(workoutName);
      if (categoryTag) {
        return categoryTag.label;
      }
    }
    
    switch (activity.type) {
      case 'meal':
        return 'Meal';
      case 'workout':
        return 'Workout';
      case 'completedWorkout':
        return 'Completed';
      case 'scheduledWorkout':
        return 'Workout';
      case 'habit':
        return 'Habit';
      case 'photo':
        return 'Progress Photo';
      case 'appointment':
        return 'Appointment';
      case 'bodyStats':
        return 'Body Stats';
      case 'goal':
        return 'Goal';
      case 'reassessment':
        return 'Reassessment';
      default:
        return activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
    }
  };

  const getCompletionStatusIcon = (activity: any) => {
    // Show status for habits, scheduled workouts, completed workouts, and reassessments
    if (
      activity.type !== 'habit' &&
      activity.type !== 'scheduledWorkout' &&
      activity.type !== 'completedWorkout' &&
      activity.type !== 'workout' &&
      activity.type !== 'reassessment'
    ) {
      return null;
    }

    // Completed workout logs and standalone workout sessions are, by definition, completed
    if (activity.type === 'completedWorkout' || activity.type === 'workout') {
      return <Check className="h-5 w-5 text-green-500" data-testid={`icon-completed-${activity.id}`} />;
    }

    if (activity.type === 'reassessment') {
      if (activity.status === 'completed') {
        return <Check className="h-5 w-5 text-green-500" data-testid={`icon-completed-${activity.id}`} />;
      }
      return <RefreshCw className="h-5 w-5 text-[#0cc9a9]" data-testid={`icon-pending-${activity.id}`} />;
    }

    if (activity.completed) {
      return <Check className="h-5 w-5 text-green-500" data-testid={`icon-completed-${activity.id}`} />;
    } else if (activity.missed) {
      return <X className="h-5 w-5 text-red-500" data-testid={`icon-missed-${activity.id}`} />;
    } else {
      return <Circle className="h-5 w-5 text-orange-400" data-testid={`icon-pending-${activity.id}`} />;
    }
  };

  // Get current visible month for header
  const currentDisplayMonth = months[0];

  const scrollToToday = () => {
    const today = new Date();
    const todayElement = document.querySelector(`[data-testid="day-${format(today, 'yyyy-MM-dd')}"]`);
    if (todayElement) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // If today is not loaded, reset months to current month
      setMonths([today]);
    }
  };

  const handleActivityClick = (e: React.MouseEvent, activity: any, dateKey: string) => {
    e.stopPropagation();
    
    if (activity.type === 'scheduledWorkout') {
      // Build calendar context params (shows date at top, enables move/edit actions)
      let calendarParams = `?source=calendar&date=${dateKey}`;
      
      // Pass scheduledId if this is an individually scheduled workout (can be moved/deleted)
      // Check for numeric IDs (individually scheduled workouts have numeric database IDs)
      if (activity.id && !String(activity.id).startsWith('programme-')) {
        calendarParams += `&scheduledId=${activity.id}`;
      }
      
      if (activity.workoutType === 'programme' && activity.enrollmentId && activity.week && activity.day) {
        // Programme workout - always use week 1 for lookup (since week 1 is the template)
        // but pass the actual week for display purposes
        navigate(`/workout-detail/${activity.enrollmentId}/1/${activity.day}${calendarParams}&displayWeek=${activity.week}`);
      } else if (activity.programmeWorkoutId) {
        // Programme workout via programmeWorkoutId
        navigate(`/training/workout/${activity.programmeWorkoutId}${calendarParams}`);
      } else if (activity.workoutId) {
        // Standalone/individual workout
        navigate(`/training/workout/${activity.workoutId}${calendarParams}`);
      }
    } else if (activity.type === 'completedWorkout') {
      // Navigate to workout detail page to view logged stats
      if (activity.enrollmentId && activity.week && activity.day) {
        // Programme workout - navigate with calendar context (shows completion view)
        let calendarParams = `?source=calendar&date=${dateKey}`;
        navigate(`/workout-detail/${activity.enrollmentId}/1/${activity.day}${calendarParams}&displayWeek=${activity.week}`);
      } else if (activity.workoutId) {
        // Standalone workout - navigate with completed context to show completion view
        navigate(`/training/workout/${activity.workoutId}?source=completed&logId=${activity.id}`);
      }
    } else if (activity.type === 'habit') {
      // Navigate to habits page (habits don't have individual detail pages)
      navigate('/habits');
    } else if (activity.type === 'reassessment') {
      // Navigate to body map for reassessment
      navigate('/training/body-map');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title="Calendar" 
        onTodayClick={scrollToToday}
        onBack={() => navigate('/')}
        useCloseIcon={true}
      />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {isLoadingPrevMonth && (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-gray-600">Loading previous month...</span>
            </div>
          )}
          <div className="space-y-0">
            {allDays.map((day, index) => {
              const hasActivities = day.activities.length > 0;
              const isCurrentDay = isToday(day.date);
              const isMondayDay = isMonday(day.date);
              const dayName = format(day.date, 'EEEE');
              const dateText = formatDate(day.date, 'monthDay');
              
              // Check if this is the first day of a new month
              const isFirstDayOfMonth = index === 0 || !isSameMonth(day.date, allDays[index - 1].date);

              return (
                <div key={day.date.toISOString()}>
                  {/* Week separator - add spacing before Monday */}
                  {isMondayDay && index > 0 && !isFirstDayOfMonth && (
                    <div className="h-6 bg-muted/30"></div>
                  )}
                  
                  <button
                    onClick={() => handleDayClick(day.date)}
                    className={`w-full text-left border-b border-border py-4 transition-colors ${isCurrentDay ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/30'}`}
                    data-testid={`day-${format(day.date, 'yyyy-MM-dd')}`}
                  >
                    {/* Day Header - clickable row */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <p className={`text-sm ${isCurrentDay ? 'text-primary font-semibold' : isMondayDay ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                        {dayName}
                      </p>
                      <p className={`text-lg font-medium ${isCurrentDay ? 'text-primary' : 'text-foreground'}`}>
                        {dateText}
                      </p>
                    </div>

                    {/* Activities for the Day - each in its own card */}
                    {hasActivities && (
                      <div className="space-y-2 mt-2">
                        {day.activities.map((activity, idx) => (
                          <div
                            key={`${activity.type}-${activity.id}-${idx}`}
                            className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={(e) => handleActivityClick(e, activity, format(day.date, 'yyyy-MM-dd'))}
                            data-testid={`activity-${activity.type}-${activity.id}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Completion Status Icon */}
                              {getCompletionStatusIcon(activity)}
                              
                              {/* Activity Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-foreground text-sm truncate" data-testid={`text-activity-title-${activity.id}`}>
                                    {activity.title || `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}`}
                                  </p>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                                </div>
                                {getActivitySummary(activity) && (
                                  <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-activity-summary-${activity.id}`}>
                                    {getActivitySummary(activity)}
                                  </p>
                                )}
                                {/* Colored Tag */}
                                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${getActivityBadgeColor(activity)}`}>
                                  {getActivityTagNameForActivity(activity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
            
            {/* Loading indicator for next month */}
            {isLoadingNextMonth && (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-gray-600">Loading next month...</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-28 right-5 z-20">
        <Button
          size="lg"
          className="rounded-full h-10 w-10 p-0"
          style={{ 
            background: '#0cc9a9',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.08)',
          }}
          onClick={() => handleDayClick(new Date())}
          data-testid="button-fab-add-activity"
        >
          <Plus className="h-5 w-5 text-black" />
        </Button>
      </div>

      {/* Action Menu - Bottom Sheet */}
      {currentView === 'menu' && selectedDate && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 flex items-end pb-16"
          onClick={handleCloseOverlay}
          data-testid="overlay-action-menu"
        >
          <div 
            className="bg-white w-full rounded-t-3xl p-6 animate-slide-up max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-action-menu"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" data-testid="text-action-menu-date">
                {format(selectedDate, 'EEEE, d MMMM yyyy')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseOverlay}
                data-testid="button-close-action-menu"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2 pb-2">
              <ActionButton
                icon={<Dumbbell className="h-6 w-6" />}
                label="Workout"
                colour="bg-blue-500"
                onClick={() => setCurrentView('workout')}
                testId="button-action-workout"
              />
              <ActionButton
                icon={<Activity className="h-6 w-6" />}
                label="Activity"
                colour="bg-green-500"
                onClick={() => setCurrentView('activity')}
                testId="button-action-activity"
              />
              <ActionButton
                icon={<Utensils className="h-6 w-6" />}
                label="Meal"
                colour="bg-orange-500"
                onClick={() => setCurrentView('meal')}
                testId="button-action-meal"
              />
              <ActionButton
                icon={<MapPin className="h-6 w-6" />}
                label="Body Map"
                colour="bg-purple-500"
                onClick={() => {
                  handleCloseOverlay();
                  window.location.href = '/body-map';
                }}
                testId="button-action-bodymap"
              />
              <ActionButton
                icon={<Image className="h-6 w-6" />}
                label="Photos"
                colour="bg-[#0cc9a9]"
                onClick={() => setCurrentView('photo')}
                testId="button-action-photos"
              />
              <ActionButton
                icon={<Scale className="h-6 w-6" />}
                label="Body stats"
                colour="bg-teal-500"
                onClick={() => setCurrentView('bodyStats')}
                testId="button-action-body-stats"
              />
            </div>
          </div>
        </div>
      )}

      {/* Workout Selector - Full Screen */}
      {currentView === 'workout' && selectedDate && (
        <WorkoutSelector
          selectedDate={selectedDate}
          onBack={() => setCurrentView('menu')}
          onSelectWorkout={(workout) => {
            console.log("Selected workout:", workout);
            handleCloseOverlay();
          }}
        />
      )}

      {/* Activity Selector - Full Screen */}
      {currentView === 'activity' && selectedDate && (
        <ActivitySelector
          selectedDate={selectedDate}
          onBack={() => setCurrentView('menu')}
          onSelectActivity={(activity) => {
            console.log("Selected activity:", activity);
            handleCloseOverlay();
          }}
        />
      )}

      {/* Meal Form - Full Screen */}
      {currentView === 'meal' && selectedDate && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          <div className="bg-card text-foreground px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('menu')}
              className="text-foreground hover:bg-muted"
              data-testid="button-back-meal"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-semibold">Log Meal</h1>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 bg-white overflow-auto p-6">
            <ActivityLogForm
              activityType="meal"
              selectedDate={selectedDate}
              onSuccess={handleCloseOverlay}
              onCancel={() => setCurrentView('menu')}
            />
          </div>
        </div>
      )}

      {/* Body Stats Form - Full Screen */}
      {currentView === 'bodyStats' && selectedDate && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          <div className="bg-card text-foreground px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('menu')}
              className="text-foreground hover:bg-muted"
              data-testid="button-back-bodystats"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-semibold">Log Body Stats</h1>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 bg-white overflow-auto p-6">
            <ActivityLogForm
              activityType="bodyStats"
              selectedDate={selectedDate}
              onSuccess={handleCloseOverlay}
              onCancel={() => setCurrentView('menu')}
            />
          </div>
        </div>
      )}

      {/* Photo Form - Full Screen */}
      {currentView === 'photo' && selectedDate && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          <div className="bg-card text-foreground px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('menu')}
              className="text-foreground hover:bg-muted"
              data-testid="button-back-photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-semibold">Log Progress Photo</h1>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 bg-white overflow-auto p-6">
            <ActivityLogForm
              activityType="photo"
              selectedDate={selectedDate}
              onSuccess={handleCloseOverlay}
              onCancel={() => setCurrentView('menu')}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Action Button Component
function ActionButton({ 
  icon, 
  label, 
  colour, 
  onClick,
  testId 
}: { 
  icon: React.ReactNode; 
  label: string; 
  colour: string; 
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
      data-testid={testId}
    >
      <div className={`${colour} p-3 rounded-full text-foreground`}>
        {icon}
      </div>
      <span className="text-lg font-medium text-gray-900">{label}</span>
    </button>
  );
}
