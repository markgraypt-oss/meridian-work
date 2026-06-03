import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import {
  habits,
  habitCompletions,
  bodyMapLogs,
  notificationPreferences,
  notifications,
  users,
} from "@shared/schema";
import { notify } from "./notifications";

const TICK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_HABIT_REMINDER_TIME = "09:00";

let started = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseHHMM(t: string): { h: number; m: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t.trim());
  if (!match) return null;
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

/**
 * Returns the current { hour, minute } in the user's IANA timezone.
 * Falls back to server local time if `tz` is null or invalid.
 */
function nowInTz(tz: string | null | undefined): { hour: number; minute: number } {
  const d = new Date();
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = fmt.formatToParts(d);
      const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
      const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
      return { hour, minute };
    } catch {
      // fall through
    }
  }
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/**
 * Returns true if the current local time (in `tz`) falls within the 30-minute
 * window starting at the given HH:MM target.
 */
function isWithinWindowTz(target: string, tz: string | null | undefined): boolean {
  const parsed = parseHHMM(target);
  if (!parsed) return false;
  const { hour, minute } = nowInTz(tz);
  const nowMin = hour * 60 + minute;
  const targetMin = parsed.h * 60 + parsed.m;
  return nowMin >= targetMin && nowMin < targetMin + 30;
}

/**
 * UTC midnight of the user's *current local day*. Used as the lower bound for
 * "already sent today" dedupe queries against `notifications.createdAt`
 * (a timestamptz stored in UTC).
 */
function startOfUserLocalDayUtc(tz: string | null | undefined): Date {
  const d = new Date();
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const [y, m, day] = fmt.format(d).split("-").map(s => parseInt(s, 10));
      return new Date(Date.UTC(y, m - 1, day));
    } catch {
      // fall through
    }
  }
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local;
}

// ── Habit Reminders (DISABLED — device-side via lib/habitNotifications.ts) ──

async function runHabitReminders(): Promise<void> {
  // Habit reminders are now scheduled device-side via lib/habitNotifications.ts on mobile.
  // Disabled here to prevent double-firing. Do not re-enable without removing the mobile scheduler.
  return;

  // ── unreachable; preserved for reference ──
  const activeHabits = await db
    .select({
      id: habits.id,
      userId: habits.userId,
      title: habits.title,
      reminderTime: habits.reminderTime,
      daysOfWeek: habits.daysOfWeek,
      startDate: habits.startDate,
      duration: habits.duration,
      habitReminders: notificationPreferences.habitReminders,
    })
    .from(habits)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, habits.userId))
    .where(eq(habits.isActive, true));
  void activeHabits;
}

// ── Body Map Reassessment ────────────────────────────────────────────────────

async function runBodyMapReassessments(): Promise<void> {
  const userPrefs = await db
    .select({
      userId: notificationPreferences.userId,
      bodyMapFrequencyDays: notificationPreferences.bodyMapFrequencyDays,
      timezone: users.timezone,
    })
    .from(notificationPreferences)
    .leftJoin(users, eq(users.id, notificationPreferences.userId))
    .where(eq(notificationPreferences.bodyMapReassessment, true));

  for (const pref of userPrefs) {
    try {
      // Per-user 09:00 local window.
      if (!isWithinWindowTz("09:00", pref.timezone)) continue;

      const today = startOfUserLocalDayUtc(pref.timezone);
      const frequencyDays = pref.bodyMapFrequencyDays ?? 14;
      const cutoff = new Date(today.getTime() - frequencyDays * 24 * 60 * 60 * 1000);

      // Most recent body map log
      const [latestLog] = await db
        .select({ id: bodyMapLogs.id, createdAt: bodyMapLogs.createdAt })
        .from(bodyMapLogs)
        .where(eq(bodyMapLogs.userId, pref.userId))
        .orderBy(sql`${bodyMapLogs.createdAt} desc`)
        .limit(1);
      if (!latestLog) continue;
      if (latestLog.createdAt > cutoff) continue;

      // Dedupe: already sent today (user-local day)
      const [alreadySent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, pref.userId),
            gte(notifications.createdAt, today),
            sql`(${notifications.data}->>'bodyMapReassessment') = 'true'`,
          ),
        )
        .limit(1);
      if (alreadySent) continue;

      await notify({
        userId: pref.userId,
        category: "recovery",
        title: "Time for a body map check-in",
        body: `It's been ${frequencyDays}+ days since your last assessment. How are you feeling?`,
        data: { bodyMapReassessment: true, url: "/body-map" },
        disableEmail: true,
        prefKey: "bodyMapReassessment",
      });
    } catch (e) {
      console.error(`[push-scheduler] body map reassessment failed user=${pref.userId}:`, e);
    }
  }
}

// ── Inactivity Nudges ────────────────────────────────────────────────────────

const INACTIVITY_LEVELS = [
  {
    days: 14,
    level: 3,
    title: "We miss you",
    body: "We miss you. Open the app to keep your insights up to date.",
  },
  {
    days: 7,
    level: 2,
    title: "It's been a week",
    body: "It's been a week. Your data helps us help you.",
  },
  {
    days: 2,
    level: 1,
    title: "Quick check-in?",
    body: "Quick check-in? Takes 60 seconds.",
  },
] as const;

async function runInactivityNudges(): Promise<void> {
  const rows = await db
    .select({
      id: users.id,
      lastActiveAt: users.lastActiveAt,
      timezone: users.timezone,
      inactivityNudge: notificationPreferences.inactivityNudge,
    })
    .from(users)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(sql`${users.lastActiveAt} IS NOT NULL`);

  const now = new Date();

  for (const row of rows) {
    try {
      if (row.inactivityNudge === false) continue;
      if (!row.lastActiveAt) continue;

      // Per-user 09:00 local window.
      if (!isWithinWindowTz("09:00", row.timezone)) continue;

      const daysSince =
        (now.getTime() - new Date(row.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);

      const targetLevel = INACTIVITY_LEVELS.find(l => daysSince >= l.days) ?? null;
      if (!targetLevel) continue;

      const [alreadySent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, row.id),
            gte(notifications.createdAt, row.lastActiveAt),
            sql`(${notifications.data}->>'inactivityLevel')::int >= ${targetLevel.level}`,
          ),
        )
        .limit(1);
      if (alreadySent) continue;

      await notify({
        userId: row.id,
        category: "coach",
        title: targetLevel.title,
        body: targetLevel.body,
        data: {
          inactivityNudge: true,
          inactivityLevel: targetLevel.level,
          url: "/dashboard",
        },
        disableEmail: true,
        prefKey: "inactivityNudge",
      });
    } catch (e) {
      console.error(`[push-scheduler] inactivity nudge failed user=${row.id}:`, e);
    }
  }
}

// ── Main tick + export ───────────────────────────────────────────────────────

async function tick(): Promise<void> {
  try {
    await runHabitReminders();
  } catch (e) {
    console.error("[push-scheduler] habit reminders error:", e);
  }
  try {
    await runBodyMapReassessments();
  } catch (e) {
    console.error("[push-scheduler] body map reassessments error:", e);
  }
  try {
    await runInactivityNudges();
  } catch (e) {
    console.error("[push-scheduler] inactivity nudges error:", e);
  }
}

export function startPushNotificationScheduler(): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 150_000);
  console.log("[push-scheduler] started (body map reassessments, inactivity nudges; habit reminders disabled — device-side, per-user timezone aware)");
}
