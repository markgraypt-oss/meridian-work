// Streaks card. Points and levels were retired on 25 Aug 2026 — the rewards
// programme is target-and-draw based and needs no currency, and streaks are
// the part people actually respond to.
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Heart, Apple, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type StreakTrack = "checkin" | "movement" | "recovery" | "nutrition";

interface TrackStreak {
  track: StreakTrack;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

interface EngagementResp {
  weekStart: string;
  activitiesThisWeek: number;
  streaks: Record<StreakTrack, TrackStreak | null>;
  recentActivity: Array<{
    id: number;
    activityType: string;
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
  readiness_weekly_baseline: "Above baseline week",
};

function StreakRing({ track, streak }: { track: StreakTrack; streak: TrackStreak | null }) {
  const meta = TRACK_META[track];
  const days = streak?.currentStreak ?? 0;
  const best = streak?.longestStreak ?? 0;
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
      {best > days && best > 0 && (
        <p className="text-[10px] text-muted-foreground/70">best {best}d</p>
      )}
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

  const streakValues = (Object.keys(TRACK_META) as StreakTrack[])
    .map((t) => data.streaks[t]?.currentStreak ?? 0);
  const bestActive = Math.max(0, ...streakValues);

  return (
    <Card className="bg-card border-border" data-testid="card-engagement">
      <CardContent className="py-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your streaks</p>
            <p className="text-lg font-semibold text-foreground" data-testid="text-streak-headline">
              {bestActive > 0 ? `${bestActive} day${bestActive === 1 ? "" : "s"} going` : "Start one today"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground" data-testid="text-week-activities">
              {data.activitiesThisWeek}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">this week</p>
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
              {data.recentActivity.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">
                    {ACTIVITY_LABEL[a.activityType] || a.activityType}
                  </span>
                  <span className="text-muted-foreground">
                    {a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : ""}
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
