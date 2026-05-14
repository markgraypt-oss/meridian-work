import { z } from "zod";
import { aiCall } from "./ai";
import type { Recipe } from "@shared/schema";
import type { ShoppingListItem } from "@shared/schema";

interface MealEntry {
  type: string;
  slotIndex: number;
  isMain: boolean;
  isSide: boolean;
  parentIndex?: number;
}

export function getMealEntries(slots: { type: string; sides?: number }[]): MealEntry[] {
  const entries: MealEntry[] = [];
  slots.forEach((slot, slotIndex) => {
    if (slot.type === "main") {
      entries.push({ type: "main", slotIndex, isMain: true, isSide: false });
      const sideCount = slot.sides || 0;
      for (let s = 0; s < sideCount; s++) {
        entries.push({
          type: "side",
          slotIndex,
          isMain: false,
          isSide: true,
          parentIndex: entries.length - 1 - s,
        });
      }
    } else {
      entries.push({ type: slot.type, slotIndex, isMain: false, isSide: false });
    }
  });
  return entries;
}

const AiGeneratedRecipeSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  calories: z.number().int().min(50).max(2000),
  protein: z.number().min(0).max(300),
  carbs: z.number().min(0).max(400),
  fat: z.number().min(0).max(200),
  totalTime: z.number().int().min(0).max(240).optional(),
  ingredients: z.array(z.string().min(1).max(200)).min(1).max(40),
  instructions: z.array(z.string().min(1).max(500)).min(1).max(20),
});
const PlannedMealSchema = z.object({
  slotIndex: z.number().int().min(0),
  isSide: z.boolean(),
  recipeId: z.number().int().positive().optional(),
  aiRecipe: AiGeneratedRecipeSchema.optional(),
}).refine(
  (m) => (m.recipeId !== undefined) !== (m.aiRecipe !== undefined),
  { message: "Provide exactly one of recipeId or aiRecipe" },
);
const PlannedDaySchema = z.object({
  dayIndex: z.number().int().min(1).max(7),
  meals: z.array(PlannedMealSchema),
});
export const AiPlanSchema = z.object({
  days: z.array(PlannedDaySchema).length(7),
});
export type AiPlan = z.infer<typeof AiPlanSchema>;
export type AiGeneratedRecipe = z.infer<typeof AiGeneratedRecipeSchema>;

export interface AiPlanInput {
  userId: string;
  caloriesPerDay: number;
  macroSplit: string;
  dietaryPreference: string;
  excludedIngredients: string[];
  maxPrepTime?: number | null;
  mealSlots: { type: string; sides?: number }[];
  recipes: Recipe[];
  lockedMeals?: { dayIndex: number; slotIndex: number; isSide: boolean; recipeId: number; recipeTitle: string }[];
}

export async function generateAiPlan(input: AiPlanInput): Promise<AiPlan | null> {
  const entries = getMealEntries(input.mealSlots);
  if (entries.length === 0) return null;
  // Empty catalog is allowed: in that case the AI must fully gap-fill every
  // slot using the `aiRecipe` field. The schema/validator below enforce the
  // resulting shape and completeness either way.
  const allowCatalog = input.recipes.length > 0;

  // Trim catalog to keep prompt cost bounded
  const catalog = input.recipes.slice(0, 80).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    cal: r.calories,
    p: r.protein,
    c: r.carbs,
    f: r.fat,
    time: r.totalTime || null,
  }));

  const lockedDescription = (input.lockedMeals || []).map((l) =>
    `day ${l.dayIndex} slot ${l.slotIndex}${l.isSide ? " (side)" : ""}: recipeId ${l.recipeId} (${l.recipeTitle}) [LOCKED - keep as-is]`
  ).join("\n");

  const prompt = [
    "You are a meal-planner. Build a 7-day plan that prefers recipes from the catalog.",
    `Daily target: ~${input.caloriesPerDay} kcal, macro split: ${input.macroSplit}.`,
    `Dietary preference: ${input.dietaryPreference}.`,
    input.excludedIngredients.length
      ? `Avoid: ${input.excludedIngredients.join(", ")}.`
      : "",
    input.maxPrepTime
      ? `Max prep time per recipe: ${input.maxPrepTime} minutes.`
      : "",
    "",
    "Each day has these slots in order (slotIndex starts at 0):",
    JSON.stringify(input.mealSlots),
    "",
    "Generate exactly 7 days. For each day include one meal per slot (and a 'side' entry for each side, with isSide=true and the same slotIndex as its main).",
    "Vary recipes across the week (avoid repeating the same recipe more than twice).",
    "Stay close to the daily kcal target (within +/-10%).",
    "",
    lockedDescription
      ? `The following meals are LOCKED by the user — you MUST include them with the exact recipeId at the exact (dayIndex, slotIndex, isSide) position; do NOT replace them:\n${lockedDescription}`
      : "",
    "",
    allowCatalog
      ? "PREFER recipes from the catalog (use the recipeId field). If — and only if — no catalog recipe fits a slot's needs, you MAY invent a single new recipe by setting the aiRecipe field instead of recipeId."
      : "The catalog is empty for this user's filters. You MUST invent a new recipe for every slot using the aiRecipe field.",
    "Each meal entry must contain exactly one of recipeId or aiRecipe (never both).",
    "When you invent a recipe, include realistic title, category, calories, protein, carbs, fat, ingredients (list of strings) and short instructions.",
    "",
    "Recipe catalog (id, title, category, kcal, protein, carbs, fat, time minutes):",
    JSON.stringify(catalog),
    "",
    'Respond ONLY with raw JSON of shape: {"days":[{"dayIndex":1,"meals":[{"slotIndex":0,"isSide":false,"recipeId":123}, {"slotIndex":1,"isSide":false,"aiRecipe":{"title":"...","category":"lunch","calories":500,"protein":30,"carbs":50,"fat":15,"ingredients":["..."],"instructions":["..."]}}]}, ... 7 entries]}',
  ]
    .filter(Boolean)
    .join("\n");

  const result = await aiCall({
    feature: "meal_plan_generation",
    userId: input.userId,
    prompt,
    schema: AiPlanSchema,
    maxTokens: 4000,
    temperature: 0.4,
  });

  if (!result.data) return null;

  // Validate completeness: each of the 7 days must have exactly one meal entry
  // for every expected (slotIndex, isSide) pair from `entries`. If anything is
  // missing or duplicated, treat as a failure so the caller falls back.
  const expectedPerDay = entries.map((e) => ({ slotIndex: e.slotIndex, isSide: e.isSide }));
  const allowed = new Set(input.recipes.map((r) => r.id));
  const seenDayIndexes = new Set<number>();
  for (const day of result.data.days) {
    if (seenDayIndexes.has(day.dayIndex)) return null;
    seenDayIndexes.add(day.dayIndex);
    if (day.meals.length !== expectedPerDay.length) return null;
    const haveKeys = new Set(day.meals.map((m) => `${m.slotIndex}:${m.isSide ? 1 : 0}`));
    for (const exp of expectedPerDay) {
      if (!haveKeys.has(`${exp.slotIndex}:${exp.isSide ? 1 : 0}`)) return null;
    }
    for (const meal of day.meals) {
      if (meal.recipeId !== undefined && !allowed.has(meal.recipeId)) return null;
    }
  }
  if (seenDayIndexes.size !== 7) return null;
  return result.data;
}

// ---------- Single-slot gap fill ----------
//
// Used by `buildPlanForUser` after the main plan is built: for every
// (dayIndex × slot × isSide) that the catalog selector and the inline
// `aiRecipe` field both failed to fill, we ask the model to invent ONE
// lightweight recipe that satisfies the user's filters. The caller then
// persists each result into the `recipes` table with `aiGenerated=true`
// and links it from `meal_plan_meals`. If this AI call fails for a slot
// the caller falls back to a deterministic placeholder so plans are
// never empty.

const SingleAiRecipeSchema = z.object({ recipe: AiGeneratedRecipeSchema });

export interface GapFillInput {
  userId: string;
  slotType: string; // 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'main' | 'side'
  isSide: boolean;
  targetCalories: number;
  macroSplit: string;
  dietaryPreference: string;
  excludedIngredients: string[];
  maxPrepTime?: number | null;
}

export async function generateGapFillRecipe(input: GapFillInput): Promise<AiGeneratedRecipe | null> {
  const role = input.isSide ? "side dish" : input.slotType;
  const prompt = [
    `Invent a single ${role} recipe to fill a gap in a 7-day meal plan.`,
    `Target ~${input.targetCalories} kcal, macro split: ${input.macroSplit}.`,
    `Dietary preference: ${input.dietaryPreference}.`,
    input.excludedIngredients.length
      ? `Avoid these ingredients: ${input.excludedIngredients.join(", ")}.`
      : "",
    input.maxPrepTime ? `Max total prep time: ${input.maxPrepTime} minutes.` : "",
    "Return realistic title, category, calories, protein, carbs, fat, ingredients (list of strings), and short instructions (list of strings).",
    'Respond ONLY with raw JSON: {"recipe":{"title":"...","category":"...","calories":500,"protein":30,"carbs":50,"fat":15,"ingredients":["..."],"instructions":["..."]}}',
  ].filter(Boolean).join("\n");

  try {
    const result = await aiCall({
      feature: "meal_plan_gap_fill",
      userId: input.userId,
      prompt,
      schema: SingleAiRecipeSchema,
      maxTokens: 800,
      temperature: 0.5,
    });
    return result.data?.recipe ?? null;
  } catch (err: any) {
    console.error("[meal_plan_gap_fill] failed:", err?.message);
    return null;
  }
}

// ---------- Shopping list ----------

const SECTION_KEYWORDS: { section: string; words: string[] }[] = [
  {
    section: "produce",
    words: [
      "apple", "banana", "berry", "berries", "lemon", "lime", "orange", "tomato",
      "lettuce", "spinach", "kale", "onion", "garlic", "ginger", "potato",
      "carrot", "celery", "cucumber", "pepper", "broccoli", "cauliflower",
      "avocado", "mushroom", "zucchini", "courgette", "herb", "parsley",
      "cilantro", "basil", "mint", "fruit", "vegetable", "salad", "leek", "scallion",
    ],
  },
  {
    section: "protein",
    words: [
      "chicken", "beef", "pork", "lamb", "turkey", "salmon", "tuna", "fish",
      "shrimp", "prawn", "egg", "tofu", "tempeh", "bacon", "sausage", "steak",
      "mince", "ground", "cod", "halibut",
    ],
  },
  {
    section: "dairy",
    words: [
      "milk", "yogurt", "yoghurt", "cheese", "butter", "cream", "feta",
      "parmesan", "mozzarella", "cheddar", "ricotta", "cottage cheese",
    ],
  },
  {
    section: "bakery",
    words: ["bread", "tortilla", "wrap", "bun", "bagel", "pita", "baguette", "naan"],
  },
  {
    section: "frozen",
    words: ["frozen"],
  },
  {
    section: "pantry",
    words: [
      "rice", "pasta", "noodle", "oil", "vinegar", "sauce", "soy", "honey",
      "sugar", "salt", "pepper", "spice", "flour", "oat", "bean", "lentil",
      "chickpea", "broth", "stock", "tomato sauce", "tomato paste", "tahini",
      "syrup", "nut", "almond", "peanut", "seed", "quinoa", "couscous", "cereal",
    ],
  },
];

function categorizeKeyword(name: string): string {
  const n = name.toLowerCase();
  for (const { section, words } of SECTION_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return section;
  }
  return "other";
}

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(\d+(\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cup|cups|oz|lb|lbs|pcs?|pieces?|cloves?|slices?|cans?|tins?)\b/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ShoppingListMealInput {
  mealPlanMealId: number;
  recipeId: number;
  recipeTitle: string;
  dayIndex: number;     // 1-based
  mealType: string;     // raw stored value, may carry slot suffix like "breakfast_0"
  ingredients: string[] | null;
}

const MEAL_TYPE_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  snack: 3,
  dinner: 4,
  main: 5,
  side: 6,
};

// Stored mealType may have slot suffix like "breakfast_0" or "main_1".
// Strip everything after the first underscore for sorting/display.
function baseMealType(raw?: string): string {
  if (!raw) return "";
  return raw.split("_")[0].toLowerCase();
}

export async function buildShoppingList(opts: {
  userId: string;
  meals: ShoppingListMealInput[];
  // Optional: existing list items to merge with (preserves manual Extras + checked state)
  existingItems?: ShoppingListItem[];
}): Promise<{ items: ShoppingListItem[]; aiGenerated: boolean }> {
  const items: ShoppingListItem[] = [];

  for (const meal of opts.meals) {
    const seen = new Set<string>();
    for (const ing of meal.ingredients || []) {
      if (!ing || typeof ing !== "string") continue;
      const trimmed = ing.trim();
      if (!trimmed) continue;
      const key = normalizeName(trimmed);
      if (!key || seen.has(key)) continue; // dedupe within the same meal
      seen.add(key);
      items.push({
        name: key,
        quantity: trimmed,
        mealPlanMealId: meal.mealPlanMealId,
        recipeId: meal.recipeId,
        recipeTitle: meal.recipeTitle,
        dayIndex: meal.dayIndex,
        mealType: meal.mealType,
        section: categorizeKeyword(key),
        recipeIds: [meal.recipeId],
        checked: false,
      });
    }
  }

  // Merge with existing list:
  //  - carry over `checked` for generated items that still exist (matched by mealPlanMealId + normalized name)
  //  - keep manual items (manual === true OR no mealPlanMealId for legacy adds), preserving Extras and per-meal manual additions
  //  - drop generated items whose recipe was swapped or removed
  if (opts.existingItems && opts.existingItems.length > 0) {
    const newKeyed = new Map<string, ShoppingListItem>();
    items.forEach((it) => {
      newKeyed.set(`${it.mealPlanMealId}:${normalizeName(it.name)}`, it);
    });

    for (const old of opts.existingItems) {
      const isManual = old.manual === true || !old.mealPlanMealId;
      if (isManual) {
        // Always keep user-added items (Extras or per-meal manual)
        items.push({ ...old });
        continue;
      }
      // Generated item — only carry over checked state if it still exists
      const k = `${old.mealPlanMealId}:${normalizeName(old.name)}`;
      const matched = newKeyed.get(k);
      if (matched && old.checked) matched.checked = true;
      // Otherwise drop (recipe swapped or removed)
    }
  }

  // Sort: by day, then base meal type, then meal id, then alphabetical
  items.sort((a, b) => {
    const da = a.dayIndex ?? 999;
    const db = b.dayIndex ?? 999;
    if (da !== db) return da - db;
    const ma = MEAL_TYPE_ORDER[baseMealType(a.mealType)] ?? 99;
    const mb = MEAL_TYPE_ORDER[baseMealType(b.mealType)] ?? 99;
    if (ma !== mb) return ma - mb;
    const ra = a.mealPlanMealId ?? 0;
    const rb = b.mealPlanMealId ?? 0;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return { items, aiGenerated: false };
}
