/**
 * Daily Readiness (Beta, User-Only)
 *
 * Personal 0-100 readiness score computed nightly per user from up to six
 * inputs (sleep, pain, energy, nutrition, movement, recovery). Equal-weighted
 * v1 algorithm — average of the available, non-null inputs (each on a 0-10
 * scale) multiplied by 10. Requires at least MIN_INPUTS_FOR_SCORE inputs
 * before a score is recorded; otherwise the row stores the inputs for later
 * recompute and leaves `score` null.
 *
 * STRICT CONTAINMENT: this score is shown only on the user's personal
 * dashboard. It is NEVER aggregated into admin reports, CSV exports, or
 * AI Executive Narrator output. See server/reportNarrator.ts and
 * server/reportingEngine.ts for the corresponding guardrails.
 */
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  bodyMapLogs,
  checkIns,
  dailyReadinessHistory,
  mealLogs,
  pointsTransactions,
  sleepEntries,
  stepEntries,
  users,
  wearableMetricsDaily,
  workoutLogs,
} from "@shared/schema";
import { awardPoints } from "./engagementEngine";
import { notify } from "./notifications";

export const MIN_INPUTS_FOR_SCORE = 3;
export const ALGORITHM_VERSION = "v1";
export const HISTORY_DAYS_REQUIRED_FOR_BASELINE = 14;
export const ROLLING_AVERAGE_DAYS = 30;
export const WEEKLY_REWARD_DAYS_REQUIRED = 5;
export const WEEKLY_REWARD_POINTS = 100;

export function isFeatureEnabled(): boolean {
  return process.env.DAILY_READINESS_ENABLED === "true";
}

export interface ReadinessInputs {
  sleep: number | null;
  pain: number | null;
  energy: number | null;
  nutrition: number | null;
  movement: number | null;
  recovery: number | null;
}

/**
 * Per-input provenance — which underlying log produced the value. `null`
 * means the input was missing for the day. Surfaced to the dashboard so
 * users can see why their score looks the way it does and what to log next.
 */
export type ReadinessInputSource =
  | "wearable"
  | "check-in"
  | "body-map"
  | "sleep-log"
  | "meal-log"
  | "workout-log"
  | "step-log";

export type ReadinessInputSources = Record<keyof ReadinessInputs, ReadinessInputSource | null>;

export interface ReadinessInputsWithSources {
  inputs: ReadinessInputs;
  sources: ReadinessInputSources;
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
 * Pure equal-weighted v1: mean of the non-null inputs (each 0-10) * 10.
 * Returns null when fewer than MIN_INPUTS_FOR_SCORE signals are available.
 */
export function computeDailyReadinessV1(inputs: ReadinessInputs): ReadinessResult {
  const values = (Object.values(inputs) as Array<number | null>).filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );
  const inputCount = values.length;
  if (inputCount < MIN_INPUTS_FOR_SCORE) {
    return { inputs, inputCount, score: null };
  }
  const mean = values.reduce((s, v) => s + v, 0) / inputCount;
  const score = Math.round(clamp(mean * 10, 0, 100));
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

/** Today's local-day key. */
export function todayKey(): string {
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
 * Build the six readiness inputs for a single user on a single local day.
 * Each input is normalised to 0-10. Missing data => null (not zero).
 */
export async function gatherInputsForDay(
  userId: string,
  dateKey: string,
): Promise<ReadinessInputsWithSources> {
  const dayStart = startOfLocalDay(dateKey);
  const dayEnd = endOfLocalDay(dateKey);

  // --- Check-in (1-5 sliders) for the day ---
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

  // --- Wearable daily (provider priority handled by picking newest) ---
  const wearableRows = await db
    .select()
    .from(wearableMetricsDaily)
    .where(and(eq(wearableMetricsDaily.userId, userId), eq(wearableMetricsDaily.date, dateKey)))
    .orderBy(desc(wearableMetricsDaily.updatedAt));
  const wear = wearableRows[0];

  const sources: ReadinessInputSources = {
    sleep: null,
    pain: null,
    energy: null,
    nutrition: null,
    movement: null,
    recovery: null,
  };

  // --- Sleep ---
  // Prefer wearable sleepScore (0-100 → /10); else manual sleepEntries duration
  // (target 8h ⇒ score 10); else check-in sleepScore (1-5 → 2,4,6,8,10).
  let sleep: number | null = null;
  if (wear?.sleepScore != null) {
    sleep = clamp(wear.sleepScore / 10, 0, 10);
    sources.sleep = "wearable";
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
      const score = se.sleepScore;
      if (score != null) {
        sleep = clamp(score / 10, 0, 10);
        sources.sleep = "sleep-log";
      } else if (se.durationMinutes != null) {
        sleep = clamp((se.durationMinutes / 60 / 8) * 10, 0, 10);
        sources.sleep = "sleep-log";
      }
    }
    if (sleep == null && ci?.sleepScore != null) {
      sleep = clamp(ci.sleepScore * 2, 0, 10);
      sources.sleep = "check-in";
    }
  }

  // --- Pain (inverted) ---
  // Body map severity is 1-10 (10 worst). Take worst log of the day; invert.
  let pain: number | null = null;
  const bmRows = await db
    .select({ severity: bodyMapLogs.severity })
    .from(bodyMapLogs)
    .where(
      and(
        eq(bodyMapLogs.userId, userId),
        gte(bodyMapLogs.createdAt, dayStart),
        lt(bodyMapLogs.createdAt, dayEnd),
      ),
    );
  if (bmRows.length > 0) {
    const worst = Math.max(...bmRows.map((r) => r.severity || 0));
    pain = clamp(10 - worst, 0, 10);
    sources.pain = "body-map";
  } else if (ci) {
    // No body-map log: derive from check-in painOrInjury flag (10 if no pain).
    pain = ci.painOrInjury ? 4 : 10;
    sources.pain = "check-in";
  }

  // --- Energy ---
  let energy: number | null = null;
  if (ci?.energyScore != null) {
    energy = clamp(ci.energyScore * 2, 0, 10);
    sources.energy = "check-in";
  }

  // --- Nutrition ---
  // Count meals logged that day, cap at 3. 3 meals ⇒ 10.
  let nutrition: number | null = null;
  const mealRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(mealLogs)
    .where(
      and(
        eq(mealLogs.userId, userId),
        // Use the user-attributed meal `date` (not `createdAt`) so meals
        // logged retroactively for the day still count toward that day's
        // nutrition input.
        gte(mealLogs.date, dayStart),
        lt(mealLogs.date, dayEnd),
      ),
    );
  const mealCount = Number(mealRow[0]?.c || 0);
  if (mealCount > 0) {
    nutrition = clamp((Math.min(mealCount, 3) / 3) * 10, 0, 10);
    sources.nutrition = "meal-log";
  }

  // --- Movement ---
  // Workout completed today ⇒ 10. Else steps (10k = 10). Wearable steps preferred.
  let movement: number | null = null;
  const woRows = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        gte(workoutLogs.completedAt, dayStart),
        lt(workoutLogs.completedAt, dayEnd),
      ),
    )
    .limit(1);
  if (woRows.length > 0) {
    movement = 10;
    sources.movement = "workout-log";
  } else if (wear?.steps != null) {
    movement = clamp((wear.steps / 10000) * 10, 0, 10);
    sources.movement = "wearable";
  } else {
    const stepRows = await db
      .select()
      .from(stepEntries)
      .where(
        and(
          eq(stepEntries.userId, userId),
          gte(stepEntries.date, dayStart),
          lt(stepEntries.date, dayEnd),
        ),
      )
      .limit(1);
    const se = stepRows[0];
    if (se?.steps != null) {
      movement = clamp((se.steps / 10000) * 10, 0, 10);
      sources.movement = "step-log";
    }
  }

  // --- Recovery ---
  // Wearable readinessScore (0-100 → /10) wins; else mood + inverse-stress avg.
  let recovery: number | null = null;
  if (wear?.readinessScore != null) {
    recovery = clamp(wear.readinessScore / 10, 0, 10);
    sources.recovery = "wearable";
  } else if (ci?.moodScore != null || ci?.stressScore != null) {
    const parts: number[] = [];
    if (ci.moodScore != null) parts.push(clamp(ci.moodScore * 2, 0, 10));
    if (ci.stressScore != null) parts.push(clamp((6 - ci.stressScore) * 2, 0, 10));
    if (ci.practicedMindfulness) parts.push(10);
    if (parts.length > 0) {
      recovery = parts.reduce((s, v) => s + v, 0) / parts.length;
      sources.recovery = "check-in";
    }
  }

  const inputs: ReadinessInputs = {
    sleep: sleep == null ? null : Math.round(sleep * 10) / 10,
    pain: pain == null ? null : Math.round(pain * 10) / 10,
    energy: energy == null ? null : Math.round(energy * 10) / 10,
    nutrition: nutrition == null ? null : Math.round(nutrition * 10) / 10,
    movement: movement == null ? null : Math.round(movement * 10) / 10,
    recovery: recovery == null ? null : Math.round(recovery * 10) / 10,
  };
  return { inputs, sources };
}

/** Compute and upsert a single user/day row. Returns the result. */
export async function computeAndStoreForUserDay(
  userId: string,
  dateKey: string,
): Promise<ReadinessResult> {
  const { inputs } = await gatherInputsForDay(userId, dateKey);
  const result = computeDailyReadinessV1(inputs);
  await db
    .insert(dailyReadinessHistory)
    .values({
      userId,
      date: dateKey,
      sleepInput: inputs.sleep,
      painInput: inputs.pain,
      energyInput: inputs.energy,
      nutritionInput: inputs.nutrition,
      movementInput: inputs.movement,
      recoveryInput: inputs.recovery,
      inputCount: result.inputCount,
      score: result.score,
      algorithmVersion: ALGORITHM_VERSION,
    })
    .onConflictDoUpdate({
      target: [dailyReadinessHistory.userId, dailyReadinessHistory.date],
      set: {
        sleepInput: inputs.sleep,
        painInput: inputs.pain,
        energyInput: inputs.energy,
        nutritionInput: inputs.nutrition,
        movementInput: inputs.movement,
        recoveryInput: inputs.recovery,
        inputCount: result.inputCount,
        score: result.score,
        algorithmVersion: ALGORITHM_VERSION,
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
  // Re-derive sources for today's inputs. The persisted row only stores
  // the numeric values, not their provenance, so we re-run the gather to
  // attach a source label per input. Cheap (same query the route just ran)
  // and keeps the storage schema unchanged.
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

  try {
    await notify({
      userId,
      category: "coach",
      title: "Weekly readiness reward earned",
      body: `You hit ${WEEKLY_REWARD_DAYS_REQUIRED}+ above-baseline days last week — +${WEEKLY_REWARD_POINTS} pts.`,
      data: {
        kind: "readiness_weekly_baseline",
        weekStart: weekStartKey,
        weekEnd: weekEndKey,
        aboveBaselineDays: aboveBaseline,
        points: WEEKLY_REWARD_POINTS,
      },
    });
  } catch (err: any) {
    console.error(
      `[daily-readiness] weekly reward notify failed user=${userId}:`,
      err?.message,
    );
  }

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
