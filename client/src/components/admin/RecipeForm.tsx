import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Upload, X } from "lucide-react";
import type { Recipe } from "@shared/schema";

const TAG_OPTIONS = [
  "High fiber",
  "One pot",
  "Instant pot",
  "Slow cooker",
  "Salad",
  "Soup",
  "Smoothie",
  "Simple meals",
  "No cooking",
];

const ALLERGEN_OPTIONS = [
  "Fish",
  "Shellfish",
  "Soy",
  "Tree nuts",
  "Eggs",
  "Dairy",
  "Gluten",
  "Peanuts",
  "Pork",
];

const DIETARY_PREFERENCE_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Keto",
  "Paleo",
  "Gluten-free",
  "Dairy-free",
  "Low-carb",
  "High protein",
];

const KEY_INGREDIENT_OPTIONS = [
  "Chicken",
  "Beef",
  "Fish",
  "Pork",
  "Seafood",
  "Eggs",
  "Tofu",
  "Vegetables",
  "Fruit",
  "Grains",
];

const recipeFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["breakfast", "main", "dessert", "side"]),
  totalTime: z.number().min(0, "Total time must be at least 0 minutes"),
  servings: z.number().min(1, "Must serve at least 1 person"),
  calories: z.number().min(0, "Calories must be at least 0"),
  protein: z.number().min(0, "Protein must be at least 0"),
  carbs: z.number().min(0, "Carbs must be at least 0"),
  fat: z.number().min(0, "Fat must be at least 0"),
  ingredients: z.string().min(1, "Ingredients are required"),
  instructions: z.string().min(1, "Instructions are required"),
  tags: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  dietaryPreferences: z.array(z.string()).default([]),
  keyIngredients: z.array(z.string()).default([]),
});

type RecipeFormData = z.infer<typeof recipeFormSchema>;

interface RecipeFormProps {
  recipe?: Recipe | null;
  onClose: () => void;
}

export function RecipeForm({ recipe, onClose }: RecipeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<RecipeFormData>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      title: recipe?.title || "",
      description: recipe?.description || "",
      category: recipe?.category as "breakfast" | "main" | "dessert" | "side" || "main",
      totalTime: recipe?.totalTime || 15,
      servings: recipe?.servings || 1,
      calories: recipe?.calories || 300,
      protein: recipe?.protein || 20,
      carbs: recipe?.carbs || 30,
      fat: recipe?.fat || 10,
      ingredients: recipe?.ingredients?.join("\n") || "",
      instructions: recipe?.instructions?.join("\n") || "",
      tags: recipe?.tags || [],
      allergens: (recipe as any)?.allergens || [],
      dietaryPreferences: (recipe as any)?.dietaryPreferences || [],
      keyIngredients: (recipe as any)?.keyIngredients || [],
    },
  });

  const protein = form.watch("protein");
  const carbs = form.watch("carbs");
  const fat = form.watch("fat");

  useEffect(() => {
    const calculatedCalories = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
    form.setValue("calories", calculatedCalories);
  }, [protein, carbs, fat, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const mutation = useMutation({
    mutationFn: async (data: RecipeFormData) => {
      let imageUrl = recipe?.imageUrl || "";

      if (imageFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("image", imageFile);
        
        const uploadResponse = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }
        
        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.url;
        setIsUploading(false);
      } else if (imagePreview === null && recipe?.imageUrl) {
        imageUrl = "";
      }

      const payload = {
        ...data,
        imageUrl,
        ingredients: data.ingredients.split("\n").map(ing => ing.trim()).filter(Boolean),
        instructions: data.instructions.split("\n").map(inst => inst.trim()).filter(Boolean),
        tags: data.tags || [],
        allergens: data.allergens || [],
        dietaryPreferences: data.dietaryPreferences || [],
        keyIngredients: data.keyIngredients || [],
      };

      const url = recipe ? `/api/recipes/${recipe.id}` : "/api/recipes";
      const method = recipe ? "PUT" : "POST";
      
      const response = await apiRequest(method, url, payload);
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Success",
        description: `Recipe ${recipe ? "updated" : "created"} successfully`,
      });
      onClose();
    },
    onError: (error) => {
      setIsUploading(false);
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
        description: `Failed to ${recipe ? "update" : "create"} recipe`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RecipeFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recipe ? "Edit Recipe" : "Create New Recipe"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Recipe title" {...field} />
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
                      placeholder="Recipe description"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="main">Main</SelectItem>
                        <SelectItem value="dessert">Dessert</SelectItem>
                        <SelectItem value="side">Side</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="totalTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Time (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="servings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servings</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="calories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calories (auto)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="300"
                        {...field}
                        readOnly
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="protein"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protein (g)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="20"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="carbs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carbs (g)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fat (g)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <FormLabel>Recipe Image</FormLabel>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Recommended: 1200 × 800px (3:2 landscape). Min 600px wide. Max 10MB. JPG or PNG.
              </p>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="space-y-2">
                    <div className="relative inline-block">
                      <img 
                        src={imagePreview} 
                        alt="Recipe preview" 
                        className="w-48 h-32 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold hover:bg-destructive/80"
                      >
                        ✕
                      </button>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                      <Upload className="h-3 w-3" />
                      Replace image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground font-medium">Upload Image</span>
                    <span className="text-[10px] text-muted-foreground">1200 × 800px</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="ingredients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredients (one per line)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="2 cups flour&#10;1 tsp salt&#10;3 eggs"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions (one step per line)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Add wet ingredients"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dietaryPreferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dietary Preferences</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {DIETARY_PREFERENCE_OPTIONS.map((pref) => (
                        <div key={pref} className="flex items-center space-x-2">
                          <Checkbox
                            id={`dietary-${pref}`}
                            checked={field.value?.includes(pref)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), pref]);
                              } else {
                                field.onChange((field.value || []).filter((p: string) => p !== pref));
                              }
                            }}
                          />
                          <label
                            htmlFor={`dietary-${pref}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {pref}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keyIngredients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Ingredients</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {KEY_INGREDIENT_OPTIONS.map((ing) => (
                        <div key={ing} className="flex items-center space-x-2">
                          <Checkbox
                            id={`keyIng-${ing}`}
                            checked={field.value?.includes(ing)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), ing]);
                              } else {
                                field.onChange((field.value || []).filter((i: string) => i !== ing));
                              }
                            }}
                          />
                          <label
                            htmlFor={`keyIng-${ing}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {ing}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {TAG_OPTIONS.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag}`}
                            checked={field.value?.includes(tag)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), tag]);
                              } else {
                                field.onChange((field.value || []).filter((t: string) => t !== tag));
                              }
                            }}
                          />
                          <label
                            htmlFor={`tag-${tag}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {tag}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allergens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contains Allergens</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ALLERGEN_OPTIONS.map((allergen) => (
                        <div key={allergen} className="flex items-center space-x-2">
                          <Checkbox
                            id={`allergen-${allergen}`}
                            checked={field.value?.includes(allergen)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), allergen]);
                              } else {
                                field.onChange((field.value || []).filter((a: string) => a !== allergen));
                              }
                            }}
                          />
                          <label
                            htmlFor={`allergen-${allergen}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {allergen}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || isUploading}>
                {isUploading ? "Uploading..." : mutation.isPending ? "Saving..." : recipe ? "Update Recipe" : "Create Recipe"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
