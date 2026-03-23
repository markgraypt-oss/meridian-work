import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BlockManager } from "@/components/admin/BlockManager";

interface ExerciseSet {
  reps: string;
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
}

interface WorkoutBlock {
  id: string;
  blockType: 'single' | 'superset' | 'triset' | 'circuit';
  section: 'warmup' | 'main';
  position: number;
  rest: string;
  exercises: BlockExercise[];
}

export default function CreateStretchingRoutinePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    title: "",
    description: "",
    workoutType: "regular" as 'regular' | 'interval' | 'circuit' | 'video',
    category: "mobility",
    difficulty: "beginner",
    duration: 15,
    equipment: [] as string[],
    blocks: [] as WorkoutBlock[],
    routineType: "stretching",
    intervalRounds: 4,
    intervalRestAfterRound: "60 sec",
    muxPlaybackId: "",
  });
  
  const { markDirty, markClean, handleNavigation, UnsavedChangesDialog } = useUnsavedChanges();
  const initialFormRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: exercises = [] } = useQuery<any[]>({
    queryKey: ["/api/exercises"],
    retry: false,
  });

  // Convert legacy flat exercises to blocks
  const convertLegacyExercisesToBlocks = (exercises: any[]): WorkoutBlock[] => {
    if (!exercises || exercises.length === 0) return [];
    
    // Check if already in block format
    if (exercises[0]?.blockType) {
      return exercises as WorkoutBlock[];
    }
    
    // Convert flat exercises to single blocks (default to main section)
    return exercises.map((exercise, index) => ({
      id: exercise.id || Date.now().toString() + index,
      blockType: 'single' as const,
      section: 'main' as const,
      position: index,
      rest: exercise.rest || '30 sec',
      exercises: [{
        id: exercise.id || Date.now().toString() + index,
        exerciseLibraryId: exercise.exerciseLibraryId || null,
        exerciseName: exercise.exerciseName || exercise.name || '',
        imageUrl: exercise.imageUrl || null,
        sets: exercise.sets || [{ reps: '30 sec hold', duration: '30 sec' }],
        tempo: exercise.tempo || null,
        load: exercise.load || null,
        notes: exercise.notes || null,
      }],
    }));
  };

  // Load form state from session storage on mount
  useEffect(() => {
    const savedFormData = sessionStorage.getItem('stretchingFormData');
    
    if (savedFormData) {
      try {
        const data = JSON.parse(savedFormData);
        // Convert legacy exercises to blocks if needed
        if (data.exercises && !data.blocks) {
          data.blocks = convertLegacyExercisesToBlocks(data.exercises);
          delete data.exercises;
        } else if (!data.blocks) {
          data.blocks = [];
        }
        // Ensure routineType is always 'stretching'
        data.routineType = "stretching";
        setFormData(data);
        initialFormRef.current = JSON.stringify(data);
      } catch (e) {
        console.error('Failed to parse saved form data');
        initialFormRef.current = JSON.stringify(formData);
      }
    } else {
      initialFormRef.current = JSON.stringify(formData);
    }
    setIsInitialized(true);
  }, []);

  // Save form data whenever it changes
  useEffect(() => {
    sessionStorage.setItem('stretchingFormData', JSON.stringify(formData));
  }, [formData]);

  // Track dirty state for unsaved changes detection
  useEffect(() => {
    if (!isInitialized) return;
    if (initialFormRef.current === null) return;
    
    const hasChanges = JSON.stringify(formData) !== initialFormRef.current;
    if (hasChanges) {
      markDirty();
    } else {
      markClean();
    }
  }, [formData, isInitialized, markDirty, markClean]);

  // Check for selected exercise from selection page and add it to a block
  useEffect(() => {
    const selectedId = sessionStorage.getItem('selectedExerciseId');
    const blockId = sessionStorage.getItem('selectedBlockId');
    if (selectedId && exercises.length > 0 && blockId) {
      const selectedExercise = exercises.find(e => e.id === parseInt(selectedId));
      const blockIndex = formData.blocks.findIndex(b => b.id === blockId);
      if (selectedExercise && blockIndex !== -1) {
        const newExercise: BlockExercise = {
          id: Date.now().toString(),
          exerciseLibraryId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          imageUrl: selectedExercise.imageUrl,
          sets: [{ reps: '30 sec hold', duration: '30 sec' }],
        };
        const newBlocks = [...formData.blocks];
        newBlocks[blockIndex].exercises.push(newExercise);
        setFormData(prev => ({...prev, blocks: newBlocks}));
        sessionStorage.removeItem('selectedExerciseId');
        sessionStorage.removeItem('selectedBlockId');
        
        setTimeout(() => {
          const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
          if (blockElement) {
            blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [exercises, formData.blocks]);

  const isEditing = !!formData.id;

  const createRoutineMutation = useMutation({
    mutationFn: (data: any) => {
      console.log("Submitting stretching routine data:", JSON.stringify(data, null, 2));
      if (isEditing) {
        const { id, ...dataWithoutId } = data;
        return apiRequest("PATCH", `/api/workouts/${id}`, dataWithoutId);
      }
      return apiRequest("POST", "/api/workouts", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: isEditing ? "Stretching routine updated successfully" : "Stretching routine created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      if (isEditing && formData.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/workouts", formData.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/workouts", formData.id, "exercises"] });
      }
      sessionStorage.removeItem('stretchingFormData');
      navigate("/admin?tab=stretching");
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast({ title: "Error", description: error?.message || (isEditing ? "Failed to update routine" : "Failed to create routine"), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={isEditing ? "Edit Stretching Routine" : "Create Stretching Routine"}
        onBack={() => {
          sessionStorage.removeItem('stretchingFormData');
          handleNavigation("/admin?tab=stretching");
        }}
      />
      <UnsavedChangesDialog />
      
      <div className="p-4 pt-16">
        <div className="w-full">
          <Card className="w-full max-w-none">
            <CardContent className="w-full pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Routine Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Morning Stretch, Hip Mobility Flow" 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea 
                  placeholder="Describe this stretching routine..." 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" 
                  rows={3} 
                />
              </div>
              
              <div className="pt-2">
                <label className="text-sm font-medium text-foreground block mb-3">Routine Type</label>
                <div className="space-y-2">
                  {([
                    { value: 'regular' as const, label: 'Regular', desc: 'Standard routine with sets and hold times' },
                    { value: 'interval' as const, label: 'Interval', desc: 'Timed intervals with audio cues' },
                    { value: 'circuit' as const, label: 'Circuit', desc: 'Complete all exercises in succession, rest after each round' },
                    { value: 'video' as const, label: 'Video', desc: 'Follow along video routine (up to 60 minutes)' }
                  ]).map((type) => (
                    <div 
                      key={type.value} 
                      className="flex items-start p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors" 
                      onClick={() => setFormData({...formData, workoutType: type.value})}
                    >
                      <div className="flex items-center h-5">
                        <input 
                          type="radio" 
                          name="workoutType" 
                          value={type.value} 
                          checked={formData.workoutType === type.value} 
                          onChange={() => setFormData({...formData, workoutType: type.value})} 
                          className="w-4 h-4" 
                        />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="font-medium text-foreground">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded"
                  >
                    <option value="mobility">Mobility</option>
                    <option value="recovery">Recovery</option>
                    <option value="flexibility">Flexibility</option>
                    <option value="warm-up">Warm-Up</option>
                    <option value="cool-down">Cool-Down</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Difficulty</label>
                  <select 
                    value={formData.difficulty} 
                    onChange={(e) => setFormData({...formData, difficulty: e.target.value})} 
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              {formData.workoutType !== 'video' && (
                <div>
                  <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                  <input 
                    type="number" 
                    value={formData.duration} 
                    onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value) || 15})} 
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" 
                  />
                </div>
              )}
              
              {formData.workoutType === 'video' && (
                <div className="w-full border-t border-border pt-4">
                  <label className="text-sm font-medium text-foreground">Mux Playback ID *</label>
                  <Input 
                    type="text"
                    placeholder="e.g., DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
                    value={formData.muxPlaybackId}
                    onChange={(e) => setFormData({...formData, muxPlaybackId: e.target.value})}
                    className="w-full mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Paste the Playback ID from Mux</p>
                </div>
              )}
              
              <div className="w-full border-t border-border pt-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Routine Structure</h3>
                <BlockManager 
                  blocks={formData.blocks}
                  onBlocksChange={(blocks) => setFormData({...formData, blocks})}
                  workoutType={formData.workoutType}
                  circuitConfig={{
                    rounds: formData.intervalRounds,
                    restAfterRound: formData.intervalRestAfterRound
                  }}
                  onCircuitConfigChange={(config) => setFormData({
                    ...formData, 
                    intervalRounds: config.rounds, 
                    intervalRestAfterRound: config.restAfterRound
                  })}
                />
              </div>
              
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <Button variant="outline" onClick={() => {
                  sessionStorage.removeItem('stretchingFormData');
                  handleNavigation("/admin?tab=stretching");
                }}>Cancel</Button>
                <Button 
                  onClick={() => createRoutineMutation.mutate(formData)} 
                  disabled={createRoutineMutation.isPending || !formData.title}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createRoutineMutation.isPending ? 'Saving...' : isEditing ? 'Update Routine' : 'Save Routine'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
