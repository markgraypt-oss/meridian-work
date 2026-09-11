import { z } from "zod";
import { aiCall } from "./index";
import {
  loadExerciseCatalogue,
  filterCatalogueByEquipment,
  filterCatalogueByContraindications,
  generatedWorkoutSchema,
  buildContextHints,
  type CatalogueEntry,
  type GeneratedWorkout,
  type WorkoutInputs,
} from "./programmeGenerator";

// ============================================================================
// One-off workout generator (rebuilt 11 Sep 2026)
//
// The previous version handed the model a 250-line exercise catalogue
// (~10k tokens) plus ~12k tokens of coaching text, asked it to write the full
// per-set JSON, and then ran three layers of repair when the shape came back
// wrong. It cost $0.10-0.17 a go, took 25-47 s, and - because the 60k-char
// prompt cap sliced the output-shape instructions off the end - failed every
// time from late August.
//
// This version does the expensive work in code:
//   1. SHORTLIST  - a deterministic, pattern-balanced candidate set (~40-60
//                   exercises, ~1.5k tokens) built from the library's own tags
//                   (movement pattern, primary muscle, level, equipment) and
//                   the words in the user's request.
//   2. COMPACT    - the model returns exercise id + sets + reps + rest + block
//                   type only (~300 output tokens), not the per-set structure.
//   3. EXPAND     - the server expands that into the GeneratedWorkout shape the
//                   app already consumes, applying the rest hierarchy.
// Stable text (rules + Mark's build method) and the shortlist go in cached
// system blocks; only the user's request is in the user message.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Request parsing (the app sends free text in `notes`)
// ---------------------------------------------------------------------------

type Focus =
  | "full_body" | "upper" | "lower" | "push" | "pull" | "glutes" | "core"
  | "conditioning" | "mobility";

export function parseFocus(text: string, explicit?: string): Focus {
  const t = `${explicit || ""} ${text || ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  if (has(/\b(mobility|stretch|recovery|flexibility|yoga|low[- ]impact)\b/)) return "mobility";
  if (has(/\b(conditioning|circuit|hiit|cardio|metcon|engine|interval)\b/)) return "conditioning";
  if (has(/\bglutes?\b/)) return "glutes";
  if (has(/\b(core|abs|abdominal)\b/) && !has(/\b(full[- ]body|upper|lower|legs?)\b/)) return "core";
  if (has(/\bpush\b/) && !has(/\bpull\b/)) return "push";
  if (has(/\bpull\b/) && !has(/\bpush\b/)) return "pull";
  if (has(/\b(upper[- ]body|upper|arms?|chest|back|shoulders?)\b/) && !has(/\b(lower|legs?|full[- ]body)\b/)) return "upper";
  if (has(/\b(lower[- ]body|lower|legs?|leg day|quads?|hamstrings?)\b/) && !has(/\b(upper|full[- ]body)\b/)) return "lower";
  return "full_body";
}

// Which library equipment tags the user has. Undefined = no restriction.
export function parseEquipment(text: string, explicit?: string): Set<string> | undefined {
  const t = (text || "").toLowerCase();
  const allowed = new Set<string>(["Bodyweight"]);
  let restricted = false;
  if (explicit === "bodyweight" || /\bbody\s*weight\s*(only)?\b/.test(t) || /\bno equipment\b/.test(t)) {
    restricted = true;
  }
  if (/\bdumbbells?\b|\bdbs?\b/.test(t)) { allowed.add("Dumbbell"); restricted = true; }
  if (/\bkettlebells?\b|\bkbs?\b/.test(t)) { allowed.add("Kettlebell"); restricted = true; }
  if (/\bbands?\b/.test(t)) { allowed.add("Long Band"); allowed.add("Short Band"); allowed.add("Band"); restricted = true; }
  if (/\bbarbell\b/.test(t)) { allowed.add("Barbell"); allowed.add("Plate"); restricted = true; }
  if (/\bbench\b/.test(t)) { allowed.add("Bench"); restricted = true; }
  if (/\btrx\b|\bsuspension\b/.test(t)) { allowed.add("TRX"); restricted = true; }
  if (/\bfull gym\b|\bgym access\b|\bat the gym\b|\bcommercial gym\b/.test(t) || explicit === "full_gym") {
    return undefined;
  }
  if (explicit === "home_gym") {
    ["Dumbbell", "Kettlebell", "Long Band", "Short Band", "Band", "Bench", "Box/Step", "Plate", "Medicine Ball", "Swiss Ball", "TRX", "Foam Roller", "Lacrosse Ball"].forEach((x) => allowed.add(x));
    return allowed;
  }
  return restricted ? allowed : undefined;
}

// Exercise names / movements the user asked for by name. Same stemming idea as
// the programme generator's ranker, kept local so the two can evolve apart.
const STOPWORDS = new Set([
  "functional", "strength", "workout", "moderate", "intensity", "include", "heavy", "light",
  "full", "body", "access", "with", "that", "this", "gym", "session", "training", "exercise",
  "minute", "minutes", "focus", "level", "want", "need", "some", "more", "less", "into", "from",
  "your", "their", "today", "please", "build", "give", "make", "based", "using", "around", "work",
  "upper", "lower", "easy", "hard", "quick", "only", "dumbbell", "dumbbells", "kettlebell",
  "barbell", "band", "bands", "bodyweight", "legs", "push", "pull", "core", "glutes", "circuit",
  "conditioning", "cardio", "hiit", "mobility", "sore", "left", "right", "jumping",
]);
function stem(w: string): string {
  return w.replace(/(ings|ing|ies|es|s)$/, "");
}
export function parseRequestedStems(text: string): string[] {
  return Array.from(new Set(
    (text || "").toLowerCase().split(/[^a-z]+/)
      .filter((w) => w.length >= 4)
      .map(stem)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  ));
}

// ---------------------------------------------------------------------------
// 2. Shortlist
// ---------------------------------------------------------------------------

type Pattern =
  | "squat" | "hinge" | "lunge" | "hpush" | "vpush" | "hpull" | "vpull"
  | "core" | "carry" | "arms" | "calves" | "conditioning" | "mobility" | "glute";

const PATTERN_LABEL: Record<Pattern, string> = {
  squat: "squat", hinge: "hinge", lunge: "lunge/single-leg", hpush: "horizontal push",
  vpush: "vertical push", hpull: "horizontal pull", vpull: "vertical pull", core: "core",
  carry: "carry", arms: "arms", calves: "calves", conditioning: "conditioning",
  mobility: "mobility", glute: "glute isolation",
};

function patternsOf(e: CatalogueEntry): Pattern[] {
  const mv = (e.movement || []).map((m) => m.toLowerCase());
  const name = (e.name || "").toLowerCase();
  const primary = (e.primaryMuscle || "").toLowerCase();
  const out: Pattern[] = [];
  const hasMv = (s: string) => mv.some((m) => m.includes(s));
  if (/\bcarry\b|farmer|suitcase|rack walk|waiter walk/.test(name)) out.push("carry");
  if (hasMv("squat")) out.push("squat");
  if (hasMv("hip hinge")) out.push("hinge");
  if (hasMv("lunge")) out.push("lunge");
  if (hasMv("horizontal push")) out.push("hpush");
  if (hasMv("vertical push")) out.push("vpush");
  if (hasMv("horizontal pull")) out.push("hpull");
  if (hasMv("vertical pull")) out.push("vpull");
  if (hasMv("core")) out.push("core");
  if (hasMv("elbow flexion") || hasMv("elbow extension")) out.push("arms");
  if (/calf|calves/.test(name) || primary === "calves") out.push("calves");
  if (hasMv("cardio") || hasMv("plyometric") || hasMv("general conditioning")) out.push("conditioning");
  if (hasMv("mobility") || hasMv("static stretch")) out.push("mobility");
  if (/assault bike|air bike|echo bike|rower|rowing|ski erg|skierg|treadmill|sprint|burpee|jump rope|skipping|sled|battle rope|shuttle/.test(name) && !out.includes("conditioning")) out.push("conditioning");
  // ~15% of the library carries only a laterality tag ("Alternating",
  // "Bilateral") or nothing at all. Fall back to the primary muscle so those
  // entries (most of the curls and extensions, for instance) still land in a
  // bucket instead of being invisible to the generator.
  const patterned = out.some((p) => p !== "carry" && p !== "calves" && p !== "conditioning" && p !== "mobility");
  if (!patterned) {
    if (primary === "biceps" || primary === "triceps" || primary === "forearms") out.push("arms");
    else if (primary === "chest") out.push("hpush");
    else if (primary === "shoulders") out.push("vpush");
    else if (primary === "lats" || primary === "middle back" || primary === "traps" || primary === "posterior shoulder") out.push("hpull");
    else if (primary === "quads") out.push(/step[- ]?up|split|lunge|pistol/.test(name) ? "lunge" : "squat");
    else if (primary === "hamstrings" || primary === "lower back") out.push("hinge");
    else if (primary === "abs" || primary === "obliques") out.push("core");
    else if (primary === "glutes") out.push(/bridge|thrust|kickback|clam|abduct|fire hydrant/.test(name) ? "glute" : "hinge");
  }
  if (primary === "glutes" && !out.includes("hinge") && !out.includes("squat") && !out.includes("lunge") && !out.includes("glute")) out.push("glute");
  return out;
}

// Soft-tissue tools are for the warm-up the app handles separately; they
// never belong in a lifting shortlist.
function isSoftTissue(e: CatalogueEntry): boolean {
  return (e.equipment || []).some((x) => /foam roller|lacrosse ball/i.test(x));
}

const QUOTAS: Record<Focus, Partial<Record<Pattern, number>>> = {
  full_body:    { squat: 6, hinge: 6, lunge: 4, hpush: 5, vpush: 4, hpull: 6, vpull: 4, core: 6, carry: 3, conditioning: 3 },
  upper:        { hpush: 8, vpush: 6, hpull: 8, vpull: 6, arms: 5, core: 5, carry: 3 },
  lower:        { squat: 8, hinge: 8, lunge: 8, glute: 4, calves: 3, core: 5, carry: 2 },
  glutes:       { hinge: 10, glute: 10, lunge: 6, squat: 5, core: 4 },
  push:         { hpush: 10, vpush: 8, arms: 5, core: 5, squat: 3 },
  pull:         { hpull: 10, vpull: 8, arms: 5, hinge: 5, core: 4, carry: 3 },
  core:         { core: 14, carry: 5, conditioning: 4, hinge: 3, squat: 3 },
  conditioning: { conditioning: 10, squat: 5, hinge: 5, lunge: 4, hpush: 4, hpull: 4, core: 5, carry: 4 },
  mobility:     { mobility: 24, core: 6, glute: 4 },
};

const LEVEL_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

export interface ShortlistOptions {
  focus: Focus;
  difficulty: string;
  allowedEquipment?: Set<string>;
  requestedStems: string[];
  favouriteExercises?: string[];
  favouriteEquipment?: string[];
}

export function buildShortlist(catalogue: CatalogueEntry[], opts: ShortlistOptions): CatalogueEntry[] {
  const want = LEVEL_RANK[(opts.difficulty || "intermediate").toLowerCase()] ?? 2;
  const favNames = (opts.favouriteExercises || []).map((s) => s.toLowerCase());
  const favEquip = (opts.favouriteEquipment || []).map((s) => s.toLowerCase());
  const liftingFocus = opts.focus !== "mobility";

  const eligible = catalogue.filter((e) => {
    if (opts.allowedEquipment) {
      const eq = e.equipment || [];
      if (eq.length > 0 && !eq.every((x) => opts.allowedEquipment!.has(x))) return false;
    }
    if (liftingFocus && isSoftTissue(e)) return false;
    const lvl = LEVEL_RANK[(e.level || "beginner").toLowerCase()] ?? 1;
    // Nobody sees exercises above their requested level; advanced sees all.
    if (lvl > want) return false;
    return true;
  });

  const score = (e: CatalogueEntry): number => {
    const name = (e.name || "").toLowerCase();
    const lvl = LEVEL_RANK[(e.level || "beginner").toLowerCase()] ?? 1;
    let s = 0;
    if (lvl === want) s += 3; else if (lvl === want - 1) s += 1;
    if (liftingFocus && (e.exerciseType || "") === "strength") s += 1;
    for (const w of opts.requestedStems) if (name.includes(w)) s += 5;
    if (favNames.some((f) => f && name.includes(f))) s += 3;
    if (favEquip.length && (e.equipment || []).some((x) => favEquip.includes(x.toLowerCase()))) s += 1;
    // Assisted / regression variants are for beginners only.
    if (want >= 2 && /assisted|regression|rehab|band assisted/.test(name)) s -= 4;
    return s;
  };

  const ranked = eligible
    .map((e) => ({ e, s: score(e), p: patternsOf(e) }))
    .sort((a, b) => (b.s - a.s) || (a.e.id - b.e.id));

  const chosen = new Map<number, CatalogueEntry>();
  // Anything the user named goes in first, regardless of pattern quotas.
  if (opts.requestedStems.length) {
    for (const r of ranked) {
      if (chosen.size >= 10) break;
      const name = (r.e.name || "").toLowerCase();
      if (opts.requestedStems.some((w) => name.includes(w))) chosen.set(r.e.id, r.e);
    }
  }
  for (const [pat, quota] of Object.entries(QUOTAS[opts.focus]) as Array<[Pattern, number]>) {
    let n = 0;
    for (const r of ranked) {
      if (n >= quota) break;
      if (!r.p.includes(pat) || chosen.has(r.e.id)) continue;
      chosen.set(r.e.id, r.e);
      n++;
    }
  }
  return Array.from(chosen.values()).sort((a, b) => a.id - b.id);
}

function shortlistLine(e: CatalogueEntry): string {
  const pats = patternsOf(e).map((p) => PATTERN_LABEL[p]).join("/") || "other";
  const uni = (e.movement || []).some((m) => /unilateral/i.test(m)) ? "; unilateral" : "";
  const equip = (e.equipment || []).join("/") || "none";
  return `#${e.id} ${e.name} (${e.primaryMuscle || (e.mainMuscle || [])[0] || "?"}; ${equip}; ${e.level || "?"}; ${pats}${uni})`;
}

// ---------------------------------------------------------------------------
// 3. Compact model output + expansion
// ---------------------------------------------------------------------------

const compactExercise = z.object({
  id: z.number().int().positive(),
  sets: z.number().int().min(1).max(8),
  reps: z.union([z.string(), z.number()]),
  load: z.string().nullable().optional(),
});
const compactBlock = z.object({
  type: z.enum(["single", "superset", "triset", "circuit"]).default("single"),
  rest: z.string().nullable().optional(),
  exercises: z.array(compactExercise).min(1).max(6),
});
const compactWorkoutSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
  category: z.enum(["strength", "cardio", "hiit", "mobility", "recovery"]).default("strength"),
  blocks: z.array(compactBlock).min(1).max(8),
});
type CompactWorkout = z.infer<typeof compactWorkoutSchema>;

// Tolerate the two shapes the model most often drifts to (sets as an array,
// reps/rest nested) so a near-miss never costs a second call.
function coerceCompact(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const blocks = Array.isArray(obj.blocks) ? obj.blocks : Array.isArray(obj.exercises) ? [{ type: "single", exercises: obj.exercises }] : [];
  return {
    name: obj.name ?? obj.sessionName ?? obj.title,
    description: obj.description ?? obj.sessionDescription ?? null,
    category: obj.category,
    blocks: blocks.map((b: any) => ({
      type: b?.type ?? b?.blockType ?? "single",
      rest: b?.rest != null ? String(b.rest) : null,
      exercises: (Array.isArray(b?.exercises) ? b.exercises : []).map((ex: any) => {
        const setsArr = Array.isArray(ex?.sets) ? ex.sets : null;
        const sets = setsArr ? setsArr.length : Number.parseInt(String(ex?.sets ?? 3), 10);
        const reps = ex?.reps ?? setsArr?.[0]?.reps ?? setsArr?.[0]?.duration ?? "10";
        return {
          id: Number.parseInt(String(ex?.id ?? ex?.exerciseLibraryId ?? ex?.exerciseId ?? ""), 10),
          sets: Number.isFinite(sets) && sets > 0 ? Math.min(8, sets) : 3,
          reps: String(reps),
          load: ex?.load != null ? String(ex.load) : null,
        };
      }),
    })),
  };
}

function restForReps(reps: string): string {
  const n = Number.parseInt(reps, 10);
  if (!Number.isFinite(n)) return "60 sec"; // timed / AMRAP / "per side"
  if (n <= 6) return "150 sec";
  if (n <= 12) return "90 sec";
  return "60 sec";
}
function normaliseRest(r: string | null | undefined): string | null {
  if (r == null) return null;
  const s = String(r).trim();
  if (!s || /^(none|n\/?a|0)$/i.test(s)) return null;
  const n = s.match(/^(\d+)\s*$/);
  return n ? `${n[1]} sec` : s;
}

export function expandCompactWorkout(c: CompactWorkout, inputs: WorkoutInputs): GeneratedWorkout {
  const difficulty = (["beginner", "intermediate", "advanced"].includes(inputs.difficulty) ? inputs.difficulty : "intermediate") as GeneratedWorkout["difficulty"];
  const blocks = c.blocks.map((b) => {
    const blockRest = normaliseRest(b.rest) ?? restForReps(String(b.exercises[0]?.reps ?? ""));
    return {
      section: "main" as const,
      blockType: b.type,
      rest: blockRest,
      exercises: b.exercises.map((ex) => {
        const reps = String(ex.reps).trim();
        const timed = /\b(sec|secs|min|mins|s)\b/i.test(reps);
        return {
          exerciseLibraryId: ex.id,
          sets: Array.from({ length: ex.sets }, () => (timed ? { duration: reps, rest: blockRest } : { reps, rest: blockRest })),
          load: ex.load ?? null,
          tempo: null,
          notes: null,
        };
      }),
    };
  });
  return {
    name: c.name.slice(0, 80),
    description: c.description ? c.description.slice(0, 400) : null,
    category: c.category,
    difficulty,
    duration: Math.max(5, Math.min(180, inputs.duration || 45)),
    blocks,
  };
}

// ---------------------------------------------------------------------------
// 4. Prompt
// ---------------------------------------------------------------------------

function buildRules(coachingContext: string): string {
  return [
    "You are an evidence-based S&C coach designing ONE training session for one person today.",
    "Choose exercises ONLY from the SHORTLIST by their numeric id. Every id you use must appear in the shortlist. Never invent ids.",
    "If the request names specific exercises or movements (deadlift, pull ups, squat, bench...), you MUST include the matching shortlist exercises; honouring named movements beats your default picks.",
    "Match the requested difficulty: for intermediate or advanced pick standard or loaded variants, never assisted, banded-assist or rehab regressions.",
    "Do NOT include warm-up, soft-tissue, mobility-prep or activation items: the app adds the person's warm-up separately. Start at the main compound lift (tier 4 of the method below) and stop after the finisher. Every block is a main block.",
    "Default to traditional sets: \"single\" for standalone lifts, \"superset\" for two paired exercises, \"triset\" for three. Use \"circuit\" ONLY when the request explicitly asks for a circuit, HIIT or conditioning.",
    "A full session is 6 to 9 exercises following the method's order: main compound first (heaviest, longest rest), then secondary/unilateral, then accessory supersets, then a short core/carry/finisher. Never return a thin 4 to 5 exercise session for a full-body request. Short requests (15 to 20 min) get 4 to 5 exercises.",
    "Respect the push:pull house ratio and the 'stimulate, do not annihilate' principle. Rest: 150 sec for heavy low-rep compounds, 90 sec for moderate work, 60 sec for accessories and circuits.",
    "Avoid medical claims. Do not diagnose, prescribe, or describe injuries. If a region is flagged as sore, keep load off it.",
    "Write the name and one-sentence description in Mark's voice: plain, direct, no hype, no em dashes.",
    "",
    coachingContext,
  ].join("\n");
}

const OUTPUT_SHAPE = `Return ONLY a raw JSON object, no markdown, no prose, using EXACTLY this shape:
{
  "name": "Upper Strength",
  "description": "Heavy press and row, then arms and core.",
  "category": "strength" | "cardio" | "hiit" | "mobility" | "recovery",
  "blocks": [
    { "type": "single", "rest": "150 sec", "exercises": [ { "id": 101, "sets": 4, "reps": "5", "load": "heavy" } ] },
    { "type": "superset", "rest": "90 sec", "exercises": [ { "id": 202, "sets": 3, "reps": "8" }, { "id": 303, "sets": 3, "reps": "10" } ] }
  ]
}
Rules for the shape: "sets" is a NUMBER of working sets (1 to 8). "reps" is a short string: a number ("8"), a range ("8-10"), "AMRAP", "10 per side", or a time for timed work ("40 sec"). "load" is optional: "heavy", "moderate", "light", "bodyweight", or a cue like "RPE 8". One "rest" per block. No other keys anywhere.`;

// ---------------------------------------------------------------------------
// 5. Entry point (same signature and result shape as before)
// ---------------------------------------------------------------------------

export async function generateWorkoutWithAI(inputs: WorkoutInputs, userId: string) {
  const notes = inputs.notes || "";
  const focus = parseFocus(notes, inputs.focus);
  const allowedEquipment = parseEquipment(notes, inputs.equipment);
  const requestedStems = parseRequestedStems(`${notes} ${inputs.focus || ""} ${inputs.goal || ""}`);

  const fullCatalogue = await loadExerciseCatalogue();
  const equipFiltered = filterCatalogueByEquipment(fullCatalogue, inputs.equipment);
  const filtered = filterCatalogueByContraindications(
    equipFiltered,
    inputs.contraindications || [],
    inputs.avoidExerciseIds || [],
  );

  const baseOpts = {
    focus,
    difficulty: inputs.difficulty,
    requestedStems,
    favouriteExercises: inputs.workoutHistory?.topExercises,
    favouriteEquipment: inputs.workoutHistory?.topEquipment,
  };
  let shortlist = buildShortlist(filtered, { ...baseOpts, allowedEquipment });
  // An over-tight equipment parse must never starve the model: fall back to
  // no equipment restriction rather than a 6-exercise shortlist.
  if (shortlist.length < 12 && allowedEquipment) {
    shortlist = buildShortlist(filtered, baseOpts);
  }
  if (shortlist.length === 0) {
    return { ok: false as const, error: "No eligible exercises for this request after equipment and injury filters", validationOutcome: "invalid" as const };
  }
  const shortlistIds = new Set(shortlist.map((e) => e.id));
  const shortlistText = `SHORTLIST (${shortlist.length} exercises; use only these ids):\n${shortlist.map(shortlistLine).join("\n")}`;

  let coachingContext = "";
  try {
    const { getCoachingContext } = await import("../aiProvider");
    coachingContext = await getCoachingContext("workout_generator");
  } catch {}

  // Block order is most-stable first: rules + method (identical for every
  // request) then the shortlist (identical for the same focus / equipment /
  // level / named movements, so repeat requests of the same kind hit cache).
  const system = [buildRules(coachingContext), shortlistText];

  const request = [
    `REQUEST: ${notes || "(no notes)"}`,
    `Session length: ${inputs.duration} minutes. Difficulty: ${inputs.difficulty}. Focus: ${focus.replace("_", " ")}.`,
    allowedEquipment ? `Equipment available: ${Array.from(allowedEquipment).join(", ")}.` : "Equipment: full gym.",
    buildContextHints(inputs),
  ].filter(Boolean).join("\n");

  const call = (extraHint?: string, temperature = 0.4) => aiCall<CompactWorkout>({
    feature: "workout_generator",
    userId,
    system,
    prompt: `${request}\n${extraHint ? `\n${extraHint}\n` : ""}\n${OUTPUT_SHAPE}`,
    schema: compactWorkoutSchema as unknown as z.ZodType<CompactWorkout>,
    preValidate: coerceCompact,
    maxTokens: 900,
    temperature,
    timeoutMs: 40_000,
  });

  let result = await call();

  // Drop hallucinated ids; if that leaves too little, one retry with the bad
  // ids named. Cached system blocks make the retry cheap.
  const prune = (c: CompactWorkout | null) => {
    if (!c) return { kept: null as CompactWorkout | null, bad: [] as number[] };
    const bad: number[] = [];
    const blocks = c.blocks
      .map((b) => ({ ...b, exercises: b.exercises.filter((ex) => { const ok = shortlistIds.has(ex.id); if (!ok) bad.push(ex.id); return ok; }) }))
      .filter((b) => b.exercises.length > 0);
    return { kept: blocks.length ? { ...c, blocks } : null, bad };
  };

  let { kept, bad } = prune(result.data);
  const exerciseCount = (c: CompactWorkout | null) => (c ? c.blocks.reduce((n, b) => n + b.exercises.length, 0) : 0);
  const minExercises = inputs.duration <= 20 ? 3 : 4;
  if (exerciseCount(kept) < minExercises) {
    const hint = bad.length
      ? `Your previous answer used ids that are NOT in the shortlist: ${bad.join(", ")}. Use only shortlist ids, and return the full session again.`
      : `Your previous answer was not usable. Return the full session again as raw JSON in exactly the shape below.`;
    result = await call(hint, 0.2);
    ({ kept, bad } = prune(result.data));
  }

  if (!kept || exerciseCount(kept) === 0) {
    const raw = (result.text || "").replace(/\s+/g, " ").trim();
    const snippet = raw.length > 320 ? `${raw.slice(0, 200)} … ${raw.slice(-120)}` : raw;
    return {
      ok: false as const,
      error: result.error || `Workout generator failed to return a usable session [${result.validationOutcome}] :: ${snippet || "(empty response)"}`,
      logId: result.logId,
      validationOutcome: result.validationOutcome,
    };
  }

  const expanded = expandCompactWorkout(kept, inputs);
  // Belt and braces: the app-facing shape is still validated against the
  // schema the rest of the codebase uses.
  const check = generatedWorkoutSchema.safeParse(expanded);
  if (!check.success) {
    return { ok: false as const, error: `Expanded workout failed schema: ${check.error.issues[0]?.message || "unknown"}`, logId: result.logId, validationOutcome: result.validationOutcome };
  }
  return {
    ok: true as const,
    data: check.data as GeneratedWorkout,
    logId: result.logId,
    validationOutcome: result.validationOutcome,
    safetyFlags: result.safetyFlags,
    shortlistSize: shortlist.length,
  };
}
