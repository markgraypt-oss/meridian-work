import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronRight, X } from "lucide-react";
import type { WeeklyCheckin } from "@shared/schema";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


interface V2Payload {
  _v: 4;
  weekStart: string;
  hero: string;
  trajectoryLabel: string;
  cards: {
    howYouFelt?: { checkInCount: number };
    howYouMoved?: { sessionsCompleted: number };
    patterns?: { isAI: boolean };
  };
}

interface V1Payload {
  weekStart: string;
  summary: { burnoutTrajectory: string };
  metrics: { burnout: { score: number | null; delta: number | null } };
  suggestions: { id: string }[];
}

function isV2(p: any): p is V2Payload {
  return p?._v === 4;
}


export default function WeeklyCheckinCard() {
  const [, navigate] = useLocation();
  const { preferences } = useUserPreferences();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<WeeklyCheckin[]>({
    queryKey: ["/api/weekly-checkins"],
  });

  const dismissMutation = useMutation({
    mutationFn: async (checkinId: number) => {
      return apiRequest("PATCH", "/api/user/preferences", {
        dismissedWeeklyCheckinId: checkinId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
      toast({ title: "Weekly check-in dismissed" });
    },
  });

  if (isLoading || !data || data.length === 0) return null;

  const now = new Date();
  const completedCheckins = data.filter((checkin) => {
    const weekStart = new Date(checkin.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    return weekEnd <= now;
  });

  if (completedCheckins.length === 0) return null;

  const latest = completedCheckins[0];

  // Hide if user has dismissed this specific weekly check-in
  if (latest.id === preferences.dismissedWeeklyCheckinId) return null;

  const payload = latest.payload as any;

  if (isV2(payload)) {
    const p = payload as V2Payload;
    return (
      <Card
        className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-2 border-[#0cc9a9]/30 relative group"
        onClick={() => navigate(`/weekly-checkin/${latest.id}`)}
        data-testid="card-weekly-checkin"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-[#0cc9a9] flex-shrink-0" />
            <p className="text-lg font-medium text-foreground">Weekly check-in</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-foreground/10 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              dismissMutation.mutate(latest.id);
            }}
            aria-label="Dismiss weekly check-in"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5" />
        </div>
      </Card>
    );
  }

  // V1 fallback for old stored payloads
  const p = payload as V1Payload;
  const acceptedCount = (latest.acceptedSuggestions || []).length;
  const dismissedCount = (latest.dismissedSuggestions || []).length;
  const totalSuggestions = p.suggestions?.length || 0;
  const pending = Math.max(0, totalSuggestions - acceptedCount - dismissedCount);
  const score = p.metrics?.burnout?.score;
  const delta = p.metrics?.burnout?.delta;

  return (
    <Card
      className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-2 border-[#0cc9a9]/30 relative group"
      onClick={() => navigate(`/weekly-checkin/${latest.id}`)}
      data-testid="card-weekly-checkin"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-[#0cc9a9] flex-shrink-0" />
          <p className="text-lg font-medium text-foreground">Weekly check-in</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-foreground/10 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            dismissMutation.mutate(latest.id);
          }}
          aria-label="Dismiss weekly check-in"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5" />
      </div>
    </Card>
  );
}
