import { z } from "zod";
import { eq, isNull as sqlIsNull } from "drizzle-orm";
import { db } from "../db";
import { learnContentLibrary, learnTopics, learningPaths, meditations, programs, recipes } from "@shared/schema";
import { aiCall } from "../ai";
import { getFeatureConfig } from "../aiProvider";
import { CONTENT_VOCAB, toCanonicalTags } from "./contentVocab";

// ---------------------------------------------------------------------------
// AI auto-tagging for education content.
//
// Reads each item's title + description + topic (the only text the database
// holds about a video) and applies 4-10 labels STRICTLY from the canonical
// vocabulary in contentVocab.ts. Learn library items get `tags`; learning
// paths get `struggles` ("helps with"). These are exactly the columns the
// coach's education search matches on, so nothing else needs to change.
//
// Since checkpoint C the same tagger also covers meditations.tags,
// recipes.tags (library rows only) and programs.tags (manual/admin rows
// only) — the columns the universal recommendation engine searches — so ALL
// new content self-tags on upload.
//
// Entry points:
//   runContentTagBackfill({ force })  — tag every covered table, return report.
//     Skips anything already tagged unless force=true, so hand-set tags are
//     never clobbered. Triggered from the admin endpoint or scripts/tag-content.ts.
//   tagNew*Async(id) — fire-and-forget hooks called from the create routes so
//     future uploads tag themselves (library items, learning paths,
//     meditations, recipes, programmes).
// ---------------------------------------------------------------------------

const tagSchema = z.object({
  tags: z.array(z.string()).max(12).default([]),
  suggestedNewLabels: z.array(z.string()).max(3).default([]),
  contentTooThin: z.boolean().default(false),
});

type TagResult = z.infer<typeof tagSchema>;

export interface TagBackfillReport {
  itemsTagged: number;
  itemsSkipped: number;
  itemsFailed: number;
  pathsTagged: number;
  pathsSkipped: number;
  pathsFailed: number;
  // Items whose title+description were too thin for confident tagging —
  // improving these descriptions is the highest-value manual follow-up.
  // Generic-table (meditation/recipe/programme) counters.
  genericTagged: number;
  genericSkipped: number;
  genericFailed: number;
  thinContent: Array<{ type: string; id: number; title: string }>;
  // Labels the AI wished the vocabulary had. Review, and promote the good
  // ones into CONTENT_VOCAB, then re-run with force=true.
  suggestedNewLabels: string[];
  // What was written, for eyeballing quality.
  details: Array<{ type: string; id: number; title: string; tags: string[] }>;
  errors: Array<{ type: string; id: number; title: string; error: string }>;
}

async function resolveProviderConfig(): Promise<{ provider?: string; model?: string }> {
  try {
    const config = await getFeatureConfig("recovery_coach");
    if (config) return { provider: config.provider, model: config.model };
  } catch {}
  return {};
}

const KIND_LABELS: Record<string, string> = {
  video: "video/guide",
  path: "learning path (a multi-part course)",
  meditation: "guided audio meditation",
  recipe: "recipe (tag by the needs it serves: protein, quick meals, weight management, snacking, eating out, meal planning...)",
  programme: "multi-week training programme",
};

async function tagOne(
  kind: string,
  title: string,
  description: string | null | undefined,
  topicTitle: string | null | undefined,
  provider?: string,
  model?: string,
): Promise<TagResult | null> {
  const prompt = `You tag wellness app content for search inside an executive health app. Users find content by describing their problems in everyday words ("can't switch off at night", "shattered by 3pm", "my back is killing me"), so tags must be the words a struggling user would actually type.

CONTENT TO TAG:
Type: ${KIND_LABELS[kind] || kind}
Title: "${title}"
Description: "${description || "(no description)"}"
Topic/context: "${topicTitle || "(none)"}"

Pick 4 to 10 tags STRICTLY from this menu (use exact spelling, lowercase):
${CONTENT_VOCAB.join(", ")}

Rules:
- Only pick tags that genuinely fit this content. Favour the problem/symptom words a user would type, plus the goal the content delivers.
- Do not pad. Wrong tags are worse than few tags.
- If the title and description are too thin to judge confidently, set contentTooThin=true and still give your best 2-4 tags.
- If an important label is missing from the menu, put up to 3 suggestions in suggestedNewLabels (do NOT put them in tags).

Respond ONLY with JSON: {"tags": string[], "suggestedNewLabels": string[], "contentTooThin": boolean}`;

  const result = await aiCall<TagResult>({
    feature: "content_tagging",
    prompt,
    schema: tagSchema as z.ZodType<TagResult>,
    provider,
    model,
    maxTokens: 300,
    temperature: 0,
    timeoutMs: 20_000,
  });
  return result.data;
}

/** Tags one learn library item by id if it has no tags yet. */
export async function tagLibraryItemById(itemId: number, force: boolean = false): Promise<boolean> {
  const [row] = await db
    .select({
      id: learnContentLibrary.id,
      title: learnContentLibrary.title,
      description: learnContentLibrary.description,
      tags: learnContentLibrary.tags,
      topicTitle: learnTopics.title,
    })
    .from(learnContentLibrary)
    .leftJoin(learnTopics, eq(learnContentLibrary.topicId, learnTopics.id))
    .where(eq(learnContentLibrary.id, itemId))
    .limit(1);
  if (!row) return false;
  if (!force && Array.isArray(row.tags) && row.tags.length > 0) return false;

  const { provider, model } = await resolveProviderConfig();
  const result = await tagOne("video", row.title, row.description, row.topicTitle, provider, model);
  const tags = toCanonicalTags(result?.tags || []);
  if (tags.length === 0) return false;
  await db.update(learnContentLibrary).set({ tags }).where(eq(learnContentLibrary.id, itemId));
  console.log(`[content-tagger] video ${itemId} "${row.title}" → ${tags.join(", ")}`);
  return true;
}

/** Tags one learning path's struggles ("helps with") by id if empty. */
export async function tagLearningPathById(pathId: number, force: boolean = false): Promise<boolean> {
  const [row] = await db
    .select({
      id: learningPaths.id,
      title: learningPaths.title,
      description: learningPaths.description,
      struggles: learningPaths.struggles,
      topicTitle: learnTopics.title,
    })
    .from(learningPaths)
    .leftJoin(learnTopics, eq(learningPaths.topicId, learnTopics.id))
    .where(eq(learningPaths.id, pathId))
    .limit(1);
  if (!row) return false;
  if (!force && Array.isArray(row.struggles) && row.struggles.length > 0) return false;

  const { provider, model } = await resolveProviderConfig();
  const result = await tagOne("path", row.title, row.description, row.topicTitle, provider, model);
  const struggles = toCanonicalTags(result?.tags || []);
  if (struggles.length === 0) return false;
  await db.update(learningPaths).set({ struggles }).where(eq(learningPaths.id, pathId));
  console.log(`[content-tagger] path ${pathId} "${row.title}" → ${struggles.join(", ")}`);
  return true;
}

/** Fire-and-forget hook for the content-library create route. */
export function tagNewLibraryItemAsync(itemId: number): void {
  tagLibraryItemById(itemId).catch((e: any) =>
    console.error("[content-tagger] auto-tag new item failed:", e?.message || e),
  );
}

/** Fire-and-forget hook for the learning-path create route. */
export function tagNewLearningPathAsync(pathId: number): void {
  tagLearningPathById(pathId).catch((e: any) =>
    console.error("[content-tagger] auto-tag new path failed:", e?.message || e),
  );
}

// --- generic-table taggers (checkpoint C) ----------------------------------

type GenericTarget = {
  kind: "meditation" | "recipe" | "programme";
  load: (id: number) => Promise<{ id: number; title: string; description: string | null; context: string | null; tags: string[] | null } | null>;
  save: (id: number, tags: string[]) => Promise<void>;
};

const GENERIC_TARGETS: Record<string, GenericTarget> = {
  meditation: {
    kind: "meditation",
    load: async (id) => {
      const [r] = await db.select().from(meditations).where(eq(meditations.id, id)).limit(1);
      return r ? { id: r.id, title: r.title, description: r.description ?? null, context: r.category ?? null, tags: r.tags ?? null } : null;
    },
    save: async (id, tags) => {
      await db.update(meditations).set({ tags }).where(eq(meditations.id, id));
    },
  },
  recipe: {
    kind: "recipe",
    load: async (id) => {
      const [r] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
      if (!r || r.userId) return null; // library recipes only — never touch user-owned recipes
      const context = [r.category, Array.isArray(r.keyIngredients) ? r.keyIngredients.slice(0, 6).join(", ") : null]
        .filter(Boolean)
        .join(" | ");
      return { id: r.id, title: r.title, description: r.description ?? null, context: context || null, tags: r.tags ?? null };
    },
    save: async (id, tags) => {
      await db.update(recipes).set({ tags }).where(eq(recipes.id, id));
    },
  },
  programme: {
    kind: "programme",
    load: async (id) => {
      const [r] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
      if (!r || r.sourceType !== "manual") return null; // admin library programmes only
      const context = [r.goal?.replace(/_/g, " "), r.difficulty, r.whoItsFor].filter(Boolean).join(" | ");
      return { id: r.id, title: r.title, description: r.description ?? null, context: context || null, tags: r.tags ?? null };
    },
    save: async (id, tags) => {
      await db.update(programs).set({ tags }).where(eq(programs.id, id));
    },
  },
};

async function tagGenericById(kind: keyof typeof GENERIC_TARGETS, id: number, force: boolean = false): Promise<boolean> {
  const target = GENERIC_TARGETS[kind];
  const row = await target.load(id);
  if (!row) return false;
  if (!force && Array.isArray(row.tags) && row.tags.length > 0) return false;

  const { provider, model } = await resolveProviderConfig();
  const result = await tagOne(target.kind, row.title, row.description, row.context, provider, model);
  const tags = toCanonicalTags(result?.tags || []);
  if (tags.length === 0) return false;
  await target.save(id, tags);
  console.log(`[content-tagger] ${target.kind} ${id} "${row.title}" → ${tags.join(", ")}`);
  return true;
}

/** Fire-and-forget hooks for the create routes. */
export function tagNewMeditationAsync(id: number): void {
  tagGenericById("meditation", id).catch((e: any) =>
    console.error("[content-tagger] auto-tag new meditation failed:", e?.message || e),
  );
}
export function tagNewRecipeAsync(id: number): void {
  tagGenericById("recipe", id).catch((e: any) =>
    console.error("[content-tagger] auto-tag new recipe failed:", e?.message || e),
  );
}
export function tagNewProgrammeAsync(id: number): void {
  tagGenericById("programme", id).catch((e: any) =>
    console.error("[content-tagger] auto-tag new programme failed:", e?.message || e),
  );
}

/**
 * Tags the whole education library. Sequential on purpose — gentle on the AI
 * provider and the report stays ordered. At library scale (~100 items) this
 * takes a few minutes and costs pennies.
 */
export async function runContentTagBackfill(opts: { force?: boolean } = {}): Promise<TagBackfillReport> {
  const force = opts.force === true;
  const report: TagBackfillReport = {
    itemsTagged: 0,
    itemsSkipped: 0,
    itemsFailed: 0,
    pathsTagged: 0,
    pathsSkipped: 0,
    pathsFailed: 0,
    genericTagged: 0,
    genericSkipped: 0,
    genericFailed: 0,
    thinContent: [],
    suggestedNewLabels: [],
    details: [],
    errors: [],
  };
  const suggested = new Set<string>();
  const { provider, model } = await resolveProviderConfig();

  const items = await db
    .select({
      id: learnContentLibrary.id,
      title: learnContentLibrary.title,
      description: learnContentLibrary.description,
      tags: learnContentLibrary.tags,
      topicTitle: learnTopics.title,
    })
    .from(learnContentLibrary)
    .leftJoin(learnTopics, eq(learnContentLibrary.topicId, learnTopics.id));

  for (const row of items) {
    if (!force && Array.isArray(row.tags) && row.tags.length > 0) {
      report.itemsSkipped++;
      continue;
    }
    try {
      const result = await tagOne("video", row.title, row.description, row.topicTitle, provider, model);
      const tags = toCanonicalTags(result?.tags || []);
      if (result?.contentTooThin) report.thinContent.push({ type: "video", id: row.id, title: row.title });
      for (const s of result?.suggestedNewLabels || []) {
        const clean = String(s || "").trim().toLowerCase();
        if (clean) suggested.add(clean);
      }
      if (tags.length === 0) {
        report.itemsFailed++;
        report.errors.push({ type: "video", id: row.id, title: row.title, error: "no valid tags returned" });
        continue;
      }
      await db.update(learnContentLibrary).set({ tags }).where(eq(learnContentLibrary.id, row.id));
      report.itemsTagged++;
      report.details.push({ type: "video", id: row.id, title: row.title, tags });
      console.log(`[content-tagger] video ${row.id} "${row.title}" → ${tags.join(", ")}`);
    } catch (e: any) {
      report.itemsFailed++;
      report.errors.push({ type: "video", id: row.id, title: row.title, error: e?.message || String(e) });
    }
  }

  const paths = await db
    .select({
      id: learningPaths.id,
      title: learningPaths.title,
      description: learningPaths.description,
      struggles: learningPaths.struggles,
      topicTitle: learnTopics.title,
    })
    .from(learningPaths)
    .leftJoin(learnTopics, eq(learningPaths.topicId, learnTopics.id));

  for (const row of paths) {
    if (!force && Array.isArray(row.struggles) && row.struggles.length > 0) {
      report.pathsSkipped++;
      continue;
    }
    try {
      const result = await tagOne("path", row.title, row.description, row.topicTitle, provider, model);
      const struggles = toCanonicalTags(result?.tags || []);
      if (result?.contentTooThin) report.thinContent.push({ type: "path", id: row.id, title: row.title });
      for (const s of result?.suggestedNewLabels || []) {
        const clean = String(s || "").trim().toLowerCase();
        if (clean) suggested.add(clean);
      }
      if (struggles.length === 0) {
        report.pathsFailed++;
        report.errors.push({ type: "path", id: row.id, title: row.title, error: "no valid tags returned" });
        continue;
      }
      await db.update(learningPaths).set({ struggles }).where(eq(learningPaths.id, row.id));
      report.pathsTagged++;
      report.details.push({ type: "path", id: row.id, title: row.title, tags: struggles });
      console.log(`[content-tagger] path ${row.id} "${row.title}" → ${struggles.join(", ")}`);
    } catch (e: any) {
      report.pathsFailed++;
      report.errors.push({ type: "path", id: row.id, title: row.title, error: e?.message || String(e) });
    }
  }

  // Generic tables (checkpoint C): meditations, library recipes, manual programmes.
  const genericSets: Array<{ kind: "meditation" | "recipe" | "programme"; rows: Array<{ id: number; title: string; description: string | null; context: string | null; tags: string[] | null }> }> = [];
  try {
    const meds = await db.select().from(meditations);
    genericSets.push({
      kind: "meditation",
      rows: meds.map((r) => ({ id: r.id, title: r.title, description: r.description ?? null, context: r.category ?? null, tags: r.tags ?? null })),
    });
  } catch (e: any) {
    console.error("[content-tagger] loading meditations failed:", e?.message || e);
  }
  try {
    const recs = await db.select().from(recipes).where(sqlIsNull(recipes.userId));
    genericSets.push({
      kind: "recipe",
      rows: recs.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        context: [r.category, Array.isArray(r.keyIngredients) ? r.keyIngredients.slice(0, 6).join(", ") : null].filter(Boolean).join(" | ") || null,
        tags: r.tags ?? null,
      })),
    });
  } catch (e: any) {
    console.error("[content-tagger] loading recipes failed:", e?.message || e);
  }
  try {
    const progs = await db.select().from(programs).where(eq(programs.sourceType, "manual"));
    genericSets.push({
      kind: "programme",
      rows: progs.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        context: [r.goal?.replace(/_/g, " "), r.difficulty, r.whoItsFor].filter(Boolean).join(" | ") || null,
        tags: r.tags ?? null,
      })),
    });
  } catch (e: any) {
    console.error("[content-tagger] loading programmes failed:", e?.message || e);
  }

  for (const set of genericSets) {
    for (const row of set.rows) {
      if (!force && Array.isArray(row.tags) && row.tags.length > 0) {
        report.genericSkipped++;
        continue;
      }
      try {
        const result = await tagOne(set.kind, row.title, row.description, row.context, provider, model);
        const tags = toCanonicalTags(result?.tags || []);
        if (result?.contentTooThin) report.thinContent.push({ type: set.kind, id: row.id, title: row.title });
        for (const s of result?.suggestedNewLabels || []) {
          const clean = String(s || "").trim().toLowerCase();
          if (clean) suggested.add(clean);
        }
        if (tags.length === 0) {
          report.genericFailed++;
          report.errors.push({ type: set.kind, id: row.id, title: row.title, error: "no valid tags returned" });
          continue;
        }
        await GENERIC_TARGETS[set.kind].save(row.id, tags);
        report.genericTagged++;
        report.details.push({ type: set.kind, id: row.id, title: row.title, tags });
        console.log(`[content-tagger] ${set.kind} ${row.id} "${row.title}" → ${tags.join(", ")}`);
      } catch (e: any) {
        report.genericFailed++;
        report.errors.push({ type: set.kind, id: row.id, title: row.title, error: e?.message || String(e) });
      }
    }
  }

  report.suggestedNewLabels = Array.from(suggested).sort();
  console.log(
    `[content-tagger] backfill done: ${report.itemsTagged} items + ${report.pathsTagged} paths + ${report.genericTagged} meditation/recipe/programme rows tagged, ` +
      `${report.itemsSkipped + report.pathsSkipped + report.genericSkipped} skipped (already tagged), ` +
      `${report.itemsFailed + report.pathsFailed + report.genericFailed} failed, ${report.thinContent.length} thin.`,
  );
  return report;
}
