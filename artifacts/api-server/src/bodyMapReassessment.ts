import { pool } from "./db";

/**
 * How long until we ask about a flagged body area again, when the matched
 * outcome does not say.
 *
 * `body_map_outcomes.reassess_in_days` is nullable and its comment reads
 * "null = no reminder". Taken literally that meant: assess someone's shoulder,
 * match an outcome an admin never filled that field in on, and then never
 * follow up. Silence is not a safe default for a pain flag - the worse it
 * hurts, the more certain it is that someone should be asked again.
 *
 * So an unset outcome now falls back to severity. An admin who deliberately
 * wants a longer or shorter gap still overrides it on the outcome itself.
 */
export function defaultReassessInDays(severity: number | null | undefined): number {
  const s = typeof severity === "number" ? severity : 5;
  if (s >= 7) return 3;   // hurts a lot - check back in a few days
  if (s >= 4) return 7;   // moderate - a week
  return 14;              // mild - a fortnight
}

let hasRunReassessmentBackfill = false;
const REASSESSMENT_BACKFILL_FLAG = "reassessment_reminders_backfill_v1";

/**
 * Give existing assessments the reminder they should have had.
 *
 * Reminder rows are only created when an assessment matches an outcome carrying
 * `reassess_in_days`. Every assessment taken against an outcome where that field
 * is blank produced no row at all, so the Home card never appeared - and now
 * that the push is driven by the same table, no notification would either.
 * Fixing the default only helps the NEXT assessment; this fixes the ones people
 * have already done.
 *
 * Creates one scheduled reminder for the most recent assessment per user per
 * body area, using the days stored on the log if present and the severity
 * fallback otherwise. Due dates are measured from when the assessment was taken,
 * so an assessment from three weeks ago lands overdue and surfaces immediately -
 * which is correct, that follow-up genuinely is late.
 *
 * Idempotent twice over: a once-per-database flag, and a NOT EXISTS guard so it
 * can never double up on an area that already has a live reminder.
 */
export async function backfillReassessmentRemindersOnce(): Promise<void> {
  if (hasRunReassessmentBackfill) return;
  hasRunReassessmentBackfill = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);

    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [REASSESSMENT_BACKFILL_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return; // already done in this database

    // Only look back 120 days. Older than that and the assessment no longer
    // describes anything current; asking about it would be noise, which is the
    // failure mode being fixed here, not one to reproduce.
    const result = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (l.user_id, COALESCE(a.name, lower(regexp_replace(l.body_part, '\\s+', '_', 'g'))))
          l.id,
          l.user_id,
          COALESCE(a.name, lower(regexp_replace(l.body_part, '\\s+', '_', 'g'))) AS area,
          l.matched_outcome_id,
          l.created_at,
          l.severity,
          l.reassessment_days
        FROM body_map_logs l
        LEFT JOIN body_map_outcomes o ON o.id = l.matched_outcome_id
        LEFT JOIN body_map_areas a ON a.id = o.body_area_id
        WHERE l.created_at > now() - interval '120 days'
        ORDER BY
          l.user_id,
          COALESCE(a.name, lower(regexp_replace(l.body_part, '\\s+', '_', 'g'))),
          l.created_at DESC
      )
      INSERT INTO reassessment_reminders
        (user_id, body_area, outcome_id, body_map_log_id, assessed_at, due_at, status)
      SELECT
        latest.user_id,
        latest.area,
        latest.matched_outcome_id,
        latest.id,
        latest.created_at,
        latest.created_at + (
          COALESCE(
            latest.reassessment_days,
            CASE
              WHEN latest.severity >= 7 THEN 3
              WHEN latest.severity >= 4 THEN 7
              ELSE 14
            END
          ) || ' days'
        )::interval,
        'scheduled'
      FROM latest
      WHERE NOT EXISTS (
        SELECT 1
        FROM reassessment_reminders r
        WHERE r.user_id = latest.user_id
          AND r.body_area = latest.area
          AND r.dismissed_at IS NULL
          AND r.completed_at IS NULL
          AND r.status IN ('scheduled', 'due')
      )
    `);

    console.log(
      `[startup-migration] reassessment reminder backfill complete: created ${result.rowCount ?? 0}`,
    );

    await pool.query(
      `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [REASSESSMENT_BACKFILL_FLAG],
    );
  } catch (e: any) {
    console.error("[startup-migration] reassessment reminder backfill failed:", e?.message || e);
  }
}
