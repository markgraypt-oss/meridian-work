import { z } from "zod";
import { storage } from "./storage";
import { getUserDataContext } from "./aiProvider";
import type {
  InsertRecommendation,
  Meditation,
  Recipe,
  Recommendation,
  Video,
} from "@shared/schema";

type ContentType = "meditation" | "recipe" | "video";

export type HydratedRecommendation =
  | (HydratedRecommendationBase & { contentType: "meditation"; content: Meditation })
  | (HydratedRecommendationBase & { contentType: "recipe"; content: Recipe })
  | (HydratedRecommendationBase & { contentType: "video"; content: Video });

interface HydratedRecommendationBase {
  id: number;
  contentId: number;
  score: number;
  rationale: string;
  rank: number;
  source: string;
  generatedAt: Date;
}

const STALE_HOURS = 4;
const DISMISSAL_DAYS = 14;
const TARGET_PER_TYPE = 3;

const RecommendationItemSchema = z.object({
  contentType: z.enum(["meditation", "recipe", "video"]),
  contentId: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(5).max(240),
});

const AiOutputSchema = z.object({
  meditations: z.array(RecommendationItemSchema).max(5).default([]),
  recipes: z.array(RecommendationItemSchema).max(5).default([]),
  videos: z.array(RecommendationItemSchema).max(5).default([]),
});

export type RecommendationItem = z.infer<typeof RecommendationItemSchema>;

interface CatalogContext {
  meditations: Meditation[];
  recipes: Recipe[];
  videos: Video[];
}

async function loadCatalogs(): Promise<CatalogContext> {
  const [meditations, recipes, videos] = await Promise.all([
    storage.getMeditations(),
    storage.getRecipes(),
    storage.getVideos(),
  ]);
  return { meditations, recipes, videos };
}

function summariseCatalog(catalog: CatalogContext, dismissed: Set<string>): string {
  const lines: string[] = [];
  lines.push("MEDITATIONS:");
  for (const m of catalog.meditations.slice(0, 40)) {
    if (dismissed.has(`meditation:${m.id}`)) continue;
    lines.push(`- id=${m.id} | ${m.title} (${m.durationMin}min, ${m.category}) tags=${(m.tags || []).join(",")} — ${m.description ?? ""}`.slice(0, 220));
  }
  lines.push("\nRECIPES:");
  for (const r of catalog.recipes.slice(0, 40)) {
    if (dismissed.has(`recipe:${r.id}`)) continue;
    const diet = (r.dietaryPreferences || []).join(",");
    lines.push(`- id=${r.id} | ${r.title} (${r.category}, ${r.totalTime}min, ${r.calories}cal, P${Math.round(r.protein)}g) diet=${diet}`);
  }
  lines.push("\nVIDEOS:");
  for (const v of catalog.videos.slice(0, 40)) {
    if (dismissed.has(`video:${v.id}`)) continue;
    const minutes = Math.max(1, Math.round((v.duration || 0) / 60));
    lines.push(`- id=${v.id} | ${v.title} (${v.category}, ${minutes}min) tags=${(v.tags || []).join(",")}`);
  }
  return lines.join("\n");
}

function buildPrompt(userContext: string, catalogSummary: string): string {
  return [
    "You are a wellness recommendation engine for a corporate health platform.",
    "Pick the most relevant content for this user RIGHT NOW based on their live context.",
    "Return strict JSON only — no prose, no markdown, no code fences.",
    "",
    "OUTPUT SHAPE:",
    `{"meditations":[{"contentType":"meditation","contentId":<id>,"score":0-100,"rationale":"<short reason>"}],"recipes":[...],"videos":[...]}`,
    `Pick at most ${TARGET_PER_TYPE} items per type. Higher score = stronger match.`,
    "Each rationale must be one short sentence (under 120 chars) referencing the user's actual context (e.g. \"higher stress today → 5-min breathwork\").",
    "Do not invent ids — use the catalog ids exactly as listed below.",
    "",
    "USER CONTEXT:",
    userContext || "(no health data available - recommend gentle, broadly useful content)",
    "",
    "CATALOG:",
    catalogSummary,
    "",
    "Return JSON now.",
  ].join("\n");
}

function ruleBasedFallback(catalog: CatalogContext, dismissed: Set<string>, userHints: { highStress: boolean; lowSleep: boolean }): InsertRecommendation[] {
  const rec: InsertRecommendation[] = [];
  const isDismissed = (t: string, id: number) => dismissed.has(`${t}:${id}`);

  // Meditation: stress → relaxation/breathwork; low sleep → sleep; else first
  let med: Meditation | undefined;
  if (userHints.highStress) {
    med = catalog.meditations.find(m => !isDismissed("meditation", m.id) && /relax|stress|breath/i.test(`${m.category} ${(m.tags || []).join(" ")} ${m.title}`));
  } else if (userHints.lowSleep) {
    med = catalog.meditations.find(m => !isDismissed("meditation", m.id) && /sleep/i.test(`${m.category} ${m.title}`));
  }
  if (!med) med = catalog.meditations.find(m => !isDismissed("meditation", m.id));
  if (med) {
    rec.push({
      contentType: "meditation",
      contentId: med.id,
      score: 70,
      rationale: userHints.highStress ? "Stress is elevated — short reset session" : userHints.lowSleep ? "Sleep was light — wind-down session" : "Quick mindfulness reset for today",
      rank: 0,
      source: "rule_based",
      userId: "", // filled by caller
    });
  }

  // Recipe: shortest high-protein recipe
  const recipe = [...catalog.recipes]
    .filter(r => !isDismissed("recipe", r.id))
    .sort((a, b) => (a.totalTime || 999) - (b.totalTime || 999))[0];
  if (recipe) {
    rec.push({
      contentType: "recipe",
      contentId: recipe.id,
      score: 60,
      rationale: `Quick option (${recipe.totalTime}min) to keep energy steady today`,
      rank: 1,
      source: "rule_based",
      userId: "",
    });
  }

  // Video: first available, prefer recovery/breath
  const vid = catalog.videos.find(v => !isDismissed("video", v.id) && /recover|breath|stress/i.test(`${v.category} ${(v.tags || []).join(" ")} ${v.title}`))
    || catalog.videos.find(v => !isDismissed("video", v.id));
  if (vid) {
    rec.push({
      contentType: "video",
      contentId: vid.id,
      score: 55,
      rationale: "Short read on a topic relevant to your recent check-ins",
      rank: 2,
      source: "rule_based",
      userId: "",
    });
  }

  return rec;
}

async function deriveQuickHints(userId: string): Promise<{ highStress: boolean; lowSleep: boolean }> {
  try {
    const checkIns = await storage.getUserCheckIns(userId);
    const recent = checkIns.slice(0, 3);
    const avgStress = recent.length ? recent.reduce((s, c) => s + (c.stressScore || 3), 0) / recent.length : 3;
    const avgSleep = recent.length ? recent.reduce((s, c) => s + (c.sleepScore || 3), 0) / recent.length : 3;
    return { highStress: avgStress >= 4, lowSleep: avgSleep <= 2.5 };
  } catch {
    return { highStress: false, lowSleep: false };
  }
}

export async function regenerateRecommendations(userId: string): Promise<void> {
  const [catalog, dismissals, userContext] = await Promise.all([
    loadCatalogs(),
    storage.getActiveDismissals(userId),
    getUserDataContext(userId, "smart_recommendations").catch(() => ""),
  ]);

  const dismissed = new Set(dismissals.map(d => `${d.contentType}:${d.contentId}`));
  const validIds = {
    meditation: new Set(catalog.meditations.map(m => m.id)),
    recipe: new Set(catalog.recipes.map(r => r.id)),
    video: new Set(catalog.videos.map(v => v.id)),
  } as const;

  let aiItems: InsertRecommendation[] | null = null;
  try {
    const { aiCall } = await import("./ai");
    const prompt = buildPrompt(userContext, summariseCatalog(catalog, dismissed));
    const result = await aiCall({
      feature: "smart_recommendations",
      userId,
      prompt,
      schema: AiOutputSchema,
      maxTokens: 1200,
      temperature: 0.4,
    });
    if (result.data) {
      const meds = result.data.meditations ?? [];
      const recs = result.data.recipes ?? [];
      const vids = result.data.videos ?? [];
      const merged: RecommendationItem[] = [
        ...meds.slice(0, TARGET_PER_TYPE).map(i => ({ ...i, contentType: "meditation" as const })),
        ...recs.slice(0, TARGET_PER_TYPE).map(i => ({ ...i, contentType: "recipe" as const })),
        ...vids.slice(0, TARGET_PER_TYPE).map(i => ({ ...i, contentType: "video" as const })),
      ];
      aiItems = merged
        .filter(i => validIds[i.contentType].has(i.contentId) && !dismissed.has(`${i.contentType}:${i.contentId}`))
        .map((i, idx) => ({
          userId,
          contentType: i.contentType,
          contentId: i.contentId,
          score: i.score,
          rationale: i.rationale,
          rank: idx,
          source: "ai" as const,
        }));
    }
  } catch (err) {
    console.error("[recommendations] AI generation failed", err);
  }

  // Always backfill missing types with rule-based candidates so the rail
  // is guaranteed to render one meditation + one recipe + one video when
  // those exist in the catalog.
  const hints = await deriveQuickHints(userId);
  const fallback = ruleBasedFallback(catalog, dismissed, hints).map(i => ({ ...i, userId }));
  const byType = new Map<string, InsertRecommendation[]>();
  for (const item of (aiItems ?? [])) {
    const arr = byType.get(item.contentType) ?? [];
    arr.push(item);
    byType.set(item.contentType, arr);
  }
  for (const f of fallback) {
    if (!byType.has(f.contentType)) {
      byType.set(f.contentType, [f]);
    }
  }
  const ordered: ("meditation" | "recipe" | "video")[] = ["meditation", "recipe", "video"];
  let rank = 0;
  const finalItems: InsertRecommendation[] = [];
  for (const t of ordered) {
    const items = byType.get(t) ?? [];
    for (const it of items) {
      finalItems.push({ ...it, rank: rank++ });
    }
  }

  await storage.replaceRecommendations(userId, finalItems);
}

export async function getCurrentRecommendations(userId: string): Promise<{
  recommendations: HydratedRecommendation[];
  generatedAt: string | null;
  stale: boolean;
}> {
  let rows = await storage.getRecommendations(userId);
  let newestAt = rows.length ? Math.max(...rows.map(r => new Date(r.generatedAt).getTime())) : 0;
  const staleMs = STALE_HOURS * 60 * 60 * 1000;
  let stale = !newestAt || (Date.now() - newestAt) > staleMs;

  if (rows.length === 0 || stale) {
    try {
      await regenerateRecommendations(userId);
      rows = await storage.getRecommendations(userId);
      newestAt = rows.length ? Math.max(...rows.map(r => new Date(r.generatedAt).getTime())) : 0;
      stale = !newestAt || (Date.now() - newestAt) > staleMs;
    } catch (err) {
      console.error("[recommendations] regenerate failed", err);
      // Keep existing stale flag so the client knows the data may be outdated.
    }
  }

  // Hydrate with content details so the client can render in one round-trip.
  const meditationIds = rows.filter(r => r.contentType === "meditation").map(r => r.contentId);
  const recipeIds = rows.filter(r => r.contentType === "recipe").map(r => r.contentId);
  const videoIds = rows.filter(r => r.contentType === "video").map(r => r.contentId);

  const [meds, recipes, videos] = await Promise.all([
    storage.getMeditationsByIds(meditationIds),
    storage.getRecipesByIds(recipeIds),
    storage.getVideosByIds(videoIds),
  ]);
  const medMap = new Map(meds.map(m => [m.id, m]));
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const videoMap = new Map(videos.map(v => [v.id, v]));

  const hydrated: HydratedRecommendation[] = rows.flatMap((r: Recommendation): HydratedRecommendation[] => {
    const base = {
      id: r.id,
      contentId: r.contentId,
      score: r.score,
      rationale: r.rationale,
      rank: r.rank,
      source: r.source,
      generatedAt: r.generatedAt,
    };
    if (r.contentType === "meditation") {
      const content = medMap.get(r.contentId);
      return content ? [{ ...base, contentType: "meditation" as const, content }] : [];
    }
    if (r.contentType === "recipe") {
      const content = recipeMap.get(r.contentId);
      return content ? [{ ...base, contentType: "recipe" as const, content }] : [];
    }
    if (r.contentType === "video") {
      const content = videoMap.get(r.contentId);
      return content ? [{ ...base, contentType: "video" as const, content }] : [];
    }
    return [];
  });

  return {
    recommendations: hydrated,
    generatedAt: newestAt ? new Date(newestAt).toISOString() : null,
    stale,
  };
}

export async function dismissRecommendation(userId: string, contentType: ContentType, contentId: number): Promise<void> {
  const until = new Date(Date.now() + DISMISSAL_DAYS * 24 * 60 * 60 * 1000);
  await storage.createDismissal({ userId, contentType, contentId, until });
  // Force regenerate so the rail refreshes immediately.
  try {
    await regenerateRecommendations(userId);
  } catch (err) {
    console.error("[recommendations] regenerate after dismiss failed", err);
  }
}

export async function invalidateRecommendations(userId: string): Promise<void> {
  try {
    await storage.clearRecommendations(userId);
  } catch (err) {
    console.error("[recommendations] invalidate failed", err);
  }
}
