import { useState, useEffect, useRef } from "react";
import { localDateStr } from "@/lib/dateUtils";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getMuxThumbnailUrl } from "@/lib/mux";
import { 
  Dumbbell, 
  GripVertical, 
  Check, 
  Layers, 
  Trash2, 
  Plus,
  Minus,
  Clock,
  FolderOpen,
  Loader2,
  ChevronRight
} from "lucide-react";

interface ExerciseData {
  id: string;
  kind: 'exercise' | 'rest';
  exerciseLibraryId: number | null;
  exerciseName: string;
  imageUrl: string | null;
  muxPlaybackId: string | null;
  blockType: 'single' | 'superset' | 'triset' | 'circuit';
  blockGroupId?: string;
  section: 'warmup' | 'main';
  position: number;
  restPeriod: string;
  restDuration?: number; // For rest blocks - duration in seconds
  setsCount: number;
  targetReps: string;
  targetDuration: string;
  durationType: 'timer' | 'text';
  exerciseType: 'strength' | 'timed_strength' | 'general' | 'endurance' | 'cardio' | 'timed';
}

type WorkoutType = 'regular' | 'interval' | 'circuit';

// Serialize a seconds value into the same string format the admin panel uses
// (e.g. "30 sec", "1 min", "1 min 15 sec", "5 min"). Keeps stored block.rest
// values consistent across admin and user-side edits.
const secondsToAdminRest = (totalSecs: number): string => {
  const s = Math.max(0, Math.round(totalSecs || 0));
  if (s < 60) return `${s} sec`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${mins} min` : `${mins} min ${rem} sec`;
};

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

export default function BuildWodPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  
  const typeParam = searchParams.get('type') as WorkoutType | null;
  const categoryParam = searchParams.get('category') || 'workout';
  const dateParam = searchParams.get('date');
  const fromParam = searchParams.get('from');
  const programmeDayParam = searchParams.get('programmeDay');
  const isProgrammeMode = programmeDayParam !== null;
  const enrollmentWorkoutIdParam = searchParams.get('enrollmentWorkoutId');
  const enrollmentIdParam = searchParams.get('enrollmentId');
  const isEnrolledEditMode = !!enrollmentWorkoutIdParam && !!enrollmentIdParam;
  const editWorkoutIdParam = searchParams.get('editWorkoutId');
  const isWorkoutEditMode = !!editWorkoutIdParam && !isEnrolledEditMode;
  
  const selectedDate = dateParam ? new Date(dateParam) : new Date();
  const showTypeSelector = categoryParam === 'workout' && !typeParam;
  const [workoutType] = useState<WorkoutType>(typeParam || 'regular');
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [intervalRounds, setIntervalRounds] = useState<number>(4);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{ startIndex: number; size: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'sets' | 'reps' | 'rest' | 'duration' | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingBlockIndices, setEditingBlockIndices] = useState<number[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const originalExercisesRef = useRef<string | null>(null);
  const [showAddRestDialog, setShowAddRestDialog] = useState(false);
  const [addRestValue, setAddRestValue] = useState<number>(60);
  const [showLoadSavedDialog, setShowLoadSavedDialog] = useState(false);
  const [loadingSavedId, setLoadingSavedId] = useState<number | null>(null);

  const { data: libraryExercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
  });

  const { data: savedWorkouts = [] } = useQuery<any[]>({
    queryKey: ['/api/workouts/mine'],
  });

  // When in enrolled edit mode, fetch workout data from API as source of truth
  const { data: enrolledProgramData } = useQuery<any>({
    queryKey: [`/api/my-programs/${enrollmentIdParam}`],
    enabled: isEnrolledEditMode && !!enrollmentIdParam,
    staleTime: 0,
  });

  // When in workout-edit mode, fetch the workout's blocks from the API
  const { data: workoutEditBlocks } = useQuery<any[]>({
    queryKey: ['/api/workouts', editWorkoutIdParam, 'exercises'],
    queryFn: async () => {
      const r = await fetch(`/api/workouts/${editWorkoutIdParam}/exercises`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load workout');
      return r.json();
    },
    enabled: isWorkoutEditMode,
    staleTime: 0,
  });

  // Also fetch the workout itself so we know workoutType / intervalRounds (circuit rounds live there)
  const { data: workoutEditMeta } = useQuery<any>({
    queryKey: ['/api/workouts', editWorkoutIdParam],
    queryFn: async () => {
      const r = await fetch(`/api/workouts/${editWorkoutIdParam}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load workout meta');
      return r.json();
    },
    enabled: isWorkoutEditMode,
    staleTime: 0,
  });

  const normalizeExercises = (exs: ExerciseData[]) =>
    JSON.stringify(exs.map(({ id, ...rest }) => rest));

  const hasChanges =
    exercises.length > 0 &&
    (originalExercisesRef.current === null ||
      normalizeExercises(exercises) !== originalExercisesRef.current);

  useEffect(() => {
    const selectedId = sessionStorage.getItem('selectedExerciseId');
    const savedExercises = sessionStorage.getItem('wodExercises');
    
    if (savedExercises && libraryExercises.length > 0) {
      try {
        const parsed = JSON.parse(savedExercises) as ExerciseData[];
        // Only auto-group for circuit workoutType, not interval (interval can have multiple circuits)
        const isCircuitWorkout = workoutType === 'circuit';
        
        // Generate a shared blockGroupId for circuit auto-grouping (only if exercises don't already have one)
        const circuitGroupId = `circuit-main-${Date.now()}`;
        
        const updatedExercises = parsed.map(ex => {
          const libExercise = ex.exerciseLibraryId 
            ? libraryExercises.find((e: any) => e.id === ex.exerciseLibraryId)
            : null;
          const exerciseType = libExercise?.exerciseType || ex.exerciseType || 'strength';
          const isTimeBased = exerciseType === 'timed' || 
                             exerciseType === 'timed_strength' ||
                             exerciseType === 'general' ||
                             exerciseType === 'cardio';
          
          // For circuit workouts, set blockType to circuit but KEEP reps (only interval uses time-only)
          const shouldBeCircuit = isCircuitWorkout && ex.section === 'main';
          
          if (shouldBeCircuit) {
            return {
              ...ex,
              kind: ex.kind || 'exercise' as const,
              exerciseType,
              blockType: 'circuit' as const,
              blockGroupId: ex.blockGroupId || circuitGroupId,
              setsCount: ex.setsCount || 3,
              targetReps: ex.targetReps || '8-12',
              targetDuration: isTimeBased ? (ex.targetDuration || '60 sec') : ex.targetDuration,
              durationType: isTimeBased ? 'timer' as const : 'text' as const,
              restPeriod: ex.restPeriod || '60s',
            };
          }
          
          return {
            ...ex,
            kind: ex.kind || 'exercise' as const,
            exerciseType,
            durationType: isTimeBased ? 'timer' as const : 'text' as const,
            targetDuration: isTimeBased && !ex.targetDuration ? '30 sec' : ex.targetDuration,
            targetReps: ex.targetReps || '8-12',
          };
        });
        setExercises(updatedExercises);
        // Always overwrite the snapshot here — this is the fully enriched version
        originalExercisesRef.current = normalizeExercises(updatedExercises);
      } catch (e) {
        console.error('Failed to restore exercises:', e);
      }
    } else if (savedExercises) {
      try {
        const parsed = JSON.parse(savedExercises) as ExerciseData[];
        // Only auto-group for circuit workoutType, not interval
        const isCircuitWorkout = workoutType === 'circuit';
        
        // Generate a shared blockGroupId for circuit auto-grouping
        const circuitGroupId = `circuit-main-${Date.now()}`;
        
        // Normalize for circuit workouts even without library data - KEEP reps (only interval uses time-only)
        if (isCircuitWorkout) {
          const normalized = parsed.map(ex => 
            ex.section === 'main' ? {
              ...ex,
              kind: ex.kind || 'exercise' as const,
              blockType: 'circuit' as const,
              blockGroupId: ex.blockGroupId || circuitGroupId,
              setsCount: ex.setsCount || 3,
              targetReps: ex.targetReps || '8-12',
              targetDuration: ex.targetDuration,
              durationType: ex.durationType || 'text' as const,
              restPeriod: ex.restPeriod || '60s',
            } : { ...ex, kind: ex.kind || 'exercise' as const }
          );
          setExercises(normalized);
          // Do NOT snapshot here — library data hasn't loaded yet; the enriched
          // branch above will overwrite once library data arrives
        } else {
          // Ensure all exercises have the kind field
          const normalized = parsed.map(ex => ({ ...ex, kind: ex.kind || 'exercise' as const }));
          setExercises(normalized);
          // Do NOT snapshot here — library data hasn't loaded yet
        }
      } catch (e) {
        console.error('Failed to restore exercises:', e);
      }
    }
    
    if (selectedId && libraryExercises.length > 0) {
      const selectedExercise = libraryExercises.find((e: any) => e.id === parseInt(selectedId));
      if (selectedExercise) {
        const exerciseType = (selectedExercise.exerciseType || 'strength') as ExerciseData['exerciseType'];
        const isTimeBased = exerciseType === 'timed' || 
                           exerciseType === 'timed_strength' ||
                           exerciseType === 'general' ||
                           exerciseType === 'cardio';
        const insertSection = (sessionStorage.getItem('wodInsertSection') || 'main') as 'warmup' | 'main';
        const sectionExercises = exercises.filter(e => e.section === insertSection);
        
        // Only auto-group for circuit workoutType, not interval (interval can have multiple circuits)
        const isCircuitWorkout = workoutType === 'circuit';
        const shouldBeCircuit = isCircuitWorkout && insertSection === 'main';
        
        // For circuit workouts, find or create a shared blockGroupId
        const existingCircuitGroupId = shouldBeCircuit 
          ? sectionExercises.find(e => e.blockGroupId)?.blockGroupId 
          : undefined;
        const circuitGroupId = shouldBeCircuit 
          ? (existingCircuitGroupId || `circuit-main-${Date.now()}`) 
          : undefined;
        
        // For interval workouts, ALWAYS set duration (duration is required for interval mode)
        const isIntervalWorkout = workoutType === 'interval';
        const needsDuration = isTimeBased || isIntervalWorkout;
        
        const hasFoamRollerEquipment = Array.isArray(selectedExercise.equipment) && 
          selectedExercise.equipment.some((e: string) => e.toLowerCase().includes('foam roller'));
        const hasFoamRollerName = (selectedExercise.name || '').toLowerCase().includes('foam roller');
        const isFoamRoller = exerciseType === 'general' && (hasFoamRollerEquipment || hasFoamRollerName);

        const newExercise: ExerciseData = {
          id: Date.now().toString(),
          kind: 'exercise',
          exerciseLibraryId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          imageUrl: selectedExercise.imageUrl,
          muxPlaybackId: selectedExercise.muxPlaybackId,
          blockType: shouldBeCircuit ? 'circuit' : 'single',
          blockGroupId: circuitGroupId,
          section: insertSection,
          position: sectionExercises.length,
          restPeriod: isFoamRoller ? 'none' : '60s',
          setsCount: isFoamRoller ? 1 : 3,
          targetReps: isIntervalWorkout ? '' : (isFoamRoller ? '' : '8-12'),
          targetDuration: isFoamRoller ? '30 sec' : (needsDuration ? '45 sec' : ''),
          durationType: isFoamRoller ? 'timer' : (needsDuration ? 'timer' : 'text'),
          exerciseType,
        };
        
        // If circuit workoutType and there are existing main exercises, update them all to be circuit (keep reps!)
        if (shouldBeCircuit && sectionExercises.length > 0) {
          setExercises(prev => {
            const updated = prev.map(ex => 
              ex.section === 'main' ? { 
                ...ex, 
                blockType: 'circuit' as const,
                blockGroupId: circuitGroupId,
                setsCount: ex.setsCount || 3,
                targetReps: ex.targetReps || '8-12',
                restPeriod: ex.restPeriod || '60s',
              } : ex
            );
            return [...updated, newExercise];
          });
        } else {
          setExercises(prev => [...prev, newExercise]);
        }
        sessionStorage.removeItem('selectedExerciseId');
        sessionStorage.removeItem('wodInsertSection');
        console.log('[PICKER-RETURN] appended new exercise:', newExercise.exerciseName, 'section=', newExercise.section);
      } else {
        console.log('[PICKER-RETURN] selectedId set but exercise not found in library:', selectedId);
      }
    } else if (selectedId) {
      console.log('[PICKER-RETURN] selectedId set but library not yet loaded; waiting');
    }
    // Clear the round-trip flag once restoration is done so loaders aren't blocked next mount
    if (savedExercises) {
      sessionStorage.removeItem('wodExercises');
    }
  }, [libraryExercises]);

  useEffect(() => {
    if (exercises.length > 0) {
      sessionStorage.setItem('wodExercises', JSON.stringify(exercises));
    }
  }, [exercises]);

  // Fallback: when in enrolled edit mode and exercises are empty (e.g. navigated back via browser),
  // load directly from the API instead of relying on sessionStorage
  useEffect(() => {
    if (!isEnrolledEditMode || !enrolledProgramData || exercises.length > 0) return;
    if (typeof window !== 'undefined' && (sessionStorage.getItem('selectedExerciseId') || sessionStorage.getItem('wodExercises'))) return;

    const workouts: any[] = enrolledProgramData.workouts || [];
    const targetWorkout = workouts.find((w: any) => w.id === Number(enrollmentWorkoutIdParam));
    if (!targetWorkout || !targetWorkout.blocks?.length) return;

    const exerciseData: ExerciseData[] = targetWorkout.blocks.map((block: any, idx: number) => {
      const libExercise = libraryExercises.find((e: any) => e.id === block.exerciseLibraryId);
      const exerciseType = libExercise?.exerciseType || block.exerciseType || 'strength';
      const isTimeBased = ['timed', 'timed_strength', 'general', 'cardio'].includes(exerciseType);
      const section = block.section === 'warmup' ? 'warmup' : 'main';
      const reps = block.reps ?? block.targetReps ?? '8-12';
      const duration = block.duration ?? block.targetDuration ?? (isTimeBased ? '30 sec' : undefined);
      const restSecs = block.restSeconds ?? 60;

      return {
        id: `api-${block.id ?? idx}-${Date.now()}`,
        kind: 'exercise' as const,
        exerciseLibraryId: block.exerciseLibraryId,
        exerciseName: block.exerciseName || libExercise?.name || 'Exercise',
        imageUrl: block.imageUrl || libExercise?.imageUrl,
        muxPlaybackId: block.muxPlaybackId || libExercise?.muxPlaybackId,
        section,
        position: block.position ?? idx,
        blockType: block.blockType || (block.blockGroupId ? 'superset' : 'single'),
        blockGroupId: block.blockGroupId || undefined,
        setsCount: block.sets ?? block.setsCount ?? 3,
        targetReps: String(reps),
        targetDuration: duration,
        durationType: (isTimeBased ? 'timer' : 'text') as 'timer' | 'text',
        restPeriod: restSecs ? `${restSecs}s` : undefined,
        exerciseType: exerciseType as ExerciseData['exerciseType'],
      };
    });

    setExercises(exerciseData);
    if (originalExercisesRef.current === null) {
      originalExercisesRef.current = normalizeExercises(exerciseData);
    }
  }, [isEnrolledEditMode, enrolledProgramData, enrollmentWorkoutIdParam, exercises.length, libraryExercises]);

  // Populate exercises from a regular workout's blocks (workout-edit mode)
  useEffect(() => {
    if (!isWorkoutEditMode || !workoutEditBlocks || !workoutEditMeta || exercises.length > 0) return;
    if (typeof window !== 'undefined' && (sessionStorage.getItem('selectedExerciseId') || sessionStorage.getItem('wodExercises'))) return;

    const loaded: ExerciseData[] = [];
    const isCircuitTypeWorkout = workoutEditMeta?.workoutType === 'circuit';
    const workoutLevelRounds = workoutEditMeta?.intervalRounds || workoutEditMeta?.circuitRounds || null;
    for (const block of workoutEditBlocks) {
      const section = block.section === 'warmup' ? 'warmup' : 'main';
      // Standalone rest block between circuits — emit as a synthetic rest entry
      // matching the shape produced by the "Add Rest" button.
      if (block.blockType === 'rest') {
        const restStr: string = block.rest || '30 sec';
        // Handles "60 sec", "1 min", "1 min 15 sec", "90s", etc.
        let restSecs = 0;
        const re = /(\d+)\s*(min|m|sec|s)?/gi;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(String(restStr))) !== null) {
          const n = parseInt(mm[1], 10);
          const unit = (mm[2] || 'sec').toLowerCase();
          restSecs += unit.startsWith('m') ? n * 60 : n;
        }
        if (!restSecs) restSecs = 30;
        loaded.push({
          id: `edit-rest-${block.id || Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: 'rest',
          exerciseLibraryId: null,
          exerciseName: 'Rest',
          imageUrl: null,
          muxPlaybackId: null,
          blockType: 'single',
          section,
          position: loaded.filter(e => e.section === section).length,
          restPeriod: 'none',
          restDuration: restSecs,
          setsCount: 1,
          targetReps: '',
          targetDuration: `${restSecs} sec`,
          durationType: 'timer',
          exerciseType: 'timed',
        } as ExerciseData);
        continue;
      }
      const isMultiExerciseBlock = block.blockType && block.blockType !== 'single';
      const blockGroupId = isMultiExerciseBlock
        ? `edit-${block.id || Date.now()}-${Math.random().toString(36).slice(2)}`
        : undefined;
      for (const ex of (block.exercises || [])) {
        const libExercise = libraryExercises.find((e: any) => e.id === ex.exerciseLibraryId);
        const exerciseType = libExercise?.exerciseType || ex.exerciseType || 'strength';
        const isTimeBased = ['timed', 'timed_strength', 'general', 'cardio'].includes(exerciseType);
        const sets = ex.sets || [{ reps: '8-12' }];
        const firstSet = sets[0] || {};
        // Set count resolution priority:
        // 1. Circuit-type workouts: rounds live on the workout (intervalRounds/circuitRounds).
        // 2. Multi-exercise blocks (circuit/superset/triset): rounds live on the block.
        // 3. Single exercises: count = length of the per-exercise sets array.
        let setsCount: number;
        if (isMultiExerciseBlock && isCircuitTypeWorkout && workoutLevelRounds) {
          setsCount = workoutLevelRounds;
        } else if (isMultiExerciseBlock) {
          setsCount = block.rounds || workoutLevelRounds || sets.length || 1;
        } else {
          setsCount = sets.length || 1;
        }
        loaded.push({
          id: `edit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: 'exercise',
          exerciseLibraryId: ex.exerciseLibraryId || null,
          exerciseName: ex.exerciseName || libExercise?.name || ex.name || '',
          imageUrl: ex.imageUrl || libExercise?.imageUrl || null,
          muxPlaybackId: ex.muxPlaybackId || libExercise?.muxPlaybackId || null,
          blockType: block.blockType || 'single',
          blockGroupId,
          section,
          position: loaded.filter(e => e.section === section).length,
          restPeriod: block.rest || '60s',
          setsCount,
          targetReps: firstSet.reps || '8-12',
          targetDuration: isTimeBased ? (firstSet.duration || '30 sec') : (firstSet.duration || ''),
          durationType: isTimeBased ? 'timer' : 'text',
          exerciseType,
        } as ExerciseData);
      }
    }
    setExercises(loaded);
    if (originalExercisesRef.current === null) {
      originalExercisesRef.current = normalizeExercises(loaded);
    }
  }, [isWorkoutEditMode, workoutEditBlocks, exercises.length, libraryExercises]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const workoutData = {
        date: localDateStr(selectedDate),
        workoutType,
        category: categoryParam,
        exercises,
        intervalRounds: workoutType === 'interval' ? intervalRounds : 
                        workoutType === 'circuit' ? (exercises.find(e => e.section === 'main')?.sets || 3) : null,
      };
      const response = await apiRequest("POST", "/api/workout-logs/custom", workoutData);
      return response.json();
    },
    onSuccess: (data) => {
      sessionStorage.removeItem('wodExercises');
      toast({ title: "Workout saved!" });
      navigate(`/wod/${data.id}`);
    },
    onError: () => {
      toast({ title: "Failed to save workout", variant: "destructive" });
    },
  });

  const workoutEditSaveMutation = useMutation({
    mutationFn: async () => {
      const blockMap = new Map<string, ExerciseData[]>();
      const blockOrder: string[] = [];
      for (const ex of exercises) {
        const key = ex.blockGroupId || ex.id;
        if (!blockMap.has(key)) { blockMap.set(key, []); blockOrder.push(key); }
        blockMap.get(key)!.push(ex);
      }
      const blocks = blockOrder.map(key => {
        const group = blockMap.get(key)!;
        const first = group[0];
        // Standalone rest block — emit with no exercises so the server stores it
        // as a rest row in workout_blocks.
        if (first.kind === 'rest') {
          return {
            section: first.section,
            blockType: 'rest',
            rest: secondsToAdminRest(first.restDuration || 30),
            rounds: null,
            exercises: [],
          };
        }
        const blockType = first.blockType || 'single';
        const isMultiExerciseBlock = blockType !== 'single';
        return {
          section: first.section,
          blockType,
          rest: first.restPeriod || '60s',
          // For circuits/supersets/trisets, store the round count on the block;
          // each exercise then carries a single set entry describing one round's reps/duration.
          rounds: isMultiExerciseBlock ? (first.setsCount || 1) : null,
          exercises: group.map(ex => ({
            exerciseLibraryId: ex.exerciseLibraryId,
            sets: isMultiExerciseBlock
              ? [{ reps: ex.targetReps || '', duration: ex.targetDuration || '' }]
              : Array.from({ length: ex.setsCount || 1 }, () => ({
                  reps: ex.targetReps || '',
                  duration: ex.targetDuration || '',
                })),
            durationType: ex.durationType || null,
            tempo: null, load: null, notes: null,
          })),
        };
      });
      // For circuit-type workouts the round count lives on the workout itself
      // (intervalRounds), so propagate the first multi-exercise block's rounds up.
      const effectiveWorkoutType = workoutType || workoutEditMeta?.workoutType || 'regular';
      const firstMultiBlock = blocks.find(b => b.blockType && b.blockType !== 'single');
      const payload: Record<string, any> = { blocks, workoutType: effectiveWorkoutType };
      if (firstMultiBlock?.rounds) {
        payload.intervalRounds = firstMultiBlock.rounds;
      }
      const response = await apiRequest('PATCH', `/api/workouts/${editWorkoutIdParam}`, payload);
      return response.json();
    },
    onSuccess: () => {
      sessionStorage.removeItem('wodExercises');
      queryClient.invalidateQueries({ queryKey: ['/api/workouts', editWorkoutIdParam] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts', editWorkoutIdParam, 'exercises'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-workout'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      toast({ title: "Workout updated!" });
      navigate(fromParam || '/', { replace: true });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save workout", description: err?.message, variant: "destructive" });
    },
  });

  const enrolledSaveMutation = useMutation({
    mutationFn: async () => {
      // Convert ExerciseData[] → blocks[] for the PUT endpoint
      const blockMap = new Map<string, ExerciseData[]>();
      const blockOrder: string[] = [];
      for (const ex of exercises) {
        const key = ex.blockGroupId || ex.id;
        if (!blockMap.has(key)) { blockMap.set(key, []); blockOrder.push(key); }
        blockMap.get(key)!.push(ex);
      }
      const blocks = blockOrder.map(key => {
        const group = blockMap.get(key)!;
        const first = group[0];
        if (first.kind === 'rest') {
          return {
            section: first.section,
            blockType: 'rest',
            rest: secondsToAdminRest(first.restDuration || 30),
            exercises: [],
          };
        }
        return {
          section: first.section,
          blockType: first.blockType || 'single',
          rest: first.restPeriod || '60s',
          exercises: group.map(ex => ({
            exerciseLibraryId: ex.exerciseLibraryId,
            sets: Array.from({ length: ex.setsCount || 1 }, () => ({
              reps: ex.targetReps || '',
              duration: ex.targetDuration || '',
            })),
            tempo: null, load: null, notes: null,
          })),
        };
      });
      const response = await apiRequest('PUT', `/api/my-programs/${enrollmentIdParam}/enrollment-workouts/${enrollmentWorkoutIdParam}/blocks`, { blocks });
      return response.json();
    },
    onSuccess: () => {
      sessionStorage.removeItem('wodExercises');
      toast({ title: "Workout updated!" });
      navigate(fromParam || '/', { replace: true });
    },
    onError: () => {
      toast({ title: "Failed to save workout", variant: "destructive" });
    },
  });

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelConfirm(true);
    } else {
      sessionStorage.removeItem('wodExercises');
      navigate(fromParam || "/", { replace: isEnrolledEditMode || isWorkoutEditMode });
    }
  };

  const handleSaveClick = () => {
    // Only show the "update for all future occurrences" confirmation when editing
    // a workout inside an enrolled programme. Library/scheduled workouts edit a
    // single user-owned copy, so save without an extra prompt.
    if (hasChanges && isEnrolledEditMode) {
      setShowSaveConfirm(true);
    } else {
      handleSave();
    }
  };

  const confirmCancel = () => {
    sessionStorage.removeItem('wodExercises');
    setShowCancelConfirm(false);
    navigate(fromParam || "/", { replace: isEnrolledEditMode });
  };

  const handleLoadSavedWorkout = async (workoutId: number) => {
    try {
      setLoadingSavedId(workoutId);
      const res = await fetch(`/api/workouts/${workoutId}/exercises`);
      if (!res.ok) throw new Error('Failed to load workout');
      const blocks = await res.json();

      const loadedExercises: ExerciseData[] = [];

      for (const block of blocks) {
        const section = block.section || 'main';
        const blockGroupId = block.blockType !== 'single'
          ? `loaded-${block.id}-${Date.now()}`
          : undefined;

        for (const blockEx of (block.exercises || [])) {
          const exerciseType = blockEx.exerciseType || 'strength';
          const isTimeBased = exerciseType === 'timed' || exerciseType === 'timed_strength' ||
            exerciseType === 'general' || exerciseType === 'cardio';

          const sets = blockEx.sets || [{ reps: '10' }];
          const firstSet = sets[0];

          loadedExercises.push({
            id: `loaded-${block.id}-${blockEx.id}-${Date.now()}`,
            kind: 'exercise',
            exerciseLibraryId: blockEx.exerciseLibraryId || null,
            exerciseName: blockEx.exerciseName || 'Unknown Exercise',
            imageUrl: blockEx.imageUrl || null,
            muxPlaybackId: blockEx.muxPlaybackId || null,
            blockType: block.blockType || 'single',
            blockGroupId,
            section: section as 'warmup' | 'main',
            position: loadedExercises.filter(e => e.section === section).length,
            restPeriod: block.rest || '60s',
            setsCount: sets.length,
            targetReps: firstSet?.reps || '8-12',
            targetDuration: isTimeBased ? (firstSet?.duration || '30 sec') : (firstSet?.duration || ''),
            durationType: isTimeBased ? 'timer' : 'text',
            exerciseType: exerciseType as ExerciseData['exerciseType'],
          });
        }
      }

      setExercises(loadedExercises);
      setShowLoadSavedDialog(false);
      toast({ title: "Workout loaded" });
    } catch (err) {
      toast({ title: "Failed to load workout", variant: "destructive" });
    } finally {
      setLoadingSavedId(null);
    }
  };

  const handleSave = () => {
    if (isEnrolledEditMode) {
      enrolledSaveMutation.mutate();
      return;
    }
    if (isWorkoutEditMode) {
      workoutEditSaveMutation.mutate();
      return;
    }
    if (isProgrammeMode) {
      sessionStorage.setItem('programmeWorkoutData', JSON.stringify({
        day: parseInt(programmeDayParam || '0'),
        exercises,
        workoutType,
      }));
      sessionStorage.removeItem('wodExercises');
      toast({ title: "Workout added to programme" });
      navigate(fromParam || '/training/create-programme');
      return;
    }
    saveMutation.mutate();
  };

  const handleInsertExercise = (section: 'warmup' | 'main' = 'main') => {
    sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
    sessionStorage.setItem('wodExercises', JSON.stringify(exercises));
    sessionStorage.setItem('wodInsertSection', section);
    if (categoryParam === 'stretching') {
      sessionStorage.setItem('wodMovementFilter', JSON.stringify(['Mobility', 'Static Stretches']));
    } else {
      sessionStorage.removeItem('wodMovementFilter');
    }
    navigate('/admin/select-exercise', { replace: true });
  };

  const handleGroupExercises = () => {
    if (selectedExercises.length >= 2) {
      const blockType = selectedExercises.length === 2 ? 'superset' :
                        selectedExercises.length === 3 ? 'triset' : 'circuit';
      const blockGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newExercises = exercises.map(ex => {
        if (selectedExercises.includes(ex.id)) {
          return { 
            ...ex, 
            blockType: blockType as any,
            blockGroupId: blockGroupId,
          };
        }
        return ex;
      });
      setExercises(newExercises);
      setSelectedExercises([]);
      toast({
        title: "Exercises grouped",
        description: `Created ${blockType} with ${selectedExercises.length} exercises`,
      });
    }
  };

  const handleDeleteExercises = () => {
    if (selectedExercises.length > 0) {
      const newExercises = exercises.filter((ex) => !selectedExercises.includes(ex.id));
      setExercises(newExercises);
      setSelectedExercises([]);
      toast({
        title: "Exercises deleted",
        description: `Removed ${selectedExercises.length} exercise(s)`,
      });
    }
  };

  const handleAddRest = () => {
    setAddRestValue(60);
    setShowAddRestDialog(true);
  };

  const confirmAddRest = () => {
    if (addRestValue === 0) {
      toast({
        title: "No rest selected",
        description: "Please select a rest duration",
        variant: "destructive",
      });
      return;
    }
    
    // Create a new rest block and add it to the main section
    const mainExs = exercises.filter(ex => ex.section === 'main');
    
    const restBlock: ExerciseData = {
      id: `rest-${Date.now()}`,
      kind: 'rest',
      exerciseLibraryId: null,
      exerciseName: 'Rest',
      imageUrl: null,
      muxPlaybackId: null,
      blockType: 'single',
      section: 'main',
      position: mainExs.length,
      restPeriod: 'none',
      restDuration: addRestValue,
      setsCount: 1,
      targetReps: '',
      targetDuration: `${addRestValue} sec`,
      durationType: 'timer',
      exerciseType: 'timed',
    };
    
    setExercises(prev => [...prev, restBlock]);
    toast({
      title: "Rest block added",
      description: `${formatRestPeriod(`${addRestValue}s`)} rest block added`,
    });
    
    setShowAddRestDialog(false);
  };

  const handleUngroup = (startIndex: number) => {
    const newExercises = [...exercises];
    let i = startIndex;
    const startExercise = exercises[startIndex];
    const currentBlockType = startExercise.blockType;
    const currentBlockGroupId = startExercise.blockGroupId;
    
    while (i < newExercises.length) {
      const ex = newExercises[i];
      const sameBlock = ex.blockType === currentBlockType && 
        (currentBlockGroupId ? ex.blockGroupId === currentBlockGroupId : !ex.blockGroupId);
      if (!sameBlock) break;
      
      newExercises[i] = { ...newExercises[i], blockType: 'single', blockGroupId: undefined };
      i++;
    }
    setExercises(newExercises);
  };

  const handleBadgeClick = (exerciseIndex: number, badgeType: 'sets' | 'reps' | 'rest' | 'duration') => {
    const exercise = exercises[exerciseIndex];
    setEditingExerciseIndex(exerciseIndex);
    setEditingField(badgeType);
    setEditingBlockIndices([]);
    
    if (badgeType === 'sets') {
      setEditValue(String(exercise.setsCount || 3));
    } else if (badgeType === 'reps') {
      setEditValue(exercise.targetReps || '8-12');
    } else if (badgeType === 'duration') {
      setEditValue(exercise.targetDuration || '30 sec');
    } else if (badgeType === 'rest') {
      if (exercise.kind === 'rest') {
        setEditValue(String(exercise.restDuration || 60));
      } else {
        const restPeriod = exercise.restPeriod || '60s';
        if (restPeriod.toLowerCase() === 'none' || restPeriod === '0') {
          setEditValue('0');
        } else {
          const secs = parseInt(restPeriod.replace('s', '').replace(' sec', ''));
          setEditValue(String(secs || 60));
        }
      }
    }
  };

  const handleBlockSetsClick = (exerciseId: string, blockIds: string[]) => {
    const exerciseIndex = exercises.findIndex(e => e.id === exerciseId);
    if (exerciseIndex === -1) return;
    const exercise = exercises[exerciseIndex];
    setEditingExerciseIndex(exerciseIndex);
    setEditingField('sets');
    setEditingBlockIndices(blockIds.map(id => exercises.findIndex(e => e.id === id)).filter(i => i !== -1));
    setEditValue(String(exercise.setsCount || 3));
  };

  const handleSaveEdit = () => {
    if (editingExerciseIndex === null || editingField === null) return;
    
    const newExercises = [...exercises];
    
    if (editingField === 'sets' && editingBlockIndices.length > 0) {
      const newSetsCount = parseInt(editValue) || 3;
      editingBlockIndices.forEach(idx => {
        newExercises[idx].setsCount = newSetsCount;
      });
    } else {
      const exercise = newExercises[editingExerciseIndex];
      
      if (editingField === 'sets') {
        exercise.setsCount = parseInt(editValue) || 3;
      } else if (editingField === 'reps') {
        exercise.targetReps = editValue;
      } else if (editingField === 'duration') {
        exercise.targetDuration = editValue;
        // For interval workouts: update all exercises in the same blockGroupId (linked durations)
        if (workoutType === 'interval' && exercise.blockGroupId) {
          newExercises.forEach((ex, idx) => {
            if (ex.blockGroupId === exercise.blockGroupId && ex.kind !== 'rest') {
              newExercises[idx].targetDuration = editValue;
            }
          });
        }
      } else if (editingField === 'rest') {
        const secs = parseInt(editValue);
        if (exercise.kind === 'rest') {
          const v = isNaN(secs) || secs <= 0 ? 30 : secs;
          exercise.restDuration = v;
          exercise.targetDuration = `${v} sec`;
        } else if (secs === 0 || isNaN(secs)) {
          exercise.restPeriod = 'none';
        } else {
          exercise.restPeriod = `${secs}s`;
        }
      }
    }
    
    setExercises(newExercises);
    setEditingExerciseIndex(null);
    setEditingField(null);
    setEditValue("");
    setEditingBlockIndices([]);
  };

  const warmupExercises = exercises.filter(e => e.section === 'warmup');
  const mainExercises = exercises.filter(e => e.section === 'main');

  const renderExerciseList = (sectionExercises: ExerciseData[], sectionLabel: string, sectionType: 'warmup' | 'main') => {
    const startIndex = sectionLabel === 'MAIN BODY' ? warmupExercises.length : 0;
    
    return (
      <>
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <h3 className="text-sm font-semibold uppercase text-foreground">
            {sectionLabel}
          </h3>
        </div>
        
        {sectionExercises.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No exercises added yet</p>
            <button
              onClick={() => handleInsertExercise(sectionType)}
              className="text-primary text-sm font-medium mt-2"
              data-testid={`button-insert-empty-${sectionType}`}
            >
              + INSERT EXERCISE
            </button>
          </div>
        ) : (
          <>
          {sectionExercises.map((exercise, sectionIdx) => {
            const globalIdx = startIndex + sectionIdx;
            const isSelected = selectedExercises.includes(exercise.id);
            const prevExercise = sectionIdx > 0 ? sectionExercises[sectionIdx - 1] : null;
            
            const isSameBlock = (a: ExerciseData, b: ExerciseData) => {
              if (a.blockType === 'single' || b.blockType === 'single') return false;
              if (a.blockType !== b.blockType) return false;
              if (a.blockGroupId && b.blockGroupId) return a.blockGroupId === b.blockGroupId;
              if (a.blockGroupId || b.blockGroupId) return false;
              return true;
            };
            
            const isBlockStart = exercise.blockType !== 'single' && 
              (!prevExercise || !isSameBlock(prevExercise, exercise));
            
            const getBlockSize = () => {
              if (exercise.blockType === 'single') return 1;
              let count = 1;
              let i = sectionIdx + 1;
              while (i < sectionExercises.length && isSameBlock(exercise, sectionExercises[i])) {
                count++;
                i++;
              }
              return count;
            };

            const blockSize = isBlockStart ? getBlockSize() : 0;
            const blockTypeLabel = exercise.blockType === 'superset' ? 'Superset' : 
                                   exercise.blockType === 'triset' ? 'Triset' : 
                                   exercise.blockType === 'circuit' ? 'Circuit' : '';
            
            const getBlockIds = (): string[] => {
              if (exercise.blockType === 'single') return [];
              const ids: string[] = [];
              let i = sectionIdx;
              while (i < sectionExercises.length && isSameBlock(exercise, sectionExercises[i])) {
                ids.push(sectionExercises[i].id);
                i++;
              }
              return ids;
            };
            const blockIds = isBlockStart ? getBlockIds() : [];
            const allBlockSelected = blockIds.length > 0 && blockIds.every(id => selectedExercises.includes(id));

            return (
              <div key={exercise.id}>
                {isBlockStart && exercise.blockType !== 'single' && (
                  <div 
                    className={`flex items-center justify-between px-4 py-2 bg-muted/30 ${
                      draggedBlock?.startIndex === globalIdx ? 'opacity-50 bg-muted' : ''
                    }`}
                    draggable
                    onDragStart={() => {
                      setDraggedBlock({ startIndex: globalIdx, size: blockIds.length });
                    }}
                    onDragEnd={() => setDraggedBlock(null)}
                    data-testid={`block-header-${globalIdx}`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allBlockSelected) {
                            setSelectedExercises(prev => prev.filter(id => !blockIds.includes(id)));
                          } else {
                            setSelectedExercises(prev => Array.from(new Set([...prev, ...blockIds])));
                          }
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                          allBlockSelected ? 'border-[#0cc9a9] bg-[#0cc9a9]' : 'border-[#0cc9a9]'
                        }`}
                        data-testid={`checkbox-block-${globalIdx}`}
                      >
                        {allBlockSelected && <Check className="w-3 h-3 text-black" />}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {blockTypeLabel} of{' '}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlockSetsClick(exercise.id, blockIds);
                          }}
                          className="text-primary hover:underline cursor-pointer"
                          data-testid={`button-edit-block-sets-${globalIdx}`}
                        >
                          {exercise.setsCount} sets
                        </button>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUngroup(globalIdx);
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground"
                        data-testid={`button-ungroup-${globalIdx}`}
                      >
                        Ungroup
                      </button>
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                    </div>
                  </div>
                )}

                <div 
                  className={`flex items-center gap-3 px-4 py-3 mx-4 bg-card rounded-lg border mb-3 ${draggedIndex === globalIdx ? 'opacity-50 bg-muted' : ''}`}
                  draggable={exercise.blockType === 'single'}
                  onDragStart={() => {
                    if (exercise.blockType === 'single') {
                      setDraggedIndex(globalIdx);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    
                    // Handle single exercise drag
                    if (draggedIndex !== null && draggedIndex !== globalIdx) {
                      const newExercises = [...exercises];
                      const [removed] = newExercises.splice(draggedIndex, 1);
                      newExercises.splice(globalIdx, 0, removed);
                      setExercises(newExercises);
                      setDraggedIndex(globalIdx);
                    }
                    
                    // Handle block drag
                    if (draggedBlock !== null && draggedBlock.startIndex !== globalIdx) {
                      const newExercises = [...exercises];
                      const blockExercises = newExercises.splice(draggedBlock.startIndex, draggedBlock.size);
                      const insertAt = globalIdx > draggedBlock.startIndex ? globalIdx - draggedBlock.size + 1 : globalIdx;
                      newExercises.splice(insertAt, 0, ...blockExercises);
                      setExercises(newExercises);
                      setDraggedBlock({ startIndex: insertAt, size: draggedBlock.size });
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDraggedBlock(null);
                  }}
                  data-testid={`exercise-row-${globalIdx}`}
                >
                  {exercise.blockType === 'single' ? (
                    <div 
                      onClick={() => {
                        if (isSelected) {
                          setSelectedExercises(prev => prev.filter(id => id !== exercise.id));
                        } else {
                          setSelectedExercises(prev => [...prev, exercise.id]);
                        }
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer flex-shrink-0 ${
                        isSelected ? 'border-[#0cc9a9] bg-[#0cc9a9]' : 'border-[#0cc9a9]'
                      }`}
                      data-testid={`checkbox-exercise-${globalIdx}`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-black" />}
                    </div>
                  ) : (
                    <div className="w-5 flex-shrink-0" />
                  )}

                  {/* Rest block rendering */}
                  {exercise.kind === 'rest' ? (
                    <>
                      <div className="w-14 h-14 bg-primary/10 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Rest</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBadgeClick(globalIdx, 'rest');
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                            data-testid={`badge-rest-block-${globalIdx}`}
                          >
                            {formatRestPeriod(`${exercise.restDuration}s`)}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        {(() => {
                          const thumbnailUrl = getMuxThumbnailUrl(exercise.muxPlaybackId, { width: 112, height: 112 });
                          if (thumbnailUrl) {
                            return (
                              <img
                                src={thumbnailUrl}
                                alt={exercise.exerciseName}
                                className="w-full h-full object-cover"
                              />
                            );
                          }
                          return (
                            <div className="w-full h-full flex items-center justify-center">
                              <Dumbbell className="w-6 h-6 text-muted-foreground" />
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {exercise.exerciseName}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {/* Sets badge: show for all exercises (grouped circuit exercises show their count) */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBadgeClick(globalIdx, 'sets');
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-foreground cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`button-edit-sets-${globalIdx}`}
                          >
                            {exercise.setsCount} sets
                          </button>
                          
                          {/* Duration badge: show for INTERVAL main body, or for timed exercise types */}
                          {(() => {
                            const isIntervalMain = workoutType === 'interval' && exercise.section === 'main';
                            const isTimeBased = exercise.exerciseType === 'timed' || 
                              exercise.exerciseType === 'timed_strength' || 
                              exercise.exerciseType === 'general' || 
                              exercise.exerciseType === 'cardio';
                            
                            if (isIntervalMain || isTimeBased) {
                              return (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBadgeClick(globalIdx, 'duration');
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary cursor-pointer hover:opacity-80 transition-opacity"
                                  data-testid={`button-edit-duration-${globalIdx}`}
                                >
                                  {exercise.targetDuration || '60 sec'}
                                </button>
                              );
                            }
                            return null;
                      })()}
                      
                      {/* Reps badge: hide for general, hide for INTERVAL main body (circuit shows reps!) */}
                      {(() => {
                        const isIntervalMain = workoutType === 'interval' && exercise.section === 'main';
                        
                        if (exercise.exerciseType === 'general' || isIntervalMain) {
                          return null;
                        }
                        return (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBadgeClick(globalIdx, 'reps');
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`button-edit-reps-${globalIdx}`}
                          >
                            {exercise.targetReps || '8-12'}
                          </button>
                        );
                      })()}
                      
                      {/* Rest badge: only show on last exercise of each block for grouped exercises */}
                      {(() => {
                        const isCircuitMain = workoutType === 'circuit' && exercise.section === 'main';
                        const isIntervalMain = workoutType === 'interval' && exercise.section === 'main';
                        const isLastInSection = sectionIdx === sectionExercises.length - 1;
                        
                        // Check if this is the last exercise in its block group (superset, triset, circuit)
                        const nextExercise = sectionIdx < sectionExercises.length - 1 ? sectionExercises[sectionIdx + 1] : null;
                        const isLastInBlockGroup = !nextExercise || !isSameBlock(exercise, nextExercise);
                        
                        // Hide rest for circuit main body exercises that are not the last one
                        if (isCircuitMain && !isLastInSection) {
                          return null;
                        }
                        
                        // Hide rest for grouped exercises (superset/triset/circuit) that are not the last in their block
                        if (exercise.blockType !== 'single' && !isLastInBlockGroup) {
                          return null;
                        }
                        
                        return (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBadgeClick(globalIdx, 'rest');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-border text-muted-foreground cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`button-edit-rest-${globalIdx}`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatRestPeriod(exercise.restPeriod)}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}

              {exercise.blockType === 'single' && (
                <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0 cursor-grab" />
              )}
            </div>
          </div>
        );
      })}
          <div className="p-4 text-center">
            <button
              onClick={() => handleInsertExercise(sectionType)}
              className="text-primary text-sm font-medium"
              data-testid={`button-insert-${sectionType}`}
            >
              + INSERT EXERCISE
            </button>
          </div>
          </>
        )}
      </>
    );
  };

  if (showTypeSelector) {
    const workoutTypes: { key: WorkoutType; label: string; description: string }[] = [
      { key: 'regular', label: 'Regular', description: 'Standard sets and reps' },
      { key: 'circuit', label: 'Circuit', description: 'Back-to-back in rounds' },
      { key: 'interval', label: 'Interval', description: 'Timed work and rest periods' },
    ];

    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col" data-testid="page-workout-type-select">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button 
            onClick={() => navigate(fromParam || '/training')}
            className="text-sm font-medium text-foreground"
          >
            Cancel
          </button>
          <h2 className="text-base font-semibold text-foreground">Workout Type</h2>
          <div className="w-12" />
        </div>
        <div className="flex-1 px-4 pt-6">
          <p className="text-sm text-muted-foreground mb-5">Choose the type of workout you want to build:</p>
          <div className="space-y-2">
            {workoutTypes.map((wt) => (
              <button
                key={wt.key}
                onClick={() => {
                  const params = new URLSearchParams(searchString);
                  params.set('type', wt.key);
                  navigate(`/build-wod?${params.toString()}`);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/50 active:scale-[0.99] transition-all"
              >
                <div className="text-left">
                  <span className="text-sm font-semibold text-foreground">{wt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{wt.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col" data-testid="page-build-wod">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button 
          onClick={handleCancel}
          className="text-sm font-medium text-foreground"
          data-testid="button-cancel"
        >
          Cancel
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") 
            ? "Today" 
            : formatDate(selectedDate, "short")}
        </h2>
        <button 
          onClick={handleSaveClick}
          disabled={isSaving || saveMutation.isPending || enrolledSaveMutation.isPending || exercises.length === 0}
          className="text-sm font-medium text-primary disabled:opacity-50"
          data-testid="button-save"
        >
          {(isSaving || saveMutation.isPending || enrolledSaveMutation.isPending) ? "Saving..." : "Save"}
        </button>
      </div>

      {workoutType === 'interval' && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-border">
          <span className="text-sm text-muted-foreground">Circuit Rounds:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIntervalRounds(Math.max(1, intervalRounds - 1))}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              data-testid="button-decrease-rounds"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-lg font-bold min-w-[24px] text-center" data-testid="text-rounds-count">{intervalRounds}</span>
            <button
              onClick={() => setIntervalRounds(intervalRounds + 1)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              data-testid="button-increase-rounds"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {categoryParam !== 'stretching' && renderExerciseList(warmupExercises, 'WARM UP', 'warmup')}
          {renderExerciseList(mainExercises, categoryParam === 'stretching' ? 'EXERCISES' : 'MAIN BODY', 'main')}
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-background">
        <div className="flex items-center justify-around py-3">
          <button
            onClick={handleGroupExercises}
            disabled={selectedExercises.length < 2}
            className={`flex flex-col items-center gap-1 ${
              selectedExercises.length >= 2 ? 'text-foreground' : 'text-muted-foreground'
            }`}
            data-testid="button-group"
          >
            <Layers className="w-6 h-6" />
            <span className="text-xs">Group</span>
          </button>

          <button
            onClick={handleDeleteExercises}
            disabled={selectedExercises.length === 0}
            className={`flex flex-col items-center gap-1 ${
              selectedExercises.length > 0 ? 'text-foreground' : 'text-muted-foreground'
            }`}
            data-testid="button-delete"
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-xs">Delete</span>
          </button>

          <button
            onClick={() => handleInsertExercise('main')}
            className="flex flex-col items-center gap-1 text-primary"
            data-testid="button-insert"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs">Insert</span>
          </button>

          {savedWorkouts.length > 0 && (
            <button
              onClick={() => setShowLoadSavedDialog(true)}
              className="flex flex-col items-center gap-1 text-foreground"
              data-testid="button-load-saved"
            >
              <FolderOpen className="w-6 h-6" />
              <span className="text-xs">Saved</span>
            </button>
          )}

          {(workoutType === 'interval' || workoutType === 'circuit') && (
            <button
              onClick={handleAddRest}
              className="flex flex-col items-center gap-1 text-foreground"
              data-testid="button-add-rest"
            >
              <Clock className="w-6 h-6" />
              <span className="text-xs">Add Rest</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Edit Dialog */}
      <Dialog open={editingExerciseIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingExerciseIndex(null);
          setEditingField(null);
          setEditValue("");
        }
      }}>
        <DialogContent className="max-w-[280px]">
          <DialogHeader>
            <DialogTitle>
              {editingField === 'sets' && 'Edit Sets'}
              {editingField === 'reps' && 'Edit Reps'}
              {editingField === 'duration' && 'Edit Duration'}
              {editingField === 'rest' && 'Edit Rest'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col gap-4">
              {editingField === 'sets' && (
                <div className="flex items-center gap-3 justify-center">
                  <button
                    onClick={() => setEditValue(String(Math.max(1, parseInt(editValue) - 1)))}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                    data-testid="button-decrease-sets"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-3xl font-bold min-w-[60px] text-center">{editValue}</span>
                  <button
                    onClick={() => setEditValue(String(parseInt(editValue) + 1))}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                    data-testid="button-increase-sets"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {editingField === 'reps' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground text-center">Reps</label>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="e.g. 8-12"
                    className="w-full px-3 py-2 text-center text-lg bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    data-testid="input-reps"
                  />
                </div>
              )}
              
              {editingField === 'duration' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground text-center">Duration</label>
                  <div className="flex gap-4 justify-center">
                    {/* Seconds column */}
                    <div className="flex flex-col items-center">
                      <ScrollArea className="h-48 w-20">
                        <div className="flex flex-col items-center py-2 space-y-1">
                          {['5 sec', '10 sec', '15 sec', '20 sec', '25 sec', '30 sec', '35 sec', '40 sec', '45 sec', '50 sec', '55 sec'].map((val) => (
                            <button
                              key={val}
                              onClick={() => setEditValue(val)}
                              className={`py-2 px-3 rounded text-sm w-full ${
                                editValue === val ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`button-duration-${val.replace(' ', '-')}`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    {/* Minutes column (1-5 min with quarter increments) */}
                    <div className="flex flex-col items-center">
                      <ScrollArea className="h-48 w-28">
                        <div className="flex flex-col items-center py-2 space-y-1">
                          {[
                            '1 min', '1 min 15 sec', '1 min 30 sec', '1 min 45 sec',
                            '2 min', '2 min 15 sec', '2 min 30 sec', '2 min 45 sec',
                            '3 min', '3 min 15 sec', '3 min 30 sec', '3 min 45 sec',
                            '4 min', '4 min 15 sec', '4 min 30 sec', '4 min 45 sec',
                            '5 min', '6 min', '7 min', '8 min', '9 min', '10 min',
                            '15 min', '20 min', '25 min', '30 min'
                          ].map((val) => (
                            <button
                              key={val}
                              onClick={() => setEditValue(val)}
                              className={`py-2 px-3 rounded text-sm w-full ${
                                editValue === val ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`button-duration-${val.replace(/ /g, '-')}`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              )}
              
              {editingField === 'rest' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground text-center">Rest period</label>
                  <div className="flex gap-4 justify-center">
                    {/* Seconds column */}
                    <div className="flex flex-col items-center">
                      <ScrollArea className="h-48 w-20">
                        <div className="flex flex-col items-center py-2 space-y-1">
                          {['5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((val) => (
                            <button
                              key={val}
                              onClick={() => setEditValue(val)}
                              className={`py-2 px-4 rounded text-base w-full ${
                                editValue === val ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`button-rest-${val}s`}
                            >
                              {val} s
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    {/* Minutes column */}
                    <div className="flex flex-col items-center">
                      <ScrollArea className="h-48 w-20">
                        <div className="flex flex-col items-center py-2 space-y-1">
                          {[
                            { label: '60 s', value: '60' },
                            { label: '90 s', value: '90' },
                            { label: '2 m', value: '120' },
                            { label: '3 m', value: '180' },
                            { label: '4 m', value: '240' },
                            { label: '5 m', value: '300' },
                            { label: '10 m', value: '600' },
                            { label: '15 m', value: '900' },
                            { label: '20 m', value: '1200' },
                            { label: '25 m', value: '1500' },
                            { label: '30 m', value: '1800' },
                          ].map((item) => (
                            <button
                              key={item.value}
                              onClick={() => setEditValue(item.value)}
                              className={`py-2 px-4 rounded text-base w-full ${
                                editValue === item.value ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`button-rest-${item.value}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  {/* None option */}
                  <button
                    onClick={() => setEditValue('0')}
                    className={`py-2 px-4 rounded text-base mt-2 ${
                      editValue === '0' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="button-rest-none"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingExerciseIndex(null);
                setEditingField(null);
                setEditValue("");
              }}
              className="flex-1"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              className="flex-1"
              data-testid="button-save-edit"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              You have unsaved changes to this workout. Are you sure you want to discard them?
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1"
              data-testid="button-keep-editing"
            >
              Keep Editing
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmCancel}
              className="flex-1"
              data-testid="button-confirm-discard"
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Save Changes?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              This will update the workout for all future occurrences in your programme.
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSaveConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => { setShowSaveConfirm(false); handleSave(); }}
              className="flex-1 bg-primary text-primary-foreground"
              data-testid="button-confirm-save"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rest Dialog */}
      <Dialog open={showAddRestDialog} onOpenChange={setShowAddRestDialog}>
        <DialogContent className="max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Add Rest Period</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Rest after completing round
            </p>
            <div className="flex flex-col gap-2">
              <ScrollArea className="h-48">
                <div className="flex flex-col items-center py-2 space-y-1">
                  {[
                    { label: 'None', value: 0 },
                    { label: '15 sec', value: 15 },
                    { label: '30 sec', value: 30 },
                    { label: '45 sec', value: 45 },
                    { label: '60 sec', value: 60 },
                    { label: '90 sec', value: 90 },
                    { label: '2 min', value: 120 },
                    { label: '3 min', value: 180 },
                    { label: '4 min', value: 240 },
                    { label: '5 min', value: 300 },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setAddRestValue(item.value)}
                      className={`py-2 px-6 rounded text-base w-full ${
                        addRestValue === item.value ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`button-add-rest-${item.value}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowAddRestDialog(false)}
              className="flex-1"
              data-testid="button-cancel-add-rest"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmAddRest}
              className="flex-1"
              data-testid="button-confirm-add-rest"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadSavedDialog} onOpenChange={setShowLoadSavedDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>My Saved Workouts</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            {savedWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No saved workouts yet. Complete a custom workout and save it from the log view.
              </p>
            ) : (
              <div className="space-y-2">
                {savedWorkouts.map((w: any) => (
                  <button
                    key={w.id}
                    onClick={() => handleLoadSavedWorkout(w.id)}
                    disabled={loadingSavedId !== null}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground capitalize">{w.category}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground capitalize">{w.difficulty}</span>
                          {w.duration && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{w.duration} min</span>
                            </>
                          )}
                        </div>
                      </div>
                      {loadingSavedId === w.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
