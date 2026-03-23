import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle2, 
  Clock, 
  Save, 
  X, 
  Star
} from "lucide-react";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { kgToLbs } from "@/lib/unitConversions";

const DURATION_OPTIONS = [
  "No Rest", "5 sec", "10 sec", "15 sec", "20 sec", "25 sec", "30 sec", "35 sec", "40 sec", "45 sec", "50 sec", "55 sec",
  "1 min", "1 min 15 sec", "1 min 30 sec", "1 min 45 sec",
  "2 min", "2 min 15 sec", "2 min 30 sec", "2 min 45 sec",
  "3 min", "3 min 15 sec", "3 min 30 sec", "3 min 45 sec",
  "4 min", "4 min 15 sec"
];
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SetLog {
  id: number;
  setNumber: number;
  targetReps?: string;
  actualReps?: number;
  targetWeight?: number;
  actualWeight?: number;
  targetDuration?: string;
  actualDuration?: string;
  actualDurationMinutes?: number;
  actualDurationSeconds?: number;
  isCompleted: boolean;
  setDifficultyRating?: string;
  painFlag?: boolean;
  failureFlag?: boolean;
}

interface ExerciseLog {
  id: number;
  exerciseName: string;
  exerciseLibraryId?: number;
  blockType?: string;
  blockGroupId?: string;
  section?: string;
  position: number;
  restPeriod?: string;
  durationType?: string;
  exerciseType?: string;
  targetDuration?: string;
  targetReps?: string;
  sets: SetLog[];
  kind?: string;
  restDuration?: number;
}

interface WorkoutLogData {
  id: number;
  workoutName: string;
  workoutType: string;
  startedAt: string;
  completedAt: string;
  duration?: number;
  workoutRating?: number;
  autoCalculatedVolume?: number;
  notes?: string;
  exercises: ExerciseLog[];
}

interface WorkoutCompletionViewProps {
  workoutLog: WorkoutLogData;
  onDelete: () => void;
  isEditing?: boolean;
  onEditModeChange?: (editing: boolean) => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatSetDisplay(set: SetLog, exerciseType?: string, durationType?: string, weightUnit: 'kg' | 'lbs' = 'kg'): string {
  // Check if this is a timer-based exercise first
  const isTimerExercise = exerciseType === 'general' || durationType === 'time' || durationType === 'timer';
  
  // For timer exercises, show duration
  if (isTimerExercise) {
    if (set.actualDuration) {
      return set.actualDuration;
    } else if (set.actualDurationMinutes || set.actualDurationSeconds) {
      const mins = set.actualDurationMinutes || 0;
      const secs = set.actualDurationSeconds || 0;
      if (mins > 0 && secs > 0) {
        return `${mins}m ${secs}s`;
      } else if (mins > 0) {
        return `${mins}m`;
      } else if (secs > 0) {
        return `${secs}s`;
      }
    }
    if (set.targetDuration) {
      return set.targetDuration;
    }
    return 'Completed';
  }
  
  // For rep-based exercises, prioritize showing actual reps/weight
  const parts: string[] = [];
  
  if (set.actualReps !== undefined && set.actualReps !== null && set.actualReps > 0) {
    parts.push(`${set.actualReps} reps`);
  }
  
  if (set.actualWeight !== undefined && set.actualWeight !== null && set.actualWeight > 0) {
    const displayWeight = weightUnit === 'lbs' ? kgToLbs(set.actualWeight) : set.actualWeight;
    parts.push(`@ ${Math.round(displayWeight * 10) / 10} ${weightUnit}`);
  }
  
  if (parts.length === 0) {
    // Show dash for missing data
    return '—';
  }
  
  return parts.join(' ');
}

export function WorkoutCompletionView({ workoutLog, onDelete, isEditing: externalIsEditing, onEditModeChange }: WorkoutCompletionViewProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { preferences } = useUserPreferences();
  const weightUnit = preferences.weightUnit || 'kg';
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  
  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
  const setIsEditing = (value: boolean) => {
    if (onEditModeChange) {
      onEditModeChange(value);
    } else {
      setInternalIsEditing(value);
    }
  };
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedSets, setEditedSets] = useState<Record<number, Partial<SetLog>>>({});

  const deleteWorkoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/workout-logs/${workoutLog.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Workout Deleted",
        description: "The workout log has been removed. You can now redo this workout.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs/timeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      onDelete();
      navigate('/');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete workout log",
        variant: "destructive",
      });
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async ({ setId, updates }: { setId: number; updates: Partial<SetLog> }) => {
      await apiRequest('PATCH', `/api/set-logs/${setId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  const handleSaveChanges = async () => {
    const updates = Object.entries(editedSets);
    for (const [setIdStr, changes] of updates) {
      await updateSetMutation.mutateAsync({ setId: parseInt(setIdStr), updates: changes });
    }
    setIsEditing(false);
    setEditedSets({});
    toast({
      title: "Changes Saved",
      description: "Your workout log has been updated.",
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSets({});
  };

  const handleSetChange = (setId: number, field: keyof SetLog, value: any) => {
    setEditedSets(prev => ({
      ...prev,
      [setId]: {
        ...prev[setId],
        [field]: value,
      },
    }));
  };

  const completedDate = new Date(workoutLog.completedAt);
  const totalSets = workoutLog.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = workoutLog.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.isCompleted).length, 
    0
  );

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-green-900/20 border-green-600/30">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-400">Workout Completed</h3>
            <p className="text-sm text-muted-foreground">
              {format(completedDate, 'EEEE, d MMMM yyyy')} at {format(completedDate, 'HH:mm')}
            </p>
          </div>
          {workoutLog.workoutRating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-[#0cc9a9] fill-[#0cc9a9]" />
              <span className="text-sm font-medium">{workoutLog.workoutRating}/10</span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>{workoutLog.duration ? formatDuration(workoutLog.duration) : 'N/A'}</span>
        </div>
        {workoutLog.autoCalculatedVolume && workoutLog.autoCalculatedVolume > 0 && (
          <div className="flex items-center gap-1">
            <span>{Math.round(weightUnit === 'lbs' ? kgToLbs(workoutLog.autoCalculatedVolume) : workoutLog.autoCalculatedVolume)} {weightUnit} volume</span>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSaveChanges}
            disabled={updateSetMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {updateSetMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelEdit}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      <Separator />

      <div className="space-y-6">
        {(() => {
          // Filter out rest blocks - they are circuit separators, not displayable exercises
          const isRestBlock = (ex: ExerciseLog) => 
            ex.kind === 'rest' || 
            ex.blockType === 'rest' || 
            ex.exerciseName?.toLowerCase() === 'rest';
          
          const warmupExercises = workoutLog.exercises.filter(ex => ex.section === 'warmup' && !isRestBlock(ex));
          const mainExercises = workoutLog.exercises.filter(ex => ex.section !== 'warmup' && !isRestBlock(ex));
          
          // Group main exercises by blockGroupId for proper superset labeling
          const getExerciseLabel = (exercise: ExerciseLog, exercises: ExerciseLog[], isWarmup: boolean): string => {
            if (isWarmup) {
              const warmupIndex = exercises.indexOf(exercise);
              return String.fromCharCode(65 + warmupIndex); // A, B, C...
            }
            
            // For main exercises, group by blockGroupId to create superset labels (1A, 1B, 2A, 2B...)
            const blockGroups: string[] = [];
            exercises.forEach(ex => {
              const groupId = ex.blockGroupId || `single-${ex.id}`;
              if (!blockGroups.includes(groupId)) {
                blockGroups.push(groupId);
              }
            });
            
            const exerciseGroupId = exercise.blockGroupId || `single-${exercise.id}`;
            const blockNumber = blockGroups.indexOf(exerciseGroupId) + 1;
            
            // Find index within the block group
            const groupExercises = exercises.filter(ex => (ex.blockGroupId || `single-${ex.id}`) === exerciseGroupId);
            const indexInGroup = groupExercises.indexOf(exercise);
            
            if (groupExercises.length === 1) {
              return `${blockNumber}`; // Single exercise: just number
            }
            return `${blockNumber}${String.fromCharCode(65 + indexInGroup)}`; // Superset: 1A, 1B, etc.
          };
          
          const renderExerciseCard = (exercise: ExerciseLog, exercises: ExerciseLog[], isWarmup: boolean) => (
            <Card key={exercise.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold">
                  {getExerciseLabel(exercise, exercises, isWarmup)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{exercise.exerciseName}</h4>
                </div>
              </div>

              <div className="space-y-0.5 pl-11">
                {(() => {
                  // For circuit workouts, limit sets to the configured rounds
                  const workoutStyle = (workoutLog as any).workoutStyle;
                  const isCircuitWorkout = workoutStyle === 'circuit';
                  // Get rounds from intervalRounds or derive from first main exercise's set count
                  const mainExs = workoutLog.exercises.filter(ex => ex.section !== 'warmup');
                  const derivedRounds = (workoutLog as any).intervalRounds || 
                    (isCircuitWorkout && mainExs[0]?.sets?.length) || exercise.sets.length;
                  const maxSets = (isCircuitWorkout && !isWarmup) ? derivedRounds : exercise.sets.length;
                  const setsToShow = exercise.sets.slice(0, maxSets);
                  
                  return setsToShow.map((set) => {
                  const edited = editedSets[set.id] || {};
                  const currentReps = edited.actualReps ?? set.actualReps ?? '';
                  const currentWeight = edited.actualWeight ?? set.actualWeight ?? '';
                  const isTimerExercise = exercise.durationType === 'timer' || exercise.durationType === 'time' || exercise.exerciseType === 'general';
                  
                  return (
                    <div 
                      key={set.id} 
                      className={`flex items-center gap-2 py-1 px-2 rounded-lg ${
                        set.isCompleted ? 'bg-muted/50' : 'bg-muted/20'
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {set.setNumber}
                      </div>
                      
                      {isEditing ? (
                        isTimerExercise ? (
                          <div className="w-32">
                            <label className="text-xs text-muted-foreground">Duration</label>
                            <Select
                              value={edited.actualDuration ?? set.actualDuration ?? set.targetDuration ?? '30 sec'}
                              onValueChange={(value) => handleSetChange(set.id, 'actualDuration', value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DURATION_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-muted-foreground">Weight ({weightUnit})</label>
                              <Input
                                type="number"
                                step="0.5"
                                value={currentWeight}
                                onChange={(e) => handleSetChange(set.id, 'actualWeight', parseFloat(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-muted-foreground">Reps</label>
                              <Input
                                type="number"
                                value={currentReps}
                                onChange={(e) => handleSetChange(set.id, 'actualReps', parseInt(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex-1 text-sm">
                          <span className={set.isCompleted ? 'text-foreground' : 'text-muted-foreground'}>
                            {formatSetDisplay(set, exercise.exerciseType, exercise.durationType, weightUnit)}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex gap-1">
                        {set.setDifficultyRating && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              set.setDifficultyRating === 'hard' ? 'border-red-500 text-red-500' :
                              set.setDifficultyRating === 'medium' ? 'border-[#0cc9a9] text-[#0cc9a9]' :
                              'border-green-500 text-green-500'
                            }`}
                          >
                            {set.setDifficultyRating}
                          </Badge>
                        )}
                        {set.painFlag && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                            Pain
                          </Badge>
                        )}
                        {set.failureFlag && (
                          <Badge variant="outline" className="text-xs border-purple-500 text-purple-500">
                            Failure
                          </Badge>
                        )}
                        {set.isCompleted && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            </Card>
          );
          
          return (
            <>
              {warmupExercises.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Warm Up</h3>
                  {warmupExercises.map((ex) => renderExerciseCard(ex, warmupExercises, true))}
                </div>
              )}
              
              {mainExercises.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">Main Body</h3>
                  {(() => {
                    // Check if this is an interval or circuit workout
                    // workoutStyle contains the actual workout format (interval/circuit/video/regular)
                    // workoutType contains the source (individual/programme)
                    const allMainExercises = workoutLog.exercises.filter(ex => ex.section !== 'warmup');
                    const restBlocks = allMainExercises.filter(ex => isRestBlock(ex));
                    const workoutStyle = (workoutLog as any).workoutStyle || workoutLog.workoutType;
                    const isIntervalWorkout = workoutStyle === 'interval' || restBlocks.length > 0;
                    const isCircuitWorkout = workoutStyle === 'circuit';
                    // For circuit workouts, derive rounds from intervalRounds or from first exercise's set count
                    const circuitRounds = (workoutLog as any).intervalRounds || 
                      (isCircuitWorkout && mainExercises[0]?.sets?.length) || null;
                    
                    // Circuit workout with rounds (single circuit repeated)
                    if (isCircuitWorkout && circuitRounds) {
                      return (
                        <div className="space-y-2">
                          {/* Circuit Header */}
                          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-primary">
                                Circuit
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {circuitRounds} rounds
                              </span>
                            </div>
                          </div>
                          
                          {/* Circuit Exercises */}
                          {mainExercises.map((ex) => renderExerciseCard(ex, mainExercises, false))}
                        </div>
                      );
                    }
                    
                    // Interval workout with multiple circuits separated by rest blocks
                    if (isIntervalWorkout && restBlocks.length > 0) {
                      // Group exercises into circuits based on rest blocks
                      const circuits: { exercises: ExerciseLog[]; restAfter?: number }[] = [];
                      let currentCircuit: ExerciseLog[] = [];
                      
                      allMainExercises.forEach((ex) => {
                        if (isRestBlock(ex)) {
                          if (currentCircuit.length > 0) {
                            circuits.push({ 
                              exercises: currentCircuit, 
                              restAfter: (ex as any).restDuration || 60 
                            });
                            currentCircuit = [];
                          }
                        } else {
                          currentCircuit.push(ex);
                        }
                      });
                      
                      // Add last circuit if any exercises remain
                      if (currentCircuit.length > 0) {
                        circuits.push({ exercises: currentCircuit });
                      }
                      
                      // Get interval duration from first exercise's target duration
                      const intervalDuration = (workoutLog as any).intervalDuration || 
                        circuits[0]?.exercises[0]?.sets[0]?.targetDuration || '60 sec';
                      const intervalRounds = (workoutLog as any).intervalRounds || 3;
                      
                      // Helper to render interval exercise card with compact summary
                      const renderIntervalExerciseCard = (exercise: ExerciseLog, allExercises: ExerciseLog[]) => {
                        const exerciseLetter = getExerciseLabel(exercise, allExercises, false);
                        
                        // Get logged stats from first set (all rounds use same weight for intervals)
                        const firstSet = exercise.sets[0];
                        let statsDisplay = '';
                        if (firstSet) {
                          const reps = firstSet.actualReps;
                          const weight = firstSet.actualWeight;
                          const duration = firstSet.actualDuration || firstSet.targetDuration;
                          
                          if (reps && weight) {
                            const displayWeight = weightUnit === 'lbs' ? kgToLbs(weight) : weight;
                            statsDisplay = `${reps} reps @ ${Math.round(displayWeight * 10) / 10} ${weightUnit}`;
                          } else if (reps) {
                            statsDisplay = `${reps} reps`;
                          } else if (duration) {
                            statsDisplay = duration;
                          } else if (firstSet.isCompleted) {
                            statsDisplay = 'Completed';
                          }
                        }
                        
                        return (
                          <Card key={exercise.id} className="p-3 bg-card border-border/50">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-primary">{exerciseLetter}</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-foreground">{exercise.exerciseName}</h4>
                                {statsDisplay && (
                                  <p className="text-sm text-muted-foreground">{statsDisplay}</p>
                                )}
                              </div>
                              {exercise.sets.some(s => s.isCompleted) && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          </Card>
                        );
                      };
                      
                      return circuits.map((circuit, circuitIndex) => (
                        <div key={`circuit-${circuitIndex}`} className="space-y-2">
                          {/* Interval Header - "X rounds x Y secs" format */}
                          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-primary">
                                Circuit {circuitIndex + 1} of {circuits.length}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {intervalRounds} rounds x {typeof intervalDuration === 'string' ? intervalDuration : `${intervalDuration} sec`}
                              </span>
                            </div>
                          </div>
                          
                          {/* Interval Exercises - compact summary display */}
                          {circuit.exercises.map((ex) => renderIntervalExerciseCard(ex, mainExercises))}
                          
                          {/* Rest Period After Circuit */}
                          {circuit.restAfter && circuitIndex < circuits.length - 1 && (
                            <div className="flex items-center justify-center gap-2 py-3 bg-muted/30 rounded-lg border border-border/50">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {circuit.restAfter} sec rest between circuits
                              </span>
                            </div>
                          )}
                        </div>
                      ));
                    } else {
                      // Non-interval/circuit workout - render exercises normally
                      return mainExercises.map((ex) => renderExerciseCard(ex, mainExercises, false));
                    }
                  })()}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {workoutLog.notes && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium text-foreground mb-2">Notes</h4>
            <p className="text-sm text-muted-foreground">{workoutLog.notes}</p>
          </div>
        </>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your logged workout data. You'll be able to redo this workout again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkoutMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteWorkoutMutation.isPending ? 'Deleting...' : 'Delete Workout'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
