import AdmZip from "adm-zip";
import type { NormalisedDailyMetrics } from "./types";

// Parse the Apple Health export.zip and extract daily metrics. Apple Health
// exports an XML file (`export.xml`) containing every HealthKit record. We do a
// streaming-ish text scan to keep memory bounded for large exports.
// Cap uncompressed XML size at 1 GB and compression ratio at 200x to mitigate
// zip-bomb / OOM attacks. Real Apple Health exports for power users top out
// around 200-400 MB uncompressed and ~10-30x compression ratio, so this is a
// generous safety ceiling.
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

export function parseAppleHealthExport(zipBuffer: Buffer): NormalisedDailyMetrics[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const exportEntry = entries.find((e) => e.entryName.endsWith("export.xml") || e.entryName.endsWith("Export.xml"));
  if (!exportEntry) {
    throw new Error("Apple Health export missing export.xml");
  }
  const declared = (exportEntry.header as any)?.size ?? 0;
  const compressed = (exportEntry.header as any)?.compressedSize ?? zipBuffer.length;
  if (declared > MAX_UNCOMPRESSED_BYTES) {
    throw new Error(`export.xml too large (${Math.round(declared / 1024 / 1024)} MB > 1024 MB limit)`);
  }
  if (compressed > 0 && declared / compressed > MAX_COMPRESSION_RATIO) {
    throw new Error("export.xml compression ratio exceeds safety limit (possible zip bomb)");
  }
  const data = exportEntry.getData();
  if (data.length > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("export.xml exceeds size limit");
  }
  const xml = data.toString("utf8");

  const recordRe = /<Record\s+([^>]+?)\/?>/g;
  const attrsRe = /(\w+)="([^"]*)"/g;

  const byDate = new Map<string, NormalisedDailyMetrics>();
  const ensure = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { date: d, raw: {} });
    return byDate.get(d)!;
  };

  // Workouts are stored as <Workout ...> elements (not <Record>). Count them per day.
  const workoutRe = /<Workout\s+([^>]+?)\/?>/g;
  let wm: RegExpExecArray | null;
  while ((wm = workoutRe.exec(xml)) !== null) {
    const attrStr = wm[1];
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    const localAttrsRe = /(\w+)="([^"]*)"/g;
    while ((am = localAttrsRe.exec(attrStr)) !== null) attrs[am[1]] = am[2];
    const startDate = attrs.startDate || attrs.creationDate;
    if (!startDate) continue;
    const day = startDate.slice(0, 10);
    const d = ensure(day);
    d.workoutCount = (d.workoutCount || 0) + 1;
  }

  let match: RegExpExecArray | null;
  while ((match = recordRe.exec(xml)) !== null) {
    const attrStr = match[1];
    const attrs: Record<string, string> = {};
    let am: RegExpExecArray | null;
    attrsRe.lastIndex = 0;
    while ((am = attrsRe.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }
    const type = attrs.type;
    const value = parseFloat(attrs.value || "0");
    const startDate = attrs.startDate || attrs.creationDate;
    const endDate = attrs.endDate || startDate;
    if (!type || !startDate) continue;
    const day = startDate.slice(0, 10);
    const d = ensure(day);

    switch (type) {
      case "HKQuantityTypeIdentifierStepCount":
        d.steps = (d.steps || 0) + value;
        break;
      case "HKQuantityTypeIdentifierAppleExerciseTime":
        d.activeMinutes = (d.activeMinutes || 0) + value;
        break;
      case "HKQuantityTypeIdentifierActiveEnergyBurned":
        d.caloriesBurned = (d.caloriesBurned || 0) + value;
        break;
      case "HKQuantityTypeIdentifierRestingHeartRate":
        // Take min for the day
        if (d.restingHrBpm == null || value < d.restingHrBpm) d.restingHrBpm = Math.round(value);
        break;
      case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
        d.hrvMs = Math.round(value);
        break;
      case "HKCategoryTypeIdentifierSleepAnalysis": {
        // value is a string state in Apple's case (asleep, inBed, etc), but we have parsed it as number which gives NaN.
        const state = attrs.value || "";
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        if (state.includes("Asleep") || state === "HKCategoryValueSleepAnalysisAsleep") {
          d.sleepMinutes = (d.sleepMinutes || 0) + minutes;
        } else if (state.includes("Awake")) {
          d.sleepAwakeMinutes = (d.sleepAwakeMinutes || 0) + minutes;
        } else if (state.includes("Deep")) {
          d.sleepDeepMinutes = (d.sleepDeepMinutes || 0) + minutes;
          d.sleepMinutes = (d.sleepMinutes || 0) + minutes;
        } else if (state.includes("REM")) {
          d.sleepRemMinutes = (d.sleepRemMinutes || 0) + minutes;
          d.sleepMinutes = (d.sleepMinutes || 0) + minutes;
        } else if (state.includes("Core") || state.includes("Light")) {
          d.sleepLightMinutes = (d.sleepLightMinutes || 0) + minutes;
          d.sleepMinutes = (d.sleepMinutes || 0) + minutes;
        }
        break;
      }
    }
  }
  // Round step counts to integers
  for (const d of Array.from(byDate.values())) {
    if (d.steps != null) d.steps = Math.round(d.steps);
    if (d.activeMinutes != null) d.activeMinutes = Math.round(d.activeMinutes);
    if (d.caloriesBurned != null) d.caloriesBurned = Math.round(d.caloriesBurned);
  }
  return Array.from(byDate.values());
}
