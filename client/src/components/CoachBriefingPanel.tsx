import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sun, Moon, Sparkles, AlertCircle, ChevronRight, X } from "lucide-react";
import { TODAY_BRIEFING_KEY } from "@/hooks/useTodayBriefing";
import type { CoachBriefing } from "@shared/schema";

type BriefingContent = {
  greeting?: string;
  summary?: string;
  focus?: string[];
  nudges?: string[];
  watchout?: string | null;
};

interface Props {
  briefing: CoachBriefing;
}

export default function CoachBriefingPanel({ briefing }: Props) {
  const isMorning = briefing.type === "morning";
  const Icon = isMorning ? Sun : Moon;
  const accent = isMorning ? "text-amber-500" : "text-indigo-400";
  const label = isMorning ? "Morning Briefing" : "Evening Debrief";
  const content = (briefing.content || {}) as BriefingContent;

  const markedReadRef = useRef(false);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/coach/briefing/${id}/read`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TODAY_BRIEFING_KEY });
      const prev = queryClient.getQueryData<CoachBriefing>(TODAY_BRIEFING_KEY);
      if (prev && prev.id === briefing.id && !prev.readAt) {
        queryClient.setQueryData<CoachBriefing>(TODAY_BRIEFING_KEY, {
          ...prev,
          readAt: new Date() as unknown as CoachBriefing["readAt"],
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(TODAY_BRIEFING_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TODAY_BRIEFING_KEY });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/coach/briefing/${id}/dismiss`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TODAY_BRIEFING_KEY });
      const prev = queryClient.getQueryData<CoachBriefing>(TODAY_BRIEFING_KEY);
      if (prev && prev.id === briefing.id) {
        queryClient.setQueryData<CoachBriefing>(TODAY_BRIEFING_KEY, {
          ...prev,
          dismissedAt: new Date() as unknown as CoachBriefing["dismissedAt"],
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(TODAY_BRIEFING_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TODAY_BRIEFING_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/briefings"] });
    },
  });

  useEffect(() => {
    if (markedReadRef.current) return;
    if (briefing.readAt) return;
    markedReadRef.current = true;
    markReadMutation.mutate(briefing.id);
  }, [briefing.id, briefing.readAt, markReadMutation]);

  return (
    <div
      className="mx-4 mt-3 mb-2 rounded-2xl border border-[#0cc9a9]/30 bg-gradient-to-br from-[#0cc9a9]/10 to-transparent overflow-hidden"
      data-testid="coach-briefing-panel"
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-background/40 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-[10px] text-muted-foreground/70">{briefing.briefingDate}</span>
          </div>
          {briefing.source === "fallback" && (
            <span className="ml-1 text-[10px] text-muted-foreground italic">offline</span>
          )}
        </div>
        <button
          onClick={() => dismissMutation.mutate(briefing.id)}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
          title="Dismiss briefing"
          data-testid="button-briefing-dismiss"
          disabled={dismissMutation.isPending}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-3">
        {content.greeting && (
          <h3 className="text-foreground font-semibold text-base leading-snug">
            {content.greeting}
          </h3>
        )}
        {content.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{content.summary}</p>
        )}

        {content.focus && content.focus.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#0cc9a9]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                Focus
              </span>
            </div>
            <ul className="space-y-1.5">
              {content.focus.map((f, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2 leading-relaxed">
                  <span className="text-[#0cc9a9] mt-0.5">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.nudges && content.nudges.length > 0 && (
          <div className="pt-1 border-t border-foreground/5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
              Nudges
            </span>
            <ul className="space-y-1">
              {content.nudges.map((n, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2 leading-relaxed">
                  <span className="mt-0.5">·</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.watchout && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-200">{content.watchout}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Link
            href="/coach/briefings"
            onClick={() => window.dispatchEvent(new Event('close-coach'))}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
            data-testid="link-briefing-history"
          >
            History <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
