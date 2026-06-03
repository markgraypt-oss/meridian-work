/**
 * Daily Readiness (Beta, User-Only)
 *
 * Personal 0-100 readiness score computed nightly per user from up to five
 * inputs (sleep, energy, trainingLoad, hrv, rhr). Weighted v2 algorithm —
 * HRV 30%, RHR 20%, Sleep 20%, Training Load 20%, Energy 10%.
 * Weights redistribute proportionally when inputs are null.
 * Requires at least MIN_INPUTS_FOR_SCORE inputs before a score is recorded.
 *
 * STRICT CONTAINMENT: this score is shown only on the user's personal
 * dashboard. It is NEVER aggregated into admin reports, CSV exports, or
 * AI Executive Narrator output. See server/reportNarrator.ts and
 * server/reportingEngine.ts for the corresponding guardrails.
 */
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  checkIns,
  dailyReadinessHistory,
  pointsTransactions,
  sleepEntries,
  stepEntries,
  users,
  wearableMetricsDaily,
  workoutLogs,
} from "@shared/schema";
import { awardPoints } from "./engagementEngine";
import { notify } from "./notifications";

export const MIN_INPUTS_FOR_SCORE = 2;
export const ALGORITHM_VERSION = "v2";
export const HISTORY_DAYS_REQUIRED_FOR_BASELINE = 14;
export const ROLLING_AVERAGE_DAYS = 30;
export const WEEKLY_REWARD_DAYS_REQUIRED = 5;
export const WEEKLY_REWARD_POINTS = 100;

export function isFeatureEnabled(): boolean {
  return process.env.DAILY_READINESS_ENABLED === "true";
}

export interface ReadinessInputs {
  sleep: number | null;
  energy: number | null;
  trainingLoad: number | null;
  hrv: number | null;
  rhr: number | null;
}

/**
 * Per-input provenance — which underlying log produced the value. `null`
 * means the input was missing for the day.
 */
export type ReadinessInputSource =
  | "wearable"
  | "check-in"
  | "sleep-log"
  | "workout-log"
  | "step-log";

export type ReadinessInputSources = Record<keyof ReadinessInputs, ReadinessInputSource | null>;

/**
 * Raw input values in their native units, captured during input gathering
 * so the readiness detail page can display real units (HRV in ms, RHR in
 * bpm, sleep score 0-100, energy 1-5, etc.) rather than the 0-10 values
 * used by the composite formula. Interpretation depends on the matching
 * `sources` value:
 *   sleep:        if source=wearable/sleep-log → 0-100 score OR minutes
 *                 if source=check-in           → 1-5
 *   energy:       always 1-5 (check-in only)
 *   hrv:          milliseconds (wearable only)
 *   rhr:          beats per minute (wearable only)
 *   trainingLoad: if source=wearable WHOOP strain → 0-21
 *                 if source=wearable activity avg → 0-10
 *                 if source=workout-log          → minutes
 *                 if source=step-log             → step count
 */
export interface ReadinessRawValues {
  sleep: number | null;
  energy: number | null;
  trainingLoad: number | null;
  hrv: number | null;
  rhr: number | null;
}

export interface ReadinessInputsWithSources {
  inputs: ReadinessInputs;
  sources: ReadinessInputSources;
  raws: ReadinessRawValues;
}

export interface ReadinessResult {
  inputs: ReadinessInputs;
  inputCount: number;
  score: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Weighted v2: HRV 30%, RHR 20%, Sleep 20%, Training Load 20%, Energy 10%.
 * When inputs are null their weight is redistributed proportionally to
 * available inputs. Returns null when fewer than MIN_INPUTS_FOR_SCORE
 * signals are available.
 */
const WEIGHTS: Record<keyof ReadinessInputs, number> = {
  hrv: 0.30,
  rhr: 0.20,
  sleep: 0.20,
  trainingLoad: 0.20,
  energy: 0.10,
};

export function computeDailyReadinessV1(inputs: ReadinessInputs): ReadinessResult {
  const available = (Object.keys(inputs) as Array<keyof ReadinessInputs>).filter(
    (k) => typeof inputs[k] === "number" && !Number.isNaN(inputs[k]),
  );
  const inputCount = available.length;
  if (inputCount < MIN_INPUTS_FOR_SCORE) {
    return { inputs, inputCount, score: null };
  }
  const totalWeight = available.reduce((s, k) => s + WEIGHTS[k], 0);
  const weightedSum = available.reduce((s, k) => {
    const raw = inputs[k] as number;
    // Training Load is stored as raw strain (high = heavy day).
    // Invert here so a hard day lowers the readiness score.
    const v = k === "trainingLoad" ? clamp(10 - raw, 0, 10) : raw;
    return s + v * (WEIGHTS[k] / totalWeight);
  }, 0);
  const score = Math.round(clamp(weightedSum * 10, 0, 100));
  return { inputs, inputCount, score };
}

/**
 * YYYY-MM-DD for a JS Date in the SERVER local timezone.
 * All readiness logic is local-day based — never use `toISOString()` here,
 * because that produces UTC which can shift the date around midnight.
 * Exported so callers (routes, scheduler) can share the exact same key.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Today's YYYY-MM-DD key. If a user IANA timezone is provided, computes in
 * that timezone. Otherwise falls back to the server's local time (legacy).
 * Always pass `tz` for user-scoped reads — the server-local fallback is only
 * for batches or contexts where no specific user is in scope.
 */
export function todayKey(tz?: string | null): string {
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      // en-CA produces YYYY-MM-DD natively.
      return fmt.format(new Date());
    } catch {
      // fall through
    }
  }
  return toDateKey(new Date());
}

/**
 * Identifiers that MUST NEVER appear in any company-facing surface
 * (admin reports, CSV exports, AI Executive Narrator snapshot, Engagement
 * Index tiles, etc). Daily Readiness is a strictly personal feature.
 */
export const READINESS_FORBIDDEN_TABLES = ["daily_readiness_history"] as const;
export const READINESS_FORBIDDEN_ACTIVITY_TYPES = ["readiness_weekly_baseline"] as const;
export const READINESS_FORBIDDEN_KEY_PATTERN = /readiness/i;

/**
 * Hard runtime guard: walks an arbitrary value and throws if it contains
 * any object key matching /readiness/i or any string equal to a forbidden
 * activity type / table name. Use this on payloads about to be sent to
 * admins, the AI narrator, or written to a CSV export.
 *
 * Throwing (rather than silently filtering) is intentional — it forces
 * containment regressions to fail loudly in tests / dev rather than leak
 * quietly in production.
 */
export function assertNoReadinessLeak(value: unknown, context: string): void {
  const forbiddenStrings = new Set<string>([
    ...READINESS_FORBIDDEN_TABLES,
    ...READINESS_FORBIDDEN_ACTIVITY_TYPES,
  ]);
  const visit = (v: unknown, path: string): void => {
    if (v === null || v === undefined) return;
    if (typeof v === "string") {
      if (forbiddenStrings.has(v)) {
        throw new Error(
          `[readiness-containment] Forbidden value "${v}" at ${path} in ${context}`,
        );
      }
      return;
    }
    if (typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      if (READINESS_FORBIDDEN_KEY_PATTERN.test(k)) {
        throw new Error(
          `[readiness-containment] Forbidden key "${k}" at ${path}.${k} in ${context}`,
        );
      }
      visit(child, `${path}.${k}`);
    }
  };
  visit(value, "$");
}

function startOfLocalDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

function endOfLocalDay(dateKey: string): Date {
  const start = startOfLocalDay(dateKey);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Build the five readiness inputs for a single user on a single local day.
 * Each input is normalised to 0-10. Missing data => null (not zero).
 *
 * Inputs (v2):
 *   sleep        — wearable sleepScore / sleep log / check-in
 *   energy       — check-in energyScore
 *   trainingLoad — INVERTED: high load yesterday → lower score today.
 *                  Source priority: WHOOP strain > wearable steps+activeMinutes+calories
 *                  + workout duration boost, adjusted by 7-day vs 30-day baseline.
 *                  Fallback: manual step logs.
 *   hrv          — wearable hrvMs normalised (20ms=0, 100ms=10)
 *   rhr          — wearable restingHrBpm normalised inverted (40bpm=10, 100bpm=0)
 */
export async function gatherInputsForDay(
  userId: string,
  dateKey: string,
): Promise<ReadinessInputsWithSources> {
  const dayStart = startOfLocalDay(dateKey);
  const dayEnd = endOfLocalDay(dateKey);

  // --- Check-in for the day ---
  const ciRows = await db
    .select()
    .from(checkIns)
    .where(
      and(
        eq(checkIns.userId, userId),
        gte(checkIns.checkInDate, dayStart),
        lt(checkIns.checkInDate, dayEnd),
      ),
    )
    .orderBy(desc(checkIns.checkInDate))
    .limit(1);
  const ci = ciRows[0];

  // --- Today's wearable metrics ---
  const wearableRows = await db
    .select()
    .from(wearableMetricsDaily)
    .where(and(eq(wearableMetricsDaily.userId, userId), eq(wearableMetricsDaily.date, dateKey)))
    .orderBy(desc(wearableMetricsDaily.updatedAt));
  const wear = wearableRows[0];

  const sources: ReadinessInputSources = {
    sleep: null,
    energy: null,
    trainingLoad: null,
    hrv: null,
    rhr: null,
  };

  const raws: ReadinessRawValues = {
    sleep: null,
    energy: null,
    trainingLoad: null,
    hrv: null,
    rhr: null,
  };

  // -----------------------------------------------------------------------
  // Sleep — wearable sleepScore (0-100 → /10) preferred; else sleep log;
  //         else check-in sleepScore (1-5 → *2)
  // -----------------------------------------------------------------------
  let sleep: number | null = null;
  // Priority: wearable score → wearable duration → sleep log → check-in
  if (wear?.sleepScore != null) {
    sleep = clamp(wear.sleepScore / 10, 0, 10);
    sources.sleep = "wearable";
    raws.sleep = wear.sleepScore;
  } else if (wear?.sleepMinutes != null) {
    sleep = clamp((wear.sleepMinutes / 60 / 8) * 10, 0, 10);
    sources.sleep = "wearable";
    raws.sleep = wear.sleepMinutes;
  } else {
    const sleepRows = await db
      .select()
      .from(sleepEntries)
      .where(
        and(
          eq(sleepEntries.userId, userId),
          gte(sleepEntries.date, dayStart),
          lt(sleepEntries.date, dayEnd),
        ),
      )
      .limit(1);
    const se = sleepRows[0];
    if (se) {
      if (se.sleepScore != null) {
        sleep = clamp(se.sleepScore / 10, 0, 10);
        sources.sleep = "sleep-log";
        raws.sleep = se.sleepScore;
      } else if (se.durationMinutes != null) {
        sleep = clamp((se.durationMinutes / 60 / 8) * 10, 0, 10);
        sources.sleep = "sleep-log";
        raws.sleep = se.durationMinutes;
      }
    }
    if (sleep == null && ci?.sleepScore != null) {
      sleep = clamp(ci.sleepScore * 2, 0, 10);
      sources.sleep = "check-in";
      raws.sleep = ci.sleepScore;
    }
  }

  // -----------------------------------------------------------------------
  // Energy — check-in energyScore (1-5 → *2)
  // -----------------------------------------------------------------------
  let energy: number | null = null;
  if (ci?.energyScore != null) {
    energy = clamp(ci.energyScore * 2, 0, 10);
    sources.energy = "check-in";
    raws.energy = ci.energyScore;
  }

  // -----------------------------------------------------------------------
  // HRV — wearable hrvMs normalised: 20ms=0, 100ms=10 (linear).
  // Individual variation is wide but this range covers 95 %+ of adults.
  // -----------------------------------------------------------------------
  let hrv: number | null = null;
  if (wear?.hrvMs != null) {
    hrv = clamp((wear.hrvMs - 20) / 80, 0, 1) * 10;
    sources.hrv = "wearable";
    raws.hrv = wear.hrvMs;
  }

  // -----------------------------------------------------------------------
  // RHR — wearable restingHrBpm, inverted: 40 bpm=10, 100 bpm=0.
  // -----------------------------------------------------------------------
  let rhr: number | null = null;
  if (wear?.restingHrBpm != null) {
    rhr = clamp((100 - wear.restingHrBpm) / 60, 0, 1) * 10;
    sources.rhr = "wearable";
    raws.rhr = wear.restingHrBpm;
  }

  // -----------------------------------------------------------------------
  // Training Load — backward-looking (yesterday's stress), then INVERTED
  // so high load → lower readiness contribution.
  //
  // Priority:
  //   1. WHOOP strain score (0-21 scale)
  //   2. Wearable steps + activeMinutes + caloriesBurned (averaged)
  //   3. Add workout duration boost from yesterday's logged workouts
  //   4. Apply 7-day vs 30-day baseline trend adjustment
  //   5. Fallback: manual step log yesterday
  // -----------------------------------------------------------------------
  let trainingLoad: number | null = null;

  const yesterdayKey = toDateKey(new Date(dayStart.getTime() - 24 * 60 * 60 * 1000));
  const yesterdayStart = startOfLocalDay(yesterdayKey);
  const yesterdayEnd = endOfLocalDay(yesterdayKey);

  const yWearRows = await db
    .select()
    .from(wearableMetricsDaily)
    .where(and(eq(wearableMetricsDaily.userId, userId), eq(wearableMetricsDaily.date, yesterdayKey)))
    .orderBy(desc(wearableMetricsDaily.updatedAt))
    .limit(1);
  const yw = yWearRows[0];

  // Step 1: WHOOP strain (stored 0-210 representing 0-21 real strain → 0-10 stress)
  let yesterdayStress: number | null = null;
  if (yw?.strainScore != null) {
    yesterdayStress = clamp(yw.strainScore / 210, 0, 1) * 10;
    sources.trainingLoad = "wearable";
    raws.trainingLoad = yw.strainScore / 10; // 0-21 real strain
  }

  // Step 2: Wearable steps + active minutes + calories burned (averaged)
  if (yesterdayStress == null && yw) {
    const factors: number[] = [];
    if (yw.steps != null) factors.push(clamp(yw.steps / 15000, 0, 1) * 10);
    if (yw.activeMinutes != null) factors.push(clamp(yw.activeMinutes / 120, 0, 1) * 10);
    if (yw.caloriesBurned != null) factors.push(clamp(yw.caloriesBurned / 800, 0, 1) * 10);
    if (factors.length > 0) {
      yesterdayStress = factors.reduce((s, v) => s + v, 0) / factors.length;
      sources.trainingLoad = "wearable";
      raws.trainingLoad = yesterdayStress; // 0-10 averaged activity score
    }
  }

  // Step 3: Add workout duration boost from yesterday's logged workouts
  const yWorkouts = await db
    .select({ duration: workoutLogs.duration })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        gte(workoutLogs.completedAt, yesterdayStart),
        lt(workoutLogs.completedAt, yesterdayEnd),
      ),
    );
  if (yWorkouts.length > 0) {
    const totalSeconds = yWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
    // 1 hour workout ≈ +2 stress points; cap boost at 3
    const boost = clamp(totalSeconds / 3600 * 2, 0, 3);
    yesterdayStress = clamp((yesterdayStress ?? 0) + boost, 0, 10);
    if (sources.trainingLoad == null) sources.trainingLoad = "workout-log";
    if (sources.trainingLoad === "workout-log") raws.trainingLoad = totalSeconds / 60; // minutes
  }

  // Step 4: 7-day vs 30-day baseline trend adjustment (wearable data only)
  if (yesterdayStress != null && sources.trainingLoad === "wearable") {
    const sevenDaysAgo = new Date(dayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(dayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [weekRows, baselineRows] = await Promise.all([
      db
        .select({ steps: wearableMetricsDaily.steps, activeMinutes: wearableMetricsDaily.activeMinutes, caloriesBurned: wearableMetricsDaily.caloriesBurned })
        .from(wearableMetricsDaily)
        .where(and(eq(wearableMetricsDaily.userId, userId), gte(wearableMetricsDaily.date, toDateKey(sevenDaysAgo)), lt(wearableMetricsDaily.date, dateKey))),
      db
        .select({ steps: wearableMetricsDaily.steps, activeMinutes: wearableMetricsDaily.activeMinutes, caloriesBurned: wearableMetricsDaily.caloriesBurned })
        .from(wearableMetricsDaily)
        .where(and(eq(wearableMetricsDaily.userId, userId), gte(wearableMetricsDaily.date, toDateKey(thirtyDaysAgo)), lt(wearableMetricsDaily.date, dateKey))),
    ]);

    if (weekRows.length >= 3 && baselineRows.length >= 7) {
      const avg = (rows: typeof weekRows, field: keyof typeof weekRows[0]) =>
        rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) / rows.length;

      const weekSteps = avg(weekRows, "steps");
      const weekActive = avg(weekRows, "activeMinutes");
      const weekCals = avg(weekRows, "caloriesBurned");
      const baseSteps = avg(baselineRows, "steps") || 8000;
      const baseActive = avg(baselineRows, "activeMinutes") || 30;
      const baseCals = avg(baselineRows, "caloriesBurned") || 300;

      const ratio =
        ((weekSteps / baseSteps) + (weekActive / baseActive) + (weekCals / baseCals)) / 3;

      if (ratio > 1.2) yesterdayStress = clamp(yesterdayStress * 1.1, 0, 10);
      else if (ratio < 0.8) yesterdayStress = clamp(yesterdayStress * 0.9, 0, 10);
    }
  }

  // Step 5: Fallback — manual step log for yesterday
  if (yesterdayStress == null) {
    const yStepRows = await db
      .select()
      .from(stepEntries)
      .where(
        and(
          eq(stepEntries.userId, userId),
          gte(stepEntries.date, yesterdayStart),
          lt(stepEntries.date, yesterdayEnd),
        ),
      )
      .limit(1);
    if (yStepRows[0]?.steps != null) {
      yesterdayStress = clamp(yStepRows[0].steps / 15000, 0, 1) * 10;
      sources.trainingLoad = "step-log";
      raws.trainingLoad = yStepRows[0].steps; // step count
    }
  }

  // Store raw strain (high = heavy day). Inversion happens in computeDailyReadinessV1.
  if (yesterdayStress != null) {
    trainingLoad = clamp(yesterdayStress, 0, 10);
  }

  const r = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  const inputs: ReadinessInputs = {
    sleep: r(sleep),
    energy: r(energy),
    trainingLoad: r(trainingLoad),
    hrv: r(hrv),
    rhr: r(rhr),
  };
  return { inputs, sources, raws };
}

/**
 * Compute and upsert a single user/day row. Returns the result.
 *
 * Locking rules (today's date only):
 *   - No check-in for today  → score returns null (gamification gate).
 *   - Locked row exists      → no recompute, returns stored values.
 *   - All inputs complete    → compute, store, and lock the row.
 *   - Partial inputs         → compute & store but leave unlocked, so
 *                              late wearable syncs can update once.
 *
 * Historic dates (not today) always recompute and never lock — used by
 * the nightly job and backfills.
 */
export async function computeAndStoreForUserDay(
  userId: string,
  dateKey: string,
): Promise<ReadinessResult> {
  const isToday = dateKey === todayKey();

  // If today's row is already locked, return it as-is. No recompute.
  if (isToday) {
    const [existing] = await db
      .select()
      .from(dailyReadinessHistory)
      .where(
        and(
          eq(dailyReadinessHistory.userId, userId),
          eq(dailyReadinessHistory.date, dateKey),
        ),
      )
      .limit(1);
    if (existing?.locked) {
      return {
        inputs: {
          sleep: existing.sleepInput ?? null,
          energy: existing.energyInput ?? null,
          trainingLoad: existing.trainingLoadInput ?? null,
          hrv: existing.hrvInput ?? null,
          rhr: existing.rhrInput ?? null,
        },
        inputCount: existing.inputCount ?? 0,
        score: existing.score ?? null,
      };
    }
  }

  const { inputs, sources, raws } = await gatherInputsForDay(userId, dateKey);

  // Gamification gate: no check-in today → no score today.
  // (Historic dates skip this — nightly job backfills regardless.)
  const hasCheckInToday =
    sources.energy === "check-in" || sources.sleep === "check-in";
  if (isToday && !hasCheckInToday) {
    await db
      .insert(dailyReadinessHistory)
      .values({
        userId,
        date: dateKey,
        sleepInput: inputs.sleep,
        energyInput: inputs.energy,
        trainingLoadInput: inputs.trainingLoad,
        hrvInput: inputs.hrv,
        rhrInput: inputs.rhr,
        sleepRaw: raws.sleep,
        energyRaw: raws.energy,
        trainingLoadRaw: raws.trainingLoad,
        hrvRaw: raws.hrv,
        rhrRaw: raws.rhr,
        inputCount: 0,
        score: null,
        algorithmVersion: ALGORITHM_VERSION,
        locked: false,
      })
      .onConflictDoUpdate({
        target: [dailyReadinessHistory.userId, dailyReadinessHistory.date],
        set: {
          sleepInput: inputs.sleep,
          energyInput: inputs.energy,
          trainingLoadInput: inputs.trainingLoad,
          hrvInput: inputs.hrv,
          rhrInput: inputs.rhr,
          sleepRaw: raws.sleep,
          energyRaw: raws.energy,
          trainingLoadRaw: raws.trainingLoad,
          hrvRaw: raws.hrv,
          rhrRaw: raws.rhr,
          inputCount: 0,
          score: null,
          algorithmVersion: ALGORITHM_VERSION,
          updatedAt: new Date(),
        },
      });
    return { inputs, inputCount: 0, score: null };
  }

  const result = computeDailyReadinessV1(inputs);

  // Lock condition: check-in done AND all three wearable inputs present.
  // Only applies to today.
  const allWearableReady =
    inputs.hrv != null && inputs.rhr != null && inputs.sleep != null;
  const shouldLock = isToday && hasCheckInToday && allWearableReady;

  await db
    .insert(dailyReadinessHistory)
    .values({
      userId,
      date: dateKey,
      sleepInput: inputs.sleep,
      energyInput: inputs.energy,
      trainingLoadInput: inputs.trainingLoad,
      hrvInput: inputs.hrv,
      rhrInput: inputs.rhr,
      sleepRaw: raws.sleep,
      energyRaw: raws.energy,
      trainingLoadRaw: raws.trainingLoad,
      hrvRaw: raws.hrv,
      rhrRaw: raws.rhr,
      inputCount: result.inputCount,
      score: result.score,
      algorithmVersion: ALGORITHM_VERSION,
      locked: shouldLock,
      lockedAt: shouldLock ? new Date() : null,
      sourcesSnapshot: shouldLock ? sources : null,
    })
    .onConflictDoUpdate({
      target: [dailyReadinessHistory.userId, dailyReadinessHistory.date],
      set: {
        sleepInput: inputs.sleep,
        energyInput: inputs.energy,
        trainingLoadInput: inputs.trainingLoad,
        hrvInput: inputs.hrv,
        rhrInput: inputs.rhr,
        sleepRaw: raws.sleep,
        energyRaw: raws.energy,
        trainingLoadRaw: raws.trainingLoad,
        hrvRaw: raws.hrv,
        rhrRaw: raws.rhr,
        inputCount: result.inputCount,
        score: result.score,
        algorithmVersion: ALGORITHM_VERSION,
        locked: shouldLock,
        lockedAt: shouldLock ? new Date() : null,
        sourcesSnapshot: shouldLock ? sources : null,
        updatedAt: new Date(),
      },
    });

  return result;
}

/** Fetch the last N days of history for a user, ascending by date. */
export async function getHistoryForUser(
  userId: string,
  days: number,
): Promise<Array<{ date: string; score: number | null; inputCount: number }>> {
  const safeDays = clamp(Math.floor(days || 30), 1, 365);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (safeDays - 1));
  const cutoffKey = toDateKey(cutoff);
  const rows = await db
    .select({
      date: dailyReadinessHistory.date,
      score: dailyReadinessHistory.score,
      inputCount: dailyReadinessHistory.inputCount,
    })
    .from(dailyReadinessHistory)
    .where(
      and(
        eq(dailyReadinessHistory.userId, userId),
        gte(dailyReadinessHistory.date, cutoffKey),
      ),
    )
    .orderBy(asc(dailyReadinessHistory.date));
  return rows;
}

/**
 * Fetch detailed readiness history for the detail page. Returns per-day
 * raw + normalised values + sources, plus a `hasWearable` flag derived
 * from the presence of any wearableMetricsDaily rows in the range — used
 * by the mobile detail page to decide whether to show HRV/RHR tabs.
 *
 * `days` is clamped to [1, 730] so 1-year and 2-year ranges remain cheap.
 */
export async function getDetailHistoryForUser(
  userId: string,
  days: number,
): Promise<{
  days: Array<{
    date: string;
    score: number | null;
    inputCount: number;
    inputs: ReadinessInputs;
    raws: ReadinessRawValues;
    sources: ReadinessInputSources;
  }>;
  hasWearable: boolean;
}> {
  const safeDays = clamp(Math.floor(days || 30), 1, 730);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (safeDays - 1));
  const cutoffKey = toDateKey(cutoff);

  const rows = await db
    .select({
      date: dailyReadinessHistory.date,
      score: dailyReadinessHistory.score,
      inputCount: dailyReadinessHistory.inputCount,
      sleepInput: dailyReadinessHistory.sleepInput,
      energyInput: dailyReadinessHistory.energyInput,
      trainingLoadInput: dailyReadinessHistory.trainingLoadInput,
      hrvInput: dailyReadinessHistory.hrvInput,
      rhrInput: dailyReadinessHistory.rhrInput,
      sleepRaw: dailyReadinessHistory.sleepRaw,
      energyRaw: dailyReadinessHistory.energyRaw,
      trainingLoadRaw: dailyReadinessHistory.trainingLoadRaw,
      hrvRaw: dailyReadinessHistory.hrvRaw,
      rhrRaw: dailyReadinessHistory.rhrRaw,
      sourcesSnapshot: dailyReadinessHistory.sourcesSnapshot,
    })
    .from(dailyReadinessHistory)
    .where(
      and(
        eq(dailyReadinessHistory.userId, userId),
        gte(dailyReadinessHistory.date, cutoffKey),
      ),
    )
    .orderBy(asc(dailyReadinessHistory.date));

  // hasWearable: any wearableMetricsDaily row with non-null hrvMs OR
  // restingHrBpm tells us the user has a wearable capable of producing
  // the HRV/RHR-specific tabs.
  const wearableProbe = await db
    .select({ id: wearableMetricsDaily.id })
    .from(wearableMetricsDaily)
    .where(
      and(
        eq(wearableMetricsDaily.userId, userId),
        sql`(${wearableMetricsDaily.hrvMs} IS NOT NULL OR ${wearableMetricsDaily.restingHrBpm} IS NOT NULL)`,
      ),
    )
    .limit(1);
  const hasWearable = wearableProbe.length > 0;

  const empty: ReadinessInputSources = { sleep: null, energy: null, trainingLoad: null, hrv: null, rhr: null };

  return {
    days: rows.map(r => ({
      date: r.date,
      score: r.score,
      inputCount: r.inputCount ?? 0,
      inputs: {
        sleep: r.sleepInput,
        energy: r.energyInput,
        trainingLoad: r.trainingLoadInput,
        hrv: r.hrvInput,
        rhr: r.rhrInput,
      },
      raws: {
        sleep: r.sleepRaw,
        energy: r.energyRaw,
        trainingLoad: r.trainingLoadRaw,
        hrv: r.hrvRaw,
        rhr: r.rhrRaw,
      },
      sources: (r.sourcesSnapshot as ReadinessInputSources) ?? empty,
    })),
    hasWearable,
  };
}

/** Single-row helper used by the dashboard card. */
export async function getTodayForUser(userId: string): Promise<{
  date: string;
  score: number | null;
  inputCount: number;
  daysOfHistory: number;
  inputs: ReadinessInputs;
  sources: ReadinessInputSources;
}> {
  const today = toDateKey(new Date());
  const [row] = await db
    .select()
    .from(dailyReadinessHistory)
    .where(and(eq(dailyReadinessHistory.userId, userId), eq(dailyReadinessHistory.date, today)))
    .limit(1);
  const total = await db
    .select({ c: sql<number>`count(*)` })
    .from(dailyReadinessHistory)
    .where(and(eq(dailyReadinessHistory.userId, userId), sql`${dailyReadinessHistory.score} IS NOT NULL`));

  // When the row is locked, return the frozen inputs and sources directly
  // from the stored row — nothing about today's score can change once locked.
  // When unlocked, re-derive sources fresh from current data so late wearable
  // syncs can flip a label from "check-in" to "wearable" before lock.
  if (row?.locked) {
    const frozenSources: ReadinessInputSources = (row.sourcesSnapshot as ReadinessInputSources | null) ?? {
      sleep: null,
      energy: null,
      trainingLoad: null,
      hrv: null,
      rhr: null,
    };
    return {
      date: today,
      score: row.score ?? null,
      inputCount: row.inputCount ?? 0,
      daysOfHistory: Number(total[0]?.c || 0),
      inputs: {
        sleep: row.sleepInput ?? null,
        energy: row.energyInput ?? null,
        trainingLoad: row.trainingLoadInput ?? null,
        hrv: row.hrvInput ?? null,
        rhr: row.rhrInput ?? null,
      },
      sources: frozenSources,
    };
  }

  const { inputs, sources } = await gatherInputsForDay(userId, today);
  return {
    date: today,
    score: row?.score ?? null,
    inputCount: row?.inputCount ?? 0,
    daysOfHistory: Number(total[0]?.c || 0),
    inputs,
    sources,
  };
}

/**
 * Award the +100 Points "Above Baseline" weekly reward when the user had
 * 5+ days last week scoring strictly above their personal 30-day rolling
 * average (computed up to the start of that week). Idempotent — checks for
 * an existing readiness_weekly_baseline transaction for the week.
 */
export async function maybeAwardWeeklyBaseline(userId: string, weekStartKey: string): Promise<boolean> {
  // Idempotency: skip if already awarded for this user+week.
  // Use a typed Drizzle query (not raw SQL) so the result is statically
  // typed and we don't need any `as any` casts to read row count.
  const existing = await db
    .select({ id: pointsTransactions.id })
    .from(pointsTransactions)
    .where(
      and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.activityType, "readiness_weekly_baseline"),
        sql`(${pointsTransactions.metadata}->>'weekStart') = ${weekStartKey}`,
      ),
    )
    .limit(1);
  if (existing.length > 0) return false;

  const weekStart = startOfLocalDay(weekStartKey);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekEndKey = toDateKey(new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000));

  // Personal 30d rolling baseline ENDING the day before the just-finished week.
  const baselineEnd = new Date(weekStart.getTime() - 24 * 60 * 60 * 1000);
  const baselineStart = new Date(baselineEnd.getTime() - (ROLLING_AVERAGE_DAYS - 1) * 24 * 60 * 60 * 1000);
  const baselineRows = await db
    .select({ score: dailyReadinessHistory.score })
    .from(dailyReadinessHistory)
    .where(
      and(
        eq(dailyReadinessHistory.userId, userId),
        gte(dailyReadinessHistory.date, toDateKey(baselineStart)),
        lt(dailyReadinessHistory.date, weekStartKey),
        sql`${dailyReadinessHistory.score} IS NOT NULL`,
      ),
    );
  const baselineScores = baselineRows.map((r) => r.score!).filter((s) => s != null);
  if (baselineScores.length < HISTORY_DAYS_REQUIRED_FOR_BASELINE) return false;
  const baseline = baselineScores.reduce((s, v) => s + v, 0) / baselineScores.length;

  const weekRows = await db
    .select({ score: dailyReadinessHistory.score })
    .from(dailyReadinessHistory)
    .where(
      and(
        eq(dailyReadinessHistory.userId, userId),
        gte(dailyReadinessHistory.date, weekStartKey),
        lt(dailyReadinessHistory.date, toDateKey(weekEnd)),
        sql`${dailyReadinessHistory.score} IS NOT NULL`,
      ),
    );
  const aboveBaseline = weekRows.filter((r) => (r.score ?? 0) > baseline).length;
  if (aboveBaseline < WEEKLY_REWARD_DAYS_REQUIRED) return false;

  await awardPoints(userId, "readiness_weekly_baseline", {
    weekStart: weekStartKey,
    weekEnd: weekEndKey,
    baseline: Math.round(baseline * 10) / 10,
    aboveBaselineDays: aboveBaseline,
  });

  return true;
}

/** Returns the YYYY-MM-DD of the Monday of the week containing `d`. */
export function mondayOf(d: Date): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateKey(date);
}

/**
 * Run the nightly compute pass. Idempotent: re-running for the same day
 * just refreshes inputs/score. Also awards the weekly baseline reward when
 * the just-finished week is detected (i.e. it's currently Monday).
 *
 * Designed to be invoked from the existing scheduled-briefings tick within
 * a small overnight window (e.g. 02:00-04:00 local). Cheap when there are
 * no rows to write.
 */
export async function runNightlyReadinessCompute(opts?: { force?: boolean }): Promise<{
  computed: number;
  weeklyAwarded: number;
}> {
  if (!isFeatureEnabled() && !opts?.force) {
    return { computed: 0, weeklyAwarded: 0 };
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = toDateKey(yesterday);

  const userRows = await db.select({ id: users.id }).from(users);
  let computed = 0;
  let weeklyAwarded = 0;
  for (const u of userRows) {
    try {
      await computeAndStoreForUserDay(u.id, dateKey);
      computed++;
    } catch (err: any) {
      console.error(`[daily-readiness] compute failed user=${u.id} date=${dateKey}:`, err?.message);
    }
  }

  // If today is Monday (server local), evaluate the just-finished week.
  if (new Date().getDay() === 1) {
    const lastMonday = new Date();
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastWeekStart = mondayOf(lastMonday);
    for (const u of userRows) {
      try {
        const awarded = await maybeAwardWeeklyBaseline(u.id, lastWeekStart);
        if (awarded) weeklyAwarded++;
      } catch (err: any) {
        console.error(`[daily-readiness] weekly award failed user=${u.id}:`, err?.message);
      }
    }
  }

  if (computed > 0 || weeklyAwarded > 0) {
    console.log(
      `[daily-readiness] nightly compute: ${computed} score(s), ${weeklyAwarded} weekly reward(s)`,
    );
  }
  return { computed, weeklyAwarded };
}
