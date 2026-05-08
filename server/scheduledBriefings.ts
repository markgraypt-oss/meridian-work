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
  // No per-user timezone column exists yet; honor `tz` if provided, otherwise
  // use the server's local time. Done this way so we can wire a real column
  // later without changing callers.
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
    // No pending workouts — caller should have already skipped, but be safe.
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
  // Opt-out: if all three training channels are off, skip entirely.
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
    });
    // Idempotency contract: alreadyBriefedToday() looks for a notifications
    // row with data.briefing=true. notify() only inserts an in-app row when
    // inAppTraining is enabled. If the user has inApp off but email/push on,
    // we'd otherwise re-send every tick. Persist a hidden marker row so the
    // next tick sees it and skips. Hidden rows are filtered from the bell by
    // storage.listUserNotifications/countUnreadNotifications.
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

// Sweep coach_briefings for any user who is "due" but does not yet have a
// row for today. Runs alongside the existing notification briefing tick so
// no new background worker is introduced. Generation itself is idempotent
// at the DB level (unique on user/date/type) and cheap when the row exists.
async function sweepCoachBriefings(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const hour = new Date().getHours();
  // Generate morning briefings during the morning window (07:00-12:00) and
  // evening briefings from 20:00 onward (most people are done with work and
  // training by 8pm, so the recap reflects a full day). Outside these
  // windows we leave the on-demand path to handle requests so we don't spend
  // tokens on users who are unlikely to open the app.
  const type: "morning" | "evening" | null =
    hour >= 7 && hour < 12 ? "morning" : hour >= 20 ? "evening" : null;
  if (!type) return;

  let mod: typeof import("./coach/briefings");
  try {
    mod = await import("./coach/briefings");
  } catch (e) {
    console.error("[coach-briefings-sweep] import failed:", e);
    return;
  }

  let generated = 0;
  for (const userId of userIds) {
    try {
      const dateKey = mod.todayKeyForUser();
      const existing = await storage.getCoachBriefingForDay(userId, dateKey, type);
      if (existing) continue;
      await mod.getOrGenerateBriefing(userId, type);
      generated++;
    } catch (e) {
      console.error(`[coach-briefings-sweep] failed for ${userId}:`, e);
    }
  }
  if (generated > 0) {
    console.log(`[coach-briefings-sweep] generated ${generated} ${type} briefing(s)`);
  }
}

async function tick(): Promise<void> {
  try {
    // Pull users joined with their training-channel preferences. Users with no
    // preferences row default to "training enabled" (matches the column
    // defaults in the schema), so missing rows still get a briefing.
    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
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
        // When the prefs row is missing, default to true for inApp/push so
        // briefings still fan out (matches schema defaults).
        inAppTraining: row.inAppTraining ?? true,
        emailTraining: row.emailTraining ?? false,
        pushTraining: row.pushTraining ?? true,
      };
      // No per-user timezone column yet — use server tz. The helper accepts
      // an explicit tz so this can be swapped in later without refactoring.
      await dispatchForUser(u, null);
    }

    // Piggy-back the proactive coach briefing sweep on this tick.
    await sweepCoachBriefings(rows.map((r) => r.id));

    // Piggy-back the nightly Daily Readiness compute (feature-flagged).
    // Runs once per local-night window (02:00-04:00). The compute itself is
    // upsert-based and idempotent, so re-running within the window is safe.
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
    // Local-day key (not UTC) so the once-per-day guard aligns with the
    // 02:00-04:00 LOCAL window above.
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
  // First tick after 90s so we don't compete with boot work; then every 30m.
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 90_000);
  console.log(
    `[briefings] scheduler started (every ${TICK_INTERVAL_MS / 60000}m, window ${BRIEFING_HOUR_START}:00-${BRIEFING_HOUR_END}:00 local)`,
  );
}

// Exposed for tests / admin endpoints to trigger a single user's briefing.
export async function runBriefingForUserNow(userId: string): Promise<void> {
  const [row] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
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
    null,
  );
}
