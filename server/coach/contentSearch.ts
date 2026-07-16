import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  coachRecommendations,
  learnContentLibrary,
  learnTopics,
  learningPathContent,
  learningPaths,
} from "@shared/schema";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { CONTENT_VOCAB } from "./contentVocab";

// ---------------------------------------------------------------------------
// Coach chat education-content retrieval.
//
// Flow per chat message:
//   1. extractContentIntent  — small schema-validated AI call decides whether
//      education content could help this message, and with what search terms.
//   2. searchEducationContent — real DB search over the learn content library
//      and learning paths. Scales to any library size: SQL narrows candidates,
//      JS ranks them, only a shortlist ever enters the coach prompt.
//   3. buildEducationBlock   — formats the shortlist (with stable IDs and the
//      user's completion status) plus the recommendation rules for the prompt.
//   4. parseRecMarkers / resolveRecommendations — after the coach replies,
//      [[REC video:12]] markers are stripped from the text and validated
//      against the DB, so the client only ever receives real, tappable
//      content. Every card shown is logged for engagement/gamification.
//
// Every step is designed to fail soft: any error here should be caught by the
// caller and the chat continues without recommendations.
// ---------------------------------------------------------------------------

export type ContentIntent = {
  wantsContent: boolean;
  searchTerms: string[];
  contentType: "video" | "path" | "any";
};

export type EducationCandidate = {
  type: "video" | "path";
  id: number;
  title: string;
  description: string | null;
  contentType: string | null; // library items: 'video' | 'pdf' | 'swipe_file' | 'article'
  topicId: number | null;
  topicTitle: string | null;
  topicSlug: string | null;
  durationMins: number | null;
  difficulty: string | null;
  tags: string[] | null;
  struggles: string[] | null;
  score: number;
};

export type ResolvedRecommendation = {
  recId: number;
  type: "video" | "path";
  id: number;
  title: string;
  topic: string | null;
  contentType: string | null;
  durationMins: number | null;
  difficulty: string | null;
  route: string;
};

const intentSchema = z.object({
  wantsContent: z.boolean(),
  searchTerms: z.array(z.string()).max(8).default([]),
  contentType: z.enum(["video", "path", "any"]).default("any"),
});

const CONTENT_KEYWORD_FALLBACK =
  /\b(video|videos|watch|learn|course|courses|guide|guides|lesson|tutorial|education|learning path|the lab)\b/i;

/**
 * Small, fast classification call: does this message warrant education
 * content, and what should we search for? Uses the same provider/model as the
 * main coach call so it works with whatever the admin has configured.
 * Falls back to a conservative keyword heuristic if the call fails.
 */
export async function extractContentIntent(
  userId: string,
  message: string,
  recentHistory: string,
  provider?: string,
  model?: string,
): Promise<ContentIntent> {
  const prompt = `You classify one chat message for an executive wellness app. Decide whether short educational content (videos, guides, learning paths on topics like sleep, stress, nutrition habits, posture, desk ergonomics, breathwork, recovery, mobility, training principles, burnout, focus) could genuinely help with the user's CURRENT message.

Set wantsContent=true when the user asks a how/why/what-should-I question about a health or performance topic, describes a struggle (poor sleep, stress, aches, low energy, procrastinating on healthy habits), or explicitly asks for videos, courses, or things to watch or learn.
Set wantsContent=false for: app/logistics questions, greetings and small talk, pure data lookups ("what was my HRV yesterday"), scheduling, feedback about the app, or moments of emotional venting where suggesting a video would feel dismissive.

searchTerms: 2 to 6 short lowercase keywords or phrases capturing the topics. STRONGLY prefer terms from this canonical tag list when any fit (content is tagged with exactly these labels): ${CONTENT_VOCAB.join(", ")}. Add a term outside the list only when nothing on it applies.
contentType: "path" if they want a structured course or multi-part journey, "video" if they want one quick thing to watch or read, otherwise "any".

Recent conversation:
${recentHistory || "(none)"}

User message: "${message}"

Respond ONLY with JSON: {"wantsContent": boolean, "searchTerms": string[], "contentType": "video" | "path" | "any"}`;

  try {
    const result = await aiCall<ContentIntent>({
      feature: "coach_content_search",
      userId,
      prompt,
      schema: intentSchema as z.ZodType<ContentIntent>,
      provider,
      model,
      maxTokens: 220,
      temperature: 0,
      timeoutMs: 12_000,
    });
    if (result.data) {
      return {
        wantsContent: result.data.wantsContent,
        searchTerms: (result.data.searchTerms || []).slice(0, 8),
        contentType: result.data.contentType || "any",
      };
    }
  } catch (e: any) {
    console.error("[coach-content] intent extraction failed:", e?.message || e);
  }
  // Conservative fallback: only trigger on explicit content requests.
  return {
    wantsContent: CONTENT_KEYWORD_FALLBACK.test(message),
    searchTerms: [],
    contentType: "any",
  };
}

function normaliseTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms || []) {
    const t = String(raw || "").trim().toLowerCase();
    if (t.length < 2 || t.length > 60 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function scoreFields(terms: string[], fields: Array<{ v: string | null | undefined; w: number }>): number {
  let score = 0;
  for (const term of terms) {
    for (const { v, w } of fields) {
      if (v && v.toLowerCase().includes(term)) score += w;
    }
  }
  return score;
}

/**
 * DB search over the education library (learn content items + learning
 * paths). With search terms, SQL ILIKE conditions narrow the candidate set
 * before JS ranking, so this stays cheap however large the library grows.
 * Without terms (browse-style requests), returns recommended paths and the
 * newest content instead.
 */
export async function searchEducationContent(opts: {
  terms: string[];
  contentType?: "video" | "path" | "any";
  limit?: number;
}): Promise<EducationCandidate[]> {
  const terms = normaliseTerms(opts.terms);
  const contentType = opts.contentType || "any";
  const limit = Math.max(1, Math.min(opts.limit ?? 8, 16));

  const wantItems = contentType === "video" || contentType === "any";
  const wantPaths = contentType === "path" || contentType === "any";

  const items: EducationCandidate[] = [];
  const paths: EducationCandidate[] = [];

  if (wantItems) {
    const baseSelect = {
      id: learnContentLibrary.id,
      title: learnContentLibrary.title,
      description: learnContentLibrary.description,
      contentType: learnContentLibrary.contentType,
      duration: learnContentLibrary.duration,
      tags: learnContentLibrary.tags,
      topicId: learnContentLibrary.topicId,
      topicTitle: learnTopics.title,
      topicSlug: learnTopics.slug,
    };
    let rows: Array<any>;
    if (terms.length > 0) {
      const conds = terms.flatMap((t) => {
        const pat = `%${t}%`;
        return [
          ilike(learnContentLibrary.title, pat),
          ilike(learnContentLibrary.description, pat),
          sql`${learnContentLibrary.tags}::text ILIKE ${pat}`,
          ilike(learnTopics.title, pat),
        ];
      });
      rows = await db
        .select(baseSelect)
        .from(learnContentLibrary)
        .leftJoin(learnTopics, eq(learnContentLibrary.topicId, learnTopics.id))
        .where(or(...conds))
        .limit(300);
    } else {
      rows = await db
        .select(baseSelect)
        .from(learnContentLibrary)
        .leftJoin(learnTopics, eq(learnContentLibrary.topicId, learnTopics.id))
        .orderBy(desc(learnContentLibrary.id))
        .limit(60);
    }
    for (const r of rows) {
      const tagsText = Array.isArray(r.tags) ? r.tags.join(" ") : "";
      const score =
        terms.length === 0
          ? 1
          : scoreFields(terms, [
              { v: r.title, w: 3 },
              { v: tagsText, w: 2.5 },
              { v: r.topicTitle, w: 2 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      items.push({
        type: "video",
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        contentType: r.contentType ?? null,
        topicId: r.topicId ?? null,
        topicTitle: r.topicTitle ?? null,
        topicSlug: r.topicSlug ?? null,
        durationMins: r.duration ? Math.max(1, Math.round(r.duration / 60)) : null,
        difficulty: null,
        tags: r.tags ?? null,
        struggles: null,
        score,
      });
    }
    items.sort((a, b) => b.score - a.score);
  }

  if (wantPaths) {
    const baseSelect = {
      id: learningPaths.id,
      title: learningPaths.title,
      description: learningPaths.description,
      category: learningPaths.category,
      struggles: learningPaths.struggles,
      systems: learningPaths.systems,
      estimatedDuration: learningPaths.estimatedDuration,
      difficulty: learningPaths.difficulty,
      isRecommended: learningPaths.isRecommended,
      topicId: learningPaths.topicId,
      topicTitle: learnTopics.title,
      topicSlug: learnTopics.slug,
    };
    let rows: Array<any>;
    if (terms.length > 0) {
      const conds = terms.flatMap((t) => {
        const pat = `%${t}%`;
        return [
          ilike(learningPaths.title, pat),
          ilike(learningPaths.description, pat),
          ilike(learningPaths.category, pat),
          sql`${learningPaths.struggles}::text ILIKE ${pat}`,
          sql`${learningPaths.systems}::text ILIKE ${pat}`,
          ilike(learnTopics.title, pat),
        ];
      });
      rows = await db
        .select(baseSelect)
        .from(learningPaths)
        .leftJoin(learnTopics, eq(learningPaths.topicId, learnTopics.id))
        .where(or(...conds))
        .limit(200);
    } else {
      rows = await db
        .select(baseSelect)
        .from(learningPaths)
        .leftJoin(learnTopics, eq(learningPaths.topicId, learnTopics.id))
        .orderBy(desc(learningPaths.isRecommended), desc(learningPaths.id))
        .limit(30);
    }
    for (const r of rows) {
      const strugglesText = Array.isArray(r.struggles) ? r.struggles.join(" ") : "";
      const systemsText = Array.isArray(r.systems) ? r.systems.join(" ") : "";
      const score =
        terms.length === 0
          ? (r.isRecommended ? 2 : 1)
          : scoreFields(terms, [
              { v: r.title, w: 3 },
              { v: strugglesText, w: 2.5 },
              { v: r.category, w: 2 },
              { v: r.topicTitle, w: 2 },
              { v: systemsText, w: 1.5 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      paths.push({
        type: "path",
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        contentType: null,
        topicId: r.topicId ?? null,
        topicTitle: r.topicTitle ?? null,
        topicSlug: r.topicSlug ?? null,
        durationMins: r.estimatedDuration ?? null,
        difficulty: r.difficulty ?? null,
        tags: null,
        struggles: r.struggles ?? null,
        score,
      });
    }
    paths.sort((a, b) => b.score - a.score);
  }

  // Blend: keep both kinds visible when both were requested, favouring items
  // slightly since single videos are the lighter recommendation.
  if (contentType === "video") return items.slice(0, limit);
  if (contentType === "path") return paths.slice(0, limit);
  const itemShare = Math.min(items.length, Math.ceil(limit * 0.6));
  const pathShare = Math.min(paths.length, limit - itemShare);
  const blended = [...items.slice(0, limit - pathShare), ...paths.slice(0, pathShare)];
  return blended.slice(0, limit);
}

/**
 * Formats the retrieved shortlist for the coach prompt, including the user's
 * completion/assignment status and the marker rules the model must follow.
 */
export async function buildEducationBlock(
  userId: string,
  candidates: EducationCandidate[],
): Promise<string> {
  if (candidates.length === 0) return "";

  const [progress, assignments] = await Promise.all([
    storage.getUserContentProgress(userId).catch(() => []),
    storage.getUserPathAssignments(userId).catch(() => []),
  ]);

  const completedItems = new Set(
    (progress || []).filter((p: any) => p.completed).map((p: any) => p.libraryItemId),
  );
  const watchById = new Map<number, number>();
  for (const p of progress || []) {
    if (typeof p.watchProgress === "number" && p.watchProgress > 0 && !p.completed) {
      watchById.set(p.libraryItemId, p.watchProgress);
    }
  }
  const assignmentByPath = new Map<number, any>();
  for (const a of assignments || []) {
    assignmentByPath.set(a.pathId, a);
  }

  // "Next up" for assigned, in-progress candidate paths (max 3 lookups).
  const nextUpByPath = new Map<number, { id: number; title: string }>();
  const assignedCandidatePaths = candidates
    .filter((c) => c.type === "path" && assignmentByPath.has(c.id) && !assignmentByPath.get(c.id)?.completedDate)
    .slice(0, 3);
  for (const p of assignedCandidatePaths) {
    try {
      const pathItems = await storage.getPathContentFromLibrary(p.id);
      const next = (pathItems || []).find((it: any) => !completedItems.has(it.id));
      if (next) nextUpByPath.set(p.id, { id: next.id, title: next.title });
    } catch {}
  }

  const videoLines: string[] = [];
  const pathLines: string[] = [];
  for (const c of candidates) {
    if (c.type === "video") {
      const status = completedItems.has(c.id)
        ? "completed"
        : watchById.has(c.id)
          ? `in progress (${watchById.get(c.id)}% watched)`
          : "not started";
      const bits = [
        `[video:${c.id}] "${c.title}"`,
        c.contentType || "video",
        c.topicTitle ? `topic: ${c.topicTitle}` : null,
        c.durationMins ? `${c.durationMins} min` : null,
        c.tags?.length ? `tags: ${c.tags.slice(0, 6).join(", ")}` : null,
        `user status: ${status}`,
      ].filter(Boolean);
      videoLines.push(`- ${bits.join(" | ")}`);
    } else {
      const a = assignmentByPath.get(c.id);
      const status = a
        ? a.completedDate
          ? "completed"
          : `assigned, ${a.progress ?? 0}% complete`
        : "not started";
      const nextUp = nextUpByPath.get(c.id);
      const bits = [
        `[path:${c.id}] "${c.title}"`,
        c.topicTitle ? `topic: ${c.topicTitle}` : null,
        c.difficulty || null,
        c.durationMins ? `~${c.durationMins} min total` : null,
        c.struggles?.length ? `helps with: ${c.struggles.slice(0, 5).join(", ")}` : null,
        `user status: ${status}`,
        nextUp ? `next up: [video:${nextUp.id}] "${nextUp.title}"` : null,
      ].filter(Boolean);
      pathLines.push(`- ${bits.join(" | ")}`);
    }
  }

  const sections: string[] = ["\n\nEDUCATION CONTENT RETRIEVED FOR THIS MESSAGE (the only videos/paths you may recommend):"];
  if (videoLines.length > 0) sections.push("Videos & guides:\n" + videoLines.join("\n"));
  if (pathLines.length > 0) sections.push("Learning paths:\n" + pathLines.join("\n"));
  sections.push(`EDUCATION RECOMMENDATION RULES:
- If one or two of these genuinely help with what the user is discussing, weave the title naturally into your reply, then add one marker per recommendation on its own line at the very END of your reply: [[REC video:12]] or [[REC path:3]] (using the real IDs above).
- Maximum 2 markers. Only IDs from the list above. Never invent or guess IDs.
- Prefer content the user has not completed. If a path is assigned and in progress, prefer its "next up" video.
- If nothing fits well, or education content would not help this message, use no markers at all. A forced recommendation is worse than none.
- Markers are machine-read and stripped before the user sees your reply. Do not mention, quote, or explain them.`);

  return sections.join("\n\n");
}

const REC_MARKER_RE = /\[{1,2}\s*REC\s+(video|path)\s*:\s*(\d+)\s*\]{1,2}/gi;

/**
 * Pulls [[REC type:id]] markers out of the model's reply and returns the
 * cleaned text (safe to show users even if resolution later fails).
 */
export function parseRecMarkers(text: string): {
  cleanText: string;
  refs: Array<{ type: "video" | "path"; id: number }>;
} {
  const refs: Array<{ type: "video" | "path"; id: number }> = [];
  const seen = new Set<string>();
  const cleanText = String(text || "")
    .replace(REC_MARKER_RE, (_m, type: string, id: string) => {
      const key = `${type.toLowerCase()}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ type: type.toLowerCase() as "video" | "path", id: parseInt(id, 10) });
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanText, refs };
}

/**
 * Validates marker refs against the DB and hydrates them into card payloads
 * with ready-made deep-link routes. Logs one coach_recommendations row per
 * card (the "shown" event); the client reports taps via the rec id.
 */
export async function resolveRecommendations(
  userId: string,
  refs: Array<{ type: "video" | "path"; id: number }>,
  source: string = "chat",
): Promise<ResolvedRecommendation[]> {
  const out: ResolvedRecommendation[] = [];

  for (const ref of refs.slice(0, 4)) {
    if (out.length >= 2) break;
    if (!Number.isFinite(ref.id) || ref.id <= 0) continue;

    try {
      if (ref.type === "video") {
        const item = await storage.getContentLibraryItem(ref.id);
        if (!item) continue;
        let route: string | null = item.topicSlug ? `/learn/${item.topicSlug}/video/${item.id}` : null;
        if (!route) {
          // Fall back to a path-scoped player if the item belongs to a path.
          const [link] = await db
            .select({ pathId: learningPathContent.pathId })
            .from(learningPathContent)
            .where(eq(learningPathContent.libraryItemId, item.id))
            .limit(1);
          if (link) route = `/learn/path/${link.pathId}/video/${item.id}`;
        }
        if (!route) continue;
        const [row] = await db
          .insert(coachRecommendations)
          .values({ userId, itemType: "video", itemId: item.id, source })
          .returning({ id: coachRecommendations.id });
        const topicTitle = await topicTitleForId(item.topicId);
        out.push({
          recId: row?.id ?? 0,
          type: "video",
          id: item.id,
          title: item.title,
          topic: topicTitle,
          contentType: item.contentType ?? null,
          durationMins: item.duration ? Math.max(1, Math.round(item.duration / 60)) : null,
          difficulty: null,
          route,
        });
      } else {
        const [row] = await db
          .select({
            id: learningPaths.id,
            title: learningPaths.title,
            estimatedDuration: learningPaths.estimatedDuration,
            difficulty: learningPaths.difficulty,
            topicTitle: learnTopics.title,
          })
          .from(learningPaths)
          .leftJoin(learnTopics, eq(learningPaths.topicId, learnTopics.id))
          .where(eq(learningPaths.id, ref.id))
          .limit(1);
        if (!row) continue;
        const [rec] = await db
          .insert(coachRecommendations)
          .values({ userId, itemType: "path", itemId: row.id, source })
          .returning({ id: coachRecommendations.id });
        out.push({
          recId: rec?.id ?? 0,
          type: "path",
          id: row.id,
          title: row.title,
          topic: row.topicTitle ?? null,
          contentType: null,
          durationMins: row.estimatedDuration ?? null,
          difficulty: row.difficulty ?? null,
          route: `/education-lab/path/${row.id}`,
        });
      }
    } catch (e: any) {
      console.error("[coach-content] failed to resolve recommendation:", e?.message || e);
    }
  }

  return out;
}

async function topicTitleForId(topicId: number | null | undefined): Promise<string | null> {
  if (!topicId) return null;
  try {
    const [t] = await db
      .select({ title: learnTopics.title })
      .from(learnTopics)
      .where(eq(learnTopics.id, topicId))
      .limit(1);
    return t?.title ?? null;
  } catch {
    return null;
  }
}

/** Marks a shown recommendation as tapped. Returns false if not found/owned. */
export async function logRecommendationTap(userId: string, recId: number): Promise<boolean> {
  const result = await db
    .update(coachRecommendations)
    .set({ tappedAt: new Date() })
    .where(and(eq(coachRecommendations.id, recId), eq(coachRecommendations.userId, userId)))
    .returning({ id: coachRecommendations.id });
  return result.length > 0;
}
