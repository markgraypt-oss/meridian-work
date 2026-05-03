import { z } from "zod";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getUserDataContext, getFeatureConfig } from "../aiProvider";
import { getTopMemoriesText } from "./memory";

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
  if (existing) return existing;

  const lockKey = `${userId}:${dateKey}:${type}`;
  if (inflight.has(lockKey)) return inflight.get(lockKey)!;

  const work = (async () => {
    try {
      return await generateAndStoreBriefing(userId, type, dateKey);
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
}

async function buildContextSnapshot(userId: string): Promise<BriefingContextSnapshot | null> {
  // Best-effort small snapshot used for auditability and debugging.
  const snap: BriefingContextSnapshot = {};
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

async function generateAndStoreBriefing(userId: string, type: BriefingType, dateKey: string) {
  // Re-check after acquiring the lock to avoid a race.
  const existing = await storage.getCoachBriefingForDay(userId, dateKey, type);
  if (existing) return existing;

  const user = await storage.getUser(userId);
  const userName = user?.firstName?.trim() || "there";

  let content: BriefingContent;
  let source: "ai" | "fallback" = "ai";
  const contextSnapshot = await buildContextSnapshot(userId);

  try {
    const config = await getFeatureConfig("recovery_coach");
    if (!config) {
      content = fallbackBriefing(type, userName);
      source = "fallback";
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
        content = fallbackBriefing(type, userName);
        source = "fallback";
      }
    }
  } catch (e) {
    console.error("[coach-briefing] generation failed, using fallback:", e);
    content = fallbackBriefing(type, userName);
    source = "fallback";
  }

  // Defence-in-depth: clamp medical-sounding language even if the model
  // ignored the system prompt rules.
  content = sanitizeBriefingContent(content);

  return storage.createCoachBriefing({
    userId,
    briefingDate: dateKey,
    type,
    content,
    contextSnapshot,
    source,
  });
}
