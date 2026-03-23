import { db } from "./db";
import { burnoutCalibrationEvents, burnoutScores } from "@shared/schema";
import { eq, desc, and, gte, count } from "drizzle-orm";

function getLevel(score: number): string {
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
