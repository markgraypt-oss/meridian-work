/**
 * Body-map programme substitution: what to flag, and what to offer instead.
 *
 * THE COACHING INTENT, in one line: keep people training, safely, out of pain.
 *
 * An assessment produces two lists of movement patterns for the sore area:
 *
 *   STOP       — nothing in this pattern this week. The slot is filled with a
 *                recovery exercise the coach picked for the area, or rested.
 *   GO EASIER  — same movement, same side, same muscle, one step easier.
 *                If the library has no easier version, the exercise is
 *                reduced (fewer sets/reps) rather than swapped for something
 *                that is not really the same exercise.
 *
 * A substitute is therefore never "any exercise from a list". For GO EASIER it
 * is the closest thing to what the athlete was already doing, one notch down.
 * For STOP it is only ever the coach's own recovery work. There is no third
 * source: "allowed patterns" (train legs instead of pressing) is gone, because
 * a programme already has leg work and nobody with a sore shoulder needs a
 * fourth squat variation in place of their bench press.
 */

export interface ExerciseLike {
  id: number;
  name: string;
  imageUrl?: string | null;
  muxPlaybackId?: string | null;
  /** The one muscle the exercise is FOR. */
  primaryMuscle?: string | null;
  mainMuscle?: string[] | null;
  equipment?: string[] | null;
  movement?: string[] | null;
  mechanics?: string[] | null;
  level?: string | null;
  exerciseType?: string | null;
  laterality?: string | null;
}

export type FlagTier = 'stop' | 'easier';

export interface FlaggingRules {
  /** STOP: no version of these patterns may be offered. */
  movementPatterns: string[];
  /** GO EASIER: keep the pattern, offer a gentler version. */
  cautionPatterns: string[];
  /** Legacy AND-refinements on the STOP rule (outcome-level config). */
  muscles: string[];
  equipment: string[];
  levels: string[];
  mechanics: string[];
}

/** What the coach configured on the outcome. */
export interface SubstitutionPool {
  /** Kept for old rows; no longer used to derive swaps. */
  allowedPatterns: string[];
  /** Recovery exercises for the area, in coach priority order. Fill STOP slots. */
  substituteExerciseIds: number[];
  coachingNote?: string;
}

export interface FlagMatch {
  flagged: boolean;
  tier: FlagTier | null;
  /** Human-readable, e.g. "Stop: Horizontal Push" / "Go easier: Horizontal Pull". */
  reason: string;
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
    cautionPatterns: outcome?.cautionMovementPatterns || [],
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
    || rules.cautionPatterns.length > 0
    || rules.muscles.length > 0
    || rules.equipment.length > 0
    || rules.levels.length > 0
    || rules.mechanics.length > 0;
}

// ── Library tag hygiene ──────────────────────────────────────────────────────

/**
 * `movement` is not a list of movement patterns. It is a mixed bag: seven in
 * ten exercises carry "Bilateral"/"Unilateral" there, which say how many limbs
 * are involved, not what the movement IS.
 */
const LATERALITY_TAGS = new Set([
  'Bilateral (2 Arms and/or 2 Legs)',
  'Unilateral (Single Arm or Leg)',
  'Alternating',
  'Contralateral (Opposite Side Arm & Leg)',
  'Ipsilateral (Same Side Arm & Leg)',
]);

/** Work that is not training and can never replace training. */
const NON_TRAINING_PATTERNS = new Set(['Mobility', 'Static Stretches', 'Dynamic Stretches']);

export function realPatterns(e: ExerciseLike): string[] {
  return (e.movement || []).filter((m) => m && !LATERALITY_TAGS.has(m));
}

function isNonTraining(e: ExerciseLike): boolean {
  const real = realPatterns(e);
  return real.length > 0 && real.every((m) => NON_TRAINING_PATTERNS.has(m));
}

/** Single-arm/leg or both — read from the column, falling back to the tags. */
function lateralityOf(e: ExerciseLike): 'unilateral' | 'bilateral' | null {
  const col = e.laterality ? String(e.laterality).toLowerCase() : '';
  if (col === 'unilateral' || col === 'bilateral') return col;
  const tags = e.movement || [];
  if (tags.some((t) => /^Unilateral|^Alternating|^Contralateral|^Ipsilateral/.test(t))) return 'unilateral';
  if (tags.some((t) => /^Bilateral/.test(t))) return 'bilateral';
  return null;
}

// ── Difficulty ladder ────────────────────────────────────────────────────────

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];
const NEVER_OFFER_LEVEL = 'advanced';

function levelIndex(e: ExerciseLike): number | null {
  if (!e.level) return null;
  const i = LEVEL_ORDER.indexOf(String(e.level).toLowerCase());
  return i === -1 ? null : i;
}

/**
 * How demanding the kit is. Barbell is the most demanding thing to hold with a
 * sore joint (fixed path, two hands locked together); bands and bodyweight the
 * least. Accessories (bench, box, ball) say nothing about load and are ignored.
 */
const KIT_RANK: Record<string, number> = {
  'Barbell': 5, 'EZ Bar': 5, 'Landmine': 5,
  'Dumbbell': 4, 'Kettlebell': 4, 'Plate': 4, 'Medicine Ball': 4,
  'Cable': 3, 'Cable Machine': 3, 'Machine': 3, 'TRX': 3,
  'Long Band': 2, 'Short Band': 2, 'Band': 2,
  'Bodyweight': 1,
};

/**
 * Pulling your own bodyweight (chin-up, pull-up, inverted row) is the HARDEST
 * version of a pull, not the easiest, so bodyweight ranks with the barbell
 * for those patterns. For a push, a squat or a lunge it stays the easiest.
 */
const BODYWEIGHT_IS_HEAVY = new Set(['Vertical Pull', 'Horizontal Pull']);

function kitRank(e: ExerciseLike): number | null {
  const heavyBodyweight = realPatterns(e).some((p) => BODYWEIGHT_IS_HEAVY.has(p));
  const ranks = (e.equipment || [])
    .map((k) => (k === 'Bodyweight' && heavyBodyweight ? 5 : KIT_RANK[k]))
    .filter((r): r is number => r != null);
  return ranks.length ? Math.max(...ranks) : null;
}

/** Chest-supported, seated, kneeling: the body is braced, the sore joint has less to stabilise. */
function isSupported(e: ExerciseLike): boolean {
  if ((e.equipment || []).includes('Bench')) return true;
  return /\b(chest[- ]supported|supported|seated|half[- ]kneeling|kneeling|tall[- ]kneeling|incline|lying|prone|floor)\b/i.test(e.name);
}

/**
 * One number, higher = harder. Level dominates, then kit, then support.
 * Unknown level is treated as intermediate so an untagged exercise is neither
 * an automatic "easier" nor automatically excluded.
 */
function difficulty(e: ExerciseLike): number {
  const lvl = levelIndex(e) ?? 1;
  const kit = kitRank(e) ?? 3;
  return lvl * 100 + kit * 10 - (isSupported(e) ? 5 : 0);
}

// ── Flagging ─────────────────────────────────────────────────────────────────

function overlap(a?: string[] | null, b?: string[] | null): string[] {
  if (!a || !b) return [];
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

const NONE: FlagMatch = {
  flagged: false,
  tier: null,
  reason: '',
  reasonType: 'movement_pattern',
  matched: { movementPattern: null, muscle: null, equipment: null, level: null, mechanics: null },
};

/**
 * Does this exercise trip the rules, and at which tier?
 *
 * STOP is checked first: AND across the configured categories, ANY within a
 * category, unconfigured categories impose nothing. Then GO EASIER: a shared
 * real pattern is enough.
 */
export function evaluateFlag(exercise: ExerciseLike, rules: FlaggingRules): FlagMatch {
  if (!hasAnyCriteria(rules)) return NONE;

  const firstOverlap = (values: string[] | null | undefined, wanted: string[]): string | null | undefined => {
    if (wanted.length === 0) return undefined;   // not configured: no constraint
    if (!values || values.length === 0) return null;
    return values.find((v) => wanted.includes(v)) ?? null;
  };

  const stopConfigured = rules.movementPatterns.length > 0 || rules.muscles.length > 0
    || rules.equipment.length > 0 || rules.mechanics.length > 0 || rules.levels.length > 0;

  if (stopConfigured) {
    const movementPattern = firstOverlap(realPatterns(exercise), rules.movementPatterns);
    const muscle = movementPattern === null ? null : firstOverlap(exercise.mainMuscle, rules.muscles);
    const equipment = muscle === null ? null : firstOverlap(exercise.equipment, rules.equipment);
    const mechanics = equipment === null ? null : firstOverlap(exercise.mechanics, rules.mechanics);
    let level: string | null | undefined = undefined;
    let ok = movementPattern !== null && muscle !== null && equipment !== null && mechanics !== null;
    if (ok && rules.levels.length > 0) {
      if (!exercise.level || !rules.levels.includes(exercise.level)) ok = false;
      else level = exercise.level;
    }
    if (ok) {
      const parts: string[] = [];
      if (movementPattern) parts.push(movementPattern);
      if (muscle) parts.push(`muscle: ${muscle}`);
      if (equipment) parts.push(`equipment: ${equipment}`);
      if (mechanics) parts.push(`mechanics: ${mechanics}`);
      if (level) parts.push(`level: ${level}`);
      return {
        flagged: true,
        tier: 'stop',
        reason: `Stop: ${parts.join(' + ')}`,
        reasonType: movementPattern ? 'movement_pattern' : muscle ? 'muscle' : equipment ? 'equipment' : mechanics ? 'mechanics' : 'level',
        matched: {
          movementPattern: movementPattern ?? null,
          muscle: muscle ?? null,
          equipment: equipment ?? null,
          level: level ?? null,
          mechanics: mechanics ?? null,
        },
      };
    }
  }

  if (rules.cautionPatterns.length > 0) {
    const hit = realPatterns(exercise).find((p) => rules.cautionPatterns.includes(p));
    if (hit) {
      return {
        flagged: true,
        tier: 'easier',
        reason: `Go easier: ${hit}`,
        reasonType: 'movement_pattern',
        matched: { movementPattern: hit, muscle: null, equipment: null, level: null, mechanics: null },
      };
    }
  }

  return NONE;
}

// ── Ranking ──────────────────────────────────────────────────────────────────

export interface SubstituteCandidate {
  id: number;
  name: string;
  imageUrl: string | null;
  movementPatterns: string[];
  equipment: string[];
  /** 'curated' = the coach's recovery work. 'derived' = same movement, one step easier. */
  source: 'curated' | 'derived';
  reason: string;
  score: number;
}

function thumb(e: ExerciseLike): string | null {
  return e.imageUrl
    || (e.muxPlaybackId ? `https://image.mux.com/${e.muxPlaybackId}/thumbnail.png?width=200` : null);
}

/** Words that say what an exercise IS, once kit and filler are stripped: "bench press", "row", "pulldown". */
const NOISE_WORDS = new Set(['a','an','the','and','or','with','on','of','to','in','from','grip','position','single','dual','double',
  'barbell','dumbbell','dumbbells','db','kettlebell','kb','cable','machine','band','bands','trx','bodyweight','plate','landmine','ez','bar',
  'seated','standing','kneeling','half','tall','prone','supine','lying','incline','decline','flat','floor','chest','supported','bench',
  'alternating','unilateral','bilateral','arm','leg','arms','legs','one','two','left','right','neutral','pronated','supinated','wide','close','narrow','reverse']);
function nameWords(e: ExerciseLike): Set<string> {
  return new Set(e.name.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((w) => w && !NOISE_WORDS.has(w)));
}
function sharedNameWords(a: ExerciseLike, b: ExerciseLike): number {
  const wb = nameWords(b);
  let n = 0;
  for (const w of nameWords(a)) if (wb.has(w)) n++;
  return n;
}

const KIT_WORD: Record<number, string> = { 5: 'barbell', 4: 'dumbbells', 3: 'cable or machine', 2: 'a band', 1: 'bodyweight' };

/** "Same movement — dumbbells instead of barbell, chest-supported." Built from what changed. */
function describeEasier(original: ExerciseLike, candidate: ExerciseLike): string {
  const changed: string[] = [];
  const ok = kitRank(original), ck = kitRank(candidate);
  if (ok != null && ck != null && ck < ok) changed.push(`${KIT_WORD[ck]} instead of ${KIT_WORD[ok]}`);
  const ol = levelIndex(original), cl = levelIndex(candidate);
  if (ol != null && cl != null && cl < ol) changed.push(`${LEVEL_ORDER[cl]} rather than ${LEVEL_ORDER[ol]}`);
  if (!isSupported(original) && isSupported(candidate)) changed.push('more supported');
  const muscle = original.primaryMuscle && candidate.primaryMuscle === original.primaryMuscle
    ? `, still works your ${String(original.primaryMuscle).toLowerCase()}` : '';
  return changed.length
    ? `Same movement, one step easier — ${changed.join(', ')}${muscle}.`
    : `Same movement, a gentler version${muscle}.`;
}

/**
 * Rank replacements for one flagged exercise.
 *
 * GO EASIER: hard requirements first — same real pattern (the flagged one),
 * same primary muscle, strictly easier on the ladder, not a stretch, not
 * advanced. Then rank by closeness: the smallest step down wins, same side
 * (single/double arm) strongly preferred, same mechanics and type a nudge.
 * An empty result is meaningful: the library has no easier version, so the
 * caller offers Reduce.
 *
 * STOP: the coach's recovery exercises only, in the order they wrote them,
 * minus any that would themselves be stopped. An empty result means rest.
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
  const byId = new Map(allExercises.map((e) => [e.id, e]));

  const originalFlag = evaluateFlag(original, rules);
  if (!originalFlag.flagged) return [];

  if (originalFlag.tier === 'stop') {
    const out: SubstituteCandidate[] = [];
    pool.substituteExerciseIds.forEach((id, i) => {
      const e = byId.get(id);
      if (!e || e.id === original.id) return;
      if (evaluateFlag(e, rules).tier === 'stop') return;
      out.push({
        id: e.id,
        name: e.name,
        imageUrl: thumb(e),
        movementPatterns: e.movement || [],
        equipment: e.equipment || [],
        source: 'curated',
        reason: pool.coachingNote || 'Recovery work for this area while the movement is paused.',
        score: 10_000 - i,
      });
    });
    return out.slice(0, limit);
  }

  // ── GO EASIER ──
  const flaggedPattern = originalFlag.matched.movementPattern as string;
  const oDiff = difficulty(original);
  const oLat = lateralityOf(original);
  const oPrimary = original.primaryMuscle || null;

  const scored: SubstituteCandidate[] = [];
  for (const candidate of allExercises) {
    if (candidate.id === original.id) continue;
    if (isNonTraining(candidate)) continue;
    const cLevel = candidate.level ? String(candidate.level).toLowerCase() : null;
    if (cLevel === NEVER_OFFER_LEVEL) continue;
    if (evaluateFlag(candidate, rules).tier === 'stop') continue;
    if (candidate.exerciseType && original.exerciseType && candidate.exerciseType !== original.exerciseType
        && (candidate.exerciseType === 'general' || original.exerciseType === 'general')) continue;

    // Same movement: the flagged pattern must survive.
    if (!realPatterns(candidate).includes(flaggedPattern)) continue;

    // Same kind of exercise: an isolation move is not replaced by a compound one.
    if (original.mechanics?.length && candidate.mechanics?.length
        && overlap(original.mechanics, candidate.mechanics).length === 0) continue;

    // Same job: primary muscle when both are tagged, else a shared main muscle.
    const cPrimary = candidate.primaryMuscle || null;
    if (oPrimary && cPrimary) {
      if (oPrimary !== cPrimary) continue;
    } else if (overlap(original.mainMuscle, candidate.mainMuscle).length === 0) {
      continue;
    }

    // One step easier: strictly lower on the ladder.
    const cDiff = difficulty(candidate);
    if (cDiff >= oDiff) continue;

    const isCurated = pool.substituteExerciseIds.includes(candidate.id);
    let score = 0;
    // Closest step down first. Gap is at most ~250; keep it dominant but bounded.
    score -= (oDiff - cDiff);
    const cLat = lateralityOf(candidate);
    if (oLat && cLat) score += oLat === cLat ? 40 : -40;
    if (original.exerciseType && candidate.exerciseType === original.exerciseType) score += 8;
    // "Dumbbell Bench Press" for "Barbell Bench Press": the name says it is the same exercise.
    score += Math.min(sharedNameWords(original, candidate), 3) * 8;
    if (cLevel == null) score -= 6;
    if (isCurated) score += 25;

    scored.push({
      id: candidate.id,
      name: candidate.name,
      imageUrl: thumb(candidate),
      movementPatterns: candidate.movement || [],
      equipment: candidate.equipment || [],
      source: isCurated ? 'curated' : 'derived',
      reason: describeEasier(original, candidate),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

// ── Tiers from an assessment ─────────────────────────────────────────────────

export type MovementResponse = 'fine' | 'manageable' | 'painful';

export interface MovementCheck {
  key: string;
  label: string;
  patterns: string[];
  /** Library exercise shown as the picture when the athlete has no programme exercise for it. */
  cueExerciseId?: number | null;
}

/**
 * Turn what the athlete told us into STOP / GO EASIER lists.
 *
 *   painful     -> stop
 *   manageable  -> go easier
 *   fine        -> nothing at 1-6; go easier at 7-8 (an 8/10 shoulder does not
 *                  get heavy rows because rows did not hurt at that moment)
 *   9-10, or any red flag -> stop everything the area is involved in
 *
 * With no responses (older app build, or an area with no checks configured)
 * the outcome's own flag lists are used unchanged.
 */
export function tiersFromAssessment(opts: {
  severity: number;
  redFlags?: string[] | null;
  responses?: Record<string, MovementResponse> | null;
  checks?: MovementCheck[] | null;
  outcome?: any;
}): { stop: string[]; easier: string[]; source: 'responses' | 'ceiling' | 'outcome' } {
  const { severity, outcome } = opts;
  const checks = opts.checks || [];
  const responses = opts.responses || {};
  const allPatterns = Array.from(new Set(checks.flatMap((c) => c.patterns || [])));
  const redFlagged = (opts.redFlags || []).some((f) => f && f !== 'none');

  if (checks.length > 0 && (severity >= 9 || redFlagged)) {
    return { stop: allPatterns, easier: [], source: 'ceiling' };
  }

  const answered = checks.filter((c) => responses[c.key]);
  if (answered.length > 0) {
    const stop = new Set<string>();
    const easier = new Set<string>();
    for (const c of checks) {
      const r = responses[c.key];
      const eff: MovementResponse | null =
        r === 'painful' ? 'painful'
        : r === 'manageable' ? 'manageable'
        : r === 'fine' ? (severity >= 7 ? 'manageable' : 'fine')
        : (severity >= 7 ? 'manageable' : null);   // unanswered at high severity: caution
      if (eff === 'painful') c.patterns.forEach((p) => stop.add(p));
      else if (eff === 'manageable') c.patterns.forEach((p) => easier.add(p));
    }
    for (const p of stop) easier.delete(p);
    return { stop: Array.from(stop), easier: Array.from(easier), source: 'responses' };
  }

  return {
    stop: outcome?.flaggingMovementPatterns || [],
    easier: outcome?.cautionMovementPatterns || [],
    source: 'outcome',
  };
}

/** Rules for the engine, from an assessment: per-person tiers replace the outcome's pattern lists. */
export function rulesForAssessment(
  outcome: any,
  tiers: { stop: string[]; easier: string[]; source?: 'responses' | 'ceiling' | 'outcome' },
): FlaggingRules {
  const base = rulesFromOutcome(outcome);
  if (tiers.source === 'outcome') return base;
  return {
    ...base,
    movementPatterns: tiers.stop,
    cautionPatterns: tiers.easier,
    // The coach's refinements (barbell only, advanced only) belong to the
    // coach's own lists. Per-person tiers are whole patterns.
    muscles: [], equipment: [], levels: [], mechanics: [],
  };
}
