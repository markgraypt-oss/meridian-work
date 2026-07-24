import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Edit2, GripVertical, Dumbbell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Workout {
  day: number;
  week?: number;
  name: string;
  [key: string]: any;
}

interface WorkoutScheduleCalendarProps {
  workouts: Workout[];
  enrollmentId: string;
  onScheduleUpdate?: () => void;
  selectedWeek?: number;
  onWeekChange?: (week: number) => void;
  totalWeeks?: number;
}

const PROGRAMME_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

export default function WorkoutScheduleCalendar({ 
  workouts, 
  enrollmentId,
  selectedWeek = 1, 
  onWeekChange, 
  totalWeeks = 1,
  onScheduleUpdate
}: WorkoutScheduleCalendarProps) {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Record<number, string>>({});
  const [draggedWorkout, setDraggedWorkout] = useState<string | null>(null);
  const [draggedFromDay, setDraggedFromDay] = useState<number | null>(null);

  const updateScheduleMutation = useMutation({
    mutationFn: async (newSchedule: Record<number, string>) => {
      const res = await apiRequest('PATCH', `/api/my-programs/${enrollmentId}/week-schedule`, {
        week: selectedWeek,
        schedule: newSchedule,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs', enrollmentId] });
      toast({
        title: 'Success',
        description: `Week ${selectedWeek} schedule updated successfully`,
      });
      setShowEditDialog(false);
      onScheduleUpdate?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
    },
  });

  // Build schedule map for the selected week, falling back to Week 1 as template
  const scheduleMap: Record<number, string> = {};
  // First, populate with Week 1 data (template)
  workouts.forEach((workout) => {
    if (workout.day && workout.day >= 1 && workout.day <= 7 && workout.week === 1) {
      scheduleMap[workout.day] = workout.name.replace(/\s*\d+\s*$/, '');
    }
  });
  // Then override with selected week data if it exists
  if (selectedWeek !== 1) {
    workouts.forEach((workout) => {
      if (workout.day && workout.day >= 1 && workout.day <= 7 && workout.week === selectedWeek) {
        scheduleMap[workout.day] = workout.name.replace(/\s*\d+\s*$/, '');
      }
    });
  }

  const handleEditClick = () => {
    setEditSchedule({ ...scheduleMap });
    setShowEditDialog(true);
  };

  const handleDragStart = (workoutName: string, fromDay: number | null) => {
    setDraggedWorkout(workoutName);
    setDraggedFromDay(fromDay);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDay: number) => {
    e.preventDefault();
    if (!draggedWorkout) return;

    const newSchedule = { ...editSchedule };
    
    // If dragging from another day, clear that day
    if (draggedFromDay !== null && draggedFromDay !== targetDay) {
      delete newSchedule[draggedFromDay];
    }
    
    // If target day already has a workout and we're dragging from another day, swap them
    if (draggedFromDay !== null && draggedFromDay !== targetDay && newSchedule[targetDay]) {
      const targetWorkout = newSchedule[targetDay];
      newSchedule[draggedFromDay] = targetWorkout;
    }
    
    // Set the dragged workout to the target day
    newSchedule[targetDay] = draggedWorkout;
    
    setEditSchedule(newSchedule);
    setDraggedWorkout(null);
    setDraggedFromDay(null);
  };

  const handleDragEnd = () => {
    setDraggedWorkout(null);
    setDraggedFromDay(null);
  };

  const handleSaveSchedule = () => {
    // Use Week 1 workouts as the base template for all weeks
    const workoutsInWeek1 = workouts
      .filter(w => w.week === 1)
      .map(w => w.name.replace(/\s*\d+\s*$/, ''));
    
    const uniqueWorkouts = Array.from(new Set(workoutsInWeek1));
    const assignedWorkouts = Object.values(editSchedule).filter(v => v && v !== '' && v !== 'rest');
    const assignedUnique = Array.from(new Set(assignedWorkouts));
    
    const unassignedWorkouts = uniqueWorkouts.filter(workout => !assignedUnique.includes(workout));
    
    if (unassignedWorkouts.length > 0) {
      toast({
        title: 'Incomplete Schedule',
        description: `Please assign all workouts before saving. Missing: ${unassignedWorkouts.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    
    updateScheduleMutation.mutate(editSchedule);
  };

  // Get unique workouts from Week 1 (template for all weeks)
  const allWorkoutNames = Array.from(
    new Set(workouts.filter(w => w.week === 1).map(w => w.name.replace(/\s*\d+\s*$/, '')))
  );
  
  // Get unassigned workouts (workouts not currently in the editSchedule)
  const getUnassignedWorkouts = () => {
    const assignedWorkouts = Object.values(editSchedule).filter(Boolean);
    return allWorkoutNames.filter(name => !assignedWorkouts.includes(name));
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Weekly Schedule</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEditClick}
              className="text-primary hover:bg-primary/10"
              data-testid="button-edit-schedule"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PROGRAMME_DAYS.map((day, index) => {
              const dayNum = index + 1;
              const workout = scheduleMap[dayNum];
              const isRestDay = !workout;

              return (
                <div
                  key={dayNum}
                  className={`p-4 rounded-lg border transition-colors ${
                    isRestDay
                      ? 'bg-muted/30 border-dashed border-border hover:bg-muted/40'
                      : 'bg-primary/8 border-primary/20 hover:bg-primary/12'
                  }`}
                  data-testid={`schedule-day-${dayNum}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide w-24">{day}</div>
                    <div className={`text-sm flex-1 ${isRestDay ? 'text-muted-foreground italic' : 'text-foreground font-medium'}`}>
                      {workout || 'Rest Day'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog with Drag and Drop */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Weekly Schedule</DialogTitle>
          </DialogHeader>
          
          {/* Unassigned Workouts Pool */}
          {getUnassignedWorkouts().length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Drag workouts to assign them:</p>
              <div className="space-y-2">
                {getUnassignedWorkouts().map((name) => (
                  <div
                    key={name}
                    draggable
                    onDragStart={() => handleDragStart(name, null)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-move transition-all bg-primary/20 text-primary border-primary/30 ${
                      draggedWorkout === name ? 'opacity-50 scale-98' : 'hover:bg-primary/30'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 flex-shrink-0" />
                    <Dumbbell className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {PROGRAMME_DAYS.map((day, index) => {
              const dayNum = index + 1;
              const assignedWorkout = editSchedule[dayNum];

              return (
                <div
                  key={dayNum}
                  className={`p-3 rounded-lg border transition-all ${
                    draggedWorkout ? 'border-dashed border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayNum)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-sm font-semibold text-muted-foreground">{day}</div>
                    <div className="flex-1 min-h-[48px]">
                      {assignedWorkout ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(assignedWorkout, dayNum)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-move transition-all bg-primary/20 text-primary border-primary/30 ${
                            draggedWorkout === assignedWorkout && draggedFromDay === dayNum ? 'opacity-50 scale-98' : 'hover:bg-primary/30'
                          }`}
                        >
                          <GripVertical className="h-4 w-4 flex-shrink-0" />
                          <Dumbbell className="h-4 w-4 flex-shrink-0" />
                          <span className="font-medium">{assignedWorkout}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground/50 py-3 px-4 border border-dashed rounded-lg text-center">
                          Rest Day - Drop workout here
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              className="bg-primary"
              onClick={handleSaveSchedule}
              disabled={updateScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {updateScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
