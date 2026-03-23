import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addWeeks } from "date-fns";
import TopHeader from "@/components/TopHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Dumbbell, Target, Zap, Calendar, LogOut, Edit2, GripVertical } from "lucide-react";
import type React from "react";

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

const goalLabels: Record<string, string> = {
  strength: "Strength",
  max_strength: "Max Strength",
  hypertrophy: "Hypertrophy",
  power: "Power",
  functional_strength: "Functional Strength",
  conditioning: "Conditioning",
  hiit: "HIIT",
  mobility: "Mobility",
  corrective: "Corrective",
  yoga: "Yoga",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function ProgrammeHub() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Record<number, string>>({});
  const [draggedWorkout, setDraggedWorkout] = useState<string | null>(null);
  const [draggedFromDay, setDraggedFromDay] = useState<number | null>(null);

  const unenrollMutation = useMutation({
    mutationFn: async (enrollmentId: number) => {
      const res = await apiRequest("DELETE", `/api/my-programs/${enrollmentId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs"] });
      toast({
        title: "Programme exited",
        description: "You have successfully exited the programme.",
      });
      navigate("/training");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to exit programme.",
        variant: "destructive",
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (newSchedule: Record<number, string>) => {
      const res = await apiRequest('PATCH', `/api/my-programs/${id}/week-schedule`, {
        week: 1,
        schedule: newSchedule,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs', id] });
      toast({ title: 'Success', description: 'Schedule updated successfully' });
      setShowEditSchedule(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update schedule', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: programData, isLoading } = useQuery<any>({
    queryKey: ['/api/my-programs', id],
    queryFn: async () => {
      const res = await fetch(`/api/my-programs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch program');
      return res.json();
    },
    enabled: isAuthenticated && !!id,
    staleTime: 0,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading programme...</p>
        </div>
      </div>
    );
  }

  if (!programData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Programme not found</p>
          <Button onClick={() => navigate('/training')} className="mt-4">
            Back to Training
          </Button>
        </div>
      </div>
    );
  }

  const { program, startDate, workouts = [], status } = programData;
  const isActive = status === 'active';

  const weekWorkouts = workouts.filter((w: any) => w.week === 1);
  const distinctWorkouts = Array.from(
    new Map(weekWorkouts.map((w: any) => [w.name, w])).values()
  );

  const getEndDate = () => {
    if (!startDate) return null;
    const start = new Date(startDate);
    return addWeeks(start, program.weeks);
  };

  const workoutDays = new Map<number, string>();
  weekWorkouts.forEach((w: any) => {
    if (w.day && !workoutDays.has(w.day)) {
      workoutDays.set(w.day, w.name.replace(/\s*\d+\s*$/, ''));
    }
  });

  const allWorkoutNames = Array.from(
    new Set(weekWorkouts.map((w: any) => w.name.replace(/\s*\d+\s*$/, '')))
  );

  const handleEditSchedule = () => {
    const scheduleMap: Record<number, string> = {};
    workoutDays.forEach((name, day) => { scheduleMap[day] = name; });
    setEditSchedule(scheduleMap);
    setShowEditSchedule(true);
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
    if (draggedFromDay !== null && draggedFromDay !== targetDay) {
      if (newSchedule[targetDay]) {
        newSchedule[draggedFromDay] = newSchedule[targetDay];
      } else {
        delete newSchedule[draggedFromDay];
      }
    }
    newSchedule[targetDay] = draggedWorkout;
    setEditSchedule(newSchedule);
    setDraggedWorkout(null);
    setDraggedFromDay(null);
  };

  const handleSaveSchedule = () => {
    const assignedWorkouts = Object.values(editSchedule).filter((v): v is string => !!v && v !== 'rest');
    const assignedUnique = Array.from(new Set(assignedWorkouts));
    const unassigned = allWorkoutNames.filter((name: string) => !assignedUnique.includes(name));
    if (unassigned.length > 0) {
      toast({ title: 'Incomplete Schedule', description: `Missing: ${unassigned.join(', ')}`, variant: 'destructive' });
      return;
    }
    updateScheduleMutation.mutate(editSchedule);
  };

  const getUnassignedWorkouts = (): string[] => {
    const assigned = Object.values(editSchedule).filter((v): v is string => !!v);
    return allWorkoutNames.filter((name: string) => !assigned.includes(name));
  };

  const PROGRAMME_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={program.title}
        onBack={() => window.history.back()}
      />

      <div className="p-4 pt-14">
        <div className="max-w-4xl mx-auto space-y-4">
          {program.description && (
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-program-description">
                  {program.description}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Timeline</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {startDate && getEndDate() ? (
                    <p className="text-sm font-bold text-foreground">
                      {format(new Date(startDate), 'dd MMM')} - {format(getEndDate()!, 'dd MMM')}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-foreground">N/A</p>
                  )}
                  <Badge variant="default" className="text-xs">
                    {program.weeks}w
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Workouts per Week</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-foreground">{program.trainingDaysPerWeek || distinctWorkouts.length}</p>
                  <p className="text-sm text-foreground">sessions</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Programme Focus</span>
                </div>
                <Badge className="w-fit">
                  <Target className="w-3 h-3 mr-1" />
                  {goalLabels[program.goal] || program.goal}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Difficulty</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {difficultyLabels[program.difficulty] || program.difficulty}
                </p>
              </CardContent>
            </Card>
          </div>

          {distinctWorkouts.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-foreground">Workouts</h3>
                <div className="space-y-3">
                  {distinctWorkouts.map((workout: any) => (
                    <button
                      key={`${workout.week}-${workout.day}`}
                      onClick={() => navigate(`/workout-detail/${id}/${workout.week}/${workout.day}`)}
                      className="w-full text-left bg-muted rounded-lg border border-border hover:border-primary hover:bg-slate-650 transition-colors cursor-pointer flex gap-3 items-stretch overflow-hidden h-[72px]"
                      data-testid={`card-workout-${workout.name}`}
                    >
                      <div className="flex-shrink-0 w-[72px] h-[72px] bg-muted overflow-hidden flex items-center justify-center rounded-l-lg">
                        {workout.imageUrl ? (
                          <img
                            src={workout.imageUrl}
                            alt={workout.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Dumbbell className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-grow px-3 py-2.5 flex flex-col justify-center min-w-0 overflow-hidden">
                        <p className="text-base font-bold text-foreground leading-snug truncate">{workout.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-0.5">
                            <Dumbbell className="w-3.5 h-3.5" />
                            {workout.exerciseCount || workout.exercises?.length || 0} exercises
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            ~{workout.estimatedDuration || Math.round((workout.exercises?.length || 0) * 1.75)} min
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {distinctWorkouts.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Weekly Schedule</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditSchedule}
                    className="text-primary hover:bg-primary/10"
                    data-testid="button-edit-schedule"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const isWorkoutDay = workoutDays.has(day);
                    return (
                      <div
                        key={day}
                        className={`flex flex-col items-center rounded-lg border-2 py-2.5 px-1 ${
                          isWorkoutDay
                            ? "border-primary bg-primary/10"
                            : "border-slate-300 dark:border-slate-600 bg-muted/40"
                        }`}
                      >
                        <span className={`text-[10px] font-bold mb-1.5 ${
                          isWorkoutDay ? "text-primary" : "text-muted-foreground"
                        }`}>
                          Day {day}
                        </span>
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            isWorkoutDay
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/60"
                          }`}
                        >
                          {isWorkoutDay ? (
                            <Dumbbell className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-[8px] font-medium text-muted-foreground">Rest</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">Workout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-muted/60 border border-border" />
                    <span className="text-xs text-muted-foreground">Rest</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isActive && (
            <Button
              onClick={() => setShowExitDialog(true)}
              variant="outline"
              className="w-full text-destructive border-destructive hover:bg-destructive/10"
              data-testid="button-exit-programme"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Exit Programme
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showEditSchedule} onOpenChange={setShowEditSchedule}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Weekly Schedule</DialogTitle>
          </DialogHeader>
          
          {getUnassignedWorkouts().length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Drag workouts to assign them:</p>
              <div className="space-y-2">
                {getUnassignedWorkouts().map((name) => (
                  <div
                    key={name}
                    draggable
                    onDragStart={() => handleDragStart(name, null)}
                    onDragEnd={() => { setDraggedWorkout(null); setDraggedFromDay(null); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-move transition-all bg-slate-100 dark:bg-slate-700 text-foreground border-slate-300 dark:border-slate-600 ${
                      draggedWorkout === name ? 'opacity-50' : 'hover:bg-slate-200 dark:hover:bg-slate-600'
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
                          onDragEnd={() => { setDraggedWorkout(null); setDraggedFromDay(null); }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-move transition-all bg-slate-100 dark:bg-slate-700 text-foreground border-slate-300 dark:border-slate-600 ${
                            draggedWorkout === assignedWorkout && draggedFromDay === dayNum ? 'opacity-50' : 'hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <Dumbbell className="h-4 w-4 flex-shrink-0 text-primary" />
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
            <Button variant="outline" onClick={() => setShowEditSchedule(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary"
              onClick={handleSaveSchedule}
              disabled={updateScheduleMutation.isPending}
            >
              {updateScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Programme?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exit this programme? Your progress will be lost and you'll need to re-enroll to continue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unenrollMutation.mutate(parseInt(id!))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unenrollMutation.isPending}
            >
              {unenrollMutation.isPending ? "Exiting..." : "Exit Programme"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
