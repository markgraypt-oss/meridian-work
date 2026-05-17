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
// V2 Types (per spec: hero + 8 conditional cards)
// =====================================================

export type TrajectoryLabel = "holding steady" | "trending up" | "declining" | "not enough data";

export interface WeeklyCheckinPayloadV2 {
  _v: 5;
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
      steps?: {
        avg: number;
        bestDay: { dayLabel: string; steps: number } | null;
        source: "wearable" | "manual";
      } | null;
    };
    goals?: {
      items: Array<{ title: string; progressPct: number | null; isCompleted: boolean }>;
    };
    habits?: {
      items: Array<{ title: string; completionsThisWeek: number; targetDaysThisWeek: number; weekDays: boolean[] }>;
    };
    lifestyle?: {
      avgSleepHours: number | null;
      sleepSource: "wearable" | "manual" | null;
      roughDaysCount: number;
      avgStepsPerDay: number | null;
      stepsSource: "wearable" | "manual" | null;
      avgActiveMinutesPerDay: number | null;
      activeMinutesSource: "wearable" | "manual" | null;
      avgRestingHr: number | null;
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
  metrics: LegacyMetrics;
}

export interface LegacyMetrics {
  burnout: { score: number | null; trajectory: string | null; previousScore: number | null; delta: number | null };
  bodyMap: { activeCount: number; newCount: number; resolvedCount: number; topAreas: string[] };
  training: { sessionsCompleted: number; sessionsPlanned: number; sessionsMissed: number; adherencePct: number | null; totalVolumeKg: number; previousVolumeKg: number | null };
  nutrition: { mealsLogged: number; daysWithMeals: number; targetDays: number };
  checkIns: { count: number; avgMood: number | null; avgEnergy: number | null; avgStress: number | null };
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
  if (!daysOfWeek) return 7;
  const normalized = daysOfWeek.trim().toLowerCase();
  if (normalized === "everyday" || normalized === "every day" || normalized === "daily") return 7;
  const parts = daysOfWeek.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
  // Single token "Everyday" inside a list shouldn't be treated as 1 scheduled day.
  if (parts.length === 1 && ["everyday", "every day", "daily"].includes(parts[0].toLowerCase())) return 7;
  return parts.length > 0 ? parts.length : 7;
}

// =====================================================
// V2 Aggregation
// =====================================================

interface V2AggData {
  weekStart: Date;
  weekEnd: Date;
  cards: WeeklyCheckinPayloadV2["cards"];
  metrics: LegacyMetrics;
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
    nutritionDaysTracked: number;
    goalsOnTrackCount: number;
    goalsTotalCount: number;
    habitsWithCompletions: number;
    burnoutTrajectory: string | null;
  };
}

export async function aggregateWeekV2(userId: string, weekStart: Date): Promise<V2AggData> {
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
    activeMinutesData,
    restingHrData,
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
    storage.getExerciseMinutesEntries(userId, 60),
    storage.getRestingHREntries(userId, 60),
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

  // Rough days: per-day composite of flags (headache / sick / fatigue / anxious / overwhelmed)
  const roughDaySet = new Set<string>();
  for (const ci of checkInData) {
    const isRough =
      ci.headache === true ||
      ci.sick === true ||
      ci.fatigue === true ||
      ci.anxious === true ||
      ci.overwhelmed === true;
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

  // ---- Sleep (wearable + manual merged) ----
  const weekSleepEntries = sleepData.filter((s: any) => {
    const d = s.date ? new Date(s.date) : null;
    return d && d >= weekStart && d < weekEnd;
  });
  let avgSleepHours: number | null = null;
  let sleepSource: "wearable" | "manual" | null = null;
  if (weekSleepEntries.length > 0) {
    const totalMins = weekSleepEntries.reduce((sum: number, s: any) => sum + Number(s.durationMinutes || 0), 0);
    avgSleepHours = Math.round((totalMins / weekSleepEntries.length / 60) * 10) / 10;
    // Prefer wearable if any entry is wearable, else manual
    sleepSource = weekSleepEntries.some((s: any) => s.source === "wearable") ? "wearable" : "manual";
  }

  // ---- Active minutes (wearable + manual merged, prefer wearable per day) ----
  const weekExMinEntries = (activeMinutesData as any[]).filter((e: any) => {
    const d = e.date ? new Date(e.date) : null;
    return d && d >= weekStart && d < weekEnd;
  });
  let avgActiveMinutesPerDay: number | null = null;
  let activeMinutesSource: "wearable" | "manual" | null = null;
  if (weekExMinEntries.length > 0) {
    const totalMins = weekExMinEntries.reduce((sum: number, e: any) => sum + Number(e.minutes || 0), 0);
    avgActiveMinutesPerDay = Math.round(totalMins / weekExMinEntries.length);
    activeMinutesSource = weekExMinEntries.some((e: any) => e.source === "wearable") ? "wearable" : "manual";
  }

  // ---- Resting HR (wearable preferred via storage merge; no separate manual fallback needed) ----
  const weekHrEntries = (restingHrData as any[]).filter((e: any) => {
    const d = e.date ? new Date(e.date) : null;
    return d && d >= weekStart && d < weekEnd;
  });
  let avgRestingHr: number | null = null;
  if (weekHrEntries.length > 0) {
    const totalBpm = weekHrEntries.reduce((sum: number, e: any) => sum + Number(e.bpm || 0), 0);
    avgRestingHr = Math.round(totalBpm / weekHrEntries.length);
  }

  // ---- Nutrition ----
  const mealDaySet = new Set<string>();
  for (const m of weekMeals) {
    if (m.date) mealDaySet.add(new Date(m.date).toISOString().slice(0, 10));
  }
  const nutritionDaysTracked = mealDaySet.size;

  // ---- Goals ----
  const activeGoalItems = allGoals
    .filter((g) => !g.isCompleted && g.type !== "nutrition")
    .slice(0, 6)
    .map((g) => ({
      title: g.title,
      progressPct: typeof g.progress === "number" ? g.progress : null,
      isCompleted: g.isCompleted ?? false,
    }));

  // ---- Habits ----
  // Count unique completion days per habit (user can accidentally tap twice on same day)
  const completionsByHabit = new Map<number, Set<string>>();
  for (const c of weekHabitCompletions) {
    const key = c.habitId;
    const dateKey = new Date(c.completedDate).toISOString().slice(0, 10);
    if (!completionsByHabit.has(key)) completionsByHabit.set(key, new Set());
    completionsByHabit.get(key)!.add(dateKey);
  }
  const habitItems = activeHabits
    .filter((h) => (completionsByHabit.get(h.id)?.size ?? 0) > 0)
    .map((h) => {
      const weekDays: boolean[] = Array(7).fill(false);
      for (const c of weekHabitCompletions) {
        if (c.habitId !== h.id) continue;
        const d = new Date(c.completedDate);
        // ISO week: Monday=0 ... Sunday=6
        const day = (d.getUTCDay() + 6) % 7;
        if (day >= 0 && day < 7) weekDays[day] = true;
      }
      return {
        title: h.title,
        completionsThisWeek: completionsByHabit.get(h.id)?.size ?? 0,
        targetDaysThisWeek: habitTargetDays(h.daysOfWeek),
        weekDays,
      };
    });

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

  const metrics: LegacyMetrics = {
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

  // ---- Steps (wearable + manual merged) for the current week ----
  const DAY_LABELS_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const stepsByDay = new Map<number, { total: number; source: "wearable" | "manual" }>();
  for (const s of stepData as any[]) {
    const d = s.date ? new Date(s.date) : null;
    if (!d || d < weekStart || d >= weekEnd) continue;
    const day = (d.getUTCDay() + 6) % 7;
    const steps = Number(s.steps || 0);
    if (!Number.isFinite(steps) || steps <= 0) continue;
    const prev = stepsByDay.get(day);
    const src: "wearable" | "manual" = s.source === "wearable" ? "wearable" : "manual";
    if (!prev || steps > prev.total) {
      stepsByDay.set(day, { total: steps, source: src });
    }
  }
  let stepsBlock: NonNullable<WeeklyCheckinPayloadV2["cards"]["howYouMoved"]>["steps"] = null;
  if (stepsByDay.size > 0) {
    const entries = Array.from(stepsByDay.entries());
    const totalSteps = entries.reduce((sum, [, v]) => sum + v.total, 0);
    const avgSteps = Math.round(totalSteps / entries.length);
    const best = entries.reduce((acc, e) => (e[1].total > acc[1].total ? e : acc));
    const anyWearable = entries.some(([, v]) => v.source === "wearable");
    stepsBlock = {
      avg: avgSteps,
      bestDay: { dayLabel: DAY_LABELS_FULL[best[0]], steps: best[1].total },
      source: anyWearable ? "wearable" : "manual",
    };
  }

  if (completedThisWeek.length > 0 || sessionsPlanned > 0 || stepsBlock) {
    cards.howYouMoved = {
      sessionsCompleted: completedThisWeek.length,
      sessionsPlanned,
      adherencePct,
      steps: stepsBlock,
    };
  }

  if (activeGoalItems.length > 0) {
    cards.goals = { items: activeGoalItems };
  }

  if (habitItems.length > 0) {
    cards.habits = { items: habitItems };
  }

  // Derive steps summary fields for lifestyle card from the already-computed stepsByDay
  const avgStepsPerDay: number | null = stepsBlock ? stepsBlock.avg : null;
  const stepsSource: "wearable" | "manual" | null = stepsBlock ? stepsBlock.source : null;

  if (avgSleepHours !== null || roughDaysCount > 0 || avgStepsPerDay !== null || avgActiveMinutesPerDay !== null || avgRestingHr !== null) {
    cards.lifestyle = {
      avgSleepHours,
      sleepSource,
      roughDaysCount,
      avgStepsPerDay,
      stepsSource,
      avgActiveMinutesPerDay,
      activeMinutesSource,
      avgRestingHr,
    };
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
- Tone: warm, honest, non-prescriptive. Never diagnose. Reference actual numbers.
`;
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
    _v: 5,
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

/**
 * Returns true if a stored payload is missing post-rebuild fields and should be regenerated.
 * Triggers: older version, habits items missing weekDays array, or removed bodyStatus card present.
 */
export function isWeeklyCheckinPayloadStale(payload: any): boolean {
  const habitsItems: any[] = Array.isArray(payload?.cards?.habits?.items) ? payload.cards.habits.items : [];
  const habitsMissingWeekDays = habitsItems.some(
    (h) => !Array.isArray(h?.weekDays) || h.weekDays.length !== 7,
  );
  const hasRemovedBodyStatus = payload?.cards?.bodyStatus !== undefined;
  return payload?._v !== 5 || habitsMissingWeekDays || hasRemovedBodyStatus;
}

/**
 * If the stored row's payload is stale, regenerate in place and return the updated row.
 * Otherwise returns the row unchanged. Only regenerates rows for the CURRENT ISO week —
 * past weeks are historical snapshots and should not be touched.
 */
export async function upgradeWeeklyCheckinIfStale(row: WeeklyCheckin): Promise<WeeklyCheckin> {
  if (!isWeeklyCheckinPayloadStale(row.payload)) return row;
  const currentWeekStart = getIsoWeekStart();
  const rowWeekStart = new Date(row.weekStart);
  if (rowWeekStart.getTime() !== currentWeekStart.getTime()) return row;
  console.log(
    `[weekly-checkin-v2] upgrading stale payload row ${row.id} for user ${row.userId} ` +
      `(v=${(row.payload as any)?._v})`,
  );
  const newPayload = await generateWeeklyCheckinPayloadV2(row.userId, rowWeekStart);
  return await storage.updateWeeklyCheckinPayload(row.id, newPayload);
}

export async function getOrCreateCurrentWeeklyCheckinV2(userId: string): Promise<WeeklyCheckin> {
  const weekStart = getIsoWeekStart();
  const existing = await storage.getWeeklyCheckin(userId, weekStart);

  if (existing) {
    const p = existing.payload as any;
    // Retry: if stored payload is V2 with a fallback narrative, attempt Claude again
    if (p?._v === 4 && p.cards?.patterns?.isAI === false) {
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
    // Regenerate stale payloads in place so they upgrade to current schema without losing row id/weekStart.
    if (isWeeklyCheckinPayloadStale(p)) {
      console.log(
        `[weekly-checkin-v2] upgrading stale payload row ${existing.id} for user ${userId} (v=${p?._v})`,
      );
      const newPayload = await generateWeeklyCheckinPayloadV2(userId, weekStart);
      const updated = await storage.updateWeeklyCheckinPayload(existing.id, newPayload);
      return updated;
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
