import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Programme } from "@shared/schema";
import { ProgrammeExerciseManager } from "./ProgrammeExerciseManager";

const programFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  whoItsFor: z.string().optional(),
  goal: z.enum(["strength", "max_strength", "hypertrophy", "power", "functional_strength", "conditioning", "hiit", "mobility", "corrective", "yoga"]),
  equipment: z.enum(["bands_only", "db_bench_only", "full_gym", "no_equipment", "bodyweight", "kettlebell_only", "dumbbell_only"]),
  weeks: z.number().min(1, "Programme must be at least 1 week"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  imageUrl: z.string().optional().or(z.literal("")),
  category: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

type ProgrammeFormData = z.infer<typeof programFormSchema>;

interface ProgrammeFormProps {
  program?: Programme | null;
  onClose: () => void;
}

const AVAILABLE_CATEGORIES = [
  { value: "gym", label: "Gym" },
  { value: "home", label: "Home" },
  { value: "travel", label: "Great for Travel" },
  { value: "female_specific", label: "Female Specific" },
];

const AVAILABLE_TAGS = [
  { value: "full_body", label: "Full Body" },
  { value: "upper_body", label: "Upper Body" },
  { value: "lower_body", label: "Lower Body" },
  { value: "time_efficient", label: "Time Efficient" },
  { value: "free_weights_only", label: "Free Weights Only" },
  { value: "cardio", label: "Cardio" },
];

export function ProgrammeForm({ program, onClose }: ProgrammeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => {
    const storedTab = sessionStorage.getItem('programmeFormTab');
    return storedTab === 'exercises' && program ? 'exercises' : 'details';
  });

  const form = useForm<ProgrammeFormData>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      title: program?.title || "",
      description: program?.description || "",
      whoItsFor: program?.whoItsFor || "",
      goal: program?.goal as any || "general_strength",
      equipment: program?.equipment as "bands_only" | "db_bench_only" | "full_gym" | "no_equipment" | "bodyweight" | "kettlebell_only" | "dumbbell_only" || "full_gym",
      weeks: program?.weeks || 12,
      difficulty: program?.difficulty as "beginner" | "intermediate" | "advanced" || "intermediate",
      imageUrl: program?.imageUrl || "",
      category: program?.category || [],
      tags: program?.tags || [],
    },
  });

  const EQUIPMENT_LABELS: Record<string, string> = {
    no_equipment: "No Equipment (At Home)",
    bodyweight: "Bodyweight",
    bands_only: "Bands Only",
    kettlebell_only: "Kettlebell Only",
    dumbbell_only: "Dumbbell Only",
    db_bench_only: "DB/Bench Only",
    full_gym: "Full Gym",
  };

  const { data: detectedEquipment } = useQuery<{ level: string; allEquipment: string[]; highestTier: number }>({
    queryKey: ['/api/programs', program?.id, 'equipment-detection'],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${program!.id}/equipment-detection`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!program?.id,
  });

  useEffect(() => {
    if (detectedEquipment?.level && program && detectedEquipment.allEquipment && detectedEquipment.allEquipment.length > 0) {
      const level = detectedEquipment.level as any;
      form.setValue('equipment', level);
    }
  }, [detectedEquipment?.level]);

  const mutation = useMutation({
    mutationFn: async (data: ProgrammeFormData) => {
      const payload = {
        ...data,
        category: data.category || [],
        tags: data.tags || [],
      };

      const url = program ? `/api/programs/${program.id}` : "/api/programs";
      const method = program ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({
        title: "Success",
        description: `Programme ${program ? "updated" : "created"} successfully`,
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
        description: `Failed to ${program ? "update" : "create"} program`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProgrammeFormData) => {
    mutation.mutate(data);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { imageUrl } = await response.json();
      form.setValue('imageUrl', imageUrl);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {program ? "Edit Programme" : "Create New Programme"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Programme Details</TabsTrigger>
            <TabsTrigger value="exercises" disabled={!program}>
              Workout Content
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Programme title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Programme description"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-left">
                          <SelectValue placeholder="Select goal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="max_strength">Max Strength</SelectItem>
                        <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                        <SelectItem value="power">Power</SelectItem>
                        <SelectItem value="functional_strength">Functional Strength</SelectItem>
                        <SelectItem value="conditioning">Conditioning</SelectItem>
                        <SelectItem value="hiit">HIIT</SelectItem>
                        <SelectItem value="mobility">Mobility</SelectItem>
                        <SelectItem value="corrective">Corrective</SelectItem>
                        <SelectItem value="yoga">Yoga</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment</FormLabel>
                    {program ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                          <span className="text-sm">{EQUIPMENT_LABELS[field.value] || field.value}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">(auto)</span>
                        </div>
                        {detectedEquipment?.allEquipment && detectedEquipment.allEquipment.length > 0 && (
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Detected: {detectedEquipment.allEquipment.join(", ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-left">
                            <SelectValue placeholder="Select equipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no_equipment">No Equipment (At Home)</SelectItem>
                          <SelectItem value="bodyweight">Bodyweight</SelectItem>
                          <SelectItem value="bands_only">Bands Only</SelectItem>
                          <SelectItem value="kettlebell_only">Kettlebell Only</SelectItem>
                          <SelectItem value="dumbbell_only">Dumbbell Only</SelectItem>
                          <SelectItem value="db_bench_only">DB/Bench Only</SelectItem>
                          <SelectItem value="full_gym">Full Gym</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-left">
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-8 items-start">
              <FormField
                control={form.control}
                name="weeks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Length (weeks)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || ""}>
                      <FormControl>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select weeks" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="2">2 Weeks</SelectItem>
                        <SelectItem value="4">4 Weeks</SelectItem>
                        <SelectItem value="6">6 Weeks</SelectItem>
                        <SelectItem value="8">8 Weeks</SelectItem>
                        <SelectItem value="10">10 Weeks</SelectItem>
                        <SelectItem value="12">12 Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <label className="text-sm font-medium">Training Days per Week</label>
                <div className="mt-2 text-sm text-muted-foreground">
                  <div>{program?.trainingDaysPerWeek || 0} workouts</div>
                  <div className="text-xs whitespace-nowrap">Based on workouts in Workout Content</div>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Programme Cover Image (optional)</FormLabel>
                  <p className="text-xs text-muted-foreground mb-2">
                    Recommended: 800 × 1200px (2:3 portrait). Min 600px wide. Max 10MB. JPG or PNG.
                  </p>
                  <div className="space-y-3">
                    {field.value ? (
                      <div className="relative inline-block">
                        <img
                          src={field.value}
                          alt="Programme cover"
                          className="w-48 h-72 object-cover rounded-lg border border-border"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full"
                          onClick={() => field.onChange("")}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-48 h-72 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <span className="text-sm font-medium">Upload Image</span>
                          <span className="text-xs">800 × 1200px</span>
                        </div>
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                    )}
                    {uploadingImage && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Uploading...
                      </div>
                    )}
                    {field.value && (
                      <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Replace image
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <p className="text-xs text-muted-foreground">Primary navigation — controls which category tabs this programme appears under in the library</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {AVAILABLE_CATEGORIES.map((cat) => (
                      <div key={cat.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${cat.value}`}
                          checked={field.value?.includes(cat.value) || false}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, cat.value]);
                            } else {
                              field.onChange(current.filter((c: string) => c !== cat.value));
                            }
                          }}
                        />
                        <Label htmlFor={`cat-${cat.value}`} className="text-sm font-normal cursor-pointer">
                          {cat.label}
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
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <p className="text-xs text-muted-foreground">Secondary filters — users can filter programmes by these tags within any category</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {AVAILABLE_TAGS.map((tag) => (
                      <div key={tag.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag.value}`}
                          checked={field.value?.includes(tag.value) || false}
                          onCheckedChange={(checked) => {
                            const currentTags = field.value || [];
                            if (checked) {
                              field.onChange([...currentTags, tag.value]);
                            } else {
                              field.onChange(currentTags.filter((t) => t !== tag.value));
                            }
                          }}
                        />
                        <Label htmlFor={`tag-${tag.value}`} className="text-sm font-normal cursor-pointer">
                          {tag.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

                <div className="flex justify-end space-x-4 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : program ? "Update Programme" : "Create Programme"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="exercises" className="mt-6">
            {program ? (
              <ProgrammeExerciseManager 
                programId={program.id} 
                totalWeeks={program.weeks}
              />
            ) : (
              <div className="p-6 border border-dashed border-border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Save the programme first to manage exercises.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}