import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { learnContentLibrary, learnTopics, learningPaths } from "@shared/schema";
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
// Entry points:
//   runContentTagBackfill({ force })  — tag the whole library, return report.
//     Skips anything already tagged unless force=true, so hand-set tags are
//     never clobbered. Triggered from the admin endpoint or scripts/tag-content.ts.
//   tagNewLibraryItemAsync(id) / tagNewLearningPathAsync(id) — fire-and-forget
//     hooks called from the create routes so future uploads tag themselves.
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
  thinContent: Array<{ type: "video" | "path"; id: number; title: string }>;
  // Labels the AI wished the vocabulary had. Review, and promote the good
  // ones into CONTENT_VOCAB, then re-run with force=true.
  suggestedNewLabels: string[];
  // What was written, for eyeballing quality.
  details: Array<{ type: "video" | "path"; id: number; title: string; tags: string[] }>;
  errors: Array<{ type: "video" | "path"; id: number; title: string; error: string }>;
}

async function resolveProviderConfig(): Promise<{ provider?: string; model?: string }> {
  try {
    const config = await getFeatureConfig("recovery_coach");
    if (config) return { provider: config.provider, model: config.model };
  } catch {}
  return {};
}

async function tagOne(
  kind: "video" | "path",
  title: string,
  description: string | null | undefined,
  topicTitle: string | null | undefined,
  provider?: string,
  model?: string,
): Promise<TagResult | null> {
  const prompt = `You tag educational wellness content for search inside an executive health app. Users find content by describing their problems in everyday words ("can't switch off at night", "shattered by 3pm", "my back is killing me"), so tags must be the words a struggling user would actually type.

CONTENT TO TAG:
Type: ${kind === "path" ? "learning path (a multi-part course)" : "video/guide"}
Title: "${title}"
Description: "${description || "(no description)"}"
Topic: "${topicTitle || "(none)"}"

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

  report.suggestedNewLabels = Array.from(suggested).sort();
  console.log(
    `[content-tagger] backfill done: ${report.itemsTagged} items + ${report.pathsTagged} paths tagged, ` +
      `${report.itemsSkipped + report.pathsSkipped} skipped (already tagged), ` +
      `${report.itemsFailed + report.pathsFailed} failed, ${report.thinContent.length} thin.`,
  );
  return report;
}
