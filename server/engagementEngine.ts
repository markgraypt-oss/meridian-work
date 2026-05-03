/**
 * Engagement Foundation engine: Points, multi-track Streaks, Levels.
 * All tunables loaded from engagement_config table with defaults seeded on first read.
 */
import { db } from "./db";
import {
  engagementConfig,
  userPoints,
  pointsTransactions,
  userTrackStreaks,
  type UserPoints,
  type UserTrackStreak,
} from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";

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
  basePoints: number;
  dailyCap?: number; // max awards per day at full rate (subsequent at curve)
  curve?: "workout"; // workout: 100% / 50% / 0%
  track?: StreakTrack;
}

interface EngagementDefaults {
  activities: Record<ActivityType, ActivityRule>;
  weeklyCaps: { soft1: number; soft1Multiplier: number; soft2: number; soft2Multiplier: number };
  streakBonuses: Array<{ days: number; multiplier: number }>;
  levels: Array<{ level: number; name: string; minPoints: number }>;
  trackActivities: Record<StreakTrack, ActivityType[]>;
}

const DEFAULTS: EngagementDefaults = {
  activities: {
    daily_checkin: { basePoints: 50, dailyCap: 1, track: "checkin" },
    weekly_checkin: { basePoints: 200, dailyCap: 1, track: "checkin" },
    workout: { basePoints: 100, dailyCap: 3, curve: "workout", track: "movement" },
    meal_log: { basePoints: 20, dailyCap: 3, track: "nutrition" },
    body_map: { basePoints: 30, dailyCap: 2, track: "movement" },
    meditation: { basePoints: 15, dailyCap: 4, track: "recovery" },
    breathwork: { basePoints: 15, dailyCap: 4, track: "recovery" },
    sleep_log: { basePoints: 15, dailyCap: 1, track: "recovery" },
    hydration_goal: { basePoints: 10, dailyCap: 1, track: "nutrition" },
    perfect_week: { basePoints: 150, dailyCap: 1 },
    // Daily Readiness (Beta): +100 for 5+ days in a week above personal
    // 30-day rolling average. Awarded weekly by server/dailyReadiness.ts.
    readiness_weekly_baseline: { basePoints: 100, dailyCap: 1 },
  },
  weeklyCaps: { soft1: 500, soft1Multiplier: 0.5, soft2: 1000, soft2Multiplier: 0.25 },
  streakBonuses: [
    { days: 90, multiplier: 1.5 },
    { days: 30, multiplier: 1.25 },
    { days: 7, multiplier: 1.1 },
  ],
  levels: [
    { level: 1, name: "Explorer", minPoints: 0 },
    { level: 2, name: "Builder", minPoints: 500 },
    { level: 3, name: "Guardian", minPoints: 2000 },
    { level: 4, name: "Champion", minPoints: 5000 },
    { level: 5, name: "Master", minPoints: 12000 },
  ],
  trackActivities: {
    checkin: ["daily_checkin", "weekly_checkin"],
    movement: ["workout", "body_map"],
    recovery: ["meditation", "breathwork", "sleep_log"],
    nutrition: ["meal_log", "hydration_goal"],
  },
};

let cachedConfig: EngagementDefaults | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getEngagementConfig(): Promise<EngagementDefaults> {
  if (cachedConfig && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cachedConfig;
  try {
    const rows = await db.select().from(engagementConfig);
    const map: Record<string, any> = {};
    for (const r of rows) map[r.key] = r.value;
    const merged: EngagementDefaults = {
      activities: { ...DEFAULTS.activities, ...(map.activities || {}) },
      weeklyCaps: { ...DEFAULTS.weeklyCaps, ...(map.weeklyCaps || {}) },
      streakBonuses: map.streakBonuses || DEFAULTS.streakBonuses,
      levels: map.levels || DEFAULTS.levels,
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

function pickLevel(totalPoints: number, levels: EngagementDefaults["levels"]): { level: number; name: string } {
  const sorted = [...levels].sort((a, b) => b.minPoints - a.minPoints);
  const match = sorted.find((l) => totalPoints >= l.minPoints) || sorted[sorted.length - 1];
  return { level: match.level, name: match.name };
}

async function ensureUserPoints(userId: string): Promise<UserPoints> {
  const existing = await db.select().from(userPoints).where(eq(userPoints.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  const inserted = await db
    .insert(userPoints)
    .values({ userId, totalPoints: 0, weekPoints: 0, weekStart: getWeekStart(), level: 1, levelName: "Explorer" })
    .returning();
  return inserted[0];
}

async function getActivityCountToday(userId: string, activityType: ActivityType): Promise<number> {
  const today = todayStr();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS c
    FROM points_transactions
    WHERE user_id = ${userId}
      AND activity_type = ${activityType}
      AND DATE(created_at) = ${today}::date
  `);
  const row = (result as any).rows?.[0] || (result as any)[0];
  return row ? Number(row.c) : 0;
}

function workoutMultiplier(countToday: number): { mult: number; reason: string | null } {
  // 1st full, 2nd 50%, 3rd+ 0%
  if (countToday === 0) return { mult: 1, reason: null };
  if (countToday === 1) return { mult: 0.5, reason: "workout_2nd" };
  return { mult: 0, reason: "workout_3rd_plus" };
}

function dailyCapMultiplier(countToday: number, cap: number): { mult: number; reason: string | null } {
  return countToday < cap ? { mult: 1, reason: null } : { mult: 0, reason: "daily_cap" };
}

function pickStreakBonus(currentStreak: number, bonuses: EngagementDefaults["streakBonuses"]): number {
  for (const b of bonuses) {
    if (currentStreak >= b.days) return b.multiplier;
  }
  return 1;
}

function weeklyCapMultiplier(weekPoints: number, caps: EngagementDefaults["weeklyCaps"]): { mult: number; reason: string | null } {
  if (weekPoints >= caps.soft2) return { mult: caps.soft2Multiplier, reason: `weekly_soft_cap_${caps.soft2}` };
  if (weekPoints >= caps.soft1) return { mult: caps.soft1Multiplier, reason: `weekly_soft_cap_${caps.soft1}` };
  return { mult: 1, reason: null };
}

export interface AwardResult {
  awarded: number;
  basePoints: number;
  multiplier: number;
  cappedReason: string | null;
  newTotal: number;
  newWeekTotal: number;
  level: number;
  levelName: string;
  leveledUp: boolean;
}

/**
 * Award points for an activity. Idempotency is the caller's responsibility — call once per
 * persisted activity. Background-safe: never throws.
 */
export async function awardPoints(
  userId: string,
  activityType: ActivityType,
  metadata?: Record<string, any>,
): Promise<AwardResult | null> {
  try {
    const cfg = await getEngagementConfig();
    const rule = cfg.activities[activityType];
    if (!rule) {
      console.warn(`[ENGAGEMENT] Unknown activity ${activityType}`);
      return null;
    }

    const countToday = await getActivityCountToday(userId, activityType);

    // Per-activity cap / curve
    const capRes = rule.curve === "workout"
      ? workoutMultiplier(countToday)
      : dailyCapMultiplier(countToday, rule.dailyCap ?? Infinity);

    const up = await ensureUserPoints(userId);
    const currentWeek = getWeekStart();
    const weekPoints = up.weekStart === currentWeek ? up.weekPoints : 0;

    // Streak multiplier (use track's streak if track defined, else 1)
    let streakMult = 1;
    let trackStreakDays = 0;
    if (rule.track) {
      const trackRows = await db
        .select()
        .from(userTrackStreaks)
        .where(and(eq(userTrackStreaks.userId, userId), eq(userTrackStreaks.track, rule.track)))
        .limit(1);
      trackStreakDays = trackRows[0]?.currentStreak ?? 0;
      streakMult = pickStreakBonus(trackStreakDays, cfg.streakBonuses);
    }

    const weeklyRes = weeklyCapMultiplier(weekPoints, cfg.weeklyCaps);

    const combinedMult = capRes.mult * streakMult * weeklyRes.mult;
    const awarded = Math.round(rule.basePoints * combinedMult);
    const cappedReason = capRes.reason || weeklyRes.reason;

    // Always record the transaction (even 0-point ones, for transparency)
    await db.insert(pointsTransactions).values({
      userId,
      activityType,
      basePoints: rule.basePoints,
      multiplier: combinedMult,
      awardedPoints: awarded,
      cappedReason: cappedReason ?? null,
      metadata: metadata ?? null,
    });

    const newTotal = (up.totalPoints || 0) + awarded;
    const newWeek = weekPoints + awarded;
    const oldLevel = up.level;
    const lvl = pickLevel(newTotal, cfg.levels);

    await db
      .update(userPoints)
      .set({
        totalPoints: newTotal,
        weekPoints: newWeek,
        weekStart: currentWeek,
        level: lvl.level,
        levelName: lvl.name,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId));

    return {
      awarded,
      basePoints: rule.basePoints,
      multiplier: combinedMult,
      cappedReason,
      newTotal,
      newWeekTotal: newWeek,
      level: lvl.level,
      levelName: lvl.name,
      leveledUp: lvl.level > oldLevel,
    };
  } catch (err: any) {
    console.error(`[ENGAGEMENT] awardPoints failed user=${userId} type=${activityType}:`, err?.message);
    return null;
  }
}

/** Update one of the four track streaks. Same daily-deduplication pattern as legacy streak. */
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

/** Record both: per-track streak update AND points award. Convenience wrapper called from routes. */
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
  await awardPoints(userId, activityType, metadata);
}

export async function getUserEngagement(userId: string) {
  const cfg = await getEngagementConfig();
  const up = await ensureUserPoints(userId);
  const currentWeek = getWeekStart();
  const weekPoints = up.weekStart === currentWeek ? up.weekPoints : 0;

  const tracks = await db.select().from(userTrackStreaks).where(eq(userTrackStreaks.userId, userId));
  const trackMap: Record<StreakTrack, UserTrackStreak | null> = {
    checkin: null, movement: null, recovery: null, nutrition: null,
  };
  for (const t of tracks) trackMap[t.track as StreakTrack] = t;

  const recentTx = await db
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.userId, userId))
    .orderBy(sql`${pointsTransactions.createdAt} DESC`)
    .limit(10);

  // Next-level info
  const sortedLevels = [...cfg.levels].sort((a, b) => a.minPoints - b.minPoints);
  const nextLevel = sortedLevels.find((l) => l.minPoints > up.totalPoints);
  const currentLevelDef = sortedLevels.filter((l) => l.minPoints <= up.totalPoints).pop() ?? sortedLevels[0];

  return {
    totalPoints: up.totalPoints,
    weekPoints,
    weekStart: currentWeek,
    level: up.level,
    levelName: up.levelName,
    nextLevel: nextLevel ? { level: nextLevel.level, name: nextLevel.name, minPoints: nextLevel.minPoints } : null,
    progressToNext: nextLevel
      ? Math.min(1, (up.totalPoints - currentLevelDef.minPoints) / (nextLevel.minPoints - currentLevelDef.minPoints))
      : 1,
    streaks: trackMap,
    recentActivity: recentTx,
  };
}

/**
 * Compute Engagement Index for a cohort (admin reports).
 * Returns null when cohort < minCohortSize for k-anonymity.
 */
export async function computeEngagementIndex(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  minCohortSize: number,
): Promise<{
  cohortSize: number;
  avgWeekPoints: number;
  avgLevel: number;
  activeUsers: number;
  participationRate: number;
  topActivities: Array<{ activityType: string; count: number }>;
  avgStreaks: Record<StreakTrack, number>;
} | null> {
  if (userIds.length < minCohortSize) return null;

  // CONTAINMENT: Daily Readiness (Beta, User-Only) is strictly excluded
  // from every company-facing Engagement Index input. We exclude its
  // activity type from:
  //   - the active-users-in-window count
  //   - the per-user weekly points sum
  //   - the per-user lifetime points sum (so derived level is unaffected)
  //   - the top-activities cohort breakdown
  // A user whose ONLY activity in-window is a readiness reward must not
  // count toward `activeUsers`.
  const READINESS_EXCLUDED = ["readiness_weekly_baseline"] as const;

  // Active users in window (had any non-readiness points tx).
  const activeRes = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id)::int AS c
    FROM points_transactions
    WHERE user_id = ANY(${userIds}::varchar[])
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND activity_type NOT IN ('readiness_weekly_baseline')
  `);
  const activeRows = (activeRes as unknown as { rows?: Array<{ c: number }> }).rows ?? [];
  const activeUsers = Number(activeRows[0]?.c ?? 0);
  if (activeUsers < minCohortSize) return null;

  // Per-user readiness contributions to subtract from user_points totals.
  // weekStart on user_points is the Monday of the current week, so "this
  // week's" readiness points = sum of awarded_points where created_at >=
  // that weekStart. Lifetime readiness = all-time sum per user.
  const readinessRes = await db.execute(sql`
    SELECT
      pt.user_id AS user_id,
      COALESCE(SUM(pt.awarded_points), 0)::int AS lifetime,
      COALESCE(SUM(CASE
        WHEN up.week_start IS NOT NULL
         AND pt.created_at >= (up.week_start || ' 00:00:00')::timestamp
        THEN pt.awarded_points ELSE 0 END), 0)::int AS this_week
    FROM points_transactions pt
    LEFT JOIN user_points up ON up.user_id = pt.user_id
    WHERE pt.user_id = ANY(${userIds}::varchar[])
      AND pt.activity_type IN ('readiness_weekly_baseline')
    GROUP BY pt.user_id
  `);
  const readinessRows =
    (readinessRes as unknown as { rows?: Array<{ user_id: string; lifetime: number; this_week: number }> })
      .rows ?? [];
  const readinessByUser = new Map<string, { lifetime: number; thisWeek: number }>();
  for (const r of readinessRows) {
    readinessByUser.set(r.user_id, { lifetime: Number(r.lifetime), thisWeek: Number(r.this_week) });
  }

  const upRows = await db
    .select()
    .from(userPoints)
    .where(sql`${userPoints.userId} = ANY(${userIds}::varchar[])`);

  // Recompute level from (totalPoints - readiness lifetime) using the
  // same engagement config so readiness rewards never inflate avgLevel.
  const cfg = await getEngagementConfig();
  const adjusted = upRows.map((r) => {
    const r0 = readinessByUser.get(r.userId) ?? { lifetime: 0, thisWeek: 0 };
    const adjTotal = Math.max(0, (r.totalPoints || 0) - r0.lifetime);
    const adjWeek = Math.max(0, (r.weekPoints || 0) - r0.thisWeek);
    const lvl = pickLevel(adjTotal, cfg.levels);
    return { weekPoints: adjWeek, level: lvl.level };
  });
  const avgWeekPoints = adjusted.length > 0
    ? Math.round(adjusted.reduce((s, r) => s + r.weekPoints, 0) / adjusted.length)
    : 0;
  const avgLevel = adjusted.length > 0
    ? Math.round((adjusted.reduce((s, r) => s + r.level, 0) / adjusted.length) * 10) / 10
    : 1;

  // Top activities cohort tile — also excludes readiness.
  const txRes = await db.execute(sql`
    SELECT activity_type, COUNT(*)::int AS c
    FROM points_transactions
    WHERE user_id = ANY(${userIds}::varchar[])
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND activity_type NOT IN ('readiness_weekly_baseline')
    GROUP BY activity_type
    ORDER BY c DESC
    LIMIT 5
  `);
  const txRows = (txRes as unknown as { rows?: Array<{ activity_type: string; c: number }> }).rows ?? [];
  const topActivities = txRows.map((r) => ({
    activityType: r.activity_type,
    count: Number(r.c),
  }));
  // Defensive invariant: readiness must never appear in topActivities.
  if (topActivities.some((a) => READINESS_EXCLUDED.includes(a.activityType as typeof READINESS_EXCLUDED[number]))) {
    throw new Error("[readiness-containment] readiness activity leaked into Engagement Index topActivities");
  }

  const trackRows = await db
    .select()
    .from(userTrackStreaks)
    .where(sql`${userTrackStreaks.userId} = ANY(${userIds}::varchar[])`);
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
  const avgStreaks: Record<StreakTrack, number> = {
    checkin: trackTotals.checkin.n ? Math.round((trackTotals.checkin.sum / trackTotals.checkin.n) * 10) / 10 : 0,
    movement: trackTotals.movement.n ? Math.round((trackTotals.movement.sum / trackTotals.movement.n) * 10) / 10 : 0,
    recovery: trackTotals.recovery.n ? Math.round((trackTotals.recovery.sum / trackTotals.recovery.n) * 10) / 10 : 0,
    nutrition: trackTotals.nutrition.n ? Math.round((trackTotals.nutrition.sum / trackTotals.nutrition.n) * 10) / 10 : 0,
  };

  return {
    cohortSize: userIds.length,
    avgWeekPoints,
    avgLevel,
    activeUsers,
    participationRate: Math.round((activeUsers / userIds.length) * 1000) / 10,
    topActivities,
    avgStreaks,
  };
}

/**
 * Idempotent migration: marks existing badges as 'legacy', seeds Check-in track streak from
 * users.currentStreak, awards a one-time "Founding Member" badge to all existing users.
 * Safe to run multiple times.
 */
export async function runEngagementMigration(): Promise<{
  legacyBadgesTagged: number;
  trackStreaksSeeded: number;
  pointsRowsCreated: number;
}> {
  // 1. Tag all currently-active badges as legacy if they haven't been re-tagged yet.
  //    (Admin will explicitly mark new gamified badges with collection='current'.)
  const tagRes = await db.execute(sql`
    UPDATE badges
    SET collection = 'legacy'
    WHERE collection = 'current'
      AND created_at < NOW() - INTERVAL '1 minute'
    RETURNING id
  `);
  const legacyBadgesTagged = ((tagRes as any).rows || tagRes as any).length || 0;

  // 2. Seed Check-in track streak from existing users.current_streak.
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

  // 3. Create user_points rows for any user that doesn't have one yet.
  const created = await db.execute(sql`
    INSERT INTO user_points (user_id, total_points, week_points, week_start, level, level_name, updated_at)
    SELECT u.id, 0, 0, ${getWeekStart()}, 1, 'Explorer', NOW()
    FROM users u
    LEFT JOIN user_points up ON up.user_id = u.id
    WHERE up.user_id IS NULL
    RETURNING user_id
  `);
  const pointsRowsCreated = ((created as any).rows || created as any).length || 0;

  return { legacyBadgesTagged, trackStreaksSeeded, pointsRowsCreated };
}
