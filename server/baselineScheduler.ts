// ====================================================================
// PHYSIOLOGICAL BASELINE SCHEDULER
// ====================================================================
// Runs once daily at ~3am UTC to recompute personal baselines for every
// user with wearable data. Baselines are slow-moving (60-day medians for
// HRV, 28-day medians for RHR and sleep) so once-daily recomputation is
// the right cadence — Whoop, Oura, and the broader fitness analytics
// industry all use a similar approach.
//
// 3am UTC was chosen because:
//   - Most users are asleep, so any DB load is invisible
//   - It's after the nightly wearable sync window for most providers,
//     so we're working with fresh overnight HRV/RHR readings
//   - It's well before users typically open the app in the morning,
//     so their baseline is current when they first check in
//
// Pattern matches server/wearables/scheduler.ts: hourly tick, but only
// runs the heavy work when the current hour is the target hour.
// ====================================================================

import { recomputeAllBaselines } from "./baselineEngine";
import { db } from "./db";
import { userPhysiologicalBaselines } from "@shared/schema";
import { desc } from "drizzle-orm";

const TICK_INTERVAL_MS = 60 * 60 * 1000; // hourly check
const TARGET_HOUR_UTC = 3; // 3am UTC

let started = false;
let lastRunDate: string | null = null; // YYYY-MM-DD of last successful run

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function tick() {
  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const today = todayUtcDateStr();

    // Only run during the target hour, and only once per day.
    // This means if the server restarts at 3:30am, we still catch the day's run.
    // And if the server runs through multiple ticks at 3:xx, we only do the work once.
    if (currentHour !== TARGET_HOUR_UTC) return;
    if (lastRunDate === today) return;

    console.log(`[baseline-scheduler] Starting nightly baseline computation at ${now.toISOString()}`);
    const result = await recomputeAllBaselines();
    lastRunDate = today;
    console.log(`[baseline-scheduler] Nightly run complete:`, result);
  } catch (err) {
    console.error("[baseline-scheduler] tick error:", err);
  }
}

// Catch-up check: if the most recent baseline computation in the database is
// more than 24 hours old (or the table is empty), kick off an immediate run.
// This handles the case where the server was down during the 3am UTC target
// window — without this, a deploy or restart during that hour would silently
// skip the day's computation.
async function catchUpIfNeeded(): Promise<void> {
  try {
    const [latest] = await db
      .select({ lastComputedAt: userPhysiologicalBaselines.lastComputedAt })
      .from(userPhysiologicalBaselines)
      .orderBy(desc(userPhysiologicalBaselines.lastComputedAt))
      .limit(1);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const needsCatchUp = !latest || !latest.lastComputedAt || latest.lastComputedAt < twentyFourHoursAgo;

    if (needsCatchUp) {
      console.log(`[baseline-scheduler] Catch-up triggered (last run: ${latest?.lastComputedAt?.toISOString() ?? 'never'})`);
      const result = await recomputeAllBaselines();
      lastRunDate = todayUtcDateStr();
      console.log(`[baseline-scheduler] Catch-up complete:`, result);
    } else {
      console.log(`[baseline-scheduler] Catch-up not needed (last run: ${latest?.lastComputedAt?.toISOString()})`);
    }
  } catch (err) {
    console.error("[baseline-scheduler] Catch-up check failed:", err);
  }
}

export function startBaselineScheduler() {
  if (started) return;
  started = true;
  // Initial tick after 90 seconds (offset from wearable scheduler's 60s to spread load),
  // then hourly. The tick itself is cheap when it's not the target hour.
  // Also run a catch-up check shortly after startup to handle missed nightly runs.
  setTimeout(() => {
    catchUpIfNeeded().catch(() => {});
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 90_000);
  console.log(`[baseline-scheduler] started (target=${TARGET_HOUR_UTC}:00 UTC, hourly checks, with startup catch-up)`);
}
