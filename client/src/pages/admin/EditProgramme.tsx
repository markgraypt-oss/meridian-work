import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ProgrammeExerciseManager } from "@/components/admin/ProgrammeExerciseManager";
import { WorkoutScheduleEditor } from "@/components/admin/WorkoutScheduleEditor";
import TopHeader from "@/components/TopHeader";

const programFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  goal: z.enum(["strength", "max_strength", "hypertrophy", "power", "functional_strength", "conditioning", "hiit", "mobility", "corrective", "yoga"]),
  equipment: z.enum(["bands_only", "db_bench_only", "full_gym", "no_equipment", "bodyweight", "kettlebell_only", "dumbbell_only"]),
  weeks: z.number().min(1, "Programme must be at least 1 week"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  imageUrl: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
});

type ProgrammeFormData = z.infer<typeof programFormSchema>;

const AVAILABLE_TAGS = [
  { value: "full_body", label: "Full Body" },
  { value: "upper_body", label: "Upper Body" },
  { value: "lower_body", label: "Lower Body" },
  { value: "time_efficient", label: "Time Efficient" },
  { value: "free_weights_only", label: "Free Weights Only" },
  { value: "cardio", label: "Cardio" },
];

const AVAILABLE_CATEGORIES = [
  { value: "gym", label: "Gym" },
  { value: "home", label: "Home" },
  { value: "travel", label: "Great for Travel" },
  { value: "female_specific", label: "Female Specific" },
];

export default function EditProgrammePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const { markDirty, markClean, handleNavigation, UnsavedChangesDialog } = useUnsavedChanges();

  // Get programmeType from query params
  const urlParams = new URLSearchParams(window.location.search);
  const programmeType = urlParams.get('programmeType') || 'main';

  const programId = parseInt(id || "0");

  const { data: program, isLoading } = useQuery({
    queryKey: ["/api/programs", programId],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${programId}`);
      if (!res.ok) throw new Error("Failed to fetch programme");
      return res.json();
    },
    enabled: programId > 0,
  });

  const form = useForm<ProgrammeFormData>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      title: "",
      description: "",
      goal: "general_strength",
      equipment: "full_gym",
      weeks: 12,
      difficulty: "intermediate",
      imageUrl: "",
      tags: [],
      category: [],
    },
  });

  useEffect(() => {
    if (program) {
      form.reset({
        title: program.title || "",
        description: program.description || "",
        goal: program.goal || "general_strength",
        equipment: program.equipment || "full_gym",
        weeks: program.weeks || 12,
        difficulty: program.difficulty || "intermediate",
        imageUrl: program.imageUrl || "",
        tags: program.tags || [],
        category: program?.category || [],
      });
      markClean();
    }
  }, [program, form, markClean]);

  useEffect(() => {
    const subscription = form.watch(() => {
      markDirty();
    });
    return () => subscription.unsubscribe();
  }, [form, markDirty]);

  useEffect(() => {
    const savedTab = sessionStorage.getItem('programmeFormTab');
    if (savedTab) {
      setActiveTab(savedTab);
      sessionStorage.removeItem('programmeFormTab');
    }
  }, []);

  const mutation = useMutation({
    mutationFn: async (data: ProgrammeFormData) => {
      const payload = {
        ...data,
        tags: data.tags || [],
        category: data.category || [],
      };

      const response = await fetch(`/api/programs/${programId}`, {
        method: "PUT",
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
      queryClient.invalidateQueries({ queryKey: ["/api/programs", programId] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs", programmeType] });
      toast({
        title: "Success",
        description: "Programme updated successfully",
      });
      // Navigate back to the appropriate admin tab based on programmeType
      const backTab = programmeType === 'stretching' ? 'stretching' : 
                      programmeType === 'corrective' ? 'corrective' : 'programs';
      // Include subtab=programmes for stretching/corrective sections
      const subtab = (programmeType === 'stretching' || programmeType === 'corrective') ? '&subtab=programmes' : '';
      navigate(`/admin?tab=${backTab}${subtab}`);
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
        description: "Failed to update programme",
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

  const handleBack = () => {
    // Navigate back to the appropriate admin tab based on programmeType
    const backTab = programmeType === 'stretching' ? 'stretching' : 
                    programmeType === 'corrective' ? 'corrective' : 'programs';
    // Include subtab=programmes for stretching/corrective sections
    const subtab = (programmeType === 'stretching' || programmeType === 'corrective') ? '&subtab=programmes' : '';
    handleNavigation(`/admin?tab=${backTab}${subtab}`);
  };
  
  // Get title context based on programmeType
  const getPageTitle = () => {
    switch (programmeType) {
      case 'stretching': return 'Edit Stretching Programme';
      case 'corrective': return 'Edit Corrective Exercise Programme';
      default: return 'Edit Programme';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader onBack={handleBack} />
        <div className="pt-16 px-4">
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader onBack={handleBack} />
        <div className="pt-16 px-4">
          <div className="text-center text-muted-foreground py-8">Programme not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader onBack={handleBack} />
      <UnsavedChangesDialog />
      
      <div className="pt-16 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="exercises">Workouts</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Programme title" {...field} data-testid="input-programme-title" />
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
                          data-testid="input-programme-description"
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
                            <SelectTrigger data-testid="select-programme-goal" className="text-left">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-programme-equipment" className="text-left">
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
                            <SelectTrigger data-testid="select-programme-difficulty" className="text-left">
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
                            <SelectTrigger data-testid="input-programme-weeks" className="w-32">
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
                      {program.trainingDaysPerWeek || 0} workouts
                      <span className="block text-xs mt-1">Based on workouts in Workout Content</span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Programme Image (optional)</FormLabel>
                      <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="max-w-sm"
                            data-testid="input-programme-image"
                          />
                          {uploadingImage && <span className="text-sm text-muted-foreground">Uploading...</span>}
                        </div>
                        {field.value && (
                          <div className="flex items-center gap-2">
                            <img src={field.value} alt="Programme preview" className="h-20 w-20 object-cover rounded" />
                            <Input 
                              placeholder="https://example.com/image.jpg"
                              value={field.value}
                              onChange={field.onChange}
                              className="max-w-sm"
                            />
                          </div>
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
                      <p className="text-xs text-muted-foreground">Primary navigation — controls which category tabs this programme appears under</p>
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
                      <p className="text-xs text-muted-foreground">Secondary filters — users can filter programmes by these tags</p>
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
                                  field.onChange(currentTags.filter((t: string) => t !== tag.value));
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
                  <Button type="button" variant="outline" onClick={() => handleNavigation("/admin")} data-testid="button-cancel-programme">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending} data-testid="button-save-programme">
                    {mutation.isPending ? "Saving..." : "Update Programme"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="exercises">
            <ProgrammeExerciseManager 
              programId={program.id} 
              totalWeeks={program.weeks}
              programmeType={programmeType}
              onDirtyStateChange={(isDirty) => {
                if (isDirty) {
                  markDirty();
                } else {
                  markClean();
                }
              }}
            />
          </TabsContent>

          <TabsContent value="schedule">
            <WorkoutScheduleEditor 
              programId={program.id} 
              totalWeeks={program.weeks}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
