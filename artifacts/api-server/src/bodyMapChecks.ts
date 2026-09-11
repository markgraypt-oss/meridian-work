/**
 * Body map: ask about every movement the sore area is involved in.
 *
 * "Which movements hurt?" only tells us the bad news — a pattern that was not
 * ticked might be fine, or might not have crossed the athlete's mind. So the
 * assessment asks about each movement in turn, with a picture of a concrete
 * exercise (their own, from their programme, when there is one), and gets an
 * answer for each: fine / sore but manageable / painful.
 *
 * Those answers are what drive the programme changes. The tier logic itself
 * lives in programmeSubstitution.ts (tiersFromAssessment); this module owns
 * the questions, the pictures, and reading an assessment back.
 */
import { pool } from "./db";
import {
  type MovementCheck,
  type MovementResponse,
  realPatterns,
  tiersFromAssessment,
  rulesForAssessment,
  poolFromOutcome,
  type FlaggingRules,
  type SubstitutionPool,
} from "./programmeSubstitution";

/** Asked before the movement questions. Any of these -> seek assessment, regardless of the number. */
export const RED_FLAGS: Array<{ key: string; label: string }> = [
  { key: 'trauma', label: 'It started with a fall, knock or impact' },
  { key: 'numbness', label: 'Numbness, tingling or weakness nearby' },
  { key: 'night', label: 'Pain that wakes you at night' },
  { key: 'cant_move', label: "Can't move it at all" },
  { key: 'swelling', label: 'Swelling, heat or it looks wrong' },
];

export const MOVEMENT_RESPONSES: Array<{ value: MovementResponse; label: string; hint: string }> = [
  { value: 'fine', label: 'Fine', hint: 'No pain doing this' },
  { value: 'manageable', label: 'Sore but manageable', hint: 'Can do it, feel it' },
  { value: 'painful', label: 'Painful', hint: "Can't do this right now" },
];

/**
 * First-pass shoulder checks. Seeded once; edited in the admin after that.
 * Cue exercise ids are library rows with a video thumbnail; the assessment
 * prefers an exercise from the athlete's own programme and only falls back
 * to these.
 *
 * No "carry" check: nothing in the library carries a Carry pattern yet, so a
 * question about it could not change anything.
 */
export const SHOULDER_CHECKS_V1: MovementCheck[] = [
  { key: 'overhead_push', label: 'Pushing overhead', patterns: ['Vertical Push'], cueExerciseId: 767 },
  { key: 'push', label: 'Pushing away from you', patterns: ['Horizontal Push'], cueExerciseId: 632 },
  { key: 'overhead_pull', label: 'Pulling down from overhead', patterns: ['Vertical Pull'], cueExerciseId: 453 },
  { key: 'pull', label: 'Pulling towards you', patterns: ['Horizontal Pull'], cueExerciseId: 707 },
];

let hasSeeded = false;
const SEED_FLAG = 'shoulder_movement_checks_v1';

export async function seedShoulderMovementChecksOnce(): Promise<void> {
  if (hasSeeded) return;
  hasSeeded = true;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_flags (key text PRIMARY KEY, created_at timestamp DEFAULT now())`);
    const seen = await pool.query(`SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`, [SEED_FLAG]);
    if ((seen.rowCount ?? 0) > 0) return;
    const r = await pool.query(
      `UPDATE body_map_areas SET movement_checks = $1::jsonb WHERE name = 'shoulder' AND movement_checks IS NULL`,
      [JSON.stringify(SHOULDER_CHECKS_V1)],
    );
    console.log(`[startup-migration] shoulder movement checks seeded (${r.rowCount} row)`);
    await pool.query(`INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [SEED_FLAG]);
  } catch (e: any) {
    console.error('[startup-migration] shoulder movement checks seed failed:', e?.message || e);
  }
}

function parseChecks(raw: any): MovementCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.key === 'string' && Array.isArray(c.patterns) && c.patterns.length > 0)
    .map((c) => ({
      key: String(c.key),
      label: String(c.label || c.key),
      patterns: c.patterns.map(String),
      cueExerciseId: c.cueExerciseId != null ? Number(c.cueExerciseId) : null,
    }));
}

export async function getAreaChecks(areaName: string): Promise<{ areaId: number; checks: MovementCheck[] } | null> {
  const r = await pool.query(`SELECT id, movement_checks FROM body_map_areas WHERE name = $1 LIMIT 1`, [areaName]);
  if (!r.rows[0]) return null;
  return { areaId: r.rows[0].id, checks: parseChecks(r.rows[0].movement_checks) };
}

export interface ResolvedCheck extends MovementCheck {
  cue: {
    exerciseId: number;
    name: string;
    imageUrl: string | null;
    /** True when the picture is one of the athlete's own programme exercises. */
    fromProgramme: boolean;
  } | null;
}

function thumbOf(row: { image_url: string | null; mux_playback_id: string | null }): string | null {
  return row.image_url
    || (row.mux_playback_id ? `https://image.mux.com/${row.mux_playback_id}/thumbnail.png?width=400` : null);
}

/**
 * The checks for an area, each with the exercise to show. Their own programme
 * first — "does THIS hurt?" next to the press they are doing this week is the
 * question we are really asking — then the area's fallback.
 */
export async function resolveChecksForUser(areaName: string, userId: string | null): Promise<ResolvedCheck[]> {
  const area = await getAreaChecks(areaName);
  if (!area || area.checks.length === 0) return [];

  // The athlete's own programme exercises, in programme order, with patterns.
  let programmeRows: Array<{ id: number; name: string; image_url: string | null; mux_playback_id: string | null; movement: string[] | null }> = [];
  if (userId) {
    try {
      const r = await pool.query(
        `SELECT DISTINCT ON (el.id) el.id, el.name, el.image_url, el.mux_playback_id, el.movement,
                pw.week_number, pd.position AS day_pos, b.position AS block_pos, be.position AS ex_pos
           FROM user_program_enrollments e
           JOIN program_weeks pw ON pw.program_id = e.program_id
           JOIN program_days pd ON pd.week_id = pw.id
           JOIN programme_workouts w ON w.day_id = pd.id
           JOIN programme_workout_blocks b ON b.workout_id = w.id
           JOIN programme_block_exercises be ON be.block_id = b.id
           JOIN exercise_library el ON el.id = be.exercise_library_id
          WHERE e.user_id = $1 AND e.status = 'active' AND e.program_type = 'main'
          ORDER BY el.id, pw.week_number, pd.position, b.position, be.position`,
        [userId],
      );
      programmeRows = r.rows
        .sort((a: any, b: any) => a.week_number - b.week_number || a.day_pos - b.day_pos || a.block_pos - b.block_pos || a.ex_pos - b.ex_pos);
    } catch (e: any) {
      console.error('[body-map checks] programme lookup failed:', e?.message || e);
    }
  }

  const fallbackIds = area.checks.map((c) => c.cueExerciseId).filter((id): id is number => !!id);
  const fallback = new Map<number, { id: number; name: string; image_url: string | null; mux_playback_id: string | null }>();
  if (fallbackIds.length) {
    const r = await pool.query(`SELECT id, name, image_url, mux_playback_id FROM exercise_library WHERE id = ANY($1::int[])`, [fallbackIds]);
    for (const row of r.rows) fallback.set(row.id, row);
  }

  return area.checks.map((c) => {
    const own = programmeRows.find((row) => realPatterns({ id: row.id, name: row.name, movement: row.movement }).some((p) => c.patterns.includes(p)));
    if (own) {
      return { ...c, cue: { exerciseId: own.id, name: own.name, imageUrl: thumbOf(own), fromProgramme: true } };
    }
    const fb = c.cueExerciseId ? fallback.get(c.cueExerciseId) : null;
    return { ...c, cue: fb ? { exerciseId: fb.id, name: fb.name, imageUrl: thumbOf(fb), fromProgramme: false } : null };
  });
}

export interface AssessmentContext {
  severity: number;
  logId: number | null;
  bodyPart: string | null;
  redFlags: string[];
  responses: Record<string, MovementResponse>;
  checks: MovementCheck[];
  tiers: { stop: string[]; easier: string[]; source: 'responses' | 'ceiling' | 'outcome' };
  rules: FlaggingRules;
  pool: SubstitutionPool;
}

/**
 * Everything the programme-modification routes need, read from the athlete's
 * latest assessment for this outcome. Nothing about the numbers comes from
 * the client. Falls back to the outcome's own lists when the assessment has
 * no per-movement answers (older app build, or an area with no checks yet).
 */
export async function assessmentContextFor(userId: string, outcomeId: number, outcome: any): Promise<AssessmentContext> {
  let severity = 5;
  let logId: number | null = null;
  let bodyPart: string | null = null;
  let redFlags: string[] = [];
  let responses: Record<string, MovementResponse> = {};
  try {
    const r = await pool.query(
      `SELECT id, severity, body_part, red_flags, movement_responses FROM body_map_logs
        WHERE user_id = $1 AND matched_outcome_id = $2
        ORDER BY created_at DESC LIMIT 1`,
      [userId, outcomeId],
    );
    const row = r.rows[0];
    if (row) {
      logId = row.id;
      if (row.severity != null) severity = Number(row.severity);
      bodyPart = row.body_part || null;
      redFlags = Array.isArray(row.red_flags) ? row.red_flags : [];
      responses = row.movement_responses && typeof row.movement_responses === 'object' ? row.movement_responses : {};
    }
  } catch (e: any) {
    console.error('[programme-modifications] assessment lookup failed:', e?.message || e);
  }

  let checks: MovementCheck[] = [];
  if (bodyPart) {
    const area = await getAreaChecks(bodyPart).catch(() => null);
    checks = area?.checks || [];
  }

  const tiers = tiersFromAssessment({ severity, redFlags, responses, checks, outcome });
  return {
    severity, logId, bodyPart, redFlags, responses, checks, tiers,
    rules: rulesForAssessment(outcome, tiers),
    pool: poolFromOutcome(outcome),
  };
}
