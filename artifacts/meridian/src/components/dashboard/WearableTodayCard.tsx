import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Moon, Footprints, Heart, Activity, Watch, Dumbbell } from "lucide-react";

interface TodayMetrics {
  date: string | null;
  source: string | null;
  provider: string | null;
  metrics: {
    sleepMinutes?: number | null;
    sleepScore?: number | null;
    hrvMs?: number | null;
    restingHrBpm?: number | null;
    steps?: number | null;
    activeMinutes?: number | null;
    readinessScore?: number | null;
    workoutCount?: number | null;
    strainScore?: number | null;
  } | null;
}

export default function WearableTodayCard() {
  const { data, isLoading } = useQuery<TodayMetrics>({
    queryKey: ["/api/wearables/today"],
    refetchOnWindowFocus: false,
  });

  // Hide the card entirely when no wearable is connected/synced — avoids
  // adding noise for users who don't use wearables.
  if (isLoading || !data?.metrics || !data.source) return null;

  const m = data.metrics;
  const sleepHours = m.sleepMinutes != null ? (m.sleepMinutes / 60).toFixed(1) : null;

  const stats: Array<{ icon: any; label: string; value: string }> = [];
  if (sleepHours) stats.push({ icon: Moon, label: "Sleep", value: `${sleepHours}h${m.sleepScore ? ` · ${m.sleepScore}` : ""}` });
  if (m.steps != null) stats.push({ icon: Footprints, label: "Steps", value: m.steps.toLocaleString() });
  if (m.restingHrBpm != null) stats.push({ icon: Heart, label: "RHR", value: `${m.restingHrBpm} bpm` });
  if (m.hrvMs != null) stats.push({ icon: Activity, label: "HRV", value: `${Math.round(m.hrvMs)} ms` });
  if (m.readinessScore != null) stats.push({ icon: Activity, label: "Readiness", value: `${m.readinessScore}/100` });
  if (m.workoutCount != null && m.workoutCount > 0) {
    const extra = m.strainScore != null ? ` · strain ${(m.strainScore / 10).toFixed(1)}` : (m.activeMinutes ? ` · ${m.activeMinutes} min` : "");
    stats.push({ icon: Dumbbell, label: "Workouts", value: `${m.workoutCount}${extra}` });
  } else if (m.activeMinutes != null && m.activeMinutes > 0 && m.steps == null) {
    stats.push({ icon: Dumbbell, label: "Active", value: `${m.activeMinutes} min` });
  }

  if (stats.length === 0) return null;

  return (
    <Card className="p-4" data-testid="card-wearable-today">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Watch className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Today's Wearable</h3>
        </div>
        <Badge variant="secondary" className="text-xs" data-testid="badge-wearable-source">
          from {data.source}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.slice(0, 6).map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2" data-testid={`wearable-stat-${s.label.toLowerCase()}`}>
              <Icon className="w-4 h-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-sm font-medium truncate">{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
