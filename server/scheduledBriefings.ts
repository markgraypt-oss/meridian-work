import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  notifications,
  notificationPreferences,
  scheduledWorkouts,
  users,
} from "@shared/schema";
import { notify } from "./notifications";
import { storage } from "./storage";

const TICK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BRIEFING_HOUR_START = 7; // 07:00 local
const BRIEFING_HOUR_END = 9;   // before 09:00 local

const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://meridian.work";

let started = false;

interface BriefingUser {
  id: string;
  firstName: string | null;
  inAppTraining: boolean | null;
  emailTraining: boolean | null;
  pushTraining: boolean | null;
}

function localHourFor(_userId: string, tz: string | null): number {
  const d = new Date();
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      });
      return parseInt(fmt.format(d), 10);
    } catch {
      // fall through
    }
  }
  return d.getHours();
}

function startOfLocalDay(tz: string | null): Date {
  const d = new Date();
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const [y, m, day] = fmt.format(d).split("-").map((s) => parseInt(s, 10));
      return new Date(Date.UTC(y, m - 1, day));
    } catch {
      // fall through
    }
  }
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local;
}

function endOfLocalDay(tz: string | null): Date {
  const start = startOfLocalDay(tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

async function alreadyBriefedToday(userId: string, tz: string | null): Promise<boolean> {
  const since = startOfLocalDay(tz);
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.category, "training"),
        gte(notifications.createdAt, since),
        sql`(${notifications.data}->>'briefing') = 'true'`,
      ),
    );
  return Number(row?.c || 0) > 0;
}

async function getTodaysWorkouts(userId: string, tz: string | null) {
  const start = startOfLocalDay(tz);
  const end = endOfLocalDay(tz);
  return await db
    .select()
    .from(scheduledWorkouts)
    .where(
      and(
        eq(scheduledWorkouts.userId, userId),
        gte(scheduledWorkouts.scheduledDate, start),
        lt(scheduledWorkouts.scheduledDate, end),
      ),
    );
}

function composeBriefing(
  firstName: string | null,
  workouts: { workoutName: string; isCompleted: boolean | null }[],
): { title: string; body: string } {
  const name = firstName ? firstName : "there";
  const pending = workouts.filter((w) => !w.isCompleted);
  if (pending.length === 0) {
    return {
      title: `Good morning, ${name}`,
      body: "You're all caught up for today. Take a walk, stretch, or rest well.",
    };
  }
  const list = pending.map((w) => `• ${w.workoutName}`).join("\n");
  const headline =
    pending.length === 1
      ? `Today's session: ${pending[0].workoutName}`
      : `${pending.length} sessions on deck today`;
  return {
    title: `Good morning, ${name}`,
    body: `${headline}\n\n${list}\n\nOpen your dashboard to get started.`,
  };
}

async function dispatchForUser(u: BriefingUser, tz: string | null): Promise<void> {
  if (!u.inAppTraining && !u.emailTraining && !u.pushTraining) return;

  const hour = localHourFor(u.id, tz);
  if (hour < BRIEFING_HOUR_START || hour >= BRIEFING_HOUR_END) return;

  if (await alreadyBriefedToday(u.id, tz)) return;

  const workouts = await getTodaysWorkouts(u.id, tz);
  const pending = workouts.filter((w) => !w.isCompleted);
  if (pending.length === 0) return;

  const { title, body } = composeBriefing(u.firstName, pending);
  const data = {
    briefing: true,
    url: `${APP_BASE_URL}/dashboard`,
    scheduledWorkoutIds: pending.map((w) => w.id),
  };
  try {
    const result = await notify({
      userId: u.id,
      category: "training",
      title,
      body,
      data,
      disableEmail: true,
      prefKey: "morningBriefing",
    });
    if (!result.notification) {
      try {
        await db.insert(notifications).values({
          userId: u.id,
          category: "training",
          title,
          body,
          data: { ...data, _hidden: true },
          emailDeliveredAt: result.channels.email ? new Date() : null,
          pushDeliveredAt: result.channels.push ? new Date() : null,
        });
      } catch (e) {
        console.error(`[briefings] failed to write dedupe marker for ${u.id}:`, e);
      }
    }
  } catch (err) {
    console.error(`[briefings] notify failed for ${u.id}:`, err);
  }
}

/**
 * Sweep coach_briefings for any user who is "due" but does not yet have a
 * row for today. Per-user timezone aware: morning briefings (06:00-11:59 local)
 * and evening briefings (20:00+ local) determined against each user's local time.
 */
async function sweepCoachBriefings(
  userRows: Array<{ id: string; timezone: string | null }>,
): Promise<void> {
  if (userRows.length === 0) return;

  let mod: typeof import("./coach/briefings");
  try {
    mod = await import("./coach/briefings");
  } catch (e) {
    console.error("[coach-briefings-sweep] import failed:", e);
    return;
  }

  let generatedMorning = 0;
  let generatedEvening = 0;
  for (const row of userRows) {
    try {
      const hour = localHourFor(row.id, row.timezone);
      const type: "morning" | "evening" | null =
        hour >= 6 && hour < 12 ? "morning" : hour >= 20 ? "evening" : null;
      if (!type) continue;

      const dateKey = mod.todayKeyForUser(row.timezone);
      const existing = await storage.getCoachBriefingForDay(row.id, dateKey, type);
      if (existing) continue;
      await mod.getOrGenerateBriefing(row.id, type);
      if (type === "morning") generatedMorning++;
      else generatedEvening++;
    } catch (e) {
      console.error(`[coach-briefings-sweep] failed for ${row.id}:`, e);
    }
  }
  if (generatedMorning > 0) {
    console.log(`[coach-briefings-sweep] generated ${generatedMorning} morning briefing(s)`);
  }
  if (generatedEvening > 0) {
    console.log(`[coach-briefings-sweep] generated ${generatedEvening} evening briefing(s)`);
  }
}

async function tick(): Promise<void> {
  try {
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        timezone: users.timezone,
        inAppTraining: notificationPreferences.inAppTraining,
        emailTraining: notificationPreferences.emailTraining,
        pushTraining: notificationPreferences.pushTraining,
      })
      .from(users)
      .leftJoin(
        notificationPreferences,
        eq(notificationPreferences.userId, users.id),
      );

    for (const row of rows) {
      const u: BriefingUser = {
        id: row.id,
        firstName: row.firstName ?? null,
        inAppTraining: row.inAppTraining ?? true,
        emailTraining: row.emailTraining ?? false,
        pushTraining: row.pushTraining ?? true,
      };
      await dispatchForUser(u, row.timezone);
    }

    await sweepCoachBriefings(
      rows.map((r) => ({ id: r.id, timezone: r.timezone })),
    );

    await maybeRunNightlyReadiness();
  } catch (err) {
    console.error("[briefings] tick error:", err);
  }
}

const READINESS_HOUR_START = 2;
const READINESS_HOUR_END = 4;
let readinessLastRunDate: string | null = null;
async function maybeRunNightlyReadiness(): Promise<void> {
  try {
    const hour = new Date().getHours();
    if (hour < READINESS_HOUR_START || hour >= READINESS_HOUR_END) return;
    const mod = await import("./dailyReadiness");
    if (!mod.isFeatureEnabled()) return;
    const today = mod.todayKey();
    if (readinessLastRunDate === today) return;
    await mod.runNightlyReadinessCompute();
    readinessLastRunDate = today;
  } catch (e) {
    console.error("[daily-readiness] tick error:", e);
  }
}

export function startBriefingScheduler(): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 90_000);
  console.log(
    `[briefings] scheduler started (every ${TICK_INTERVAL_MS / 60000}m, window ${BRIEFING_HOUR_START}:00-${BRIEFING_HOUR_END}:00 per-user local)`,
  );
}

export async function runBriefingForUserNow(userId: string): Promise<void> {
  const [row] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      timezone: users.timezone,
      inAppTraining: notificationPreferences.inAppTraining,
      emailTraining: notificationPreferences.emailTraining,
      pushTraining: notificationPreferences.pushTraining,
    })
    .from(users)
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, users.id),
    )
    .where(eq(users.id, userId));
  if (!row) return;
  await dispatchForUser(
    {
      id: row.id,
      firstName: row.firstName ?? null,
      inAppTraining: row.inAppTraining ?? true,
      emailTraining: row.emailTraining ?? false,
      pushTraining: row.pushTraining ?? true,
    },
    row.timezone,
  );
}
