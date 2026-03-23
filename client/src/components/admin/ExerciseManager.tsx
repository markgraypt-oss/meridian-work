import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';

interface ExerciseSet {
  reps: string;
  rest: string;
  duration?: string;
}

interface WorkoutExercise {
  id?: string;
  exerciseLibraryId: number | null;
  exerciseName?: string;
  name?: string;
  sets: ExerciseSet[];
  imageUrl?: string;
  durationType?: 'time' | 'text';
  duration?: string;
  section?: 'warmup' | 'main';
}

interface WorkoutExerciseManagerProps {
  exercises: WorkoutExercise[];
  onExercisesChange: (exercises: WorkoutExercise[]) => void;
  workoutType?: string;
  onBeforeNavigate?: () => void;
}

export function ExerciseManager({ exercises: initialExercises, onExercisesChange, workoutType = 'regular', onBeforeNavigate }: WorkoutExerciseManagerProps) {
  const exercises = initialExercises || [];
  const [, navigate] = useLocation();
  
  const { data: libraryExercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
    retry: false,
  });

  // Handle returned exercise from selection page
  useEffect(() => {
    if (!onExercisesChange || typeof onExercisesChange !== 'function') return;
    
    const selectedId = sessionStorage.getItem('selectedExerciseId');
    const selectedSection = sessionStorage.getItem('selectedSection') as 'warmup' | 'main' | null;
    if (selectedId && libraryExercises.length > 0) {
      const selectedExercise = libraryExercises.find((e: any) => e.id === parseInt(selectedId));
      if (selectedExercise) {
        const newExercise: WorkoutExercise = {
          id: Date.now().toString(),
          exerciseLibraryId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          imageUrl: selectedExercise.imageUrl,
          sets: [{ reps: '8-12', rest: '60 sec', duration: '30 sec' }],
          durationType: 'time',
          section: selectedSection || 'main',
        };
        onExercisesChange([...exercises, newExercise]);
        sessionStorage.removeItem('selectedExerciseId');
        sessionStorage.removeItem('selectedSection');
      }
    }
  }, [libraryExercises, onExercisesChange, exercises]);

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

  const addExercise = (section: 'warmup' | 'main' = 'main', selectedExercise?: any) => {
    const newExercise: WorkoutExercise = {
      id: Date.now().toString(),
      exerciseLibraryId: selectedExercise?.id || null,
      exerciseName: selectedExercise?.name || undefined,
      imageUrl: selectedExercise?.imageUrl || undefined,
      sets: [{ reps: '8-12', rest: '60 sec', duration: '30 sec' }],
      durationType: 'time',
      section,
    };
    onExercisesChange([...exercises, newExercise]);
  };

  const incrementSets = (index: number) => {
    const newExercises = [...exercises];
    const lastSet = newExercises[index].sets[newExercises[index].sets.length - 1];
    newExercises[index].sets.push({ reps: lastSet.reps, rest: lastSet.rest, duration: lastSet.duration });
    onExercisesChange(newExercises);
  };

  const decrementSets = (index: number) => {
    const newExercises = [...exercises];
    if (newExercises[index].sets.length > 1) {
      newExercises[index].sets.pop();
      onExercisesChange(newExercises);
    }
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'rest' | 'duration', value: string) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex] = {
      ...newExercises[exerciseIndex].sets[setIndex],
      [field]: value
    };
    onExercisesChange(newExercises);
  };

  const removeExercise = (index: number) => {
    onExercisesChange(exercises.filter((_, i) => i !== index));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newExercises = [...exercises];
    if (direction === 'up' && index > 0) {
      [newExercises[index], newExercises[index - 1]] = [newExercises[index - 1], newExercises[index]];
    } else if (direction === 'down' && index < newExercises.length - 1) {
      [newExercises[index], newExercises[index + 1]] = [newExercises[index + 1], newExercises[index]];
    }
    onExercisesChange(newExercises);
  };

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
    const newExercises = [...exercises];
    newExercises[index] = { ...newExercises[index], [field]: value };
    onExercisesChange(newExercises);
  };

  const getExerciseLabel = (exercise: WorkoutExercise, sectionIndex: number) => {
    if (exercise.section === 'warmup') {
      return String.fromCharCode(65 + sectionIndex); // A, B, C...
    } else {
      return `${sectionIndex + 1}A`;
    }
  };

  const warmupExercises = exercises.filter(e => e.section === 'warmup' || !e.section) || [];
  const mainExercises = exercises.filter(e => e.section === 'main') || [];

  const renderSection = (section: 'warmup' | 'main', sectionExercises: WorkoutExercise[], sectionTitle: string) => {

    return (
      <div key={section} className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-semibold text-foreground">{sectionTitle}</h4>
          {workoutType === 'regular' && (
            <Button size="sm" variant="outline" onClick={() => {
              if (onBeforeNavigate) {
                onBeforeNavigate();
              }
              sessionStorage.setItem('exerciseSelectionReturnPath', window.location.pathname + window.location.search);
              sessionStorage.setItem('selectedSection', section);
              navigate('/admin/select-exercise');
            }} data-testid={`button-add-exercise-${section}`}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </div>
        
        {sectionExercises.length === 0 ? (
          <div className="p-3 border border-dashed border-border rounded-lg text-center text-muted-foreground text-xs">
            No exercises in {sectionTitle.toLowerCase()} yet.
          </div>
        ) : (
          sectionExercises.map((exercise, sectionIdx) => {
            const globalIdx = exercises.indexOf(exercise);
            return (
              <Card key={exercise.id || globalIdx} className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-sm font-semibold text-foreground">{getExerciseLabel(exercise, sectionIdx)}</div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveExercise(globalIdx, 'up')}
                        disabled={globalIdx === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveExercise(globalIdx, 'down')}
                        disabled={globalIdx === exercises.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeExercise(globalIdx)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Exercise</label>
                    {exercise.exerciseName ? (
                      <div className="text-sm text-foreground">{exercise.exerciseName}</div>
                    ) : (
                      <Select
                        value={exercise.exerciseLibraryId?.toString() || ''}
                        onValueChange={(val) => {
                          const selected = libraryExercises.find(e => e.id === parseInt(val));
                          updateExercise(globalIdx, 'exerciseLibraryId', parseInt(val));
                          if (selected) {
                            updateExercise(globalIdx, 'exerciseName', selected.name);
                            updateExercise(globalIdx, 'imageUrl', selected.imageUrl);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select exercise" />
                        </SelectTrigger>
                        <SelectContent>
                          {(libraryExercises as any[]).map((ex: any) => (
                            <SelectItem key={ex.id} value={ex.id.toString()}>
                              {ex.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(Array.isArray(exercise.sets) ? exercise.sets : []).map((set, setIdx) => (
                      <div 
                        key={setIdx} 
                        className="grid gap-3" 
                        style={{ gridTemplateColumns: '1.5rem 1fr 1fr 1fr 1fr' }}
                      >
                        <div>
                          {setIdx === 0 && (
                            <label className="text-xs font-medium text-muted-foreground block h-4">Sets</label>
                          )}
                          <div className="text-sm font-semibold text-foreground text-center h-8 flex items-center justify-center">
                            {setIdx + 1}
                          </div>
                        </div>
                        <div>
                          {setIdx === 0 ? (
                            <>
                              <label className="text-xs font-medium text-muted-foreground block h-4">Type</label>
                              <Select 
                                value={exercise.durationType || 'text'}
                                onValueChange={(val) => updateExercise(globalIdx, 'durationType', val)}
                              >
                                <SelectTrigger className="h-8 text-xs px-1 [&_svg]:w-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="time">Time</SelectItem>
                                  <SelectItem value="text">Text</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          ) : (
                            <div className="h-8" />
                          )}
                        </div>
                        <div>
                          {setIdx === 0 && exercise.durationType === 'time' && (
                            <label className="text-xs font-medium text-muted-foreground block h-4">Duration</label>
                          )}
                          {exercise.durationType === 'time' ? (
                            <Select 
                              value={set.duration || '30 sec'}
                              onValueChange={(val) => updateSet(globalIdx, setIdx, 'duration', val)}
                            >
                              <SelectTrigger className="h-8 text-xs px-1 [&_svg]:w-3">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {generateTimeOptions(30).map(time => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="h-8" />
                          )}
                        </div>
                        <div>
                          {setIdx === 0 && (
                            <label className="text-xs font-medium text-muted-foreground block h-4">Reps</label>
                          )}
                          <input 
                            type="text" 
                            value={set.reps} 
                            onChange={(e) => updateSet(globalIdx, setIdx, 'reps', e.target.value)}
                            placeholder="8-12" 
                            className="w-full h-8 px-2 bg-background border border-border rounded text-xs text-foreground"
                          />
                        </div>
                        <div>
                          {setIdx === 0 && (
                            <>
                              <label className="text-xs font-medium text-muted-foreground block h-4">Rest</label>
                              <input 
                                type="text" 
                                value={set.rest} 
                                onChange={(e) => updateSet(globalIdx, setIdx, 'rest', e.target.value)}
                                placeholder="60 sec" 
                                className="w-full h-8 px-2 bg-background border border-border rounded text-xs text-foreground"
                              />
                            </>
                          )}
                          {setIdx > 0 && (
                            <div className="h-8" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => decrementSets(globalIdx)}
                      disabled={exercise.sets.length <= 1}
                    >
                      - Sets
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => incrementSets(globalIdx)}
                    >
                      + Sets
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {workoutType !== 'regular' && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => addExercise('main')} data-testid="button-add-exercise">
            <Plus className="h-4 w-4 mr-1" /> Add Exercise
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {renderSection('warmup', warmupExercises, 'Warm Up')}
        {renderSection('main', mainExercises, 'Main Body')}
      </div>
    </div>
  );
}
