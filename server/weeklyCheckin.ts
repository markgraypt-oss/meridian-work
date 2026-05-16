import { z } from "zod";
import { aiCall } from "./ai";
import { storage } from "./storage";
import { computeBurnoutScore } from "./burnoutEngine";
import { db } from "./db";
import {
  meals,
  habitCompletions as hcTable,
  goals as goalsSchema,
  wearableMetricsDaily as wmdTable,
} from "@shared/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import type { WeeklyCheckin } from "@shared/schema";

// =====================================================
// V1 Types (kept for scheduler & admin preview)
// =====================================================

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

// =====================================================
// V2 Types (per spec: hero + 8 conditional cards)
// =====================================================

export type TrajectoryLabel = "holding steady" | "trending up" | "declining" | "not enough data";

export interface WeeklyCheckinPayloadV2 {
  _v: 2;
  weekStart: string;
  weekEnd: string;
  hero: string;
  trajectoryLabel: TrajectoryLabel;
  cards: {
    howYouFelt?: {
      checkInCount: number;
      avgMood: number | null;
      avgEnergy: number | null;
      avgStress: number | null;
      roughDaysCount: number;
    };
    howYouMoved?: {
      sessionsCompleted: number;
      sessionsPlanned: number;
      adherencePct: number | null;
    };
    goals?: {
      items: Array<{ title: string; progressPct: number | null; isCompleted: boolean }>;
    };
    habits?: {
      items: Array<{ title: string; completionsThisWeek: number; targetDaysThisWeek: number }>;
    };
    lifestyle?: {
      avgSleepHours: number | null;
      sleepSource: "wearable" | "manual" | null;
      roughDaysCount: number;
    };
    bodyStatus?: {
      areas: Array<{ bodyPart: string; status: "active" | "chronic" | "resolved" }>;
    };
    patterns?: {
      narrative: string;
      bulletPoints: string[];
      isAI: boolean;
      generatedAt: string;
    };
    nutrition?: {
      daysTracked: number;
      mealsLogged: number;
    };
  };
  // Kept for trends chart backward compat
  metrics: WeeklyCheckinPayload["metrics"];
}

// =====================================================
// Shared helpers
// =====================================================

export function getIsoWeekStart(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
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

function habitTargetDays(daysOfWeek: string | null | undefined): number {
  if (!daysOfWeek || daysOfWeek === "everyday") return 7;
  const parts = daysOfWeek.split(",").filter((d) => d.trim().length > 0);
  return parts.length > 0 ? parts.length : 7;
}

// =====================================================
// V1 Aggregation (kept intact for admin preview + scheduler)
// =====================================================

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
  const { getRecentWearableMetrics } = await import("./wearables");
  const wearableSafe = getRecentWearableMetrics(userId, 60).catch((e: any) => {
    console.warn("[weekly-checkin] wearable fetch failed, continuing without it:", e?.message || e);
    return { rows: [], bestProviderByDate: new Map<string, string>() };
  });

  const [
    checkInData,
    workoutLogData,
    bodyMapData,
    sleepData,
    stepData,
    weekMeals,
    scheduledThisWeek,
    wearable,
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
    wearableSafe,
  ]);

  let burnoutScore: number | null = null;
  let burnoutTraj: string | null = null;
  try {
    const result = computeBurnoutScore({
      checkIns: checkInData,
      workoutLogs: workoutLogData.filter((w: { completedAt?: Date | null }) => w.completedAt && new Date(w.completedAt) >= start && new Date(w.completedAt) < end),
      bodyMapLogs: bodyMapData,
      sleepEntries: sleepData,
      stepEntries: stepData,
      wearableMetrics: wearable.rows,
    });
    burnoutScore = result.score;
    burnoutTraj = result.trajectory;
  } catch {}

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

  const completedThisWeek = workoutLogData.filter((w: { completedAt?: Date | null }) => {
    const ts = w.completedAt ? new Date(w.completedAt) : null;
    return ts && ts >= start && ts < end;
  });
  const totalVolumeKg = completedThisWeek.reduce(
    (sum: number, w: { autoCalculatedVolume?: number | string | null }) =>
      sum + Number(w.autoCalculatedVolume || 0),
    0,
  );

  const sessionsPlanned = scheduledThisWeek.length;
  const sessionsCompletedInPlan = scheduledThisWeek.filter((s) => s.isCompleted === true).length;
  const sessionsMissed = Math.max(0, sessionsPlanned - sessionsCompletedInPlan);
  const adherencePct = sessionsPlanned > 0 ? Math.round((sessionsCompletedInPlan / sessionsPlanned) * 100) : null;

  const mealDays = new Set<string>();
  for (const m of weekMeals) {
    if (m.date) mealDays.add(new Date(m.date).toISOString().slice(0, 10));
  }

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

// =====================================================
// V1 AI prompt + generation (kept for admin preview)
// =====================================================

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

  const ai = result.data ?? {
    wins: [] as string[],
    concerns: [] as string[],
    burnoutTrajectory:
      "We didn't have enough new context to read your trajectory this week. Keep logging check-ins so we can pick up patterns next time.",
    suggestions: [
      { title: "Log a daily check-in", body: "Even a 30-second check-in gives the coach something to work with next week.", category: "general" as const },
      { title: "Pick one recovery anchor", body: "Choose a single recovery habit (a wind-down routine, a walk, a stretch) and aim for it 4 days this week.", category: "recovery" as const },
    ],
  };

  const payload: WeeklyCheckinPayload = {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    summary: { wins: ai.wins, concerns: ai.concerns, burnoutTrajectory: ai.burnoutTrajectory },
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
    const after = await storage.getWeeklyCheckin(userId, weekStart);
    if (after) return after;
    throw err;
  }
}

// =====================================================
// V2 Aggregation
// =====================================================

interface V2AggData {
  weekStart: Date;
  weekEnd: Date;
  cards: WeeklyCheckinPayloadV2["cards"];
  metrics: WeeklyCheckinPayload["metrics"];
  // For AI prompt
  promptData: {
    checkInCount: number;
    avgMood: number | null;
    avgEnergy: number | null;
    avgStress: number | null;
    roughDaysCount: number;
    sessionsCompleted: number;
    sessionsPlanned: number;
    adherencePct: number | null;
    avgSleepHours: number | null;
    sleepSource: "wearable" | "manual" | null;
    activeBodyAreas: string[];
    nutritionDaysTracked: number;
    goalsOnTrackCount: number;
    goalsTotalCount: number;
    habitsWithCompletions: number;
    burnoutTrajectory: string | null;
  };
}

async function aggregateWeekV2(userId: string, weekStart: Date): Promise<V2AggData> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const prevWeekStart = getPreviousIsoWeekStart(weekStart);

  const { getRecentWearableMetrics } = await import("./wearables");
  const wearableSafe = getRecentWearableMetrics(userId, 60).catch((e: any) => {
    console.warn("[weekly-checkin-v2] wearable fetch failed:", e?.message || e);
    return { rows: [] as any[], bestProviderByDate: new Map<string, string>() };
  });

  const [
    checkInData,
    workoutLogData,
    bodyMapData,
    sleepData,
    stepData,
    weekMeals,
    scheduledThisWeek,
    wearable,
    allGoals,
    activeHabits,
    weekHabitCompletions,
  ] = await Promise.all([
    storage.getCheckInsInRange(userId, weekStart, weekEnd),
    storage.getUserWorkoutLogs(userId, 200),
    storage.getBodyMapLogs(userId),
    storage.getSleepEntries(userId, 60),
    storage.getStepEntries(userId, 60),
    db.select().from(meals).where(and(
      eq(meals.userId, userId),
      gte(meals.date, weekStart),
      lt(meals.date, weekEnd),
    )),
    storage.getScheduledWorkoutsInRange(userId, weekStart, new Date(weekEnd.getTime() - 1)),
    wearableSafe,
    storage.getGoals(userId),
    storage.getHabits(userId),
    db.select().from(hcTable).where(and(
      eq(hcTable.userId, userId),
      gte(hcTable.completedDate, weekStart),
      lt(hcTable.completedDate, weekEnd),
    )),
  ]);

  // ---- Burnout (for legacy metrics / trajectoryLabel fallback) ----
  let burnoutScore: number | null = null;
  let burnoutTrajRaw: string | null = null;
  try {
    const result = computeBurnoutScore({
      checkIns: checkInData,
      workoutLogs: workoutLogData.filter((w: any) => w.completedAt && new Date(w.completedAt) >= weekStart && new Date(w.completedAt) < weekEnd),
      bodyMapLogs: bodyMapData,
      sleepEntries: sleepData,
      stepEntries: stepData,
      wearableMetrics: wearable.rows,
    });
    burnoutScore = result.score;
    burnoutTrajRaw = result.trajectory;
  } catch {}

  // ---- Check-ins ----
  const isNum = (v: unknown): v is number => typeof v === "number";
  const moodVals = checkInData.map((c) => c.moodScore).filter(isNum);
  const energyVals = checkInData.map((c) => c.energyScore).filter(isNum);
  const stressVals = checkInData.map((c) => c.stressScore).filter(isNum);
  const avgMood = avg(moodVals);
  const avgEnergy = avg(energyVals);
  const avgStress = avg(stressVals);

  // Rough days: per-day composite (moodScore ≤ 2 OR stressScore ≥ 4 OR energyScore ≤ 2)
  const roughDaySet = new Set<string>();
  for (const ci of checkInData) {
    const isRough =
      (isNum(ci.moodScore) && ci.moodScore <= 2) ||
      (isNum(ci.stressScore) && ci.stressScore >= 4) ||
      (isNum(ci.energyScore) && ci.energyScore <= 2);
    if (isRough) {
      roughDaySet.add(new Date(ci.checkInDate).toISOString().slice(0, 10));
    }
  }
  const roughDaysCount = roughDaySet.size;

  // ---- Training ----
  const completedThisWeek = workoutLogData.filter((w: any) => {
    const ts = w.completedAt ? new Date(w.completedAt) : null;
    return ts && ts >= weekStart && ts < weekEnd;
  });
  const totalVolumeKg = completedThisWeek.reduce(
    (sum: number, w: any) => sum + Number(w.autoCalculatedVolume || 0),
    0,
  );
  const sessionsPlanned = scheduledThisWeek.length;
  const sessionsCompletedInPlan = scheduledThisWeek.filter((s) => s.isCompleted === true).length;
  const sessionsMissed = Math.max(0, sessionsPlanned - sessionsCompletedInPlan);
  const adherencePct = sessionsPlanned > 0 ? Math.round((sessionsCompletedInPlan / sessionsPlanned) * 100) : null;

  // Previous week volume for legacy metrics
  const prevCompletions = workoutLogData.filter((w: any) => {
    const ts = w.completedAt ? new Date(w.completedAt) : null;
    return ts && ts >= prevWeekStart && ts < weekStart;
  });
  const prevVolumeKg = Math.round(prevCompletions.reduce((s: number, w: any) => s + Number(w.autoCalculatedVolume || 0), 0));

  // ---- Sleep from wearables ----
  const wearableRowsThisWeek = wearable.rows.filter((r: any) => {
    if (!r.sleepMinutes) return false;
    const rowDate = new Date((r.date as string) + "T00:00:00Z");
    return rowDate >= weekStart && rowDate < weekEnd;
  });
  let avgSleepHours: number | null = null;
  let sleepSource: "wearable" | "manual" | null = null;
  if (wearableRowsThisWeek.length > 0) {
    const totalMins = wearableRowsThisWeek.reduce((s: number, r: any) => s + (r.sleepMinutes as number), 0);
    avgSleepHours = Math.round((totalMins / wearableRowsThisWeek.length / 60) * 10) / 10;
    sleepSource = "wearable";
  }

  // ---- Nutrition ----
  const mealDaySet = new Set<string>();
  for (const m of weekMeals) {
    if (m.date) mealDaySet.add(new Date(m.date).toISOString().slice(0, 10));
  }
  const nutritionDaysTracked = mealDaySet.size;

  // ---- Goals ----
  const activeGoalItems = allGoals
    .filter((g) => !g.isCompleted)
    .slice(0, 6)
    .map((g) => ({
      title: g.title,
      progressPct: typeof g.progress === "number" ? g.progress : null,
      isCompleted: g.isCompleted ?? false,
    }));

  // ---- Habits ----
  const completionsByHabit = new Map<number, number>();
  for (const c of weekHabitCompletions) {
    completionsByHabit.set(c.habitId, (completionsByHabit.get(c.habitId) ?? 0) + 1);
  }
  const habitItems = activeHabits
    .filter((h) => (completionsByHabit.get(h.id) ?? 0) > 0)
    .map((h) => ({
      title: h.title,
      completionsThisWeek: completionsByHabit.get(h.id) ?? 0,
      targetDaysThisWeek: habitTargetDays(h.daysOfWeek),
    }));

  // ---- Body map ----
  const bodyAreas: Array<{ bodyPart: string; status: "active" | "chronic" | "resolved" }> = [];
  for (const b of bodyMapData) {
    if ((b.severity ?? 0) === 0) {
      const updated = b.updatedAt ? new Date(b.updatedAt) : null;
      if (updated && updated >= weekStart && updated < weekEnd) {
        bodyAreas.push({ bodyPart: b.bodyPart, status: "resolved" });
      }
    } else {
      const isChronic = b.duration === "more_than_two_weeks";
      bodyAreas.push({ bodyPart: b.bodyPart, status: isChronic ? "chronic" : "active" });
    }
  }

  // ---- Legacy metrics (for trends chart) ----
  const legacyBodyMap = bodyMapData.filter(b => (b.severity ?? 0) > 0);
  const newAreas = bodyMapData.filter(b => { const c = b.createdAt ? new Date(b.createdAt) : null; return c && c >= weekStart && c < weekEnd; });
  const resolvedAreas = bodyMapData.filter(b => { const u = b.updatedAt ? new Date(b.updatedAt) : null; return (b.severity ?? 0) === 0 && u && u >= weekStart && u < weekEnd; });

  const metrics: WeeklyCheckinPayload["metrics"] = {
    burnout: { score: burnoutScore, trajectory: burnoutTrajRaw, previousScore: null, delta: null },
    bodyMap: {
      activeCount: legacyBodyMap.length,
      newCount: newAreas.length,
      resolvedCount: resolvedAreas.length,
      topAreas: legacyBodyMap.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 4).map(b => b.bodyPart),
    },
    training: {
      sessionsCompleted: completedThisWeek.length,
      sessionsPlanned,
      sessionsMissed,
      adherencePct,
      totalVolumeKg: Math.round(totalVolumeKg),
      previousVolumeKg: prevVolumeKg,
    },
    nutrition: {
      mealsLogged: weekMeals.length,
      daysWithMeals: nutritionDaysTracked,
      targetDays: 7,
    },
    checkIns: {
      count: checkInData.length,
      avgMood,
      avgEnergy,
      avgStress,
    },
  };

  // ---- Assemble conditional cards ----
  const cards: WeeklyCheckinPayloadV2["cards"] = {};

  if (checkInData.length > 0) {
    cards.howYouFelt = {
      checkInCount: checkInData.length,
      avgMood,
      avgEnergy,
      avgStress,
      roughDaysCount,
    };
  }

  if (completedThisWeek.length > 0 || sessionsPlanned > 0) {
    cards.howYouMoved = {
      sessionsCompleted: completedThisWeek.length,
      sessionsPlanned,
      adherencePct,
    };
  }

  if (activeGoalItems.length > 0) {
    cards.goals = { items: activeGoalItems };
  }

  if (habitItems.length > 0) {
    cards.habits = { items: habitItems };
  }

  if (avgSleepHours !== null || roughDaysCount > 0) {
    cards.lifestyle = {
      avgSleepHours,
      sleepSource,
      roughDaysCount,
    };
  }

  if (bodyAreas.length > 0) {
    cards.bodyStatus = { areas: bodyAreas };
  }

  // patterns card populated by AI generation below

  if (nutritionDaysTracked >= 3) {
    cards.nutrition = {
      daysTracked: nutritionDaysTracked,
      mealsLogged: weekMeals.length,
    };
  }

  return {
    weekStart,
    weekEnd,
    cards,
    metrics,
    promptData: {
      checkInCount: checkInData.length,
      avgMood,
      avgEnergy,
      avgStress,
      roughDaysCount,
      sessionsCompleted: completedThisWeek.length,
      sessionsPlanned,
      adherencePct,
      avgSleepHours,
      sleepSource,
      activeBodyAreas: bodyAreas.filter(b => b.status === "active" || b.status === "chronic").map(b => b.bodyPart),
      nutritionDaysTracked,
      goalsOnTrackCount: activeGoalItems.filter(g => (g.progressPct ?? 0) >= 50).length,
      goalsTotalCount: activeGoalItems.length,
      habitsWithCompletions: habitItems.length,
      burnoutTrajectory: burnoutTrajRaw,
    },
  };
}

// =====================================================
// V2 AI — patterns prompt + schema
// =====================================================

const patternsAiSchema = z.object({
  hero: z.string().min(10).max(300),
  trajectoryLabel: z.enum(["holding steady", "trending up", "declining", "not enough data"]),
  patterns: z.array(z.string().min(10).max(400)).min(0).max(3),
});

function buildPatternsPrompt(promptData: V2AggData["promptData"], weekStart: Date, weekEnd: Date): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `You are a workplace wellbeing coach writing the "Patterns this week" section of a weekly check-in for a corporate wellness app.

Week: ${fmt(weekStart)} to ${fmt(weekEnd)}

User data for this week:
${JSON.stringify(promptData, null, 2)}

Your task — output raw JSON only, no prose, no code fences:
{
  "hero": "<one clear sentence summarising this week's dominant theme, referencing actual data>",
  "trajectoryLabel": "<one of: 'holding steady' | 'trending up' | 'declining' | 'not enough data'>",
  "patterns": ["<cross-stream pattern 1>", "<cross-stream pattern 2>"]
}

Rules:
- "hero": specific to this person's actual numbers. Not generic. Max 2 sentences.
- "trajectoryLabel": based on the overall wellbeing picture across all streams. Use "not enough data" only if fewer than 2 streams have data.
- "patterns": 2-3 specific observations that connect two or more data streams (e.g. "Your three lowest-mood days all followed nights with under 6 h sleep"). If fewer than 2 genuine cross-stream patterns exist, return an empty array.
- Tone: warm, honest, non-prescriptive. Never diagnose. Reference actual numbers.`;
}

function buildFallbackNarrative(promptData: V2AggData["promptData"]): { narrative: string; trajectoryLabel: TrajectoryLabel } {
  const parts: string[] = [];
  if (promptData.checkInCount > 0) {
    parts.push(`${promptData.checkInCount} check-in${promptData.checkInCount !== 1 ? "s" : ""} logged`);
    if (promptData.avgMood !== null) parts.push(`avg mood ${promptData.avgMood}/5`);
  }
  if (promptData.sessionsCompleted > 0) {
    parts.push(`${promptData.sessionsCompleted} training session${promptData.sessionsCompleted !== 1 ? "s" : ""} completed`);
  }
  if (promptData.avgSleepHours !== null) {
    parts.push(`avg ${promptData.avgSleepHours}h sleep per night`);
  }
  if (promptData.nutritionDaysTracked > 0) {
    parts.push(`nutrition tracked ${promptData.nutritionDaysTracked} day${promptData.nutritionDaysTracked !== 1 ? "s" : ""}`);
  }

  const narrative =
    parts.length > 0
      ? `This week: ${parts.join(", ")}.`
      : "Not enough data was logged this week to identify patterns — keep logging check-ins and activities so insights can build up.";

  // Map legacy trajectory to label
  let trajectoryLabel: TrajectoryLabel = "not enough data";
  const traj = (promptData.burnoutTrajectory || "").toLowerCase();
  if (traj.includes("improv") || traj.includes("better") || traj.includes("up")) {
    trajectoryLabel = "trending up";
  } else if (traj.includes("declin") || traj.includes("worse") || traj.includes("down")) {
    trajectoryLabel = "declining";
  } else if (parts.length >= 2) {
    trajectoryLabel = "holding steady";
  }

  return { narrative, trajectoryLabel };
}

// =====================================================
// V2 Generation
// =====================================================

export async function generatePatternsNarrative(
  promptData: V2AggData["promptData"],
  weekStart: Date,
  weekEnd: Date,
  userId: string,
): Promise<{ narrative: string; bulletPoints: string[]; isAI: boolean; trajectoryLabel: TrajectoryLabel }> {
  const prompt = buildPatternsPrompt(promptData, weekStart, weekEnd);

  try {
    const result = await aiCall({
      feature: "weekly_checkin",
      prompt,
      schema: patternsAiSchema,
      userId,
      maxTokens: 800,
      temperature: 0.4,
      inputs: { weekStart: weekStart.toISOString(), promptData },
    });

    if (result.data) {
      return {
        narrative: result.data.hero,
        bulletPoints: result.data.patterns,
        isAI: true,
        trajectoryLabel: result.data.trajectoryLabel,
      };
    }
  } catch (e: any) {
    console.warn("[weekly-checkin-v2] AI patterns call failed, using fallback:", e?.message);
  }

  const { narrative, trajectoryLabel } = buildFallbackNarrative(promptData);
  return { narrative, bulletPoints: [], isAI: false, trajectoryLabel };
}

export async function generateWeeklyCheckinPayloadV2(userId: string, weekStart: Date): Promise<WeeklyCheckinPayloadV2> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const agg = await aggregateWeekV2(userId, weekStart);

  const { narrative, bulletPoints, isAI, trajectoryLabel } = await generatePatternsNarrative(
    agg.promptData,
    weekStart,
    agg.weekEnd,
    userId,
  );

  const hero = isAI ? narrative : narrative;

  return {
    _v: 2,
    weekStart: weekStart.toISOString(),
    weekEnd: agg.weekEnd.toISOString(),
    hero,
    trajectoryLabel,
    cards: {
      ...agg.cards,
      patterns: {
        narrative,
        bulletPoints,
        isAI,
        generatedAt: new Date().toISOString(),
      },
    },
    metrics: agg.metrics,
  };
}

export async function getOrCreateCurrentWeeklyCheckinV2(userId: string): Promise<WeeklyCheckin> {
  const weekStart = getIsoWeekStart();
  const existing = await storage.getWeeklyCheckin(userId, weekStart);

  if (existing) {
    const p = existing.payload as any;
    // Retry: if stored payload is V2 with a fallback narrative, attempt Claude again
    if (p?._v === 2 && p.cards?.patterns?.isAI === false) {
      try {
        const agg = await aggregateWeekV2(userId, weekStart);
        const result = await generatePatternsNarrative(agg.promptData, weekStart, agg.weekEnd, userId);
        if (result.isAI) {
          const updatedPayload: WeeklyCheckinPayloadV2 = {
            ...(existing.payload as WeeklyCheckinPayloadV2),
            hero: result.narrative,
            trajectoryLabel: result.trajectoryLabel,
            cards: {
              ...(existing.payload as WeeklyCheckinPayloadV2).cards,
              patterns: {
                narrative: result.narrative,
                bulletPoints: result.bulletPoints,
                isAI: true,
                generatedAt: new Date().toISOString(),
              },
            },
          };
          const updated = await storage.updateWeeklyCheckinPayload(existing.id, updatedPayload);
          return updated;
        }
      } catch (e: any) {
        console.warn("[weekly-checkin-v2] retry narrative failed, returning cached fallback:", e?.message);
      }
    }
    return existing;
  }

  const payload = await generateWeeklyCheckinPayloadV2(userId, weekStart);

  try {
    return await storage.createWeeklyCheckin({
      userId,
      weekStart,
      payload,
      acceptedSuggestions: [],
      dismissedSuggestions: [],
    });
  } catch (err) {
    const after = await storage.getWeeklyCheckin(userId, weekStart);
    if (after) return after;
    throw err;
  }
}
