import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWorkoutSession } from "@/context/WorkoutSessionContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { formatWeightValue, getWeightUnitLabel } from "@/lib/unitConversions";
import { ScrollArea } from "@/components/ui/scroll-area";
import IntervalWorkoutSession from "@/components/IntervalWorkoutSession";
import { 
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Clock, 
  FileText, 
  Plus,
  Minus,
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  Dumbbell,
  Square,
  Link as LinkIcon,
  Search,
  Check,
  X,
  GripVertical,
  Hand,
  Trash2,
  Layers,
  Pencil,
  ThumbsUp,
  Timer,
  RefreshCw
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { ExerciseLibraryItem } from "@shared/schema";
import WorkoutRatingDialog, { WorkoutCelebration } from "@/components/WorkoutRatingDialog";

interface SetData {
  id?: number;
  setNumber: number;
  targetReps: string | null;
  targetDuration: string | null;
  actualReps: number | null;
  actualWeight: number | null;
  actualDuration: string | null;
  actualDurationMinutes: number | null;
  actualDurationSeconds: number | null;
  isCompleted: boolean;
  side: 'left' | 'right' | 'bilateral' | null;
  setDifficultyRating: 'easy' | 'medium' | 'hard' | null;
  painFlag: boolean;
  failureFlag: boolean;
}

interface ExerciseData {
  id?: number;
  exerciseLibraryId: number | null;
  exerciseName: string;
  imageUrl: string | null;
  muxPlaybackId?: string | null;
  blockType: string;
  section: string;
  position: number;
  restPeriod: string;
  durationType: string;
  exerciseType: string; // 'general', 'endurance', 'strength', 'cardio', 'timed', 'timed_strength'
  laterality?: 'unilateral' | 'bilateral' | null; // For exercises that need left/right tracking
  kind?: 'exercise' | 'rest'; // Type of block - exercise or rest
  restDuration?: number; // For rest blocks - duration in seconds
  sets: SetData[];
  previous?: { setNumber: number; reps: number | null; weight: number | null }[];
}

interface WorkoutLogData {
  id: number;
  workoutName: string;
  workoutType: string;
  workoutId: number | null;
  programmeId: number | null;
  notes: string | null;
  startedAt: string;
  status: string;
  exercises: ExerciseData[];
  workoutStyle: string | null;
  intervalRounds: number | null;
  intervalRestAfterRound: string | null;
}

export default function ActiveWorkout() {
  const { logId } = useParams<{ logId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const { 
    timerMap, 
    activeExerciseLogId,
    startTimer: contextStartTimer, 
    pauseTimer: contextPauseTimer, 
    resumeTimer: contextResumeTimer,
    skipTimer: contextSkipTimer, 
    resetTimer: contextResetTimer,
    getTimer,
    initWorkout,
    clearWorkout,
  } = useWorkoutSession();
  
  const [autoFillStats, setAutoFillStats] = useState(false);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [lastTimerValue, setLastTimerValue] = useState<number>(0);
  const [stoppedEarly, setStoppedEarly] = useState(false);
  
  const [showStopwatch, setShowStopwatch] = useState(false);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchClosing, setStopwatchClosing] = useState(false);
  const [stopwatchJustOpened, setStopwatchJustOpened] = useState(false);
  const stopwatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Exercise selector state
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<ExerciseLibraryItem[]>([]);

  // Exercise options / substitute state
  const [showExerciseOptions, setShowExerciseOptions] = useState(false);
  const [substituteExerciseIndex, setSubstituteExerciseIndex] = useState<number | null>(null);
  const [substituteMode, setSubstituteMode] = useState(false);
  
  // Edit mode state
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editExercises, setEditExercises] = useState<ExerciseData[]>([]);
  const [originalExercises, setOriginalExercises] = useState<ExerciseData[]>([]);
  const [selectedEditExercises, setSelectedEditExercises] = useState<number[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{ startIndex: number; size: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Inline editing state
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'time' | 'reps' | 'rest' | 'sets' | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  
  // Interval workout state
  const [showIntervalSession, setShowIntervalSession] = useState(false);
  const [currentIntervalCircuit, setCurrentIntervalCircuit] = useState(0);
  const [intervalWeights, setIntervalWeights] = useState<Record<string, string>>({});
  
  // Workout completion state
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const workoutEndedIntentionally = useRef(false);
  const hasReallyMounted = useRef(false);
  const pendingSetCreations = useRef<Set<string>>(new Set());
  const clearWorkoutRef = useRef(clearWorkout);
  const [completionData, setCompletionData] = useState<{
    summary: {
      totalVolume: number;
      totalTimeSeconds: number;
      durationSeconds: number;
      exerciseCount: number;
      workoutRating: number;
    };
    prs: Array<{
      type: 'weight' | 'reps' | 'volume' | 'first';
      exerciseName: string;
      value?: number;
      previous?: number;
      reps?: number;
      weight?: number;
    }>;
  } | null>(null);

  // Fetch the workout log
  const { data: workoutLog, isLoading } = useQuery<WorkoutLogData>({
    queryKey: ['/api/workout-logs', logId],
    queryFn: async () => {
      const res = await fetch(`/api/workout-logs/${logId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch workout log');
      return res.json();
    },
    enabled: !!logId,
  });

  // Fetch exercise library for selector
  const { data: exerciseLibrary = [] } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ['/api/exercises'],
    enabled: showExerciseSelector,
  });

  // Filter exercises based on search term
  const filteredLibraryExercises = exerciseLibrary.filter(ex =>
    ex.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase())
  );

  // Toggle exercise selection
  const toggleExerciseSelection = (exercise: ExerciseLibraryItem) => {
    if (substituteMode) {
      // Single-select in substitute mode
      setSelectedExercises([exercise]);
      return;
    }
    setSelectedExercises(prev => {
      const isSelected = prev.some(e => e.id === exercise.id);
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id);
      } else {
        return [...prev, exercise];
      }
    });
  };

  const handleSubstituteExercise = () => {
    if (substituteExerciseIndex === null || selectedExercises.length === 0) return;
    const newExercise = selectedExercises[0];
    setExercises(prev => prev.map((ex, idx) => {
      if (idx !== substituteExerciseIndex) return ex;
      return {
        ...ex,
        exerciseName: newExercise.name,
        exerciseLibraryId: newExercise.id,
        imageUrl: newExercise.imageUrl || null,
        muxPlaybackId: newExercise.muxPlaybackId || null,
      };
    }));
    setShowExerciseSelector(false);
    setSubstituteMode(false);
    setSubstituteExerciseIndex(null);
    setSelectedExercises([]);
    setExerciseSearchTerm("");
  };

  // Add exercises mutation
  const addExercisesMutation = useMutation({
    mutationFn: async (exercisesToAdd: ExerciseLibraryItem[]) => {
      const results = [];
      for (const exercise of exercisesToAdd) {
        const maxPosition = Math.max(0, ...exercises.map(e => e.position || 0));
        // For each exercise type, set appropriate defaults:
        // - general: time only (foam rolling, stretching)
        // - endurance: reps only
        // - strength: reps only (weight entered during workout)
        // - timed/cardio: BOTH reps AND time
        // - timed_strength: BOTH reps AND time (weight entered during workout)
        // Backend expects 'reps' and 'duration' field names (maps to targetReps/targetDuration)
        const exerciseType = exercise.exerciseType || 'strength';
        let defaultSets;
        if (exerciseType === 'general') {
          // General exercises (stretching, foam rolling) - time only
          defaultSets = [{ duration: '30 sec' }, { duration: '30 sec' }];
        } else if (exerciseType === 'timed' || exerciseType === 'cardio' || exerciseType === 'timed_strength') {
          // Timed exercises need BOTH reps AND time
          defaultSets = [{ reps: '10', duration: '30 sec' }, { reps: '10', duration: '30 sec' }];
        } else {
          // Strength, endurance, etc. - reps only
          defaultSets = [{ reps: '10' }, { reps: '10' }];
        }
        const response = await apiRequest('POST', `/api/workout-logs/${logId}/exercises`, {
          exerciseLibraryId: exercise.id,
          exerciseName: exercise.name,
          blockType: 'single',
          section: 'main',
          position: maxPosition + 1 + results.length,
          restPeriod: '60 sec',
          durationType: exerciseType === 'general' || exerciseType === 'timed' ? 'timer' : 'text',
          exerciseType: exerciseType,
          sets: defaultSets,
        });
        results.push(response);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', logId] });
      setShowExerciseSelector(false);
      setSelectedExercises([]);
      setExerciseSearchTerm("");
      toast({
        title: "Exercises added",
        description: `Added ${selectedExercises.length} exercise${selectedExercises.length > 1 ? 's' : ''} to your workout`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add exercises. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Keep clearWorkout ref updated
  useEffect(() => {
    clearWorkoutRef.current = clearWorkout;
  }, [clearWorkout]);

  // Initialize workout session on mount
  useEffect(() => {
    if (logId) {
      initWorkout(parseInt(logId));
    }
  }, [logId, initWorkout]);

  // Redirect to read-only view if workout is already completed
  useEffect(() => {
    if (workoutLog && workoutLog.status === 'completed') {
      navigate(`/progress/workout/${logId}`, { replace: true });
    }
  }, [workoutLog, logId, navigate]);

  // Mark component as really mounted (skip React StrictMode first cleanup)
  useEffect(() => {
    hasReallyMounted.current = true;
    return () => {
      hasReallyMounted.current = false;
    };
  }, []);

  // Auto-cancel workout when user TRULY exits the page (not StrictMode remount)
  // Only applies to in_progress workouts - completed workouts should not be cancelled
  const workoutStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (workoutLog?.status) {
      workoutStatusRef.current = workoutLog.status;
    }
  }, [workoutLog?.status]);

  useEffect(() => {
    return () => {
      // Only cancel if truly mounted (not StrictMode cleanup), user didn't finish intentionally,
      // AND the workout is still in_progress (not already completed)
      if (hasReallyMounted.current && !workoutEndedIntentionally.current && logId && workoutStatusRef.current === 'in_progress') {
        fetch(`/api/workout-logs/${logId}/cancel`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {});
        clearWorkoutRef.current();
      }
    };
  }, [logId]);

  // Read any pending substitution from sessionStorage into a ref on mount
  const pendingSubstitutionsRef = useRef<Record<number, { name: string; id: number; imageUrl: string | null; muxPlaybackId: string | null }>>({});
  useEffect(() => {
    if (!logId) return;
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(`substitute_${logId}_`));
    keys.forEach(key => {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const idx = parseInt(key.split('_').pop() || '-1', 10);
        if (idx >= 0) pendingSubstitutionsRef.current[idx] = parsed;
      } catch {}
      sessionStorage.removeItem(key);
    });
  }, [logId]);

  // Sort exercises by section (warmup first) then by position
  const sortExercises = (exerciseList: ExerciseData[]) => {
    return [...exerciseList].sort((a, b) => {
      const sectionA = a.section?.toLowerCase() || 'main';
      const sectionB = b.section?.toLowerCase() || 'main';
      
      // Warmup comes first
      if (sectionA === 'warmup' && sectionB !== 'warmup') return -1;
      if (sectionA !== 'warmup' && sectionB === 'warmup') return 1;
      
      // Within same section, sort by position
      return (a.position || 0) - (b.position || 0);
    });
  };

  // Check if this is an interval workout
  const isIntervalWorkout = workoutLog?.workoutStyle === 'interval';

  // Prepare interval circuits from main body exercises - grouped by block boundaries
  // Rest blocks are used as circuit separators, not included in exercise counts
  const intervalCircuits = useMemo(() => {
    if (!isIntervalWorkout) return [];
    
    const mainBodyExercises = exercises.filter(e => 
      (e.section?.toLowerCase() || 'main') !== 'warmup'
    );
    
    if (mainBodyExercises.length === 0) return [];
    
    type CircuitExercise = {
      id: number;
      exerciseName: string;
      sets: { duration?: string; reps?: string }[];
      imageUrl: string | null;
      muxPlaybackId?: string | null;
      exerciseIndex: number;
    };
    
    type Circuit = {
      exercises: CircuitExercise[];
      rounds: number;
      restAfterRound: string;
      restAfterCircuit?: number; // Rest duration in seconds after this circuit
    };
    
    // Group exercises into circuits, using rest blocks as separators
    // Filter out rest blocks from exercise arrays
    const circuits: Circuit[] = [];
    let currentCircuitExercises: CircuitExercise[] = [];
    let lastRestDuration: number | undefined = undefined;
    
    mainBodyExercises.forEach((ex) => {
      const globalIndex = exercises.findIndex(e => e === ex);
      
      // Check if this is a rest block (support both new 'kind' field and legacy markers)
      const isRestBlock = ex.kind === 'rest' || 
        ex.blockType === 'rest' ||
        ex.exerciseName?.toLowerCase() === 'rest' ||
        ex.exerciseName?.toLowerCase().includes('rest block');
      
      if (isRestBlock) {
        // Rest block marks end of current circuit and start of next
        if (currentCircuitExercises.length > 0) {
          circuits.push({
            exercises: currentCircuitExercises,
            rounds: workoutLog?.intervalRounds || 3,
            restAfterRound: workoutLog?.intervalRestAfterRound || '60 sec',
            restAfterCircuit: ex.restDuration || 60,
          });
          currentCircuitExercises = [];
        }
        lastRestDuration = ex.restDuration || 60;
      } else {
        // Regular exercise - add to current circuit
        currentCircuitExercises.push({
          id: ex.id || 0,
          exerciseName: ex.exerciseName,
          sets: ex.sets.map(s => ({
            duration: s.targetDuration || undefined,
            reps: s.targetReps || undefined,
          })),
          imageUrl: ex.imageUrl,
          muxPlaybackId: ex.muxPlaybackId,
          exerciseIndex: globalIndex,
        });
      }
    });
    
    // Don't forget the last circuit if there are remaining exercises
    if (currentCircuitExercises.length > 0) {
      circuits.push({
        exercises: currentCircuitExercises,
        rounds: workoutLog?.intervalRounds || 3,
        restAfterRound: workoutLog?.intervalRestAfterRound || '60 sec',
      });
    }
    
    return circuits;
  }, [exercises, isIntervalWorkout, workoutLog]);

  // Interval session handlers
  const handleStartIntervalSession = (circuitIndex: number = 0) => {
    setCurrentIntervalCircuit(circuitIndex);
    setShowIntervalSession(true);
  };

  const handleIntervalSessionComplete = () => {
    toast({
      title: "Workout Complete!",
      description: "Great job finishing your interval workout!",
    });
    setShowIntervalSession(false);
  };

  const handleIntervalSessionClose = (nextCircuitIndex?: number) => {
    setShowIntervalSession(false);
    
    // If there's a next circuit, update the current circuit and scroll to it
    if (nextCircuitIndex !== undefined && nextCircuitIndex < intervalCircuits.length) {
      setCurrentIntervalCircuit(nextCircuitIndex);
      
      // Scroll to the next circuit after a brief delay
      setTimeout(() => {
        const circuitElement = document.getElementById(`circuit-${nextCircuitIndex}`);
        if (circuitElement) {
          circuitElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (stopwatchRunning) {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }
    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
  }, [stopwatchRunning]);

  const toggleStopwatch = () => {
    if (!showStopwatch) {
      setShowStopwatch(true);
      setStopwatchRunning(true);
      setStopwatchClosing(false);
      setStopwatchJustOpened(true);
      setTimeout(() => setStopwatchJustOpened(false), 1000);
    } else {
      setStopwatchRunning(false);
      setStopwatchClosing(true);
      setTimeout(() => {
        setShowStopwatch(false);
        setStopwatchClosing(false);
        setStopwatchSeconds(0);
      }, 1000);
    }
  };

  const resetStopwatch = () => {
    setStopwatchSeconds(0);
  };

  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Fetch previous performance for each exercise
  useEffect(() => {
    if (workoutLog?.exercises) {
      const sortedExercises = sortExercises(workoutLog.exercises);
      const pending = pendingSubstitutionsRef.current;
      const hasPending = Object.keys(pending).length > 0;
      if (hasPending) {
        const substituted = sortedExercises.map((ex, i) => {
          if (pending[i]) {
            const s = pending[i];
            return { ...ex, exerciseName: s.name, exerciseLibraryId: s.id, imageUrl: s.imageUrl, muxPlaybackId: s.muxPlaybackId };
          }
          return ex;
        });
        setExercises(substituted);
        pendingSubstitutionsRef.current = {};
      } else {
        setExercises(sortedExercises);
      }
      
      workoutLog.exercises.forEach(async (ex) => {
        if (ex.exerciseLibraryId) {
          try {
            const response = await fetch(`/api/exercises/${ex.exerciseLibraryId}/previous-performance`, {
              credentials: 'include',
            });
            if (response.ok) {
              const prevData = await response.json();
              if (prevData?.sets) {
                setExercises(prev => prev.map(e => 
                  e.exerciseLibraryId === ex.exerciseLibraryId 
                    ? { ...e, previous: prevData.sets }
                    : e
                ));
              }
            }
          } catch (error) {
            console.error('Error fetching previous performance:', error);
          }
        }
      });
    }
  }, [workoutLog]);

  // Check if any timer is currently running and handle animation
  const activeTimer = activeExerciseLogId ? timerMap[activeExerciseLogId] : null;
  const isAnyTimerRunning = activeTimer?.isRunning && activeTimer.remainingSeconds > 0;

  // Handle timer animation in/out
  useEffect(() => {
    if (isAnyTimerRunning && activeTimer) {
      setShowTimer(true);
      setAnimatingOut(false);
      setStoppedEarly(false);
      setLastTimerValue(activeTimer.remainingSeconds);
    } else if (showTimer) {
      setAnimatingOut(true);
      const timeout = setTimeout(() => {
        setShowTimer(false);
        setAnimatingOut(false);
        setStoppedEarly(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isAnyTimerRunning, showTimer, activeTimer]);

  const startTimer = useCallback((exerciseLogId: number, seconds: number) => {
    contextStartTimer(exerciseLogId, seconds);
  }, [contextStartTimer]);

  const pauseTimer = useCallback((exerciseLogId: number) => {
    contextPauseTimer(exerciseLogId);
  }, [contextPauseTimer]);

  const resumeTimer = useCallback((exerciseLogId: number) => {
    contextResumeTimer(exerciseLogId);
  }, [contextResumeTimer]);

  const resetTimer = useCallback((exerciseLogId: number, seconds: number) => {
    setStoppedEarly(true);
    contextResetTimer(exerciseLogId, seconds);
  }, [contextResetTimer]);

  const skipTimer = useCallback((exerciseLogId: number) => {
    contextSkipTimer(exerciseLogId);
  }, [contextSkipTimer]);

  const parseRestPeriod = (restPeriod: string): number => {
    // Handle 'none' case explicitly
    const restLower = (restPeriod || '').toLowerCase();
    if (restLower === 'none' || restLower === '0' || restLower === '') return 0;
    
    const match = restPeriod.match(/(\d+)\s*(sec|min|m|s)/i);
    if (!match) return 60;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.startsWith('m') ? value * 60 : value;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
  };

  const formatRestDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    if (mins > 0) {
      return `${mins}m`;
    }
    return `${seconds}s`;
  };

  // Update set mutation
  const updateSetMutation = useMutation({
    mutationFn: async ({ setId, updates }: { setId: number; updates: any }) => {
      return apiRequest('PATCH', `/api/set-logs/${setId}`, updates);
    },
  });

  // Add new set mutation
  const addSetMutation = useMutation({
    mutationFn: async ({ exerciseLogId, targetReps, targetDuration, setNumber, initialData, exerciseIndex, setIndex }: { 
      exerciseLogId: number; 
      targetReps?: string;
      targetDuration?: string;
      setNumber?: number;
      initialData?: Record<string, any>;
      exerciseIndex?: number;
      setIndex?: number;
    }) => {
      const result = await apiRequest('POST', `/api/exercise-logs/${exerciseLogId}/sets`, { 
        targetReps, 
        targetDuration,
        setNumber,
        ...initialData 
      });
      return { ...result, exerciseIndex, setIndex };
    },
    onSuccess: (data: any) => {
      // Remove from pending and update local state with the new set ID
      const pendingKey = `${data.exerciseIndex}-${data.setIndex}`;
      pendingSetCreations.current.delete(pendingKey);
      
      // Update local exercises state with the new set ID
      if (data.id !== undefined && data.exerciseIndex !== undefined && data.setIndex !== undefined) {
        setExercises(prev => {
          const updated = [...prev];
          if (updated[data.exerciseIndex] && updated[data.exerciseIndex].sets[data.setIndex]) {
            const exercise = { ...updated[data.exerciseIndex] };
            const sets = [...exercise.sets];
            sets[data.setIndex] = { ...sets[data.setIndex], id: data.id };
            exercise.sets = sets;
            updated[data.exerciseIndex] = exercise;
          }
          return updated;
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', logId] });
    },
    onError: (_error, variables) => {
      // Remove from pending on error too
      const pendingKey = `${variables.exerciseIndex}-${variables.setIndex}`;
      pendingSetCreations.current.delete(pendingKey);
    },
  });

  // Delete set mutation
  const deleteSetMutation = useMutation({
    mutationFn: async ({ setId }: { setId: number }) => {
      return apiRequest('DELETE', `/api/set-logs/${setId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', logId] });
    },
  });

  // Complete workout mutation with rating
  const completeMutation = useMutation({
    mutationFn: async ({ workoutRating, notes }: { workoutRating: number; notes?: string }) => {
      workoutEndedIntentionally.current = true;
      return apiRequest('POST', `/api/workout-logs/${logId}/complete`, { workoutRating, notes });
    },
    onSuccess: (data: any) => {
      clearWorkout();
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      
      // If we have PR and summary data, show celebration
      if (data?.summary) {
        setCompletionData({
          summary: data.summary,
          prs: data.prs || [],
        });
        setShowRatingDialog(false);
        setShowCelebration(true);
      } else {
        toast({ title: "Workout completed!", description: "Great job!" });
        navigate('/training');
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete workout", variant: "destructive" });
    },
  });

  // Handler to open rating dialog
  const handleCompleteWorkout = () => {
    setShowRatingDialog(true);
  };

  // Handler to complete workout with rating
  const handleRatingComplete = (rating: number, notes?: string) => {
    completeMutation.mutate({ workoutRating: rating, notes });
  };

  // Handler to close celebration and navigate
  const handleCelebrationClose = () => {
    setShowCelebration(false);
    setCompletionData(null);
    navigate('/training');
  };

  // Cancel workout mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/workout-logs/${logId}/cancel`, {});
    },
    onSuccess: () => {
      clearWorkout();
      toast({ title: "Workout cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      // Navigate back to the workout detail page, replacing history so back button works correctly
      if (workoutLog?.workoutId) {
        navigate(`/training/workout/${workoutLog.workoutId}`, { replace: true });
      } else {
        navigate('/training', { replace: true });
      }
    },
  });

  const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: string, value: string) => {
    // actualDuration is stored as a string, others are numeric
    const isStringField = field === 'actualDuration';
    let parsedValue: string | number | null;
    
    if (isStringField) {
      parsedValue = value === '' ? null : value;
    } else {
      // Handle numeric fields - allow decimals like .25, .5, .75
      if (value === '' || value === null) {
        parsedValue = null;
      } else {
        const num = parseFloat(value);
        parsedValue = isNaN(num) ? null : num;
      }
    }
    
    // Update local state first
    setExercises(prev => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: parsedValue };
      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });

    // Get exercise from current state
    const exercise = exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    const pendingKey = `${exerciseIndex}-${setIndex}`;
    
    if (set?.id) {
      // Existing set - update it
      updateSetMutation.mutate({ setId: set.id, updates: { [field]: parsedValue } });
    } else if (exercise?.id) {
      // No set exists yet (happens for circuit workout rounds 2, 3, 4, etc.)
      // Check if we're already creating this set
      if (pendingSetCreations.current.has(pendingKey)) {
        // A set creation is already in progress for this exercise/set combo
        // We need to wait for it to complete and then update
        // For now, we'll rely on the query invalidation to sync the data
        return;
      }
      
      // Mark this set as being created
      pendingSetCreations.current.add(pendingKey);
      
      // Create a new set with this initial data
      const setNumber = setIndex + 1;
      const targetReps = exercise.sets[0]?.targetReps || undefined;
      const targetDuration = exercise.sets[0]?.targetDuration || undefined;
      
      addSetMutation.mutate({ 
        exerciseLogId: exercise.id, 
        targetReps,
        targetDuration,
        setNumber,
        initialData: { [field]: parsedValue },
        exerciseIndex,
        setIndex
      });
    }
  };

  const handleAddSet = (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (exercise?.id) {
      addSetMutation.mutate({ 
        exerciseLogId: exercise.id, 
        targetReps: exercise.sets[0]?.targetReps || undefined 
      });
    }
  };

  const handleRemoveSet = (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (exercise && exercise.sets.length > 1) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      if (lastSet?.id) {
        deleteSetMutation.mutate({ setId: lastSet.id });
      }
    }
  };

  // Handler to update interval workout data (reps/weight) and save to database
  const handleIntervalDataUpdate = (exerciseId: number, field: 'reps' | 'kg', value: string) => {
    // Update local state
    setIntervalWeights(prev => ({
      ...prev,
      [`${exerciseId}-${field}`]: value
    }));
    
    // Find the exercise and its first set to update
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise && exercise.sets[0]?.id) {
      const setId = exercise.sets[0].id;
      const dbField = field === 'reps' ? 'actualReps' : 'actualWeight';
      const parsedValue = value === '' ? null : parseFloat(value);
      
      if (parsedValue !== null && !isNaN(parsedValue)) {
        updateSetMutation.mutate({ setId, updates: { [dbField]: parsedValue } });
      }
    }
  };

  const formatPrevious = (prev: { reps: number | null; weight: number | null } | undefined): string => {
    if (!prev) return '-';
    if (prev.reps && prev.weight) {
      const displayWeight = formatWeightValue(prev.weight, preferences.weightUnit);
      return `${displayWeight} ${getWeightUnitLabel(preferences.weightUnit)} x ${prev.reps}`;
    }
    if (prev.reps) {
      return `${prev.reps} reps`;
    }
    return '-';
  };

  // Parse and format time input to consistent m:ss format
  const formatTimeInput = (input: string): string => {
    if (!input || input.trim() === '') return '';
    
    const trimmed = input.trim().toLowerCase();
    
    // Already in m:ss or mm:ss format
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    let totalSeconds = 0;
    
    // Handle fractions like "2 1/2" or "1.5"
    const fractionMatch = trimmed.match(/(\d+)\s*(\d+)\/(\d+)\s*(m|min|mins|minutes?)?/i);
    if (fractionMatch) {
      const whole = parseInt(fractionMatch[1]);
      const numerator = parseInt(fractionMatch[2]);
      const denominator = parseInt(fractionMatch[3]);
      const isMinutes = fractionMatch[4] && fractionMatch[4].startsWith('m');
      const value = whole + (numerator / denominator);
      totalSeconds = isMinutes ? value * 60 : value;
    } else {
      // Handle decimal minutes like "1.5 min"
      const decimalMinMatch = trimmed.match(/^(\d+\.?\d*)\s*(m|min|mins|minutes?)$/i);
      if (decimalMinMatch) {
        totalSeconds = parseFloat(decimalMinMatch[1]) * 60;
      } else {
        // Handle minutes and seconds separately: "1m 30s", "1 min 30 sec"
        const minSecMatch = trimmed.match(/(\d+)\s*(m|min|mins|minutes?)\s*(\d+)?\s*(s|sec|secs|seconds?)?/i);
        if (minSecMatch) {
          const minutes = parseInt(minSecMatch[1]) || 0;
          const seconds = parseInt(minSecMatch[3]) || 0;
          totalSeconds = minutes * 60 + seconds;
        } else {
          // Handle just seconds: "30", "30s", "30 secs", "30 seconds"
          const secMatch = trimmed.match(/^(\d+)\s*(s|sec|secs|seconds?)?$/i);
          if (secMatch) {
            totalSeconds = parseInt(secMatch[1]);
          } else {
            // Handle just minutes: "2m", "2 mins"
            const minMatch = trimmed.match(/^(\d+)\s*(m|min|mins|minutes?)$/i);
            if (minMatch) {
              totalSeconds = parseInt(minMatch[1]) * 60;
            } else {
              // Return original if can't parse
              return input;
            }
          }
        }
      }
    }
    
    // Convert to m:ss format
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle time input blur - format the value
  const handleTimeBlur = (exerciseIndex: number, setIndex: number, value: string) => {
    const formattedValue = formatTimeInput(value);
    if (formattedValue !== value) {
      handleSetUpdate(exerciseIndex, setIndex, 'actualDuration', formattedValue);
    }
  };

  // Helper to format duration strings (e.g. "120" -> "2 min", "60" -> "60 sec")
  const formatDurationForDisplay = (duration: string | number | undefined): string => {
    if (!duration) return '60 sec';
    const dStr = String(duration);
    
    // If already has 'min' or 'sec', return as-is
    if (dStr.includes('min') || dStr.includes('sec')) {
      return dStr;
    }
    
    // Parse as seconds
    const seconds = parseInt(dStr, 10);
    if (isNaN(seconds)) return dStr;
    
    if (seconds >= 60 && seconds % 60 === 0) {
      const mins = seconds / 60;
      return `${mins} min`;
    } else if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} min ${secs} sec`;
    }
    return `${seconds} sec`;
  };

  const getSetsSummary = (exercise: ExerciseData, section?: string): string => {
    const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
    const isIntervalStyle = workoutLog?.workoutStyle === 'interval';
    const exerciseSection = section || exercise.section?.toLowerCase() || 'main';
    const circuitRounds = workoutLog?.intervalRounds || 3;
    
    // For rest blocks, just show the formatted rest duration
    if (exercise.exerciseName === 'Rest') {
      const rawDuration = exercise.sets[0]?.targetDuration || exercise.restPeriod || '60';
      return formatDurationForDisplay(rawDuration);
    }
    
    // For interval workouts: ALWAYS show duration-only format (no reps)
    // Use intervalRounds for both warmup and main body
    if (isIntervalStyle) {
      const displaySetCount = exerciseSection === 'warmup' ? exercise.sets.length : circuitRounds;
      const duration = exercise.sets[0]?.targetDuration || '60 sec';
      const formattedDuration = formatDurationForDisplay(duration);
      return `${displaySetCount} sets x ${formattedDuration}`;
    }
    
    // For circuit workouts in main body section, show rounds instead of actual set count
    const displaySetCount = (isCircuitWorkout && exerciseSection !== 'warmup') ? circuitRounds : exercise.sets.length;
    const isTimeBased = exercise.durationType === 'timer';
    
    if (isTimeBased) {
      const durations = exercise.sets.map(s => s.targetDuration || '30 sec');
      const uniqueDurations = Array.from(new Set(durations));
      const durationPart = uniqueDurations.length === 1 ? uniqueDurations[0] : null;
      
      // Check if there are also reps (timed-with-reps)
      const reps = exercise.sets.map(s => s.targetReps).filter(Boolean);
      if (reps.length > 0) {
        const uniqueReps = Array.from(new Set(reps));
        const repsPart = uniqueReps.length === 1 ? uniqueReps[0] : reps.join(', ');
        if (durationPart) {
          return `${displaySetCount} sets x ${durationPart} x ${repsPart}`;
        }
        return `${displaySetCount} sets x ${repsPart}`;
      }
      
      // Timed-only
      if (durationPart) {
        return `${displaySetCount} sets x ${durationPart}`;
      }
      return `${displaySetCount} sets`;
    }
    
    const reps = exercise.sets.map(s => s.targetReps || s.actualReps).filter(Boolean);
    if (reps.length === 0) {
      return `${displaySetCount} sets`;
    }
    const uniqueReps = Array.from(new Set(reps));
    if (uniqueReps.length === 1) {
      return `${displaySetCount} sets x ${uniqueReps[0]} reps`;
    }
    return `${displaySetCount} sets x ${reps.join(', ')} reps`;
  };

  // Calculate exercise label (A, B for warmup; 1A, 1B, 2A for main body)
  const getExerciseLabel = (exerciseIndex: number): string => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return '';
    
    const section = exercise.section?.toLowerCase() || 'main';
    const sectionExercises = exercises.filter(e => (e.section?.toLowerCase() || 'main') === section);
    const indexInSection = sectionExercises.findIndex(e => e === exercise);
    
    if (section === 'warmup') {
      // Warmup: just letters A, B, C...
      return String.fromCharCode(65 + indexInSection);
    }
    
    // Main body: group by position for supersets/trisets
    // Find unique positions to create block numbers
    const positions = sectionExercises.map(e => e.position);
    const uniquePositions = Array.from(new Set(positions)).sort((a, b) => a - b);
    const blockNumber = uniquePositions.indexOf(exercise.position) + 1;
    
    // Find index within this block (same position)
    const blockExercises = sectionExercises.filter(e => e.position === exercise.position);
    const indexInBlock = blockExercises.findIndex(e => e === exercise);
    const letter = String.fromCharCode(65 + indexInBlock);
    
    return `${blockNumber}${letter}`;
  };

  // Get the block identifier for an exercise (blockType + position-based block index)
  const getBlockIdentifier = (exercise: ExerciseData): string => {
    const blockType = exercise.blockType || 'single';
    const blockIndex = Math.floor((exercise.position || 0) / 10);
    return `${blockType}-${blockIndex}`;
  };

  // Check if exercise is part of a superset/triset/circuit block
  const getBlockInfo = (exerciseIndex: number): { isFirstInBlock: boolean; isLastInBlock: boolean; blockType: string; blockSize: number; blockIdentifier: string } => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return { isFirstInBlock: true, isLastInBlock: true, blockType: 'single', blockSize: 1, blockIdentifier: 'single-0' };
    
    const blockType = exercise.blockType || 'single';
    const blockIdentifier = getBlockIdentifier(exercise);
    
    if (blockType === 'single') {
      return { isFirstInBlock: true, isLastInBlock: true, blockType: 'single', blockSize: 1, blockIdentifier };
    }
    
    // For supersets/trisets/circuits, find consecutive exercises with the same block identifier
    // This ensures exercises are only grouped if they have the same blockType AND same position range
    let blockStart = exerciseIndex;
    while (blockStart > 0 && getBlockIdentifier(exercises[blockStart - 1]) === blockIdentifier) {
      blockStart--;
    }
    
    // Look forwards to find end of block
    let blockEnd = exerciseIndex;
    while (blockEnd < exercises.length - 1 && getBlockIdentifier(exercises[blockEnd + 1]) === blockIdentifier) {
      blockEnd++;
    }
    
    const blockSize = blockEnd - blockStart + 1;
    const isFirstInBlock = exerciseIndex === blockStart;
    const isLastInBlock = exerciseIndex === blockEnd;
    
    return { isFirstInBlock, isLastInBlock, blockType, blockSize, blockIdentifier };
  };

  const getBlockTypeLabel = (blockType: string): string => {
    // For interval and circuit workouts, always use "CIRCUIT" label
    if (workoutLog?.workoutStyle === 'interval' || workoutLog?.workoutStyle === 'circuit') {
      return blockType !== 'single' ? 'CIRCUIT' : '';
    }
    switch (blockType) {
      case 'superset': return 'SUPERSET';
      case 'triset': return 'TRISET';
      case 'circuit': return 'CIRCUIT';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading workout...</div>
      </div>
    );
  }

  if (!workoutLog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Workout not found</p>
          <Button onClick={() => navigate('/training')}>Go to Training</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Unified Header Block - Timer + Navigation as one piece */}
      <div className="sticky top-0 z-40 border-b border-border">
        {/* Timer Section - expands smoothly to push content down */}
        {showTimer && (
          <div className={`${animatingOut ? (stoppedEarly ? 'bg-red-900/30' : 'bg-green-900/30') : 'bg-muted/50'} ${animatingOut ? 'animate-collapse' : 'animate-expand'}`}>
            <div className="text-center">
              <span className={`text-3xl font-medium tracking-wider ${animatingOut ? (stoppedEarly ? 'text-red-400' : 'text-green-400') : 'text-foreground'}`} data-testid="large-timer-display">
                {formatTime(activeTimer?.remainingSeconds ?? lastTimerValue)}
              </span>
            </div>
          </div>
        )}
        
        {showStopwatch && !showTimer && (
          <div className={`bg-muted/50 ${stopwatchClosing ? 'animate-collapse' : stopwatchJustOpened ? 'animate-expand' : 'py-3'}`}>
            <div className="text-center relative">
              <span className={`text-3xl font-medium tracking-wider ${stopwatchRunning ? 'text-[#0cc9a9]' : 'text-foreground'}`}>
                {formatStopwatch(stopwatchSeconds)}
              </span>
              <button 
                onClick={resetStopwatch}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStopwatchRunning((prev: boolean) => !prev)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${stopwatchRunning ? 'text-[#0cc9a9]' : 'text-green-400'}`}
              >
                {stopwatchRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        
        {/* Navigation Section - part of the unified block */}
        <div className="bg-background">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm font-bold text-white bg-destructive px-4 py-1.5 rounded-md"
              data-testid="button-cancel-workout"
            >
              Cancel
            </button>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleStopwatch}
                className={`${showStopwatch ? 'text-[#0cc9a9]' : 'text-muted-foreground'} hover:text-foreground`}
                data-testid="button-stopwatch"
              >
                <Clock className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate(`/active-workout/${logId}/notes`)}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-notes"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowEditMenu(true)}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-workout-menu"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={handleCompleteWorkout}
              className="text-sm font-bold text-black bg-primary px-4 py-1.5 rounded-md"
              disabled={completeMutation.isPending}
              data-testid="button-save-workout"
            >
              {completeMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Workout Title */}
      <div className="mx-2 mt-4 mb-1 bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-border/50">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-workout-title">
            {workoutLog.workoutName}
          </h1>
        </div>
        {/* Auto Fill Stats Toggle */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50">
          <span className="text-sm font-medium text-foreground/70">Auto fill stats</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-zinc-400 text-sm leading-none">ⓘ</button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm" side="bottom" align="start">
              <p className="font-semibold mb-1">Auto fill stats</p>
              <p className="text-muted-foreground leading-relaxed">When turned on, your weights and reps from your last session are automatically filled in so you can quickly confirm or adjust them. No need to start from scratch every time.</p>
            </PopoverContent>
          </Popover>
          <Switch
            checked={autoFillStats}
            onCheckedChange={(checked) => {
              setAutoFillStats(checked);
              if (checked) {
                setExercises(prev => prev.map(exercise => {
                  if (!exercise.previous || exercise.previous.length === 0) return exercise;
                  const updatedSets = exercise.sets.map((set, idx) => {
                    const prevSet = exercise.previous?.find(p => p.setNumber === idx + 1) || exercise.previous?.[idx];
                    if (!prevSet) return set;
                    const updated = { ...set };
                    if (updated.actualReps == null && prevSet.reps != null) {
                      updated.actualReps = prevSet.reps;
                    }
                    if (updated.actualWeight == null && prevSet.weight != null) {
                      updated.actualWeight = prevSet.weight;
                    }
                    return updated;
                  });
                  return { ...exercise, sets: updatedSets };
                }));
              }
            }}
            className="ml-auto"
            data-testid="switch-autofill"
          />
        </div>
      </div>

      {/* Exercises List */}
      <div className="px-2 py-3 space-y-3">
        {exercises.map((exercise, exerciseIndex) => {
          // For interval workouts, skip rendering rest blocks as exercises
          // They are used as circuit separators and their timer is handled in the circuit header
          // Support both new 'kind' field and legacy markers
          const isRestBlock = exercise.kind === 'rest' || 
            exercise.blockType === 'rest' ||
            exercise.exerciseName?.toLowerCase() === 'rest' ||
            exercise.exerciseName?.toLowerCase().includes('rest block');
          
          if (isIntervalWorkout && isRestBlock) {
            return null;
          }
          
          const exerciseLogId = exercise.id || 0;
          const restSeconds = parseRestPeriod(exercise.restPeriod);
          const timer = timerMap[exerciseLogId];
          const timerValue = timer?.remainingSeconds ?? restSeconds;
          const isTimerRunning = timer?.isRunning && activeExerciseLogId === exerciseLogId;
          
          // Exercise type determines display format:
          // - general: Time only (foam rolling, stretching)
          // - endurance: Reps only (bodyweight exercises)
          // - strength: Reps + Weight (default, barbell exercises)
          // - cardio/timed: Time + Reps
          // - timed_strength: Time + Reps + Weight
          const exType = exercise.exerciseType || 'strength';
          const isGeneralExercise = exType === 'general';
          const isEnduranceExercise = exType === 'endurance';
          const isStrengthExercise = exType === 'strength';
          const isCardioOrTimedExercise = exType === 'cardio' || exType === 'timed';
          const isTimedStrengthExercise = exType === 'timed_strength';
          
          // For backwards compatibility, also check old logic
          const isTimeBasedExercise = exercise.durationType === 'timer';
          const hasTargetReps = exercise.sets.some(s => s.targetReps && s.targetReps !== '0');
          
          // Use new exercise type logic, with fallback to old logic
          const isTimedOnlyExercise = isGeneralExercise || (isTimeBasedExercise && !hasTargetReps && !isCardioOrTimedExercise && !isTimedStrengthExercise);
          const isTimedWithRepsExercise = isCardioOrTimedExercise || (isTimeBasedExercise && hasTargetReps && !isTimedStrengthExercise);
          
          // Check if we need to show a section header
          const currentSection = exercise.section?.toLowerCase() || 'main';
          const prevExercise = exercises[exerciseIndex - 1];
          const prevSection = prevExercise?.section?.toLowerCase() || 'main';
          const showSectionHeader = exerciseIndex === 0 || currentSection !== prevSection;

          const blockInfo = getBlockInfo(exerciseIndex);
          const blockTypeLabel = getBlockTypeLabel(blockInfo.blockType);
          const showBlockConnector = blockInfo.blockSize > 1 && !blockInfo.isLastInBlock;
          
          // Check if this is a new circuit block (different from previous exercise)
          const prevBlockInfo = exerciseIndex > 0 ? getBlockInfo(exerciseIndex - 1) : null;
          
          // For interval workouts, find which circuit this exercise belongs to
          const exerciseCircuitIndex = isIntervalWorkout ? 
            intervalCircuits.findIndex(circuit => 
              circuit.exercises.some(ex => ex.exerciseIndex === exerciseIndex)
            ) : -1;
          
          // Check if this is the first exercise in its circuit (for interval workouts)
          const isFirstInIntervalCircuit = isIntervalWorkout && 
            exerciseCircuitIndex >= 0 &&
            intervalCircuits[exerciseCircuitIndex]?.exercises[0]?.exerciseIndex === exerciseIndex;
          
          // Show circuit block for either: traditional circuit blockType OR first exercise in interval circuit
          const isNewCircuitBlock = currentSection !== 'warmup' && (
            (blockInfo.blockType === 'circuit' && 
              blockInfo.isFirstInBlock &&
              (!prevBlockInfo || prevBlockInfo.blockIdentifier !== blockInfo.blockIdentifier)) ||
            isFirstInIntervalCircuit
          );
          
          // Calculate circuit number by finding this exercise's circuit in intervalCircuits
          // Find which circuit contains this exercise by matching exerciseIndex
          const circuitNumber = isNewCircuitBlock && isIntervalWorkout ? exerciseCircuitIndex + 1 : 0;

          return (
            <div key={exercise.id || exerciseIndex} className="relative" data-testid={`exercise-block-${exerciseIndex}`}>
              {/* Section Header Banner - only shows when transitioning between sections */}
              {showSectionHeader && (
                <>
                  <div className="py-2">
                    <h2 className="inline-block bg-primary px-4 py-1.5 text-base font-bold text-black uppercase tracking-wider rounded-md">
                      {currentSection === 'warmup' ? 'WARM UP' : 'MAIN BODY'}
                    </h2>
                  </div>
                  {/* Circuit workout banner - shows below MAIN BODY for circuit workouts */}
                  {currentSection !== 'warmup' && workoutLog?.workoutStyle === 'circuit' && workoutLog?.intervalRounds && (
                    <div className="px-4 py-3 bg-primary/10 border-b border-border">
                      <p className="text-sm text-primary font-medium">
                        Perform as a circuit workout of {workoutLog.intervalRounds} rounds
                      </p>
                    </div>
                  )}
                  {/* Interval workout - instruction text only (buttons moved to circuit headers) */}
                  {currentSection !== 'warmup' && isIntervalWorkout && intervalCircuits.length > 0 && (
                    <div className="p-4 bg-primary/10 border-b border-border">
                      <p className="text-sm text-foreground">
                        {intervalCircuits.length === 1 
                          ? 'Review the exercises below, enter any weights, then start the timed circuit.'
                          : `${intervalCircuits.length} circuits to complete. Review exercises below, enter weights, then start each circuit.`}
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Rest Period Between Circuits - shows before circuit headers (except first) */}
              {isNewCircuitBlock && circuitNumber > 1 && intervalCircuits[circuitNumber - 2]?.restAfterCircuit && (() => {
                const restSecs = intervalCircuits[circuitNumber - 2]?.restAfterCircuit || 60;
                const circuitRestId = -1000 - (circuitNumber - 2); // Unique negative ID for circuit rest timers
                const circuitRestTimer = getTimer(circuitRestId);
                const isCircuitRestRunning = circuitRestTimer?.isRunning || false;
                
                const formatTime = (secs: number) => {
                  if (secs >= 60) {
                    const mins = Math.floor(secs / 60);
                    const remSecs = secs % 60;
                    return remSecs > 0 ? `${mins}:${remSecs.toString().padStart(2, '0')}` : `${mins}:00`;
                  }
                  return `0:${secs.toString().padStart(2, '0')}`;
                };
                
                return (
                  <div 
                    className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border"
                    data-testid={`circuit-rest-period-${circuitNumber - 1}`}
                  >
                    <button 
                      onClick={() => isCircuitRestRunning ? resetTimer(circuitRestId, restSecs) : startTimer(circuitRestId, restSecs)}
                      className="flex items-center gap-2 text-[#0cc9a9] font-medium text-sm"
                      data-testid={`button-circuit-rest-${circuitNumber - 1}`}
                    >
                      <span>👋</span>
                      <span>Rest between circuits</span>
                    </button>
                    {isCircuitRestRunning ? (
                      <button 
                        onClick={() => resetTimer(circuitRestId, restSecs)}
                        className="text-[#0cc9a9] text-sm font-bold"
                        data-testid={`button-reset-circuit-rest-${circuitNumber - 1}`}
                      >
                        {formatTime(circuitRestTimer?.remainingSeconds || restSecs)}
                      </button>
                    ) : (
                      <button 
                        onClick={() => startTimer(circuitRestId, restSecs)}
                        className="text-[#0cc9a9] text-sm font-bold"
                        data-testid={`button-start-circuit-rest-${circuitNumber - 1}`}
                      >
                        {formatTime(restSecs)}
                      </button>
                    )}
                  </div>
                );
              })()}
              
              {/* Circuit Block Header - shows when starting a new circuit block */}
              {isNewCircuitBlock && circuitNumber > 0 && (
                <div id={`circuit-${circuitNumber - 1}`} className="px-4 py-3 bg-primary/20 border-b border-primary/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0cc9a9]">
                      Circuit {circuitNumber} of {intervalCircuits.length}
                    </h3>
                    <span className="text-xs text-foreground/60">
                      {intervalCircuits[circuitNumber - 1]?.exercises.length || 0} exercises
                    </span>
                  </div>
                  <Button
                    onClick={() => handleStartIntervalSession(circuitNumber - 1)}
                    className="w-full bg-primary hover:opacity-90 text-white rounded-full py-4 text-sm font-semibold"
                    data-testid={`button-start-circuit-${circuitNumber}`}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Circuit {circuitNumber} ({workoutLog?.intervalRounds || 3} rounds)
                  </Button>
                </div>
              )}

              {/* Exercise Card */}
              <div className="relative z-10 bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border border-border/50">

              {/* Exercise Header */}
              <div className="flex items-center gap-3 p-4 pb-2">
                {/* Exercise Image */}
                {exercise.exerciseLibraryId && exercise.exerciseName?.toLowerCase() !== 'rest' ? (
                  <Link href={`/exercise/${exercise.exerciseLibraryId}?returnTo=active-workout`} className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer">
                      {exercise.muxPlaybackId ? (
                        <img
                          src={`https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                          alt={exercise.exerciseName}
                          className="w-full h-full object-cover"
                        />
                      ) : exercise.imageUrl ? (
                        <img 
                          src={exercise.imageUrl} 
                          alt={exercise.exerciseName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dumbbell className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </Link>
                ) : (
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {exercise.muxPlaybackId ? (
                      <img
                        src={`https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                        alt={exercise.exerciseName}
                        className="w-full h-full object-cover"
                      />
                    ) : exercise.imageUrl ? (
                      <img 
                        src={exercise.imageUrl} 
                        alt={exercise.exerciseName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
                
                {/* Exercise Info */}
                <div className="flex-1 min-w-0">
                  {exercise.exerciseLibraryId && exercise.exerciseName?.toLowerCase() !== 'rest' ? (
                    <Link href={`/exercise/${exercise.exerciseLibraryId}?returnTo=active-workout`}>
                      <h3 className="font-medium text-foreground truncate underline-offset-2 hover:underline cursor-pointer" data-testid={`text-exercise-name-${exerciseIndex}`}>
                        {exercise.exerciseName}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="font-medium text-foreground truncate" data-testid={`text-exercise-name-${exerciseIndex}`}>
                      {exercise.exerciseName}
                    </h3>
                  )}
                  <p className="text-sm text-foreground/60">
                    {getSetsSummary(exercise, currentSection)}
                  </p>
                </div>
                
                {/* Exercise Menu */}
                <button
                  className="text-muted-foreground p-1"
                  onClick={() => {
                    setSubstituteExerciseIndex(exerciseIndex);
                    setShowExerciseOptions(true);
                  }}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Rest Timer Row - hidden for circuit/interval workouts in main body */}
              {(() => {
                const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                const isMainBody = currentSection !== 'warmup';
                
                // For circuit/interval workouts in main body, rest is handled differently
                // Check for 'none', 'None', or '0' as "no rest" values
                const restPeriodLower = (exercise.restPeriod || '').toLowerCase();
                const hasNoRest = restPeriodLower === 'none' || restPeriodLower === '0' || restPeriodLower === '';
                // For superset/triset blocks, only show rest on the last exercise in the block
                const isNonLastInBlock = blockInfo.blockSize > 1 && !blockInfo.isLastInBlock;
                const shouldShowRest = !hasNoRest && 
                  !isNonLastInBlock &&
                  !(isCircuitWorkout && isMainBody) &&
                  !(isIntervalWorkout && isMainBody);
                
                if (!shouldShowRest) return null;
                
                return (
                  <div 
                    className="flex items-center justify-between mx-3 my-1 px-3 py-2 bg-[#0cc9a9]/5 rounded-lg"
                    data-testid={`rest-timer-row-${exerciseIndex}`}
                  >
                    <button 
                      onClick={() => isTimerRunning ? resetTimer(exerciseLogId, restSeconds) : startTimer(exerciseLogId, restSeconds)}
                      className="flex items-center gap-2 text-[#0cc9a9] font-medium text-sm"
                      data-testid={`button-rest-timer-${exerciseIndex}`}
                    >
                      <Hand className="w-[18px] h-[18px] text-[#0cc9a9]" />
                      <span>Rest between each set</span>
                    </button>
                    {isTimerRunning ? (
                      <button 
                        onClick={() => resetTimer(exerciseLogId, restSeconds)}
                        className="flex items-center gap-1.5 text-foreground/60"
                        data-testid={`button-stop-timer-${exerciseIndex}`}
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span className="text-sm">Stop</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => startTimer(exerciseLogId, restSeconds)}
                        className="flex items-center gap-1.5 text-[#0cc9a9] text-sm font-bold bg-white px-3 py-1 rounded-full shadow-sm"
                        data-testid={`button-start-rest-${exerciseIndex}`}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        {formatRestDisplay(timerValue)}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Interval Workout Main Body - inputs based on exercise type */}
              {isIntervalWorkout && currentSection !== 'warmup' ? (
                <div className="px-4 py-3">
                  {/* Rest blocks - just show timer, no inputs */}
                  {exercise.exerciseName === 'Rest' ? (
                    <div className="text-[#0cc9a9] text-sm font-bold py-2">
                      {formatDurationForDisplay(exercise.sets[0]?.targetDuration || exercise.restPeriod || '60')}
                    </div>
                  ) : isGeneralExercise ? (
                    /* General exercises (foam rolling, stretching) - Duration text only */
                    <div className="text-foreground/70 text-sm py-2">
                      {exercise.sets[0]?.targetDuration || '60 sec'}
                    </div>
                  ) : isEnduranceExercise ? (
                    /* Endurance exercises - Reps only */
                    <div className="flex items-center justify-between">
                      <div className="text-foreground/70 text-sm">
                        {exercise.sets[0]?.targetDuration || '60 sec'}
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-foreground/70 mb-1">Reps</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder=""
                          value={intervalWeights[`${exercise.id}-reps`] || ''}
                          onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'reps', e.target.value)}
                          className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                          data-testid={`input-interval-reps-${exerciseIndex}`}
                        />
                      </div>
                    </div>
                  ) : (isCardioOrTimedExercise && !isTimedStrengthExercise) ? (
                    /* Cardio/Timed exercises - Reps only (timer handled by circuit) */
                    <div className="flex items-center justify-between">
                      <div className="text-foreground/70 text-sm">
                        {exercise.sets[0]?.targetDuration || '60 sec'}
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-foreground/70 mb-1">Reps</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder=""
                          value={intervalWeights[`${exercise.id}-reps`] || ''}
                          onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'reps', e.target.value)}
                          className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                          data-testid={`input-interval-reps-${exerciseIndex}`}
                        />
                      </div>
                    </div>
                  ) : isTimedStrengthExercise ? (
                    /* Timed Strength exercises - Reps + KG (timer handled by circuit) */
                    <div className="flex items-center justify-between">
                      <div className="text-foreground/70 text-sm">
                        {exercise.sets[0]?.targetDuration || '60 sec'}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-foreground/70 mb-1">Reps</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder=""
                            value={intervalWeights[`${exercise.id}-reps`] || ''}
                            onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'reps', e.target.value)}
                            className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                            data-testid={`input-interval-reps-${exerciseIndex}`}
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-foreground/70 mb-1">{preferences.weightUnit === 'lbs' ? 'Lbs' : 'Kg'}</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder=""
                            value={intervalWeights[`${exercise.id}-kg`] || ''}
                            onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'kg', e.target.value)}
                            className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                            data-testid={`input-interval-weight-${exerciseIndex}`}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Strength exercises (default) - Reps + KG */
                    <div className="flex items-center justify-between">
                      <div className="text-foreground/70 text-sm">
                        {exercise.sets[0]?.targetDuration || '60 sec'}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-foreground/70 mb-1">Reps</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder=""
                            value={intervalWeights[`${exercise.id}-reps`] || ''}
                            onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'reps', e.target.value)}
                            className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                            data-testid={`input-interval-reps-${exerciseIndex}`}
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-foreground/70 mb-1">{preferences.weightUnit === 'lbs' ? 'Lbs' : 'Kg'}</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder=""
                            value={intervalWeights[`${exercise.id}-kg`] || ''}
                            onChange={(e) => exercise.id && handleIntervalDataUpdate(exercise.id, 'kg', e.target.value)}
                            className="w-20 h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                            data-testid={`input-interval-weight-${exerciseIndex}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : isTimedOnlyExercise ? (
                /* Timed-Only Exercise View - shows single "Go for X" with Start button */
                <div className="px-4 py-2">
                  {(() => {
                    // Use the first set's duration for the single timer
                    const firstSet = exercise.sets[0];
                    const duration = firstSet?.targetDuration || '30sec';
                    const timerKey = exerciseLogId;
                    const timer = timerMap[timerKey];
                    const isExerciseTimerRunning = timer?.isRunning && activeExerciseLogId === timerKey;
                    
                    // Parse duration to seconds for timer
                    const parseDurationToSeconds = (dur: string): number => {
                      const match = dur.match(/(\d+)\s*(sec|min|s|m)?/i);
                      if (!match) return 30;
                      const value = parseInt(match[1]);
                      const unit = (match[2] || 'sec').toLowerCase();
                      return unit.startsWith('m') ? value * 60 : value;
                    };
                    const durationSeconds = parseDurationToSeconds(duration);
                    
                    return (
                      <div 
                        className="flex items-center justify-between py-3"
                        data-testid={`timed-exercise-row-${exerciseIndex}`}
                      >
                        <span className="text-foreground/70 text-sm">
                          Go for {duration}
                        </span>
                        <button
                          onClick={() => {
                            if (isExerciseTimerRunning) {
                              contextPauseTimer(timerKey);
                            } else {
                              contextStartTimer(timerKey, durationSeconds);
                            }
                          }}
                          className="flex items-center gap-1.5 text-[#0cc9a9] font-bold text-sm bg-[#0cc9a9]/10 px-3 py-1 rounded-full"
                          data-testid={`button-start-timer-${exerciseIndex}`}
                        >
                          <Clock className="w-4 h-4" />
                          <span>{isExerciseTimerRunning ? 'Stop' : 'Start'}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {/* Timed with Reps - shows Reps and Time columns (no weight) */}
                  {isTimedWithRepsExercise ? (
                    <div className="px-4 py-2">
                      {(() => {
                        const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                        const isMainBody = currentSection !== 'warmup';
                        const circuitRounds = workoutLog?.intervalRounds || 3;
                        const displaySetsCount = (isCircuitWorkout && isMainBody) ? circuitRounds : exercise.sets.length;
                        
                        return Array.from({ length: displaySetsCount }).map((_, setIndex) => {
                          const set = exercise.sets[setIndex] || { setNumber: setIndex + 1 };
                          const duration = set.targetDuration || exercise.sets[0]?.targetDuration || '30sec';
                          const setTimerKey = exerciseLogId * 1000 + setIndex;
                          const setTimer = timerMap[setTimerKey];
                          const isSetTimerRunning = setTimer?.isRunning && activeExerciseLogId === setTimerKey;
                          
                          const parseDurationToSeconds = (dur: string): number => {
                            const match = dur.match(/(\d+)\s*(sec|min|s|m)?/i);
                            if (!match) return 30;
                            const value = parseInt(match[1]);
                            const unit = (match[2] || 'sec').toLowerCase();
                            return unit.startsWith('m') ? value * 60 : value;
                          };
                          const durationSeconds = parseDurationToSeconds(duration);
                          
                          const prevData = exercise.previous?.find(p => p.setNumber === set.setNumber || p.setNumber === setIndex + 1);
                          const isLastSet = setIndex === displaySetsCount - 1;
                          
                          return (
                            <div 
                              key={set.id || setIndex}
                              className="py-2"
                              data-testid={`set-row-${exerciseIndex}-${setIndex}`}
                            >
                              {/* Header row - only show for first set */}
                              {setIndex === 0 && (
                                <div className="grid grid-cols-4 gap-2 pb-2 text-sm text-foreground font-bold">
                                  <div>Set</div>
                                  <div>Previous</div>
                                  <div>Reps</div>
                                  <div>Time</div>
                                </div>
                              )}
                              {/* Set row with inputs - Reps and Time columns */}
                              <div className="grid grid-cols-4 gap-2 items-center">
                                <div className="text-foreground font-medium">{setIndex + 1}</div>
                                <div className="text-foreground/60 text-sm">
                                  {prevData?.reps ? `${prevData.reps} reps` : '-'}
                                </div>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder=""
                                  value={set.actualReps ?? ''}
                                  onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualReps', e.target.value)}
                                  className="h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                  data-testid={`input-reps-${exerciseIndex}-${setIndex}`}
                                />
                                <Input
                                  type="text"
                                  inputMode="text"
                                  placeholder=""
                                  value={set.actualDuration ?? ''}
                                  onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualDuration', e.target.value)}
                                  onBlur={(e) => handleTimeBlur(exerciseIndex, setIndex, e.target.value)}
                                  className="h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                  data-testid={`input-time-${exerciseIndex}-${setIndex}`}
                                />
                              </div>
                              {/* Timer row - Go for X with Start button - only show for last set */}
                              {isLastSet && (
                                <div className="flex items-center justify-between mt-5">
                                  <span className="text-foreground/70 text-sm">
                                    Go for {duration}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (isSetTimerRunning) {
                                        contextPauseTimer(setTimerKey);
                                      } else {
                                        contextStartTimer(setTimerKey, durationSeconds);
                                      }
                                    }}
                                    className="flex items-center gap-1.5 text-[#0cc9a9] font-bold text-sm bg-[#0cc9a9]/10 px-3 py-1 rounded-full"
                                    data-testid={`button-start-timer-${exerciseIndex}-${setIndex}`}
                                  >
                                    <Clock className="w-4 h-4" />
                                    <span>{isSetTimerRunning ? 'Stop' : 'Start'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : isEnduranceExercise ? (
                    <>
                      {/* Endurance exercises - Reps only, no weight - reps on right side */}
                      <div className="grid grid-cols-4 gap-2 px-4 py-2 text-sm text-foreground font-bold">
                        <div>Set</div>
                        <div>Previous</div>
                        <div></div>
                        <div>Reps</div>
                      </div>

                      {(() => {
                        const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                        const isMainBody = currentSection !== 'warmup';
                        const circuitRounds = workoutLog?.intervalRounds || 3;
                        const displaySetsCount = (isCircuitWorkout && isMainBody) ? circuitRounds : exercise.sets.length;
                        
                        return Array.from({ length: displaySetsCount }).map((_, setIndex) => {
                          const set = exercise.sets[setIndex] || { setNumber: setIndex + 1 };
                          const prevData = exercise.previous?.find(p => p.setNumber === set.setNumber || p.setNumber === setIndex + 1);
                          
                          return (
                            <div 
                              key={set.id || setIndex} 
                              className="grid grid-cols-4 gap-2 px-4 py-2 items-center"
                              data-testid={`set-row-${exerciseIndex}-${setIndex}`}
                            >
                              <div className="text-foreground font-medium">{setIndex + 1}</div>
                              <div className="text-foreground/60 text-sm">
                                {prevData?.reps ? `${prevData.reps} reps` : '-'}
                              </div>
                              <div></div>
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder=""
                                value={set.actualReps ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualReps', e.target.value)}
                                className="h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-reps-${exerciseIndex}-${setIndex}`}
                              />
                            </div>
                          );
                        });
                      })()}
                    </>
                  ) : isTimedStrengthExercise ? (
                    <>
                      {/* Timed Strength exercises - Time + Weight + Reps (3 editable boxes) */}
                      <div className="grid grid-cols-5 gap-1.5 px-4 py-2 text-sm text-foreground font-bold">
                        <div>Set</div>
                        <div>Prev</div>
                        <div>Time</div>
                        <div>{preferences.weightUnit === 'lbs' ? 'Lbs' : 'Kg'}</div>
                        <div>Reps</div>
                      </div>

                      {(() => {
                        const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                        const isMainBody = currentSection !== 'warmup';
                        const circuitRounds = workoutLog?.intervalRounds || 3;
                        
                        // For circuit workouts in main body, show circuit rounds number of rows
                        const displaySetsCount = (isCircuitWorkout && isMainBody) ? circuitRounds : exercise.sets.length;
                        
                        return Array.from({ length: displaySetsCount }).map((_, setIndex) => {
                          const set = exercise.sets[setIndex] || { setNumber: setIndex + 1 };
                          const prevData = exercise.previous?.find(p => p.setNumber === set.setNumber || p.setNumber === setIndex + 1);
                          
                          return (
                            <div 
                              key={set.id || setIndex} 
                              className="grid grid-cols-5 gap-1.5 px-4 py-2 items-center"
                              data-testid={`set-row-${exerciseIndex}-${setIndex}`}
                            >
                              <div className="text-foreground font-medium text-sm">{setIndex + 1}</div>
                              <div className="text-foreground/60 text-xs">
                                {formatPrevious(prevData)}
                              </div>
                              <Input
                                type="text"
                                inputMode="text"
                                placeholder=""
                                value={set.actualDuration ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualDuration', e.target.value)}
                                onBlur={(e) => {
                                  const formatted = formatTimeInput(e.target.value);
                                  if (formatted !== e.target.value) {
                                    handleSetUpdate(exerciseIndex, setIndex, 'actualDuration', formatted);
                                  }
                                }}
                                className="h-9 w-full text-center text-sm bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-duration-${exerciseIndex}-${setIndex}`}
                              />
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder=""
                                value={set.actualWeight ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualWeight', e.target.value)}
                                className="h-9 w-full text-center text-sm bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-weight-${exerciseIndex}-${setIndex}`}
                              />
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder=""
                                value={set.actualReps ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualReps', e.target.value)}
                                className="h-9 w-full text-center text-sm bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-reps-${exerciseIndex}-${setIndex}`}
                              />
                            </div>
                          );
                        });
                      })()}
                      
                      {/* Timer row - after sets */}
                      {(() => {
                        const firstSet = exercise.sets[0];
                        const duration = firstSet?.targetDuration || '30sec';
                        const timerKey = exerciseLogId;
                        const timer = timerMap[timerKey];
                        const isExerciseTimerRunning = timer?.isRunning && activeExerciseLogId === timerKey;
                        
                        const parseDurationToSeconds = (dur: string): number => {
                          const match = dur.match(/(\d+)\s*(sec|min|s|m)?/i);
                          if (!match) return 30;
                          const value = parseInt(match[1]);
                          const unit = (match[2] || 'sec').toLowerCase();
                          return unit.startsWith('m') ? value * 60 : value;
                        };
                        const durationSeconds = parseDurationToSeconds(duration);
                        
                        return (
                          <div 
                            className="flex items-center justify-between px-4 py-3"
                            data-testid={`timed-strength-timer-row-${exerciseIndex}`}
                          >
                            <span className="text-foreground/70 text-sm">
                              Go for {duration}
                            </span>
                            <button
                              onClick={() => {
                                if (isExerciseTimerRunning) {
                                  contextPauseTimer(timerKey);
                                } else {
                                  contextStartTimer(timerKey, durationSeconds);
                                }
                              }}
                              className="flex items-center gap-1.5 text-[#0cc9a9] font-bold text-sm bg-[#0cc9a9]/10 px-3 py-1 rounded-full"
                              data-testid={`button-start-timer-${exerciseIndex}`}
                            >
                              <Clock className="w-4 h-4" />
                              <span>{isExerciseTimerRunning ? 'Stop' : 'Start'}</span>
                            </button>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {/* Regular strength exercises - standard table format */}
                      <div className="grid grid-cols-[48px_80px_1fr_1fr] gap-1.5 px-4 py-2 text-sm text-foreground font-bold">
                        <div>Set</div>
                        <div>Previous</div>
                        <div>{preferences.weightUnit === 'lbs' ? 'Lbs' : 'Kg'}</div>
                        <div>Reps</div>
                      </div>

                      {(() => {
                        const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                        const isMainBody = currentSection !== 'warmup';
                        const circuitRounds = workoutLog?.intervalRounds || 3;
                        
                        // For circuit workouts in main body, show circuit rounds number of rows
                        const displaySetsCount = (isCircuitWorkout && isMainBody) ? circuitRounds : exercise.sets.length;
                        
                        return Array.from({ length: displaySetsCount }).map((_, setIndex) => {
                          const set = exercise.sets[setIndex] || { setNumber: setIndex + 1 };
                          const prevData = exercise.previous?.find(p => p.setNumber === set.setNumber || p.setNumber === setIndex + 1);
                          
                          return (
                            <div 
                              key={set.id || setIndex} 
                              className="grid grid-cols-[48px_80px_1fr_1fr] gap-1.5 px-4 py-2 items-center"
                              data-testid={`set-row-${exerciseIndex}-${setIndex}`}
                            >
                              <div className="text-foreground font-medium">{setIndex + 1}</div>
                              <div className="text-foreground/60 text-xs truncate">
                                {formatPrevious(prevData)}
                              </div>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder=""
                                value={set.actualWeight ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualWeight', e.target.value)}
                                className="h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-weight-${exerciseIndex}-${setIndex}`}
                              />
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder=""
                                value={set.actualReps ?? ''}
                                onChange={(e) => handleSetUpdate(exerciseIndex, setIndex, 'actualReps', e.target.value)}
                                className="h-10 text-center bg-white text-zinc-900 border border-zinc-300 rounded-md shadow-sm"
                                data-testid={`input-reps-${exerciseIndex}-${setIndex}`}
                              />
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}

                  {/* Add/Remove Set Controls - hidden for circuit workouts in main body */}
                  {(() => {
                    const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                    const isMainBody = currentSection !== 'warmup';
                    
                    // Hide add/remove set controls for circuit workouts in main body
                    if (isCircuitWorkout && isMainBody) return null;
                    
                    return (
                      <div className="flex items-center gap-4 px-4 py-3">
                        <button 
                          onClick={() => handleAddSet(exerciseIndex)}
                          className="flex items-center gap-2 text-[#0cc9a9] font-medium text-sm"
                          data-testid={`button-add-set-${exerciseIndex}`}
                        >
                          <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-[#0cc9a9]">
                            <Plus className="w-3 h-3" strokeWidth={3} />
                          </span>
                          Add new set
                        </button>
                        {exercise.sets.length > 1 && (
                          <>
                            <div className="h-4 w-px bg-border" />
                            <button 
                              onClick={() => handleRemoveSet(exerciseIndex)}
                              className="flex items-center gap-2 text-destructive text-sm"
                              data-testid={`button-remove-set-${exerciseIndex}`}
                            >
                              <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-destructive">
                                <Minus className="w-3 h-3" strokeWidth={3} />
                              </span>
                              Remove set
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Circuit Rest Timer - shows at the bottom of last main body exercise */}
                  {(() => {
                    const isCircuitWorkout = workoutLog?.workoutStyle === 'circuit';
                    const mainBodyExercises = exercises.filter(e => (e.section?.toLowerCase() || 'main') !== 'warmup');
                    const isLastMainBodyExercise = currentSection !== 'warmup' && 
                      mainBodyExercises.length > 0 && 
                      mainBodyExercises[mainBodyExercises.length - 1] === exercise;
                    
                    if (!isCircuitWorkout || !isLastMainBodyExercise || exercise.restPeriod === 'none') return null;
                    
                    return (
                      <div 
                        className="flex items-center justify-between px-4 py-3 mt-4 border-t border-border"
                        data-testid={`circuit-rest-timer-row-${exerciseIndex}`}
                      >
                        <button 
                          onClick={() => isTimerRunning ? resetTimer(exerciseLogId, restSeconds) : startTimer(exerciseLogId, restSeconds)}
                          className="flex items-center gap-2 text-[#0cc9a9] font-medium text-sm"
                          data-testid={`button-circuit-rest-timer-${exerciseIndex}`}
                        >
                          <span>👋</span>
                          <span>Rest between rounds</span>
                        </button>
                        {isTimerRunning ? (
                          <button 
                            onClick={() => resetTimer(exerciseLogId, restSeconds)}
                            className="flex items-center gap-1.5 text-muted-foreground"
                            data-testid={`button-stop-circuit-timer-${exerciseIndex}`}
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span className="text-sm">Stop</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => startTimer(exerciseLogId, restSeconds)}
                            className="text-[#0cc9a9] text-sm font-bold"
                            data-testid={`button-start-circuit-rest-${exerciseIndex}`}
                          >
                            {formatRestDisplay(timerValue)}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              </div>{/* end Exercise Card */}

              {/* Superset/Triset Link - shows between exercises in same block */}
              {showBlockConnector && (
                <div className="bg-primary -mt-3 -mb-6">
                  <div className="flex items-center justify-center py-4 gap-12">
                    <div className="flex flex-col items-center">
                      <ChevronUp className="w-3 h-3 text-black stroke-[2.5]" />
                      <ChevronDown className="w-3 h-3 text-black stroke-[2.5] -mt-1" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="w-3 h-3 text-black" />
                      <span className="text-xs font-bold text-black">{blockTypeLabel}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <ChevronUp className="w-3 h-3 text-black stroke-[2.5]" />
                      <ChevronDown className="w-3 h-3 text-black stroke-[2.5] -mt-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insert Exercise Button */}
      <div className="px-4 py-6 flex flex-col items-center gap-8">
        <button 
          className="flex items-center gap-2 text-[#0cc9a9] font-medium"
          onClick={() => setShowExerciseSelector(true)}
          data-testid="button-insert-exercise"
        >
          <span className="text-lg">🏋️</span>
          Insert Exercise
        </button>

        {/* Save Button */}
        <Button 
          onClick={handleCompleteWorkout}
          disabled={completeMutation.isPending}
          className="w-48 bg-[#0cc9a9] hover:bg-[#0cc9a9] text-black font-medium"
          data-testid="button-save-bottom"
        >
          {completeMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Exercise Options Bottom Sheet */}
      <Sheet open={showExerciseOptions} onOpenChange={setShowExerciseOptions}>
        <SheetContent side="bottom" className="p-0 rounded-t-xl [&>button]:hidden">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
          <div>
            <button
              className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/50 active:bg-muted"
              onClick={() => {
                setShowExerciseOptions(false);
                setTimeout(() => navigate(`/active-workout/${logId}/substitute/${substituteExerciseIndex}`), 300);
              }}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">Substitute exercise</p>
            </button>
          </div>
          <div className="pb-8" />
        </SheetContent>
      </Sheet>

      {/* Exercise Selector Sheet */}
      <Sheet open={showExerciseSelector} onOpenChange={(open) => {
        if (!open) {
          setSubstituteMode(false);
          setSubstituteExerciseIndex(null);
          setSelectedExercises([]);
          setExerciseSearchTerm("");
        }
        setShowExerciseSelector(open);
      }}>
        <SheetContent side="bottom" className="h-[95vh] p-0 rounded-t-xl flex flex-col [&>button]:hidden">
          {/* Header */}
          <div className="flex-shrink-0 bg-background z-10 border-b border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <button 
                onClick={() => {
                  setShowExerciseSelector(false);
                  setSelectedExercises([]);
                  setExerciseSearchTerm("");
                }}
                className="text-sm font-medium text-foreground"
                data-testid="button-cancel-exercise-selector"
              >
                Cancel
              </button>
              <h2 className="text-base font-semibold text-foreground">
                {substituteMode ? 'Substitute Exercise' : 'Add Exercises'}
              </h2>
              <button 
                onClick={() => substituteMode ? handleSubstituteExercise() : addExercisesMutation.mutate(selectedExercises)}
                disabled={selectedExercises.length === 0 || addExercisesMutation.isPending}
                className={`text-sm font-medium ${selectedExercises.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}
                data-testid="button-add-selected-exercises"
              >
                {substituteMode ? 'Substitute' : addExercisesMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for exercise..."
                value={exerciseSearchTerm}
                onChange={(e) => setExerciseSearchTerm(e.target.value)}
                className="pl-9 bg-muted/50"
                data-testid="input-search-exercises"
              />
            </div>
          </div>

          {/* Exercise List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="divide-y divide-border">
              {filteredLibraryExercises.map((exercise) => {
                const isSelected = selectedExercises.some(e => e.id === exercise.id);
                return (
                  <div
                    key={exercise.id}
                    onClick={() => toggleExerciseSelection(exercise)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 active:bg-muted"
                    data-testid={`exercise-selector-item-${exercise.id}`}
                  >
                    {/* Exercise Image */}
                    <div className="w-14 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0">
                      {exercise.muxPlaybackId ? (
                        <img
                          src={`https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                          alt={exercise.name}
                          className="w-full h-full object-cover"
                        />
                      ) : exercise.imageUrl ? (
                        <img
                          src={exercise.imageUrl}
                          alt={exercise.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dumbbell className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Exercise Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {exercise.name}
                      </p>
                    </div>

                    {/* Selection Checkbox */}
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected 
                        ? 'border-[#0cc9a9] bg-[#0cc9a9]' 
                        : 'border-white/50'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 text-black" />}
                    </div>
                  </div>
                );
              })}

              {filteredLibraryExercises.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  {exerciseSearchTerm ? 'No exercises match your search' : 'No exercises available'}
                </div>
              )}
            </div>

            {/* Add Custom Exercise Link */}
            <div className="px-4 py-4 border-t border-border">
              <button 
                className="flex items-center gap-2 text-primary text-sm"
                data-testid="button-add-custom-exercise"
              >
                <Plus className="w-4 h-4" />
                Add custom exercise
              </button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Menu Bottom Sheet */}
      <Sheet open={showEditMenu} onOpenChange={setShowEditMenu}>
        <SheetContent side="bottom" className="h-auto p-0 rounded-t-xl">
          <div className="py-2">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <button
              onClick={() => {
                setShowEditMenu(false);
                const exercisesCopy = JSON.parse(JSON.stringify(exercises));
                setEditExercises(exercisesCopy);
                setOriginalExercises(JSON.parse(JSON.stringify(exercises)));
                setSelectedEditExercises([]);
                setIsEditMode(true);
              }}
              className="w-full px-6 py-4 text-left text-base font-medium text-foreground hover:bg-muted/50"
              data-testid="menu-edit-this-workout"
            >
              Edit This Workout
            </button>
            <button
              onClick={() => {
                setShowEditMenu(false);
                cancelMutation.mutate();
              }}
              className="w-full px-6 py-4 text-left text-base font-medium text-destructive hover:bg-muted/50"
              data-testid="menu-delete-workout"
            >
              Delete
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Mode Full Screen */}
      {isEditMode && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          {/* Edit Mode Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button 
              onClick={() => {
                setIsEditMode(false);
                setSelectedEditExercises([]);
              }}
              className="text-sm font-medium text-foreground"
              data-testid="button-cancel-edit"
            >
              Cancel
            </button>
            <h2 className="text-base font-semibold text-foreground">{workoutLog.workoutName}</h2>
            <button 
              onClick={async () => {
                setIsSaving(true);
                try {
                  // Save all exercise changes
                  for (let i = 0; i < editExercises.length; i++) {
                    const exercise = editExercises[i];
                    const originalExercise = originalExercises.find(o => o.id === exercise.id);
                    
                    if (exercise.id) {
                      // Update exercise log with position, blockType, section, restPeriod
                      await apiRequest('PATCH', `/api/exercise-logs/${exercise.id}`, {
                        position: i,
                        blockType: exercise.blockType,
                        section: exercise.section,
                        restPeriod: exercise.restPeriod,
                      });
                      
                      // Handle set changes
                      const currentSets = exercise.sets || [];
                      const originalSets = originalExercise?.sets || [];
                      
                      // Delete removed sets
                      for (const origSet of originalSets) {
                        if (origSet.id && !currentSets.some(s => s.id === origSet.id)) {
                          await apiRequest('DELETE', `/api/set-logs/${origSet.id}`, {});
                        }
                      }
                      
                      // Add new sets or update existing
                      for (let j = 0; j < currentSets.length; j++) {
                        const set = currentSets[j];
                        if (set.id) {
                          // Update existing set
                          const origSet = originalSets.find(s => s.id === set.id);
                          if (origSet?.targetReps !== set.targetReps || origSet?.targetDuration !== set.targetDuration) {
                            await apiRequest('PATCH', `/api/set-logs/${set.id}`, {
                              targetReps: set.targetReps,
                              targetDuration: set.targetDuration,
                            });
                          }
                        } else {
                          // Create new set
                          await apiRequest('POST', `/api/exercise-logs/${exercise.id}/sets`, {
                            setNumber: j + 1,
                            targetReps: set.targetReps || null,
                            targetDuration: set.targetDuration || null,
                          });
                        }
                      }
                    }
                  }
                  
                  // Update local state
                  setExercises([...editExercises]);
                  await queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', logId] });
                  setIsEditMode(false);
                  setSelectedEditExercises([]);
                  toast({
                    title: "Workout updated",
                    description: "Your changes have been saved",
                  });
                } catch (error) {
                  console.error("Failed to save workout changes:", error);
                  toast({
                    title: "Error",
                    description: "Failed to save some changes",
                    variant: "destructive",
                  });
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              className="text-sm font-medium text-primary disabled:opacity-50"
              data-testid="button-save-edit"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Edit Mode Exercise List */}
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border">
              {editExercises.map((exercise, index) => {
                const isSelected = selectedEditExercises.includes(index);
                const prevExercise = editExercises[index - 1];
                const nextExercise = editExercises[index + 1];
                
                // Check if this is the first exercise in a new section
                const isNewSection = !prevExercise || prevExercise.section !== exercise.section;
                const sectionLabel = exercise.section === 'warmup' ? 'Warm Up' : 'Main Body';
                
                // Check if this is the start of a superset/triset block
                const isBlockStart = exercise.blockType !== 'single' && 
                  (!prevExercise || prevExercise.blockType !== exercise.blockType || prevExercise.position !== exercise.position - 1);
                
                // Check if in same block as previous
                const inSameBlockAsPrev = prevExercise && 
                  prevExercise.blockType === exercise.blockType && 
                  prevExercise.blockType !== 'single';

                // Get block size for header
                const getBlockSize = () => {
                  if (exercise.blockType === 'single') return 1;
                  let count = 1;
                  let i = index + 1;
                  while (i < editExercises.length && editExercises[i].blockType === exercise.blockType) {
                    count++;
                    i++;
                  }
                  return count;
                };

                const blockSize = isBlockStart ? getBlockSize() : 0;
                const blockTypeLabel = exercise.blockType === 'superset' ? 'Superset' : 
                                       exercise.blockType === 'triset' ? 'Triset' : 
                                       exercise.blockType === 'circuit' ? 'Circuit' : '';
                
                // Get sets count
                const setsCount = exercise.sets?.length || 0;
                
                // Calculate block indices and selection state for grouped blocks
                const getBlockIndices = (): number[] => {
                  if (exercise.blockType === 'single') return [];
                  const indices: number[] = [];
                  let i = index;
                  while (i < editExercises.length && editExercises[i].blockType === exercise.blockType) {
                    indices.push(i);
                    i++;
                  }
                  return indices;
                };
                const blockIndices = isBlockStart ? getBlockIndices() : [];
                const allBlockSelected = blockIndices.length > 0 && blockIndices.every(bi => selectedEditExercises.includes(bi));
                
                // Get display values
                const getDisplayBadges = () => {
                  const badges: { label: string; type: 'time' | 'reps' | 'rest' | 'sets' }[] = [];
                  const firstSet = exercise.sets?.[0];
                  const setsCountDisplay = exercise.sets?.length || 0;
                  
                  // Add sets count badge
                  badges.push({ label: `${setsCountDisplay} sets`, type: 'sets' });
                  
                  // Show reps badge if present
                  if (firstSet?.targetReps) {
                    badges.push({ label: firstSet.targetReps, type: 'reps' });
                  }
                  
                  // Show time badge if present (for timed exercises, show BOTH reps and time)
                  if (firstSet?.targetDuration) {
                    badges.push({ label: firstSet.targetDuration, type: 'time' });
                  }
                  
                  // Add rest badge
                  if (exercise.restPeriod && exercise.restPeriod !== '0') {
                    badges.push({ label: exercise.restPeriod.replace(' sec', 's').replace(' min', 'm'), type: 'rest' });
                  } else {
                    badges.push({ label: 'None', type: 'rest' });
                  }
                  
                  return badges;
                };

                const displayBadges = getDisplayBadges();
                
                // Handle badge click for inline editing
                const handleBadgeClick = (badgeType: 'time' | 'reps' | 'rest' | 'sets') => {
                  setEditingExerciseIndex(index);
                  setEditingField(badgeType);
                  
                  // Set initial value based on badge type
                  if (badgeType === 'sets') {
                    setEditValue(String(exercise.sets?.length || 2));
                  } else if (badgeType === 'time') {
                    const firstSet = exercise.sets?.[0];
                    const duration = firstSet?.targetDuration || '30 sec';
                    // Parse the duration to get seconds value
                    if (duration.includes('min') || duration.includes('m')) {
                      const mins = parseInt(duration.replace(' min', '').replace('m', '').replace(' ', ''));
                      setEditValue(String(mins * 60));
                    } else {
                      const secs = parseInt(duration.replace(' sec', '').replace('s', '').replace(' ', ''));
                      setEditValue(String(secs || 30));
                    }
                  } else if (badgeType === 'reps') {
                    const firstSet = exercise.sets?.[0];
                    setEditValue(firstSet?.targetReps || '10');
                  } else if (badgeType === 'rest') {
                    const restPeriod = exercise.restPeriod || '60 sec';
                    if (restPeriod === 'None' || restPeriod === '0') {
                      setEditValue('0');
                    } else if (restPeriod.includes('min')) {
                      const mins = parseInt(restPeriod.replace(' min', '').replace('m', ''));
                      setEditValue(String(mins * 60));
                    } else {
                      const secs = parseInt(restPeriod.replace(' sec', '').replace('s', ''));
                      setEditValue(String(secs));
                    }
                  }
                };

                return (
                  <div key={exercise.id || index}>
                    {/* Section Header */}
                    {isNewSection && (
                      <div className="px-4 py-3 bg-muted/50 border-b border-border">
                        <h3 className="text-base font-semibold uppercase text-foreground">
                          {sectionLabel}
                        </h3>
                      </div>
                    )}
                    
                    {/* Block Header - entire block is draggable from here */}
                    {isBlockStart && exercise.blockType !== 'single' && (
                      <div 
                        className={`flex items-center justify-between px-4 py-2 bg-muted/30 ${
                          draggedBlock?.startIndex === index ? 'opacity-50 bg-muted' : ''
                        }`}
                        draggable
                        onDragStart={() => {
                          setDraggedBlock({ startIndex: index, size: blockIndices.length });
                        }}
                        onDragEnd={() => setDraggedBlock(null)}
                        data-testid={`block-header-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Select/deselect all exercises in this block
                              if (allBlockSelected) {
                                setSelectedEditExercises(prev => prev.filter(idx => !blockIndices.includes(idx)));
                              } else {
                                setSelectedEditExercises(prev => Array.from(new Set([...prev, ...blockIndices])));
                              }
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                              allBlockSelected ? 'border-[#0cc9a9] bg-[#0cc9a9]' : 'border-[#0cc9a9]'
                            }`}
                            data-testid={`checkbox-block-${index}`}
                          >
                            {allBlockSelected && <Check className="w-3 h-3 text-black" />}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {blockTypeLabel} of <span className="text-primary">{setsCount} sets</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Ungroup - set all exercises in this block to 'single'
                              const newExercises = [...editExercises];
                              let i = index;
                              while (i < newExercises.length && newExercises[i].blockType === exercise.blockType) {
                                newExercises[i] = { ...newExercises[i], blockType: 'single' };
                                i++;
                              }
                              setEditExercises(newExercises);
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground"
                            data-testid={`button-ungroup-${index}`}
                          >
                            Ungroup
                          </button>
                          <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                        </div>
                      </div>
                    )}

                    {/* Exercise Row - only standalone exercises are draggable */}
                    <div 
                      className={`flex items-center gap-3 px-4 py-3 ${draggedIndex === index ? 'opacity-50 bg-muted' : ''}`}
                      draggable={exercise.blockType === 'single'}
                      onDragStart={() => {
                        if (exercise.blockType === 'single') {
                          setDraggedIndex(index);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        // Handle single exercise drag
                        if (exercise.blockType === 'single' && draggedIndex !== null && draggedIndex !== index) {
                          const newExercises = [...editExercises];
                          const [removed] = newExercises.splice(draggedIndex, 1);
                          // Update the section of the dragged exercise to match the target position
                          const targetSection = newExercises[index]?.section || newExercises[index - 1]?.section || 'main';
                          removed.section = targetSection;
                          newExercises.splice(index, 0, removed);
                          setEditExercises(newExercises);
                          setDraggedIndex(index);
                        }
                        // Handle block drag - move entire block as a unit
                        if (draggedBlock !== null && exercise.blockType === 'single') {
                          const { startIndex, size } = draggedBlock;
                          // Only process if dropping on a different position
                          if (index < startIndex || index >= startIndex + size) {
                            const newExercises = [...editExercises];
                            // Extract the block
                            const blockExercises = newExercises.splice(startIndex, size);
                            // Update section for all exercises in the block
                            const targetSection = newExercises[index]?.section || newExercises[index - 1]?.section || 'main';
                            blockExercises.forEach(ex => {
                              ex.section = targetSection;
                            });
                            // Calculate new insert position (adjusting for removed items if needed)
                            const insertIndex = index > startIndex ? index - size : index;
                            // Insert the block at new position
                            newExercises.splice(insertIndex, 0, ...blockExercises);
                            setEditExercises(newExercises);
                            // Update dragged block position
                            setDraggedBlock({ startIndex: insertIndex, size });
                          }
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDraggedBlock(null);
                      }}
                      data-testid={`edit-exercise-row-${index}`}
                    >
                      {/* Checkbox - only show for standalone exercises, not for grouped exercises */}
                      {exercise.blockType === 'single' ? (
                        <div 
                          onClick={() => {
                            if (isSelected) {
                              setSelectedEditExercises(prev => prev.filter(i => i !== index));
                            } else {
                              setSelectedEditExercises(prev => [...prev, index]);
                            }
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer flex-shrink-0 ${
                            isSelected ? 'border-[#0cc9a9] bg-[#0cc9a9]' : 'border-[#0cc9a9]'
                          }`}
                          data-testid={`checkbox-exercise-${index}`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black" />}
                        </div>
                      ) : (
                        <div className="w-5 flex-shrink-0" />
                      )}

                      {/* Exercise Image */}
                      <div className="w-14 h-14 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        {exercise.muxPlaybackId ? (
                          <img
                            src={`https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                            alt={exercise.exerciseName}
                            className="w-full h-full object-cover"
                          />
                        ) : exercise.imageUrl ? (
                          <img
                            src={exercise.imageUrl}
                            alt={exercise.exerciseName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Dumbbell className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Exercise Info */}
                      <div className="flex-1 min-w-0">
                        {exercise.exerciseLibraryId && exercise.exerciseName?.toLowerCase() !== 'rest' ? (
                          <Link href={`/exercise/${exercise.exerciseLibraryId}?returnTo=active-workout`}>
                            <p className="text-sm font-medium text-foreground truncate hover:underline underline-offset-2 cursor-pointer">
                              {exercise.exerciseName}
                            </p>
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-foreground truncate">
                            {exercise.exerciseName}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {displayBadges.map((badge, badgeIndex) => (
                            <button 
                              key={badgeIndex}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBadgeClick(badge.type);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                                badge.type === 'rest' 
                                  ? 'border border-border text-muted-foreground' 
                                  : badge.type === 'sets'
                                  ? 'bg-muted text-foreground'
                                  : 'bg-primary/10 text-primary'
                              }`}
                              data-testid={`button-edit-${badge.type}-${index}`}
                            >
                              {badge.type === 'rest' && <Hand className="w-3 h-3" />}
                              {badge.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Drag Handle - only show for standalone exercises */}
                      {exercise.blockType === 'single' && (
                        <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0 cursor-grab" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Edit Mode Bottom Toolbar */}
          <div className="border-t border-border bg-background">
            <div className="flex items-center justify-around py-3">
              {/* Group Button */}
              <button
                onClick={() => {
                  if (selectedEditExercises.length >= 2) {
                    const blockType = selectedEditExercises.length === 2 ? 'superset' :
                                      selectedEditExercises.length === 3 ? 'triset' : 'circuit';
                    const newExercises = [...editExercises];
                    selectedEditExercises.forEach(idx => {
                      newExercises[idx] = { ...newExercises[idx], blockType };
                    });
                    setEditExercises(newExercises);
                    setSelectedEditExercises([]);
                    toast({
                      title: "Exercises grouped",
                      description: `Created ${blockType} with ${selectedEditExercises.length} exercises`,
                    });
                  }
                }}
                disabled={selectedEditExercises.length < 2}
                className={`flex flex-col items-center gap-1 ${
                  selectedEditExercises.length >= 2 ? 'text-primary' : 'text-muted-foreground'
                }`}
                data-testid="button-group-exercises"
              >
                <Layers className="w-6 h-6" />
                <span className="text-xs">Group</span>
              </button>

              {/* Delete Button */}
              <button
                onClick={async () => {
                  if (selectedEditExercises.length > 0) {
                    const exercisesToDelete = selectedEditExercises.map(idx => editExercises[idx]);
                    const newExercises = editExercises.filter((_, idx) => !selectedEditExercises.includes(idx));
                    setEditExercises(newExercises);
                    
                    // Delete from database with proper error handling
                    try {
                      await Promise.all(
                        exercisesToDelete.map(exercise => {
                          if (exercise.id) {
                            return apiRequest('DELETE', `/api/exercise-logs/${exercise.id}`, {});
                          }
                          return Promise.resolve();
                        })
                      );
                      
                      setSelectedEditExercises([]);
                      toast({
                        title: "Exercises deleted",
                        description: `Removed ${exercisesToDelete.length} exercise(s)`,
                      });
                    } catch (error) {
                      console.error("Failed to delete exercises:", error);
                      toast({
                        title: "Error",
                        description: "Failed to delete some exercises",
                        variant: "destructive",
                      });
                    }
                  }
                }}
                disabled={selectedEditExercises.length === 0}
                className={`flex flex-col items-center gap-1 ${
                  selectedEditExercises.length > 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}
                data-testid="button-delete-exercises"
              >
                <Trash2 className="w-6 h-6" />
                <span className="text-xs">Delete</span>
              </button>

              {/* Insert Button */}
              <button
                onClick={() => {
                  setShowExerciseSelector(true);
                }}
                className="flex flex-col items-center gap-1 text-[#0cc9a9]"
                data-testid="button-insert-exercise-edit"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">Insert</span>
              </button>
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
                  {editingField === 'time' && 'Edit Time'}
                  {editingField === 'reps' && 'Edit Reps'}
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
                  
                  {editingField === 'time' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-muted-foreground text-center">Duration</label>
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
                                  data-testid={`button-time-${val}s`}
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
                                  data-testid={`button-time-${item.value}`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {editingField === 'reps' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm text-muted-foreground">Reps (e.g., 10, 8-12)</label>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="10"
                        className="text-center text-xl"
                        data-testid="input-edit-reps"
                      />
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
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingExerciseIndex(null);
                    setEditingField(null);
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingExerciseIndex === null || !editingField) return;
                    
                    const newExercises = [...editExercises];
                    const exercise = newExercises[editingExerciseIndex];
                    
                    if (editingField === 'sets') {
                      const newSetsCount = parseInt(editValue);
                      const currentSets = exercise.sets || [];
                      
                      if (newSetsCount > currentSets.length) {
                        // Add more sets with proper typing
                        const additionalSets: SetData[] = Array.from(
                          { length: newSetsCount - currentSets.length },
                          (_, idx) => ({
                            setNumber: currentSets.length + idx + 1,
                            targetReps: currentSets[0]?.targetReps || null,
                            targetDuration: currentSets[0]?.targetDuration || null,
                            actualReps: null,
                            actualWeight: null,
                            actualDuration: null,
                            actualDurationMinutes: null,
                            actualDurationSeconds: null,
                            isCompleted: false,
                            side: null,
                            setDifficultyRating: null,
                            painFlag: false,
                            failureFlag: false,
                          })
                        );
                        exercise.sets = [...currentSets, ...additionalSets];
                      } else if (newSetsCount < currentSets.length) {
                        // Remove sets
                        exercise.sets = currentSets.slice(0, newSetsCount);
                      }
                    } else if (editingField === 'time') {
                      // Update all sets with new time - format properly
                      const seconds = parseInt(editValue);
                      let formattedDuration: string;
                      if (seconds >= 60) {
                        const mins = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        if (secs === 0) {
                          formattedDuration = `${mins} min`;
                        } else {
                          formattedDuration = `${seconds} sec`;
                        }
                      } else {
                        formattedDuration = `${editValue} sec`;
                      }
                      
                      if (exercise.sets) {
                        exercise.sets = exercise.sets.map(set => ({
                          ...set,
                          targetDuration: formattedDuration,
                        }));
                      }
                    } else if (editingField === 'reps') {
                      // Update all sets with new reps
                      if (exercise.sets) {
                        exercise.sets = exercise.sets.map(set => ({
                          ...set,
                          targetReps: editValue,
                        }));
                      }
                    } else if (editingField === 'rest') {
                      if (editValue === '0') {
                        exercise.restPeriod = 'None';
                      } else {
                        const seconds = parseInt(editValue);
                        if (seconds >= 60) {
                          const mins = Math.floor(seconds / 60);
                          const secs = seconds % 60;
                          if (secs === 0) {
                            exercise.restPeriod = `${mins} min`;
                          } else {
                            exercise.restPeriod = `${seconds} sec`;
                          }
                        } else {
                          exercise.restPeriod = `${editValue} sec`;
                        }
                      }
                    }
                    
                    setEditExercises(newExercises);
                    setEditingExerciseIndex(null);
                    setEditingField(null);
                    setEditValue("");
                    
                    toast({
                      title: "Updated",
                      description: `${editingField} has been updated`,
                    });
                  }}
                  data-testid="button-save-edit"
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Interval Workout Session Overlay */}
      {showIntervalSession && isIntervalWorkout && intervalCircuits.length > 0 && (
        <IntervalWorkoutSession
          circuits={intervalCircuits}
          startingCircuitIndex={currentIntervalCircuit}
          onComplete={handleIntervalSessionComplete}
          onClose={handleIntervalSessionClose}
        />
      )}

      {/* Cancel Workout Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Workout?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this workout? Your progress will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-workout">Keep Going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                workoutEndedIntentionally.current = true;
                setShowCancelConfirm(false);
                cancelMutation.mutate();
              }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-cancel-workout"
            >
              Cancel Workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workout Rating Dialog */}
      <WorkoutRatingDialog
        open={showRatingDialog}
        onComplete={handleRatingComplete}
        isPending={completeMutation.isPending}
      />

      {/* Workout Celebration Dialog */}
      {completionData && (
        <WorkoutCelebration
          open={showCelebration}
          onClose={handleCelebrationClose}
          summary={completionData.summary}
          prs={completionData.prs}
          workoutName={workoutLog?.workoutName || "Workout"}
        />
      )}
    </div>
  );
}
