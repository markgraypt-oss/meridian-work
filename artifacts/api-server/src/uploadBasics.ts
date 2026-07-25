// ---------------------------------------------------------------------------
// Bulk import: the "Basics" programme series (6 programmes, authored 25 Jul 2026).
//
// Builds six beginner→intermediate programmes with movement-variation progression
// (the featured lift climbs its pyramid every 2 weeks). Authors only the changed
// weeks (1/3/5, or 1/3/5/7 for the 8-week ones); the per-week inheritance engine
// fills the gaps. Idempotent: deletes any existing programme with the same title
// first (cascade), then re-inserts — so re-running is always safe.
//
// Run on Replit after review (same as the micro-reset import):
//   npx tsx -e "import('./server/uploadBasics').then(m => m.runBasicsUpload()).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })"
//
// Exercises are resolved by name against exercise_library; every name is
// pre-validated before ANY insert, so a typo aborts cleanly with zero writes.
// ---------------------------------------------------------------------------

import { db } from "./db";
import {
  programs,
  programWeeks,
  programDays,
  programmeWorkouts,
  programmeWorkoutBlocks,
  programmeBlockExercises,
  exerciseLibrary,
} from "@workspace/db";
import { eq } from "drizzle-orm";

// ---- set / exercise builders -------------------------------------------------
const R = (reps, n = 3) => Array.from({ length: n }, () => ({ reps: String(reps), duration: "" }));
const T = (dur) => [{ reps: "", duration: dur }];
// main-body exercise: 3 sets of `reps` (reps can be a number, "8", or "25 m" for a carry)
const M = (name, reps) => ({ name, sets: R(reps), durationType: "text" });
// warm-up item: 1 set; timer if the value contains "sec", else reps
const W = (name, val) =>
  /sec/i.test(String(val))
    ? { name, sets: T(val), durationType: "timer" }
    : { name, sets: [{ reps: String(val), duration: "" }], durationType: "text" };
const BLK = (section, blockType, rest, exercises) => ({ section, blockType, rest, exercises });

// ---- rest strings (must match the live library convention) -------------------
const R2 = "2 min", R3 = "3 min", R90 = "1 min 30 sec", R60 = "1 min", R45 = "45 sec", NR = "No Rest";

// ---- warm-up presets (per day type) -----------------------------------------
const WU_SQUAT = () => BLK("warmup", "circuit", NR, [
  W("Foam Roller - Thoracic Spine", "30 sec"), W("Foam Roller Thoracic Extension", 10),
  W("Foam Roller - Quad", "45 sec"), W("Foam Roller - Adductor", "45 sec"),
  W("Cat Cow", 8), W("Half-Kneeling Rotation with Forward Lean", 8), W("Worlds Greatest Stretch", 5),
  W("Deep Squat Holds", 3), W("3 Part Shoulder Warm-Up", 10), W("Clamshell", 12),
  W("Single-Leg Glute Bridge", 10), W("Band Lateral Walk", 10),
  W("Band Straight Arm Pulldown", 12), W("Band External Rotation", 12),
]);
const WU_HINGE = () => BLK("warmup", "circuit", NR, [
  W("Lacrosse Ball - Lower Back", "45 sec"), W("Foam Roller - Thoracic Spine", "30 sec"),
  W("Foam Roller Thoracic Extension", 10), W("Foam Roller - Hip", "45 sec"),
  W("Cat Cow", 8), W("Half-Kneeling Hip Flexor Stretch", 8), W("Worlds Greatest Stretch", 5),
  W("Dowell Hip Hinge", 8), W("3 Part Shoulder Warm-Up", 10), W("Bird Dog", 8),
  W("Single-Leg Glute Bridge", 10), W("Band Straight Arm Pulldown", 12), W("Band External Rotation", 12),
]);
const WU_UPPER = () => BLK("warmup", "circuit", NR, [
  W("Foam Roller - Thoracic Spine", "30 sec"), W("Foam Roller Thoracic Extension", 10),
  W("Foam Roller - Lats", "45 sec"), W("Cat Cow", 8), W("Foam Roller Thread The Needle", 8),
  W("Worlds Greatest Stretch", 5), W("3 Part Shoulder Warm-Up", 10), W("Dead Bug", 8),
  W("Clamshell", 12), W("Single-Leg Glute Bridge", 10),
  W("Band Straight Arm Pulldown", 12), W("Band External Rotation", 12),
]);
const WU_PRESS = () => BLK("warmup", "circuit", NR, [
  W("Foam Roller - Thoracic Spine", "30 sec"), W("Foam Roller Thoracic Extension", 10),
  W("Foam Roller - Lats", "45 sec"), W("Foam Roller - Chest", "30 sec"), W("Cat Cow", 8),
  W("Foam Roller Thread The Needle", 8), W("Band Pull Aparts", 15), W("3 Part Shoulder Warm-Up", 10),
  W("Prone Y", 10), W("Dead Bug", 8), W("Band Straight Arm Pulldown", 12), W("Band External Rotation", 12),
]);

// ---- shared session fragments -----------------------------------------------
const SUITCASE = () => M("Dumbbell Suitcase Carry", "25 m");

// =============================================================================
// Programme specs. Each `week(phase)` returns the 3 days for that authored phase;
// only the starred lift(s) differ across phases — accessories are constant, so
// the inheritance engine could carry them, but each authored week is fully
// self-contained (an authored week does NOT inherit).
// =============================================================================

const HOWTO = "HOW TO PROGRESS: work in the rep range leaving 1–2 in the tank; when you hit the top of the range on all sets with clean form, add the smallest jump next session and build back up. The featured lift steps up a variation every fortnight — only when the current one is clean. If it isn't, stay on it, or drop to the one below.";

// ---- SQUAT BASICS 1 ----------------------------------------------------------
const squat1 = [
  ["Bodyweight Box Squat", 12, 15],
  ["Paused Dumbbell Goblet Box Squat", 10, 12],
  ["Heels Elevated Dumbbell Goblet Squat", 10, 12],
  ["Dumbbell Goblet Squat", 8, 10],
];
function squatDays(ladder, heavyRest) {
  return (phase) => {
    const [ex, heavy, vol] = ladder[phase];
    return [
      { name: "Squat Day", description: "Warm up fully and ramp up to the squat, then leave 1–2 in the tank on your working sets. Superset the lettered pairs.", blocks: [
        WU_SQUAT(),
        BLK("main", "single", heavyRest, [M(ex, heavy)]),
        BLK("main", "superset", R90, [M("Flat Dumbbell Press", 8), M("Dumbbell Chest Supported Pronated Row", 10)]),
        BLK("main", "single", R90, [M("Lat Pulldown", 10)]),
        BLK("main", "single", R90, [M("Machine Leg Curl", 12)]),
        BLK("main", "superset", R45, [M("Half-Kneeling Pallof Press", 8), M("Flat Dumbbell Triceps Extension - Neutral", 12)]),
      ] },
      { name: "Hinge & Single-Leg Day", description: "Open on the hinge — push the hips back, flat back. Superset the lettered pairs.", blocks: [
        WU_HINGE(),
        BLK("main", "single", R2, [M("Dumbbell RDL", 8)]),
        BLK("main", "superset", R90, [M("Seated Dumbbell Shoulder Press", 8), M("Single-Arm Dumbbell Row - 90 Degree Abduction", 10)]),
        BLK("main", "superset", R60, [M("Dumbbell Reverse Lunge", 8), M("Reverse Crunch", 12)]),
        BLK("main", "superset", R45, [M("Machine Row - Neutral", 10), M("Incline Dumbbell Curl", 10)]),
      ] },
      { name: "Upper & Squat Volume Day", description: "Open on the upper pair. The second squat is lighter, higher-rep volume — not a second max day.", blocks: [
        WU_UPPER(),
        BLK("main", "superset", R2, [M("Incline Dumbbell Press", 8), M("Single-Arm Dumbbell Row (High Pull)", 10)]),
        BLK("main", "single", R90, [M(ex, vol)]),
        BLK("main", "single", R90, [M("Half-Kneeling 45° Single Arm Pulldown", 10)]),
        BLK("main", "superset", R45, [SUITCASE(), M("Seated Dumbbell Lateral Raise", 12)]),
      ] },
    ];
  };
}

// ---- SQUAT BASICS 2 ----------------------------------------------------------
const squat2 = [
  ["Dumbbell Goblet Squat", 8, 10],
  ["Kettlebell Rack Squat", 8, 10],
  ["Barbell Box Squat", 6, 8],
  ["Barbell Back Squat", 5, 8],
];

// ---- HINGE BASICS 1 / 2 ------------------------------------------------------
const hinge1 = [
  ["Dumbbells To Side RDL", 10],
  ["Dumbbell RDL", 8],
  ["Single-Leg Dumbbell RDL - Shin On Bench", 8],
  ["B-Stance Dumbbell RDL", 8],
];
const hinge2 = [
  ["B-Stance Dumbbell RDL", 8],
  ["Barbell RDL", 8],
  ["Trap Bar Deadlift From Blocks", 6],
  ["Trap Bar Deadlift", 5],
];
function hingeDays(ladder, heavyRest, volumeEx, volumeReps) {
  return (phase) => {
    const [ex, heavy] = ladder[phase];
    return [
      { name: "Hinge Day", description: "The hinge is the star — done fresh and alone. Push the hips back, keep the lats tight, neutral spine.", blocks: [
        WU_HINGE(),
        BLK("main", "single", heavyRest, [M(ex, heavy)]),
        BLK("main", "superset", R90, [M("Flat Dumbbell Press", 8), M("Chest Supported Dumbbell Row", 10)]),
        BLK("main", "single", R90, [M("Lat Pulldown", 10)]),
        BLK("main", "superset", R45, [M("Half-Kneeling Pallof Press", 8), M("Flat Dumbbell Triceps Extension - Neutral", 12)]),
      ] },
      { name: "Squat & Upper Day", description: "Open on the goblet squat. Superset the lettered pairs.", blocks: [
        WU_SQUAT(),
        BLK("main", "single", R2, [M("Dumbbell Goblet Squat", 10)]),
        BLK("main", "superset", R90, [M("Seated Dumbbell Shoulder Press", 8), M("Single-Arm Dumbbell Row - 90 Degree Abduction", 10)]),
        BLK("main", "superset", R60, [M("Dumbbell Reverse Lunge", 8), M("Reverse Crunch", 12)]),
        BLK("main", "superset", R45, [M("Machine Row - Neutral", 10), M("Incline Dumbbell Curl", 10)]),
      ] },
      { name: "Upper & Posterior Volume Day", description: "Open on the upper pair. The second hinge piece is lighter posterior volume — no second heavy pull.", blocks: [
        WU_UPPER(),
        BLK("main", "superset", R2, [M("Incline Dumbbell Press", 8), M("Single-Arm Dumbbell Row (High Pull)", 10)]),
        BLK("main", "single", R90, [M(volumeEx, volumeReps)]),
        BLK("main", "single", R90, [M("Half-Kneeling 45° Single Arm Pulldown", 10)]),
        BLK("main", "superset", R45, [SUITCASE(), M("Seated Dumbbell Lateral Raise", 12)]),
      ] },
    ];
  };
}

// ---- UPPER BODY BASICS -------------------------------------------------------
const ubPress = [["Push Up", 8, 12], ["Incline Dumbbell Press", 10, 12], ["Flat Dumbbell Press", 8, 10]];
const ubRow = [["Chest Supported Dumbbell Row", 10, 12], ["Single Arm Dumbbell Row", 8, 10], ["Split Stance Dumbbell Row", 8, 10]];
function upperDays(phase) {
  const [pEx, pHeavy, pVol] = ubPress[phase];
  const [rEx, rHeavy, rVol] = ubRow[phase];
  return [
    { name: "Press & Row + Squat", description: "Open on the press/row antagonist pair (press heavy, row volume). Superset the lettered pairs.", blocks: [
      WU_PRESS(),
      BLK("main", "superset", R2, [M(pEx, pHeavy), M(rEx, rVol)]),
      BLK("main", "single", R2, [M("Dumbbell Goblet Squat", 10)]),
      BLK("main", "single", R90, [M("Lat Pulldown", 10)]),
      BLK("main", "superset", R45, [M("Half-Kneeling Pallof Press", 8), M("Flat Dumbbell Triceps Extension - Neutral", 12)]),
    ] },
    { name: "Vertical Upper & Hinge", description: "Open on the hinge, then vertical push/pull. Superset the lettered pairs.", blocks: [
      WU_HINGE(),
      BLK("main", "single", R2, [M("Dumbbell RDL", 8)]),
      BLK("main", "superset", R90, [M("Seated Dumbbell Shoulder Press", 8), M("Single-Arm Dumbbell Row - 90 Degree Abduction", 10)]),
      BLK("main", "single", R90, [M("Half-Kneeling 45° Single Arm Pulldown", 10)]),
      BLK("main", "superset", R45, [M("Reverse Crunch", 12), M("Incline Dumbbell Curl", 10)]),
    ] },
    { name: "Row & Press + Lunge", description: "Open on the row/press antagonist pair (row heavy, press volume). Superset the lettered pairs.", blocks: [
      WU_PRESS(),
      BLK("main", "superset", R2, [M(rEx, rHeavy), M(pEx, pVol)]),
      BLK("main", "single", R90, [M("Dumbbell Reverse Lunge", 8)]),
      BLK("main", "single", R90, [M("Cable Straight Arm Pulldown", 12)]),
      BLK("main", "superset", R45, [SUITCASE(), M("Seated Dumbbell Lateral Raise", 12)]),
    ] },
  ];
}

// ---- FULL BODY BASICS --------------------------------------------------------
const fbSquat = [["Paused Dumbbell Goblet Box Squat", 10], ["Heels Elevated Dumbbell Goblet Squat", 10], ["Dumbbell Goblet Squat", 8]];
const fbHinge = [["Dumbbells To Side RDL", 10], ["Dumbbell RDL", 8], ["B-Stance Dumbbell RDL", 8]];
const fbPress = [["Push Up", 8], ["Incline Dumbbell Press", 10], ["Flat Dumbbell Press", 8]];
function fullBodyDays(phase) {
  const [sqEx, sqR] = fbSquat[phase];
  const [hgEx, hgR] = fbHinge[phase];
  const [prEx, prR] = fbPress[phase];
  return [
    { name: "Squat Day", description: "Open on the squat, fresh. Superset the lettered pairs.", blocks: [
      WU_SQUAT(),
      BLK("main", "single", R2, [M(sqEx, sqR)]),
      BLK("main", "superset", R90, [M("Seated Dumbbell Shoulder Press", 8), M("Chest Supported Dumbbell Row", 10)]),
      BLK("main", "single", R90, [M("Lat Pulldown", 10)]),
      BLK("main", "single", R90, [M("Machine Leg Curl", 12)]),
      BLK("main", "superset", R45, [M("Half-Kneeling Pallof Press", 8), M("Flat Dumbbell Triceps Extension - Neutral", 12)]),
    ] },
    { name: "Hinge Day", description: "Open on the hinge, fresh — hips back, neutral spine. Superset the lettered pairs.", blocks: [
      WU_HINGE(),
      BLK("main", "single", R2, [M(hgEx, hgR)]),
      BLK("main", "superset", R90, [M("Dumbbell Floor Press", 10), M("Single-Arm Dumbbell Row - 90 Degree Abduction", 10)]),
      BLK("main", "superset", R90, [M("Dumbbell Reverse Lunge", 8), M("Half-Kneeling 45° Single Arm Pulldown", 10)]),
      BLK("main", "superset", R45, [M("Reverse Crunch", 12), M("Incline Dumbbell Curl", 10)]),
    ] },
    { name: "Upper & Single-Leg Day", description: "Open on the press/row pair. Superset the lettered pairs.", blocks: [
      WU_PRESS(),
      BLK("main", "superset", R2, [M(prEx, prR), M("Single-Arm Dumbbell Row (High Pull)", 10)]),
      BLK("main", "single", R90, [M("Cable Straight Arm Pulldown", 12)]),
      BLK("main", "single", R90, [M("Dumbbell Rear Foot Elevated Split Squat", 8)]),
      BLK("main", "superset", R45, [SUITCASE(), M("Seated Dumbbell Lateral Raise", 12)]),
    ] },
  ];
}

// ---- the six programmes ------------------------------------------------------
const SPECS = [
  {
    title: "Squat Basics 1 — Own the Squat",
    difficulty: "beginner", weeks: 8, authoredWeeks: [1, 3, 5, 7],
    description: "Part 1 of 2. A patient 8-week build for a beginner learning to squat well — dumbbell and bodyweight only, no barbell (that's Squat Basics 2). The squat is the star: it climbs one honest step every 2 weeks (bodyweight box squat → paused goblet box squat → heels-elevated goblet → flat goblet), trained twice a week, one heavier day and one lighter volume day, because a skill is learned through frequency. " + HOWTO + " Never chase depth you can't own with a neutral spine.",
    week: squatDays(squat1, R2),
  },
  {
    title: "Squat Basics 2 — Add the Bar",
    difficulty: "intermediate", weeks: 8, authoredWeeks: [1, 3, 5, 7],
    description: "Part 2 of 2 (assumes Squat Basics 1 — owns a flat DB goblet squat). Takes the owned squat onto the barbell, patiently: reload the goblet → front-loaded kettlebell rack squat to learn bracing → barbell box squat → full barbell back squat only in the last two weeks. " + HOWTO + " Keep the barbell box squat until depth and bracing are solid before the full back squat.",
    week: squatDays(squat2, R3),
  },
  {
    title: "Hip Hinge Basics 1 — Own the Hinge",
    difficulty: "beginner", weeks: 8, authoredWeeks: [1, 3, 5, 7],
    description: "Part 1 of 2. Builds a bulletproof hip hinge — strictly dumbbell, no barbell and no floor pull (that's Hinge Basics 2). The hinge is the star, done fresh and alone, climbing every 2 weeks (side-loaded RDL → dumbbell RDL → supported single-leg RDL → B-stance RDL); a light glute bridge on the third day adds posterior frequency without a second heavy hinge. " + HOWTO + " Push the hips back as far as your mobility allows and stop the instant you'd round.",
    week: hingeDays(hinge1, R2, "Dumbbell Glute Bridge", 12),
  },
  {
    title: "Hip Hinge Basics 2 — Add the Bar",
    difficulty: "intermediate", weeks: 8, authoredWeeks: [1, 3, 5, 7],
    description: "Part 2 of 2 (assumes Hinge Basics 1 — owns a loaded DB RDL). Takes the owned hinge onto the bar and to a deadlift — from blocks first (never floor-pull a fragile back), and only the last two weeks pull from the floor: B-stance RDL → barbell RDL → trap-bar deadlift from blocks → trap-bar deadlift. A light single-leg RDL keeps posterior frequency without a second heavy axial pull. " + HOWTO + " From blocks before the floor, RDL before the deadlift.",
    week: hingeDays(hinge2, R3, "Single-Leg Dumbbell RDL - Shin On Bench", 8),
  },
  {
    title: "Upper Body Basics",
    difficulty: "beginner", weeks: 6, authoredWeeks: [1, 3, 5],
    description: "Upper-biased but complete — all six patterns across the week. Two stars climb every 2 weeks and stay sub-barbell (the barbell bench and free bent-over row are the tops of their pyramids and earn their own runway later): press push-up → incline DB → flat DB; row chest-supported → single-arm → split-stance. Each is trained twice a week, heavy and volume. No pull-ups — vertical pull is a lat pulldown throughout. " + HOWTO,
    week: upperDays,
  },
  {
    title: "Full Body Basics",
    difficulty: "beginner", weeks: 6, authoredWeeks: [1, 3, 5],
    description: "The balanced entry to the Basics series — learn the three foundational lifts at once, each the star of its own day, each climbing every 2 weeks, all at dumbbell/bodyweight level. No barbell (that lives in the lift-specific Part 2s). Squat box → free → flat goblet; hinge side-loaded → DB RDL → B-stance; press push-up → incline → flat DB. " + HOWTO,
    week: fullBodyDays,
  },
];

// ---- engine ------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[‐-―]/g, "-").replace(/[^a-z0-9]/g, "");

export async function runBasicsUpload() {
  const report = { created: [], deleted: [] };

  // build exercise name → id map
  const lib = await db.select({ id: exerciseLibrary.id, name: exerciseLibrary.name }).from(exerciseLibrary);
  const byName = new Map();
  for (const e of lib) byName.set(norm(e.name), e.id);
  const resolve = (name) => {
    const id = byName.get(norm(name));
    if (!id) throw new Error("UNRESOLVED exercise name: " + name);
    return id;
  };

  // PRE-VALIDATE every exercise name across all six programmes before any write
  const missing = new Set();
  for (const spec of SPECS) {
    for (let p = 0; p < spec.authoredWeeks.length; p++) {
      for (const day of spec.week(p)) {
        for (const b of day.blocks) {
          for (const ex of b.exercises) {
            if (!byName.get(norm(ex.name))) missing.add(ex.name);
          }
        }
      }
    }
  }
  if (missing.size) throw new Error("Aborting — unresolved names: " + [...missing].join(" | "));

  const dayPositions = [0, 2, 4]; // Mon / Wed / Fri, matching Foundations

  for (const spec of SPECS) {
    // idempotent: delete existing programme(s) with this title (cascade)
    const existing = await db.select({ id: programs.id }).from(programs).where(eq(programs.title, spec.title));
    for (const p of existing) {
      await db.delete(programs).where(eq(programs.id, p.id));
      report.deleted.push({ title: spec.title, id: p.id });
    }

    const [prog] = await db.insert(programs).values({
      title: spec.title,
      description: spec.description,
      goal: "functional_strength",
      equipment: "full_gym",
      duration: spec.weeks * 7,
      weeks: spec.weeks,
      trainingDaysPerWeek: 3,
      difficulty: spec.difficulty,
      programmeType: "main",
      sourceType: "manual",
      source: "manual",
      category: ["gym", "foundations"],
      tags: ["strength training", "workout basics", "exercise form", "beginner friendly"],
    }).returning({ id: programs.id });

    let workoutCount = 0, exerciseCount = 0;
    for (let p = 0; p < spec.authoredWeeks.length; p++) {
      const weekNumber = spec.authoredWeeks[p];
      const [wk] = await db.insert(programWeeks).values({ programId: prog.id, weekNumber }).returning({ id: programWeeks.id });

      // 7 day rows per week (positions 0–6); workouts land on 0/2/4
      const dayIds = [];
      for (let pos = 0; pos < 7; pos++) {
        const [d] = await db.insert(programDays).values({ weekId: wk.id, position: pos }).returning({ id: programDays.id });
        dayIds.push(d.id);
      }

      const days = spec.week(p);
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const [wo] = await db.insert(programmeWorkouts).values({
          dayId: dayIds[dayPositions[di]],
          name: day.name,
          description: day.description,
          workoutType: "regular",
          category: "strength",
          difficulty: spec.difficulty,
          duration: 35,
          position: 0,
        }).returning({ id: programmeWorkouts.id });
        workoutCount++;

        for (let bi = 0; bi < day.blocks.length; bi++) {
          const b = day.blocks[bi];
          const [blk] = await db.insert(programmeWorkoutBlocks).values({
            workoutId: wo.id,
            section: b.section,
            blockType: b.blockType,
            position: bi,
            rest: b.rest,
            rounds: null,
            restAfterRound: null,
          }).returning({ id: programmeWorkoutBlocks.id });

          for (let ei = 0; ei < b.exercises.length; ei++) {
            const ex = b.exercises[ei];
            await db.insert(programmeBlockExercises).values({
              blockId: blk.id,
              exerciseLibraryId: resolve(ex.name),
              position: ei,
              sets: ex.sets,
              durationType: ex.durationType,
              tempo: null,
              load: null,
              notes: null,
            });
            exerciseCount++;
          }
        }
      }
    }

    report.created.push({ title: spec.title, id: prog.id, weeks: spec.weeks, authoredWeeks: spec.authoredWeeks, workouts: workoutCount, exercises: exerciseCount });
  }

  return report;
}
