import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  dbResponses: [] as any[],
  awardCalls: [] as any[],
  awardImpl: (..._a: any[]) => Promise.resolve() as Promise<any>,
}));

function makeWhereResult() {
  const value = h.dbResponses.shift() ?? [];
  const promise: any = Promise.resolve(value);
  promise.limit = () => Promise.resolve(value);
  return promise;
}

vi.mock("../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => makeWhereResult(),
      }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
    }),
  },
}));

vi.mock("../server/engagementEngine", () => ({
  awardPoints: (...a: any[]) => {
    h.awardCalls.push(a);
    return h.awardImpl(...a);
  },
}));

import {
  computeDailyReadinessV1,
  maybeAwardWeeklyBaseline,
  MIN_INPUTS_FOR_SCORE,
  HISTORY_DAYS_REQUIRED_FOR_BASELINE,
  WEEKLY_REWARD_DAYS_REQUIRED,
} from "../server/dailyReadiness";

beforeEach(() => {
  h.dbResponses = [];
  h.awardCalls = [];
  h.awardImpl = (..._a: any[]) => Promise.resolve();
});

describe("computeDailyReadinessV1", () => {
  it("returns null score when fewer than MIN_INPUTS_FOR_SCORE inputs are present", () => {
    const inputs = {
      sleep: 8,
      pain: 9,
      energy: null,
      nutrition: null,
      movement: null,
      recovery: null,
    };
    const result = computeDailyReadinessV1(inputs);
    expect(MIN_INPUTS_FOR_SCORE).toBe(3);
    expect(result.inputCount).toBe(2);
    expect(result.score).toBeNull();
    expect(result.inputs).toBe(inputs);
  });

  it("averages 6 full inputs and multiplies by 10", () => {
    const result = computeDailyReadinessV1({
      sleep: 8,
      pain: 7,
      energy: 6,
      nutrition: 5,
      movement: 4,
      recovery: 3,
    });
    // mean = 33/6 = 5.5 => score = 55
    expect(result.inputCount).toBe(6);
    expect(result.score).toBe(55);
  });

  it("rounds the averaged score correctly (e.g. all 7s => 70)", () => {
    const result = computeDailyReadinessV1({
      sleep: 7,
      pain: 7,
      energy: 7,
      nutrition: 7,
      movement: 7,
      recovery: 7,
    });
    expect(result.score).toBe(70);
  });

  it("clamps the resulting score to the 0-100 range", () => {
    const high = computeDailyReadinessV1({
      sleep: 15,
      pain: 20,
      energy: 12,
      nutrition: null,
      movement: null,
      recovery: null,
    });
    // mean = 47/3 ≈ 15.67 => *10 = 156.67 -> clamped to 100
    expect(high.inputCount).toBe(3);
    expect(high.score).toBe(100);

    const low = computeDailyReadinessV1({
      sleep: -5,
      pain: -2,
      energy: -1,
      nutrition: null,
      movement: null,
      recovery: null,
    });
    // mean negative => *10 negative -> clamped to 0
    expect(low.score).toBe(0);
  });

  it("returns null score when every input is null", () => {
    const result = computeDailyReadinessV1({
      sleep: null,
      pain: null,
      energy: null,
      nutrition: null,
      movement: null,
      recovery: null,
    });
    expect(result.inputCount).toBe(0);
    expect(result.score).toBeNull();
  });

  it("ignores NaN values when counting inputs", () => {
    const result = computeDailyReadinessV1({
      sleep: Number.NaN,
      pain: 5,
      energy: 5,
      nutrition: null,
      movement: null,
      recovery: null,
    });
    expect(result.inputCount).toBe(2);
    expect(result.score).toBeNull();
  });
});

describe("maybeAwardWeeklyBaseline", () => {
  const weekStart = "2025-05-05"; // Monday

  it("is idempotent: skips when a transaction already exists for that week", async () => {
    h.dbResponses = [
      [{ id: "existing-tx" }], // existing transactions check
    ];
    const awarded = await maybeAwardWeeklyBaseline("user-1", weekStart);
    expect(awarded).toBe(false);
    expect(h.awardCalls).toHaveLength(0);
  });

  it("requires at least HISTORY_DAYS_REQUIRED_FOR_BASELINE baseline scores", async () => {
    expect(HISTORY_DAYS_REQUIRED_FOR_BASELINE).toBe(14);
    const baseline13 = Array.from({ length: 13 }, () => ({ score: 50 }));
    const week = Array.from({ length: 7 }, () => ({ score: 90 })); // would otherwise pass
    h.dbResponses = [
      [], // no existing transaction
      baseline13, // only 13 baseline rows
      week,
    ];
    const awarded = await maybeAwardWeeklyBaseline("user-1", weekStart);
    expect(awarded).toBe(false);
    expect(h.awardCalls).toHaveLength(0);
  });

  it("awards when 5+ days strictly above the 30-day baseline mean", async () => {
    expect(WEEKLY_REWARD_DAYS_REQUIRED).toBe(5);
    const baseline14 = Array.from({ length: 14 }, () => ({ score: 50 }));
    // 5 strictly above 50, 2 at or below
    const week = [
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 50 }, // not strictly above
      { score: 40 },
    ];
    h.dbResponses = [[], baseline14, week];
    const awarded = await maybeAwardWeeklyBaseline("user-2", weekStart);
    expect(awarded).toBe(true);
    expect(h.awardCalls).toHaveLength(1);
    const [userId, activityType, metadata] = h.awardCalls[0];
    expect(userId).toBe("user-2");
    expect(activityType).toBe("readiness_weekly_baseline");
    expect(metadata.weekStart).toBe(weekStart);
    expect(metadata.baseline).toBe(50);
    expect(metadata.aboveBaselineDays).toBe(5);
  });

  it("does not award when only 4 days are strictly above the baseline", async () => {
    const baseline14 = Array.from({ length: 14 }, () => ({ score: 50 }));
    const week = [
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 60 },
      { score: 50 }, // tie -> not strictly above
      { score: 50 },
      { score: 40 },
    ];
    h.dbResponses = [[], baseline14, week];
    const awarded = await maybeAwardWeeklyBaseline("user-3", weekStart);
    expect(awarded).toBe(false);
    expect(h.awardCalls).toHaveLength(0);
  });
});
