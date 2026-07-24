import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { insertExerciseLibraryItemSchema, type ExerciseLibraryItem, type InsertExerciseLibraryItem } from "@shared/schema";
import { z } from "zod";

// Use the base schema - muxPlaybackId is optional
const exerciseFormSchema = insertExerciseLibraryItemSchema;
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "./exerciseFilterConstants";

interface ExerciseLibraryFormProps {
  open: boolean;
  onClose: () => void;
  exercise?: ExerciseLibraryItem | null;
}

export function ExerciseLibraryForm({ open, onClose, exercise }: ExerciseLibraryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useForm<InsertExerciseLibraryItem>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: {
      name: "",
      instructions: null,
      mainMuscle: [],
      equipment: [],
      movement: [],
      mechanics: [],
      level: "Beginner",
      exerciseType: "strength",
      muxPlaybackId: "",
      imageUrl: null,
    },
  });

  const EXERCISE_TYPE_OPTIONS = [
    { value: "general", label: "General", description: "Time only (e.g., foam rolling, stretching)" },
    { value: "endurance", label: "Endurance", description: "Reps only, no weight (e.g., bodyweight exercises)" },
    { value: "strength", label: "Strength", description: "Reps + Weight (e.g., barbell exercises)" },
    { value: "cardio", label: "Cardio", description: "Time + Reps (e.g., running)" },
    { value: "timed", label: "Timed", description: "Time + Reps (e.g., planks)" },
    { value: "timed_strength", label: "Timed Strength", description: "Time + Reps + Weight (e.g., side plank with dumbbell)" },
  ];

  // Reset form when exercise changes or dialog opens
  useEffect(() => {
    if (open) {
      if (exercise) {
        form.reset({
          name: exercise.name,
          instructions: exercise.instructions,
          mainMuscle: exercise.mainMuscle || [],
          equipment: exercise.equipment || [],
          movement: exercise.movement || [],
          mechanics: exercise.mechanics || [],
          level: exercise.level || "Beginner",
          exerciseType: exercise.exerciseType || "strength",
          muxPlaybackId: exercise.muxPlaybackId || "",
          imageUrl: null,
        });
      } else {
        form.reset({
          name: "",
          instructions: null,
          mainMuscle: [],
          equipment: [],
          movement: [],
          mechanics: [],
          level: "Beginner",
          exerciseType: "strength",
          muxPlaybackId: "",
          imageUrl: null,
        });
      }
    }
  }, [exercise, open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertExerciseLibraryItem) => {
      const res = await apiRequest("POST", "/api/exercises", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: "Success",
        description: "Exercise created successfully",
      });
      onClose();
      form.reset();
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
        description: "Failed to create exercise",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertExerciseLibraryItem) => {
      const res = await apiRequest("PUT", `/api/exercises/${exercise?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: "Success",
        description: "Exercise updated successfully",
      });
      onClose();
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
        description: "Failed to update exercise",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/exercises/${exercise?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: "Success",
        description: "Exercise deleted successfully",
      });
      setShowDeleteConfirm(false);
      onClose();
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
        description: "Failed to delete exercise. It may be in use by workouts.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertExerciseLibraryItem) => {
    if (exercise) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise ? "Edit" : "Create"} Exercise</DialogTitle>
          <DialogDescription>
            {exercise ? "Update" : "Add a new"} exercise to the master library
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercise Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Barbell Back Squat" data-testid="input-exercise-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exerciseType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercise Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "strength"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-exercise-type">
                        <SelectValue placeholder="Select exercise type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXERCISE_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions (Coaching Cues)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Enter coaching cues and instructions for this exercise..."
                      rows={4}
                      data-testid="textarea-exercise-instructions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-exercise-level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEVEL_OPTIONS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mainMuscle"
              render={({ field }) => {
                const existingTags = field.value || [];
                const allMuscleOptions = Array.from(new Set([...MAIN_MUSCLE_OPTIONS, ...existingTags])).sort();
                return (
                  <FormItem>
                    <FormLabel>Main Muscle</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {allMuscleOptions.map((muscle) => (
                        <div key={muscle} className="flex items-center space-x-2">
                          <Checkbox
                            id={`muscle-${muscle}`}
                            checked={field.value?.includes(muscle) || false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, muscle]);
                              } else {
                                field.onChange(current.filter((m) => m !== muscle));
                              }
                            }}
                            data-testid={`checkbox-muscle-${muscle.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}
                          />
                          <Label htmlFor={`muscle-${muscle}`} className="text-sm font-normal cursor-pointer">
                            {muscle}
                            {!MAIN_MUSCLE_OPTIONS.includes(muscle) && <span className="text-xs text-muted-foreground ml-1">(archived)</span>}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="equipment"
              render={({ field }) => {
                const existingTags = field.value || [];
                const allEquipmentOptions = Array.from(new Set([...EQUIPMENT_OPTIONS, ...existingTags])).sort();
                return (
                  <FormItem>
                    <FormLabel>Equipment</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {allEquipmentOptions.map((equipment) => (
                        <div key={equipment} className="flex items-center space-x-2">
                          <Checkbox
                            id={`equipment-${equipment}`}
                            checked={field.value?.includes(equipment) || false}
                            onCheckedChange={(checked) => {
                              const currentEquipment = field.value || [];
                              if (checked) {
                                field.onChange([...currentEquipment, equipment]);
                              } else {
                                field.onChange(currentEquipment.filter((e) => e !== equipment));
                              }
                            }}
                            data-testid={`checkbox-equipment-${equipment.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}
                          />
                          <Label htmlFor={`equipment-${equipment}`} className="text-sm font-normal cursor-pointer">
                            {equipment}
                            {!EQUIPMENT_OPTIONS.includes(equipment) && <span className="text-xs text-muted-foreground ml-1">(archived)</span>}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="movement"
              render={({ field }) => {
                const existingTags = field.value || [];
                const archivedPatterns = existingTags.filter(t => !MOVEMENT_PATTERN_OPTIONS.includes(t) && !MOVEMENT_TYPE_OPTIONS.includes(t));
                return (
                  <FormItem>
                    <FormLabel>Movement Pattern</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 border rounded-md p-3">
                      {MOVEMENT_PATTERN_OPTIONS.map((movement) => (
                        <div key={movement} className="flex items-center space-x-2">
                          <Checkbox
                            id={`movement-${movement}`}
                            checked={field.value?.includes(movement) || false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, movement]);
                              } else {
                                field.onChange(current.filter((m) => m !== movement));
                              }
                            }}
                            data-testid={`checkbox-movement-${movement.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}
                          />
                          <Label htmlFor={`movement-${movement}`} className="text-sm font-normal cursor-pointer">
                            {movement}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <FormLabel className="mt-4 block">Movement Type</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 border rounded-md p-3">
                      {MOVEMENT_TYPE_OPTIONS.map((movement) => (
                        <div key={movement} className="flex items-center space-x-2">
                          <Checkbox
                            id={`movement-${movement}`}
                            checked={field.value?.includes(movement) || false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, movement]);
                              } else {
                                field.onChange(current.filter((m) => m !== movement));
                              }
                            }}
                            data-testid={`checkbox-movement-${movement.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}
                          />
                          <Label htmlFor={`movement-${movement}`} className="text-sm font-normal cursor-pointer">
                            {movement}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {archivedPatterns.length > 0 && (
                      <>
                        <FormLabel className="mt-4 block text-muted-foreground">Archived Tags</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 border rounded-md p-3 bg-muted/30">
                          {archivedPatterns.map((movement) => (
                            <div key={movement} className="flex items-center space-x-2">
                              <Checkbox
                                id={`movement-${movement}`}
                                checked={field.value?.includes(movement) || false}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, movement]);
                                  } else {
                                    field.onChange(current.filter((m) => m !== movement));
                                  }
                                }}
                                data-testid={`checkbox-movement-${movement.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}
                              />
                              <Label htmlFor={`movement-${movement}`} className="text-sm font-normal cursor-pointer text-muted-foreground">
                                {movement} <span className="text-xs">(archived)</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="mechanics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mechanics</FormLabel>
                  <div className="flex gap-4 mt-2">
                    {MECHANICS_OPTIONS.map((mechanic) => (
                      <div key={mechanic} className="flex items-center space-x-2">
                        <Checkbox
                          id={`mechanic-${mechanic}`}
                          checked={field.value?.includes(mechanic) || false}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, mechanic]);
                            } else {
                              field.onChange(current.filter((m) => m !== mechanic));
                            }
                          }}
                          data-testid={`checkbox-mechanic-${mechanic.toLowerCase()}`}
                        />
                        <Label htmlFor={`mechanic-${mechanic}`} className="text-sm font-normal cursor-pointer">
                          {mechanic}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="muxPlaybackId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mux Playback ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., DS00Spx1CV902MCtPj5WknGlR102V5HFkDe" data-testid="input-mux-playback-id" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Paste the Playback ID from Mux. Leave empty if video is not yet available.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-exercise"
                className="w-full"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : exercise
                  ? "Update Exercise"
                  : "Create Exercise"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
                className="w-full"
              >
                Cancel
              </Button>
              {exercise && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-exercise"
                  className="w-full"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Exercise"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{exercise?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
