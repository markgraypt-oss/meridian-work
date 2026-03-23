import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X, Clock, Flame, AlertTriangle, Users } from "lucide-react";
import type { Recipe } from "@shared/schema";

export default function RecipeDetail() {
  const [, params] = useRoute("/recipe/:id");
  const [, navigate] = useLocation();
  const recipeId = params?.id;

  const { data: recipe, isLoading, error } = useQuery<Recipe>({
    queryKey: [`/api/recipes/${recipeId}`],
    enabled: !!recipeId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="text-center text-muted-foreground">Recipe not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="w-full h-72 overflow-hidden relative">
        <img
          src={recipe.imageUrl || "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80"}
          alt={recipe.title}
          className="w-full h-full object-cover"
          data-testid="img-recipe"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <button
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-[#0cc9a9] shadow-lg"
          data-testid="button-close-recipe"
        >
          <X className="h-5 w-5 text-black" />
        </button>
      </div>

      <div className="px-5 pt-5 pb-2">
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-recipe-title">
          {recipe.title}
        </h2>

        {recipe.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed" data-testid="text-description">
            {recipe.description}
          </p>
        )}
      </div>

      {recipe.allergens && recipe.allergens.length > 0 && (
        <div className="px-5 pt-2">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0cc9a9] border border-[#0cc9a9]">
            <AlertTriangle className="h-4 w-4 text-[#0cc9a9] flex-shrink-0" />
            <span className="text-sm font-semibold text-[#0cc9a9]" data-testid="text-allergens">
              Contains {recipe.allergens.join(", ")}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <Clock className="h-4 w-4 text-[#0cc9a9]" />
            <span className="text-sm font-medium">{recipe.totalTime} min</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <Users className="h-4 w-4 text-[#0cc9a9]" />
            <span className="text-sm font-medium">{recipe.servings} serving{recipe.servings > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center mb-1">
                <Flame className="h-4 w-4 text-orange-400" />
              </div>
              <p className="text-sm font-semibold">{recipe.calories}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Calories</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center mb-1">
                <span className="text-xs font-bold text-blue-400">P</span>
              </div>
              <p className="text-sm font-semibold">{Math.round(recipe.protein)}g</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Protein</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-[#0cc9a9]/15 flex items-center justify-center mb-1">
                <span className="text-xs font-bold text-[#0cc9a9]">C</span>
              </div>
              <p className="text-sm font-semibold">{Math.round(recipe.carbs)}g</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Carbs</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center mb-1">
                <span className="text-xs font-bold text-green-400">F</span>
              </div>
              <p className="text-sm font-semibold">{Math.round(recipe.fat)}g</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Fat</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        <h3 className="text-base font-bold mb-3">Ingredients</h3>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.06]" data-testid="list-ingredients">
          {recipe.ingredients?.map((ingredient, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0cc9a9] flex-shrink-0" />
              <span className="text-sm text-foreground/90">{ingredient}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-6">
        <h3 className="text-base font-bold mb-3">Directions</h3>
        <div className="space-y-0" data-testid="list-directions">
          {recipe.instructions?.map((instruction, index) => (
            <div key={index} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-[#0cc9a9]/15 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#0cc9a9]">{index + 1}</span>
                </div>
                {index < (recipe.instructions?.length || 0) - 1 && (
                  <div className="w-px flex-1 bg-white/[0.06] mt-2" />
                )}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 pt-1">{instruction}</p>
            </div>
          ))}
        </div>
      </div>

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="px-5 pt-6">
          <h3 className="text-base font-bold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2" data-testid="list-tags">
            {recipe.tags.map((tag, index) => (
              <span key={index} className="px-3 py-1.5 rounded-full bg-white/[0.06] text-xs text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
