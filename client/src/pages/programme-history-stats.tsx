import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TopHeader from "@/components/TopHeader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Dumbbell, Clock, TrendingUp, Calendar, 
  Trophy, Flame, BarChart3, Sparkles, Search,
  CheckCircle2, ArrowUpRight, Zap, Target,
  ChevronDown, ChevronUp, SlidersHorizontal,
  MoreVertical, Trash2
} from "lucide-react";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from "date-fns";

const goalLabels: Record<string, string> = {
  power: "Power",
  max_strength: "Max Strength",
  conditioning: "Conditioning",
  hiit: "HIIT",
  muscular_endurance: "Muscular Endurance",
  active_recovery: "Active Recovery",
  mobility_stretching: "Mobility/Stretching",
  recovery: "Recovery",
  hypertrophy: "Hypertrophy",
  general_strength: "General Strength",
  corrective_exercises: "Corrective Exercises",
  mobility: "Mobility",
  yoga: "Yoga",
  fat_loss: "Fat Loss",
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function formatVolume(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

type PRMetric = 'rm1' | 'rm5' | 'rm10' | 'max_reps' | 'max_weight';
type ExerciseSortBy = 'max_weight' | 'total_volume' | 'total_reps' | 'sessions' | 'most_improved';

const prMetricLabels: Record<PRMetric, string> = {
  rm1: '1RM',
  rm5: '5RM',
  rm10: '10RM',
  max_reps: 'Max Reps',
  max_weight: 'Max Weight',
};

const exerciseSortLabels: Record<ExerciseSortBy, string> = {
  max_weight: 'Heaviest',
  total_volume: 'Most Volume',
  total_reps: 'Most Reps',
  sessions: 'Most Sessions',
  most_improved: 'Most Improved',
};

function ProgressionChart({ data, dataKey, chartId }: { data: { week: number; [key: string]: number }[]; dataKey: string; chartId: string }) {
  if (data.length < 2) return null;
  const values = data.map(d => d[dataKey]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const height = 48;
  const width = 240;
  const padding = 8;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const step = usableWidth / (values.length - 1);

  const improved = values[values.length - 1] > values[0];
  const color = improved ? "#22c55e" : values[values.length - 1] === values[0] ? "#0cc9a9" : "#ef4444";

  const points = values.map((v, i) => {
    const x = padding + i * step;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${chartId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="var(--background)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function WorkoutCalendar({ 
  workoutDates, 
  onDayClick
}: { 
  workoutDates: { date: string; workoutName: string; workoutLogId: number }[];
  onDayClick: (logId: number) => void;
}) {
  const dateMap = new Map<string, { workoutName: string; workoutLogId: number }>();
  for (const w of workoutDates) {
    dateMap.set(w.date, { workoutName: w.workoutName, workoutLogId: w.workoutLogId });
  }

  const allDates = workoutDates.map(w => parseISO(w.date));
  if (allDates.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No workout data</p>;

  const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
  const firstDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  const months: Date[] = [];
  let current = startOfMonth(firstDate);
  while (current <= endOfMonth(endDate)) {
    months.push(current);
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return (
    <div className="space-y-4">
      {months.map(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const firstDayOfWeek = getDay(monthStart);
        const blanks = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return (
          <div key={monthStart.toISOString()}>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {format(monthStart, 'MMMM yyyy')}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-xs text-muted-foreground text-center py-1">{d}</div>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const workout = dateMap.get(dateStr);
                const isCompleted = !!workout;

                return (
                  <div
                    key={dateStr}
                    onClick={() => workout && onDayClick(workout.workoutLogId)}
                    className={`aspect-square flex flex-col items-center justify-center rounded text-xs relative ${
                      isCompleted 
                        ? 'bg-green-500/15 text-green-500 font-semibold cursor-pointer hover:bg-green-500/25 transition-colors' 
                        : 'text-muted-foreground'
                    }`}
                    title={workout?.workoutName || ''}
                  >
                    {format(day, 'd')}
                    {isCompleted && (
                      <CheckCircle2 className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProgrammeHistoryStats() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [expandedPR, setExpandedPR] = useState<string | null>(null);
  const [prMetric, setPrMetric] = useState<PRMetric>('max_weight');
  const [exerciseSort, setExerciseSort] = useState<ExerciseSortBy>('max_weight');
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/my-programs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-programs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/programme-history'] });
      toast({ title: "Programme deleted" });
      navigate('/movement');
    },
    onError: () => {
      toast({ title: "Failed to delete programme", variant: "destructive" });
    },
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/my-programs', id, 'stats'],
    queryFn: async () => {
      const res = await fetch(`/api/my-programs/${id}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const { data: aiData, isLoading: aiLoading } = useQuery<any>({
    queryKey: ['/api/my-programs', id, 'ai-summary'],
    queryFn: async () => {
      const res = await fetch(`/api/my-programs/${id}/ai-summary`);
      if (!res.ok) throw new Error('Failed to fetch AI summary');
      return res.json();
    },
    enabled: isAuthenticated && !!id && !!data,
    staleTime: 1000 * 60 * 30,
  });

  const sortedExercises = useMemo(() => {
    if (!data?.allExerciseStats || !data?.exerciseProgression) return [];
    let list = [...data.allExerciseStats];
    const search = exerciseSearch.toLowerCase().trim();
    if (search) {
      list = list.filter((e: any) => e.exerciseName.toLowerCase().includes(search));
    }

    if (exerciseSort === 'most_improved') {
      list = list.map((ex: any) => {
        const prog = data.exerciseProgression.find((ep: any) => ep.exerciseName === ex.exerciseName);
        if (prog && prog.weekly.length >= 2) {
          const first = prog.weekly[0].bestWeight;
          const last = prog.weekly[prog.weekly.length - 1].bestWeight;
          return { ...ex, improvement: first > 0 ? last - first : 0 };
        }
        return { ...ex, improvement: 0 };
      });
      list.sort((a: any, b: any) => b.improvement - a.improvement);
    } else {
      const sortKey: Record<ExerciseSortBy, string> = {
        max_weight: 'maxWeight',
        total_volume: 'totalVolume',
        total_reps: 'totalReps',
        sessions: 'sessionsCount',
        most_improved: 'maxWeight',
      };
      list.sort((a: any, b: any) => (b[sortKey[exerciseSort]] || 0) - (a[sortKey[exerciseSort]] || 0));
    }
    return list;
  }, [data?.allExerciseStats, data?.exerciseProgression, exerciseSearch, exerciseSort]);

  const sortedPRs = useMemo(() => {
    if (!data?.allExerciseStats) return [];
    const sortKey: Record<PRMetric, string> = {
      rm1: 'rm1',
      rm5: 'rm5',
      rm10: 'rm10',
      max_reps: 'maxReps',
      max_weight: 'maxWeight',
    };
    const key = sortKey[prMetric];
    let list = [...data.allExerciseStats].filter((e: any) => {
      const val = e[key];
      return val !== null && val !== undefined && val > 0;
    });
    list.sort((a: any, b: any) => (b[key] || 0) - (a[key] || 0));
    return list.slice(0, 5);
  }, [data?.allExerciseStats, prMetric]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Programme not found</p>
          <Button onClick={() => navigate('/training')} variant="outline">Back to Training</Button>
        </div>
      </div>
    );
  }

  const { enrollment, summary, exerciseProgression, highlights, workoutCalendar, weeklyConsistency } = data;
  const weekEntries = Object.entries(weeklyConsistency || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxWeekWorkouts = weekEntries.length > 0 ? Math.max(...weekEntries.map(([, v]) => v as number)) : 1;

  const getProgressionForExercise = (name: string) => {
    return exerciseProgression?.find((ep: any) => ep.exerciseName === name);
  };

  const getPRDisplayValue = (ex: any): { primary: string; secondary?: string } => {
    if (prMetric === 'rm1') {
      return { primary: ex.rm1 !== null ? `${ex.rm1} kg` : '-' };
    }
    if (prMetric === 'rm5') {
      return { primary: ex.rm5 !== null ? `${ex.rm5} kg` : '-' };
    }
    if (prMetric === 'rm10') {
      return { primary: ex.rm10 !== null ? `${ex.rm10} kg` : '-' };
    }
    if (prMetric === 'max_reps') {
      return { primary: `${ex.maxReps}`, secondary: 'reps' };
    }
    return { primary: `${ex.maxWeight} kg` };
  };

  const coachSummary = aiData?.summary || "Great work on completing this programme. Keep pushing towards your goals.";

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader 
        title={enrollment.programTitle}
        onBack={() => window.history.back()} 
        rightMenuButton={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="text-red-500 focus:text-red-500"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Programme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Programme</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this programme and all associated workout logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-6 pt-2 max-w-lg mx-auto">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {goalLabels[enrollment.programGoal] || enrollment.programGoal}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">
            {enrollment.programDifficulty}
          </Badge>
          {enrollment.status === 'completed' && (
            <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
              Completed
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {enrollment.startDate ? format(new Date(enrollment.startDate), 'dd MMM yyyy') : ''} 
            {enrollment.endDate ? ` — ${format(new Date(enrollment.endDate), 'dd MMM yyyy')}` : ''}
            {enrollment.programWeeks ? ` · ${enrollment.programWeeks} weeks` : ''}
          </span>
        </div>

        {/* AI Coach Summary - Collapsible */}
        <Card className="mb-4 border-[#0cc9a9]/30 bg-gradient-to-br from-[#0cc9a9]/5 to-transparent">
          <CardContent className="p-4">
            <div 
              className="flex items-start gap-3 cursor-pointer"
              onClick={() => !aiLoading && setCoachExpanded(!coachExpanded)}
            >
              <div className="w-9 h-9 rounded-full bg-[#0cc9a9]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-[#0cc9a9]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-[#0cc9a9] uppercase tracking-wide">Coach Summary</p>
                  {!aiLoading && (
                    coachExpanded 
                      ? <ChevronUp className="h-4 w-4 text-[#0cc9a9]" /> 
                      : <ChevronDown className="h-4 w-4 text-[#0cc9a9]" />
                  )}
                </div>
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded animate-pulse w-full" />
                    <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-muted rounded animate-pulse w-3/5" />
                  </div>
                ) : (
                  <p className={`text-sm text-foreground leading-relaxed transition-all ${!coachExpanded ? 'line-clamp-3' : ''}`}>
                    {coachSummary}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Progress */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Programme Completion</span>
              <span className={`text-2xl font-bold ${summary.completionRate === 100 ? 'text-green-500' : summary.completionRate >= 50 ? 'text-[#0cc9a9]' : 'text-[#0cc9a9]'}`}>
                {summary.completionRate}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full transition-all ${summary.completionRate === 100 ? 'bg-[#0cc9a9]' : 'bg-[#0cc9a9]'}`}
                style={{ width: `${Math.min(summary.completionRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary.workoutsCompleted} of {summary.totalWorkouts} workouts completed
            </p>
          </CardContent>
        </Card>

        {/* Highlight Awards with Fun Facts */}
        {highlights && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {highlights.mostImproved && (
              <Card className="border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Most Improved</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{highlights.mostImproved.exerciseName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{highlights.mostImproved.startWeight}kg → {highlights.mostImproved.endWeight}kg</p>
                </CardContent>
              </Card>
            )}
            {highlights.mostVolumeExercise && (
              <Card className="border-[#0cc9a9]/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="h-4 w-4 text-[#0cc9a9]" />
                    <span className="text-xs font-semibold text-[#0cc9a9] uppercase tracking-wider">Most Volume</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{highlights.mostVolumeExercise.exerciseName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatVolume(highlights.mostVolumeExercise.totalVolume)}</p>
                </CardContent>
              </Card>
            )}
            {highlights.mostRepsExercise && (
              <Card className="border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-semibold text-purple-500 uppercase tracking-wider">Most Reps</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{highlights.mostRepsExercise.exerciseName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{highlights.mostRepsExercise.totalReps.toLocaleString()} reps</p>
                </CardContent>
              </Card>
            )}
            {highlights.biggestSession && (
              <Card className="border-orange-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Biggest Session</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{highlights.biggestSession.workoutName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatVolume(highlights.biggestSession.volume)} · Wk {highlights.biggestSession.week}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Dumbbell className="h-5 w-5 text-[#0cc9a9] mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{summary.workoutsCompleted}</p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 text-[#0cc9a9] mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{formatDuration(summary.totalDuration)}</p>
              <p className="text-xs text-muted-foreground">Total Time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 text-[#0cc9a9] mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{formatVolume(summary.totalVolume)}</p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-5 w-5 text-[#0cc9a9] mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{formatDuration(summary.avgSessionLength)}</p>
              <p className="text-xs text-muted-foreground">Avg Session</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{summary.totalSets}</p>
              <p className="text-xs text-muted-foreground">Sets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">{summary.totalReps.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Reps</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {summary.avgRating ? `${summary.avgRating}/10` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Avg Difficulty</p>
            </CardContent>
          </Card>
        </div>

        {/* Personal Records - Top 5 with Metric Toggle */}
        {sortedPRs.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#0cc9a9]" />
                Personal Records
              </h2>
            </div>
            <div className="flex gap-1.5 mb-3">
              {(Object.keys(prMetricLabels) as PRMetric[]).map(metric => (
                <button
                  key={metric}
                  onClick={() => { setPrMetric(metric); setExpandedPR(null); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    prMetric === metric
                      ? 'bg-[#0cc9a9] text-black'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {prMetricLabels[metric]}
                </button>
              ))}
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-0">
                  {sortedPRs.map((pr: any, i: number) => {
                    const progression = getProgressionForExercise(pr.exerciseName);
                    const isExpanded = expandedPR === pr.exerciseName;
                    const weeklyData = progression?.weekly || [];
                    const display = getPRDisplayValue(pr);
                    const firstW = weeklyData.length > 0 ? weeklyData[0] : null;
                    const lastW = weeklyData.length > 1 ? weeklyData[weeklyData.length - 1] : null;
                    const weightDiff = firstW && lastW ? lastW.bestWeight - firstW.bestWeight : 0;

                    return (
                      <div key={pr.exerciseName}>
                        <div 
                          className={`flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 rounded px-2 -mx-2 transition-colors ${i < sortedPRs.length - 1 && !isExpanded ? 'border-b border-border' : ''}`}
                          onClick={() => setExpandedPR(isExpanded ? null : pr.exerciseName)}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {i < 3 ? (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                i === 0 ? 'bg-[#0cc9a9]/20' : i === 1 ? 'bg-gray-400/20' : 'bg-[#0cc9a9]/20'
                              }`}>
                                <span className={`text-xs font-bold ${i === 0 ? 'text-[#0cc9a9]' : i === 1 ? 'text-gray-400' : 'text-[#0cc9a9]'}`}>
                                  {i + 1}
                                </span>
                              </div>
                            ) : (
                              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-muted-foreground">{i + 1}</span>
                              </div>
                            )}
                            <span className="text-sm font-medium text-foreground truncate">{pr.exerciseName}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <span className="text-sm font-bold text-[#0cc9a9]">{display.primary}</span>
                              {display.secondary && (
                                <span className="text-xs text-muted-foreground ml-1">{display.secondary}</span>
                              )}
                            </div>
                            {weeklyData.length >= 2 && (
                              isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {isExpanded && weeklyData.length >= 2 && (
                          <div className="py-3 px-3 bg-muted/20 rounded-lg mb-2 mx-0">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs text-muted-foreground">
                                Wk {firstW.week}: {firstW.bestWeight}kg
                              </span>
                              {weightDiff !== 0 && (
                                <span className={`text-xs font-semibold flex items-center gap-0.5 ${weightDiff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                  {weightDiff > 0 && <ArrowUpRight className="h-3 w-3" />}
                                  {weightDiff > 0 ? '+' : ''}{weightDiff}kg
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Wk {lastW!.week}: {lastW!.bestWeight}kg
                              </span>
                            </div>
                            <div className="w-full">
                              <ProgressionChart data={weeklyData} dataKey="bestWeight" chartId={`pr-${i}-${prMetric}`} />
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground px-1">
                              {weeklyData.map((w: any) => (
                                <span key={w.week}>W{w.week}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Exercise Browser with Sort */}
        {sortedExercises.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-[#0cc9a9]" />
                All Exercises
              </h2>
            </div>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="relative">
                <select
                  value={exerciseSort}
                  onChange={(e) => setExerciseSort(e.target.value as ExerciseSortBy)}
                  className="h-9 pl-3 pr-8 rounded-md border border-input bg-background text-xs appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0cc9a9]"
                >
                  {(Object.keys(exerciseSortLabels) as ExerciseSortBy[]).map(key => (
                    <option key={key} value={key}>{exerciseSortLabels[key]}</option>
                  ))}
                </select>
                <SlidersHorizontal className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              {(showAllExercises ? sortedExercises : sortedExercises.slice(0, 5)).map((ex: any, i: number) => {
                const prog = getProgressionForExercise(ex.exerciseName);
                const weeklyData = prog?.weekly || [];
                const improved = weeklyData.length >= 2 && weeklyData[weeklyData.length - 1].bestWeight > weeklyData[0].bestWeight;
                const improvementKg = weeklyData.length >= 2 ? weeklyData[weeklyData.length - 1].bestWeight - weeklyData[0].bestWeight : 0;

                return (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">{ex.exerciseName}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {improved && (
                            <span className="text-[10px] font-semibold text-green-500 flex items-center gap-0.5">
                              <ArrowUpRight className="h-2.5 w-2.5" />+{improvementKg}kg
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">{ex.sessionsCount}x</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/40 rounded-md px-2 py-1.5 text-center">
                          <p className="text-[10px] text-muted-foreground">Max</p>
                          <p className="text-sm font-semibold text-[#0cc9a9]">{ex.maxWeight > 0 ? `${ex.maxWeight}kg` : '-'}</p>
                        </div>
                        <div className="bg-muted/40 rounded-md px-2 py-1.5 text-center">
                          <p className="text-[10px] text-muted-foreground">Volume</p>
                          <p className="text-sm font-semibold text-foreground">{formatVolume(ex.totalVolume)}</p>
                        </div>
                        <div className="bg-muted/40 rounded-md px-2 py-1.5 text-center">
                          <p className="text-[10px] text-muted-foreground">Reps</p>
                          <p className="text-sm font-semibold text-foreground">{ex.totalReps.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {sortedExercises.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-[#0cc9a9]"
                onClick={() => setShowAllExercises(!showAllExercises)}
              >
                {showAllExercises ? 'Show Less' : `Show All ${sortedExercises.length} Exercises`}
              </Button>
            )}
            {sortedExercises.length === 0 && exerciseSearch && (
              <p className="text-sm text-muted-foreground text-center py-4">No exercises found</p>
            )}
          </div>
        )}

        {/* Weekly Consistency */}
        {weekEntries.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Weekly Consistency
            </h2>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {weekEntries.map(([week, count]) => (
                    <div key={week} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Week {week}</span>
                      <div className="flex-1 bg-muted rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-[#0cc9a9] transition-all"
                          style={{ width: `${((count as number) / maxWeekWorkouts) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-4 text-right">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Workout Calendar */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#0cc9a9]" />
            Workout Calendar
          </h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Completed</span>
                </div>
              </div>
              <WorkoutCalendar 
                workoutDates={workoutCalendar || []}
                onDayClick={(logId) => navigate(`/progress/workout/${logId}?source=programme-history&enrollmentId=${id}`)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
