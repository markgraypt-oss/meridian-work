import { z } from "zod";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { exerciseSwapJudgements } from "@workspace/db";
import { aiCall } from "../ai";
import type { MovementCheck, MovementResponse } from "../programmeSubstitution";

/**
 * Judgement on the substitution engine's shortlist.
 *
 * The engine picks candidates from tags and a difficulty ladder. That is
 * correct but blunt: it cannot tell that a member who said "pushing overhead
 * is painful" but "pulling towards me is fine" would be better served by the
 * landmine press than the seated dumbbell press, even though both cleared the
 * rules. This layer reads the assessment — area, side, severity, red flags,
 * how each movement felt — and the engine's list, then puts the list in the
 * order a coach would, drops anything a coach would not offer, and says why
 * the first choice is first.
 *
 * DELIBERATELY BOUNDED. It can only REORDER and REMOVE within the engine's
 * list. It cannot add an exercise, so nothing the hard rules excluded can ever
 * reach the screen. If it removes everything, the app's own fallbacks (rest,
 * fewer sets) apply. Any failure or timeout leaves the engine's order intact.
 *
 * COST. One call per assessment, for every flagged exercise at once. The
 * verdict is cached on (outcome, exercise, the answers, the candidate set), so
 * a member re-running the same assessment, or another member with the same
 * answers, pays nothing.
 */

const MAX_GROUPS_PER_CALL = 12;
const MAX_CANDIDATES = 8;

/** Reasoning over a shortlist wants a capable model, not the cheapest. Haiku
 *  is the sweet spot; an admin row for `swap_judge` still overrides. */
const DEFAULT_MODEL = { provider: 'anthropic', model: 'claude-haiku-4-5' };

async function modelOverride(): Promise<{ provider?: string; model?: string }> {
  try {
    const { storage } = await import('../storage');
    const settings = await storage.getAllAiCoachingSettings();
    if (settings.find((s: any) => s.feature === 'swap_judge' && s.isActive)) return {};
  } catch { /* fall through */ }
  return DEFAULT_MODEL;
}

export interface JudgeCandidate {
  id: number;
  name: string;
  movementPatterns: string[];
  equipment: string[];
  source: 'curated' | 'derived';
  /** The engine's factual line. */
  reason: string;
}

export interface JudgeGroup {
  exerciseId: number;
  exerciseName: string;
  tier: 'stop' | 'easier' | null | undefined;
  /** Why the engine flagged it, e.g. "Movement pattern: Vertical Push". */
  reason: string;
  original: {
    movement?: string[] | null;
    equipment?: string[] | null;
    mechanics?: string[] | null;
    primaryMuscle?: string | null;
    level?: string | null;
  } | null;
  candidates: JudgeCandidate[];
}

export interface JudgeAssessment {
  outcomeId: number;
  bodyPart: string | null;
  side: string | null;
  severity: number;
  redFlags: string[];
  responses: Record<string, MovementResponse>;
  checks: MovementCheck[];
}

export interface JudgeVerdict {
  /** Candidate ids, best first. Only ids from the engine's list. */
  order: number[];
  /** Candidates the judge would not offer, with a short reason each. */
  dropped: { id: number; why: string }[];
  /** Why the first choice is first, said to the member. */
  why: string | null;
}

const responseSchema = z.object({
  verdicts: z.array(z.object({
    exerciseId: z.number(),
    order: z.array(z.number()).max(MAX_CANDIDATES),
    dropped: z.array(z.object({ id: z.number(), why: z.string().max(160) })).max(MAX_CANDIDATES).default([]),
    why: z.string().max(200).nullable().default(null),
  })).max(MAX_GROUPS_PER_CALL),
});

function answersHash(a: JudgeAssessment): string {
  const responses = Object.keys(a.responses).sort().map(k => `${k}=${a.responses[k]}`).join(',');
  const flags = [...a.redFlags].sort().join(',');
  return createHash('sha1')
    .update(`${a.bodyPart ?? ''}|${a.side ?? ''}|${a.severity}|${flags}|${responses}`)
    .digest('hex');
}

function candidatesHash(g: JudgeGroup): string {
  return createHash('sha1').update(g.candidates.map(c => c.id).sort((x, y) => x - y).join(',')).digest('hex');
}

function describeAnswers(a: JudgeAssessment): string {
  const lines: string[] = [];
  lines.push(`Area: ${(a.bodyPart || 'unknown').replace(/_/g, ' ')}${a.side ? ` (${a.side === 'both' ? 'both sides' : a.side + ' side'})` : ''}`);
  lines.push(`Pain today: ${a.severity}/10`);
  if (a.redFlags.length) lines.push(`Red flags reported: ${a.redFlags.join(', ')}`);
  const answered = a.checks
    .filter(c => a.responses[c.key])
    .map(c => `- ${c.label}: ${a.responses[c.key]}`);
  if (answered.length) {
    lines.push('How each movement felt (fine / manageable / painful):');
    lines.push(...answered);
  } else {
    lines.push('No per-movement answers were given.');
  }
  return lines.join('\n');
}

/**
 * Returns a map exerciseId -> verdict. Missing keys mean "keep the engine's
 * order". Never throws.
 */
export async function judgeSwaps(groups: JudgeGroup[], assessment: JudgeAssessment): Promise<Map<number, JudgeVerdict>> {
  const out = new Map<number, JudgeVerdict>();
  // Nothing to judge for a group with 0 or 1 candidates.
  const judgeable = groups
    .filter(g => g.candidates.length > 1)
    .map(g => ({ ...g, candidates: g.candidates.slice(0, MAX_CANDIDATES) }));
  if (judgeable.length === 0) return out;

  const aHash = answersHash(assessment);

  // 1. Cache.
  const misses: JudgeGroup[] = [];
  for (const g of judgeable) {
    try {
      const [row] = await db
        .select()
        .from(exerciseSwapJudgements)
        .where(and(
          eq(exerciseSwapJudgements.outcomeId, assessment.outcomeId),
          eq(exerciseSwapJudgements.originalExerciseId, g.exerciseId),
          eq(exerciseSwapJudgements.answersHash, aHash),
          eq(exerciseSwapJudgements.candidatesHash, candidatesHash(g)),
        ))
        .limit(1);
      if (row && row.verdict) { out.set(g.exerciseId, row.verdict as JudgeVerdict); continue; }
    } catch (e: any) {
      console.error('[swap-judge] cache read failed:', e?.message || e);
    }
    misses.push(g);
  }
  if (misses.length === 0) return out;

  const batch = misses.slice(0, MAX_GROUPS_PER_CALL);

  const system = [
`You are the strength coach behind MeridianWork, reviewing exercise swaps for a member who has reported pain. A rules engine has already produced, for each flagged exercise, a shortlist of replacements that are safe by its rules. Your job is the judgement the rules cannot make: given how this member says each movement FEELS, which of the shortlist would you actually put first, and is there anything on it you would not offer at all.

You may only REORDER the shortlist and DROP items from it. You cannot add an exercise. Every id you return must come from the shortlist for that exercise.

HOW TO JUDGE:
- Read the member's answers. A movement they called "painful" should steer you away from replacements that load the same joint the same way, even if the tag is different. A movement they called "fine" is a safe direction to lean.
- Higher pain scores and any red flag mean be more conservative: prefer supported, lighter, shorter-range, lower-skill options first.
- Prefer a replacement that keeps the same muscle and purpose as the original (a row for a row), so the programme still does its job.
- For a STOPPED movement the shortlist is the coach's recovery work; order it from gentlest to most demanding for THIS member's answers.
- Drop something only when you would not offer it to this member today. Do not drop for style reasons. If everything is reasonable, drop nothing.
- Prefer common, easy-to-set-up exercises over exotic ones when they are otherwise equal.

THE "why" LINE: one sentence, under 140 characters, said to the member in plain British English, explaining why the first choice is first for THEM and their answers. No jargon, no diagnosis, no promises about healing. Example: "You said pushing overhead hurt but pressing forward was fine, so this keeps the arm below shoulder height."

Return JSON only:
{"verdicts":[{"exerciseId":number,"order":[number,...],"dropped":[{"id":number,"why":string}],"why":string|null}]}`,
  ];

  const prompt = `MEMBER'S ASSESSMENT
${describeAnswers(assessment)}

FLAGGED EXERCISES AND THEIR SHORTLISTS
${batch.map((g, i) => {
    const o = g.original;
    const oDesc = o ? [
      o.movement?.length ? `patterns: ${o.movement.join(', ')}` : null,
      o.equipment?.length ? `kit: ${o.equipment.join(', ')}` : null,
      o.primaryMuscle ? `for: ${o.primaryMuscle}` : null,
      o.level ? `level: ${o.level}` : null,
    ].filter(Boolean).join('; ') : '';
    return `${i + 1}. exerciseId ${g.exerciseId} — ${g.exerciseName} [${g.tier === 'stop' ? 'STOPPED' : 'GO EASIER'}]${oDesc ? `\n   ${oDesc}` : ''}
   Flagged because: ${g.reason}
   Shortlist (engine order):
${g.candidates.map(c => `     id ${c.id}: ${c.name} — ${c.movementPatterns.join(', ') || 'no pattern'}; ${c.equipment.join(', ') || 'bodyweight'}${c.source === 'curated' ? '; coach-curated recovery work' : ''}. ${c.reason}`).join('\n')}`;
  }).join('\n\n')}`;

  try {
    const result = await aiCall({
      feature: 'swap_judge',
      system,
      prompt,
      schema: responseSchema,
      maxTokens: 160 * batch.length + 200,
      temperature: 0.2,
      timeoutMs: 15_000,
      ...(await modelOverride()),
    });

    const verdicts = result.data?.verdicts || [];
    const toPersist: any[] = [];
    for (const v of verdicts) {
      const g = batch.find(x => x.exerciseId === v.exerciseId);
      if (!g) continue;
      const allowed = new Set(g.candidates.map(c => c.id));
      const dropped = (v.dropped || []).filter(d => allowed.has(d.id)).map(d => ({ id: d.id, why: d.why.trim().slice(0, 160) }));
      const droppedIds = new Set(dropped.map(d => d.id));
      // Only ids we sent, no duplicates, nothing that was dropped.
      const order: number[] = [];
      for (const id of v.order) if (allowed.has(id) && !droppedIds.has(id) && !order.includes(id)) order.push(id);
      // Anything the model forgot to mention keeps its engine position at the end.
      for (const c of g.candidates) if (!order.includes(c.id) && !droppedIds.has(c.id)) order.push(c.id);
      const verdict: JudgeVerdict = { order, dropped, why: v.why ? v.why.trim().slice(0, 200) : null };
      out.set(g.exerciseId, verdict);
      toPersist.push({
        outcomeId: assessment.outcomeId,
        originalExerciseId: g.exerciseId,
        answersHash: aHash,
        candidatesHash: candidatesHash(g),
        verdict,
      });
    }
    if (toPersist.length) {
      await db.insert(exerciseSwapJudgements).values(toPersist)
        .onConflictDoNothing()
        .catch((e: any) => console.error('[swap-judge] cache write failed:', e?.message || e));
    }
    console.log(`[swap-judge] ${judgeable.length} groups: ${judgeable.length - misses.length} cached, ${toPersist.length} judged, ${misses.length - toPersist.length} fell back`);
  } catch (e: any) {
    console.error('[swap-judge] failed, engine order kept:', e?.message || e);
  }
  return out;
}
