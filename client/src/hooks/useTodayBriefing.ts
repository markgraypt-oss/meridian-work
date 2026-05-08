import { useQuery } from "@tanstack/react-query";
import type { CoachBriefing } from "@shared/schema";

export const TODAY_BRIEFING_KEY = ["/api/coach/briefing/today"];

export function useTodayBriefing(enabled = true) {
  const query = useQuery<CoachBriefing | null>({
    queryKey: TODAY_BRIEFING_KEY,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Backend returns 204 when no AI briefing is available yet. Treat any
  // briefing flagged as a legacy "fallback" as no briefing.
  const raw = query.data ?? undefined;
  const briefing = raw && (raw as any).source !== "fallback" ? raw : undefined;
  const isUnread = !!briefing && !briefing.readAt && !briefing.dismissedAt;

  return { briefing, isUnread, isLoading: query.isLoading };
}
