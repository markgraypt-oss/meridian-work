import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userProgramEnrollments } from "@workspace/db";
import { storage } from "../storage";
import { aiCall } from "../ai";
import { getFeatureConfig, getDefaultConfig } from "../aiProvider";
import { getCoachPersona } from "./coachPersona";

// The AI-generated shape the mobile "Coach's Review" card renders. `cta.route`
// is filled in by us (a deep link), never by the model.
const reviewSchema = z.object({
  state: z.enum(["not_started", "on_track", "behind", "attention"]),
  headline: z.string().max(80),
  body: z.string().max(600),
  suggestions: z.array(z.object({ label: z.string().max(90) })).max(3).default([]),
  cta: z.object({ label: z.string().max(40) }).nullable().default(null),
});
type RawReview = z.infer<typeof reviewSchema>;
export type ProgrammeReview = RawReview & { cta: { label: string; route: string } | null };
export type StoredReview = { review: ProgrammeReview; generatedAt: string };

const SEVERE_INJURY_THRESHOLD = 7; // body-map severity 1-10
const INJURY_WINDOW_DAYS = 14;
const BURNOUT_RECOVERY_THRESHOLD = 70; // burnout score 0-100

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

function baseState(done: number, expectedByNow: number): "not_started" | "behind" | "on_track" {
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

// Injury / recovery signals that push the review into the `attention` state.
async function attentionSignals(userId: string): Promise<{
  injury: { part: string; side: string | null; severity: number; when: string } | null;
  recovery: { reason: string } | null;
}> {
  let injury = null as any;
  try {
    const logs = await storage.getBodyMapLogs(userId); // desc by createdAt
    const cutoff = Date.now() - INJURY_WINDOW_DAYS * 86400000;
    const hit = (logs || []).find(
      (l: any) => (l?.severity || 0) >= SEVERE_INJURY_THRESHOLD && new Date(l.createdAt).getTime() >= cutoff,
    );
    if (hit) {
      injury = {
        part: hit.bodyPart,
        side: hit.side || null,
        severity: hit.severity,
        when: new Date(hit.createdAt).toISOString().slice(0, 10),
      };
    }
  } catch {}

  let recovery = null as any;
  try {
    const b: any = await storage.getBurnoutScore(userId);
    if (b && typeof b.score === "number" && b.score >= BURNOUT_RECOVERY_THRESHOLD) {
      recovery = { reason: `burnout score ${b.score} of 100` };
    }
  } catch {}

  return { injury, recovery };
}

// Deep link to the user's next actual session (today's scheduled workout for
// this enrollment). Falls back to the programme hub when it is a rest day, the
// programme has not started, or the active enrollment is a different one.
async function nextSessionLink(
  userId: string,
  enrollmentId: number,
): Promise<{ name: string | null; week: number | null; day: number | null; route: string }> {
  const hub = `/program-hub/${enrollmentId}`;
  try {
    const tw: any = await storage.getTodayWorkout(userId);
    if (tw && !tw.isRestDay && tw.enrollmentId === enrollmentId && tw.week && tw.day) {
      return {
        name: tw.workoutName || tw.name || null,
        week: tw.week,
        day: tw.day,
        route: `/workout-detail/${enrollmentId}/${tw.week}/${tw.day}`,
      };
    }
  } catch {}
  return { name: null, week: null, day: null, route: hub };
}

type ReviewContext = {
  enr: any;
  program: any;
  sched: ReturnType<typeof scheduleInfo>;
  done: number;
  state: ProgrammeReview["state"];
  flagKey: string;
  injury: Awaited<ReturnType<typeof attentionSignals>>["injury"];
  recovery: Awaited<ReturnType<typeof attentionSignals>>["recovery"];
};

async function buildContext(userId: string, enrollmentId: number): Promise<ReviewContext | null> {
  const enr = await storage.getEnrollmentById(enrollmentId);
  if (!enr || enr.userId !== userId) return null;
  const program = await storage.getProgramById(enr.programId);
  const sched = scheduleInfo(enr, program);
  const done = enr.workoutsCompleted || 0;
  const { injury, recovery } = await attentionSignals(userId);
  const state: ProgrammeReview["state"] = injury || recovery ? "attention" : baseState(done, sched.expectedByNow);
  const flagKey = injury ? `inj:${injury.part}:${injury.severity}` : recovery ? "rec" : "none";
  return { enr, program, sched, done, state, flagKey, injury, recovery };
}

/**
 * Generate a fresh review for one enrollment, persist it (cached in the
 * `review` jsonb column), and return it. Returns null if the enrollment is
 * missing / not owned by the user, or the model fails.
 */
export async function generateProgrammeReview(
  userId: string,
  enrollmentId: number,
): Promise<StoredReview | null> {
  const ctx = await buildContext(userId, enrollmentId);
  if (!ctx) return null;
  const { enr, program, sched, done, state, flagKey, injury, recovery } = ctx;

  const total = enr.totalWorkouts || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const recent = await recentActivitySummary(userId, enrollmentId);
  const next = await nextSessionLink(userId, enrollmentId);

  const flagText = injury
    ? `The client recently flagged ${titleCase(injury.part)}${injury.side ? ` (${injury.side})` : ""} at ${injury.severity} out of 10 on ${injury.when}.`
    : recovery
      ? `The client's recovery signals are low (${recovery.reason}); they may be run down.`
      : "none";

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
- attention: something needs care (see FLAG below). Acknowledge it plainly, tell them to train around it or ease off and let it settle, and keep today lighter or swap to mobility/recovery if it is sore. Be supportive, do not diagnose, do not tell them to see a doctor unless it sounds serious. cta label "Review and Adjust".
- Keep body under about 55 words. Keep it real, not gushing.

FACTS:
Programme: ${program?.title || "their programme"} (goal: ${titleCase(program?.goal || "")}, ${program?.difficulty || ""}, ${sched.weeks || "?"} weeks, about ${sched.perWeek}x per week).
Progress: ${done} of ${total} sessions done (${pct}%).
Schedule: currently week ${sched.currentWeek} of ${sched.weeks || "?"}.
Next session: ${next.name ? `${next.name} (week ${next.week}, day ${next.day})` : "rest day or nothing scheduled today"}.
Recent activity: ${recent}
FLAG: ${flagText}

Return only the JSON object now.`;

  const config = (await getFeatureConfig("programme_review")) || getDefaultConfig();

  let raw: RawReview;
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
    raw = result.data as RawReview;
  } catch (e: any) {
    console.error(`[programme-review] generation failed for ${userId}/${enrollmentId}: ${e?.message || e}`);
    return null;
  }

  // The app forbids em dashes in output; strip any the model slipped in.
  const clean = (s: string) => String(s || "").replace(/\s*[—–]\s*/g, ", ");
  const fallbackLabel =
    state === "not_started" ? "Start First Session" : state === "attention" ? "Review and Adjust" : "View Programme";

  const review: ProgrammeReview = {
    state,
    headline: clean(raw.headline),
    body: clean(raw.body),
    suggestions: (raw.suggestions || []).map((sg) => ({ label: clean(sg.label) })),
    // We own the route (deep link to the next session, else the hub); the
    // model only supplies the label.
    cta: { label: raw.cta?.label ? clean(raw.cta.label) : fallbackLabel, route: next.route },
  };

  const generatedAt = new Date().toISOString();
  const wrapper = {
    v: 1,
    review,
    snapshot: { completed: done, week: sched.currentWeek, flag: flagKey },
    generatedAt,
  };

  try {
    await db
      .update(userProgramEnrollments)
      .set({ review: wrapper as any })
      .where(eq(userProgramEnrollments.id, enrollmentId));
  } catch (e: any) {
    console.error(`[programme-review] persist failed for ${enrollmentId}: ${e?.message || e}`);
  }

  return { review, generatedAt };
}

/**
 * Return the cached review, regenerating only when the enrollment gained a
 * review, the user's progress / current week moved, or an injury / recovery
 * flag changed. Keeps this to ~1 AI call per meaningful change, not per load.
 */
export async function getOrGenerateProgrammeReview(
  userId: string,
  enrollmentId: number,
): Promise<StoredReview | null> {
  const ctx = await buildContext(userId, enrollmentId);
  if (!ctx) return null;

  const [row] = await db
    .select({ review: userProgramEnrollments.review })
    .from(userProgramEnrollments)
    .where(eq(userProgramEnrollments.id, enrollmentId));
  const stored = (row?.review as any) || null;

  if (
    stored?.review &&
    stored.snapshot &&
    stored.snapshot.completed === ctx.done &&
    stored.snapshot.week === ctx.sched.currentWeek &&
    (stored.snapshot.flag ?? "none") === ctx.flagKey
  ) {
    return { review: stored.review as ProgrammeReview, generatedAt: stored.generatedAt };
  }

  return await generateProgrammeReview(userId, enrollmentId);
}
