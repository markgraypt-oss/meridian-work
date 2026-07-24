import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { formatDate, formatTime, formatDateTime, formatTimeOnly } from "@/lib/dateTimeFormat";
import { 
  formatWeight as formatWeightUtil, 
  formatWeightValue as formatWeightValueUtil,
  formatDistance as formatDistanceUtil,
  formatDistanceValue as formatDistanceValueUtil,
  parseWeightToKg,
  parseDistanceToKm,
  getWeightUnitLabel,
  getDistanceUnitLabel
} from "@/lib/unitConversions";

export function useFormattedDate() {
  const { preferences } = useUserPreferences();
  
  return {
    formatDate: (date: Date | string, variant: "full" | "short" | "withDay" | "monthDay" = "full") => 
      formatDate(date, preferences.dateFormat, variant),
    formatTime: (date: Date | string) => 
      formatTime(date, preferences.timeFormat),
    formatDateTime: (date: Date | string) => 
      formatDateTime(date, preferences.dateFormat, preferences.timeFormat),
    formatTimeOnly: (timeString: string) => 
      formatTimeOnly(timeString, preferences.timeFormat),
    dateFormat: preferences.dateFormat,
    timeFormat: preferences.timeFormat,
  };
}

export function useFormattedWeight() {
  const { preferences } = useUserPreferences();
  
  return {
    formatWeight: (valueInKg: number, decimals: number = 1): string => 
      formatWeightUtil(valueInKg, preferences.weightUnit, decimals),
    formatWeightValue: (valueInKg: number, decimals: number = 1): number => 
      formatWeightValueUtil(valueInKg, preferences.weightUnit, decimals),
    parseToKg: (value: number): number => 
      parseWeightToKg(value, preferences.weightUnit),
    weightUnit: preferences.weightUnit,
    weightUnitLabel: getWeightUnitLabel(preferences.weightUnit),
  };
}

export function useFormattedDistance() {
  const { preferences } = useUserPreferences();
  
  return {
    formatDistance: (valueInKm: number, decimals: number = 1): string => 
      formatDistanceUtil(valueInKm, preferences.distanceUnit, decimals),
    formatDistanceValue: (valueInKm: number, decimals: number = 1): number => 
      formatDistanceValueUtil(valueInKm, preferences.distanceUnit, decimals),
    parseToKm: (value: number): number => 
      parseDistanceToKm(value, preferences.distanceUnit),
    distanceUnit: preferences.distanceUnit,
    distanceUnitLabel: getDistanceUnitLabel(preferences.distanceUnit),
  };
}
