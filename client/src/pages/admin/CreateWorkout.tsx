import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import TopHeader from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function CreateWorkoutPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    title: "",
    description: "",
    workoutType: "regular" as 'regular' | 'interval' | 'circuit' | 'video',
    category: "strength",
    difficulty: "beginner",
    duration: 30,
    equipment: [] as string[],
    blocks: [] as WorkoutBlock[],
    intervalRounds: 4,
    intervalRestAfterRound: "60 sec",
    muxPlaybackId: "",
    imageUrl: "",
  });
  
  const [uploadingImage, setUploadingImage] = useState(false);
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
      rest: exercise.rest || '60 sec',
      exercises: [{
        id: exercise.id || Date.now().toString() + index,
        exerciseLibraryId: exercise.exerciseLibraryId || null,
        exerciseName: exercise.exerciseName || exercise.name || '',
        imageUrl: exercise.imageUrl || null,
        sets: exercise.sets || [{ reps: '8-12', duration: '30 sec' }],
        tempo: exercise.tempo || null,
        load: exercise.load || null,
        notes: exercise.notes || null,
      }],
    }));
  };

  // Load form state and step from session storage on mount
  useEffect(() => {
    const savedFormData = sessionStorage.getItem('workoutFormData');
    const savedStep = sessionStorage.getItem('workoutStep');
    
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
        setFormData(data);
        // Set initial form state for dirty tracking AFTER loading from session storage
        initialFormRef.current = JSON.stringify(data);
        // Skip to step 2 if editing (has id)
        if (data.id) {
          setStep(2);
        }
      } catch (e) {
        console.error('Failed to parse saved form data');
      }
    } else {
      // No saved data, so current formData is the initial state
      initialFormRef.current = JSON.stringify(formData);
    }
    if (savedStep) {
      setStep(parseInt(savedStep));
    }
    setIsInitialized(true);
  }, []);

  // Save form data and step whenever they change
  useEffect(() => {
    sessionStorage.setItem('workoutFormData', JSON.stringify(formData));
    sessionStorage.setItem('workoutStep', step.toString());
  }, [formData, step]);

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
    const pendingBlockData = sessionStorage.getItem('pendingIntervalBlock');
    
    if (selectedId && exercises.length > 0 && step === 2 && blockId) {
      const selectedExercise = exercises.find(e => e.id === parseInt(selectedId));
      
      // First, check if we need to add a pending interval block
      let blocksToUpdate = [...formData.blocks];
      let blockIndex = blocksToUpdate.findIndex(b => b.id === blockId);
      
      // If block doesn't exist but we have pending block data, add it first
      if (blockIndex === -1 && pendingBlockData) {
        try {
          const pendingBlock = JSON.parse(pendingBlockData);
          blocksToUpdate = [...blocksToUpdate, pendingBlock];
          blockIndex = blocksToUpdate.length - 1;
        } catch (e) {
          console.error('Failed to parse pending block data');
        }
      }
      
      if (selectedExercise && blockIndex !== -1) {
        const newExercise: BlockExercise = {
          id: Date.now().toString(),
          exerciseLibraryId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          imageUrl: selectedExercise.imageUrl,
          sets: [{ reps: '8-12', duration: '30 sec' }],
        };
        blocksToUpdate[blockIndex].exercises.push(newExercise);
        setFormData(prev => ({...prev, blocks: blocksToUpdate}));
        
        // Clean up all sessionStorage keys
        sessionStorage.removeItem('selectedExerciseId');
        sessionStorage.removeItem('selectedBlockId');
        sessionStorage.removeItem('pendingIntervalBlock');
        sessionStorage.removeItem('pendingIntervalBlockId');
        
        // Scroll to the block after a short delay to allow render
        setTimeout(() => {
          const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
          if (blockElement) {
            blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [exercises, step, formData.blocks]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const uploadData = new FormData();
      uploadData.append('image', file);
      const response = await fetch('/api/upload/image', { method: 'POST', body: uploadData, credentials: 'include' });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setFormData({...formData, imageUrl: result.imageUrl || result.url});
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const isEditing = !!formData.id;
  const editContext = (() => { try { return JSON.parse(sessionStorage.getItem('workoutEditContext') || 'null'); } catch { return null; } })();
  const isEnrolledEdit = editContext?.type === 'enrolled' && editContext?.enrollmentId && editContext?.enrollmentWorkoutId && !formData.id;

  const createWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEnrolledEdit) {
        return apiRequest("PUT", `/api/my-programs/${editContext.enrollmentId}/enrollment-workouts/${editContext.enrollmentWorkoutId}/blocks`, { title: data.title, blocks: data.blocks });
      }
      if (isEditing) {
        const { id, ...dataWithoutId } = data;
        return apiRequest("PATCH", `/api/workouts/${id}`, dataWithoutId);
      }
      return apiRequest("POST", "/api/workouts", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: isEditing ? "Workout updated successfully" : "Workout created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      if (isEditing && formData.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/workouts", formData.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/workouts", formData.id, "exercises"] });
      }
      if (isEnrolledEdit) {
        queryClient.invalidateQueries({ queryKey: ['/api/my-programs', String(editContext.enrollmentId)] });
        sessionStorage.removeItem('workoutEditContext');
      }
      sessionStorage.removeItem('workoutFormData');
      sessionStorage.removeItem('workoutStep');
      if (isEnrolledEdit) {
        window.history.back();
      } else {
        navigate("/admin?tab=workouts");
      }
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast({ title: "Error", description: error?.message || (isEditing ? "Failed to update workout" : "Failed to create workout"), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={isEditing ? "Edit Workout" : (step === 1 ? "Build new workout" : "Edit Workout")}
        onBack={() => {
          if (step === 2 && !isEditing) {
            setStep(1);
          } else {
            sessionStorage.removeItem('workoutFormData');
            sessionStorage.removeItem('workoutStep');
            handleNavigation("/admin?tab=workouts");
          }
        }}
      />
      <UnsavedChangesDialog />
      
      <div className={step === 2 ? "p-4 pt-16" : "p-6 pt-16"}>
        <div className={step === 2 ? "w-full" : "max-w-2xl mx-auto"}>
          <Card className="w-full max-w-none">
            <CardContent className="w-full pt-6 space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Workout name</label>
                    <input 
                      type="text" 
                      placeholder="Workout name, like Day 1 Abs" 
                      value={formData.title} 
                      onChange={(e) => setFormData({...formData, title: e.target.value})} 
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" 
                    />
                  </div>
                  
                  <div className="pt-4">
                    <label className="text-sm font-medium text-foreground block mb-3">Type of workout</label>
                    <div className="space-y-2">
                      {([
                        { value: 'regular' as const, label: 'Regular', desc: 'Standard workout structure with sets and reps' },
                        { value: 'interval' as const, label: 'Interval', desc: 'Tempo guided warm-ups, HIIT features or timed intervals' },
                        { value: 'circuit' as const, label: 'Circuit', desc: 'Complete all exercises in succession, rest after each round' },
                        { value: 'video' as const, label: 'Video', desc: 'Follow along workout video for classes, routines, cool down (60 minutes)' }
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
                  
                  <div className="flex gap-2 justify-end pt-6 border-t border-border">
                    <Button variant="outline" onClick={() => {
                      sessionStorage.removeItem('workoutFormData');
                      sessionStorage.removeItem('workoutStep');
                      handleNavigation("/admin?tab=workouts");
                    }}>Cancel</Button>
                    <Button 
                      onClick={() => {
                        if (formData.title.trim()) {
                          setStep(2);
                        }
                      }} 
                      disabled={!formData.title.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground">Title</label>
                    <input type="text" placeholder="Workout title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea placeholder="Workout description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Cover Image (optional)</label>
                    <p className="text-xs text-muted-foreground">
                      Recommended: 1200 × 800px (3:2 landscape). Min 600px wide. Max 10MB. JPG or PNG.
                    </p>
                    {formData.imageUrl ? (
                      <div className="space-y-2">
                        <div className="relative inline-block">
                          <img src={formData.imageUrl} alt="Preview" className="w-48 h-32 object-cover rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          <button type="button" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold hover:bg-destructive/80" onClick={() => setFormData({...formData, imageUrl: ''})}>✕</button>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                          Replace image
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <span className="text-xs font-medium">Upload Image</span>
                          <span className="text-[10px]">1200 × 800px</span>
                        </div>
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
                      </label>
                    )}
                    {uploadingImage && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Uploading...
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Category</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded">
                      <option value="strength">Strength</option>
                      <option value="cardio">Cardio</option>
                      <option value="hiit">HIIT</option>
                      <option value="mobility">Mobility</option>
                      <option value="recovery">Recovery</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Difficulty</label>
                    <select value={formData.difficulty} onChange={(e) => setFormData({...formData, difficulty: e.target.value})} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  {formData.workoutType !== 'video' && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                      <input type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value) || 30})} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded" />
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
                    <h3 className="text-sm font-medium text-foreground mb-3">Workout Structure</h3>
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
                      if (isEditing) {
                        sessionStorage.removeItem('workoutFormData');
                        sessionStorage.removeItem('workoutStep');
                        handleNavigation("/admin?tab=workouts");
                      } else {
                        setStep(1);
                      }
                    }}>Back</Button>
                    <Button 
                      onClick={() => createWorkoutMutation.mutate(formData)} 
                      disabled={createWorkoutMutation.isPending || !formData.title}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {createWorkoutMutation.isPending ? 'Saving...' : isEditing ? 'Update Workout' : 'Save Workout'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
