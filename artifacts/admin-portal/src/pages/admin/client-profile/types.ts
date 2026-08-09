export interface DataPoint { date: string; value: number }

export interface NutritionDay {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WorkoutLog {
  id: number;
  date: string | null;
  name: string | null;
  durationMinutes: number | null;
  rating: number | null;
}

export interface CheckInRecord {
  id: number;
  date: string;
  moodScore: number | null;
  energyScore: number | null;
}

export interface Photo {
  id: number;
  photoSetId: string;
  date: string;
  category: string;
  imageUrl: string;
}

export interface Measurement {
  id: number;
  date: string;
  waist?: number | null;
  chest?: number | null;
  hips?: number | null;
  neck?: number | null;
  shoulders?: number | null;
  leftBicep?: number | null;
  rightBicep?: number | null;
  leftThigh?: number | null;
  rightThigh?: number | null;
  leftCalf?: number | null;
  rightCalf?: number | null;
}

export type MetricKey = 'bodyweight' | 'steps' | 'sleep' | 'readiness' | 'calories' | 'workouts';
export type DrilldownDays = 7 | 30 | 90 | 180 | 365;

export const METRIC_ACCENT: Record<MetricKey, string> = {
  bodyweight: '#60a5fa',
  steps:      '#34d399',
  sleep:      '#818cf8',
  readiness:  '#fbbf24',
  calories:   '#f87171',
  workouts:   '#fb923c',
};

export const DRILLDOWN_OPTIONS: { days: DrilldownDays; label: string }[] = [
  { days: 7,   label: '1W' },
  { days: 30,  label: '1M' },
  { days: 90,  label: '3M' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
];
