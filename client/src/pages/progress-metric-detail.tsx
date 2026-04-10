import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subDays, subMonths, addMonths, isAfter, isBefore, parseISO, isSameDay, startOfDay, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, parse } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { formatWeightValue, getWeightUnitLabel, parseWeightToKg } from "@/lib/unitConversions";
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash2, X, Check, Footprints, Moon, Scale, Percent, Camera, Utensils, Heart, Activity, Dumbbell, Flame, Ruler, TrendingDown, TrendingUp, Minus, Droplets, Target, Zap, Brain, Star, Eye, Info } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y";
type MetricKey = 
  | "steps" 
  | "sleep" 
  | "bodyWeight" 
  | "bodyFat" 
  | "photos" 
  | "caloricIntake" 
  | "restingHR" 
  | "bloodPressure" 
  | "leanBodyMass" 
  | "caloricBurn"
  | "exerciseMinutes"
  | "hydration"
  | "neck"
  | "chest"
  | "shoulder"
  | "leftBicep"
  | "rightBicep"
  | "leftForearm"
  | "rightForearm"
  | "waist"
  | "hips"
  | "leftThigh"
  | "rightThigh"
  | "leftCalf"
  | "rightCalf";

interface MetricConfig {
  key: MetricKey;
  label: string;
  icon: typeof Footprints;
  unit: string;
  endpoint: string;
  color: string;
}

const metricConfigs: MetricConfig[] = [
  { key: "steps", label: "Steps", icon: Footprints, unit: "", endpoint: "/api/progress/steps", color: "#0cc9a9" },
  { key: "sleep", label: "Sleep", icon: Moon, unit: "hrs", endpoint: "/api/progress/sleep", color: "#a78bfa" },
  { key: "bodyWeight", label: "Body Weight", icon: Scale, unit: "kg", endpoint: "/api/progress/bodyweight", color: "#22c55e" },
  { key: "bodyFat", label: "Body Fat %", icon: Percent, unit: "%", endpoint: "/api/progress/body-fat", color: "#f97316" },
  { key: "photos", label: "Photos", icon: Camera, unit: "", endpoint: "/api/progress/pictures", color: "#ec4899" },
  { key: "caloricIntake", label: "Caloric Intake", icon: Utensils, unit: "kcal", endpoint: "/api/progress/caloric-intake", color: "#0cc9a9" },
  { key: "restingHR", label: "Resting Heart Rate", icon: Heart, unit: "bpm", endpoint: "/api/progress/resting-hr", color: "#ef4444" },
  { key: "bloodPressure", label: "Blood Pressure", icon: Activity, unit: "mmHg", endpoint: "/api/progress/blood-pressure", color: "#8b5cf6" },
  { key: "leanBodyMass", label: "Lean Body Mass", icon: Dumbbell, unit: "kg", endpoint: "/api/progress/lean-body-mass", color: "#14b8a6" },
  { key: "caloricBurn", label: "Caloric Burn", icon: Flame, unit: "kcal", endpoint: "/api/progress/caloric-burn", color: "#f43f5e" },
  { key: "exerciseMinutes", label: "Exercise Minutes", icon: Dumbbell, unit: "min", endpoint: "/api/progress/exercise-minutes", color: "#22c55e" },
  { key: "hydration", label: "Hydration", icon: Droplets, unit: "ml", endpoint: "/api/hydration/history?days=90", color: "#06b6d4" },
  { key: "neck", label: "Neck", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/neck", color: "#06b6d4" },
  { key: "chest", label: "Chest", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/chest", color: "#06b6d4" },
  { key: "shoulder", label: "Shoulder", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/shoulder", color: "#06b6d4" },
  { key: "leftBicep", label: "L Bicep", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/leftBicep", color: "#06b6d4" },
  { key: "rightBicep", label: "R Bicep", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/rightBicep", color: "#06b6d4" },
  { key: "leftForearm", label: "L Forearm", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/leftForearm", color: "#06b6d4" },
  { key: "rightForearm", label: "R Forearm", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/rightForearm", color: "#06b6d4" },
  { key: "waist", label: "Waist", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/waist", color: "#06b6d4" },
  { key: "hips", label: "Hips", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/hips", color: "#06b6d4" },
  { key: "leftThigh", label: "L Thigh", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/leftThigh", color: "#06b6d4" },
  { key: "rightThigh", label: "R Thigh", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/rightThigh", color: "#06b6d4" },
  { key: "leftCalf", label: "L Calf", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/leftCalf", color: "#06b6d4" },
  { key: "rightCalf", label: "R Calf", icon: Ruler, unit: "cm", endpoint: "/api/progress/measurements/rightCalf", color: "#06b6d4" },
];

interface MetricCategory {
  name: string;
  metrics: MetricKey[];
}

const metricCategories: MetricCategory[] = [
  {
    name: "Biometrics",
    metrics: ["bodyWeight", "bodyFat", "leanBodyMass", "restingHR", "bloodPressure", "caloricBurn", "exerciseMinutes"],
  },
  {
    name: "Body Measurements",
    metrics: ["neck", "chest", "shoulder", "leftBicep", "rightBicep", "leftForearm", "rightForearm", "waist", "hips", "leftThigh", "rightThigh", "leftCalf", "rightCalf"],
  },
  {
    name: "Activity",
    metrics: ["steps", "sleep", "caloricIntake", "hydration"],
  },
];

interface MetricDropdownProps {
  currentMetricKey: MetricKey;
  currentLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (key: MetricKey) => void;
  onClose: () => void;
}

function MetricDropdown({ currentMetricKey, currentLabel, isOpen, onToggle, onSelect, onClose }: MetricDropdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    ["Biometrics"]
  );

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name) 
        : [...prev, name]
    );
  };

  const getMetricLabel = (key: MetricKey) => {
    return metricConfigs.find(c => c.key === key)?.label || key;
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="dropdown-overlay"
      />
      <div 
        className="fixed top-14 left-4 right-4 z-50 bg-white rounded-lg shadow-xl max-h-[70vh] overflow-y-auto"
        data-testid="dropdown-metric-selector"
      >
        {metricCategories.map(category => (
          <Collapsible 
            key={category.name}
            open={expandedCategories.includes(category.name)}
            onOpenChange={() => toggleCategory(category.name)}
          >
            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100" data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <span className="font-medium text-gray-900">{category.name}</span>
              {expandedCategories.includes(category.name) ? (
                <ChevronUp className="h-5 w-5 text-[#0cc9a9]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#0cc9a9]" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {category.metrics.map(metricKey => (
                <button
                  key={metricKey}
                  className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 text-left"
                  onClick={() => onSelect(metricKey)}
                  data-testid={`dropdown-metric-${metricKey}`}
                >
                  <span className="text-gray-700">{getMetricLabel(metricKey)}</span>
                  {currentMetricKey === metricKey && (
                    <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </>
  );
}

const timeRanges: TimeRange[] = ["1W", "1M", "3M", "6M", "1Y"];

function getPeriodRange(range: TimeRange, weekStart?: Date, offset: number = 0): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "1W": {
      const ws = weekStart || startOfWeek(now, { weekStartsOn: 1 });
      return { start: ws, end: endOfWeek(ws, { weekStartsOn: 1 }) };
    }
    case "1M": {
      const endMonth = startOfMonth(addMonths(now, offset));
      const end = offset === 0 ? now : endOfMonth(endMonth);
      const start = startOfMonth(addMonths(now, offset));
      return { start, end };
    }
    case "3M": {
      const blockEnd = addMonths(now, offset * 3);
      const end = offset === 0 ? now : blockEnd;
      const start = subMonths(end, 3);
      return { start: startOfDay(start), end: startOfDay(end) };
    }
    case "6M": {
      const blockEnd = addMonths(now, offset * 6);
      const end = offset === 0 ? now : blockEnd;
      const start = subMonths(end, 6);
      return { start: startOfDay(start), end: startOfDay(end) };
    }
    case "1Y": {
      const blockEnd = addMonths(now, offset * 12);
      const end = offset === 0 ? now : blockEnd;
      const start = subMonths(end, 12);
      return { start: startOfDay(start), end: startOfDay(end) };
    }
  }
}

function getDateCutoff(range: TimeRange, weekOffset?: Date): Date {
  return getPeriodRange(range, weekOffset).start;
}

function getWeekEnd(weekStart: Date): Date {
  return endOfWeek(weekStart, { weekStartsOn: 1 });
}

const addEntrySchemas: Record<MetricKey, z.ZodObject<any>> = {
  steps: z.object({
    date: z.string().min(1, "Date is required"),
    steps: z.coerce.number().min(0, "Steps must be positive"),
    goal: z.coerce.number().optional(),
  }),
  sleep: z.object({
    date: z.string().min(1, "Date is required"),
    hours: z.coerce.number().min(0).max(24, "Hours must be 0-24"),
    quality: z.coerce.number().min(1).max(10).optional(),
  }),
  bodyWeight: z.object({
    date: z.string().min(1, "Date is required"),
    weight: z.coerce.number().min(0, "Weight must be positive"),
  }),
  bodyFat: z.object({
    date: z.string().min(1, "Date is required"),
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100"),
  }),
  photos: z.object({
    date: z.string().min(1, "Date is required"),
  }),
  caloricIntake: z.object({
    date: z.string().min(1, "Date is required"),
    calories: z.coerce.number().min(0, "Calories must be positive"),
  }),
  restingHR: z.object({
    date: z.string().min(1, "Date is required"),
    bpm: z.coerce.number().min(30).max(200, "BPM must be 30-200"),
  }),
  bloodPressure: z.object({
    date: z.string().min(1, "Date is required"),
    systolic: z.coerce.number().min(50).max(250, "Systolic must be 50-250"),
    diastolic: z.coerce.number().min(30).max(150, "Diastolic must be 30-150"),
  }),
  leanBodyMass: z.object({
    date: z.string().min(1, "Date is required"),
    mass: z.coerce.number().min(0, "Mass must be positive"),
  }),
  caloricBurn: z.object({
    date: z.string().min(1, "Date is required"),
    calories: z.coerce.number().min(0, "Calories must be positive"),
  }),
  exerciseMinutes: z.object({
    date: z.string().min(1, "Date is required"),
    minutes: z.coerce.number().min(0, "Minutes must be positive"),
  }),
  hydration: z.object({
    date: z.string().min(1, "Date is required"),
    totalMl: z.coerce.number().min(0, "Amount must be positive"),
  }),
  neck: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  chest: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  shoulder: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  leftBicep: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  rightBicep: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  leftForearm: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  rightForearm: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  waist: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  hips: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  leftThigh: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  rightThigh: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  leftCalf: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  rightCalf: z.object({
    date: z.string().min(1, "Date is required"),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
};

function formatTooltipValue(value: number, metricKey: MetricKey): string {
  if (metricKey === "sleep") {
    const hours = Math.floor(value);
    const mins = Math.round((value - hours) * 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (metricKey === "steps") return value.toLocaleString();
  if (metricKey === "caloricBurn" || metricKey === "caloricIntake") return value.toLocaleString();
  if (metricKey === "bodyWeight" || metricKey === "leanBodyMass" || metricKey === "bodyFat") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
}

function getTooltipUnit(metricKey: MetricKey, configUnit: string): string {
  if (metricKey === "sleep") return "";
  return configUnit;
}

function getValueFromEntry(entry: any, metricKey: MetricKey): number {
  switch (metricKey) {
    case "steps": return entry.steps;
    case "sleep": return entry.hours;
    case "bodyWeight": return entry.weight;
    case "bodyFat": return entry.percentage;
    case "photos": return 1;
    case "caloricIntake": return entry.calories;
    case "restingHR": return entry.bpm;
    case "bloodPressure": return entry.systolic;
    case "leanBodyMass": return entry.mass;
    case "caloricBurn": return entry.calories;
    case "exerciseMinutes": return entry.minutes;
    case "hydration": return entry.totalMl;
    case "neck":
    case "chest":
    case "shoulder":
    case "leftBicep":
    case "rightBicep":
    case "leftForearm":
    case "rightForearm":
    case "waist":
    case "hips":
    case "leftThigh":
    case "rightThigh":
    case "leftCalf":
    case "rightCalf":
      return entry.value;
  }
}

function formatEntryDisplay(entry: any, metricKey: MetricKey, weightUnit: "kg" | "lbs" = "kg"): string {
  const weightUnitLabel = getWeightUnitLabel(weightUnit);
  const convertWeight = (val: number) => formatWeightValue(val, weightUnit, 1);
  switch (metricKey) {
    case "steps": return `${entry.steps.toLocaleString()} steps`;
    case "sleep": return `${entry.hours}h${entry.quality ? ` (Q: ${entry.quality}/10)` : ""}`;
    case "bodyWeight": return `${convertWeight(entry.weight)} ${weightUnitLabel}`;
    case "bodyFat": return `${entry.percentage}%`;
    case "photos": return "Photo";
    case "caloricIntake": return `${entry.calories.toLocaleString()} kcal`;
    case "restingHR": return `${entry.bpm} bpm`;
    case "bloodPressure": return `${entry.systolic}/${entry.diastolic} mmHg`;
    case "leanBodyMass": return `${convertWeight(entry.mass)} ${weightUnitLabel}`;
    case "caloricBurn": return `${entry.calories.toLocaleString()} kcal`;
    case "exerciseMinutes": return `${entry.minutes} min`;
    case "neck":
    case "chest":
    case "shoulder":
    case "leftBicep":
    case "rightBicep":
    case "leftForearm":
    case "rightForearm":
    case "waist":
    case "hips":
    case "leftThigh":
    case "rightThigh":
    case "leftCalf":
    case "rightCalf":
      return `${entry.value} cm`;
    case "hydration":
      return `${entry.totalMl} ml`;
    default:
      return "";
  }
}

function AddEntryForm({ 
  metricKey, 
  endpoint,
  onSuccess 
}: { 
  metricKey: MetricKey; 
  endpoint: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const schema = addEntrySchemas[metricKey];
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      ...(metricKey === "steps" && { steps: 0, goal: 10000 }),
      ...(metricKey === "sleep" && { hours: 7 }),
      ...(metricKey === "bodyWeight" && { weight: 0 }),
      ...(metricKey === "bodyFat" && { percentage: 0 }),
      ...(metricKey === "caloricIntake" && { calories: 0 }),
      ...(metricKey === "restingHR" && { bpm: 60 }),
      ...(metricKey === "bloodPressure" && { systolic: 120, diastolic: 80 }),
      ...(metricKey === "leanBodyMass" && { mass: 0 }),
      ...(metricKey === "caloricBurn" && { calories: 0 }),
      ...(metricKey === "exerciseMinutes" && { minutes: 0 }),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({ title: "Entry added successfully" });
      onSuccess();
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    const processedData = { ...data };
    if (metricKey === "bodyWeight" && processedData.weight !== undefined) {
      processedData.weight = parseWeightToKg(parseFloat(processedData.weight), preferences.weightUnit);
    }
    if (metricKey === "leanBodyMass" && processedData.mass !== undefined) {
      processedData.mass = parseWeightToKg(parseFloat(processedData.mass), preferences.weightUnit);
    }
    mutation.mutate(processedData);
  };

  if (metricKey === "photos") {
    return (
      <div className="text-center text-muted-foreground py-4" data-testid="text-photos-redirect">
        To add photos, please use the Progress Photos section.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-add-entry">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-entry-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {metricKey === "steps" && (
          <>
            <FormField
              control={form.control}
              name="steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-steps" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-goal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "sleep" && (
          <>
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" {...field} data-testid="input-entry-hours" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={"quality" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality (1-10, optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="10" {...field} data-testid="input-entry-quality" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "bodyWeight" && (
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight ({preferences.weightUnit})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-weight" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "bodyFat" && (
          <FormField
            control={form.control}
            name="percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body Fat (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-percentage" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "caloricIntake" && (
          <FormField
            control={form.control}
            name="calories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Calories</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-calories" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "restingHR" && (
          <FormField
            control={form.control}
            name="bpm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BPM</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-bpm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "bloodPressure" && (
          <>
            <FormField
              control={form.control}
              name="systolic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Systolic (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-systolic" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diastolic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diastolic (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-diastolic" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "leanBodyMass" && (
          <FormField
            control={form.control}
            name="mass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lean Mass ({preferences.weightUnit})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-mass" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "caloricBurn" && (
          <FormField
            control={form.control}
            name="calories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Calories Burned</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-calories-burn" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "exerciseMinutes" && (
          <FormField
            control={form.control}
            name="minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exercise Minutes</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-exercise-minutes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button 
          type="submit" 
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
          disabled={mutation.isPending}
          data-testid="button-submit-entry"
        >
          {mutation.isPending ? "Adding..." : "Add Entry"}
        </Button>
      </form>
    </Form>
  );
}

interface CaloricIntakeViewProps {
  entries: any[];
  timeRange: TimeRange;
}

function CaloricIntakeView({ entries, timeRange }: CaloricIntakeViewProps) {
  const { formatDate } = useFormattedDate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedBar, setSelectedBar] = useState<{ dataKey: string; index: number; data: any; x: number; y: number; width: number } | null>(null);
  const [selectedMacroBar, setSelectedMacroBar] = useState<{ index: number; data: any; x: number; y: number; width: number } | null>(null);
  
  // Get goal values from first entry (they should all be the same)
  const goal = entries[0]?.goal || 2100;
  const proteinGoal = entries[0]?.proteinGoal || 137;
  const carbsGoal = entries[0]?.carbsGoal || 142;
  const fatGoal = entries[0]?.fatGoal || 110;

  // Calculate 2-week date range based on offset, starting from Monday
  const today = new Date();
  // Find the most recent Monday (or today if Monday)
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days from Monday
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysFromMonday);
  
  // Apply week offset (go back 2 weeks at a time)
  const startDate = new Date(currentMonday);
  startDate.setDate(currentMonday.getDate() - (weekOffset * 14));
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);

  // Generate all 14 days for the chart (even if no data)
  const chartData: Array<{
    date: string;
    dayLabel: string;
    fullDate: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }> = [];
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = entries.find(e => e.date === dateStr);
    chartData.push({
      date: dateStr,
      dayLabel: format(d, 'EEE').charAt(0),
      fullDate: formatDate(d, 'monthDay'),
      calories: entry?.calories || 0,
      protein: entry?.protein || 0,
      carbs: entry?.carbs || 0,
      fat: entry?.fat || 0,
    });
  }

  // Calculate macro distribution averages for the visible period (using chartData which has correct values)
  const totalProtein = chartData.reduce((sum, e) => sum + (e.protein || 0), 0);
  const totalCarbs = chartData.reduce((sum, e) => sum + (e.carbs || 0), 0);
  const totalFat = chartData.reduce((sum, e) => sum + (e.fat || 0), 0);
  const totalMacros = totalProtein + totalCarbs + totalFat || 1;
  const proteinPercent = Math.round((totalProtein / totalMacros) * 100);
  const carbsPercent = Math.round((totalCarbs / totalMacros) * 100);
  const fatPercent = Math.round((totalFat / totalMacros) * 100);

  const MacroBarChart = ({ 
    title, 
    dataKey, 
    goalValue, 
    color,
    unit
  }: { 
    title: string; 
    dataKey: 'calories' | 'protein' | 'carbs' | 'fat'; 
    goalValue: number; 
    color: string;
    unit: string;
  }) => {
    // Calculate Y axis domain - goal should be at midpoint
    const maxDataValue = Math.max(...chartData.map(d => d[dataKey]));
    // Set yMax so goal is at midpoint (yMax = goalValue * 2)
    const yMax = Math.max(goalValue * 2, maxDataValue * 1.15);
    const tickCount = 5;
    const tickInterval = Math.ceil(yMax / (tickCount - 1));
    const yTicks = Array.from({ length: tickCount }, (_, i) => i * tickInterval);

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-sm text-white">Current Goal: <span className="text-[#0cc9a9]">{goalValue.toLocaleString()}</span></span>
        </div>
        <div className="h-36 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid 
                horizontal={true} 
                vertical={false} 
                stroke="#333" 
                strokeDasharray="3 3"
              />
              <XAxis 
                dataKey="dayLabel" 
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                height={20}
              />
              <YAxis 
                tick={{ fill: '#888', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                domain={[0, yMax]}
                ticks={yTicks}
                width={32}
                tickFormatter={(v) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return v.toString();
                }}
              />
              <Bar 
                dataKey={dataKey} 
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
                onClick={(data: any, index: number) => {
                  setSelectedBar({ 
                    dataKey, 
                    index, 
                    data: chartData[index],
                    x: data.x,
                    y: data.y,
                    width: data.width
                  });
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => {
                  const value = entry[dataKey];
                  const lowerBound = goalValue * 0.95;
                  const upperBound = goalValue * 1.05;
                  const isInRange = value >= lowerBound && value <= upperBound;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={isInRange ? "#0cc9a9" : color}
                    />
                  );
                })}
              </Bar>
              <ReferenceLine 
                y={goalValue * 0.95} 
                stroke="#0cc9a9" 
                strokeWidth={1}
                strokeDasharray="8 8"
                ifOverflow="extendDomain"
              />
              <ReferenceLine 
                y={goalValue} 
                stroke="#0cc9a9" 
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
              <ReferenceLine 
                y={goalValue * 1.05} 
                stroke="#0cc9a9" 
                strokeWidth={1}
                strokeDasharray="8 8"
                ifOverflow="extendDomain"
              />
            </BarChart>
          </ResponsiveContainer>
          {selectedBar && selectedBar.dataKey === dataKey && (
            <div 
              className="absolute bg-card border border-border rounded px-2 py-1 shadow-lg z-10 text-center"
              style={{ 
                left: `${selectedBar.x + selectedBar.width / 2}px`,
                top: `${selectedBar.y - 36}px`,
                transform: 'translateX(-50%)',
                fontSize: '10px',
                lineHeight: '1.3'
              }}
              onClick={() => setSelectedBar(null)}
            >
              <p className="text-muted-foreground whitespace-nowrap">{formatDate(parseISO(selectedBar.data.date), 'short')}</p>
              <p className="font-bold whitespace-nowrap" style={{ color }}>{selectedBar.data[dataKey]}{unit}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between px-2">
        <span className="text-sm font-bold text-foreground">
          {formatDate(startDate, 'short').toUpperCase()} - {formatDate(endDate, 'short').toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border"
            onClick={() => setWeekOffset(prev => prev + 1)}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border"
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
            disabled={weekOffset === 0}
            data-testid="button-next-week"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      </div>

      {/* Calories Bar Chart */}
      <MacroBarChart 
        title="Calories (Cal)" 
        dataKey="calories" 
        goalValue={goal} 
        color="#3b82f6"
        unit=""
      />

      {/* Proteins Bar Chart */}
      <MacroBarChart 
        title="Proteins (g)" 
        dataKey="protein" 
        goalValue={proteinGoal} 
        color="#22c55e"
        unit="g"
      />

      {/* Carbs Bar Chart */}
      <MacroBarChart 
        title="Carbs (g)" 
        dataKey="carbs" 
        goalValue={carbsGoal} 
        color="#3b82f6"
        unit="g"
      />

      {/* Fats Bar Chart */}
      <MacroBarChart 
        title="Fats (g)" 
        dataKey="fat" 
        goalValue={fatGoal} 
        color="#f97316"
        unit="g"
      />

      {/* Macro Distribution - Stacked bar chart per day */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Macro Distribution</h3>
        <div className="h-36 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData.map(d => {
                const total = d.protein + d.carbs + d.fat || 1;
                return {
                  ...d,
                  proteinPct: Math.round((d.protein / total) * 100),
                  carbsPct: Math.round((d.carbs / total) * 100),
                  fatPct: Math.round((d.fat / total) * 100),
                };
              })} 
              margin={{ top: 10, right: 0, left: 0, bottom: 0 }} 
              barCategoryGap="25%"
            >
              <CartesianGrid 
                horizontal={true} 
                vertical={false} 
                stroke="#333" 
                strokeDasharray="3 3"
              />
              <XAxis 
                dataKey="dayLabel" 
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                height={20}
              />
              <YAxis 
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                width={30}
              />
              <Bar 
                dataKey="proteinPct" 
                stackId="macros" 
                fill="#22c55e" 
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                onClick={(data: any, index: number) => {
                  const macroChartData = chartData.map(d => {
                    const total = d.protein + d.carbs + d.fat || 1;
                    return {
                      ...d,
                      proteinPct: Math.round((d.protein / total) * 100),
                      carbsPct: Math.round((d.carbs / total) * 100),
                      fatPct: Math.round((d.fat / total) * 100),
                    };
                  });
                  setSelectedMacroBar({ 
                    index, 
                    data: macroChartData[index],
                    x: data.x,
                    y: data.y,
                    width: data.width
                  });
                }}
                style={{ cursor: 'pointer' }}
              />
              <Bar 
                dataKey="carbsPct" 
                stackId="macros" 
                fill="#3b82f6" 
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                onClick={(data: any, index: number) => {
                  const macroChartData = chartData.map(d => {
                    const total = d.protein + d.carbs + d.fat || 1;
                    return {
                      ...d,
                      proteinPct: Math.round((d.protein / total) * 100),
                      carbsPct: Math.round((d.carbs / total) * 100),
                      fatPct: Math.round((d.fat / total) * 100),
                    };
                  });
                  setSelectedMacroBar({ 
                    index, 
                    data: macroChartData[index],
                    x: data.x,
                    y: data.y,
                    width: data.width
                  });
                }}
                style={{ cursor: 'pointer' }}
              />
              <Bar 
                dataKey="fatPct" 
                stackId="macros" 
                fill="#f97316" 
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
                onClick={(data: any, index: number) => {
                  const macroChartData = chartData.map(d => {
                    const total = d.protein + d.carbs + d.fat || 1;
                    return {
                      ...d,
                      proteinPct: Math.round((d.protein / total) * 100),
                      carbsPct: Math.round((d.carbs / total) * 100),
                      fatPct: Math.round((d.fat / total) * 100),
                    };
                  });
                  setSelectedMacroBar({ 
                    index, 
                    data: macroChartData[index],
                    x: data.x,
                    y: data.y,
                    width: data.width
                  });
                }}
                style={{ cursor: 'pointer' }}
              />
              <ReferenceLine y={50} stroke="#0cc9a9" strokeWidth={2} strokeDasharray="6 4" />
              <ReferenceLine y={25} stroke="#0cc9a9" strokeWidth={2} strokeDasharray="6 4" />
            </BarChart>
          </ResponsiveContainer>
          {selectedMacroBar && (
            <div 
              className="absolute bg-card border border-border rounded px-2 py-1 shadow-lg z-10 text-center"
              style={{ 
                left: `${selectedMacroBar.x + selectedMacroBar.width / 2}px`,
                top: `${Math.max(5, selectedMacroBar.y - 50)}px`,
                transform: 'translateX(-50%)',
                fontSize: '10px',
                lineHeight: '1.3'
              }}
              onClick={() => setSelectedMacroBar(null)}
            >
              <p className="text-muted-foreground whitespace-nowrap">{formatDate(parseISO(selectedMacroBar.data.date), 'short')}</p>
              <p className="whitespace-nowrap"><span className="text-green-500">Protein</span> {selectedMacroBar.data.proteinPct}%</p>
              <p className="whitespace-nowrap"><span className="text-blue-500">Carbs</span> {selectedMacroBar.data.carbsPct}%</p>
              <p className="whitespace-nowrap"><span className="text-orange-500">Fat</span> {selectedMacroBar.data.fatPct}%</p>
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-muted-foreground">Protein ({proteinPercent}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-muted-foreground">Carbs ({carbsPercent}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500" />
            <span className="text-muted-foreground">Fat ({fatPercent}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HydrationViewProps {
  entries: { date: string; totalMl: number; goalMl: number }[];
}

function HydrationView({ entries }: HydrationViewProps) {
  const { formatDate } = useFormattedDate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedBar, setSelectedBar] = useState<{ index: number; data: any; x: number; y: number; width: number } | null>(null);

  // Get goal from first entry (default to 3000ml)
  const goal = entries[0]?.goalMl || 3000;

  // Calculate 2-week date range based on offset, starting from Monday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysFromMonday);
  
  const startDate = new Date(currentMonday);
  startDate.setDate(currentMonday.getDate() - (weekOffset * 14));
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);

  // Generate all 14 days for the chart
  const chartData: Array<{
    date: string;
    dayLabel: string;
    fullDate: string;
    totalMl: number;
    goalMl: number;
    hitTarget: boolean;
  }> = [];
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = entries.find(e => e.date === dateStr);
    const totalMl = entry?.totalMl || 0;
    const entryGoal = entry?.goalMl || goal;
    chartData.push({
      date: dateStr,
      dayLabel: format(d, 'EEE').charAt(0),
      fullDate: formatDate(d, 'monthDay'),
      totalMl,
      goalMl: entryGoal,
      hitTarget: totalMl >= entryGoal,
    });
  }

  // Calculate stats for the visible 2-week range
  const daysWithData = chartData.filter(d => d.totalMl > 0);
  const timesHitTarget = daysWithData.filter(d => d.hitTarget).length;
  const timesMissed = daysWithData.length - timesHitTarget;
  
  // Calculate longest streak
  let longestStreak = 0;
  let currentStreak = 0;
  for (const day of chartData) {
    if (day.hitTarget && day.totalMl > 0) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (day.totalMl > 0) {
      currentStreak = 0;
    }
  }

  // Chart max is set so the goal line appears at 75% of the chart height
  // If goal is at 75%, then yMax = goal / 0.75 = goal * 1.333
  const maxDataValue = Math.max(...chartData.map(d => d.totalMl));
  const yMax = Math.max(goal / 0.75, maxDataValue * 1.1);
  const goalLineY = goal; // Yellow line at actual goal value

  const dateRangeLabel = `${formatDate(startDate, 'short').toUpperCase()} - ${formatDate(endDate, 'short').toUpperCase()}`;

  return (
    <div className="space-y-6">
      {/* Date Range Navigation */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{dateRangeLabel}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset(weekOffset + 1)}
            data-testid="button-prev-weeks"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
            data-testid="button-next-weeks"
          >
            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
          </Button>
        </div>
      </div>

      {/* Hydration Label with Goal */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Hydration (L)</span>
        <span className="text-sm">Current Goal: <span className="text-[#0cc9a9] font-medium">{(goal / 1000).toFixed(1)}L</span></span>
      </div>

      {/* Bar Chart with Click Label */}
      <div className="h-36 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid horizontal={true} vertical={false} stroke="#333" strokeDasharray="3 3" />
            <XAxis 
              dataKey="dayLabel" 
              tick={{ fill: '#888', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={20}
            />
            <YAxis 
              tick={{ fill: '#888', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
              width={36}
              tickFormatter={(v) => (v / 1000).toFixed(1)}
            />
            <Bar 
              dataKey="totalMl" 
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              onClick={(data: any, index: number) => {
                if (chartData[index].totalMl > 0) {
                  setSelectedBar({ 
                    index, 
                    data: chartData[index],
                    x: data.x,
                    y: data.y,
                    width: data.width
                  });
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={entry.totalMl === 0 ? "transparent" : entry.hitTarget ? "#0cc9a9" : "#3b82f6"}
                />
              ))}
            </Bar>
            <ReferenceLine y={goalLineY} stroke="#0cc9a9" strokeWidth={1} strokeDasharray="8 8" ifOverflow="extendDomain" />
          </BarChart>
        </ResponsiveContainer>
        {selectedBar && (
          <div 
            className="absolute bg-card border border-border rounded px-2 py-1 shadow-lg z-10 text-center"
            style={{ 
              left: `${selectedBar.x + selectedBar.width / 2}px`,
              top: `${selectedBar.y - 36}px`,
              transform: 'translateX(-50%)',
              fontSize: '10px',
              lineHeight: '1.3'
            }}
            onClick={() => setSelectedBar(null)}
          >
            <p className="text-muted-foreground whitespace-nowrap">{formatDate(parseISO(selectedBar.data.date), 'short')}</p>
            <p className="font-bold whitespace-nowrap text-[#3b82f6]">{(selectedBar.data.totalMl / 1000).toFixed(2)}L</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{timesHitTarget}</p>
          <p className="text-xs text-muted-foreground">Times Hit Target</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{timesMissed}</p>
          <p className="text-xs text-muted-foreground">Times Missed</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-[#0cc9a9]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#0cc9a9]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{longestStreak}</p>
          <p className="text-xs text-muted-foreground">Longest Streak</p>
        </Card>
      </div>
    </div>
  );
}

export default function ProgressMetricDetail() {
  const { formatDate } = useFormattedDate();
  const params = useParams<{ metricKey: string }>();
  const [, navigate] = useLocation();
  const metricKey = params.metricKey as MetricKey;
  const { preferences } = useUserPreferences();
  
  const config = metricConfigs.find(c => c.key === metricKey);
  
  const getDisplayUnit = (key: string) => {
    if (key === "bodyWeight" || key === "leanBodyMass") {
      return getWeightUnitLabel(preferences.weightUnit);
    }
    return config?.unit || "";
  };
  
  const formatWeightDisplay = (value: number): number => {
    if (metricKey === "bodyWeight" || metricKey === "leanBodyMass") {
      return formatWeightValue(value, preferences.weightUnit);
    }
    return value;
  };
  
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedSleepEntry, setExpandedSleepEntry] = useState<number | null>(null);
  const [expandedSleepStage, setExpandedSleepStage] = useState<string | null>(null);
  const [sleepScoreExpanded, setSleepScoreExpanded] = useState(false);
  const [sleepStagesAboutExpanded, setSleepStagesAboutExpanded] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [periodOffset, setPeriodOffset] = useState(0);
  const { toast } = useToast();

  const handleMetricSelect = (key: MetricKey) => {
    setShowDropdown(false);
    if (key !== metricKey) {
      navigate(`/my-progress/${key}`);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="page-metric-not-found">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Metric Not Found</h1>
        </div>
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">The requested metric could not be found.</p>
          <Button 
            onClick={() => navigate("/")}
            className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
            data-testid="button-go-home"
          >
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const Icon = config.icon;
  const endpoint = config.endpoint;

  const { data: entries = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: [endpoint],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `${endpoint}/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({ title: "Entry deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `${endpoint}/${id}`, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      if (endpoint === "/api/progress/steps") {
        await queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      }
      toast({ title: "Entry updated" });
      setEditingEntry(null);
      setEditValue("");
    },
    onError: () => {
      toast({ title: "Failed to update entry", variant: "destructive" });
    },
  });

  const handleEditClick = (entry: any) => {
    setEditingEntry(entry);
    const value = getValueFromEntry(entry, metricKey);
    setEditValue(value.toString());
  };

  const handleUpdateEntry = () => {
    if (!editingEntry || !editValue) return;
    
    let updateData: any = {};
    const numValue = parseFloat(editValue);
    
    switch (metricKey) {
      case "steps": updateData = { steps: numValue }; break;
      case "sleep": updateData = { hours: numValue }; break;
      case "bodyWeight": updateData = { weight: numValue }; break;
      case "bodyFat": updateData = { percentage: numValue }; break;
      case "caloricIntake": updateData = { calories: numValue }; break;
      case "restingHR": updateData = { bpm: numValue }; break;
      case "leanBodyMass": updateData = { mass: numValue }; break;
      case "caloricBurn": updateData = { calories: numValue }; break;
      case "exerciseMinutes": updateData = { minutes: numValue }; break;
      default: updateData = { value: numValue }; break;
    }
    
    updateMutation.mutate({ id: editingEntry.id, data: updateData });
  };

  const currentPeriod = getPeriodRange(timeRange, selectedWeekStart, periodOffset);
  const cutoffDate = currentPeriod.start;
  const filteredEntries = entries.filter(entry => {
    const entryDate = startOfDay(parseISO(entry.date));
    const cutoff = startOfDay(currentPeriod.start);
    const end = startOfDay(currentPeriod.end);
    return (isAfter(entryDate, cutoff) || isSameDay(entryDate, cutoff)) && (isBefore(entryDate, end) || isSameDay(entryDate, end));
  });

  const now = new Date();
  const rangeStartDate = startOfDay(currentPeriod.start);
  const rangeEndDate = startOfDay(currentPeriod.end);

  const chartData = [...filteredEntries]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(entry => ({
      timestamp: parseISO(entry.date).getTime(),
      value: getValueFromEntry(entry, metricKey),
      fullDate: entry.date,
    }));

  const chartDomain: [number, number] = [rangeStartDate.getTime(), rangeEndDate.getTime()];
  
  const generateTicks = (start: number, end: number, range: TimeRange): number[] => {
    const ticks: number[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (range === "1W") {
      const dayMs = 24 * 60 * 60 * 1000;
      let current = startDate.getTime();
      while (current <= end) {
        ticks.push(current);
        current += dayMs;
      }
    } else if (range === "1M") {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      let current = startDate.getTime();
      while (current <= end) {
        ticks.push(current);
        current += weekMs;
      }
      if (ticks.length > 0 && end - ticks[ticks.length - 1] > 3 * 24 * 60 * 60 * 1000) {
        ticks.push(end);
      }
    } else if (range === "3M") {
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      let current = startDate.getTime();
      while (current <= end) {
        ticks.push(current);
        current += twoWeeksMs;
      }
    } else {
      let interval: number;
      switch (range) {
        case "6M": interval = 1; break;
        case "1Y": interval = 2; break;
        default: interval = 1;
      }
      
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current.getTime() <= end) {
        if (current.getTime() >= start) {
          ticks.push(current.getTime());
        }
        current = new Date(current.getFullYear(), current.getMonth() + interval, 1);
      }
    }
    
    return ticks;
  };
  
  const chartTicks = generateTicks(chartDomain[0], chartDomain[1], timeRange);
  
  const formatTickLabel = (timestamp: number): string => {
    if (timeRange === "1W") {
      return format(new Date(timestamp), "EEE");
    }
    if (timeRange === "1M" || timeRange === "3M") {
      return formatDate(new Date(timestamp), "monthDay");
    }
    return format(new Date(timestamp), "MMM yy");
  };

  const filteredEntriesForList = metricKey === "hydration" 
    ? entries.filter((e: any) => e.totalMl > 0)
    : entries;
  
  const allGroupedByMonth = filteredEntriesForList.reduce((acc, entry) => {
    const monthKey = format(parseISO(entry.date), "MMMM yyyy");
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedMonths = Object.keys(allGroupedByMonth).sort((a, b) => {
    const dateA = parse(a, "MMMM yyyy", new Date());
    const dateB = parse(b, "MMMM yyyy", new Date());
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="min-h-screen bg-background pt-14" data-testid="page-progress-metric-detail">
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-background"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.06) 100%)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Button 
              variant="ghost" 
              className="p-0 text-foreground hover:bg-muted flex items-center justify-center"
              style={{ width: '50px', height: '50px', minWidth: '50px', minHeight: '50px' }}
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <X className="w-5 h-5" />
            </Button>
            {metricKey === "photos" ? (
              <h1 className="text-foreground text-xl font-semibold" data-testid="text-metric-title">{config.label}</h1>
            ) : (
              <button 
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                onClick={() => setShowDropdown(!showDropdown)}
                data-testid="button-metric-dropdown"
              >
                <h1 className="text-foreground text-xl font-semibold" data-testid="text-metric-title">{config.label}</h1>
                <ChevronUp className={`w-4 h-4 text-foreground transition-transform ${showDropdown ? '' : 'rotate-180'}`} />
              </button>
            )}
            {metricKey === "caloricIntake" || metricKey === "hydration" || metricKey === "sleep" ? (
              <div style={{ width: '50px' }} />
            ) : (
              <Button
                size="sm"
                className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                onClick={() => {
                  const bodyMetrics: MetricKey[] = ["bodyWeight", "bodyFat", "leanBodyMass"];
                  const measurementMetrics: MetricKey[] = ["neck", "chest", "shoulder", "leftBicep", "rightBicep", "leftForearm", "rightForearm", "waist", "hips", "leftThigh", "rightThigh", "leftCalf", "rightCalf"];
                  if (bodyMetrics.includes(metricKey) || measurementMetrics.includes(metricKey)) {
                    navigate(`/my-progress/add?from=/my-progress/${metricKey}`);
                  } else {
                    setShowAddForm(!showAddForm);
                  }
                }}
                data-testid="button-add-entry"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
      </header>

      <MetricDropdown
        currentMetricKey={metricKey}
        currentLabel={config.label}
        isOpen={showDropdown}
        onToggle={() => setShowDropdown(!showDropdown)}
        onSelect={handleMetricSelect}
        onClose={() => setShowDropdown(false)}
      />

      <div className="p-4 space-y-6">
        {metricKey !== "caloricIntake" && metricKey !== "hydration" && (
          <div className="space-y-3">
            <Tabs value={timeRange} onValueChange={(v) => {
              setTimeRange(v as TimeRange);
              setPeriodOffset(0);
              if (v === "1W") {
                setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
              }
            }}>
              <TabsList className="grid grid-cols-5 w-full">
                {timeRanges.map(range => (
                  <TabsTrigger 
                    key={range} 
                    value={range}
                    className="text-xs"
                    data-testid={`tab-range-${range}`}
                  >
                  {range}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {(() => {
              const navigatePrev = () => {
                if (timeRange === "1W") {
                  setSelectedWeekStart(prev => addWeeks(prev, -1));
                } else {
                  setPeriodOffset(prev => prev - 1);
                }
              };
              const navigateNext = () => {
                if (timeRange === "1W") {
                  const nextWeek = addWeeks(selectedWeekStart, 1);
                  if (!isAfter(nextWeek, startOfWeek(new Date(), { weekStartsOn: 1 }))) {
                    setSelectedWeekStart(nextWeek);
                  }
                } else {
                  if (periodOffset < 0) setPeriodOffset(prev => prev + 1);
                }
              };
              const isAtCurrent = timeRange === "1W"
                ? isSameDay(selectedWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))
                : periodOffset === 0;
              const canGoNext = !isAtCurrent;

              const periodRange = currentPeriod;
              let dateLabel = "";
              let currentLabel = "";
              if (timeRange === "1W") {
                dateLabel = `${format(selectedWeekStart, "MMM d")} --- ${format(getWeekEnd(selectedWeekStart), "MMM d, yyyy")}`;
                currentLabel = "This Week";
              } else if (timeRange === "1M") {
                dateLabel = format(periodRange.start, "MMMM yyyy");
                currentLabel = "This Month";
              } else if (timeRange === "3M") {
                dateLabel = `${format(periodRange.start, "MMM d")} --- ${format(periodRange.end, "MMM d, yyyy")}`;
                currentLabel = "Current Quarter";
              } else if (timeRange === "6M") {
                dateLabel = `${format(periodRange.start, "MMM d")} --- ${format(periodRange.end, "MMM d, yyyy")}`;
                currentLabel = "Last 6 Months";
              } else {
                dateLabel = `${format(periodRange.start, "MMM yyyy")} --- ${format(periodRange.end, "MMM yyyy")}`;
                currentLabel = "This Year";
              }

              return (
                <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                  <button
                    onClick={navigatePrev}
                    className="p-1.5 rounded-lg hover:bg-muted/50 active:scale-95 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                    {isAtCurrent && (
                      <p className="text-xs text-[#0cc9a9] font-medium">{currentLabel}</p>
                    )}
                  </div>
                  <button
                    onClick={navigateNext}
                    className={`p-1.5 rounded-lg transition-all ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted/50 active:scale-95'}`}
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Custom Caloric Intake View */}
        {metricKey === "caloricIntake" && (
          <CaloricIntakeView entries={filteredEntries} timeRange={timeRange} />
        )}

        {/* Custom Hydration View */}
        {metricKey === "hydration" && (
          <HydrationView entries={entries as { date: string; totalMl: number; goalMl: number }[]} />
        )}

        {/* Standard chart for other metrics */}
        {metricKey !== "caloricIntake" && metricKey !== "hydration" && isLoading ? (
          <Skeleton className="h-48 w-full" data-testid="skeleton-chart" />
        ) : metricKey !== "caloricIntake" && metricKey !== "hydration" && chartData.length > 0 ? (
          <Card className="p-2" data-testid="chart-progress">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0cc9a9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0cc9a9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="timestamp" 
                  type="number"
                  domain={chartDomain}
                  ticks={chartTicks}
                  tickFormatter={formatTickLabel}
                  axisLine={{ stroke: '#333', strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10, dy: 5 }}
                  scale="time"
                  height={25}
                />
                <YAxis 
                  axisLine={{ stroke: '#333', strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 9 }}
                  width={28}
                  domain={metricKey === "sleep" ? [(dataMin: number) => Math.floor(dataMin - 0.5), (dataMax: number) => Math.ceil(dataMax + 0.5)] : ['dataMin - 1', 'dataMax + 1']}
                  orientation="left"
                  tickCount={metricKey === "sleep" ? 5 : undefined}
                  tickFormatter={(v) => {
                    if (metricKey === "sleep") return v.toFixed(1);
                    if (v >= 1000) return `${Math.round(v / 1000)}k`;
                    return Math.round(v).toString();
                  }}
                />
                {chartData.length > 0 && (() => {
                  const values = chartData.map(d => d.value);
                  const minVal = Math.min(...values);
                  const maxVal = Math.max(...values);
                  const midVal = (minVal + maxVal) / 2;
                  return <ReferenceLine y={midVal} stroke="#444" strokeWidth={1} strokeOpacity={0.4} />;
                })()}
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ 
                          backgroundColor: '#1f1f1f', 
                          border: '2px solid #0cc9a9',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          lineHeight: '1.2'
                        }}>
                          <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
                            {formatDate(new Date(data.timestamp), "short")}
                          </p>
                          <p style={{ color: '#0cc9a9', fontSize: '22px', fontWeight: 'bold', margin: 0 }}>
                            {formatTooltipValue(data.value, metricKey)}<span style={{ fontSize: '12px', fontWeight: 'normal' }}>{getTooltipUnit(metricKey, config.unit)}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0cc9a9" 
                  strokeWidth={2}
                  fill="url(#colorValue)"
                  connectNulls={true}
                  dot={(timeRange === "1W" || timeRange === "1M" || timeRange === "3M") ? { r: 4, fill: "#0cc9a9", stroke: "#0cc9a9", strokeWidth: 2 } : false}
                  activeDot={(timeRange === "1W" || timeRange === "1M" || timeRange === "3M") ? { r: 6, fill: "#0cc9a9", stroke: "#fff", strokeWidth: 2 } : false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        ) : metricKey !== "caloricIntake" && metricKey !== "hydration" ? (
          <Card className="p-4">
            <div className="h-48 flex items-center justify-center text-muted-foreground" data-testid="text-no-data">
              No data for this time period
            </div>
          </Card>
        ) : null}

        {metricKey === "bodyWeight" && entries.length > 0 && (() => {
          const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const currentWeight = sortedEntries[sortedEntries.length - 1]?.weight || 0;
          const startWeight = sortedEntries[0]?.weight || 0;
          const weightChange = currentWeight - startWeight;
          const lowestWeight = Math.min(...sortedEntries.map(e => e.weight));
          const highestWeight = Math.max(...sortedEntries.map(e => e.weight));
          
          const unit = getDisplayUnit("bodyWeight");
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="bodyweight-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Scale className="w-6 h-6 mx-auto text-[#0cc9a9] mb-2" />
                <p className="text-2xl font-bold text-foreground" data-testid="text-current-weight">{formatWeightDisplay(currentWeight)}{unit}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                {weightChange < 0 ? (
                  <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                ) : weightChange > 0 ? (
                  <TrendingUp className="w-6 h-6 mx-auto text-red-500 mb-2" />
                ) : (
                  <Minus className="w-6 h-6 mx-auto text-gray-500 mb-2" />
                )}
                <p className="text-2xl font-bold text-foreground" data-testid="text-weight-change">
                  {weightChange > 0 ? "+" : ""}{formatWeightDisplay(Math.abs(weightChange)).toFixed(1)}{unit}
                </p>
                <p className="text-xs text-muted-foreground">Change</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground" data-testid="text-lowest-weight">{formatWeightDisplay(lowestWeight)}{unit}</p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-foreground" data-testid="text-highest-weight">{formatWeightDisplay(highestWeight)}{unit}</p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
            </div>
          );
        })()}

        {/* Steps Summary Cards */}
        {metricKey === "steps" && filteredEntries.length > 0 && (() => {
          const values = filteredEntries.map(e => e.steps);
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          return (
            <div className="grid grid-cols-3 gap-3" data-testid="steps-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Minus className="w-6 h-6 mx-auto text-[#0cc9a9] mb-2" />
                <p className="text-xl font-bold text-foreground">{avg.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Average</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{highest.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{lowest.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
            </div>
          );
        })()}

        {/* Sleep Hub Section */}
        {metricKey === "sleep" && filteredEntries.length > 0 && (() => {
          const STAGE_COLORS = { deep: "#3b82f6", light: "#06b6d4", rem: "#a855f7", awake: "#f97316" };
          const values = filteredEntries.map(e => e.hours);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          const formatHoursDisplay = (h: number) => {
            const hours = Math.floor(h);
            const mins = Math.round((h - hours) * 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
          };
          const formatDurationMins = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h}h ${m}m`;
          };

          const entriesWithScore = filteredEntries.filter((e: any) => e.sleepScore);
          const avgSleepScore = entriesWithScore.length > 0
            ? entriesWithScore.reduce((sum: number, e: any) => sum + (e.sleepScore || 0), 0) / entriesWithScore.length
            : 0;

          const entriesWithStages = filteredEntries.filter((e: any) => e.deepSleepMinutes || e.lightSleepMinutes || e.remSleepMinutes);
          const avgStages = entriesWithStages.length > 0 ? {
            deep: entriesWithStages.reduce((s: number, e: any) => s + (e.deepSleepMinutes || 0), 0) / entriesWithStages.length,
            light: entriesWithStages.reduce((s: number, e: any) => s + (e.lightSleepMinutes || 0), 0) / entriesWithStages.length,
            rem: entriesWithStages.reduce((s: number, e: any) => s + (e.remSleepMinutes || 0), 0) / entriesWithStages.length,
            awake: entriesWithStages.reduce((s: number, e: any) => s + (e.awakeMinutes || 0), 0) / entriesWithStages.length,
          } : null;

          const getSleepScoreLabel = (score: number) => {
            if (score >= 85) return { label: "Excellent", color: "text-green-500" };
            if (score >= 70) return { label: "Good", color: "text-blue-500" };
            if (score >= 50) return { label: "Fair", color: "text-[#0cc9a9]" };
            return { label: "Poor", color: "text-red-500" };
          };

          const half = Math.floor(filteredEntries.length / 2);
          const trendDir = filteredEntries.length >= 4 ? (() => {
            const recentAvg = filteredEntries.slice(half).reduce((s: number, e: any) => s + e.hours, 0) / (filteredEntries.length - half);
            const olderAvg = filteredEntries.slice(0, half).reduce((s: number, e: any) => s + e.hours, 0) / half;
            const diff = recentAvg - olderAvg;
            if (Math.abs(diff) < 0.1) return null;
            return { direction: diff > 0 ? "up" : "down", value: Math.abs(diff) };
          })() : null;

          const getPreviousPeriodEntries = () => {
            let prevRange: { start: Date; end: Date };
            if (timeRange === "1W") {
              const prevWeekStart = addWeeks(selectedWeekStart, -1);
              prevRange = { start: prevWeekStart, end: getWeekEnd(prevWeekStart) };
            } else {
              prevRange = getPeriodRange(timeRange, selectedWeekStart, periodOffset - 1);
            }
            return entries.filter((e: any) => {
              const d = startOfDay(parseISO(e.date));
              return (isAfter(d, startOfDay(prevRange.start)) || isSameDay(d, startOfDay(prevRange.start))) && (isBefore(d, startOfDay(prevRange.end)) || isSameDay(d, startOfDay(prevRange.end)));
            });
          };
          const prevEntries = getPreviousPeriodEntries();

          const prevEntriesWithScore = prevEntries.filter((e: any) => e.sleepScore);
          const prevAvgSleepScore = prevEntriesWithScore.length > 0
            ? prevEntriesWithScore.reduce((s: number, e: any) => s + (e.sleepScore || 0), 0) / prevEntriesWithScore.length
            : null;
          const sleepScoreChange = prevAvgSleepScore !== null && avgSleepScore > 0
            ? Math.round(avgSleepScore - prevAvgSleepScore)
            : null;

          const prevEntriesWithStages = prevEntries.filter((e: any) => e.deepSleepMinutes || e.lightSleepMinutes || e.remSleepMinutes);
          const prevAvgStages = prevEntriesWithStages.length > 0 ? {
            deep: prevEntriesWithStages.reduce((s: number, e: any) => s + (e.deepSleepMinutes || 0), 0) / prevEntriesWithStages.length,
            light: prevEntriesWithStages.reduce((s: number, e: any) => s + (e.lightSleepMinutes || 0), 0) / prevEntriesWithStages.length,
            rem: prevEntriesWithStages.reduce((s: number, e: any) => s + (e.remSleepMinutes || 0), 0) / prevEntriesWithStages.length,
            awake: prevEntriesWithStages.reduce((s: number, e: any) => s + (e.awakeMinutes || 0), 0) / prevEntriesWithStages.length,
          } : null;

          const getStageChange = (stage: string) => {
            if (!avgStages || !prevAvgStages) return null;
            const curr = avgStages[stage as keyof typeof avgStages];
            const prev = prevAvgStages[stage as keyof typeof prevAvgStages];
            const diff = Math.round(curr - prev);
            if (Math.abs(diff) < 2) return null;
            return diff;
          };

          const periodLabel = timeRange === "1W" ? "vs last week" : timeRange === "1M" ? "vs prev month" : timeRange === "3M" ? "vs prev 3 months" : timeRange === "6M" ? "vs prev 6 months" : "vs prev year";

          const stagesPieData = avgStages ? [
            { name: "Deep", value: Math.round(avgStages.deep), color: STAGE_COLORS.deep },
            { name: "Light", value: Math.round(avgStages.light), color: STAGE_COLORS.light },
            { name: "REM", value: Math.round(avgStages.rem), color: STAGE_COLORS.rem },
            { name: "Awake", value: Math.round(avgStages.awake), color: STAGE_COLORS.awake },
          ].filter(d => d.value > 0) : [];

          const scoreColor = avgSleepScore >= 85 ? "#22c55e" : avgSleepScore >= 70 ? "#3b82f6" : avgSleepScore >= 50 ? "#0cc9a9" : "#ef4444";
          const scoreGradientId = "sleepScoreGrad";
          const totalStageMins = avgStages ? avgStages.deep + avgStages.light + avgStages.rem + avgStages.awake : 0;
          const stagePercent = (val: number) => totalStageMins > 0 ? Math.round((val / totalStageMins) * 100) : 0;

          return (
            <div className="space-y-4">
              {avgSleepScore > 0 && (
                <Card className="bg-card border-border overflow-hidden">
                  <button onClick={() => setSleepScoreExpanded(!sleepScoreExpanded)} className="w-full text-left">
                    <div className="p-5 flex items-center gap-6">
                      <div className="relative w-28 h-28 flex-shrink-0">
                        <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90">
                          <defs>
                            <linearGradient id={scoreGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor={scoreColor} stopOpacity="0.5" />
                              <stop offset="100%" stopColor={scoreColor} stopOpacity="1" />
                            </linearGradient>
                          </defs>
                          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" opacity="0.3" />
                          <circle cx="60" cy="60" r="50" fill="none"
                            stroke={`url(#${scoreGradientId})`}
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(avgSleepScore / 100) * 2 * Math.PI * 50} ${2 * Math.PI * 50}`}
                            className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-foreground leading-none">{Math.round(avgSleepScore)}</span>
                          <span className="text-xs text-muted-foreground mt-0.5 font-medium">of 100</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-base text-muted-foreground uppercase tracking-widest font-medium">Sleep Score</p>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${sleepScoreExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        <p className="text-2xl font-bold" style={{ color: scoreColor }}>
                          {getSleepScoreLabel(avgSleepScore).label}
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Avg Duration</span>
                            <span className="text-sm font-semibold text-foreground">{formatHoursDisplay(avg)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Best Night</span>
                            <span className="text-sm font-semibold text-green-500">{formatHoursDisplay(highest)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Shortest Night</span>
                            <span className="text-sm font-semibold text-orange-400">{formatHoursDisplay(lowest)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                  {sleepScoreExpanded && (
                    <div className="px-5 pb-5 pt-0 space-y-3">
                      <div className="h-px bg-border/50" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        Your sleep score reflects overall sleep quality based on duration, timing, stages, and interruptions. Scores above 85 indicate excellent restorative sleep.
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Excellent", range: "85-100", color: "#22c55e" },
                          { label: "Good", range: "70-84", color: "#3b82f6" },
                          { label: "Fair", range: "50-69", color: "#0cc9a9" },
                          { label: "Poor", range: "0-49", color: "#ef4444" },
                        ].map(tier => (
                          <div key={tier.label} className="text-center">
                            <div className="w-full h-2 rounded-full mb-1.5" style={{ backgroundColor: tier.color }} />
                            <p className="text-xs font-semibold text-foreground">{tier.label}</p>
                            <p className="text-xs text-muted-foreground">{tier.range}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(trendDir || sleepScoreChange !== null) && (
                    <div className="border-t border-border/50">
                      {sleepScoreChange !== null && sleepScoreChange !== 0 && (
                        <div className={`px-5 py-2.5 flex items-center gap-2 ${sleepScoreChange > 0 ? "bg-green-500/5" : "bg-red-500/5"}`}>
                          {sleepScoreChange > 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                          <p className="text-sm text-muted-foreground">
                            Score <span className={`font-semibold ${sleepScoreChange > 0 ? "text-green-500" : "text-red-400"}`}>{sleepScoreChange > 0 ? "+" : ""}{sleepScoreChange} pts</span> {periodLabel}
                          </p>
                        </div>
                      )}
                      {trendDir && (
                        <div className={`px-5 py-2.5 flex items-center gap-2 ${trendDir.direction === "up" ? "bg-green-500/5" : "bg-red-500/5"}`}>
                          {trendDir.direction === "up" ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                          <p className="text-sm text-muted-foreground">
                            Duration <span className={`font-semibold ${trendDir.direction === "up" ? "text-green-500" : "text-red-400"}`}>{trendDir.direction === "up" ? "+" : "-"}{trendDir.value.toFixed(1)}h</span> {periodLabel}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {!avgSleepScore && (
                <div className="grid grid-cols-3 gap-3" data-testid="sleep-stats-cards">
                  <Card className="bg-card border-border p-3 text-center">
                    <Minus className="w-5 h-5 mx-auto text-[#a78bfa] mb-1" />
                    <p className="text-lg font-bold text-foreground">{formatHoursDisplay(avg)}</p>
                    <p className="text-[10px] text-muted-foreground">Average</p>
                  </Card>
                  <Card className="bg-card border-border p-3 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                    <p className="text-lg font-bold text-foreground">{formatHoursDisplay(highest)}</p>
                    <p className="text-[10px] text-muted-foreground">Highest</p>
                  </Card>
                  <Card className="bg-card border-border p-3 text-center">
                    <TrendingDown className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-lg font-bold text-foreground">{formatHoursDisplay(lowest)}</p>
                    <p className="text-[10px] text-muted-foreground">Lowest</p>
                  </Card>
                </div>
              )}

              {stagesPieData.length > 0 && avgStages && (() => {
                const stageDetails: Record<string, { role: string; ideal: string; tip: string }> = {
                  Deep: { role: "Physical restoration, muscle repair, immune system strengthening, and growth hormone release.", ideal: "1-2 hours (15-25% of total sleep)", tip: "Avoid alcohol before bed and maintain a cool room temperature to maximize deep sleep." },
                  Light: { role: "Memory consolidation, motor skill learning, and transitional recovery between deeper stages.", ideal: "3-4 hours (45-55% of total sleep)", tip: "Light sleep is natural and healthy. Consistent bedtimes help optimize your full sleep architecture." },
                  REM: { role: "Emotional processing, creativity, memory integration, and cognitive restoration.", ideal: "1.5-2 hours (20-25% of total sleep)", tip: "REM increases in later sleep cycles. Sleeping a full 7-8 hours ensures you get enough." },
                  Awake: { role: "Brief awakenings are normal between sleep cycles. They usually go unnoticed.", ideal: "Under 30 minutes total per night", tip: "If awake time is high, review caffeine intake, screen time, and evening stress levels." },
                };

                const r = 92;
                const circumference = 2 * Math.PI * r;
                let cumulativeOffset = 0;

                return (
                <Card className="bg-card border-border overflow-hidden">
                  <div className="px-5 pt-5 pb-1 flex items-start justify-between">
                    <div>
                      <p className="text-base text-muted-foreground uppercase tracking-widest font-medium">Sleep Stages</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Nightly average breakdown</p>
                    </div>
                    <button
                      onClick={() => setSleepStagesAboutExpanded(!sleepStagesAboutExpanded)}
                      className="p-1.5 rounded-lg hover:bg-muted/50 active:scale-95 transition-all"
                    >
                      <Info className={`w-5 h-5 transition-colors ${sleepStagesAboutExpanded ? 'text-[#0cc9a9]' : 'text-muted-foreground'}`} />
                    </button>
                  </div>

                  {sleepStagesAboutExpanded && (
                    <div className="px-5 pb-3 pt-2">
                      <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/50">
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          Your body cycles through four distinct sleep stages multiple times each night. Each stage plays a unique role in physical and mental recovery.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { name: "Deep Sleep", color: STAGE_COLORS.deep, desc: "Physical repair & restoration" },
                            { name: "Light Sleep", color: STAGE_COLORS.light, desc: "Memory & motor learning" },
                            { name: "REM Sleep", color: STAGE_COLORS.rem, desc: "Emotional & cognitive processing" },
                            { name: "Awake Time", color: STAGE_COLORS.awake, desc: "Natural brief awakenings" },
                          ].map(s => (
                            <div key={s.name} className="flex items-start gap-2.5 bg-background/50 rounded-lg p-2.5">
                              <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: s.color }} />
                              <div>
                                <p className="text-sm font-semibold text-foreground leading-tight">{s.name}</p>
                                <p className="text-xs text-muted-foreground leading-tight mt-0.5">{s.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground italic">Tap each stage below for more details, ideal ranges, and tips.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center py-8 px-5">
                    <div className="relative" style={{ width: 280, height: 280 }}>
                      <svg width="280" height="280" viewBox="0 0 280 280">
                        <circle cx="140" cy="140" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="20" opacity="0.3" />
                        {stagesPieData.map((segment) => {
                          const segFraction = segment.value / totalStageMins;
                          const segLength = segFraction * circumference;
                          const gapSize = 4;
                          const dashArray = `${Math.max(0, segLength - gapSize)} ${circumference - Math.max(0, segLength - gapSize)}`;
                          const rotation = -90 + (cumulativeOffset / totalStageMins) * 360 + (gapSize / circumference) * 180;
                          cumulativeOffset += segment.value;
                          return (
                            <circle
                              key={segment.name}
                              cx="140" cy="140" r={r}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth="20"
                              strokeDasharray={dashArray}
                              strokeLinecap="round"
                              transform={`rotate(${rotation} 140 140)`}
                              className="transition-all duration-500"
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-4xl font-bold text-foreground leading-none tracking-tight">{formatDurationMins(Math.round(totalStageMins))}</span>
                        <span className="text-sm text-muted-foreground font-medium mt-1.5">Total Sleep</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-2.5">
                    {[
                      { label: "Deep", key: "deep", val: avgStages.deep, color: STAGE_COLORS.deep },
                      { label: "Light", key: "light", val: avgStages.light, color: STAGE_COLORS.light },
                      { label: "REM", key: "rem", val: avgStages.rem, color: STAGE_COLORS.rem },
                      { label: "Awake", key: "awake", val: avgStages.awake, color: STAGE_COLORS.awake },
                    ].filter(s => s.val > 0).map(s => {
                      const isOpen = expandedSleepStage === s.label;
                      const detail = stageDetails[s.label];
                      const pct = stagePercent(s.val);
                      const change = getStageChange(s.key);
                      return (
                        <button
                          key={s.label}
                          onClick={() => setExpandedSleepStage(isOpen ? null : s.label)}
                          className="w-full text-left"
                        >
                          <div className={`rounded-xl transition-all duration-200 ${isOpen ? 'bg-muted/50 ring-1 ring-border' : 'bg-muted/20 hover:bg-muted/35 active:scale-[0.98]'}`}>
                            <div className="flex items-center gap-3.5 p-4">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}18` }}>
                                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: s.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-base font-semibold text-foreground">{s.label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-foreground">{formatDurationMins(Math.round(s.val))}</span>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 mt-1.5">
                                  <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground w-9 text-right">{pct}%</span>
                                </div>
                                {change !== null && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {s.key === "awake" ? (
                                      change < 0 ? <TrendingDown className="w-3 h-3 text-green-500" /> : <TrendingUp className="w-3 h-3 text-red-400" />
                                    ) : (
                                      change > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-400" />
                                    )}
                                    <span className={`text-xs font-medium ${s.key === "awake" ? (change < 0 ? "text-green-500" : "text-red-400") : (change > 0 ? "text-green-500" : "text-red-400")}`}>
                                      {change > 0 ? "+" : ""}{change}min {periodLabel}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isOpen && detail && (
                              <div className="px-4 pb-4 pt-0 space-y-3">
                                <div className="h-px bg-border/50" />
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">What it does</p>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{detail.role}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Ideal range</p>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{detail.ideal}</p>
                                  </div>
                                  <div className="bg-blue-500/8 rounded-xl px-4 py-3 border border-blue-500/10">
                                    <p className="text-xs text-blue-400 uppercase tracking-wider font-medium mb-1">Tip</p>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{detail.tip}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
                );
              })()}
            </div>
          );
        })()}

        {/* Body Fat Summary Cards */}
        {metricKey === "bodyFat" && filteredEntries.length > 0 && (() => {
          const values = filteredEntries.map(e => e.percentage);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          return (
            <div className="grid grid-cols-3 gap-3" data-testid="bodyfat-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Minus className="w-6 h-6 mx-auto text-[#f97316] mb-2" />
                <p className="text-xl font-bold text-foreground">{avg.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Average</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{highest}%</p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{lowest}%</p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
            </div>
          );
        })()}

        {/* Resting HR Summary Cards */}
        {metricKey === "restingHR" && filteredEntries.length > 0 && (() => {
          const values = filteredEntries.map(e => e.bpm);
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          return (
            <div className="grid grid-cols-3 gap-3" data-testid="restinghr-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Heart className="w-6 h-6 mx-auto text-[#ef4444] mb-2" />
                <p className="text-xl font-bold text-foreground">{avg} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
                <p className="text-xs text-muted-foreground">Average</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{highest} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{lowest} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
            </div>
          );
        })()}

        {/* Caloric Burn Summary Cards */}
        {metricKey === "caloricBurn" && filteredEntries.length > 0 && (() => {
          const values = filteredEntries.map(e => e.calories);
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          return (
            <div className="grid grid-cols-3 gap-3" data-testid="caloricburn-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Flame className="w-6 h-6 mx-auto text-[#f43f5e] mb-2" />
                <p className="text-xl font-bold text-foreground">{avg.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
                <p className="text-xs text-muted-foreground">Average</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{highest.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{lowest.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
            </div>
          );
        })()}

        {/* Exercise Minutes Summary Cards */}
        {metricKey === "exerciseMinutes" && filteredEntries.length > 0 && (() => {
          const values = filteredEntries.map(e => e.minutes);
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          const highest = Math.max(...values);
          const lowest = Math.min(...values);
          return (
            <div className="grid grid-cols-3 gap-3" data-testid="exerciseminutes-stats-cards">
              <Card className="bg-card border-border p-4 text-center">
                <Dumbbell className="w-6 h-6 mx-auto text-[#22c55e] mb-2" />
                <p className="text-xl font-bold text-foreground">{avg} <span className="text-sm font-normal text-muted-foreground">min</span></p>
                <p className="text-xs text-muted-foreground">Average</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{highest} <span className="text-sm font-normal text-muted-foreground">min</span></p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </Card>
              <Card className="bg-card border-border p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold text-foreground">{lowest} <span className="text-sm font-normal text-muted-foreground">min</span></p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </Card>
            </div>
          );
        })()}

        <div className="space-y-4">
          {showAddForm && metricKey !== "caloricIntake" && (
            <Card className="p-4" data-testid="card-add-form">
              <AddEntryForm 
                metricKey={metricKey} 
                endpoint={endpoint}
                onSuccess={() => setShowAddForm(false)}
              />
            </Card>
          )}

          {metricKey === "caloricIntake" ? null : metricKey === "sleep" ? (() => {
            const SLEEP_STAGE_COLORS = { deep: "#3b82f6", light: "#06b6d4", rem: "#a855f7", awake: "#f97316" };
            const fmtDur = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${h}h ${m}m`; };
            const allSleepEntries = filteredEntries
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const getSleepScoreColor = (score: number) => {
              if (score >= 85) return "text-green-500";
              if (score >= 70) return "text-blue-500";
              if (score >= 50) return "text-[#0cc9a9]";
              return "text-red-500";
            };
            return allSleepEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4" data-testid="text-no-entries">No entries yet</p>
            ) : (
              <Card className="bg-card border-border overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between">
                  <p className="text-base text-muted-foreground uppercase tracking-widest font-medium">Sleep Log</p>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">{allSleepEntries.length} nights</span>
                </div>
                <div className="divide-y divide-border/50">
                  {allSleepEntries.map((entry: any) => {
                    const isExpanded = expandedSleepEntry === entry.id;
                    const hasStages = entry.deepSleepMinutes || entry.lightSleepMinutes || entry.remSleepMinutes;
                    const entryTotal = (entry.deepSleepMinutes || 0) + (entry.lightSleepMinutes || 0) + (entry.remSleepMinutes || 0) + (entry.awakeMinutes || 0);
                    return (
                      <div key={entry.id} data-testid={`entry-sleep-${entry.id}`}>
                        <button
                          onClick={() => setExpandedSleepEntry(isExpanded ? null : entry.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/20 transition-colors active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-muted/40 flex flex-col items-center justify-center">
                              <span className="text-sm font-bold text-foreground leading-none">
                                {format(parseISO(entry.date), "dd")}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase leading-none mt-0.5">
                                {format(parseISO(entry.date), "MMM")}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-base">{(() => { const h = entry.hours || 0; const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`; })()}</p>
                              {entry.bedTime && entry.wakeTime && (
                                <p className="text-xs text-muted-foreground mt-0.5">{entry.bedTime} — {entry.wakeTime}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {entry.sleepScore ? (
                              <div className="flex items-center gap-2">
                                <div className="relative w-10 h-10">
                                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" opacity="0.3" />
                                    <circle cx="18" cy="18" r="14" fill="none"
                                      stroke={entry.sleepScore >= 85 ? "#22c55e" : entry.sleepScore >= 70 ? "#3b82f6" : entry.sleepScore >= 50 ? "#0cc9a9" : "#ef4444"}
                                      strokeWidth="3" strokeLinecap="round"
                                      strokeDasharray={`${(entry.sleepScore / 100) * 2 * Math.PI * 14} ${2 * Math.PI * 14}`} />
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{entry.sleepScore}</span>
                                </div>
                              </div>
                            ) : entry.quality ? (
                              <span className="text-base font-medium text-foreground">{entry.quality}<span className="text-xs text-muted-foreground">/10</span></span>
                            ) : null}
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-3">
                            <div className="flex gap-3">
                              {entry.quality && (
                                <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                                  <Star className="w-4 h-4 mx-auto text-[#0cc9a9] mb-1" />
                                  <p className="text-base font-bold text-foreground">{entry.quality}/10</p>
                                  <p className="text-xs text-muted-foreground">Quality</p>
                                </div>
                              )}
                              {entry.sleepScore && (
                                <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                                  <Moon className="w-4 h-4 mx-auto text-blue-400 mb-1" />
                                  <p className="text-base font-bold text-foreground">{entry.sleepScore}/100</p>
                                  <p className="text-xs text-muted-foreground">Score</p>
                                </div>
                              )}
                              <div className="flex-1 bg-muted/30 rounded-xl p-3 text-center">
                                <Moon className="w-4 h-4 mx-auto text-purple-400 mb-1" />
                                <p className="text-base font-bold text-foreground">{fmtDur(entry.durationMinutes)}</p>
                                <p className="text-xs text-muted-foreground">Duration</p>
                              </div>
                            </div>

                            {hasStages && (
                              <div className="space-y-2.5">
                                <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/20">
                                  {entry.deepSleepMinutes > 0 && (
                                    <div className="h-full rounded-l-full" style={{ width: `${(entry.deepSleepMinutes / entryTotal) * 100}%`, backgroundColor: SLEEP_STAGE_COLORS.deep }} />
                                  )}
                                  {entry.lightSleepMinutes > 0 && (
                                    <div className="h-full" style={{ width: `${(entry.lightSleepMinutes / entryTotal) * 100}%`, backgroundColor: SLEEP_STAGE_COLORS.light }} />
                                  )}
                                  {entry.remSleepMinutes > 0 && (
                                    <div className="h-full" style={{ width: `${(entry.remSleepMinutes / entryTotal) * 100}%`, backgroundColor: SLEEP_STAGE_COLORS.rem }} />
                                  )}
                                  {entry.awakeMinutes > 0 && (
                                    <div className="h-full rounded-r-full" style={{ width: `${(entry.awakeMinutes / entryTotal) * 100}%`, backgroundColor: SLEEP_STAGE_COLORS.awake }} />
                                  )}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {[
                                    { label: "Deep", val: entry.deepSleepMinutes, color: SLEEP_STAGE_COLORS.deep },
                                    { label: "Light", val: entry.lightSleepMinutes, color: SLEEP_STAGE_COLORS.light },
                                    { label: "REM", val: entry.remSleepMinutes, color: SLEEP_STAGE_COLORS.rem },
                                    { label: "Awake", val: entry.awakeMinutes, color: SLEEP_STAGE_COLORS.awake },
                                  ].filter(s => s.val > 0).map(s => (
                                    <div key={s.label} className="text-center">
                                      <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: s.color }} />
                                      <p className="text-xs font-semibold text-foreground">{fmtDur(s.val)}</p>
                                      <p className="text-xs text-muted-foreground">{s.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {entry.notes && (
                              <p className="text-sm text-muted-foreground italic bg-muted/20 rounded-xl px-4 py-3">"{entry.notes}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </Card>
            );
          })() : sortedMonths.length === 0 ? (
            <p className="text-muted-foreground text-center py-4" data-testid="text-no-entries">No entries yet</p>
          ) : (
            <div className="space-y-6">
              {sortedMonths.map(month => (
                <div key={month}>
                  <h3 className="text-lg font-bold text-foreground mb-3" data-testid={`text-month-header-${month.replace(/\s+/g, '-').toLowerCase()}`}>
                    {format(parse(month, "MMMM yyyy", new Date()), "MMM").toUpperCase()}
                  </h3>
                  <div className="border-t border-border">
                    {allGroupedByMonth[month]
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((entry: any) => {
                        const rawValue = getValueFromEntry(entry, metricKey);
                        const displayValue = formatTooltipValue(rawValue, metricKey);
                        const measurementMetrics = ["neck", "chest", "shoulder", "leftBicep", "rightBicep", "leftForearm", "rightForearm", "waist", "hips", "leftThigh", "rightThigh", "leftCalf", "rightCalf"];
                        const isMeasurement = measurementMetrics.includes(metricKey);
                        const hasDetailPage = metricKey === "bodyWeight" || metricKey === "bodyFat" || isMeasurement;
                        return (
                          <div 
                            key={entry.id} 
                            className={`py-3 flex items-center justify-between border-b border-border transition-colors ${metricKey === "hydration" ? "" : "cursor-pointer hover:bg-muted/30"}`}
                            onClick={() => {
                              if (metricKey === "hydration") {
                                return;
                              }
                              if (hasDetailPage) {
                                if (isMeasurement) {
                                  const entryDate = format(parseISO(entry.date), "yyyy-MM-dd");
                                  navigate(`/my-progress/add?date=${entryDate}&from=/my-progress/${metricKey}`);
                                } else {
                                  navigate(`/my-progress/${metricKey}/entry/${entry.id}`);
                                }
                              } else {
                                handleEditClick(entry);
                              }
                            }}
                            data-testid={`entry-${metricKey}-${entry.id}`}
                          >
                            <p className="text-foreground" data-testid={`text-entry-date-${entry.id}`}>
                              {formatDate(parseISO(entry.date), "short")}
                            </p>
                            <p className="text-foreground text-right" data-testid={`text-entry-value-${entry.id}`}>
                              <span className="font-bold">{displayValue}</span>
                              <span className="text-xs text-muted-foreground ml-0.5">{getTooltipUnit(metricKey, config.unit)}</span>
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="bg-card border-border max-w-[320px] p-4">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base">Edit Entry</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {formatDate(parseISO(editingEntry.date), "short")}
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium">{config?.label} ({config?.unit})</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-9"
                  data-testid="input-edit-value"
                />
              </div>
              <Button
                onClick={handleUpdateEntry}
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black h-9"
                disabled={updateMutation.isPending}
                data-testid="button-save-entry"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  deleteMutation.mutate(editingEntry.id);
                  setEditingEntry(null);
                }}
                className="w-full text-destructive hover:text-destructive h-8 text-sm"
                data-testid="button-delete-entry"
              >
                Delete
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
