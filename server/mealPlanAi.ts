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

interface RawIngredient {
  raw: string;
  recipeId: number;
}

const AiCategorizationSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      section: z.enum(["produce", "protein", "dairy", "bakery", "frozen", "pantry", "other"]),
    }),
  ),
});

export async function buildShoppingList(opts: {
  userId: string;
  recipes: { id: number; ingredients: string[] | null }[];
}): Promise<{ items: ShoppingListItem[]; aiGenerated: boolean }> {
  const raw: RawIngredient[] = [];
  for (const r of opts.recipes) {
    for (const ing of r.ingredients || []) {
      if (ing && typeof ing === "string") raw.push({ raw: ing, recipeId: r.id });
    }
  }

  // Aggregate by normalized name
  const byKey = new Map<string, { name: string; quantities: string[]; recipeIds: Set<number> }>();
  for (const r of raw) {
    const key = normalizeName(r.raw);
    if (!key) continue;
    const entry = byKey.get(key) || { name: key, quantities: [], recipeIds: new Set<number>() };
    entry.quantities.push(r.raw.trim());
    entry.recipeIds.add(r.recipeId);
    byKey.set(key, entry);
  }

  const aggregated = Array.from(byKey.values()).map((e) => ({
    name: e.name,
    quantity: e.quantities.length === 1 ? e.quantities[0] : `${e.quantities.length}x (${e.quantities.slice(0, 3).join("; ")}${e.quantities.length > 3 ? "..." : ""})`,
    recipeIds: Array.from(e.recipeIds),
  }));

  if (aggregated.length === 0) return { items: [], aiGenerated: false };

  // Try AI categorization
  let aiSections: Record<string, string> | null = null;
  let aiGenerated = false;
  try {
    const prompt = [
      "Categorize each grocery ingredient into one section.",
      'Sections: "produce", "protein", "dairy", "bakery", "frozen", "pantry", "other".',
      "",
      "Ingredients:",
      JSON.stringify(aggregated.map((a) => a.name)),
      "",
      'Respond ONLY with raw JSON: {"items":[{"name":"...","section":"..."}, ...]}. Use the same names as input.',
    ].join("\n");
    const result = await aiCall({
      feature: "shopping_list_categorize",
      userId: opts.userId,
      prompt,
      schema: AiCategorizationSchema,
      maxTokens: 1500,
      temperature: 0,
    });
    if (result.data) {
      aiSections = {};
      for (const it of result.data.items) aiSections[it.name.toLowerCase()] = it.section;
      aiGenerated = true;
    }
  } catch (err: any) {
    console.error("[shopping_list_categorize] failed:", err?.message);
  }

  const items: ShoppingListItem[] = aggregated.map((a) => ({
    name: a.name,
    section: aiSections?.[a.name.toLowerCase()] || categorizeKeyword(a.name),
    quantity: a.quantity,
    recipeIds: a.recipeIds,
    checked: false,
  }));

  // Sort: by section, then alphabetical
  const sectionOrder = ["produce", "protein", "dairy", "bakery", "pantry", "frozen", "other"];
  items.sort((x, y) => {
    const sx = sectionOrder.indexOf(x.section);
    const sy = sectionOrder.indexOf(y.section);
    if (sx !== sy) return sx - sy;
    return x.name.localeCompare(y.name);
  });

  return { items, aiGenerated };
}
