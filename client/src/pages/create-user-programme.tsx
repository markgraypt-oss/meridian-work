import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Dumbbell, X, Edit2, Copy, ChevronLeft, Search, Eye, Clock, ChevronDown, ChevronUp, Heart, Pencil, ImagePlus
} from "lucide-react";
import { getMuxThumbnailUrl } from "@/lib/mux";

const GOALS = [
  { value: "strength", label: "Strength" },
  { value: "max_strength", label: "Max Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "power", label: "Power" },
  { value: "functional_strength", label: "Functional Strength" },
  { value: "conditioning", label: "Conditioning" },
  { value: "hiit", label: "HIIT" },
  { value: "mobility", label: "Mobility" },
  { value: "corrective", label: "Corrective" },
  { value: "yoga", label: "Yoga" },
];

const EQUIPMENT = [
  { value: "full_gym", label: "Full Gym" },
  { value: "home_gym", label: "Home Gym" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "db_bench_only", label: "Dumbbells & Bench" },
  { value: "bands_only", label: "Bands Only" },
  { value: "kettlebell_only", label: "Kettlebell Only" },
  { value: "no_equipment", label: "No Equipment" },
];

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const DAY_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

interface ExerciseSet {
  reps: string;
  duration?: string;
}

interface BlockExercise {
  id: string;
  exerciseLibraryId: number | null;
  exerciseName: string;
  imageUrl?: string;
  muxPlaybackId?: string | null;
  sets: ExerciseSet[];
  tempo?: string;
  load?: string;
  notes?: string;
}

interface WorkoutBlock {
  id: string;
  blockType: "single" | "superset" | "triset";
  section: "warmup" | "main";
  rest: string;
  exercises: BlockExercise[];
}

interface WorkoutData {
  id?: number;
  name: string;
  description?: string;
  category: string;
  difficulty: string;
  duration: number;
  blocks: WorkoutBlock[];
}

interface DayWorkout {
  dayPosition: number;
  workout: WorkoutData;
}

interface WeekSchedule {
  weekNumber: number;
  days: DayWorkout[];
}

export default function CreateUserProgramme() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEditing = !!params.id;
  const programId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState({
    title: "",
    description: "",
    goal: "general_strength",
    equipment: "full_gym",
    weeks: "4",
    difficulty: "intermediate",
    imageUrl: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const [schedule, setSchedule] = useState<WeekSchedule[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [showAddWorkoutScreen, setShowAddWorkoutScreen] = useState(false);
  const [addWorkoutDayTarget, setAddWorkoutDayTarget] = useState<number | null>(null);
  const [showWorkoutActionMenu, setShowWorkoutActionMenu] = useState(false);
  const [actionMenuDayTarget, setActionMenuDayTarget] = useState<number | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<string>("workouts");
  const [workoutSearchQuery, setWorkoutSearchQuery] = useState("");
  const [workoutSourceTab, setWorkoutSourceTab] = useState<"library" | "saved" | "mine">("library");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: exercises = [] } = useQuery<any[]>({
    queryKey: ["/api/exercises"],
    retry: false,
  });

  const { data: libraryWorkouts = [] } = useQuery<any[]>({
    queryKey: ["/api/workouts"],
  });

  const { data: savedWorkouts = [] } = useQuery<any[]>({
    queryKey: ["/api/favorites/workouts"],
  });

  const { data: myWorkouts = [] } = useQuery<any[]>({
    queryKey: ["/api/workouts/mine"],
  });

  const { data: existingProgram } = useQuery<any>({
    queryKey: ["/api/user-programmes", programId],
    enabled: isEditing && !!programId,
    queryFn: async () => {
      const res = await fetch(`/api/user-programmes/${programId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load programme");
      return res.json();
    },
  });

  const { data: existingSchedule } = useQuery<any[]>({
    queryKey: ["/api/user-programmes", programId, "schedule"],
    enabled: isEditing && !!programId,
    queryFn: async () => {
      const res = await fetch(`/api/user-programmes/${programId}/schedule`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
  });

  useEffect(() => {
    if (existingProgram && isEditing) {
      setMeta({
        title: existingProgram.title || "",
        description: existingProgram.description || "",
        goal: existingProgram.goal || "general_strength",
        equipment: existingProgram.equipment || "full_gym",
        weeks: String(existingProgram.weeks || 4),
        difficulty: existingProgram.difficulty || "intermediate",
        imageUrl: existingProgram.imageUrl || "",
      });
      setStep(2);
    }
  }, [existingProgram, isEditing]);

  useEffect(() => {
    if (existingSchedule && isEditing) {
      const parsed: WeekSchedule[] = existingSchedule.map((week: any) => ({
        weekNumber: week.weekNumber,
        days: (week.days || []).flatMap((day: any) =>
          (day.workouts || []).map((w: any) => ({
            dayPosition: day.position,
            workout: {
              id: w.id,
              name: w.name,
              description: w.description || "",
              category: w.category || "strength",
              difficulty: w.difficulty || "beginner",
              duration: w.duration || 30,
              blocks: (w.blocks || []).map((b: any) => ({
                id: `block-${b.id}`,
                blockType: b.blockType || "single",
                section: b.section || "main",
                rest: b.rest || null,
                exercises: (b.exercises || []).map((ex: any) => ({
                  id: `ex-${ex.id}`,
                  exerciseLibraryId: ex.exerciseLibraryId,
                  exerciseName: exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.name || "Exercise",
                  imageUrl: exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.imageUrl,
                  sets: Array.isArray(ex.sets) ? ex.sets : [{ reps: "10" }],
                  tempo: ex.tempo || "",
                  load: ex.load || "",
                  notes: ex.notes || "",
                })),
              })),
            },
          }))
        ),
      }));
      setSchedule(parsed);
    }
  }, [existingSchedule, isEditing, exercises]);

  useEffect(() => {
    if (!isEditing && step === 2 && schedule.length === 0) {
      const weekCount = parseInt(meta.weeks) || 4;
      const newSchedule: WeekSchedule[] = [];
      for (let w = 1; w <= weekCount; w++) {
        newSchedule.push({ weekNumber: w, days: [] });
      }
      setSchedule(newSchedule);
    }
  }, [step, meta.weeks, isEditing]);

  useEffect(() => {
    const savedState = sessionStorage.getItem('programmeBuilderState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.meta) setMeta(parsed.meta);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.activeWeek) setActiveWeek(parsed.activeWeek);
        setStep(2);
      } catch {}
      sessionStorage.removeItem('programmeBuilderState');

      const shouldShowAddWorkout = sessionStorage.getItem('programmeBuilderShowAddWorkout');
      const dayTargetStr = sessionStorage.getItem('programmeBuilderDayTarget');
      if (shouldShowAddWorkout === 'true' && dayTargetStr) {
        setAddWorkoutDayTarget(parseInt(dayTargetStr));
        setShowAddWorkoutScreen(true);
        sessionStorage.removeItem('programmeBuilderShowAddWorkout');
      }
    }
  }, []);

  useEffect(() => {
    const workoutData = sessionStorage.getItem('programmeWorkoutData');
    if (workoutData && exercises.length > 0) {
      try {
        const parsed = JSON.parse(workoutData);
        const dayPosition = parsed.day;
        const wodExercises = parsed.exercises || [];

        const blockMap = new Map<string, any[]>();
        const singleExercises: any[] = [];

        for (const ex of wodExercises) {
          if (ex.kind === 'rest') continue;
          if (ex.blockGroupId) {
            if (!blockMap.has(ex.blockGroupId)) blockMap.set(ex.blockGroupId, []);
            blockMap.get(ex.blockGroupId)!.push(ex);
          } else {
            singleExercises.push(ex);
          }
        }

        const blocks: WorkoutBlock[] = [];

        for (const ex of singleExercises) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            blockType: "single",
            section: ex.section || "main",
            rest: ex.restPeriod || "60 sec",
            exercises: [{
              id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              exerciseLibraryId: ex.exerciseLibraryId,
              exerciseName: ex.exerciseName,
              imageUrl: ex.imageUrl || undefined,
              sets: Array.from({ length: ex.setsCount || 3 }, () => ({ reps: ex.targetReps || "10" })),
              tempo: "",
              load: "",
              notes: "",
            }],
          });
        }

        for (const [, groupExercises] of Array.from(blockMap)) {
          const first = groupExercises[0];
          blocks.push({
            id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            blockType: first.blockType || "superset",
            section: first.section || "main",
            rest: first.restPeriod || "60 sec",
            exercises: groupExercises.map((ex: any) => ({
              id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              exerciseLibraryId: ex.exerciseLibraryId,
              exerciseName: ex.exerciseName,
              imageUrl: ex.imageUrl || undefined,
              sets: Array.from({ length: ex.setsCount || 3 }, () => ({ reps: ex.targetReps || "10" })),
              tempo: "",
              load: "",
              notes: "",
            })),
          });
        }

        const newWorkout: WorkoutData = {
          name: `${DAY_LABELS[dayPosition]} Workout`,
          description: "",
          category: "strength",
          difficulty: "intermediate",
          duration: 45,
          blocks,
        };

        setSchedule((prev) => {
          const updated = [...prev];
          const weekIdx = updated.findIndex((w) => w.weekNumber === activeWeek);
          if (weekIdx === -1) return prev;
          const existingIdx = updated[weekIdx].days.findIndex((d) => d.dayPosition === dayPosition);
          if (existingIdx >= 0) {
            updated[weekIdx].days[existingIdx].workout = newWorkout;
          } else {
            updated[weekIdx].days.push({ dayPosition, workout: newWorkout });
          }
          return updated;
        });
      } catch {}
      sessionStorage.removeItem('programmeWorkoutData');
    }
  }, [exercises]);

  useEffect(() => {
    const selectedId = sessionStorage.getItem('selectedWorkoutId');
    const dayTargetStr = sessionStorage.getItem('programmeBuilderDayTarget');
    if (selectedId && dayTargetStr && exercises.length > 0) {
      const dayPosition = parseInt(dayTargetStr);
      const workoutId = parseInt(selectedId);
      sessionStorage.removeItem('selectedWorkoutId');
      sessionStorage.removeItem('selectedWorkoutData');
      sessionStorage.removeItem('programmeBuilderDayTarget');

      (async () => {
        try {
          const blocksRes = await fetch(`/api/workouts/${workoutId}/blocks`, { credentials: "include" });
          const blocksJson = blocksRes.ok ? await blocksRes.json() : { blocks: [] };
          const blocksData = Array.isArray(blocksJson) ? blocksJson : (blocksJson.blocks || []);
          const workoutInfo = blocksJson.workout || {};

          const importedBlocks: WorkoutBlock[] = (blocksData || []).map((b: any) => ({
            id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            blockType: b.blockType || "single",
            section: b.section || "main",
            rest: b.rest || "60 sec",
            exercises: (b.exercises || []).map((ex: any) => ({
              id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              exerciseLibraryId: ex.exerciseLibraryId,
              exerciseName: ex.exerciseName || exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.name || "Exercise",
              imageUrl: ex.imageUrl || exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.imageUrl,
              muxPlaybackId: ex.muxPlaybackId,
              sets: Array.isArray(ex.sets) ? ex.sets : [{ reps: "10" }],
              tempo: ex.tempo || "",
              load: ex.load || "",
              notes: ex.notes || "",
            })),
          }));

          const importedWorkout: WorkoutData = {
            id: workoutId,
            name: workoutInfo.title || workoutInfo.name || "Workout",
            description: workoutInfo.description || "",
            category: workoutInfo.category || "strength",
            difficulty: workoutInfo.difficulty || "intermediate",
            duration: workoutInfo.duration || 45,
            blocks: importedBlocks,
          };

          setSchedule((prev) => {
            const updated = [...prev];
            const weekIdx = updated.findIndex((w) => w.weekNumber === activeWeek);
            if (weekIdx === -1) return prev;
            const existingIdx = updated[weekIdx].days.findIndex((d) => d.dayPosition === dayPosition);
            if (existingIdx >= 0) {
              updated[weekIdx].days[existingIdx].workout = importedWorkout;
            } else {
              updated[weekIdx].days.push({ dayPosition, workout: importedWorkout });
            }
            return updated;
          });
          setShowAddWorkoutScreen(false);
        } catch {}
      })();
    }
  }, [exercises]);

  const getTrainingDaysPerWeek = () => {
    if (schedule.length === 0) return 0;
    const totalDays = schedule.reduce((sum, week) => sum + week.days.length, 0);
    return Math.round(totalDays / schedule.length);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...meta, trainingDaysPerWeek: getTrainingDaysPerWeek() };
      const res = await apiRequest("POST", "/api/user-programmes", payload);
      return res.json();
    },
    onSuccess: async (program: any) => {
      await saveWorkoutsToProgram(program.id);
      queryClient.invalidateQueries({ queryKey: ["/api/user-programmes"] });
      toast({ title: "Programme created!", description: "Your custom programme is ready." });
      navigate("/training?tab=my-programme");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create programme.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...meta, trainingDaysPerWeek: getTrainingDaysPerWeek() };
      const res = await apiRequest("PUT", `/api/user-programmes/${programId}`, payload);
      return res.json();
    },
    onSuccess: async () => {
      if (programId) await saveWorkoutsToProgram(programId);
      queryClient.invalidateQueries({ queryKey: ["/api/user-programmes"] });
      toast({ title: "Programme updated!", description: "Changes saved." });
      navigate("/training?tab=my-programme");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update programme.", variant: "destructive" });
    },
  });

  async function saveWorkoutsToProgram(pid: number) {
    for (const week of schedule) {
      for (const dayWorkout of week.days) {
        const workoutRes = await apiRequest("POST", `/api/user-programmes/${pid}/workouts`, {
          weekNumber: week.weekNumber,
          dayPosition: dayWorkout.dayPosition,
          name: dayWorkout.workout.name,
          description: dayWorkout.workout.description,
          category: dayWorkout.workout.category,
          difficulty: dayWorkout.workout.difficulty,
          duration: dayWorkout.workout.duration,
        });
        const savedWorkout = await workoutRes.json();

        if (dayWorkout.workout.blocks.length > 0) {
          const blocksPayload = dayWorkout.workout.blocks.map((b) => ({
            section: b.section,
            blockType: b.blockType,
            rest: b.rest,
            exercises: b.exercises.map((ex) => ({
              exerciseLibraryId: ex.exerciseLibraryId,
              sets: ex.sets,
              durationType: "text",
              tempo: ex.tempo || null,
              load: ex.load || null,
              notes: ex.notes || null,
            })),
          }));

          await apiRequest("PUT", `/api/user-programmes/workouts/${savedWorkout.id}/blocks/batch`, {
            blocks: blocksPayload,
          });
        }
      }
    }
  }

  const handleSubmit = () => {
    if (!meta.title.trim()) {
      toast({ title: "Title required", description: "Give your programme a name.", variant: "destructive" });
      return;
    }
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const removeWorkoutFromDay = (dayPosition: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const weekIdx = updated.findIndex((w) => w.weekNumber === activeWeek);
      if (weekIdx === -1) return prev;
      updated[weekIdx].days = updated[weekIdx].days.filter(
        (d) => d.dayPosition !== dayPosition
      );
      return updated;
    });
  };

  const copyWeekSchedule = (fromWeek: number, toWeek: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const fromIdx = updated.findIndex((w) => w.weekNumber === fromWeek);
      const toIdx = updated.findIndex((w) => w.weekNumber === toWeek);
      if (fromIdx === -1 || toIdx === -1) return prev;

      updated[toIdx].days = updated[fromIdx].days.map((d) => ({
        ...d,
        workout: {
          ...d.workout,
          blocks: d.workout.blocks.map((b) => ({
            ...b,
            id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            exercises: b.exercises.map((ex) => ({
              ...ex,
              id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            })),
          })),
        },
      }));
      return updated;
    });
    toast({ title: "Week copied", description: `Week ${fromWeek} schedule copied to Week ${toWeek}.` });
  };

  const currentWeekSchedule = schedule.find((w) => w.weekNumber === activeWeek);

  const getWorkoutForDay = (dayPos: number) =>
    currentWeekSchedule?.days.find((d) => d.dayPosition === dayPos)?.workout;

  const totalWorkoutsCount = schedule.reduce((sum, w) => sum + w.days.length, 0);

  const LIBRARY_FILTERS = [
    { id: "workouts", label: "Workouts" },
    { id: "stretching", label: "Mobility" },
    { id: "yoga", label: "Yoga" },
    { id: "corrective", label: "Corrective" },
  ];

  const getSourceWorkouts = () => {
    switch (workoutSourceTab) {
      case "saved": return savedWorkouts;
      case "mine": return myWorkouts;
      case "library":
      default: return libraryWorkouts;
    }
  };

  const filteredLibraryWorkouts = useMemo(() => {
    const sourceList = getSourceWorkouts();
    return sourceList.filter((w: any) => {
      const title = (w.title || w.name || "").toLowerCase();
      const query = workoutSearchQuery.toLowerCase().trim();

      if (query && !title.includes(query)) return false;

      if (workoutSourceTab === "library") {
        switch (libraryFilter) {
          case "stretching":
            if (!title.includes("stretch") && !title.includes("mobility")) return false;
            break;
          case "yoga":
            if (!title.includes("yoga")) return false;
            break;
          case "corrective":
            if (!title.includes("corrective")) return false;
            break;
          case "workouts":
          default:
            if (title.includes("stretch") || title.includes("mobility") || title.includes("yoga") || title.includes("corrective")) return false;
        }
      }

      if (difficultyFilter !== "all") {
        const wDiff = (w.difficulty || "").toLowerCase();
        if (!wDiff) return true;
        if (wDiff !== difficultyFilter) return false;
      }

      if (durationFilter !== "all") {
        const dur = w.duration || 0;
        if (!dur) return true;
        switch (durationFilter) {
          case "short": if (dur > 20) return false; break;
          case "medium": if (dur <= 20 || dur > 40) return false; break;
          case "long": if (dur <= 40) return false; break;
        }
      }

      return true;
    });
  }, [workoutSourceTab, libraryWorkouts, savedWorkouts, myWorkouts, libraryFilter, workoutSearchQuery, difficultyFilter, durationFilter]);

  const openAddWorkoutScreen = (dayPosition: number) => {
    setAddWorkoutDayTarget(dayPosition);
    setLibraryFilter("workouts");
    setWorkoutSearchQuery("");
    setWorkoutSourceTab("library");
    setDifficultyFilter("all");
    setDurationFilter("all");
    setShowFilters(false);
    setShowAddWorkoutScreen(true);
  };

  const handleViewWorkout = (workoutId: number) => {
    const returnPath = isEditing ? `/training/edit-programme/${programId}` : '/training/create-programme';
    sessionStorage.setItem('programmeBuilderState', JSON.stringify({ meta, schedule, activeWeek }));
    if (addWorkoutDayTarget !== null) {
      sessionStorage.setItem('programmeBuilderDayTarget', String(addWorkoutDayTarget));
    }
    sessionStorage.setItem('programmeBuilderShowAddWorkout', 'true');
    navigate(`/training/workout/${workoutId}?source=programme-builder&returnTo=${encodeURIComponent(returnPath)}`);
  };

  const handleEditExistingWorkout = (dayOverride?: number) => {
    const targetDay = dayOverride ?? addWorkoutDayTarget;
    if (targetDay === null) return;
    const existingWorkout = getWorkoutForDay(targetDay);
    if (!existingWorkout) return;

    const wodExercises: any[] = [];
    existingWorkout.blocks.forEach((block: WorkoutBlock, blockIdx: number) => {
      const groupId = block.blockType !== 'single'
        ? `group-${Date.now()}-${blockIdx}-${Math.random().toString(36).slice(2, 6)}`
        : undefined;

      block.exercises.forEach((ex: BlockExercise, exIdx: number) => {
        wodExercises.push({
          id: `ex-${Date.now()}-${blockIdx}-${exIdx}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'exercise' as const,
          exerciseLibraryId: ex.exerciseLibraryId,
          exerciseName: ex.exerciseName,
          imageUrl: ex.imageUrl || undefined,
          section: block.section || 'main',
          blockType: block.blockType || 'single',
          blockGroupId: groupId,
          position: exIdx,
          restPeriod: block.rest || '60s',
          setsCount: ex.sets?.length || 3,
          targetReps: ex.sets?.[0]?.reps || '10',
          tempo: ex.tempo || '',
          load: ex.load || '',
          notes: ex.notes || '',
          targetDuration: '',
          durationType: 'text' as const,
          exerciseType: 'strength' as const,
        });
      });
    });

    sessionStorage.setItem('programmeBuilderState', JSON.stringify({ meta, schedule, activeWeek }));
    sessionStorage.setItem('wodExercises', JSON.stringify(wodExercises));
    const returnPath = isEditing ? `/training/edit-programme/${programId}` : '/training/create-programme';
    navigate(`/build-wod?type=regular&programmeDay=${targetDay}&from=${encodeURIComponent(returnPath)}`);
  };

  const handleCreateNewWorkout = () => {
    if (addWorkoutDayTarget === null) return;
    sessionStorage.setItem('programmeBuilderState', JSON.stringify({ meta, schedule, activeWeek }));
    const returnPath = isEditing ? `/training/edit-programme/${programId}` : '/training/create-programme';
    navigate(`/build-wod?type=regular&programmeDay=${addWorkoutDayTarget}&from=${encodeURIComponent(returnPath)}`);
  };

  const handleSelectLibraryWorkout = async (libraryWorkout: any) => {
    if (addWorkoutDayTarget === null) return;
    try {
      const workoutId = libraryWorkout.id;
      const blocksRes = await fetch(`/api/workouts/${workoutId}/blocks`, { credentials: "include" });
      const blocksJson = blocksRes.ok ? await blocksRes.json() : { blocks: [] };
      const blocksData = Array.isArray(blocksJson) ? blocksJson : (blocksJson.blocks || blocksJson.workout?.blocks || []);

      const importedBlocks: WorkoutBlock[] = (blocksData || []).map((b: any) => ({
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        blockType: b.blockType || "single",
        section: b.section || "main",
        rest: b.rest || null,
        exercises: (b.exercises || []).map((ex: any) => ({
          id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          exerciseLibraryId: ex.exerciseLibraryId,
          exerciseName: exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.name || ex.exerciseName || "Exercise",
          imageUrl: exercises.find((e: any) => e.id === ex.exerciseLibraryId)?.imageUrl || ex.imageUrl,
          sets: Array.isArray(ex.sets) ? ex.sets : [{ reps: "10" }],
          tempo: ex.tempo || "",
          load: ex.load || "",
          notes: ex.notes || "",
        })),
      }));

      const importedWorkout: WorkoutData = {
        id: libraryWorkout.id,
        name: libraryWorkout.title || libraryWorkout.name || "Workout",
        description: libraryWorkout.description || "",
        category: libraryWorkout.category || "strength",
        difficulty: libraryWorkout.difficulty || "intermediate",
        duration: libraryWorkout.duration || 45,
        blocks: importedBlocks,
      };

      setSchedule((prev) => {
        const updated = [...prev];
        const weekIdx = updated.findIndex((w) => w.weekNumber === activeWeek);
        if (weekIdx === -1) return prev;
        const existingIdx = updated[weekIdx].days.findIndex((d) => d.dayPosition === addWorkoutDayTarget);
        if (existingIdx >= 0) {
          updated[weekIdx].days[existingIdx].workout = importedWorkout;
        } else {
          updated[weekIdx].days.push({ dayPosition: addWorkoutDayTarget, workout: importedWorkout });
        }
        return updated;
      });

      setShowAddWorkoutScreen(false);
      toast({ title: "Workout added", description: `"${importedWorkout.name}" added to ${DAY_LABELS[addWorkoutDayTarget]}.` });
    } catch {
      toast({ title: "Error", description: "Failed to import workout.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader
        title={isEditing ? "Edit Programme" : "Create Programme"}
        onBack={() => navigate("/training?tab=my-programme")}
      />

      <div className="p-4 pt-14">
        {step === 1 && (
          <div className="max-w-lg mx-auto space-y-5">
            <div className="text-center mb-6">
              <Dumbbell className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="text-xl font-bold text-foreground">Build Your Programme</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set up the basics, then design your weekly schedule
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Programme Name *</Label>
              <Input
                id="title"
                value={meta.title}
                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                placeholder="e.g. My Strength Builder"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                placeholder="What's this programme about?"
              />
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex gap-3 items-start">
                <div className="relative w-[140px] h-[200px] rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  {meta.imageUrl ? (
                    <>
                      <img src={meta.imageUrl} alt="Programme cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-white font-bold text-xs leading-tight line-clamp-2">
                          {meta.title || "Programme Title"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1"
                        onClick={() => setMeta({ ...meta, imageUrl: "" })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 transition-colors">
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        <>
                          <ImagePlus className="w-6 h-6 text-white/50 mb-1" />
                          <span className="text-[10px] text-white/50 text-center px-2">Add cover</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          try {
                            const formData = new FormData();
                            formData.append("image", file);
                            const res = await fetch("/api/upload/image", {
                              method: "POST",
                              credentials: "include",
                              body: formData,
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setMeta({ ...meta, imageUrl: data.imageUrl });
                            } else {
                              toast({ title: "Upload failed", variant: "destructive" });
                            }
                          } catch {
                            toast({ title: "Upload failed", variant: "destructive" });
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                <div className="pt-1 space-y-1">
                  <p className="text-xs text-muted-foreground">This is how your programme card will look in the library.</p>
                  <p className="text-[11px] text-muted-foreground/70">Ideal size: 600 × 900px (portrait)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goal</Label>
                <Select value={meta.goal} onValueChange={(v) => setMeta({ ...meta, goal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOALS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (weeks)</Label>
                <Select value={meta.weeks} onValueChange={(v) => setMeta({ ...meta, weeks: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((w) => (
                      <SelectItem key={w} value={String(w)}>{w} {w === 1 ? "week" : "weeks"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full btn-primary mt-4"
              onClick={() => {
                if (!meta.title.trim() || !meta.description.trim()) {
                  toast({ title: "Required", description: "Please fill in the name and description.", variant: "destructive" });
                  return;
                }
                setStep(2);
              }}
            >
              Next: Design Schedule
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{meta.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {meta.weeks} weeks | {totalWorkoutsCount} workouts
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Details
              </Button>
            </div>


            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label, idx) => {
                const workout = getWorkoutForDay(idx);
                return (
                  <div key={idx} className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
                    {workout ? (
                      <Card
                        className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => {
                          setActionMenuDayTarget(idx);
                          setShowWorkoutActionMenu(true);
                        }}
                      >
                        <CardContent className="p-2">
                          <Dumbbell className="h-4 w-4 text-primary mx-auto mb-1" />
                          <p className="text-[10px] font-medium text-foreground truncate leading-tight">
                            {workout.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {workout.blocks.reduce((s: number, b: WorkoutBlock) => s + b.exercises.length, 0)} ex
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card
                        className="border-dashed border-gray-600 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                        onClick={() => openAddWorkoutScreen(idx)}
                      >
                        <CardContent className="p-2">
                          <Plus className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
                          <p className="text-[10px] text-muted-foreground">Add</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1 btn-primary"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : "Create Programme"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAddWorkoutScreen && addWorkoutDayTarget !== null && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
          <div className="bg-background text-foreground px-4 py-3 flex items-center justify-between border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowAddWorkoutScreen(false); }}
              className="text-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-semibold">
              {DAY_LABELS[addWorkoutDayTarget]} Workout
            </h1>
            <div className="w-10" />
          </div>

          <div className="flex-1 bg-background text-foreground overflow-y-auto">
            <div className="p-4 space-y-3 w-full box-border">


              <button
                    onClick={handleCreateNewWorkout}
                    className="w-full flex items-center gap-4 bg-blue-500 hover:bg-blue-600 rounded-full py-3.5 px-5 transition-colors"
                  >
                    <div className="bg-white/20 p-2.5 rounded-full">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                    <p className="font-semibold text-white">Create New Workout</p>
                  </button>

                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 pr-10"
                      placeholder="Search workouts..."
                      value={workoutSearchQuery}
                      onChange={(e) => setWorkoutSearchQuery(e.target.value)}
                    />
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${showFilters ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {showFilters && (
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                        className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                      >
                        <option value="all">All Levels</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                      <select
                        value={durationFilter}
                        onChange={(e) => setDurationFilter(e.target.value)}
                        className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                      >
                        <option value="all">Any Duration</option>
                        <option value="short">Under 20 min</option>
                        <option value="medium">20-40 min</option>
                        <option value="long">40+ min</option>
                      </select>
                    </div>
                  )}

                  <div className="flex border-b border-border mt-2">
                    {[
                      { id: "library" as const, label: "Library" },
                      { id: "saved" as const, label: "Saved" },
                      { id: "mine" as const, label: "My Workouts" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setWorkoutSourceTab(tab.id)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors border-b-2 ${
                          workoutSourceTab === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                        {tab.id === "saved" && savedWorkouts.length > 0 && (
                          <span className="ml-1 text-[10px]">({savedWorkouts.length})</span>
                        )}
                        {tab.id === "mine" && myWorkouts.length > 0 && (
                          <span className="ml-1 text-[10px]">({myWorkouts.length})</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {workoutSourceTab === "library" && (
                    <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4">
                      {LIBRARY_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => setLibraryFilter(filter.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                            libraryFilter === filter.id
                              ? "bg-[#0cc9a9] text-black"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredLibraryWorkouts.length === 0 ? (
                    <div className="text-center py-8">
                      <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">
                        {workoutSourceTab === "saved" ? "No saved workouts yet" :
                         workoutSourceTab === "mine" ? "No workouts created yet" :
                         "No workouts match your filters"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLibraryWorkouts.map((workout: any) => (
                        <div
                          key={workout.id}
                          className="flex items-center gap-3 bg-card hover:bg-muted rounded-lg py-2.5 px-3 transition-colors border border-border"
                        >
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {workout.imageUrl ? (
                              <img
                                src={workout.imageUrl}
                                alt={workout.title || workout.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-foreground">
                              {workout.title || workout.name}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {workout.difficulty && <span className="capitalize">{workout.difficulty}</span>}
                              {workout.duration && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />{workout.duration}m
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleViewWorkout(workout.id)}
                            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
                            title="View Workout"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSelectLibraryWorkout(workout)}
                            className="p-2 text-primary hover:bg-primary/10 transition-colors rounded-lg"
                            title="Add"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

            </div>
          </div>
        </div>
      )}

      {showWorkoutActionMenu && actionMenuDayTarget !== null && (() => {
        const actionWorkout = getWorkoutForDay(actionMenuDayTarget);
        if (!actionWorkout) return null;
        const isUserCreated = !actionWorkout.id;
        return (
          <>
            <div 
              className="fixed inset-0 bg-black/60 z-[101]" 
              onClick={() => setShowWorkoutActionMenu(false)} 
            />
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[102] animate-in slide-in-from-bottom px-6 pt-8 pb-10">
                <button
                  className="w-full text-left py-4 text-[16px] font-medium text-black"
                  onClick={() => {
                    setShowWorkoutActionMenu(false);
                    const returnPath = isEditing ? `/training/edit-programme/${programId}` : '/training/create-programme';
                    sessionStorage.setItem('programmeBuilderState', JSON.stringify({ meta, schedule, activeWeek }));
                    sessionStorage.setItem('programmeBuilderDayTarget', String(actionMenuDayTarget));
                    if (actionWorkout.id) {
                      navigate(`/training/workout/${actionWorkout.id}?source=programme-builder&returnTo=${encodeURIComponent(returnPath)}`);
                    } else {
                      const previewWorkout = {
                        title: actionWorkout.title || 'Workout',
                        workoutType: actionWorkout.workoutType || 'regular',
                        category: actionWorkout.category || 'workout',
                        intervalRounds: actionWorkout.intervalRounds,
                      };
                      const previewExercises = actionWorkout.blocks.map((block: WorkoutBlock) => ({
                        ...block,
                        exercises: block.exercises.map((ex: BlockExercise) => {
                          const libEx = exercises.find((e: any) => e.id === ex.exerciseLibraryId);
                          return {
                            exerciseLibraryId: ex.exerciseLibraryId,
                            exerciseName: ex.exerciseName,
                            name: ex.exerciseName,
                            imageUrl: ex.imageUrl,
                            muxPlaybackId: ex.muxPlaybackId,
                            equipment: libEx?.equipment || [],
                            sets: ex.sets || [{ reps: '8-12' }],
                            tempo: ex.tempo,
                            load: ex.load,
                            notes: ex.notes,
                          };
                        }),
                      }));
                      sessionStorage.setItem('previewWorkoutData', JSON.stringify({
                        workout: previewWorkout,
                        exercises: previewExercises,
                        type: 'programme',
                      }));
                      navigate(`/training/workout/preview?source=programme-builder&returnTo=${encodeURIComponent(returnPath)}`);
                    }
                  }}
                >
                  View workout
                </button>
                {isUserCreated && (
                  <button
                    className="w-full text-left py-4 text-[16px] font-medium text-black"
                    onClick={() => {
                      setShowWorkoutActionMenu(false);
                      handleEditExistingWorkout(actionMenuDayTarget);
                    }}
                  >
                    Edit workout
                  </button>
                )}
                {isUserCreated && (
                  <button
                    className="w-full text-left py-4 text-[16px] font-medium text-black"
                    onClick={() => {
                      setRenameValue(actionWorkout.name || actionWorkout.title || '');
                      setShowWorkoutActionMenu(false);
                      setShowRenameDialog(true);
                    }}
                  >
                    Rename
                  </button>
                )}
                <button
                  className="w-full text-left py-4 text-[16px] font-medium text-red-500"
                  onClick={() => {
                    removeWorkoutFromDay(actionMenuDayTarget);
                    setShowWorkoutActionMenu(false);
                  }}
                >
                  Remove
                </button>
            </div>
          </>
        );
      })()}

      {showRenameDialog && actionMenuDayTarget !== null && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[101]" 
            onClick={() => setShowRenameDialog(false)} 
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-[102] p-6 w-[85%] max-w-sm">
            <h3 className="text-lg font-semibold text-black mb-4">Rename Workout</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black text-base focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim()) {
                  setSchedule(prev => prev.map(week => ({
                    ...week,
                    days: week.days.map(day => 
                      day.dayPosition === actionMenuDayTarget && day.workout && !day.workout.id
                        ? { ...day, workout: { ...day.workout, name: renameValue.trim(), title: renameValue.trim() } }
                        : day
                    )
                  })));
                  setShowRenameDialog(false);
                }
              }}
            />
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 py-2 rounded-lg border border-gray-300 text-black font-medium"
                onClick={() => setShowRenameDialog(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
                disabled={!renameValue.trim()}
                onClick={() => {
                  setSchedule(prev => prev.map(week => ({
                    ...week,
                    days: week.days.map(day => 
                      day.dayPosition === actionMenuDayTarget && day.workout && !day.workout.id
                        ? { ...day, workout: { ...day.workout, name: renameValue.trim(), title: renameValue.trim() } }
                        : day
                    )
                  })));
                  setShowRenameDialog(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
