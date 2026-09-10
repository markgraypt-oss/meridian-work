import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { exerciseSwapLines } from "@workspace/db";
import { aiCall } from "../ai";
import { COACH_VOICE } from "./coachPersona";

/**
 * Coach voice for exercise swaps.
 *
 * The substitution engine writes a true and useful reason: "Same movement, works
 * your chest - dumbbell instead of barbell." Accurate, and it reads like a
 * database explaining itself. This turns that into the sentence Mark would say.
 *
 * DELIBERATELY NARROW. This layer cannot choose, rank, add or remove a
 * substitute. It receives pairs the deterministic engine has already cleared and
 * returns text. Anything it hands back for a pair that was not asked for is
 * discarded, and any failure falls straight back to the engine's own line. The
 * hard safety filters stay where they are; nothing here can put an exercise in
 * front of a sore shoulder.
 *
 * COST. The line depends only on (outcome, original exercise, substitute), never
 * on the user, so the cache is shared across everyone. The library is finite:
 * each swap is written once, ever, and every later assessment reads it for free.
 * A user whose flagged exercises have all been seen before costs nothing at all.
 */

const MAX_PAIRS_PER_CALL = 12;

/**
 * Rewriting one sentence does not need a frontier model, and the wrapper's
 * default is claude-sonnet-4-5 — which would be the most expensive way possible
 * to do the cheapest job in the app.
 *
 * Only used when no `swap_voice` row exists in ai_coaching_settings, so
 * configuring it in the admin still wins.
 */
const CHEAP_DEFAULT = { provider: 'openai', model: 'gpt-4.1-nano' };

async function modelOverride(): Promise<{ provider?: string; model?: string }> {
  try {
    const { storage } = await import('../storage');
    const settings = await storage.getAllAiCoachingSettings();
    const configured = settings.find((s: any) => s.feature === 'swap_voice' && s.isActive);
    if (configured) return {}; // let the wrapper resolve it from the admin setting
  } catch { /* fall through to the cheap default */ }
  return CHEAP_DEFAULT;
}

export interface SwapPair {
  outcomeId: number;
  originalExerciseId: number;
  originalName: string;
  substituteExerciseId: number;
  substituteName: string;
  /** The engine's factual line. The fallback, and the source of truth for facts. */
  factualReason: string;
  /** Why the original was flagged, e.g. "Movement pattern: Horizontal Push + Equipment: Barbell". */
  flagReason: string;
  bodyArea?: string | null;
}

const responseSchema = z.object({
  lines: z.array(z.object({
    originalExerciseId: z.number(),
    substituteExerciseId: z.number(),
    line: z.string().min(1).max(200),
  })).max(MAX_PAIRS_PER_CALL),
});

const keyOf = (p: { outcomeId: number; originalExerciseId: number; substituteExerciseId: number }) =>
  `${p.outcomeId}:${p.originalExerciseId}:${p.substituteExerciseId}`;

/**
 * Returns a map of pair-key -> coach line. Missing keys simply mean "use the
 * engine's line"; the caller never has to handle an error from here.
 */
export async function getSwapLines(pairs: SwapPair[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (pairs.length === 0) return out;

  // Dedupe: the same swap can appear for several flagged instances.
  const byKey = new Map<string, SwapPair>();
  for (const p of pairs) if (!byKey.has(keyOf(p))) byKey.set(keyOf(p), p);
  const unique = Array.from(byKey.values());

  // 1. Cache.
  try {
    const rows = await db
      .select()
      .from(exerciseSwapLines)
      .where(and(
        inArray(exerciseSwapLines.outcomeId, Array.from(new Set(unique.map(p => p.outcomeId)))),
        inArray(exerciseSwapLines.originalExerciseId, Array.from(new Set(unique.map(p => p.originalExerciseId)))),
        inArray(exerciseSwapLines.substituteExerciseId, Array.from(new Set(unique.map(p => p.substituteExerciseId)))),
      ));
    for (const r of rows) {
      const k = keyOf({
        outcomeId: r.outcomeId,
        originalExerciseId: r.originalExerciseId,
        substituteExerciseId: r.substituteExerciseId,
      });
      if (byKey.has(k)) out.set(k, r.line);
    }
  } catch (e: any) {
    // A cache read failing is not a reason to fail the screen.
    console.error("[swap-voice] cache read failed:", e?.message || e);
  }

  const misses = unique.filter(p => !out.has(keyOf(p)));
  if (misses.length === 0) return out;

  // 2. One call for everything still missing. Capped, because a user with a
  //    dozen unseen swaps is already an outlier and the rest fall back cleanly.
  const batch = misses.slice(0, MAX_PAIRS_PER_CALL);

  const prompt = `${COACH_VOICE}

A member has reported pain${batch[0].bodyArea ? ` in their ${batch[0].bodyArea}` : ''}, and their programme has swapped some exercises so they can keep training around it. Write the one line that appears under each swap explaining why it is a sensible replacement.

FOR EACH SWAP BELOW, rewrite the factual reason in your voice.

RULES:
- ONE sentence. Maximum 120 characters. It sits under a small card on a phone.
- Say it to them, not about them. "You still get the same press, your shoulder just isn't pinned to the bar."
- Keep every FACT from the factual reason. Do not invent a benefit, a muscle, a timescale or a claim about healing.
- Never promise the pain will go, never diagnose, never mention injury recovery times.
- No jargon. Nothing "asks for" anything, nothing is "suppressed", no "movement patterns" or "modalities" as words on screen.
- Plain, warm, direct. Like you are stood next to them.

SWAPS:
${batch.map((p, i) => `${i + 1}. id ${p.originalExerciseId} -> ${p.substituteExerciseId}
   Replacing: ${p.originalName}
   With: ${p.substituteName}
   Flagged because: ${p.flagReason}
   Factual reason: ${p.factualReason}`).join('\n')}

Return JSON only:
{"lines":[{"originalExerciseId":number,"substituteExerciseId":number,"line":string}]}`;

  try {
    const result = await aiCall({
      feature: "swap_voice",
      prompt,
      schema: responseSchema,
      maxTokens: 60 * batch.length + 120,
      temperature: 0.6,
      timeoutMs: 12_000,
      ...(await modelOverride()),
    });

    const lines = result.data?.lines || [];
    const toPersist: { outcomeId: number; originalExerciseId: number; substituteExerciseId: number; line: string }[] = [];

    for (const l of lines) {
      // Only accept pairs we actually asked about. A model returning an id we
      // never sent is discarded rather than trusted.
      const match = batch.find(p =>
        p.originalExerciseId === l.originalExerciseId &&
        p.substituteExerciseId === l.substituteExerciseId);
      if (!match) continue;

      const line = l.line.trim();
      if (!line || line.length > 200) continue;

      out.set(keyOf(match), line);
      toPersist.push({
        outcomeId: match.outcomeId,
        originalExerciseId: match.originalExerciseId,
        substituteExerciseId: match.substituteExerciseId,
        line,
      });
    }

    if (toPersist.length) {
      await db.insert(exerciseSwapLines).values(toPersist)
        .onConflictDoNothing()
        .catch((e: any) => console.error("[swap-voice] cache write failed:", e?.message || e));
    }

    console.log(
      `[swap-voice] ${unique.length} pairs: ${unique.length - misses.length} cached, ` +
      `${toPersist.length} written, ${misses.length - toPersist.length} fell back`,
    );
  } catch (e: any) {
    // Silent by design. The caller already has a correct line for every pair.
    console.error("[swap-voice] generation failed, using factual lines:", e?.message || e);
  }

  return out;
}

export const swapLineKey = keyOf;
