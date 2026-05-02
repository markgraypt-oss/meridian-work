import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Users, BookOpen, Play, ChefHat, Dumbbell, Search, X, Filter, ChevronDown, MapPin, Sparkles, BarChart3, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import type { Video, Recipe, ExerciseLibraryItem, Workout } from "@shared/schema";
import { ExerciseManager } from "@/components/admin/ExerciseManager";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "@/components/admin/exerciseFilterConstants";
import AdminMindfulnessTab from "@/pages/admin/AdminMindfulnessTools";

// Type for program data
type Program = {
  id: number;
  title: string;
  description: string;
  goal: string;
  difficulty: string;
  weeks: number;
  trainingDaysPerWeek: number;
  duration: number;
  equipment: string;
  imageUrl?: string;
  whoItsFor?: string;
  programmeType: string;
  category?: string[];
  tags?: string[];
  createdAt?: Date;
};
import { VideoForm } from "@/components/admin/VideoForm";
import { RecipeForm } from "@/components/admin/RecipeForm";
import { ExerciseLibraryForm } from "@/components/admin/ExerciseLibraryForm";
import { BodyMapConfig } from "@/components/admin/BodyMapConfig";

export default function AdminPanel() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  
  // Read tab from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || "overview");
  
  // Update tab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location]);
  const [learningTab, setLearningTab] = useState("learning-paths");
  const [stretchingSubTab, setStretchingSubTab] = useState("workouts");
  const [correctiveSubTab, setCorrectiveSubTab] = useState("workouts");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [pathsPage, setPathsPage] = useState(1);
  const [selectedVideoTopic, setSelectedVideoTopic] = useState<string | null>(null);
  const [editingContentItem, setEditingContentItem] = useState<any | null>(null);
  const [editingContentTitle, setEditingContentTitle] = useState("");
  const [editingContentDescription, setEditingContentDescription] = useState("");
  const [editingContentFile, setEditingContentFile] = useState<File | null>(null);
  const [editingContentMuxPlaybackId, setEditingContentMuxPlaybackId] = useState("");
  const [showCreateVideoModal, setShowCreateVideoModal] = useState(false);
  const [showCreatePdfModal, setShowCreatePdfModal] = useState(false);
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [selectedTopicForContent, setSelectedTopicForContent] = useState<string | null>(null);
  const [newContentTitle, setNewContentTitle] = useState("");
  const [newContentDescription, setNewContentDescription] = useState("");
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [addContentMuxPlaybackId, setAddContentMuxPlaybackId] = useState("");
  const [contentMuxPlaybackId, setContentMuxPlaybackId] = useState("");
  const [addContentDocFiles, setAddContentDocFiles] = useState<File[]>([]);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseLibraryItem | null>(null);
  const [editingPath, setEditingPath] = useState<any | null>(null);
  const [showPathEditModal, setShowPathEditModal] = useState(false);
  const [showCreatePathModal, setShowCreatePathModal] = useState(false);
  const [newPathTitle, setNewPathTitle] = useState("");
  const [newPathDescription, setNewPathDescription] = useState("");
  const [newPathTopicId, setNewPathTopicId] = useState<number | null>(null);
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any | null>(null);
  const [workoutFormStep, setWorkoutFormStep] = useState(1); // Step 1: name/type, Step 2: details/exercises
  const [workoutFormData, setWorkoutFormData] = useState({
    title: "",
    description: "",
    workoutType: "regular", // 'regular', 'interval', 'circuit', 'video'
    category: "strength",
    difficulty: "beginner",
    duration: 30,
    equipment: [] as string[],
    exercises: [] as any[],
  });
  const [deleteProgrammeId, setDeleteProgrammeId] = useState<number | null>(null);
  const [deletePathId, setDeletePathId] = useState<number | null>(null);
  const [showBreathTechniqueForm, setShowBreathTechniqueForm] = useState(false);
  const [editingBreathTechnique, setEditingBreathTechnique] = useState<any | null>(null);
  const [breathTechniqueFormData, setBreathTechniqueFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "relaxation",
    difficulty: "beginner",
    defaultDurationMinutes: 5,
    inhaleSeconds: 4,
    holdAfterInhaleSeconds: 0,
    exhaleSeconds: 4,
    holdAfterExhaleSeconds: 0,
    defaultRounds: 4,
    isActive: true,
    sortOrder: 0,
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Read tab from URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const pathIdParam = params.get('pathId');
    const subtabParam = params.get('subtab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
    // Set sub-tab for stretching or corrective based on URL param
    if (subtabParam) {
      if (tabParam === 'stretching') {
        setStretchingSubTab(subtabParam);
      } else if (tabParam === 'corrective') {
        setCorrectiveSubTab(subtabParam);
      }
    }
    // Scroll to the specific path card if pathId is provided
    if (pathIdParam) {
      setTimeout(() => {
        const element = document.getElementById(`learning-path-${pathIdParam}`);
        if (element) {
          element.scrollIntoView({ block: 'center' });
        }
      }, 50);
    }
  }, []);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Reset learn tab state when switching between tabs
  useEffect(() => {
    setSelectedTopic("");
    setPathsPage(1);
    setSelectedVideoTopic(null);
    setEditingContentItem(null);
  }, [learningTab]);

  // Update content item mutation
  const updateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      // Determine the correct endpoint based on content source
      // Content from learnContentLibrary uses /api/content-library/:id
      // Content from pathContentItems uses /api/learning-paths/content/:id
      const isLibraryContent = editingContentItem.topicId !== undefined;
      const endpoint = isLibraryContent 
        ? `/api/content-library/${editingContentItem.id}`
        : `/api/learning-paths/content/${editingContentItem.id}`;

      if (editingContentFile) {
        // If there's a new PDF file, use FormData
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description);
        formData.append('content_type', 'pdf');
        formData.append('file', editingContentFile);

        const response = await fetch(endpoint, {
          method: 'PATCH',
          body: formData,
        });
        if (!response.ok) throw new Error('Failed to update content');
        return response.json();
      } else {
        // For metadata updates or video with muxPlaybackId, use JSON
        const payload: any = {
          title: data.title,
          description: data.description,
        };
        if (editingContentMuxPlaybackId) {
          payload.muxPlaybackId = editingContentMuxPlaybackId;
          payload.content_type = 'video';
        }
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to update content');
        return response.json();
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Content updated successfully' });
      setEditingContentItem(null);
      setEditingContentFile(null);
      setEditingContentMuxPlaybackId('');
      // Invalidate content library queries
      if (editingContentItem?.topicId) {
        queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${editingContentItem.topicId}`] });
      }
      if (selectedTopicId) {
        queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${selectedTopicId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update content', variant: 'destructive' });
    },
  });

  // Create video content mutation
  const createVideoMutation = useMutation({
    mutationFn: async () => {
      const topicId = selectedTopicForContent || selectedVideoTopic;
      const pathId = (learningPaths as any[]).find(p => p.topic_id === topicId)?.id;
      if (!pathId) throw new Error('No path found for this topic');

      const response = await fetch(`/api/learning-paths/${pathId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newContentTitle,
          description: newContentDescription,
          contentType: 'video',
          muxPlaybackId: contentMuxPlaybackId,
        }),
      });
      if (!response.ok) throw new Error('Failed to create video');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Video added successfully' });
      setShowCreateVideoModal(false);
      setShowAddContentModal(false);
      setNewContentTitle('');
      setNewContentDescription('');
      setContentFile(null);
      setContentMuxPlaybackId('');
      setAddContentMuxPlaybackId('');
      setAddContentDocFiles([]);
      setSelectedTopicForContent(null);
      if (selectedTopicId) {
        queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${selectedTopicId}`] });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add video', variant: 'destructive' });
    },
  });

  // Create PDF content mutation
  const createPdfMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', newContentTitle);
      formData.append('description', newContentDescription);
      formData.append('contentType', 'pdf');
      formData.append('file', contentFile!);

      const topicId = selectedTopicForContent || selectedVideoTopic;
      const pathId = (learningPaths as any[]).find(p => p.topic_id === topicId)?.id;
      if (!pathId) throw new Error('No path found for this topic');

      const response = await fetch(`/api/learning-paths/${pathId}/content`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to create PDF');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Document added successfully' });
      setShowCreatePdfModal(false);
      setShowAddContentModal(false);
      setNewContentTitle('');
      setNewContentDescription('');
      setContentFile(null);
      setAddContentMuxPlaybackId('');
      setAddContentDocFiles([]);
      setSelectedTopicForContent(null);
      if (selectedTopicId) {
        queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${selectedTopicId}`] });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add PDF', variant: 'destructive' });
    },
  });

  // Fetch data
  const { data: programs = [], isLoading: programsLoading } = useQuery<Program[]>({
    queryKey: ["/api/programs"],
    retry: false,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
    retry: false,
  });

  const { data: recipes = [], isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    retry: false,
  });

  const { data: exercises = [], isLoading: exercisesLoading } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    retry: false,
  });

  const { data: workouts = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "workout"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=workout");
      return res.json();
    },
    retry: false,
  });

  const { data: stretchingRoutines = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "stretching"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=stretching");
      return res.json();
    },
    retry: false,
  });

  const { data: correctiveRoutines = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "corrective"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=corrective");
      return res.json();
    },
    retry: false,
  });

  const { data: stretchingProgrammes = [] } = useQuery<Program[]>({
    queryKey: ["/api/programs", "stretching"],
    queryFn: async () => {
      const res = await fetch("/api/programs?programmeType=stretching");
      return res.json();
    },
    retry: false,
  });

  const { data: correctiveProgrammes = [] } = useQuery<Program[]>({
    queryKey: ["/api/programs", "corrective"],
    queryFn: async () => {
      const res = await fetch("/api/programs?programmeType=corrective");
      return res.json();
    },
    retry: false,
  });

  const { data: yogaClasses = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "yoga"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=yoga");
      return res.json();
    },
    retry: false,
  });

  const { data: breathworkSessions = [] } = useQuery({
    queryKey: ["/api/breathwork/techniques"],
    retry: false,
  });

  const { data: mindfulnessTools = [] } = useQuery({
    queryKey: ["/api/admin/mindfulness"],
    retry: false,
  });

  const { data: deskHealthItems = [] } = useQuery({
    queryKey: ["/api/desk-health"],
    retry: false,
  });

  const { data: learningPaths = [] } = useQuery({
    queryKey: ["/api/learning-paths"],
    retry: false,
  });

  const { data: learnVideoTopics = [] } = useQuery({
    queryKey: ["/api/learn-topics"],
    retry: false,
  });

  // Fetch content for the selected video topic from content library
  // selectedVideoTopic is already the topic ID (number)
  const selectedTopicId = selectedVideoTopic;
  const { data: selectedTopicContent = [] } = useQuery({
    queryKey: [`/api/content-library/topic/${selectedTopicId}`],
    queryFn: () => fetch(`/api/content-library/topic/${selectedTopicId}`).then(r => r.json()),
    enabled: !!selectedTopicId,
    retry: false,
  });

  // Restore editing programme state ONLY when returning from exercise selection
  // (not on every admin panel visit)
  useEffect(() => {
    if (programsLoading) return;
    const editingProgrammeId = sessionStorage.getItem('editingProgrammeId');
    const selectedExerciseId = sessionStorage.getItem('selectedExerciseId');
    const returningFromExerciseSelection = sessionStorage.getItem('returningFromExerciseSelection');
    
    // Only restore if we're explicitly returning from exercise selection
    if (editingProgrammeId && selectedExerciseId && returningFromExerciseSelection === 'true' && programs.length > 0) {
      const program = programs.find((p: any) => p.id === parseInt(editingProgrammeId));
      if (program) {
        navigate(`/admin/programmes/${program.id}`);
        setActiveTab('programmes');
      }
      // Clear the flag after restoring
      sessionStorage.removeItem('returningFromExerciseSelection');
    }
  }, [programs, programsLoading]);

  // Exercise library search and filter state
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [videoSearchTerm, setVideoSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMainMuscles, setSelectedMainMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  // Programme search and filter state
  const [programmeSearchTerm, setProgrammeSearchTerm] = useState("");
  const [programmeFiltersOpen, setProgrammeFiltersOpen] = useState(false);
  const [selectedProgrammeDifficulty, setSelectedProgrammeDifficulty] = useState<string[]>([]);
  const [selectedProgrammeEquipment, setSelectedProgrammeEquipment] = useState<string[]>([]);
  const [selectedProgrammeWeeks, setSelectedProgrammeWeeks] = useState<number[]>([]);
  const [selectedProgrammeFocus, setSelectedProgrammeFocus] = useState<string[]>([]);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);

  // Workout search and filter state
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState("");
  const [workoutFiltersOpen, setWorkoutFiltersOpen] = useState(false);
  const [selectedWorkoutCategory, setSelectedWorkoutCategory] = useState<string[]>([]);
  const [selectedWorkoutDifficulty, setSelectedWorkoutDifficulty] = useState<string[]>([]);


  // Filtered programmes based on search and filters
  const filteredProgrammes = useMemo(() => {
    return programs.filter((programme: Program) => {
      // Search by name
      const matchesSearch = programme.title.toLowerCase().includes(programmeSearchTerm.toLowerCase());
      
      // Filter by difficulty
      const matchesDifficulty = selectedProgrammeDifficulty.length === 0 || 
        selectedProgrammeDifficulty.includes(programme.difficulty);

      // Filter by equipment
      const matchesEquipment = selectedProgrammeEquipment.length === 0 || 
        selectedProgrammeEquipment.some(equip => programme.equipment?.includes(equip));

      // Filter by weeks
      const matchesWeeks = selectedProgrammeWeeks.length === 0 || 
        selectedProgrammeWeeks.includes(programme.weeks);

      // Filter by focus
      const matchesFocus = selectedProgrammeFocus.length === 0 || 
        selectedProgrammeFocus.some(focus => programme.goal?.includes(focus));

      // Filter by tags
      const matchesTags = filteredTags.length === 0 || 
        filteredTags.some(tag => programme.tags?.includes(tag));

      return matchesSearch && matchesDifficulty && matchesEquipment && matchesWeeks && matchesFocus && matchesTags;
    });
  }, [programs, programmeSearchTerm, selectedProgrammeDifficulty, selectedProgrammeEquipment, selectedProgrammeWeeks, selectedProgrammeFocus, filteredTags]);

  // Filtered workouts based on search and filters
  const filteredWorkouts = useMemo(() => {
    return (workouts as any[]).filter((workout: any) => {
      const matchesSearch = (workout.title || workout.name).toLowerCase().includes(workoutSearchTerm.toLowerCase()) ||
        (workout.description || "").toLowerCase().includes(workoutSearchTerm.toLowerCase());
      const matchesCategory = selectedWorkoutCategory.length === 0 || selectedWorkoutCategory.includes(workout.category);
      const matchesDifficulty = selectedWorkoutDifficulty.length === 0 || selectedWorkoutDifficulty.includes(workout.difficulty);
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [workouts, workoutSearchTerm, selectedWorkoutCategory, selectedWorkoutDifficulty]);

  // Filtered exercises based on search and filters
  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      // Search by name - match ALL words in any order
      const searchWords = exerciseSearchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
      const exerciseName = exercise.name.toLowerCase();
      const matchesSearch = searchWords.length === 0 || searchWords.every(word => exerciseName.includes(word));
      
      // Filter by main muscle
      const matchesMainMuscle = selectedMainMuscles.length === 0 || 
        selectedMainMuscles.some(muscle => exercise.mainMuscle?.includes(muscle));
      
      // Filter by equipment
      const matchesEquipment = selectedEquipment.length === 0 || 
        selectedEquipment.some(equip => exercise.equipment?.includes(equip));
      
      // Filter by movement
      const matchesMovement = selectedMovements.length === 0 || 
        selectedMovements.some(move => exercise.movement?.includes(move));
      
      // Filter by mechanics
      const matchesMechanics = selectedMechanics.length === 0 || 
        selectedMechanics.some(mech => exercise.mechanics?.includes(mech));
      
      // Filter by level
      const matchesLevel = selectedLevels.length === 0 || 
        (exercise.level && selectedLevels.includes(exercise.level));

      return matchesSearch && matchesMainMuscle && matchesEquipment && 
             matchesMovement && matchesMechanics && matchesLevel;
    });
  }, [exercises, exerciseSearchTerm, selectedMainMuscles, selectedEquipment, selectedMovements, selectedMechanics, selectedLevels]);

  const toggleFilter = (value: string, current: string[], setter: (value: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const clearAllProgrammeFilters = () => {
    setProgrammeSearchTerm("");
    setSelectedProgrammeDifficulty([]);
    setSelectedProgrammeEquipment([]);
    setSelectedProgrammeWeeks([]);
    setSelectedProgrammeFocus([]);
    setFilteredTags([]);
  };

  const hasActiveProgrammeFilters = programmeSearchTerm !== "" || selectedProgrammeDifficulty.length > 0 || selectedProgrammeEquipment.length > 0 || selectedProgrammeWeeks.length > 0 || selectedProgrammeFocus.length > 0 || filteredTags.length > 0;

  const clearAllExerciseFilters = () => {
    setExerciseSearchTerm("");
    setSelectedMainMuscles([]);
    setSelectedEquipment([]);
    setSelectedMovements([]);
    setSelectedMechanics([]);
    setSelectedLevels([]);
  };

  const hasActiveExerciseFilters = exerciseSearchTerm !== "" || selectedMainMuscles.length > 0 || 
    selectedEquipment.length > 0 || selectedMovements.length > 0 || 
    selectedMechanics.length > 0 || selectedLevels.length > 0;

  // Get unique difficulties from programmes
  const uniqueDifficulties = Array.from(new Set(programs.map((p: Program) => p.difficulty).filter(Boolean)));
  const uniqueWeeks = Array.from(new Set(programs.map((p: Program) => p.weeks).filter(Boolean))).sort((a, b) => a - b);

  // Predefined filter options
  const EQUIPMENT_OPTIONS = ["Bands Only", "DB/Bench Only", "Full Gym", "No Equipment (At Home)", "Bodyweight", "Kettlebell Only"];
  const FOCUS_OPTIONS = ["Power", "Max Strength", "Conditioning", "Muscular Endurance", "Hypertrophy", "General Strength", "Corrective Exercises"];
  const TAG_OPTIONS = ["Full Body", "Upper Body", "Lower Body", "Core Focus", "Cardio", "Time Efficient"];
  
  // Get unique tags from programmes
  const uniqueTags = Array.from(new Set(programs.flatMap((p: Program) => p.tags || []).filter(Boolean)));
  const [selectedProgrammeTags, setSelectedProgrammeTags] = useState<string[]>([]);

  // Delete learning path mutation
  const deletePathMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/learning-paths/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      setDeletePathId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
      toast({ title: "Success", description: "Learning path deleted successfully" });
    },
    onError: () => {
      setDeletePathId(null);
      toast({ title: "Error", description: "Failed to delete learning path", variant: "destructive" });
    },
  });

  // Delete content library item mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/content-library/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
    },
    onSuccess: () => {
      if (selectedVideoTopic) {
        queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${selectedVideoTopic}`] });
      }
      toast({ title: "Success", description: "Content deleted successfully" });
      setEditingContentItem(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete content", variant: "destructive" });
    },
  });

  // Create learning path mutation
  const createPathMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; topicId: number }) => {
      const response = await fetch('/api/learning-paths', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: (newPath) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
      toast({ title: "Success", description: "Learning path created successfully" });
      setShowCreatePathModal(false);
      setNewPathTitle("");
      setNewPathDescription("");
      setNewPathTopicId(null);
      // Navigate to edit the new path
      navigate(`/admin/edit-path/${newPath.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create learning path", variant: "destructive" });
    },
  });

  // Update learning path mutation
  const updatePathMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/learning-paths/${editingPath.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update path");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-paths"] });
      toast({ title: "Success", description: "Learning path updated successfully" });
      setEditingPath(null);
      setShowPathEditModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update learning path", variant: "destructive" });
    },
  });

  // Delete mutations
  const deleteProgrammeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/programs/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({
        title: "Success",
        description: "Programme deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete program",
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Success",
        description: "Video deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/recipes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: "Recipe deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive",
      });
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/exercises/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, ...errorData };
      }
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: "Success",
        description: "Exercise deleted successfully",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      const description = error.detail || error.message || "Failed to delete exercise";
      toast({
        title: "Cannot Delete Exercise",
        description,
        variant: "destructive",
      });
    },
  });

  const createWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/workouts", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to create workout");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      toast({ title: "Success", description: "Workout created successfully" });
      setShowWorkoutForm(false);
      setWorkoutFormData({ title: "", description: "", category: "strength", difficulty: "beginner", duration: 30, equipment: [] });
      setEditingWorkout(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create workout", variant: "destructive" });
    },
  });

  const updateWorkoutMutation = useMutation({
    mutationFn: async (payload: { id: number; data: any }) => {
      const response = await fetch(`/api/workouts/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update workout");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      toast({ title: "Success", description: "Workout updated successfully" });
      setShowWorkoutForm(false);
      setWorkoutFormData({ title: "", description: "", category: "strength", difficulty: "beginner", duration: 30, equipment: [] });
      setEditingWorkout(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update workout", variant: "destructive" });
    },
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/workouts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      toast({ title: "Success", description: "Workout deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete workout", variant: "destructive" });
    },
  });

  const createBreathTechniqueMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/breathwork/techniques", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to create breath technique");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breathwork/techniques"] });
      toast({ title: "Success", description: "Breath technique created successfully" });
      setShowBreathTechniqueForm(false);
      resetBreathTechniqueForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create breath technique", variant: "destructive" });
    },
  });

  const updateBreathTechniqueMutation = useMutation({
    mutationFn: async (payload: { id: number; data: any }) => {
      const response = await fetch(`/api/admin/breathwork/techniques/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload.data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update breath technique");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breathwork/techniques"] });
      toast({ title: "Success", description: "Breath technique updated successfully" });
      setShowBreathTechniqueForm(false);
      setEditingBreathTechnique(null);
      resetBreathTechniqueForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update breath technique", variant: "destructive" });
    },
  });

  const deleteBreathTechniqueMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/breathwork/techniques/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete breath technique");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breathwork/techniques"] });
      toast({ title: "Success", description: "Breath technique deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete breath technique", variant: "destructive" });
    },
  });

  const resetBreathTechniqueForm = () => {
    setBreathTechniqueFormData({
      name: "",
      slug: "",
      description: "",
      category: "relaxation",
      difficulty: "beginner",
      defaultDurationMinutes: 5,
      inhaleSeconds: 4,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 4,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 4,
      isActive: true,
      sortOrder: 0,
    });
  };

  const handleBreathTechniqueSubmit = () => {
    const data = {
      ...breathTechniqueFormData,
      slug: breathTechniqueFormData.slug || breathTechniqueFormData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    };
    if (editingBreathTechnique) {
      updateBreathTechniqueMutation.mutate({ id: editingBreathTechnique.id, data });
    } else {
      createBreathTechniqueMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title="Admin Panel" 
        onBack={() => {
          if (activeTab === "overview") {
            navigate('/profile');
          } else {
            setActiveTab("overview");
          }
        }}
        data-testid="button-back-to-profile"
      />
      
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground mb-6">
            Manage your platform content and settings
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card onClick={() => setActiveTab("exercises")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exercises</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{exercises.length}</div>
                <p className="text-xs text-muted-foreground">
                  Exercises in library
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("programs")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Programmes</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{programs.length}</div>
                <p className="text-xs text-muted-foreground">
                  Training programs available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("learn")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learn Content</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(learningPaths as any[]).length + (learnVideoTopics as any[]).length}</div>
                <p className="text-xs text-muted-foreground">
                  Total paths & topics
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("workouts")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(workouts as any[]).length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Workouts available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("recipes")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recipes</CardTitle>
                <ChefHat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recipes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Nutrition recipes available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("breathwork")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Breathwork Sessions</CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(breathworkSessions as any[]).length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Sessions available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("mindfulness")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mindfulness Tools</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(mindfulnessTools as any[]).length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Tools available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("desk-health")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Desk Health Items</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(deskHealthItems as any[]).length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Items in toolkit
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("stretching")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stretching & Mobility</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stretchingProgrammes.length + stretchingRoutines.length}</div>
                <p className="text-xs text-muted-foreground">
                  Items available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("yoga")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Yoga</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{yogaClasses.length}</div>
                <p className="text-xs text-muted-foreground">
                  Classes available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("corrective")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Corrective Exercise</CardTitle>
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{correctiveProgrammes.length + correctiveRoutines.length}</div>
                <p className="text-xs text-muted-foreground">
                  Items available
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => setActiveTab("body-map")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Body Map Config</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Settings</div>
                <p className="text-xs text-muted-foreground">
                  Configure body map areas
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => navigate("/admin/companies")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Company Management</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Companies</div>
                <p className="text-xs text-muted-foreground">
                  Manage companies, users and benefits
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => navigate("/admin/users")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Management</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Manage</div>
                <p className="text-xs text-muted-foreground">
                  Add and manage users
                </p>
              </CardContent>
            </Card>

            <Card onClick={() => navigate("/admin/reports")} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Company Reports</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Reports</div>
                <p className="text-xs text-muted-foreground">
                  Anonymous aggregate wellness data
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-500 bg-gradient-to-br from-purple-500/10 to-[#0cc9a9]/10"
              onClick={() => navigate('/admin/ai-coaching')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Coach</CardTitle>
                <Sparkles className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">Configure</div>
                <p className="text-xs text-muted-foreground">
                  Train AI to coach like you
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/admin/burnout-calibration')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Burnout Calibration</CardTitle>
                <BarChart3 className="h-4 w-4 text-[#0cc9a9]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#0cc9a9]">Monitor</div>
                <p className="text-xs text-muted-foreground">
                  Threshold accuracy & trends
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exercises" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-foreground">All Exercises</h2>
            <Button onClick={() => setShowExerciseForm(true)} data-testid="button-add-exercise">
              <Plus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={exerciseSearchTerm}
              onChange={(e) => setExerciseSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-admin-exercise-search"
            />
          </div>

          {/* Collapsible Filters */}
          <div className="space-y-2 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Filters</h4>
              {hasActiveExerciseFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllExerciseFilters} data-testid="button-clear-exercise-filters">
                  Clear All
                </Button>
              )}
            </div>

            {/* Main Muscle Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Main Muscle {selectedMainMuscles.length > 0 && `(${selectedMainMuscles.length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MAIN_MUSCLE_OPTIONS.map((muscle) => (
                    <Badge
                      key={muscle}
                      variant={selectedMainMuscles.includes(muscle) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(muscle, selectedMainMuscles, setSelectedMainMuscles)}
                    >
                      {muscle}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Equipment Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Equipment {selectedEquipment.length > 0 && `(${selectedEquipment.length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {EQUIPMENT_OPTIONS.map((equipment) => (
                    <Badge
                      key={equipment}
                      variant={selectedEquipment.includes(equipment) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(equipment, selectedEquipment, setSelectedEquipment)}
                    >
                      {equipment}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Movement Pattern Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Movement Pattern {selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MOVEMENT_PATTERN_OPTIONS.map((movement) => (
                    <Badge
                      key={movement}
                      variant={selectedMovements.includes(movement) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(movement, selectedMovements, setSelectedMovements)}
                    >
                      {movement}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Movement Type Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Movement Type {selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MOVEMENT_TYPE_OPTIONS.map((movement) => (
                    <Badge
                      key={movement}
                      variant={selectedMovements.includes(movement) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(movement, selectedMovements, setSelectedMovements)}
                    >
                      {movement}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Mechanics Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Mechanics {selectedMechanics.length > 0 && `(${selectedMechanics.length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MECHANICS_OPTIONS.map((mechanic) => (
                    <Badge
                      key={mechanic}
                      variant={selectedMechanics.includes(mechanic) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(mechanic, selectedMechanics, setSelectedMechanics)}
                    >
                      {mechanic}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Level Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Level {selectedLevels.length > 0 && `(${selectedLevels.length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {LEVEL_OPTIONS.map((level) => (
                    <Badge
                      key={level}
                      variant={selectedLevels.includes(level) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(level, selectedLevels, setSelectedLevels)}
                    >
                      {level}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <p className="text-sm text-muted-foreground">{filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} found</p>

          {exercisesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredExercises.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {filteredExercises.map((exercise) => {
                const getLevelColor = (level: string) => {
                  switch (level?.toLowerCase()) {
                    case 'beginner':
                      return 'bg-green-50 text-green-700 border-green-200';
                    case 'intermediate':
                      return 'bg-blue-50 text-blue-700 border-blue-200';
                    case 'advanced':
                      return 'bg-purple-50 text-purple-700 border-purple-200';
                    default:
                      return 'bg-gray-50 text-gray-700 border-gray-200';
                  }
                };

                return (
                  <Card 
                    key={exercise.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer hover:border-primary flex overflow-hidden h-16"
                    onClick={() => {
                      setEditingExercise(exercise);
                      setShowExerciseForm(true);
                    }}
                    data-testid={`card-exercise-${exercise.id}`}
                  >
                    <div className="p-4 flex-1 flex flex-col space-y-2 min-w-0 justify-center">
                      <div>
                        <h3 className="font-semibold text-foreground text-base break-words" style={{ textWrap: 'pretty' }}>
                          {exercise.name}
                        </h3>
                      </div>
                    </div>

                    <div className="w-1/3 flex-shrink-0 h-full" onClick={(e) => e.stopPropagation()}>
                      {exercise.muxPlaybackId ? (
                        <img 
                          src={`https://image.mux.com/${exercise.muxPlaybackId}/thumbnail.jpg?time=1`} 
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
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Dumbbell className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : exercises.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No exercises found yet.</p>
              <p className="text-sm text-muted-foreground">Exercises will appear here as they are added to your library.</p>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-2">No exercises match your filters</p>
              <Button variant="link" onClick={clearAllExerciseFilters}>
                Clear filters
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Educational Videos</h2>
            <Button onClick={() => setShowVideoForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </div>

          {videosLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video: Video) => (
                <Card key={video.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{video.title}</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingVideo(video);
                            setShowVideoForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteVideoMutation.mutate(video.id)}
                          disabled={deleteVideoMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
                      {video.description.slice(0, 100)}...
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{video.category}</Badge>
                      <Badge variant="outline">{Math.floor(video.duration / 60)} min</Badge>
                      <Badge variant="outline">{video.views || 0} views</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="programs" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Training Programmes</h2>
            <Button onClick={() => navigate('/admin/programmes/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Programme
            </Button>
          </div>

          {/* Search and Filter Bar */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by programme name..."
                value={programmeSearchTerm}
                onChange={(e) => setProgrammeSearchTerm(e.target.value)}
                className="flex-1"
                data-testid="input-programme-search"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProgrammeFiltersOpen(!programmeFiltersOpen)}
                className="gap-2"
                data-testid="button-programme-filters"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              {hasActiveProgrammeFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllProgrammeFilters}
                  className="text-xs"
                  data-testid="button-clear-programme-filters"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Filters Panel */}
            {programmeFiltersOpen && (
              <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold block mb-2">Difficulty</label>
                    <div className="space-y-2">
                      {uniqueDifficulties.map(difficulty => (
                        <div key={difficulty} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`diff-${difficulty}`}
                            checked={selectedProgrammeDifficulty.includes(difficulty)}
                            onChange={() => toggleFilter(difficulty, selectedProgrammeDifficulty, setSelectedProgrammeDifficulty)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`diff-${difficulty}`} className="text-sm cursor-pointer capitalize">{difficulty}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Equipment</label>
                    <div className="space-y-2">
                      {EQUIPMENT_OPTIONS.map(equip => (
                        <div key={equip} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`equip-${equip}`}
                            checked={selectedProgrammeEquipment.includes(equip)}
                            onChange={() => toggleFilter(equip, selectedProgrammeEquipment, setSelectedProgrammeEquipment)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`equip-${equip}`} className="text-sm cursor-pointer">{equip}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Programme Length</label>
                    <div className="space-y-2">
                      {uniqueWeeks.map(weeks => (
                        <div key={weeks} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`weeks-${weeks}`}
                            checked={selectedProgrammeWeeks.includes(weeks)}
                            onChange={() => {
                              if (selectedProgrammeWeeks.includes(weeks)) {
                                setSelectedProgrammeWeeks(selectedProgrammeWeeks.filter(w => w !== weeks));
                              } else {
                                setSelectedProgrammeWeeks([...selectedProgrammeWeeks, weeks]);
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`weeks-${weeks}`} className="text-sm cursor-pointer">{weeks} Weeks</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Focus</label>
                    <div className="space-y-2">
                      {FOCUS_OPTIONS.map(focus => (
                        <div key={focus} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`focus-${focus}`}
                            checked={selectedProgrammeFocus.includes(focus)}
                            onChange={() => toggleFilter(focus, selectedProgrammeFocus, setSelectedProgrammeFocus)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`focus-${focus}`} className="text-sm cursor-pointer">{focus}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Tags</label>
                    <div className="space-y-2">
                      {uniqueTags.map(tag => (
                        <div key={tag} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`tag-${tag}`}
                            checked={filteredTags.includes(tag)}
                            onChange={() => toggleFilter(tag, filteredTags, setFilteredTags)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer">{tag}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {programsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : hasActiveProgrammeFilters ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">{filteredProgrammes.length} programme{filteredProgrammes.length !== 1 ? 's' : ''} found</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProgrammes.map((program: Program) => (
                  <Card key={program.id} className="overflow-hidden">
                    <div className="relative h-40 bg-gradient-to-br from-gray-700 to-gray-900">
                      {program.imageUrl ? (
                        <img src={program.imageUrl} alt={program.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dumbbell className="w-10 h-10 text-white/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button size="sm" variant="secondary" className="h-7 w-7 p-0 bg-white/20 backdrop-blur-sm hover:bg-white/40" onClick={() => navigate(`/admin/programmes/${program.id}`)}>
                          <Edit className="h-3.5 w-3.5 text-white" />
                        </Button>
                        <Button size="sm" variant="secondary" className="h-7 w-7 p-0 bg-red-500/60 backdrop-blur-sm hover:bg-red-500/80" onClick={() => setDeleteProgrammeId(program.id)} disabled={deleteProgrammeMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5 text-white" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="text-white font-bold text-sm leading-tight line-clamp-2">{program.title}</h4>
                        <div className="flex items-center gap-1.5 text-white/70 mt-1">
                          <span className="text-xs">{program.weeks}w</span>
                          <span className="text-white/40">·</span>
                          <span className="text-xs capitalize">{program.difficulty}</span>
                          <span className="text-white/40">·</span>
                          <span className="text-xs">{program.trainingDaysPerWeek}d/wk</span>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-2.5">
                      <div className="flex flex-wrap gap-1">
                        {program.tags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag.replace(/_/g, ' ')}</Badge>
                        ))}
                        {program.goal && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{program.goal.replace(/_/g, ' ')}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                { key: "all", title: "All Programmes", filter: () => true },
                { key: "gym", title: "Gym", filter: (p: Program) => (p.category || []).includes("gym") },
                { key: "home", title: "Home", filter: (p: Program) => (p.category || []).includes("home") },
                { key: "travel", title: "Great for Travel", filter: (p: Program) => (p.category || []).includes("travel") },
                { key: "female_specific", title: "Female Specific", filter: (p: Program) => (p.category || []).includes("female_specific") },
                { key: "corrective", title: "Corrective Exercise", filter: (p: Program) => p.programmeType === "corrective" },
              ].map((section) => {
                const sectionProgrammes = programs.filter(section.filter);
                if (sectionProgrammes.length === 0 && section.key !== "all") return null;
                return (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-foreground">{section.title}</h3>
                      <Badge variant="outline" className="text-xs">{sectionProgrammes.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {sectionProgrammes.map((program: Program) => (
                        <Card key={program.id} className="overflow-hidden group">
                          <div className="relative h-40 bg-gradient-to-br from-gray-700 to-gray-900">
                            {program.imageUrl ? (
                              <img src={program.imageUrl} alt={program.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="w-10 h-10 text-white/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="secondary" className="h-7 w-7 p-0 bg-white/20 backdrop-blur-sm hover:bg-white/40" onClick={() => navigate(`/admin/programmes/${program.id}`)}>
                                <Edit className="h-3.5 w-3.5 text-white" />
                              </Button>
                              <Button size="sm" variant="secondary" className="h-7 w-7 p-0 bg-red-500/60 backdrop-blur-sm hover:bg-red-500/80" onClick={() => setDeleteProgrammeId(program.id)} disabled={deleteProgrammeMutation.isPending}>
                                <Trash2 className="h-3.5 w-3.5 text-white" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <h4 className="text-white font-bold text-sm leading-tight line-clamp-2">{program.title}</h4>
                              <div className="flex items-center gap-1.5 text-white/70 mt-1">
                                <span className="text-xs">{program.weeks}w</span>
                                <span className="text-white/40">·</span>
                                <span className="text-xs capitalize">{program.difficulty}</span>
                                <span className="text-white/40">·</span>
                                <span className="text-xs">{program.trainingDaysPerWeek}d/wk</span>
                              </div>
                            </div>
                          </div>
                          <CardContent className="p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {program.tags?.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag.replace(/_/g, ' ')}</Badge>
                              ))}
                              {program.goal && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{program.goal.replace(/_/g, ' ')}</Badge>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Nutrition Recipes</h2>
            <Button onClick={() => setShowRecipeForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          </div>

          {recipesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipes.map((recipe: Recipe) => (
                <Card key={recipe.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{recipe.title}</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRecipe(recipe);
                            setShowRecipeForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRecipeMutation.mutate(recipe.id)}
                          disabled={deleteRecipeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
                      {recipe.description.slice(0, 100)}...
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary">{recipe.category}</Badge>
                      <Badge variant="outline">{recipe.difficulty}</Badge>
                      <Badge variant="outline">{recipe.totalTime} min</Badge>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-muted-foreground">
                      {recipe.calories} cal • {recipe.protein}g protein
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="workouts">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Workouts</h2>
              <Button onClick={() => navigate('/admin/create-workout')}><Plus className="h-4 w-4 mr-2" />Add Workout</Button>
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  placeholder="Search workouts..."
                  value={workoutSearchTerm}
                  onChange={(e) => setWorkoutSearchTerm(e.target.value)}
                  className="w-full"
                  data-testid="input-workout-search"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setWorkoutFiltersOpen(!workoutFiltersOpen)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${workoutFiltersOpen ? 'rotate-180' : ''}`} />
              </Button>
              {(workoutSearchTerm || selectedWorkoutCategory.length > 0 || selectedWorkoutDifficulty.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWorkoutSearchTerm("");
                    setSelectedWorkoutCategory([]);
                    setSelectedWorkoutDifficulty([]);
                  }}
                  className="text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {workoutFiltersOpen && (workouts as any[]).length > 0 && (
              <Card className="p-4 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold block mb-2">Category</label>
                    <div className="space-y-2">
                      {Array.from(new Set((workouts as any[]).map((w: any) => w.category).filter(Boolean))).map(category => (
                        <div key={category} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`cat-${category}`}
                            checked={selectedWorkoutCategory.includes(category as string)}
                            onChange={() => toggleFilter(category as string, selectedWorkoutCategory, setSelectedWorkoutCategory)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`cat-${category}`} className="text-sm cursor-pointer capitalize">{category}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Difficulty</label>
                    <div className="space-y-2">
                      {Array.from(new Set((workouts as any[]).map((w: any) => w.difficulty).filter(Boolean))).map(difficulty => (
                        <div key={difficulty} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`wdiff-${difficulty}`}
                            checked={selectedWorkoutDifficulty.includes(difficulty as string)}
                            onChange={() => toggleFilter(difficulty as string, selectedWorkoutDifficulty, setSelectedWorkoutDifficulty)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`wdiff-${difficulty}`} className="text-sm cursor-pointer capitalize">{difficulty}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {(workouts as any[]).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWorkouts.map((workout: any) => (
                  <Card key={workout.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg truncate max-w-[200px]">{workout.title || workout.name}</CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={async () => {
                            // Fetch the structured blocks from the API (the workouts list endpoint
                            // doesn't include block_exercises rows, only the legacy `exercises` JSON
                            // column, which is missing the IDs and exerciseName fields the editor needs).
                            sessionStorage.removeItem('workoutEditContext');
                            try {
                              const [blocksRes, libRes] = await Promise.all([
                                fetch(`/api/workouts/${workout.id}/exercises`, { credentials: 'include' }),
                                fetch(`/api/exercises`, { credentials: 'include' }),
                              ]);
                              const rawBlocks = blocksRes.ok ? await blocksRes.json() : [];
                              const lib: any[] = libRes.ok ? await libRes.json() : [];
                              const libById = new Map<number, any>(lib.map((e) => [e.id, e]));

                              const isBlockShape = Array.isArray(rawBlocks) && rawBlocks.length > 0 && (rawBlocks[0]?.blockType !== undefined || rawBlocks[0]?.exercises !== undefined);
                              const blocks = isBlockShape
                                ? rawBlocks.map((b: any, bi: number) => ({
                                    id: String(b.id ?? `b-${bi}-${Date.now()}`),
                                    blockType: b.blockType || 'single',
                                    section: b.section || 'main',
                                    position: b.position ?? bi,
                                    rest: b.rest || '60 sec',
                                    restDuration: b.blockType === 'rest' ? (b.rest || '30 sec') : undefined,
                                    rounds: b.rounds ?? null,
                                    restAfterRound: b.restAfterRound ?? null,
                                    exercises: (b.exercises || []).map((ex: any, ei: number) => {
                                      const libEx = ex.exerciseLibraryId ? libById.get(ex.exerciseLibraryId) : null;
                                      return {
                                        id: String(ex.id ?? `e-${bi}-${ei}-${Date.now()}`),
                                        exerciseLibraryId: ex.exerciseLibraryId ?? null,
                                        exerciseName: libEx?.name || ex.exerciseName || ex.name || '',
                                        imageUrl: libEx?.imageUrl || ex.imageUrl || null,
                                        sets: Array.isArray(ex.sets) && ex.sets.length > 0 ? ex.sets : [],
                                        tempo: ex.tempo ?? null,
                                        load: ex.load ?? null,
                                        notes: ex.notes ?? null,
                                        durationType: ex.durationType ?? null,
                                      };
                                    }),
                                  }))
                                : [];

                              sessionStorage.setItem('workoutFormData', JSON.stringify({
                                id: workout.id,
                                title: workout.title,
                                description: workout.description || "",
                                workoutType: workout.workoutType || "regular",
                                category: workout.category,
                                difficulty: workout.difficulty,
                                duration: workout.duration,
                                equipment: workout.equipment || [],
                                blocks,
                                imageUrl: workout.imageUrl || "",
                                muxPlaybackId: workout.muxPlaybackId || "",
                                videoUrl: workout.videoUrl || "",
                                routineType: workout.routineType || "",
                                intervalRounds: workout.intervalRounds || 3,
                                intervalRestAfterRound: workout.intervalRestAfterRound || "60 sec",
                              }));
                              sessionStorage.setItem('workoutStep', '2');
                              navigate('/admin/create-workout');
                            } catch (err) {
                              toast({ title: "Couldn't open workout", description: "Failed to load workout details", variant: "destructive" });
                            }
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteWorkoutMutation.mutate(workout.id)} disabled={deleteWorkoutMutation.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{workout.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{workout.category}</Badge>
                        <Badge variant="outline">{workout.difficulty}</Badge>
                        <Badge variant="outline">{workout.duration} min</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">{workoutSearchTerm || selectedWorkoutCategory.length > 0 || selectedWorkoutDifficulty.length > 0 ? "No workouts match your filters." : "No workouts found yet."}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="breathwork">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Breathwork Sessions</h2>
              <Button onClick={() => {
                resetBreathTechniqueForm();
                setEditingBreathTechnique(null);
                setShowBreathTechniqueForm(true);
              }} data-testid="button-add-breath-technique"><Plus className="h-4 w-4 mr-2" />Add Session</Button>
            </div>
            {(breathworkSessions as any[]).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(breathworkSessions as any[]).map((session: any) => (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingBreathTechnique(session);
                            setBreathTechniqueFormData({
                              name: session.name || "",
                              slug: session.slug || "",
                              description: session.description || "",
                              category: session.category || "relaxation",
                              difficulty: session.difficulty || "beginner",
                              defaultDurationMinutes: session.defaultDurationMinutes || 5,
                              inhaleSeconds: session.inhaleSeconds || 4,
                              holdAfterInhaleSeconds: session.holdAfterInhaleSeconds || 0,
                              exhaleSeconds: session.exhaleSeconds || 4,
                              holdAfterExhaleSeconds: session.holdAfterExhaleSeconds || 0,
                              defaultRounds: session.defaultRounds || 4,
                              isActive: session.isActive ?? true,
                              sortOrder: session.sortOrder || 0,
                            });
                            setShowBreathTechniqueForm(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteBreathTechniqueMutation.mutate(session.id)} disabled={deleteBreathTechniqueMutation.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{session.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{session.category}</Badge>
                        <Badge variant="outline">{session.difficulty}</Badge>
                        <Badge variant="outline">{session.defaultDurationMinutes} min</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No breathwork sessions found yet.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mindfulness">
          <AdminMindfulnessTab tools={mindfulnessTools as any[]} />
        </TabsContent>

        <TabsContent value="desk-health">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Workday Engine Admin</h2>
            <p className="text-muted-foreground">Manage all workday health content including positions, micro-resets, aches & fixes, and desk setups.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => navigate('/admin/workday/positions')}
                data-testid="card-admin-workday-positions"
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    Working Positions
                  </CardTitle>
                  <CardDescription>Manage desk working positions (sitting, standing, etc.)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Manage Positions</Button>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => navigate('/admin/workday/micro-resets')}
                data-testid="card-admin-workday-micro-resets"
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Play className="h-5 w-5 text-primary" />
                    Micro-Resets
                  </CardTitle>
                  <CardDescription>Manage quick desk movements and stretch breaks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Manage Micro-Resets</Button>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => navigate('/admin/workday/aches-fixes')}
                data-testid="card-admin-workday-aches-fixes"
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Aches & Fixes
                  </CardTitle>
                  <CardDescription>Manage common desk aches and their relief exercises</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Manage Aches & Fixes</Button>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => navigate('/admin/workday/desk-setups')}
                data-testid="card-admin-workday-desk-setups"
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Desk Setups
                  </CardTitle>
                  <CardDescription>Manage desk setup gallery and ergonomic tips</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Manage Desk Setups</Button>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => navigate('/admin/workday/desk-references')}
                data-testid="card-admin-workday-desk-references"
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Desk Reference Photos
                  </CardTitle>
                  <CardDescription>Choose the "ideal setup" example shown in AI Desk Analyzer</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">Manage Reference Photos</Button>
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="learn">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Learn</h2>
            
            <div className="flex gap-2">
              <button
                onClick={() => setLearningTab("learning-paths")}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  learningTab === "learning-paths"
                    ? "bg-blue-500 text-foreground"
                    : "bg-card text-slate-300 hover:bg-muted"
                }`}
              >
                Learning Paths
              </button>
              <button
                onClick={() => setLearningTab("learn-videos")}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  learningTab === "learn-videos"
                    ? "bg-blue-500 text-foreground"
                    : "bg-card text-slate-300 hover:bg-muted"
                }`}
              >
                Video Topics
              </button>
            </div>

            {learningTab === "learning-paths" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <Button onClick={() => setShowCreatePathModal(true)}><Plus className="h-4 w-4 mr-2" />Add Path</Button>
                </div>
                
                {(learningPaths as any[]).length > 0 && (
                  <>
                    <div className="flex gap-4 items-center">
                      <label className="text-sm font-medium">Filter by Topic:</label>
                      <select
                        value={selectedTopic}
                        onChange={(e) => {
                          setSelectedTopic(e.target.value);
                          setPathsPage(1);
                        }}
                        className="px-3 py-2 bg-card text-foreground border border-border rounded"
                      >
                        <option value="">All Topics</option>
                        {Array.from(new Set((learningPaths as any[]).map((p: any) => (p.topic || p.category)?.toLowerCase()))).sort().map((topic) => (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const filteredPaths = (learningPaths as any[])
                        .filter(path => !selectedTopic || (path.topic || path.category)?.toLowerCase() === selectedTopic)
                        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
                      
                      const ITEMS_PER_PAGE = 10;
                      const totalPages = Math.ceil(filteredPaths.length / ITEMS_PER_PAGE);
                      const startIdx = (pathsPage - 1) * ITEMS_PER_PAGE;
                      const endIdx = startIdx + ITEMS_PER_PAGE;
                      const paginatedPaths = filteredPaths.slice(startIdx, endIdx);

                      return (
                        <>
                          {filteredPaths.length > 0 ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {paginatedPaths.map((path: any) => (
                                  <Card key={path.id} id={`learning-path-${path.id}`}>
                                    <CardHeader>
                                      <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">{path.title || path.name}</CardTitle>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => navigate(`/admin/edit-path/${path.id}`)}
                                            data-testid={`button-edit-path-${path.id}`}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => setDeletePathId(path.id)}
                                            disabled={deletePathMutation.isPending}
                                            data-testid={`button-delete-path-${path.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm text-muted-foreground">{path.description || 'No description'}</p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                              
                              {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-6">
                                  <span className="text-sm text-muted-foreground">
                                    Page {pathsPage} of {totalPages} ({filteredPaths.length} total)
                                  </span>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      disabled={pathsPage === 1}
                                      onClick={() => setPathsPage(p => p - 1)}
                                    >
                                      Previous
                                    </Button>
                                    <Button
                                      variant="outline"
                                      disabled={pathsPage === totalPages}
                                      onClick={() => setPathsPage(p => p + 1)}
                                    >
                                      Next
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <Card className="p-12 text-center">
                              <p className="text-muted-foreground">No learning paths found for selected topic.</p>
                            </Card>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}

                {(learningPaths as any[]).length === 0 && (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No learning paths found yet.</p>
                  </Card>
                )}
              </div>
            )}

            {learningTab === "learn-videos" && (
              <div className="space-y-6">
                {!selectedVideoTopic ? (
                  <>
                    {(learnVideoTopics as any[]).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(learnVideoTopics as any[]).map((topic: any) => (
                          <Card 
                            key={topic.id}
                            className="cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => setSelectedVideoTopic(topic.id)}
                          >
                            <CardHeader>
                              <CardTitle className="text-lg">{topic.title || topic.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">{topic.description || 'No description'}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-12 text-center">
                        <p className="text-muted-foreground">No learn video topics found yet.</p>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedVideoTopic(null)}
                      className="text-blue-500 hover:text-blue-400 font-medium mb-4"
                    >
                      ← Back to Topics
                    </button>
                    {(() => {
                      const topic = (learnVideoTopics as any[]).find(t => t.id === selectedVideoTopic);
                      const contentItems = (selectedTopicContent as any[]) || [];
                      
                      return (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-foreground">{topic?.title} Content</h2>
                            <Button 
                              onClick={() => {
                                setSelectedTopicForContent(selectedVideoTopic);
                                setShowAddContentModal(true);
                              }}
                            >
                              + Add Content
                            </Button>
                          </div>
                          
                          {contentItems.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {contentItems.map((item: any) => (
                                <Card 
                                  key={item.id}
                                  className="cursor-pointer hover:shadow-lg transition-shadow"
                                  onClick={() => {
                                    setEditingContentItem(item);
                                    setEditingContentTitle(item.title);
                                    setEditingContentDescription(item.description || '');
                                    setEditingContentMuxPlaybackId(item.mux_playback_id || item.muxPlaybackId || '');
                                  }}
                                >
                                  <CardHeader>
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <p className="text-sm text-muted-foreground">{item.description || 'No description'}</p>
                                    <p className="text-xs text-slate-400 mt-2">Type: {item.content_type}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <Card className="p-12 text-center">
                              <p className="text-muted-foreground mb-4">No content found for this topic.</p>
                              <p className="text-sm text-slate-400">Content will appear here once you add videos or PDFs for this topic.</p>
                              <div className="flex gap-2 justify-center mt-4">
                                <Button onClick={() => setShowCreateVideoModal(true)}>Add Video</Button>
                                <Button variant="outline" onClick={() => setShowCreatePdfModal(true)}>Add PDF</Button>
                              </div>
                            </Card>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="body-map">
          <BodyMapConfig />
        </TabsContent>

        <TabsContent value="stretching">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Stretching & Mobility</h2>
            </div>
            
            {/* Sub-tabs for Programmes and Workouts */}
            <div className="flex gap-2 border-b border-border pb-2">
              <Button 
                variant={stretchingSubTab === "programmes" ? "default" : "ghost"}
                onClick={() => setStretchingSubTab("programmes")}
              >
                Programmes
              </Button>
              <Button 
                variant={stretchingSubTab === "workouts" ? "default" : "ghost"}
                onClick={() => setStretchingSubTab("workouts")}
              >
                Individual Workouts
              </Button>
            </div>

            {stretchingSubTab === "programmes" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => navigate('/admin/programmes/new?programmeType=stretching')}>
                    <Plus className="h-4 w-4 mr-2" />Add Programme
                  </Button>
                </div>
                {stretchingProgrammes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stretchingProgrammes.map((program: Program) => (
                      <Card key={program.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{program.title}</CardTitle>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/programmes/${program.id}?programmeType=stretching`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteProgrammeId(program.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{program.description || 'No description'}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{program.weeks} weeks</Badge>
                            <Badge variant="outline">{program.difficulty}</Badge>
                            <Badge variant="outline">{program.trainingDaysPerWeek} days/week</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No stretching programmes added yet.</p>
                  </Card>
                )}
              </div>
            )}

            {stretchingSubTab === "workouts" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => {
                    sessionStorage.removeItem('stretchingFormData');
                    navigate('/admin/stretching/create');
                  }}>
                    <Plus className="h-4 w-4 mr-2" />Add Routine
                  </Button>
                </div>
                {stretchingRoutines.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stretchingRoutines.map((item: Workout) => (
                      <Card key={item.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{item.title || 'Untitled Routine'}</CardTitle>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                sessionStorage.setItem('stretchingFormData', JSON.stringify({
                                  id: item.id,
                                  title: item.title,
                                  description: item.description || '',
                                  category: item.category,
                                  difficulty: item.difficulty,
                                  duration: item.duration,
                                  equipment: item.equipment || [],
                                  blocks: (item as any).blocks || item.exercises || [],
                                  routineType: 'stretching',
                                  workoutType: (item as any).workoutType || 'regular',
                                  videoUrl: (item as any).videoUrl || '',
                                }));
                                navigate('/admin/stretching/create');
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                try {
                                  await fetch(`/api/workouts/${item.id}`, { method: 'DELETE' });
                                  queryClient.invalidateQueries({ queryKey: ["/api/workouts", "stretching"] });
                                  toast({ title: "Success", description: "Routine deleted" });
                                } catch (error) {
                                  toast({ title: "Error", description: "Failed to delete routine", variant: "destructive" });
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{item.description || 'No description'}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{item.category}</Badge>
                            <Badge variant="outline">{item.duration} min</Badge>
                            {(item as any).workoutType && (item as any).workoutType !== 'regular' && (
                              <Badge variant="outline" className="capitalize">{(item as any).workoutType}</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No stretching routines added yet.</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="yoga">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Yoga</h2>
              <Button onClick={() => {
                sessionStorage.removeItem('yogaFormData');
                navigate('/admin/yoga/create');
              }}><Plus className="h-4 w-4 mr-2" />Add Class</Button>
            </div>
            {yogaClasses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {yogaClasses.map((item: Workout) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{item.title || 'Untitled Class'}</CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            sessionStorage.setItem('yogaFormData', JSON.stringify({
                              id: item.id,
                              title: item.title,
                              description: item.description || '',
                              category: item.category,
                              difficulty: item.difficulty,
                              duration: item.duration,
                              equipment: item.equipment || [],
                              blocks: (item as any).blocks || item.exercises || [],
                              routineType: 'yoga',
                              workoutType: (item as any).workoutType || 'regular',
                              videoUrl: (item as any).videoUrl || '',
                            }));
                            navigate('/admin/yoga/create');
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={async () => {
                            try {
                              await fetch(`/api/workouts/${item.id}`, { method: 'DELETE' });
                              queryClient.invalidateQueries({ queryKey: ["/api/workouts", "yoga"] });
                              toast({ title: "Success", description: "Yoga class deleted" });
                            } catch (error) {
                              toast({ title: "Error", description: "Failed to delete yoga class", variant: "destructive" });
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{item.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{item.category}</Badge>
                        <Badge variant="outline">{item.duration} min</Badge>
                        {(item as any).workoutType && (item as any).workoutType !== 'regular' && (
                          <Badge variant="outline" className="capitalize">{(item as any).workoutType}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No yoga classes added yet.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="corrective">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Corrective Exercise</h2>
            </div>
            
            {/* Sub-tabs for Programmes and Workouts */}
            <div className="flex gap-2 border-b border-border pb-2">
              <Button 
                variant={correctiveSubTab === "programmes" ? "default" : "ghost"}
                onClick={() => setCorrectiveSubTab("programmes")}
              >
                Programmes
              </Button>
              <Button 
                variant={correctiveSubTab === "workouts" ? "default" : "ghost"}
                onClick={() => setCorrectiveSubTab("workouts")}
              >
                Individual Workouts
              </Button>
            </div>

            {correctiveSubTab === "programmes" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => navigate('/admin/programmes/new?programmeType=corrective')}>
                    <Plus className="h-4 w-4 mr-2" />Add Programme
                  </Button>
                </div>
                {correctiveProgrammes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {correctiveProgrammes.map((program: Program) => (
                      <Card key={program.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{program.title}</CardTitle>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/programmes/${program.id}?programmeType=corrective`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteProgrammeId(program.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{program.description || 'No description'}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{program.weeks} weeks</Badge>
                            <Badge variant="outline">{program.trainingDaysPerWeek} days/week</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No corrective exercise programmes added yet.</p>
                  </Card>
                )}
              </div>
            )}

            {correctiveSubTab === "workouts" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => {
                    sessionStorage.removeItem('correctiveFormData');
                    navigate('/admin/corrective/create');
                  }}>
                    <Plus className="h-4 w-4 mr-2" />Add Routine
                  </Button>
                </div>
                {correctiveRoutines.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {correctiveRoutines.map((item: Workout) => (
                      <Card key={item.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{item.title || 'Untitled Routine'}</CardTitle>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                sessionStorage.setItem('correctiveFormData', JSON.stringify({
                                  id: item.id,
                                  title: item.title,
                                  description: item.description || '',
                                  category: item.category,
                                  difficulty: item.difficulty,
                                  duration: item.duration,
                                  equipment: item.equipment || [],
                                  blocks: (item as any).blocks || item.exercises || [],
                                  routineType: 'corrective',
                                  workoutType: (item as any).workoutType || 'regular',
                                  videoUrl: (item as any).videoUrl || '',
                                }));
                                navigate('/admin/corrective/create');
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                try {
                                  await fetch(`/api/workouts/${item.id}`, { method: 'DELETE' });
                                  queryClient.invalidateQueries({ queryKey: ["/api/workouts", "corrective"] });
                                  toast({ title: "Success", description: "Routine deleted" });
                                } catch (error) {
                                  toast({ title: "Error", description: "Failed to delete routine", variant: "destructive" });
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{item.description || 'No description'}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{item.category}</Badge>
                            <Badge variant="outline">{item.duration} min</Badge>
                            {(item as any).workoutType && (item as any).workoutType !== 'regular' && (
                              <Badge variant="outline" className="capitalize">{(item as any).workoutType}</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No corrective exercise routines added yet.</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
        </div>
      </div>

      {/* Add Content Modal */}
      {showAddContentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Content</CardTitle>
              <button
                onClick={() => {
                  setShowAddContentModal(false);
                  setSelectedTopicForContent(null);
                  setNewContentTitle('');
                  setNewContentDescription('');
                  setContentFile(null);
                  setAddContentMuxPlaybackId('');
                  setAddContentDocFiles([]);
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  value={newContentTitle}
                  onChange={(e) => setNewContentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  placeholder="Content title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={newContentDescription}
                  onChange={(e) => setNewContentDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  rows={3}
                  placeholder="Content description"
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Mux Playback ID (for video)</label>
                  <input
                    type="text"
                    value={addContentMuxPlaybackId}
                    onChange={(e) => setAddContentMuxPlaybackId(e.target.value)}
                    className="w-full px-3 py-2 bg-card text-foreground border border-border rounded"
                    placeholder="Enter Mux Playback ID (e.g., abc123xyz)"
                  />
                  <p className="text-xs text-slate-500 mt-1">Get the Playback ID from your Mux dashboard after uploading the video</p>
                </div>


                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Add PDF Documents</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.doc,.docx"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAddContentDocFiles(prev => [...prev, ...Array.from(e.target.files)]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-card text-foreground border border-border rounded"
                  />
                  {addContentDocFiles.length > 0 && (
                    <div className="text-xs text-blue-400 mt-2 space-y-1">
                      {addContentDocFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <p>✓ {file.name}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setAddContentDocFiles(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddContentModal(false);
                    setSelectedTopicForContent(null);
                    setNewContentTitle('');
                    setNewContentDescription('');
                    setAddContentMuxPlaybackId('');
                    setAddContentDocFiles([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const topicId = selectedTopicForContent || selectedVideoTopic;

                    try {
                      if (addContentMuxPlaybackId) {
                        const response = await fetch(`/api/learn-topics/${topicId}/content`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: newContentTitle,
                            description: newContentDescription,
                            contentType: 'video',
                            muxPlaybackId: addContentMuxPlaybackId,
                          }),
                        });
                        if (!response.ok) throw new Error('Failed to add video');
                      } else if (addContentDocFiles.length > 0) {
                        for (const file of addContentDocFiles) {
                          const formData = new FormData();
                          formData.append('title', newContentTitle);
                          formData.append('description', newContentDescription);
                          formData.append('contentType', 'pdf');
                          formData.append('file', file);
                          const response = await fetch(`/api/learn-topics/${topicId}/content`, {
                            method: 'POST',
                            body: formData,
                          });
                          if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
                        }
                      }
                      
                      toast({ title: 'Success', description: 'Content added successfully' });
                      setShowAddContentModal(false);
                      setSelectedTopicForContent(null);
                      setNewContentTitle('');
                      setNewContentDescription('');
                      setAddContentMuxPlaybackId('');
                      setAddContentDocFiles([]);
                      queryClient.invalidateQueries({ queryKey: [`/api/content-library/topic/${topicId}`] });
                    } catch (error) {
                      toast({ title: 'Error', description: 'Failed to upload content', variant: 'destructive' });
                    }
                  }}
                  disabled={!newContentTitle || (!addContentMuxPlaybackId && addContentDocFiles.length === 0)}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Video Modal */}
      {showCreateVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Video</CardTitle>
              <button
                onClick={() => {
                  setShowCreateVideoModal(false);
                  setNewContentTitle('');
                  setNewContentDescription('');
                  setContentMuxPlaybackId('');
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  value={newContentTitle}
                  onChange={(e) => setNewContentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  placeholder="Video title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={newContentDescription}
                  onChange={(e) => setNewContentDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  rows={2}
                  placeholder="Video description"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Mux Playback ID</label>
                <input
                  type="text"
                  value={contentMuxPlaybackId}
                  onChange={(e) => setContentMuxPlaybackId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  placeholder="Enter Mux Playback ID (e.g., abc123xyz)"
                />
                <p className="text-xs text-slate-500 mt-1">Get the Playback ID from your Mux dashboard</p>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateVideoModal(false);
                    setNewContentTitle('');
                    setNewContentDescription('');
                    setContentMuxPlaybackId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createVideoMutation.mutate()}
                  disabled={createVideoMutation.isPending || !newContentTitle || !contentMuxPlaybackId}
                >
                  {createVideoMutation.isPending ? 'Saving...' : 'Add Video'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create PDF Modal */}
      {showCreatePdfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add PDF</CardTitle>
              <button
                onClick={() => {
                  setShowCreatePdfModal(false);
                  setNewContentTitle('');
                  setNewContentDescription('');
                  setContentFile(null);
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  value={newContentTitle}
                  onChange={(e) => setNewContentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  placeholder="PDF title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={newContentDescription}
                  onChange={(e) => setNewContentDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  rows={2}
                  placeholder="PDF description"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setContentFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePdfModal(false);
                    setNewContentTitle('');
                    setNewContentDescription('');
                    setContentFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createPdfMutation.mutate()}
                  disabled={createPdfMutation.isPending || !newContentTitle || !contentFile}
                >
                  {createPdfMutation.isPending ? 'Uploading...' : 'Add PDF'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Content Item Modal */}
      {editingContentItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Edit Content</CardTitle>
              <button
                onClick={() => {
                  setEditingContentItem(null);
                  setEditingContentFile(null);
                  setEditingContentMuxPlaybackId('');
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  value={editingContentTitle}
                  onChange={(e) => setEditingContentTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={editingContentDescription}
                  onChange={(e) => setEditingContentDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  rows={3}
                />
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Add Video (Mux Playback ID)</label>
                  <input
                    type="text"
                    value={editingContentMuxPlaybackId}
                    onChange={(e) => setEditingContentMuxPlaybackId(e.target.value)}
                    placeholder="Enter Mux Playback ID"
                    className="w-full px-3 py-2 bg-card text-foreground border border-border rounded"
                  />
                  <p className="text-xs text-slate-400 mt-1">Get this from your Mux dashboard</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Add PDF Documents</label>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setEditingContentFile(e.target.files[0]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-card text-foreground border border-border rounded"
                  />
                  {editingContentFile && <p className="text-xs text-blue-400 mt-1">New file selected: {editingContentFile.name}</p>}
                </div>
              </div>

              <div className="flex gap-2 justify-between pt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
                      deleteContentMutation.mutate(editingContentItem.id);
                    }
                  }}
                  disabled={deleteContentMutation.isPending}
                >
                  {deleteContentMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingContentItem(null);
                      setEditingContentFile(null);
                      setEditingContentMuxPlaybackId('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateContentMutation.mutate({
                      title: editingContentTitle,
                      description: editingContentDescription,
                    })}
                    disabled={updateContentMutation.isPending}
                  >
                    {updateContentMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Learning Path Modal */}
      {showCreatePathModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create Learning Path</CardTitle>
              <button
                onClick={() => {
                  setShowCreatePathModal(false);
                  setNewPathTitle("");
                  setNewPathDescription("");
                  setNewPathTopicId(null);
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Topic</label>
                <select
                  value={newPathTopicId || ""}
                  onChange={(e) => setNewPathTopicId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                >
                  <option value="">Select a topic...</option>
                  {(learnVideoTopics as any[]).map((topic: any) => (
                    <option key={topic.id} value={topic.id}>{topic.title || topic.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  value={newPathTitle}
                  onChange={(e) => setNewPathTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  placeholder="Enter path title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  rows={3}
                  placeholder="Enter path description"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePathModal(false);
                    setNewPathTitle("");
                    setNewPathDescription("");
                    setNewPathTopicId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (newPathTopicId && newPathTitle) {
                      createPathMutation.mutate({
                        title: newPathTitle,
                        description: newPathDescription,
                        topicId: newPathTopicId,
                      });
                    }
                  }}
                  disabled={createPathMutation.isPending || !newPathTitle || !newPathTopicId}
                >
                  {createPathMutation.isPending ? 'Creating...' : 'Create Path'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Forms */}
      <ExerciseLibraryForm
        open={showExerciseForm}
        exercise={editingExercise}
        onClose={() => {
          setShowExerciseForm(false);
          setEditingExercise(null);
        }}
      />


      {showVideoForm && (
        <VideoForm
          video={editingVideo}
          onClose={() => {
            setShowVideoForm(false);
            setEditingVideo(null);
          }}
        />
      )}

      {showRecipeForm && (
        <RecipeForm
          recipe={editingRecipe}
          onClose={() => {
            setShowRecipeForm(false);
            setEditingRecipe(null);
          }}
        />
      )}

      {showWorkoutForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{workoutFormStep === 1 ? 'Build new workout' : 'Edit Workout'}</CardTitle>
              <button onClick={() => {
                setShowWorkoutForm(false);
                setWorkoutFormStep(1);
                setWorkoutFormData({ title: "", description: "", workoutType: "regular", category: "strength", difficulty: "beginner", duration: 30, equipment: [], exercises: [] });
              }} className="text-slate-400 hover:text-foreground">✕</button>
            </CardHeader>
            <CardContent className="space-y-4">
              {workoutFormStep === 1 ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Workout name</label>
                    <input type="text" placeholder="Workout name, like Day 1 Abs" value={workoutFormData.title} onChange={(e) => setWorkoutFormData({...workoutFormData, title: e.target.value})} className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" />
                  </div>
                  
                  <div className="pt-4">
                    <label className="text-sm font-medium text-foreground block mb-3">Type of workout</label>
                    <div className="space-y-2">
                      {[
                        { value: 'regular', label: 'Regular', desc: 'Standard workout structure' },
                        { value: 'interval', label: 'Interval', desc: 'Any tempo guided warm-ups, intervals, HIIT features or rest intervals' },
                        { value: 'circuit', label: 'Circuit', desc: 'Exercises performed in succession. Designed to target multiple' },
                        { value: 'video', label: 'Video', desc: 'Follow along workout video for classes, routines, cool down (60 minutes)' }
                      ].map((type) => (
                        <div key={type.value} className="flex items-start p-3 border border-border rounded-lg cursor-pointer hover:bg-card/50 transition-colors" onClick={() => setWorkoutFormData({...workoutFormData, workoutType: type.value})}>
                          <div className="flex items-center h-5">
                            <input type="radio" name="workoutType" value={type.value} checked={workoutFormData.workoutType === type.value} onChange={(e) => setWorkoutFormData({...workoutFormData, workoutType: e.target.value})} className="w-4 h-4" />
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="font-medium text-foreground">{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 justify-end pt-6 border-t border-border">
                    <Button variant="outline" onClick={() => {
                      setShowWorkoutForm(false);
                      setWorkoutFormStep(1);
                      setWorkoutFormData({ title: "", description: "", workoutType: "regular", category: "strength", difficulty: "beginner", duration: 30, equipment: [], exercises: [] });
                    }}>Cancel</Button>
                    <Button onClick={() => {
                      if (workoutFormData.title.trim()) {
                        setWorkoutFormStep(2);
                      }
                    }} className="btn-primary" disabled={!workoutFormData.title.trim()}>
                      START BUILDING
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Title</label>
                    <input type="text" placeholder="Workout title" value={workoutFormData.title} onChange={(e) => setWorkoutFormData({...workoutFormData, title: e.target.value})} className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea placeholder="Workout description" value={workoutFormData.description} onChange={(e) => setWorkoutFormData({...workoutFormData, description: e.target.value})} className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" rows={3} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Category</label>
                    <select value={workoutFormData.category} onChange={(e) => setWorkoutFormData({...workoutFormData, category: e.target.value})} className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded text-left">
                      <option value="strength">Strength</option>
                      <option value="cardio">Cardio</option>
                      <option value="hiit">HIIT</option>
                      <option value="mobility">Mobility</option>
                      <option value="recovery">Recovery</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Difficulty</label>
                    <select value={workoutFormData.difficulty} onChange={(e) => setWorkoutFormData({...workoutFormData, difficulty: e.target.value})} className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded text-left">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                    <input type="number" value={workoutFormData.duration} onChange={(e) => setWorkoutFormData({...workoutFormData, duration: parseInt(e.target.value) || 30})} className="w-24 mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" />
                  </div>
                  <div className="border-t border-border pt-4">
                    <ExerciseManager 
                      exercises={workoutFormData.exercises}
                      onExercisesChange={(exercises) => setWorkoutFormData({...workoutFormData, exercises})}
                      workoutType={workoutFormData.workoutType}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => {
                      if (editingWorkout) {
                        setShowWorkoutForm(false);
                        setWorkoutFormStep(1);
                        setEditingWorkout(null);
                        setWorkoutFormData({ title: "", description: "", workoutType: "regular", category: "strength", difficulty: "beginner", duration: 30, equipment: [], exercises: [] });
                      } else {
                        setWorkoutFormStep(1);
                      }
                    }}>
                      {editingWorkout ? 'Cancel' : 'Back'}
                    </Button>
                    <Button onClick={() => {
                      if (editingWorkout) {
                        updateWorkoutMutation.mutate({ id: editingWorkout.id, data: workoutFormData });
                      } else {
                        createWorkoutMutation.mutate(workoutFormData);
                      }
                    }} disabled={createWorkoutMutation.isPending || updateWorkoutMutation.isPending || !workoutFormData.title}>
                      {createWorkoutMutation.isPending || updateWorkoutMutation.isPending ? 'Saving...' : 'Save Workout'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Programme Confirmation Dialog */}
      <AlertDialog open={deleteProgrammeId !== null} onOpenChange={(open) => !open && setDeleteProgrammeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Programme?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this programme? This will permanently remove the programme and all its workouts, weeks, and associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProgrammeId && deleteProgrammeMutation.mutate(deleteProgrammeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProgrammeMutation.isPending ? 'Deleting...' : 'Delete Programme'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Learning Path Confirmation Dialog */}
      <AlertDialog open={deletePathId !== null} onOpenChange={(open) => !open && setDeletePathId(null)}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Learning Path?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this learning path? This action cannot be undone. The content in the library will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-card border-border hover:bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePathId && deletePathMutation.mutate(deletePathId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePathMutation.isPending ? 'Deleting...' : 'Delete Path'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Breath Technique Form Dialog */}
      {showBreathTechniqueForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingBreathTechnique ? 'Edit Breath Technique' : 'Add Breath Technique'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Box Breathing" 
                    value={breathTechniqueFormData.name} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, name: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Slug</label>
                  <input 
                    type="text" 
                    placeholder="auto-generated" 
                    value={breathTechniqueFormData.slug} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, slug: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description *</label>
                <textarea 
                  placeholder="Describe the breathing technique..." 
                  value={breathTechniqueFormData.description} 
                  onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, description: e.target.value})} 
                  className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  rows={3} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <select 
                    value={breathTechniqueFormData.category} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, category: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  >
                    <option value="relaxation">Relaxation</option>
                    <option value="energy">Energy</option>
                    <option value="focus">Focus</option>
                    <option value="recovery">Recovery</option>
                    <option value="performance">Performance</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Difficulty</label>
                  <select 
                    value={breathTechniqueFormData.difficulty} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, difficulty: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Breathing Pattern (seconds)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Inhale</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={breathTechniqueFormData.inhaleSeconds} 
                      onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, inhaleSeconds: parseInt(e.target.value) || 4})} 
                      className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hold (in)</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={breathTechniqueFormData.holdAfterInhaleSeconds} 
                      onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, holdAfterInhaleSeconds: parseInt(e.target.value) || 0})} 
                      className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Exhale</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={breathTechniqueFormData.exhaleSeconds} 
                      onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, exhaleSeconds: parseInt(e.target.value) || 4})} 
                      className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hold (out)</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={breathTechniqueFormData.holdAfterExhaleSeconds} 
                      onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, holdAfterExhaleSeconds: parseInt(e.target.value) || 0})} 
                      className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Duration (min)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={breathTechniqueFormData.defaultDurationMinutes} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, defaultDurationMinutes: parseInt(e.target.value) || 5})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Default Rounds</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={breathTechniqueFormData.defaultRounds} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, defaultRounds: parseInt(e.target.value) || 4})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Sort Order</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={breathTechniqueFormData.sortOrder} 
                    onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, sortOrder: parseInt(e.target.value) || 0})} 
                    className="w-full mt-1 px-3 py-2 bg-card text-foreground border border-border rounded" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  checked={breathTechniqueFormData.isActive} 
                  onChange={(e) => setBreathTechniqueFormData({...breathTechniqueFormData, isActive: e.target.checked})} 
                  className="rounded border-border"
                />
                <label htmlFor="isActive" className="text-sm text-foreground">Active (visible to users)</label>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <Button variant="outline" onClick={() => {
                  setShowBreathTechniqueForm(false);
                  setEditingBreathTechnique(null);
                  resetBreathTechniqueForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBreathTechniqueSubmit} 
                  disabled={createBreathTechniqueMutation.isPending || updateBreathTechniqueMutation.isPending || !breathTechniqueFormData.name || !breathTechniqueFormData.description}
                >
                  {createBreathTechniqueMutation.isPending || updateBreathTechniqueMutation.isPending ? 'Saving...' : (editingBreathTechnique ? 'Update Technique' : 'Create Technique')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}