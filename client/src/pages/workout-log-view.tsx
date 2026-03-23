import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ChevronLeft, MoreVertical, Pencil, Trash2, Bookmark, Loader2 } from "lucide-react";
import { WorkoutCompletionView } from "@/components/training/WorkoutCompletionView";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SetLog {
  id: number;
  setNumber: number;
  targetReps?: string;
  actualReps?: number;
  targetWeight?: number;
  actualWeight?: number;
  targetDuration?: string;
  actualDuration?: string;
  actualDurationMinutes?: number;
  actualDurationSeconds?: number;
  isCompleted: boolean;
  setDifficultyRating?: string;
  painFlag?: boolean;
  failureFlag?: boolean;
}

interface ExerciseLog {
  id: number;
  exerciseName: string;
  exerciseLibraryId?: number;
  blockType?: string;
  blockGroupId?: string;
  section?: string;
  position: number;
  restPeriod?: string;
  durationType?: string;
  exerciseType?: string;
  targetDuration?: string;
  targetReps?: string;
  sets: SetLog[];
}

interface WorkoutLogData {
  id: number;
  workoutName: string;
  workoutType: string;
  startedAt: string;
  completedAt: string;
  duration?: number;
  workoutRating?: number;
  autoCalculatedVolume?: number;
  notes?: string;
  exercises: ExerciseLog[];
}

export default function WorkoutLogView() {
  const { logId } = useParams<{ logId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [workoutName, setWorkoutName] = useState("");

  const urlParams = new URLSearchParams(searchString);
  const sourceParam = urlParams.get('source');

  const enrollmentIdParam = urlParams.get('enrollmentId');

  const handleBack = () => {
    if (sourceParam === 'home') {
      navigate('/');
    } else if (sourceParam === 'programme-history' && enrollmentIdParam) {
      navigate(`/programme-history/${enrollmentIdParam}`);
    } else {
      navigate('/progress/workouts');
    }
  };

  const { data: workoutLog, isLoading, refetch } = useQuery<WorkoutLogData>({
    queryKey: [`/api/workout-logs/${logId}`],
    enabled: !!logId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/workout-logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Workout deleted" });
      handleBack();
    },
    onError: () => {
      toast({ title: "Failed to delete workout", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `/api/workout-logs/${logId}/save`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/mine"] });
      toast({ title: "Workout saved to your library" });
      setShowSaveDialog(false);
      setWorkoutName("");
    },
    onError: () => {
      toast({ title: "Failed to save workout", variant: "destructive" });
    },
  });

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    deleteMutation.mutate();
  };

  const handleEditLog = () => {
    setShowActionSheet(false);
    setShowEditMode(true);
  };

  const handleEditComplete = () => {
    setShowEditMode(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/progress/workouts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const handleSaveWorkout = () => {
    if (workoutName.trim().length === 0) return;
    saveMutation.mutate(workoutName.trim());
  };

  const isCustomWorkout = workoutLog?.workoutType === 'custom';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Skeleton className="h-6 w-24" />
              <div className="w-10" />
            </div>
          </div>
        </div>
        <div className="px-4 py-6 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!workoutLog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workout log not found</p>
          <Button variant="ghost" onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const completedDate = workoutLog.completedAt 
    ? formatDate(new Date(workoutLog.completedAt), 'short')
    : '';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">{completedDate}</h1>
            <Drawer open={showActionSheet} onOpenChange={setShowActionSheet}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="p-4 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base font-normal h-12"
                    onClick={handleEditLog}
                  >
                    <Pencil className="h-5 w-5 mr-3" />
                    Edit Log
                  </Button>
                  {isCustomWorkout && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-base font-normal h-12"
                      onClick={() => {
                        setShowActionSheet(false);
                        setShowSaveDialog(true);
                      }}
                    >
                      <Bookmark className="h-5 w-5 mr-3" />
                      Save Workout
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-base font-normal h-12 text-destructive hover:text-destructive"
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-5 w-5 mr-3" />
                    Delete
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-2xl font-bold text-foreground mb-4">{workoutLog.workoutName}</h2>
        <WorkoutCompletionView 
          workoutLog={workoutLog} 
          onDelete={() => setShowDeleteDialog(true)}
          isEditing={showEditMode}
          onEditModeChange={(editing) => {
            setShowEditMode(editing);
            if (!editing) {
              handleEditComplete();
            }
          }}
        />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workout log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Workout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Give this workout a name so you can easily find and reuse it.
            </p>
            <Input
              placeholder="e.g. Monday Push Day"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && workoutName.trim().length > 0) {
                  handleSaveWorkout();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveWorkout}
              disabled={workoutName.trim().length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
