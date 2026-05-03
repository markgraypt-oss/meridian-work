import { z } from "zod";
import { aiCall } from "./ai";
import { storage } from "./storage";
import { computeBurnoutScore } from "./burnoutEngine";
import { db } from "./db";
import { meals } from "@shared/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import type { WeeklyCheckin } from "@shared/schema";

export interface SuggestionPayload {
  id: string;
  title: string;
  body: string;
  category: "training" | "recovery" | "nutrition" | "mindset" | "sleep" | "general";
}

export interface WeeklyCheckinPayload {
  weekStart: string;
  weekEnd: string;
  summary: {
    wins: string[];
    concerns: string[];
    burnoutTrajectory: string;
  };
  metrics: {
    burnout: { score: number | null; trajectory: string | null; previousScore: number | null; delta: number | null };
    bodyMap: { activeCount: number; newCount: number; resolvedCount: number; topAreas: string[] };
    training: { sessionsCompleted: number; sessionsPlanned: number; sessionsMissed: number; adherencePct: number | null; totalVolumeKg: number; previousVolumeKg: number | null };
    nutrition: { mealsLogged: number; daysWithMeals: number; targetDays: number };
    checkIns: { count: number; avgMood: number | null; avgEnergy: number | null; avgStress: number | null };
  };
  suggestions: SuggestionPayload[];
}

const suggestionSchema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(10).max(400),
  category: z.enum(["training", "recovery", "nutrition", "mindset", "sleep", "general"]),
});

const aiOutputSchema = z.object({
  wins: z.array(z.string().min(3).max(200)).min(0).max(5),
  concerns: z.array(z.string().min(3).max(200)).min(0).max(5),
  burnoutTrajectory: z.string().min(5).max(400),
  suggestions: z.array(suggestionSchema).min(2).max(3),
});

/**
 * Returns the Monday 00:00 UTC of the ISO week containing `now`.
 */
export function getIsoWeekStart(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getPreviousIsoWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function aggregateWeek(userId: string, weekStart: Date): Promise<{
  metrics: WeeklyCheckinPayload["metrics"];
  weekEnd: Date;
  prevWeekStart: Date;
  prevMetrics: WeeklyCheckinPayload["metrics"];
}> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const prevWeekStart = getPreviousIsoWeekStart(weekStart);

  const [thisWeek, prevWeek] = await Promise.all([
    aggregateRange(userId, weekStart, weekEnd),
    aggregateRange(userId, prevWeekStart, weekStart),
  ]);

  // Carry deltas
  thisWeek.metrics.burnout.previousScore = prevWeek.metrics.burnout.score;
  thisWeek.metrics.burnout.delta =
    thisWeek.metrics.burnout.score !== null && prevWeek.metrics.burnout.score !== null
      ? thisWeek.metrics.burnout.score - prevWeek.metrics.burnout.score
      : null;
  thisWeek.metrics.training.previousVolumeKg = prevWeek.metrics.training.totalVolumeKg;

  return {
    metrics: thisWeek.metrics,
    weekEnd,
    prevWeekStart,
    prevMetrics: prevWeek.metrics,
  };
}

async function aggregateRange(userId: string, start: Date, end: Date): Promise<{ metrics: WeeklyCheckinPayload["metrics"] }> {
  const [
    checkInData,
    workoutLogData,
    bodyMapData,
    sleepData,
    stepData,
    weekMeals,
    scheduledThisWeek,
  ] = await Promise.all([
    storage.getCheckInsInRange(userId, start, end),
    storage.getUserWorkoutLogs(userId, 200),
    storage.getBodyMapLogs(userId),
    storage.getSleepEntries(userId, 60),
    storage.getStepEntries(userId, 60),
    db.select().from(meals).where(and(
      eq(meals.userId, userId),
      gte(meals.date, start),
      lt(meals.date, end),
    )),
    storage.getScheduledWorkoutsInRange(userId, start, new Date(end.getTime() - 1)),
  ]);

  // Burnout for this window
  let burnoutScore: number | null = null;
  let burnoutTraj: string | null = null;
  try {
    const result = computeBurnoutScore({
      checkIns: checkInData,
      workoutLogs: workoutLogData.filter((w: { completedAt?: Date | null }) => w.completedAt && new Date(w.completedAt) >= start && new Date(w.completedAt) < end),
      bodyMapLogs: bodyMapData,
      sleepEntries: sleepData,
      stepEntries: stepData,
      wearableMetrics: [],
    });
    burnoutScore = result.score;
    burnoutTraj = result.trajectory;
  } catch {}

  // Body map deltas (active = severity > 0 within the window)
  const newAreas = bodyMapData.filter(b => {
    const created = b.createdAt ? new Date(b.createdAt) : null;
    return created && created >= start && created < end;
  });
  const activeAreas = bodyMapData.filter(b => (b.severity ?? 0) > 0);
  const resolvedAreas = bodyMapData.filter(b => {
    const updated = b.updatedAt ? new Date(b.updatedAt) : null;
    return (b.severity ?? 0) === 0 && updated && updated >= start && updated < end;
  });
  const topAreas = activeAreas
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 4)
    .map(b => `${b.bodyPart}${b.severity ? ` (${b.severity}/10)` : ""}`);

  // Training: count completed workouts in the window
  const completedThisWeek = workoutLogData.filter((w: { completedAt?: Date | null }) => {
    const ts = w.completedAt ? new Date(w.completedAt) : null;
    return ts && ts >= start && ts < end;
  });
  const totalVolumeKg = completedThisWeek.reduce(
    (sum: number, w: { autoCalculatedVolume?: number | string | null }) =>
      sum + Number(w.autoCalculatedVolume || 0),
    0,
  );

  // Training: planned vs completed adherence (uses scheduledWorkouts table)
  const sessionsPlanned = scheduledThisWeek.length;
  const sessionsCompletedInPlan = scheduledThisWeek.filter(
    (s) => s.isCompleted === true,
  ).length;
  const sessionsMissed = Math.max(0, sessionsPlanned - sessionsCompletedInPlan);
  const adherencePct =
    sessionsPlanned > 0
      ? Math.round((sessionsCompletedInPlan / sessionsPlanned) * 100)
      : null;

  // Nutrition adherence: distinct days with at least one meal logged
  const mealDays = new Set<string>();
  for (const m of weekMeals) {
    if (m.date) mealDays.add(new Date(m.date).toISOString().slice(0, 10));
  }

  // Check-in averages
  const isNumber = (v: unknown): v is number => typeof v === "number";
  const moodVals = checkInData.map((c) => c.moodScore).filter(isNumber);
  const energyVals = checkInData.map((c) => c.energyScore).filter(isNumber);
  const stressVals = checkInData.map((c) => c.stressScore).filter(isNumber);

  const metrics: WeeklyCheckinPayload["metrics"] = {
    burnout: { score: burnoutScore, trajectory: burnoutTraj, previousScore: null, delta: null },
    bodyMap: {
      activeCount: activeAreas.length,
      newCount: newAreas.length,
      resolvedCount: resolvedAreas.length,
      topAreas,
    },
    training: {
      sessionsCompleted: completedThisWeek.length,
      sessionsPlanned,
      sessionsMissed,
      adherencePct,
      totalVolumeKg: Math.round(totalVolumeKg),
      previousVolumeKg: null,
    },
    nutrition: {
      mealsLogged: weekMeals.length,
      daysWithMeals: mealDays.size,
      targetDays: 7,
    },
    checkIns: {
      count: checkInData.length,
      avgMood: avg(moodVals),
      avgEnergy: avg(energyVals),
      avgStress: avg(stressVals),
    },
  };

  return { metrics };
}

function buildPrompt(metrics: WeeklyCheckinPayload["metrics"], weekStart: Date, weekEnd: Date): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `You are an evidence-informed wellbeing coach writing a single user's weekly check-in summary for a workplace wellness app.

Week: ${fmt(weekStart)} to ${fmt(weekEnd)}

Aggregated metrics for THIS user this week (and the prior week for comparison):
${JSON.stringify(metrics, null, 2)}

Write a concise weekly summary as JSON with these exact keys:
- "wins": up to 3 short bullet points celebrating positive patterns this week (skip if none).
- "concerns": up to 3 short bullet points naming patterns worth watching (skip if none).
- "burnoutTrajectory": one short paragraph (2-3 sentences) describing the burnout trajectory in plain language. Reference the score change and the dominant drivers.
- "suggestions": EXACTLY 2 or 3 advisory suggestions. Each has { "title", "body", "category" }. Categories: "training" | "recovery" | "nutrition" | "mindset" | "sleep" | "general". Suggestions are advisory only — do NOT propose specific programme/workout changes; instead describe principles ("consider lighter sessions on days with poor sleep").

Tone: warm, specific, non-prescriptive. Do not diagnose or claim to treat any condition. Avoid generic platitudes; reference actual numbers from the metrics. Respond with raw JSON only — no prose, no code fences.`;
}

export async function generateWeeklyCheckinPayload(userId: string, weekStart: Date): Promise<WeeklyCheckinPayload> {
  const { metrics, weekEnd } = await aggregateWeek(userId, weekStart);

  const prompt = buildPrompt(metrics, weekStart, weekEnd);

  const result = await aiCall({
    feature: "weekly_checkin",
    prompt,
    schema: aiOutputSchema,
    userId,
    maxTokens: 1200,
    temperature: 0.4,
    inputs: { weekStart: weekStart.toISOString(), metrics },
  });

  // Fallback if AI fails: produce a minimal deterministic payload so the
  // feature stays functional and idempotent.
  const ai = result.data ?? {
    wins: [] as string[],
    concerns: [] as string[],
    burnoutTrajectory:
      "We didn't have enough new context to read your trajectory this week. Keep logging check-ins so we can pick up patterns next time.",
    suggestions: [
      {
        title: "Log a daily check-in",
        body: "Even a 30-second check-in gives the coach something to work with next week.",
        category: "general" as const,
      },
      {
        title: "Pick one recovery anchor",
        body: "Choose a single recovery habit (a wind-down routine, a walk, a stretch) and aim for it 4 days this week.",
        category: "recovery" as const,
      },
    ],
  };

  const payload: WeeklyCheckinPayload = {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    summary: {
      wins: ai.wins,
      concerns: ai.concerns,
      burnoutTrajectory: ai.burnoutTrajectory,
    },
    metrics,
    suggestions: ai.suggestions.map((s, idx) => ({
      id: `s${idx + 1}`,
      title: s.title,
      body: s.body,
      category: s.category,
    })),
  };

  return payload;
}

/**
 * Idempotently fetch (or generate, then store) the weekly check-in for the
 * user's current ISO week.
 */
export async function getOrCreateCurrentWeeklyCheckin(userId: string): Promise<WeeklyCheckin> {
  const weekStart = getIsoWeekStart();
  const existing = await storage.getWeeklyCheckin(userId, weekStart);
  if (existing) return existing;

  const payload = await generateWeeklyCheckinPayload(userId, weekStart);

  try {
    return await storage.createWeeklyCheckin({
      userId,
      weekStart,
      payload,
      acceptedSuggestions: [],
      dismissedSuggestions: [],
    });
  } catch (err) {
    // Race: another request created it concurrently — return whichever exists.
    const after = await storage.getWeeklyCheckin(userId, weekStart);
    if (after) return after;
    throw err;
  }
}
