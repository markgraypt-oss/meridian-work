// How long a workout takes, worked out from its sets, reps and rest.
//
// One place for every screen: the workout library, programme workouts, a
// programme's workout list and an enrolled workout. Until 24 Nov 2026 the two
// programme lists used "exercises x 1.75 minutes", which ignored sets and rest
// and showed a 32 minute session as "~12 min". Moved here from routes.ts so
// storage.ts can use the same sum.

export function parseDurationToSecondsServer(duration?: string | number): number {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  const lower = duration.toLowerCase();
  let total = 0;
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) total += parseInt(minMatch[1]) * 60;
  const secMatch = lower.match(/(\d+)\s*sec/);
  if (secMatch) total += parseInt(secMatch[1]);
  if (!minMatch && !secMatch) {
    const numMatch = duration.match(/(\d+)/);
    if (numMatch) total = parseInt(numMatch[1]);
  }
  return total;
}

// Rest is stored as text: "60 sec", "90 sec", "2 min". Also reads a mixed
// "1 min 30 secs" and a bare number of seconds. The old version read
// "1 min 30 secs" as 60 seconds.
export function parseRestServer(rest?: string | number | null): number {
  if (!rest) return 0;
  if (typeof rest === 'number') return rest;
  const lower = rest.toLowerCase();
  const min = lower.match(/(\d+(?:\.\d+)?)\s*m/);
  const sec = lower.match(/(\d+)\s*s/);
  if (min || sec) {
    return Math.round((min ? parseFloat(min[1]) * 60 : 0) + (sec ? parseInt(sec[1], 10) : 0));
  }
  const match = lower.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Seconds of actual work for ONE set of an exercise, using its first set as the
// representative spec (sets are uniform in practice, and the UI shows the first
// set's reps/duration too). Timer exercises use their target seconds; rep
// exercises approximate ~3s per rep with a small floor so a 1-3 rep set is not
// counted as ~zero.
export function perSetWorkSeconds(exercise: any): number {
  const sets = Array.isArray(exercise?.sets) && exercise.sets.length > 0 ? exercise.sets : [{}];
  const first = sets[0] || {};
  const isTimer = exercise?.durationType === 'timer' || exercise?.durationType === 'time';
  if (isTimer) {
    const secs = parseDurationToSecondsServer(first.duration || exercise?.duration || exercise?.targetDuration);
    // Cap a single interval at 10 min so a stray/garbage value can't blow up.
    return Math.min(600, secs > 0 ? secs : 30);
  }
  // Cap reps at 60 so a bad value (e.g. reps stored as a big number) is bounded.
  const reps = parseInt(String(first.reps ?? exercise?.reps ?? ''), 10) || 10;
  return Math.max(8, Math.min(60, reps) * 3);
}

// How many times an exercise/round is repeated, resolved the SAME way the app
// displays the set/round count: regular uses the sets-array length; interval
// uses the block's round count; circuit uses the workout-level round count
// first. Falls back to the sets-array length when a round count is absent.
export function resolveRoundCount(workout: any, block: any): number {
  const wt = workout?.workoutType || 'regular';
  const firstEx = (block?.exercises || [])[0];
  const setsLen = Array.isArray(firstEx?.sets) && firstEx.sets.length > 0 ? firstEx.sets.length : 1;
  const raw = wt === 'circuit'
    ? (workout?.intervalRounds || block?.rounds || setsLen)
    : wt === 'interval'
      ? (block?.rounds || setsLen)
      : setsLen;
  // Cap rounds at 20 — no real session has more, so a bad round count is bounded.
  return Math.max(1, Math.min(20, raw));
}

// Setup / transition time counted on every straight set, on top of the reps.
export const SET_TRANSITION_SECONDS = 10;

export function calculateServerWorkoutDuration(workout: any): number {
  const workoutType = workout?.workoutType || 'regular';
  // Video workouts are timed by their media, not by sets/reps.
  if (workoutType === 'video') return workout?.duration || 0;

  const rawExercises = workout?.exercises || [];
  const isBlockFormat = rawExercises.length > 0 && rawExercises[0]?.exercises;
  const blocks: any[] = isBlockFormat
    ? rawExercises
    : [{ section: 'main', blockType: 'single', exercises: rawExercises }];

  let totalSeconds = 0;

  for (const block of blocks) {
    // Standalone rest blocks contribute only their own rest time.
    if (block?.blockType === 'rest') {
      totalSeconds += parseRestServer(block.rest) || 30;
      continue;
    }
    const exs = block?.exercises || [];
    if (exs.length === 0) continue;

    const section = block?.section || 'main';
    const isWarmup = section === 'warmup' || section === 'warm_up';
    // Circuit/interval MAIN work: every exercise is done once per round and the
    // whole set of exercises repeats for `rounds`, with a short rest between
    // rounds. Warm-ups are always straight sets, even inside an interval workout.
    const circuitStyle = !isWarmup &&
      (workoutType === 'interval' || workoutType === 'circuit' || block?.blockType === 'circuit');

    if (circuitStyle) {
      const rounds = Math.max(1, resolveRoundCount(workout, block));
      let roundWork = 0;
      for (const ex of exs) roundWork += perSetWorkSeconds(ex);
      // "rest after round" is ONE rest after completing all exercises in the
      // round (per the schema), so it applies between rounds — NOT once per
      // exercise. Multiplying by the exercise count was the bug that inflated
      // circuits. Capped at 5 min in case of a stray value.
      const restBetweenRounds = Math.min(300, workoutType === 'circuit'
        ? parseRestServer(workout?.intervalRestAfterRound)
        : parseRestServer(block?.restAfterRound));
      totalSeconds += rounds * roundWork
        + Math.max(0, rounds - 1) * restBetweenRounds
        + parseRestServer(block?.rest);
    } else {
      // Straight sets (regular blocks and all warm-ups). One "round" is every
      // exercise in the block performed once; a single-exercise block just
      // repeats that exercise for its set count.
      const rounds = Math.max(1, resolveRoundCount({ workoutType: 'regular' }, block));
      let roundWork = 0;
      // ~10s of setup / re-rack "white space" is real work time on every set,
      // on top of the reps or the timer.
      for (const ex of exs) roundWork += perSetWorkSeconds(ex) + SET_TRANSITION_SECONDS;
      const rest = Math.min(300, parseRestServer(block?.rest)); // cap a stray rest at 5 min
      // Rest counted once PER SET (not per gap): the recovery after each set
      // plus the transition between exercises. For 3 lifts x 5 sets at 3 min
      // that is 15 x 3 = 45 min of rest — the bulk of a strength session, which
      // the old estimate dropped almost entirely.
      totalSeconds += rounds * roundWork + rounds * rest;
    }
  }

  // Final safety cap: nothing in this app is a 2-hour session, so a computed
  // value above 120 min means the underlying data is off — bound it either way.
  return Math.max(1, Math.min(120, Math.ceil(totalSeconds / 60)));
}
