import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Camera, ChevronLeft, Clock, ImagePlus, Loader2, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

type MealType = "breakfast" | "main" | "side" | "dessert";

type Idea = {
  title: string;
  blurb: string;
  totalTime?: number;
  keyIngredients: string[];
  category?: MealType;
};

type Draft = {
  title: string;
  description: string;
  category: MealType;
  totalTime: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string[];
  keyIngredients?: string[];
  tags?: string[];
  aiGenerated?: boolean;
  aiDraftedFromPhoto?: boolean;
};

type Preferences = {
  mealType?: MealType;
  maxMinutes?: number;
  notes?: string;
};

const MAX_PHOTOS = 4;

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "main", label: "Main" },
  { value: "side", label: "Side" },
  { value: "dessert", label: "Dessert" },
];

const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "Under 15 min" },
  { value: 30, label: "Under 30 min" },
  { value: 45, label: "Under 45 min" },
  { value: 60, label: "Under 1 hour" },
];

// Resize + JPEG-encode in the browser. Keeps each image well under the
// server's per-image cap and the overall 12 MB request limit.
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function RecipeFromPhoto() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [mealType, setMealType] = useState<MealType | undefined>(undefined);
  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState<string>("");

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);

  // When the user picks an idea we expand it into a full draft and show it
  // for review. They then save (POST to /api/my/recipes) or back out.
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
  const [previewSourceIdea, setPreviewSourceIdea] = useState<Idea | null>(null);

  const buildPreferences = (): Preferences | undefined => {
    const trimmedNotes = notes.trim();
    if (!mealType && !maxMinutes && !trimmedNotes) return undefined;
    const p: Preferences = {};
    if (mealType) p.mealType = mealType;
    if (maxMinutes) p.maxMinutes = maxMinutes;
    if (trimmedNotes) p.notes = trimmedNotes;
    return p;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast({ title: `Up to ${MAX_PHOTOS} photos at a time.` });
      return;
    }
    const toProcess = Array.from(files).slice(0, remaining);
    try {
      const encoded = await Promise.all(toProcess.map(downscaleImage));
      setPhotos((prev) => [...prev, ...encoded]);
      // Old ideas were generated from a different photo set; clear them so
      // the user doesn't pick a stale idea against new pictures.
      setIdeas([]);
      setSeenTitles([]);
    } catch {
      toast({
        title: "Couldn't load that photo",
        description: "Try a different image.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setIdeas([]);
    setSeenTitles([]);
  };

  const ideasMutation = useMutation({
    mutationFn: async (mode: "fresh" | "more") => {
      const body: { images: string[]; exclude?: string[]; preferences?: Preferences } = {
        images: photos,
      };
      if (mode === "more" && seenTitles.length) body.exclude = seenTitles;
      const prefs = buildPreferences();
      if (prefs) body.preferences = prefs;
      const res = await apiRequest("POST", "/api/my/recipes/ideas-from-photo", body);
      return (await res.json()) as { ideas: Idea[] };
    },
    onSuccess: (data, mode) => {
      setIdeas(data.ideas);
      setSeenTitles((prev) =>
        mode === "more"
          ? [...prev, ...data.ideas.map((i) => i.title)]
          : data.ideas.map((i) => i.title)
      );
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Couldn't get ideas", description, variant: "destructive" });
    },
  });

  const expandMutation = useMutation({
    mutationFn: async (idea: Idea) => {
      const body: {
        idea: Idea;
        images: string[];
        preferences?: Preferences;
      } = { idea, images: photos };
      const prefs = buildPreferences();
      if (prefs) body.preferences = prefs;
      const res = await apiRequest("POST", "/api/my/recipes/expand-idea", body);
      const json = (await res.json()) as { draft: Draft };
      return { draft: json.draft, idea };
    },
    onSuccess: ({ draft, idea }) => {
      setPreviewDraft(draft);
      setPreviewSourceIdea(idea);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Couldn't build that recipe", description, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (draft: Draft) => {
      const res = await apiRequest("POST", "/api/my/recipes", draft);
      return (await res.json()) as Recipe;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe saved", description: "You can edit it any time." });
      navigate(`/recipe/${saved.id}`);
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Couldn't save recipe", description, variant: "destructive" });
    },
  });

  const isLoadingIdeas = ideasMutation.isPending;
  const isExpanding = expandMutation.isPending;
  const isSaving = saveMutation.isPending;

  // -------- Preview-then-save view (shown after "Use this one") --------
  if (previewDraft) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPreviewDraft(null);
                setPreviewSourceIdea(null);
              }}
              data-testid="button-back-to-ideas"
              disabled={isSaving}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold truncate">Preview recipe</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xl font-semibold">{previewDraft.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{previewDraft.description}</p>
              </div>
              <Badge variant="secondary" className="capitalize flex-shrink-0">
                {previewDraft.category}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {previewDraft.totalTime} min
              </span>
              <span>·</span>
              <span>Serves {previewDraft.servings}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-md bg-muted">
                <div className="font-semibold">{previewDraft.calories}</div>
                <div className="text-muted-foreground">cal</div>
              </div>
              <div className="p-2 rounded-md bg-muted">
                <div className="font-semibold">{previewDraft.protein}g</div>
                <div className="text-muted-foreground">protein</div>
              </div>
              <div className="p-2 rounded-md bg-muted">
                <div className="font-semibold">{previewDraft.carbs}g</div>
                <div className="text-muted-foreground">carbs</div>
              </div>
              <div className="p-2 rounded-md bg-muted">
                <div className="font-semibold">{previewDraft.fat}g</div>
                <div className="text-muted-foreground">fat</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Macros are rough estimates. You can edit anything after saving.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="font-semibold">Ingredients</p>
            <ul className="space-y-1.5 text-sm">
              {previewDraft.ingredients.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="font-semibold">Instructions</p>
            <ol className="space-y-2 text-sm">
              {previewDraft.instructions.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold text-[#0cc9a9] flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setPreviewDraft(null);
                setPreviewSourceIdea(null);
              }}
              disabled={isSaving}
              data-testid="button-back-to-ideas-secondary"
            >
              Back to ideas
            </Button>
            <Button
              className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
              onClick={() => saveMutation.mutate(previewDraft)}
              disabled={isSaving}
              data-testid="button-save-recipe"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save recipe
                </>
              )}
            </Button>
          </div>

          {previewSourceIdea && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={isSaving || isExpanding}
              onClick={() => expandMutation.mutate(previewSourceIdea)}
              data-testid="button-regenerate-recipe"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try a different version
            </Button>
          )}
        </div>
      </div>
    );
  }

  // -------- Default view: photos, preferences, ideas --------
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/recipes")} data-testid="button-back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Recipe from a photo</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
            <p className="text-sm">
              Snap your fridge, pantry, or a few ingredients. We'll suggest 3 quick recipe ideas.
            </p>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                  <img src={src} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                    aria-label="Remove photo"
                    data-testid={`button-remove-photo-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
              disabled={photos.length >= MAX_PHOTOS}
              data-testid="button-take-photo"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take a photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
              disabled={photos.length >= MAX_PHOTOS}
              data-testid="button-choose-photo"
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Choose photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS} photos</p>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-medium text-sm">What are you in the mood for?</p>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Meal type</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((opt) => {
                const active = mealType === opt.value;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={active ? "bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black" : ""}
                    onClick={() => setMealType(active ? undefined : opt.value)}
                    data-testid={`chip-meal-${opt.value}`}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Time</p>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((opt) => {
                const active = maxMinutes === opt.value;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={active ? "bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black" : ""}
                    onClick={() => setMaxMinutes(active ? undefined : opt.value)}
                    data-testid={`chip-time-${opt.value}`}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Other notes (optional)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. one pan only, high protein, no oven, kid friendly"
              maxLength={500}
              rows={2}
              data-testid="input-notes"
            />
          </div>
        </Card>

        <Button
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
          disabled={photos.length === 0 || isLoadingIdeas || isExpanding}
          onClick={() => ideasMutation.mutate("fresh")}
          data-testid="button-get-ideas"
        >
          {isLoadingIdeas && ideas.length === 0 ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Looking at your photos...
            </>
          ) : ideas.length > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start over with new ideas
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Get 3 ideas
            </>
          )}
        </Button>

        {ideas.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Pick one to build out</h2>
            {ideas.map((idea, idx) => {
              const isThisOne = isExpanding;
              return (
                <Card key={`${idea.title}-${idx}`} className="p-4 space-y-2" data-testid={`card-idea-${idx}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{idea.blurb}</p>
                    </div>
                    {idea.category && (
                      <Badge variant="secondary" className="capitalize flex-shrink-0">
                        {idea.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {idea.totalTime ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {idea.totalTime} min
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {idea.keyIngredients.slice(0, 6).map((ing) => (
                      <Badge key={ing} variant="outline" className="text-xs">
                        {ing}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                    disabled={isExpanding || isLoadingIdeas || photos.length === 0}
                    onClick={() => expandMutation.mutate(idea)}
                    data-testid={`button-pick-idea-${idx}`}
                  >
                    {isThisOne ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Building the recipe...
                      </>
                    ) : (
                      "See full recipe"
                    )}
                  </Button>
                </Card>
              );
            })}

            <Button
              variant="outline"
              className="w-full"
              disabled={isLoadingIdeas || isExpanding || photos.length === 0}
              onClick={() => ideasMutation.mutate("more")}
              data-testid="button-more-ideas"
            >
              {isLoadingIdeas ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Thinking up 3 more...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Show me 3 more
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
