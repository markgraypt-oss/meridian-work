/**
 * Body-map programme substitution: what to flag, and what to offer instead.
 *
 * THE COACHING INTENT this implements, in one line: keep training, work around
 * the sore thing rather than stopping. Anterior shoulder pain at 6/10 should
 * take the barbell bench press out and put a dumbbell chest press in — the same
 * movement, the same muscles, without the part that hurts. Strengthen through
 * pain, within reason.
 *
 * That single sentence dictates the whole design:
 *
 *   - The outcome's flagging rules say what to AVOID.
 *   - The exercise being replaced says what to PRESERVE.
 *
 * A substitute is therefore not "any exercise from a list". It is the closest
 * thing to what the athlete was already doing that does not trip the same rules.
 *
 * This module exists because the two endpoints that needed this logic had each
 * grown their own copy, and the copies disagreed:
 *
 *   - /preview read patterns, equipment and level, and required ALL configured
 *     categories to match (AND).
 *   - /accept read patterns, muscles, equipment, level and mechanics, and
 *     flagged on the FIRST category that matched (OR).
 *
 * So a rule meaning "barbell horizontal pushes" was read by accept as "every
 * horizontal push, and separately every barbell exercise" — which would flag the
 * dumbbell press we wanted to substitute IN. AND is the semantics that makes the
 * coaching example above expressible at all, so AND is what this module uses.
 */

export interface ExerciseLike {
  id: number;
  name: string;
  imageUrl?: string | null;
  muxPlaybackId?: string | null;
  /** The one muscle the exercise is FOR. Far stronger evidence than mainMuscle,
   *  which lists everything involved — a bench press carries Triceps and
   *  Shoulders too, and matching on those offers a pushdown as a substitute. */
  primaryMuscle?: string | null;
  mainMuscle?: string[] | null;
  equipment?: string[] | null;
  movement?: string[] | null;
  mechanics?: string[] | null;
  level?: string | null;
  exerciseType?: string | null;
  laterality?: string | null;
}

export interface FlaggingRules {
  movementPatterns: string[];
  muscles: string[];
  equipment: string[];
  levels: string[];
  mechanics: string[];
}

/** What the coach configured on the outcome's substitution pool. */
export interface SubstitutionPool {
  /** Movement patterns that are acceptable replacements. Used when the flag is
   *  ON the movement pattern, so "same pattern" is not an option. */
  allowedPatterns: string[];
  /** Hand-picked substitutes, in coach priority order. Always ranked first. */
  substituteExerciseIds: number[];
  coachingNote?: string;
}

export interface FlagMatch {
  flagged: boolean;
  /** Human-readable, e.g. "Movement pattern: Horizontal Push + Equipment: Barbell". */
  reason: string;
  /** Which category drove it, kept for the existing reasonType field. */
  reasonType: 'movement_pattern' | 'muscle' | 'equipment' | 'level' | 'mechanics';
  matched: {
    movementPattern: string | null;
    muscle: string | null;
    equipment: string | null;
    level: string | null;
    mechanics: string | null;
  };
}

export function rulesFromOutcome(outcome: any): FlaggingRules {
  return {
    movementPatterns: outcome?.flaggingMovementPatterns || [],
    muscles: outcome?.flaggingMuscles || [],
    equipment: outcome?.flaggingEquipment || [],
    levels: outcome?.flaggingLevel || [],
    mechanics: outcome?.flaggingMechanics || [],
  };
}

export function poolFromOutcome(outcome: any): SubstitutionPool {
  const raw = outcome?.substitutionRules as any;
  const pool = Array.isArray(raw) ? raw[0] : raw;
  return {
    allowedPatterns: pool?.allowedPatterns || [],
    substituteExerciseIds: pool?.substituteExerciseIds || [],
    coachingNote: pool?.coachingNote || undefined,
  };
}

export function hasAnyCriteria(rules: FlaggingRules): boolean {
  return rules.movementPatterns.length > 0
    || rules.muscles.length > 0
    || rules.equipment.length > 0
    || rules.levels.length > 0
    || rules.mechanics.length > 0;
}

/**
 * Does this exercise trip the outcome's rules?
 *
 * AND across configured categories, ANY within a category, and a category with
 * nothing configured imposes no constraint. So:
 *
 *   patterns:[Horizontal Push] + equipment:[Barbell]  ->  barbell bench: FLAGGED
 *                                                          dumbbell press: not flagged
 *   patterns:[Vertical Push]                          ->  every overhead press, any kit
 *
 * That second form is how a coach says "no overhead work at all this week", and
 * it still works: one category configured means only that category must match.
 */
export function evaluateFlag(exercise: ExerciseLike, rules: FlaggingRules): FlagMatch {
  const none: FlagMatch = {
    flagged: false,
    reason: '',
    reasonType: 'movement_pattern',
    matched: { movementPattern: null, muscle: null, equipment: null, level: null, mechanics: null },
  };
  if (!hasAnyCriteria(rules)) return none;

  const firstOverlap = (values: string[] | null | undefined, wanted: string[]): string | null | undefined => {
    // undefined = this category is not configured, so it does not constrain.
    if (wanted.length === 0) return undefined;
    if (!values || values.length === 0) return null;
    return values.find((v) => wanted.includes(v)) ?? null;
  };

  const movementPattern = firstOverlap(exercise.movement, rules.movementPatterns);
  if (movementPattern === null) return none;

  const muscle = firstOverlap(exercise.mainMuscle, rules.muscles);
  if (muscle === null) return none;

  const equipment = firstOverlap(exercise.equipment, rules.equipment);
  if (equipment === null) return none;

  const mechanics = firstOverlap(exercise.mechanics, rules.mechanics);
  if (mechanics === null) return none;

  let level: string | null | undefined = undefined;
  if (rules.levels.length > 0) {
    if (!exercise.level || !rules.levels.includes(exercise.level)) return none;
    level = exercise.level;
  }

  const parts: string[] = [];
  if (movementPattern) parts.push(`Movement pattern: ${movementPattern}`);
  if (muscle) parts.push(`Muscle: ${muscle}`);
  if (equipment) parts.push(`Equipment: ${equipment}`);
  if (mechanics) parts.push(`Mechanics: ${mechanics}`);
  if (level) parts.push(`Difficulty level: ${level}`);

  const reasonType: FlagMatch['reasonType'] =
    movementPattern ? 'movement_pattern'
    : muscle ? 'muscle'
    : equipment ? 'equipment'
    : mechanics ? 'mechanics'
    : 'level';

  return {
    flagged: true,
    reason: parts.join(' + '),
    reasonType,
    matched: {
      movementPattern: movementPattern ?? null,
      muscle: muscle ?? null,
      equipment: equipment ?? null,
      level: level ?? null,
      mechanics: mechanics ?? null,
    },
  };
}

export interface SubstituteCandidate {
  id: number;
  name: string;
  imageUrl: string | null;
  movementPatterns: string[];
  equipment: string[];
  /** 'curated' = hand-picked by the coach for this outcome. 'derived' = matched. */
  source: 'curated' | 'derived';
  /** One short line saying why this is a sensible swap. */
  reason: string;
  score: number;
}

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

/**
 * A level a substitute may never be offered at.
 *
 * This engine only ever runs because someone has reported pain, so the question
 * "is an advanced exercise appropriate here?" already has an answer: no. It is a
 * HARD filter, not a scoring penalty, and it does not wait for an outcome to
 * configure flaggingLevel — an admin forgetting to tick a box is not a reason to
 * hand a sore shoulder a barbell exercise rated advanced.
 *
 * Deliberately not blocked: a candidate merely HARDER than the original but
 * still under advanced. That is a scoring penalty below instead, because
 * blocking it would empty the list whenever the athlete was already working at
 * beginner level, and an intermediate machine press is a safer object than
 * nothing at all.
 */
const NEVER_OFFER_LEVEL = 'advanced';

function levelDistance(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ia = LEVEL_ORDER.indexOf(String(a).toLowerCase());
  const ib = LEVEL_ORDER.indexOf(String(b).toLowerCase());
  if (ia === -1 || ib === -1) return null;
  return Math.abs(ia - ib);
}

function overlap(a?: string[] | null, b?: string[] | null): string[] {
  if (!a || !b) return [];
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function thumb(e: ExerciseLike): string | null {
  return e.imageUrl
    || (e.muxPlaybackId ? `https://image.mux.com/${e.muxPlaybackId}/thumbnail.png?width=200` : null);
}

/**
 * Say, in one line, why this swap makes sense — built from what actually stayed
 * the same and what changed, never from a template. "Same movement, dumbbells
 * instead of barbell" tells an athlete something. "Suggested alternative" does not.
 */
function describeSubstitute(original: ExerciseLike, candidate: ExerciseLike, flag: FlagMatch): string {
  const keptPatterns = overlap(original.movement, candidate.movement);
  const keptMuscles = overlap(original.mainMuscle, candidate.mainMuscle);

  const kept: string[] = [];
  if (keptPatterns.length > 0) kept.push('the same movement');
  // Name the primary when both agree on it — "works your chest" is worth more
  // than "works the same muscles", and it is the actual reason this is a swap.
  if (original.primaryMuscle && candidate.primaryMuscle === original.primaryMuscle) {
    kept.push(`works your ${String(original.primaryMuscle).toLowerCase()}`);
  } else if (keptMuscles.length > 0) {
    kept.push(keptMuscles.length === 1 ? `works your ${keptMuscles[0].toLowerCase()}` : 'works the same muscles');
  }

  const changed: string[] = [];
  if (flag.matched.equipment) {
    const newKit = (candidate.equipment || []).filter((e) => e !== flag.matched.equipment);
    changed.push(newKit.length ? `${newKit[0].toLowerCase()} instead of ${flag.matched.equipment.toLowerCase()}` : `without the ${flag.matched.equipment.toLowerCase()}`);
  }
  if (flag.matched.level && candidate.level && candidate.level !== flag.matched.level) {
    changed.push(`${String(candidate.level).toLowerCase()} rather than ${String(flag.matched.level).toLowerCase()}`);
  }
  if (flag.matched.movementPattern && keptPatterns.length === 0) {
    changed.push(`avoids ${flag.matched.movementPattern.toLowerCase()}`);
  }
  if (flag.matched.mechanics && changed.length === 0) {
    changed.push(`not ${String(flag.matched.mechanics).toLowerCase()}`);
  }

  if (kept.length && changed.length) {
    const keptText = kept[0] === 'the same movement' && kept[1] ? `Same movement, ${kept[1]}` : `Keeps ${kept.join(' and ')}`;
    return `${keptText} — ${changed.join(', ')}.`;
  }
  if (kept.length) return `Keeps ${kept.join(' and ')}.`;
  if (changed.length) return `A safer option — ${changed.join(', ')}.`;
  return 'A suitable alternative for this area.';
}

/**
 * Rank replacements for one flagged exercise.
 *
 * Hard filters first (a candidate that would itself be flagged is not a
 * substitute, it is the same problem with a different name), then score by how
 * much of the original stimulus survives.
 *
 * The coach's curated list always sits on top, in the order they wrote it — the
 * scoring exists to make the feature work when nobody has curated anything,
 * which today is the normal case.
 */
export function rankSubstitutes(opts: {
  original: ExerciseLike;
  rules: FlaggingRules;
  pool: SubstitutionPool;
  allExercises: ExerciseLike[];
  limit?: number;
}): SubstituteCandidate[] {
  const { original, rules, pool, allExercises } = opts;
  const limit = opts.limit ?? 6;

  const originalFlag = evaluateFlag(original, rules);
  const curatedOrder = new Map<number, number>();
  pool.substituteExerciseIds.forEach((id, i) => curatedOrder.set(id, i));

  const scored: SubstituteCandidate[] = [];

  for (const candidate of allExercises) {
    if (candidate.id === original.id) continue;

    // A substitute must not trip the same rules. This is the one filter that
    // cannot be traded away: without it the engine happily offers the barbell
    // incline press to someone who cannot press a barbell.
    if (evaluateFlag(candidate, rules).flagged) continue;

    // Never offer an advanced exercise to someone who has just reported pain,
    // whatever the outcome's rules say and whatever the original was. An
    // exercise with no level recorded is allowed through rather than blocked —
    // a gap in the library's tagging should not silently empty the list — but it
    // is scored below anything properly tagged.
    const candidateLevel = candidate.level ? String(candidate.level).toLowerCase() : null;
    if (candidateLevel === NEVER_OFFER_LEVEL) continue;

    const isCurated = curatedOrder.has(candidate.id);
    let score = 0;

    if (isCurated) {
      // Coach order is law. Big constant, minus position, so the curated list
      // keeps its exact sequence above everything derived.
      score += 10_000 - (curatedOrder.get(candidate.id) as number);
    }

    const sharedMuscles = overlap(original.mainMuscle, candidate.mainMuscle);
    const sharedPatterns = overlap(original.movement, candidate.movement);

    // Primary muscle is the strongest signal there is, and it is the one that
    // stops nonsense. Bench press lists Chest, Triceps and Shoulders in
    // mainMuscle, so scoring on that overlap alone put a tricep pushdown and a
    // lateral raise on the shortlist — both share exactly one ASSISTANCE muscle
    // with the bench and neither is remotely a substitute for it.
    const oPrimary = original.primaryMuscle || null;
    const cPrimary = candidate.primaryMuscle || null;
    const bothTagged = !!oPrimary && !!cPrimary;
    const samePrimary = bothTagged && oPrimary === cPrimary;
    // The candidate's primary is only an assisting muscle of the original (or
    // vice versa). Related, but not the same job.
    const assistOnly = bothTagged && !samePrimary && (
      (original.mainMuscle || []).includes(cPrimary as string) ||
      (candidate.mainMuscle || []).includes(oPrimary as string)
    );

    // When the movement pattern ITSELF is what hurts, "same pattern, same
    // muscle" is not available by definition — every close relative of the
    // original is flagged too. This is precisely the case allowedPatterns
    // exists for: the coach naming what to train instead.
    const patternIsFlagged = !!originalFlag.matched.movementPattern;
    const coachAllowed = patternIsFlagged
      && pool.allowedPatterns.length > 0
      && overlap(candidate.movement, pool.allowedPatterns).length > 0;

    // Preserving the training stimulus is the point, so muscle and pattern
    // dominate the score.
    if (bothTagged) {
      if (samePrimary) score += 80;
      else if (assistOnly) score += 10;   // related, but a different job
      else if (!coachAllowed) score -= 60; // trains something else entirely
      // A shared assisting muscle is worth a nudge and nothing more.
      if (!samePrimary && sharedMuscles.length > 0) score += 5;
    } else {
      // One side is untagged. Fall back to the old mainMuscle overlap so the
      // engine still works while the library is being tagged, but score it below
      // a real primary match so a tagged candidate always wins.
      if (sharedMuscles.length > 0) score += 40 + Math.min(sharedMuscles.length - 1, 3) * 8;
      else if (!coachAllowed) score -= 60;
    }

    if (sharedPatterns.length > 0) score += 35;
    else if (coachAllowed) score += 30;

    if (overlap(original.mechanics, candidate.mechanics).length > 0) score += 12;
    if (original.exerciseType && candidate.exerciseType === original.exerciseType) score += 8;
    if (original.laterality && candidate.laterality === original.laterality) score += 3;

    // Level. Same as the original is ideal; easier is fine; harder while sore is
    // a step in the wrong direction, so it costs.
    const oi = original.level ? LEVEL_ORDER.indexOf(String(original.level).toLowerCase()) : -1;
    const ci = candidateLevel ? LEVEL_ORDER.indexOf(candidateLevel) : -1;
    if (oi !== -1 && ci !== -1) {
      if (ci === oi) score += 8;
      else if (ci < oi) score += 5;   // easier: appropriate while managing pain
      else score -= 12;               // harder than what they were already doing
    } else if (ci === -1) {
      score -= 4;                     // untagged: usable, but not preferred
    }

    // Is this a substitute at all, or just another exercise in the library?
    //
    // With both sides tagged the test is strict: it has to train the same thing
    // (same primary) or be the same movement. Sharing an assisting muscle is not
    // enough — that is exactly how a tricep pushdown got onto a bench press
    // shortlist. Untagged exercises fall back to the looser mainMuscle test so
    // the engine keeps working while the library is being tagged.
    //
    // `coachAllowed` has to be in this test, not only in the scoring. Without it
    // the guard threw away every candidate on the allowedPatterns path — the one
    // route that cannot share a muscle or a pattern with the original — so an
    // outcome that banned a whole movement offered nothing at all.
    const relevant = bothTagged
      ? (samePrimary || sharedPatterns.length > 0)
      : (sharedMuscles.length > 0 || sharedPatterns.length > 0);
    if (!isCurated && !coachAllowed && !relevant) continue;

    scored.push({
      id: candidate.id,
      name: candidate.name,
      imageUrl: thumb(candidate),
      movementPatterns: candidate.movement || [],
      equipment: candidate.equipment || [],
      source: isCurated ? 'curated' : 'derived',
      reason: describeSubstitute(original, candidate, originalFlag),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}
