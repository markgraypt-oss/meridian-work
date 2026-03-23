import { useParams, useLocation } from "wouter";
import { localDateStr } from "@/lib/dateUtils";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { consumeScrollRestore, clearScrollRestore } from "@/lib/scrollRestore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dumbbell, Clock, MoreVertical, X, Zap, RotateCcw, Link } from "lucide-react";
import { ExerciseCard } from "@/components/ExerciseCard";
import { WorkoutCompletionView } from "@/components/training/WorkoutCompletionView";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

const formatRestPeriod = (restPeriod: string): string => {
  if (!restPeriod || restPeriod.toLowerCase() === 'none') return 'none';
  
  const secs = parseInt(restPeriod.replace('s', '').replace(' sec', ''));
  if (isNaN(secs) || secs === 0) return 'none';
  
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (remainingSecs === 0) {
      return `${mins}m`;
    }
    return `${mins}m ${remainingSecs}s`;
  }
  return `${secs}s`;
};

export default function WodDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showEditLogMode, setShowEditLogMode] = useState(false);

  // Phase 1: claim the saved scroll value before global hook can interfere.
  // Phase 2: actually scroll after the browser renders content (via rAF).
  const pendingScrollRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    pendingScrollRef.current = consumeScrollRestore(`/wod/${id}`);
  }, [id]);
  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    clearScrollRestore();
    requestAnimationFrame(() => window.scrollTo(0, y));
    const t = setTimeout(() => window.scrollTo(0, y), 200);
    return () => clearTimeout(t);
  }, [id]);

  // Helper to generate exercise labels
  const getExerciseLabel = (index: number, isWarmup: boolean, isCircuitMode: boolean = false, groupNumber?: number, indexInGroup?: number) => {
    if (isWarmup) {
      // Warm-up uses letters only: A, B, C, D, etc.
      return String.fromCharCode(65 + index);
    }
    if (isCircuitMode && groupNumber !== undefined && indexInGroup !== undefined) {
      // Circuit/Interval mode with block groups - use group number + letter within group
      return `${groupNumber}${String.fromCharCode(65 + indexInGroup)}`;
    }
    if (isCircuitMode) {
      // Circuit mode: all in one group - 1A, 1B, 1C, 1D, etc.
      return `1${String.fromCharCode(65 + index)}`;
    }
    // Regular main body uses number + letter: 1A, 2A, 3A, etc.
    return `${index + 1}A`;
  };
  
  // Helper to check if two exercises are in the same block group
  const isSameBlockGroup = (a: any, b: any): boolean => {
    if (!a || !b) return false;
    if (a.blockType === 'single' || b.blockType === 'single') return false;
    if (a.blockType !== b.blockType) return false;
    if (a.blockGroupId && b.blockGroupId) return a.blockGroupId === b.blockGroupId;
    if (a.blockGroupId || b.blockGroupId) return false;
    return true;
  };

  // Helper to transform set data from database format to ExerciseCard format
  const transformSets = (sets: any[]) => {
    if (!sets || !Array.isArray(sets)) return [];
    return sets.map((set: any) => ({
      reps: set.targetReps || set.reps,
      duration: set.targetDuration || set.duration,
    }));
  };

  const { data: workoutLog, isLoading } = useQuery<any>({
    queryKey: ['/api/workout-logs', id],
    queryFn: async () => {
      const res = await fetch(`/api/workout-logs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch workout');
      return res.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const exerciseLogs = workoutLog?.exercises || [];

  const { data: libraryExercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
    enabled: isAuthenticated,
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/workout-logs/${id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress/workouts'] });
      toast({ title: "Workout marked as complete!" });
      navigate('/');
    },
    onError: () => {
      toast({ title: "Failed to mark complete", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/workout-logs/custom/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      toast({ title: "Workout deleted" });
      navigate('/');
    },
    onError: () => {
      toast({ title: "Failed to delete workout", variant: "destructive" });
    },
  });

  const moveDateMutation = useMutation({
    mutationFn: async (newDate: Date) => {
      return apiRequest('PATCH', `/api/workout-logs/custom/${id}`, { date: localDateStr(newDate) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', id] });
      setShowDatePicker(false);
      toast({ title: "Workout moved to new date" });
    },
    onError: () => {
      toast({ title: "Failed to move workout", variant: "destructive" });
    },
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/workout-logs/${id}`, { 
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      navigate(`/active-workout/${id}`);
    },
    onError: () => {
      toast({ title: "Failed to start workout", variant: "destructive" });
    },
  });

  const handleStartWorkout = () => {
    startWorkoutMutation.mutate();
  };

  const handleEditWorkout = () => {
    const currentWorkoutStyle = workoutLog?.workoutStyle || 'regular';
    sessionStorage.setItem('wodExercises', JSON.stringify(
      exerciseLogs.map((ex: any, index: number) => ({
        id: ex.id?.toString() || Date.now().toString(),
        kind: ex.kind || 'exercise',
        exerciseLibraryId: ex.exerciseLibraryId,
        exerciseName: ex.exerciseName,
        imageUrl: libraryExercises.find((lib: any) => lib.id === ex.exerciseLibraryId)?.imageUrl,
        blockType: ex.blockType || 'single',
        blockGroupId: ex.blockGroupId || undefined,
        section: ex.section || 'main',
        position: index,
        restPeriod: ex.restPeriod || '60 sec',
        restDuration: ex.restDuration || undefined,
        setsCount: ex.sets?.length || 3,
        targetReps: ex.targetReps || ex.sets?.[0]?.targetReps || '8-12',
        targetDuration: ex.targetDuration || ex.sets?.[0]?.targetDuration || '',
        durationType: ex.durationType || 'text',
        exerciseType: ex.exerciseType || 'strength',
      }))
    ));
    sessionStorage.setItem('wodEditId', id || '');
    navigate(`/build-wod?type=${currentWorkoutStyle}&from=/wod/${id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workoutLog) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Workout not found</p>
      </div>
    );
  }

  const isWorkoutCompleted = workoutLog.status === 'completed';
  const workoutStyle = workoutLog.workoutStyle || 'regular';
  const isCircuitWorkout = workoutStyle === 'circuit';
  const isIntervalWorkout = workoutStyle === 'interval';
  const circuitRounds = workoutLog.intervalRounds || workoutLog.circuitRounds || 3;

  const warmupExercises = exerciseLogs.filter((ex: any) => ex.section === 'warmup');
  const mainExercises = exerciseLogs.filter((ex: any) => ex.section !== 'warmup');

  const handleWorkoutLogDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', id] });
    queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
    queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
    navigate('/');
  };

  const uniqueEquipment = new Set<string>();
  exerciseLogs.forEach((ex: any) => {
    const libraryExercise = libraryExercises.find((lib: any) => lib.id === ex.exerciseLibraryId);
    if (libraryExercise?.equipment) {
      libraryExercise.equipment.forEach((eq: string) => uniqueEquipment.add(eq));
    }
  });

  const getEquipmentIcon = (equipment: string) => {
    const icons: Record<string, string> = {
      'barbell': '🏋️',
      'dumbbell': '🏋️',
      'kettlebell': '🔔',
      'bands': '🎗️',
      'bodyweight': '🏃',
      'mat': '🧘',
      'bench': '🪑',
      'cable': '📡',
      'machine': '⚙️',
      'sliders': '🛝',
    };
    return icons[equipment.toLowerCase()] || '💪';
  };

  return (
    <div className="min-h-screen w-full bg-background pb-32">
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => isWorkoutCompleted ? navigate('/') : setShowCancelConfirm(true)}
            className="p-2 -ml-2"
            data-testid="button-close"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium">Today</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 -mr-2" data-testid="button-menu">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem 
                onClick={() => setShowDatePicker(true)}
                data-testid="menu-move-day"
              >
                Move To Another Day
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleEditWorkout}
                data-testid="menu-edit"
              >
                Edit This Workout
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 focus:text-red-500"
                data-testid="menu-delete"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">{workoutLog.name || "Workout of the Day"}</h1>

        {isWorkoutCompleted ? (
          <WorkoutCompletionView
            workoutLog={workoutLog}
            onDelete={handleWorkoutLogDeleted}
            isEditing={showEditLogMode}
            onEditModeChange={setShowEditLogMode}
          />
        ) : (
          <>
            <Separator className="mb-2 opacity-30" />

            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              {isCircuitWorkout ? (
                <RotateCcw className="h-4 w-4" />
              ) : isIntervalWorkout ? (
                <Zap className="h-4 w-4" />
              ) : (
                <Dumbbell className="h-4 w-4" />
              )}
              <span className="text-sm capitalize">{workoutStyle}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Duration: est. {workoutLog.duration || Math.round(exerciseLogs.length * 3)} minutes</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Dumbbell className="h-4 w-4" />
              <span className="text-sm">{exerciseLogs.length} Exercises</span>
            </div>

            {uniqueEquipment.size > 0 && (
              <>
                <p className="text-sm text-foreground mb-2">Equipment:</p>
                <div className="flex flex-wrap gap-3 mb-4">
                  {Array.from(uniqueEquipment).map((equipment) => (
                    <div key={equipment} className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center text-xl">
                        {getEquipmentIcon(equipment)}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 capitalize">{equipment}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {warmupExercises.length > 0 && (
              <div className="space-y-4 mt-4">
                <h3 className="text-base font-semibold uppercase text-foreground">WARM UP</h3>
                <div className="space-y-3">
                  {warmupExercises.map((exercise: any, index: number) => {
                    const libraryExercise = libraryExercises.find((lib: any) => lib.id === exercise.exerciseLibraryId);
                    return (
                      <ExerciseCard
                        key={exercise.id}
                        index={index}
                        label={getExerciseLabel(index, true)}
                        exercise={{
                          name: exercise.exerciseName,
                          exerciseLibraryId: exercise.exerciseLibraryId,
                          exerciseType: exercise.exerciseType || 'strength',
                          durationType: exercise.durationType,
                          sets: transformSets(exercise.sets),
                          rest: formatRestPeriod(exercise.restPeriod || '60s'),
                          imageUrl: libraryExercise?.imageUrl,
                          muxPlaybackId: libraryExercise?.muxPlaybackId,
                          blockType: exercise.blockType,
                        }}
                        workoutId={`/wod/${id}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {mainExercises.length > 0 && (
              <div className="space-y-4 mt-4">
                <h3 className="text-base font-semibold uppercase text-foreground">MAIN BODY</h3>
            
            {/* Circuit header - only for circuit workouts (not interval) */}
            {isCircuitWorkout && !isIntervalWorkout && (
              <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg mb-4">
                <p className="text-foreground font-medium">
                  Perform as a circuit workout of {circuitRounds} rounds
                </p>
              </div>
            )}
            
            <div>
              {(() => {
                // For interval workouts, compute block groups for proper labeling
                let currentGroupNumber = 0;
                let currentGroupId: string | null = null;
                let indexInCurrentGroup = 0;
                // Track non-rest exercise index for proper labeling
                let nonRestIndex = 0;
                
                return mainExercises.map((exercise: any, index: number) => {
                  const libraryExercise = libraryExercises.find((lib: any) => lib.id === exercise.exerciseLibraryId);
                  const isLastExercise = index === mainExercises.length - 1;
                  const prevExercise = index > 0 ? mainExercises[index - 1] : null;
                  const nextExercise = mainExercises[index + 1];
                  
                  const currentBlockType = exercise.blockType || 'single';
                  const nextBlockType = nextExercise?.blockType || 'single';
                  const prevBlockType = prevExercise?.blockType || 'single';
                  
                  // Check if this is a rest block - do this FIRST before any counter updates
                  const isRestBlock = exercise.kind === 'rest' || exercise.exerciseName === 'Rest';
                  
                  // Find previous and next non-rest exercises for proper block group detection
                  const prevNonRestExercise = mainExercises.slice(0, index).reverse().find((ex: any) => 
                    ex.kind !== 'rest' && ex.exerciseName !== 'Rest'
                  );
                  const nextNonRestExercise = mainExercises.slice(index + 1).find((ex: any) => 
                    ex.kind !== 'rest' && ex.exerciseName !== 'Rest'
                  );
                  
                  // For interval workouts: track block groups (skip for rest blocks)
                  if (isIntervalWorkout && !isRestBlock) {
                    const isNewGroup = !prevNonRestExercise || !isSameBlockGroup(prevNonRestExercise, exercise);
                    if (isNewGroup && currentBlockType !== 'single') {
                      currentGroupNumber++;
                      currentGroupId = exercise.blockGroupId || null;
                      indexInCurrentGroup = 0;
                    } else if (currentBlockType === 'single') {
                      currentGroupNumber++;
                      indexInCurrentGroup = 0;
                    } else {
                      indexInCurrentGroup++;
                    }
                  }
                  
                  const isInBlock = currentBlockType !== 'single';
                  // Use next NON-REST exercise to determine if this is last in block group
                  const isLastInBlockGroup = isIntervalWorkout 
                    ? (isInBlock && (!nextNonRestExercise || !isSameBlockGroup(exercise, nextNonRestExercise)))
                    : (isInBlock && (isLastExercise || nextBlockType !== currentBlockType));
                  const showConnector = isInBlock && !isLastInBlockGroup && !isRestBlock;
                  // For interval and circuit workouts, always use "CIRCUIT" label
                  // For regular workouts, use the specific block type (SUPERSET, TRISET, etc)
                  const wodSetCount = (() => {
                    if (exercise.sets && Array.isArray(exercise.sets)) return exercise.sets.length;
                    return parseInt(exercise.sets) || 0;
                  })();
                  const wodTypeLabel = (isIntervalWorkout || isCircuitWorkout) ? 'CIRCUIT' : (
                    currentBlockType === 'superset' ? 'SUPERSET' :
                    currentBlockType === 'triset' ? 'TRISET' :
                    currentBlockType === 'circuit' ? 'CIRCUIT' : currentBlockType.toUpperCase()
                  );
                  const connectorLabel = wodSetCount > 0
                    ? `${wodTypeLabel} of ${wodSetCount} ${wodSetCount === 1 ? 'Set' : 'Sets'}`
                    : wodTypeLabel;
                  
                  const needsTopSpacing = index > 0 && (!isInBlock || prevBlockType !== currentBlockType);
                  
                  // For circuit WOD: all exercises in one circuit
                  // For interval WOD: each block group is independent
                  const isCircuitMode = isCircuitWorkout;
                  
                  // For interval workouts: always use duration, never reps
                  // For circuit workouts: use reps
                  const circuitSets = (isCircuitMode || (isIntervalWorkout && isInBlock))
                    ? Array.from({ length: isRestBlock ? 1 : circuitRounds }, (_, i) => {
                        const originalSet = exercise.sets?.[0] || {};
                        const rawDuration = originalSet.targetDuration || originalSet.duration || exercise.targetDuration || exercise.restDuration;
                        
                        // Format duration properly - keep existing format if it has units, otherwise add 'sec'
                        const formatDuration = (d: any) => {
                          if (!d) return '30 secs';
                          const dStr = String(d);
                          // If already has 'min' or 'sec' in it, format it properly
                          if (dStr.includes('min') || dStr.includes('sec')) {
                            return dStr.replace(/\bsec\b/, 'secs').replace(/\bmin\b/, 'min');
                          }
                          // If just a number, add 'secs'
                          return `${dStr.replace(/\D*$/, '')} secs`;
                        };
                        
                        return {
                          // For interval workouts: don't include reps (duration only)
                          // For circuit workouts: include reps
                          reps: isIntervalWorkout ? undefined : (originalSet.targetReps || originalSet.reps || exercise.targetReps || '8-12'),
                          duration: isIntervalWorkout || isRestBlock ? formatDuration(rawDuration) : rawDuration,
                        };
                      })
                    : transformSets(exercise.sets);
                  
                  // Determine the label using nonRestIndex (rest blocks don't count)
                  let label: string;
                  if (isCircuitMode) {
                    label = getExerciseLabel(nonRestIndex, false, true);
                  } else if (isIntervalWorkout) {
                    label = getExerciseLabel(nonRestIndex, false, true, currentGroupNumber, indexInCurrentGroup);
                  } else {
                    label = getExerciseLabel(nonRestIndex, false, false);
                  }
                  
                  // For rest visibility: circuit shows only on last, interval shows on last of each block
                  const showRest = isCircuitMode 
                    ? isLastExercise 
                    : (isIntervalWorkout && isInBlock ? isLastInBlockGroup : true);
                  
                  // Determine if this is the first exercise of a new block group (for interval workouts)
                  // Use prevNonRestExercise to skip rest blocks when determining block boundaries
                  const isFirstOfNewBlockGroup = isIntervalWorkout && isInBlock && 
                    (!prevNonRestExercise || !isSameBlockGroup(prevNonRestExercise, exercise));
                  
                  // Add spacing between different block groups (skip rest blocks)
                  const needsBlockGroupSpacing = isIntervalWorkout && index > 0 && 
                    prevNonRestExercise && !isSameBlockGroup(prevNonRestExercise, exercise) && !isRestBlock;
                  
                  // Get block header text for interval workouts - always "Circuit of X rounds"
                  const getBlockHeaderText = () => {
                    return `Circuit of ${circuitRounds} rounds`;
                  };
                  
                  // Render rest blocks differently - compact single-line style (no label, no counter increment)
                  if (isRestBlock) {
                    const restDuration = exercise.restDuration || exercise.targetDuration || '30';
                    const formattedRest = formatRestPeriod(`${restDuration}s`);
                    return (
                      <div key={exercise.id} className="mt-4">
                        <div className="bg-card border border-border rounded-lg py-3 px-4 w-full">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-primary" />
                            </div>
                            <p className="font-medium text-foreground text-sm">REST</p>
                            <p className="text-sm text-muted-foreground">{formattedRest}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Increment nonRestIndex for this exercise (before returning)
                  const currentNonRestIndex = nonRestIndex;
                  nonRestIndex++;
                  
                  return (
                    <div key={exercise.id} className={`${needsTopSpacing && !isCircuitMode && !isIntervalWorkout ? "mt-3" : ""} ${needsBlockGroupSpacing ? "mt-6" : ""}`}>
                      {/* Block header for interval workouts - shows before first exercise of each block group */}
                      {isFirstOfNewBlockGroup && (
                        <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg mb-4">
                          <p className="text-foreground font-medium">
                            {getBlockHeaderText()}
                          </p>
                        </div>
                      )}
                      
                      <ExerciseCard
                        index={index}
                        label={label}
                        exercise={{
                          name: exercise.exerciseName,
                          exerciseLibraryId: exercise.exerciseLibraryId,
                          exerciseType: exercise.exerciseType || 'strength',
                          durationType: isIntervalWorkout ? 'timer' : exercise.durationType,
                          sets: circuitSets,
                          rest: showRest ? formatRestPeriod(exercise.restPeriod || '60s') : 'none',
                          imageUrl: libraryExercise?.imageUrl,
                          muxPlaybackId: libraryExercise?.muxPlaybackId,
                          blockType: isCircuitMode ? 'circuit' : currentBlockType,
                        }}
                        workoutId={`/wod/${id}`}
                        circuitRounds={(isCircuitMode || (isIntervalWorkout && isInBlock)) ? circuitRounds : undefined}
                        isIntervalWorkout={isIntervalWorkout}
                      />
                      
                      {/* Block connector between exercises in the same block group */}
                      {(isCircuitMode ? !isLastExercise : showConnector) && (
                        <div className="relative flex items-center justify-center py-1">
                          <svg className="absolute left-0 top-0 bottom-0 w-2" style={{ height: '100%' }}>
                            <line x1="2" y1="0" x2="2" y2="100%" stroke="hsl(48, 96%, 53%)" strokeWidth="3" strokeDasharray="5,4" />
                          </svg>
                          <svg className="absolute right-0 top-0 bottom-0 w-2" style={{ height: '100%' }}>
                            <line x1="2" y1="0" x2="2" y2="100%" stroke="hsl(48, 96%, 53%)" strokeWidth="3" strokeDasharray="5,4" />
                          </svg>
                          <div className="flex items-center gap-1.5 bg-primary px-3 py-1 rounded-full">
                            <Link className="w-3.5 h-3.5 text-black rotate-45" />
                            <span className="text-xs font-bold text-black uppercase tracking-wide">
                              {isCircuitMode ? 'CIRCUIT' : connectorLabel}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Repeat indicator for interval blocks - shows after last exercise in each block */}
                      {isIntervalWorkout && isLastInBlockGroup && (
                        <div className="flex items-center gap-2 text-muted-foreground pt-2 pb-2">
                          <span className="text-lg">🔄</span>
                          <span className="text-sm">Repeat for {circuitRounds} rounds</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            
                {/* Repeat indicator for circuit workouts (not interval - interval has per-block rounds) */}
                {isCircuitWorkout && !isIntervalWorkout && (
                  <div className="flex items-center gap-2 text-muted-foreground pt-4">
                    <span className="text-lg">🔄</span>
                    <span className="text-sm">Repeat for {circuitRounds} rounds</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!isWorkoutCompleted && (
        <Button 
          onClick={handleStartWorkout}
          disabled={startWorkoutMutation.isPending}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-48 bg-primary hover:opacity-90 text-white rounded-full py-3 text-base font-semibold shadow-xl z-50"
          data-testid="button-start-now"
        >
          {startWorkoutMutation.isPending ? "Starting..." : "START NOW"}
        </Button>
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Delete Workout?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Are you sure you want to delete this workout? This cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1"
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              className="flex-1"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DialogContent className="max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Move to Another Day</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDatePicker(false)}
              className="flex-1"
              data-testid="button-cancel-move"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => moveDateMutation.mutate(selectedDate)}
              className="flex-1"
              disabled={moveDateMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveDateMutation.isPending ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Leave Workout?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Are you sure you want to leave? Your workout will remain saved for later.
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1"
              data-testid="button-stay"
            >
              Stay
            </Button>
            <Button 
              onClick={() => navigate('/')}
              className="flex-1"
              data-testid="button-leave"
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
