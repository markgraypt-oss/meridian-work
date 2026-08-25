// Workforce Rewards engine — Phase 1 (data loop + draw).
//
// Reads device-sourced daily steps, applies anti-cheat, computes who hit the
// activity target per company per period, allocates draw tickets, and runs a
// fair, re-checkable draw.
//
// Privacy contract:
//   - Individual results live in reward_period_results and are NEVER returned
//     by a company-facing read. getRewardParticipation returns counts only.
//   - A winner's identity reaches the employer only after that one person
//     accepts the identity-release prompt (reward_fulfilments.identity_released).
//
// Consent contract:
//   - Only users who enrolled AND granted step access are evaluated. Rewards
//     consent is deliberately separate from the WWI anonymised-reporting basis.
//
// Raw SQL by design (mirrors reportingEngine / startupMigrations) so we don't
// touch the large Drizzle schema; Drizzle types can be added later.

import { randomBytes } from "crypto";
import { pool } from "./db";

let hasEnsuredSchema = false;

// ---- Schema (created on boot, safe every time) ----
const REWARDS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS reward_programs (
     id serial PRIMARY KEY,
     company_name text NOT NULL UNIQUE,
     status text NOT NULL DEFAULT 'active',
     target_metric text NOT NULL DEFAULT 'steps',
     target_type text NOT NULL DEFAULT 'daily_average',
     target_threshold integer NOT NULL DEFAULT 10000,
     period_type text NOT NULL DEFAULT 'month',
     daily_step_cap integer NOT NULL DEFAULT 40000,
     min_days_for_eligibility integer NOT NULL DEFAULT 20,
     winners_per_qualifiers integer NOT NULL DEFAULT 30,
     budget_cap_pence integer,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS reward_period_results (
     id serial PRIMARY KEY,
     program_id integer NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     period_key text NOT NULL,
     period_start text NOT NULL,
     period_end text NOT NULL,
     days_in_period integer NOT NULL,
     days_with_data integer NOT NULL DEFAULT 0,
     capped_total_steps bigint NOT NULL DEFAULT 0,
     avg_steps_per_day real NOT NULL DEFAULT 0,
     target_threshold integer NOT NULL,
     hit boolean NOT NULL DEFAULT false,
     weeks_hit integer NOT NULL DEFAULT 0,
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
  `CREATE TABLE IF NOT EXISTS reward_draws (
     id serial PRIMARY KEY,
     program_id integer NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
     period_key text NOT NULL,
     period_type text NOT NULL DEFAULT 'month',
     reward_description text NOT NULL,
     qualifiers integer NOT NULL DEFAULT 0,
     total_tickets integer NOT NULL DEFAULT 0,
     winners_drawn integer NOT NULL DEFAULT 0,
     excluded_previous_winners integer NOT NULL DEFAULT 0,
     seed text NOT NULL,
     algorithm text NOT NULL DEFAULT 'mulberry32-weighted-v1',
     drawn_by varchar,
     drawn_at timestamp DEFAULT now(),
     UNIQUE (program_id, period_key, period_type)
   )`,
  `CREATE TABLE IF NOT EXISTS reward_draw_entries (
     id serial PRIMARY KEY,
     draw_id integer NOT NULL REFERENCES reward_draws(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     tickets integer NOT NULL,
     ticket_start integer NOT NULL,
     ticket_end integer NOT NULL,
     won boolean NOT NULL DEFAULT false,
     UNIQUE (draw_id, user_id)
   )`,
  `CREATE TABLE IF NOT EXISTS reward_fulfilments (
     id serial PRIMARY KEY,
     draw_id integer REFERENCES reward_draws(id) ON DELETE CASCADE,
     program_id integer NOT NULL REFERENCES reward_programs(id) ON DELETE CASCADE,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     period_key text NOT NULL,
     reward_description text NOT NULL,
     identity_released boolean NOT NULL DEFAULT false,
     identity_decision text,
     identity_decided_at timestamp,
     status text NOT NULL DEFAULT 'pending',
     admin_note text,
     status_changed_by varchar,
     status_changed_at timestamp,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS reward_results_program_period_idx
     ON reward_period_results (program_id, period_key)`,
  `CREATE INDEX IF NOT EXISTS reward_fulfilments_program_idx
     ON reward_fulfilments (program_id, status)`,
];

// Additive columns for installs that already have the Phase 1a tables.
// Mirrors the startupMigrations self-heal pattern: safe to run every boot.
const REWARDS_ALTERS: string[] = [
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS anomaly_sd_multiplier real NOT NULL DEFAULT 3`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS max_gap_days integer NOT NULL DEFAULT 7`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS max_tickets_per_period integer NOT NULL DEFAULT 4`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS require_consent boolean NOT NULL DEFAULT true`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS weekly_perk text`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS monthly_reward text NOT NULL DEFAULT 'A day off'`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS yearly_reward text`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS reward_cost_pence integer`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS legal_acknowledged_at timestamp`,
  `ALTER TABLE reward_programs ADD COLUMN IF NOT EXISTS legal_acknowledged_by varchar`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS period_type text NOT NULL DEFAULT 'month'`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS eligible boolean NOT NULL DEFAULT false`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS ineligible_reason text`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS longest_gap_days integer NOT NULL DEFAULT 0`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS anomaly_days integer NOT NULL DEFAULT 0`,
  `ALTER TABLE reward_period_results ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'none'`,
  `ALTER TABLE reward_consent ADD COLUMN IF NOT EXISTS enrolled_at timestamp`,
];

export async function ensureRewardsSchemaOnce(): Promise<void> {
  if (hasEnsuredSchema) return;
  hasEnsuredSchema = true;
  try {
    for (const ddl of REWARDS_DDL) await pool.query(ddl);
    for (const alter of REWARDS_ALTERS) {
      try {
        await pool.query(alter);
      } catch (e: any) {
        console.error("[rewards] alter failed:", alter, e?.message || e);
      }
    }
    console.log("[rewards] schema ensured");
  } catch (e: any) {
    console.error("[rewards] schema ensure failed:", e?.message || e);
  }
}

// ---- Period helpers ----

export interface PeriodBounds {
  key: string;
  type: "month" | "week";
  start: string;       // YYYY-MM-DD
  end: string;         // YYYY-MM-DD (calendar end of the period)
  daysCounted: number; // elapsed days up to today if in-progress, else full length
}

const DAY_MS = 86400000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(isoDate: string): Date {
  return new Date(isoDate + "T00:00:00Z");
}

function addDays(isoDate: string, n: number): string {
  return iso(new Date(utc(isoDate).getTime() + n * DAY_MS));
}

function boundsFrom(
  key: string,
  type: "month" | "week",
  start: Date,
  end: Date,
  today: Date
): PeriodBounds {
  const startIso = iso(start);
  const endIso = iso(end);
  const todayIso = iso(today);
  // An in-progress period is judged on elapsed days only, so nobody is punished
  // for days that have not happened yet.
  const effectiveEndIso = todayIso < endIso ? todayIso : endIso;
  if (effectiveEndIso < startIso) {
    return { key, type, start: startIso, end: endIso, daysCounted: 0 };
  }
  const days = Math.round((utc(effectiveEndIso).getTime() - utc(startIso).getTime()) / DAY_MS) + 1;
  return { key, type, start: startIso, end: endIso, daysCounted: Math.max(1, days) };
}

// Month period from a YYYY-MM key.
export function monthBounds(monthKey: string, today: Date): PeriodBounds {
  const [y, m] = monthKey.split("-").map(Number);
  return boundsFrom(
    monthKey,
    "month",
    new Date(Date.UTC(y, m - 1, 1)),
    new Date(Date.UTC(y, m, 0)),
    today
  );
}

// ISO-8601 week key for a date, e.g. '2026-W35'. Weeks run Monday..Sunday and
// week 1 is the week containing 4 January.
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // the Thursday of this week
  const isoYear = t.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const ftDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNum + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

// Monday..Sunday bounds for a 'YYYY-Www' key.
export function weekBounds(weekKey: string, today: Date): PeriodBounds {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - jan4DayNum * DAY_MS);
  const start = new Date(week1Monday.getTime() + (week - 1) * 7 * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return boundsFrom(weekKey, "week", start, end, today);
}

export function periodBounds(key: string, today: Date): PeriodBounds {
  return key.includes("W") ? weekBounds(key, today) : monthBounds(key, today);
}

// The ISO weeks belonging to a month = those whose Monday falls in that month.
// Gives the 4 (occasionally 5) weeks a person can "hit" for ticket weighting.
export function weeksOfMonth(monthKey: string, today: Date): PeriodBounds[] {
  const month = monthBounds(monthKey, today);
  const out: PeriodBounds[] = [];
  const seen = new Set<string>();
  let cursor = month.start;
  while (cursor <= month.end) {
    const d = utc(cursor);
    if ((d.getUTCDay() + 6) % 7 === 0) {
      const key = isoWeekKey(d);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(weekBounds(key, today));
      }
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

// ---- Program ----

export async function getOrCreateProgram(companyName: string): Promise<any> {
  await ensureRewardsSchemaOnce();
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

const PROGRAM_EDITABLE = [
  "status",
  "target_metric",
  "target_type",
  "target_threshold",
  "period_type",
  "daily_step_cap",
  "min_days_for_eligibility",
  "winners_per_qualifiers",
  "budget_cap_pence",
  "anomaly_sd_multiplier",
  "max_gap_days",
  "max_tickets_per_period",
  "require_consent",
  "weekly_perk",
  "monthly_reward",
  "yearly_reward",
  "reward_cost_pence",
] as const;

export async function updateProgram(companyName: string, patch: Record<string, any>): Promise<any> {
  const program = await getOrCreateProgram(companyName);
  const sets: string[] = [];
  const vals: any[] = [];
  for (const col of PROGRAM_EDITABLE) {
    if (patch[col] !== undefined) {
      vals.push(patch[col]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  // The employer, not Meridian, owns the tax/prize-draw position. Stamp who
  // acknowledged it rather than trusting a bare boolean.
  if (patch.legal_acknowledged_by) {
    vals.push(patch.legal_acknowledged_by);
    sets.push(`legal_acknowledged_by = $${vals.length}`);
    sets.push(`legal_acknowledged_at = now()`);
  }
  if (sets.length === 0) return program;
  vals.push(program.id);
  const updated = await pool.query(
    `UPDATE reward_programs SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return updated.rows[0];
}

// ---- Consent / enrolment ----
// Rewards need individual tracking, so they carry their OWN consent — never
// inferred from the Wellbeing Index basis, which is anonymised aggregate only.

export async function getConsent(userId: string): Promise<any> {
  await ensureRewardsSchemaOnce();
  const r = await pool.query(`SELECT * FROM reward_consent WHERE user_id = $1`, [userId]);
  return (
    r.rows[0] || {
      user_id: userId,
      enrolled: false,
      step_access_granted: false,
      consent_identity_on_win: false,
    }
  );
}

export async function setConsent(
  userId: string,
  companyName: string | null,
  patch: { enrolled?: boolean; stepAccessGranted?: boolean; consentIdentityOnWin?: boolean }
): Promise<any> {
  await ensureRewardsSchemaOnce();
  const current = await getConsent(userId);
  const enrolled = patch.enrolled ?? current.enrolled ?? false;
  const stepAccess = patch.stepAccessGranted ?? current.step_access_granted ?? false;
  const identity = patch.consentIdentityOnWin ?? current.consent_identity_on_win ?? false;
  const r = await pool.query(
    `INSERT INTO reward_consent
       (user_id, company_name, enrolled, step_access_granted, consent_identity_on_win, enrolled_at, updated_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $3 THEN now() ELSE NULL END, now())
     ON CONFLICT (user_id) DO UPDATE SET
       company_name = EXCLUDED.company_name,
       enrolled = EXCLUDED.enrolled,
       step_access_granted = EXCLUDED.step_access_granted,
       consent_identity_on_win = EXCLUDED.consent_identity_on_win,
       enrolled_at = CASE
         WHEN EXCLUDED.enrolled AND reward_consent.enrolled_at IS NULL THEN now()
         WHEN NOT EXCLUDED.enrolled THEN NULL
         ELSE reward_consent.enrolled_at END,
       updated_at = now()
     RETURNING *`,
    [userId, companyName, enrolled, stepAccess, identity]
  );
  return r.rows[0];
}

// ---- Evaluation ----

interface DayRow {
  user_id: string;
  date: string;
  day_steps: number;  // capped
  raw_steps: number;  // uncapped, for anomaly detection
  over_cap: boolean;
}

interface MemberRow {
  id: string;
  enrolled: boolean;
  step_access: boolean;
  has_device: boolean;
  steps_baseline: number | null;
  steps_std_dev: number | null;
  steps_sample_count: number;
}

// Longest run of consecutive elapsed days with no device data. A dead device
// mid-period is a continuity failure, not a sedentary month.
function longestGap(datesWithData: Set<string>, startIso: string, daysCounted: number): number {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < daysCounted; i++) {
    if (datesWithData.has(addDays(startIso, i))) {
      run = 0;
    } else {
      run++;
      if (run > longest) longest = run;
    }
  }
  return longest;
}

async function fetchMembers(companyName: string): Promise<MemberRow[]> {
  const r = await pool.query(
    `SELECT u.id,
            COALESCE(c.enrolled, false)             AS enrolled,
            COALESCE(c.step_access_granted, false)  AS step_access,
            EXISTS (
              SELECT 1 FROM wearable_connections wc
              WHERE wc.user_id = u.id AND wc.status = 'connected'
            )                                        AS has_device,
            b.steps_baseline, b.steps_std_dev,
            COALESCE(b.steps_sample_count, 0)        AS steps_sample_count
     FROM users u
     LEFT JOIN reward_consent c ON c.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT steps_baseline, steps_std_dev, steps_sample_count
       FROM user_physiological_baselines b2
       WHERE b2.user_id = u.id
       ORDER BY b2.id DESC LIMIT 1
     ) b ON true
     WHERE u.company_name = $1 AND COALESCE(u.is_admin, false) = false`,
    [companyName]
  );
  return r.rows as MemberRow[];
}

async function fetchDays(
  userIds: string[],
  cap: number,
  startIso: string,
  endIso: string
): Promise<DayRow[]> {
  // MAX across providers, not SUM — a user with both Apple Health and WHOOP
  // connected must not have their steps double-counted.
  const r = await pool.query(
    `SELECT user_id, date,
            LEAST(MAX(steps), $2)::int AS day_steps,
            MAX(steps)::int            AS raw_steps,
            (MAX(steps) > $2)          AS over_cap
     FROM wearable_metrics_daily
     WHERE user_id = ANY($1) AND steps IS NOT NULL AND steps > 0
       AND date >= $3 AND date <= $4
     GROUP BY user_id, date`,
    [userIds, cap, startIso, endIso]
  );
  return r.rows as DayRow[];
}

export interface EvaluationSummary {
  evaluated: number;
  eligible: number;
  hit: number;
  flagged: number;
  period: PeriodBounds;
}

// Computes per-user results for the period and upserts them.
//
// Anti-cheat, in order:
//   1. MAX steps per day across providers (no double count).
//   2. Hard daily cap (program.daily_step_cap).
//   3. Personal-baseline anomaly: a day more than N SD above that person's own
//      28-day median is counted but FLAGGED, and a flagged result is held out of
//      the draw until an admin clears it.
//   4. Continuity: the device must be connected and must not have gone dark for
//      more than program.max_gap_days consecutive days in the period.
export async function evaluateRewardPeriod(
  companyName: string,
  periodKey: string,
  today: Date,
  periodType?: "month" | "week"
): Promise<EvaluationSummary> {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const period = periodBounds(periodKey, today);
  const resolvedType = periodType || period.type;

  if (period.daysCounted === 0) {
    return { evaluated: 0, eligible: 0, hit: 0, flagged: 0, period };
  }

  const members = await fetchMembers(companyName);
  if (members.length === 0) return { evaluated: 0, eligible: 0, hit: 0, flagged: 0, period };

  const cap = Number(program.daily_step_cap);
  const threshold = Number(program.target_threshold);
  const minDays = Number(program.min_days_for_eligibility);
  const maxGap = Number(program.max_gap_days ?? 7);
  const sdMult = Number(program.anomaly_sd_multiplier ?? 3);
  const maxTickets = Number(program.max_tickets_per_period ?? 4);
  const requireConsent = program.require_consent !== false;

  const userIds = members.map((m) => m.id);

  // For a month we also need the ISO weeks that belong to it, which can reach a
  // few days either side of the month boundary — fetch the union in one query.
  const weeks = resolvedType === "month" ? weeksOfMonth(period.key, today) : [];
  let fetchStart = period.start;
  let fetchEnd = period.end;
  for (const w of weeks) {
    if (w.start < fetchStart) fetchStart = w.start;
    if (w.end > fetchEnd) fetchEnd = w.end;
  }

  const dayRows = await fetchDays(userIds, cap, fetchStart, fetchEnd);
  const byUser = new Map<string, DayRow[]>();
  for (const row of dayRows) {
    const list = byUser.get(row.user_id);
    if (list) list.push(row);
    else byUser.set(row.user_id, [row]);
  }

  let eligibleCount = 0;
  let hitCount = 0;
  let flaggedCount = 0;

  for (const member of members) {
    const rows = byUser.get(member.id) || [];
    const inPeriod = rows.filter((r) => r.date >= period.start && r.date <= period.end);

    const datesWithData = new Set(inPeriod.map((r) => r.date));
    const daysWithData = datesWithData.size;
    const cappedTotal = inPeriod.reduce((sum, r) => sum + Number(r.day_steps), 0);
    const avg = cappedTotal / period.daysCounted;
    const gap = longestGap(datesWithData, period.start, period.daysCounted);

    // Personal-baseline anomaly. Needs a real baseline to compare against —
    // a new user with 3 days of history gets no anomaly flags, by design.
    const baseline = member.steps_baseline;
    const sd = member.steps_std_dev;
    const hasBaseline = baseline != null && sd != null && sd > 0 && Number(member.steps_sample_count) >= 14;
    const anomalyCeiling = hasBaseline ? Number(baseline) + sdMult * Number(sd) : Infinity;
    const anomalyDays = inPeriod.filter((r) => Number(r.raw_steps) > anomalyCeiling).length;
    const overCapDays = inPeriod.filter((r) => r.over_cap === true).length;
    const flagged = anomalyDays > 0 || overCapDays > 0;

    // Eligibility, most-specific reason first.
    let ineligibleReason: string | null = null;
    if (requireConsent && !member.enrolled) ineligibleReason = "not_enrolled";
    else if (requireConsent && !member.step_access) ineligibleReason = "no_step_access";
    else if (!member.has_device) ineligibleReason = "no_connected_device";
    else if (daysWithData < minDays) ineligibleReason = "insufficient_days";
    else if (gap > maxGap) ineligibleReason = "sync_gap";
    const eligible = ineligibleReason === null;

    const hit = eligible && avg >= threshold;

    // Ticket weighting: how many of the month's ISO weeks this person hit.
    let weeksHit = 0;
    if (resolvedType === "month" && eligible) {
      for (const w of weeks) {
        if (w.daysCounted === 0) continue;
        const weekRows = rows.filter((r) => r.date >= w.start && r.date <= w.end);
        if (weekRows.length === 0) continue;
        const weekTotal = weekRows.reduce((sum, r) => sum + Number(r.day_steps), 0);
        if (weekTotal / w.daysCounted >= threshold) weeksHit++;
      }
      if (weeksHit > maxTickets) weeksHit = maxTickets;
    }

    if (eligible) eligibleCount++;
    if (hit) hitCount++;
    if (flagged) flaggedCount++;

    await pool.query(
      `INSERT INTO reward_period_results
         (program_id,user_id,period_key,period_type,period_start,period_end,days_in_period,
          days_with_data,capped_total_steps,avg_steps_per_day,target_threshold,hit,weeks_hit,
          flagged_anomaly,anomaly_days,longest_gap_days,eligible,ineligible_reason,computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
       ON CONFLICT (program_id,user_id,period_key) DO UPDATE SET
         period_type=EXCLUDED.period_type,
         period_start=EXCLUDED.period_start, period_end=EXCLUDED.period_end,
         days_in_period=EXCLUDED.days_in_period, days_with_data=EXCLUDED.days_with_data,
         capped_total_steps=EXCLUDED.capped_total_steps, avg_steps_per_day=EXCLUDED.avg_steps_per_day,
         target_threshold=EXCLUDED.target_threshold, hit=EXCLUDED.hit,
         weeks_hit=EXCLUDED.weeks_hit, flagged_anomaly=EXCLUDED.flagged_anomaly,
         anomaly_days=EXCLUDED.anomaly_days, longest_gap_days=EXCLUDED.longest_gap_days,
         eligible=EXCLUDED.eligible, ineligible_reason=EXCLUDED.ineligible_reason,
         computed_at=now(),
         -- never silently un-clear an admin's anti-cheat decision on re-run
         review_status = CASE
           WHEN reward_period_results.review_status IN ('cleared','rejected')
             THEN reward_period_results.review_status
           WHEN EXCLUDED.flagged_anomaly THEN 'flagged'
           ELSE 'none' END`,
      [program.id, member.id, period.key, resolvedType, period.start, period.end, period.daysCounted,
        daysWithData, cappedTotal, avg, threshold, hit, weeksHit,
        flagged, anomalyDays, gap, eligible, ineligibleReason]
    );

    // First insert cannot use the CASE above (no prior row), so settle it here.
    if (flagged) {
      await pool.query(
        `UPDATE reward_period_results SET review_status = 'flagged'
         WHERE program_id=$1 AND user_id=$2 AND period_key=$3 AND review_status = 'none'`,
        [program.id, member.id, period.key]
      );
    }
  }

  return { evaluated: members.length, eligible: eligibleCount, hit: hitCount, flagged: flaggedCount, period };
}

// Evaluate the month AND each of its ISO weeks. This is what the scheduler runs.
export async function evaluateCompanyFully(
  companyName: string,
  monthKey: string,
  today: Date
): Promise<{ month: EvaluationSummary; weeks: EvaluationSummary[] }> {
  const month = await evaluateRewardPeriod(companyName, monthKey, today, "month");
  const weeks: EvaluationSummary[] = [];
  for (const w of weeksOfMonth(monthKey, today)) {
    if (w.daysCounted === 0) continue;
    weeks.push(await evaluateRewardPeriod(companyName, w.key, today, "week"));
  }
  return { month, weeks };
}

// ---- Aggregate reporter (company-facing; NEVER returns an individual) ----

export async function getRewardParticipation(companyName: string, periodKey: string, today: Date) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const period = periodBounds(periodKey, today);

  const counts = await pool.query(
    `SELECT
       COUNT(*)::int                                          AS members,
       COUNT(*) FILTER (WHERE COALESCE(c.enrolled,false))::int AS enrolled,
       COUNT(*) FILTER (WHERE COALESCE(c.step_access_granted,false))::int AS step_access
     FROM users u
     LEFT JOIN reward_consent c ON c.user_id = u.id
     WHERE u.company_name = $1 AND COALESCE(u.is_admin,false) = false`,
    [companyName]
  );
  const m = counts.rows[0] || {};
  const totalMembers = Number(m.members ?? 0);

  const res = await pool.query(
    `SELECT
       COUNT(*)::int                                        AS evaluated,
       COUNT(*) FILTER (WHERE eligible)::int                 AS eligible,
       COUNT(*) FILTER (WHERE hit)::int                      AS hit_count,
       COUNT(*) FILTER (WHERE review_status = 'flagged')::int AS flagged_count,
       COALESCE(SUM(CASE WHEN hit THEN GREATEST(weeks_hit,1) ELSE 0 END),0)::int AS total_tickets,
       COALESCE(AVG(avg_steps_per_day) FILTER (WHERE eligible),0)::float AS avg_steps
     FROM reward_period_results
     WHERE program_id = $1 AND period_key = $2`,
    [program.id, period.key]
  );
  const r = res.rows[0] || {};
  const hitCount = Number(r.hit_count ?? 0);
  const eligible = Number(r.eligible ?? 0);

  // Why people are out — counts per reason, never names.
  const reasons = await pool.query(
    `SELECT ineligible_reason AS reason, COUNT(*)::int AS c
     FROM reward_period_results
     WHERE program_id = $1 AND period_key = $2 AND ineligible_reason IS NOT NULL
     GROUP BY ineligible_reason ORDER BY c DESC`,
    [program.id, period.key]
  );

  return {
    companyName,
    period: period.key,
    periodType: period.type,
    periodStart: period.start,
    periodEnd: period.end,
    daysCounted: period.daysCounted,
    target: `${Number(program.target_threshold).toLocaleString()} steps/day avg`,
    totalMembers,
    enrolled: Number(m.enrolled ?? 0),
    withStepAccess: Number(m.step_access ?? 0),
    evaluated: Number(r.evaluated ?? 0),
    eligible,
    hitTarget: hitCount,
    // Rate is of the people actually taking part, not of everyone on the payroll.
    participationRate: eligible > 0 ? Math.round((hitCount / eligible) * 1000) / 10 : 0,
    enrolmentRate: totalMembers > 0 ? Math.round((Number(m.enrolled ?? 0) / totalMembers) * 1000) / 10 : 0,
    flaggedForReview: Number(r.flagged_count ?? 0),
    totalTickets: Number(r.total_tickets ?? 0),
    avgStepsAcrossParticipants: Math.round(Number(r.avg_steps ?? 0)),
    projectedWinners: plannedWinners(program, hitCount),
    ineligibleBreakdown: reasons.rows.map((x: any) => ({ reason: x.reason, count: Number(x.c) })),
  };
}

// ---- Draw engine ----
// Deterministic given (seed, entrant list). The seed, the algorithm name and
// every entrant's ticket range are stored, so a disputed draw can be recomputed
// by hand from reward_draws + reward_draw_entries alone.

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function plannedWinners(program: any, qualifiers: number): number {
  if (qualifiers <= 0) return 0;
  const per = Number(program.winners_per_qualifiers || 30);
  let winners = Math.max(1, Math.floor(qualifiers / per));
  const budget = program.budget_cap_pence;
  const cost = program.reward_cost_pence;
  if (budget != null && cost != null && Number(cost) > 0) {
    winners = Math.min(winners, Math.floor(Number(budget) / Number(cost)));
  }
  return Math.max(0, Math.min(winners, qualifiers));
}

// The winners of this program's most recent earlier draw of the same cadence.
async function previousWinnerIds(programId: number, periodKey: string, periodType: string): Promise<Set<string>> {
  const prev = await pool.query(
    `SELECT id FROM reward_draws
     WHERE program_id = $1 AND period_type = $2 AND period_key < $3
     ORDER BY period_key DESC LIMIT 1`,
    [programId, periodType, periodKey]
  );
  if (!prev.rows[0]) return new Set();
  const winners = await pool.query(
    `SELECT user_id FROM reward_draw_entries WHERE draw_id = $1 AND won = true`,
    [prev.rows[0].id]
  );
  return new Set(winners.rows.map((r: any) => r.user_id));
}

// Pure, deterministic winner selection — exported so a disputed draw can be
// recomputed from reward_draws.seed + reward_draw_entries with no database and
// no server. Weighted WITHOUT replacement: each round sums the tickets of the
// entrants still in, picks one ticket uniformly at random, and walks the list in
// the stored order until the cumulative count passes it.
export function drawWinners(
  entrants: { userId: string; tickets: number }[],
  winnerCount: number,
  seed: string
): string[] {
  const rng = mulberry32(hashSeed(seed));
  const remaining = entrants.slice();
  const winners: string[] = [];
  for (let i = 0; i < winnerCount && remaining.length > 0; i++) {
    const totalRemaining = remaining.reduce((s, e) => s + e.tickets, 0);
    if (totalRemaining <= 0) break;
    const pick = Math.floor(rng() * totalRemaining);
    let cumulative = 0;
    let chosen = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      cumulative += remaining[j].tickets;
      if (pick < cumulative) {
        chosen = j;
        break;
      }
    }
    winners.push(remaining[chosen].userId);
    remaining.splice(chosen, 1);
  }
  return winners;
}

export async function runDraw(
  companyName: string,
  periodKey: string,
  today: Date,
  opts: { drawnBy?: string; rewardDescription?: string; redraw?: boolean } = {}
) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const period = periodBounds(periodKey, today);

  // Draws are immutable once run — a re-runnable draw is not an auditable draw.
  const existing = await pool.query(
    `SELECT * FROM reward_draws WHERE program_id=$1 AND period_key=$2 AND period_type=$3`,
    [program.id, period.key, period.type]
  );
  if (existing.rows[0] && !opts.redraw) {
    return { alreadyDrawn: true, draw: existing.rows[0] };
  }
  if (existing.rows[0] && opts.redraw) {
    await pool.query(`DELETE FROM reward_draws WHERE id = $1`, [existing.rows[0].id]);
  }

  // The employer owns the tax / prize-draw position (P11D, UK prize-draw rules).
  // No real prize gets drawn until someone at that company has acknowledged it.
  if (!program.legal_acknowledged_at) {
    throw new Error(
      "This company has not acknowledged the rewards legal and tax position. " +
      "Complete the acknowledgement on the programme settings before running a draw."
    );
  }

  const rewardDescription =
    opts.rewardDescription ||
    (period.type === "week" ? program.weekly_perk : program.monthly_reward) ||
    "Reward";

  // Qualifiers: hit the target, were eligible, and are not sitting on an
  // unresolved anti-cheat flag.
  const qualifying = await pool.query(
    `SELECT user_id, GREATEST(weeks_hit, 1) AS tickets
     FROM reward_period_results
     WHERE program_id = $1 AND period_key = $2
       AND hit = true AND eligible = true
       AND review_status IN ('none','cleared')
     ORDER BY user_id`,
    [program.id, period.key]
  );

  const excluded = await previousWinnerIds(program.id, period.key, period.type);
  const entrants = qualifying.rows
    .filter((r: any) => !excluded.has(r.user_id))
    .map((r: any) => ({ userId: r.user_id as string, tickets: Math.max(1, Number(r.tickets)) }));
  const excludedCount = qualifying.rows.length - entrants.length;

  const totalTickets = entrants.reduce((s, e) => s + e.tickets, 0);
  const winnerCount = plannedWinners(program, entrants.length);

  const seed = randomBytes(16).toString("hex");
  const winners = drawWinners(entrants, winnerCount, seed);
  const winnerSet = new Set(winners);

  const drawRow = await pool.query(
    `INSERT INTO reward_draws
       (program_id,period_key,period_type,reward_description,qualifiers,total_tickets,
        winners_drawn,excluded_previous_winners,seed,drawn_by,drawn_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     RETURNING *`,
    [program.id, period.key, period.type, rewardDescription, entrants.length, totalTickets,
      winners.length, excludedCount, seed, opts.drawnBy || null]
  );
  const draw = drawRow.rows[0];

  // Ticket ranges over the full entrant list, in the same order the draw used.
  let cursor = 1;
  for (const e of entrants) {
    const start = cursor;
    const end = cursor + e.tickets - 1;
    cursor = end + 1;
    await pool.query(
      `INSERT INTO reward_draw_entries (draw_id,user_id,tickets,ticket_start,ticket_end,won)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (draw_id,user_id) DO NOTHING`,
      [draw.id, e.userId, e.tickets, start, end, winnerSet.has(e.userId)]
    );
  }

  // A win creates a fulfilment. The employer sees a name only once this one
  // person accepts the identity-release prompt (or pre-consented at opt-in).
  for (const userId of winners) {
    const consent = await getConsent(userId);
    const pre = consent.consent_identity_on_win === true;
    await pool.query(
      `INSERT INTO reward_fulfilments
         (draw_id,program_id,user_id,period_key,reward_description,
          identity_released,identity_decision,identity_decided_at,status,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending', now())`,
      [draw.id, program.id, userId, period.key, rewardDescription,
        pre, pre ? "accepted" : null, pre ? new Date() : null]
    );
  }

  return { alreadyDrawn: false, draw, winners: winners.length, entrants: entrants.length, totalTickets };
}

// ---- Draw + fulfilment reads (company-facing) ----

export async function listDraws(companyName: string) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const r = await pool.query(
    `SELECT d.*,
            (SELECT COUNT(*) FROM reward_fulfilments f
              WHERE f.draw_id = d.id AND f.identity_released)::int AS names_released
     FROM reward_draws d
     WHERE d.program_id = $1
     ORDER BY d.period_key DESC, d.id DESC`,
    [program.id]
  );
  return r.rows;
}

// Winners with names — ONLY those who released their identity. Everyone else in
// the draw stays a count.
export async function listFulfilments(companyName: string, status?: string) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const params: any[] = [program.id];
  let statusClause = "";
  if (status) {
    params.push(status);
    statusClause = ` AND f.status = $${params.length}`;
  }
  const r = await pool.query(
    `SELECT f.id, f.period_key, f.reward_description, f.status, f.admin_note,
            f.identity_released, f.identity_decision, f.identity_decided_at, f.created_at,
            CASE WHEN f.identity_released
                 THEN TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,''))
                 ELSE NULL END AS winner_name,
            CASE WHEN f.identity_released THEN u.email ELSE NULL END AS winner_email
     FROM reward_fulfilments f
     JOIN users u ON u.id = f.user_id
     WHERE f.program_id = $1${statusClause}
     ORDER BY f.created_at DESC`,
    params
  );
  return r.rows.map((row: any) => ({
    ...row,
    winner_name: row.identity_released ? row.winner_name || "(name not set)" : null,
    awaitingConsent: !row.identity_released && row.identity_decision === null,
    declinedIdentity: row.identity_decision === "declined",
  }));
}

const FULFILMENT_STATUSES = ["pending", "approved", "fulfilled", "rejected", "forfeited"];

export async function updateFulfilment(
  companyName: string,
  fulfilmentId: number,
  status: string,
  adminNote: string | null,
  changedBy: string
) {
  await ensureRewardsSchemaOnce();
  if (!FULFILMENT_STATUSES.includes(status)) {
    throw new Error(`Invalid fulfilment status '${status}'`);
  }
  const program = await getOrCreateProgram(companyName);
  const r = await pool.query(
    `UPDATE reward_fulfilments
     SET status = $1, admin_note = COALESCE($2, admin_note),
         status_changed_by = $3, status_changed_at = now()
     WHERE id = $4 AND program_id = $5
     RETURNING id, period_key, reward_description, status, admin_note`,
    [status, adminNote, changedBy, fulfilmentId, program.id]
  );
  if (!r.rows[0]) throw new Error("Fulfilment not found for this company");
  return r.rows[0];
}

// Anti-cheat review. An admin sees the numbers, never a name — they are ruling
// on a flagged result, not inspecting a person's activity.
export async function listFlaggedResults(companyName: string, periodKey: string) {
  await ensureRewardsSchemaOnce();
  const program = await getOrCreateProgram(companyName);
  const r = await pool.query(
    `SELECT id, period_key, days_with_data, capped_total_steps, avg_steps_per_day,
            anomaly_days, longest_gap_days, review_status
     FROM reward_period_results
     WHERE program_id = $1 AND period_key = $2 AND review_status = 'flagged'
     ORDER BY anomaly_days DESC, id`,
    [program.id, periodKey]
  );
  return r.rows;
}

export async function reviewResult(companyName: string, resultId: number, decision: "cleared" | "rejected") {
  await ensureRewardsSchemaOnce();
  if (decision !== "cleared" && decision !== "rejected") throw new Error("Invalid review decision");
  const program = await getOrCreateProgram(companyName);
  const r = await pool.query(
    `UPDATE reward_period_results SET review_status = $1
     WHERE id = $2 AND program_id = $3
     RETURNING id, review_status`,
    [decision, resultId, program.id]
  );
  if (!r.rows[0]) throw new Error("Result not found for this company");
  return r.rows[0];
}

// ---- User-facing (mobile) ----

export async function getMyRewardsStatus(userId: string, today: Date) {
  await ensureRewardsSchemaOnce();
  const userRow = await pool.query(
    `SELECT company_name FROM users WHERE id = $1`,
    [userId]
  );
  const companyName = userRow.rows[0]?.company_name || null;
  const consent = await getConsent(userId);

  const wins = await pool.query(
    `SELECT f.id, f.period_key, f.reward_description, f.status,
            f.identity_released, f.identity_decision, f.created_at
     FROM reward_fulfilments f
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );

  if (!companyName) {
    return {
      available: false,
      reason: "no_company",
      enrolled: consent.enrolled === true,
      wins: wins.rows,
    };
  }

  const program = await getOrCreateProgram(companyName);
  const monthKey = today.toISOString().slice(0, 7);
  const period = monthBounds(monthKey, today);

  const mine = await pool.query(
    `SELECT avg_steps_per_day, days_with_data, hit, weeks_hit, eligible,
            ineligible_reason, review_status, longest_gap_days
     FROM reward_period_results
     WHERE program_id = $1 AND user_id = $2 AND period_key = $3`,
    [program.id, userId, period.key]
  );
  const me = mine.rows[0] || null;

  const hasDevice = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM wearable_connections
       WHERE user_id = $1 AND status = 'connected') AS ok`,
    [userId]
  );

  const drawn = await pool.query(
    `SELECT d.id, d.winners_drawn, d.qualifiers
     FROM reward_draws d
     WHERE d.program_id = $1 AND d.period_key = $2 AND d.period_type = 'month'`,
    [program.id, period.key]
  );

  const tickets = me ? Math.max(me.hit ? 1 : 0, Number(me.weeks_hit || 0)) : 0;

  return {
    available: program.status === "active",
    companyName,
    period: period.key,
    target: Number(program.target_threshold),
    weeklyPerk: program.weekly_perk || null,
    monthlyReward: program.monthly_reward || null,
    enrolled: consent.enrolled === true,
    stepAccessGranted: consent.step_access_granted === true,
    consentIdentityOnWin: consent.consent_identity_on_win === true,
    deviceConnected: hasDevice.rows[0]?.ok === true,
    // Progress is this person's own data — only ever returned to this person.
    avgStepsPerDay: me ? Math.round(Number(me.avg_steps_per_day)) : 0,
    daysWithData: me ? Number(me.days_with_data) : 0,
    daysCounted: period.daysCounted,
    onTrack: me ? me.hit === true : false,
    eligible: me ? me.eligible === true : false,
    ineligibleReason: me ? me.ineligible_reason : consent.enrolled ? null : "not_enrolled",
    underReview: me ? me.review_status === "flagged" : false,
    tickets,
    maxTickets: Number(program.max_tickets_per_period ?? 4),
    drawRun: drawn.rows.length > 0,
    wins: wins.rows,
  };
}

// The winner's identity-release decision. Declining keeps the win — it just
// means the employer is told a winner exists without being told who.
export async function respondToWin(userId: string, fulfilmentId: number, accept: boolean) {
  await ensureRewardsSchemaOnce();
  const r = await pool.query(
    `UPDATE reward_fulfilments
     SET identity_released = $1,
         identity_decision = $2,
         identity_decided_at = now()
     WHERE id = $3 AND user_id = $4
     RETURNING id, period_key, reward_description, status, identity_released, identity_decision`,
    [accept, accept ? "accepted" : "declined", fulfilmentId, userId]
  );
  if (!r.rows[0]) throw new Error("Win not found");
  return r.rows[0];
}

// ---- Scheduler entry point ----
// Every company with an active programme, current month + its ISO weeks.
export async function evaluateAllCompanies(today: Date) {
  await ensureRewardsSchemaOnce();
  const monthKey = today.toISOString().slice(0, 7);
  const companies = await pool.query(
    `SELECT company_name FROM reward_programs WHERE status = 'active' ORDER BY company_name`
  );
  const results: { company: string; month: EvaluationSummary }[] = [];
  for (const row of companies.rows) {
    try {
      const out = await evaluateCompanyFully(row.company_name, monthKey, today);
      results.push({ company: row.company_name, month: out.month });
    } catch (e: any) {
      console.error(`[rewards] evaluation failed for ${row.company_name}:`, e?.message || e);
    }
  }
  return results;
}
