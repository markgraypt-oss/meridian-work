import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { notifications, users } from "@shared/schema";
import { notify } from "./notifications";
import { storage } from "./storage";
import {
  getIsoWeekStart,
  getOrCreateCurrentWeeklyCheckin,
} from "./weeklyCheckin";
import type { WeeklyCheckinPayload } from "./weeklyCheckin";

const TICK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SEND_HOUR_START = 7; // 07:00 server local
const SEND_HOUR_END = 10;  // before 10:00 server local
const MONDAY = 1;

const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://meridian.work";

let started = false;

async function alreadyEmailedThisWeek(
  userId: string,
  weekStart: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.category, "coach"),
        gte(notifications.createdAt, weekStart),
        sql`(${notifications.data}->>'weeklyCheckin') = 'true'`,
      ),
    );
  return Number(row?.c || 0) > 0;
}

function composeEmail(
  firstName: string | null,
  payload: WeeklyCheckinPayload,
): { title: string; body: string } {
  const name = firstName ? firstName : "there";
  const wins = payload.summary?.wins ?? [];
  const concerns = payload.summary?.concerns ?? [];
  const traj = payload.summary?.burnoutTrajectory ?? "";

  const lines: string[] = [];
  lines.push(`Hi ${name}, here's your weekly review.`);
  lines.push("");
  if (traj) {
    lines.push(traj);
    lines.push("");
  }
  if (wins.length > 0) {
    lines.push("Wins this week:");
    for (const w of wins.slice(0, 3)) lines.push(`• ${w}`);
    lines.push("");
  }
  if (concerns.length > 0) {
    lines.push("Worth watching:");
    for (const c of concerns.slice(0, 3)) lines.push(`• ${c}`);
    lines.push("");
  }
  lines.push("Open your dashboard to see suggestions and full details.");

  return {
    title: "Your weekly check-in is ready",
    body: lines.join("\n").trim(),
  };
}

async function dispatchForUser(
  userId: string,
  firstName: string | null,
  weekStart: Date,
): Promise<"sent" | "skipped" | "error"> {
  if (await alreadyEmailedThisWeek(userId, weekStart)) return "skipped";

  let payload: WeeklyCheckinPayload;
  try {
    const checkin = await getOrCreateCurrentWeeklyCheckin(userId);
    payload = checkin.payload as WeeklyCheckinPayload;
  } catch (e) {
    console.error(`[weekly-checkin-scheduler] generate failed for ${userId}:`, e);
    return "error";
  }

  const { title, body } = composeEmail(firstName, payload);
  const data = {
    weeklyCheckin: true,
    weekStart: weekStart.toISOString(),
    url: `${APP_BASE_URL}/weekly-checkin`,
  };

  try {
    const result = await notify({
      userId,
      category: "coach",
      title,
      body,
      data,
    });
    const delivered =
      result.channels.inApp || result.channels.email || result.channels.push;
    // If nothing was delivered (user opted out of all coach channels, or quiet
    // hours / daily cap blocked fan-out, or push isn't configured) don't write
    // a dedupe marker — we want to retry on a later tick in the same window
    // in case prefs change. Skipping permanent opt-outs is fine: notify() will
    // still no-op next tick.
    if (!delivered) {
      return "skipped";
    }
    // notify() writes the in-app row when inAppCoach is on. If only email/push
    // delivered we still need a marker row so alreadyEmailedThisWeek() returns
    // true on the next tick. Hidden rows are filtered from the bell.
    if (!result.notification) {
      try {
        await db.insert(notifications).values({
          userId,
          category: "coach",
          title,
          body,
          data: { ...data, _hidden: true },
          emailDeliveredAt: result.channels.email ? new Date() : null,
          pushDeliveredAt: result.channels.push ? new Date() : null,
        });
      } catch (e) {
        console.error(
          `[weekly-checkin-scheduler] dedupe marker write failed for ${userId}:`,
          e,
        );
      }
    }
    return "sent";
  } catch (e) {
    console.error(`[weekly-checkin-scheduler] notify failed for ${userId}:`, e);
    return "error";
  }
}

async function tick(): Promise<void> {
  try {
    const now = new Date();
    if (now.getDay() !== MONDAY) return;
    const hour = now.getHours();
    if (hour < SEND_HOUR_START || hour >= SEND_HOUR_END) return;

    const weekStart = getIsoWeekStart(now);

    // "Active user" predicate: has logged in at least once and has an email
    // address we can deliver to. This excludes invited-but-unactivated users
    // and seed/system rows. Per-channel preferences (handled by notify())
    // further refine who actually receives an email/push.
    const rows = await db
      .select({ id: users.id, firstName: users.firstName })
      .from(users)
      .where(and(isNotNull(users.firstLoginAt), isNotNull(users.email)));

    let sent = 0;
    let skipped = 0;
    let errored = 0;
    for (const u of rows) {
      const outcome = await dispatchForUser(u.id, u.firstName ?? null, weekStart);
      if (outcome === "sent") sent++;
      else if (outcome === "skipped") skipped++;
      else errored++;
    }
    if (sent > 0 || errored > 0) {
      console.log(
        `[weekly-checkin-scheduler] sent=${sent} skipped=${skipped} errored=${errored} (${rows.length} users)`,
      );
    }
  } catch (err) {
    console.error("[weekly-checkin-scheduler] tick error:", err);
  }
}

export function startWeeklyCheckinScheduler(): void {
  if (started) return;
  started = true;
  // First tick after 2m so we don't compete with boot work; then every 30m.
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 120_000);
  console.log(
    `[weekly-checkin-scheduler] started (every ${TICK_INTERVAL_MS / 60000}m, Mondays ${SEND_HOUR_START}:00-${SEND_HOUR_END}:00 local)`,
  );
}

// Exposed for admin/test triggers.
export async function runWeeklyCheckinForUserNow(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;
  const weekStart = getIsoWeekStart();
  await dispatchForUser(userId, user.firstName ?? null, weekStart);
}
