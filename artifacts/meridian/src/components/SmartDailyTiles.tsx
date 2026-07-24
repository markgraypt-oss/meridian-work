import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dumbbell,
  Target,
  Wind,
  Video,
  Check,
  Clock,
  Zap,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import type { ReassessmentReminder } from "@shared/schema";

interface SmartDailyTilesProps {
  selectedDate?: Date;
}

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
}

interface SmartDailyTile {
  id: string;
  type: "workout" | "habit" | "breath" | "video" | "checkin" | "reassessment" | "learn";
  title: string;
  description?: string;
  icon: React.ReactNode;
  action?: () => void;
  link?: string;
  status?: "pending" | "completed" | "in-progress";
  progress?: number;
  metadata?: Record<string, any>;
  isRelevant: boolean;
  isNew?: boolean;
  tag?: { label: string; color: string };
}

const getCategoryColor = (category: string): string => {
  switch (category?.toLowerCase()) {
    case 'strength':
      return 'bg-blue-500 text-white';
    case 'cardio':
      return 'bg-orange-500 text-white';
    case 'hiit':
      return 'bg-red-500 text-white';
    case 'mobility':
      return 'bg-green-500 text-white';
    case 'recovery':
      return 'bg-purple-500 text-white';
    case 'stretching':
      return 'bg-teal-500 text-white';
    case 'corrective':
      return 'bg-[#0cc9a9] text-black';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getTypeTag = (type: string): { label: string; color: string } => {
  switch (type) {
    case 'workout':
      return { label: 'Workout', color: 'bg-blue-500 text-white' };
    case 'habit':
      return { label: 'Habit', color: 'bg-green-500 text-white' };
    case 'breath':
      return { label: 'Breath', color: 'bg-cyan-500 text-white' };
    case 'video':
      return { label: 'Education', color: 'bg-purple-500 text-white' };
    case 'checkin':
      return { label: 'Check-in', color: 'bg-[#0cc9a9] text-black' };
    case 'reassessment':
      return { label: 'Reassessment', color: 'bg-red-500 text-white' };
    case 'learn':
      return { label: 'The Lab', color: 'bg-indigo-500 text-white' };
    default:
      return { label: type, color: 'bg-gray-500 text-white' };
  }
};

export default function SmartDailyTiles({ selectedDate }: SmartDailyTilesProps = {}) {
  const dateParam = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  
  const { data: todayWorkouts } = useQuery<TodayWorkout[]>({
    queryKey: dateParam ? ['/api/today-workouts', { date: dateParam }] : ['/api/today-workouts'],
    queryFn: async () => {
      const url = dateParam ? `/api/today-workouts?date=${dateParam}` : '/api/today-workouts';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
  });

  const { data: dueReminders } = useQuery<ReassessmentReminder[]>({
    queryKey: dateParam 
      ? [`/api/reassessment-reminders/on-date?date=${dateParam}`]
      : ['/api/reassessment-reminders/due'],
  });

  const workoutTiles: SmartDailyTile[] = (todayWorkouts || []).map((workout) => {
    const link = workout.isProgramme
      ? `/workout-detail/${workout.enrollmentId}/${workout.week}/${workout.day}`
      : workout.isScheduled && workout.workoutId
        ? `/workouts/${workout.workoutId}`
        : '#';
    
    return {
      id: workout.id,
      type: "workout",
      title: workout.workoutName,
      description: "Complete your scheduled workout",
      icon: <Dumbbell className="h-5 w-5" />,
      link,
      status: "pending",
      isRelevant: true,
      tag: { label: workout.category || 'Workout', color: getCategoryColor(workout.category) },
      metadata: { isExtra: workout.isExtra },
    };
  });

  if (workoutTiles.length === 0) {
    workoutTiles.push({
      id: "workout-none",
      type: "workout",
      title: "No Workout Scheduled",
      description: "No workout scheduled for today",
      icon: <Dumbbell className="h-5 w-5" />,
      status: "pending",
      isRelevant: false,
      tag: getTypeTag('workout'),
    });
  }

  const otherTiles: SmartDailyTile[] = [
    {
      id: "habit",
      type: "habit",
      title: "Daily Habits",
      description: "Track your daily habits",
      icon: <Target className="h-5 w-5" />,
      link: "/goals",
      status: "pending",
      isRelevant: true,
      tag: getTypeTag('habit'),
    },
    {
      id: "breath",
      type: "breath",
      title: "Breath Session",
      description: "Box Breathing - 5 min",
      icon: <Wind className="h-5 w-5" />,
      link: "/recovery/breath-work",
      status: "pending",
      isRelevant: true,
      tag: getTypeTag('breath'),
    },
    {
      id: "learn",
      type: "learn",
      title: "Continue Learning",
      description: "Sleep Optimization Masterclass",
      icon: <BookOpen className="h-5 w-5" />,
      link: "/education-lab",
      progress: 35,
      isRelevant: true,
      tag: getTypeTag('learn'),
    },
    {
      id: "video",
      type: "video",
      title: "Assigned Education",
      description: "Watch your assigned content",
      icon: <Video className="h-5 w-5" />,
      link: "/education-lab",
      status: "pending",
      isRelevant: true,
      tag: getTypeTag('video'),
    },
  ];

  const reassessmentTiles: SmartDailyTile[] = (dueReminders || []).map((reminder, index) => {
    const bodyAreaLabel = reminder.bodyArea.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return {
      id: `reassessment-${reminder.id}`,
      type: "reassessment" as const,
      title: "Reassessment Due",
      description: `It's time to reassess your ${bodyAreaLabel}`,
      icon: <AlertCircle className="h-5 w-5" />,
      link: `/training/body-map?area=${reminder.bodyArea}`,
      status: "pending" as const,
      isRelevant: true,
      isNew: true,
      tag: getTypeTag('reassessment'),
    };
  });

  const allTiles = [...reassessmentTiles, ...workoutTiles, ...otherTiles];

  return (
    <section className="py-12 bg-gray-100 w-full" data-testid="smart-daily-tiles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <h2 className="text-2xl font-bold text-neutral-dark mb-6 w-full" data-testid="smart-tiles-heading">Today's Smart Tasks</h2>

        <div className="space-y-3 w-full">
          {allTiles?.map((tile: SmartDailyTile) => (
            <a
              key={tile.id}
              href={tile.link || "#"}
              className="block"
              onClick={(e) => {
                if (!tile.link && tile.action) {
                  e.preventDefault();
                  tile.action();
                }
              }}
            >
              <Card className="hover:shadow-md transition-all cursor-pointer bg-white">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      {tile.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {tile.title}
                        </h3>
                        {tile.isNew && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            NEW
                          </Badge>
                        )}
                        {tile.metadata?.isExtra && (
                          <Badge variant="outline" className="text-xs border-dashed">
                            Extra
                          </Badge>
                        )}
                      </div>

                      {tile.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {tile.description}
                        </p>
                      )}

                      {tile.tag && (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tile.tag.color}`}>
                          {tile.tag.label}
                        </span>
                      )}

                      {tile.progress !== undefined && tile.progress > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={tile.progress} className="flex-1 h-1" />
                          <span className="text-xs text-muted-foreground">
                            {tile.progress}%
                          </span>
                        </div>
                      )}

                      {!tile.tag && (
                        <div className="flex items-center gap-3 mt-2">
                          {tile.status === "completed" && (
                            <div className="flex items-center gap-1 text-green-600 text-xs">
                              <Check className="h-4 w-4" />
                              Completed
                            </div>
                          )}

                          {tile.status === "pending" && (
                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Clock className="h-4 w-4" />
                              Pending
                            </div>
                          )}

                          {tile.status === "in-progress" && (
                            <div className="flex items-center gap-1 text-primary text-xs">
                              <Zap className="h-4 w-4" />
                              In Progress
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {tile.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                        data-testid={`tile-cta-${tile.id}`}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    )}

                    {tile.status === "completed" && (
                      <div className="flex-shrink-0 p-2 rounded-lg bg-green-100 text-green-600">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
