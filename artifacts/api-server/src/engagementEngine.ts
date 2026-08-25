/**
 * Engagement Foundation engine: multi-track Streaks + the activity event log.
 *
 * POINTS AND LEVELS WERE RETIRED (25 Aug 2026). The Workforce Rewards
 * programme is target-and-draw based and needs no points currency, and the
 * old economy was never surfaced anywhere users cared about.
 *
 * The subtlety that made this non-trivial: `points_transactions` was doing two
 * jobs. It was the points ledger AND it was the activity event log that the
 * company-facing Engagement Index reads (active users, top activities,
 * participation rate). Deleting the points economy without noticing that would
 * have silently zeroed a live employer report.
 *
 * So the two jobs are now separate. `engagement_activity_log` is a clean event
 * log — who did what, when — with no currency attached. The Index reads that.
 * `user_points` / `points_transactions` are no longer written by anything;
 * their rows are backfilled into the new log on boot and the tables are left
 * in place (not dropped) so the data survives until you're sure.
 *
 * If a points economy ever returns for the consumer/Vitality-catalog model, it
 * gets its own clean ledger — it does not come back here.
 */
import { db, pool } from "./db";
import {
  engagementConfig,
  userTrackStreaks,
  type UserTrackStreak,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export type ActivityType =
  | "daily_checkin"
  | "weekly_checkin"
  | "workout"
  | "meal_log"
  | "body_map"
  | "meditation"
  | "breathwork"
  | "sleep_log"
  | "hydration_goal"
  | "perfect_week"
  | "readiness_weekly_baseline";

export type StreakTrack = "checkin" | "movement" | "recovery" | "nutrition";

interface ActivityRule {
  track?: StreakTrack;
}

interface EngagementDefaults {
  activities: Record<ActivityType, ActivityRule>;
  trackActivities: Record<StreakTrack, ActivityType[]>;
}

const DEFAULTS: EngagementDefaults = {
  activities: {
    daily_checkin: { track: "checkin" },
    weekly_checkin: { track: "checkin" },
    workout: { track: "movement" },
    meal_log: { track: "nutrition" },
    body_map: { track: "movement" },
    meditation: { track: "recovery" },
    breathwork: { track: "recovery" },
    sleep_log: { track: "recovery" },
    hydration_goal: { track: "nutrition" },
    perfect_week: {},
    // Daily Readiness (Beta) is user-only and stays OUT of every
    // company-facing figure — see the containment note in computeEngagementIndex.
    readiness_weekly_baseline: {},
  },
  trackActivities: {
    checkin: ["daily_checkin", "weekly_checkin"],
    movement: ["workout", "body_map"],
    recovery: ["meditation", "breathwork", "sleep_log"],
    nutrition: ["meal_log", "hydration_goal"],
  },
};

// Activity types that must never reach a company-facing number.
const READINESS_EXCLUDED = ["readiness_weekly_baseline"] as const;

let cachedConfig: EngagementDefaults | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getEngagementConfig(): Promise<EngagementDefaults> {
  if (cachedConfig && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cachedConfig;
  try {
    const rows = await db.select().from(engagementConfig);
    const map: Record<string, any> = {};
    for (const r of rows) map[r.key] = r.value;
    // Legacy rows for points tunables (weeklyCaps, streakBonuses, levels) may
    // still exist in engagement_config. They are ignored, not read.
    const merged: EngagementDefaults = {
      activities: { ...DEFAULTS.activities, ...(map.activities || {}) },
      trackActivities: { ...DEFAULTS.trackActivities, ...(map.trackActivities || {}) },
    };
    cachedConfig = merged;
    cacheLoadedAt = Date.now();
    return merged;
  } catch (err: any) {
    console.error("[ENGAGEMENT] Failed to load config, using defaults:", err?.message);
    return DEFAULTS;
  }
}

export function invalidateEngagementConfigCache() {
  cachedConfig = null;
  cacheLoadedAt = 0;
}

/** ISO Monday-anchored YYYY-MM-DD week start. */
export function getWeekStart(d: Date = new Date()): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ---- Activity log (the clean replacement for points_transactions) ----

let hasEnsuredLog = false;

export async function ensureActivityLogOnce(): Promise<void> {
  if (hasEnsuredLog) return;
  hasEnsuredLog = true;
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS engagement_activity_log (
         id serial PRIMARY KEY,
         user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         activity_type text NOT NULL,
         metadata jsonb,
         created_at timestamp NOT NULL DEFAULT now()
       )`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS engagement_activity_user_time_idx
         ON engagement_activity_log (user_id, created_at DESC)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS engagement_activity_type_time_idx
         ON engagement_activity_log (activity_type, created_at)`
    );

    // One-time backfill so the Engagement Index keeps its history. Guarded by
    // emptiness rather than a flag table: if the log has any row, a backfill
    // has already happened (or real traffic has started) and we leave it alone.
    const existing = await pool.query(`SELECT 1 FROM engagement_activity_log LIMIT 1`);
    if (existing.rowCount === 0) {
      const copied = await pool.query(
        `INSERT INTO engagement_activity_log (user_id, activity_type, metadata, created_at)
         SELECT user_id, activity_type, metadata, created_at
         FROM points_transactions`
      );
      console.log(`[ENGAGEMENT] activity log backfilled from points_transactions: ${copied.rowCount} row(s)`);
    }
    console.log("[ENGAGEMENT] activity log ready");
  } catch (e: any) {
    // points_transactions may already be gone on a future install — that's fine.
    console.error("[ENGAGEMENT] activity log ensure failed:", e?.message || e);
  }
}

/** Record that an activity happened. No currency, no caps, no multipliers. */
export async function logActivity(
  userId: string,
  activityType: ActivityType,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await ensureActivityLogOnce();
    await pool.query(
      `INSERT INTO engagement_activity_log (user_id, activity_type, metadata)
       VALUES ($1, $2, $3)`,
      [userId, activityType, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err: any) {
    // Background-safe: an engagement log write must never break the user's action.
    console.error(`[ENGAGEMENT] logActivity failed user=${userId} type=${activityType}:`, err?.message);
  }
}

/** Has this activity+metadata-key already been logged? Used for weekly idempotency. */
export async function hasLoggedActivity(
  userId: string,
  activityType: ActivityType,
  metadataKey: string,
  metadataValue: string,
): Promise<boolean> {
  try {
    await ensureActivityLogOnce();
    const r = await pool.query(
      `SELECT 1 FROM engagement_activity_log
       WHERE user_id = $1 AND activity_type = $2 AND metadata->>$3 = $4
       LIMIT 1`,
      [userId, activityType, metadataKey, metadataValue]
    );
    return (r.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.error(`[ENGAGEMENT] hasLoggedActivity failed user=${userId}:`, err?.message);
    // Fail closed: treat an error as "already done" so we never double-award.
    return true;
  }
}

// ---- Streaks (preserved — badges and the Index depend on these) ----

/** Update one of the four track streaks. Daily-deduplicated. */
export async function updateTrackStreak(userId: string, track: StreakTrack): Promise<UserTrackStreak | null> {
  try {
    const today = todayStr();
    const existing = await db
      .select()
      .from(userTrackStreaks)
      .where(and(eq(userTrackStreaks.userId, userId), eq(userTrackStreaks.track, track)))
      .limit(1);

    if (existing.length === 0) {
      const inserted = await db
        .insert(userTrackStreaks)
        .values({ userId, track, currentStreak: 1, longestStreak: 1, lastActivityDate: today, freezesAvailable: 0 })
        .returning();
      return inserted[0];
    }

    const row = existing[0];
    if (row.lastActivityDate === today) return row;

    let newStreak = 1;
    if (row.lastActivityDate) {
      const diffDays = Math.floor(
        (new Date(today).getTime() - new Date(row.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) newStreak = row.currentStreak + 1;
    }
    const newLongest = Math.max(newStreak, row.longestStreak);
    const updated = await db
      .update(userTrackStreaks)
      .set({ currentStreak: newStreak, longestStreak: newLongest, lastActivityDate: today, updatedAt: new Date() })
      .where(eq(userTrackStreaks.id, row.id))
      .returning();
    return updated[0];
  } catch (err: any) {
    console.error(`[ENGAGEMENT] updateTrackStreak failed user=${userId} track=${track}:`, err?.message);
    return null;
  }
}

/**
 * Record an activity: update its track streak and write the event log.
 * Called from ~11 places in routes.ts. Signature unchanged from the points era
 * so every call site keeps working.
 */
export async function recordEngagementActivity(
  userId: string,
  activityType: ActivityType,
  metadata?: Record<string, any>,
): Promise<void> {
  const cfg = await getEngagementConfig();
  const rule = cfg.activities[activityType];
  if (rule?.track) {
    await updateTrackStreak(userId, rule.track);
  }
  await logActivity(userId, activityType, metadata);
}

export async function getUserEngagement(userId: string) {
  await ensureActivityLogOnce();
  const currentWeek = getWeekStart();

  const tracks = await db.select().from(userTrackStreaks).where(eq(userTrackStreaks.userId, userId));
  const trackMap: Record<StreakTrack, UserTrackStreak | null> = {
    checkin: null, movement: null, recovery: null, nutrition: null,
  };
  for (const t of tracks) trackMap[t.track as StreakTrack] = t;

  const recent = await pool.query(
    `SELECT id, activity_type AS "activityType", metadata, created_at AS "createdAt"
     FROM engagement_activity_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  const weekCount = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM engagement_activity_log
     WHERE user_id = $1 AND created_at >= ($2 || ' 00:00:00')::timestamp`,
    [userId, currentWeek]
  );

  return {
    weekStart: currentWeek,
    activitiesThisWeek: Number(weekCount.rows[0]?.c ?? 0),
    streaks: trackMap,
    recentActivity: recent.rows,
  };
}

/**
 * Compute the Engagement Index for a cohort (admin reports).
 * Returns null when the cohort is below minCohortSize for k-anonymity.
 *
 * CONTAINMENT: Daily Readiness (Beta, user-only) is excluded from every
 * company-facing input — the active-user count and the top-activities
 * breakdown. A user whose ONLY activity in-window is a readiness reward must
 * not count toward `activeUsers`. (The old points-subtraction machinery here
 * existed only to stop readiness inflating levels; with points gone, the
 * exclusion is just this filter.)
 */
export async function computeEngagementIndex(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  minCohortSize: number,
): Promise<{
  cohortSize: number;
  activeUsers: number;
  participationRate: number;
  avgActivitiesPerActiveUser: number;
  topActivities: Array<{ activityType: string; count: number }>;
  avgStreaks: Record<StreakTrack, number>;
} | null> {
  if (userIds.length < minCohortSize) return null;
  await ensureActivityLogOnce();

  const activeRes = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS active,
            COUNT(*)::int                AS total
     FROM engagement_activity_log
     WHERE user_id = ANY($1::varchar[])
       AND created_at >= $2 AND created_at <= $3
       AND activity_type <> ALL($4::text[])`,
    [userIds, startDate, endDate, READINESS_EXCLUDED as unknown as string[]]
  );
  const activeUsers = Number(activeRes.rows[0]?.active ?? 0);
  const totalActivities = Number(activeRes.rows[0]?.total ?? 0);
  if (activeUsers < minCohortSize) return null;

  const txRes = await pool.query(
    `SELECT activity_type, COUNT(*)::int AS c
     FROM engagement_activity_log
     WHERE user_id = ANY($1::varchar[])
       AND created_at >= $2 AND created_at <= $3
       AND activity_type <> ALL($4::text[])
     GROUP BY activity_type
     ORDER BY c DESC
     LIMIT 5`,
    [userIds, startDate, endDate, READINESS_EXCLUDED as unknown as string[]]
  );
  const topActivities = txRes.rows.map((r: any) => ({
    activityType: r.activity_type,
    count: Number(r.c),
  }));
  // Defensive invariant: readiness must never appear in a company-facing list.
  if (topActivities.some((a) => (READINESS_EXCLUDED as readonly string[]).includes(a.activityType))) {
    throw new Error("[readiness-containment] readiness activity leaked into Engagement Index topActivities");
  }

  const trackRows = await db
    .select()
    .from(userTrackStreaks)
    .where(sql`${userTrackStreaks.userId} = ANY(${sql`ARRAY[${sql.join(userIds.map((i) => sql`${i}`), sql`, `)}]::varchar[]`})`);
  const trackTotals: Record<StreakTrack, { sum: number; n: number }> = {
    checkin: { sum: 0, n: 0 }, movement: { sum: 0, n: 0 },
    recovery: { sum: 0, n: 0 }, nutrition: { sum: 0, n: 0 },
  };
  for (const t of trackRows) {
    const k = t.track as StreakTrack;
    if (trackTotals[k]) {
      trackTotals[k].sum += t.currentStreak || 0;
      trackTotals[k].n += 1;
    }
  }
  const avg = (x: { sum: number; n: number }) => (x.n ? Math.round((x.sum / x.n) * 10) / 10 : 0);

  return {
    cohortSize: userIds.length,
    activeUsers,
    participationRate: Math.round((activeUsers / userIds.length) * 1000) / 10,
    avgActivitiesPerActiveUser: activeUsers > 0 ? Math.round((totalActivities / activeUsers) * 10) / 10 : 0,
    topActivities,
    avgStreaks: {
      checkin: avg(trackTotals.checkin),
      movement: avg(trackTotals.movement),
      recovery: avg(trackTotals.recovery),
      nutrition: avg(trackTotals.nutrition),
    },
  };
}

/**
 * Idempotent migration: tags existing badges as 'legacy' and seeds the Check-in
 * track streak from users.currentStreak. Safe to run repeatedly.
 * (The old step that created user_points rows is gone with the points economy.)
 */
export async function runEngagementMigration(): Promise<{
  legacyBadgesTagged: number;
  trackStreaksSeeded: number;
}> {
  const tagRes = await db.execute(sql`
    UPDATE badges
    SET collection = 'legacy'
    WHERE collection = 'current'
      AND created_at < NOW() - INTERVAL '1 minute'
    RETURNING id
  `);
  const legacyBadgesTagged = ((tagRes as any).rows || tagRes as any).length || 0;

  const usersWithStreaks = await db.execute(sql`
    SELECT id, current_streak, longest_streak, last_streak_activity_date
    FROM users
    WHERE current_streak > 0
  `);
  const userRows = (usersWithStreaks as any).rows || usersWithStreaks;
  let trackStreaksSeeded = 0;
  for (const u of userRows as any[]) {
    const exists = await db
      .select()
      .from(userTrackStreaks)
      .where(and(eq(userTrackStreaks.userId, u.id), eq(userTrackStreaks.track, "checkin")))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(userTrackStreaks).values({
        userId: u.id,
        track: "checkin",
        currentStreak: u.current_streak || 0,
        longestStreak: u.longest_streak || u.current_streak || 0,
        lastActivityDate: u.last_streak_activity_date || null,
        freezesAvailable: 0,
      });
      trackStreaksSeeded++;
    }
  }

  return { legacyBadgesTagged, trackStreaksSeeded };
}
