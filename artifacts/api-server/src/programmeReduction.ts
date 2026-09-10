/**
 * Volume reduction — the third answer to a flagged exercise.
 *
 * Until now a flagged exercise had two outcomes: swap it, or keep it as it is.
 * That leaves out the middle, which is often the right coaching call — the
 * movement itself is fine and worth keeping, there just needs to be less of it
 * for a while. "Strengthen through pain, within reason" only works if "less of
 * it" is something the app can actually express.
 *
 * DESIGN NOTE, and it matters. There is an older mechanism in storage.ts
 * (`applyAcceptedModifications`) that did volume changes by writing new `sets`
 * straight onto `programme_block_exercises`. That table is the SHARED PROGRAMME
 * TEMPLATE. One user reporting a sore shoulder would have permanently rewritten
 * the programme for every other user on it, with no record of the original to
 * restore. Nothing in the live app calls it, which is the only reason it has
 * never done damage.
 *
 * So reductions here are never written to a template. They are stored per slot
 * alongside substitutions and applied at read time, exactly the way a swap is —
 * which also means reassessment restores them for free.
 */

/** One entry in the `sets` JSONB array: [{reps, duration?, rest?}, ...]. */
export interface SetSpec {
  reps?: string | number | null;
  duration?: number | null;
  rest?: string | number | null;
  [key: string]: any;
}

export type ReductionTier = 'mild' | 'moderate' | 'high';

export interface Reduction {
  tier: ReductionTier;
  sets: SetSpec[];
  originalSets: SetSpec[];
  /** "4×10 → 3×7", ready to render. */
  summary: string;
  /** One line of plain English for the review screen. */
  detail: string;
}

/**
 * How hard to pull it back.
 *
 * Deliberately gentler than the old code, which at severity 5 halved sets AND
 * reps — a 75% volume cut dressed up as a modification. Someone who agrees to
 * "reduce" and finds three quarters of their session gone will just stop
 * trusting the suggestion. These numbers keep a real working stimulus at every
 * tier; the point is to stay in the movement, not to gut it.
 */
const TIERS: Record<ReductionTier, { repFactor: number; setDelta: (n: number) => number; blurb: string }> = {
  mild:     { repFactor: 0.8, setDelta: (n) => n,                     blurb: 'same sets, slightly lower reps' },
  moderate: { repFactor: 0.7, setDelta: (n) => Math.max(2, n - 1),    blurb: 'one set fewer and lower reps' },
  high:     { repFactor: 0.6, setDelta: (n) => Math.max(2, Math.ceil(n / 2)), blurb: 'half the sets and lower reps' },
};

export function tierForSeverity(severity: number | null | undefined): ReductionTier {
  const s = typeof severity === 'number' ? severity : 5;
  if (s >= 7) return 'high';
  if (s >= 4) return 'moderate';
  return 'mild';
}

/** Floor of 5 reps, unless the exercise was already prescribed below that. */
function scaleReps(value: string | number | null | undefined, factor: number): string | number | null | undefined {
  if (value === null || value === undefined || value === '') return value;

  const scaleOne = (n: number) => {
    const floor = n < 5 ? 1 : 5;
    return Math.max(floor, Math.round(n * factor));
  };

  if (typeof value === 'number') return scaleOne(value);

  const text = String(value).trim();

  // A range: "8-10", "8 to 10", "8–10".
  const range = text.match(/^(\d+)\s*(?:-|–|to)\s*(\d+)$/i);
  if (range) {
    const lo = scaleOne(parseInt(range[1], 10));
    const hi = scaleOne(parseInt(range[2], 10));
    return lo === hi ? String(lo) : `${lo}-${hi}`;
  }

  // A plain number, possibly with a suffix ("12 each side").
  const plain = text.match(/^(\d+)(\D.*)?$/);
  if (plain) return `${scaleOne(parseInt(plain[1], 10))}${plain[2] ?? ''}`;

  // AMRAP, "max", "to failure" — no number to scale. Fewer sets still applies,
  // and quietly inventing a rep target for an open-ended set would be worse.
  return value;
}

/** Timed work reduces the same way, to the nearest 5s, never below 15s. */
function scaleDuration(seconds: number | null | undefined, factor: number): number | null | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return seconds;
  if (seconds <= 15) return seconds;
  return Math.max(15, Math.round((seconds * factor) / 5) * 5);
}

/** "4×10", "3×45s", "2 sets" — one formatter, shared with the restore list. */
export function describeSets(sets: unknown): string {
  if (!Array.isArray(sets) || sets.length === 0) return '—';
  const first = sets[0] as SetSpec;
  if (typeof first?.duration === 'number' && (first.reps === null || first.reps === undefined || first.reps === '')) {
    return `${sets.length}×${first.duration}s`;
  }
  const reps = first?.reps;
  return reps === null || reps === undefined || reps === '' ? `${sets.length} sets` : `${sets.length}×${reps}`;
}

/**
 * Build the reduced prescription for one exercise.
 *
 * Returns null when there is nothing sensible to reduce — no sets recorded, or
 * a single set of open-ended work where cutting the count would remove the
 * exercise entirely. In that case the caller should not offer Reduce at all
 * rather than offering something that does nothing.
 */
export function buildReduction(
  originalSets: unknown,
  severity: number | null | undefined,
): Reduction | null {
  const sets: SetSpec[] = Array.isArray(originalSets) ? (originalSets as SetSpec[]) : [];
  if (sets.length === 0) return null;

  const tier = tierForSeverity(severity);
  const { repFactor, setDelta, blurb } = TIERS[tier];

  const targetCount = Math.min(sets.length, Math.max(1, setDelta(sets.length)));
  const kept = sets.slice(0, targetCount).map((set) => ({
    ...set,
    reps: scaleReps(set.reps, repFactor),
    duration: scaleDuration(set.duration, repFactor),
  }));

  // If nothing actually moved, there is no reduction to offer.
  const unchanged =
    kept.length === sets.length &&
    kept.every((s, i) => String(s.reps ?? '') === String(sets[i].reps ?? '') && s.duration === sets[i].duration);
  if (unchanged) return null;

  const summary = `${describeSets(sets)} → ${describeSets(kept)}`;

  return {
    tier,
    sets: kept,
    originalSets: sets,
    summary,
    detail: `Keep the movement, ${blurb} while this settles (${summary}).`,
  };
}
