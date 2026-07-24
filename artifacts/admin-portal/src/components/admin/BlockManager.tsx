import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Trash2, Plus, Layers, Edit, Timer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLocation } from 'wouter';

interface ExerciseSet {
  reps: string;
  rest?: string;
  duration?: string;
}

interface BlockExercise {
  id: string;
  exerciseLibraryId: number | null;
  exerciseName?: string;
  imageUrl?: string;
  sets: ExerciseSet[];
  tempo?: string;
  load?: string;
  notes?: string;
  durationType?: 'text' | 'timer';
  isRest?: boolean; // For rest periods within mini-circuits
  restDuration?: string; // Duration for rest items
}

interface WorkoutBlock {
  id: string;
  blockType: 'single' | 'superset' | 'triset' | 'circuit' | 'rest';
  section: 'warmup' | 'main';
  position: number;
  rest: string;
  exercises: BlockExercise[];
  rounds?: number;
  restAfterRound?: string;
  restDuration?: string; // For rest blocks only
}

type WorkoutType = 'regular' | 'interval' | 'circuit' | 'video';

interface CircuitConfig {
  rounds: number;
  restAfterRound: string;
}

interface BlockManagerProps {
  blocks: WorkoutBlock[];
  onBlocksChange: (blocks: WorkoutBlock[]) => void;
  workoutType?: WorkoutType;
  circuitConfig?: CircuitConfig;
  onCircuitConfigChange?: (config: CircuitConfig) => void;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  single: 'Single Exercise',
  superset: 'Superset (2 exercises)',
  triset: 'Triset (3 exercises)',
  circuit: 'Circuit (up to 10 exercises)',
  rest: 'Rest Period',
};

const BLOCK_EXERCISE_LIMITS: Record<string, number> = {
  single: 1,
  superset: 2,
  triset: 3,
  circuit: 10,
  rest: 0,
};

export function BlockManager({ 
  blocks, 
  onBlocksChange, 
  workoutType = 'regular',
  circuitConfig: circuitConfigProp,
  onCircuitConfigChange
}: BlockManagerProps) {
  const [, navigate] = useLocation();
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  
  // Ensure circuitConfig always has valid defaults (field-level to handle partial objects)
  const circuitConfig = {
    rounds: circuitConfigProp?.rounds ?? 4,
    restAfterRound: circuitConfigProp?.restAfterRound ?? 'No Rest',
  };
  
  const isCircuitMode = workoutType === 'circuit';
  const isIntervalMode = workoutType === 'interval';

  const moveBlock = (blockIndex: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    const sectionBlocks = newBlocks.filter(b => b.section === block.section);
    const blockIndexInSection = sectionBlocks.findIndex(b => b.id === block.id);
    
    if (direction === 'up' && blockIndexInSection > 0) {
      const prevBlockFullIndex = newBlocks.findIndex(b => b.id === sectionBlocks[blockIndexInSection - 1].id);
      [newBlocks[blockIndex], newBlocks[prevBlockFullIndex]] = [newBlocks[prevBlockFullIndex], newBlocks[blockIndex]];
      onBlocksChange(newBlocks);
    } else if (direction === 'down' && blockIndexInSection < sectionBlocks.length - 1) {
      const nextBlockFullIndex = newBlocks.findIndex(b => b.id === sectionBlocks[blockIndexInSection + 1].id);
      [newBlocks[blockIndex], newBlocks[nextBlockFullIndex]] = [newBlocks[nextBlockFullIndex], newBlocks[blockIndex]];
      onBlocksChange(newBlocks);
    }
  };

  const reorderExerciseInModal = (blockIndex: number, exerciseIndex: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const exercises = [...newBlocks[blockIndex].exercises];
    
    if (direction === 'up' && exerciseIndex > 0) {
      [exercises[exerciseIndex], exercises[exerciseIndex - 1]] = [exercises[exerciseIndex - 1], exercises[exerciseIndex]];
    } else if (direction === 'down' && exerciseIndex < exercises.length - 1) {
      [exercises[exerciseIndex], exercises[exerciseIndex + 1]] = [exercises[exerciseIndex + 1], exercises[exerciseIndex]];
    }
    
    newBlocks[blockIndex].exercises = exercises;
    onBlocksChange(newBlocks);
  };

  const { data: libraryExercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
    retry: false,
  });

  const generateTimeOptions = (maxMinutes: number) => {
    const options = [];
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
    const sectionBlocks = blocks.filter(b => b.section === section);
    const newBlockId = Date.now().toString();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      blockType,
      section,
      position: sectionBlocks.length,
      rest: 'No Rest',
      exercises: [],
    };
    onBlocksChange([...blocks, newBlock]);
    
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
    const mainBlocks = blocks.filter(b => b.section === 'main');
    const newBlockId = Date.now().toString();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      blockType: 'circuit',
      section: 'main',
      position: mainBlocks.length,
      rest: 'No Rest',
      exercises: [],
      rounds: 3,
      restAfterRound: 'No Rest',
    };
    onBlocksChange([...blocks, newBlock]);
    
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${newBlockId}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Add a rest block for interval/circuit workouts in main body
  const addRestBlock = () => {
    const mainBlocks = blocks.filter(b => b.section === 'main');
    const newBlockId = Date.now().toString();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      blockType: 'rest',
      section: 'main',
      position: mainBlocks.length,
      rest: '30 sec',
      exercises: [],
      restDuration: '30 sec',
    };
    onBlocksChange([...blocks, newBlock]);
    
    setTimeout(() => {
      const blockElement = document.querySelector(`[data-block-id="${newBlockId}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Update rest block duration
  const updateRestBlockDuration = (blockIndex: number, duration: string) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].restDuration = duration;
    onBlocksChange(newBlocks);
  };

  // Add rest item within a block (between exercises in mini-circuits)
  const addRestToBlock = (blockId: string) => {
    const newBlocks = [...blocks];
    const blockIndex = newBlocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    
    const restItem: BlockExercise = {
      id: Date.now().toString(),
      exerciseLibraryId: null,
      exerciseName: 'Rest',
      sets: [],
      isRest: true,
      restDuration: '30 sec',
    };
    
    newBlocks[blockIndex].exercises.push(restItem);
    onBlocksChange(newBlocks);
  };

  // Update rest item duration within a block
  const updateRestItemDuration = (blockIndex: number, exerciseIndex: number, duration: string) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exerciseIndex].restDuration = duration;
    onBlocksChange(newBlocks);
  };

  // Update interval block rounds
  const updateIntervalBlockRounds = (blockIndex: number, rounds: number) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].rounds = rounds;
    onBlocksChange(newBlocks);
  };

  // Update interval block rest after round
  const updateIntervalBlockRestAfterRound = (blockIndex: number, rest: string) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].restAfterRound = rest;
    onBlocksChange(newBlocks);
  };

  // Get or create the interval block for main body (interval mode uses a single block for all exercises)
  const getOrCreateCircuitBlock = (): WorkoutBlock => {
    const existingBlock = blocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    if (existingBlock) return existingBlock;
    
    // Create a new interval block (uses circuit type internally for unlimited exercises)
    const newBlockId = Date.now().toString();
    const newBlock: WorkoutBlock = {
      id: newBlockId,
      blockType: 'circuit', // Use circuit type internally for interval mode
      section: 'main',
      position: 0,
      rest: circuitConfig.restAfterRound,
      exercises: [],
    };
    onBlocksChange([...blocks, newBlock]);
    return newBlock;
  };

  const addExerciseToCircuitBlock = () => {
    // Check if interval block already exists
    const existingBlock = blocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    
    if (existingBlock) {
      // Block exists, can navigate immediately
      sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
      sessionStorage.setItem('selectedBlockId', existingBlock.id);
      navigate('/admin/select-exercise');
    } else {
      // Need to create block first - create it and save to sessionStorage synchronously
      const newBlockId = Date.now().toString();
      const newBlock: WorkoutBlock = {
        id: newBlockId,
        blockType: 'circuit',
        section: 'main',
        position: 0,
        rest: circuitConfig.restAfterRound,
        exercises: [],
      };
      
      // Update blocks state
      const updatedBlocks = [...blocks, newBlock];
      onBlocksChange(updatedBlocks);
      
      // Also save the pending block ID so CreateWorkout can handle it
      sessionStorage.setItem('pendingIntervalBlockId', newBlockId);
      sessionStorage.setItem('pendingIntervalBlock', JSON.stringify(newBlock));
      sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
      sessionStorage.setItem('selectedBlockId', newBlockId);
      
      // Small delay to ensure state updates before navigation
      setTimeout(() => {
        navigate('/admin/select-exercise');
      }, 50);
    }
  };

  const updateCircuitRounds = (rounds: number) => {
    if (onCircuitConfigChange) {
      onCircuitConfigChange({ ...circuitConfig, rounds });
    }
  };

  const updateCircuitRest = (rest: string) => {
    if (onCircuitConfigChange) {
      onCircuitConfigChange({ ...circuitConfig, restAfterRound: rest });
    }
    // Also update the block rest if it exists
    const intervalBlock = blocks.find(b => b.section === 'main' && b.blockType === 'circuit');
    if (intervalBlock) {
      const blockIndex = blocks.findIndex(b => b.id === intervalBlock.id);
      updateBlockRest(blockIndex, rest);
    }
  };

  const removeBlock = (blockIndex: number) => {
    const newBlocks = blocks.filter((_, i) => i !== blockIndex);
    newBlocks.forEach((block, i) => block.position = i);
    onBlocksChange(newBlocks);
  };

  const updateBlockRest = (blockIndex: number, rest: string) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].rest = rest;
    onBlocksChange(newBlocks);
  };

  const addExerciseToBlock = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const limit = BLOCK_EXERCISE_LIMITS[block.blockType];
    if (block.exercises.length >= limit) return;

    sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
    sessionStorage.setItem('selectedBlockId', blockId);
    navigate('/admin/select-exercise');
  };

  const removeExerciseFromBlock = (blockIndex: number, exerciseIndex: number) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises = newBlocks[blockIndex].exercises.filter((_, i) => i !== exerciseIndex);
    onBlocksChange(newBlocks);
  };

  const moveExerciseInBlock = (blockIndex: number, exerciseIndex: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    
    // First try to move exercise within the block
    const exercises = [...block.exercises];
    if (direction === 'up' && exerciseIndex > 0) {
      [exercises[exerciseIndex], exercises[exerciseIndex - 1]] = [exercises[exerciseIndex - 1], exercises[exerciseIndex]];
      newBlocks[blockIndex].exercises = exercises;
      onBlocksChange(newBlocks);
      return;
    } else if (direction === 'down' && exerciseIndex < exercises.length - 1) {
      [exercises[exerciseIndex], exercises[exerciseIndex + 1]] = [exercises[exerciseIndex + 1], exercises[exerciseIndex]];
      newBlocks[blockIndex].exercises = exercises;
      onBlocksChange(newBlocks);
      return;
    }
    
    // If at edge of block, swap blocks instead (for warm up mostly)
    if (direction === 'up' && exerciseIndex === 0 && blockIndex > 0) {
      [newBlocks[blockIndex], newBlocks[blockIndex - 1]] = [newBlocks[blockIndex - 1], newBlocks[blockIndex]];
      onBlocksChange(newBlocks);
    } else if (direction === 'down' && exerciseIndex === exercises.length - 1 && blockIndex < newBlocks.length - 1) {
      [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [newBlocks[blockIndex + 1], newBlocks[blockIndex]];
      onBlocksChange(newBlocks);
    }
  };

  const updateExerciseInBlock = (blockIndex: number, exerciseIndex: number, field: keyof BlockExercise, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exerciseIndex] = {
      ...newBlocks[blockIndex].exercises[exerciseIndex],
      [field]: value
    };
    onBlocksChange(newBlocks);
  };

  const updateSetInExercise = (blockIndex: number, exerciseIndex: number, setIndex: number, field: keyof ExerciseSet, value: string) => {
    const newBlocks = [...blocks];
    const sets = [...newBlocks[blockIndex].exercises[exerciseIndex].sets];
    sets[setIndex] = { ...sets[setIndex], [field]: value };
    newBlocks[blockIndex].exercises[exerciseIndex].sets = sets;
    onBlocksChange(newBlocks);
  };

  const addSetToExercise = (blockIndex: number, exerciseIndex: number) => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    const lastSet = newBlocks[blockIndex].exercises[exerciseIndex].sets.slice(-1)[0] || { reps: '8-12' };
    const newSet = { reps: lastSet.reps, duration: lastSet.duration };
    
    // For supersets/trisets/circuits, add set to ALL exercises in the block
    if (block.blockType !== 'single') {
      block.exercises.forEach((exercise) => {
        exercise.sets.push(newSet);
      });
    } else {
      // For single exercises, just add to this one
      newBlocks[blockIndex].exercises[exerciseIndex].sets.push(newSet);
    }
    onBlocksChange(newBlocks);
  };

  const removeSetFromExercise = (blockIndex: number, exerciseIndex: number) => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    
    // For supersets/trisets/circuits, remove set from ALL exercises in the block (if more than 1 set)
    if (block.blockType !== 'single') {
      if (block.exercises[exerciseIndex].sets.length > 1) {
        block.exercises.forEach((exercise) => {
          if (exercise.sets.length > 1) {
            exercise.sets.pop();
          }
        });
      }
    } else {
      // For single exercises, just remove from this one
      if (newBlocks[blockIndex].exercises[exerciseIndex].sets.length > 1) {
        newBlocks[blockIndex].exercises[exerciseIndex].sets.pop();
      }
    }
    onBlocksChange(newBlocks);
  };

  const getBlockLabel = (block: WorkoutBlock, sectionBlocks: WorkoutBlock[]) => {
    const indexInSection = sectionBlocks.findIndex(b => b.id === block.id);
    return `${indexInSection + 1}`;
  };

  const getExerciseLabel = (block: WorkoutBlock, sectionBlocks: WorkoutBlock[], exerciseIndex: number) => {
    // For warm up: just letters A, B, C, D... counting across all exercises in all blocks
    if (block.section === 'warmup') {
      let totalExercisesBefore = 0;
      for (const b of sectionBlocks) {
        if (b.id === block.id) break;
        totalExercisesBefore += b.exercises.length;
      }
      const letter = String.fromCharCode(65 + totalExercisesBefore + exerciseIndex);
      return letter;
    }
    
    // For main body: block number + letter
    const indexInSection = sectionBlocks.findIndex(b => b.id === block.id);
    const blockNum = indexInSection + 1;
    const letter = String.fromCharCode(65 + exerciseIndex);
    return `${blockNum}${letter}`;
  };

  const warmupBlocks = blocks.filter(b => b.section === 'warmup');
  const mainBlocks = blocks.filter(b => b.section === 'main');

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
          const blockIndex = blocks.findIndex(b => b.id === block.id);
          return (
            <Card key={block.id} data-block-id={block.id} className="w-full max-w-none px-2 py-4 border-l-4 border-l-primary">
              <div className="space-y-3">
                {/* Block header for multi-exercise blocks */}
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
                        disabled={blockIndex === 0 || blocks[blockIndex - 1].section !== block.section}
                        data-testid={`button-move-block-up-${block.id}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => moveBlock(blockIndex, 'down')}
                        disabled={blockIndex === blocks.length - 1 || blocks[blockIndex + 1].section !== block.section}
                        data-testid={`button-move-block-down-${block.id}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => setEditingBlockIndex(blockIndex)}
                        data-testid={`button-edit-block-${block.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {block.exercises.map((exercise, exerciseIndex) => (
                  <div key={exercise.id} className="w-full px-1 pt-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-primary">
                        {getExerciseLabel(block, sectionBlocks, exerciseIndex)}
                      </span>
                      <div className="flex items-center gap-1">
                        {/* Only show up/down arrows for single exercise blocks */}
                        {block.blockType === 'single' && (() => {
                          let isFirstInSection = false;
                          let isLastInSection = false;
                          
                          for (let i = 0; i < sectionBlocks.length; i++) {
                            const b = sectionBlocks[i];
                            if (b.id === block.id) {
                              isFirstInSection = exerciseIndex === 0 && i === 0;
                              isLastInSection = exerciseIndex === b.exercises.length - 1 && i === sectionBlocks.length - 1;
                              break;
                            }
                          }
                          
                          return (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'up')} disabled={isFirstInSection}>
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'down')} disabled={isLastInSection}>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </>
                          );
                        })()}
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => removeExerciseFromBlock(blockIndex, exerciseIndex)}>
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
                                onValueChange={(val) => updateExerciseInBlock(blockIndex, exerciseIndex, 'durationType', val as 'text' | 'timer')}
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
                                onValueChange={(val) => updateSetInExercise(blockIndex, exerciseIndex, setIndex, 'duration', val)}
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
                              onChange={(e) => updateSetInExercise(blockIndex, exerciseIndex, setIndex, 'reps', e.target.value)}
                              placeholder="8-12"
                              className="w-full h-8 px-2 bg-background border border-border rounded text-xs"
                            />
                          </div>
                          <div className="w-16">
                            {setIndex === 0 && (block.blockType === 'single' || exerciseIndex === block.exercises.length - 1) && (
                              <Select
                                value={block.rest || 'No Rest'}
                                onValueChange={(val) => updateBlockRest(blockIndex, val)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Rest" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="No Rest">No Rest</SelectItem>
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

                    {(block.blockType === 'single' || exerciseIndex === block.exercises.length - 1) && (
                      <>
                        <div className="border-t border-border mt-2 mb-3" />
                        <div className="flex gap-2 justify-center">
                          <Button size="sm" variant="outline" onClick={() => removeSetFromExercise(blockIndex, exerciseIndex)} disabled={exercise.sets.length <= 1}>
                            - Sets
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addSetToExercise(blockIndex, exerciseIndex)}>
                            + Sets
                          </Button>
                        </div>
                      </>
                    )}
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
                        onClick={() => removeBlock(blockIndex)}
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

  const editingBlock = editingBlockIndex !== null ? blocks[editingBlockIndex] : null;

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
                value={circuitConfig.rounds.toString()}
                onValueChange={(val) => updateCircuitRounds(parseInt(val))}
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
                value={circuitConfig.restAfterRound}
                onValueChange={updateCircuitRest}
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
                const blockIndex = blocks.findIndex(b => b.id === intervalBlock.id);
                
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
                            onValueChange={(val) => updateRestItemDuration(blockIndex, exerciseIndex, val)}
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
                            onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'up')}
                            disabled={exerciseIndex === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'down')}
                            disabled={isLastExercise}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeExerciseFromBlock(blockIndex, exerciseIndex)}
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
                          onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'up')}
                          disabled={exerciseIndex === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'down')}
                          disabled={isLastExercise}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeExerciseFromBlock(blockIndex, exerciseIndex)}
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
                            onValueChange={(val) => updateExerciseInBlock(blockIndex, exerciseIndex, 'durationType', val as 'text' | 'timer')}
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
                              onValueChange={(val) => updateSetInExercise(blockIndex, exerciseIndex, 0, 'duration', val)}
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
                            onChange={(e) => updateSetInExercise(blockIndex, exerciseIndex, 0, 'reps', e.target.value)}
                            placeholder="8-12"
                            className="w-full h-8 px-2 bg-background border border-border rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Show rest indicator only after last exercise */}
                    {isLastExercise && (
                      <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground text-center">
                        Rest {circuitConfig.restAfterRound} after completing round
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
            onClick={addExerciseToCircuitBlock}
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
              const blockIndex = blocks.findIndex(b => b.id === block.id);
              
              // Render rest block
              if (block.blockType === 'rest') {
                return (
                  <Card key={block.id} data-block-id={block.id} className="w-full px-3 py-4 border-l-4 border-l-[#0cc9a9] bg-[#0cc9a9]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Timer className="h-5 w-5 text-[#0cc9a9]" />
                        <span className="text-sm font-bold text-[#0cc9a9]">Rest Period</span>
                        <Select
                          value={block.restDuration || '30 sec'}
                          onValueChange={(val) => updateRestBlockDuration(blockIndex, val)}
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
                          onClick={() => moveBlock(blockIndex, 'up')}
                          disabled={blockIndexInSection === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(blockIndex, 'down')}
                          disabled={blockIndexInSection === mainBlocks.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeBlock(blockIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }
              
              // Calculate mini-circuit number (excluding rest blocks)
              const miniCircuitNumber = mainBlocks.slice(0, blockIndexInSection + 1).filter(b => b.blockType !== 'rest').length;
              
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
                          onClick={() => moveBlock(blockIndex, 'up')}
                          disabled={blockIndexInSection === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => moveBlock(blockIndex, 'down')}
                          disabled={blockIndexInSection === mainBlocks.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeBlock(blockIndex)}
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
                          onValueChange={(val) => updateIntervalBlockRounds(blockIndex, parseInt(val))}
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
                          value={block.restAfterRound || 'No Rest'}
                          onValueChange={(val) => updateIntervalBlockRestAfterRound(blockIndex, val)}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="No Rest">No Rest</SelectItem>
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
                                  onValueChange={(val) => updateRestItemDuration(blockIndex, exerciseIndex, val)}
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
                                  onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'up')}
                                  disabled={exerciseIndex === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'down')}
                                  disabled={isLastExercise}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeExerciseFromBlock(blockIndex, exerciseIndex)}
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
                                onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'up')}
                                disabled={exerciseIndex === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => moveExerciseInBlock(blockIndex, exerciseIndex, 'down')}
                                disabled={isLastExercise}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => removeExerciseFromBlock(blockIndex, exerciseIndex)}
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
                                  onValueChange={(val) => updateExerciseInBlock(blockIndex, exerciseIndex, 'durationType', val as 'text' | 'timer')}
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
                                    onValueChange={(val) => updateSetInExercise(blockIndex, exerciseIndex, 0, 'duration', val)}
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
                                  onChange={(e) => updateSetInExercise(blockIndex, exerciseIndex, 0, 'reps', e.target.value)}
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

  return (
    <div className="w-full space-y-8">
      {renderSection('warmup', warmupBlocks, 'Warm Up')}
      <div className="border-t border-border" />
      {isCircuitMode ? renderCircuitMainBody() : isIntervalMode ? renderIntervalMainBody() : renderSection('main', mainBlocks, 'Main Body')}

      {/* Edit Block Modal for reordering exercises in supersets/trisets/circuits */}
      <Dialog open={editingBlockIndex !== null} onOpenChange={(open) => !open && setEditingBlockIndex(null)}>
        <DialogContent className="sm:max-w-sm rounded-lg mx-2">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Reorder {editingBlock?.blockType} Exercises
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 py-4 px-1">
            {editingBlock?.exercises.map((exercise, index) => (
              <div 
                key={exercise.id} 
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <span className="text-sm font-bold text-primary w-6">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 text-sm font-medium truncate">
                  {exercise.exerciseName || 'No exercise selected'}
                </span>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={() => reorderExerciseInModal(editingBlockIndex!, index, 'up')}
                    disabled={index === 0}
                    data-testid={`button-modal-move-up-${index}`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={() => reorderExerciseInModal(editingBlockIndex!, index, 'down')}
                    disabled={index === (editingBlock?.exercises.length || 1) - 1}
                    data-testid={`button-modal-move-down-${index}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex justify-center pt-2">
            <Button 
              size="sm"
              onClick={() => setEditingBlockIndex(null)} 
              data-testid="button-close-edit-modal"
              className="px-6 py-1 h-8 text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
