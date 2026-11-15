/**
 * Distance wording in the person's own unit.
 *
 * Distances are stored in metres. users.distance_unit holds "km", or "miles"
 * (set by the mobile app and by onboarding), or "mi" (set by the website's
 * preferences page). The last two both mean miles.
 *
 * The mobile app has the same badge rule in components/badgeText.ts, so keep
 * the two in step.
 */
export const KM_PER_MILE = 1.609344;

export function usesMiles(distanceUnit: string | null | undefined): boolean {
  return distanceUnit === "miles" || distanceUnit === "mi";
}

/** 10 -> "10", 5.23 -> "5.2". */
function oneDecimal(n: number): string {
  const one = n.toFixed(1);
  return one.endsWith(".0") ? one.slice(0, -2) : one;
}

/** 5 km -> "3.1", 21 km -> "13", 1,000 km -> "621". One decimal under 100 miles, whole miles from there. */
function milesNumber(km: number): string {
  const miles = km / KM_PER_MILE;
  if (miles < 100) return oneDecimal(miles);
  return Math.round(miles).toLocaleString("en-GB");
}

/** A distance for a sentence or an AI prompt: 10000 m is "10 km", or "6.2 miles" for someone who uses miles. */
export function distancePhrase(meters: number, distanceUnit: string | null | undefined): string {
  const km = meters / 1000;
  if (!usesMiles(distanceUnit)) return `${oneDecimal(km)} km`;
  const miles = milesNumber(km);
  return `${miles} ${miles === "1" ? "mile" : "miles"}`;
}

/**
 * Text written in km, reworded for someone who uses miles: "First 5 km run"
 * becomes "First 3.1 mile run", and "Run 100 km in total" becomes "Run 62.1
 * miles in total". Text with no "N km" in it comes back as it is, and so does
 * everything for someone who uses km. Used for the running badges, which are
 * stored worded in km.
 */
export function distanceWording(text: string, distanceUnit: string | null | undefined): string {
  if (!text || !usesMiles(distanceUnit)) return text;
  return text.replace(/(\d[\d,]*(?:\.\d+)?) km( run)?/g, (whole: string, num: string, run?: string) => {
    const km = parseFloat(num.replace(/,/g, ""));
    if (!Number.isFinite(km)) return whole;
    const miles = milesNumber(km);
    if (run) return `${miles} mile run`;
    return `${miles} ${miles === "1" ? "mile" : "miles"}`;
  });
}
