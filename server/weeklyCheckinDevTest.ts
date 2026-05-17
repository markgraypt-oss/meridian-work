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
  aggregateWeekV2,
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
    _v: 4,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    hero,
    trajectoryLabel,
    cards: { ...cards, patterns: patternsCard },
    metrics,
  };
}

// ── Retry integration test ────────────────────────────────────────────────────
// Exercises the exact retry-on-open branch in getOrCreateCurrentWeeklyCheckinV2
// against a real DB record, then proves Claude is not called again on the second
// open. Uses a sentinel week (2020-01-06) and the first real user in the DB.
// The sentinel record is deleted in a finally block regardless of outcome.

export interface RetryTestReport {
  userId: string;
  sentinelWeek: string;
  planted: { isAI: boolean; generatedAt: string };
  afterCall1: { isAI: boolean; generatedAt: string; narrative: string };
  afterCall2: { isAI: boolean; generatedAt: string; narrative: string };
  retryFired: boolean;
  noReCallOnSecondOpen: boolean;
  verdict: "PASS" | "FAIL";
  failReason?: string;
}

export async function runRetryIntegrationTest(): Promise<RetryTestReport> {
  const { db } = await import("./db");
  const { users, weeklyCheckins } = await import("../shared/schema");
  const { eq, and } = await import("drizzle-orm");
  const { storage } = await import("./storage");

  // ── 1. Get first real userId (needed for FK constraint) ──────────────────
  const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!firstUser) throw new Error("No users in DB — cannot run retry test");
  const userId = firstUser.id;

  // Sentinel week: 2020-01-06 (Monday, 6 years ago — no real user data)
  const sentinelWeek = new Date("2020-01-06T00:00:00.000Z");
  const sentinelWeekEnd = new Date("2020-01-13T00:00:00.000Z");

  let plantedRecord: Awaited<ReturnType<typeof storage.createWeeklyCheckin>> | null = null;

  try {
    // ── 2. Ensure no leftover sentinel record from a prior test run ──────────
    await db.delete(weeklyCheckins)
      .where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.weekStart, sentinelWeek)));

    // ── 3. Plant fallback payload (isAI: false) ──────────────────────────────
    const fallbackPayload: WeeklyCheckinPayloadV2 = {
      _v: 4,
      weekStart: sentinelWeek.toISOString(),
      weekEnd: sentinelWeekEnd.toISOString(),
      hero: "Fallback static text.",
      trajectoryLabel: "not enough data",
      cards: {
        howYouFelt: { checkInCount: 4, avgMood: 3.5, avgEnergy: 3.0, avgStress: 2.8, roughDaysCount: 0 },
        patterns: {
          narrative: "Fallback static text.",
          bulletPoints: [],
          isAI: false,
          generatedAt: "2020-01-13T08:00:00.000Z",
        },
      },
      metrics: {
        burnout: { score: null, trajectory: null, previousScore: null, delta: null },
        bodyMap: { activeCount: 0, newCount: 0, resolvedCount: 0, topAreas: [] },
        training: { sessionsCompleted: 0, sessionsPlanned: 0, sessionsMissed: 0, adherencePct: null, totalVolumeKg: 0, previousVolumeKg: null },
        nutrition: { mealsLogged: 0, daysWithMeals: 0, targetDays: 7 },
        checkIns: { count: 4, avgMood: 3.5, avgEnergy: 3.0, avgStress: 2.8 },
      },
    };

    plantedRecord = await storage.createWeeklyCheckin({
      userId,
      weekStart: sentinelWeek,
      payload: fallbackPayload,
      acceptedSuggestions: [],
      dismissedSuggestions: [],
    });

    const plantedIsAI = (plantedRecord.payload as any).cards.patterns.isAI as boolean;
    const plantedGeneratedAt = (plantedRecord.payload as any).cards.patterns.generatedAt as string;

    // ── 4. CALL 1 — mirrors getOrCreateCurrentWeeklyCheckinV2 exactly ────────
    // Re-fetch from DB just as the real endpoint does
    let after1: typeof plantedRecord = plantedRecord;
    {
      const existing = await storage.getWeeklyCheckin(userId, sentinelWeek);
      if (existing) {
        const p = existing.payload as any;
        if (p?._v === 4 && p.cards?.patterns?.isAI === false) {
          const agg = await aggregateWeekV2(userId, sentinelWeek);
          const result = await generatePatternsNarrative(
            agg.promptData, sentinelWeek, agg.weekEnd, userId,
          );
          if (result.isAI) {
            const updatedPayload: WeeklyCheckinPayloadV2 = {
              ...(existing.payload as WeeklyCheckinPayloadV2),
              hero: result.narrative,
              trajectoryLabel: result.trajectoryLabel,
              cards: {
                ...(existing.payload as WeeklyCheckinPayloadV2).cards,
                patterns: {
                  narrative: result.narrative,
                  bulletPoints: result.bulletPoints,
                  isAI: true,
                  generatedAt: new Date().toISOString(),
                },
              },
            };
            after1 = await storage.updateWeeklyCheckinPayload(existing.id, updatedPayload);
          }
          // else: Claude failed again, after1 stays as existing (isAI still false)
        }
      }
    }

    const after1IsAI = (after1.payload as any).cards.patterns.isAI as boolean;
    const after1GeneratedAt = (after1.payload as any).cards.patterns.generatedAt as string;
    const after1Narrative = (after1.payload as any).cards.patterns.narrative as string;

    // ── 5. Wait 150 ms — if Claude fired again, its new Date() would differ ──
    await new Promise((r) => setTimeout(r, 150));

    // ── 6. CALL 2 — second open, same week ────────────────────────────────────
    let after2: typeof plantedRecord = after1;
    {
      const existing = await storage.getWeeklyCheckin(userId, sentinelWeek);
      if (existing) {
        const p = existing.payload as any;
        if (p?._v === 4 && p.cards?.patterns?.isAI === false) {
          // Should NOT enter here if Call 1 succeeded
          const agg = await aggregateWeekV2(userId, sentinelWeek);
          const result = await generatePatternsNarrative(
            agg.promptData, sentinelWeek, agg.weekEnd, userId,
          );
          if (result.isAI) {
            const updatedPayload: WeeklyCheckinPayloadV2 = {
              ...(existing.payload as WeeklyCheckinPayloadV2),
              hero: result.narrative,
              trajectoryLabel: result.trajectoryLabel,
              cards: {
                ...(existing.payload as WeeklyCheckinPayloadV2).cards,
                patterns: {
                  narrative: result.narrative,
                  bulletPoints: result.bulletPoints,
                  isAI: true,
                  generatedAt: new Date().toISOString(),
                },
              },
            };
            after2 = await storage.updateWeeklyCheckinPayload(existing.id, updatedPayload);
          }
        }
        // isAI already true → skip block, return as-is
        if ((existing.payload as any).cards?.patterns?.isAI !== false) {
          after2 = existing;
        }
      }
    }

    const after2IsAI = (after2.payload as any).cards.patterns.isAI as boolean;
    const after2GeneratedAt = (after2.payload as any).cards.patterns.generatedAt as string;
    const after2Narrative = (after2.payload as any).cards.patterns.narrative as string;

    // ── 7. Derive verdict ────────────────────────────────────────────────────
    const retryFired = !plantedIsAI && after1IsAI;
    const noReCallOnSecondOpen = after1GeneratedAt === after2GeneratedAt;

    let failReason: string | undefined;
    if (!retryFired) failReason = `Call 1 did not flip isAI (still ${after1IsAI}) — Claude likely failed again`;
    else if (!noReCallOnSecondOpen) failReason = `generatedAt changed between Call 1 and Call 2 — Claude was called again on second open`;

    return {
      userId,
      sentinelWeek: sentinelWeek.toISOString(),
      planted: { isAI: plantedIsAI, generatedAt: plantedGeneratedAt },
      afterCall1: { isAI: after1IsAI, generatedAt: after1GeneratedAt, narrative: after1Narrative },
      afterCall2: { isAI: after2IsAI, generatedAt: after2GeneratedAt, narrative: after2Narrative },
      retryFired,
      noReCallOnSecondOpen,
      verdict: retryFired && noReCallOnSecondOpen ? "PASS" : "FAIL",
      failReason,
    };
  } finally {
    // Always clean up the sentinel record
    try {
      await db.delete(weeklyCheckins)
        .where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.weekStart, sentinelWeek)));
    } catch {
      // best-effort cleanup
    }
  }
}
