import { db } from "../db";
import { wearableConnections, wearableMetricsDaily, wearableSyncLogs, wearableWorkouts, stepEntries, habits, habitCompletions, type WearableConnection, type WearableMetricsDaily, type WearableWorkout } from "@shared/schema";
import type { NormalisedDailyMetrics, WearableAdapter, WearableProvider } from "./types";
import { ouraAdapter } from "./oura";
import { whoopAdapter } from "./whoop";
import { googleFitAdapter } from "./googleFit";
import { encryptToken, decryptToken } from "./encryption";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

export const ADAPTERS: Record<WearableProvider, WearableAdapter | null> = {
  oura: ouraAdapter,
  whoop: whoopAdapter,
  google_fit: googleFitAdapter,
  apple_health: null, // upload-only
};

export const PROVIDER_LABELS: Record<WearableProvider, string> = {
  oura: "Oura Ring",
  whoop: "WHOOP",
  google_fit: "Google Fit",
  apple_health: "Apple Health",
};

export function getAdapter(provider: string): WearableAdapter | null {
  if (provider in ADAPTERS) return ADAPTERS[provider as WearableProvider];
  return null;
}

export function buildRedirectUri(req: { protocol: string; get(h: string): string | undefined }, provider: string): string {
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${host}/api/wearables/callback/${provider}`;
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function upsertConnection(userId: string, provider: WearableProvider, data: {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  providerUserId?: string | null;
  scopes?: string[] | null;
  status?: string;
  meta?: any;
}): Promise<WearableConnection> {
  const [existing] = await db.select().from(wearableConnections)
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)));

  const payload: any = {
    status: data.status ?? "connected",
    updatedAt: new Date(),
  };
  if (data.accessToken !== undefined) payload.accessTokenEnc = encryptToken(data.accessToken);
  if (data.refreshToken !== undefined) payload.refreshTokenEnc = encryptToken(data.refreshToken);
  if (data.tokenExpiresAt !== undefined) payload.tokenExpiresAt = data.tokenExpiresAt;
  if (data.providerUserId !== undefined) payload.providerUserId = data.providerUserId;
  if (data.scopes !== undefined) payload.scopes = data.scopes;
  if (data.meta !== undefined) payload.meta = data.meta;

  if (existing) {
    const [u] = await db.update(wearableConnections).set(payload)
      .where(eq(wearableConnections.id, existing.id)).returning();
    return u;
  }
  const [created] = await db.insert(wearableConnections).values({
    userId, provider, connectedAt: new Date(), ...payload,
  }).returning();
  return created;
}

export async function getConnections(userId: string): Promise<WearableConnection[]> {
  return db.select().from(wearableConnections).where(eq(wearableConnections.userId, userId));
}

export async function getConnection(userId: string, provider: string): Promise<WearableConnection | undefined> {
  const [row] = await db.select().from(wearableConnections)
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)));
  return row;
}

export async function disconnectProvider(userId: string, provider: string, deleteData = false): Promise<void> {
  await db.update(wearableConnections)
    .set({ status: "disconnected", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)));
  if (deleteData) {
    await db.delete(wearableMetricsDaily)
      .where(and(eq(wearableMetricsDaily.userId, userId), eq(wearableMetricsDaily.provider, provider)));
  }
}

export async function upsertDailyMetrics(userId: string, provider: WearableProvider, metrics: NormalisedDailyMetrics[]): Promise<number> {
  let count = 0;
  for (const m of metrics) {
    if (!m.date) continue;
    const values: any = {
      userId,
      provider,
      date: m.date,
      sleepMinutes: m.sleepMinutes ?? null,
      sleepDeepMinutes: m.sleepDeepMinutes ?? null,
      sleepRemMinutes: m.sleepRemMinutes ?? null,
      sleepLightMinutes: m.sleepLightMinutes ?? null,
      sleepAwakeMinutes: m.sleepAwakeMinutes ?? null,
      sleepScore: m.sleepScore ?? null,
      hrvMs: m.hrvMs ?? null,
      restingHrBpm: m.restingHrBpm ?? null,
      steps: m.steps ?? null,
      activeMinutes: m.activeMinutes ?? null,
      caloriesBurned: m.caloriesBurned ?? null,
      readinessScore: m.readinessScore ?? null,
      strainScore: m.strainScore ?? null,
      workoutCount: m.workoutCount ?? null,
      vo2MaxMlKgMin: m.vo2MaxMlKgMin ?? null,
      raw: m.raw ?? null,
      updatedAt: new Date(),
    };
    await db.insert(wearableMetricsDaily).values(values).onConflictDoUpdate({
      target: [wearableMetricsDaily.userId, wearableMetricsDaily.date, wearableMetricsDaily.provider],
      set: {
        ...(values.sleepMinutes != null && { sleepMinutes: values.sleepMinutes }),
        ...(values.sleepDeepMinutes != null && { sleepDeepMinutes: values.sleepDeepMinutes }),
        ...(values.sleepRemMinutes != null && { sleepRemMinutes: values.sleepRemMinutes }),
        ...(values.sleepLightMinutes != null && { sleepLightMinutes: values.sleepLightMinutes }),
        ...(values.sleepAwakeMinutes != null && { sleepAwakeMinutes: values.sleepAwakeMinutes }),
        ...(values.sleepScore != null && { sleepScore: values.sleepScore }),
        ...(values.hrvMs != null && { hrvMs: values.hrvMs }),
        ...(values.restingHrBpm != null && { restingHrBpm: values.restingHrBpm }),
        ...(values.steps != null && { steps: values.steps }),
        ...(values.activeMinutes != null && { activeMinutes: values.activeMinutes }),
        ...(values.caloriesBurned != null && { caloriesBurned: values.caloriesBurned }),
        ...(values.readinessScore != null && { readinessScore: values.readinessScore }),
        ...(values.strainScore != null && { strainScore: values.strainScore }),
        ...(values.workoutCount != null && { workoutCount: values.workoutCount }),
        ...(values.vo2MaxMlKgMin != null && { vo2MaxMlKgMin: values.vo2MaxMlKgMin }),
        ...(values.raw != null && { raw: values.raw }),
        updatedAt: new Date(),
      },
    });
    count++;
  }

  // After persisting wearable metrics, sync step entries and auto-complete the step habit.
  // Fire-and-forget: a failure here must never break the sync response.
  syncStepGoalsAndHabits(userId, metrics).catch((e) =>
    console.error("[wearables] syncStepGoalsAndHabits failed:", e?.message || e)
  );

  return count;
}

/**
 * For every day in `metrics` that carries a step count:
 *  1. Upserts a row in step_entries (wearable value wins — objective source).
 *  2. Auto-completes the user's "Hit Your Step Count" habit when the target is met,
 *     but never un-completes a day and never creates duplicate completions.
 *
 * Called after every upsertDailyMetrics so all providers (Apple Health, WHOOP, Oura …)
 * benefit automatically. Idempotent — safe to re-run for the same dates.
 */
async function syncStepGoalsAndHabits(userId: string, metrics: NormalisedDailyMetrics[]): Promise<void> {
  const daysWithSteps = metrics.filter((m) => m.date && m.steps != null && m.steps > 0);
  if (daysWithSteps.length === 0) return;

  // ── 1. Upsert step_entries (wearable wins) ──────────────────────────────────
  for (const m of daysWithSteps) {
    const dayStart = new Date(`${m.date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${m.date}T23:59:59.999Z`);

    const [existing] = await db
      .select({ id: stepEntries.id })
      .from(stepEntries)
      .where(and(
        eq(stepEntries.userId, userId),
        gte(stepEntries.date, dayStart),
        lte(stepEntries.date, dayEnd),
      ))
      .limit(1);

    if (existing) {
      await db
        .update(stepEntries)
        .set({ steps: m.steps! })
        .where(eq(stepEntries.id, existing.id));
    } else {
      await db.insert(stepEntries).values({ userId, date: dayStart, steps: m.steps! });
    }
  }

  // ── 2. Auto-complete "Hit Your Step Count" habit ─────────────────────────────
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.title, "Hit Your Step Count")))
    .orderBy(desc(habits.id))
    .limit(1);

  if (!habit) return;

  const stepTarget: number = (habit.settings as any)?.stepTarget ?? 10000;
  let anyNewCompletion = false;

  for (const m of daysWithSteps) {
    if ((m.steps ?? 0) < stepTarget) continue;

    const dayStart = new Date(`${m.date}T00:00:00.000Z`);
    const dayEnd   = new Date(`${m.date}T23:59:59.999Z`);

    // Guard: skip if already completed for this date
    const [alreadyDone] = await db
      .select({ id: habitCompletions.id })
      .from(habitCompletions)
      .where(and(
        eq(habitCompletions.habitId, habit.id),
        eq(habitCompletions.userId, userId),
        gte(habitCompletions.completedDate, dayStart),
        lte(habitCompletions.completedDate, dayEnd),
      ))
      .limit(1);

    if (alreadyDone) continue;

    await db.insert(habitCompletions).values({
      habitId: habit.id,
      userId,
      completedDate: dayStart,
    });
    anyNewCompletion = true;
    console.log(`[wearables] auto-completed step habit for ${userId} on ${m.date} (${m.steps} steps >= ${stepTarget})`);
  }

  // Recalculate streak only when at least one new completion was added
  if (anyNewCompletion) {
    const { storage } = await import("../storage");
    await storage.updateHabitStreak(habit.id);
  }
}

async function refreshIfNeeded(conn: WearableConnection, adapter: WearableAdapter): Promise<string | null> {
  let accessToken = decryptToken(conn.accessTokenEnc);
  const refreshToken = decryptToken(conn.refreshTokenEnc);
  const expired = conn.tokenExpiresAt && new Date(conn.tokenExpiresAt).getTime() < Date.now() + 60_000;
  if (expired && refreshToken && adapter.refresh) {
    try {
      const fresh = await adapter.refresh(refreshToken);
      await upsertConnection(conn.userId, conn.provider as WearableProvider, {
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken ?? refreshToken,
        tokenExpiresAt: fresh.expiresAt ?? null,
        status: "connected",
      });
      accessToken = fresh.accessToken;
    } catch (err: any) {
      await db.update(wearableConnections)
        .set({ status: "needs_reauth", lastSyncStatus: "error", lastSyncError: String(err?.message || err) })
        .where(eq(wearableConnections.id, conn.id));
      return null;
    }
  }
  return accessToken;
}

export async function syncProvider(userId: string, provider: WearableProvider, opts: { days?: number; trigger?: string } = {}): Promise<{ daysSynced: number; status: "ok" | "error"; error?: string }> {
  const adapter = getAdapter(provider);
  // 30-day backfill on initial OAuth, 7-day rolling window on scheduled/manual
  const defaultDays = opts.trigger === "oauth_callback" ? 30 : 7;
  const days = opts.days ?? defaultDays;
  const trigger = opts.trigger || "manual";

  const [logRow] = await db.insert(wearableSyncLogs).values({
    userId, provider, status: "ok", trigger, startedAt: new Date(),
  }).returning();

  const finalize = async (status: "ok" | "error", daysSynced: number, errorMessage?: string) => {
    await db.update(wearableSyncLogs).set({
      status, completedAt: new Date(), daysSynced, errorMessage: errorMessage || null,
    }).where(eq(wearableSyncLogs.id, logRow.id));
    await db.update(wearableConnections).set({
      lastSyncAt: new Date(), lastSyncStatus: status, lastSyncError: errorMessage || null, updatedAt: new Date(),
    }).where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, provider)));
  };

  if (provider === "apple_health") {
    await finalize("ok", 0, undefined);
    return { daysSynced: 0, status: "ok" };
  }

  if (!adapter || !adapter.fetchDaily) {
    await finalize("error", 0, "Adapter not available");
    return { daysSynced: 0, status: "error", error: "Adapter not available" };
  }

  const conn = await getConnection(userId, provider);
  if (!conn || conn.status === "disconnected") {
    await finalize("error", 0, "Not connected");
    return { daysSynced: 0, status: "error", error: "Not connected" };
  }

  try {
    const accessToken = await refreshIfNeeded(conn, adapter);
    if (!accessToken) {
      await finalize("error", 0, "Token refresh failed");
      return { daysSynced: 0, status: "error", error: "Token refresh failed" };
    }
    const today = new Date();
    const fromDate = dateOnly(new Date(today.getTime() - days * 24 * 60 * 60 * 1000));
    const toDate = dateOnly(today);
    const metrics = await adapter.fetchDaily(accessToken, fromDate, toDate);
    const written = await upsertDailyMetrics(userId, provider, metrics);
    await finalize("ok", written);
    return { daysSynced: written, status: "ok" };
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error(`[wearables] sync ${provider} for ${userId} failed:`, msg);
    await finalize("error", 0, msg);
    return { daysSynced: 0, status: "error", error: msg };
  }
}

export interface MobileWorkoutInput {
  startedAt: string; // ISO 8601
  endedAt?: string | null;
  type?: string | null;
  durationMinutes?: number | null;
  distanceMeters?: number | null;
  activeEnergyKcal?: number | null;
  averageHeartRate?: number | null;
}

/**
 * Idempotently upsert per-workout records from a mobile HealthKit sync.
 * Unique constraint: (userId, provider, startedAt).
 * Returns the count of rows inserted or updated.
 */
export async function upsertWearableWorkouts(
  userId: string,
  provider: WearableProvider,
  workouts: MobileWorkoutInput[],
): Promise<number> {
  let count = 0;
  for (const w of workouts) {
    if (!w.startedAt) continue;
    const startedAt = new Date(w.startedAt);
    if (isNaN(startedAt.getTime())) continue;

    const values: any = {
      userId,
      provider,
      startedAt,
      endedAt: w.endedAt ? new Date(w.endedAt) : null,
      type: w.type ?? null,
      durationMinutes: w.durationMinutes ?? null,
      distanceMeters: w.distanceMeters ?? null,
      activeEnergyKcal: w.activeEnergyKcal ?? null,
      averageHeartRate: w.averageHeartRate ?? null,
      raw: w,
      updatedAt: new Date(),
    };

    await db.insert(wearableWorkouts).values(values).onConflictDoUpdate({
      target: [wearableWorkouts.userId, wearableWorkouts.provider, wearableWorkouts.startedAt],
      set: {
        endedAt: values.endedAt,
        type: values.type,
        durationMinutes: values.durationMinutes,
        distanceMeters: values.distanceMeters,
        activeEnergyKcal: values.activeEnergyKcal,
        averageHeartRate: values.averageHeartRate,
        raw: values.raw,
        updatedAt: values.updatedAt,
      },
    });
    count++;
  }
  return count;
}

/**
 * Fetch the most recent wearable workouts for a user across all (or a specific) provider.
 */
export async function getWearableWorkouts(
  userId: string,
  limit = 20,
  provider?: WearableProvider,
): Promise<WearableWorkout[]> {
  const conditions = [eq(wearableWorkouts.userId, userId)];
  if (provider) conditions.push(eq(wearableWorkouts.provider, provider));
  return db
    .select()
    .from(wearableWorkouts)
    .where(and(...conditions))
    .orderBy(desc(wearableWorkouts.startedAt))
    .limit(limit);
}

// Get the most recent N days of normalised metrics across all providers,
// preferring the most-recently-synced provider per (date) when conflicts exist.
export async function getRecentWearableMetrics(userId: string, days = 30): Promise<{ rows: WearableMetricsDaily[]; bestProviderByDate: Map<string, string> }> {
  const cutoff = dateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const rows = await db.select().from(wearableMetricsDaily)
    .where(and(eq(wearableMetricsDaily.userId, userId), sql`${wearableMetricsDaily.date} >= ${cutoff}`));

  // Provider preference: oura > whoop > apple_health > google_fit (medical-grade signal quality)
  const PRIORITY: Record<string, number> = { oura: 4, whoop: 3, apple_health: 2, google_fit: 1 };
  const bestProviderByDate = new Map<string, string>();
  for (const r of rows) {
    const cur = bestProviderByDate.get(r.date);
    if (!cur || (PRIORITY[r.provider] || 0) > (PRIORITY[cur] || 0)) {
      bestProviderByDate.set(r.date, r.provider);
    }
  }
  return { rows, bestProviderByDate };
}
