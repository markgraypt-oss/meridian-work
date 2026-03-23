import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, Component, ReactNode } from "react";
import TopHeader from "@/components/TopHeader";
import MuxPlayer from "@mux/mux-player-react";
import { getMuxThumbnailUrl } from "@/lib/mux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Plus, Minus, ChevronRight, Dumbbell, Calendar, Loader2, Check } from "lucide-react";

class MuxPlayerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: false };
  }
  componentDidCatch() {}
  render() {
    return this.props.children;
  }
}

function AddToWorkoutDrawer({ exerciseId, exerciseName, exerciseType, open, onClose }: {
  exerciseId: number;
  exerciseName: string;
  exerciseType: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<'select-workout' | 'configure' | 'scope'>('select-workout');
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);

  const [numSets, setNumSets] = useState(3);
  const [reps, setReps] = useState('10');
  const [rest, setRest] = useState('60 sec');
  const [duration, setDuration] = useState('30');
  const [load, setLoad] = useState('');

  const isTimeBased = exerciseType === 'timed' || exerciseType === 'timed_strength' || exerciseType === 'general' || exerciseType === 'cardio';

  const { data: timeline, isLoading: timelineLoading } = useQuery<any>({
    queryKey: ['/api/my-programs/timeline'],
    enabled: open,
  });

  const activeEnrollments = timeline ? [
    ...(timeline.current ? [timeline.current] : []),
    ...(timeline.supplementary || []),
  ].filter((e: any) => e.status === 'active' || e.status === 'scheduled') : [];

  const allEnrollmentIds = activeEnrollments.map((e: any) => e.id);

  const workoutQueries = useQueries({
    queries: allEnrollmentIds.map((eid: number) => ({
      queryKey: ['/api/my-programs', eid, 'enrollment-workouts'],
      queryFn: async () => {
        const res = await fetch(`/api/my-programs/${eid}/enrollment-workouts`);
        if (!res.ok) throw new Error('Failed to fetch workouts');
        return res.json();
      },
      enabled: open && eid != null,
    })),
  });

  const workoutsByEnrollment: Record<number, any[]> = {};
  const workoutsLoading = workoutQueries.some((q) => q.isLoading);
  allEnrollmentIds.forEach((eid: number, idx: number) => {
    if (workoutQueries[idx]?.data) {
      workoutsByEnrollment[eid] = workoutQueries[idx].data;
    }
  });

  const getEnrollmentPosition = (enrollment: any) => {
    if (!enrollment?.startDate) return { week: 1, day: 1 };
    const start = new Date(enrollment.startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const week = Math.max(1, Math.floor(diffDays / 7) + 1);
    const day = (diffDays % 7) + 1;
    return { week, day };
  };

  const addExerciseMutation = useMutation({
    mutationFn: async (data: { applyScope: 'next' | 'all_future' }) => {
      const sets = Array.from({ length: numSets }, () => {
        const setObj: any = {};
        if (isTimeBased) {
          setObj.duration = `${duration} sec`;
        } else {
          setObj.reps = reps;
        }
        if (rest && rest !== 'No Rest') {
          setObj.rest = rest;
        }
        return setObj;
      });

      const enrollment = activeEnrollments.find((e: any) => e.id === selectedEnrollmentId);
      const position = getEnrollmentPosition(enrollment);

      return apiRequest('POST', `/api/my-programs/${selectedEnrollmentId}/add-exercise-to-workout`, {
        templateWorkoutId: selectedWorkout.templateWorkoutId,
        exerciseLibraryId: exerciseId,
        sets,
        durationType: isTimeBased ? 'timer' : 'text',
        load: load || undefined,
        applyScope: data.applyScope,
        currentWeekNumber: position.week,
        currentDayNumber: position.day,
      });
    },
    onSuccess: async (response: any) => {
      const data = await response.json();
      toast({
        title: "Exercise Added",
        description: `${exerciseName} has been added to ${selectedWorkout.name}${data.added > 1 ? ` (${data.added} workout instances)` : ''}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/programme-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workout-detail'] });
      handleReset();
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add exercise to workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReset = () => {
    setStep('select-workout');
    setSelectedWorkout(null);
    setSelectedEnrollmentId(null);
    setNumSets(3);
    setReps('10');
    setRest('60 sec');
    setDuration('30');
    setLoad('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg">
            {step === 'select-workout' && 'Add to Workout'}
            {step === 'configure' && 'Configure Exercise'}
            {step === 'scope' && 'Apply Changes'}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto max-h-[65vh]">
          {step === 'select-workout' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                Select a workout to add <span className="font-semibold text-primary">{exerciseName}</span> to:
              </p>

              {timelineLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : activeEnrollments.length === 0 ? (
                <div className="text-center py-8">
                  <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No active training programme found.</p>
                  <p className="text-xs text-muted-foreground mt-1">Enrol in a programme first to add exercises.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeEnrollments.map((enrollment: any) => (
                    <div key={enrollment.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          {enrollment.programTitle || enrollment.program?.title || 'Programme'}
                        </span>
                      </div>
                      {workoutsLoading && !workoutsByEnrollment[enrollment.id] ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      ) : workoutsByEnrollment[enrollment.id]?.length ? (
                        <div className="space-y-1 ml-6">
                          {workoutsByEnrollment[enrollment.id].map((workout: any) => (
                            <button
                              key={workout.id}
                              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                              onClick={() => {
                                setSelectedEnrollmentId(enrollment.id);
                                setSelectedWorkout(workout);
                                setStep('configure');
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{workout.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Day {workout.dayNumber} · {workout.category || workout.workoutType}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      ) : !workoutsLoading ? (
                        <p className="text-xs text-muted-foreground ml-6">No workouts found</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-5">
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground">Adding to</p>
                <p className="text-sm font-semibold text-foreground">{selectedWorkout?.name}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Number of Sets</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setNumSets(Math.max(1, numSets - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-bold text-foreground w-8 text-center">{numSets}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setNumSets(Math.min(10, numSets + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isTimeBased ? (
                <div>
                  <Label className="text-sm font-medium">Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-1"
                    placeholder="30"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-medium">Reps per Set</Label>
                  <Input
                    type="text"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="mt-1"
                    placeholder="10"
                  />
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Rest Between Sets</Label>
                <select
                  value={rest}
                  onChange={(e) => setRest(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                >
                  <option value="No Rest">No Rest</option>
                  <option value="5 sec">5 sec</option>
                  <option value="10 sec">10 sec</option>
                  <option value="15 sec">15 sec</option>
                  <option value="20 sec">20 sec</option>
                  <option value="25 sec">25 sec</option>
                  <option value="30 sec">30 sec</option>
                  <option value="35 sec">35 sec</option>
                  <option value="40 sec">40 sec</option>
                  <option value="45 sec">45 sec</option>
                  <option value="50 sec">50 sec</option>
                  <option value="55 sec">55 sec</option>
                  <option value="1 min">1 min</option>
                  <option value="1 min 15 sec">1 min 15 sec</option>
                  <option value="1 min 30 sec">1 min 30 sec</option>
                  <option value="1 min 45 sec">1 min 45 sec</option>
                  <option value="2 min">2 min</option>
                  <option value="2 min 15 sec">2 min 15 sec</option>
                  <option value="2 min 30 sec">2 min 30 sec</option>
                  <option value="2 min 45 sec">2 min 45 sec</option>
                  <option value="3 min">3 min</option>
                  <option value="3 min 15 sec">3 min 15 sec</option>
                  <option value="3 min 30 sec">3 min 30 sec</option>
                  <option value="3 min 45 sec">3 min 45 sec</option>
                  <option value="4 min">4 min</option>
                  <option value="4 min 15 sec">4 min 15 sec</option>
                  <option value="4 min 30 sec">4 min 30 sec</option>
                  <option value="4 min 45 sec">4 min 45 sec</option>
                  <option value="5 min">5 min</option>
                  <option value="6 min">6 min</option>
                </select>
              </div>

              {(exerciseType === 'strength' || exerciseType === 'timed_strength') && (
                <div>
                  <Label className="text-sm font-medium">Load (optional)</Label>
                  <Input
                    type="text"
                    value={load}
                    onChange={(e) => setLoad(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. 30kg, bodyweight"
                  />
                </div>
              )}

              <Button
                className="w-full mt-2"
                onClick={() => setStep('scope')}
              >
                Next
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('select-workout');
                  setSelectedWorkout(null);
                }}
              >
                Back
              </Button>
            </div>
          )}

          {step === 'scope' && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground">Adding</p>
                <p className="text-sm font-semibold text-primary">{exerciseName}</p>
                <p className="text-xs text-muted-foreground mt-1">to {selectedWorkout?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {numSets} sets × {isTimeBased ? `${duration}s` : `${reps} reps`} · {rest}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                How would you like to apply this change?
              </p>

              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                onClick={() => addExerciseMutation.mutate({ applyScope: 'next' })}
                disabled={addExerciseMutation.isPending}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Next scheduled workout</p>
                    <p className="text-xs text-muted-foreground">Add to the next upcoming instance of this workout</p>
                  </div>
                </div>
              </button>

              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                onClick={() => addExerciseMutation.mutate({ applyScope: 'all_future' })}
                disabled={addExerciseMutation.isPending}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">All future weeks</p>
                    <p className="text-xs text-muted-foreground">Add to this workout for the remaining programme</p>
                  </div>
                </div>
              </button>

              {addExerciseMutation.isPending && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Adding exercise...</span>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep('configure')}
                disabled={addExerciseMutation.isPending}
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function ExerciseDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const isFromWorkout = !!new URLSearchParams(window.location.search).get('returnTo');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const handleBack = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const returnTo = searchParams.get('returnTo');
    
    if (returnTo) {
      window.history.back();
    } else {
      const scrollPosition = sessionStorage.getItem('exerciseLibraryScrollPosition');
      navigate('/training?tab=exercise-library');
      if (scrollPosition) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(scrollPosition, 10));
        }, 100);
      }
    }
  };

  const { data: exercise, isLoading } = useQuery<any>({
    queryKey: ['/api/exercises', id],
    queryFn: async () => {
      const res = await fetch(`/api/exercises/${id}`);
      if (!res.ok) throw new Error('Failed to fetch exercise');
      return res.json();
    },
    enabled: isAuthenticated && !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exercise...</p>
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Exercise not found</p>
      </div>
    );
  }

  const instructionsList = exercise.instructions
    ? exercise.instructions.split(/\n/).filter((line: string) => line.trim())
    : [];

  const tags = [];
  if (exercise.mainMuscle && exercise.mainMuscle.length > 0) {
    tags.push(...exercise.mainMuscle);
  }
  if (exercise.equipment && exercise.equipment.length > 0) {
    tags.push(...exercise.equipment);
  }
  if (exercise.movement && exercise.movement.length > 0) {
    tags.push(...exercise.movement);
  }
  if (exercise.mechanics && exercise.mechanics.length > 0) {
    tags.push(...exercise.mechanics);
  }
  if (exercise.level) {
    tags.push(exercise.level);
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        onBack={handleBack}
      />

      <div className="relative bg-black aspect-video w-full overflow-hidden">
        {exercise.muxPlaybackId && exercise.muxPlaybackId.length >= 10 ? (
          <MuxPlayerErrorBoundary>
            <MuxPlayer
              playbackId={exercise.muxPlaybackId}
              streamType="on-demand"
              style={{ width: '100%', height: '100%' }}
              poster={getMuxThumbnailUrl(exercise.muxPlaybackId) || undefined}
              data-testid="mux-player-exercise"
            />
          </MuxPlayerErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <p className="text-gray-400 text-lg font-medium">Video coming soon</p>
          </div>
        )}
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-primary mb-2">
          {exercise.name}
        </h1>

        {exercise.exerciseType && (
          <p className="text-sm font-semibold text-muted-foreground mb-4">
            {exercise.exerciseType === 'strength' && 'Strength (Weight + Reps, e.g. bench press)'}
            {exercise.exerciseType === 'endurance' && 'Endurance (Reps only, no weight, e.g. push up)'}
            {exercise.exerciseType === 'cardio' && 'Cardio (e.g. running, cycling)'}
            {exercise.exerciseType === 'timed' && 'Timed (Time-based only, e.g. plank)'}
            {exercise.exerciseType === 'timed_strength' && 'Timed Strength (Time + Weight, e.g. farmer\'s carry)'}
            {exercise.exerciseType === 'general' && 'General (Time only, e.g. foam rolling, stretching)'}
          </p>
        )}

        {!isFromWorkout && (
          <Button
            className="w-full mb-6 gap-2"
            onClick={() => setShowAddDrawer(true)}
          >
            <Plus className="h-4 w-4" />
            Add to Workout
          </Button>
        )}

        {instructionsList.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Text Instructions</h2>
            </div>
            <ol className="space-y-3">
              {instructionsList.map((instruction: string, idx: number) => (
                <li key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 font-bold text-foreground text-sm">{idx + 1}.</span>
                  <span className="text-sm text-foreground leading-relaxed">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Tags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddToWorkoutDrawer
        exerciseId={parseInt(id!)}
        exerciseName={exercise.name}
        exerciseType={exercise.exerciseType || 'strength'}
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
      />
    </div>
  );
}
