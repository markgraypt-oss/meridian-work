import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Camera, ChevronLeft, ImagePlus, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

type Idea = {
  title: string;
  blurb: string;
  keyIngredients: string[];
  category?: "breakfast" | "main" | "side" | "dessert";
};

const MAX_PHOTOS = 4;

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
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [expandingTitle, setExpandingTitle] = useState<string | null>(null);

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
      // Old ideas were generated from a different photo set; clear them so the
      // user doesn't pick a stale idea against new pictures.
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
      const body: { images: string[]; exclude?: string[] } = { images: photos };
      if (mode === "more" && seenTitles.length) body.exclude = seenTitles;
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
      // 1. Expand the chosen idea.
      const expandRes = await apiRequest("POST", "/api/my/recipes/expand-idea", {
        idea,
        images: photos,
      });
      const { draft } = (await expandRes.json()) as { draft: Record<string, unknown> };
      // 2. Save it as a custom recipe owned by the user.
      const saveRes = await apiRequest("POST", "/api/my/recipes", draft);
      return (await saveRes.json()) as Recipe;
    },
    onMutate: (idea: Idea) => {
      setExpandingTitle(idea.title);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe saved", description: "You can edit it any time." });
      navigate(`/recipe/${saved.id}`);
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Couldn't build that recipe", description, variant: "destructive" });
    },
    onSettled: () => {
      setExpandingTitle(null);
    },
  });

  const isExpanding = expandMutation.isPending;
  const isLoadingIdeas = ideasMutation.isPending;

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

      <div className="p-4 space-y-6">
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
          <p className="text-xs text-muted-foreground">
            {photos.length}/{MAX_PHOTOS} photos
          </p>

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
        </Card>

        {ideas.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Pick one to build out</h2>
            {ideas.map((idea, idx) => {
              const isThisOne = expandingTitle === idea.title;
              return (
                <Card key={`${idea.title}-${idx}`} className="p-4 space-y-2" data-testid={`card-idea-${idx}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{idea.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{idea.blurb}</p>
                    </div>
                    {idea.category && (
                      <Badge variant="secondary" className="capitalize flex-shrink-0">
                        {idea.category}
                      </Badge>
                    )}
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
                      "Use this one"
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

            <p className="text-xs text-muted-foreground text-center">
              Macros are rough estimates. You can edit anything after saving.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
