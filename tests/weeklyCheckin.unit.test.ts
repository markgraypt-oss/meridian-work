import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  storageMock: {
    getCheckInsInRange: (..._a: any[]) => Promise.resolve([] as any[]),
    getUserWorkoutLogs: (..._a: any[]) => Promise.resolve([] as any[]),
    getBodyMapLogs: (..._a: any[]) => Promise.resolve([] as any[]),
    getSleepEntries: (..._a: any[]) => Promise.resolve([] as any[]),
    getStepEntries: (..._a: any[]) => Promise.resolve([] as any[]),
    getScheduledWorkoutsInRange: (..._a: any[]) => Promise.resolve([] as any[]),
  } as Record<string, (...a: any[]) => Promise<any>>,
  aiCallMock: (..._a: any[]) => Promise.resolve({ data: null }) as Promise<any>,
  computeBurnoutScoreMock: (..._a: any[]) => ({ score: null, trajectory: null }) as any,
  mealRows: [] as any[],
}));

vi.mock("../server/storage", () => ({ storage: h.storageMock }));
vi.mock("../server/ai", () => ({ aiCall: (...a: any[]) => h.aiCallMock(...a) }));
vi.mock("../server/burnoutEngine", () => ({
  computeBurnoutScore: (...a: any[]) => h.computeBurnoutScoreMock(...a),
}));
vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.mealRows),
      }),
    }),
  },
}));

const storageMock = h.storageMock;
const setAiCall = (fn: (...a: any[]) => any) => { h.aiCallMock = fn; };
const setBurnout = (fn: (...a: any[]) => any) => { h.computeBurnoutScoreMock = fn; };
const setMeals = (rows: any[]) => { h.mealRows = rows; };
const setStorage = (key: string, fn: (...a: any[]) => Promise<any>) => { h.storageMock[key] = fn; };

import {
  getIsoWeekStart,
  getPreviousIsoWeekStart,
  aggregateWeek,
  generateWeeklyCheckinPayload,
} from "../server/weeklyCheckin";

beforeEach(() => {
  setMeals([]);
  for (const k of [
    "getCheckInsInRange",
    "getUserWorkoutLogs",
    "getBodyMapLogs",
    "getSleepEntries",
    "getStepEntries",
    "getScheduledWorkoutsInRange",
  ]) {
    setStorage(k, async () => []);
  }
  setBurnout(() => ({ score: 50, trajectory: "stable" }));
  setAiCall(async () => ({ data: null }));
});

describe("getIsoWeekStart", () => {
  it("returns Monday 00:00 UTC for a Wednesday", () => {
    // Wednesday 2025-05-07
    const d = new Date(Date.UTC(2025, 4, 7, 14, 30, 0));
    const start = getIsoWeekStart(d);
    expect(start.toISOString()).toBe("2025-05-05T00:00:00.000Z");
    expect(start.getUTCDay()).toBe(1);
  });

  it("returns the same Monday when called on Monday", () => {
    const d = new Date(Date.UTC(2025, 4, 5, 9, 0, 0)); // Monday
    expect(getIsoWeekStart(d).toISOString()).toBe("2025-05-05T00:00:00.000Z");
  });

  it("returns the previous Monday when called on Sunday", () => {
    const d = new Date(Date.UTC(2025, 4, 11, 23, 59, 0)); // Sunday
    expect(getIsoWeekStart(d).toISOString()).toBe("2025-05-05T00:00:00.000Z");
  });

  it("getPreviousIsoWeekStart subtracts exactly 7 days", () => {
    const monday = new Date(Date.UTC(2025, 4, 5));
    expect(getPreviousIsoWeekStart(monday).toISOString()).toBe(
      "2025-04-28T00:00:00.000Z",
    );
  });
});

describe("aggregateWeek", () => {
  const weekStart = new Date(Date.UTC(2025, 4, 5)); // Mon 2025-05-05
  const inThisWeek = new Date(Date.UTC(2025, 4, 7, 12)); // Wed
  const inPrevWeek = new Date(Date.UTC(2025, 3, 30, 12)); // Wed prior week

  it("aggregates metrics for the current and previous week", async () => {
    setStorage("getCheckInsInRange", async (_uid: string, start: Date) => {
      if (start.getTime() === weekStart.getTime()) {
        return [
          { moodScore: 6, energyScore: 7, stressScore: 4 },
          { moodScore: 8, energyScore: 5, stressScore: 6 },
        ];
      }
      return [{ moodScore: 4, energyScore: 4, stressScore: 7 }];
    });

    setStorage("getUserWorkoutLogs", async () => [
      { completedAt: inThisWeek, autoCalculatedVolume: 1200 },
      { completedAt: inThisWeek, autoCalculatedVolume: 800 },
      { completedAt: inPrevWeek, autoCalculatedVolume: 500 },
      { completedAt: null, autoCalculatedVolume: 999 },
    ]);

    setStorage("getBodyMapLogs", async () => [
      { bodyPart: "knee", severity: 7, createdAt: inThisWeek, updatedAt: inThisWeek },
      { bodyPart: "lower_back", severity: 4, createdAt: inPrevWeek, updatedAt: inPrevWeek },
      { bodyPart: "shoulder", severity: 0, createdAt: inPrevWeek, updatedAt: inThisWeek },
    ]);

    setStorage("getScheduledWorkoutsInRange", async (_uid: string, start: Date) => {
      if (start.getTime() === weekStart.getTime()) {
        return [
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: false },
          { isCompleted: false },
        ];
      }
      return [{ isCompleted: true }];
    });

    setMeals([
      { date: new Date(Date.UTC(2025, 4, 5, 8)) },
      { date: new Date(Date.UTC(2025, 4, 5, 19)) },
      { date: new Date(Date.UTC(2025, 4, 7, 12)) },
    ]);

    let burnoutCallCount = 0;
    setBurnout(() => {
      burnoutCallCount++;
      return burnoutCallCount === 1
        ? { score: 60, trajectory: "rising" }
        : { score: 45, trajectory: "stable" };
    });

    const result = await aggregateWeek("user-1", weekStart);

    expect(result.weekEnd.toISOString()).toBe("2025-05-12T00:00:00.000Z");
    expect(result.prevWeekStart.toISOString()).toBe("2025-04-28T00:00:00.000Z");

    const m = result.metrics;
    expect(m.training.sessionsCompleted).toBe(2);
    expect(m.training.sessionsPlanned).toBe(4);
    expect(m.training.sessionsMissed).toBe(2);
    expect(m.training.adherencePct).toBe(50);
    expect(m.training.totalVolumeKg).toBe(2000);
    expect(m.training.previousVolumeKg).toBe(500);

    expect(m.bodyMap.activeCount).toBe(2);
    expect(m.bodyMap.newCount).toBe(1);
    expect(m.bodyMap.resolvedCount).toBe(1);
    expect(m.bodyMap.topAreas[0]).toContain("knee");

    expect(m.nutrition.mealsLogged).toBe(3);
    expect(m.nutrition.daysWithMeals).toBe(2);
    expect(m.nutrition.targetDays).toBe(7);

    expect(m.checkIns.count).toBe(2);
    expect(m.checkIns.avgMood).toBe(7);
    expect(m.checkIns.avgEnergy).toBe(6);
    expect(m.checkIns.avgStress).toBe(5);

    expect(m.burnout.score).toBe(60);
    expect(m.burnout.previousScore).toBe(45);
    expect(m.burnout.delta).toBe(15);
    expect(m.burnout.trajectory).toBe("rising");
  });

  it("returns null averages and null burnout delta when there is no data", async () => {
    setBurnout(() => {
      throw new Error("not enough data");
    });

    const result = await aggregateWeek("user-empty", weekStart);
    expect(result.metrics.checkIns.avgMood).toBeNull();
    expect(result.metrics.checkIns.avgEnergy).toBeNull();
    expect(result.metrics.checkIns.avgStress).toBeNull();
    expect(result.metrics.burnout.score).toBeNull();
    expect(result.metrics.burnout.delta).toBeNull();
    expect(result.metrics.training.adherencePct).toBeNull();
    expect(result.metrics.training.totalVolumeKg).toBe(0);
  });
});

describe("generateWeeklyCheckinPayload deterministic fallback", () => {
  const weekStart = new Date(Date.UTC(2025, 4, 5));

  it("produces a fallback payload when aiCall returns no data", async () => {
    setAiCall(async () => ({ data: null }));

    const payload = await generateWeeklyCheckinPayload("user-1", weekStart);

    expect(payload.weekStart).toBe(weekStart.toISOString());
    expect(payload.weekEnd).toBe("2025-05-12T00:00:00.000Z");
    expect(payload.summary.wins).toEqual([]);
    expect(payload.summary.concerns).toEqual([]);
    expect(payload.summary.burnoutTrajectory).toMatch(/keep logging/i);
    expect(payload.suggestions).toHaveLength(2);
    expect(payload.suggestions.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(payload.suggestions[0].category).toBe("general");
    expect(payload.suggestions[1].category).toBe("recovery");
    // metrics block is still populated from aggregateWeek
    expect(payload.metrics.nutrition.targetDays).toBe(7);
  });

  it("uses AI-provided summary and suggestions when available", async () => {
    setAiCall(async () => ({
      data: {
        wins: ["Great consistency"],
        concerns: ["Watch sleep"],
        burnoutTrajectory: "Trending stable across the week.",
        suggestions: [
          { title: "Hydrate well", body: "Aim for 2L most days.", category: "nutrition" },
          { title: "Wind-down", body: "Try a 10-min wind-down before bed.", category: "sleep" },
          { title: "Easy walk", body: "A 20-min walk on rest days helps recovery.", category: "recovery" },
        ],
      },
    }));

    const payload = await generateWeeklyCheckinPayload("user-1", weekStart);
    expect(payload.summary.wins).toEqual(["Great consistency"]);
    expect(payload.suggestions).toHaveLength(3);
    expect(payload.suggestions[2].id).toBe("s3");
    expect(payload.suggestions[2].category).toBe("recovery");
  });
});
