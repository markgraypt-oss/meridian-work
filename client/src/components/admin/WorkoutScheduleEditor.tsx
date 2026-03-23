import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Dumbbell, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ScheduleDay {
  dayId: number;
  position: number;
  dayName: string;
  workouts: Array<{
    id: number;
    name: string;
    workoutType: string;
    category: string;
    duration: number;
  }>;
}

interface ScheduleWeek {
  weekId: number;
  weekNumber: number;
  days: ScheduleDay[];
}

interface ScheduleData {
  schedule: ScheduleWeek[];
  workouts: Array<{
    id: number;
    name: string;
    dayId: number;
    workoutType: string;
    category: string;
    duration: number;
  }>;
}

interface WorkoutScheduleEditorProps {
  programId: number;
  totalWeeks: number;
}

export function WorkoutScheduleEditor({ programId, totalWeeks }: WorkoutScheduleEditorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draggedWorkout, setDraggedWorkout] = useState<number | null>(null);

  const { data: scheduleData, isLoading } = useQuery<ScheduleData>({
    queryKey: ['/api/programs', programId, 'schedule'],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${programId}/schedule`);
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
  });

  const assignDayMutation = useMutation({
    mutationFn: async ({ workoutId, dayId }: { workoutId: number; dayId: number }) => {
      const res = await apiRequest('PATCH', `/api/programme-workouts/${workoutId}/assign-day`, { dayId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'schedule'] });
      toast({
        title: "Schedule updated",
        description: "Workout has been moved to the new day.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update schedule.",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (e: React.DragEvent, workoutId: number) => {
    setDraggedWorkout(workoutId);
    e.dataTransfer.setData('workoutId', workoutId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dayId: number) => {
    e.preventDefault();
    const workoutId = parseInt(e.dataTransfer.getData('workoutId'));
    if (workoutId && dayId) {
      assignDayMutation.mutate({ workoutId, dayId });
    }
    setDraggedWorkout(null);
  };

  const handleDragEnd = () => {
    setDraggedWorkout(null);
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading schedule...</div>;
  }

  // Always show Week 1 as it's the template for all weeks
  const week1Schedule = scheduleData?.schedule.find(w => w.weekNumber === 1);
  const allWorkouts = scheduleData?.workouts || [];

  const getWorkoutTypeColor = (type: string) => {
    switch (type) {
      case 'interval': return 'bg-[#0cc9a9]/20 text-[#0cc9a9] border-[#0cc9a9]/30';
      case 'circuit': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'video': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Weekly Schedule</h3>
        <p className="text-sm text-muted-foreground">
          Drag workouts between days to reschedule. This schedule repeats for all {totalWeeks} weeks.
        </p>
      </div>

      {allWorkouts.length === 0 ? (
        <Card className="bg-card border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No workouts created yet. Add workouts in the "Workouts" tab first, then come back here to schedule them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {week1Schedule?.days.map((day) => (
              <Card 
                key={day.dayId}
                className={`transition-all ${
                  draggedWorkout ? 'border-dashed border-primary/50 bg-primary/5' : ''
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day.dayId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 flex-shrink-0">
                      <div className="text-sm font-semibold text-foreground">Day {day.position + 1}</div>
                    </div>
                    <div className="flex-1 min-h-[48px]">
                      {day.workouts.length === 0 ? (
                        <div className="text-sm text-muted-foreground/50 py-3 px-4 border border-dashed rounded-lg text-center">
                          Rest Day - Drop workout here
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {day.workouts.map((workout) => (
                            <div
                              key={workout.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, workout.id)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-move transition-all ${
                                draggedWorkout === workout.id ? 'opacity-50 scale-98' : 'hover:bg-foreground/5'
                              } ${getWorkoutTypeColor(workout.workoutType)}`}
                            >
                              <GripVertical className="h-4 w-4 flex-shrink-0" />
                              <Dumbbell className="h-4 w-4 flex-shrink-0" />
                              <span className="font-medium flex-1 truncate">{workout.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) || (
              <div className="text-center text-muted-foreground py-8">
                No days configured for this programme yet.
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Drag workouts between days to reschedule them. Workouts are automatically placed starting from Day 1.
          </div>
        </>
      )}
    </div>
  );
}
