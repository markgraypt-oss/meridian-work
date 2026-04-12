import { useMemo } from "react";
import { localDateStr, todayLocalStr } from "@/lib/dateUtils";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { 
  Footprints, 
  Moon, 
  Scale, 
  Percent, 
  Camera, 
  Utensils, 
  Heart, 
  Activity, 
  Dumbbell, 
  Flame,
  Droplets
} from "lucide-react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";

interface StepEntry {
  id: number;
  steps: number;
  date: string;
  goal: number | null;
}

interface SleepEntry {
  id: number;
  durationMinutes: number;
  quality: number | null;
  sleepScore: number | null;
  date: string;
}

interface BodyweightEntry {
  id: number;
  weight: number;
  date: string;
}

interface BodyFatEntry {
  id: number;
  percentage: number;
  date: string;
}

interface ProgressPicture {
  id: number;
  imageUrl: string;
  date: string;
  notes: string | null;
}

interface PhotoSet {
  photoSetId: string;
  date: string;
  photos: {
    id: number;
    category: string;
    imageUrl: string;
  }[];
}

interface CaloricIntakeEntry {
  id: number;
  calories: number;
  date: string;
}

interface RestingHREntry {
  id: number;
  bpm: number;
  date: string;
}

interface ExerciseMinutesEntry {
  id: number;
  minutes: number;
  date: string;
}

interface LeanBodyMassEntry {
  id: number;
  mass: number;
  date: string;
}

interface CaloricBurnEntry {
  id: number;
  calories: number;
  date: string;
}

interface HydrationEntry {
  goalMl: number;
  totalMl: number;
  percentage: number;
}

type MetricKey = 
  | "steps" 
  | "sleep" 
  | "bodyWeight" 
  | "bodyFat" 
  | "photos" 
  | "caloricIntake" 
  | "restingHR" 
  | "hydration"
  | "exerciseMinutes" 
  | "leanBodyMass" 
  | "caloricBurn";

interface MetricConfig {
  key: MetricKey;
  label: string;
  icon: typeof Footprints;
  unit: string;
  endpoint: string;
  color: string;
  formatValue: (data: any[], dateStr?: string) => string;
  getProgressPercent: (data: any[], dateStr?: string) => number;
  hideProgressBar?: boolean;
  showPhotoThumbnails?: boolean;
  showMiniGraph?: boolean;
  getGraphData?: (data: any[]) => { value: number; timestamp: number }[];
  showRing?: boolean;
  getRingData?: (data: any[]) => { value: number; max: number; label: string } | null;
}

const allMetricConfigs: MetricConfig[] = [
  {
    key: "steps",
    label: "Steps",
    icon: Footprints,
    unit: "",
    endpoint: "/api/progress/steps",
    color: "#0cc9a9",
    formatValue: (data: StepEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return latest.steps.toLocaleString();
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: StepEntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.steps, timestamp: new Date(entry.date).getTime() }));
    },
  },
  {
    key: "sleep",
    label: "Sleep",
    icon: Moon,
    unit: "hrs",
    endpoint: "/api/progress/sleep",
    color: "#a78bfa",
    formatValue: (data: SleepEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      const hours = (latest.durationMinutes / 60).toFixed(1);
      return `${hours}h`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showRing: true,
    getRingData: (data: SleepEntry[]) => {
      if (!data?.length) return null;
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const recent = data.filter(e => new Date(e.date) >= threeMonthsAgo && e.sleepScore);
      if (!recent.length) return null;
      const avgScore = Math.round(recent.reduce((s, e) => s + (e.sleepScore || 0), 0) / recent.length);
      return { value: avgScore, max: 100, label: "Avg Score" };
    },
  },
  {
    key: "bodyWeight",
    label: "Body Weight",
    icon: Scale,
    unit: "kg",
    endpoint: "/api/progress/bodyweight",
    color: "#22c55e",
    formatValue: (data: BodyweightEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.weight} kg`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: BodyweightEntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.weight, timestamp: new Date(entry.date).getTime() }));
    },
  },
  {
    key: "bodyFat",
    label: "Body Fat",
    icon: Percent,
    unit: "%",
    endpoint: "/api/progress/body-fat",
    color: "#f97316",
    formatValue: (data: BodyFatEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.percentage}%`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: BodyFatEntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.percentage, timestamp: new Date(entry.date).getTime() }));
    },
  },
  {
    key: "photos",
    label: "Photos",
    icon: Camera,
    unit: "",
    endpoint: "/api/progress/pictures",
    color: "#ec4899",
    formatValue: (data: PhotoSet[]) => {
      if (!data?.length) return "No data";
      const sortedSets = [...data].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestDate = new Date(sortedSets[0].date);
      return latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showPhotoThumbnails: true,
  },
  {
    key: "caloricIntake",
    label: "Caloric Intake",
    icon: Utensils,
    unit: "kcal",
    endpoint: "/api/progress/caloric-intake",
    color: "#0cc9a9",
    formatValue: (data: any[], dateStr?: string) => {
      if (!data?.length) return "No data";
      const targetDate = dateStr || todayLocalStr();
      const dateEntry = data.find(e => e.date === targetDate);
      const calories = dateEntry?.calories || 0;
      return `${calories.toLocaleString()} kcal`;
    },
    getProgressPercent: (data: any[], dateStr?: string) => {
      if (!data?.length) return 0;
      const targetDate = dateStr || todayLocalStr();
      const dateEntry = data.find(e => e.date === targetDate);
      const goal = dateEntry?.goal || 2000;
      const calories = dateEntry?.calories || 0;
      return Math.min(100, (calories / goal) * 100);
    },
  },
  {
    key: "restingHR",
    label: "Resting HR",
    icon: Heart,
    unit: "bpm",
    endpoint: "/api/progress/resting-hr",
    color: "#ef4444",
    formatValue: (data: RestingHREntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.bpm} bpm`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: RestingHREntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.bpm, timestamp: new Date(entry.date).getTime() }));
    },
  },
  {
    key: "hydration",
    label: "Hydration",
    icon: Droplets,
    unit: "ml",
    endpoint: "/api/hydration/today",
    color: "#06b6d4",
    formatValue: (data: HydrationEntry | null) => {
      if (!data) return "No data";
      const current = (data as any).totalMl || 0;
      const goal = (data as any).goalMl || 3000;
      return `${(current / 1000).toFixed(1)}L / ${(goal / 1000).toFixed(1)}L`;
    },
    getProgressPercent: (data: HydrationEntry | null) => {
      if (!data) return 0;
      return Math.min(100, (data as any).percentage || 0);
    },
  },
  {
    key: "exerciseMinutes",
    label: "Exercise Mins",
    icon: Activity,
    unit: "min",
    endpoint: "/api/progress/exercise-minutes",
    color: "#8b5cf6",
    formatValue: (data: ExerciseMinutesEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.minutes} min`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: ExerciseMinutesEntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.minutes, timestamp: new Date(entry.date).getTime() }));
    },
  },
  {
    key: "leanBodyMass",
    label: "Lean Body Mass",
    icon: Dumbbell,
    unit: "kg",
    endpoint: "/api/progress/lean-body-mass",
    color: "#14b8a6",
    formatValue: (data: LeanBodyMassEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.mass} kg`;
    },
    getProgressPercent: (data: LeanBodyMassEntry[]) => {
      if (!data?.length) return 0;
      return 70;
    },
  },
  {
    key: "caloricBurn",
    label: "Caloric Burn",
    icon: Flame,
    unit: "kcal",
    endpoint: "/api/progress/caloric-burn",
    color: "#f43f5e",
    formatValue: (data: CaloricBurnEntry[]) => {
      if (!data?.length) return "No data";
      const latest = data[0];
      return `${latest.calories.toLocaleString()} kcal`;
    },
    getProgressPercent: () => 0,
    hideProgressBar: true,
    showMiniGraph: true,
    getGraphData: (data: CaloricBurnEntry[]) => {
      if (!data?.length) return [];
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const filtered = data.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= threeMonthsAgo;
      });
      return filtered
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => ({ value: entry.calories, timestamp: new Date(entry.date).getTime() }));
    },
  },
];

const DEFAULT_VISIBLE_METRICS: MetricKey[] = [
  "steps", "sleep", "bodyWeight", "bodyFat", "hydration", 
  "caloricIntake", "restingHR", "photos", "caloricBurn", "exerciseMinutes"
];


interface ProgressTileProps {
  config: MetricConfig;
  onClick: () => void;
  selectedDate?: Date;
}

function ProgressTile({ config, onClick, selectedDate }: ProgressTileProps) {
  const dateStr = selectedDate ? localDateStr(selectedDate) : todayLocalStr();
  const { data, isLoading } = useQuery<any>({
    queryKey: [config.endpoint, dateStr],
  });

  const Icon = config.icon;
  
  // Handle hydration specially as it returns an object, not an array
  const defaultData = config.key === "hydration" ? null : [];
  const value = config.formatValue(data ?? defaultData, dateStr);
  const progress = config.getProgressPercent(data ?? defaultData, dateStr);
  
  // Determine if there's data based on metric type
  const hasData = config.key === "hydration" 
    ? data && (data as any).totalMl > 0
    : data && Array.isArray(data) && data.length > 0;

  const graphData = useMemo(() => {
    if (!config.showMiniGraph || !config.getGraphData || !hasData) {
      return [];
    }
    return config.getGraphData(data ?? []);
  }, [config, data, hasData]);

  const ringData = useMemo(() => {
    if (!config.showRing || !config.getRingData || !hasData) return null;
    return config.getRingData(data ?? []);
  }, [config, data, hasData]);

  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-foreground/5 active:bg-foreground/10 transition-colors relative overflow-hidden"
      onClick={onClick}
      data-testid={`tile-progress-${config.key}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <span className="text-sm text-muted-foreground font-medium">{config.label}</span>
      </div>
      
      <div className="space-y-1">
        {config.showPhotoThumbnails ? (
          <>
            <p 
              className="text-xs text-muted-foreground text-center"
              data-testid={`text-progress-value-${config.key}`}
            >
              {isLoading ? "..." : value}
            </p>
            {hasData && Array.isArray(data) && (
              <div className="flex gap-4 justify-center">
                {(() => {
                  const photoSets = data as PhotoSet[];
                  const sortedSets = [...photoSets].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  );
                  const latestSet = sortedSets[0];
                  if (!latestSet?.photos?.length) return null;
                  return latestSet.photos.slice(0, 3).map((photo, idx) => (
                    <div key={photo.id || idx} className="w-8 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={photo.imageUrl} 
                        alt="Progress" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ));
                })()}
              </div>
            )}
          </>
        ) : (
          <>
            <p 
              className={`text-lg font-semibold ${hasData ? "text-foreground" : "text-muted-foreground"}`}
              data-testid={`text-progress-value-${config.key}`}
            >
              {isLoading ? "..." : value}
            </p>
            
            {config.showRing && ringData && (() => {
              const ringSize = 70;
              const ringStroke = 4;
              const ringRadius = (ringSize - ringStroke) / 2;
              const ringCirc = ringRadius * 2 * Math.PI;
              const ringProgress = Math.min(ringData.value / ringData.max, 1);
              const ringOffset = ringCirc - ringProgress * ringCirc;
              const scoreColor = ringData.value >= 85 ? "#22c55e" : ringData.value >= 70 ? "#3b82f6" : ringData.value >= 50 ? "#0cc9a9" : "#ef4444";
              return (
                <div className="absolute bottom-2 right-3">
                  <div className="relative flex-shrink-0">
                    <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                      <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="currentColor" strokeWidth={ringStroke} className="text-gray-700" />
                      <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke={scoreColor} strokeWidth={ringStroke} strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" className="transition-all duration-300" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-foreground leading-none">{ringData.value}</span>
                      <span className="text-[8px] text-muted-foreground leading-none mt-0.5">of {ringData.max}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {config.showMiniGraph && hasData && graphData.length > 0 && (() => {
              const values = graphData.map(d => d.value);
              const minVal = Math.min(...values);
              const maxVal = Math.max(...values);
              const range = maxVal - minVal || 1;
              const yMin = minVal - range * 0.1;
              const yMax = maxVal + range * 0.1;
              return (
                <div className="w-full mt-2" style={{ height: 28, marginLeft: -4, marginRight: -4 }}>
                  <ResponsiveContainer width="100%" height={28}>
                    <AreaChart data={graphData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                      <defs>
                        <linearGradient id={`miniGradient-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0cc9a9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0cc9a9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <YAxis domain={[yMin, yMax]} hide={true} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#0cc9a9" 
                        strokeWidth={2}
                        fill={`url(#miniGradient-${config.key})`}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
            
            {!config.hideProgressBar && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${progress}%`,
                    backgroundColor: hasData ? "#0cc9a9" : "#6b7280"
                  }}
                  data-testid={`progress-bar-${config.key}`}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}


interface MyProgressSectionProps {
  selectedDate?: Date;
}

export default function MyProgressSection({ selectedDate }: MyProgressSectionProps) {
  const [, navigate] = useLocation();

  const visibleConfigs = DEFAULT_VISIBLE_METRICS
    .map(key => allMetricConfigs.find(c => c.key === key))
    .filter((c): c is MetricConfig => c !== undefined);

  return (
    <div data-testid="section-my-progress">
      <div className="flex items-center justify-between mb-4">
        <h3>
          <span className="text-sm font-semibold bg-[#0cc9a9] text-black px-3 py-1 rounded-md uppercase tracking-wide">My Progress</span>
        </h3>
      </div>
      
      {/* Workouts and Exercise PRs tiles */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/progress/workouts')}
          data-testid="tile-progress-workouts"
        >
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#3b82f620' }}
            >
              <Dumbbell className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Workouts</span>
          </div>
        </Card>
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/progress/exercise-prs')}
          data-testid="tile-progress-exercise-prs"
        >
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#0cc9a920' }}
            >
              <Activity className="w-4 h-4 text-[#0cc9a9]" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Exercise PRs</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleConfigs.map((config) => (
          <ProgressTile 
            key={config.key}
            config={config}
            onClick={() => navigate(`/my-progress/${config.key}`)}
            selectedDate={selectedDate}
          />
        ))}
      </div>
    </div>
  );
}
