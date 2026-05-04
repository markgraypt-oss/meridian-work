import { useQuery } from "@tanstack/react-query";
import type { CoachBriefing } from "@shared/schema";

export const TODAY_BRIEFING_KEY = ["/api/coach/briefing/today"];

export function useTodayBriefing(enabled = true) {
  const query = useQuery<CoachBriefing>({
    queryKey: TODAY_BRIEFING_KEY,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const briefing = query.data;
  const isUnread = !!briefing && !briefing.readAt && !briefing.dismissedAt;

  return { briefing, isUnread, isLoading: query.isLoading };
}
