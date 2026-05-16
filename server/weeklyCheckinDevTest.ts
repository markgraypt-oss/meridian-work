/**
 * Dev-only: synthetic weekly check-in payload generator.
 *
 * Produces WeeklyCheckinPayloadV2 objects from fixed in-memory fixtures —
 * zero DB reads, zero DB writes, zero user data touched.
 *
 * NOT imported anywhere in production paths. The route that calls this
 * is gated behind NODE_ENV !== "production".
 */

import {
  generatePatternsNarrative,
  getIsoWeekStart,
  getPreviousIsoWeekStart,
  type WeeklyCheckinPayloadV2,
  type LegacyMetrics,
} from "./weeklyCheckin";

export type DevScenario =
  | "connected"
  | "unconnected"
  | "sparse"
  | "claude_failure";

interface PromptData {
  checkInCount: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  roughDaysCount: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  adherencePct: number | null;
  avgSleepHours: number | null;
  sleepSource: "wearable" | "manual" | null;
  activeBodyAreas: string[];
  nutritionDaysTracked: number;
  goalsOnTrackCount: number;
  goalsTotalCount: number;
  habitsWithCompletions: number;
  burnoutTrajectory: string | null;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURES: Record<DevScenario, {
  promptData: PromptData;
  cards: WeeklyCheckinPayloadV2["cards"];
  metrics: LegacyMetrics;
}> = {
  // Scenario 1: user with a connected wearable — rich data, all cards present
  connected: {
    promptData: {
      checkInCount: 5,
      avgMood: 3.8,
      avgEnergy: 3.2,
      avgStress: 2.9,
      roughDaysCount: 1,
      sessionsCompleted: 3,
      sessionsPlanned: 4,
      adherencePct: 75,
      avgSleepHours: 7.2,
      sleepSource: "wearable",
      activeBodyAreas: ["lower back"],
      nutritionDaysTracked: 5,
      goalsOnTrackCount: 2,
      goalsTotalCount: 3,
      habitsWithCompletions: 2,
      burnoutTrajectory: "slight improvement",
    },
    cards: {
      howYouFelt: { checkInCount: 5, avgMood: 3.8, avgEnergy: 3.2, avgStress: 2.9, roughDaysCount: 1 },
      howYouMoved: { sessionsCompleted: 3, sessionsPlanned: 4, adherencePct: 75 },
      goals: {
        items: [
          { title: "Run 5k without stopping", progressPct: 60, isCompleted: false },
          { title: "Meditate daily", progressPct: 85, isCompleted: false },
          { title: "Drink 2L water daily", progressPct: 40, isCompleted: false },
        ],
      },
      habits: {
        items: [
          { title: "Morning stretch", completionsThisWeek: 4, targetDaysThisWeek: 5 },
          { title: "Phone-free first hour", completionsThisWeek: 3, targetDaysThisWeek: 7 },
        ],
      },
      lifestyle: { avgSleepHours: 7.2, sleepSource: "wearable", roughDaysCount: 1 },
      bodyStatus: {
        areas: [
          { bodyPart: "Lower back", status: "chronic" },
        ],
      },
      nutrition: { daysTracked: 5, mealsLogged: 13 },
    },
    metrics: {
      burnout: { score: 42, trajectory: "slight improvement", previousScore: 48, delta: -6 },
      bodyMap: { activeCount: 1, newCount: 0, resolvedCount: 0, topAreas: ["Lower back"] },
      training: { sessionsCompleted: 3, sessionsPlanned: 4, sessionsMissed: 1, adherencePct: 75, totalVolumeKg: 4200, previousVolumeKg: 3800 },
      nutrition: { mealsLogged: 13, daysWithMeals: 5, targetDays: 7 },
      checkIns: { count: 5, avgMood: 3.8, avgEnergy: 3.2, avgStress: 2.9 },
    },
  },

  // Scenario 2: unconnected user — manual sleep only, no wearable, no goals/habits
  unconnected: {
    promptData: {
      checkInCount: 3,
      avgMood: 3.5,
      avgEnergy: 3.0,
      avgStress: 2.5,
      roughDaysCount: 0,
      sessionsCompleted: 2,
      sessionsPlanned: 0,
      adherencePct: null,
      avgSleepHours: 6.8,
      sleepSource: "manual",
      activeBodyAreas: [],
      nutritionDaysTracked: 1,
      goalsOnTrackCount: 0,
      goalsTotalCount: 0,
      habitsWithCompletions: 0,
      burnoutTrajectory: null,
    },
    cards: {
      howYouFelt: { checkInCount: 3, avgMood: 3.5, avgEnergy: 3.0, avgStress: 2.5, roughDaysCount: 0 },
      howYouMoved: { sessionsCompleted: 2, sessionsPlanned: 0, adherencePct: null },
      lifestyle: { avgSleepHours: 6.8, sleepSource: "manual", roughDaysCount: 0 },
      // no goals, habits, bodyStatus, nutrition (< 3 days tracked)
    },
    metrics: {
      burnout: { score: null, trajectory: null, previousScore: null, delta: null },
      bodyMap: { activeCount: 0, newCount: 0, resolvedCount: 0, topAreas: [] },
      training: { sessionsCompleted: 2, sessionsPlanned: 0, sessionsMissed: 0, adherencePct: null, totalVolumeKg: 1800, previousVolumeKg: null },
      nutrition: { mealsLogged: 2, daysWithMeals: 1, targetDays: 7 },
      checkIns: { count: 3, avgMood: 3.5, avgEnergy: 3.0, avgStress: 2.5 },
    },
  },

  // Scenario 3: sparse user — no check-ins, no sessions, no sleep, no goals/habits/body/nutrition
  sparse: {
    promptData: {
      checkInCount: 0,
      avgMood: null,
      avgEnergy: null,
      avgStress: null,
      roughDaysCount: 0,
      sessionsCompleted: 0,
      sessionsPlanned: 0,
      adherencePct: null,
      avgSleepHours: null,
      sleepSource: null,
      activeBodyAreas: [],
      nutritionDaysTracked: 0,
      goalsOnTrackCount: 0,
      goalsTotalCount: 0,
      habitsWithCompletions: 0,
      burnoutTrajectory: null,
    },
    cards: {
      // All cards absent — only patterns will render
    },
    metrics: {
      burnout: { score: null, trajectory: null, previousScore: null, delta: null },
      bodyMap: { activeCount: 0, newCount: 0, resolvedCount: 0, topAreas: [] },
      training: { sessionsCompleted: 0, sessionsPlanned: 0, sessionsMissed: 0, adherencePct: null, totalVolumeKg: 0, previousVolumeKg: null },
      nutrition: { mealsLogged: 0, daysWithMeals: 0, targetDays: 7 },
      checkIns: { count: 0, avgMood: null, avgEnergy: null, avgStress: null },
    },
  },

  // Scenario 4: claude_failure — same data as "connected" but AI call will be forced to fail
  // (handled at generation time, not in fixtures)
  claude_failure: {
    promptData: {
      checkInCount: 5,
      avgMood: 3.8,
      avgEnergy: 3.2,
      avgStress: 2.9,
      roughDaysCount: 1,
      sessionsCompleted: 3,
      sessionsPlanned: 4,
      adherencePct: 75,
      avgSleepHours: 7.2,
      sleepSource: "wearable",
      activeBodyAreas: ["lower back"],
      nutritionDaysTracked: 5,
      goalsOnTrackCount: 2,
      goalsTotalCount: 3,
      habitsWithCompletions: 2,
      burnoutTrajectory: "slight improvement",
    },
    cards: {
      howYouFelt: { checkInCount: 5, avgMood: 3.8, avgEnergy: 3.2, avgStress: 2.9, roughDaysCount: 1 },
      howYouMoved: { sessionsCompleted: 3, sessionsPlanned: 4, adherencePct: 75 },
      goals: {
        items: [
          { title: "Run 5k without stopping", progressPct: 60, isCompleted: false },
          { title: "Meditate daily", progressPct: 85, isCompleted: false },
          { title: "Drink 2L water daily", progressPct: 40, isCompleted: false },
        ],
      },
      habits: {
        items: [
          { title: "Morning stretch", completionsThisWeek: 4, targetDaysThisWeek: 5 },
          { title: "Phone-free first hour", completionsThisWeek: 3, targetDaysThisWeek: 7 },
        ],
      },
      lifestyle: { avgSleepHours: 7.2, sleepSource: "wearable", roughDaysCount: 1 },
      bodyStatus: {
        areas: [
          { bodyPart: "Lower back", status: "chronic" },
        ],
      },
      nutrition: { daysTracked: 5, mealsLogged: 13 },
    },
    metrics: {
      burnout: { score: 42, trajectory: "slight improvement", previousScore: 48, delta: -6 },
      bodyMap: { activeCount: 1, newCount: 0, resolvedCount: 0, topAreas: ["Lower back"] },
      training: { sessionsCompleted: 3, sessionsPlanned: 4, sessionsMissed: 1, adherencePct: 75, totalVolumeKg: 4200, previousVolumeKg: 3800 },
      nutrition: { mealsLogged: 13, daysWithMeals: 5, targetDays: 7 },
      checkIns: { count: 5, avgMood: 3.8, avgEnergy: 3.2, avgStress: 2.9 },
    },
  },
};

// ── Generator ─────────────────────────────────────────────────────────────────

export async function buildSyntheticPayloadV2(
  scenario: DevScenario,
): Promise<WeeklyCheckinPayloadV2> {
  const weekStart = getIsoWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const fixture = FIXTURES[scenario];
  const { promptData, cards, metrics } = fixture;

  let patternsCard: WeeklyCheckinPayloadV2["cards"]["patterns"];

  if (scenario === "claude_failure") {
    // Force the fallback path — no AI call made at all
    patternsCard = {
      narrative: "This week: 5 check-ins logged, avg mood 3.8/5, 3 training sessions completed, avg 7.2h sleep per night, nutrition tracked 5 days.",
      bulletPoints: [],
      isAI: false,
      generatedAt: new Date().toISOString(),
    };
  } else {
    // Real AI call with synthetic prompt data — no userId → logs as null
    const result = await generatePatternsNarrative(
      promptData,
      weekStart,
      weekEnd,
      null as any,
    );
    patternsCard = {
      narrative: result.narrative,
      bulletPoints: result.bulletPoints,
      isAI: result.isAI,
      generatedAt: new Date().toISOString(),
    };
  }

  // Hero is always the patterns narrative sentence
  const hero = patternsCard.narrative;

  // trajectoryLabel: derive from AI result or fallback
  let trajectoryLabel: WeeklyCheckinPayloadV2["trajectoryLabel"] = "not enough data";
  if (scenario === "claude_failure") {
    trajectoryLabel = "holding steady";
  } else if (scenario === "connected") {
    trajectoryLabel = "trending up";
  } else if (scenario === "unconnected") {
    trajectoryLabel = "holding steady";
  }

  return {
    _v: 2,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    hero,
    trajectoryLabel,
    cards: { ...cards, patterns: patternsCard },
    metrics,
  };
}
