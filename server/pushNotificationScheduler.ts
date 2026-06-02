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
 * Returns true if the current local time falls within the 30-minute window
 * starting at the given HH:MM target.
 */
function isWithinWindow(target: string, tzOffsetMinutes?: number | null): boolean {
  const parsed = parseHHMM(target);
  if (!parsed) return false;
  const now = new Date();
  // If tzOffsetMinutes is provided, compute "now" in the user's local time.
  // getTimezoneOffset() returns (UTC - local) in minutes: e.g. CEST = -120.
  // So local time = UTC - tzOffsetMinutes.
  let hours: number;
  let minutes: number;
  if (typeof tzOffsetMinutes === "number") {
    const localMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
    const local = new Date(localMs);
    hours = local.getUTCHours();
    minutes = local.getUTCMinutes();
  } else {
    hours = now.getHours();
    minutes = now.getMinutes();
  }
  const nowMin = hours * 60 + minutes;
  const targetMin = parsed.h * 60 + parsed.m;
  return nowMin >= targetMin && nowMin < targetMin + 30;
}

/**
 * Returns true if the habit is scheduled for today based on its daysOfWeek field.
 * Accepts 'everyday' / 'every day', or a comma-separated list of day names/abbreviations.
 */
function isDueToday(daysOfWeek: string | null, tzOffsetMinutes?: number | null): boolean {
  if (!daysOfWeek) return true;
  const lower = daysOfWeek.toLowerCase().trim();
  if (lower === "everyday" || lower === "every day" || lower === "daily") return true;
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayAbbr = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let todayIdx: number;
  if (typeof tzOffsetMinutes === "number") {
    const localMs = Date.now() - tzOffsetMinutes * 60 * 1000;
    todayIdx = new Date(localMs).getUTCDay();
  } else {
    todayIdx = new Date().getDay();
  }
  return lower.includes(dayNames[todayIdx]) || lower.includes(dayAbbr[todayIdx]);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns true if today falls between the habit's startDate and
 * (startDate + duration weeks). Mirrors the mobile UI bucketing in
 * app/habits.tsx so the scheduler doesn't fire reminders for habits the
 * user already considers "Past" or hasn't started yet ("Scheduled").
 */
function isHabitWithinDurationWindow(
  startDate: Date | string | null | undefined,
  durationWeeks: number | null | undefined,
  tzOffsetMinutes?: number | null,
): boolean {
  if (!startDate) return true; // legacy rows with no start date — be permissive
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return true;
  const weeks = typeof durationWeeks === "number" && durationWeeks > 0 ? durationWeeks : 3;
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + weeks * 7);

  // Compare against "now" in the user's local time so a habit ending tonight
  // still fires this morning.
  const nowMs = typeof tzOffsetMinutes === "number"
    ? Date.now() - tzOffsetMinutes * 60 * 1000
    : Date.now();
  const now = new Date(nowMs);
  // Strip time-of-day for inclusive day-based comparison.
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const todayDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayDay >= startDay && todayDay < endDay;
}

// ── Habit Reminders ──────────────────────────────────────────────────────────

async function runHabitReminders(): Promise<void> {
  const activeHabits = await db
    .select({
      id: habits.id,
      userId: habits.userId,
      title: habits.title,
      reminderTime: habits.reminderTime,
      reminderTimezoneOffset: habits.reminderTimezoneOffset,
      daysOfWeek: habits.daysOfWeek,
      startDate: habits.startDate,
      duration: habits.duration,
      habitReminders: notificationPreferences.habitReminders,
    })
    .from(habits)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, habits.userId))
    .where(eq(habits.isActive, true));

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  for (const habit of activeHabits) {
    try {
      // Respect toggle — null means default on
      if (habit.habitReminders === false) continue;

      const reminderTime = habit.reminderTime || DEFAULT_HABIT_REMINDER_TIME;
      if (!isWithinWindow(reminderTime, habit.reminderTimezoneOffset)) continue;
      if (!isDueToday(habit.daysOfWeek, habit.reminderTimezoneOffset)) continue;
      if (!isHabitWithinDurationWindow(habit.startDate, habit.duration, habit.reminderTimezoneOffset)) continue;

      // Skip if already completed today
      const [done] = await db
        .select({ id: habitCompletions.id })
        .from(habitCompletions)
        .where(
          and(
            eq(habitCompletions.habitId, habit.id),
            gte(habitCompletions.completedDate, today),
            lt(habitCompletions.completedDate, tomorrow),
          ),
        )
        .limit(1);
      if (done) continue;

      // Deduplicate: skip if already sent a reminder for this habit today
      const [alreadySent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, habit.userId),
            gte(notifications.createdAt, today),
            sql`(${notifications.data}->>'habitId')::text = ${String(habit.id)}`,
            sql`(${notifications.data}->>'habitReminder') = 'true'`,
          ),
        )
        .limit(1);
      if (alreadySent) continue;

      await notify({
        userId: habit.userId,
        category: "coach",
        title: habit.title,
        body: "Time to complete your habit for today.",
        data: { habitId: habit.id, habitReminder: true, url: "/habits" },
        disableEmail: true,
        prefKey: "habitReminders",
      });
    } catch (e) {
      console.error(`[push-scheduler] habit reminder failed habit=${habit.id}:`, e);
    }
  }
}

// ── Body Map Reassessment ────────────────────────────────────────────────────

async function runBodyMapReassessments(): Promise<void> {
  // Body map reassessments fire at 09:00 only
  if (!isWithinWindow("09:00")) return;

  const userPrefs = await db
    .select({
      userId: notificationPreferences.userId,
      bodyMapFrequencyDays: notificationPreferences.bodyMapFrequencyDays,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.bodyMapReassessment, true));

  const today = startOfToday();

  for (const pref of userPrefs) {
    try {
      const frequencyDays = pref.bodyMapFrequencyDays ?? 14;
      const cutoff = new Date(today.getTime() - frequencyDays * 24 * 60 * 60 * 1000);

      // Get most recent body map log
      const [latestLog] = await db
        .select({ id: bodyMapLogs.id, createdAt: bodyMapLogs.createdAt })
        .from(bodyMapLogs)
        .where(eq(bodyMapLogs.userId, pref.userId))
        .orderBy(sql`${bodyMapLogs.createdAt} desc`)
        .limit(1);
      if (!latestLog) continue;

      // The latest log must be at least frequencyDays old.
      // If the user has reassessed recently, the latest log will be newer and we skip.
      if (latestLog.createdAt > cutoff) continue;

      // Deduplicate: already sent a body map reassessment nudge today
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
  // Only run once per day at the 09:00 window
  if (!isWithinWindow("09:00")) return;

  const rows = await db
    .select({
      id: users.id,
      lastActiveAt: users.lastActiveAt,
      inactivityNudge: notificationPreferences.inactivityNudge,
    })
    .from(users)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(sql`${users.lastActiveAt} IS NOT NULL`);

  const now = new Date();

  for (const row of rows) {
    try {
      // Respect toggle — null means default on
      if (row.inactivityNudge === false) continue;
      if (!row.lastActiveAt) continue;

      const daysSince =
        (now.getTime() - new Date(row.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);

      // Find the highest inactivity level the user qualifies for
      const targetLevel = INACTIVITY_LEVELS.find((l) => daysSince >= l.days) ?? null;
      if (!targetLevel) continue;

      // Deduplicate: skip if this level (or higher) was already sent since lastActiveAt.
      // Once the user opens the app, lastActiveAt resets and the cycle restarts.
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
  // 2.5 min after boot so DB columns are available and other schedulers have started
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 150_000);
  console.log("[push-scheduler] started (habit reminders, body map reassessments, inactivity nudges)");
}
