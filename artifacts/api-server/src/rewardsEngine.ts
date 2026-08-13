// Workforce Rewards engine — Phase 1a (the data loop).
// Reads device-sourced daily steps, applies anti-cheat caps, and computes who
// hit the activity target per company per period. NO rewards/draws yet — this
// stage only proves the trusted-data pipeline and exposes AGGREGATE counts.
//
// Privacy: individual results are stored (reward_period_results) but the only
// company-facing read (getRewardParticipation) returns counts, never a person.
//
// Raw SQL by design (mirrors reportingEngine / startupMigrations) so we don't
// touch the large Drizzle schema; Drizzle types can be added later.

import { pool } from "./db";

let hasEnsuredSchema = false;

// ---- Schema (created on boot, safe every time) ----
const REWARDS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS reward_programs (
     id serial PRIMARY KEY,
     company_name text NOT NULL UNIQUE,
     status text NOT NULL DEFAULT 'active',          -- draft | active | paused
     target_metric text NOT NULL DEFAULT 'steps',
     target_type text NOT NULL DEFAULT 'daily_average', -- daily_average | period_total
     target_threshold integer NOT NULL DEFAULT 10000, -- steps/day average
     period_type text NOT NULL DEFAULT 'month',       -- week | month
     daily_step_cap integer NOT NULL DEFAULT 40000,   -- anti-cheat: max counted per day
     min_days_for_eligibility integer NOT NULL DEFAULT 20, -- must have data on >= N days
     winners_per_qualifiers integer NOT NULL DEFAULT 30,   -- ~1 winner per N qualifiers
     budget_cap_pence integer,                        -- optional monthly spend ceiling
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS reward_period_results (
     id serial PRIMARY KEY,
     program_id integer NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     period_key text NOT NULL,        -- e.g. '2026-08' (month) or '2026-W33' (week)
     period_start text NOT NULL,      -- YYYY-MM-DD
     period_end text NOT NULL,        -- YYYY-MM-DD
     days_in_period integer NOT NULL, -- calendar days counted (elapsed if in-progress)
     days_with_data integer NOT NULL DEFAULT 0,
     capped_total_steps bigint NOT NULL DEFAULT 0,
     avg_steps_per_day real NOT NULL DEFAULT 0,
     target_threshold integer NOT NULL,
     hit boolean NOT NULL DEFAULT false,
     weeks_hit integer NOT NULL DEFAULT 0,   -- for ticket weighting (Phase 1b)
     flagged_anomaly boolean NOT NULL DEFAULT false,
     computed_at timestamp DEFAULT now(),
     UNIQUE (program_id, user_id, period_key)
   )`,
  `CREATE TABLE IF NOT EXISTS reward_consent (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     company_name text,
     enrolled boolean NOT NULL DEFAULT false,
     step_access_granted boolean NOT NULL DEFAULT false,
     consent_identity_on_win boolean NOT NULL DEFAULT false,
     updated_at timestamp DEFAULT now(),
     UNIQUE (user_id)
   )`,
];

export async function ensureRewardsSchemaOnce(): Promise<void> {
  if (hasEnsuredSchema) return;
  hasEnsuredSchema = true;
  try {
    for (const ddl of REWARDS_DDL) await pool.query(ddl);
    console.log("[rewards] schema ensured");
  } catch (e: any) {
    console.error("[rewards] schema ensure failed:", e?.message || e);
  }
}

// ---- Period helpers ----

export interface PeriodBounds {
  key: string;
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD (calendar end of the period)
  daysCounted: number; // elapsed days up to today if in-progress, else full length
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Month period from a YYYY-MM key (defaults to the month of `today`).
export function monthBounds(monthKey: string, today: Date): PeriodBounds {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // last day of month
  const todayIso = iso(today);
  const endIso = iso(end);
  // If the month is in progress, only count days up to today.
  const effectiveEndIso = todayIso < endIso ? todayIso : endIso;
  const startMs = start.getTime();
  const effEndMs = new Date(effectiveEndIso + "T00:00:00Z").getTime();
  const daysCounted = Math.max(1, Math.round((effEndMs - startMs) / 86400000) + 1);
  return { key: monthKey, start: iso(start), end: endIso, daysCounted };
}

// ---- Program ----

export async function getOrCreateProgram(companyName: string): Promise<any> {
  const found = await pool.query(`SELECT * FROM reward_programs WHERE company_name = $1`, [companyName]);
  if (found.rows[0]) return found.rows[0];
  const created = await pool.query(
    `INSERT INTO reward_programs (company_name) VALUES ($1)
     ON CONFLICT (company_name) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [companyName]
  );
  return created.rows[0];
}

// ---- Evaluation ----
// Computes per-user step results for the period and upserts them. Anti-cheat:
// take the MAX steps across providers for a day (no double count), then cap that
// day at daily_step_cap. Eligibility needs >= min_days_for_eligibility days of
// data so a handful of huge days can't game a monthly average.
export async function evaluateRewardPeriod(
  companyName: string,
  monthKey: string,
  today: Date
): Promise<{ evaluated: number; hit: number; period: PeriodBounds }> {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const period = monthBounds(monthKey, today);

  const userRows = await pool.query(
    `SELECT id FROM users WHERE company_name = $1 AND is_admin = false`,
    [companyName]
  );
  const userIds: string[] = userRows.rows.map((r: any) => r.id);
  if (userIds.length === 0) return { evaluated: 0, hit: 0, period };

  const cap = program.daily_step_cap as number;
  const threshold = program.target_threshold as number;
  const minDays = program.min_days_for_eligibility as number;

  // Per user: days with data, capped total, and any day that exceeded the cap
  // (kept as an anomaly flag for admin review; the value is still capped).
  const agg = await pool.query(
    `WITH per_day AS (
       SELECT user_id, date,
              LEAST(MAX(steps), $2) AS day_steps,
              (MAX(steps) > $2) AS over_cap
       FROM wearable_metrics_daily
       WHERE user_id = ANY($1) AND steps IS NOT NULL AND steps > 0
         AND date >= $3 AND date <= $4
       GROUP BY user_id, date
     )
     SELECT user_id,
            COUNT(*)::int AS days_with_data,
            COALESCE(SUM(day_steps),0)::bigint AS capped_total,
            bool_or(over_cap) AS flagged
     FROM per_day
     GROUP BY user_id`,
    [userIds, cap, period.start, period.end]
  );

  let hitCount = 0;
  for (const row of agg.rows) {
    const daysWithData = Number(row.days_with_data);
    const cappedTotal = Number(row.capped_total);
    const avg = cappedTotal / period.daysCounted;
    const hit = daysWithData >= minDays && avg >= threshold;
    if (hit) hitCount++;
    await pool.query(
      `INSERT INTO reward_period_results
         (program_id,user_id,period_key,period_start,period_end,days_in_period,
          days_with_data,capped_total_steps,avg_steps_per_day,target_threshold,hit,flagged_anomaly,computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
       ON CONFLICT (program_id,user_id,period_key) DO UPDATE SET
         period_start=EXCLUDED.period_start, period_end=EXCLUDED.period_end,
         days_in_period=EXCLUDED.days_in_period, days_with_data=EXCLUDED.days_with_data,
         capped_total_steps=EXCLUDED.capped_total_steps, avg_steps_per_day=EXCLUDED.avg_steps_per_day,
         target_threshold=EXCLUDED.target_threshold, hit=EXCLUDED.hit,
         flagged_anomaly=EXCLUDED.flagged_anomaly, computed_at=now()`,
      [program.id, row.user_id, period.key, period.start, period.end, period.daysCounted,
        daysWithData, cappedTotal, avg, threshold, hit, row.flagged === true]
    );
  }

  return { evaluated: agg.rows.length, hit: hitCount, period };
}

// ---- Aggregate (company-facing; NEVER returns individuals) ----
export async function getRewardParticipation(companyName: string, monthKey: string, today: Date) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const period = monthBounds(monthKey, today);

  const totalRow = await pool.query(
    `SELECT COUNT(*)::int AS c FROM users WHERE company_name = $1 AND is_admin = false`,
    [companyName]
  );
  const totalMembers = Number(totalRow.rows[0]?.c ?? 0);

  const res = await pool.query(
    `SELECT
       COUNT(*)::int AS evaluated,
       COUNT(*) FILTER (WHERE hit)::int AS hit_count,
       COUNT(*) FILTER (WHERE flagged_anomaly)::int AS flagged_count,
       COALESCE(AVG(avg_steps_per_day),0)::float AS avg_steps
     FROM reward_period_results
     WHERE program_id = $1 AND period_key = $2`,
    [program.id, period.key]
  );
  const r = res.rows[0] || {};
  const hitCount = Number(r.hit_count ?? 0);
  const winners = Math.max(1, Math.floor(hitCount / (program.winners_per_qualifiers || 30)));

  return {
    companyName,
    period: period.key,
    target: `${program.target_threshold.toLocaleString()} steps/day avg`,
    totalMembers,
    withData: Number(r.evaluated ?? 0),
    hitTarget: hitCount,
    participationRate: totalMembers > 0 ? Math.round((hitCount / totalMembers) * 1000) / 10 : 0,
    flaggedForReview: Number(r.flagged_count ?? 0),
    avgStepsAcrossMembers: Math.round(Number(r.avg_steps ?? 0)),
    projectedMonthlyWinners: hitCount > 0 ? winners : 0,
  };
}
