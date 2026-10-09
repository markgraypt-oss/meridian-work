// ===========================================================================
// TESTER FEEDBACK PROMPTS — day 7 / day 21 / review
// Spec: claude/tester-feedback-prompts-spec-08oct.md (9 Oct 2026)
//
// Testers (the website sign-ups in the Testers company) get an in-app card at
// day 7 and day 21 with two questions each; day 21 can flip to a review ask.
// Copy lives here so wording changes don't need a mobile build.
// A daily scheduler sends one push per prompt when it first becomes due.
// ===========================================================================

import { Resend } from "resend";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { notify } from "./notifications";
import { renderBrandedEmail, emailParagraph, emailNote } from "./emailBrand";
import { users, companies, testerPromptEvents } from "@workspace/db";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "mark@meridian.work";

export type PromptKey = "day7" | "day21" | "review";
const DAY_MS = 86_400_000;
const RE_ASK_AFTER_DAYS = 3;
const MAX_DISMISSALS = 2;

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
export const PROMPTS = {
  day7: {
    key: "day7" as const,
    thresholdDays: 7,
    title: "One week in. Two questions.",
    q1: { label: "How's it going so far?", options: ["Badly", "Not great", "OK", "Good", "Very good"] },
    q2: { label: "What's broken, confusing or missing?", placeholder: "One thing is plenty." },
    submit: "Send to Mark",
    later: "Not now",
    thanks: "Thanks. Mark reads every one.",
    push: { title: "One week in", body: "Two quick questions from Mark. Thirty seconds." },
  },
  day21: {
    key: "day21" as const,
    thresholdDays: 21,
    title: "Three weeks in. Two questions.",
    q1: { label: "Has it changed anything about how you work or feel?", options: ["No", "Not yet", "A little", "Yes, clearly"] },
    q2: { label: "What would make you recommend it, or what's stopping you?", placeholder: "" },
    submit: "Send to Mark",
    later: "Not now",
    thanks: "Thanks. That's the useful kind of answer.",
    push: { title: "Three weeks in", body: "Two quick questions from Mark, and then he'll leave you alone." },
  },
  review: {
    key: "review" as const,
    title: "Would you say that publicly?",
    body: "A sentence or two in your own words. It goes on meridian.work with your first name and job title, nothing else.",
    textLabel: "Your words",
    jobTitleLabel: "Job title (optional)",
    consentLabel: "You can use this with my first name and job title.",
    submit: "Post it",
    later: "Maybe later",
    thanks: "Thank you. If you'd ever do a 30-second video version, reply to any of my emails and say so.",
  },
  messageMark: { label: "Message Mark", mailto: "mailto:mark@meridian.work?subject=MeridianWork%20tester%20feedback" },
};

// ---------------------------------------------------------------------------
// Who is a tester
// ---------------------------------------------------------------------------
let testersCompanyId: number | null | undefined;
async function getTestersCompanyId(): Promise<number | null> {
  if (testersCompanyId !== undefined) return testersCompanyId;
  const envId = Number(process.env.TESTERS_COMPANY_ID);
  if (Number.isFinite(envId) && envId > 0) { testersCompanyId = envId; return envId; }
  const [c] = await db.select({ id: companies.id }).from(companies)
    .where(sql`lower(${companies.name}) like '%tester%'`).orderBy(companies.id).limit(1);
  testersCompanyId = c?.id ?? null;
  return testersCompanyId;
}

export async function isTesterUser(user: { id: string; isAdmin?: boolean | null; companyId?: number | null; signupSource?: string | null }): Promise<boolean> {
  if (!user || user.isAdmin) return false;
  if (user.signupSource === "website-test") return true;
  const tid = await getTestersCompanyId();
  return tid !== null && user.companyId === tid;
}

// ---------------------------------------------------------------------------
// Due logic
// ---------------------------------------------------------------------------
function daysSince(d: Date | string | null | undefined): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY_MS);
}

async function eventsFor(userId: string, key: PromptKey) {
  return db.select().from(testerPromptEvents)
    .where(and(eq(testerPromptEvents.userId, userId), eq(testerPromptEvents.promptKey, key)))
    .orderBy(desc(testerPromptEvents.createdAt));
}

function isOpen(events: { action: string; createdAt: Date | null }[]): boolean {
  if (events.some(e => e.action === "answered")) return false;
  const dismissed = events.filter(e => e.action === "dismissed");
  if (dismissed.length >= MAX_DISMISSALS) return false;
  if (dismissed.length === 1 && daysSince(dismissed[0].createdAt) < RE_ASK_AFTER_DAYS) return false;
  return true;
}

export async function getDuePrompt(userId: string) {
  const user = await storage.getUser(userId);
  if (!user || !(await isTesterUser(user as any))) return { prompt: null, tester: false };
  const days = daysSince(user.createdAt);
  for (const key of ["day21", "day7"] as const) {
    const def = PROMPTS[key];
    if (days < def.thresholdDays) continue;
    const ev = await eventsFor(userId, key);
    if (!isOpen(ev)) continue;
    return { prompt: { ...def, daysIn: days }, tester: true, review: PROMPTS.review, messageMark: PROMPTS.messageMark };
  }
  return { prompt: null, tester: true, messageMark: PROMPTS.messageMark };
}

// ---------------------------------------------------------------------------
// Recording answers
// ---------------------------------------------------------------------------
export async function recordPromptEvent(userId: string, key: PromptKey, action: "answered" | "dismissed", answers?: any) {
  await db.insert(testerPromptEvents).values({ userId, promptKey: key, action, answers: answers ?? null });
}

export function validateAnswers(key: PromptKey, body: any): { ok: true; answers: any } | { ok: false; message: string } {
  const a = body?.answers || {};
  if (key === "day7" || key === "day21") {
    const n = PROMPTS[key].q1.options.length;
    const q1 = Number(a.q1);
    if (!Number.isInteger(q1) || q1 < 1 || q1 > n) return { ok: false, message: "Pick an answer to the first question" };
    const q2 = typeof a.q2 === "string" ? a.q2.trim().slice(0, 1000) : "";
    return { ok: true, answers: { q1, q1Label: PROMPTS[key].q1.options[q1 - 1], q2 } };
  }
  const text = typeof a.text === "string" ? a.text.trim().slice(0, 600) : "";
  const jobTitle = typeof a.jobTitle === "string" ? a.jobTitle.trim().slice(0, 80) : "";
  if (!text) return { ok: false, message: "Write a sentence or two first" };
  if (a.consent !== true) return { ok: false, message: "Tick the box so I can use it" };
  return { ok: true, answers: { text, jobTitle, consent: true } };
}

/** day21 q1 >= 3 ("A little" / "Yes, clearly") earns the review ask. */
export function wantsReview(key: PromptKey, answers: any): boolean {
  return key === "day21" && Number(answers?.q1) >= 3;
}

// ---------------------------------------------------------------------------
// Email Mark each answer, Reply-To the tester
// ---------------------------------------------------------------------------
export async function emailMarkAboutAnswer(user: { email?: string | null; firstName?: string | null; createdAt?: Date | null }, key: PromptKey, answers: any) {
  if (!resend) return;
  const name = user.firstName || "A tester";
  const days = daysSince(user.createdAt);
  const esc = (s: string) => String(s || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  let subject: string, bodyHtml: string;
  if (key === "review") {
    subject = `New tester review: ${name}`;
    bodyHtml =
      emailParagraph(`<strong>${esc(name)}</strong>${answers.jobTitle ? `, ${esc(answers.jobTitle)}` : ""} &lt;${esc(user.email || "")}&gt; · day ${days}`) +
      emailParagraph(`<em>“${esc(answers.text)}”</em>`) +
      emailNote("Consent given for first name + job title on meridian.work. Reply to this email to ask for the video version.");
  } else {
    const def = PROMPTS[key];
    subject = `Tester ${key === "day7" ? "day 7" : "day 21"}: ${name} — ${answers.q1Label}`;
    bodyHtml =
      emailParagraph(`<strong>${esc(name)}</strong> &lt;${esc(user.email || "")}&gt; · day ${days}`) +
      emailParagraph(`<strong>${esc(def.q1.label)}</strong><br>${esc(answers.q1Label)} (${answers.q1}/${def.q1.options.length})`) +
      emailParagraph(`<strong>${esc(def.q2.label)}</strong><br>${answers.q2 ? esc(answers.q2) : "<span style=\"color:#8a94a6\">(left blank)</span>"}`) +
      emailNote("Reply to this email and it goes straight to the tester.");
  }
  try {
    await resend.emails.send({
      from: "MeridianWork <no-reply@meridian.work>",
      to: ADMIN_EMAIL,
      replyTo: user.email || undefined,
      subject,
      html: renderBrandedEmail({ eyebrow: "Testers", heading: subject, bodyHtml, footerNote: "Automated from the in-app tester prompt." }),
    });
  } catch (err) {
    console.error("[TESTER-PROMPT] email to Mark failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Admin list
// ---------------------------------------------------------------------------
export async function listTesterFeedback(limit = 500) {
  return db.select({
    id: testerPromptEvents.id,
    userId: testerPromptEvents.userId,
    promptKey: testerPromptEvents.promptKey,
    action: testerPromptEvents.action,
    answers: testerPromptEvents.answers,
    createdAt: testerPromptEvents.createdAt,
    firstName: users.firstName,
    email: users.email,
    userCreatedAt: users.createdAt,
  }).from(testerPromptEvents)
    .leftJoin(users, eq(users.id, testerPromptEvents.userId))
    .orderBy(desc(testerPromptEvents.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Scheduler: one push per prompt, the day it becomes due. 08:00 UTC
// (9am UK/IE, 10am Spain), hourly tick, once per day, startup catch-up.
// ---------------------------------------------------------------------------
const TICK_INTERVAL_MS = 60 * 60 * 1000;
const TARGET_HOUR_UTC = 8;
let started = false;
let lastRunDate: string | null = null;

export async function runTesterPromptSweep(): Promise<{ checked: number; notified: number }> {
  const tid = await getTestersCompanyId();
  const candidates = await db.select().from(users).where(
    tid !== null
      ? sql`(${users.companyId} = ${tid} OR ${users.signupSource} = 'website-test') AND coalesce(${users.isAdmin}, false) = false`
      : sql`${users.signupSource} = 'website-test' AND coalesce(${users.isAdmin}, false) = false`
  );
  let notified = 0;
  for (const u of candidates) {
    const days = daysSince(u.createdAt);
    for (const key of ["day7", "day21"] as const) {
      const def = PROMPTS[key];
      if (days < def.thresholdDays) continue;
      const ev = await eventsFor(u.id, key);
      if (ev.some(e => e.action === "notified") || !isOpen(ev)) continue;
      try {
        await notify({
          userId: u.id,
          category: "coach",
          title: def.push.title,
          body: def.push.body,
          data: { route: "/", testerPrompt: key },
          disableEmail: true,
        });
        await db.insert(testerPromptEvents).values({ userId: u.id, promptKey: key, action: "notified", answers: null });
        notified++;
      } catch (err) {
        console.error(`[tester-prompts] push failed for ${u.id} ${key}:`, err);
      }
    }
  }
  return { checked: candidates.length, notified };
}

function todayUtc() { return new Date().toISOString().slice(0, 10); }

async function tick() {
  try {
    const now = new Date();
    if (now.getUTCHours() !== TARGET_HOUR_UTC) return;
    if (lastRunDate === todayUtc()) return;
    const r = await runTesterPromptSweep();
    lastRunDate = todayUtc();
    console.log(`[tester-prompts] sweep done ${now.toISOString()}:`, r);
  } catch (err) {
    console.error("[tester-prompts] tick error:", err);
  }
}

async function catchUpIfNeeded() {
  // If it's already past the target hour today and nothing has run, run now.
  // Idempotent: 'notified' rows stop any double-send.
  const now = new Date();
  if (now.getUTCHours() > TARGET_HOUR_UTC && lastRunDate !== todayUtc()) {
    const r = await runTesterPromptSweep();
    lastRunDate = todayUtc();
    console.log(`[tester-prompts] startup catch-up:`, r);
  }
}

export function startTesterPromptScheduler() {
  if (started) return;
  started = true;
  setTimeout(() => {
    catchUpIfNeeded().catch(() => {});
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 120_000);
  console.log(`[tester-prompts] scheduler started (target=${TARGET_HOUR_UTC}:00 UTC, hourly checks, startup catch-up)`);
}
