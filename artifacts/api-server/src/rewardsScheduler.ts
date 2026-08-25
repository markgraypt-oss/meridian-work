// ====================================================================
// WORKFORCE REWARDS SCHEDULER
// ====================================================================
// Two jobs, both once a day:
//
//   1. Re-evaluate the CURRENT month and its ISO weeks for every company with
//      an active programme, so progress in the app and the employer's
//      participation counts are never more than a day stale.
//
//   2. On DRAW_DAY_OF_MONTH, finalise the PREVIOUS month: evaluate it one last
//      time, then run its draw. The delay is deliberate — wearable data lands
//      late (a phone that syncs on the 2nd still counts for the 31st), so
//      drawing at midnight on the 1st would quietly disqualify people.
//
// Runs at 4am UTC, one hour AFTER the baseline scheduler, because the
// personal-baseline anti-cheat check reads user_physiological_baselines and
// wants that day's fresh numbers.
//
// Pattern matches baselineScheduler.ts: hourly tick, heavy work only on the
// target hour, at most once per day.
//
// NOTE: the manual admin endpoints (POST .../evaluate and .../draws/run) remain
// the fallback — on Replit autoscale a background timer can be frozen between
// requests, so nothing here is the only path to a result.
// ====================================================================

import { evaluateAllCompanies, evaluateCompanyFully, runDraw } from "./rewardsEngine";
import { pool } from "./db";

const TICK_INTERVAL_MS = 60 * 60 * 1000; // hourly check
const TARGET_HOUR_UTC = 4;               // 4am UTC, after baselines at 3am
const DRAW_DAY_OF_MONTH = 3;             // finalise last month on the 3rd

let started = false;
let lastRunDate: string | null = null;

function previousMonthKey(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

// Finalise the month just gone: one last evaluation (catching late syncs), then
// the draw. runDraw is idempotent — a month already drawn returns its existing
// draw untouched, so a restart on the 3rd cannot double-draw.
async function finalisePreviousMonth(today: Date): Promise<void> {
  const monthKey = previousMonthKey(today);
  const companies = await pool.query(
    `SELECT company_name FROM reward_programs WHERE status = 'active' ORDER BY company_name`
  );
  for (const row of companies.rows) {
    const company = row.company_name as string;
    try {
      await evaluateCompanyFully(company, monthKey, today);
      const result = await runDraw(company, monthKey, today, { drawnBy: "scheduler" });
      if (result.alreadyDrawn) {
        console.log(`[rewards-scheduler] ${company} ${monthKey}: already drawn, left alone`);
      } else {
        console.log(
          `[rewards-scheduler] ${company} ${monthKey}: drew ${result.winners} winner(s) ` +
          `from ${result.entrants} qualifier(s), ${result.totalTickets} ticket(s)`
        );
      }
    } catch (err: any) {
      // A missing legal acknowledgement lands here by design — it should stop
      // the draw and be visible, not silently skip.
      console.error(`[rewards-scheduler] ${company} ${monthKey} finalisation failed:`, err?.message || err);
    }
  }
}

async function tick(): Promise<void> {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== TARGET_HOUR_UTC) return;
    if (lastRunDate === today) return;
    lastRunDate = today;

    console.log(`[rewards-scheduler] daily run starting ${now.toISOString()}`);
    const results = await evaluateAllCompanies(now);
    for (const r of results) {
      console.log(
        `[rewards-scheduler] ${r.company} ${r.month.period.key}: ` +
        `${r.month.eligible}/${r.month.evaluated} eligible, ${r.month.hit} hit target, ` +
        `${r.month.flagged} flagged`
      );
    }

    if (now.getUTCDate() === DRAW_DAY_OF_MONTH) {
      await finalisePreviousMonth(now);
    }

    console.log(`[rewards-scheduler] daily run complete (${results.length} company/companies)`);
  } catch (err) {
    console.error("[rewards-scheduler] tick error:", err);
  }
}

// If the process was down through the 4am window, the current month's numbers
// go stale. Catch up when the newest computed_at is over 24h old.
async function catchUpIfNeeded(): Promise<void> {
  try {
    const latest = await pool.query(`SELECT MAX(computed_at) AS last FROM reward_period_results`);
    const last: Date | null = latest.rows[0]?.last ? new Date(latest.rows[0].last) : null;
    const stale = !last || last.getTime() < Date.now() - 24 * 60 * 60 * 1000;
    if (!stale) {
      console.log(`[rewards-scheduler] catch-up not needed (last run ${last?.toISOString()})`);
      return;
    }
    console.log(`[rewards-scheduler] catch-up triggered (last run ${last?.toISOString() ?? "never"})`);
    const now = new Date();
    const results = await evaluateAllCompanies(now);
    lastRunDate = now.toISOString().slice(0, 10);
    console.log(`[rewards-scheduler] catch-up complete (${results.length} company/companies)`);
  } catch (err) {
    console.error("[rewards-scheduler] catch-up check failed:", err);
  }
}

export function startRewardsScheduler(): void {
  if (started) return;
  started = true;
  // 150s after boot — offset from the wearable (60s) and baseline (90s)
  // schedulers so the three don't contend on startup.
  setTimeout(() => {
    catchUpIfNeeded().catch(() => {});
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 150_000);
  console.log(
    `[rewards-scheduler] started (target=${TARGET_HOUR_UTC}:00 UTC, hourly checks, ` +
    `draws finalise on day ${DRAW_DAY_OF_MONTH})`
  );
}
