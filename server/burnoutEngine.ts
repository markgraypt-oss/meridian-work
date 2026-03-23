import type { CheckIn, BodyMapLog, WorkoutLog, SleepEntry, StepEntry } from "@shared/schema";

interface BurnoutDriver {
  key: string;
  label: string;
  explanation: string;
  trend: 'up' | 'down' | 'stable';
  weight: number;
}

interface BurnoutResult {
  score: number;
  trajectory: 'stable' | 'rising' | 'elevated' | 'recovering';
  confidence: 'low' | 'medium' | 'high';
  topDrivers: BurnoutDriver[];
  checkInCount: number;
  dataSourceCount: number;
}

interface BurnoutDataSources {
  checkIns: CheckIn[];
  workoutLogs?: WorkoutLog[];
  bodyMapLogs?: BodyMapLog[];
  sleepEntries?: SleepEntry[];
  stepEntries?: StepEntry[];
}

// --- Normalisation helpers ---
// For inverted scales (higher user rating = lower burnout):
//   User rates 1-5 where 5=best. We flip so 1 -> 100 (worst burnout), 5 -> 0.
function normalizeInverted(value: number | null | undefined): number {
  const v = value ?? 3;
  return ((5 - v) / 4) * 100;
}

// For stress (higher user rating = higher burnout):
//   User rates 1-5 where 5=most stressed. 1 -> 0, 5 -> 100.
function normalizeStress(value: number | null | undefined): number {
  const v = value ?? 3;
  return ((v - 1) / 4) * 100;
}

// --- Check-in boolean flags ---
// Negative flags each contribute 12.5 burnout points.
// Positive/protective flags each reduce by 8.33 points.
function computeBooleanPenalty(checkIn: CheckIn): number {
  let penalty = 0;
  const negativeFlags: (keyof CheckIn)[] = [
    'headache', 'alcohol', 'sick', 'painOrInjury',
    'anxious', 'overwhelmed', 'fatigue', 'caffeineAfter2pm'
  ];
  const positiveFlags: (keyof CheckIn)[] = [
    'emotionallyStable', 'practicedMindfulness', 'exercisedYesterday'
  ];

  for (const flag of negativeFlags) {
    if (checkIn[flag] === true) penalty += 12.5;
  }
  for (const flag of positiveFlags) {
    if (checkIn[flag] === true) penalty -= 8.33;
  }

  return Math.max(0, Math.min(100, penalty));
}

// --- CHECK-IN DAY SCORE ---
// Sub-component weights based on Maslach Burnout Inventory dimensions:
//   - Stress (25%): Maps to Emotional Exhaustion, the CORE burnout dimension.
//     Research consistently shows EE is the strongest predictor and earliest signal.
//   - Energy (22%): Depletion/exhaustion is the second most salient symptom.
//     Physical and emotional fatigue compound each other.
//   - Mood (18%): Maps to depersonalisation/cynicism (MBI dimension 2).
//     Persistent low mood signals emotional withdrawal.
//   - Sleep quality (15%): Subjective sleep quality is both a cause and consequence
//     of burnout. Distinct from sleep duration (tracked separately).
//   - Booleans (12%): Behavioural/somatic manifestations (headaches, anxiety,
//     skipped meals, alcohol). These are the "body keeping score" signals.
//   - Clarity (8%): Cognitive impairment (brain fog, decision fatigue). Important
//     but typically a later-stage symptom, so weighted lower.
const CHECKIN_SUB_WEIGHTS: Record<string, number> = {
  stress: 0.25,
  energy: 0.22,
  mood: 0.18,
  sleep: 0.15,
  booleans: 0.12,
  clarity: 0.08,
};

function computeCheckInDayScore(checkIn: CheckIn): {
  total: number;
  components: Record<string, number>;
} {
  const sleepComponent = normalizeInverted(checkIn.sleepScore);
  const stressComponent = normalizeStress(checkIn.stressScore);
  const energyComponent = normalizeInverted(checkIn.energyScore);
  const moodComponent = normalizeInverted(checkIn.moodScore);
  const clarityComponent = normalizeInverted(checkIn.clarityScore);
  const booleanComponent = computeBooleanPenalty(checkIn);

  const total =
    stressComponent * CHECKIN_SUB_WEIGHTS.stress +
    energyComponent * CHECKIN_SUB_WEIGHTS.energy +
    moodComponent * CHECKIN_SUB_WEIGHTS.mood +
    sleepComponent * CHECKIN_SUB_WEIGHTS.sleep +
    booleanComponent * CHECKIN_SUB_WEIGHTS.booleans +
    clarityComponent * CHECKIN_SUB_WEIGHTS.clarity;

  return {
    total: Math.round(Math.max(0, Math.min(100, total))),
    components: {
      sleep: sleepComponent,
      stress: stressComponent,
      energy: energyComponent,
      mood: moodComponent,
      clarity: clarityComponent,
      booleans: booleanComponent,
    },
  };
}

// --- WORKOUT CONSISTENCY SCORE ---
// U-shaped curve: both inactivity AND overtraining increase burnout risk.
//   - Inactivity signals withdrawal/disengagement (a burnout behaviour).
//   - Overtraining signals compulsive coping or inadequate recovery.
//   - Sweet spot: 3-5 sessions/week (evidence-based optimal range).
function computeWorkoutConsistencyScore(workoutLogs: WorkoutLog[], windowDays: number): number {
  if (!workoutLogs || workoutLogs.length === 0) return 60;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const completedInWindow = workoutLogs.filter(w => {
    if (w.status !== 'completed') return false;
    const date = w.completedAt ? new Date(w.completedAt) : null;
    return date && date >= windowStart;
  });

  const uniqueDays = new Set(
    completedInWindow.map(w => {
      const d = new Date(w.completedAt as Date);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const workoutsPerWeek = (uniqueDays.size / windowDays) * 7;

  // U-shaped: optimal 3-5/week, risk rises on both ends
  if (workoutsPerWeek >= 3 && workoutsPerWeek <= 5) return 0;   // Optimal range
  if (workoutsPerWeek > 5 && workoutsPerWeek <= 6) return 15;   // Slightly high
  if (workoutsPerWeek > 6) return 35;                            // Overtraining signal
  if (workoutsPerWeek >= 2) return 20;                           // Slightly low
  if (workoutsPerWeek >= 1) return 45;                           // Low -- withdrawal risk
  if (workoutsPerWeek >= 0.5) return 65;                         // Very low
  return 80;                                                      // Near-zero activity -- strong withdrawal signal
}

// --- BODY MAP PAIN SCORE ---
// Physical pain and musculoskeletal complaints increase with burnout.
// Uses recency weighting: recent pain matters more than old entries.
function computeBodyMapPainScore(bodyMapLogs: BodyMapLog[], windowDays: number): number {
  if (!bodyMapLogs || bodyMapLogs.length === 0) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const recentLogs = bodyMapLogs.filter(log => {
    if (!log.createdAt) return false;
    const date = new Date(log.createdAt);
    return date >= windowStart;
  });

  if (recentLogs.length === 0) return 0;

  const uniqueAreas = new Set(recentLogs.map(l => `${l.bodyPart}-${l.side || ''}`));
  const areaCount = uniqueAreas.size;

  // Recency-weighted severity: entries from the last 7 days count full,
  // entries from 8-14 days count 70%, older entries count 40%.
  let weightedSeveritySum = 0;
  let weightSum = 0;
  for (const log of recentLogs) {
    const daysAgo = (now.getTime() - new Date(log.createdAt!).getTime()) / (24 * 60 * 60 * 1000);
    const recencyWeight = daysAgo <= 7 ? 1.0 : daysAgo <= 14 ? 0.7 : 0.4;
    weightedSeveritySum += (log.severity || 0) * recencyWeight;
    weightSum += recencyWeight;
  }
  const avgSeverity = weightSum > 0 ? weightedSeveritySum / weightSum : 0;

  const highImpactCount = recentLogs.filter(l =>
    l.trainingImpact === 'significant' || l.trainingImpact === 'unable'
  ).length;

  let score = 0;
  score += Math.min(40, areaCount * 12);         // More pain areas = higher load
  score += (avgSeverity / 10) * 35;              // Higher severity = higher load
  score += Math.min(25, highImpactCount * 10);   // Training impact = functional limitation

  return Math.max(0, Math.min(100, score));
}

// --- SLEEP TRACKING SCORE ---
// Combines objective sleep data: duration, quality rating, and device sleep score.
// Sleep disruption has a strong bidirectional relationship with burnout --
// it is both an early warning sign and a consequence that accelerates decline.
function computeSleepTrackingScore(sleepEntries: SleepEntry[], windowDays: number): number {
  if (!sleepEntries || sleepEntries.length === 0) return 50;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const recentEntries = sleepEntries.filter(e => {
    const date = new Date(e.date);
    return date >= windowStart;
  });

  if (recentEntries.length === 0) return 50;

  let score = 0;
  let count = 0;

  for (const entry of recentEntries) {
    let entryScore = 50;

    if (entry.durationMinutes) {
      const hours = entry.durationMinutes / 60;
      if (hours >= 7 && hours <= 9) entryScore = 0;       // Optimal
      else if (hours >= 6 && hours < 7) entryScore = 30;   // Slightly short
      else if (hours >= 5 && hours < 6) entryScore = 55;   // Short
      else if (hours < 5) entryScore = 85;                  // Severely short
      else if (hours > 9) entryScore = 20;                  // Oversleeping (can signal depression)
    }

    if (entry.quality) {
      const qualityScore = normalizeInverted(entry.quality);
      entryScore = (entryScore + qualityScore) / 2;
    }

    if (entry.sleepScore) {
      const sleepScoreNorm = ((100 - entry.sleepScore) / 100) * 100;
      entryScore = (entryScore * 0.6) + (sleepScoreNorm * 0.4);
    }

    score += entryScore;
    count++;
  }

  return Math.max(0, Math.min(100, Math.round(score / count)));
}

// --- ACTIVITY/STEPS SCORE ---
// General daily movement. Low activity correlates with burnout but is a weaker
// signal than the other sources. Useful as a supporting indicator.
function computeActivityScore(stepEntries: StepEntry[], windowDays: number): number {
  if (!stepEntries || stepEntries.length === 0) return 50;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const recentEntries = stepEntries.filter(e => {
    const date = new Date(e.date);
    return date >= windowStart;
  });

  if (recentEntries.length === 0) return 50;

  const avgSteps = recentEntries.reduce((sum, e) => sum + (e.steps || 0), 0) / recentEntries.length;

  if (avgSteps >= 10000) return 0;
  if (avgSteps >= 8000) return 10;
  if (avgSteps >= 6000) return 25;
  if (avgSteps >= 4000) return 45;
  if (avgSteps >= 2000) return 65;
  return 85;
}

// --- Trend computation ---
function computeTrend(recent: number[], baseline: number[]): 'up' | 'down' | 'stable' {
  // Rule 1 & 3: Require at least 3 data points in each window (minimum data gate + rolling 3 vs 3)
  if (recent.length < 3 || baseline.length < 3) return 'stable';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const diff = recentAvg - baselineAvg;
  // Rule 2: Magnitude filter — require >10 point shift on 0-100 scale (a single 1-step
  // change on a 5-point scale = 25 pts, so 10 pts filters out noise without hiding real shifts)
  if (diff > 10) return 'up';
  if (diff < -10) return 'down';
  return 'stable';
}

// --- Driver explanations (contextual, severity-aware) ---
function getDriverExplanation(key: string, value: number): string {
  const explanations: Record<string, (v: number) => string> = {
    stress: (v) => v > 60 ? 'High stress is the primary driver of your burnout risk' : v > 30 ? 'Moderate stress levels detected' : 'Stress is well managed',
    energy: (v) => v > 60 ? 'Persistent low energy signals significant depletion' : v > 30 ? 'Energy levels are somewhat low' : 'Energy levels are solid',
    mood: (v) => v > 60 ? 'Low mood indicates emotional withdrawal risk' : v > 30 ? 'Mood has room for improvement' : 'Mood is positive',
    sleep: (v) => v > 60 ? 'Poor sleep quality is significantly impacting recovery' : v > 30 ? 'Sleep quality could be better' : 'Sleep quality is good',
    clarity: (v) => v > 60 ? 'Mental clarity is notably reduced' : v > 30 ? 'Focus and clarity could improve' : 'Mental clarity is strong',
    booleans: (v) => v > 60 ? 'Multiple warning signs flagged in recent check-ins' : v > 30 ? 'Some lifestyle flags are contributing' : 'Lifestyle factors are mostly positive',
    workoutConsistency: (v) => v > 60 ? 'Very low training frequency suggests withdrawal from routine' : v > 30 ? 'Training frequency could be more consistent' : 'Training consistency is strong',
    painLoad: (v) => v > 60 ? 'Active pain or injuries are significantly impacting your score' : v > 30 ? 'Some pain or injury areas are present' : 'Pain and injury load is minimal',
    sleepTracking: (v) => v > 60 ? 'Sleep duration and quality are poor -- a key burnout accelerator' : v > 30 ? 'Sleep patterns have room for improvement' : 'Sleep patterns are healthy',
    activity: (v) => v > 60 ? 'Daily movement is well below recommended levels' : v > 30 ? 'Daily movement could be higher' : 'Daily movement levels are good',
  };
  return (explanations[key] || (() => ''))(value);
}

const DRIVER_LABELS: Record<string, string> = {
  stress: 'Stress Level',
  energy: 'Energy Level',
  mood: 'Mood',
  sleep: 'Sleep (Check-in)',
  clarity: 'Mental Clarity',
  booleans: 'Lifestyle Flags',
  workoutConsistency: 'Workout Consistency',
  painLoad: 'Pain & Injury Load',
  sleepTracking: 'Sleep Patterns',
  activity: 'Daily Activity',
};

const BASE_CHECKIN_KEYS = ['sleep', 'stress', 'energy', 'mood', 'clarity', 'booleans'];

// ====================================================================
// MAIN SCORING FUNCTION
// ====================================================================
// OVERALL SOURCE WEIGHTS (research rationale):
//
//   Check-ins: 60%
//     The subjective self-report IS the burnout measure. The Maslach Burnout
//     Inventory is entirely self-reported. Our check-in captures the core
//     dimensions: emotional exhaustion (stress), depletion (energy),
//     depersonalisation (mood), cognitive impairment (clarity), and
//     behavioural signals (booleans). This must dominate.
//
//   Sleep tracking: 20%
//     Sleep disruption is the strongest physiological marker of burnout.
//     Meta-analyses show a robust bidirectional relationship: poor sleep
//     causes burnout AND burnout causes poor sleep. It is both an early
//     warning system and an accelerant. Second-highest weight.
//
//   Workout consistency: 10%
//     Exercise is a protective factor (resource in Conservation of Resources
//     theory). A sudden drop in training consistency signals withdrawal, a
//     key burnout behaviour. Overtraining signals compulsive coping.
//     Important but not as diagnostically powerful as sleep.
//
//   Body map pain: 5%
//     Somatic/musculoskeletal complaints can accompany burnout, but pain is
//     far from universal — someone can be severely burned out with no injury.
//     Reduced to 5% to avoid over-rewarding a clean body map.
//
//   Daily activity (steps): 5%
//     General movement is a weak but useful supporting indicator. Low step
//     counts correlate with burnout but have many confounding factors
//     (desk work, travel, weather). Lowest weight.
//
// ====================================================================

const SOURCE_WEIGHTS = {
  checkIn: 0.60,
  sleepTracking: 0.20,
  workoutConsistency: 0.10,
  painLoad: 0.05,
  activity: 0.05,
};

export function computeBurnoutScore(data: BurnoutDataSources): BurnoutResult {
  const { checkIns, workoutLogs, bodyMapLogs, sleepEntries, stepEntries } = data;

  const hasCheckIns = checkIns.length > 0;
  const hasWorkouts = workoutLogs && workoutLogs.length > 0;
  const hasBodyMap = bodyMapLogs && bodyMapLogs.length > 0;
  const hasSleep = sleepEntries && sleepEntries.length > 0;
  const hasSteps = stepEntries && stepEntries.length > 0;

  let dataSourceCount = 0;
  if (hasCheckIns) dataSourceCount++;
  if (hasWorkouts) dataSourceCount++;
  if (hasBodyMap) dataSourceCount++;
  if (hasSleep) dataSourceCount++;
  if (hasSteps) dataSourceCount++;

  if (!hasCheckIns && dataSourceCount === 0) {
    return {
      score: 0,
      trajectory: 'stable',
      confidence: 'low',
      topDrivers: [],
      checkInCount: 0,
      dataSourceCount: 0,
    };
  }

  const windowDays = 30;

  const workoutScore = hasWorkouts ? computeWorkoutConsistencyScore(workoutLogs!, windowDays) : null;
  const painScore = hasBodyMap ? computeBodyMapPainScore(bodyMapLogs!, windowDays) : null;
  const sleepTrackingScore = hasSleep ? computeSleepTrackingScore(sleepEntries!, windowDays) : null;
  const activityScore = hasSteps ? computeActivityScore(stepEntries!, windowDays) : null;

  // --- EWMA over recent 7 check-ins (exponential decay = 0.15) ---
  const sorted = [...checkIns].sort((a, b) => {
    const dateA = new Date(a.checkInDate).getTime();
    const dateB = new Date(b.checkInDate).getTime();
    return dateB - dateA;
  });

  const checkInDayScores = sorted.map(ci => computeCheckInDayScore(ci));

  let checkInWeightedScore = 0;
  const checkInWeightedComponents: Record<string, number> = {
    sleep: 0, stress: 0, energy: 0, mood: 0, clarity: 0, booleans: 0,
  };

  if (hasCheckIns) {
    const recentWindow = checkInDayScores.slice(0, 7);
    const decayFactor = 0.15;
    let weightedSum = 0;
    let weightTotal = 0;
    const tempComponents: Record<string, number> = { ...checkInWeightedComponents };

    for (let i = 0; i < recentWindow.length; i++) {
      const weight = Math.exp(-decayFactor * i);
      weightedSum += recentWindow[i].total * weight;
      weightTotal += weight;
      for (const key of Object.keys(tempComponents)) {
        tempComponents[key] += recentWindow[i].components[key] * weight;
      }
    }
    checkInWeightedScore = weightedSum / weightTotal;
    for (const key of Object.keys(tempComponents)) {
      checkInWeightedComponents[key] = tempComponents[key] / weightTotal;
    }
  }

  // --- Dynamic weight redistribution ---
  // If a source has no data, its weight is redistributed proportionally
  // across active sources so weights always sum to 1.0.
  const activeWeights: Record<string, number> = {};
  let totalActiveWeight = 0;

  if (hasCheckIns) { activeWeights['checkIn'] = SOURCE_WEIGHTS.checkIn; totalActiveWeight += SOURCE_WEIGHTS.checkIn; }
  if (sleepTrackingScore !== null) { activeWeights['sleepTracking'] = SOURCE_WEIGHTS.sleepTracking; totalActiveWeight += SOURCE_WEIGHTS.sleepTracking; }
  if (workoutScore !== null) { activeWeights['workoutConsistency'] = SOURCE_WEIGHTS.workoutConsistency; totalActiveWeight += SOURCE_WEIGHTS.workoutConsistency; }
  if (painScore !== null) { activeWeights['painLoad'] = SOURCE_WEIGHTS.painLoad; totalActiveWeight += SOURCE_WEIGHTS.painLoad; }
  if (activityScore !== null) { activeWeights['activity'] = SOURCE_WEIGHTS.activity; totalActiveWeight += SOURCE_WEIGHTS.activity; }

  if (totalActiveWeight > 0) {
    const scale = 1 / totalActiveWeight;
    for (const key of Object.keys(activeWeights)) {
      activeWeights[key] *= scale;
    }
  }

  // --- Weighted final score ---
  let finalScore = 0;
  if (hasCheckIns) finalScore += checkInWeightedScore * (activeWeights['checkIn'] || 0);
  if (sleepTrackingScore !== null) finalScore += sleepTrackingScore * (activeWeights['sleepTracking'] || 0);
  if (workoutScore !== null) finalScore += workoutScore * (activeWeights['workoutConsistency'] || 0);
  if (painScore !== null) finalScore += painScore * (activeWeights['painLoad'] || 0);
  if (activityScore !== null) finalScore += activityScore * (activeWeights['activity'] || 0);

  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)));

  // --- Debug logging ---
  console.log('[Burnout Engine] Source scores:', {
    checkIn: hasCheckIns ? Math.round(checkInWeightedScore) : 'N/A',
    sleepTracking: sleepTrackingScore !== null ? Math.round(sleepTrackingScore) : 'N/A',
    workout: workoutScore !== null ? Math.round(workoutScore) : 'N/A',
    pain: painScore !== null ? Math.round(painScore) : 'N/A',
    activity: activityScore !== null ? Math.round(activityScore) : 'N/A',
    finalScore,
    dataSourceCount,
    weights: activeWeights,
  });

  // --- Build driver components for ranking ---
  const allDriverComponents: Record<string, number> = {};
  const allDriverWeights: Record<string, number> = {};

  if (hasCheckIns) {
    const checkInNorm = activeWeights['checkIn'] || 0;
    for (const key of BASE_CHECKIN_KEYS) {
      allDriverComponents[key] = checkInWeightedComponents[key];
      allDriverWeights[key] = checkInNorm * CHECKIN_SUB_WEIGHTS[key];
    }
  }

  if (sleepTrackingScore !== null) {
    allDriverComponents['sleepTracking'] = sleepTrackingScore;
    allDriverWeights['sleepTracking'] = activeWeights['sleepTracking'] || 0;
  }
  if (workoutScore !== null) {
    allDriverComponents['workoutConsistency'] = workoutScore;
    allDriverWeights['workoutConsistency'] = activeWeights['workoutConsistency'] || 0;
  }
  if (painScore !== null) {
    allDriverComponents['painLoad'] = painScore;
    allDriverWeights['painLoad'] = activeWeights['painLoad'] || 0;
  }
  if (activityScore !== null) {
    allDriverComponents['activity'] = activityScore;
    allDriverWeights['activity'] = activeWeights['activity'] || 0;
  }

  // --- Trajectory (based on check-in trend: recent 7 vs baseline 8+) ---
  const recentCheckInScores = checkInDayScores.slice(0, 7).map(s => s.total);
  const baselineCheckInScores = checkInDayScores.slice(7).map(s => s.total);

  const recentAvg = recentCheckInScores.length > 0
    ? recentCheckInScores.reduce((a, b) => a + b, 0) / recentCheckInScores.length
    : finalScore;

  const baselineAvg = baselineCheckInScores.length > 0
    ? baselineCheckInScores.reduce((a, b) => a + b, 0) / baselineCheckInScores.length
    : recentAvg;

  const diff = recentAvg - baselineAvg;

  let trajectory: 'stable' | 'rising' | 'elevated' | 'recovering';
  if (diff >= 15) {
    trajectory = 'elevated';
  } else if (diff >= 5) {
    trajectory = 'rising';
  } else if (diff <= -5) {
    trajectory = 'recovering';
  } else {
    trajectory = 'stable';
  }

  // --- Confidence ---
  let confidence: 'low' | 'medium' | 'high';
  const totalDataPoints = checkIns.length + (workoutLogs?.length || 0) + (bodyMapLogs?.length || 0) + (sleepEntries?.length || 0) + (stepEntries?.length || 0);
  if (totalDataPoints >= 40 && dataSourceCount >= 3) {
    confidence = 'high';
  } else if (totalDataPoints >= 15 && dataSourceCount >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // --- Driver trend computation ---
  // For check-in sub-components: compare recent 7 check-ins vs baseline 8+.
  const recentComponentsByKey: Record<string, number[]> = {};
  const baselineComponentsByKey: Record<string, number[]> = {};

  for (const key of BASE_CHECKIN_KEYS) {
    recentComponentsByKey[key] = [];
    baselineComponentsByKey[key] = [];
  }

  // Rolling 3 vs 3: last 3 check-ins are "recent", the 3 before them are "baseline".
  // computeTrend requires min 3 in each bucket so fewer than 6 check-ins → always stable.
  checkInDayScores.slice(0, 3).forEach(s => {
    for (const key of BASE_CHECKIN_KEYS) {
      recentComponentsByKey[key].push(s.components[key]);
    }
  });
  checkInDayScores.slice(3, 6).forEach(s => {
    for (const key of BASE_CHECKIN_KEYS) {
      baselineComponentsByKey[key].push(s.components[key]);
    }
  });

  // For non-check-in sources: split raw data into recent (7 days) vs baseline
  // (8-30 days) and compute scores for each window to get a real trend.
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const baselineCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const nonCheckInTrends: Record<string, 'up' | 'down' | 'stable'> = {};

  if (workoutLogs && workoutLogs.length > 0) {
    const recentWorkouts = workoutLogs.filter(w => w.completedAt && new Date(w.completedAt) >= recentCutoff);
    const baselineWorkouts = workoutLogs.filter(w => w.completedAt && new Date(w.completedAt) >= baselineCutoff && new Date(w.completedAt) < recentCutoff);
    if (recentWorkouts.length > 0 && baselineWorkouts.length > 0) {
      const recentScore = computeWorkoutConsistencyScore(recentWorkouts, 7);
      const baselineScore = computeWorkoutConsistencyScore(baselineWorkouts, 23);
      nonCheckInTrends['workoutConsistency'] = recentScore > baselineScore + 5 ? 'up' : recentScore < baselineScore - 5 ? 'down' : 'stable';
    }
  }

  if (sleepEntries && sleepEntries.length > 0) {
    const recentSleep = sleepEntries.filter(e => new Date(e.date) >= recentCutoff);
    const baselineSleep = sleepEntries.filter(e => new Date(e.date) >= baselineCutoff && new Date(e.date) < recentCutoff);
    if (recentSleep.length > 0 && baselineSleep.length > 0) {
      const recentScore = computeSleepTrackingScore(recentSleep, 7);
      const baselineScore = computeSleepTrackingScore(baselineSleep, 23);
      nonCheckInTrends['sleepTracking'] = recentScore > baselineScore + 5 ? 'up' : recentScore < baselineScore - 5 ? 'down' : 'stable';
    }
  }

  if (stepEntries && stepEntries.length > 0) {
    const recentSteps = stepEntries.filter(e => new Date(e.date) >= recentCutoff);
    const baselineSteps = stepEntries.filter(e => new Date(e.date) >= baselineCutoff && new Date(e.date) < recentCutoff);
    if (recentSteps.length > 0 && baselineSteps.length > 0) {
      const recentScore = computeActivityScore(recentSteps, 7);
      const baselineScore = computeActivityScore(baselineSteps, 23);
      nonCheckInTrends['activity'] = recentScore > baselineScore + 5 ? 'up' : recentScore < baselineScore - 5 ? 'down' : 'stable';
    }
  }

  if (bodyMapLogs && bodyMapLogs.length > 0) {
    const recentPain = bodyMapLogs.filter(l => l.createdAt && new Date(l.createdAt) >= recentCutoff);
    const baselinePain = bodyMapLogs.filter(l => l.createdAt && new Date(l.createdAt) >= baselineCutoff && new Date(l.createdAt!) < recentCutoff);
    if (recentPain.length > 0 && baselinePain.length > 0) {
      const recentScore = computeBodyMapPainScore(recentPain, 7);
      const baselineScore = computeBodyMapPainScore(baselinePain, 23);
      nonCheckInTrends['painLoad'] = recentScore > baselineScore + 5 ? 'up' : recentScore < baselineScore - 5 ? 'down' : 'stable';
    }
  }

  // --- Rank drivers by weighted contribution, select top 4 ---
  const driverEntries = Object.keys(allDriverComponents).map(key => {
    let trend: 'up' | 'down' | 'stable';
    if (recentComponentsByKey[key] && baselineComponentsByKey[key] &&
        recentComponentsByKey[key].length > 0 && baselineComponentsByKey[key].length > 0) {
      trend = computeTrend(recentComponentsByKey[key], baselineComponentsByKey[key]);
    } else if (nonCheckInTrends[key]) {
      trend = nonCheckInTrends[key];
    } else {
      trend = 'stable';
    }
    return {
      key,
      label: DRIVER_LABELS[key] || key,
      explanation: getDriverExplanation(key, allDriverComponents[key]),
      trend,
      weight: allDriverWeights[key] || 0,
      weightedContribution: allDriverComponents[key] * (allDriverWeights[key] || 0),
    };
  });

  driverEntries.sort((a, b) => b.weightedContribution - a.weightedContribution);

  const topDrivers: BurnoutDriver[] = driverEntries.slice(0, 4).map(d => ({
    key: d.key,
    label: d.label,
    explanation: d.explanation,
    trend: d.trend,
    weight: d.weight,
  }));

  return {
    score: finalScore,
    trajectory,
    confidence,
    topDrivers,
    checkInCount: checkIns.length,
    dataSourceCount,
  };
}
