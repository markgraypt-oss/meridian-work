import { db } from "./db";
import { burnoutCalibrationEvents, burnoutScores, physiologicalSnapshots, userPhysiologicalBaselines, wearableMetricsDaily } from "@shared/schema";
import { eq, desc, and, gte, count } from "drizzle-orm";

export function getLevel(score: number): string {
  if (score <= 20) return 'optimal';
  if (score <= 40) return 'balanced';
  if (score <= 60) return 'strained';
  if (score <= 80) return 'overloaded';
  return 'sustained_overload';
}

export async function trackCalibrationEvent(
  userId: string,
  newScore: number,
  newTrajectory: string,
  dataSourceCount: number
): Promise<void> {
  try {
    const previousScores = await db
      .select()
      .from(burnoutScores)
      .where(eq(burnoutScores.userId, userId))
      .orderBy(desc(burnoutScores.computedDate))
      .limit(2);

    if (previousScores.length < 2) return;

    const previous = previousScores[1];
    const previousLevel = getLevel(previous.score);
    const newLevel = getLevel(newScore);

    if (previousLevel !== newLevel) {
      const recentHistory = await db
        .select()
        .from(burnoutScores)
        .where(eq(burnoutScores.userId, userId))
        .orderBy(desc(burnoutScores.computedDate))
        .limit(60);

      let consecutiveDays = 0;
      for (const s of recentHistory) {
        if (getLevel(s.score) === previousLevel) {
          consecutiveDays++;
        } else {
          break;
        }
      }

      const daysInLevel = Math.max(consecutiveDays, 1);

      await db.insert(burnoutCalibrationEvents).values({
        userId,
        eventType: 'level_transition',
        fromLevel: previousLevel,
        toLevel: newLevel,
        fromScore: previous.score,
        toScore: newScore,
        daysInLevel,
        metadata: { trajectory: newTrajectory, dataSourceCount },
      });
    }

    // Sustained high detection: 14+ consecutive days above 60.
    // Burnout is a chronic condition (Maslach & Leiter, 2016) that develops
    // over weeks, not days. A 5-day threshold would catch acute stress spikes
    // (project deadlines, busy weeks) that resolve naturally. 14 days ensures
    // we're detecting genuine sustained overload patterns.
    const recentScores = await db
      .select()
      .from(burnoutScores)
      .where(eq(burnoutScores.userId, userId))
      .orderBy(desc(burnoutScores.computedDate))
      .limit(21);

    if (recentScores.length >= 14) {
      const allHigh = recentScores.slice(0, 14).every(s => s.score > 60);
      if (allHigh) {
        const existingSustained = await db
          .select({ ct: count() })
          .from(burnoutCalibrationEvents)
          .where(
            and(
              eq(burnoutCalibrationEvents.userId, userId),
              eq(burnoutCalibrationEvents.eventType, 'sustained_high'),
              gte(burnoutCalibrationEvents.createdAt, new Date(Date.now() - 21 * 24 * 60 * 60 * 1000))
            )
          );

        if ((existingSustained[0]?.ct || 0) === 0) {
          await db.insert(burnoutCalibrationEvents).values({
            userId,
            eventType: 'sustained_high',
            fromScore: recentScores[13].score,
            toScore: newScore,
            fromLevel: getLevel(recentScores[13].score),
            toLevel: newLevel,
            daysInLevel: 14,
            metadata: { trajectory: newTrajectory, consecutiveHighDays: 14 },
          });
        }
      }
    }

    // Rapid improvement detection: 20+ point drop over 7 days.
    // Genuine recovery from burnout-level stress needs at least a week of
    // sustained improvement to be meaningful, not a 3-day fluctuation.
    if (recentScores.length >= 7) {
      const scoreDrop = recentScores[6].score - recentScores[0].score;
      if (scoreDrop >= 20) {
        const existingImprovement = await db
          .select({ ct: count() })
          .from(burnoutCalibrationEvents)
          .where(
            and(
              eq(burnoutCalibrationEvents.userId, userId),
              eq(burnoutCalibrationEvents.eventType, 'rapid_improvement'),
              gte(burnoutCalibrationEvents.createdAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
            )
          );

        if ((existingImprovement[0]?.ct || 0) === 0) {
          await db.insert(burnoutCalibrationEvents).values({
            userId,
            eventType: 'rapid_improvement',
            fromScore: recentScores[6].score,
            toScore: recentScores[0].score,
            fromLevel: getLevel(recentScores[6].score),
            toLevel: getLevel(recentScores[0].score),
            daysInLevel: 7,
            metadata: { trajectory: newTrajectory, scoreDrop },
          });
        }
      }
    }
  } catch (error) {
    console.error("[Calibration] Error tracking event:", error);
  }
}

export async function trackRecoveryModeActivation(
  userId: string,
  currentScore: number
): Promise<void> {
  try {
    await db.insert(burnoutCalibrationEvents).values({
      userId,
      eventType: 'recovery_mode_activated',
      fromScore: currentScore,
      fromLevel: getLevel(currentScore),
      toLevel: getLevel(currentScore),
      toScore: currentScore,
      metadata: { activatedAtScore: currentScore },
    });
  } catch (error) {
    console.error("[Calibration] Error tracking recovery mode:", error);
  }
}

interface CalibrationReport {
  totalEvents: number;
  eventsByType: Record<string, number>;
  transitionMatrix: Record<string, Record<string, number>>;
  avgDaysBeforeEscalation: number | null;
  avgDaysBeforeDeescalation: number | null;
  recoveryModeEffectiveness: {
    activations: number;
    improvedAfter: number;
    worsenedAfter: number;
    stableAfter: number;
    effectivenessRate: number | null;
  };
  levelStability: Record<string, { avgDaysInLevel: number; escalationRate: number; deescalationRate: number; totalTransitions: number }>;
  thresholdAlerts: string[];
}

export async function generateCalibrationReport(): Promise<CalibrationReport> {
  const allEvents = await db
    .select()
    .from(burnoutCalibrationEvents)
    .orderBy(desc(burnoutCalibrationEvents.createdAt));

  const eventsByType: Record<string, number> = {};
  const transitionMatrix: Record<string, Record<string, number>> = {};
  const escalationDays: number[] = [];
  const deescalationDays: number[] = [];
  const levelDays: Record<string, number[]> = {};
  const levelEscalations: Record<string, number> = {};
  const levelDeescalations: Record<string, number> = {};
  const levelTotalTransitions: Record<string, number> = {};
  const levels = ['optimal', 'balanced', 'strained', 'overloaded', 'sustained_overload'];

  for (const level of levels) {
    transitionMatrix[level] = {};
    levelDays[level] = [];
    levelEscalations[level] = 0;
    levelDeescalations[level] = 0;
    levelTotalTransitions[level] = 0;
    for (const l2 of levels) {
      transitionMatrix[level][l2] = 0;
    }
  }

  for (const event of allEvents) {
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

    if (event.eventType === 'level_transition' && event.fromLevel && event.toLevel) {
      if (transitionMatrix[event.fromLevel]) {
        transitionMatrix[event.fromLevel][event.toLevel] = (transitionMatrix[event.fromLevel][event.toLevel] || 0) + 1;
      }

      const fromIdx = levels.indexOf(event.fromLevel);
      const toIdx = levels.indexOf(event.toLevel);
      if (fromIdx >= 0 && toIdx >= 0) {
        levelTotalTransitions[event.fromLevel] = (levelTotalTransitions[event.fromLevel] || 0) + 1;
        if (toIdx > fromIdx) {
          escalationDays.push(event.daysInLevel || 1);
          levelEscalations[event.fromLevel] = (levelEscalations[event.fromLevel] || 0) + 1;
        } else {
          deescalationDays.push(event.daysInLevel || 1);
          levelDeescalations[event.fromLevel] = (levelDeescalations[event.fromLevel] || 0) + 1;
        }
        if (event.daysInLevel) {
          levelDays[event.fromLevel].push(event.daysInLevel);
        }
      }
    }
  }

  const recoveryActivations = allEvents.filter(e => e.eventType === 'recovery_mode_activated');
  let improvedAfter = 0;
  let worsenedAfter = 0;
  let stableAfter = 0;

  for (const activation of recoveryActivations) {
    const laterTransitions = allEvents.filter(e =>
      e.eventType === 'level_transition' &&
      e.userId === activation.userId &&
      e.createdAt && activation.createdAt &&
      new Date(e.createdAt) > new Date(activation.createdAt)
    );

    if (laterTransitions.length > 0) {
      const next = laterTransitions[laterTransitions.length - 1];
      if (next.toScore !== null && activation.fromScore !== null) {
        if ((next.toScore ?? 0) < (activation.fromScore ?? 0) - 5) improvedAfter++;
        else if ((next.toScore ?? 0) > (activation.fromScore ?? 0) + 5) worsenedAfter++;
        else stableAfter++;
      }
    }
  }

  const levelStability: Record<string, { avgDaysInLevel: number; escalationRate: number; deescalationRate: number; totalTransitions: number }> = {};
  for (const level of levels) {
    const days = levelDays[level];
    const avgDays = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    const total = levelTotalTransitions[level] || 0;
    levelStability[level] = {
      avgDaysInLevel: avgDays,
      escalationRate: total > 0 ? Math.round((levelEscalations[level] / total) * 100) : 0,
      deescalationRate: total > 0 ? Math.round((levelDeescalations[level] / total) * 100) : 0,
      totalTransitions: total,
    };
  }

  const thresholdAlerts: string[] = [];

  if (levelStability['balanced']?.escalationRate > 60 && levelStability['balanced']?.totalTransitions >= 5) {
    thresholdAlerts.push('High escalation rate from Balanced level (>60%). Consider lowering the Balanced/Strained threshold from 40 to capture early warning signs sooner.');
  }

  if (levelStability['strained']?.deescalationRate < 20 && levelStability['strained']?.totalTransitions >= 5) {
    thresholdAlerts.push('Low de-escalation rate from Strained level (<20%). Users may be getting stuck. Consider whether interventions at this level are sufficient.');
  }

  if (levelStability['overloaded']?.avgDaysInLevel > 14 && levelStability['overloaded']?.totalTransitions >= 3) {
    thresholdAlerts.push('Users spend 14+ days in Overloaded level on average. Consider earlier intervention triggers or more aggressive recovery recommendations at this level.');
  }

  const recoveryEffectiveness = recoveryActivations.length > 0
    ? Math.round((improvedAfter / recoveryActivations.length) * 100)
    : null;

  if (recoveryEffectiveness !== null && recoveryEffectiveness < 40 && recoveryActivations.length >= 3) {
    thresholdAlerts.push(`Recovery Mode effectiveness is ${recoveryEffectiveness}% (below 40%). The recovery interventions may need strengthening.`);
  }

  return {
    totalEvents: allEvents.length,
    eventsByType,
    transitionMatrix,
    avgDaysBeforeEscalation: escalationDays.length > 0
      ? Math.round(escalationDays.reduce((a, b) => a + b, 0) / escalationDays.length)
      : null,
    avgDaysBeforeDeescalation: deescalationDays.length > 0
      ? Math.round(deescalationDays.reduce((a, b) => a + b, 0) / deescalationDays.length)
      : null,
    recoveryModeEffectiveness: {
      activations: recoveryActivations.length,
      improvedAfter,
      worsenedAfter,
      stableAfter,
      effectivenessRate: recoveryEffectiveness,
    },
    levelStability,
    thresholdAlerts,
  };
}


// ====================================================================
// PHYSIOLOGICAL SNAPSHOT WRITER (Phase 1c)
// ====================================================================
// Writes one snapshot per burnout computation into physiological_snapshots.
// Self-contained: fetches its own baselines + recent wearable metrics and
// computes HRV/RHR z-scores using the SAME method as the burnout engine
// (7-day window, EWMA weighting, z = (recent - baseline) / max(1, sd),
// provider dedup by priority). Kept independent of the engine so we never
// have to reshape the engine's return type.
//
// Warning thresholds (conservative, tunable once calibration data accrues):
//   HRV z <= -1.5  -> "hrv_suppressed"  (HRV well below personal baseline)
//   RHR z >= +1.5  -> "rhr_elevated"    (RHR well above personal baseline)
// warningFired is true if either flag is present.

const WEARABLE_PRIORITY_SNAPSHOT: Record<string, number> = {
  oura: 4, whoop: 3, apple_health: 2, google_fit: 1,
};

function ewmaAverage(values: number[], decayFactor = 0.15): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < values.length; i++) {
    const weight = Math.exp(-decayFactor * i);
    weightedSum += values[i] * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

export async function writePhysiologicalSnapshot(
  userId: string,
  score: number,
  tier: string,
): Promise<void> {
  try {
    // Fetch baselines
    const [baseline] = await db
      .select()
      .from(userPhysiologicalBaselines)
      .where(eq(userPhysiologicalBaselines.userId, userId))
      .limit(1);

    const baselineCalibrated = !!(baseline && baseline.isCalibrated);

    let hrvZScore: number | null = null;
    let rhrZScore: number | null = null;
    const warningFlags: string[] = [];

    if (baselineCalibrated && baseline) {
      // Last 7 days of wearable metrics for this user
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffStr = sevenDaysAgo.toISOString().slice(0, 10);

      const metrics = await db
        .select()
        .from(wearableMetricsDaily)
        .where(and(
          eq(wearableMetricsDaily.userId, userId),
          gte(wearableMetricsDaily.date, cutoffStr),
        ))
        .orderBy(desc(wearableMetricsDaily.date));

      // Dedupe by date, keeping highest-priority provider (matches engine logic)
      const byDate = new Map<string, typeof metrics[number]>();
      for (const m of metrics) {
        const cur = byDate.get(m.date);
        if (!cur || (WEARABLE_PRIORITY_SNAPSHOT[m.provider] || 0) > (WEARABLE_PRIORITY_SNAPSHOT[cur.provider] || 0)) {
          byDate.set(m.date, m);
        }
      }
      const deduped = Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));

      // HRV z-score
      const hrvVals = deduped.filter(m => m.hrvMs != null).map(m => m.hrvMs as number);
      if (hrvVals.length >= 3 && baseline.hrvBaselineMs && baseline.hrvStdDevMs) {
        const recentHrv = ewmaAverage(hrvVals);
        hrvZScore = (recentHrv - baseline.hrvBaselineMs) / Math.max(1, baseline.hrvStdDevMs);
        if (hrvZScore <= -1.5) warningFlags.push('hrv_suppressed');
      }

      // RHR z-score
      const rhrVals = deduped.filter(m => m.restingHrBpm != null).map(m => m.restingHrBpm as number);
      if (rhrVals.length >= 3 && baseline.rhrBaselineBpm && baseline.rhrStdDevBpm) {
        const recentRhr = ewmaAverage(rhrVals);
        rhrZScore = (recentRhr - baseline.rhrBaselineBpm) / Math.max(1, baseline.rhrStdDevBpm);
        if (rhrZScore >= 1.5) warningFlags.push('rhr_elevated');
      }
    }

    await db.insert(physiologicalSnapshots).values({
      userId,
      hrvZScore,
      rhrZScore,
      baselineCalibrated,
      warningFired: warningFlags.length > 0,
      warningFlags,
      score,
      tier,
    });
  } catch (error) {
    console.error("[Calibration] Error writing physiological snapshot:", error);
  }
}

// ===========================================================================
// PHASE 1c STEP 3 — Early-warning validity
// ===========================================================================
//
// For each warning fired in physiological_snapshots, look forward 14 days for
// a tier escalation in burnout_calibration_events. Bucket as TP/FP/TN/FN, then
// compute precision, recall, and median lead time. Returns null metrics with
// an `insufficientData` explanation when the cohort isn't large enough yet —
// no fake numbers. This is the backward-looking proof system that validates
// the early-warning mechanism actually warns BEFORE escalation, not after.

const WINDOW_DAYS = 14;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

interface FlagStats {
  warnings: number;
  truePositives: number;
  falsePositives: number;
  precision: number | null;
}

interface ValidityReport {
  windowDays: number;
  generatedAt: string;
  totalSnapshots: number;
  totalWarnings: number;
  totalEscalations: number;
  buckets: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
  metrics: {
    precision: number | null;
    recall: number | null;
    medianLeadTimeDays: number | null;
  };
  byFlag: {
    hrv_suppressed: FlagStats;
    rhr_elevated: FlagStats;
    both: FlagStats;
  };
  insufficientData: {
    precision: string | null;
    recall: string | null;
    leadTime: string | null;
  };
}

const tierOrder: Record<string, number> = {
  optimal: 0,
  balanced: 1,
  strained: 2,
  overloaded: 3,
  sustained_overload: 4,
};

function isEscalation(fromTier: string, toTier: string): boolean {
  const from = tierOrder[fromTier];
  const to = tierOrder[toTier];
  if (from === undefined || to === undefined) return false;
  return to > from;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function computeEarlyWarningValidity(): Promise<ValidityReport> {
  // Pull all snapshots + all level-transition escalations across all users.
  // Indexed in memory by userId so we look forward efficiently per warning.
  const allSnapshots = await db
    .select()
    .from(physiologicalSnapshots)
    .orderBy(physiologicalSnapshots.computedAt);

  const allTransitions = await db
    .select()
    .from(burnoutCalibrationEvents)
    .where(eq(burnoutCalibrationEvents.eventType, 'level_transition'));

  // Filter to actual escalations (toTier worse than fromTier)
  const escalations = allTransitions.filter((e: any) =>
    e.fromLevel && e.toLevel && isEscalation(e.fromLevel, e.toLevel)
  );

  // Group escalations by userId for fast forward-lookup
  const escByUser: Record<string, any[]> = {};
  for (const e of escalations) {
    if (!e.userId || !e.createdAt) continue;
    (escByUser[e.userId] ||= []).push(e);
  }
  // Sort each user's escalations chronologically
  for (const uid in escByUser) {
    escByUser[uid].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;
  const leadTimes: number[] = [];

  const byFlag = {
    hrv_suppressed: { warnings: 0, truePositives: 0, falsePositives: 0, precision: null as number | null },
    rhr_elevated:  { warnings: 0, truePositives: 0, falsePositives: 0, precision: null as number | null },
    both:          { warnings: 0, truePositives: 0, falsePositives: 0, precision: null as number | null },
  };

  // Track which escalations were "caught" by at least one warning, so we can
  // compute recall against escalations that no warning preceded (FN).
  const caughtEscalationIds = new Set<number>();

  for (const snap of allSnapshots) {
    const userId = (snap as any).userId;
    const computedAt = (snap as any).computedAt;
    if (!userId || !computedAt) continue;

    const snapTime = new Date(computedAt).getTime();
    const windowEnd = snapTime + WINDOW_MS;
    const userEscalations = escByUser[userId] || [];
    const escalationInWindow = userEscalations.find((e) => {
      const t = new Date(e.createdAt).getTime();
      return t > snapTime && t <= windowEnd;
    });

    if ((snap as any).warningFired) {
      // Per-flag counting
      const flags = Array.isArray((snap as any).warningFlags) ? (snap as any).warningFlags : [];
      const hasHrv = flags.includes('hrv_suppressed');
      const hasRhr = flags.includes('rhr_elevated');
      if (hasHrv && hasRhr) byFlag.both.warnings++;
      else if (hasHrv) byFlag.hrv_suppressed.warnings++;
      else if (hasRhr) byFlag.rhr_elevated.warnings++;

      if (escalationInWindow) {
        tp++;
        caughtEscalationIds.add(escalationInWindow.id);
        const leadDays = (new Date(escalationInWindow.createdAt).getTime() - snapTime) / (1000 * 60 * 60 * 24);
        leadTimes.push(leadDays);
        if (hasHrv && hasRhr) byFlag.both.truePositives++;
        else if (hasHrv) byFlag.hrv_suppressed.truePositives++;
        else if (hasRhr) byFlag.rhr_elevated.truePositives++;
      } else {
        fp++;
        if (hasHrv && hasRhr) byFlag.both.falsePositives++;
        else if (hasHrv) byFlag.hrv_suppressed.falsePositives++;
        else if (hasRhr) byFlag.rhr_elevated.falsePositives++;
      }
    } else {
      if (escalationInWindow) {
        fn++;
        // Don't mark as caught — this is a miss.
      } else {
        tn++;
      }
    }
  }

  // Compute per-flag precision
  for (const k of Object.keys(byFlag) as Array<keyof typeof byFlag>) {
    const fs = byFlag[k];
    fs.precision = (fs.truePositives + fs.falsePositives) > 0
      ? +(fs.truePositives / (fs.truePositives + fs.falsePositives)).toFixed(3)
      : null;
  }

  const totalWarnings = tp + fp;
  const totalEscalations = escalations.length;

  const precision = totalWarnings > 0 ? +(tp / totalWarnings).toFixed(3) : null;
  // Recall = of all escalations that occurred, how many were preceded by a warning?
  const recall = totalEscalations > 0 ? +(tp / (tp + fn)).toFixed(3) : null;
  const medianLeadTimeDays = leadTimes.length > 0 ? +median(leadTimes)!.toFixed(2) : null;

  return {
    windowDays: WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    totalSnapshots: allSnapshots.length,
    totalWarnings,
    totalEscalations,
    buckets: { truePositives: tp, falsePositives: fp, trueNegatives: tn, falseNegatives: fn },
    metrics: { precision, recall, medianLeadTimeDays },
    byFlag,
    insufficientData: {
      precision: precision === null ? 'no warnings fired yet' : null,
      recall: recall === null ? 'no tier escalations recorded yet' : null,
      leadTime: medianLeadTimeDays === null ? 'no true positives yet' : null,
    },
  };
}
