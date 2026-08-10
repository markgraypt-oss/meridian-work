import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { notifications, users } from "@workspace/db";
import { notify } from "./notifications";
import { storage } from "./storage";
import { aiCall } from "./ai";
import { getFeatureConfig } from "./aiProvider";
import { COACH_VOICE } from "./coach/coachPersona";
import { getUserStateSnapshot, formatUserStateBlock } from "./coach/userState";

// ---------------------------------------------------------------------------
// Accountability Engine (v1) - spec: claude/accountability-engine-spec.md
//
// A real coach notices the CHANGE, not the schedule. This engine watches each
// user's own pattern (their usual training cadence, their check-in habit) and
// intervenes only when something breaks, at the right intensity:
//
//   STEP 1 (nudge)          one concrete miss, person otherwise engaged.
//   STEP 2 (human check-in) repeated misses / big cadence break / check-in
//                           silence. A genuine question, never a reminder.
//
// Hard rules (agreed with Mark):
//   - One intervention in flight at a time. In flight = the last accountability
//     message has had no workout log and no check-in after it and is <5 days old.
//   - Never two accountability sends within 3 days.
//   - A step 2 unanswered for 5 days => 14-day back-off. Silence, not nagging.
//   - Every message is AI-written from the user's own data in the coach voice.
//     If generation fails, send NOTHING - a template defeats the purpose.
//   - Never nudge into harm: Recovery Mode, low burnout score, or fresh
//     severe pain suppress workout nudges.
//
// Delivery: notify() (in-app + push, quiet hours + daily cap respected),
// per-user local 12:00-12:30 window (briefings own the morning), push opens
// the coach chat so the reply becomes a real conversation.
//
// State is tracked entirely in the existing notifications table via
// data.accountability = true - no schema changes.
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SEND_WINDOW_START = "12:00"; // per-user local time, 30-min window
const MIN_DAYS_BETWEEN_SENDS = 3;
const IN_FLIGHT_EXPIRY_DAYS = 5;
const BACKOFF_AFTER_STEP2_DAYS = 14;
const MAX_INACTIVE_DAYS = 45; // beyond this the generic inactivity nudge owns it

let started = false;

// ── Time helpers (same conventions as pushNotificationScheduler) ─────────────

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
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
      return { hour, minute };
    } catch {
      // fall through
    }
  }
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function isWithinWindowTz(target: string, tz: string | null | undefined): boolean {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(target);
  if (!m) return false;
  const { hour, minute } = nowInTz(tz);
  const nowMin = hour * 60 + minute;
  const targetMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return nowMin >= targetMin && nowMin < targetMin + 30;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

// ── Signal computation ───────────────────────────────────────────────────────

type Signal =
  | { kind: "missed_scheduled"; step: 1 | 2; facts: string }
  | { kind: "pattern_break"; step: 1 | 2; facts: string }
  | { kind: "checkin_silence"; step: 2; facts: string };

interface LastAccountabilityMsg {
  createdAt: Date;
  step: number;
}

async function getLastAccountabilityMsg(userId: string): Promise<LastAccountabilityMsg | null> {
  const [row] = await db
    .select({ createdAt: notifications.createdAt, data: notifications.data })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        sql`(${notifications.data}->>'accountability') = 'true'`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  if (!row?.createdAt) return null;
  const step = Number((row.data as any)?.step) || 1;
  return { createdAt: new Date(row.createdAt), step };
}

/**
 * Detect the strongest active signal for this user, or null.
 * Uses only their OWN historical pattern - no fixed schedules.
 */
async function detectSignal(userId: string): Promise<Signal | null> {
  const now = new Date();
  const dayMs = 86_400_000;

  const [logs, scheduled, recentCheckIns] = await Promise.all([
    storage.getUserWorkoutLogs(userId, 60).catch(() => []),
    storage
      .getScheduledWorkoutsInRange(userId, new Date(now.getTime() - 8 * dayMs), now)
      .catch(() => []),
    storage
      .getCheckInsInRange(userId, new Date(now.getTime() - 21 * dayMs), now)
      .catch(() => []),
  ]);

  // ---- Check-in silence: a regular checker gone quiet for 3+ days. ----
  const checkinDates = (recentCheckIns || [])
    .map((c: any) => new Date(c.checkInDate ?? c.createdAt))
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  const daysSinceCheckin = checkinDates.length
    ? daysBetween(now, checkinDates[0])
    : null;
  const checkinsInPriorFortnight = checkinDates.filter((d) => {
    const age = daysBetween(now, d);
    return age >= 3 && age <= 17;
  }).length;
  const checkinSilence =
    daysSinceCheckin !== null && daysSinceCheckin >= 3 && checkinsInPriorFortnight >= 5;

  // ---- Workout cadence from their own last 28 days. ----
  const logDates = (logs || [])
    .map((l: any) => new Date(l.completedAt ?? l.startedAt ?? l.createdAt))
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  const daysSinceWorkout = logDates.length ? daysBetween(now, logDates[0]) : null;
  const workoutsLast28 = logDates.filter((d) => daysBetween(now, d) <= 28).length;
  // usual gap between sessions, clamped 2..7 days; needs a real habit to exist
  const hasCadence = workoutsLast28 >= 4;
  const usualGap = hasCadence ? Math.min(7, Math.max(2, 28 / workoutsLast28)) : null;

  // ---- Scheduled workout misses in the last 7 days. ----
  const missed = (scheduled || []).filter((s: any) => {
    if (s.isCompleted) return false;
    const d = new Date(s.scheduledDate);
    if (!Number.isFinite(d.getTime())) return false;
    const age = daysBetween(now, d);
    return age >= 1 && age <= 7 && d.getTime() < now.getTime();
  });
  const missedYesterday = missed.find((s: any) => {
    const age = daysBetween(now, new Date(s.scheduledDate));
    return age >= 1 && age < 2;
  });

  // Strongest first: repeated misses / big break => step 2.
  if (missed.length >= 2) {
    const names = missed
      .slice(0, 3)
      .map((s: any) => s.workoutName)
      .filter(Boolean)
      .join(", ");
    return {
      kind: "missed_scheduled",
      step: 2,
      facts: `${missed.length} scheduled sessions missed in the last 7 days${names ? ` (${names})` : ""}. Last logged workout ${daysSinceWorkout !== null ? Math.floor(daysSinceWorkout) : "many"} days ago.`,
    };
  }

  if (
    hasCadence &&
    usualGap !== null &&
    daysSinceWorkout !== null &&
    daysSinceWorkout >= usualGap * 2 + 2
  ) {
    return {
      kind: "pattern_break",
      step: 2,
      facts: `Usually trains about every ${Math.round(usualGap)} days (${workoutsLast28} sessions in the last 4 weeks) but has not logged a workout for ${Math.floor(daysSinceWorkout)} days.`,
    };
  }

  if (checkinSilence) {
    return {
      kind: "checkin_silence",
      step: 2,
      facts: `Checked in ${checkinsInPriorFortnight} times in the prior fortnight, then went quiet ${Math.floor(daysSinceCheckin!)} days ago. No check-in since.`,
    };
  }

  // Softer, single-miss signals => step 1 (only if otherwise engaged).
  const engaged = daysSinceWorkout !== null && daysSinceWorkout <= 7;
  if (missedYesterday && engaged) {
    return {
      kind: "missed_scheduled",
      step: 1,
      facts: `Yesterday's scheduled session ("${(missedYesterday as any).workoutName || "workout"}") was not completed. Trained within the last week otherwise.`,
    };
  }

  if (
    hasCadence &&
    usualGap !== null &&
    daysSinceWorkout !== null &&
    daysSinceWorkout >= usualGap + 2 &&
    daysSinceWorkout <= usualGap + 4
  ) {
    return {
      kind: "pattern_break",
      step: 1,
      facts: `Usually trains about every ${Math.round(usualGap)} days but the current gap is ${Math.floor(daysSinceWorkout)} days. Small break in an otherwise consistent pattern (${workoutsLast28} sessions in the last 4 weeks).`,
    };
  }

  return null;
}

// ── Message generation (AI in the coach voice, or nothing) ───────────────────

const messageSchema = z.object({
  title: z.string().min(4).max(48),
  body: z.string().min(20).max(220),
});

async function generateMessage(
  userId: string,
  firstName: string | null,
  signal: Signal,
): Promise<{ title: string; body: string } | null> {
  const config = await getFeatureConfig("recovery_coach");
  if (!config) return null;

  const snapshot = await getUserStateSnapshot(userId).catch(() => null);
  const stateBlock = snapshot ? formatUserStateBlock(snapshot) : "";
  const name = firstName?.trim() || "there";

  const stepGuide =
    signal.step === 1
      ? `STEP 1, A LIGHT NUDGE. One miss, nothing more. Tone: warm, zero guilt, an easy door back in. Acknowledge life happens. Point at the next opportunity (today), not the miss. Do NOT ask a question. Example energy (do not copy): "No session yesterday. Life happens. Today's is ready when you are."`
      : `STEP 2, CHECK IN AS A HUMAN. A pattern has broken. Tone: a coach who noticed and cares, not a system that tracked. The body MUST end with ONE genuine, open question about what is going on for them (schedule, energy, or motivation), because their answer decides what happens next. Never scold, never list what they missed.`;

  const prompt = `${COACH_VOICE}

You are writing ONE short proactive push notification to ${name}. This is accountability outreach: you noticed a change in their pattern and you are reaching out the way a real coach would.

WHY YOU ARE REACHING OUT (the signal, from their real data):
${signal.facts}

${stateBlock ? `THEIR CURRENT STATE:\n${stateBlock}\n` : ""}
${stepGuide}

HARD RULES:
- Reference their SPECIFIC situation (their gap, their session, their streak). It must be impossible to send this message to anyone else.
- Never use the words "missed", "failed", "streak broken", "you haven't", "still no". No guilt framing anywhere.
- Never mention data, tracking, logging, monitoring, or that you "noticed in the data". You just know them.
- No em dashes anywhere. No emojis. British English.
- title: max 45 characters, feels like a text from a coach, not an app (no "Reminder", no "Alert").
- body: max 200 characters, 1 to 3 short sentences.

Return ONLY this JSON: {"title": string, "body": string}`;

  const result = await aiCall({
    feature: "coach_accountability",
    userId,
    prompt,
    maxTokens: 200,
    provider: config.provider,
    model: config.model,
    schema: messageSchema,
    temperature: 0.6,
  });

  if (!result.data) {
    console.error(
      `[accountability] AI generation failed for user ${userId} (${signal.kind}); sending nothing.`,
    );
    return null;
  }
  // Belt and braces: strip any em/en dashes the model sneaks in.
  const clean = (s: string) => s.replace(/[–—‒―]/g, ",").replace(/\s+,/g, ",");
  return { title: clean(result.data.title), body: clean(result.data.body) };
}

// ── Per-user evaluation ──────────────────────────────────────────────────────

export async function runAccountabilityForUser(
  userId: string,
  opts: { firstName?: string | null; force?: boolean } = {},
): Promise<{ sent: boolean; reason: string }> {
  const now = new Date();

  // Cadence + in-flight gates (skipped with force, for testing).
  const last = await getLastAccountabilityMsg(userId);
  if (!opts.force && last) {
    const age = daysBetween(now, last.createdAt);
    if (age < MIN_DAYS_BETWEEN_SENDS) return { sent: false, reason: "too_soon" };

    // Back-off after an unanswered step 2.
    if (last.step >= 2 && age < BACKOFF_AFTER_STEP2_DAYS) {
      const answered = await hasActivitySince(userId, last.createdAt);
      if (!answered) return { sent: false, reason: "backoff_after_step2" };
    }

    // One in flight: recent message, no workout/check-in since.
    if (age < IN_FLIGHT_EXPIRY_DAYS) {
      const answered = await hasActivitySince(userId, last.createdAt);
      if (!answered) return { sent: false, reason: "in_flight" };
    }
  }

  const signal = await detectSignal(userId);
  if (!signal) return { sent: false, reason: "no_signal" };

  // Escalation: a persisting signal after an unanswered step 1 becomes step 2.
  let step = signal.step;
  if (last && last.step === 1 && daysBetween(now, last.createdAt) >= MIN_DAYS_BETWEEN_SENDS) {
    const answered = await hasActivitySince(userId, last.createdAt);
    if (!answered) step = 2;
  }

  // Safety softeners: never nudge training into harm.
  if (signal.kind !== "checkin_silence") {
    const snapshot = await getUserStateSnapshot(userId).catch(() => null);
    if (snapshot) {
      if (snapshot.burnout.recoveryMode) return { sent: false, reason: "recovery_mode" };
      if (snapshot.burnout.score !== null && snapshot.burnout.score < 40)
        return { sent: false, reason: "low_burnout_score" };
      const severePain = snapshot.pain.activeIssues.some(
        (i) => i.severity >= 7 && i.daysAgo <= 7,
      );
      if (severePain) return { sent: false, reason: "severe_pain" };
    }
  }

  const message = await generateMessage(userId, opts.firstName ?? null, {
    ...signal,
    step,
  } as Signal);
  if (!message) return { sent: false, reason: "generation_failed" };

  await notify({
    userId,
    category: "coach",
    title: message.title,
    body: message.body,
    data: {
      accountability: true,
      step,
      signal: signal.kind,
      url: "/?coach=1",
    },
    disableEmail: true,
  });

  console.log(
    `[accountability] sent step ${step} (${signal.kind}) to user ${userId}`,
  );
  return { sent: true, reason: `sent_step_${step}` };
}

/** Any workout log or check-in after the given time counts as the person responding. */
async function hasActivitySince(userId: string, since: Date): Promise<boolean> {
  const [logs, checkins] = await Promise.all([
    storage.getUserWorkoutLogs(userId, 5).catch(() => []),
    storage.getCheckInsInRange(userId, since, new Date()).catch(() => []),
  ]);
  const workoutAfter = (logs || []).some((l: any) => {
    const d = new Date(l.completedAt ?? l.startedAt ?? l.createdAt);
    return Number.isFinite(d.getTime()) && d.getTime() > since.getTime();
  });
  return workoutAfter || (checkins || []).length > 0;
}

// ── Scheduler ────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_INACTIVE_DAYS * 86_400_000);
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      timezone: users.timezone,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(and(sql`${users.lastActiveAt} IS NOT NULL`, gte(users.lastActiveAt, cutoff)));

  for (const row of rows) {
    try {
      // Per-user local lunchtime window; briefings own the morning.
      if (!isWithinWindowTz(SEND_WINDOW_START, row.timezone)) continue;
      await runAccountabilityForUser(row.id, { firstName: row.firstName });
    } catch (e) {
      console.error(`[accountability] tick failed for user ${row.id}:`, e);
    }
  }
}

export function startAccountabilityEngine(): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 180_000);
  console.log(
    "[accountability] started (signal-driven coach outreach, ladder v1, per-user 12:00 local window)",
  );
}
