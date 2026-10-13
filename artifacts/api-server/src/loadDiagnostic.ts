// Workforce Load Diagnostic: twelve categorical questions about the conditions
// of someone's working life (commute, shifts, travel, meetings, caring, sleep
// environment). Load, not feelings. Baseline at onboarding, then each calendar
// quarter in a 14-day window. Individual answers feed only that person's coach;
// companies see aggregates under the 10-person floor.
// Spec: claude/load-diagnostic-baseline-spec-11oct.md
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { loadDiagnosticResponses, users } from "@workspace/db";

export const LOAD_DIAGNOSTIC_VERSION = 1;
export const WINDOW_DAYS = 14;

export interface LdOption { key: string; label: string }
export interface LdQuestion { key: string; question: string; options: LdOption[] }

const opts = (pairs: [string, string][]): LdOption[] => pairs.map(([key, label]) => ({ key, label }));

export const QUESTIONS: LdQuestion[] = [
  { key: "commute_time", question: "How long is your commute, door to door, on a normal day?",
    options: opts([["none", "I work from home"], ["u20", "Under 20 minutes"], ["20_45", "20 to 45 minutes"], ["45_90", "45 to 90 minutes"], ["o90", "Over 90 minutes"]]) },
  { key: "commute_mode", question: "How do you mostly get there?",
    options: opts([["walk_cycle", "Walk or cycle"], ["public", "Train, bus or tram"], ["drive", "Drive"], ["mixed", "A mix"], ["na", "I work from home"]]) },
  { key: "work_place", question: "Where do you work most weeks?",
    options: opts([["office5", "At the workplace every day"], ["hybrid34", "Hybrid, 3 or 4 days in"], ["hybrid12", "Hybrid, 1 or 2 days in"], ["remote", "Fully remote"], ["field", "On site, on the road or in a vehicle"]]) },
  { key: "hours_pattern", question: "What are your working hours like?",
    options: opts([["fixed_day", "Fixed daytime hours"], ["evenings", "Shifts including evenings"], ["nights", "Nights"], ["rotating", "Rotating shifts"], ["irregular", "Irregular or set by me"]]) },
  { key: "on_call", question: "How often are you expected to be reachable outside your hours?",
    options: opts([["never", "Never"], ["sometimes", "Now and then"], ["weekly", "Most weeks"], ["daily", "Most days"]]) },
  { key: "travel_tz", question: "Work trips across time zones in the last three months?",
    options: opts([["none", "None"], ["1_2", "One or two"], ["3_5", "Three to five"], ["6plus", "Six or more"]]) },
  { key: "meetings", question: "Meetings or calls on a typical day?",
    options: opts([["u1", "Under an hour"], ["1_2", "One to two hours"], ["2_4", "Two to four hours"], ["o4", "Over four hours"]]) },
  { key: "lunch", question: "A proper break away from your desk at lunch, most days?",
    options: opts([["yes30", "Yes, half an hour or more"], ["short", "A short one, or at my desk"], ["rarely", "Rarely"]]) },
  { key: "caring", question: "Caring responsibilities outside work?",
    options: opts([["none", "None"], ["under5", "Children under five"], ["school", "School-age children"], ["adult", "An adult or older relative"], ["multiple", "More than one of these"]]) },
  { key: "sleep_disturbed", question: "How many nights a week is your sleep disturbed by things outside your control (children, partner's hours, noise, shifts)?",
    options: opts([["rarely", "Rarely"], ["1_2", "One or two"], ["3_4", "Three or four"], ["most", "Most nights"]]) },
  { key: "physical", question: "How physical is the job itself?",
    options: opts([["seated", "Mostly seated"], ["mixed", "A mix of sitting and moving"], ["standing", "On my feet most of the day"], ["manual", "Heavy or manual"]]) },
  { key: "after_hours_screen", question: "Work email or messages outside your hours on a normal day?",
    options: opts([["none", "None"], ["u30", "Under half an hour"], ["30_60", "Half an hour to an hour"], ["o60", "Over an hour"]]) },
];

export const INTRO_COPY = {
  title: "Your working day",
  lead: "Twelve questions about how you work: your commute, your hours, your meetings, and what pulls on your sleep at home.",
  sections: [
    {
      heading: "Why we ask",
      body: "The app measures how you are. It can't see why. A ninety-minute drive and a toddler waking at 3am need different advice from a ten-minute walk and a quiet house. These answers let your coach give advice that fits your actual days.",
    },
    {
      heading: "What happens to your answers",
      body: "They shape your coach's advice and nothing else. If you use MeridianWork through your company, it sees group patterns only: never fewer than ten people behind any figure, and never which answer was yours.",
    },
  ],
  note: "About two minutes. You can change your answers any time in Profile.",
  start: "Start",
  done: { title: "Done. Your coach now knows your days.", button: "Back to home" },
};

export const CARD_COPY = {
  baseline: {
    title: "Tell your coach about your working day",
    body: "Commute, hours, meetings, sleep at home. Twelve quick questions, so the advice fits your life and not a generic one.",
    button: "Answer now",
    later: "Not now",
  },
  quarterly: {
    title: "Has your working day changed?",
    body: "A new quarter. Two minutes to bring your answers up to date so the advice keeps fitting.",
    button: "Update",
    later: "Not now",
  },
};

export type Answers = Record<string, string>;

export function periodKeyFor(d: Date = new Date()): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}
function quarterStart(d: Date = new Date()): Date {
  const m = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), m, 1));
}

export function validate(answers: any): { ok: true; answers: Answers } | { ok: false; message: string } {
  if (!answers || typeof answers !== "object") return { ok: false, message: "Answers missing" };
  const clean: Answers = {};
  for (const q of QUESTIONS) {
    const v = answers[q.key];
    if (typeof v !== "string" || !q.options.some(o => o.key === v)) return { ok: false, message: `Answer the question: ${q.question}` };
    clean[q.key] = v;
  }
  return { ok: true, answers: clean };
}

export interface LdStatus {
  due: boolean;
  reason: "baseline" | "quarterly" | null;
  periodKey: string;
  windowEnds: string | null;
  current: Answers | null;        // answers for the current period, if any
  latest: Answers | null;         // most recent answers from any period
  latestPeriod: string | null;
}

export async function getStatus(userId: string, now = new Date()): Promise<LdStatus> {
  const rows = await db.select().from(loadDiagnosticResponses)
    .where(eq(loadDiagnosticResponses.userId, userId))
    .orderBy(sql`${loadDiagnosticResponses.completedAt} desc`);
  const periodKey = periodKeyFor(now);
  const current = rows.find(r => r.periodKey === periodKey) || null;
  const latest = rows[0] || null;
  const qs = quarterStart(now);
  const windowEnd = new Date(qs.getTime() + WINDOW_DAYS * 86400000);
  const inWindow = now < windowEnd;

  let due = false; let reason: LdStatus["reason"] = null; let windowEnds: string | null = null;
  if (rows.length === 0) { due = true; reason = "baseline"; }
  else if (!current && inWindow) { due = true; reason = "quarterly"; windowEnds = windowEnd.toISOString(); }
  return {
    due, reason, periodKey, windowEnds,
    current: (current?.answers as Answers) || null,
    latest: (latest?.answers as Answers) || null,
    latestPeriod: latest?.periodKey || null,
  };
}

export async function saveAnswers(userId: string, answers: Answers, now = new Date()): Promise<{ periodKey: string; baseline: boolean }> {
  const periodKey = periodKeyFor(now);
  const [existingAny] = await db.select({ id: loadDiagnosticResponses.id }).from(loadDiagnosticResponses).where(eq(loadDiagnosticResponses.userId, userId)).limit(1);
  const [existing] = await db.select({ id: loadDiagnosticResponses.id }).from(loadDiagnosticResponses)
    .where(and(eq(loadDiagnosticResponses.userId, userId), eq(loadDiagnosticResponses.periodKey, periodKey)));
  if (existing) {
    await db.update(loadDiagnosticResponses).set({ answers, version: LOAD_DIAGNOSTIC_VERSION, updatedAt: now }).where(eq(loadDiagnosticResponses.id, existing.id));
  } else {
    await db.insert(loadDiagnosticResponses).values({ userId, periodKey, answers, version: LOAD_DIAGNOSTIC_VERSION, completedAt: now, updatedAt: now });
  }
  return { periodKey, baseline: !existingAny };
}

// ---------------------------------------------------------------------------
// Plain-English rendering (coach context and the closing line)
// ---------------------------------------------------------------------------
function label(key: string, value: string | undefined): string | null {
  const q = QUESTIONS.find(x => x.key === key);
  const o = q?.options.find(x => x.key === value);
  return o ? o.label : null;
}

export function summariseForCoach(a: Answers, periodKey?: string | null): string {
  const L = (k: string) => label(k, a[k]);
  const lines: string[] = [];
  const commute = a.commute_time === "none" ? "Works from home" : `Commute ${(L("commute_time") || "").toLowerCase()}${a.commute_mode && a.commute_mode !== "na" ? `, ${(L("commute_mode") || "").toLowerCase()}` : ""}`;
  lines.push(`${commute}. ${L("work_place") || ""}.`);
  lines.push(`${L("hours_pattern") || ""}. Reachable out of hours: ${(L("on_call") || "").toLowerCase()}. Time-zone trips last quarter: ${(L("travel_tz") || "").toLowerCase()}.`);
  lines.push(`Meetings ${(L("meetings") || "").toLowerCase()} a day. Lunch break: ${(L("lunch") || "").toLowerCase()}.`);
  lines.push(`Caring responsibilities: ${(L("caring") || "").toLowerCase()}. Sleep disturbed by things outside their control: ${(L("sleep_disturbed") || "").toLowerCase()} nights a week.`);
  lines.push(`Job is ${(L("physical") || "").toLowerCase()}. Work messages after hours: ${(L("after_hours_screen") || "").toLowerCase()}.`);
  return `LOAD PROFILE (the user's own answers${periodKey ? `, ${periodKey}` : ""}):\n- ${lines.join("\n- ")}\nUse this to make advice specific (a long drive gets different sleep and mobility advice from a ten-minute walk; broken sleep from a toddler is not a sleep-hygiene problem). Never present these as measured data.`;
}

/** One-line closer after the questionnaire. Rule-based, no AI call. */
export function personalLine(a: Answers): string {
  const bits: string[] = [];
  if (a.commute_time === "o90" || a.commute_time === "45_90") bits.push(`a ${(label("commute_time", a.commute_time) || "").toLowerCase()} commute`);
  if (a.sleep_disturbed === "3_4" || a.sleep_disturbed === "most") bits.push(`sleep broken ${a.sleep_disturbed === "most" ? "most nights" : "three or four nights a week"}`);
  if (a.hours_pattern === "nights" || a.hours_pattern === "rotating") bits.push(`${(label("hours_pattern", a.hours_pattern) || "").toLowerCase()}`);
  if (a.meetings === "o4") bits.push("four-plus hours of meetings a day");
  if (a.on_call === "daily") bits.push("being reachable most days");
  if (a.lunch === "rarely") bits.push("rarely a real lunch break");
  if (bits.length === 0) return "Nothing here is pulling hard against you. The advice will build on that.";
  const top = bits.slice(0, 2);
  const subject = top.length === 2 ? `${top[0]} and ${top[1]}` : top[0];
  const first = subject.charAt(0).toUpperCase() + subject.slice(1);
  return `${first}: that's where the advice will start.`;
}

// ---------------------------------------------------------------------------
// Company aggregate (leadership view). Floor: 10 responders in the period.
// ---------------------------------------------------------------------------
export interface LdMarker { key: string; label: string; percent: number; pairsWith: "sleep" | "stress" | "physical" }
export interface LdAggregate {
  periodKey: string;
  state: "empty" | "thin" | "full";
  responders: number;
  requiredResponders: number;
  markers: LdMarker[];              // all markers, sorted by prevalence desc
  topDrivers: LdMarker[];           // first three
  distributions: { key: string; question: string; options: { key: string; label: string; percent: number }[] }[];
  previous?: { periodKey: string; responders: number; markers: { key: string; percent: number }[] } | null;
}

const MARKERS: { key: string; label: string; pairsWith: LdMarker["pairsWith"]; test: (a: Answers) => boolean }[] = [
  { key: "long_commute", label: "Commute over 45 minutes", pairsWith: "sleep", test: a => a.commute_time === "45_90" || a.commute_time === "o90" },
  { key: "driving_commute", label: "Driving commute over 45 minutes", pairsWith: "physical", test: a => a.commute_mode === "drive" && (a.commute_time === "45_90" || a.commute_time === "o90") },
  { key: "shift_work", label: "Shift or night work", pairsWith: "sleep", test: a => ["evenings", "nights", "rotating"].includes(a.hours_pattern) },
  { key: "on_call", label: "Reachable out of hours weekly or more", pairsWith: "stress", test: a => a.on_call === "weekly" || a.on_call === "daily" },
  { key: "tz_travel", label: "Three or more time-zone trips a quarter", pairsWith: "stress", test: a => a.travel_tz === "3_5" || a.travel_tz === "6plus" },
  { key: "meetings_heavy", label: "Over four hours of meetings a day", pairsWith: "stress", test: a => a.meetings === "o4" },
  { key: "no_lunch", label: "No real lunch break", pairsWith: "stress", test: a => a.lunch === "short" || a.lunch === "rarely" },
  { key: "caring", label: "Caring responsibilities", pairsWith: "stress", test: a => !!a.caring && a.caring !== "none" },
  { key: "sleep_disturbed", label: "Sleep disturbed three or more nights a week", pairsWith: "sleep", test: a => a.sleep_disturbed === "3_4" || a.sleep_disturbed === "most" },
  { key: "seated", label: "Mostly seated", pairsWith: "physical", test: a => a.physical === "seated" },
  { key: "after_hours_screen", label: "Work screens after hours over 30 minutes", pairsWith: "sleep", test: a => a.after_hours_screen === "30_60" || a.after_hours_screen === "o60" },
];

export const LD_FLOOR = 10;

async function responsesFor(companyId: number, periodKey: string): Promise<Answers[]> {
  const members = await db.select({ id: users.id }).from(users).where(eq(users.companyId, companyId));
  if (members.length === 0) return [];
  const rows = await db.select({ answers: loadDiagnosticResponses.answers }).from(loadDiagnosticResponses)
    .where(and(inArray(loadDiagnosticResponses.userId, members.map(m => m.id)), eq(loadDiagnosticResponses.periodKey, periodKey)));
  return rows.map(r => r.answers as Answers);
}

function pct(n: number, d: number): number { return d === 0 ? 0 : Math.round((n / d) * 100); }

function markersFor(list: Answers[]) {
  return MARKERS.map(m => ({ key: m.key, label: m.label, pairsWith: m.pairsWith, percent: pct(list.filter(m.test).length, list.length) }))
    .sort((x, y) => y.percent - x.percent);
}

function previousPeriodKey(periodKey: string): string {
  const [y, q] = periodKey.split("-Q").map(Number);
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
}

export async function aggregateForCompany(companyId: number, periodKey = periodKeyFor()): Promise<LdAggregate> {
  const list = await responsesFor(companyId, periodKey);
  const n = list.length;
  const state: LdAggregate["state"] = n < LD_FLOOR ? "empty" : n < 20 ? "thin" : "full";
  if (state === "empty") {
    return { periodKey, state, responders: n, requiredResponders: LD_FLOOR, markers: [], topDrivers: [], distributions: [], previous: null };
  }
  const markers = markersFor(list);
  const distributions = QUESTIONS.map(q => ({
    key: q.key, question: q.question,
    options: q.options.map(o => ({ key: o.key, label: o.label, percent: pct(list.filter(a => a[q.key] === o.key).length, n) })),
  }));
  const prevKey = previousPeriodKey(periodKey);
  const prevList = await responsesFor(companyId, prevKey);
  const previous = prevList.length >= LD_FLOOR
    ? { periodKey: prevKey, responders: prevList.length, markers: markersFor(prevList).map(m => ({ key: m.key, percent: m.percent })) }
    : null;
  return { periodKey, state, responders: n, requiredResponders: LD_FLOOR, markers, topDrivers: markers.slice(0, 3), distributions, previous };
}
