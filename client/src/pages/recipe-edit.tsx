import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";
import { STYLE_OPTIONS } from "@/lib/recipeStyles";

const CATEGORY_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "main", label: "Main" },
  { value: "side", label: "Side" },
  { value: "dessert", label: "Dessert" },
];

// Schema describes the form's shape (strings for the textareas, numbers for macros).
// We translate to the API payload shape on submit.
const formSchema = z.object({
  title: z.string().trim().min(1, "Give your recipe a name."),
  description: z.string().trim().min(1, "A short description helps you recognise it later."),
  category: z.string().min(1, "Pick a category."),
  totalTime: z.coerce.number().int().min(0, "Must be 0 or more."),
  servings: z.coerce.number().int().min(1, "At least one serving."),
  calories: z.coerce.number().int().min(0, "Must be 0 or more."),
  protein: z.coerce.number().min(0, "Must be 0 or more."),
  carbs: z.coerce.number().min(0, "Must be 0 or more."),
  fat: z.coerce.number().min(0, "Must be 0 or more."),
  ingredients: z.string(),
  instructions: z.string(),
  tags: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

const linesToArray = (s: string): string[] =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const arrayToLines = (a: string[] | null | undefined): string =>
  Array.isArray(a) ? a.join("\n") : "";

const DEFAULT_VALUES: FormValues = {
  title: "",
  description: "",
  category: "main",
  totalTime: 30,
  servings: 1,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ingredients: "",
  instructions: "",
  tags: [],
};

export default function RecipeEdit() {
  const [, navigate] = useLocation();
  const [isEditMatch, editParams] = useRoute("/my/recipes/:id/edit");
  const [isNewMatch] = useRoute("/my/recipes/new");
  const editingId = isEditMatch ? Number(editParams?.id) : null;
  const isEditing = isEditMatch && Number.isFinite(editingId);
  const { toast } = useToast();

  const editingDetailKey = editingId ? `/api/my/recipes/${editingId}` : "";
  const { data: existing, isLoading: isLoadingExisting } = useQuery<Recipe>({
    queryKey: [editingDetailKey],
    enabled: !!isEditing && !!editingDetailKey,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Populate the form when the existing recipe arrives.
  useEffect(() => {
    if (!existing) return;
    form.reset({
      title: existing.title ?? "",
      description: existing.description ?? "",
      category: existing.category ?? "main",
      totalTime: existing.totalTime ?? 0,
      servings: existing.servings ?? 1,
      calories: existing.calories ?? 0,
      protein: existing.protein ?? 0,
      carbs: existing.carbs ?? 0,
      fat: existing.fat ?? 0,
      ingredients: arrayToLines(existing.ingredients),
      instructions: arrayToLines(existing.instructions),
      tags: Array.isArray((existing as any).tags) ? (existing as any).tags : [],
    });
  }, [existing, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        totalTime: values.totalTime,
        servings: values.servings,
        calories: values.calories,
        protein: values.protein,
        carbs: values.carbs,
        fat: values.fat,
        ingredients: linesToArray(values.ingredients),
        instructions: linesToArray(values.instructions),
        tags: values.tags ?? [],
      };
      if (isEditing && editingId) {
        const res = await apiRequest("PATCH", `/api/my/recipes/${editingId}`, payload);
        return (await res.json()) as Recipe;
      }
      const res = await apiRequest("POST", "/api/my/recipes", payload);
      return (await res.json()) as Recipe;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/recipes"] });
      if (isEditing && editingId) {
        queryClient.invalidateQueries({ queryKey: [`/api/my/recipes/${editingId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/recipes/${editingId}`] });
      }
      toast({ title: isEditing ? "Recipe updated" : "Recipe saved" });
      navigate(`/recipe/${saved.id}`);
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Couldn't save recipe", description, variant: "destructive" });
    },
  });

  // Invalid edit URL (e.g. /my/recipes/abc/edit) — surface a clear message
  // instead of leaving the user staring at a blank screen.
  if (!isNewMatch && !isEditing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold mb-2">Recipe not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          That link doesn't look right.
        </p>
        <Button onClick={() => navigate("/recipes")}>Back to recipes</Button>
      </div>
    );
  }

  if (isEditing && isLoadingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0cc9a9]" />
      </div>
    );
  }

  if (isEditing && !isLoadingExisting && !existing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold mb-2">Recipe not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          This recipe may have been deleted or doesn't belong to you.
        </p>
        <Button onClick={() => navigate("/recipes")}>Back to recipes</Button>
      </div>
    );
  }

  const onSubmit = (values: FormValues) => saveMutation.mutate(values);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between px-3 h-14">
          <button
            onClick={() => navigate(isEditing && editingId ? `/recipe/${editingId}` : "/recipes")}
            className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-muted/70"
            aria-label="Back"
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold" data-testid="text-page-title">
            {isEditing ? "Edit recipe" : "New recipe"}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="px-4 pt-4 space-y-5"
          data-testid="form-recipe-edit"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Greek chicken bowl" {...field} data-testid="input-title" />
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
                    placeholder="A short note about this recipe."
                    rows={2}
                    {...field}
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
              name="totalTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total time (min)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      {...field}
                      data-testid="input-total-time"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="servings"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Servings</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    {...field}
                    data-testid="input-servings"
                  />
                </FormControl>
                <FormDescription>
                  Macros below are per serving.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="calories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calories</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" min={0} {...field} data-testid="input-calories" />
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
                    <Input type="number" inputMode="decimal" min={0} step="0.1" {...field} data-testid="input-protein" />
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
                    <Input type="number" inputMode="decimal" min={0} step="0.1" {...field} data-testid="input-carbs" />
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
                    <Input type="number" inputMode="decimal" min={0} step="0.1" {...field} data-testid="input-fat" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="ingredients"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ingredients</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={"One per line, e.g.\n200g chicken breast\n1 cup rice\n1 tbsp olive oil"}
                    rows={6}
                    {...field}
                    data-testid="input-ingredients"
                  />
                </FormControl>
                <FormDescription>One ingredient per line.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => {
              const value = field.value ?? [];
              const toggle = (id: string) =>
                field.onChange(value.includes(id) ? value.filter((v: string) => v !== id) : [...value, id]);
              return (
                <FormItem>
                  <FormLabel>Style (optional)</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((opt) => {
                      const active = value.includes(opt.id);
                      return (
                        <Button
                          key={opt.id}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={active ? "bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black" : ""}
                          onClick={() => toggle(opt.id)}
                          data-testid={`chip-tag-${opt.id}`}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                  <FormDescription>Tap any that fit so this recipe shows up when people filter by them.</FormDescription>
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instructions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={"One step per line, e.g.\nSeason and pan-sear chicken 4 min/side\nBoil rice 12 min\nServe and drizzle olive oil"}
                    rows={6}
                    {...field}
                    data-testid="input-instructions"
                  />
                </FormControl>
                <FormDescription>One step per line.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(isEditing && editingId ? `/recipe/${editingId}` : "/recipes")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? "Saving..." : isEditing ? "Save changes" : "Save recipe"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
