import type { CheckIn, BodyMapLog, WorkoutLog, SleepEntry, StepEntry, WearableMetricsDaily, UserPhysiologicalBaselines } from "@shared/schema";
import type { NotesAggregate } from "./notesAnalyser";

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
  // Wearable-sourced daily metrics. When present we PREFER these over the
  // self-reported sleep/step entries because they are objective measurements.
  wearableMetrics?: WearableMetricsDaily[];
  // User's personal physiological baselines (HRV, RHR, sleep duration).
  // Computed nightly by the baseline scheduler from rolling windows.
  // Required for the physiological readiness source to contribute to the score.
  // When null or uncalibrated, that source contributes nothing and its
  // weight is redistributed across active sources via existing logic.
  baselines?: UserPhysiologicalBaselines | null;
  // Rolled-up summary of notes analyses across the last 14 days.
  // Used for two purposes: (1) a small severity-driven score contribution
  // when red flags or sustained high-severity notes appear, and (2) enriching
  // driver explanations with verbatim phrases from the user's own notes.
  // Null when no recent check-ins have notes analyses.
  notesAggregate?: NotesAggregate | null;
}

// Convert wearable_metrics_daily rows into the SleepEntry/StepEntry shapes
// the existing scoring functions already understand. We pick the highest-priority
// provider per day (oura > whoop > apple_health > google_fit).
const WEARABLE_PRIORITY: Record<string, number> = { oura: 4, whoop: 3, apple_health: 2, google_fit: 1 };

function pickBestPerDay(metrics: WearableMetricsDaily[]): WearableMetricsDaily[] {
  const byDate = new Map<string, WearableMetricsDaily>();
  for (const m of metrics) {
    const cur = byDate.get(m.date);
    if (!cur || (WEARABLE_PRIORITY[m.provider] || 0) > (WEARABLE_PRIORITY[cur.provider] || 0)) {
      byDate.set(m.date, m);
    }
  }
  return Array.from(byDate.values());
}

function wearablesToSleepEntries(metrics: WearableMetricsDaily[]): SleepEntry[] {
  return pickBestPerDay(metrics)
    .filter((m) => m.sleepMinutes != null)
    .map((m) => ({
      id: 0, userId: m.userId,
      date: new Date(`${m.date}T00:00:00Z`),
      durationMinutes: m.sleepMinutes!,
      quality: null, bedTime: null, wakeTime: null,
      deepSleepMinutes: m.sleepDeepMinutes ?? null,
      lightSleepMinutes: m.sleepLightMinutes ?? null,
      remSleepMinutes: m.sleepRemMinutes ?? null,
      awakeMinutes: m.sleepAwakeMinutes ?? null,
      sleepScore: m.sleepScore ?? null,
      notes: null, createdAt: m.createdAt,
    }) as SleepEntry);
}

function wearablesToStepEntries(metrics: WearableMetricsDaily[]): StepEntry[] {
  return pickBestPerDay(metrics)
    .filter((m) => m.steps != null)
    .map((m) => ({
      id: 0, userId: m.userId,
      date: new Date(`${m.date}T00:00:00Z`),
      steps: m.steps!,
      distance: null,
      activeMinutes: m.activeMinutes ?? null,
      notes: null, createdAt: m.createdAt,
    }) as StepEntry);
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
      if (hours >= 7) entryScore = 0;                       // Optimal (7h+). Long sleep is recovery-positive
                                                            // for active adults under training load, NOT a
                                                            // depression signal. No penalty for >9h.
      else if (hours >= 6 && hours < 7) entryScore = 30;   // Slightly short
      else if (hours >= 5 && hours < 6) entryScore = 55;   // Short
      else if (hours < 5) entryScore = 85;                  // Severely short
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

// --- PHYSIOLOGICAL READINESS SCORE ---
// The most powerful new signal in the engine. Combines three approaches:
//
//   1. PROVIDER COMPOSITE (Oura readiness / Whoop recovery):
//      Use this directly when present. These scores are the result of
//      millions of dollars of R&D and combine HRV, RHR, body temp deviation,
//      sleep quality, prior strain, and more. Better than anything we'd
//      compute from raw fields. Average the last 7 days, EWMA-weighted
//      toward recent data.
//
//   2. RAW HRV/RHR COMPOSITE (Apple Health and other providers):
//      When no readiness score is available, compute our own from raw HRV
//      and RHR vs the user's personal baselines. HRV suppression and RHR
//      elevation both signal autonomic stress.
//
//   3. CALIBRATION GATE:
//      Returns null until the baseline has 14+ samples per metric. Until
//      then, this source doesn't contribute to the score — the dynamic
//      weight redistribution gives that 12% back to check-ins.
//
// Output: 0 (excellent recovery) -> 100 (severe physiological stress).
function computePhysiologicalReadinessScore(
  metrics: WearableMetricsDaily[] | undefined,
  baselines: UserPhysiologicalBaselines | null | undefined,
): number | null {
  if (!metrics || metrics.length === 0) return null;
  if (!baselines || !baselines.isCalibrated) return null;

  // Look at the last 7 days only — readiness is a recent-recovery metric,
  // not a long-term trend. Older data dilutes the signal.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffStr = sevenDaysAgo.toISOString().slice(0, 10);
  const recentMetrics = metrics.filter(m => m.date >= cutoffStr);
  if (recentMetrics.length === 0) return null;

  // Dedupe by provider priority (same logic as elsewhere in the engine)
  const byDate = new Map<string, WearableMetricsDaily>();
  for (const m of recentMetrics) {
    const cur = byDate.get(m.date);
    if (!cur || (WEARABLE_PRIORITY[m.provider] || 0) > (WEARABLE_PRIORITY[cur.provider] || 0)) {
      byDate.set(m.date, m);
    }
  }
  const dedupedMetrics = Array.from(byDate.values())
    .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

  // EWMA weighting: most recent day has full weight, decays by ~14% per day.
  // Same decay factor as the check-in EWMA for consistency.
  const decayFactor = 0.15;

  // --- APPROACH 1: Provider composite (Oura readiness / Whoop recovery) ---
  // Both Oura and Whoop store their composite score in readinessScore (0-100).
  // Higher = better recovery, so we invert for burnout contribution.
  const readinessRows = dedupedMetrics.filter(m => m.readinessScore != null);
  if (readinessRows.length >= 3) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < readinessRows.length; i++) {
      const weight = Math.exp(-decayFactor * i);
      const readiness = readinessRows[i].readinessScore as number;
      weightedSum += (100 - readiness) * weight; // invert: 100 readiness -> 0 burnout
      weightTotal += weight;
    }
    return Math.max(0, Math.min(100, weightedSum / weightTotal));
  }

  // --- APPROACH 2: Raw HRV + RHR composite vs personal baseline ---
  // Compute z-scores: how many standard deviations from baseline is each metric?
  // Negative HRV z-score (below baseline) = bad. Positive RHR z-score (above baseline) = bad.
  const hrvBaseline = baselines.hrvBaselineMs;
  const hrvSd = baselines.hrvStdDevMs;
  const rhrBaseline = baselines.rhrBaselineBpm;
  const rhrSd = baselines.rhrStdDevBpm;

  if (!hrvBaseline || !hrvSd || !rhrBaseline || !rhrSd) return null;

  // Recent HRV values, EWMA-weighted
  const hrvRows = dedupedMetrics.filter(m => m.hrvMs != null);
  const rhrRows = dedupedMetrics.filter(m => m.restingHrBpm != null);

  // Need at least 3 days of each to compute a meaningful recent average
  if (hrvRows.length < 3 || rhrRows.length < 3) return null;

  const ewmaAvg = (rows: WearableMetricsDaily[], field: 'hrvMs' | 'restingHrBpm'): number => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < rows.length; i++) {
      const weight = Math.exp(-decayFactor * i);
      weightedSum += (rows[i][field] as number) * weight;
      weightTotal += weight;
    }
    return weightedSum / weightTotal;
  };

  const recentHrv = ewmaAvg(hrvRows, 'hrvMs');
  const recentRhr = ewmaAvg(rhrRows, 'restingHrBpm');

  // Z-scores. Floor of 1 on stdev to prevent division-by-near-zero noise
  // for users with very stable baselines (small stdev).
  const hrvZ = (recentHrv - hrvBaseline) / Math.max(1, hrvSd);
  const rhrZ = (recentRhr - rhrBaseline) / Math.max(1, rhrSd);

  // Burnout contributions:
  //   HRV: every standard deviation BELOW baseline = 25 points of burnout
  //   RHR: every standard deviation ABOVE baseline = 25 points of burnout
  // Caps at 100 so a single catastrophic week doesn't dominate.
  const hrvContribution = Math.max(0, -hrvZ) * 25;
  const rhrContribution = Math.max(0, rhrZ) * 25;

  // Weighted blend: HRV is more sensitive (60%), RHR is more robust (40%).
  // When both move the same direction, score is high; when they diverge,
  // we average and the signal is appropriately moderated.
  const combined = (hrvContribution * 0.6) + (rhrContribution * 0.4);

  return Math.max(0, Math.min(100, combined));
}

// --- STRAIN:RECOVERY BALANCE SCORE ---
// Detects the classic overtraining / compulsive coping pattern: someone
// repeatedly hammering high training strain on days when their body is
// signalling low recovery. This is a Whoop-specific input — Whoop stores
// strain (0-21, scaled x10 in the DB so 0-210) alongside recovery (0-100,
// stored in the readinessScore field for Whoop). Oura doesn't have a strain
// equivalent, and Apple Health doesn't provide either, so this returns null
// for non-Whoop users.
//
// Why this matters for the fitness audience: this is the literal pattern
// behind every "I trained through it and got injured" story. Catching it
// proactively is a meaningful intervention point.
//
// Output: 0 (good balance) -> 100 (sustained overreaching).
function computeStrainRecoveryBalanceScore(metrics: WearableMetricsDaily[] | undefined): number | null {
  if (!metrics || metrics.length === 0) return null;

  // Only consider Whoop data — Oura readinessScore exists but has no strain
  // counterpart, so we can't compute a balance for Oura.
  const whoopMetrics = metrics.filter(m => m.provider === 'whoop' && m.strainScore != null && m.readinessScore != null);

  // Need at least 7 days of paired Whoop data to detect a sustained pattern.
  // Fewer days = could be a one-off hard week, not an overtraining pattern.
  if (whoopMetrics.length < 7) return null;

  // Sort most recent first, take last 14 days max
  const sorted = whoopMetrics
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  // Imbalance score per day: high strain (>14 on 0-21 scale, i.e. >140 in DB)
  // combined with low recovery (<50) is the danger zone.
  // Strain is stored x10 in the DB so we divide back.
  let imbalanceDays = 0;
  let totalDays = sorted.length;

  for (const day of sorted) {
    const strain = (day.strainScore as number) / 10; // back to 0-21 scale
    const recovery = day.readinessScore as number;
    // Classic Whoop "in the red" pattern: strain > 14 AND recovery < 50
    if (strain > 14 && recovery < 50) {
      imbalanceDays++;
    }
  }

  // Convert to 0-100 burnout contribution
  const imbalanceRatio = imbalanceDays / totalDays;

  // 0 imbalance days  -> score 0
  // 50% imbalance days -> score 60 (concerning pattern)
  // 100% imbalance days -> score 100 (sustained red zone — major flag)
  return Math.max(0, Math.min(100, imbalanceRatio * 100 + (imbalanceDays > 0 ? 10 : 0)));
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
    physiologicalReadiness: (v) => v > 60 ? 'Your physiology is showing significant strain — HRV suppressed and recovery scores low' : v > 30 ? 'Physiological recovery is below your personal baseline' : 'Physiological recovery is solid — your body is handling current load well',
    strainRecoveryBalance: (v) => v > 60 ? 'High training strain repeatedly hitting low recovery — classic overreaching pattern' : v > 30 ? 'Some days of high strain on low recovery — watch the trend' : 'Training strain and recovery are well balanced',
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
  physiologicalReadiness: 'Physiological Readiness',
  strainRecoveryBalance: 'Strain vs Recovery Balance',
};

const BASE_CHECKIN_KEYS = ['sleep', 'stress', 'energy', 'mood', 'clarity', 'booleans'];

// --- NOTES CONTRIBUTION ---
// Computes a small additive contribution (0 to ~2.5 points) based on the
// notes aggregate. Intentionally conservative: subjective text shouldn't
// dominate weeks of physiological data, but explicit user-reported severity
// should nudge the score. Returns 0 when aggregate is empty or absent.
//
// Triggers:
//   - Any red flag phrase across the 14-day window:     +1.5
//   - 2+ days of high-or-severe severity:               +1.0
//   - 1 day of high-or-severe severity:                 +0.5
// Max total: 2.5 points added to the final burnout score.
function computeNotesContribution(aggregate: NotesAggregate | null | undefined): number {
  if (!aggregate || aggregate.analysisCount === 0) return 0;
  let contribution = 0;
  if (aggregate.redFlagCount > 0) contribution += 1.5;
  const severeDays = aggregate.severityCounts.high + aggregate.severityCounts.severe;
  if (severeDays >= 2) contribution += 1.0;
  else if (severeDays === 1) contribution += 0.5;
  return contribution;
}

// --- PERCEIVED CONTROL CONTRIBUTION ---
// When the user reports high stress AND low perceived control, that is the
// classic learned-helplessness pattern. Meta-analyses consistently show this
// combination is a stronger burnout predictor than high stress alone.
//
// Conversely, high stress + high perceived control is just a hard week —
// a sense of agency is a documented protective factor against burnout.
//
// Triggers (only fires when the user actually answered the question, i.e.
// perceivedControlTriggerMet was true and perceivedControlScore is not null):
//
//   Stress >= 4 (high) + perceivedControl 1-2 (low):   +1.5  (learned helplessness)
//   Stress >= 4 (high) + perceivedControl 3 (moderate): +0.5  (uncertainty)
//   Stress >= 4 (high) + perceivedControl 4-5 (high):  -0.5  (agency as buffer)
//   Stress < 4:                                          0    (trigger condition not met)
//
// Output range: -0.5 to +1.5. Intentionally small relative to the 0-100 scale.
function computePerceivedControlContribution(checkIns: CheckIn[]): number {
  if (!checkIns || checkIns.length === 0) return 0;

  // Use the most recent check-in. Sorted by date descending so index 0 is newest.
  const sorted = [...checkIns].sort((a, b) => {
    const dateA = new Date(a.checkInDate).getTime();
    const dateB = new Date(b.checkInDate).getTime();
    return dateB - dateA;
  });
  const latest = sorted[0];
  if (!latest) return 0;

  const stress = latest.stressScore;
  const control = latest.perceivedControlScore;

  // Question wasn't answered — no signal to use
  if (control === null || control === undefined) return 0;
  // Stress isn't high enough for the trigger condition
  if (stress === null || stress === undefined || stress < 4) return 0;

  if (control <= 2) return 1.5;   // Learned helplessness pattern
  if (control === 3) return 0.5;  // Uncertain control
  if (control >= 4) return -0.5;  // Agency as buffer
  return 0;
}

// --- DRIVER CHRONICITY ---
// How SUSTAINED a problem is, is one of the strongest burnout signals. A single
// bad day is noise; two weeks of bad days is a pattern. This counts how many of
// the recent check-ins (14-day window) were in the "bad" zone for a given driver
// and produces a clause that names the timeframe. Only fires at >= 5 bad days so
// we never manufacture chronicity from a blip.
//
// Direction per metric (confirmed against normalizeStress / normalizeInverted):
//   stress:  bad when score >= 4 (high = bad)
//   mood/energy/sleep/clarity: bad when score <= 2 (low = bad, inverted scale)
//
// 1-5 scale throughout. Returns '' when not sustained enough or not applicable.
function computeDriverChronicity(driverKey: string, checkIns: CheckIn[]): string {
  if (!checkIns || checkIns.length === 0) return '';

  // 14-day window, most recent first
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const windowed = checkIns.filter(c => {
    const t = new Date(c.checkInDate).getTime();
    return t >= fourteenDaysAgo && t <= now;
  });
  if (windowed.length === 0) return '';

  // Map driver -> (field, isBad predicate, descriptor)
  const isHighBad = (v: number | null | undefined) => v !== null && v !== undefined && v >= 4;
  const isLowBad = (v: number | null | undefined) => v !== null && v !== undefined && v <= 2;

  let badCount = 0;
  let descriptor = '';
  switch (driverKey) {
    case 'stress':
      badCount = windowed.filter(c => isHighBad(c.stressScore)).length;
      descriptor = 'elevated';
      break;
    case 'mood':
      badCount = windowed.filter(c => isLowBad(c.moodScore)).length;
      descriptor = 'low';
      break;
    case 'energy':
      badCount = windowed.filter(c => isLowBad(c.energyScore)).length;
      descriptor = 'low';
      break;
    case 'sleep':
      badCount = windowed.filter(c => isLowBad(c.sleepScore)).length;
      descriptor = 'poor';
      break;
    case 'clarity':
      badCount = windowed.filter(c => isLowBad(c.clarityScore)).length;
      descriptor = 'low';
      break;
    default:
      return ''; // booleans and non-check-in drivers have no single-metric chronicity
  }

  // Not sustained enough to call it a pattern
  if (badCount < 5) return '';

  if (badCount >= 10) {
    return ` This has stayed ${descriptor} on ${badCount} of your last ${windowed.length} check-ins, so it has been building for most of the past two weeks.`;
  }
  return ` This has been ${descriptor} on ${badCount} of your last ${windowed.length} check-ins, a recurring pattern rather than a one-off.`;
}

// --- DRIVER NARRATIVE ENRICHMENT ---
// When the user has recurring stressor categories or recurring verbatim
// phrases across recent check-ins, splice that into the matching driver's
// explanation. This is the mechanism that turns generic "your stress is
// elevated" into specific "your stress is elevated, and you've mentioned
// work pressure in 3 of your last 5 check-ins."
//
// The base explanation already covers severity. We append a clause that
// names specific recurring patterns from the notes. Only applied when the
// driver is from check-ins (stress, energy, mood, sleep, booleans, clarity)
// because those are the ones the user is writing about.
function enrichDriverExplanation(
  baseExplanation: string,
  driverKey: string,
  aggregate: NotesAggregate | null | undefined,
  checkIns: CheckIn[],
): string {
  const checkInDriverKeys = ['stress', 'energy', 'mood', 'sleep', 'booleans', 'clarity'];
  if (!checkInDriverKeys.includes(driverKey)) return baseExplanation;

  // Chronicity leads the enrichment chain: how long > what > can you change it.
  // It is the most actionable signal because it distinguishes a blip from a trend.
  let enrichment = computeDriverChronicity(driverKey, checkIns);

  // Notes-driven enrichment (most specific signal — the user's own words).
  // Prefer recurring phrases over recurring categories over generic red-flag hint.
  if (aggregate && aggregate.analysisCount > 0) {
    if (aggregate.recurringPhrases.length > 0) {
      const top = aggregate.recurringPhrases[0];
      enrichment = ` You've described "${top}" in multiple recent check-ins.`;
    } else if (aggregate.recurringCategories.length > 0) {
      const top = aggregate.recurringCategories[0];
      enrichment = ` You've mentioned ${top} pressure in multiple recent check-ins.`;
    } else if (aggregate.redFlagCount > 0) {
      enrichment = ` Your recent notes include phrases worth paying attention to.`;
    }
  }

  // Perceived-control enrichment ONLY for the stress driver, ONLY when the
  // user answered the conditional question on the most recent check-in.
  // Layered on top of notes enrichment if present, since they complement
  // each other (notes = what is wrong, control = whether you can change it).
  if (driverKey === 'stress' && checkIns.length > 0) {
    const sorted = [...checkIns].sort((a, b) => {
      const dateA = new Date(a.checkInDate).getTime();
      const dateB = new Date(b.checkInDate).getTime();
      return dateB - dateA;
    });
    const latest = sorted[0];
    if (latest && latest.stressScore !== null && latest.stressScore !== undefined && latest.stressScore >= 4
        && latest.perceivedControlScore !== null && latest.perceivedControlScore !== undefined) {
      const control = latest.perceivedControlScore;
      if (control <= 2) {
        enrichment += ` You also reported feeling little control over what's driving this.`;
      } else if (control >= 4) {
        enrichment += ` You reported feeling mostly in control, which is a real protective factor.`;
      }
    }
  }

  return baseExplanation + enrichment;
}

// ====================================================================
// MAIN SCORING FUNCTION
// ====================================================================
// OVERALL SOURCE WEIGHTS (research rationale):
//
//   Check-ins: 50%
//     The subjective self-report IS the burnout measure. The Maslach Burnout
//     Inventory is entirely self-reported. Our check-in captures the core
//     dimensions: emotional exhaustion (stress), depletion (energy),
//     depersonalisation (mood), cognitive impairment (clarity), and
//     behavioural signals (booleans). This must dominate. Reduced from 60%
//     to 50% to make room for objective physiological signals, but still
//     the largest single source — burnout remains primarily psychological.
//
//   Physiological readiness: 18%
//     The single biggest objective signal we have. Uses provider composite
//     scores (Oura readiness / Whoop recovery) directly when present —
//     these algorithms incorporate HRV, RHR, body temp, sleep, and prior
//     strain in ways we couldn't easily replicate. For users without a
//     provider composite (Apple Health), we compute our own from raw HRV
//     and RHR vs the user's personal baseline. Gated by 14-sample
//     calibration; contributes nothing until the baseline is established.
//     This is a LEADING indicator — physiological stress often precedes
//     subjective awareness by days to weeks.
//
//   Sleep tracking: 17%
//     Sleep disruption is the strongest established physiological marker
//     of burnout. Meta-analyses show a robust bidirectional relationship.
//     Slight reduction from 20% to make room for physiological readiness;
//     the two are partially overlapping signals (Oura's readiness already
//     factors sleep) so this avoids double-counting.
//
//   Workout consistency: 7%
//     Exercise is a protective factor (resource in Conservation of Resources
//     theory). Sudden drop = withdrawal, overtraining = compulsive coping.
//     Reduced from 10% because physiological signals now catch overtraining
//     more directly via HRV/RHR.
//
//   Body map pain: 4%
//     Somatic complaints accompany burnout but pain is far from universal.
//     Slight reduction from 5% as part of overall rebalancing.
//
//   Daily activity (steps): 2%
//     Weak signal with many confounders (desk work, weather, travel).
//     Significantly reduced from 5% — raw step counts are noisy compared
//     to HRV/RHR/readiness data when available.
//
//   Strain:recovery balance: 2%
//     Whoop-only. Catches the overtraining/compulsive coping pattern when
//     high strain consistently coincides with low recovery. Small weight
//     because it only applies to Whoop users, but high diagnostic value
//     when it fires for the fitness audience.
//
// Total: 100%. Dynamic redistribution handles users with fewer sources.
// A user with only check-ins gets check-ins at effectively 100%, exactly
// the same as today's check-in-only experience.
// ====================================================================

const SOURCE_WEIGHTS = {
  checkIn: 0.50,
  physiologicalReadiness: 0.18,
  sleepTracking: 0.17,
  workoutConsistency: 0.07,
  painLoad: 0.04,
  activity: 0.02,
  strainRecoveryBalance: 0.02,
};

export function computeBurnoutScore(data: BurnoutDataSources): BurnoutResult {
  const { checkIns, workoutLogs, bodyMapLogs } = data;
  // Wearable preference: when wearable metrics exist for a date, use them as
  // the authoritative sleep/step source. Days not covered by wearables fall
  // back to manual entries so users with partial wearable coverage are not
  // penalised.
  const wearableSleep = data.wearableMetrics ? wearablesToSleepEntries(data.wearableMetrics) : [];
  const wearableSteps = data.wearableMetrics ? wearablesToStepEntries(data.wearableMetrics) : [];
  const wearableSleepDates = new Set(wearableSleep.map((e) => e.date.toISOString().slice(0, 10)));
  const wearableStepDates = new Set(wearableSteps.map((e) => e.date.toISOString().slice(0, 10)));

  const sleepEntries = [
    ...wearableSleep,
    ...((data.sleepEntries || []).filter((e) => !wearableSleepDates.has(new Date(e.date).toISOString().slice(0, 10)))),
  ];
  const stepEntries = [
    ...wearableSteps,
    ...((data.stepEntries || []).filter((e) => !wearableStepDates.has(new Date(e.date).toISOString().slice(0, 10)))),
  ];

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

  // NEW SOURCES — physiological readiness (HRV/RHR/provider composite) and
  // strain:recovery balance. Both return null when calibration or data is
  // insufficient; the dynamic weight redistribution will then exclude them.
  const physiologicalReadinessScore = computePhysiologicalReadinessScore(data.wearableMetrics, data.baselines);
  const strainRecoveryBalanceScore = computeStrainRecoveryBalanceScore(data.wearableMetrics);

  // Increment dataSourceCount for new sources that contributed
  if (physiologicalReadinessScore !== null) dataSourceCount++;
  if (strainRecoveryBalanceScore !== null) dataSourceCount++;

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
  if (physiologicalReadinessScore !== null) { activeWeights['physiologicalReadiness'] = SOURCE_WEIGHTS.physiologicalReadiness; totalActiveWeight += SOURCE_WEIGHTS.physiologicalReadiness; }
  if (sleepTrackingScore !== null) { activeWeights['sleepTracking'] = SOURCE_WEIGHTS.sleepTracking; totalActiveWeight += SOURCE_WEIGHTS.sleepTracking; }
  if (workoutScore !== null) { activeWeights['workoutConsistency'] = SOURCE_WEIGHTS.workoutConsistency; totalActiveWeight += SOURCE_WEIGHTS.workoutConsistency; }
  if (painScore !== null) { activeWeights['painLoad'] = SOURCE_WEIGHTS.painLoad; totalActiveWeight += SOURCE_WEIGHTS.painLoad; }
  if (activityScore !== null) { activeWeights['activity'] = SOURCE_WEIGHTS.activity; totalActiveWeight += SOURCE_WEIGHTS.activity; }
  if (strainRecoveryBalanceScore !== null) { activeWeights['strainRecoveryBalance'] = SOURCE_WEIGHTS.strainRecoveryBalance; totalActiveWeight += SOURCE_WEIGHTS.strainRecoveryBalance; }

  if (totalActiveWeight > 0) {
    const scale = 1 / totalActiveWeight;
    for (const key of Object.keys(activeWeights)) {
      activeWeights[key] *= scale;
    }
  }

  // --- Weighted final score ---
  let finalScore = 0;
  if (hasCheckIns) finalScore += checkInWeightedScore * (activeWeights['checkIn'] || 0);
  if (physiologicalReadinessScore !== null) finalScore += physiologicalReadinessScore * (activeWeights['physiologicalReadiness'] || 0);
  if (sleepTrackingScore !== null) finalScore += sleepTrackingScore * (activeWeights['sleepTracking'] || 0);
  if (workoutScore !== null) finalScore += workoutScore * (activeWeights['workoutConsistency'] || 0);
  if (painScore !== null) finalScore += painScore * (activeWeights['painLoad'] || 0);
  if (activityScore !== null) finalScore += activityScore * (activeWeights['activity'] || 0);
  if (strainRecoveryBalanceScore !== null) finalScore += strainRecoveryBalanceScore * (activeWeights['strainRecoveryBalance'] || 0);

  // Apply the small notes contribution AFTER weighted source computation.
  // It's additive (not weighted) because it represents explicit user-reported
  // severity that should escalate the score, not be redistributed by the
  // dynamic weight logic.
  const notesContribution = computeNotesContribution(data.notesAggregate);
  finalScore += notesContribution;

  // Perceived control nudge: small adjustment based on the learned-helplessness
  // pattern (high stress + low perceived control). Conservative — max +1.5/-0.5
  // out of 100. Applied additively, not via weighted source logic, because it
  // reflects an explicit user-reported state that should escalate or buffer
  // the score directly.
  const perceivedControlContribution = computePerceivedControlContribution(data.checkIns);
  finalScore += perceivedControlContribution;

  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)));

  // --- Debug logging ---
  console.log('[Burnout Engine] Source scores:', {
    checkIn: hasCheckIns ? Math.round(checkInWeightedScore) : 'N/A',
    physiologicalReadiness: physiologicalReadinessScore !== null ? Math.round(physiologicalReadinessScore) : 'N/A',
    sleepTracking: sleepTrackingScore !== null ? Math.round(sleepTrackingScore) : 'N/A',
    workout: workoutScore !== null ? Math.round(workoutScore) : 'N/A',
    pain: painScore !== null ? Math.round(painScore) : 'N/A',
    activity: activityScore !== null ? Math.round(activityScore) : 'N/A',
    strainRecoveryBalance: strainRecoveryBalanceScore !== null ? Math.round(strainRecoveryBalanceScore) : 'N/A',
    finalScore,
    dataSourceCount,
    baselineCalibrated: data.baselines?.isCalibrated ?? false,
    notesContribution: notesContribution.toFixed(2),
    notesAnalysisCount: data.notesAggregate?.analysisCount ?? 0,
    notesRedFlags: data.notesAggregate?.redFlagCount ?? 0,
    perceivedControlContribution: perceivedControlContribution.toFixed(2),
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

  if (physiologicalReadinessScore !== null) {
    allDriverComponents['physiologicalReadiness'] = physiologicalReadinessScore;
    allDriverWeights['physiologicalReadiness'] = activeWeights['physiologicalReadiness'] || 0;
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
  if (strainRecoveryBalanceScore !== null) {
    allDriverComponents['strainRecoveryBalance'] = strainRecoveryBalanceScore;
    allDriverWeights['strainRecoveryBalance'] = activeWeights['strainRecoveryBalance'] || 0;
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
    const baseExplanation = getDriverExplanation(key, allDriverComponents[key]);
    return {
      key,
      label: DRIVER_LABELS[key] || key,
      explanation: enrichDriverExplanation(baseExplanation, key, data.notesAggregate, data.checkIns),
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
