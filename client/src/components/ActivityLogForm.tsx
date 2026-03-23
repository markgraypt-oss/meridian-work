import { useState } from "react";
import { localDateStr } from "@/lib/dateUtils";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

// Helper function to handle optional numeric fields
const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
  z.number().optional()
);

// Form schemas for each activity type
const mealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().optional(),
  calories: optionalNumber,
  protein: optionalNumber,
  carbs: optionalNumber,
  fat: optionalNumber,
  date: z.string(),
});

const workoutSchema = z.object({
  title: z.string().min(1, "Title is required"),
  duration: optionalNumber,
  exercisesCompleted: optionalNumber,
  notes: z.string().optional(),
  date: z.string(),
});

const bodyStatsSchema = z.object({
  weight: optionalNumber,
  bodyFat: optionalNumber,
  muscleMass: optionalNumber,
  waist: optionalNumber,
  chest: optionalNumber,
  arms: optionalNumber,
  legs: optionalNumber,
  notes: z.string().optional(),
  date: z.string(),
});

const photoSchema = z.object({
  photoType: z.enum(['front', 'side', 'back', 'other']),
  imageUrl: z.string().min(1, "Photo is required"),
  notes: z.string().optional(),
  date: z.string(),
});

type ActivityType = 'meal' | 'workout' | 'bodyStats' | 'photo';

interface ActivityLogFormProps {
  activityType: ActivityType;
  selectedDate: Date;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ActivityLogForm({ activityType, selectedDate, onSuccess, onCancel }: ActivityLogFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");

  // Determine the schema based on activity type
  const getSchema = () => {
    switch (activityType) {
      case 'meal':
        return mealSchema;
      case 'workout':
        return workoutSchema;
      case 'bodyStats':
        return bodyStatsSchema;
      case 'photo':
        return photoSchema;
      default:
        return mealSchema;
    }
  };

  const form = useForm<any>({
    resolver: zodResolver(getSchema()),
    defaultValues: {
      date: localDateStr(selectedDate),
      ...(activityType === 'meal' && { mealType: 'lunch' }),
      ...(activityType === 'photo' && { photoType: 'front', imageUrl: uploadedImageUrl }),
    },
  });

  // Determine the API endpoint based on activity type
  const getEndpoint = () => {
    switch (activityType) {
      case 'meal':
        return '/api/meals';
      case 'workout':
        return '/api/workout-sessions';
      case 'bodyStats':
        return '/api/body-stats';
      case 'photo':
        return '/api/progress-photos';
      default:
        return '/api/meals';
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(getEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save activity');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/activities'] });
      toast({ title: "Success", description: "Activity logged successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to log activity",
        variant: "destructive" 
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { imageUrl } = await response.json();
      setUploadedImageUrl(imageUrl);
      form.setValue('imageUrl', imageUrl);
      toast({ title: "Success", description: "Image uploaded successfully" });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to upload image",
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const getTitle = () => {
    switch (activityType) {
      case 'meal':
        return 'Log Meal';
      case 'workout':
        return 'Log Workout';
      case 'bodyStats':
        return 'Log Body Stats';
      case 'photo':
        return 'Log Progress Photo';
      default:
        return 'Log Activity';
    }
  };

  return (
    <div className="space-y-4" data-testid={`form-${activityType}`}>
      <h3 className="text-lg font-semibold">{getTitle()}</h3>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Meal Form Fields */}
        {activityType === 'meal' && (
          <>
            <div>
              <Label htmlFor="title">Meal Name</Label>
              <Input {...form.register('title')} id="title" placeholder="e.g., Chicken and Rice" data-testid="input-meal-title" />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.title.message as string}</p>
              )}
            </div>

            <div>
              <Label htmlFor="mealType">Meal Type</Label>
              <Select onValueChange={(value) => form.setValue('mealType', value as any)} defaultValue="lunch">
                <SelectTrigger data-testid="select-meal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="calories">Calories</Label>
                <Input {...form.register('calories')} type="number" id="calories" placeholder="500" data-testid="input-calories" />
              </div>
              <div>
                <Label htmlFor="protein">Protein (g)</Label>
                <Input {...form.register('protein')} type="number" step="0.1" id="protein" placeholder="30" data-testid="input-protein" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input {...form.register('carbs')} type="number" step="0.1" id="carbs" placeholder="50" data-testid="input-carbs" />
              </div>
              <div>
                <Label htmlFor="fat">Fat (g)</Label>
                <Input {...form.register('fat')} type="number" step="0.1" id="fat" placeholder="15" data-testid="input-fat" />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea {...form.register('description')} id="description" placeholder="Additional notes..." data-testid="textarea-meal-description" />
            </div>
          </>
        )}

        {/* Workout Form Fields */}
        {activityType === 'workout' && (
          <>
            <div>
              <Label htmlFor="title">Workout Name</Label>
              <Input {...form.register('title')} id="title" placeholder="e.g., Morning Run" data-testid="input-workout-title" />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.title.message as string}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input {...form.register('duration')} type="number" id="duration" placeholder="45" data-testid="input-duration" />
              </div>
              <div>
                <Label htmlFor="exercisesCompleted">Exercises Completed</Label>
                <Input {...form.register('exercisesCompleted')} type="number" id="exercisesCompleted" placeholder="8" data-testid="input-exercises" />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea {...form.register('notes')} id="notes" placeholder="How did it go?" data-testid="textarea-workout-notes" />
            </div>
          </>
        )}

        {/* Body Stats Form Fields */}
        {activityType === 'bodyStats' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight">Weight</Label>
                <Input {...form.register('weight')} type="number" step="0.1" id="weight" placeholder="75.5" data-testid="input-weight" />
              </div>
              <div>
                <Label htmlFor="bodyFat">Body Fat (%)</Label>
                <Input {...form.register('bodyFat')} type="number" step="0.1" id="bodyFat" placeholder="15.5" data-testid="input-bodyfat" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="muscleMass">Muscle Mass</Label>
                <Input {...form.register('muscleMass')} type="number" step="0.1" id="muscleMass" placeholder="60" data-testid="input-muscle-mass" />
              </div>
              <div>
                <Label htmlFor="waist">Waist</Label>
                <Input {...form.register('waist')} type="number" step="0.1" id="waist" placeholder="85" data-testid="input-waist" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chest">Chest</Label>
                <Input {...form.register('chest')} type="number" step="0.1" id="chest" placeholder="100" data-testid="input-chest" />
              </div>
              <div>
                <Label htmlFor="arms">Arms</Label>
                <Input {...form.register('arms')} type="number" step="0.1" id="arms" placeholder="35" data-testid="input-arms" />
              </div>
            </div>

            <div>
              <Label htmlFor="legs">Legs</Label>
              <Input {...form.register('legs')} type="number" step="0.1" id="legs" placeholder="55" data-testid="input-legs" />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea {...form.register('notes')} id="notes" placeholder="Additional measurements or notes..." data-testid="textarea-stats-notes" />
            </div>
          </>
        )}

        {/* Progress Photo Form Fields */}
        {activityType === 'photo' && (
          <>
            <div>
              <Label htmlFor="photoType">Photo Type</Label>
              <Select onValueChange={(value) => form.setValue('photoType', value as any)} defaultValue="front">
                <SelectTrigger data-testid="select-photo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Front</SelectItem>
                  <SelectItem value="side">Side</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="image">Upload Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                data-testid="input-photo-upload"
              />
              {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
              {uploadedImageUrl && <p className="text-sm text-green-600 mt-1">Image uploaded successfully</p>}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea {...form.register('notes')} id="notes" placeholder="Progress notes..." data-testid="textarea-photo-notes" />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || uploading}
            className="flex-1"
            data-testid="button-submit"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
