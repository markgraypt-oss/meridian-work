import type { Recipe } from "@shared/schema";

export type StyleOption = { id: string; label: string };

// Extra "style" filters that cut across the meal-type categories.
// Recipes opt in via the `tags` column. The matcher also includes a few
// pragmatic fallbacks so popular existing recipes still surface even when
// nobody has tagged them yet.
export const STYLE_OPTIONS: StyleOption[] = [
  { id: "airfryer", label: "Air fryer" },
  { id: "high-protein", label: "High protein" },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

const tagMatches = (recipe: Recipe, candidates: string[]): boolean => {
  const tags = ((recipe as any).tags ?? []) as string[];
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const want = candidates.map(norm);
  return tags.some((t) => want.includes(norm(String(t))));
};

const textIncludes = (recipe: Recipe, needles: string[]): boolean => {
  const haystack = [
    recipe.title,
    recipe.description,
    ...((recipe.instructions ?? []) as string[]),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
  return needles.some((n) => haystack.includes(n));
};

export function recipeMatchesStyle(recipe: Recipe, styleId: string): boolean {
  switch (styleId) {
    case "airfryer":
      if (tagMatches(recipe, ["airfryer", "air-fryer", "air fryer"])) return true;
      // Fallback: instructions/title mention air frying.
      return textIncludes(recipe, ["air fry", "air-fry", "airfry", "air fryer"]);

    case "high-protein": {
      if (tagMatches(recipe, ["high-protein", "high protein", "highprotein"])) return true;
      const dietary = ((recipe as any).dietaryPreferences ?? []) as string[];
      if (Array.isArray(dietary) && dietary.some((d) => norm(String(d)) === "highprotein")) {
        return true;
      }
      // Fallback: a meaningful protein-per-serving threshold.
      const protein = Number((recipe as any).protein ?? 0);
      const servings = Math.max(1, Number(recipe.servings ?? 1));
      // protein column is per-serving in this app, but guard anyway.
      const perServing = protein > 0 && protein < 200 ? protein : protein / servings;
      return perServing >= 25;
    }

    default:
      return false;
  }
}
