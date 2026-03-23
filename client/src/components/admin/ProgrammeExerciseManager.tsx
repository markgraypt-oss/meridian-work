import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Dumbbell, Zap, RotateCcw, Video } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ProgrammeBlockManager } from './ProgrammeBlockManager';

type WorkoutType = 'regular' | 'interval' | 'circuit' | 'video';

const WORKOUT_TYPES = [
  {
    id: 'regular' as const,
    label: 'Regular',
    description: 'Standard structured workout with sets and reps',
    icon: Dumbbell,
  },
  {
    id: 'interval' as const,
    label: 'Interval',
    description: 'Tempo-based or HIIT workout with timed intervals',
    icon: Zap,
  },
  {
    id: 'circuit' as const,
    label: 'Circuit',
    description: 'Exercises performed in succession with minimal rest',
    icon: RotateCcw,
  },
  {
    id: 'video' as const,
    label: 'Video',
    description: 'Follow-along 60-minute video workout',
    icon: Video,
  },
];

const CATEGORIES = ['Strength', 'Cardio', 'HIIT', 'Mobility', 'Recovery'];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

interface ProgrammeExerciseManagerProps {
  programId: number;
  totalWeeks: number;
  programmeType?: string;
  onDirtyStateChange?: (isDirty: boolean) => void;
}

interface WorkoutTemplate {
  name: string;
  canonicalWorkoutId: number;
  allWorkoutIds: number[];
  exerciseCount: number;
  instances: {
    workoutId: number;
    weekNumber: number;
    dayNumber: number;
  }[];
}

export function ProgrammeExerciseManager({ programId, programmeType, onDirtyStateChange }: ProgrammeExerciseManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem('editingProgrammeWorkoutId');
    const storedProgramId = sessionStorage.getItem('editingProgrammeId');
    if (stored && storedProgramId === programId.toString()) {
      return parseInt(stored);
    }
    return null;
  });

  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [selectedType, setSelectedType] = useState<WorkoutType>('regular');
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newWorkoutDescription, setNewWorkoutDescription] = useState('');
  const [newWorkoutCategory, setNewWorkoutCategory] = useState('Strength');
  const [newWorkoutDifficulty, setNewWorkoutDifficulty] = useState('Beginner');
  const [newWorkoutDuration, setNewWorkoutDuration] = useState('30');
  const [newWorkoutImageUrl, setNewWorkoutImageUrl] = useState('');
  const [uploadingWorkoutImage, setUploadingWorkoutImage] = useState(false);
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<number | null>(null);

  const resetNewWorkoutForm = () => {
    setNewWorkoutName('');
    setNewWorkoutDescription('');
    setNewWorkoutCategory('Strength');
    setNewWorkoutDifficulty('Beginner');
    setNewWorkoutDuration('30');
    setNewWorkoutImageUrl('');
    setUploadingWorkoutImage(false);
    setSelectedType('regular');
  };

  const handleWorkoutImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingWorkoutImage(true);
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setNewWorkoutImageUrl(result.imageUrl || result.url);
      toast({ title: "Image uploaded", description: "Cover image uploaded successfully" });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    } finally {
      setUploadingWorkoutImage(false);
    }
  };

  useEffect(() => {
    if (selectedWorkoutId) {
      sessionStorage.setItem('editingProgrammeWorkoutId', selectedWorkoutId.toString());
      sessionStorage.setItem('editingProgrammeId', programId.toString());
    }
  }, [selectedWorkoutId, programId]);

  const { data: workoutTemplates = [], isLoading: loadingWorkouts } = useQuery<WorkoutTemplate[]>({
    queryKey: ['/api/programs', programId, 'workout-templates'],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${programId}/workout-templates`);
      if (!res.ok) throw new Error('Failed to load workout templates');
      return res.json();
    },
  });

  const createWorkoutMutation = useMutation({
    mutationFn: async (workoutData: {
      name: string;
      description?: string;
      workoutType: WorkoutType;
      category: string;
      difficulty: string;
      duration: number;
      imageUrl?: string;
    }) => {
      const res = await apiRequest('POST', `/api/programs/${programId}/workouts`, workoutData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'workout-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId] });
      resetNewWorkoutForm();
      setShowAddWorkout(false);
      setSelectedWorkoutId(data.id);
      toast({
        title: "Workout created",
        description: "New workout has been added to the programme.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create workout.",
        variant: "destructive",
      });
    },
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: number) => {
      return apiRequest('DELETE', `/api/programme-workouts/${workoutId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'workout-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/programs', programId] });
      if (selectedWorkoutId === deleteWorkoutId) {
        setSelectedWorkoutId(null);
      }
      setDeleteWorkoutId(null);
      toast({
        title: "Workout deleted",
        description: "The workout has been removed from the programme.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete workout.",
        variant: "destructive",
      });
    },
  });

  const selectedTemplate = workoutTemplates.find(t => t.canonicalWorkoutId === selectedWorkoutId);
  const workoutToDelete = workoutTemplates.find(t => t.canonicalWorkoutId === deleteWorkoutId);

  if (loadingWorkouts) {
    return <div className="text-center text-muted-foreground py-4">Loading workouts...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Select Workout Template</label>
        <p className="text-xs text-muted-foreground mb-3">
          Changes to a workout will apply to all instances across all weeks.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select 
              value={selectedWorkoutId?.toString() || ''} 
              onValueChange={(val) => setSelectedWorkoutId(parseInt(val))}
            >
              <SelectTrigger data-testid="select-workout-dropdown">
                <SelectValue placeholder="Select a workout to edit exercises" />
              </SelectTrigger>
              <SelectContent>
                {workoutTemplates.map((template) => (
                  <SelectItem 
                    key={template.canonicalWorkoutId} 
                    value={template.canonicalWorkoutId.toString()} 
                    data-testid={`workout-option-${template.canonicalWorkoutId}`}
                  >
                    {template.name} ({template.exerciseCount} exercises)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={() => setShowTypeSelection(true)} 
            size="sm"
            data-testid="button-add-workout"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Workout
          </Button>
        </div>
      </div>

      {workoutTemplates.length === 0 && (
        <div className="p-6 border border-dashed border-border rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No workouts in this programme yet. Add a workout to get started.
          </p>
          <Button onClick={() => setShowTypeSelection(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add First Workout
          </Button>
        </div>
      )}

      {selectedWorkoutId && selectedTemplate && (
        <ProgrammeBlockManager 
          workoutId={selectedWorkoutId} 
          programId={programId}
          programmeType={programmeType}
          onBlocksUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/programs', programId, 'workout-templates'] });
          }}
          onDirtyStateChange={onDirtyStateChange}
          onDeleteWorkout={() => setDeleteWorkoutId(selectedWorkoutId)}
        />
      )}

      {/* Step 1: Workout Type Selection Dialog */}
      <Dialog 
        open={showTypeSelection} 
        onOpenChange={(open) => {
          setShowTypeSelection(open);
          if (!open) resetNewWorkoutForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Workout Type</DialogTitle>
            <DialogDescription>
              Choose the type of workout you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {WORKOUT_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
                  }`}
                  data-testid={`type-option-${type.id}`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {type.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {type.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTypeSelection(false);
                resetNewWorkoutForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowTypeSelection(false);
                setShowAddWorkout(true);
              }}
              data-testid="button-continue-to-details"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Workout Details Dialog */}
      <Dialog 
        open={showAddWorkout} 
        onOpenChange={(open) => {
          setShowAddWorkout(open);
          if (!open) resetNewWorkoutForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Workout</DialogTitle>
            <DialogDescription>
              Enter the details for your new {WORKOUT_TYPES.find(t => t.id === selectedType)?.label.toLowerCase()} workout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g., Upper Push, Lower Pull, Full Body A"
                value={newWorkoutName}
                onChange={(e) => setNewWorkoutName(e.target.value)}
                data-testid="input-workout-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional workout description..."
                value={newWorkoutDescription}
                onChange={(e) => setNewWorkoutDescription(e.target.value)}
                rows={2}
                data-testid="input-workout-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cover Image (optional)</label>
              <p className="text-xs text-muted-foreground">
                Recommended: 1200 × 800px (3:2 landscape). Min 600px wide. Max 10MB. JPG or PNG.
              </p>
              {newWorkoutImageUrl ? (
                <div className="space-y-2">
                  <div className="relative inline-block">
                    <img
                      src={newWorkoutImageUrl}
                      alt="Workout cover"
                      className="w-48 h-32 object-cover rounded-lg border border-border"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold hover:bg-destructive/80"
                      onClick={() => setNewWorkoutImageUrl('')}
                    >
                      ✕
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Replace image
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleWorkoutImageUpload}
                      disabled={uploadingWorkoutImage}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-xs font-medium">Upload Image</span>
                    <span className="text-[10px]">1200 × 800px</span>
                  </div>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleWorkoutImageUpload}
                    disabled={uploadingWorkoutImage}
                    className="hidden"
                    data-testid="input-workout-image-upload"
                  />
                </label>
              )}
              {uploadingWorkoutImage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Uploading...
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={newWorkoutCategory} onValueChange={setNewWorkoutCategory}>
                  <SelectTrigger data-testid="select-workout-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <Select value={newWorkoutDifficulty} onValueChange={setNewWorkoutDifficulty}>
                  <SelectTrigger data-testid="select-workout-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((diff) => (
                      <SelectItem key={diff} value={diff}>{diff}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Workout Type</label>
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                {(() => {
                  const typeInfo = WORKOUT_TYPES.find(t => t.id === selectedType);
                  if (!typeInfo) return null;
                  const Icon = typeInfo.icon;
                  return (
                    <>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{typeInfo.label}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddWorkout(false);
                setShowTypeSelection(true);
              }}
            >
              Back
            </Button>
            <Button 
              onClick={() => createWorkoutMutation.mutate({
                name: newWorkoutName.trim(),
                description: newWorkoutDescription.trim() || undefined,
                workoutType: selectedType,
                category: newWorkoutCategory.toLowerCase(),
                difficulty: newWorkoutDifficulty.toLowerCase(),
                duration: parseInt(newWorkoutDuration) || 30,
                imageUrl: newWorkoutImageUrl.trim() || undefined,
              })}
              disabled={!newWorkoutName.trim() || createWorkoutMutation.isPending}
              data-testid="button-confirm-add-workout"
            >
              {createWorkoutMutation.isPending ? 'Creating...' : 'Create Workout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteWorkoutId !== null} onOpenChange={(open) => !open && setDeleteWorkoutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workoutToDelete?.name}"? This will permanently remove this workout and all its exercises from the programme. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkoutId && deleteWorkoutMutation.mutate(deleteWorkoutId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-workout"
            >
              {deleteWorkoutMutation.isPending ? 'Deleting...' : 'Delete Workout'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
