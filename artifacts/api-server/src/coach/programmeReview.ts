import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userProgramEnrollments } from "@workspace/db";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getFeatureConfig, getDefaultConfig } from "../aiProvider";
import { getCoachPersona } from "./coachPersona";

// The AI-generated shape the mobile "Coach's Review" card renders.
const reviewSchema = z.object({
  state: z.enum(["not_started", "on_track", "behind", "attention"]),
  headline: z.string().max(80),
  body: z.string().max(600),
  suggestions: z.array(z.object({ label: z.string().max(90) })).max(3).default([]),
  cta: z.object({ label: z.string().max(40) }).nullable().default(null),
});
export type ProgrammeReview = z.infer<typeof reviewSchema>;

export type StoredReview = { review: ProgrammeReview; generatedAt: string };

function titleCase(s: string): string {
  return String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scheduleInfo(enr: any, program: any) {
  const now = Date.now();
  const start = enr?.startDate ? new Date(enr.startDate).getTime() : now;
  const weeks = program?.weeks || 0;
  const elapsedDays = Math.max(0, Math.floor((now - start) / 86400000));
  const currentWeek = weeks ? Math.min(weeks, Math.floor(elapsedDays / 7) + 1) : 1;
  const perWeek =
    program?.trainingDaysPerWeek ||
    (weeks ? Math.round((enr?.totalWorkouts || 0) / weeks) : 0) ||
    3;
  const expectedByNow = Math.min(currentWeek, weeks || currentWeek) * perWeek;
  return { currentWeek, weeks, perWeek, expectedByNow };
}

function classify(done: number, expectedByNow: number): ProgrammeReview["state"] {
  if (done <= 0) return "not_started";
  if (done < expectedByNow * 0.5) return "behind";
  return "on_track";
}

async function recentActivitySummary(userId: string, enrollmentId: number): Promise<string> {
  try {
    const logs = await storage.getUserWorkoutLogs(userId, 25);
    const mine = (logs || []).filter((l: any) => l?.enrollmentId === enrollmentId);
    if (!mine.length) return "No sessions logged for this programme yet.";
    const last = mine[0];
    const lastDate = last?.completedAt || last?.createdAt;
    const when = lastDate ? new Date(lastDate).toISOString().slice(0, 10) : null;
    return `${mine.length} logged session(s) for this programme${when ? `, most recent on ${when}` : ""}.`;
  } catch {
    return "Recent session data unavailable.";
  }
}

/**
 * Generate a fresh review for one enrollment, persist it to the enrollment
 * (cached in the `review` jsonb column), and return it. Returns null if the
 * enrollment is missing / not owned by the user, or the model fails.
 */
export async function generateProgrammeReview(
  userId: string,
  enrollmentId: number,
): Promise<StoredReview | null> {
  const enr = await storage.getEnrollmentById(enrollmentId);
  if (!enr || enr.userId !== userId) return null;

  const program = await storage.getProgramById(enr.programId);
  const sched = scheduleInfo(enr, program);
  const done = enr.workoutsCompleted || 0;
  const total = enr.totalWorkouts || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const state = classify(done, sched.expectedByNow);
  const recent = await recentActivitySummary(userId, enrollmentId);

  const persona = getCoachPersona("programme_review");
  const prompt = `${persona}

You are giving ONE client a short, personal review of the training programme they are enrolled in, and a nudge for what to do next. Return ONLY a JSON object of this shape:
{
  "state": "not_started" | "on_track" | "behind" | "attention",
  "headline": string,        // 3 to 6 words, punchy, no full stop
  "body": string,            // 2 to 3 sentences, your voice, speaking directly to them
  "suggestions": [ { "label": string } ],   // 0 to 2 short, specific, actionable suggestions
  "cta": { "label": string } | null          // one primary button label, or null
}

Rules:
- Speak directly to the client as "you". Warm but direct. No corporate fluff, no motivational filler.
- No em dashes anywhere. No bullet characters inside any string.
- Base everything ONLY on the facts below. Never invent numbers, sessions or dates.
- The state is already decided for you: use "${state}" and write to match it.
- not_started: they have not started yet. Encourage them to do their first session this week and remind them the warm-up is part of the session, on the sheet. cta label like "Start First Session".
- on_track: acknowledge the progress honestly, then give ONE specific, useful cue that fits this programme's goal. cta label "View Programme".
- behind: no guilt. Reset expectations and get them to commit to just one session this week. You may gently suggest they can reschedule if life got in the way. cta label "View Programme".
- Keep body under about 55 words. Keep it real, not gushing.

FACTS:
Programme: ${program?.title || "their programme"} (goal: ${titleCase(program?.goal || "")}, ${program?.difficulty || ""}, ${sched.weeks || "?"} weeks, about ${sched.perWeek}x per week).
Progress: ${done} of ${total} sessions done (${pct}%).
Schedule: currently week ${sched.currentWeek} of ${sched.weeks || "?"}.
Recent activity: ${recent}

Return only the JSON object now.`;

  const config = (await getFeatureConfig("programme_review")) || getDefaultConfig();

  let review: ProgrammeReview;
  try {
    const result = await aiCall({
      feature: "programme_review",
      userId,
      prompt,
      maxTokens: 500,
      provider: config.provider,
      model: config.model,
      schema: reviewSchema,
      temperature: 0.5,
    });
    if (!result.data) {
      console.error(
        `[programme-review] no valid data for user ${userId} enrollment ${enrollmentId} (validation=${result.validationOutcome || "unknown"})`,
      );
      return null;
    }
    review = result.data as ProgrammeReview;
  } catch (e: any) {
    console.error(`[programme-review] generation failed for ${userId}/${enrollmentId}: ${e?.message || e}`);
    return null;
  }

  // Defence-in-depth: the app forbids em dashes in output; strip any the model slipped in.
  review.headline = review.headline.replace(/\s*[—–]\s*/g, ", ");
  review.body = review.body.replace(/\s*[—–]\s*/g, ", ");

  const generatedAt = new Date().toISOString();
  const wrapper = {
    v: 1,
    review,
    snapshot: { completed: done, week: sched.currentWeek },
    generatedAt,
  };

  try {
    await db
      .update(userProgramEnrollments)
      .set({ review: wrapper as any })
      .where(eq(userProgramEnrollments.id, enrollmentId));
  } catch (e: any) {
    console.error(`[programme-review] persist failed for ${enrollmentId}: ${e?.message || e}`);
    // Non-fatal: still return the fresh review to the caller.
  }

  return { review, generatedAt };
}

/**
 * Return the cached review, regenerating only when the enrollment is absent a
 * review or the user's progress / current week has moved since it was written.
 * Keeps this to one AI call per meaningful change instead of per screen load.
 */
export async function getOrGenerateProgrammeReview(
  userId: string,
  enrollmentId: number,
): Promise<StoredReview | null> {
  const enr = await storage.getEnrollmentById(enrollmentId);
  if (!enr || enr.userId !== userId) return null;

  const [row] = await db
    .select({ review: userProgramEnrollments.review })
    .from(userProgramEnrollments)
    .where(eq(userProgramEnrollments.id, enrollmentId));
  const stored = (row?.review as any) || null;

  const program = await storage.getProgramById(enr.programId);
  const sched = scheduleInfo(enr, program);
  const done = enr.workoutsCompleted || 0;

  if (
    stored?.review &&
    stored.snapshot &&
    stored.snapshot.completed === done &&
    stored.snapshot.week === sched.currentWeek
  ) {
    return { review: stored.review as ProgrammeReview, generatedAt: stored.generatedAt };
  }

  return await generateProgrammeReview(userId, enrollmentId);
}
