// Shared cycle phase computation. Pure function, no database access.
// Used by /api/cycle/today (routes.ts), coach briefings (coach/briefings.ts),
// and daily readiness adjustments (dailyReadiness.ts).
//
// Phase model, scaled to the user's cycle length. Ovulation is assumed
// 14 days before the next period (the luteal phase length is the stable one):
//   menstrual:   day 1 .. avgPeriodLength
//   ovulatory:   3-day window centred on (avgCycleLength - 14)
//   follicular:  after menstrual, before the ovulatory window
//   late_luteal: final 4 days before the estimated next period (and overdue)
//   luteal:      everything in between

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal" | "late_luteal";

export interface CyclePhaseResult {
  phase: CyclePhase;
  cycleDay: number;
  daysUntilNextPeriod: number; // <= 0 means due or overdue
  nextPeriodEstimate: string; // local YYYY-MM-DD
}

// Local YYYY-MM-DD, deliberately not toISOString() (UTC one-day-back shift).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeCyclePhase(
  lastPeriodStart: Date,
  avgCycleLength: number,
  avgPeriodLength: number,
): CyclePhaseResult {
  const now = new Date();
  const start = new Date(lastPeriodStart.getFullYear(), lastPeriodStart.getMonth(), lastPeriodStart.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const daysElapsed = Math.round((today.getTime() - start.getTime()) / 86400000);
  const cycleDay = daysElapsed + 1;

  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + avgCycleLength);
  const daysUntilNextPeriod = Math.round((next.getTime() - today.getTime()) / 86400000);

  const ovulationDay = avgCycleLength - 14;

  let phase: CyclePhase;
  if (cycleDay <= avgPeriodLength) phase = "menstrual";
  else if (Math.abs(cycleDay - ovulationDay) <= 1) phase = "ovulatory";
  else if (cycleDay < ovulationDay - 1) phase = "follicular";
  else if (daysUntilNextPeriod <= 4) phase = "late_luteal";
  else phase = "luteal";

  return { phase, cycleDay, daysUntilNextPeriod, nextPeriodEstimate: ymd(next) };
}
