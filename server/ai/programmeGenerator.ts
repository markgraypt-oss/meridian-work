import { z } from "zod";
import { db } from "../db";
import { storage } from "../storage";
import { and, eq } from "drizzle-orm";
import {
  programs,
  programWeeks,
  programDays,
  programmeWorkouts as programmeWorkoutsTable,
  programmeWorkoutBlocks,
  programmeBlockExercises,
  workouts,
  workoutBlocks,
  blockExercises,
  exerciseLibrary,
  programGenerations,
  scheduledWorkouts,
  userProgramEnrollments,
  enrollmentWorkouts,
  enrollmentWorkoutBlocks,
  enrollmentBlockExercises,
} from "@shared/schema";
import { aiCall } from "./index";

// ---------------------------------------------------------------------------
// Catalogue helper — keeps the prompt compact while pinning the model to real
// exerciseLibrary rows.
// ---------------------------------------------------------------------------

interface CatalogueEntry {
  id: number;
  name: string;
  mainMuscle?: string[] | null;
  equipment?: string[] | null;
  movement?: string[] | null;
  level?: string | null;
  exerciseType?: string | null;
}

export async function loadExerciseCatalogue(): Promise<CatalogueEntry[]> {
  const rows = await db.select({
    id: exerciseLibrary.id,
    name: exerciseLibrary.name,
    mainMuscle: exerciseLibrary.mainMuscle,
    equipment: exerciseLibrary.equipment,
    movement: exerciseLibrary.movement,
    level: exerciseLibrary.level,
    exerciseType: exerciseLibrary.exerciseType,
  }).from(exerciseLibrary);
  return rows;
}

export function filterCatalogueByEquipment(catalogue: CatalogueEntry[], equipment?: string): CatalogueEntry[] {
  if (!equipment || equipment === "full_gym") return catalogue;
  if (equipment === "bodyweight") {
    return catalogue.filter(e =>
      !e.equipment || e.equipment.length === 0 ||
      e.equipment.some(x => /body\s*weight|none/i.test(x))
    );
  }
  if (equipment === "home_gym") {
    return catalogue.filter(e =>
      !e.equipment || e.equipment.length === 0 ||
      e.equipment.some(x => !/(barbell|cable|machine|smith)/i.test(x))
    );
  }
  return catalogue;
}

// Drop catalogue entries that match an injured / contraindicated muscle group.
export function filterCatalogueByContraindications(
  catalogue: CatalogueEntry[],
  avoidMuscles: string[],
  avoidExerciseIds: number[],
): CatalogueEntry[] {
  if (avoidMuscles.length === 0 && avoidExerciseIds.length === 0) return catalogue;
  const avoidSet = new Set(avoidMuscles.map(m => m.toLowerCase()));
  const idSet = new Set(avoidExerciseIds);
  return catalogue.filter(e => {
    if (idSet.has(e.id)) return false;
    if (avoidSet.size === 0) return true;
    const muscles = (e.mainMuscle || []).map(m => m.toLowerCase());
    return !muscles.some(m => avoidSet.has(m));
  });
}

function compactCatalogueForPrompt(catalogue: CatalogueEntry[], limit = 250): string {
  const slice = catalogue.slice(0, limit);
  return slice.map(e => {
    const parts: string[] = [`#${e.id} ${e.name}`];
    if (e.mainMuscle?.length) parts.push(`muscle:${e.mainMuscle.join("/")}`);
    if (e.equipment?.length) parts.push(`equip:${e.equipment.join("/")}`);
    if (e.movement?.length) parts.push(`move:${e.movement.join("/")}`);
    if (e.level) parts.push(`level:${e.level}`);
    if (e.exerciseType) parts.push(`type:${e.exerciseType}`);
    return parts.join(" | ");
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const setSchema = z.object({
  reps: z.union([z.string(), z.number()]).optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  rest: z.string().optional(),
});
export type GeneratedSet = z.infer<typeof setSchema>;

const exerciseSchema = z.object({
  exerciseLibraryId: z.number().int().positive(),
  sets: z.array(setSchema).min(1).max(8),
  load: z.string().optional().nullable(),
  tempo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type GeneratedExercise = z.infer<typeof exerciseSchema>;

const blockSchema = z.object({
  section: z.enum(["warmup", "main"]).default("main"),
  blockType: z.enum(["single", "superset", "triset", "circuit"]).default("single"),
  rest: z.string().optional().nullable(),
  exercises: z.array(exerciseSchema).min(1).max(8),
});
export type GeneratedBlock = z.infer<typeof blockSchema>;

export const generatedWorkoutSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional().nullable(),
  category: z.enum(["strength", "cardio", "hiit", "mobility", "recovery"]).default("strength"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  duration: z.number().int().min(5).max(180),
  blocks: z.array(blockSchema).min(1).max(8),
});

const dayPlanSchema = z.object({
  position: z.number().int().min(1).max(7),
  workouts: z.array(generatedWorkoutSchema).min(1).max(2),
});

const weekPlanSchema = z.object({
  weekNumber: z.number().int().min(1).max(8),
  days: z.array(dayPlanSchema).min(1).max(7),
});

export const generatedProgrammeSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  goal: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  weeks: z.array(weekPlanSchema).min(1).max(8),
});

export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>;
export type GeneratedProgramme = z.infer<typeof generatedProgrammeSchema>;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export interface ProgrammeInputs {
  goal: string;
  equipment: string;
  weeks: number;
  daysPerWeek: number;
  sessionDuration: number;
  difficulty: string;
  audience?: string;
  notes?: string;
  programmeType?: string;
  /** Optional admin-selected target user (for personalised generation). */
  targetUserId?: string | null;
  /** Muscle groups / regions to avoid (e.g. "lower back"). */
  contraindications?: string[];
  /** Exercise library IDs to never include. */
  avoidExerciseIds?: number[];
}

export interface WorkoutInputs {
  goal?: string;
  equipment?: string;
  duration: number;
  difficulty: string;
  focus?: string;
  notes?: string;
  contraindications?: string[];
  avoidExerciseIds?: number[];
  /** 0–100 burnout score; >70 nudges towards lighter/recovery work. */
  burnoutScore?: number;
  /** Compact body-map summary {bodyPart, severity} provided by the route. */
  bodyMap?: Array<{ bodyPart: string; severity: number }>;
  /** Snapshot of the user's current programme position so the AI workout
   *  complements (rather than collides with) what they're already doing. */
  programmeContext?: {
    programName?: string;
    goal?: string;
    currentWeek?: number;
    currentDay?: number;
    todayPlannedWorkout?: string | null;
    recentWorkoutNames?: string[];
  };
}

function buildContextHints(opts: {
  contraindications?: string[];
  avoidExerciseIds?: number[];
  burnoutScore?: number;
  bodyMap?: Array<{ bodyPart: string; severity: number }>;
  programmeContext?: WorkoutInputs["programmeContext"];
} & Record<string, any>): string {
  const lines: string[] = [];
  if (opts.contraindications?.length) {
    lines.push(`AVOID training the following regions / patterns: ${opts.contraindications.join(", ")}.`);
  }
  if (opts.avoidExerciseIds?.length) {
    lines.push(`Never use these exerciseLibraryId values: ${opts.avoidExerciseIds.join(", ")}.`);
  }
  if (typeof opts.burnoutScore === "number") {
    lines.push(`User burnout score is ${opts.burnoutScore}/100.${opts.burnoutScore >= 70 ? " Bias toward mobility/recovery and reduce intensity." : ""}`);
  }
  if (opts.bodyMap?.length) {
    const summary = opts.bodyMap
      .filter(p => p.severity >= 3)
      .map(p => `${p.bodyPart}(sev ${p.severity})`).join(", ");
    if (summary) lines.push(`Active discomfort regions: ${summary}. Avoid loading these areas.`);
  }
  if (opts.programmeContext) {
    const c = opts.programmeContext;
    const parts: string[] = [];
    if (c.programName) parts.push(`programme "${c.programName}"`);
    if (c.goal) parts.push(`goal ${c.goal}`);
    if (c.currentWeek) parts.push(`week ${c.currentWeek}`);
    if (c.currentDay) parts.push(`day ${c.currentDay}`);
    if (c.todayPlannedWorkout) parts.push(`today they have planned: "${c.todayPlannedWorkout}"`);
    if (c.recentWorkoutNames?.length) parts.push(`recent sessions: ${c.recentWorkoutNames.slice(0, 5).join(", ")}`);
    if (parts.length) {
      lines.push(`User is currently following: ${parts.join("; ")}. Design today's session to COMPLEMENT this — avoid overlapping the same primary muscles trained today, and stay aligned with the programme's overall goal.`);
    }
  }
  return lines.length ? lines.join("\n") : "";
}

function buildProgrammePrompt(inputs: ProgrammeInputs, catalogueText: string, weeksToGenerate: number, retryHint?: string, coachingContext?: string): string {
  const hints = buildContextHints(inputs);
  return [
    `You are an evidence-based strength & conditioning coach designing a complete ${weeksToGenerate}-week training programme.`,
    `Generate ALL ${weeksToGenerate} weeks (numbered 1..${weeksToGenerate}). Apply progressive overload across weeks (intensity / volume / complexity).`,
    "Pick exercises ONLY from the catalogue below by their numeric `exerciseLibraryId`. Never invent IDs.",
    "Avoid medical claims. Do not diagnose, prescribe, or describe injuries.",
    coachingContext ? coachingContext : "",
    (inputs as any).profileNote ? String((inputs as any).profileNote) : "",
    hints,
    retryHint || "",
    "",
    "Inputs:",
    JSON.stringify(inputs, null, 2),
    "",
    `Exercise catalogue (${catalogueText.split("\n").length} entries shown):`,
    catalogueText,
    "",
    "Respond with ONLY valid JSON matching this shape (no prose, no markdown):",
    `{
  "title": string, "description": string, "goal": string,
  "difficulty": "beginner"|"intermediate"|"advanced",
  "weeks": [{"weekNumber": 1..N, "days": [
    {"position": 1..7, "workouts": [{
      "name": string, "description": string|null,
      "category": "strength"|"cardio"|"hiit"|"mobility"|"recovery",
      "difficulty": "beginner"|"intermediate"|"advanced",
      "duration": number,
      "blocks": [{
        "section": "warmup"|"main",
        "blockType": "single"|"superset"|"triset"|"circuit",
        "rest": string|null,
        "exercises": [{
          "exerciseLibraryId": number,
          "sets": [{"reps": string|number, "rest": string?}],
          "load": string|null, "tempo": string|null, "notes": string|null
        }]
      }]
    }]}
  ]}]
}`,
    `Each week must contain exactly ${inputs.daysPerWeek} day entries (no rest days). Keep each workout near ${inputs.sessionDuration} minutes total. Across weeks, vary load/reps to drive progression.`,
  ].filter(Boolean).join("\n");
}

function buildWorkoutPrompt(inputs: WorkoutInputs, catalogueText: string, retryHint?: string, coachingContext?: string): string {
  const hints = buildContextHints(inputs);
  return [
    "You are an evidence-based S&C coach designing one training session for one user today.",
    "Pick exercises ONLY from the catalogue below by their numeric `exerciseLibraryId`. Never invent IDs.",
    "Avoid medical claims. Do not diagnose, prescribe, or describe injuries.",
    `Do NOT generate any warm-up blocks. Every block's "section" must be "main". The user will add their own warm-up.`,
    coachingContext ? coachingContext : "",
    hints,
    retryHint || "",
    "",
    "Inputs:",
    JSON.stringify(inputs, null, 2),
    "",
    `Exercise catalogue (${catalogueText.split("\n").length} entries shown):`,
    catalogueText,
    "",
    "Respond with ONLY valid JSON matching this shape (no prose, no markdown):",
    `{
  "name": string, "description": string|null,
  "category": "strength"|"cardio"|"hiit"|"mobility"|"recovery",
  "difficulty": "beginner"|"intermediate"|"advanced",
  "duration": number,
  "blocks": [{
    "section": "warmup"|"main",
    "blockType": "single"|"superset"|"triset"|"circuit",
    "rest": string|null,
    "exercises": [{
      "exerciseLibraryId": number,
      "sets": [{"reps": string|number, "rest": string?}],
      "load": string|null, "tempo": string|null, "notes": string|null
    }]
  }]
}`,
    `Total duration must be near ${inputs.duration} minutes.`,
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Catalogue cross-checker
// ---------------------------------------------------------------------------

function collectExerciseIds(prog: GeneratedProgramme): number[] {
  const ids: number[] = [];
  for (const w of prog.weeks) for (const d of w.days) for (const wk of d.workouts)
    for (const b of wk.blocks) for (const e of b.exercises) ids.push(e.exerciseLibraryId);
  return ids;
}

function unknownIds(ids: number[], validIds: Set<number>): number[] {
  return Array.from(new Set(ids.filter(id => !validIds.has(id))));
}

function pruneBlocks(blocks: GeneratedBlock[], validIds: Set<number>): GeneratedBlock[] {
  return blocks
    .map(b => ({ ...b, exercises: b.exercises.filter(e => validIds.has(e.exerciseLibraryId)) }))
    .filter(b => b.exercises.length > 0);
}

export function pruneProgramme(prog: GeneratedProgramme, catalogue: CatalogueEntry[]): GeneratedProgramme {
  const validIds = new Set(catalogue.map(c => c.id));
  for (const week of prog.weeks) {
    for (const day of week.days) {
      day.workouts = day.workouts
        .map(w => ({ ...w, blocks: pruneBlocks(w.blocks, validIds) }))
        .filter(w => w.blocks.length > 0);
    }
    week.days = week.days.filter(d => d.workouts.length > 0);
  }
  return prog;
}

export function pruneWorkout(w: GeneratedWorkout, catalogue: CatalogueEntry[]): GeneratedWorkout {
  const validIds = new Set(catalogue.map(c => c.id));
  return { ...w, blocks: pruneBlocks(w.blocks, validIds) };
}

// ---------------------------------------------------------------------------
// Public entry points used by the routes
// ---------------------------------------------------------------------------

export async function generateProgrammeWithAI(inputs: ProgrammeInputs, userId: string) {
  // Personalise from the target user (admin-selected) when provided: pull
  // their latest burnout score and any body-map regions they have flagged
  // as painful (severity ≥ 3) and feed them into the prompt context so the
  // generator avoids loading those areas and tones intensity appropriately.
  const personalised: { contraindications: string[]; burnoutScore?: number; bodyMap?: Array<{ bodyPart: string; severity: number }>; profileNote?: string } = {
    contraindications: [...(inputs.contraindications || [])],
  };
  if (inputs.targetUserId) {
    try {
      const targetUser = await storage.getUser(inputs.targetUserId);
      if (targetUser) {
        const bits: string[] = [];
        const u: any = targetUser;
        if (u.fitnessLevel) bits.push(`fitness ${u.fitnessLevel}`);
        if (u.preferredGoals) bits.push(`prefers ${u.preferredGoals}`);
        if (bits.length) personalised.profileNote = `Target user: ${bits.join(", ")}.`;
      }
      const burn = await storage.getBurnoutScore(inputs.targetUserId);
      if (burn && typeof (burn as any).score === "number") {
        personalised.burnoutScore = (burn as any).score;
      }
      const bodyLogs = await storage.getBodyMapLogs(inputs.targetUserId);
      if (bodyLogs?.length) {
        const recent = bodyLogs
          .filter((b: any) => typeof b.severity === "number" && b.severity >= 3)
          .slice(0, 8)
          .map((b: any) => ({ bodyPart: String(b.bodyPart || ""), severity: Number(b.severity) }))
          .filter((b) => b.bodyPart);
        if (recent.length) {
          personalised.bodyMap = recent;
          for (const r of recent) {
            if (!personalised.contraindications.includes(r.bodyPart)) {
              personalised.contraindications.push(r.bodyPart);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("[generateProgrammeWithAI] personalisation lookup failed:", e?.message);
    }
  }

  const effectiveInputs: ProgrammeInputs & { burnoutScore?: number; bodyMap?: Array<{ bodyPart: string; severity: number }>; profileNote?: string } = {
    ...inputs,
    contraindications: personalised.contraindications,
    burnoutScore: personalised.burnoutScore,
    bodyMap: personalised.bodyMap,
    profileNote: personalised.profileNote,
  };

  const fullCatalogue = await loadExerciseCatalogue();
  const equipFiltered = filterCatalogueByEquipment(fullCatalogue, effectiveInputs.equipment);
  const filtered = filterCatalogueByContraindications(
    equipFiltered,
    effectiveInputs.contraindications || [],
    effectiveInputs.avoidExerciseIds || [],
  );
  const validIds = new Set(filtered.map(c => c.id));
  const catalogueText = compactCatalogueForPrompt(filtered);

  const programmeSchema = generatedProgrammeSchema as unknown as z.ZodType<GeneratedProgramme>;
  // Route validation already clamps requested weeks to 1..8 (the
  // model+token budget supports at most ~8 weeks per call). We assert here
  // again as a defence-in-depth check so downstream save logic always
  // matches the generated content.
  const weeksToGenerate = Math.max(1, Math.min(8, effectiveInputs.weeks));
  const tokenBudget = Math.min(8000, 1500 + weeksToGenerate * effectiveInputs.daysPerWeek * 250);

  // Pull admin-tunable coaching expertise (philosophy, structure rules,
  // boundaries) for the Programme Builder so admins can shape the AI's
  // output without code changes.
  let coachingContext = "";
  try {
    const { getCoachingContext } = await import("../aiProvider");
    coachingContext = await getCoachingContext("programme_generator");
  } catch {}

  // First attempt
  let result = await aiCall<GeneratedProgramme>({
    feature: "programme_generator",
    prompt: buildProgrammePrompt(effectiveInputs, catalogueText, weeksToGenerate, undefined, coachingContext),
    userId,
    schema: programmeSchema,
    maxTokens: tokenBudget,
    temperature: 0.4,
    timeoutMs: 90_000,
  });

  // Catalogue repair retry — if any unknown IDs slipped past the schema,
  // ask the model to re-emit using only valid IDs. Per spec we retry ONCE
  // and then fail loudly rather than silently pruning unknown exercises.
  if (result.data) {
    const bad = unknownIds(collectExerciseIds(result.data), validIds);
    if (bad.length > 0) {
      const retryHint = `Your previous response used exerciseLibraryId values that are NOT in the catalogue: ${bad.join(", ")}. Replace them with valid catalogue IDs only.`;
      result = await aiCall<GeneratedProgramme>({
        feature: "programme_generator",
        prompt: buildProgrammePrompt(effectiveInputs, catalogueText, weeksToGenerate, retryHint, coachingContext),
        userId,
        schema: programmeSchema,
        maxTokens: tokenBudget,
        temperature: 0.2,
        timeoutMs: 90_000,
      });
      if (result.data) {
        const stillBad = unknownIds(collectExerciseIds(result.data), validIds);
        if (stillBad.length > 0) {
          return {
            ok: false as const,
            error: `Generator returned exerciseLibraryId values not in the catalogue after one repair attempt: ${stillBad.join(", ")}`,
            logId: result.logId,
            validationOutcome: result.validationOutcome,
          };
        }
      }
    }
  }

  if (!result.data) {
    return {
      ok: false as const,
      error: result.error || "Programme generator failed to return valid JSON",
      logId: result.logId,
      validationOutcome: result.validationOutcome,
    };
  }
  // At this point all IDs are guaranteed valid; pruneProgramme is only used
  // to drop any empty blocks/days that may remain after schema validation.
  const pruned = pruneProgramme(result.data, filtered);
  const totalDays = pruned.weeks.reduce((s, w) => s + w.days.length, 0);
  if (totalDays === 0) {
    return {
      ok: false as const,
      error: "Generated programme contained no usable exercises after catalogue check",
      logId: result.logId,
      validationOutcome: result.validationOutcome,
    };
  }
  return {
    ok: true as const,
    data: pruned,
    logId: result.logId,
    validationOutcome: result.validationOutcome,
    safetyFlags: result.safetyFlags,
  };
}

export async function generateWorkoutWithAI(inputs: WorkoutInputs, userId: string) {
  const fullCatalogue = await loadExerciseCatalogue();
  const equipFiltered = filterCatalogueByEquipment(fullCatalogue, inputs.equipment);
  const filtered = filterCatalogueByContraindications(
    equipFiltered,
    inputs.contraindications || [],
    inputs.avoidExerciseIds || [],
  );
  const validIds = new Set(filtered.map(c => c.id));
  const catalogueText = compactCatalogueForPrompt(filtered);

  const workoutSchema = generatedWorkoutSchema as unknown as z.ZodType<GeneratedWorkout>;

  // Pull admin-tunable coaching expertise (philosophy, prompt interpretation,
  // selection rules, boundaries) for the one-off Workout Generator.
  let coachingContext = "";
  try {
    const { getCoachingContext } = await import("../aiProvider");
    coachingContext = await getCoachingContext("workout_generator");
  } catch {}

  let result = await aiCall<GeneratedWorkout>({
    feature: "workout_generator",
    prompt: buildWorkoutPrompt(inputs, catalogueText, undefined, coachingContext),
    userId,
    schema: workoutSchema,
    maxTokens: 2500,
    temperature: 0.5,
    timeoutMs: 45_000,
  });

  if (result.data) {
    const ids = result.data.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId));
    const bad = unknownIds(ids, validIds);
    if (bad.length > 0) {
      const retryHint = `Your previous response used exerciseLibraryId values not in the catalogue: ${bad.join(", ")}. Use only valid catalogue IDs.`;
      result = await aiCall<GeneratedWorkout>({
        feature: "workout_generator",
        prompt: buildWorkoutPrompt(inputs, catalogueText, retryHint, coachingContext),
        userId,
        schema: workoutSchema,
        maxTokens: 2500,
        temperature: 0.3,
        timeoutMs: 45_000,
      });
      if (result.data) {
        const stillBadIds = result.data.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId));
        const stillBad = unknownIds(stillBadIds, validIds);
        if (stillBad.length > 0) {
          return {
            ok: false as const,
            error: `Generator returned exerciseLibraryId values not in the catalogue after one repair attempt: ${stillBad.join(", ")}`,
            logId: result.logId,
            validationOutcome: result.validationOutcome,
          };
        }
      }
    }
  }

  if (!result.data) {
    return {
      ok: false as const,
      error: result.error || "Workout generator failed to return valid JSON",
      logId: result.logId,
      validationOutcome: result.validationOutcome,
    };
  }
  const pruned = pruneWorkout(result.data, filtered);
  if (pruned.blocks.length === 0) {
    return {
      ok: false as const,
      error: "Generated workout contained no usable exercises after catalogue check",
      logId: result.logId,
      validationOutcome: result.validationOutcome,
    };
  }
  return {
    ok: true as const,
    data: pruned,
    logId: result.logId,
    validationOutcome: result.validationOutcome,
    safetyFlags: result.safetyFlags,
  };
}

// ---------------------------------------------------------------------------
// Section regeneration — regenerate a single day or workout in an existing
// draft, using the rest of the draft (and any admin edits already applied) as
// context so the new section complements what surrounds it.
// ---------------------------------------------------------------------------

export interface RegenerateSectionArgs {
  inputs: ProgrammeInputs;
  existingProgramme: GeneratedProgramme;
  weekNumber: number;
  targetDayPosition: number;
  workoutIndex?: number | null;
}

function summariseProgramme(prog: GeneratedProgramme, exclude: { weekNumber: number; dayPosition: number; workoutIndex?: number | null }): string {
  const lines: string[] = [];
  for (const wk of prog.weeks) {
    for (const day of wk.days) {
      for (let i = 0; i < day.workouts.length; i++) {
        const w = day.workouts[i];
        const isExcluded =
          wk.weekNumber === exclude.weekNumber &&
          day.position === exclude.dayPosition &&
          (typeof exclude.workoutIndex !== "number" || exclude.workoutIndex === i);
        if (isExcluded) continue;
        const ids = w.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId));
        lines.push(`W${wk.weekNumber}D${day.position}#${i + 1} "${w.name}" (${w.category}, ${w.duration}min) ids:[${ids.join(",")}]`);
      }
    }
  }
  return lines.join("\n");
}

function buildRegenerateDayPrompt(args: RegenerateSectionArgs, catalogueText: string, contextSummary: string, retryHint?: string): string {
  const hints = buildContextHints(args.inputs);
  return [
    "You are an evidence-based S&C coach REPLACING a single day inside an existing programme draft.",
    `Generate ONE day for week ${args.weekNumber}, day position ${args.targetDayPosition}, with exactly the same number of workouts and overall session length the rest of the programme uses.`,
    "Pick exercises ONLY from the catalogue below by their numeric `exerciseLibraryId`. Never invent IDs.",
    "Avoid medical claims. Do not diagnose, prescribe, or describe injuries.",
    hints,
    retryHint || "",
    "",
    "Programme inputs:",
    JSON.stringify(args.inputs, null, 2),
    "",
    "Other days already in the draft (do not duplicate primary muscle work or workout names; complement them):",
    contextSummary || "(no other days)",
    "",
    `Exercise catalogue (${catalogueText.split("\n").length} entries shown):`,
    catalogueText,
    "",
    "Respond with ONLY valid JSON matching this shape (no prose, no markdown):",
    `{"position": ${args.targetDayPosition}, "workouts": [{
      "name": string, "description": string|null,
      "category": "strength"|"cardio"|"hiit"|"mobility"|"recovery",
      "difficulty": "beginner"|"intermediate"|"advanced",
      "duration": number,
      "blocks": [{
        "section": "warmup"|"main",
        "blockType": "single"|"superset"|"triset"|"circuit",
        "rest": string|null,
        "exercises": [{
          "exerciseLibraryId": number,
          "sets": [{"reps": string|number, "rest": string?}],
          "load": string|null, "tempo": string|null, "notes": string|null
        }]
      }]
    }]}`,
    `Each workout must be near ${args.inputs.sessionDuration} minutes total.`,
  ].filter(Boolean).join("\n");
}

function buildRegenerateWorkoutPrompt(args: RegenerateSectionArgs, catalogueText: string, contextSummary: string, retryHint?: string): string {
  const hints = buildContextHints(args.inputs);
  return [
    "You are an evidence-based S&C coach REPLACING a single workout inside an existing programme draft.",
    `Generate ONE workout for week ${args.weekNumber}, day ${args.targetDayPosition}, slot index ${args.workoutIndex ?? 0}.`,
    "Pick exercises ONLY from the catalogue below by their numeric `exerciseLibraryId`. Never invent IDs.",
    "Avoid medical claims. Do not diagnose, prescribe, or describe injuries.",
    hints,
    retryHint || "",
    "",
    "Programme inputs:",
    JSON.stringify(args.inputs, null, 2),
    "",
    "Other workouts already in the draft (complement them; avoid duplicating primary muscle work):",
    contextSummary || "(no other workouts)",
    "",
    `Exercise catalogue (${catalogueText.split("\n").length} entries shown):`,
    catalogueText,
    "",
    "Respond with ONLY valid JSON matching this shape (no prose, no markdown):",
    `{"name": string, "description": string|null,
      "category": "strength"|"cardio"|"hiit"|"mobility"|"recovery",
      "difficulty": "beginner"|"intermediate"|"advanced",
      "duration": number,
      "blocks": [{
        "section": "warmup"|"main",
        "blockType": "single"|"superset"|"triset"|"circuit",
        "rest": string|null,
        "exercises": [{
          "exerciseLibraryId": number,
          "sets": [{"reps": string|number, "rest": string?}],
          "load": string|null, "tempo": string|null, "notes": string|null
        }]
      }]}`,
    `Total duration must be near ${args.inputs.sessionDuration} minutes.`,
  ].filter(Boolean).join("\n");
}

export type RegenerateSectionResult =
  | { ok: true; kind: "day"; weekNumber: number; data: z.infer<typeof dayPlanSchema>; logId?: number; validationOutcome?: any; safetyFlags?: any }
  | { ok: true; kind: "workout"; weekNumber: number; dayPosition: number; workoutIndex: number; data: GeneratedWorkout; logId?: number; validationOutcome?: any; safetyFlags?: any }
  | { ok: false; error: string; logId?: number; validationOutcome?: any };

export async function regenerateProgrammeSection(args: RegenerateSectionArgs, userId: string): Promise<RegenerateSectionResult> {
  const fullCatalogue = await loadExerciseCatalogue();
  const equipFiltered = filterCatalogueByEquipment(fullCatalogue, args.inputs.equipment);
  const filtered = filterCatalogueByContraindications(
    equipFiltered,
    args.inputs.contraindications || [],
    args.inputs.avoidExerciseIds || [],
  );
  const validIds = new Set(filtered.map(c => c.id));
  const catalogueText = compactCatalogueForPrompt(filtered);

  const isWorkout = typeof args.workoutIndex === "number" && args.workoutIndex >= 0;
  const contextSummary = summariseProgramme(args.existingProgramme, {
    weekNumber: args.weekNumber,
    dayPosition: args.targetDayPosition,
    workoutIndex: isWorkout ? args.workoutIndex! : null,
  });

  if (isWorkout) {
    const schema = generatedWorkoutSchema as unknown as z.ZodType<GeneratedWorkout>;
    let result = await aiCall<GeneratedWorkout>({
      feature: "programme_section_regen",
      prompt: buildRegenerateWorkoutPrompt(args, catalogueText, contextSummary),
      userId,
      schema,
      maxTokens: 2500,
      temperature: 0.4,
      timeoutMs: 45_000,
    });
    if (result.data) {
      const ids = result.data.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId));
      const bad = unknownIds(ids, validIds);
      if (bad.length > 0) {
        const retryHint = `Your previous response used exerciseLibraryId values not in the catalogue: ${bad.join(", ")}. Use only valid catalogue IDs.`;
        result = await aiCall<GeneratedWorkout>({
          feature: "programme_section_regen",
          prompt: buildRegenerateWorkoutPrompt(args, catalogueText, contextSummary, retryHint),
          userId,
          schema,
          maxTokens: 2500,
          temperature: 0.2,
          timeoutMs: 45_000,
        });
        if (result.data) {
          const stillBad = unknownIds(result.data.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId)), validIds);
          if (stillBad.length > 0) {
            return { ok: false, error: `Generator returned exerciseLibraryId values not in the catalogue after one repair attempt: ${stillBad.join(", ")}`, logId: result.logId, validationOutcome: result.validationOutcome };
          }
        }
      }
    }
    if (!result.data) {
      return { ok: false, error: result.error || "Section regenerator failed to return valid JSON", logId: result.logId, validationOutcome: result.validationOutcome };
    }
    const pruned = pruneWorkout(result.data, filtered);
    if (pruned.blocks.length === 0) {
      return { ok: false, error: "Regenerated workout contained no usable exercises after catalogue check", logId: result.logId, validationOutcome: result.validationOutcome };
    }
    return {
      ok: true,
      kind: "workout",
      weekNumber: args.weekNumber,
      dayPosition: args.targetDayPosition,
      workoutIndex: args.workoutIndex!,
      data: pruned,
      logId: result.logId,
      validationOutcome: result.validationOutcome,
      safetyFlags: result.safetyFlags,
    };
  }

  // Day regeneration
  const daySchema = dayPlanSchema as unknown as z.ZodType<z.infer<typeof dayPlanSchema>>;
  let result = await aiCall<z.infer<typeof dayPlanSchema>>({
    feature: "programme_section_regen",
    prompt: buildRegenerateDayPrompt(args, catalogueText, contextSummary),
    userId,
    schema: daySchema,
    maxTokens: 4000,
    temperature: 0.4,
    timeoutMs: 60_000,
  });
  if (result.data) {
    const ids = result.data.workouts.flatMap(w => w.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId)));
    const bad = unknownIds(ids, validIds);
    if (bad.length > 0) {
      const retryHint = `Your previous response used exerciseLibraryId values not in the catalogue: ${bad.join(", ")}. Use only valid catalogue IDs.`;
      result = await aiCall<z.infer<typeof dayPlanSchema>>({
        feature: "programme_section_regen",
        prompt: buildRegenerateDayPrompt(args, catalogueText, contextSummary, retryHint),
        userId,
        schema: daySchema,
        maxTokens: 4000,
        temperature: 0.2,
        timeoutMs: 60_000,
      });
      if (result.data) {
        const stillBad = unknownIds(result.data.workouts.flatMap(w => w.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId))), validIds);
        if (stillBad.length > 0) {
          return { ok: false, error: `Generator returned exerciseLibraryId values not in the catalogue after one repair attempt: ${stillBad.join(", ")}`, logId: result.logId, validationOutcome: result.validationOutcome };
        }
      }
    }
  }
  if (!result.data) {
    return { ok: false, error: result.error || "Section regenerator failed to return valid JSON", logId: result.logId, validationOutcome: result.validationOutcome };
  }
  const prunedDay = {
    ...result.data,
    position: args.targetDayPosition,
    workouts: result.data.workouts
      .map(w => pruneWorkout(w, filtered))
      .filter(w => w.blocks.length > 0),
  };
  if (prunedDay.workouts.length === 0) {
    return { ok: false, error: "Regenerated day contained no usable exercises after catalogue check", logId: result.logId, validationOutcome: result.validationOutcome };
  }
  return {
    ok: true,
    kind: "day",
    weekNumber: args.weekNumber,
    data: prunedDay,
    logId: result.logId,
    validationOutcome: result.validationOutcome,
    safetyFlags: result.safetyFlags,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function saveGeneratedProgramme(args: {
  inputs: ProgrammeInputs;
  data: GeneratedProgramme;
  userId: string;
  isAdmin: boolean;
  aiCallLogId?: number;
  provider?: string;
  model?: string;
  imageUrl?: string | null;
}) {
  const { inputs, data, userId, isAdmin, aiCallLogId } = args;

  // Validate every exerciseLibraryId is real before any DB writes.
  const ids = collectExerciseIds(data);
  const valid = await db.select({ id: exerciseLibrary.id }).from(exerciseLibrary);
  const validSet = new Set(valid.map(r => r.id));
  const bad = unknownIds(ids, validSet);
  if (bad.length > 0) {
    throw new Error(`Refusing to save: unknown exerciseLibraryId(s) ${bad.join(", ")}`);
  }

  // 1) Programme row — created via storage so we mirror existing semantics.
  // Persist the actual number of generated weeks (not the requested value),
  // so programs.weeks always matches what's in program_weeks/program_days.
  const generatedWeekCount = data.weeks.length;
  const program = await storage.createProgram({
    title: data.title,
    description: data.description,
    goal: inputs.goal,
    equipment: inputs.equipment,
    duration: inputs.sessionDuration,
    weeks: generatedWeekCount,
    trainingDaysPerWeek: inputs.daysPerWeek,
    difficulty: data.difficulty,
    programmeType: inputs.programmeType || "main",
    sourceType: isAdmin ? "manual" : "user_created",
    createdByUserId: isAdmin ? null : userId,
    imageUrl: args.imageUrl ?? null,
    source: "ai",
    generationInputs: inputs,
  });

  // 2) Insert each week → days → workouts → blocks → exercises directly.
  // We do not use storage.createProgrammeWorkout here because that helper
  // only targets Week 1; we need full multi-week persistence for AI
  // programmes so progressive overload across weeks survives.
  for (const week of data.weeks) {
    const [weekRow] = await db.insert(programWeeks).values({
      programId: program.id,
      weekNumber: week.weekNumber,
    }).returning();

    for (const day of week.days) {
      const [dayRow] = await db.insert(programDays).values({
        weekId: weekRow.id,
        position: day.position,
      }).returning();

      for (let wIdx = 0; wIdx < day.workouts.length; wIdx++) {
        const w = day.workouts[wIdx];
        const [workoutRow] = await db.insert(programmeWorkoutsTable).values({
          dayId: dayRow.id,
          name: w.name,
          description: w.description ?? null,
          workoutType: "regular",
          category: w.category,
          difficulty: w.difficulty,
          duration: w.duration,
          position: wIdx,
        }).returning();

        for (let bIdx = 0; bIdx < w.blocks.length; bIdx++) {
          const b = w.blocks[bIdx];
          const [blockRow] = await db.insert(programmeWorkoutBlocks).values({
            workoutId: workoutRow.id,
            section: b.section,
            blockType: b.blockType,
            position: bIdx,
            rest: b.rest || null,
          }).returning();

          for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
            const ex = b.exercises[eIdx];
            await db.insert(programmeBlockExercises).values({
              blockId: blockRow.id,
              exerciseLibraryId: ex.exerciseLibraryId,
              position: eIdx,
              sets: ex.sets,
              tempo: ex.tempo || null,
              load: ex.load || null,
              notes: ex.notes || null,
            });
          }
        }
      }
    }
  }

  // 3) Audit row
  await db.insert(programGenerations).values({
    userId,
    kind: "programme",
    inputs,
    rawResponse: data,
    provider: args.provider || null,
    model: args.model || null,
    programId: program.id,
    workoutId: null,
    aiCallLogId: aiCallLogId ?? null,
  });

  return program;
}

export async function saveGeneratedWorkout(args: {
  inputs: WorkoutInputs;
  data: GeneratedWorkout;
  userId: string;
  aiCallLogId?: number;
  provider?: string;
  model?: string;
  /** When true, also schedule this workout for today on the user's calendar. */
  scheduleForToday?: boolean;
}) {
  const { inputs, data, userId, aiCallLogId } = args;

  const ids = data.blocks.flatMap(b => b.exercises.map(e => e.exerciseLibraryId));
  const valid = await db.select({ id: exerciseLibrary.id }).from(exerciseLibrary);
  const validSet = new Set(valid.map(r => r.id));
  const bad = unknownIds(ids, validSet);
  if (bad.length > 0) {
    throw new Error(`Refusing to save: unknown exerciseLibraryId(s) ${bad.join(", ")}`);
  }

  // Reverse-map the AI's constrained category onto the richer goal vocabulary
  // so AI-generated workouts populate the new programme-aligned fields.
  const categoryToGoal: Record<string, string> = {
    strength: "strength",
    cardio: "conditioning",
    hiit: "hiit",
    mobility: "mobility",
    recovery: "corrective",
  };
  const derivedGoal = categoryToGoal[data.category] || "strength";

  const [workout] = await db.insert(workouts).values({
    title: data.name,
    description: data.description || "",
    category: data.category,
    goal: derivedGoal,
    duration: data.duration,
    difficulty: data.difficulty,
    equipment: inputs.equipment ? [inputs.equipment] : [],
    equipmentLevel: inputs.equipment || null,
    categories: [],
    targetAreas: [],
    routineType: "workout",
    workoutType: "regular",
    userId,
    sourceType: "user",
    source: "ai",
    generationInputs: inputs,
  }).returning();

  for (let bIdx = 0; bIdx < data.blocks.length; bIdx++) {
    const b = data.blocks[bIdx];
    const [blockRow] = await db.insert(workoutBlocks).values({
      workoutId: workout.id,
      section: b.section,
      blockType: b.blockType,
      position: bIdx,
      rest: b.rest || null,
    }).returning();

    for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
      const ex = b.exercises[eIdx];
      await db.insert(blockExercises).values({
        blockId: blockRow.id,
        exerciseLibraryId: ex.exerciseLibraryId,
        position: eIdx,
        sets: ex.sets,
        tempo: ex.tempo || null,
        load: ex.load || null,
        notes: ex.notes || null,
      });
    }
  }

  await db.insert(programGenerations).values({
    userId,
    kind: "workout",
    inputs,
    rawResponse: data,
    provider: args.provider || null,
    model: args.model || null,
    programId: null,
    workoutId: workout.id,
    aiCallLogId: aiCallLogId ?? null,
  });

  // Place into today's slot. If the user has an active main programme with
  // snapshot data, we attach the AI session as an `enrollmentWorkout` row
  // overridden to today's date so it surfaces inside the programme flow
  // (logging / progression semantics match the rest of the programme),
  // rather than appearing as a detached "individual" calendar entry. If no
  // active enrollment exists we fall back to the standalone scheduled slot.
  if (args.scheduleForToday) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let attachedToProgramme = false;
    try {
      const [activeEnrollment] = await db
        .select()
        .from(userProgramEnrollments)
        .where(and(
          eq(userProgramEnrollments.userId, userId),
          eq(userProgramEnrollments.status, "active"),
          eq(userProgramEnrollments.programType, "main"),
        ))
        .limit(1);

      if (activeEnrollment) {
        // Locate any existing snapshot row to use as a templateWorkoutId
        // anchor (the column is not nullable).
        const [snapshot] = await db
          .select({ templateWorkoutId: enrollmentWorkouts.templateWorkoutId })
          .from(enrollmentWorkouts)
          .where(eq(enrollmentWorkouts.enrollmentId, activeEnrollment.id))
          .limit(1);

        if (snapshot) {
          const startDate = new Date(activeEnrollment.startDate);
          const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const todayLocal = new Date();
          const todayOnly = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
          const daysElapsed = Math.max(0, Math.floor((todayOnly.getTime() - startOnly.getTime()) / 86400000));
          const currentWeek = Math.floor(daysElapsed / 7) + 1;
          const currentDay = (daysElapsed % 7) + 1;

          const [enrollmentWorkout] = await db.insert(enrollmentWorkouts).values({
            enrollmentId: activeEnrollment.id,
            templateWorkoutId: snapshot.templateWorkoutId,
            weekNumber: currentWeek,
            dayNumber: currentDay,
            scheduledDateOverride: today,
            name: data.name,
            description: data.description || null,
            workoutType: "regular",
            category: data.category,
            difficulty: data.difficulty,
            duration: data.duration,
            position: 99, // push to end so it doesn't collide with planned workouts
          }).returning();

          for (let bIdx = 0; bIdx < data.blocks.length; bIdx++) {
            const b = data.blocks[bIdx];
            const [blockRow] = await db.insert(enrollmentWorkoutBlocks).values({
              enrollmentWorkoutId: enrollmentWorkout.id,
              templateBlockId: null,
              section: b.section,
              blockType: b.blockType,
              position: bIdx,
              rest: b.rest || null,
            }).returning();

            for (let eIdx = 0; eIdx < b.exercises.length; eIdx++) {
              const ex = b.exercises[eIdx];
              await db.insert(enrollmentBlockExercises).values({
                enrollmentBlockId: blockRow.id,
                templateExerciseId: null,
                exerciseLibraryId: ex.exerciseLibraryId,
                position: eIdx,
                sets: ex.sets,
                tempo: ex.tempo || null,
                load: ex.load || null,
                notes: ex.notes || null,
              });
            }
          }
          attachedToProgramme = true;
        }
      }
    } catch (err: any) {
      console.warn("[saveGeneratedWorkout] enrollment attach failed, falling back to scheduledWorkouts:", err?.message);
    }

    if (!attachedToProgramme) {
      await db.insert(scheduledWorkouts).values({
        userId,
        workoutId: workout.id,
        workoutType: "individual",
        workoutName: data.name,
        scheduledDate: today,
      });
    }
  }

  return workout;
}
