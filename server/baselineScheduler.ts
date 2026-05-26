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

export function startBaselineScheduler() {
  if (started) return;
  started = true;
  // Initial tick after 90 seconds (offset from wearable scheduler's 60s to spread load),
  // then hourly. The tick itself is cheap when it's not the target hour.
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 90_000);
  console.log(`[baseline-scheduler] started (target=${TARGET_HOUR_UTC}:00 UTC, hourly checks)`);
}
