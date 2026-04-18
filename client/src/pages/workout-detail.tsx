import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Dumbbell, Clock, MoreVertical, Zap, RotateCcw, Video, Link, Trash2, Brain, Activity, Loader2, ThumbsUp, ThumbsDown, Sparkles, Heart } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { ExerciseCard } from "@/components/ExerciseCard";
import { WorkoutScheduleCalendar } from "@/components/training/WorkoutScheduleCalendar";
import { MoveWorkoutCalendar } from "@/components/training/MoveWorkoutCalendar";
import { WorkoutCompletionView } from "@/components/training/WorkoutCompletionView";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateWorkoutDuration } from "@/lib/utils";
import { consumeScrollRestore, clearScrollRestore } from "@/lib/scrollRestore";
import { format, parse } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
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

export default function WorkoutDetail() {
  const { enrollmentId, week, day } = useParams();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showActiveWorkoutDialog, setShowActiveWorkoutDialog] = useState(false);
  const [activeWorkoutLogId, setActiveWorkoutLogId] = useState<number | null>(null);
  const [showEditLogMode, setShowEditLogMode] = useState(false);
  const [showDeleteLogDialog, setShowDeleteLogDialog] = useState(false);
  const [showAiCoach, setShowAiCoach] = useState(false);
  const [aiCoachMode, setAiCoachMode] = useState<string | null>(null);
  const [aiCoachData, setAiCoachData] = useState<any>(null);
  const [aiFeedbackSent, setAiFeedbackSent] = useState<Record<string, boolean>>({});
  const [aiHintDismissed, setAiHintDismissed] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  const pendingScrollRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    pendingScrollRef.current = consumeScrollRestore(`/workout-detail/${enrollmentId}/${week}/${day}`);
  }, [enrollmentId, week, day]);
  useEffect(() => {
    if (pendingScrollRef.current !== null) {
      const y = pendingScrollRef.current;
      pendingScrollRef.current = null;
      clearScrollRestore();
      requestAnimationFrame(() => window.scrollTo(0, y));
      const t = setTimeout(() => window.scrollTo(0, y), 200);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [enrollmentId, week, day]);
  
  // Parse URL query params for calendar context
  const urlParams = new URLSearchParams(searchString);
  const scheduledDateStr = urlParams.get('date');
  const sourceContext = urlParams.get('source');
  const displayWeekStr = urlParams.get('displayWeek');
  const isFromCalendar = sourceContext === 'calendar';
  const isFromLibrary = sourceContext === 'library';
  const scheduledDate = scheduledDateStr ? parse(scheduledDateStr, 'yyyy-MM-dd', new Date()) : null;
  const displayWeek = displayWeekStr ? parseInt(displayWeekStr) : parseInt(week || '1');


  const { data: programData, isLoading } = useQuery<any>({
    queryKey: ['/api/my-programs', enrollmentId],
    queryFn: async () => {
      const res = await fetch(`/api/my-programs/${enrollmentId}`);
      if (!res.ok) throw new Error('Failed to fetch program');
      return res.json();
    },
    enabled: isAuthenticated && !!enrollmentId,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<any>({
    queryKey: ['/api/my-programs/timeline'],
    enabled: isAuthenticated,
  });

  const activeEnrollmentId = timeline?.current?.id;
  const currentEnrollmentId = enrollmentId ? parseInt(enrollmentId) : null;
  const supplementaryEnrollmentIds = (timeline?.currentSupplementary || []).map((s: any) => s.id);
  const isEnrolledProgramme = !timelineLoading && currentEnrollmentId && (
    currentEnrollmentId === activeEnrollmentId || 
    supplementaryEnrollmentIds.includes(currentEnrollmentId)
  );
  const targetWorkout = programData?.workouts?.find((w: any) =>
    w.week === parseInt(week || '1') && w.day === parseInt(day || '1')
  );
  const isVideoWorkout = targetWorkout?.workoutType === 'video';
  const canStartWorkout = isEnrolledProgramme && !isVideoWorkout;

  const handleEditWorkout = () => {
    const enrollmentWorkoutId = targetWorkout?.enrollmentWorkoutId;
    const enrollmentIdNum = parseInt(enrollmentId || '0');
    if (!enrollmentWorkoutId || !enrollmentIdNum) return;
    setIsLoadingEdit(true);
    try {
      // Convert enrolled workout blocks → ExerciseData format for build-wod
      const exerciseData: any[] = [];
      for (const block of targetWorkout.blocks || []) {
        const blockGroupId = block.blockType !== 'single'
          ? `edit-${block.id || Date.now()}-${Math.random().toString(36).slice(2)}`
          : undefined;
        for (const ex of block.exercises || []) {
          const exerciseType = ex.exerciseType || 'strength';
          const isTimeBased = ['timed', 'timed_strength', 'general', 'cardio'].includes(exerciseType);
          const sets = ex.sets || [{ reps: '8-12' }];
          const firstSet = sets[0];
          exerciseData.push({
            id: `edit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            kind: 'exercise',
            exerciseLibraryId: ex.exerciseLibraryId || null,
            exerciseName: ex.exerciseName || ex.name || '',
            imageUrl: ex.imageUrl || null,
            muxPlaybackId: ex.muxPlaybackId || null,
            blockType: block.blockType || 'single',
            blockGroupId,
            section: block.section || 'main',
            position: exerciseData.filter((e: any) => e.section === (block.section || 'main')).length,
            restPeriod: block.rest || '60s',
            setsCount: sets.length,
            targetReps: firstSet?.reps || '8-12',
            targetDuration: isTimeBased ? (firstSet?.duration || '30 sec') : (firstSet?.duration || ''),
            durationType: isTimeBased ? 'timer' : 'text',
            exerciseType,
          });
        }
      }
      sessionStorage.setItem('wodExercises', JSON.stringify(exerciseData));
      const returnUrl = `/workout-detail/${enrollmentId}/${week}/${day}`;
      navigate(`/build-wod?type=${targetWorkout.workoutType || 'regular'}&from=${encodeURIComponent(returnUrl)}&enrollmentWorkoutId=${enrollmentWorkoutId}&enrollmentId=${enrollmentIdNum}`, { replace: true });
    } catch {
      toast({ title: 'Error', description: 'Could not load workout for editing.', variant: 'destructive' });
    } finally {
      setIsLoadingEdit(false);
    }
  };

  // Fetch upcoming count for this workout position
  const { data: scheduleData } = useQuery<{ scheduledDates: string[]; upcomingCount: number }>({
    queryKey: ['/api/my-programs', enrollmentId, 'workout-schedule', day],
    queryFn: async () => {
      const response = await fetch(`/api/my-programs/${enrollmentId}/workout-schedule?dayPosition=${day}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    },
    enabled: isAuthenticated && !!enrollmentId && !!day,
  });

  // Check for completed workout log - ONLY when navigating from calendar with a specific date
  const { data: completedWorkoutLog, isLoading: completedLogLoading, refetch: refetchCompletedLog } = useQuery<any>({
    queryKey: ['/api/workout-logs/completed-by-context', enrollmentId, displayWeek, day],
    queryFn: async () => {
      const response = await fetch(
        `/api/workout-logs/completed-by-context?enrollmentId=${enrollmentId}&week=${displayWeek}&day=${day}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch completed log');
      return response.json();
    },
    enabled: isAuthenticated && !!enrollmentId && !!day && isFromCalendar && !!scheduledDateStr,
  });

  // Only show completed view when navigating from calendar/history with a specific date
  const isWorkoutCompleted = isFromCalendar && scheduledDateStr && !completedLogLoading && !!completedWorkoutLog?.id;

  const hasCompletedThisWorkout = isWorkoutCompleted;

  const handleWorkoutDeleted = () => {
    refetchCompletedLog();
    queryClient.invalidateQueries({ queryKey: ['/api/workout-logs/completed-by-context', enrollmentId, displayWeek, day] });
  };

  const startWorkoutMutation = useMutation({
    mutationFn: async (workoutData: { workoutId: number; workoutType: string; workoutName: string; programmeId?: number; enrollmentId?: number; week?: number; day?: number; workoutStyle?: string; intervalRounds?: number | null; intervalRestAfterRound?: string | null }) => {
      const response = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(workoutData),
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.message || 'Failed to start workout') as any;
        error.activeLogId = data.activeLogId;
        throw error;
      }
      return data;
    },
    onSuccess: async (data, variables) => {
      const { workouts = [] } = programData || {};
      // Use week from URL (template week, always 1) to find workout data
      const targetWorkout = workouts.find((w: any) => w.week === parseInt(week || '1') && w.day === parseInt(day || '1'));
      
      if (targetWorkout) {
        // Prefer block structure for proper superset grouping
        if (targetWorkout.blocks && targetWorkout.blocks.length > 0) {
          const warmupBlocks = targetWorkout.blocks.filter((b: any) => b.section === 'warmup' || b.section === 'warm_up');
          const mainBlocks = targetWorkout.blocks.filter((b: any) => b.section !== 'warmup' && b.section !== 'warm_up');
          
          let position = 0;
          
          // Log warmup exercises
          for (const block of warmupBlocks) {
            const blockExercises = block.exercises || [];
            for (const ex of blockExercises) {
              await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
                exerciseLibraryId: ex.exerciseLibraryId,
                exerciseName: ex.exerciseName || ex.name,
                blockType: block.blockType || 'single',
                blockGroupId: blockExercises.length > 1 ? `warmup-${block.id}` : null,
                section: 'warmup',
                position: position++,
                restPeriod: block.rest || '60 sec',
                durationType: ex.durationType || 'text',
                exerciseType: ex.exerciseType || 'strength',
                sets: ex.sets || [{ reps: '8-12' }],
              });
            }
          }
          
          // Log main exercises with proper block grouping
          const isIntervalWorkoutType = targetWorkout.workoutType === 'interval';
          // Check if data already contains rest blocks (to avoid duplicating them)
          const hasExistingRestBlocks = mainBlocks.some((b: any) => b.blockType === 'rest');
          
          // Process blocks in order, keeping track of circuit number for non-rest blocks
          let circuitNumber = 0;
          
          for (const block of mainBlocks) {
            if (block.blockType === 'rest') {
              // Add rest block with proper kind field
              await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
                exerciseLibraryId: null,
                exerciseName: 'Rest',
                blockType: 'rest',
                blockGroupId: null,
                section: 'main',
                position: position++,
                restPeriod: block.rest || '60 sec',
                durationType: 'text',
                exerciseType: 'rest',
                sets: [],
                kind: 'rest',
                restDuration: typeof block.rest === 'string' ? parseInt(block.rest) || 60 : (block.rest || 60),
              });
            } else {
              // Regular exercise block
              circuitNumber++;
              const blockExercises = block.exercises || [];
              const blockGroupId = blockExercises.length > 1 ? `main-${circuitNumber}` : null;
              
              for (const ex of blockExercises) {
                await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
                  exerciseLibraryId: ex.exerciseLibraryId,
                  exerciseName: ex.exerciseName || ex.name,
                  blockType: block.blockType || 'single',
                  blockGroupId: blockGroupId,
                  section: 'main',
                  position: position++,
                  restPeriod: block.rest || '60 sec',
                  durationType: ex.durationType || 'text',
                  exerciseType: ex.exerciseType || 'strength',
                  sets: ex.sets || [{ reps: '8-12' }],
                });
              }
              
              // For interval workouts without existing rest blocks, add rest after each circuit except the last
              const remainingExerciseBlocks = mainBlocks.slice(mainBlocks.indexOf(block) + 1).filter((b: any) => b.blockType !== 'rest');
              if (isIntervalWorkoutType && !hasExistingRestBlocks && remainingExerciseBlocks.length > 0) {
                const restDuration = block.restAfterCircuit || block.rest || '60 sec';
                await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
                  exerciseLibraryId: null,
                  exerciseName: 'Rest',
                  blockType: 'rest',
                  blockGroupId: null,
                  section: 'main',
                  position: position++,
                  restPeriod: restDuration,
                  durationType: 'text',
                  exerciseType: 'rest',
                  sets: [],
                  kind: 'rest',
                  restDuration: typeof restDuration === 'string' ? parseInt(restDuration) || 60 : restDuration,
                });
              }
            }
          }
        } else if (targetWorkout.exercises) {
          // Fallback to flat exercises array
          for (let i = 0; i < targetWorkout.exercises.length; i++) {
            const ex = targetWorkout.exercises[i];
            await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
              exerciseLibraryId: ex.exerciseLibraryId,
              exerciseName: ex.exerciseName || ex.name,
              blockType: ex.blockType || 'single',
              blockGroupId: ex.blockGroupId || null,
              section: ex.section || 'main',
              position: i,
              restPeriod: ex.rest || '60 sec',
              durationType: ex.durationType || 'text',
              exerciseType: ex.exerciseType || 'strength',
              sets: ex.sets || [{ reps: '8-12' }],
            });
          }
        }
      }
      
      navigate(`/active-workout/${data.id}`);
    },
    onError: (error: any) => {
      if (error?.activeLogId) {
        setActiveWorkoutLogId(error.activeLogId);
        setShowActiveWorkoutDialog(true);
      } else if (error?.message?.includes('already have an active workout')) {
        setShowActiveWorkoutDialog(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to start workout",
          variant: "destructive",
        });
      }
    },
  });

  const cancelActiveWorkoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/workout-logs/cancel-active');
    },
    onSuccess: () => {
      setShowActiveWorkoutDialog(false);
      setActiveWorkoutLogId(null);
      toast({
        title: "Workout Cancelled",
        description: "Your previous workout has been cancelled. You can now start a new one.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel the previous workout",
        variant: "destructive",
      });
    },
  });

  const workoutIdForAi = programData?.workouts?.find((w: any) => 
    w.week === parseInt(week || '1') && w.day === parseInt(day || '1')
  )?.workoutId || programData?.workouts?.find((w: any) => 
    w.week === parseInt(week || '1') && w.day === parseInt(day || '1')
  )?.id;

  const aiCoachMutation = useMutation({
    mutationFn: async (mode: string) => {
      const res = await apiRequest('POST', '/api/ai/workout-coach', { mode, workoutId: workoutIdForAi });
      return res.json();
    },
    onSuccess: (data, mode) => {
      setAiCoachData(data);
      setAiCoachMode(mode);
    },
    onError: (error: Error) => {
      toast({ title: 'AI unavailable', description: error.message, variant: 'destructive' });
    },
  });

  const aiCoachFeedbackMutation = useMutation({
    mutationFn: async ({ rating, aiMessage }: { rating: 'positive' | 'negative'; aiMessage: string }) => {
      return apiRequest('POST', '/api/ai-feedback', {
        feature: 'workout_adaptation',
        rating,
        aiMessage,
        userMessage: aiCoachMode,
        context: { mode: aiCoachMode, workoutId: workoutIdForAi },
      });
    },
    onSuccess: (_, variables) => {
      setAiFeedbackSent(prev => ({ ...prev, [aiCoachMode || '']: true }));
      toast({ title: variables.rating === 'positive' ? 'Thanks!' : 'Noted', description: 'Your feedback helps improve recommendations.' });
    },
  });

  const handleStartWorkout = () => {
    if (!programData || !enrollmentId || !week || !day) return;
    
    const { workouts = [], programmeId } = programData;
    // Use week from URL (always 1 for template lookup) to find workout data
    const targetWorkout = workouts.find((w: any) => w.week === parseInt(week) && w.day === parseInt(day));
    
    if (!targetWorkout) return;
    
    // Use displayWeek for logging (actual week user is viewing) instead of template week
    startWorkoutMutation.mutate({
      workoutId: targetWorkout.workoutId || targetWorkout.id,
      workoutType: 'programme',
      workoutName: targetWorkout.name,
      programmeId,
      enrollmentId: parseInt(enrollmentId),
      week: displayWeek,
      day: parseInt(day),
      workoutStyle: targetWorkout.workoutType || 'regular',
      intervalRounds: targetWorkout.intervalRounds || null,
      intervalRestAfterRound: targetWorkout.intervalRestAfterRound || null,
    });
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

  const { workouts = [] } = programData || {};
  const workout = workouts.find((w: any) => w.week === parseInt(week || '1') && w.day === parseInt(day || '1'));

  if (!workout) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Workout not found</p>
      </div>
    );
  }

  const workoutNameWithoutNumber = workout.name.replace(/\s*\d+\s*$/, '');
  const isCircuitWorkout = workout.workoutType === 'circuit';
  const isIntervalWorkout = workout.workoutType === 'interval';
  const circuitRounds = workout.intervalRounds || workout.circuitRounds || 3;

  const estimatedDuration = workout.estimatedDuration || calculateWorkoutDuration({
    workoutType: workout.workoutType,
    exercises: workout.exercises,
    blocks: workout.blocks,
    circuitRounds: circuitRounds,
    intervalRounds: workout.intervalRounds,
  }) || (workout.exercises?.length || 0) * 2;

  const groupExercisesByBlock = (exercises: any[], blocks?: any[]) => {
    if (blocks && blocks.length > 0) {
      const warmupBlocks = blocks.filter(b => b.section === 'warmup' || b.section === 'warm_up');
      const mainBlocks = blocks.filter(b => b.section !== 'warmup' && b.section !== 'warm_up');
      
      const warmupExercises = warmupBlocks.flatMap(b => (b.exercises || []).map((ex: any) => ({
        ...ex,
        name: ex.exerciseName || ex.name,
        blockId: b.id,
        section: b.section,
        blockRest: b.rest,
      })));
      
      const miniCircuits = mainBlocks.map(block => ({
        exercises: (block.exercises || []).map((ex: any) => ({
          ...ex,
          name: ex.exerciseName || ex.name,
          blockId: block.id,
          section: block.section,
        })),
        rounds: block.rounds || 3,
        restAfterRound: block.restAfterRound || '60 sec',
        blockRest: block.rest || '60 sec',
      }));
      
      return { warmup: warmupExercises, miniCircuits };
    }
    
    if (!exercises || exercises.length === 0) return { warmup: [], miniCircuits: [] };
    
    const warmupExercises = exercises.filter(ex => ex.section === 'warmup' || ex.section === 'warm_up');
    const mainExercises = exercises.filter(ex => ex.section !== 'warmup' && ex.section !== 'warm_up');
    
    const blockGroups: Map<number, { exercises: any[]; rounds: number; restAfterRound: string; blockRest: string }> = new Map();
    
    for (const ex of mainExercises) {
      const blockId = ex.blockId || ex.blockPosition || 0;
      if (!blockGroups.has(blockId)) {
        blockGroups.set(blockId, {
          exercises: [],
          rounds: ex.blockRounds || 3,
          restAfterRound: ex.blockRestAfterRound || '60 sec',
          blockRest: ex.blockRest || '60 sec',
        });
      }
      blockGroups.get(blockId)!.exercises.push(ex);
    }
    
    const miniCircuits = Array.from(blockGroups.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, group]) => group);
    
    return { warmup: warmupExercises, miniCircuits };
  };

  const { warmup: warmupExercises, miniCircuits } = isIntervalWorkout 
    ? groupExercisesByBlock(workout.exercises, workout.blocks)
    : { warmup: [], miniCircuits: [] };

  const exerciseCounts = (() => {
    const total = workout.exercises?.length || 0;
    if (workout.blocks && workout.blocks.length > 0) {
      const wBlocks = workout.blocks.filter((b: any) => b.section === 'warmup' || b.section === 'warm_up');
      const mBlocks = workout.blocks.filter((b: any) => b.section !== 'warmup' && b.section !== 'warm_up');
      const warmupCount = wBlocks.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0);
      const mainCount = mBlocks.reduce((sum: number, b: any) => sum + (b.exercises?.length || 0), 0);
      if (warmupCount > 0 || mainCount > 0) {
        return { total: warmupCount + mainCount, warmup: warmupCount, main: mainCount };
      }
    }
    if (workout.exercises) {
      const warmupCount = workout.exercises.filter((ex: any) => ex.section === 'warmup' || ex.section === 'warm_up').length;
      const mainCount = total - warmupCount;
      return { total, warmup: warmupCount, main: mainCount };
    }
    return { total, warmup: 0, main: total };
  })();

  return (
    <div className="min-h-screen bg-background relative">
      <TopHeader 
        onBack={() => window.history.back()}
        title={isFromCalendar && scheduledDate ? formatDate(scheduledDate, 'short') : undefined}
        rightActionLabel={isFromCalendar ? undefined : "Schedule"}
        rightActionIcon={isFromCalendar ? undefined : <Calendar className="h-4 w-4" />}
        onRightAction={isFromCalendar ? undefined : () => setShowScheduleDialog(true)}
        rightMenuButton={
          <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground hover:bg-muted"
                data-testid="button-workout-menu"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-background border-t border-muted">
              <div className="py-4 px-4">
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
                <div className="space-y-2">
                  {isWorkoutCompleted ? (
                    <>
                      {!isVideoWorkout && (
                        <button
                          className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                          onClick={() => {
                            setShowActionSheet(false);
                            setShowEditLogMode(true);
                          }}
                          data-testid="menu-edit-log"
                        >
                          Edit Log
                        </button>
                      )}
                      <button
                        className="w-full text-left py-4 px-2 text-destructive text-lg hover:bg-muted/50 rounded-lg transition-colors"
                        onClick={() => {
                          setShowActionSheet(false);
                          setShowDeleteLogDialog(true);
                        }}
                        data-testid="menu-delete-log"
                      >
                        Delete
                      </button>
                    </>
                  ) : isFromCalendar ? (
                    <>
                      <button
                        className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                        onClick={() => {
                          setShowActionSheet(false);
                          setShowMoveDialog(true);
                        }}
                        data-testid="menu-move-workout"
                      >
                        Move To Another Day
                      </button>
                      <button
                        className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                        disabled={isLoadingEdit}
                        onClick={() => {
                          setShowActionSheet(false);
                          handleEditWorkout();
                        }}
                        data-testid="menu-edit-workout"
                      >
                        {isLoadingEdit ? 'Loading…' : 'Edit This Workout'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                        disabled={isLoadingEdit}
                        onClick={() => {
                          setShowActionSheet(false);
                          handleEditWorkout();
                        }}
                        data-testid="menu-edit-workout"
                      >
                        {isLoadingEdit ? 'Loading…' : 'Edit workout'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        }
      />

      <div className="pt-16 pb-40 max-w-4xl mx-auto">
        <div className="px-6">
          {isWorkoutCompleted ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-4">{workoutNameWithoutNumber}</h1>
              <WorkoutCompletionView 
                workoutLog={completedWorkoutLog}
                onDelete={handleWorkoutDeleted}
                isEditing={showEditLogMode}
                onEditModeChange={setShowEditLogMode}
              />
              
              <AlertDialog open={showDeleteLogDialog} onOpenChange={setShowDeleteLogDialog}>
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
                      onClick={async () => {
                        try {
                          await apiRequest('DELETE', `/api/workout-logs/${completedWorkoutLog.id}`);
                          toast({
                            title: "Workout Deleted",
                            description: "The workout log has been removed.",
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/my-progress'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/my-programs/timeline'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/workout-logs/completed-by-context', enrollmentId, displayWeek, day] });
                          navigate('/');
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to delete workout log",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete Workout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
          <>
          <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{workoutNameWithoutNumber}</h1>
          <div className="border-t border-gray-200 dark:border-gray-700" />

          <div className="flex items-center justify-between text-muted-foreground py-2">
            <div className="flex items-center gap-2">
              {workout.workoutType === 'circuit' ? (
                <Zap className="h-4 w-4" />
              ) : workout.workoutType === 'interval' ? (
                <RotateCcw className="h-4 w-4" />
              ) : workout.workoutType === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Dumbbell className="h-4 w-4" />
              )}
              <span className="text-sm capitalize">{workout.workoutType || 'Regular'}</span>
            </div>
            {!isFromCalendar && scheduleData?.upcomingCount !== undefined && scheduleData.upcomingCount > 0 && (
              <span className="text-sm text-primary font-bold">
                {scheduleData.upcomingCount} Upcoming
              </span>
            )}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Duration: est. {estimatedDuration} minutes</span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Dumbbell className="h-4 w-4" />
            <span className="text-sm">
              {exerciseCounts.total} Exercises{exerciseCounts.warmup > 0 && exerciseCounts.main > 0 && (
                <span className="text-muted-foreground"> ({exerciseCounts.warmup} Warm Up + {exerciseCounts.main} Main Body)</span>
              )}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 mb-2" />

        {workout.description && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">Notes:</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{workout.description}</p>
          </div>
        )}

        <div className="mb-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Equipment:</h3>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const equipmentIcons: Record<string, string> = {
                'Bodyweight': '💪', 'Body Weight': '💪',
                'Mat': '🧘', 'Yoga Mat': '🧘',
                'Dumbbell': '🏋️', 'Dumbbells': '🏋️', 'Barbell': '🏋️',
                'Kettlebell': '🔔',
                'Resistance Band': '🔗', 'Band': '🔗', 'Short Band': '🔗', 'Long Band': '🔗', 'Mini Band': '🔗',
                'Bench': '🪑',
                'Box/Step': '📦', 'Box': '📦', 'Step': '📦',
                'Cable Machine': '⚙️', 'Cable': '⚙️', 'Machine': '⚙️',
                'Pull-up Bar': '🔩', 'Pullup Bar': '🔩',
                'TRX': '🪢', 'Suspension Trainer': '🪢',
                'Foam Roller': '🛢️',
                'Swiss Ball': '⚪', 'Stability Ball': '⚪',
                'Medicine Ball': '🏀', 'Med Ball': '🏀',
                'Sliders': '📊', 'Slider': '📊',
                'Jump Rope': '🪢', 'Wall': '🧱', 'Chair': '🪑',
              };
              const displayName: Record<string, string> = {
                'Bodyweight': 'Body\nWeight', 'Body Weight': 'Body\nWeight',
                'Foam Roller': 'Foam\nRoller', 'Pull Up Bar': 'Pull Up\nBar', 'Pull-up Bar': 'Pull Up\nBar',
                'Resistance Bands': 'Resistance\nBands', 'Resistance Band': 'Resistance\nBands',
                'Cable Machine': 'Cable\nMachine', 'Swiss Ball': 'Swiss\nBall',
                'Medicine Ball': 'Medicine\nBall', 'Kettlebell': 'Kettle\nbell',
                'Stability Ball': 'Stability\nBall', 'Box/Step': 'Box/\nStep',
              };
              const equipmentSet = new Set<string>();
              const blocks = workout.blocks || [];
              const exercises = workout.exercises || [];
              if (blocks.length > 0) {
                blocks.forEach((block: any) => {
                  (block.exercises || []).forEach((ex: any) => {
                    const eqArr = ex.equipment || ex.exerciseEquipment;
                    if (eqArr && Array.isArray(eqArr)) eqArr.forEach((eq: string) => equipmentSet.add(eq));
                  });
                });
              } else {
                exercises.forEach((ex: any) => {
                  const eqArr = ex.equipment || ex.exerciseEquipment;
                  if (eqArr && Array.isArray(eqArr)) eqArr.forEach((eq: string) => equipmentSet.add(eq));
                });
              }
              const equipmentList = Array.from(equipmentSet);
              if (equipmentList.length === 0) return <span className="text-sm text-muted-foreground">No equipment required</span>;
              return equipmentList.map((eq) => {
                const label = displayName[eq] || eq;
                return (
                  <div key={eq} className="flex flex-col items-center gap-1 w-14">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-lg shadow-sm">{equipmentIcons[eq] || '🔧'}</div>
                    <span className="text-[10px] text-center text-muted-foreground leading-tight whitespace-pre-line">{label}</span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 mt-4" />
        </div>
        </>
        )}
        </div>

        {!isWorkoutCompleted && (
        <>
        <div className="space-y-4 mb-8 px-3">
          {workout.exercises && workout.exercises.length > 0 ? (
            <>
              {isCircuitWorkout && (
                <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg">
                  <p className="text-foreground font-medium">
                    Perform as a circuit workout of {circuitRounds} rounds
                  </p>
                </div>
              )}

              {isIntervalWorkout ? (
                <>
                  {warmupExercises.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-black uppercase tracking-wide px-5 py-2 mx-3 bg-primary rounded-full inline-block">Warm Up</h3>
                      {warmupExercises.map((exercise: any, idx: number) => (
                        <ExerciseCard 
                          key={`warmup-${exercise.id}-${idx}`}
                          exercise={exercise}
                          index={idx}
                          workoutId={`/workout-detail/${enrollmentId}/${week}/${day}`}
                        />
                      ))}
                    </div>
                  )}

                  {miniCircuits.length > 0 && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-black uppercase tracking-wide px-5 py-2 mx-3 bg-primary rounded-full inline-block">Main Body</h3>
                      
                      {miniCircuits.map((circuit, circuitIdx) => (
                        <div key={`circuit-${circuitIdx}`} className="space-y-4">
                          <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg">
                            <p className="text-foreground font-medium">
                              Circuit of {circuit.rounds} rounds
                            </p>
                          </div>
                          
                          {circuit.exercises.map((exercise: any, exIdx: number) => {
                            const isLastInCircuit = exIdx === circuit.exercises.length - 1;
                            return (
                              <ExerciseCard 
                                key={`circuit-${circuitIdx}-ex-${exercise.id}-${exIdx}`}
                                exercise={{ ...exercise, rest: isLastInCircuit ? circuit.restAfterRound : undefined }}
                                index={exIdx}
                                workoutId={`/workout-detail/${enrollmentId}/${week}/${day}`}
                                circuitRounds={circuit.rounds}
                                isIntervalWorkout={true}
                              />
                            );
                          })}
                          
                          <div className="flex items-center gap-2 text-muted-foreground pt-2">
                            <span className="text-lg">🔄</span>
                            <span className="text-sm">Repeat for {circuit.rounds} rounds</span>
                          </div>

                          {circuitIdx < miniCircuits.length - 1 && (
                            <Separator className="my-4 opacity-30" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                (() => {
                  const hasBlocks = workout.blocks && workout.blocks.length > 0;
                  
                  if (hasBlocks) {
                    const warmupBlocks = workout.blocks.filter((b: any) => b.section === 'warmup' || b.section === 'warm_up');
                    const mainBlocks = workout.blocks.filter((b: any) => b.section !== 'warmup' && b.section !== 'warm_up');
                    
                    let warmupExerciseIndex = 0;
                    
                    const renderBlock = (block: any, section: 'warmup' | 'main', blockNumber: number, isLastBlock: boolean) => {
                      const blockExercises = block.exercises || [];
                      const isMultiExercise = block.blockType !== 'single' && blockExercises.length > 1;
                      
                      const exerciseCards = blockExercises.map((exercise: any, exIdx: number) => {
                        let label: string;
                        if (section === 'warmup') {
                          label = String.fromCharCode(65 + warmupExerciseIndex);
                          warmupExerciseIndex++;
                        } else {
                          label = `${blockNumber}${String.fromCharCode(65 + exIdx)}`;
                        }
                        
                        const isLastExercise = exIdx === blockExercises.length - 1;
                        const exerciseSetCount = (() => {
                          if (Array.isArray(exercise.sets)) return exercise.sets.length;
                          return parseInt(exercise.sets) || 1;
                        })();
                        const isSingleExerciseSingleSet = blockExercises.length === 1 && exerciseSetCount <= 1;
                        const showRest = isCircuitWorkout 
                          ? (isLastBlock && isLastExercise)
                          : (isLastExercise && !isSingleExerciseSingleSet);
                        
                        return (
                          <ExerciseCard 
                            key={`${section}-${block.id}-${exercise.id}`}
                            exercise={{
                              ...exercise,
                              name: exercise.exerciseName || exercise.name,
                              rest: showRest ? block.rest : undefined,
                            }}
                            index={exIdx}
                            label={label}
                            workoutId={`/workout-detail/${enrollmentId}/${week}/${day}`}
                            circuitRounds={section === 'main' && isCircuitWorkout ? circuitRounds : undefined}
                          />
                        );
                      });
                      
                      if (isMultiExercise) {
                        const cardsWithLabels: JSX.Element[] = [];
                        const blockSetCount = (() => {
                          if (isCircuitWorkout) return circuitRounds;
                          const firstEx = blockExercises[0];
                          if (firstEx?.sets && Array.isArray(firstEx.sets)) return firstEx.sets.length;
                          return parseInt(firstEx?.sets) || 0;
                        })();
                        const blockTypeLabel = isCircuitWorkout ? 'CIRCUIT' : (
                          block.blockType === 'superset' ? 'SUPERSET' :
                          block.blockType === 'triset' ? 'TRISET' :
                          block.blockType === 'circuit' ? 'CIRCUIT' : block.blockType?.toUpperCase() || 'SUPERSET'
                        );
                        const connectorLabel = blockSetCount > 0 
                          ? `${blockTypeLabel} OF ${blockSetCount} ${isCircuitWorkout ? (blockSetCount === 1 ? 'ROUND' : 'ROUNDS') : (blockSetCount === 1 ? 'SET' : 'SETS')}`
                          : blockTypeLabel;
                        exerciseCards.forEach((card: JSX.Element, cardIdx: number) => {
                          cardsWithLabels.push(card);
                          if (cardIdx < exerciseCards.length - 1) {
                            cardsWithLabels.push(
                              <div key={`label-${cardIdx}`} className="relative flex items-center justify-center py-1">
                                <svg className="absolute left-0 top-0 bottom-0 w-2" style={{ height: '100%' }}>
                                  <line x1="2" y1="0" x2="2" y2="100%" stroke="hsl(48, 96%, 53%)" strokeWidth="3" strokeDasharray="5,4" />
                                </svg>
                                <svg className="absolute right-0 top-0 bottom-0 w-2" style={{ height: '100%' }}>
                                  <line x1="2" y1="0" x2="2" y2="100%" stroke="hsl(48, 96%, 53%)" strokeWidth="3" strokeDasharray="5,4" />
                                </svg>
                                <div className="flex items-center gap-1.5 bg-primary px-3 py-1 rounded-full">
                                  <Link className="w-3.5 h-3.5 text-black rotate-45" />
                                  <span className="text-xs font-bold text-black uppercase tracking-wide">{connectorLabel}</span>
                                </div>
                              </div>
                            );
                          }
                        });
                        return (
                          <div key={block.id} className="-space-y-[1px]">
                            {cardsWithLabels}
                          </div>
                        );
                      }
                      
                      return <div key={block.id}>{exerciseCards}</div>;
                    };
                    
                    return (
                      <>
                        {warmupBlocks.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="text-sm font-bold text-black uppercase tracking-wide px-5 py-2 mx-3 bg-primary rounded-full inline-block">Warm Up</h3>
                            {warmupBlocks.map((block: any, idx: number) => renderBlock(block, 'warmup', idx, false))}
                          </div>
                        )}
                        {mainBlocks.length > 0 && (
                          <div className="space-y-4 mt-6">
                            <h3 className="text-sm font-bold text-black uppercase tracking-wide px-5 py-2 mx-3 bg-primary rounded-full inline-block">Main Body</h3>
                            {isCircuitWorkout && (
                              <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg">
                                <p className="text-foreground font-medium">
                                  Perform as a circuit workout of {circuitRounds} rounds
                                </p>
                              </div>
                            )}
                            {mainBlocks.map((block: any, idx: number) => renderBlock(block, 'main', idx + 1, idx === mainBlocks.length - 1))}
                            {isCircuitWorkout && (
                              <div className="flex items-center gap-2 text-muted-foreground pt-2">
                                <span className="text-lg">🔄</span>
                                <span className="text-sm">Repeat for {circuitRounds} rounds</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  }
                  
                  return (
                    <>
                      {workout.exercises.map((exercise: any, idx: number) => {
                        const isLastExercise = idx === workout.exercises.length - 1;
                        const exerciseWithRest = isCircuitWorkout 
                          ? { ...exercise, rest: isLastExercise ? exercise.rest : undefined }
                          : exercise;
                        const isWarmup = exercise.section === 'warmup' || exercise.section === 'warm_up';
                        
                        return (
                          <ExerciseCard 
                            key={`${exercise.id}-${idx}`}
                            exercise={exerciseWithRest}
                            index={idx}
                            workoutId={`/workout-detail/${enrollmentId}/${week}/${day}`}
                            circuitRounds={isCircuitWorkout && !isWarmup ? circuitRounds : undefined}
                          />
                        );
                      })}
                      {isCircuitWorkout && (
                        <div className="flex items-center gap-2 text-muted-foreground pt-2">
                          <span className="text-lg">🔄</span>
                          <span className="text-sm">Repeat for {circuitRounds} rounds</span>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No exercises in this workout</p>
          )}
        </div>
        </>
        )}
      </div>

      {canStartWorkout && !completedLogLoading && !isWorkoutCompleted && (
        <Button 
          onClick={handleStartWorkout}
          disabled={startWorkoutMutation.isPending}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-48 bg-primary hover:opacity-90 text-white rounded-full py-3 text-base font-semibold shadow-xl z-50"
          data-testid="button-start-workout"
        >
          {startWorkoutMutation.isPending ? 'Starting...' : 'START NOW'}
        </Button>
      )}

      <WorkoutScheduleCalendar 
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        enrollmentId={parseInt(enrollmentId || '0')}
        dayPosition={parseInt(day || '1')}
        workoutName={workoutNameWithoutNumber}
      />

      {isFromCalendar && scheduledDateStr && (
        <MoveWorkoutCalendar
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
          enrollmentId={parseInt(enrollmentId || '0')}
          week={displayWeek}
          day={parseInt(day || '1')}
          position={workout?.position}
          workoutName={workoutNameWithoutNumber}
          currentDate={scheduledDateStr}
        />
      )}

      {/* Dialog when there's already an active workout */}
      <AlertDialog open={showActiveWorkoutDialog} onOpenChange={setShowActiveWorkoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workout In Progress</AlertDialogTitle>
            <AlertDialogDescription>
              You have a workout that was started but not finished. Would you like to resume it or cancel it and start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeWorkoutLogId) {
                  navigate(`/active-workout/${activeWorkoutLogId}`);
                } else {
                  cancelActiveWorkoutMutation.mutate();
                }
              }}
              className="bg-primary"
            >
              {activeWorkoutLogId ? 'Resume Workout' : 'Cancel Previous & Start New'}
            </AlertDialogAction>
            {activeWorkoutLogId && (
              <AlertDialogAction
                onClick={() => cancelActiveWorkoutMutation.mutate()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {cancelActiveWorkoutMutation.isPending ? 'Cancelling...' : 'Cancel Previous'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEnrolledProgramme && (
        <>
          <button
            onClick={() => { setShowAiCoach(true); setAiHintDismissed(true); }}
            className="fixed bottom-[50%] right-5 z-40 w-12 h-12 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          >
            <Brain className="h-5 w-5 text-white" />
            {!aiHintDismissed && !hasCompletedThisWorkout && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </button>

          {!aiHintDismissed && !hasCompletedThisWorkout && !showAiCoach && (
            <div className="fixed bottom-[calc(50%+1rem)] right-[4.5rem] z-40 animate-in fade-in-0 slide-in-from-right-2 duration-500">
              <div className="bg-card border border-primary/30 rounded-lg px-3 py-2 shadow-lg max-w-[160px]">
                <p className="text-xs text-foreground font-medium">Check your readiness</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tap to get an AI check</p>
                <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-card border-r border-b border-primary/30 rotate-[-45deg]" />
              </div>
            </div>
          )}

          <Drawer open={showAiCoach} onOpenChange={setShowAiCoach}>
            <DrawerContent className="bg-background border-t border-muted max-h-[80vh]">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-2" />
              <div className="px-5 pb-8 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">AI Workout Coach</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {!hasCompletedThisWorkout ? (
                    <>
                      <button
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                          aiCoachMode === 'readiness' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                        }`}
                        onClick={() => aiCoachMutation.mutate('readiness')}
                        disabled={aiCoachMutation.isPending}
                      >
                        <Activity className="h-5 w-5 text-green-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium">Am I ready?</p>
                          <p className="text-[10px] text-muted-foreground">Check readiness</p>
                        </div>
                      </button>
                      <button
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                          aiCoachMode === 'warmup_tips' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                        }`}
                        onClick={() => aiCoachMutation.mutate('warmup_tips')}
                        disabled={aiCoachMutation.isPending}
                      >
                        <Sparkles className="h-5 w-5 text-[#0cc9a9] flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium">Pre-workout</p>
                          <p className="text-[10px] text-muted-foreground">Tips & focus areas</p>
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                          aiCoachMode === 'post_workout' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                        }`}
                        onClick={() => aiCoachMutation.mutate('post_workout')}
                        disabled={aiCoachMutation.isPending}
                      >
                        <Activity className="h-5 w-5 text-purple-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium">How did I do?</p>
                          <p className="text-[10px] text-muted-foreground">Performance review</p>
                        </div>
                      </button>
                      <button
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                          aiCoachMode === 'recovery_tips' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                        }`}
                        onClick={() => aiCoachMutation.mutate('recovery_tips')}
                        disabled={aiCoachMutation.isPending}
                      >
                        <Heart className="h-5 w-5 text-red-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium">Recovery</p>
                          <p className="text-[10px] text-muted-foreground">What to do next</p>
                        </div>
                      </button>
                    </>
                  )}
                </div>

                {aiCoachMutation.isPending && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">Analysing your data...</span>
                  </div>
                )}

                {aiCoachData && !aiCoachMutation.isPending && (
                  <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    {aiCoachMode === 'readiness' && aiCoachData.data && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl font-bold ${
                            (aiCoachData.data.readinessScore || 0) >= 7 ? 'text-green-400' :
                            (aiCoachData.data.readinessScore || 0) >= 4 ? 'text-[#0cc9a9]' : 'text-red-400'
                          }`}>{aiCoachData.data.readinessScore}/10</div>
                          <div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              aiCoachData.data.status === 'good_to_go' ? 'bg-green-500/10 text-green-400' :
                              aiCoachData.data.status === 'scale_back' ? 'bg-[#0cc9a9]/10 text-[#0cc9a9]' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {aiCoachData.data.status === 'good_to_go' ? 'Good to go' :
                               aiCoachData.data.status === 'scale_back' ? 'Scale back' : 'Rest day'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{aiCoachData.data.summary}</p>
                        {aiCoachData.data.flags?.length > 0 && (
                          <div className="bg-[#0cc9a9]/5 rounded-lg p-3">
                            <p className="text-xs font-medium text-[#0cc9a9] mb-1">Watch out for</p>
                            {aiCoachData.data.flags.map((f: string, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">- {f}</p>
                            ))}
                          </div>
                        )}
                        {aiCoachData.data.recommendation && (
                          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                            <p className="text-xs font-medium text-primary mb-1">Today's plan</p>
                            <p className="text-xs text-muted-foreground">{aiCoachData.data.recommendation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(aiCoachMode === 'warmup_tips' || aiCoachMode === 'recovery_tips') && aiCoachData.data && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{aiCoachData.data.summary}</p>
                        {aiCoachData.data.tips?.map((tip: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-card rounded-lg p-3">
                            <span className="text-primary text-sm font-bold mt-0.5">{i + 1}</span>
                            <p className="text-sm text-muted-foreground">{tip}</p>
                          </div>
                        ))}
                        {aiCoachData.data.focusAreas?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {aiCoachData.data.focusAreas.map((area: string, i: number) => (
                              <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">{area}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {aiCoachMode === 'post_workout' && aiCoachData.data && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{aiCoachData.data.summary}</p>
                        {aiCoachData.data.weeklyProgress && (
                          <div className="flex gap-3 text-xs">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded">{aiCoachData.data.weeklyProgress}</span>
                            {aiCoachData.data.streak && <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded">{aiCoachData.data.streak}</span>}
                          </div>
                        )}
                        {aiCoachData.data.tip && (
                          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                            <p className="text-xs font-medium text-primary mb-1">Next session tip</p>
                            <p className="text-xs text-muted-foreground">{aiCoachData.data.tip}</p>
                          </div>
                        )}
                        {aiCoachData.data.recoveryNote && (
                          <div className="bg-purple-500/5 rounded-lg p-3">
                            <p className="text-xs font-medium text-purple-400 mb-1">Recovery</p>
                            <p className="text-xs text-muted-foreground">{aiCoachData.data.recoveryNote}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {aiCoachData.data?.raw && (
                      <p className="text-sm text-muted-foreground">{aiCoachData.data.summary}</p>
                    )}

                    {!aiFeedbackSent[aiCoachMode || ''] && (
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">Was this helpful?</span>
                        <div className="flex gap-2">
                          <button
                            className="p-2 rounded-lg hover:bg-green-500/10 transition-colors"
                            onClick={() => aiCoachFeedbackMutation.mutate({ rating: 'positive', aiMessage: JSON.stringify(aiCoachData.data) })}
                            disabled={aiCoachFeedbackMutation.isPending}
                          >
                            <ThumbsUp className="h-4 w-4 text-muted-foreground hover:text-green-400" />
                          </button>
                          <button
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            onClick={() => aiCoachFeedbackMutation.mutate({ rating: 'negative', aiMessage: JSON.stringify(aiCoachData.data) })}
                            disabled={aiCoachFeedbackMutation.isPending}
                          >
                            <ThumbsDown className="h-4 w-4 text-muted-foreground hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    )}
                    {aiFeedbackSent[aiCoachMode || ''] && (
                      <p className="text-xs text-center text-muted-foreground pt-3 border-t border-border">Thanks for your feedback</p>
                    )}
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}

    </div>
  );
}
