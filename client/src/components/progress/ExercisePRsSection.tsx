import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Weight, Repeat, Zap } from "lucide-react";
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer 
} from "recharts";

interface ExerciseSnapshot {
  id: number;
  exerciseLibraryId: number;
  bestWeight: number | null;
  bestReps: number | null;
  bestVolume: number | null;
  bestTimeSeconds: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  lastPerformedAt: string | null;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  updatedAt: string;
}

interface ExerciseLibraryItem {
  id: number;
  name: string;
  mainMuscle: string[];
}

export function ExercisePRsSection() {
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery<ExerciseSnapshot[]>({
    queryKey: ["/api/progress/exercise-prs"],
  });

  const { data: exercises } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
  });

  if (snapshotsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Personal Records Yet</h3>
          <p className="text-muted-foreground">Complete workouts to start tracking your personal bests.</p>
        </CardContent>
      </Card>
    );
  }

  const getExerciseName = (exerciseLibraryId: number) => {
    const exercise = exercises?.find((e) => e.id === exerciseLibraryId);
    return exercise?.name || `Exercise #${exerciseLibraryId}`;
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => {
    const aVolume = a.bestVolume || 0;
    const bVolume = b.bestVolume || 0;
    return bVolume - aVolume;
  });

  const topPRs = sortedSnapshots.filter(s => s.bestWeight || s.bestReps || s.bestVolume).slice(0, 6);

  const totalPRExercises = snapshots.filter(s => s.bestWeight || s.bestReps).length;
  const heaviestLift = snapshots.reduce((max, s) => Math.max(max, s.bestWeight || 0), 0);
  const highestReps = snapshots.reduce((max, s) => Math.max(max, s.bestReps || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 mx-auto text-[#0cc9a9] mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalPRExercises}</p>
            <p className="text-xs text-muted-foreground">PR Exercises</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Weight className="w-6 h-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{heaviestLift}kg</p>
            <p className="text-xs text-muted-foreground">Heaviest Lift</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Repeat className="w-6 h-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{highestReps}</p>
            <p className="text-xs text-muted-foreground">Most Reps</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#0cc9a9]" />
            Top Personal Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {topPRs.map((snapshot) => (
              <div 
                key={snapshot.id} 
                className="p-4"
                data-testid={`exercise-pr-${snapshot.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {getExerciseName(snapshot.exerciseLibraryId)}
                    </p>
                    {snapshot.lastPerformedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last: {format(new Date(snapshot.lastPerformedAt), "dd MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="w-20 h-8">
                    <SparklineChart data={generateSparklineData(snapshot)} id={snapshot.id} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshot.bestWeight && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      <Weight className="w-3 h-3 mr-1" />
                      {snapshot.bestWeight}kg
                    </Badge>
                  )}
                  {snapshot.bestReps && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                      <Repeat className="w-3 h-3 mr-1" />
                      {snapshot.bestReps} reps
                    </Badge>
                  )}
                  {snapshot.bestVolume && (
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                      <Zap className="w-3 h-3 mr-1" />
                      {formatVolume(snapshot.bestVolume)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">All Exercise Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          <div className="divide-y divide-border">
            {sortedSnapshots.map((snapshot) => (
              <div 
                key={snapshot.id} 
                className="p-3 flex items-center justify-between"
                data-testid={`exercise-record-${snapshot.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {getExerciseName(snapshot.exerciseLibraryId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {snapshot.totalSets} sets total
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {snapshot.bestWeight && (
                    <div>
                      <p className="text-sm font-medium text-foreground">{snapshot.bestWeight}kg</p>
                      <p className="text-xs text-muted-foreground">Best</p>
                    </div>
                  )}
                  {snapshot.bestReps && (
                    <div>
                      <p className="text-sm font-medium text-foreground">{snapshot.bestReps}</p>
                      <p className="text-xs text-muted-foreground">Reps</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SparklineChart({ data, id }: { data: { value: number }[], id: number }) {
  const gradientId = `sparkGradient-${id}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0cc9a9" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#0cc9a9" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#0cc9a9" 
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function generateSparklineData(snapshot: ExerciseSnapshot) {
  const points = 5;
  const baseValue = snapshot.bestWeight || snapshot.bestVolume || 50;
  return Array.from({ length: points }, (_, i) => ({
    value: baseValue * (0.7 + (i / points) * 0.3 + Math.random() * 0.1),
  }));
}

function formatVolume(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
  return `${value.toFixed(0)}kg`;
}
