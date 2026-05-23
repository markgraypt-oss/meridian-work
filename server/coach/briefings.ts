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
  return {
    greeting: clampMedical(c.greeting),
    summary: clampMedical(c.summary),
    focus: c.focus.map(clampMedical),
    nudges: (c.nudges || []).map(clampMedical),
    watchout: c.watchout ? clampMedical(c.watchout) : c.watchout ?? null,
  };
}

const briefingSchema = z.object({
  greeting: z.string().min(1).max(280),
  summary: z.string().min(1).max(800),
  focus: z.array(z.string().min(1).max(220)).min(1).max(5),
  nudges: z.array(z.string().min(1).max(220)).max(5).optional().default([]),
  watchout: z.string().max(280).optional().nullable(),
});

export type BriefingContent = z.infer<typeof briefingSchema>;

export type BriefingType = "morning" | "evening";

export function todayKeyForUser(date: Date = new Date()): string {
  // ISO yyyy-mm-dd in server timezone (the app currently has no per-user TZ stored)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Retained for reference / potential future use but no longer called. We
// deliberately do NOT serve generic fallback copy to users — if the AI fails
// the briefing is skipped and the scheduler retries on the next 30m tick.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fallbackBriefing(type: BriefingType, userName: string): BriefingContent {
  if (type === "morning") {
    return {
      greeting: `Good morning, ${userName}.`,
      summary: "Here is a simple plan to start the day well while we wait on your full briefing.",
      focus: [
        "Drink a large glass of water before coffee",
        "Aim for 10 minutes of movement in the first hour",
        "Pick the single most important task for today and start it before 11am",
      ],
      nudges: ["Step away from the desk every 60 minutes."],
      watchout: null,
    };
  }
  return {
    greeting: `Evening, ${userName}.`,
    summary: "A short debrief while we wait on your full evening briefing.",
    focus: [
      "Note one win from today and one thing to improve tomorrow",
      "Aim for a screen-free 30 minutes before bed",
      "Keep tomorrow's first task visible so you can start fast",
    ],
    nudges: ["Hydrate before bed if you trained today."],
    watchout: null,
  };
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
  // match the underlying wearable source. Do NOT relax this comparison —
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

async function buildRecentBriefingsText(userId: string): Promise<string> {
  try {
    const recent = await storage.listCoachBriefings(userId, 5);
    if (!recent.length) return "";
    const lines = recent.map((b) => {
      const c = (b.content as BriefingContent | null) || null;
      const focus = c?.focus?.slice(0, 2).join("; ") || "";
      return `- ${b.briefingDate} ${b.type}: ${focus}`;
    });
    return `\nRECENT BRIEFINGS (most recent first, do not repeat the same focus items verbatim):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// Every wearable field that can be surfaced in the briefing prompt (see
// server/aiProvider.ts sleep/steps/resting_hr sections) must be captured
// here. If a new wearable field is ever piped into the briefing context,
// add it here too — otherwise drift in that field will not trigger
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
  // exactly. Do not relax this — drift between briefing copy and the
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
  // is also the drift-detection source of truth — see wearableSnapshotsEqual.
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

      const intent = type === "morning"
        ? "Set the user up for a focused, healthy day. Acknowledge how they look right now (sleep, stress, body), pick 3 high-leverage focus actions for today, and 1-3 short nudges. If something is concerning (e.g. very low sleep, high pain, rising burnout), surface it in `watchout`."
        : "Wind the user down. Reflect on what today looked like (movement, check-ins, hydration), suggest 2-3 recovery / wind-down focus actions, and 1-3 nudges to set up tomorrow. If something is concerning, surface it in `watchout`.";

      const prompt = `You are the user's digital performance coach. Produce a short ${type} briefing as JSON only.

OUTPUT JSON SHAPE (strict):
{
  "greeting": string (<= 240 chars, address ${userName} by name),
  "summary": string (<= 600 chars, 2-3 sentences, plain language),
  "focus": string[] (2-4 specific, actionable items for ${type === "morning" ? "today" : "tonight / tomorrow"}),
  "nudges": string[] (0-3 short reminders),
  "watchout": string | null (one sentence if you see a concerning pattern, otherwise null)
}

RULES:
- Reference the user's actual data when it is in the snapshot below.
- Never give medical advice or diagnose. Recommend professional input where appropriate.
- Be warm, direct, and concise. No em dashes.
- Do not invent data. If a metric is missing, do not pretend you know it.
- Quote every duration and metric exactly as it appears in the data snapshot (e.g. "6h 54m", "13,307 steps"). Never round, summarise, or convert sleep durations to decimal hours like "6.9 hours".
- Build on the recent briefings below — vary the focus items so the user gets fresh, progressive guidance, not the same suggestions repeated.
- Do not include any prose outside the JSON.

INTENT: ${intent}
${memoryText ? `\nUSER MEMORY (durable facts about this user, use to personalise):\n${memoryText}` : ""}${recentText}
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
  // unconditionally overwrite it — createCoachBriefing's onConflict guard
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
  // by notify(). Only fire when the briefing is for *today* — skip any
  // historical backfill so users aren't pinged about old days.
  const todayKey = todayKeyForUser(new Date());
  if (briefing.briefingDate === todayKey) {
    const isEvening = type === "evening";
    const defaultTitle = isEvening ? "Evening briefing ready" : "Morning briefing ready";
    const headline = (content.greeting || defaultTitle).trim();
    const firstFocus = (content.focus?.[0] || content.summary || "").trim();
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
