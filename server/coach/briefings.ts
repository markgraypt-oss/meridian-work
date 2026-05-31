import { z } from "zod";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getUserDataContext, getFeatureConfig } from "../aiProvider";
import { getTopMemoriesText } from "./memory";
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

export type BriefingContent = z.infer<typeof briefingSchema>;

export type BriefingType = "morning" | "evening";

export function todayKeyForUser(date: Date = new Date()): string {
  // ISO yyyy-mm-dd in server timezone (the app currently has no per-user TZ stored)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


// Per-process locks to prevent duplicate generation when the dashboard fires
// multiple simultaneous requests on first load.
const inflight = new Map<string, Promise<any>>();

export async function getOrGenerateBriefing(
  userId: string,
  type: BriefingType,
  date: Date = new Date(),
) {
  const dateKey = todayKeyForUser(date);
  const existing = await storage.getCoachBriefingForDay(userId, dateKey, type);

  // Drift contract: a stored briefing is only served if the wearable
  // snapshot it was generated from still matches the current wearable
  // snapshot exactly. If anything has changed (e.g. Apple Health backfilled
  // additional steps for "yesterday" after the briefing was first
  // generated) we regenerate so the numbers quoted in the briefing always
  // match the underlying wearable source. Do NOT relax this comparison -
  // the whole point of this check is to prevent user-visible drift like
  // "13,289 steps yesterday" while the wearable now reads 13,307.
  if (existing && (existing as any).source !== "fallback") {
    const stored = (existing.contextSnapshot as BriefingContextSnapshot | null)?.wearable;
    const fresh = await buildWearableSnapshot(userId);
    if (wearableSnapshotsEqual(stored, fresh)) return existing;
    // Fall through to regeneration. The lock below covers concurrent
    // dashboard requests so we only regenerate once.
  }

  const lockKey = `${userId}:${dateKey}:${type}`;
  if (inflight.has(lockKey)) return inflight.get(lockKey)!;

  const work = (async () => {
    try {
      return await generateAndStoreBriefing(userId, type, dateKey, !!existing);
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
    return `\nTODAY'S WEATHER (use ONLY in the morning opener, never invent if absent):\n- Range: ${tMin}-${tMax}\u00B0C, ${conditions}, humidity ${humidity}%\n- UV index: ${uv} (${uvNote})`;
  } catch {
    return "";
  }
}

async function buildReadinessAndBaselineText(userId: string, dateKey: string): Promise<string> {
  try {
    const [dr, baselines] = await Promise.all([
      import("../dailyReadiness").then((m) => m.getTodayForUser(userId)).catch(() => null),
      storage.getUserPhysiologicalBaselines(userId).catch(() => undefined),
    ]);

    const lines: string[] = [];
    lines.push("\nTODAY'S READINESS:");
    if (dr && dr.score != null) {
      lines.push(`- Daily Readiness Score: ${dr.score}/100 (based on ${dr.daysOfHistory} days of history)`);
      if (dr.inputs) {
        const ip = dr.inputs as any;
        if (ip.sleep != null) lines.push(`- Readiness input: sleep contribution ${ip.sleep}`);
        if (ip.energy != null) lines.push(`- Readiness input: energy contribution ${ip.energy}`);
        if (ip.trainingLoad != null) lines.push(`- Readiness input: training load contribution ${ip.trainingLoad}`);
        if (ip.hrv != null) lines.push(`- Readiness input: HRV contribution ${ip.hrv}`);
        if (ip.rhr != null) lines.push(`- Readiness input: RHR contribution ${ip.rhr}`);
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
    const { getRecentWearableMetrics } = await import("../wearables");
    const { rows } = await getRecentWearableMetrics(userId, 14);
    const PRIORITY: Record<string, number> = { oura: 4, whoop: 3, apple_health: 2, google_fit: 1 };
    const byDate = new Map<string, any>();
    for (const r of rows) {
      const cur = byDate.get(r.date);
      if (!cur || (PRIORITY[r.provider] || 0) > (PRIORITY[cur.provider] || 0)) {
        byDate.set(r.date, r);
      }
    }
    return Array.from(byDate.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({
        date: r.date,
        provider: r.provider,
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

function wearableSnapshotsEqual(
  a: WearableDaySnapshot[] | undefined | null,
  b: WearableDaySnapshot[] | undefined | null,
): boolean {
  const aa = a || [];
  const bb = b || [];
  if (aa.length !== bb.length) return false;
  const key = (d: WearableDaySnapshot) =>
    [
      d.date, d.provider,
      d.steps, d.sleepMinutes, d.sleepDeepMinutes, d.sleepRemMinutes, d.sleepScore,
      d.activeMinutes, d.caloriesBurned,
      d.restingHrBpm, d.hrvMs, d.readinessScore,
    ].join("|");
  const sa = aa.map(key).sort();
  const sb = bb.map(key).sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

async function buildContextSnapshot(userId: string): Promise<BriefingContextSnapshot | null> {
  // Snapshot of inputs used to generate the briefing. The `wearable` field
  // is also the drift-detection source of truth - see wearableSnapshotsEqual.
  const snap: BriefingContextSnapshot = {};
  snap.wearable = await buildWearableSnapshot(userId);
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

If there is no readiness score yet (building baseline), give a softer snapshot of overnight metrics and link to the planned workout if any, without making a strong verdict.`;

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

      const prompt = `You are the user's digital performance coach. Produce a rich ${type} briefing as JSON only.

OUTPUT JSON SHAPE (strict):
{
  "opener": string (greeting + light context. Morning: friendly greeting addressing ${userName} by name, optional weather note if provided, optional one-line nod to yesterday or the user's recent context. Evening: friendly greeting addressing ${userName} by name, one-line frame for the day just lived. Max 400 chars. 2-4 short sentences max. No emojis.),
  "deepDive": [
    { "title": string (4-8 words, e.g. "Nervous system is primed", "Load is high even on rest"), "body": string (1-3 short sentences interpreting one specific aspect of the data, max 400 chars) }
  ] (2-3 items, each on a DIFFERENT aspect of the body's state. Morning aspects to choose from: recovery/nervous system, load history, healthspan trend, sleep quality, baseline deviation. Evening aspects to choose from: output level, recovery cost, check-in alignment, sleep debt, trend signal.),
  "recommendations": [
    { "title": string (e.g. the scheduled workout name, or "Active recovery", "Mobility session"), "body": string (1-2 sentences on WHY this fits today's recovery state. Tie it explicitly to the verdict from deepDive. Max 300 chars.) }
  ] (0-2 items. Morning: today's scheduled workout from USER HEALTH DATA CONTEXT, framed against the recovery verdict, plus optional stretching/yoga if recovery is suppressed or no session is planned. Evening: usually empty or a single wind-down/recovery suggestion. NEVER invent workouts that are not in the user's scheduled data. If no workout is scheduled and no recovery work is needed, return an empty array.),
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
- TODAY is ${dateKey}. The wearable snapshot below has one row per date. The row whose "date" equals TODAY is today's data, which may be partial in the morning. The row immediately before TODAY is YESTERDAY. NEVER call today's partial numbers "yesterday". NEVER call yesterday's numbers "today".
- Reference the user's actual numbers when they appear. Quote durations exactly (e.g. "7h 19m", "14,873 steps"). Never convert sleep to decimal hours.
- If data is missing, do not pretend you have it. Do not invent.
- No em dashes anywhere. Use commas, full stops, or rephrase.
- No bullet characters inside body strings. The structure of the JSON IS the structure. Don't put dashes or bullets inside body text.
- Warm but direct. No corporate fluff. No motivational filler.
- Build on the recent briefings below so you don't repeat yourself.
- Do not include any prose outside the JSON.

INTENT:
${intent}
${memoryText ? `\nUSER MEMORY (durable facts about this user, use to personalise):\n${memoryText}` : ""}${recentText}
${readinessText}
${weatherText}
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

  // Fire a push / in-app notification for fresh morning briefings so the
  // coach feels proactive even if the user has not opened the dashboard
  // yet. Quiet hours, daily cap, and per-channel preferences are honored
  // by notify(). Only fire when the briefing is for *today* - skip any
  // historical backfill so users aren't pinged about old days.
  const todayKey = todayKeyForUser(new Date());
  if (briefing.briefingDate === todayKey) {
    const isEvening = type === "evening";
    const defaultTitle = isEvening ? "Evening briefing ready" : "Morning briefing ready";
    // Prefer rich shape (opener + first deepDive section) when present,
    // otherwise fall back to the legacy headline/body fields so old rows
    // still notify correctly.
    const richTitle = content.deepDive?.[0]?.title?.trim();
    const richBody = content.deepDive?.[0]?.body?.trim() || content.opener?.trim();
    const headline = (richTitle || content.headline || defaultTitle).trim();
    const firstFocus = (richBody || content.body || "").trim();
    notify({
      userId,
      category: "coach",
      title: headline,
      body: firstFocus,
      data: { url: `/?coach=1&briefing=${briefing.id}`, briefingId: briefing.id, type, route: "/coach-briefings" },
      disableEmail: true,
      prefKey: isEvening ? "eveningBriefing" : "morningBriefing",
    }).catch((err) => console.error("[coach-briefing] notify failed:", err));
  }

  return briefing;
}
