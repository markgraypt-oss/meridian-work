import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Heart, Apple, Activity } from "lucide-react";

type StreakTrack = "checkin" | "movement" | "recovery" | "nutrition";

interface TrackStreak {
  track: StreakTrack;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

interface EngagementResp {
  totalPoints: number;
  weekPoints: number;
  level: number;
  levelName: string;
  nextLevel: { level: number; name: string; minPoints: number } | null;
  progressToNext: number;
  streaks: Record<StreakTrack, TrackStreak | null>;
  recentActivity: Array<{
    id: number;
    activityType: string;
    awardedPoints: number;
    cappedReason: string | null;
    createdAt: string;
  }>;
}

const TRACK_META: Record<StreakTrack, { label: string; Icon: any; color: string }> = {
  checkin: { label: "Check-in", Icon: Flame, color: "#f97316" },
  movement: { label: "Movement", Icon: Activity, color: "#0cc9a9" },
  recovery: { label: "Recovery", Icon: Heart, color: "#a78bfa" },
  nutrition: { label: "Nutrition", Icon: Apple, color: "#22c55e" },
};

const ACTIVITY_LABEL: Record<string, string> = {
  daily_checkin: "Daily check-in",
  weekly_checkin: "Weekly check-in",
  workout: "Workout",
  meal_log: "Meal logged",
  body_map: "Body map",
  meditation: "Meditation",
  breathwork: "Breathwork",
  sleep_log: "Sleep logged",
  hydration_goal: "Hydration goal",
  perfect_week: "Perfect week",
};

function StreakRing({ track, streak }: { track: StreakTrack; streak: TrackStreak | null }) {
  const meta = TRACK_META[track];
  const days = streak?.currentStreak ?? 0;
  const Icon = meta.Icon;
  return (
    <div className="flex flex-col items-center" data-testid={`streak-${track}`}>
      <div
        className="relative h-14 w-14 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${meta.color}20`, border: `2px solid ${meta.color}` }}
      >
        <Icon className="h-5 w-5" style={{ color: meta.color }} />
      </div>
      <p className="text-sm font-semibold text-foreground mt-1">{days}d</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
    </div>
  );
}

export default function EngagementCard() {
  const { data, isLoading } = useQuery<EngagementResp>({
    queryKey: ["/api/user/engagement"],
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6">
          <div className="h-24 animate-pulse bg-muted/50 rounded" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const pct = Math.round((data.progressToNext || 0) * 100);

  return (
    <Card className="bg-card border-border" data-testid="card-engagement">
      <CardContent className="py-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Level {data.level}</p>
            <p className="text-lg font-semibold text-foreground" data-testid="text-level-name">
              {data.levelName}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Trophy className="h-4 w-4 text-[#0cc9a9]" />
              <p className="text-xl font-bold text-foreground" data-testid="text-week-points">
                {data.weekPoints.toLocaleString()}
              </p>
            </div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pts this week</p>
          </div>
        </div>

        <div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0cc9a9] transition-all"
              style={{ width: `${pct}%` }}
              data-testid="progress-next-level"
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>{data.totalPoints.toLocaleString()} total</span>
            <span>
              {data.nextLevel
                ? `${(data.nextLevel.minPoints - data.totalPoints).toLocaleString()} to ${data.nextLevel.name}`
                : "Max level"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(TRACK_META) as StreakTrack[]).map((track) => (
            <StreakRing key={track} track={track} streak={data.streaks[track]} />
          ))}
        </div>

        {data.recentActivity.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Recent</p>
            <ul className="space-y-1">
              {data.recentActivity.slice(0, 4).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">
                    {ACTIVITY_LABEL[tx.activityType] || tx.activityType}
                  </span>
                  <span className={tx.awardedPoints > 0 ? "text-[#0cc9a9] font-medium" : "text-muted-foreground"}>
                    {tx.awardedPoints > 0 ? `+${tx.awardedPoints}` : "0"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
