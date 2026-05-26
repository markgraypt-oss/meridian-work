// ====================================================================
// PHYSIOLOGICAL BASELINE ENGINE
// ====================================================================
// Computes rolling personal baselines for HRV, resting heart rate, and
// sleep duration from each user's wearable_metrics_daily history.
//
// Why personal baselines?
//   HRV and RHR are highly individual. One person's "healthy" HRV of 35ms
//   might be another's "alarming low" of 70ms. Absolute numbers tell us
//   nothing — deviations from a user's own normal tell us everything.
//
// Statistical approach:
//   - Median (not mean) — robust to outliers like illness days, bad readings
//   - Standard deviation alongside — needed to score how unusual a value is
//   - Minimum 14 samples before a baseline is "calibrated" and usable
//
// Windows:
//   - HRV:          60 days (noisy day-to-day, needs longer to stabilise)
//   - RHR:          28 days (more stable, adapts to fitness changes)
//   - Sleep duration: 28 days (habits shift, captures current pattern)
// ====================================================================

import { db } from "./db";
import { wearableMetricsDaily, userPhysiologicalBaselines, burnoutCalibrationEvents } from "@shared/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";

const HRV_WINDOW_DAYS = 60;
const RHR_WINDOW_DAYS = 28;
const SLEEP_WINDOW_DAYS = 28;
const MIN_SAMPLES_FOR_CALIBRATION = 14;

// Wearable priority: when multiple providers report the same day, use the highest-priority one.
// Matches the priority order used elsewhere in the burnout engine.
const WEARABLE_PRIORITY: Record<string, number> = {
  oura: 4,
  whoop: 3,
  apple_health: 2,
  google_fit: 1,
};

interface MetricRow {
  date: string;
  provider: string;
  value: number;
}

// Pick the highest-priority provider per day to avoid double-counting.
function dedupeByDate(rows: MetricRow[]): number[] {
  const byDate = new Map<string, MetricRow>();
  for (const row of rows) {
    const existing = byDate.get(row.date);
    if (!existing || (WEARABLE_PRIORITY[row.provider] || 0) > (WEARABLE_PRIORITY[existing.provider] || 0)) {
      byDate.set(row.date, row);
    }
  }
  return Array.from(byDate.values()).map(r => r.value);
}

// Standard median calculation
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Standard deviation around the median (more robust than around the mean for skewed data)
function stdDev(values: number[], centre: number): number {
  if (values.length < 2) return 0;
  const squaredDeviations = values.map(v => (v - centre) ** 2);
  const variance = squaredDeviations.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Fetch one metric type for a user over a date window, deduped by provider priority.
async function fetchMetricValues(
  userId: string,
  metricColumn: 'hrvMs' | 'restingHrBpm' | 'sleepMinutes',
  windowDays: number,
): Promise<number[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date: wearableMetricsDaily.date,
      provider: wearableMetricsDaily.provider,
      value: wearableMetricsDaily[metricColumn],
    })
    .from(wearableMetricsDaily)
    .where(
      and(
        eq(wearableMetricsDaily.userId, userId),
        gte(wearableMetricsDaily.date, cutoffStr),
        isNotNull(wearableMetricsDaily[metricColumn]),
      ),
    );

  const metricRows: MetricRow[] = rows
    .filter(r => r.value !== null && r.value !== undefined)
    .map(r => ({ date: r.date, provider: r.provider, value: r.value as number }));

  return dedupeByDate(metricRows);
}

// Compute one user's full baseline set. Returns the computed values for upsert.
export async function computeUserBaselines(userId: string): Promise<{
  hrvBaselineMs: number | null;
  hrvStdDevMs: number | null;
  hrvSampleCount: number;
  rhrBaselineBpm: number | null;
  rhrStdDevBpm: number | null;
  rhrSampleCount: number;
  sleepDurationBaselineMinutes: number | null;
  sleepDurationStdDevMinutes: number | null;
  sleepDurationSampleCount: number;
  isCalibrated: boolean;
  daysUntilCalibrated: number | null;
}> {
  const [hrvValues, rhrValues, sleepValues] = await Promise.all([
    fetchMetricValues(userId, 'hrvMs', HRV_WINDOW_DAYS),
    fetchMetricValues(userId, 'restingHrBpm', RHR_WINDOW_DAYS),
    fetchMetricValues(userId, 'sleepMinutes', SLEEP_WINDOW_DAYS),
  ]);

  const hrvMedian = hrvValues.length > 0 ? median(hrvValues) : null;
  const hrvSd = hrvMedian !== null ? stdDev(hrvValues, hrvMedian) : null;

  const rhrMedian = rhrValues.length > 0 ? median(rhrValues) : null;
  const rhrSd = rhrMedian !== null ? stdDev(rhrValues, rhrMedian) : null;

  const sleepMedian = sleepValues.length > 0 ? median(sleepValues) : null;
  const sleepSd = sleepMedian !== null ? stdDev(sleepValues, sleepMedian) : null;

  // Calibration gate: all three metrics must have at least 14 samples.
  // Why all three? Because the physiological readiness score combines them.
  // A partial baseline (e.g. HRV calibrated but RHR not) would give a misleading signal.
  const allCalibrated =
    hrvValues.length >= MIN_SAMPLES_FOR_CALIBRATION &&
    rhrValues.length >= MIN_SAMPLES_FOR_CALIBRATION &&
    sleepValues.length >= MIN_SAMPLES_FOR_CALIBRATION;

  // Days until calibration: the largest gap across all three metrics.
  // If a user has 10 HRV / 14 RHR / 14 sleep samples, they need 4 more HRV days.
  const daysUntilCalibrated = allCalibrated
    ? null
    : Math.max(
        MIN_SAMPLES_FOR_CALIBRATION - hrvValues.length,
        MIN_SAMPLES_FOR_CALIBRATION - rhrValues.length,
        MIN_SAMPLES_FOR_CALIBRATION - sleepValues.length,
      );

  return {
    hrvBaselineMs: hrvMedian,
    hrvStdDevMs: hrvSd,
    hrvSampleCount: hrvValues.length,
    rhrBaselineBpm: rhrMedian,
    rhrStdDevBpm: rhrSd,
    rhrSampleCount: rhrValues.length,
    sleepDurationBaselineMinutes: sleepMedian,
    sleepDurationStdDevMinutes: sleepSd,
    sleepDurationSampleCount: sleepValues.length,
    isCalibrated: allCalibrated,
    daysUntilCalibrated,
  };
}

// Upsert the computed baselines for a user, and log a calibration event
// the first time they transition into "calibrated" state.
export async function updateUserBaselines(userId: string): Promise<void> {
  const computed = await computeUserBaselines(userId);

  // Check existing state to detect calibration transitions.
  const [existing] = await db
    .select()
    .from(userPhysiologicalBaselines)
    .where(eq(userPhysiologicalBaselines.userId, userId))
    .limit(1);

  const wasCalibrated = existing?.isCalibrated ?? false;
  const becameCalibrated = !wasCalibrated && computed.isCalibrated;

  const now = new Date();

  if (existing) {
    // Update existing baseline row
    await db
      .update(userPhysiologicalBaselines)
      .set({
        ...computed,
        calibrationCompletedAt: becameCalibrated ? now : existing.calibrationCompletedAt,
        lastComputedAt: now,
        updatedAt: now,
      })
      .where(eq(userPhysiologicalBaselines.userId, userId));
  } else {
    // First-time baseline for this user
    await db.insert(userPhysiologicalBaselines).values({
      userId,
      ...computed,
      calibrationStartedAt: now,
      calibrationCompletedAt: computed.isCalibrated ? now : null,
      lastComputedAt: now,
    });
  }

  // Log calibration completion event (only fires once per user, when they first calibrate).
  // This feeds the calibration analytics for revolutionary requirement #1
  // (proving the early warning system works) and enables the
  // "Meridian has learned your baseline" notification.
  if (becameCalibrated) {
    await db.insert(burnoutCalibrationEvents).values({
      userId,
      eventType: 'baseline_calibrated',
      metadata: {
        hrvSamples: computed.hrvSampleCount,
        rhrSamples: computed.rhrSampleCount,
        sleepSamples: computed.sleepDurationSampleCount,
        hrvBaselineMs: computed.hrvBaselineMs,
        rhrBaselineBpm: computed.rhrBaselineBpm,
        sleepDurationBaselineMinutes: computed.sleepDurationBaselineMinutes,
      },
    });
    console.log(`[baseline-engine] User ${userId} reached calibration. HRV=${computed.hrvBaselineMs?.toFixed(1)}ms RHR=${computed.rhrBaselineBpm?.toFixed(1)}bpm Sleep=${computed.sleepDurationBaselineMinutes?.toFixed(0)}min`);
  }
}

// Recompute baselines for every user with wearable data.
// Called by the nightly scheduler.
export async function recomputeAllBaselines(): Promise<{ processed: number; calibrated: number; errors: number }> {
  let processed = 0;
  let calibrated = 0;
  let errors = 0;

  // Find all distinct userIds with any wearable data
  const userRows = await db
    .selectDistinct({ userId: wearableMetricsDaily.userId })
    .from(wearableMetricsDaily);

  console.log(`[baseline-engine] Recomputing baselines for ${userRows.length} users with wearable data`);

  for (const { userId } of userRows) {
    try {
      const result = await computeUserBaselines(userId);
      await updateUserBaselines(userId);
      processed++;
      if (result.isCalibrated) calibrated++;
    } catch (err) {
      errors++;
      console.error(`[baseline-engine] Failed to recompute for user ${userId}:`, err);
    }
  }

  console.log(`[baseline-engine] Complete. Processed=${processed} Calibrated=${calibrated} Errors=${errors}`);
  return { processed, calibrated, errors };
}
