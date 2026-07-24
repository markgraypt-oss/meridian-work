import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Dumbbell, Flame, TrendingUp, ChevronRight, Star } from "lucide-react";
import { useLocation } from "wouter";

interface WorkoutLog {
  id: number;
  workoutName: string;
  completedAt: string;
  duration: number;
  workoutRating: number | null;
  autoCalculatedVolume: number | null;
  autoCalculatedTime: number | null;
}

export function WorkoutHistorySection() {
  const [, navigate] = useLocation();
  const { data: workouts, isLoading } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/progress/workouts"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!workouts || workouts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Workout History</h3>
          <p className="text-muted-foreground">Complete your first workout to see your progress here.</p>
        </CardContent>
      </Card>
    );
  }

  const formatVolume = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}t`;
    return `${value.toFixed(0)}kg`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
  };

  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((sum, w) => sum + (w.autoCalculatedVolume || 0), 0);
  const totalTime = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
  const avgRating = workouts.filter(w => w.workoutRating).length > 0 
    ? workouts.filter(w => w.workoutRating).reduce((sum, w) => sum + (w.workoutRating || 0), 0) / workouts.filter(w => w.workoutRating).length
    : 0;

  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Dumbbell className="w-6 h-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">Total Workouts</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{formatDuration(totalTime)}</p>
            <p className="text-xs text-muted-foreground">Total Time</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{formatVolume(totalVolume)}</p>
            <p className="text-xs text-muted-foreground">Total Volume</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Workouts List */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Workouts</h3>
        <div className="space-y-2">
          {sortedWorkouts.map((workout) => (
            <div 
              key={workout.id} 
              className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/progress/workout/${workout.id}`)}
              data-testid={`workout-history-item-${workout.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{workout.workoutName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(workout.completedAt), "dd MMM yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {workout.duration ? formatDuration(workout.duration) : '-'}
                  </p>
                  {workout.workoutRating && (
                    <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                      <Star className="w-3 h-3 text-[#0cc9a9] fill-[#0cc9a9]" />
                      <span>{workout.workoutRating}/10</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
