import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { notifications, users } from "@shared/schema";
import { notify } from "./notifications";
import { storage } from "./storage";
import {
  getIsoWeekStart,
  getOrCreateCurrentWeeklyCheckinV2,
} from "./weeklyCheckin";

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
  payload: any,
): { title: string; body: string } {
  const name = firstName ? firstName : "there";
  const lines: string[] = [];
  lines.push(`Hi ${name}, here's your weekly review.`);
  lines.push("");

  if (payload?._v === 4) {
    // V2 payload
    const hero: string = payload.hero ?? "";
    const patterns: string[] = payload.cards?.patterns?.bulletPoints ?? [];
    if (hero) {
      lines.push(hero);
      lines.push("");
    }
    if (patterns.length > 0) {
      lines.push("Patterns we noticed:");
      for (const p of patterns.slice(0, 3)) lines.push(`• ${p}`);
      lines.push("");
    }
  } else {
    // V1 payload fallback
    const wins: string[] = payload?.summary?.wins ?? [];
    const concerns: string[] = payload?.summary?.concerns ?? [];
    const traj: string = payload?.summary?.burnoutTrajectory ?? "";
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
  }

  lines.push("Open your dashboard to see your full weekly summary.");

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

  let payload: any;
  try {
    const checkin = await getOrCreateCurrentWeeklyCheckinV2(userId);
    payload = checkin.payload;
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
      disableEmail: true,
    });
    const delivered =
      result.channels.inApp || result.channels.email || result.channels.push;
    if (!delivered) {
      return "skipped";
    }
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
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 120_000);
  console.log(
    `[weekly-checkin-scheduler] started (every ${TICK_INTERVAL_MS / 60000}m, Mondays ${SEND_HOUR_START}:00-${SEND_HOUR_END}:00 local)`,
  );
}

export async function runWeeklyCheckinForUserNow(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;
  const weekStart = getIsoWeekStart();
  await dispatchForUser(userId, user.firstName ?? null, weekStart);
}
