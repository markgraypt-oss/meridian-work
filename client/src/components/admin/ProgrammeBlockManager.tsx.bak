import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Trash2, Plus, Layers, Save, Dumbbell, Zap, RotateCcw, Video, ChevronDown as ChevronDownIcon, Timer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type WorkoutType = 'regular' | 'interval' | 'circuit' | 'video';

const WORKOUT_TYPE_INFO = {
  regular: { label: 'Regular', icon: Dumbbell, description: 'Standard structured workout' },
  interval: { label: 'Interval', icon: Zap, description: 'Tempo-based or HIIT workout' },
  circuit: { label: 'Circuit', icon: RotateCcw, description: 'Exercises in succession' },
  video: { label: 'Video', icon: Video, description: 'Follow-along video workout' },
};

const CATEGORIES = ['Strength', 'Cardio', 'HIIT', 'Mobility', 'Recovery'];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

interface ExerciseSet {
  reps: string;
  rest?: string;
  duration?: string;
}

interface BlockExercise {
  id: number;
  blockId: number;
  exerciseLibraryId: number | null;
  exerciseName?: string;
  imageUrl?: string;
  sets: ExerciseSet[];
  durationType?: 'text' | 'timer';
  tempo?: string;
  load?: string;
  notes?: string;
  position: number;
  isRest?: boolean;
  restDuration?: string;
}

interface WorkoutBlock {
  id: number;
  workoutId: number;
  blockType: 'single' | 'superset' | 'triset' | 'circuit' | 'rest';
  section: 'warmup' | 'main';
  position: number;
  rest: string;
  exercises: BlockExercise[];
  rounds?: number;
  restAfterRound?: string;
}

interface ProgrammeBlockManagerProps {
  workoutId: number;
  programId: number;
  programmeType?: string;
  onBlocksUpdated?: () => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
  onDeleteWorkout?: () => void;
}

const BLOCK_EXERCISE_LIMITS: Record<string, number> = {
  single: 1,
  superset: 2,
  triset: 3,
  circuit: 10,
};

let tempIdCounter = -1;
const generateTempId = () => tempIdCounter--;

interface WorkoutDetails {
  id: number;
  name: string;
  description: string | null;
  workoutType: WorkoutType;
  category: string;
  difficulty: string;
  duration: number;
  intervalRounds?: number;
  intervalRestAfterRound?: string;
}

export function ProgrammeBlockManager({ workoutId, programId, programmeType, onBlocksUpdated, onDirtyStateChange, onDeleteWorkout }: ProgrammeBlockManagerProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftBlocks, setDraftBlocks] = useState<WorkoutBlock[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const processedExerciseRef = useRef<string | null>(null);
  
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [draftDetails, setDraftDetails] = useState<WorkoutDetails | null>(null);
  const [detailsDirty, setDetailsDirty] = useState(false);
  
  // Interval mode configuration
  const [intervalRounds, setIntervalRounds] = useState(4);
  const [intervalRestAfterRound, setIntervalRestAfterRound] = useState('No Rest');
  
  const isCircuitMode = draftDetails?.workoutType === 'circuit';
  const isIntervalMode = draftDetails?.workoutType === 'interval';

  const { data: serverBlocks = [], isLoading } = useQuery<WorkoutBlock[]>({
    queryKey: ['/api/programme-workouts', workoutId, 'blocks'],
    queryFn: async () => {
      const res = await fetch(`/api/programme-workouts/${workoutId}/blocks`);
      if (!res.ok) throw new Error('Failed to load blocks');
      return res.json();
    },
    enabled: !!workoutId,
  });

  const { data: workoutDetails, isLoading: loadingDetails } = useQuery<WorkoutDetails>({
    queryKey: ['/api/programme-workouts', workoutId],
    queryFn: async () => {
      const res = await fetch(`/api/programme-workouts/${workoutId}`);
      if (!res.ok) throw new Error('Failed to load workout details');
      return res.json();
    },
    enabled: !!workoutId,
  });

  // Reset all draft state when workoutId changes to ensure we load the correct workout
  useEffect(() => {
    setDraftDetails(null);
    setDetailsDirty(false);
    setDraftBlocks([]);
    setIsInitialized(false);
    setIsDirty(false);
  }, [workoutId]);

  useEffect(() => {
    if (workoutDetails && (!draftDetails || draftDetails.id !== workoutDetails.id)) {
      setDraftDetails({
        id: workoutDetails.id,
        name: workoutDetails.name,
        description: workoutDetails.description,
        workoutType: (workoutDetails.workoutType as WorkoutType) || 'regular',
        category: (workoutDetails.category || 'strength').toLowerCase(),
        difficulty: (workoutDetails.difficulty || 'beginner').toLowerCase(),
        duration: workoutDetails.duration || 30,
        intervalRounds: workoutDetails.intervalRounds,
        intervalRestAfterRound: workoutDetails.intervalRestAfterRound,
      });
      // Initialize interval state from loaded data
      if (workoutDetails.intervalRounds) {
        setIntervalRounds(workoutDetails.intervalRounds);
      }
      if (workoutDetails.intervalRestAfterRound) {
        setIntervalRestAfterRound(workoutDetails.intervalRestAfterRound);
      }
    }
  }, [workoutDetails]);

  const updateDetailsMutation = useMutation({
    mutationFn: async (details: Partial<WorkoutDetails>) => {
      const res = await apiRequest('PATCH', `/api/programme-workouts/${workoutId}`, details);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programme-workouts', workoutId] });
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'workout-templates'] });
      setDetailsDirty(false);
      onBlocksUpdated?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update workout details', variant: 'destructive' });
    },
  });

  const updateDetail = <K extends keyof WorkoutDetails>(key: K, value: WorkoutDetails[K]) => {
    if (draftDetails) {
      setDraftDetails({ ...draftDetails, [key]: value });
      setDetailsDirty(true);
    }
  };

  const { data: libraryExercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
    retry: false,
  });

  // Single unified initialization effect - processes sessionStorage BEFORE falling back to server
  useEffect(() => {
    // Read all sessionStorage values FIRST for debugging
    const savedDraft = sessionStorage.getItem('programmeDraftBlocks');
    const selectedId = sessionStorage.getItem('selectedExerciseId');
    const selectedBlockId = sessionStorage.getItem('selectedProgrammeBlockId');
    const storedProgramId = sessionStorage.getItem('editingProgrammeId');
    
    console.log('INIT EFFECT:', {
      isLoading,
      isInitialized,
      savedDraft: !!savedDraft,
      selectedId,
      selectedBlockId,
      storedProgramId,
      programId,
      libraryExercisesCount: libraryExercises.length,
      processedRef: processedExerciseRef.current
    });
    
    if (isLoading || isInitialized) return;
    
    // If there's a pending selection, wait for library exercises to load
    if (selectedId && libraryExercises.length === 0) {
      return; // Don't initialize yet - wait for exercises
    }
    
    // Skip if already processed this selection (prevents double-processing)
    if (selectedId && processedExerciseRef.current === selectedId) {
      setDraftBlocks(JSON.parse(JSON.stringify(serverBlocks)));
      setIsInitialized(true);
      return;
    }
    
    // PRIORITY 1: Process saved draft with pending exercise selection
    if (savedDraft && storedProgramId === programId.toString()) {
      try {
        let restoredBlocks: WorkoutBlock[] = JSON.parse(savedDraft);
        
        // Add selected exercise if present
        if (selectedId && selectedBlockId) {
          const selectedExercise = libraryExercises.find((e: any) => e.id === parseInt(selectedId));
          const blockIdNum = parseInt(selectedBlockId);
          
          if (selectedExercise) {
            processedExerciseRef.current = selectedId; // Mark as processed
            
            restoredBlocks = restoredBlocks.map(block => {
              if (block.id === blockIdNum) {
                const newExercise: BlockExercise = {
                  id: generateTempId(),
                  blockId: block.id,
                  exerciseLibraryId: selectedExercise.id,
                  exerciseName: selectedExercise.name,
                  imageUrl: selectedExercise.imageUrl,
                  sets: [{ reps: '8-12', rest: 'No Rest' }],
                  durationType: 'text',
                  position: block.exercises.length,
                };
                return { ...block, exercises: [...block.exercises, newExercise] };
              }
              return block;
            });
            
            toast({ title: 'Exercise added', description: 'Remember to save your changes' });
          }
        }
        
        setDraftBlocks(restoredBlocks);
        setIsDirty(true);
        
        // Clean up ALL sessionStorage keys immediately
        sessionStorage.removeItem('programmeDraftBlocks');
        sessionStorage.removeItem('programmeDraftDirty');
        sessionStorage.removeItem('selectedExerciseId');
        sessionStorage.removeItem('selectedProgrammeBlockId');
        sessionStorage.removeItem('editingProgrammeId');
        sessionStorage.removeItem('editingProgrammeWorkoutId');
        sessionStorage.removeItem('programmeFormTab');
        sessionStorage.removeItem('exerciseSelectionReturnPath');
        
        setIsInitialized(true);
        return;
      } catch (e) {
        console.error('Failed to restore draft:', e);
      }
    }
    
    // PRIORITY 2: Fall back to server data (no saved draft)
    setDraftBlocks(JSON.parse(JSON.stringify(serverBlocks)));
    setIsInitialized(true);
  }, [serverBlocks, isLoading, isInitialized, libraryExercises, programId, toast]);

  useEffect(() => {
    onDirtyStateChange?.(isDirty || detailsDirty);
  }, [isDirty, detailsDirty, onDirtyStateChange]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/programme-workouts', workoutId, 'blocks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'workouts'] });
    onBlocksUpdated?.();
  };

  const saveMutation = useMutation({
    mutationFn: async (blocks: WorkoutBlock[]) => {
      const res = await fetch(`/api/programme-workouts/${workoutId}/blocks/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks, programId }),
      });
      if (!res.ok) throw new Error('Failed to save workout');
      return res.json();
    },
    onSuccess: (savedBlocks) => {
      setDraftBlocks(savedBlocks);
      setIsDirty(false);
      invalidateQueries();
      toast({ title: 'Success', description: 'Workout saved to all instances' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save workout', variant: 'destructive' });
    },
  });

  const handleSave = async () => {
    try {
      // Save details first if they've changed
      if (detailsDirty && draftDetails) {
        await updateDetailsMutation.mutateAsync({
          name: draftDetails.name,
          description: draftDetails.description,
          workoutType: draftDetails.workoutType,
          category: draftDetails.category,
          difficulty: draftDetails.difficulty,
          duration: draftDetails.duration,
          intervalRounds: draftDetails.intervalRounds,
          intervalRestAfterRound: draftDetails.intervalRestAfterRound,
        });
      }
      // Save blocks if they've changed
      if (isDirty) {
        await saveMutation.mutateAsync(draftBlocks);
      } else if (detailsDirty) {
        // If only details changed, show success toast
        toast({ title: 'Success', description: 'Workout saved' });
      } else {
        // Nothing changed
        toast({ title: 'No changes', description: 'No changes to save' });
      }
      // Stay on the page - toast notification is shown above
    } catch (error) {
      // Error toast is already shown by mutation onError handlers
    }
  };

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const generateTimeOptions = (maxMinutes: number, includeNoRest: boolean = true) => {
    const options = [];
    if (includeNoRest) {
      options.push('No Rest');
    }
    for (let i = 5; i <= 55; i += 5) {
      options.push(`${i} sec`);
    }
    for (let i = 1; i <= Math.min(maxMinutes, 5); i++) {
      options.push(`${i} min`);
      if (i < 5) {
        options.push(`${i} min 15 sec`);
        options.push(`${i} min 30 sec`);
        options.push(`${i} min 45 sec`);
      }
    }
    for (let i = 6; i <= maxMinutes; i++) {
      options.push(`${i} min`);
    }
    return options;
  };

  const addBlock = (blockType: 'single' | 'superset' | 'triset' | 'circuit', section: 'warmup' | 'main') => {
    const sectionBlocks = draftBlocks.filter(b => b.section === section);
    const newBlockId = generateTempId();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      workoutId,
      blockType,
      section,
      position: sectionBlocks.length,
      rest: 'No Rest',
      exercises: [],
    };
    setDraftBlocks([...draftBlocks, newBlock]);
    markDirty();
    
    // Scroll to the new block after it renders
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${newBlockId}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Add a mini-circuit block for interval workouts
  const addIntervalBlock = () => {
    const mainBlocks = draftBlocks.filter(b => b.section === 'main');
    const newBlockId = generateTempId();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      workoutId,
      blockType: 'circuit',
      section: 'main',
      position: mainBlocks.length,
      rest: 'No Rest',
      exercises: [],
      rounds: 3,
      restAfterRound: 'No Rest',
    };
    setDraftBlocks([...draftBlocks, newBlock]);
    markDirty();
    
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${newBlockId}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Update interval block rounds
  const updateIntervalBlockRounds = (blockId: number, rounds: number) => {
    setDraftBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, rounds } : block
    ));
    markDirty();
  };

  // Update interval block rest after round
  const updateIntervalBlockRestAfterRound = (blockId: number, rest: string) => {
    setDraftBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, restAfterRound: rest } : block
    ));
    markDirty();
  };

  // Add a rest block to the main body (for interval/circuit workouts)
  const addRestBlock = () => {
    const mainBlocks = draftBlocks.filter(b => b.section === 'main');
    const newBlockId = generateTempId();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      workoutId,
      blockType: 'rest',
      section: 'main',
      position: mainBlocks.length,
      rest: '30 sec',
      exercises: [],
    };
    setDraftBlocks([...draftBlocks, newBlock]);
    markDirty();
  };

  // Update rest block duration
  const updateRestBlockDuration = (blockId: number, duration: string) => {
    setDraftBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, rest: duration } : block
    ));
    markDirty();
  };

  // Add a rest item within a mini-circuit (between exercises)
  const addRestToBlock = (blockId: number) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const restItem: BlockExercise = {
          id: generateTempId(),
          blockId,
          exerciseLibraryId: null,
          exerciseName: 'Rest',
          sets: [],
          position: block.exercises.length,
          isRest: true,
          restDuration: '30 sec',
        };
        return { ...block, exercises: [...block.exercises, restItem] };
      }
      return block;
    }));
    markDirty();
  };

  // Update rest item duration within a block
  const updateRestItemDuration = (blockId: number, exerciseIndex: number, duration: string) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const newExercises = [...block.exercises];
        if (newExercises[exerciseIndex]) {
          newExercises[exerciseIndex] = { ...newExercises[exerciseIndex], restDuration: duration };
        }
        return { ...block, exercises: newExercises };
      }
      return block;
    }));
    markDirty();
  };

  const removeBlock = (blockId: number) => {
    setDraftBlocks(draftBlocks.filter(b => b.id !== blockId));
    markDirty();
  };

  const moveBlock = (blockIndex: number, direction: 'up' | 'down') => {
    const block = draftBlocks[blockIndex];
    if (!block) return;
    
    const sectionBlocks = draftBlocks.filter(b => b.section === block.section);
    const blockIndexInSection = sectionBlocks.findIndex(b => b.id === block.id);
    
    let targetIndex = -1;
    if (direction === 'up' && blockIndexInSection > 0) {
      targetIndex = blockIndexInSection - 1;
    } else if (direction === 'down' && blockIndexInSection < sectionBlocks.length - 1) {
      targetIndex = blockIndexInSection + 1;
    }

    if (targetIndex >= 0) {
      const newSectionBlocks = [...sectionBlocks];
      [newSectionBlocks[blockIndexInSection], newSectionBlocks[targetIndex]] = 
        [newSectionBlocks[targetIndex], newSectionBlocks[blockIndexInSection]];
      
      newSectionBlocks.forEach((b, i) => b.position = i);
      
      const otherBlocks = draftBlocks.filter(b => b.section !== block.section);
      setDraftBlocks([...otherBlocks, ...newSectionBlocks].sort((a, b) => {
        if (a.section !== b.section) return a.section === 'warmup' ? -1 : 1;
        return a.position - b.position;
      }));
      markDirty();
    }
  };

  const addExerciseToDraft = (blockId: number, exerciseLibraryId: number, exerciseName: string, imageUrl?: string) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const newExercise: BlockExercise = {
          id: generateTempId(),
          blockId,
          exerciseLibraryId,
          exerciseName,
          imageUrl,
          sets: [{ reps: '8-12', rest: 'No Rest' }],
          durationType: 'text',
          position: block.exercises.length,
        };
        return { ...block, exercises: [...block.exercises, newExercise] };
      }
      return block;
    }));
    markDirty();
    toast({ title: 'Exercise added', description: 'Remember to save your changes' });
  };

  const addExerciseToBlock = (blockId: number) => {
    const block = draftBlocks.find(b => b.id === blockId);
    if (!block) return;
    const limit = BLOCK_EXERCISE_LIMITS[block.blockType];
    if (block.exercises.length >= limit) return;

    sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
    sessionStorage.setItem('selectedProgrammeBlockId', blockId.toString());
    sessionStorage.setItem('editingProgrammeId', programId.toString());
    sessionStorage.setItem('editingProgrammeWorkoutId', workoutId.toString());
    sessionStorage.setItem('programmeFormTab', 'exercises');
    sessionStorage.setItem('programmeDraftBlocks', JSON.stringify(draftBlocks));
    sessionStorage.setItem('programmeDraftDirty', isDirty.toString());
    navigate('/admin/select-exercise');
  };

  const removeExerciseFromBlock = (blockId: number, exerciseId: number) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        return { ...block, exercises: block.exercises.filter(e => e.id !== exerciseId) };
      }
      return block;
    }));
    markDirty();
  };

  const updateExerciseInBlock = (blockId: number, exerciseId: number, field: keyof BlockExercise, value: any) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: block.exercises.map(e => 
            e.id === exerciseId ? { ...e, [field]: value } : e
          ),
        };
      }
      return block;
    }));
    markDirty();
  };

  const updateSetInExercise = (blockId: number, exerciseId: number, setIndex: number, field: keyof ExerciseSet, value: string) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: block.exercises.map(e => {
            if (e.id === exerciseId) {
              const newSets = [...e.sets];
              newSets[setIndex] = { ...newSets[setIndex], [field]: value };
              return { ...e, sets: newSets };
            }
            return e;
          }),
        };
      }
      return block;
    }));
    markDirty();
  };

  const addSetToExercise = (blockId: number, exerciseId: number) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: block.exercises.map(e => {
            if (e.id === exerciseId) {
              const lastSet = e.sets.slice(-1)[0] || { reps: '8-12' };
              return { ...e, sets: [...e.sets, { reps: lastSet.reps, duration: lastSet.duration }] };
            }
            return e;
          }),
        };
      }
      return block;
    }));
    markDirty();
  };

  const removeSetFromExercise = (blockId: number, exerciseId: number) => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          exercises: block.exercises.map(e => {
            if (e.id === exerciseId && e.sets.length > 1) {
              return { ...e, sets: e.sets.slice(0, -1) };
            }
            return e;
          }),
        };
      }
      return block;
    }));
    markDirty();
  };

  const updateBlockRest = (blockId: number, rest: string) => {
    setDraftBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, rest } : block
    ));
    markDirty();
  };

  // Interval mode functions
  const getOrCreateIntervalBlock = (): WorkoutBlock | undefined => {
    const existingBlock = draftBlocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    if (existingBlock) return existingBlock;
    
    // Create a new interval block (uses circuit type internally for unlimited exercises)
    const newBlockId = generateTempId();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      workoutId,
      blockType: 'circuit',
      section: 'main',
      position: 0,
      rest: intervalRestAfterRound,
      exercises: [],
    };
    setDraftBlocks(prev => [...prev, newBlock]);
    markDirty();
    return newBlock;
  };

  const addExerciseToIntervalBlock = () => {
    let intervalBlock: WorkoutBlock | undefined = draftBlocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    let blocksToStore = draftBlocks;
    
    if (!intervalBlock) {
      // Create a new interval block (uses circuit type internally for unlimited exercises)
      const newBlockId = generateTempId();
      const newBlock: WorkoutBlock = {
        id: newBlockId,
        workoutId,
        blockType: 'circuit',
        section: 'main',
        position: 0,
        rest: intervalRestAfterRound,
        exercises: [],
      };
      blocksToStore = [...draftBlocks, newBlock];
      setDraftBlocks(blocksToStore);
      markDirty();
      intervalBlock = newBlock;
    }
    if (!intervalBlock) return;

    console.log('addExerciseToIntervalBlock - storing:', {
      blockId: intervalBlock.id,
      blocksToStore: blocksToStore.map(b => ({ id: b.id, section: b.section, blockType: b.blockType, exerciseCount: b.exercises.length })),
      programId: programId.toString()
    });
    sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
    sessionStorage.setItem('selectedProgrammeBlockId', intervalBlock.id.toString());
    sessionStorage.setItem('editingProgrammeId', programId.toString());
    sessionStorage.setItem('editingProgrammeWorkoutId', workoutId.toString());
    sessionStorage.setItem('programmeFormTab', 'exercises');
    sessionStorage.setItem('programmeDraftBlocks', JSON.stringify(blocksToStore));
    sessionStorage.setItem('programmeDraftDirty', 'true');
    navigate('/admin/select-exercise');
  };

  const updateIntervalRounds = (rounds: number) => {
    setIntervalRounds(rounds);
    setDraftDetails(prev => prev ? { ...prev, intervalRounds: rounds } : prev);
    setDetailsDirty(true);
    markDirty();
  };

  const updateIntervalRest = (rest: string) => {
    setIntervalRestAfterRound(rest);
    setDraftDetails(prev => prev ? { ...prev, intervalRestAfterRound: rest } : prev);
    setDetailsDirty(true);
    // Also update the block rest if it exists
    const intervalBlock = draftBlocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    if (intervalBlock) {
      updateBlockRest(intervalBlock.id, rest);
    }
    markDirty();
  };

  const moveExerciseInInterval = (blockId: number, exerciseIndex: number, direction: 'up' | 'down') => {
    setDraftBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        const exercises = [...block.exercises];
        if (direction === 'up' && exerciseIndex > 0) {
          [exercises[exerciseIndex], exercises[exerciseIndex - 1]] = [exercises[exerciseIndex - 1], exercises[exerciseIndex]];
        } else if (direction === 'down' && exerciseIndex < exercises.length - 1) {
          [exercises[exerciseIndex], exercises[exerciseIndex + 1]] = [exercises[exerciseIndex + 1], exercises[exerciseIndex]];
        }
        return { ...block, exercises };
      }
      return block;
    }));
    markDirty();
  };

  const getExerciseLabel = (block: WorkoutBlock, sectionBlocks: WorkoutBlock[], exerciseIndex: number) => {
    if (block.section === 'warmup') {
      let totalExercisesBefore = 0;
      for (const b of sectionBlocks) {
        if (b.id === block.id) break;
        totalExercisesBefore += b.exercises.length;
      }
      const letter = String.fromCharCode(65 + totalExercisesBefore + exerciseIndex);
      return letter;
    }
    
    const indexInSection = sectionBlocks.findIndex(b => b.id === block.id);
    const blockNum = indexInSection + 1;
    const letter = String.fromCharCode(65 + exerciseIndex);
    return `${blockNum}${letter}`;
  };

  const warmupBlocks = draftBlocks.filter(b => b.section === 'warmup').sort((a, b) => a.position - b.position);
  const mainBlocks = draftBlocks.filter(b => b.section === 'main').sort((a, b) => a.position - b.position);

  const renderSection = (section: 'warmup' | 'main', sectionBlocks: WorkoutBlock[], title: string) => {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => addBlock('single', section)} data-testid={`button-add-single-${section}`}>
            <Plus className="h-4 w-4 mr-1" /> Single
          </Button>
          <Button size="sm" variant="outline" onClick={() => addBlock('superset', section)} data-testid={`button-add-superset-${section}`}>
            <Layers className="h-4 w-4 mr-1" /> Superset
          </Button>
          <Button size="sm" variant="outline" onClick={() => addBlock('triset', section)} data-testid={`button-add-triset-${section}`}>
            <Layers className="h-4 w-4 mr-1" /> Triset
          </Button>
          <Button size="sm" variant="outline" onClick={() => addBlock('circuit', section)} data-testid={`button-add-circuit-${section}`}>
            <Layers className="h-4 w-4 mr-1" /> Circuit
          </Button>
        </div>

        {sectionBlocks.length === 0 && (
          <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
            No blocks added yet. Add a single exercise or group (superset/triset/circuit) to get started.
          </div>
        )}

        {sectionBlocks.map((block) => {
          const blockIndex = draftBlocks.findIndex(b => b.id === block.id);
          return (
            <Card key={block.id} data-block-id={block.id} className="w-full max-w-none px-2 py-4 border-l-4 border-l-primary">
              <div className="space-y-3">
                {block.blockType !== 'single' && block.exercises.length > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground capitalize">
                      {block.blockType}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => moveBlock(blockIndex, 'up')}
                        disabled={sectionBlocks.findIndex(b => b.id === block.id) === 0}
                        data-testid={`button-move-block-up-${block.id}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => moveBlock(blockIndex, 'down')}
                        disabled={sectionBlocks.findIndex(b => b.id === block.id) === sectionBlocks.length - 1}
                        data-testid={`button-move-block-down-${block.id}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {block.exercises.map((exercise, exerciseIndex) => (
                  <div key={exercise.id} className="w-full px-1 py-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-primary">
                        {getExerciseLabel(block, sectionBlocks, exerciseIndex)}
                      </span>
                      <div className="flex items-center gap-1">
                        {block.blockType === 'single' && (() => {
                          const blockIndexInSection = sectionBlocks.findIndex(b => b.id === block.id);
                          const isFirstInSection = exerciseIndex === 0 && blockIndexInSection === 0;
                          const isLastInSection = exerciseIndex === block.exercises.length - 1 && blockIndexInSection === sectionBlocks.length - 1;
                          
                          return (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(blockIndex, 'up')} disabled={isFirstInSection}>
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(blockIndex, 'down')} disabled={isLastInSection}>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </>
                          );
                        })()}
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => removeExerciseFromBlock(block.id, exercise.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm font-medium mb-3">{exercise.exerciseName || 'No exercise selected'}</div>
                    
                    <div className="space-y-2 pb-1">
                      <div className="flex gap-2 items-center">
                        <div className="text-xs font-medium text-muted-foreground w-8 shrink-0">Sets</div>
                        <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Type</div>
                        {exercise.durationType === 'timer' && (
                          <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Duration</div>
                        )}
                        <div className={`text-xs font-medium text-muted-foreground pl-2 ${exercise.durationType === 'timer' ? 'w-16' : 'w-20'}`}>Reps</div>
                        {(block.blockType === 'single' || exerciseIndex === block.exercises.length - 1) && (
                          <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Rest</div>
                        )}
                      </div>
                      {exercise.sets.map((set, setIndex) => (
                        <div key={setIndex} className="flex gap-2 items-center">
                          <div className="text-sm font-medium w-8 shrink-0">{setIndex + 1}</div>
                          <div className="w-16">
                            {setIndex === 0 ? (
                              <Select
                                value={exercise.durationType || 'text'}
                                onValueChange={(val) => updateExerciseInBlock(block.id, exercise.id, 'durationType', val as 'text' | 'timer')}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="timer">Time</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : null}
                          </div>
                          {exercise.durationType === 'timer' && (
                            <div className="w-16">
                              <Select
                                value={set.duration || ''}
                                onValueChange={(val) => updateSetInExercise(block.id, exercise.id, setIndex, 'duration', val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {generateTimeOptions(10).map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className={exercise.durationType === 'timer' ? 'w-16' : 'w-20'}>
                            <input
                              type="text"
                              value={set.reps}
                              onChange={(e) => updateSetInExercise(block.id, exercise.id, setIndex, 'reps', e.target.value)}
                              placeholder="8-12"
                              className="w-full h-8 px-2 bg-background border border-border rounded text-xs"
                            />
                          </div>
                          <div className="w-16">
                            {setIndex === 0 && (block.blockType === 'single' || exerciseIndex === block.exercises.length - 1) && (
                              <Select
                                value={set.rest || ''}
                                onValueChange={(val) => updateSetInExercise(block.id, exercise.id, setIndex, 'rest', val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Rest" />
                                </SelectTrigger>
                                <SelectContent>
                                  {generateTimeOptions(10).map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border my-2" />

                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="outline" onClick={() => removeSetFromExercise(block.id, exercise.id)} disabled={exercise.sets.length <= 1}>
                        - Sets
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => addSetToExercise(block.id, exercise.id)}>
                        + Sets
                      </Button>
                    </div>
                  </div>
                ))}

                {block.exercises.length < BLOCK_EXERCISE_LIMITS[block.blockType] && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addExerciseToBlock(block.id)}
                      className="flex-1"
                      data-testid={`button-add-exercise-block-${block.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Exercise ({block.exercises.length}/{BLOCK_EXERCISE_LIMITS[block.blockType]})
                    </Button>
                    {block.exercises.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeBlock(block.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-block-${block.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  // Render interval main body section (no block types, just exercises in sequence)
  const renderCircuitMainBody = () => {
    const intervalBlock = mainBlocks[0]; // In interval mode, there's only one block
    const allExercises = intervalBlock?.exercises || [];
    
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Main Body</h3>
        </div>

        {/* Rounds and Rest Configuration */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rounds:</span>
              <Select
                value={intervalRounds.toString()}
                onValueChange={(val) => updateIntervalRounds(parseInt(val))}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Rest after round:</span>
              <Select
                value={intervalRestAfterRound}
                onValueChange={updateIntervalRest}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rest</SelectItem>
                  {generateTimeOptions(5).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Complete all exercises in sequence, then rest before the next round.
          </p>
        </Card>

        {/* Exercise List */}
        {allExercises.length === 0 ? (
          <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
            No exercises added yet. Add exercises to build your circuit workout.
          </div>
        ) : (
          <Card className="w-full px-2 py-4 border-l-4 border-l-primary">
            <div className="space-y-3">
              {allExercises.map((exercise, exerciseIndex) => {
                const isLastExercise = exerciseIndex === allExercises.length - 1;
                
                // Render rest item
                if (exercise.isRest) {
                  return (
                    <div key={exercise.id} className="w-full px-3 py-3 bg-[#0cc9a9]/10 rounded-lg border border-[#0cc9a9]/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Timer className="h-4 w-4 text-[#0cc9a9]" />
                          <span className="text-sm font-medium text-[#0cc9a9]">Rest</span>
                          <Select
                            value={exercise.restDuration || '30 sec'}
                            onValueChange={(val) => updateRestItemDuration(intervalBlock.id, exerciseIndex, val)}
                          >
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {generateTimeOptions(5).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => moveExerciseInInterval(intervalBlock.id, exerciseIndex, 'up')}
                            disabled={exerciseIndex === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => moveExerciseInInterval(intervalBlock.id, exerciseIndex, 'down')}
                            disabled={isLastExercise}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeExerciseFromBlock(intervalBlock.id, exercise.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Calculate exercise number (excluding rest items)
                const exerciseNumber = allExercises.slice(0, exerciseIndex + 1).filter(e => !e.isRest).length;
                
                return (
                  <div key={exercise.id} className="w-full px-1 pt-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-primary">
                        {exerciseNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveExerciseInInterval(intervalBlock.id, exerciseIndex, 'up')}
                          disabled={exerciseIndex === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveExerciseInInterval(intervalBlock.id, exerciseIndex, 'down')}
                          disabled={isLastExercise}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeExerciseFromBlock(intervalBlock.id, exercise.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm font-medium mb-3">{exercise.exerciseName || 'No exercise selected'}</div>
                    
                    {/* Simplified exercise config for circuit - just reps/duration per round */}
                    <div className="space-y-2 pb-1">
                      <div className="flex gap-2 items-center">
                        <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Type</div>
                        {exercise.durationType === 'timer' && (
                          <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Duration</div>
                        )}
                        <div className="text-xs font-medium text-muted-foreground w-20 pl-2">Reps</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="w-16">
                          <Select
                            value={exercise.durationType || 'text'}
                            onValueChange={(val) => updateExerciseInBlock(intervalBlock.id, exercise.id, 'durationType', val as 'text' | 'timer')}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="timer">Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {exercise.durationType === 'timer' && (
                          <div className="w-16">
                            <Select
                              value={exercise.sets[0]?.duration || ''}
                              onValueChange={(val) => updateSetInExercise(intervalBlock.id, exercise.id, 0, 'duration', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {generateTimeOptions(10).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="w-20">
                          <input
                            type="text"
                            value={exercise.sets[0]?.reps || ''}
                            onChange={(e) => updateSetInExercise(intervalBlock.id, exercise.id, 0, 'reps', e.target.value)}
                            placeholder="8-12"
                            className="w-full h-8 px-2 bg-background border border-border rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Show rest indicator only after last exercise */}
                    {isLastExercise && (
                      <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground text-center">
                        Rest {intervalRestAfterRound} after completing round
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Add Exercise and Rest Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addExerciseToIntervalBlock}
            className="flex-1"
            data-testid="button-add-circuit-exercise"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Exercise
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => intervalBlock && addRestToBlock(intervalBlock.id)}
            className="flex-1"
            data-testid="button-add-rest-to-circuit"
          >
            <Timer className="h-4 w-4 mr-1" />
            Add Rest
          </Button>
        </div>
      </div>
    );
  };

  // Render interval main body with multiple mini-circuits
  const renderIntervalMainBody = () => {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Main Body</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Add mini-circuits below. Each mini-circuit has its own set of exercises, rounds, and rest period.
        </p>

        {mainBlocks.length === 0 ? (
          <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
            No mini-circuits added yet. Add a mini-circuit to build your interval workout.
          </div>
        ) : (
          <div className="space-y-4">
            {mainBlocks.map((block, blockIndexInSection) => {
              // Calculate mini-circuit number (excluding rest blocks)
              const miniCircuitNumber = mainBlocks.slice(0, blockIndexInSection + 1).filter(b => b.blockType !== 'rest').length;
              
              // Render rest block
              if (block.blockType === 'rest') {
                return (
                  <Card key={block.id} data-block-id={block.id} className="w-full px-3 py-4 bg-[#0cc9a9]/10 border-l-4 border-l-[#0cc9a9]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Timer className="h-5 w-5 text-[#0cc9a9]" />
                        <span className="text-sm font-bold text-[#0cc9a9]">Rest Period</span>
                        <Select
                          value={block.rest || ''}
                          onValueChange={(val) => updateRestBlockDuration(block.id, val)}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {generateTimeOptions(5).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(block.id, 'up')}
                          disabled={blockIndexInSection === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(block.id, 'down')}
                          disabled={blockIndexInSection === mainBlocks.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeBlock(block.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }
              
              return (
                <Card key={block.id} data-block-id={block.id} className="w-full px-3 py-4 border-l-4 border-l-primary">
                  <div className="space-y-3">
                    {/* Mini-circuit header */}
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-sm font-bold text-primary">
                        Mini-Circuit {miniCircuitNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(block.id, 'up')}
                          disabled={blockIndexInSection === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(block.id, 'down')}
                          disabled={blockIndexInSection === mainBlocks.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeBlock(block.id)}
                          disabled={block.exercises.length > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Rounds and Rest Configuration for this mini-circuit */}
                    <div className="flex flex-wrap gap-4 items-center p-2 bg-primary/5 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Rounds:</span>
                        <Select
                          value={(block.rounds || 3).toString()}
                          onValueChange={(val) => updateIntervalBlockRounds(block.id, parseInt(val))}
                        >
                          <SelectTrigger className="w-16 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Rest after circuit:</span>
                        <Select
                          value={block.restAfterRound || ''}
                          onValueChange={(val) => updateIntervalBlockRestAfterRound(block.id, val)}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No rest</SelectItem>
                            {generateTimeOptions(5).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Exercises in this mini-circuit */}
                    {block.exercises.map((exercise, exerciseIndex) => {
                      const isLastExercise = exerciseIndex === block.exercises.length - 1;
                      
                      // Render rest item
                      if (exercise.isRest) {
                        return (
                          <div key={exercise.id} className="w-full px-3 py-3 bg-[#0cc9a9]/10 rounded-lg border border-[#0cc9a9]/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Timer className="h-4 w-4 text-[#0cc9a9]" />
                                <span className="text-sm font-medium text-[#0cc9a9]">Rest</span>
                                <Select
                                  value={exercise.restDuration || '30 sec'}
                                  onValueChange={(val) => updateRestItemDuration(block.id, exerciseIndex, val)}
                                >
                                  <SelectTrigger className="w-20 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {generateTimeOptions(5).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveExerciseInInterval(block.id, exerciseIndex, 'up')}
                                  disabled={exerciseIndex === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveExerciseInInterval(block.id, exerciseIndex, 'down')}
                                  disabled={isLastExercise}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeExerciseFromBlock(block.id, exercise.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Calculate exercise number (excluding rest items)
                      const exerciseNumber = block.exercises.slice(0, exerciseIndex + 1).filter(e => !e.isRest).length;
                      
                      return (
                        <div key={exercise.id} className="w-full px-1 pt-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-primary">
                              {exerciseNumber}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => moveExerciseInInterval(block.id, exerciseIndex, 'up')}
                                disabled={exerciseIndex === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => moveExerciseInInterval(block.id, exerciseIndex, 'down')}
                                disabled={isLastExercise}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => removeExerciseFromBlock(block.id, exercise.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm font-medium mb-3">{exercise.exerciseName || 'No exercise selected'}</div>
                          
                          {/* Exercise config - duration per round */}
                          <div className="space-y-2 pb-1">
                            <div className="flex gap-2 items-center">
                              <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Type</div>
                              {exercise.durationType === 'timer' && (
                                <div className="text-xs font-medium text-muted-foreground w-16 pl-2">Duration</div>
                              )}
                              <div className="text-xs font-medium text-muted-foreground w-20 pl-2">Reps</div>
                            </div>
                            <div className="flex gap-2 items-center">
                              <div className="w-16">
                                <Select
                                  value={exercise.durationType || 'text'}
                                  onValueChange={(val) => updateExerciseInBlock(block.id, exercise.id, 'durationType', val as 'text' | 'timer')}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="timer">Time</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {exercise.durationType === 'timer' && (
                                <div className="w-16">
                                  <Select
                                    value={exercise.sets[0]?.duration || ''}
                                    onValueChange={(val) => updateSetInExercise(block.id, exercise.id, 0, 'duration', val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {generateTimeOptions(10).map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div className="w-20">
                                <input
                                  type="text"
                                  value={exercise.sets[0]?.reps || ''}
                                  onChange={(e) => updateSetInExercise(block.id, exercise.id, 0, 'reps', e.target.value)}
                                  placeholder="8-12"
                                  className="w-full h-8 px-2 bg-background border border-border rounded text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Exercise and Rest buttons for this mini-circuit */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addExerciseToBlock(block.id)}
                        className="flex-1"
                        data-testid={`button-add-interval-exercise-${block.id}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Exercise
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addRestToBlock(block.id)}
                        className="flex-1"
                        data-testid={`button-add-rest-to-circuit-${block.id}`}
                      >
                        <Timer className="h-4 w-4 mr-1" />
                        Add Rest
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Mini-Circuit and Rest Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addIntervalBlock}
            className="flex-1"
            data-testid="button-add-mini-circuit"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Mini-Circuit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addRestBlock}
            className="flex-1"
            data-testid="button-add-rest-block"
          >
            <Timer className="h-4 w-4 mr-1" />
            Add Rest
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading || loadingDetails) {
    return <div className="text-center text-muted-foreground py-4">Loading workout...</div>;
  }

  const TypeIcon = draftDetails?.workoutType ? WORKOUT_TYPE_INFO[draftDetails.workoutType]?.icon : Dumbbell;

  return (
    <div className="w-full space-y-6">
      {/* Workout Details Section */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <div className="border border-border rounded-lg overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TypeIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">{draftDetails?.name || 'Workout Details'}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="capitalize">{draftDetails?.workoutType || 'regular'}</span>
                  <span>•</span>
                  <span className="capitalize">{draftDetails?.category || 'strength'}</span>
                </div>
              </div>
            </div>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 space-y-4 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={draftDetails?.name || ''}
                    onChange={(e) => updateDetail('name', e.target.value)}
                    placeholder="Workout title"
                    data-testid="input-workout-title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workout Type</label>
                  <Select
                    value={draftDetails?.workoutType || 'regular'}
                    onValueChange={(val) => updateDetail('workoutType', val as WorkoutType)}
                  >
                    <SelectTrigger data-testid="select-workout-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WORKOUT_TYPE_INFO).map(([key, info]) => {
                        const Icon = info.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{info.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={draftDetails?.description || ''}
                  onChange={(e) => updateDetail('description', e.target.value)}
                  placeholder="Optional workout description..."
                  rows={2}
                  data-testid="input-workout-edit-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={draftDetails?.category?.toLowerCase() || 'strength'}
                    onValueChange={(val) => updateDetail('category', val)}
                  >
                    <SelectTrigger data-testid="select-workout-edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.toLowerCase()} value={cat.toLowerCase()}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select
                    value={draftDetails?.difficulty?.toLowerCase() || 'beginner'}
                    onValueChange={(val) => updateDetail('difficulty', val)}
                  >
                    <SelectTrigger data-testid="select-workout-edit-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((diff) => (
                        <SelectItem key={diff.toLowerCase()} value={diff.toLowerCase()}>{diff}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Workout Structure Section */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Workout Structure</h3>
        <p className="text-sm text-muted-foreground">
          Organise exercises into blocks for warm up and main body sections.
        </p>
      </div>

      {renderSection('warmup', warmupBlocks, 'Warm Up')}
      <div className="my-6" />
      {isCircuitMode ? renderCircuitMainBody() : isIntervalMode ? renderIntervalMainBody() : renderSection('main', mainBlocks, 'Main Body')}

      <div className="flex items-center justify-between pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          {(isDirty || detailsDirty) && (
            <span className="text-sm text-[#0cc9a9] font-medium">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onDeleteWorkout && (
            <Button 
              variant="destructive"
              onClick={onDeleteWorkout}
              data-testid="button-delete-workout"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Workout
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={(!isDirty && !detailsDirty) || saveMutation.isPending || updateDetailsMutation.isPending}
            data-testid="button-save-workout"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending || updateDetailsMutation.isPending ? 'Saving...' : 'Save Workout'}
          </Button>
        </div>
      </div>

    </div>
  );
}
