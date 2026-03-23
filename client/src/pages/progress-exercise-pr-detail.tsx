import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Weight, Repeat, Zap, Trophy, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { format, subMonths, subYears, startOfWeek, endOfWeek, addWeeks, isAfter, isSameDay, isBefore } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type PRMetric = "maxWeight" | "maxReps" | "volume" | "oneRepMax" | "fiveRepMax" | "tenRepMax";
type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y";

const PR_METRIC_LABELS: Record<PRMetric, string> = {
  maxWeight: "Max weight",
  maxReps: "Max reps",
  volume: "Volume",
  oneRepMax: "1 rep max",
  fiveRepMax: "5 rep max",
  tenRepMax: "10 rep max",
};

const EMPTY_STATE_MESSAGES: Record<PRMetric, string> = {
  maxWeight: "Log a weighted set to unlock your max weight.",
  maxReps: "Log a set to unlock your max reps.",
  volume: "Complete a workout with this exercise to unlock volume tracking.",
  oneRepMax: "Log a set of 1 rep to unlock your 1 rep max.",
  fiveRepMax: "Log a set of 5 reps to unlock your 5 rep max.",
  tenRepMax: "Log a set of 10 reps to unlock your 10 rep max.",
};

const timeRanges: TimeRange[] = ["1W", "1M", "3M", "6M", "1Y"];

function getDateCutoff(range: TimeRange, weekOffset?: Date): Date {
  const now = new Date();
  switch (range) {
    case "1W": return weekOffset || startOfWeek(now, { weekStartsOn: 1 });
    case "1M": return subMonths(now, 1);
    case "3M": return subMonths(now, 3);
    case "6M": return subMonths(now, 6);
    case "1Y": return subYears(now, 1);
  }
}

function generateTicks(start: number, end: number, range: TimeRange): number[] {
  const ticks: number[] = [];
  const startDate = new Date(start);
  
  if (range === "1W") {
    const dayMs = 24 * 60 * 60 * 1000;
    let current = startDate.getTime();
    while (current <= end) {
      ticks.push(current);
      current += dayMs;
    }
    return ticks;
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
}

interface ExercisePRDetail {
  id: number;
  name: string;
  exerciseType: string;
  maxWeight: number | null;
  maxReps: number | null;
  volume: number | null;
  oneRepMax: number | null;
  fiveRepMax: number | null;
  tenRepMax: number | null;
  history: {
    date: string;
    maxWeight: number | null;
    maxReps: number | null;
    volume: number | null;
    oneRepMax: number | null;
    fiveRepMax: number | null;
    tenRepMax: number | null;
  }[];
}

export default function ProgressExercisePRDetail() {
  const [, params] = useRoute("/progress/exercise-pr/:id");
  const [, navigate] = useLocation();
  const { formatDate } = useFormattedDate();
  
  const [selectedMetric, setSelectedMetric] = useState<PRMetric>("maxWeight");
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const exerciseId = params?.id;

  const { data: exercise, isLoading } = useQuery<ExercisePRDetail>({
    queryKey: [`/api/progress/exercise-pr/${exerciseId}`],
    enabled: !!exerciseId,
  });

  const chartData = useMemo(() => {
    if (!exercise?.history) return [];
    
    const cutoff = getDateCutoff(timeRange, timeRange === "1W" ? selectedWeekStart : undefined);
    const upperBound = timeRange === "1W" ? endOfWeek(selectedWeekStart, { weekStartsOn: 1 }) : null;
    
    return exercise.history
      .filter(h => {
        if (h[selectedMetric] === null) return false;
        const d = new Date(h.date);
        if (d < cutoff) return false;
        if (upperBound && d > upperBound) return false;
        return true;
      })
      .map(h => ({
        timestamp: new Date(h.date).getTime(),
        date: format(new Date(h.date), "dd MMM"),
        value: h[selectedMetric] as number,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [exercise?.history, selectedMetric, timeRange, selectedWeekStart]);

  const chartDomain = useMemo((): [number, number] => {
    const cutoff = getDateCutoff(timeRange, timeRange === "1W" ? selectedWeekStart : undefined);
    const end = timeRange === "1W" ? endOfWeek(selectedWeekStart, { weekStartsOn: 1 }).getTime() : Date.now();
    return [cutoff.getTime(), end];
  }, [timeRange, selectedWeekStart]);

  const chartTicks = useMemo(() => {
    return generateTicks(chartDomain[0], chartDomain[1], timeRange);
  }, [chartDomain, timeRange]);

  const formatTickLabel = (timestamp: number): string => {
    if (timeRange === "1W") {
      return format(new Date(timestamp), "EEE");
    }
    if (timeRange === "1M" || timeRange === "3M") {
      return format(new Date(timestamp), "d MMM");
    }
    return format(new Date(timestamp), "MMM yy");
  };

  const formatValue = (value: number | null, metric: PRMetric): string => {
    if (value === null || value === undefined) return "-";
    
    switch (metric) {
      case "maxWeight":
      case "oneRepMax":
      case "fiveRepMax":
      case "tenRepMax":
        return `${value}kg`;
      case "maxReps":
        return `${value}`;
      case "volume":
        if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
        return `${value}kg`;
      default:
        return String(value);
    }
  };

  const getUnit = (metric: PRMetric): string => {
    switch (metric) {
      case "maxWeight":
      case "oneRepMax":
      case "fiveRepMax":
      case "tenRepMax":
      case "volume":
        return "kg";
      case "maxReps":
        return "";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/progress/exercise-prs")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Skeleton className="h-6 w-40" />
            </div>
          </div>
        </div>
        <div className="px-4 py-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/progress/exercise-prs")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Exercise Not Found</h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">This exercise could not be found.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = [
    { key: "maxWeight" as PRMetric, label: "Max weight", icon: Scale, value: exercise.maxWeight, iconColor: "text-[#0cc9a9]" },
    { key: "maxReps" as PRMetric, label: "Max reps", icon: Repeat, value: exercise.maxReps, iconColor: "text-cyan-500" },
    { key: "volume" as PRMetric, label: "Volume", icon: Zap, value: exercise.volume, iconColor: "text-green-500" },
    { key: "oneRepMax" as PRMetric, label: "1RM", icon: Trophy, value: exercise.oneRepMax, iconColor: "text-purple-500" },
    { key: "fiveRepMax" as PRMetric, label: "5RM", icon: TrendingUp, value: exercise.fiveRepMax, iconColor: "text-orange-500" },
    { key: "tenRepMax" as PRMetric, label: "10RM", icon: TrendingDown, value: exercise.tenRepMax, iconColor: "text-pink-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/progress/exercise-prs")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground truncate">{exercise.name}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 pb-24">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const isSelected = selectedMetric === stat.key;
            return (
              <Card 
                key={stat.key} 
                className={`bg-card border-border cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[#0cc9a9]' : ''}`}
                onClick={() => setSelectedMetric(stat.key)}
              >
                <CardContent className="p-3 text-center">
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${stat.iconColor}`} />
                  <p className="text-lg font-bold text-foreground">
                    {formatValue(stat.value, stat.key)}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as PRMetric)}>
          <SelectTrigger data-testid="select-graph-metric">
            <SelectValue>{PR_METRIC_LABELS[selectedMetric]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PR_METRIC_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={timeRange} onValueChange={(v) => { setTimeRange(v as TimeRange); if (v === "1W") { setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); } }}>
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

        {timeRange === "1W" && (
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
            <button onClick={() => setSelectedWeekStart(prev => addWeeks(prev, -1))} className="p-1.5 rounded-lg hover:bg-muted/50 active:scale-95 transition-all">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {format(selectedWeekStart, "MMM d")} — {format(endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), "MMM d, yyyy")}
              </p>
              {isSameDay(selectedWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 })) && (
                <p className="text-xs text-[#0cc9a9] font-medium">This Week</p>
              )}
            </div>
            <button onClick={() => { const nextWeek = addWeeks(selectedWeekStart, 1); if (!isAfter(nextWeek, startOfWeek(new Date(), { weekStartsOn: 1 }))) { setSelectedWeekStart(nextWeek); } }} className={`p-1.5 rounded-lg transition-all ${isAfter(addWeeks(selectedWeekStart, 1), startOfWeek(new Date(), { weekStartsOn: 1 })) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted/50 active:scale-95'}`}>
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}

        <Card className="p-2">
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {EMPTY_STATE_MESSAGES[selectedMetric]}
                </p>
              </div>
            </div>
          ) : (
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
                  height={30}
                />
                <YAxis 
                  axisLine={{ stroke: '#333', strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10 }}
                  width={40}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  orientation="left"
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
                            {data.value}<span style={{ fontSize: '12px', fontWeight: 'normal' }}>{getUnit(selectedMetric)}</span>
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
          )}
        </Card>
      </div>
    </div>
  );
}
