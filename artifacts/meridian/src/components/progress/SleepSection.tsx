import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Moon, Plus, TrendingUp, TrendingDown, Minus, Clock, Star, ChevronDown, ChevronUp, Trash2, Brain, Eye, Zap, Activity } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SleepEntry {
  id: number;
  date: string;
  durationMinutes: number;
  quality: number | null;
  bedTime: string | null;
  wakeTime: string | null;
  deepSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  remSleepMinutes: number | null;
  awakeMinutes: number | null;
  sleepScore: number | null;
  notes: string | null;
}

const STAGE_COLORS = {
  deep: "#6366f1",
  light: "#a5b4fc",
  rem: "#8b5cf6",
  awake: "#f97316",
};

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function getSleepScoreLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "text-green-500" };
  if (score >= 70) return { label: "Good", color: "text-blue-500" };
  if (score >= 50) return { label: "Fair", color: "text-[#0cc9a9]" };
  return { label: "Poor", color: "text-red-500" };
}

export function SleepSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [showStages, setShowStages] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hours, setHours] = useState("7");
  const [minutes, setMinutes] = useState("30");
  const [quality, setQuality] = useState([7]);
  const [bedTime, setBedTime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [notes, setNotes] = useState("");
  const [sleepScore, setSleepScore] = useState([75]);
  const [deepHours, setDeepHours] = useState("1");
  const [deepMins, setDeepMins] = useState("30");
  const [lightHours, setLightHours] = useState("3");
  const [lightMins, setLightMins] = useState("0");
  const [remHours, setRemHours] = useState("1");
  const [remMins, setRemMins] = useState("30");
  const [awakeHours, setAwakeHours] = useState("0");
  const [awakeMins, setAwakeMins] = useState("15");
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<SleepEntry[]>({
    queryKey: ["/api/progress/sleep"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/progress/sleep", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/sleep"] });
      setIsAddOpen(false);
      setShowStages(false);
      toast({ title: "Sleep entry added" });
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/progress/sleep/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/sleep"] });
      toast({ title: "Entry deleted" });
    },
  });

  const handleAdd = () => {
    const durationMinutes = parseInt(hours) * 60 + parseInt(minutes);
    const data: any = {
      date: newDate,
      durationMinutes,
      quality: quality[0],
      bedTime,
      wakeTime,
      notes: notes || undefined,
    };

    if (showStages) {
      data.sleepScore = sleepScore[0];
      data.deepSleepMinutes = parseInt(deepHours) * 60 + parseInt(deepMins);
      data.lightSleepMinutes = parseInt(lightHours) * 60 + parseInt(lightMins);
      data.remSleepMinutes = parseInt(remHours) * 60 + parseInt(remMins);
      data.awakeMinutes = parseInt(awakeHours) * 60 + parseInt(awakeMins);
    }

    addMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sortedEntries = entries 
    ? [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const reversedEntries = [...sortedEntries].reverse();
  const last7Days = sortedEntries.slice(-7);
  const last30Days = sortedEntries.slice(-30);

  const durationChartData = last7Days.map((e) => ({
    date: format(new Date(e.date), "EEE"),
    hours: e.durationMinutes / 60,
  }));

  const avgDuration = sortedEntries.length > 0 
    ? sortedEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / sortedEntries.length / 60 
    : 0;

  const highestDuration = sortedEntries.length > 0 
    ? Math.max(...sortedEntries.map(e => e.durationMinutes)) / 60 
    : 0;

  const lowestDuration = sortedEntries.length > 0 
    ? Math.min(...sortedEntries.map(e => e.durationMinutes)) / 60 
    : 0;

  const avgQuality = sortedEntries.filter(e => e.quality).length > 0
    ? sortedEntries.filter(e => e.quality).reduce((sum, e) => sum + (e.quality || 0), 0) / sortedEntries.filter(e => e.quality).length
    : 0;

  const entriesWithScore = sortedEntries.filter(e => e.sleepScore);
  const avgSleepScore = entriesWithScore.length > 0
    ? entriesWithScore.reduce((sum, e) => sum + (e.sleepScore || 0), 0) / entriesWithScore.length
    : 0;

  const entriesWithStages = sortedEntries.filter(e => e.deepSleepMinutes || e.lightSleepMinutes || e.remSleepMinutes);

  const avgStages = entriesWithStages.length > 0 ? {
    deep: entriesWithStages.reduce((s, e) => s + (e.deepSleepMinutes || 0), 0) / entriesWithStages.length,
    light: entriesWithStages.reduce((s, e) => s + (e.lightSleepMinutes || 0), 0) / entriesWithStages.length,
    rem: entriesWithStages.reduce((s, e) => s + (e.remSleepMinutes || 0), 0) / entriesWithStages.length,
    awake: entriesWithStages.reduce((s, e) => s + (e.awakeMinutes || 0), 0) / entriesWithStages.length,
  } : null;

  const getTrend = () => {
    if (last30Days.length < 4) return { direction: "neutral" as const, value: 0 };
    const half = Math.floor(last30Days.length / 2);
    const recentAvg = last30Days.slice(half).reduce((s, e) => s + e.durationMinutes, 0) / (last30Days.length - half);
    const olderAvg = last30Days.slice(0, half).reduce((s, e) => s + e.durationMinutes, 0) / half;
    const diff = (recentAvg - olderAvg) / 60;
    if (Math.abs(diff) < 0.1) return { direction: "neutral" as const, value: 0 };
    return { direction: diff > 0 ? "up" as const : "down" as const, value: Math.abs(diff) };
  };

  const trend = getTrend();

  const scoreChartData = last30Days
    .filter(e => e.sleepScore)
    .map(e => ({
      date: format(new Date(e.date), "dd MMM"),
      score: e.sleepScore,
    }));

  const stagesPieData = avgStages ? [
    { name: "Deep", value: Math.round(avgStages.deep), color: STAGE_COLORS.deep },
    { name: "Light", value: Math.round(avgStages.light), color: STAGE_COLORS.light },
    { name: "REM", value: Math.round(avgStages.rem), color: STAGE_COLORS.rem },
    { name: "Awake", value: Math.round(avgStages.awake), color: STAGE_COLORS.awake },
  ].filter(d => d.value > 0) : [];

  const visibleLogs = showAllLogs ? reversedEntries : reversedEntries.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Sleep Hub</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90" data-testid="button-add-sleep">
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Sleep Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-sleep-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input type="number" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} data-testid="input-sleep-hours" />
                </div>
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-testid="input-sleep-minutes" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quality (1-10): {quality[0]}</Label>
                <Slider value={quality} onValueChange={setQuality} min={1} max={10} step={1} data-testid="slider-sleep-quality" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bed Time</Label>
                  <Input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} data-testid="input-bed-time" />
                </div>
                <div className="space-y-2">
                  <Label>Wake Time</Label>
                  <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} data-testid="input-wake-time" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStages(!showStages)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-500" />
                  Sleep Stages & Score (from tracker)
                </span>
                {showStages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showStages && (
                <div className="space-y-4 pl-1 border-l-2 border-indigo-500/30 ml-2">
                  <div className="space-y-2 pl-3">
                    <Label>Sleep Score (1-100): {sleepScore[0]}</Label>
                    <Slider value={sleepScore} onValueChange={setSleepScore} min={1} max={100} step={1} />
                  </div>
                  <div className="pl-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">Deep Sleep</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0" max="12" value={deepHours} onChange={(e) => setDeepHours(e.target.value)} placeholder="hrs" />
                      <Input type="number" min="0" max="59" value={deepMins} onChange={(e) => setDeepMins(e.target.value)} placeholder="min" />
                    </div>
                  </div>
                  <div className="pl-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">Light Sleep</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0" max="12" value={lightHours} onChange={(e) => setLightHours(e.target.value)} placeholder="hrs" />
                      <Input type="number" min="0" max="59" value={lightMins} onChange={(e) => setLightMins(e.target.value)} placeholder="min" />
                    </div>
                  </div>
                  <div className="pl-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">REM Sleep</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0" max="12" value={remHours} onChange={(e) => setRemHours(e.target.value)} placeholder="hrs" />
                      <Input type="number" min="0" max="59" value={remMins} onChange={(e) => setRemMins(e.target.value)} placeholder="min" />
                    </div>
                  </div>
                  <div className="pl-3">
                    <Label className="text-xs text-muted-foreground mb-2 block">Awake Time</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0" max="12" value={awakeHours} onChange={(e) => setAwakeHours(e.target.value)} placeholder="hrs" />
                      <Input type="number" min="0" max="59" value={awakeMins} onChange={(e) => setAwakeMins(e.target.value)} placeholder="min" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did you feel?" data-testid="input-sleep-notes" />
              </div>
              <Button 
                onClick={handleAdd} 
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                disabled={addMutation.isPending}
                data-testid="button-save-sleep"
              >
                {addMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sortedEntries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Moon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Sleep Data</h3>
            <p className="text-muted-foreground">Track your sleep to see patterns and improve rest.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {avgSleepScore > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Sleep Score</p>
                    <p className="text-4xl font-bold text-foreground mt-1">{Math.round(avgSleepScore)}</p>
                    <p className={`text-sm font-medium ${getSleepScoreLabel(avgSleepScore).color}`}>
                      {getSleepScoreLabel(avgSleepScore).label}
                    </p>
                  </div>
                  <div className="w-20 h-20 relative">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={avgSleepScore >= 85 ? "#22c55e" : avgSleepScore >= 70 ? "#3b82f6" : avgSleepScore >= 50 ? "#0cc9a9" : "#ef4444"}
                        strokeWidth="3"
                        strokeDasharray={`${avgSleepScore} ${100 - avgSleepScore}`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <Clock className="w-5 h-5 mx-auto text-indigo-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{avgDuration.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">Average</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{highestDuration.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">Highest</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <TrendingDown className="w-5 h-5 mx-auto text-red-400 mb-1" />
                <p className="text-lg font-bold text-foreground">{lowestDuration.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">Lowest</p>
              </CardContent>
            </Card>
          </div>

          {trend.direction !== "neutral" && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${trend.direction === "up" ? "bg-green-500/10" : "bg-red-500/10"}`}>
              {trend.direction === "up" ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <p className="text-sm text-foreground">
                Sleep is trending <span className="font-medium">{trend.direction}</span> by {trend.value.toFixed(1)}h compared to earlier
              </p>
            </div>
          )}

          {stagesPieData.length > 0 && avgStages && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sleep Stages (avg)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stagesPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stagesPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_COLORS.deep }} />
                        <span className="text-xs text-muted-foreground">Deep</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{formatDuration(Math.round(avgStages.deep))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_COLORS.light }} />
                        <span className="text-xs text-muted-foreground">Light</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{formatDuration(Math.round(avgStages.light))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_COLORS.rem }} />
                        <span className="text-xs text-muted-foreground">REM</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{formatDuration(Math.round(avgStages.rem))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STAGE_COLORS.awake }} />
                        <span className="text-xs text-muted-foreground">Awake</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{formatDuration(Math.round(avgStages.awake))}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationChartData}>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 12]} tickFormatter={(v) => `${v}h`} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value.toFixed(1)}h`, 'Sleep']}
                    />
                    <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {sortedEntries.length >= 2 && (
                <div className="mt-4 py-2 px-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-foreground font-medium">
                    Averaging <span className="text-purple-400">{avgDuration.toFixed(1)}h</span> of sleep over your last {sortedEntries.length} entries
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {scoreChartData.length > 1 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sleep Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreChartData}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} width={35} tickCount={4} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`${value}/100`, 'Score']}
                      />
                      <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} fill="url(#scoreGradient)" dot={false} activeDot={{ r: 5, fill: '#22c55e', stroke: '#22c55e' }} />
                      <Area type="monotone" dataKey="score" stroke="none" fill="none" dot={(props: any) => {
                        const { cx, cy, index, payload } = props;
                        if (index !== scoreChartData.length - 1) return <g key={`score-last-${index}`} />;
                        return (
                          <g key={`score-last-${index}`}>
                            <circle cx={cx} cy={cy} r={8} fill="#22c55e" fillOpacity={0.2} stroke="none" />
                            <circle cx={cx} cy={cy} r={5} fill="#22c55e" stroke="hsl(var(--card))" strokeWidth={2} />
                            <text x={cx} y={cy - 14} textAnchor="middle" fill="#22c55e" fontSize={11} fontWeight={700}>{payload.date}</text>
                          </g>
                        );
                      }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {avgQuality > 0 && sortedEntries.filter(e => e.quality).length > 1 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quality Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const qualityChartData = last30Days.filter(e => e.quality).map(e => ({ date: format(new Date(e.date), "dd MMM"), quality: e.quality }));
                      return (
                        <AreaChart data={qualityChartData}>
                          <defs>
                            <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0cc9a9" stopOpacity={0.6} />
                              <stop offset="100%" stopColor="#0cc9a9" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[1, 10]} tickLine={false} axisLine={false} width={35} tickCount={4} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Area type="monotone" dataKey="quality" stroke="#0cc9a9" strokeWidth={2} fill="url(#qualityGradient)" dot={false} activeDot={{ r: 5, fill: '#0cc9a9', stroke: '#0cc9a9' }} />
                          <Area type="monotone" dataKey="quality" stroke="none" fill="none" dot={(props: any) => {
                            const { cx, cy, index, payload } = props;
                            if (index !== qualityChartData.length - 1) return <g key={`quality-last-${index}`} />;
                            return (
                              <g key={`quality-last-${index}`}>
                                <circle cx={cx} cy={cy} r={8} fill="#0cc9a9" fillOpacity={0.2} stroke="none" />
                                <circle cx={cx} cy={cy} r={5} fill="#0cc9a9" stroke="hsl(var(--card))" strokeWidth={2} />
                                <text x={cx} y={cy - 14} textAnchor="middle" fill="#0cc9a9" fontSize={11} fontWeight={700}>{payload.date}</text>
                              </g>
                            );
                          }} />
                        </AreaChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Sleep Log</CardTitle>
              <span className="text-xs text-muted-foreground">{sortedEntries.length} entries</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {visibleLogs.map((entry) => {
                  const isExpanded = expandedEntry === entry.id;
                  const hasStages = entry.deepSleepMinutes || entry.lightSleepMinutes || entry.remSleepMinutes;
                  return (
                    <div key={entry.id} data-testid={`sleep-entry-${entry.id}`}>
                      <button
                        onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center w-10">
                            <span className="text-xs font-medium text-muted-foreground">
                              {format(new Date(entry.date), "dd")}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {format(new Date(entry.date), "MMM")}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{formatDuration(entry.durationMinutes)}</p>
                            {entry.bedTime && entry.wakeTime && (
                              <p className="text-[10px] text-muted-foreground">{entry.bedTime} → {entry.wakeTime}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {entry.sleepScore && (
                            <div className="text-right">
                              <p className={`text-sm font-bold ${getSleepScoreLabel(entry.sleepScore).color}`}>{entry.sleepScore}</p>
                              <p className="text-[10px] text-muted-foreground">Score</p>
                            </div>
                          )}
                          {entry.quality && !entry.sleepScore && (
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">{entry.quality}/10</p>
                              <p className="text-[10px] text-muted-foreground">Quality</p>
                            </div>
                          )}
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 bg-muted/20">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {entry.quality && (
                              <div className="flex items-center gap-2">
                                <Star className="w-3.5 h-3.5 text-[#0cc9a9]" />
                                <span className="text-muted-foreground">Quality:</span>
                                <span className="font-medium text-foreground">{entry.quality}/10</span>
                              </div>
                            )}
                            {entry.sleepScore && (
                              <div className="flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-muted-foreground">Score:</span>
                                <span className="font-medium text-foreground">{entry.sleepScore}/100</span>
                              </div>
                            )}
                          </div>

                          {hasStages && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sleep Stages</p>
                              <div className="w-full h-4 rounded-full overflow-hidden flex">
                                {entry.deepSleepMinutes && entry.deepSleepMinutes > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(entry.deepSleepMinutes / entry.durationMinutes) * 100}%`,
                                      backgroundColor: STAGE_COLORS.deep,
                                    }}
                                    title={`Deep: ${formatDuration(entry.deepSleepMinutes)}`}
                                  />
                                )}
                                {entry.lightSleepMinutes && entry.lightSleepMinutes > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(entry.lightSleepMinutes / entry.durationMinutes) * 100}%`,
                                      backgroundColor: STAGE_COLORS.light,
                                    }}
                                    title={`Light: ${formatDuration(entry.lightSleepMinutes)}`}
                                  />
                                )}
                                {entry.remSleepMinutes && entry.remSleepMinutes > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(entry.remSleepMinutes / entry.durationMinutes) * 100}%`,
                                      backgroundColor: STAGE_COLORS.rem,
                                    }}
                                    title={`REM: ${formatDuration(entry.remSleepMinutes)}`}
                                  />
                                )}
                                {entry.awakeMinutes && entry.awakeMinutes > 0 && (
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(entry.awakeMinutes / entry.durationMinutes) * 100}%`,
                                      backgroundColor: STAGE_COLORS.awake,
                                    }}
                                    title={`Awake: ${formatDuration(entry.awakeMinutes)}`}
                                  />
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {entry.deepSleepMinutes && entry.deepSleepMinutes > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS.deep }} />
                                    <span className="text-muted-foreground">Deep</span>
                                    <span className="ml-auto font-medium text-foreground">{formatDuration(entry.deepSleepMinutes)}</span>
                                  </div>
                                )}
                                {entry.lightSleepMinutes && entry.lightSleepMinutes > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS.light }} />
                                    <span className="text-muted-foreground">Light</span>
                                    <span className="ml-auto font-medium text-foreground">{formatDuration(entry.lightSleepMinutes)}</span>
                                  </div>
                                )}
                                {entry.remSleepMinutes && entry.remSleepMinutes > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS.rem }} />
                                    <span className="text-muted-foreground">REM</span>
                                    <span className="ml-auto font-medium text-foreground">{formatDuration(entry.remSleepMinutes)}</span>
                                  </div>
                                )}
                                {entry.awakeMinutes && entry.awakeMinutes > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS.awake }} />
                                    <span className="text-muted-foreground">Awake</span>
                                    <span className="ml-auto font-medium text-foreground">{formatDuration(entry.awakeMinutes)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {entry.notes && (
                            <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(entry.id); }}
                            className="text-red-500 hover:text-red-600 text-xs h-7"
                            data-testid={`button-delete-sleep-${entry.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {reversedEntries.length > 5 && (
                <button
                  onClick={() => setShowAllLogs(!showAllLogs)}
                  className="w-full py-3 text-sm text-blue-600 font-medium hover:bg-muted/30 transition-colors flex items-center justify-center gap-1"
                >
                  {showAllLogs ? (
                    <>Show Less <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>Show All ({reversedEntries.length}) <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
