import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dumbbell, Clock, Calendar, Link, Zap, RotateCcw, Video, Save, MoreVertical, Bookmark, Plus } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import TopHeader from "@/components/TopHeader";
import { ExerciseCard } from "@/components/ExerciseCard";
import { WorkoutCompletionView } from "@/components/training/WorkoutCompletionView";
import { ScheduleWorkoutDialog } from "@/components/training/ScheduleWorkoutDialog";
import { MoveWorkoutCalendar } from "@/components/training/MoveWorkoutCalendar";
import WorkoutRatingDialog from "@/components/WorkoutRatingDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, parse } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { calculateWorkoutDuration } from "@/lib/utils";
import { consumeScrollRestore, clearScrollRestore } from "@/lib/scrollRestore";
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

export default function TrainingWorkoutDetail() {
  const [match, params] = useRoute("/training/workout/:id");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { isAuthenticated, user: currentUser } = useAuth();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const isPreviewMode = params?.id === 'preview';
  const workoutId = isPreviewMode ? null : (params?.id ? parseInt(params.id) : null);
  const [showProgrammeWarning, setShowProgrammeWarning] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showActiveWorkoutDialog, setShowActiveWorkoutDialog] = useState(false);
  const [activeWorkoutLogId, setActiveWorkoutLogId] = useState<number | null>(null);
  const [showCompleteVideoDialog, setShowCompleteVideoDialog] = useState(false);
  const [justCompletedWorkout, setJustCompletedWorkout] = useState(false);
  const [justCompletedLogId, setJustCompletedLogId] = useState<number | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteLogDialog, setShowDeleteLogDialog] = useState(false);
  const [showEditLogMode, setShowEditLogMode] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  
  // Parse URL query params for calendar/completed context
  const urlParams = new URLSearchParams(searchString);
  const scheduledDateStr = urlParams.get('date');
  const sourceContext = urlParams.get('source');
  const scheduledWorkoutIdStr = urlParams.get('scheduledId');
  const logIdStr = urlParams.get('logId');
  const isFromCalendar = sourceContext === 'calendar';
  const isFromCompleted = sourceContext === 'completed';
  const isFromProgrammeBuilder = sourceContext === 'programme-builder';
  const returnToPath = urlParams.get('returnTo');
  const scheduledDate = scheduledDateStr ? parse(scheduledDateStr, 'yyyy-MM-dd', new Date()) : null;
  const scheduledWorkoutId = scheduledWorkoutIdStr ? parseInt(scheduledWorkoutIdStr) : null;
  const completedLogId = logIdStr ? parseInt(logIdStr) : null;
  
  // Move date state - initialize with current date or today
  const [newMoveDate, setNewMoveDate] = useState<string>(
    scheduledDateStr || format(new Date(), 'yyyy-MM-dd')
  );
  
  const muxPlayerRef = useRef<any>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const savedProgressRestoredRef = useRef(false);

  const { data: timeline, isLoading: timelineLoading } = useQuery<any>({
    queryKey: ['/api/my-programs/timeline'],
    enabled: isAuthenticated,
  });


  const handleBack = () => {
    const returnTab = urlParams.get('returnTab');
    if (isFromProgrammeBuilder) {
      window.history.back();
    } else if (returnTab) {
      navigate(`/training?tab=${returnTab}`);
    } else if (isFromCalendar || isFromCompleted) {
      window.history.back();
    } else if (workoutData?.type === 'programme' && workoutData?.workout?.programId) {
      navigate(`/training/programme/${workoutData.workout.programId}`);
    } else {
      navigate('/training?tab=workouts');
    }
  };

  const handleAddToProgramme = () => {
    if (!workoutId || !workout) return;
    sessionStorage.setItem('selectedWorkoutId', workoutId.toString());
    sessionStorage.setItem('selectedWorkoutData', JSON.stringify({
      id: workoutId,
      title: workout.title || workout.name,
      description: workout.description,
      category: workout.category,
      difficulty: workout.difficulty,
      duration: workout.duration,
      workoutType: workout.workoutType,
    }));
    window.history.back();
  };

  const previewData = useMemo(() => {
    if (!isPreviewMode) return null;
    try {
      const raw = sessionStorage.getItem('previewWorkoutData');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [isPreviewMode]);

  const { data: workoutData, isLoading } = useQuery<any>({
    queryKey: ['/api/workouts', workoutId],
    queryFn: async () => {
      const res = await fetch(`/api/workouts/${workoutId}`);
      if (res.ok) {
        const workout = await res.json();
        const exRes = await fetch(`/api/workouts/${workoutId}/exercises`);
        const exercises = exRes.ok ? await exRes.json() : [];
        return { workout, exercises, type: 'standalone' };
      }
      
      const progRes = await fetch(`/api/programme-workouts/${workoutId}`);
      if (!progRes.ok) throw new Error('Failed to fetch workout');
      const progData = await progRes.json();
      return { 
        workout: progData, 
        exercises: progData.blocks || [], 
        type: 'programme' 
      };
    },
    enabled: isAuthenticated && !!workoutId && !isPreviewMode,
    staleTime: 0,
  });

  const effectiveData = isPreviewMode ? previewData : workoutData;
  const workout = effectiveData?.workout;
  const exercises = effectiveData?.exercises || [];
  const exercisesLoading = false;
  const isVideoWorkoutType = workout?.workoutType === 'video';

  const { data: savedVideoProgress } = useQuery<any>({
    queryKey: ['/api/video-workout-progress', workoutId],
    enabled: isAuthenticated && !!workoutId && isVideoWorkoutType,
  });

  // Check for completed workout log - ONLY when navigating from completed tile (dashboard/calendar/history)
  const { data: completedWorkoutLog, isLoading: completedLogLoading, refetch: refetchCompletedLog } = useQuery<any>({
    queryKey: ['/api/workout-logs', completedLogId],
    queryFn: async () => {
      if (!completedLogId) return null;
      const response = await fetch(
        `/api/workout-logs/${completedLogId}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch completed log');
      return response.json();
    },
    enabled: isAuthenticated && isFromCompleted && !!completedLogId,
  });

  // Fetch the just-completed log when workout is completed via the rating dialog
  const { data: justCompletedLog, isLoading: justCompletedLogLoading } = useQuery<any>({
    queryKey: ['/api/workout-logs', justCompletedLogId],
    queryFn: async () => {
      if (!justCompletedLogId) return null;
      const response = await fetch(
        `/api/workout-logs/${justCompletedLogId}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch completed log');
      return response.json();
    },
    enabled: isAuthenticated && justCompletedWorkout && !!justCompletedLogId,
  });

  // Only show completed view when navigating from completed tile with a specific logId
  const isWorkoutCompleted = isFromCompleted && !!completedLogId && !completedLogLoading && !!completedWorkoutLog?.id;
  
  // Also show completed view when just completed a workout
  const showJustCompletedView = justCompletedWorkout && !!justCompletedLogId && !justCompletedLogLoading && !!justCompletedLog?.id;

  const handleWorkoutDeleted = () => {
    refetchCompletedLog();
    queryClient.invalidateQueries({ queryKey: ['/api/workout-logs/completed-by-workout', workoutId] });
  };

  const pendingScrollRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    pendingScrollRef.current = consumeScrollRestore(`/training/workout/${params?.id}`);
  }, [params?.id]);
  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    clearScrollRestore();
    requestAnimationFrame(() => window.scrollTo(0, y));
    const t = setTimeout(() => window.scrollTo(0, y), 200);
    return () => clearTimeout(t);
  }, [params?.id]);

  useEffect(() => {
    if (savedVideoProgress?.completed && !videoWatched) {
      setVideoWatched(true);
      setShowSaveButton(true);
    }
  }, [savedVideoProgress, videoWatched]);

  useEffect(() => {
    if (playerReady && savedVideoProgress && !savedProgressRestoredRef.current && !savedVideoProgress.completed) {
      const player = muxPlayerRef.current;
      if (player && savedVideoProgress.progressTime > 0) {
        player.currentTime = savedVideoProgress.progressTime;
        savedProgressRestoredRef.current = true;
      }
    }
  }, [playerReady, savedVideoProgress]);

  const handleLoadedMetadata = useCallback(() => {
    setPlayerReady(true);
  }, []);

  const saveVideoProgressMutation = useMutation({
    mutationFn: async (data: { progressTime: number; duration: number; completed?: boolean }) => {
      return apiRequest('POST', `/api/video-workout-progress/${workoutId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-workout-progress', workoutId] });
    },
  });

  const handleVideoTimeUpdate = useCallback((event: any) => {
    const player = event?.target;
    if (!player) return;
    
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;
    setVideoProgress(currentTime);
    if (duration > 0) setVideoDuration(duration);
  }, []);

  const handleVideoPlay = useCallback((event: any) => {
    if (!hasPlayedOnce) {
      setHasPlayedOnce(true);
      const player = event?.target;
      if (player) {
        if (player.requestFullscreen) {
          player.requestFullscreen().catch(() => {});
        } else if ((player as any).webkitRequestFullscreen) {
          (player as any).webkitRequestFullscreen();
        } else if ((player as any).webkitEnterFullscreen) {
          (player as any).webkitEnterFullscreen();
        }
      }
    }
  }, [hasPlayedOnce]);

  const handleVideoEnded = useCallback(() => {
    const player = muxPlayerRef.current;
    const duration = player?.duration || videoDuration || 0;
    setVideoWatched(true);
    setShowSaveButton(true);
    saveVideoProgressMutation.mutate({
      progressTime: duration,
      duration: duration,
      completed: true,
    });
  }, [saveVideoProgressMutation, videoDuration]);

  const handleSaveWorkout = useCallback(async () => {
    try {
      await saveVideoProgressMutation.mutateAsync({
        progressTime: videoDuration,
        duration: videoDuration,
        completed: true,
      });
      toast({
        title: "Workout Saved",
        description: "Great job completing this video workout!",
      });
      navigate("/training");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save workout progress",
        variant: "destructive",
      });
    }
  }, [navigate, toast, videoDuration, saveVideoProgressMutation]);

  const isBlockFormat = Array.isArray(exercises?.[0]?.exercises);
  const isIntervalWorkout = workout?.workoutType === 'interval';
  
  const getFlatExercises = (exerciseList: any[], type: string) => {
    const result: any[] = [];
    
    if (type === 'programme' || Array.isArray(exerciseList[0]?.exercises)) {
      // Separate warmup and main blocks for proper numbering
      const warmupBlocks = exerciseList.filter((b: any) => b.section === 'warmup' || b.section === 'warm_up');
      const mainBlocks = exerciseList.filter((b: any) => b.section !== 'warmup' && b.section !== 'warm_up');
      let position = 0;
      
      warmupBlocks.forEach((block: any) => {
        const blockExercises = block.exercises || [];
        blockExercises.forEach((ex: any) => {
          result.push({
            ...ex,
            blockType: block.blockType || 'single',
            blockGroupId: blockExercises.length > 1 ? `warmup-${block.id}` : null,
            section: 'warmup',
            position: position++,
            rest: block.rest || undefined,
          });
        });
      });
      
      const isIntervalWorkoutType = workout?.workoutType === 'interval';
      // Check if data already contains rest blocks (to avoid duplicating them)
      const hasExistingRestBlocks = mainBlocks.some((b: any) => b.blockType === 'rest');
      
      // Process blocks in order, keeping track of circuit number for non-rest blocks
      let circuitNumber = 0;
      
      mainBlocks.forEach((block: any) => {
        if (block.blockType === 'rest') {
          // Add rest block with proper kind field
          result.push({
            exerciseLibraryId: null,
            exerciseName: 'Rest',
            blockType: 'rest',
            blockGroupId: null,
            section: 'main',
            position: position++,
            rest: block.rest || '60 sec',
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
          blockExercises.forEach((ex: any) => {
            result.push({
              ...ex,
              blockType: block.blockType || 'single',
              blockGroupId: blockGroupId,
              section: 'main',
              position: position++,
              rest: block.rest || undefined,
            });
          });
          
          // For interval workouts without existing rest blocks, add rest after each circuit except the last
          // Get the remaining non-rest blocks to check if this is the last one
          const remainingExerciseBlocks = mainBlocks.slice(mainBlocks.indexOf(block) + 1).filter((b: any) => b.blockType !== 'rest');
          if (isIntervalWorkoutType && !hasExistingRestBlocks && remainingExerciseBlocks.length > 0) {
            const restDuration = block.restAfterCircuit || block.rest || '60 sec';
            result.push({
              exerciseLibraryId: null,
              exerciseName: 'Rest',
              blockType: 'rest',
              blockGroupId: null,
              section: 'main',
              position: position++,
              rest: restDuration,
              durationType: 'text',
              exerciseType: 'rest',
              sets: [],
              kind: 'rest',
              restDuration: typeof restDuration === 'string' ? parseInt(restDuration) || 60 : restDuration,
            });
          }
        }
      });
    } else {
      exerciseList.forEach((ex: any, index: number) => {
        result.push({
          ...ex,
          position: index,
        });
      });
    }
    
    return result;
  };

  const startWorkoutMutation = useMutation({
    mutationFn: async (mutationData: { workoutId: number; workoutType: string; workoutName: string; programmeId?: number; workoutStyle?: string; intervalRounds?: number | null; intervalRestAfterRound?: string | null }) => {
      const response = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mutationData),
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.message || 'Failed to start workout') as any;
        error.activeLogId = data.activeLogId;
        throw error;
      }
      return data;
    },
    onSuccess: async (data) => {
      const flatExercises = getFlatExercises(exercises, workoutData?.type || 'standalone');
      
      for (const exercise of flatExercises) {
        await apiRequest('POST', `/api/workout-logs/${data.id}/exercises`, {
          exerciseLibraryId: exercise.exerciseLibraryId,
          exerciseName: exercise.exerciseName || exercise.name,
          blockType: exercise.blockType || 'single',
          blockGroupId: exercise.blockGroupId || null,
          section: exercise.section || 'main',
          position: exercise.position || 0,
          restPeriod: exercise.rest || undefined,
          durationType: exercise.durationType || 'text',
          exerciseType: exercise.exerciseType || 'strength',
          sets: exercise.sets || [{ reps: '8-12' }],
          kind: exercise.kind || undefined,
          restDuration: exercise.restDuration || undefined,
        });
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

  // Complete video workout mutation - creates log and immediately completes it
  const completeVideoWorkoutMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!workout || !workoutId) throw new Error("No workout");
      
      // Step 1: Create the workout log
      const logResponse = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workoutId,
          workoutType: workoutData?.type === 'programme' ? 'programme' : 'individual',
          workoutName: workout.title || workout.name,
          workoutStyle: 'video',
        }),
      });
      
      if (!logResponse.ok) {
        const error = await logResponse.json();
        throw new Error(error.message || 'Failed to create workout log');
      }
      
      const logData = await logResponse.json();
      
      // Step 2: Immediately complete the workout
      await apiRequest('POST', `/api/workout-logs/${logData.id}/complete`, {
        workoutRating: rating,
      });
      
      // Return the log ID so we can fetch the completed log
      return { logId: logData.id };
    },
    onSuccess: (data) => {
      setShowCompleteVideoDialog(false);
      setJustCompletedWorkout(true);
      setJustCompletedLogId(data.logId);
      refetchCompletedLog();
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs/timeline'] });
      toast({
        title: "Workout Complete!",
        description: "Great job completing your video workout!",
      });
    },
    onError: (error: any) => {
      setShowCompleteVideoDialog(false);
      toast({
        title: "Error",
        description: error.message || "Failed to complete workout",
        variant: "destructive",
      });
    },
  });

  const hasActiveProgramme = !!timeline?.current;
  const activeProgrammeName = timeline?.current?.programTitle;

  const { data: bookmarks = [] } = useQuery<any[]>({
    queryKey: ["/api/bookmarks"],
    enabled: isAuthenticated,
  });

  const isWorkoutSaved = workoutId ? bookmarks.some((b: any) => b.contentType === 'workout' && b.contentId === workoutId) : false;

  const saveBookmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", "/api/bookmarks", {
        contentType: "workout",
        contentId: id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Saved", description: "Workout saved." });
    },
  });

  const unsaveBookmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/bookmarks/workout/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Removed", description: "Workout removed from saved." });
    },
  });

  const toggleBookmark = () => {
    if (!workoutId) return;
    if (isWorkoutSaved) {
      unsaveBookmarkMutation.mutate(workoutId);
    } else {
      saveBookmarkMutation.mutate(workoutId);
    }
  };

  // Move workout mutation
  const moveWorkoutMutation = useMutation({
    mutationFn: async (newDate: string) => {
      if (!scheduledWorkoutId) {
        throw new Error("Cannot move this workout - it's part of your programme schedule");
      }
      return apiRequest('PATCH', `/api/scheduled-workouts/${scheduledWorkoutId}/move`, { newDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
      toast({
        title: "Workout Moved",
        description: `Workout moved to ${newMoveDate ? formatDate(new Date(newMoveDate), 'full') : 'new date'}`,
      });
      setShowMoveDialog(false);
      navigate('/calendar');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move workout",
        variant: "destructive",
      });
    },
  });

  const handleStartWorkout = () => {
    if (!workout || !workoutId) return;
    
    // If user has an active programme and this is a standalone workout, show warning
    if (hasActiveProgramme && workoutData?.type !== 'programme') {
      setShowProgrammeWarning(true);
      return;
    }
    
    proceedWithStartWorkout();
  };

  const proceedWithStartWorkout = () => {
    if (!workout || !workoutId) return;
    
    startWorkoutMutation.mutate({
      workoutId,
      workoutType: workoutData?.type === 'programme' ? 'programme' : 'individual',
      workoutName: workout.title || workout.name,
      workoutStyle: workout.workoutType || 'regular',
      intervalRounds: workout.intervalRounds || null,
      intervalRestAfterRound: workout.intervalRestAfterRound || null,
    });
  };

  const isVideoWorkout = workout?.workoutType === 'video';
  const isStandaloneWorkout = workoutData?.type === 'standalone';
  // Show Start Now for standalone workouts, OR when the user arrived via a
  // calendar-scheduled instance (a one-off scheduled programme workout from
  // the home dash today tile or calendar). Video workouts have their own flow.
  const canStartWorkout = (isStandaloneWorkout || isFromCalendar) && !isVideoWorkout;

  if (isLoading || exercisesLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Workout not found</p>
      </div>
    );
  }

  const isCircuitWorkout = workout.workoutType === 'circuit';
  const circuitRounds = workout.intervalRounds || workout.circuitRounds || 3;

  // Equipment icon mapping
  const equipmentIcons: Record<string, string> = {
    'Bodyweight': '💪',
    'Body Weight': '💪',
    'Mat': '🧘',
    'Yoga Mat': '🧘',
    'Dumbbell': '🏋️',
    'Dumbbells': '🏋️',
    'Barbell': '🏋️',
    'Kettlebell': '🔔',
    'Resistance Band': '🔗',
    'Band': '🔗',
    'Short Band': '🔗',
    'Long Band': '🔗',
    'Mini Band': '🔗',
    'Bench': '🪑',
    'Box/Step': '📦',
    'Box': '📦',
    'Step': '📦',
    'Cable Machine': '⚙️',
    'Cable': '⚙️',
    'Machine': '⚙️',
    'Pull-up Bar': '🔩',
    'Pullup Bar': '🔩',
    'TRX': '🪢',
    'Suspension Trainer': '🪢',
    'Foam Roller': '🛢️',
    'Swiss Ball': '⚪',
    'Stability Ball': '⚪',
    'Medicine Ball': '🏀',
    'Med Ball': '🏀',
    'Sliders': '📊',
    'Slider': '📊',
    'Jump Rope': '🪢',
    'Wall': '🧱',
    'Chair': '🪑',
  };

  // Extract unique equipment from all exercises
  const extractEquipment = (): string[] => {
    const equipmentSet = new Set<string>();
    
    const addEquipment = (ex: any) => {
      // Handle both 'equipment' and 'exerciseEquipment' field names
      const equipmentArray = ex.equipment || ex.exerciseEquipment;
      if (equipmentArray && Array.isArray(equipmentArray)) {
        equipmentArray.forEach((eq: string) => equipmentSet.add(eq));
      }
    };
    
    if (isBlockFormat) {
      exercises.forEach((block: any) => {
        (block.exercises || []).forEach(addEquipment);
      });
    } else {
      exercises.forEach(addEquipment);
    }
    
    return Array.from(equipmentSet);
  };

  const workoutEquipment = extractEquipment();

  const totalExerciseCount = isBlockFormat 
    ? exercises.reduce((total: number, block: any) => total + (block.exercises?.length || 0), 0)
    : exercises?.length || 0;

  const estimatedDuration = workout.estimatedDuration || calculateWorkoutDuration({
    workoutType: workout.workoutType,
    exercises: exercises,
    blocks: exercises[0]?.exercises ? exercises : undefined,
    circuitRounds: circuitRounds,
    intervalRounds: workout.intervalRounds,
  }) || (exercises?.length || 0) * 2;

  const handleScheduleClick = () => {
    setShowScheduleDialog(true);
  };

  const handleMoveWorkout = () => {
    setShowMoveDialog(true);
  };

  const getHeaderTitle = () => {
    if (isFromCompleted && completedWorkoutLog?.completedAt) {
      return formatDate(new Date(completedWorkoutLog.completedAt), 'short');
    }
    if (isFromCalendar && scheduledDate) {
      return formatDate(scheduledDate, 'short');
    }
    return undefined;
  };

  const getHeaderMenu = () => {
    if (isWorkoutCompleted) {
      return (
        <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background border-t border-muted">
            <div className="py-4 px-4">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
              <div className="space-y-2">
                {!isVideoWorkoutType && (
                  <button
                    className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowEditLogMode(true);
                    }}
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
                >
                  Delete
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      );
    }
    if (isFromCalendar) {
      return (
        <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background border-t border-muted">
            <div className="py-4 px-4">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
              <div className="space-y-2">
                <button
                  className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={() => {
                    setShowActionSheet(false);
                    handleMoveWorkout();
                  }}
                >
                  Move To Another Day
                </button>
                <button
                  className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={async () => {
                    setShowActionSheet(false);
                    if (!workout) return;

                    const uid = (currentUser as any)?.id;
                    const isOwner = (workout as any).userId && (workout as any).userId === uid;
                    const returnUrl = window.location.pathname + window.location.search;
                    const wType = (workout as any).workoutType || 'regular';

                    const goToEditor = (id: number) => {
                      sessionStorage.removeItem('wodExercises');
                      navigate(`/build-wod?type=${wType}&editWorkoutId=${id}&from=${encodeURIComponent(returnUrl)}`, { replace: true });
                    };

                    // Owner editing their own personal workout: edit in place
                    if (isOwner) {
                      goToEditor(workout.id);
                      return;
                    }

                    // Library workout (or anyone else's): fork into user's library, repoint schedule, then edit the copy
                    try {
                      toast({ title: "Creating your copy..." });
                      const res = await apiRequest('POST', `/api/workouts/${workout.id}/fork`, {
                        scheduledWorkoutId: scheduledWorkoutId || undefined,
                      });
                      const forked = await res.json();
                      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/today-workouts'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
                      goToEditor(forked.id);
                    } catch (err: any) {
                      console.error('Fork failed:', err);
                      toast({ title: "Couldn't start edit", description: err?.message || "Please try again", variant: "destructive" });
                    }
                  }}
                >
                  Edit This Workout
                </button>
                {scheduledWorkoutId && (
                  <button
                    className="w-full text-left py-4 px-2 text-destructive text-lg hover:bg-muted/50 rounded-lg transition-colors"
                    onClick={async () => {
                      setShowActionSheet(false);
                      if (confirm('Remove this workout from your calendar?')) {
                        try {
                          await apiRequest('DELETE', `/api/scheduled-workouts/${scheduledWorkoutId}`);
                          queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/today-workout'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/today-workouts'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
                          toast({ title: "Removed from calendar" });
                          navigate('/');
                        } catch {
                          toast({ title: "Failed to remove", variant: "destructive" });
                        }
                      }
                    }}
                  >
                    Remove From Calendar
                  </button>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      );
    }
    if (workout?.sourceType === 'user') {
      return (
        <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background border-t border-muted">
            <div className="py-4 px-4">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
              <div className="space-y-2">
                <button
                  className="w-full text-left py-4 px-2 text-destructive text-lg hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={async () => {
                    setShowActionSheet(false);
                    if (confirm('Delete this saved workout?')) {
                      try {
                        await apiRequest('DELETE', `/api/workouts/mine/${workoutId}`);
                        queryClient.invalidateQueries({ queryKey: ['/api/workouts/mine'] });
                        toast({ title: "Workout deleted" });
                        navigate('/training?tab=workouts');
                      } catch {
                        toast({ title: "Failed to delete workout", variant: "destructive" });
                      }
                    }
                  }}
                >
                  Delete Workout
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      );
    }
    return undefined;
  };

  // Handler for closing after just completing a workout
  const handleCloseJustCompleted = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background relative">
      {showJustCompletedView ? (
        // Special header with X button after just completing a workout
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={handleCloseJustCompleted}
              className="text-foreground hover:text-muted-foreground transition-colors p-2"
              data-testid="button-close-just-completed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-foreground">Workout Complete</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>
      ) : (
        <TopHeader 
          onBack={handleBack}
          title={getHeaderTitle()}
          rightActionLabel={isPreviewMode ? undefined : isFromProgrammeBuilder ? "Add" : (isFromCalendar || isFromCompleted) ? undefined : "Schedule"}
          rightActionIcon={isPreviewMode ? undefined : isFromProgrammeBuilder ? <Plus className="h-4 w-4" /> : (isFromCalendar || isFromCompleted) ? undefined : <Calendar className="h-4 w-4" />}
          onRightAction={isPreviewMode ? undefined : isFromProgrammeBuilder ? handleAddToProgramme : (isFromCalendar || isFromCompleted) ? undefined : handleScheduleClick}
          rightMenuButton={(isFromProgrammeBuilder || isPreviewMode) ? undefined :
            <>
              {!isFromCalendar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-muted"
                  onClick={toggleBookmark}
                >
                  <Bookmark className={`h-4 w-4 transition-colors ${
                    isWorkoutSaved ? 'fill-[#0cc9a9] text-[#0cc9a9]' : ''
                  }`} />
                </Button>
              )}
              {getHeaderMenu()}
            </>
          }
        />
      )}

      <div className="pt-16 pb-40 max-w-4xl mx-auto">
        
        <div className="px-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">{workout.title || workout.name}</h1>
          
          {(isWorkoutCompleted || showJustCompletedView) ? (
            <WorkoutCompletionView 
              workoutLog={showJustCompletedView ? justCompletedLog : completedWorkoutLog}
              onDelete={handleWorkoutDeleted}
            />
          ) : (
          <>
          <div className="border-t border-gray-200 dark:border-gray-700" />

          <div className="flex items-center gap-2 text-muted-foreground py-2">
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
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Duration: est. {estimatedDuration} minutes</span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Dumbbell className="h-4 w-4" />
            <span className="text-sm">{totalExerciseCount} Exercises</span>
          </div>
          </>
          )}
        </div>

        {!isWorkoutCompleted && !showJustCompletedView && (
        <>
        <div className="mx-6 border-t border-gray-200 dark:border-gray-700 mb-2" />

        <div className="mb-2 px-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Equipment:</h3>
          <div className="flex flex-wrap gap-2">
            {workoutEquipment.length > 0 ? (
              workoutEquipment.map((eq) => {
                const displayName: Record<string, string> = {
                  'Bodyweight': 'Body\nWeight',
                  'Body Weight': 'Body\nWeight',
                  'Foam Roller': 'Foam\nRoller',
                  'Pull Up Bar': 'Pull Up\nBar',
                  'Resistance Bands': 'Resistance\nBands',
                  'Cable Machine': 'Cable\nMachine',
                  'Swiss Ball': 'Swiss\nBall',
                  'Medicine Ball': 'Medicine\nBall',
                  'Kettlebell': 'Kettle\nbell',
                  'TRX': 'TRX',
                };
                const label = displayName[eq] || eq;
                return (
                  <div key={eq} className="flex flex-col items-center gap-1 w-14">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-lg shadow-sm">{equipmentIcons[eq] || '🔧'}</div>
                    <span className="text-[10px] text-center text-muted-foreground leading-tight whitespace-pre-line">{label}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground">No equipment required</span>
            )}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 mt-4" />
        </div>

        {isVideoWorkout && workout.muxPlaybackId && workout.muxPlaybackId.length >= 10 && (
          <div className="px-6 mb-6">
            <Separator className="mb-4 opacity-30" />
            <h3 className="text-sm font-bold text-black uppercase tracking-wide px-5 py-2 bg-primary rounded-full inline-block mb-4">Workout Video</h3>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <MuxPlayer
                ref={muxPlayerRef}
                playbackId={workout.muxPlaybackId}
                streamType="on-demand"
                style={{ width: '100%', height: '100%' }}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handleVideoPlay}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                data-testid="video-workout-player"
              />
            </div>
            {videoWatched && (
              <div className="mt-3 text-center">
                <span className="text-sm text-green-500 font-medium">Video completed!</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 mb-8 px-3">
          {exercises && exercises.length > 0 ? (
            (() => {
              const isBlockFormat = Array.isArray(exercises[0]?.exercises);
              
              if (isBlockFormat) {
                const warmupBlocks = exercises.filter((b: any) => b.section === 'warmup' || b.section === 'warm_up');
                const allMainBlocks = exercises.filter((b: any) => b.section !== 'warmup' && b.section !== 'warm_up');
                // Filter out REST blocks for circuit/interval rendering - they should be rendered separately
                const mainBlocks = allMainBlocks.filter((b: any) => b.blockType !== 'rest');
                const restBlocks = allMainBlocks.filter((b: any) => b.blockType === 'rest');
                
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
                    const showRest = isCircuitWorkout 
                      ? (isLastBlock && isLastExercise)
                      : isLastExercise;
                    
                    const blockRounds = block.rounds || 3;
                    // Get rest from exercise sets first, then fall back to block rest
                    const exerciseRestFromSets = exercise.sets?.[0]?.rest;
                    const restValue = isIntervalWorkout 
                      ? block.restAfterRound 
                      : (exerciseRestFromSets && exerciseRestFromSets !== 'No Rest' && exerciseRestFromSets !== 'none' 
                          ? exerciseRestFromSets 
                          : (block.rest && block.rest !== '60 sec' && block.rest !== 'No Rest' && block.rest !== 'none' ? block.rest : undefined));
                    return (
                      <ExerciseCard 
                        key={`${section}-${block.id}-${exercise.id}`}
                        exercise={{
                          ...exercise,
                          name: exercise.exerciseName,
                          rest: showRest ? restValue : undefined,
                        }}
                        index={exIdx}
                        label={label}
                        workoutId={`/training/workout/${workoutId}`}
                        circuitRounds={section === 'main' ? (isIntervalWorkout ? blockRounds : (isCircuitWorkout ? circuitRounds : undefined)) : undefined}
                        isIntervalWorkout={isIntervalWorkout && section === 'main'}
                      />
                    );
                  });
                  
                  if (isMultiExercise) {
                    const cardsWithLabels: JSX.Element[] = [];
                    const blockSetCount = (() => {
                      if (isCircuitWorkout || isIntervalWorkout) return circuitRounds;
                      const firstEx = blockExercises[0];
                      if (firstEx?.sets && Array.isArray(firstEx.sets)) return firstEx.sets.length;
                      return parseInt(firstEx?.sets) || 0;
                    })();
                    const blockTypeLabel = (isCircuitWorkout || isIntervalWorkout) ? 'CIRCUIT' : (
                      block.blockType === 'superset' ? 'SUPERSET' :
                      block.blockType === 'triset' ? 'TRISET' :
                      block.blockType === 'circuit' ? 'CIRCUIT' : block.blockType?.toUpperCase() || 'CIRCUIT'
                    );
                    const connectorLabel = blockSetCount > 0 
                      ? `${blockTypeLabel} OF ${blockSetCount} ${(isCircuitWorkout || isIntervalWorkout) ? (blockSetCount === 1 ? 'ROUND' : 'ROUNDS') : (blockSetCount === 1 ? 'SET' : 'SETS')}`
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
                          <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg mx-3">
                            <p className="text-foreground font-medium">
                              Perform as a circuit workout of {circuitRounds} rounds
                            </p>
                          </div>
                        )}
                        {isIntervalWorkout ? (
                          (() => {
                            // Sort all main blocks by position to interleave REST blocks properly
                            const sortedBlocks = [...allMainBlocks].sort((a, b) => (a.position || 0) - (b.position || 0));
                            let circuitIndex = 0;
                            
                            return sortedBlocks.map((block: any, idx: number) => {
                              // Render REST blocks as compact cards
                              if (block.blockType === 'rest') {
                                const restDuration = block.rest;
                                return (
                                  <div key={block.id || `rest-${idx}`} className="mt-4">
                                    <div className="bg-card border border-border rounded-lg py-3 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                          <Clock className="w-4 h-4 text-primary" />
                                        </div>
                                        <p className="font-medium text-foreground text-sm">REST</p>
                                        {restDuration && <p className="text-sm text-muted-foreground">{restDuration}</p>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Render circuit blocks with header and repeat indicator
                              circuitIndex++;
                              const blockRounds = block.rounds || 3;
                              const isLastCircuit = circuitIndex === mainBlocks.length;
                              
                              return (
                                <div key={block.id || idx} className="space-y-4">
                                  <div className="bg-primary/10 border-l-4 border-primary p-4 rounded-r-lg mx-3">
                                    <p className="text-foreground font-medium">
                                      Circuit of {blockRounds} rounds
                                    </p>
                                  </div>
                                  {renderBlock(block, 'main', circuitIndex, isLastCircuit)}
                                  <div className="flex items-center gap-2 text-muted-foreground px-3 pt-2">
                                    <span className="text-lg">🔄</span>
                                    <span className="text-sm">Repeat for {blockRounds} rounds</span>
                                  </div>
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <>
                            {mainBlocks.map((block: any, idx: number) => renderBlock(block, 'main', idx + 1, idx === mainBlocks.length - 1))}
                            {isCircuitWorkout && (
                              <div className="flex items-center gap-2 text-muted-foreground px-3 pt-2">
                                <span className="text-lg">🔄</span>
                                <span className="text-sm">Repeat for {circuitRounds} rounds</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                );
              }
              
              return exercises.map((exercise: any, idx: number) => (
                <ExerciseCard 
                  key={`${exercise.id}-${idx}`}
                  exercise={exercise}
                  index={idx}
                  workoutId={`/training/workout/${workoutId}`}
                  circuitRounds={isCircuitWorkout ? circuitRounds : undefined}
                />
              ));
            })()
          ) : (
            <p className="text-muted-foreground text-sm">No exercises in this workout</p>
          )}
        </div>
        </>
        )}

      </div>

      {canStartWorkout && !isFromProgrammeBuilder && !completedLogLoading && !isWorkoutCompleted && !showJustCompletedView && (
        <Button 
          onClick={handleStartWorkout}
          disabled={startWorkoutMutation.isPending}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-48 bg-primary hover:opacity-90 text-white rounded-full py-3 text-base font-semibold shadow-xl z-50"
          data-testid="button-start-workout"
        >
          {startWorkoutMutation.isPending ? 'Starting...' : 'START NOW'}
        </Button>
      )}

      {isVideoWorkout && !isFromProgrammeBuilder && showSaveButton && !showJustCompletedView && (
        <Button 
          onClick={handleSaveWorkout}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-48 bg-[#0cc9a9] hover:bg-teal-600 text-black rounded-full py-3 text-base font-semibold shadow-xl z-50"
          data-testid="button-save-video-workout"
        >
          <Save className="w-5 h-5 mr-2" />
          SAVE WORKOUT
        </Button>
      )}

      {isVideoWorkout && !isFromProgrammeBuilder && !completedLogLoading && !isWorkoutCompleted && !showJustCompletedView && (
        <Button 
          onClick={() => setShowCompleteVideoDialog(true)}
          disabled={completeVideoWorkoutMutation.isPending}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-48 bg-primary hover:opacity-90 text-white rounded-full py-3 text-base font-semibold shadow-xl z-50"
          data-testid="button-complete-video-workout"
        >
          {completeVideoWorkoutMutation.isPending ? 'Completing...' : 'COMPLETE'}
        </Button>
      )}

      {/* Complete Video Workout Rating Dialog */}
      <WorkoutRatingDialog
        open={showCompleteVideoDialog}
        onComplete={(rating) => completeVideoWorkoutMutation.mutate(rating)}
        isPending={completeVideoWorkoutMutation.isPending}
      />

      {/* Move To Another Day Dialog */}
      {scheduledWorkoutId && (
        <MoveWorkoutCalendar
          open={showMoveDialog}
          onOpenChange={setShowMoveDialog}
          scheduledWorkoutId={scheduledWorkoutId}
          workoutName={workout?.title || workout?.name || 'Workout'}
          currentDate={scheduledDateStr || format(new Date(), 'yyyy-MM-dd')}
        />
      )}

      {/* Warning dialog when user has an active programme */}
      <AlertDialog open={showProgrammeWarning} onOpenChange={setShowProgrammeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Programme Detected</AlertDialogTitle>
            <AlertDialogDescription>
              You currently have an active programme: <strong>{activeProgrammeName}</strong>. 
              Starting this standalone workout will not count towards your programme progress. 
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowProgrammeWarning(false);
              proceedWithStartWorkout();
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Log Confirmation Dialog */}
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
                  if (completedLogId) {
                    await apiRequest('DELETE', `/api/workout-logs/${completedLogId}`);
                    toast({
                      title: "Workout Deleted",
                      description: "The workout log has been removed.",
                    });
                    queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/my-progress'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/my-programs/timeline'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/scheduled-workouts'] });
                    navigate('/');
                  }
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

      {/* Schedule Workout Dialog */}
      {workoutId && (
        <ScheduleWorkoutDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          workoutId={workoutId}
          workoutName={workout?.title || workout?.name || 'Workout'}
        />
      )}
    </div>
  );
}
