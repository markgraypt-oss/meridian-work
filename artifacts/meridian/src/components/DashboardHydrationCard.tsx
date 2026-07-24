import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { localDateStr, todayLocalStr } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Droplets, ChevronRight, CheckCircle2 } from "lucide-react";
import type { HydrationLog, HydrationGoal } from "@shared/schema";

interface DashboardHydrationCardProps {
  habitId: number;
  onChevronClick: () => void;
  selectedDate?: Date;
}

const getProgressBarColor = (percentage: number) => {
  if (percentage < 50) return '#ef4444';
  if (percentage < 75) return '#0cc9a9';
  return '#4ade80';
};

export default function DashboardHydrationCard({ habitId, onChevronClick, selectedDate }: DashboardHydrationCardProps) {
  const { isAuthenticated } = useAuth();

  // Format date for API query - use selectedDate if provided, otherwise use today
  const dateStr = selectedDate ? localDateStr(selectedDate) : todayLocalStr();

  const { data: hydrationStats } = useQuery<{
    totalMl: number;
    goalMl: number;
    percentage: number;
    logs: HydrationLog[];
    goal: HydrationGoal | undefined;
  }>({
    queryKey: ['/api/hydration/today', dateStr],
    queryFn: async () => {
      const response = await fetch(`/api/hydration/today?date=${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch hydration stats');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const isLoading = !hydrationStats;
  const hydrationGoal = hydrationStats?.goalMl || 3000;
  const hydrationCurrent = hydrationStats?.totalMl || 0;
  const hydrationPercentage = hydrationStats?.percentage || 0;

  if (isLoading) {
    return (
      <Card className="p-4" data-testid={`card-hydration-habit-${habitId}-loading`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-muted rounded animate-pulse mb-2" />
        <div className="h-2 w-full bg-muted rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card 
      className="p-4 hover:bg-foreground/5 transition-colors cursor-pointer"
      data-testid={`card-hydration-habit-${habitId}`}
      onClick={() => onChevronClick()}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {hydrationPercentage >= 100 ? (
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            ) : (
              <Droplets className="h-6 w-6 text-blue-500 flex-shrink-0" />
            )}
            <h4 className="text-lg font-medium text-foreground">Stay hydrated</h4>
          </div>
          
          <div className="mb-2">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-sm font-medium text-foreground">{hydrationCurrent}ml</span>
              <span className="text-xs text-muted-foreground">/ {hydrationGoal}ml</span>
            </div>
            <div className="flex h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full transition-all"
                style={{ 
                  width: `${Math.min(hydrationPercentage, 100)}%`,
                  backgroundColor: getProgressBarColor(hydrationPercentage)
                }}
              ></div>
            </div>
          </div>

          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-500 text-white">
            Hydration
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChevronClick();
          }}
          className="ml-4 flex-shrink-0"
          data-testid={`button-hydration-chevron-${habitId}`}
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5" />
        </button>
      </div>
    </Card>
  );
}
