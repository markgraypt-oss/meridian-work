/**
 * Primary muscle for an exercise.
 *
 * `main_muscle` is a multi-select: a bench press carries Chest, Triceps and
 * Shoulders, and its array order is just the order the checkboxes appear in the
 * admin. There is no way to ask it "what is this exercise FOR", which is the
 * only question the workout screen wants answered. Bench press is chest. A
 * dumbbell row is lats. A squat is quads.
 *
 * So: one designated primary, derived from the exercise NAME. The name is far
 * more reliable than the tag set — nobody writes "Bench Press" meaning anything
 * other than a chest press, whereas the tag array only says what is involved.
 *
 * ORDER IN THIS TABLE IS THE WHOLE ALGORITHM. First match wins, so anything
 * specific must sit above the general rule it would otherwise be swallowed by:
 * "Chest Supported Dumbbell Row" contains "chest", so every pulling rule has to
 * come before the chest rules. "Leg Curl" contains "curl", so it must beat
 * biceps. That is why this reads as a long ordered list rather than a map.
 */

export const MAIN_MUSCLE_OPTIONS = [
  "Abs", "Abductors", "Adductors", "Ankle & Foot", "Biceps", "Calves",
  "Chest", "Forearms", "Glutes", "Hamstrings", "Hip Flexor", "Lats",
  "Lower Back", "Middle Back", "Neck", "Neck & Jaw", "Obliques",
  "Posterior Shoulder", "Quads", "Rotator Cuff", "Shoulders", "Traps",
  "Triceps", "Wrist & Hands",
] as const;

type Muscle = (typeof MAIN_MUSCLE_OPTIONS)[number];

const RULES: Array<[RegExp, Muscle]> = [
  // ── Rotator cuff and rear shoulder. Before every other shoulder rule,
  //    because "external rotation" and "face pull" would otherwise be caught by
  //    the generic shoulder/pull rules.
  [/\b(external|internal)\s+rotation\b/, 'Rotator Cuff'],
  [/\bcuban\s+(press|rotation)\b/, 'Rotator Cuff'],
  [/\b(rotator\s*cuff|infraspinatus|supraspinatus)\b/, 'Rotator Cuff'],
  [/\bface\s*pull\b/, 'Posterior Shoulder'],
  [/\brear\s*(delt|deltoid)\b/, 'Posterior Shoulder'],
  [/\breverse\s*(fly|flye|pec\s*deck)\b/, 'Posterior Shoulder'],
  [/\bband\s*pull\s*apart\b/, 'Posterior Shoulder'],
  [/\bprone\s*(y|t|w|i)\b/, 'Posterior Shoulder'],

  // ── Traps. "Upright Row" before the generic row rule.
  [/\bshrug\b/, 'Traps'],
  [/\bupright\s*row\b/, 'Traps'],

  // ── Pulling. Must precede chest: "chest supported row" contains "chest".
  [/\b(pull[\s-]?up|chin[\s-]?up|pulldown|pull[\s-]?down|pullover|pull[\s-]?over)\b/, 'Lats'],
  [/\blat\b/, 'Lats'],
  [/\brow\b/, 'Lats'],

  // ── Elbow flexion. Every non-biceps "curl" has to be caught first.
  [/\b(leg|hamstring|ham|nordic|glute[\s-]?ham)\s*curl\b/, 'Hamstrings'],
  [/\bwrist\s*(curl|extension|flexion)\b/, 'Forearms'],
  [/\b(bicep|biceps|preacher|concentration|hammer\s*curl|spider\s*curl|drag\s*curl)\b/, 'Biceps'],
  [/\bcurl\b/, 'Biceps'],

  // ── Elbow extension. "Close grip bench" is a triceps lift, so it beats bench.
  [/\b(skull\s*crusher|skullcrusher|jm\s*press)\b/, 'Triceps'],
  [/\b(tricep|triceps)\b/, 'Triceps'],
  [/\b(pushdown|push[\s-]?down|pressdown|press[\s-]?down|kickback)\b/, 'Triceps'],
  [/\bclose[\s-]?grip\s*(bench|press|push)/, 'Triceps'],
  [/\boverhead\s*(extension|tricep)/, 'Triceps'],

  // ── Vertical pressing. Before the generic press rules.
  [/\b(overhead|shoulder|military|arnold|z)\s*press\b/, 'Shoulders'],
  [/\bpush\s*press\b/, 'Shoulders'],
  [/\b(lateral|side|front)\s*raise\b/, 'Shoulders'],
  [/\bhandstand\b/, 'Shoulders'],
  [/\blandmine\s*press\b/, 'Shoulders'],
  [/\b(delt|deltoid)\b/, 'Shoulders'],

  // ── Chest.
  [/\b(bench\s*press|chest\s*press|floor\s*press|svend\s*press)\b/, 'Chest'],
  // "Incline Dumbbell Press" names no chest keyword at all. Safe here because
  // every shoulder press rule sits above, and Leg Press / Pallof Press carry no
  // bench angle.
  [/\b(incline|decline|flat)\b.*\bpress\b/, 'Chest'],
  [/\b(pec\s*deck|pec\s*fly|chest\s*fly|cable\s*crossover|crossover)\b/, 'Chest'],
  [/\b(push[\s-]?up|pushup|press[\s-]?up)\b/, 'Chest'],
  [/\bbench\b/, 'Chest'],
  [/\b(fly|flye)\b/, 'Chest'],
  [/\bdip\b/, 'Chest'],
  [/\bchest\b/, 'Chest'],

  // ── Hip hinge. RDL and good mornings are hamstrings; the rest posterior.
  [/\b(romanian\s*deadlift|rdl|stiff[\s-]?leg|straight[\s-]?leg\s*deadlift)\b/, 'Hamstrings'],
  [/\bgood\s*morning\b/, 'Hamstrings'],
  [/\b(hip\s*thrust|glute\s*bridge|hip\s*bridge|frog\s*pump)\b/, 'Glutes'],
  [/\b(glute|kickback|donkey\s*kick)\b/, 'Glutes'],
  [/\bdeadlift\b/, 'Glutes'],
  [/\bswing\b/, 'Glutes'],
  [/\bhip\s*extension\b/, 'Glutes'],

  // ── Hip abduction / adduction. Before the generic leg rules.
  [/\b(abduction|abductor|clam\s*shell|clamshell|monster\s*walk|lateral\s*band\s*walk)\b/, 'Abductors'],
  [/\b(adduction|adductor|copenhagen)\b/, 'Adductors'],

  // ── Knee-dominant.
  [/\b(squat|leg\s*press|hack|sissy)\b/, 'Quads'],
  [/\bleg\s*extension\b/, 'Quads'],
  [/\b(lunge|split\s*squat|step[\s-]?up|bulgarian)\b/, 'Quads'],
  [/\bknee\s*extension\b/, 'Quads'],

  // ── Lower leg.
  [/\b(calf|calves|heel\s*raise|toe\s*raise)\b/, 'Calves'],
  [/\b(ankle|foot|arch|tibialis)\b/, 'Ankle & Foot'],

  // ── Hip flexors.
  [/\b(hip\s*flexor|psoas|march)\b/, 'Hip Flexor'],

  // ── Core. Obliques before abs, since "side plank" is a plank.
  [/\b(pallof|anti[\s-]?rotation)\b/, 'Obliques'],
  [/\b(oblique|side\s*plank|side\s*bend|wood\s*chop|woodchop|russian\s*twist|windmill)\b/, 'Obliques'],
  [/\b(rotation|twist)\b/, 'Obliques'],
  [/\b(back\s*extension|hyper\s*extension|hyperextension|superman|bird\s*dog|jefferson\s*curl)\b/, 'Lower Back'],
  [/\b(plank|dead\s*bug|deadbug|hollow|crunch|sit[\s-]?up|situp|ab\s*wheel|rollout|leg\s*raise|knee\s*raise|toes\s*to\s*bar|v[\s-]?up|flutter|abs?)\b/, 'Abs'],

  // ── Grip and carries. Grip is what fails in a carry, so it goes to forearms.
  [/\b(grip|farmer|suitcase|carry|hang)\b/, 'Forearms'],
  [/\b(wrist|finger|hand)\b/, 'Wrist & Hands'],

  // ── Neck.
  [/\bneck\b/, 'Neck'],
];

/**
 * When the name says nothing, fall back to the tag set — but pick by a fixed
 * preference rather than array position, so the answer is at least consistent.
 * Ordered by how likely a muscle is to be the POINT of an exercise rather than
 * an assisting one: nothing is trained primarily to work the forearms by
 * accident, but plenty of lifts list them.
 */
const FALLBACK_PREFERENCE: Muscle[] = [
  'Chest', 'Lats', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Abs',
  'Biceps', 'Triceps', 'Calves', 'Traps', 'Obliques', 'Lower Back',
  'Middle Back', 'Posterior Shoulder', 'Rotator Cuff', 'Abductors',
  'Adductors', 'Hip Flexor', 'Forearms', 'Ankle & Foot', 'Wrist & Hands',
  'Neck', 'Neck & Jaw',
];

export interface PrimaryMuscleResult {
  muscle: Muscle | null;
  /** How we got there — worth logging so a bad rule can be found later. */
  source: 'name' | 'single-tag' | 'tag-preference' | 'none';
}

export function derivePrimaryMuscle(name: string, mainMuscle?: string[] | null): PrimaryMuscleResult {
  const n = (name || '').toLowerCase();

  for (const [re, muscle] of RULES) {
    if (re.test(n)) return { muscle, source: 'name' };
  }

  const tags = (mainMuscle || []).filter(Boolean);
  if (tags.length === 1 && (MAIN_MUSCLE_OPTIONS as readonly string[]).includes(tags[0])) {
    return { muscle: tags[0] as Muscle, source: 'single-tag' };
  }
  if (tags.length > 1) {
    for (const pref of FALLBACK_PREFERENCE) {
      if (tags.includes(pref)) return { muscle: pref, source: 'tag-preference' };
    }
  }
  return { muscle: null, source: 'none' };
}

// ─────────────────────────────────────────────────────────────────────────────

import { pool } from "./db";

let hasRun = false;
const FLAG = "primary_muscle_backfill_v1";

/**
 * Tag the whole library.
 *
 * Only ever fills rows where primary_muscle IS NULL, so it is safe to re-run and
 * a hand correction in the admin is never overwritten. Reports what it did, and
 * names the exercises it could not work out — with a library this size that
 * short list is the manual job, instead of all of it.
 */
export async function backfillPrimaryMuscleOnce(force = false): Promise<{
  updated: number; byName: number; byTag: number; unresolved: string[];
}> {
  const empty = { updated: 0, byName: 0, byTag: 0, unresolved: [] as string[] };
  if (hasRun && !force) return empty;
  hasRun = true;

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_flags (key text PRIMARY KEY, created_at timestamp DEFAULT now())`);
    if (!force) {
      const seen = await pool.query(`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`, [FLAG]);
      if ((seen.rowCount ?? 0) > 0) return empty;
    }

    const { rows } = await pool.query(
      `SELECT id, name, main_muscle FROM exercise_library WHERE primary_muscle IS NULL`,
    );

    let byName = 0, byTag = 0, updated = 0;
    const unresolved: string[] = [];

    for (const row of rows) {
      const { muscle, source } = derivePrimaryMuscle(row.name, row.main_muscle);
      if (!muscle) { unresolved.push(row.name); continue; }
      await pool.query(`UPDATE exercise_library SET primary_muscle = $1 WHERE id = $2`, [muscle, row.id]);
      updated++;
      if (source === 'name') byName++; else byTag++;
    }

    console.log(
      `[startup-migration] primary muscle backfill: ${updated} tagged ` +
      `(${byName} from the name, ${byTag} from tags), ${unresolved.length} unresolved` +
      (unresolved.length ? ` -> ${unresolved.slice(0, 40).join(', ')}` : ''),
    );

    await pool.query(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [FLAG]);
    return { updated, byName, byTag, unresolved };
  } catch (e: any) {
    console.error("[startup-migration] primary muscle backfill failed:", e?.message || e);
    return empty;
  }
}
