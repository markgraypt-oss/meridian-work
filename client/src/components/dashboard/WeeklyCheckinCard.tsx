import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { WeeklyCheckin } from "@shared/schema";

interface WeeklyPayload {
  weekStart: string;
  weekEnd: string;
  summary: { wins: string[]; concerns: string[]; burnoutTrajectory: string };
  metrics: { burnout: { score: number | null; delta: number | null } };
  suggestions: { id: string }[];
}

export default function WeeklyCheckinCard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<WeeklyCheckin>({
    queryKey: ["/api/weekly-checkins/current"],
  });

  if (isLoading || !data) return null;
  const payload = data.payload as WeeklyPayload;
  const acceptedCount = (data.acceptedSuggestions || []).length;
  const dismissedCount = (data.dismissedSuggestions || []).length;
  const totalSuggestions = payload.suggestions?.length || 0;
  const pending = Math.max(0, totalSuggestions - acceptedCount - dismissedCount);
  const score = payload.metrics?.burnout?.score;
  const delta = payload.metrics?.burnout?.delta;

  return (
    <Card
      className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border-2 border-[#0cc9a9]/30"
      onClick={() => navigate("/weekly-checkin")}
      data-testid="card-weekly-checkin"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-[#0cc9a9] flex-shrink-0" />
          <p className="text-lg font-medium text-foreground">Weekly check-in</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {payload.summary?.burnoutTrajectory || "Your AI summary is ready."}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#0cc9a9] text-black">
            Week of {format(new Date(payload.weekStart), "d MMM")}
          </span>
          {score !== null && score !== undefined && (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
              Burnout {score}{delta !== null && delta !== undefined ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""}
            </span>
          )}
          {pending > 0 && (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {pending} suggestion{pending === 1 ? "" : "s"} to review
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
    </Card>
  );
}
