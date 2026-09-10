/**
 * Day-streak milestones.
 *
 * The streak itself already exists and is recalculated from real activity. What
 * was missing was a sense of ARRIVAL: the number ticked up in a corner of the
 * dashboard and nothing ever happened. A streak is one of the few numbers in the
 * app a person builds purely by turning up, so crossing a threshold should feel
 * like something.
 *
 * The ladder is dense early and sparse later, because that is where the habit is
 * actually formed — the gap between day 3 and day 7 matters far more to someone
 * starting out than the gap between 750 and 1000.
 */
const FIXED_LADDER = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000];

/** Past the fixed ladder, every 250 days. */
const ROLLING_STEP = 250;

export interface StreakMilestoneState {
  /** Highest milestone the streak has reached, or null before the first one. */
  current: number | null;
  /** The next one to aim at. Null only if something has gone very well. */
  next: number | null;
  /** Days still to go. */
  remaining: number;
  /** 0..1 across the span between the last milestone and the next. */
  progress: number;
}

export function milestoneStateFor(streak: number): StreakMilestoneState {
  const n = Math.max(0, Math.floor(streak || 0));

  let current: number | null = null;
  let next: number | null = null;

  for (const m of FIXED_LADDER) {
    if (n >= m) current = m;
    else { next = m; break; }
  }

  if (next === null) {
    const last = FIXED_LADDER[FIXED_LADDER.length - 1];
    if (n >= last) {
      const steps = Math.floor((n - last) / ROLLING_STEP);
      current = last + steps * ROLLING_STEP;
      next = current + ROLLING_STEP;
    }
  }

  const floor = current ?? 0;
  const span = (next ?? floor) - floor;
  const progress = span > 0 ? Math.min(1, Math.max(0, (n - floor) / span)) : 1;

  return { current, next, remaining: next ? Math.max(0, next - n) : 0, progress };
}

/**
 * Should we celebrate right now?
 *
 * Only when the streak has reached a milestone we have not already shown. The
 * "already shown" mark is what stops the same 100-day moment reappearing every
 * time the dashboard refreshes — the streak is recalculated on every read, so
 * without it the modal would fire on a loop.
 *
 * A streak that BREAKS and rebuilds should be able to celebrate the same
 * milestone again, so the mark is cleared whenever the streak falls below it.
 */
export function milestoneToCelebrate(
  streak: number,
  lastCelebrated: number | null | undefined,
): number | null {
  const { current } = milestoneStateFor(streak);
  if (current === null) return null;
  const seen = typeof lastCelebrated === 'number' ? lastCelebrated : 0;
  return current > seen ? current : null;
}

/** Clear the mark when a streak has fallen back below what we last celebrated. */
export function normaliseCelebratedMark(
  streak: number,
  lastCelebrated: number | null | undefined,
): number {
  const seen = typeof lastCelebrated === 'number' ? lastCelebrated : 0;
  const { current } = milestoneStateFor(streak);
  const reached = current ?? 0;
  return seen > reached ? reached : seen;
}
