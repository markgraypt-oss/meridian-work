import { z } from 'zod';
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@workspace/db";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getUserDataContext, getFeatureConfig } from "../aiProvider";
import { getTopMemoriesText } from "./memory";
import { COACH_VOICE } from "./coachPersona";
import { notify } from "../notifications";

// Phrases that drift toward medical advice. We replace them with neutral
// coaching language as a defence-in-depth pass on top of the system-prompt
// rules, since the prompt alone can be ignored by some models.
const MEDICAL_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\byou (?:have|are suffering from|likely have|probably have)\s+(?:an?\s+)?(?:injury|condition|disorder|disease|syndrome)\b/gi, replace: "you may want to check in with a clinician" },
  { re: /\b(?:diagnos(?:e|is|ed))\b/gi, replace: "discuss with a clinician" },
  { re: /\b(?:i (?:would )?prescribe|prescribed|prescription)\b/gi, replace: "i would suggest" },
  { re: /\b(?:take|increase|decrease|stop) (?:your )?(?:medication|dosage|dose)\b/gi, replace: "speak with your prescriber about your medication" },
  { re: /\bmedical advice\b/gi, replace: "general guidance" },
];

function clampMedical(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, replace } of MEDICAL_PATTERNS) out = out.replace(re, replace);
  return out;
}

function sanitizeBriefingContent(c: BriefingContent): BriefingContent {
  const clampStr = (s: string | null | undefined) => (s ? clampMedical(s) : s ?? null);
  return {
    // New rich shape
    opener: clampStr(c.opener) || undefined,
    deepDive: c.deepDive?.map((s) => ({
      title: clampMedical(s.title),
      body: clampMedical(s.body),
    })),
    recommendations: c.recommendations?.map((r) => ({
      title: clampMedical(r.title),
      body: clampMedical(r.body),
    })),
    closingQuestion: clampStr(c.closingQuestion) || undefined,
    suggestedReplies: c.suggestedReplies?.map((s) => clampMedical(s)),
    // Legacy short shape (kept for backwards compatibility with existing rows)
    headline: c.headline ? clampMedical(c.headline) : c.headline,
    body: c.body ? clampMedical(c.body) : c.body,
    nudge: c.nudge ? clampMedical(c.nudge) : c.nudge ?? null,
  };
}

const briefingSchema = z.object({
  // New rich shape — preferred
  opener: z.string().max(400).optional().nullable(),
  deepDive: z.array(z.object({
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(400),
  })).max(4).optional(),
  recommendations: z.array(z.object({
    title: z.string().min(1).max(60),
    body: z.string().min(1).max(300),
  })).max(3).optional(),
  closingQuestion: z.string().max(280).optional().nullable(),
  suggestedReplies: z.array(z.string().max(80)).max(4).optional(),
  // Legacy short shape — kept so older rows still validate and render
  headline: z.string().max(120).optional(),
  body: z.string().max(240).optional(),
  nudge: z.string().max(140).optional().nullable(),
}).refine(
  (c) => Boolean(c.opener) || Boolean(c.headline),
  { message: "briefing must include either an opener (new shape) or a headline (legacy shape)" },
);

// The AI-generated shape validated by briefingSchema, plus proactive
// recommendation cards attached deterministically AFTER generation (they are
// not model output). Stored in the same jsonb content blob and rendered as
// tappable cards on the briefing panel.
export type BriefingContent = z.infer<typeof briefingSchema> & {
  recommendationCards?: import("./recommendationDomains").ResolvedRec[];
};

export type BriefingType = "morning" | "evening";

export function todayKeyForUser(tz?: string | null, date: Date = new Date()): string {
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return fmt.format(date);
    } catch {
      // fall through
    }
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


// Per-process locks to prevent duplicate generation when the dashboard fires
// multiple simultaneous requests on first load.
const inflight = new Map<string, Promise<any>>();

// Flatten a briefing's rich content into the plain-text body used as the
// first assistant message of its saved conversation. Mirrors the assembly in
// the POST /api/coach/briefing/:id/read route so history text is identical
// whether the conversation is created at generation time or on read.
export function buildBriefingConversationText(content: any): string {
  const c = (content || {}) as any;
  const parts: string[] = [];
  if (c.opener) parts.push(String(c.opener).trim());
  if (Array.isArray(c.deepDive)) for (const d of c.deepDive) {
    if (d?.title || d?.body) parts.push(`${d.title ? d.title + "\n" : ""}${d.body || ""}`.trim());
  }
  if (Array.isArray(c.recommendations)) for (const r of c.recommendations) {
    if (r?.title || r?.body) parts.push(`${r.title ? r.title + "\n" : ""}${r.body || ""}`.trim());
  }
  if (c.closingQuestion) parts.push(String(c.closingQuestion).trim());
  return parts.filter(Boolean).join("\n\n");
}

export function buildBriefingConversationTitle(row: any): string {
  const dateLabel = new Date(((row?.briefingDate as string) || "") + "T12:00:00")
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const typeLabel = row?.type === "evening" ? "Evening briefing" : "Morning briefing";
  return `${typeLabel}, ${dateLabel}`.slice(0, 60);
}

// Ensure a briefing has a saved conversation so it appears in coach history
// the moment it is generated - independent of whether/when the client opens
// the drawer and fires the read endpoint. Idempotent: returns the existing
// conversationId if one is already linked, and never creates a second row.
export async function ensureBriefingConversation(
  userId: string,
  row: any,
): Promise<number | null> {
  if (!row) return null;
  if (row.conversationId) return row.conversationId;
  const content = buildBriefingConversationText(row.content);
  if (!content) return null;
  const title = buildBriefingConversationTitle(row);
  const conversation = await storage.createCoachConversation(userId, title, [
    { role: "assistant", content },
  ]);
  await storage.linkCoachBriefingConversation(row.id, userId, conversation.id);
  row.conversationId = conversation.id;
  return conversation.id;
}

export async function getOrGenerateBriefing(
  userId: string,
  type: BriefingType,
  date: Date = new Date(),
) {
  // Look up the user's timezone once at the top so all date-key calls inside
  // this function agree on the user's local "today".
  const userRow = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  const userTz = userRow[0]?.timezone ?? null;
  const dateKey = todayKeyForUser(userTz, date);
  const existing = await storage.getCoachBriefingForDay(userId, dateKey, type);

  // HOLD: with WHOOP/Oura connected, the briefing is not generated until that
  // provider's physio data for today has been imported — Apple/Google numbers
  // must never appear in coach copy as stand-ins. The briefing endpoint
  // already returns 204 for "no briefing yet" (same as the pre-check-in
  // wait), so the app shows its normal waiting state. The mobile piggyback
  // sync + hourly scheduler keep this window short.
  {
    const { getOauthPhysioHold } = await import("../wearables");
    const gate = await getOauthPhysioHold(userId, dateKey);
    if (gate.hold) {
      console.log(`[coach-briefing] holding ${type} ${dateKey} for ${userId}: waiting for ${gate.provider} sync`);
      return existing && (existing as any).source !== "fallback" ? existing : null;
    }
    // gate.degraded: generate anyway — buildReadinessAndBaselineText injects a
    // prompt note so the coach reminds the user to reconnect the wearable.
  }

  // Drift contract: a stored briefing is only served if every input it is
  // ALLOWED TO QUOTE still matches the current data. If a quotable number has
  // changed (e.g. Apple Health backfilled yesterday's steps) we regenerate so
  // the copy never disagrees with the wearable source ("13,289 steps" while
  // the ring shows 13,307).
  //
  // SCOPED TO QUOTABLE FIELDS (13 Aug 2026): the MORNING briefing is
  // explicitly forbidden from referencing today's steps / active minutes /
  // calories (see intentMorning), but today's row was still part of the drift
  // comparison — and today's activity numbers climb continuously, so nearly
  // every briefing view after a sync regenerated the morning briefing for
  // numbers its copy cannot mention. With 3 real users this multiplied
  // coach_briefing from the expected ~42 calls/week to 142 (AI activity log).
  // HealthKit background delivery (same-day change) makes today's row change
  // hourly, so the waste would only have grown. Morning now ignores TODAY'S
  // activity fields; overnight fields (sleep, HRV, RHR, readiness) and all
  // prior days stay strict. Evening quotes today's activity, so it stays
  // fully strict. Do NOT loosen the remaining comparisons.
  if (existing && (existing as any).source !== "fallback") {
    const stored = existing.contextSnapshot as BriefingContextSnapshot | null;
    const fresh = await buildContextSnapshot(userId);
    // Regenerate when ANY user-visible input the briefing quotes has changed —
    // not just the wearable snapshot. The Daily Readiness Score and the day's
    // check-in are quoted in the copy but come from separate sources, so they
    // must be part of the drift trigger too; otherwise the text silently lags
    // (e.g. coach says readiness 48 while the ring shows 59 after a check-in).
    const ignoreActivityOnDate = type === "morning" ? dateKey : null;
    if (
      wearableSnapshotsEqual(stored?.wearable, fresh?.wearable, ignoreActivityOnDate) &&
      (stored?.readinessScore ?? null) === (fresh?.readinessScore ?? null) &&
      checkInSnapshotsEqual(stored?.lastCheckIn, fresh?.lastCheckIn)
    ) {
      return existing;
    }
    // Fall through to regeneration. The lock below covers concurrent
    // dashboard requests so we only regenerate once.
  }

  const lockKey = `${userId}:${dateKey}:${type}`;
  if (inflight.has(lockKey)) return inflight.get(lockKey)!;

  const work = (async () => {
    try {
      return await generateAndStoreBriefing(userId, type, dateKey, !!existing, userTz);
    } finally {
      inflight.delete(lockKey);
    }
  })();
  inflight.set(lockKey, work);
  return work;
}

async function buildWeatherText(lat: number | null | undefined, lng: number | null | undefined): Promise<string> {
  if (lat == null || lng == null) return "";
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&current=temperature_2m,relative_humidity_2m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,uv_index_max,weather_code&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const data: any = await res.json();
    const cur = data?.current;
    const daily = data?.daily;
    if (!cur || !daily) return "";
    const code = Number(cur.weather_code);
    const codeMap: Record<number, string> = {
      0: "clear skies",
      1: "mostly clear",
      2: "partly cloudy",
      3: "overcast",
      45: "fog",
      48: "freezing fog",
      51: "light drizzle",
      53: "drizzle",
      55: "heavy drizzle",
      61: "light rain",
      63: "rain",
      65: "heavy rain",
      71: "light snow",
      73: "snow",
      75: "heavy snow",
      77: "snow grains",
      80: "light showers",
      81: "showers",
      82: "heavy showers",
      85: "snow showers",
      86: "heavy snow showers",
      95: "thunderstorm",
      96: "thunderstorm with hail",
      99: "thunderstorm with heavy hail",
    };
    const conditions = codeMap[code] || "mixed conditions";
    const tMin = Math.round(Number(daily.temperature_2m_min?.[0] ?? cur.temperature_2m));
    const tMax = Math.round(Number(daily.temperature_2m_max?.[0] ?? cur.temperature_2m));
    const uv = Math.round(Number(daily.uv_index_max?.[0] ?? cur.uv_index ?? 0));
    const humidity = Math.round(Number(cur.relative_humidity_2m ?? 0));
    const uvNote =
      uv >= 8 ? "very high UV, time outdoor sessions for early morning or late afternoon" :
      uv >= 6 ? "high UV, consider timing outdoor sessions outside peak sun" :
      uv >= 3 ? "moderate UV" :
      "low UV";
    return `\nTODAY'S WEATHER (context only, NOT for the opener. Use ONLY to shape a movement suggestion when relevant, see INTENT. Never invent if absent):\n- Range: ${tMin}-${tMax}\u00B0C, ${conditions}, humidity ${humidity}%\n- UV index: ${uv} (${uvNote})`;
  } catch {
    return "";
  }
}

async function buildCycleContextText(userId: string): Promise<string> {
  try {
    const { db: cDb } = await import("../db");
    const { cycleSettings: cSettings, cycleLogs: cLogs } = await import("@workspace/db");
    const { eq: cEq, desc: cDesc } = await import("drizzle-orm");

    const [settings] = await cDb.select().from(cSettings)
      .where(cEq(cSettings.userId, userId)).limit(1);
    if (!settings?.enabled) return "";

    const [latestLog] = await cDb.select().from(cLogs)
      .where(cEq(cLogs.userId, userId))
      .orderBy(cDesc(cLogs.periodStart)).limit(1);
    if (!latestLog) return "";

    const { computeCyclePhase } = await import("../cyclePhase");
    const phase = computeCyclePhase(
      new Date((latestLog.periodStart as string) + "T00:00:00"),
      settings.avgCycleLength,
      settings.avgPeriodLength
    );

    const phaseDescriptions: Record<string, string> = {
      menstrual:   "Menstrual phase (days 1-5). Energy typically lower. Rest and gentle movement most appropriate.",
      follicular:  "Follicular phase (post-period). Energy rising. Good window for challenge and higher intensity.",
      ovulatory:   "Ovulatory phase (mid-cycle peak). Peak energy and strength. Body tolerates high intensity well.",
      luteal:      "Luteal phase (post-ovulation). Progesterone rising. Energy more variable. Consistency over intensity.",
      late_luteal: "Late luteal phase (final days before period). Body approaching next cycle. Prioritise recovery and lower-intensity movement.",
    };

    const symptoms = Array.isArray(latestLog.symptoms) && latestLog.symptoms.length
      ? `\n- Recently logged symptoms: ${latestLog.symptoms.join(", ")}` : "";
    const notes = latestLog.notes
      ? `\n- User notes: "${latestLog.notes}"` : "";
    const flow = latestLog.flow
      ? `\n- Flow: ${latestLog.flow}` : "";

    return `\nCYCLE TRACKER DATA (use to contextualise recovery, energy expectations, and training recommendations. Never make it the headline. Never ask about it in the closing question. Treat as supporting physiological context only):
- Current phase: ${phase.phase} — cycle day ${phase.cycleDay} of ${settings.avgCycleLength}
- Phase context: ${phaseDescriptions[phase.phase] || ""}
- Days until next period: ${phase.daysUntilNextPeriod > 0 ? phase.daysUntilNextPeriod : "due"}${flow}${symptoms}${notes}`;
  } catch {
    return "";
  }
}

// Read today's Daily Readiness score the SAME way the dashboard ring does:
// recompute-then-read. The ring endpoint (/api/daily-readiness/today) always
// calls computeAndStoreForUserDay before reading, so it reflects the latest
// inputs. The briefing must use the identical path or it quotes a stale saved
// score (e.g. briefing says 62 while the ring shows 68 after a check-in or a
// late wearable sync). computeAndStoreForUserDay is a no-op when today's row
// is locked and holds (returns null score) while WHOOP/Oura data is pending,
// so this stays consistent with the ring in every state.
async function readFreshReadiness(userId: string) {
  const { computeAndStoreForUserDay, getTodayForUser, todayKey } = await import("../dailyReadiness");
  try {
    const [tzRow] = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    await computeAndStoreForUserDay(userId, todayKey(tzRow?.timezone ?? null));
  } catch (e) {
    console.error("[coach-briefing] readiness recompute failed:", e);
  }
  return getTodayForUser(userId);
}

async function buildReadinessAndBaselineText(userId: string, dateKey: string): Promise<string> {
  try {
    const [dr, baselines] = await Promise.all([
      readFreshReadiness(userId).catch(() => null),
      storage.getUserPhysiologicalBaselines(userId).catch(() => undefined),
    ]);

    const lines: string[] = [];
    lines.push("\nTODAY'S READINESS:");
    if (dr && dr.score != null) {
      lines.push(`- Daily Readiness Score: ${dr.score}/100 (based on ${dr.daysOfHistory} days of history)`);
      if (dr.inputs) {
        const ip = dr.inputs as any;
        // These are INTERNAL diagnostic sub-scores on an arbitrary scale. They
        // exist only to tell the model WHICH factor is dragging readiness up or
        // down. They are NOT user-facing numbers and must never be quoted. The
        // prompt has a hard rule forbidding their appearance in any output.
        lines.push("- INTERNAL readiness driver scores (DO NOT quote these numbers or the word 'contribution' to the user. Use them ONLY to decide which factor to talk about, then describe it in plain words. Higher = that factor is helping recovery, lower = it is hurting it):");
        if (ip.sleep != null) lines.push(`  - sleep driver: ${ip.sleep}`);
        if (ip.energy != null) lines.push(`  - energy driver: ${ip.energy}`);
        if (ip.trainingLoad != null) lines.push(`  - recent training load driver: ${ip.trainingLoad}`);
        if (ip.hrv != null) lines.push(`  - HRV driver: ${ip.hrv}`);
        if (ip.rhr != null) lines.push(`  - resting HR driver: ${ip.rhr}`);
      }
    } else if (dr && dr.daysOfHistory < 14) {
      lines.push(`- Daily Readiness Score: not yet available (building baseline, ${dr.daysOfHistory}/14 days collected)`);
    } else {
      lines.push("- Daily Readiness Score: not available today");
    }

    if (baselines) {
      const b = baselines as any;
      lines.push("\nUSER PHYSIOLOGICAL BASELINES (30-day medians, used to detect today's extremes):");
      if (b.hrvMedian != null) lines.push(`- HRV baseline: ${b.hrvMedian}ms (stddev ${b.hrvStddev ?? "?"}ms)`);
      if (b.rhrMedian != null) lines.push(`- Resting HR baseline: ${b.rhrMedian}bpm (stddev ${b.rhrStddev ?? "?"}bpm)`);
      if (b.sleepMinutesMedian != null) lines.push(`- Sleep baseline: ${b.sleepMinutesMedian} minutes (stddev ${b.sleepMinutesStddev ?? "?"} min)`);
      lines.push("RULES FOR EXTREMES: today's HRV more than 1 stddev BELOW baseline = suppressed recovery. Today's HRV well ABOVE baseline = strong recovery. Today's RHR more than 1 stddev ABOVE baseline = elevated, recovery cost. Sleep below 6h = short sleep. Sleep above 9h = unusually long sleep, possibly recovery debt or illness.");
    } else {
      lines.push("\n(No physiological baselines yet — user is still in the first 30 days, so do not compare to baseline. Just describe today's numbers plainly.)");
    }

    // Degraded-wearable note: connection broken 48h+, physio unavailable.
    try {
      const { getOauthPhysioHold, PROVIDER_LABELS } = await import("../wearables");
      const gate = await getOauthPhysioHold(userId, dateKey);
      if (gate.degraded && gate.provider) {
        const label = (PROVIDER_LABELS as any)[gate.provider] || gate.provider;
        lines.push(`\n- IMPORTANT: The user's ${label} has been disconnected for over 48 hours and is sending no data. Sleep, HRV and resting HR are unavailable (never substituted from another source); today's readiness runs on check-ins and activity only. Gently but clearly remind the user to reconnect ${label} in Wearables & Integrations to restore full readiness accuracy. Do not guess or invent physiological values.`);
      }
    } catch {}

    return lines.join("\n");
  } catch {
    return "";
  }
}

async function buildRecentBriefingsText(userId: string): Promise<string> {
  try {
    const recent = await storage.listCoachBriefings(userId, 5);
    if (!recent.length) return "";
    const lines = recent.map((b) => {
      const c = (b.content as BriefingContent | null) || null;
      // Rich shape: summarise via the deepDive section titles. Legacy shape:
      // fall back to the headline. This is just a "don't repeat yourself"
      // hint to the model so the gist is enough.
      const richSummary = c?.deepDive?.slice(0, 3).map((s) => s.title).join("; ") || "";
      const summary = richSummary || c?.headline || "";
      return `- ${b.briefingDate} ${b.type}: ${summary}`;
    });
    return `\nRECENT BRIEFINGS (most recent first, vary the angles you choose so you don't repeat yourself):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// Every wearable field that can be surfaced in the briefing prompt (see
// server/aiProvider.ts sleep/steps/resting_hr sections) must be captured
// here. If a new wearable field is ever piped into the briefing context,
// add it here too - otherwise drift in that field will not trigger
// regeneration and the briefing copy will silently lag the wearable.
interface WearableDaySnapshot {
  date: string;
  provider: string;
  steps: number | null;
  sleepMinutes: number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes: number | null;
  sleepScore: number | null;
  activeMinutes: number | null;
  caloriesBurned: number | null;
  restingHrBpm: number | null;
  hrvMs: number | null;
  readinessScore: number | null;
}

interface BriefingContextSnapshot {
  // App-computed Daily Readiness Score (0-100), quoted in the briefing copy.
  // Part of the drift trigger so a score change (e.g. after a check-in)
  // regenerates the briefing instead of leaving copy that disagrees with the
  // Daily Readiness ring on the dashboard.
  readinessScore?: number | null;
  lastCheckIn?: {
    date: Date | string | null;
    mood: number | null;
    energy: number | null;
    stress: number | null;
    sleep: number | null;
    clarity: number | null;
  };
  burnout?: {
    score: number | null;
    trajectory: string | null;
    date: Date | string | null;
  };
  // Wearable metrics the briefing was generated from. Used to detect drift:
  // if any value here differs from the current wearable snapshot when the
  // briefing is re-requested, we regenerate so the user-visible numbers
  // (steps, sleep, HR, etc.) always match the underlying wearable source
  // exactly. Do not relax this - drift between briefing copy and the
  // wearable data is the bug this guards against.
  wearable?: WearableDaySnapshot[];
}

async function buildWearableSnapshot(userId: string): Promise<WearableDaySnapshot[]> {
  try {
    const { getMergedDailyMetrics } = await import("../wearables");
    const merged = await getMergedDailyMetrics(userId, 14);
    return merged
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({
        date: r.date,
        // Per-metric merge: a day can mix sources. Label with the sleep/HRV
        // source (the physiological provider these snapshots are about),
        // falling back to the steps source, then any source present.
        provider: r._sources.sleepMinutes || r._sources.hrvMs || r._sources.steps || r.provider,
        steps: r.steps ?? null,
        sleepMinutes: r.sleepMinutes ?? null,
        sleepDeepMinutes: r.sleepDeepMinutes != null ? Math.round(r.sleepDeepMinutes) : null,
        sleepRemMinutes: r.sleepRemMinutes != null ? Math.round(r.sleepRemMinutes) : null,
        sleepScore: r.sleepScore ?? null,
        activeMinutes: r.activeMinutes ?? null,
        caloriesBurned: r.caloriesBurned ?? null,
        restingHrBpm: r.restingHrBpm ?? null,
        hrvMs: r.hrvMs != null ? Math.round(r.hrvMs) : null,
        readinessScore: r.readinessScore ?? null,
      }));
  } catch (e) {
    console.error("[coach-briefing] wearable snapshot failed:", e);
    return [];
  }
}

/**
 * Compare two wearable snapshots on their QUOTABLE fields.
 *
 * ignoreActivityOnDate: for the MORNING briefing, pass today's dateKey —
 * today's steps / activeMinutes / caloriesBurned climb continuously all day
 * and the morning copy is forbidden from quoting them, so they are excluded
 * from today's row comparison (overnight fields — sleep, HRV, RHR, sleep
 * score, provider readiness — remain strict, as do ALL fields of every prior
 * day, whose numbers the copy may quote and which only change on genuine
 * backfills). Pass null for the evening briefing: it quotes today's activity,
 * so every field stays strict.
 */
function wearableSnapshotsEqual(
  a: WearableDaySnapshot[] | undefined | null,
  b: WearableDaySnapshot[] | undefined | null,
  ignoreActivityOnDate: string | null = null,
): boolean {
  const aa = a || [];
  const bb = b || [];
  if (aa.length !== bb.length) return false;
  const key = (d: WearableDaySnapshot) => {
    const ignoreActivity = ignoreActivityOnDate !== null && d.date === ignoreActivityOnDate;
    return [
      d.date, d.provider,
      ignoreActivity ? "-" : d.steps,
      d.sleepMinutes, d.sleepDeepMinutes, d.sleepRemMinutes, d.sleepScore,
      ignoreActivity ? "-" : d.activeMinutes,
      ignoreActivity ? "-" : d.caloriesBurned,
      d.restingHrBpm, d.hrvMs, d.readinessScore,
    ].join("|");
  };
  const sa = aa.map(key).sort();
  const sb = bb.map(key).sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

function checkInSnapshotsEqual(
  a: BriefingContextSnapshot["lastCheckIn"] | undefined | null,
  b: BriefingContextSnapshot["lastCheckIn"] | undefined | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const key = (c: NonNullable<BriefingContextSnapshot["lastCheckIn"]>) =>
    [c.date ? new Date(c.date).getTime() : "null", c.mood, c.energy, c.stress, c.sleep, c.clarity].join("|");
  return key(a) === key(b);
}

async function buildContextSnapshot(userId: string): Promise<BriefingContextSnapshot | null> {
  // Snapshot of inputs used to generate the briefing. The `wearable` field
  // is also the drift-detection source of truth - see wearableSnapshotsEqual.
  const snap: BriefingContextSnapshot = {};
  snap.wearable = await buildWearableSnapshot(userId);
  try {
    const dr = await readFreshReadiness(userId);
    snap.readinessScore = dr?.score ?? null;
  } catch (e) {
    console.error("[coach-briefing] readiness snapshot failed:", e);
  }
  try {
    const checkIns = await storage.getUserCheckIns(userId, 1);
    const c = checkIns?.[0];
    if (c) {
      snap.lastCheckIn = {
        date: c.checkInDate ?? c.createdAt ?? null,
        mood: c.moodScore ?? null,
        energy: c.energyScore ?? null,
        stress: c.stressScore ?? null,
        sleep: c.sleepScore ?? null,
        clarity: c.clarityScore ?? null,
      };
    }
  } catch (e) {
    console.error("[coach-briefing] checkin snapshot failed:", e);
  }
  try {
    const burnout = await storage.getBurnoutScore(userId);
    if (burnout) {
      snap.burnout = {
        score: burnout.score ?? null,
        trajectory: burnout.trajectory ?? null,
        date: burnout.computedDate ?? null,
      };
    }
  } catch (e) {
    console.error("[coach-briefing] burnout snapshot failed:", e);
  }
  return Object.keys(snap).length ? snap : null;
}

async function generateAndStoreBriefing(
  userId: string,
  type: BriefingType,
  dateKey: string,
  forceRegenerate = false,
  userTz: string | null = null,
) {
  // Re-check after acquiring the lock to avoid a race. Skip legacy fallback
  // rows so they get replaced on a successful generation. When forceRegenerate
  // is true (drift detected by getOrGenerateBriefing) we bypass this short
  // circuit and always rebuild from fresh data.
  const existing = await storage.getCoachBriefingForDay(userId, dateKey, type);
  if (!forceRegenerate && existing && (existing as any).source !== "fallback") return existing;

  const user = await storage.getUser(userId);
  const userName = user?.firstName?.trim() || "there";

  let content: BriefingContent | null = null;
  const source: "ai" = "ai";
  const contextSnapshot = await buildContextSnapshot(userId);

  try {
    const config = await getFeatureConfig("recovery_coach");
    if (!config) {
      console.error(
        `[coach-briefing] no recovery_coach feature config for user ${userId} (${type}). Skipping; scheduler will retry.`,
      );
      return null;
    } else {
      const dataContext = await getUserDataContext(userId, "coach_briefing");
      const memoryText = await getTopMemoriesText(userId, 8);
      const recentText = await buildRecentBriefingsText(userId);
      const readinessText = await buildReadinessAndBaselineText(userId, dateKey);
      // Weather context. lat/lng column is added in a later phase. Until then this
      // stays a no-op and the prompt simply has no weather block to reference.
      const userLat = (user as any)?.lastLat ?? null;
      const userLng = (user as any)?.lastLng ?? null;
      const weatherText = await buildWeatherText(userLat, userLng);
      const cycleText = await buildCycleContextText(userId);

      const intentMorning = `A MORNING READINESS PREVIEW. The day has not happened yet, so do NOT reference today's steps, today's active minutes, or any activity that would only exist after the user has lived the day. The ONLY today-data you may reference in the morning is OVERNIGHT data: last night's sleep, this morning's HRV, this morning's resting HR, and today's Daily Readiness Score if available, plus today's weather if provided.

YOUR JOB IN THE MORNING:
1. Read the readiness score and overnight metrics vs the user's baseline.
2. Look at whether a workout is scheduled today (in the USER HEALTH DATA CONTEXT below).
3. Produce a readiness verdict that links the body's state to the day ahead.

THE FOUR VERDICTS (pick the one that fits, do not name the colour):
- GREEN (good sleep + HRV at/above baseline + RHR at/below baseline + good check-in if any, plus workout planned): tell the user the body looks primed and today's planned session is well-timed. Use language like "go after it", "good day to push", "your body's ready for it".
- YELLOW (one or two markers off, workout planned): tell the user recovery is mixed. The session is still doable but they may find it heavier than usual. Suggest listening to the body in the warm-up.
- RED (multiple markers suppressed, workout planned): tell the user the body is asking for less. Suggest considering an easier session, scaling back intensity, or moving the workout to tomorrow. Never order them to skip.
- REST DAY (no workout planned today): describe how recovery looks and suggest the kind of day that fits (active recovery, mobility, prioritising sleep).

If there is no readiness score yet (building baseline), give a softer snapshot of overnight metrics and link to the planned workout if any, without making a strong verdict.

WEATHER USAGE: Weather is supporting context only, never the headline and never the opener. Only bring weather into a movement recommendation: on a day with no scheduled workout, suggest an outdoor walk, run or cardio if conditions are good, or an indoor or treadmill option to keep steps up if it is cold or wet. High UV can adjust the timing of an outdoor session, nothing more.`;

      const intentEvening = `AN EVENING DAY REVIEW. The day has now happened. Reference today's actual data: steps, active minutes, workouts completed, hydration, check-in if logged. Do NOT preview tomorrow as the main focus, this is a review of today.

YOUR JOB IN THE EVENING:
1. Read what actually happened today: did they hit good output, did they complete a planned workout, how does the check-in read.
2. Look at this evening's recovery markers (HRV, RHR if available) vs baseline to see how the body responded to the day.
3. Produce a one-line verdict on the day's output, then a body that captures what happened and what stood out.

THE EVENING VERDICTS (pick the one that fits, do not name the label):
- BIG DAY (high steps, completed workout, good check-in): celebrate the output briefly, then flag the recovery cost if HRV/RHR show it, and invite a recovery-focused wind-down.
- STEADY DAY (moderate output, consistent with their norm): observe the consistency, name one thing that stood out positively or one signal worth watching.
- QUIET DAY (low output, no workout, low energy on check-in): observe it without judgement. If the body needed it (recovery markers were suppressed this morning), validate that. If not, gently note tomorrow as a fresh start.
- MIXED DAY (workout completed but check-in poor, or high steps but suppressed HRV): name the tension. The body did the work but is showing a cost, or vice versa.

If a workout was scheduled but not completed, do NOT scold. Acknowledge neutrally if relevant and move on.`;

      const intent = type === "morning" ? intentMorning : intentEvening;
      // Compute today's day name (Monday, Tuesday, etc) so the model never
      // has to guess which day of the week dateKey corresponds to. This
      // fixes cases where the opener said "that's a wrap on Saturday" when
      // today was actually Sunday.
      const dayName = new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

      const prompt = `${COACH_VOICE}

The briefing below is you, Mark, speaking to ${userName}. Write it in your voice. Produce a rich ${type} briefing as JSON only.

OUTPUT JSON SHAPE (strict):
{
  "opener": string (greeting + light context. Morning: friendly greeting addressing ${userName} by name, then lead with the overnight readiness signal (sleep, HRV, resting HR, or readiness score). Optional one-line nod to yesterday or recent context. Do NOT lead with or centre the weather. Weather never belongs in the opener. Evening: friendly greeting addressing ${userName} by name, one-line frame for the day just lived. Max 400 chars. 2-4 short sentences max. No emojis.),
  "deepDive": [
    { "title": string (4-8 words, e.g. "Nervous system is primed", "Load is high even on rest"), "body": string (1-3 short sentences interpreting one specific aspect of the data, max 400 chars) }
  ] (2-3 items, each on a DIFFERENT aspect of the body's state. Morning aspects to choose from: recovery/nervous system, load history, healthspan trend, sleep quality, baseline deviation. Evening aspects to choose from: output level, recovery cost, check-in alignment, sleep debt, trend signal.),
  "recommendations": [
    { "title": string (e.g. the scheduled workout name, or "Active recovery", "Mobility session"), "body": string (1-2 sentences on WHY this fits today's recovery state. Tie it explicitly to the verdict from deepDive. Max 300 chars.) }
  ] (Morning: if a workout is scheduled today in USER HEALTH DATA CONTEXT, it MUST appear here, framed against the recovery verdict. This is required, never omit a scheduled workout. If NO workout is scheduled today, you MUST instead recommend movement that fits the day: active recovery or mobility, an outdoor walk, run or cardio if the weather is good, or an indoor or treadmill option to keep step count up if it is cold or wet. Morning recommendations are never empty. Evening: usually empty or a single wind-down suggestion. NEVER invent workouts that are not in the user's scheduled data.),
  "closingQuestion": string (one open question that invites the user to chat with the coach. Should connect to the day's most interesting signal. Max 280 chars. Examples: "How recovered do your legs actually feel today on a 1-10 scale, and what kind of session are you most excited for?", "How did today's run feel compared to last week's?", "Anything you'd like to dig into about today's recovery numbers?"),
  "suggestedReplies": [string] (2-3 short tappable replies, each max 80 chars, that the user might plausibly send in response to the closingQuestion. They should be concrete and varied, like Whoop's reply chips. Examples: "Legs feel around 7, excited to run", "Tired today, prefer strength", "Tell me more about my recovery").
}

WHAT THIS IS:
- A rich coach briefing in the style of Whoop's morning/evening briefings. Multi-section, conversational, data-grounded.
- Designed to open the door to the AI coach. The user can ask follow-up questions if they want detail.
- ALWAYS suggestion, feedback, advice. NEVER directions or instructions. Do not tell the user what to do. Offer a perspective and an option.

WHAT THIS IS NOT:
- A to-do list. Do not give multi-step instructions.
- A nutrition plan. Do not prescribe protein grams, calorie targets, meal times, or photo-logging routines.
- A guilt trip. Do not flag what the user hasn't logged. Do not call out streaks of missed entries.
- A medical assessment. Never diagnose.

ABSOLUTELY FORBIDDEN (THIS IS THE MOST IMPORTANT RULE):
- Do NOT mention food logging, meal logging, calorie tracking, nutrition tracking, food entries, eating, meals, protein, calories, carbs, fats, fibre, hydration tracking, water logging, or any tracking gap of any kind. Not anywhere. Pretend you cannot see any food or nutrition data at all. If you are tempted to write anything that mentions food, eating, logging, or tracking, write a different thing about something else entirely (sleep, recovery, movement, mood, breathwork, the user's mentioned context). Violating this rule means the entire briefing fails its purpose.
- Do NOT mention what the user "hasn't" done. No "you haven't", no "still no", no "missed", no "gap". Only describe what IS there.

RULES:
- TODAY is ${dayName}, ${dateKey}. YESTERDAY was the calendar day before TODAY. The wearable snapshot below has one row per date. The row whose "date" equals TODAY is today's data, which may be partial in the morning. The row immediately before TODAY is YESTERDAY. NEVER call today's partial numbers "yesterday". NEVER call yesterday's numbers "today".
- Reference the user's actual numbers when they appear. Quote durations exactly (e.g. "7h 19m", "14,873 steps"). Never convert sleep to decimal hours.
- Check-in scores (mood, energy, stress, clarity, and the check-in sleep score) are on a 1-5 scale. ALWAYS reference them with the "/5" suffix to make the scale unambiguous. Examples: "stress is averaging 2.1/5", "your mood was 3/5 yesterday", "clarity dropped to 2.4/5 this week". Apply to averages, single values, and ranges. Do NOT add "/5" to wearable metrics with their own scales: HRV in ms, VO2 Max in ml/kg/min, Whoop strain on 0-21, Whoop recovery as a percentage, RHR in bpm, sleep duration in hours and minutes, steps as raw numbers. Body map severity stays "x/10". Daily Readiness Score stays "x/100".
- If data is missing, do not pretend you have it. Do not invent.
- No em dashes anywhere. Use commas, full stops, or rephrase.
- No bullet characters inside body strings. The structure of the JSON IS the structure. Don't put dashes or bullets inside body text.
- PLAIN LANGUAGE, NO INTERNAL JARGON. Never use the word "contribution", "driver", "input", "score" (except the Daily Readiness Score itself out of 100), or any internal sub-score number. Never write things like "HRV contribution is 6.1", "energy contribution is 4", "training load is sitting at 9.3", "sleep contribution 9.1". Those internal numbers are meaningless to the user and must never appear. Instead, translate what the number tells you into plain coaching language a normal person understands. Examples of the rewrite: instead of "HRV contribution is 6.1" write "your HRV is a touch below where it usually sits"; instead of "energy contribution is just 4" write "your energy is running low"; instead of "training load is sitting at 9.3" write "your body is still carrying a fair bit of load from recent days"; instead of "sleep contribution is 9.1" write "your sleep is doing its job". Only ever quote REAL measured values with their natural units (HRV in ms, resting HR in bpm, sleep as 7h 17m, steps as a number, the readiness score out of 100). Everything else gets described, not numbered.
- Warm but direct. No corporate fluff. No motivational filler.
- If CYCLE TRACKER DATA is present, use the phase to contextualise HRV, RHR, and energy readings. In luteal and late_luteal phases, HRV suppression and elevated RHR are expected hormonal variations, not alarm signals. In menstrual phase, lower energy and higher fatigue are expected. In follicular and ovulatory phases, metrics may run above baseline. You MAY reference the cycle phase naturally in a deepDive body when it is the best explanation for a metric reading — e.g. "HRV is a touch below your baseline, which is typical at this point in your cycle." Keep it one brief clause, never the headline or title of a section. NEVER lead the opener with the cycle. NEVER make a deepDive section title about the cycle. NEVER reference cycle in recommendations. NEVER ask about the cycle, period, or symptoms in the closing question.
- Build on the recent briefings below so you don't repeat yourself.
- Do not include any prose outside the JSON.

INTENT:
${intent}
${memoryText ? `\nUSER MEMORY (durable facts about this user, use to personalise):\n${memoryText}` : ""}${recentText}
${readinessText}
${weatherText}
${cycleText}
${dataContext}

Return only the JSON object now.`;

      const result = await aiCall({
        feature: "coach_briefing",
        userId,
        prompt,
        maxTokens: 700,
        provider: config.provider,
        model: config.model,
        schema: briefingSchema,
        temperature: 0.5,
      });

      if (result.data) {
        content = result.data as BriefingContent;
      } else {
        console.error(
          `[coach-briefing] AI returned no valid data for user ${userId} (${type}). validation=${result.validationOutcome || "unknown"}. text preview: ${typeof result.text === "string" ? result.text.slice(0, 200) : "(none)"}`,
        );
        return null;
      }
    }
  } catch (e: any) {
    console.error(
      `[coach-briefing] generation failed for user ${userId} (${type}): ${e?.message || e}`,
      e?.stack,
    );
    return null;
  }

  if (!content) return null;

  // Defence-in-depth: clamp medical-sounding language even if the model
  // ignored the system prompt rules.
  content = sanitizeBriefingContent(content);

  // Proactive recommendation cards: derived deterministically from the user's
  // live state (poor sleep -> wind-down meditation, desk pain -> ache/fix,
  // etc.), resolved into tappable deep-link cards and logged with
  // source='briefing'. Fails soft — the briefing stores fine without cards.
  try {
    const { buildBriefingRecommendations } = await import("./recommendationEngine");
    const cards = await buildBriefingRecommendations(userId, type);
    if (cards.length > 0) content.recommendationCards = cards;
  } catch (e: any) {
    console.error(`[coach-briefing] recommendation cards failed for ${userId} (${type}):`, e?.message || e);
  }

  // If a real AI briefing already exists (drift regeneration) we must
  // unconditionally overwrite it - createCoachBriefing's onConflict guard
  // only updates rows where source='fallback'. Use replaceCoachBriefing for
  // the regen path so the fresh wearable numbers actually land.
  let briefing;
  if (forceRegenerate && existing && (existing as any).source !== "fallback") {
    briefing = await storage.replaceCoachBriefing(userId, dateKey, type, content, contextSnapshot);
    if (!briefing) {
      briefing = await storage.createCoachBriefing({
        userId, briefingDate: dateKey, type, content, contextSnapshot, source,
      });
    }
  } else {
    briefing = await storage.createCoachBriefing({
      userId, briefingDate: dateKey, type, content, contextSnapshot, source,
    });
  }

  // Save the briefing into coach history immediately, so it shows up whether
  // or not the client ever opens the drawer to fire the read endpoint. Fails
  // soft: a history-write hiccup must never block the briefing itself.
  try {
    await ensureBriefingConversation(userId, briefing);
  } catch (e: any) {
    console.error(`[coach-briefing] history conversation create failed for ${userId} (${type}):`, e?.message || e);
  }

  // Fire a push / in-app notification for fresh morning briefings so the
  // coach feels proactive even if the user has not opened the dashboard
  // yet. Quiet hours, daily cap, and per-channel preferences are honored
  // by notify(). Only fire when the briefing is for *today* - skip any
  // historical backfill so users aren't pinged about old days.
  //
  // Do NOT re-notify on a drift regeneration. When the briefing is rebuilt
  // later in the day because HRV / steps / readiness / the check-in changed,
  // the stored briefing still updates (so the in-app copy stays accurate),
  // but the user has already been pinged this morning - a second lock-screen
  // push is the "multiple briefing notifications in one day" bug. We only
  // push on the first real briefing of the day: a brand-new row, or one that
  // replaces a source='fallback' placeholder (which never pushed).
  const wasDriftRegen = !!(forceRegenerate && existing && (existing as any).source !== "fallback");
  const todayKey = todayKeyForUser(userTz, new Date());
  if (!wasDriftRegen && briefing.briefingDate === todayKey) {
    const isEvening = type === "evening";
    // Lock-screen title is the briefing label. Section titles belong INSIDE
    // the briefing, not on the lock screen. Body is a short teaser drawn
    // from the opener (rich shape) or the legacy body field, truncated so
    // the lock screen does not show a wall of text.
    const notifTitle = isEvening ? "Evening Briefing" : "Morning Briefing";
    const rawBody = (content.opener || content.body || "").trim();
    const truncateToSentence = (s: string, max: number) => {
      if (!s) return s;
      if (s.length <= max) return s;
      const slice = s.slice(0, max);
      // Prefer cutting at a sentence end, then a comma, then a space.
      const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      if (lastStop > max * 0.5) return slice.slice(0, lastStop + 1);
      const lastComma = slice.lastIndexOf(", ");
      if (lastComma > max * 0.5) return slice.slice(0, lastComma) + ".";
      const lastSpace = slice.lastIndexOf(" ");
      return slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd() + "...";
    };
    const teaser = truncateToSentence(rawBody, 110);
    notify({
      userId,
      category: "coach",
      title: notifTitle,
      body: teaser,
      data: { url: `/?coach=1&briefing=${briefing.id}`, briefingId: briefing.id, type, route: "/coach-briefings" },
      disableEmail: true,
      prefKey: isEvening ? "eveningBriefing" : "morningBriefing",
    }).catch((err) => console.error("[coach-briefing] notify failed:", err));
  }

  return briefing;
}
