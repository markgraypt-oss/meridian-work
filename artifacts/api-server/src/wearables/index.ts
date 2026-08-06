import { db } from "../db";
import { wearableConnections, wearableMetricsDaily, wearableSyncLogs, wearableWorkouts, stepEntries, habits, habitCompletions, type WearableConnection, type WearableMetricsDaily, type WearableWorkout } from "@workspace/db";
import type { NormalisedDailyMetrics, OAuthTokens, WearableAdapter, WearableProvider } from "./types";
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

export async function getConnectionsByProvider(provider: WearableProvider): Promise<WearableConnection[]> {
  return db.select().from(wearableConnections).where(eq(wearableConnections.provider, provider));
}

export async function getConnectionByProviderUser(provider: WearableProvider, providerUserId: string): Promise<WearableConnection | undefined> {
  const [row] = await db.select().from(wearableConnections)
    .where(and(
      eq(wearableConnections.provider, provider),
      eq(wearableConnections.providerUserId, providerUserId),
    ));
  return row;
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
    // Build update set that only overwrites fields when the new value is non-null.
    // This prevents a re-sync that happens to return empty for one metric (e.g. an
    // HRV query that slices through a chunk boundary) from destroying previously
    // collected data for that day.
    const updateSet: any = { updatedAt: new Date() };
    if (values.sleepMinutes !== null) updateSet.sleepMinutes = values.sleepMinutes;
    if (values.sleepDeepMinutes !== null) updateSet.sleepDeepMinutes = values.sleepDeepMinutes;
    if (values.sleepRemMinutes !== null) updateSet.sleepRemMinutes = values.sleepRemMinutes;
    if (values.sleepLightMinutes !== null) updateSet.sleepLightMinutes = values.sleepLightMinutes;
    if (values.sleepAwakeMinutes !== null) updateSet.sleepAwakeMinutes = values.sleepAwakeMinutes;
    if (values.sleepScore !== null) updateSet.sleepScore = values.sleepScore;
    if (values.hrvMs !== null) updateSet.hrvMs = values.hrvMs;
    if (values.restingHrBpm !== null) updateSet.restingHrBpm = values.restingHrBpm;
    if (values.steps !== null) updateSet.steps = values.steps;
    if (values.activeMinutes !== null) updateSet.activeMinutes = values.activeMinutes;
    if (values.caloriesBurned !== null) updateSet.caloriesBurned = values.caloriesBurned;
    if (values.readinessScore !== null) updateSet.readinessScore = values.readinessScore;
    if (values.strainScore !== null) updateSet.strainScore = values.strainScore;
    if (values.workoutCount !== null) updateSet.workoutCount = values.workoutCount;
    if (values.vo2MaxMlKgMin !== null) updateSet.vo2MaxMlKgMin = values.vo2MaxMlKgMin;
    if (values.raw !== null) updateSet.raw = values.raw;

    await db.insert(wearableMetricsDaily).values(values).onConflictDoUpdate({
      target: [wearableMetricsDaily.userId, wearableMetricsDaily.date, wearableMetricsDaily.provider],
      set: updateSet,
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

// Serialize token refreshes per connection within this process. WHOOP and Oura
// hand out SINGLE-USE refresh tokens: the morning burst of WHOOP webhooks (sleep
// + recovery + workout arrive together) plus the hourly scheduler can refresh
// the SAME token concurrently. The first call consumes it and receives a new
// one; every other concurrent call then fails with invalid_grant — and the old
// code treated that as "condemn the connection" (needs_reauth), auto-dropping a
// perfectly healthy WHOOP link through no fault of the user. This chain runs
// refreshes for a given connection one-at-a-time, so only the first refreshes
// and the rest reuse the fresh token.
const refreshChains = new Map<number, Promise<any>>();
function withConnLock<T>(connId: number, fn: () => Promise<T>): Promise<T> {
  const prev = refreshChains.get(connId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the chain alive for the next caller; swallow errors on the stored link
  // so one failure never rejects the next queued refresh.
  refreshChains.set(connId, run.then(() => {}, () => {}));
  return run;
}

function tokenExpired(c: { tokenExpiresAt: Date | string | null } | undefined | null): boolean {
  return !!(c && c.tokenExpiresAt && new Date(c.tokenExpiresAt).getTime() < Date.now() + 60_000);
}

async function refreshIfNeeded(conn: WearableConnection, adapter: WearableAdapter): Promise<string | null> {
  // Fast path: token still valid — no refresh, no lock.
  if (!tokenExpired(conn) || !adapter.refresh) {
    return decryptToken(conn.accessTokenEnc);
  }

  return withConnLock(conn.id, async () => {
    // CROSS-INSTANCE serialization. The deployment is autoscale: several
    // copies of this server can run at once, and the in-process chain above
    // only serializes within ONE copy. WHOOP/Oura refresh tokens are
    // single-use WITH reuse detection: if two instances refresh the same
    // token concurrently, the loser's "reuse" makes the provider revoke the
    // ENTIRE token family — killing even the winner's fresh token and forcing
    // a manual reconnect. A Postgres advisory xact-lock keyed on the
    // connection id makes every instance take turns: the first refreshes,
    // the rest wake, re-read, and reuse the fresh token.
    let notifyDisconnect = false;
    // If WHOOP rotates the token but the DATABASE fails at the save step (a
    // dropped connection — see db.ts), the fresh tokens exist only in memory:
    // losing them leaves the consumed token in the DB, the next refresh
    // replays it, and the provider revokes the whole family. Capture the
    // rotated tokens here and persist them AT ALL COSTS below.
    let unsavedFresh: OAuthTokens | null = null;
    let token: string | null = null;
    try {
    token = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(42117, ${conn.id})`);

    // Re-read inside the lock: another worker (this instance or any other)
    // may have refreshed while we waited. Reuse its fresh token (and clear
    // any stale needs_reauth flag) instead of burning a consumed token.
    const [cur] = await tx.select().from(wearableConnections).where(eq(wearableConnections.id, conn.id));
    if (cur && !tokenExpired(cur)) {
      if (cur.status === "needs_reauth") {
        await tx.update(wearableConnections).set({ status: "connected", updatedAt: new Date() }).where(eq(wearableConnections.id, cur.id));
      }
      return decryptToken(cur.accessTokenEnc);
    }

    const refreshToken = decryptToken((cur ?? conn).refreshTokenEnc);
    if (!refreshToken) return null;

    try {
      // Never hold the advisory lock + a pool connection on a hung HTTP
      // call: time the refresh out after 20s. The timeout message does NOT
      // match the fatal regex, so a trip is treated as transient (status
      // untouched, retried next tick). Rare edge: if the provider actually
      // processed the refresh after we gave up, the stored token is consumed
      // and the NEXT attempt fails fatally — acceptable, and reuse-detection
      // does not fire for a single late consumer.
      const fresh = await Promise.race([
        adapter.refresh(refreshToken),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("refresh timed out after 20s")), 20_000),
        ),
      ]);
      // Rotation happened at the provider. From this moment the fresh tokens
      // MUST reach the DB or the family dies — track them until saved.
      unsavedFresh = { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken };
      await tx.update(wearableConnections).set({
        accessTokenEnc: encryptToken(fresh.accessToken),
        refreshTokenEnc: encryptToken(fresh.refreshToken ?? refreshToken),
        tokenExpiresAt: fresh.expiresAt ?? null,
        status: "connected",
        updatedAt: new Date(),
      }).where(eq(wearableConnections.id, conn.id));
      unsavedFresh = null; // saved inside the transaction
      return fresh.accessToken;
    } catch (err: any) {
      const msg = String(err?.message || err);
      // No post-failure re-read needed: we HOLD the advisory lock, so no other
      // worker can have refreshed this connection while our call was in flight.
      // Only condemn on a genuine token rejection. Transient failures (network,
      // 5xx, timeouts) leave status untouched so the next tick retries.
      // Deployment logs were blind to refresh deaths (nothing logged them) —
      // always print the REAL provider error here.
      console.error(`[wearables] token refresh FAILED for conn ${conn.id} (${conn.provider}):`, msg);
      const fatal = /invalid_grant|invalid_token|unauthorized|\b400\b|\b401\b/i.test(msg);
      if (fatal) {
        // Reconnect-interleave guard: the OAuth callback writes new tokens
        // WITHOUT taking this lock. If the user re-authorised while our
        // (doomed) refresh call was in flight, the row now carries a NEW
        // token family — the encrypted string always changes on rewrite
        // (random IVs). Never stamp needs_reauth over a fresh reconnect;
        // skip, and the next sync uses the new tokens.
        // Second look after a short delay: a re-auth callback OR another
        // worker's post-failure save-retry may have landed new tokens while
        // our doomed call was in flight. Never condemn over a stale read.
        await new Promise((r) => setTimeout(r, 3000));
        const [latest] = await tx.select().from(wearableConnections).where(eq(wearableConnections.id, conn.id));
        if (latest && (latest.refreshTokenEnc !== (cur ?? conn).refreshTokenEnc || !tokenExpired(latest))) {
          console.log(`[wearables] refresh failed but row has newer/valid tokens — not condemning conn ${conn.id}`);
          return decryptToken(latest.accessTokenEnc);
        }
        await tx.update(wearableConnections)
          .set({ status: "needs_reauth", lastSyncStatus: "error", lastSyncError: msg })
          .where(eq(wearableConnections.id, conn.id));
        // Alert the user ONCE, on the connected -> needs_reauth transition
        // only — fired AFTER the transaction commits (see below), never while
        // holding the advisory lock + a pool connection.
        if (conn.status !== "needs_reauth") notifyDisconnect = true;
      } else {
        await tx.update(wearableConnections)
          .set({ lastSyncStatus: "error", lastSyncError: msg })
          .where(eq(wearableConnections.id, conn.id));
      }
      return null;
    }
    });
    } catch (txErr: any) {
      // The transaction itself died (DB connection drop mid-refresh).
      console.error(`[wearables] refresh transaction failed for conn ${conn.id}:`, txErr?.message || txErr);
    }

    // Persist-at-all-costs: if the provider rotated the token but the
    // transaction failed before the save committed, write the fresh tokens
    // with plain retries on new connections. Give up only after 5 attempts —
    // and even then DO NOT condemn (transient), so the next tick can still
    // recover.
    if (unsavedFresh) {
      for (let attempt = 1; attempt <= 5 && unsavedFresh; attempt++) {
        try {
          await db.update(wearableConnections).set({
            accessTokenEnc: encryptToken(unsavedFresh.accessToken),
            refreshTokenEnc: encryptToken(unsavedFresh.refreshToken ?? null),
            tokenExpiresAt: unsavedFresh.expiresAt ?? null,
            status: "connected",
            updatedAt: new Date(),
          }).where(eq(wearableConnections.id, conn.id));
          token = unsavedFresh.accessToken;
          console.log(`[wearables] persisted rotated token for conn ${conn.id} on retry ${attempt}`);
          unsavedFresh = null;
        } catch (e: any) {
          console.error(`[wearables] token save retry ${attempt} failed for conn ${conn.id}:`, e?.message || e);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (unsavedFresh) {
        console.error(`[wearables] CRITICAL: rotated token for conn ${conn.id} could not be persisted after 5 retries`);
      }
    }

    if (notifyDisconnect) {
      try {
        const { notify } = await import("../notifications");
        const label = PROVIDER_LABELS[conn.provider as WearableProvider] || conn.provider;
        await notify({
          userId: conn.userId,
          category: "admin",
          title: `${label} disconnected`,
          body: `MeridianWork lost its connection to ${label} and has stopped syncing. Open Wearables & Integrations and tap Connect to restore your sleep, recovery and HRV data.`,
          data: { url: "/profile/integrations", provider: conn.provider, kind: "wearable_disconnected" },
          disableEmail: true,
        });
      } catch (notifyErr) {
        console.error("[wearables] disconnect notification failed:", notifyErr);
      }
    }

    return token;
  });
}

export async function syncProvider(userId: string, provider: WearableProvider, opts: { days?: number; trigger?: string } = {}): Promise<{ daysSynced: number; status: "ok" | "error"; error?: string }> {
  const adapter = getAdapter(provider);
  // 30-day backfill on initial OAuth, 7-day rolling window on scheduled/manual
  const defaultDays = opts.trigger === "oauth_callback" ? 90 : 7;
  const days = opts.days ?? defaultDays;
  const trigger = opts.trigger || "manual";

  const [logRow] = await db.insert(wearableSyncLogs).values({
    userId, provider, status: "ok", trigger, startedAt: new Date(),
  }).returning();

  const finalize = async (status: "ok" | "error", daysSynced: number, errorMessage?: string, preserveConnError = false) => {
    await db.update(wearableSyncLogs).set({
      status, completedAt: new Date(), daysSynced, errorMessage: errorMessage || null,
    }).where(eq(wearableSyncLogs.id, logRow.id));
    await db.update(wearableConnections).set({
      lastSyncAt: new Date(), lastSyncStatus: status,
      // preserveConnError: refreshIfNeeded already stored the DETAILED provider
      // error on the connection — don't clobber it with a generic message.
      ...(preserveConnError ? {} : { lastSyncError: errorMessage || null }),
      // A successful sync proves the connection is healthy — clear any stale
      // needs_reauth flag so a transient blip self-heals in the UI.
      ...(status === "ok" ? { status: "connected" } : {}),
      updatedAt: new Date(),
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
      await finalize("error", 0, "Token refresh failed", true);
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

// Per-metric provider priority. Different metrics trust different sources:
//  - Physiological signals (HRV, RHR, sleep, VO2, readiness) are most accurate
//    from dedicated wearables: oura > whoop, then apple/google as fallback.
//  - Activity signals (steps, energy, exercise minutes) are most complete from
//    the phone/watch all-day tracking: apple/google > oura/whoop as fallback.
//  - Strain is a WHOOP-only metric.
const PHYSIO_PRIORITY: Record<string, number> = { oura: 4, whoop: 3, apple_health: 2, google_fit: 1 };
const ACTIVITY_PRIORITY: Record<string, number> = { apple_health: 4, google_fit: 3, oura: 2, whoop: 1 };

// Which priority table each metric field uses.
const PHYSIO_FIELDS = ['hrvMs', 'restingHrBpm', 'sleepMinutes', 'sleepDeepMinutes', 'sleepRemMinutes', 'sleepLightMinutes', 'sleepAwakeMinutes', 'sleepScore', 'vo2MaxMlKgMin', 'readinessScore'] as const;
const ACTIVITY_FIELDS = ['steps', 'caloriesBurned', 'activeMinutes', 'workoutCount'] as const;
// strainScore is WHOOP-only, taken from whichever row has it.

export interface MergedDailyMetric extends WearableMetricsDaily {
  // Map of metric field -> provider it was sourced from, for provenance labelling.
  _sources: Record<string, string>;
}

// Merge all provider rows into ONE row per date, selecting each metric field
// independently from the highest-priority provider that has a non-null value
// for that specific field. This means a single day's merged row can mix e.g.
// WHOOP HRV + Apple steps + WHOOP strain. Gaps fill from the next provider
// down automatically.
export function mergeMetricsPerDay(rows: WearableMetricsDaily[]): MergedDailyMetric[] {
  const byDate = new Map<string, WearableMetricsDaily[]>();
  for (const r of rows) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }

  const pickField = (dayRows: WearableMetricsDaily[], field: string, priority: Record<string, number>): { value: any; provider: string | null } => {
    let best: any = null;
    let bestProvider: string | null = null;
    let bestRank = -1;
    for (const r of dayRows) {
      const v = (r as any)[field];
      if (v === null || v === undefined) continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      const rank = priority[r.provider] || 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = v;
        bestProvider = r.provider;
      }
    }
    return { value: best, provider: bestProvider };
  };

  const out: MergedDailyMetric[] = [];
  for (const [date, dayRows] of byDate) {
    // Seed the merged row off the highest physio-priority provider's row so
    // non-metric fields (id, userId, raw, timestamps) have sensible values.
    const seed = dayRows.slice().sort((a, b) => (PHYSIO_PRIORITY[b.provider] || 0) - (PHYSIO_PRIORITY[a.provider] || 0))[0];
    const merged: any = { ...seed, _sources: {} as Record<string, string> };

    for (const field of PHYSIO_FIELDS) {
      const { value, provider } = pickField(dayRows, field, PHYSIO_PRIORITY);
      merged[field] = value;
      if (provider) merged._sources[field] = provider;
    }
    for (const field of ACTIVITY_FIELDS) {
      const { value, provider } = pickField(dayRows, field, ACTIVITY_PRIORITY);
      merged[field] = value;
      if (provider) merged._sources[field] = provider;
    }
    // Strain: WHOOP-only. Take it from any row that has it (only WHOOP will).
    const strainRow = dayRows.find((r) => r.strainScore != null);
    merged.strainScore = strainRow ? strainRow.strainScore : null;
    if (strainRow) merged._sources.strainScore = strainRow.provider;

    out.push(merged as MergedDailyMetric);
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ─── OAuth physio gate ──────────────────────────────────────────────────────
// HARD RULE: when the user has a WHOOP or Oura connection, physiological
// metrics (sleep, HRV, RHR, sleep stages/score) come from that provider ONLY.
// Apple Health / Google Fit NEVER stand in for physio — not while waiting for
// the morning sync, not to fill gaps. Activity metrics (steps, calories,
// active minutes) still flow from Apple/Google as usual (they hold activity
// priority). Readiness and the coach briefing HOLD until the OAuth provider's
// physio data for the day has actually been imported.

// A connection that is not explicitly disconnected counts: needs_reauth users
// have been notified and the scheduler retries them — Apple must not silently
// take over physio in the meantime.
export async function getConnectedOauthProvider(userId: string): Promise<WearableProvider | null> {
  const conns = await getConnections(userId);
  const c = conns.find(
    (x) => (x.provider === "whoop" || x.provider === "oura") && x.status !== "disconnected",
  );
  return (c?.provider as WearableProvider) ?? null;
}

// Has the provider's physio for this date actually landed in our DB?
export async function oauthPhysioArrived(
  userId: string,
  provider: WearableProvider,
  dateKey: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(wearableMetricsDaily)
    .where(and(
      eq(wearableMetricsDaily.userId, userId),
      eq(wearableMetricsDaily.date, dateKey),
      eq(wearableMetricsDaily.provider, provider),
    ));
  return !!row && (
    row.sleepMinutes != null || row.sleepScore != null ||
    row.hrvMs != null || row.restingHrBpm != null
  );
}

// Graduated hold decision, shared by readiness, the briefing generator and
// the API routes so the three can never drift apart.
//   hold=true      -> provider connected, today's physio not yet imported, and
//                     the connection is either healthy (normal morning wait —
//                     minutes, thanks to piggyback sync) or only recently
//                     broken. Score + briefing wait.
//   degraded=true  -> connection has been BROKEN (needs_reauth) with no data
//                     for 48h+. Check-in-only scores RESUME so the app is not
//                     dead for an inattentive user — but physio stays blank
//                     (stripNonOauthPhysio still applies; Apple NEVER fills
//                     in) and the coach keeps prompting to reconnect.
export interface OauthPhysioHold {
  hold: boolean;
  provider: WearableProvider | null;
  degraded: boolean;
}

const DEGRADE_AFTER_MS = 48 * 60 * 60 * 1000;

export async function getOauthPhysioHold(userId: string, dateKey: string): Promise<OauthPhysioHold> {
  const provider = await getConnectedOauthProvider(userId);
  if (!provider) return { hold: false, provider: null, degraded: false };
  if (await oauthPhysioArrived(userId, provider, dateKey)) {
    return { hold: false, provider, degraded: false };
  }
  const conn = await getConnection(userId, provider);
  if (conn?.status === "needs_reauth") {
    const [newest] = await db
      .select({ date: wearableMetricsDaily.date })
      .from(wearableMetricsDaily)
      .where(and(
        eq(wearableMetricsDaily.userId, userId),
        eq(wearableMetricsDaily.provider, provider),
      ))
      .orderBy(desc(wearableMetricsDaily.date))
      .limit(1);
    // No data ever, or newest data older than the degrade window -> degrade.
    const newestMs = newest ? new Date(`${newest.date}T00:00:00Z`).getTime() : 0;
    if (Date.now() - newestMs > DEGRADE_AFTER_MS) {
      return { hold: false, provider, degraded: true };
    }
  }
  return { hold: true, provider, degraded: false };
}

// Blank any physio field on a merged row that was sourced from a non-OAuth
// provider. Call when getConnectedOauthProvider() returned a provider.
export function stripNonOauthPhysio<T extends MergedDailyMetric>(row: T | undefined): T | undefined {
  if (!row) return row;
  for (const f of PHYSIO_FIELDS) {
    const src = row._sources?.[f];
    if (src && src !== "whoop" && src !== "oura") {
      (row as any)[f] = null;
      delete row._sources[f];
    }
  }
  return row;
}

// Convenience: fetch + merge in one call. Returns one clean row per date with
// per-metric source selection already applied.
export async function getMergedDailyMetrics(userId: string, days = 30): Promise<MergedDailyMetric[]> {
  const cutoff = dateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const rows = await db.select().from(wearableMetricsDaily)
    .where(and(eq(wearableMetricsDaily.userId, userId), sql`${wearableMetricsDaily.date} >= ${cutoff}`));
  return mergeMetricsPerDay(rows);
}
