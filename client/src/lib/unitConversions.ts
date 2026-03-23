const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 0.453592;
const KM_TO_MI = 0.621371;
const MI_TO_KM = 1.60934;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function kmToMi(km: number): number {
  return Math.round(km * KM_TO_MI * 10) / 10;
}

export function miToKm(mi: number): number {
  return Math.round(mi * MI_TO_KM * 10) / 10;
}

export function formatWeight(
  valueInKg: number,
  unit: "kg" | "lbs",
  decimals: number = 1
): string {
  if (unit === "lbs") {
    const lbs = valueInKg * KG_TO_LBS;
    return `${lbs.toFixed(decimals)} lbs`;
  }
  return `${valueInKg.toFixed(decimals)} kg`;
}

export function formatWeightValue(
  valueInKg: number,
  unit: "kg" | "lbs",
  decimals: number = 1
): number {
  if (unit === "lbs") {
    return Math.round(valueInKg * KG_TO_LBS * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
  return Math.round(valueInKg * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function formatDistance(
  valueInKm: number,
  unit: "km" | "mi",
  decimals: number = 1
): string {
  if (unit === "mi") {
    const mi = valueInKm * KM_TO_MI;
    return `${mi.toFixed(decimals)} mi`;
  }
  return `${valueInKm.toFixed(decimals)} km`;
}

export function formatDistanceValue(
  valueInKm: number,
  unit: "km" | "mi",
  decimals: number = 1
): number {
  if (unit === "mi") {
    return Math.round(valueInKm * KM_TO_MI * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
  return Math.round(valueInKm * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function parseWeightToKg(value: number, fromUnit: "kg" | "lbs"): number {
  if (fromUnit === "lbs") {
    return value * LBS_TO_KG;
  }
  return value;
}

export function parseDistanceToKm(value: number, fromUnit: "km" | "mi"): number {
  if (fromUnit === "mi") {
    return value * MI_TO_KM;
  }
  return value;
}

export function getWeightUnitLabel(unit: "kg" | "lbs"): string {
  return unit === "lbs" ? "lbs" : "kg";
}

export function getDistanceUnitLabel(unit: "km" | "mi"): string {
  return unit === "mi" ? "mi" : "km";
}
