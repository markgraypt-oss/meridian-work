import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Moon, Sparkles, AlertCircle, ChevronRight } from "lucide-react";
import type { CoachBriefing } from "@shared/schema";

type BriefingContent = {
  greeting?: string;
  summary?: string;
  focus?: string[];
  nudges?: string[];
  watchout?: string | null;
};

export default function CoachBriefingCard() {
  const { data, isLoading, isError } = useQuery<CoachBriefing>({
    queryKey: ["/api/coach/briefing/today"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const cardRef = useRef<HTMLDivElement | null>(null);

  // When the dashboard is opened from a briefing notification (which links
  // to /?briefing=<id>), scroll the briefing card into view once it has
  // rendered so the user lands directly on the content the push referred to.
  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const briefingId = params.get("briefing");
    if (!briefingId) return;
    if (String(data.id) !== briefingId) return;
    const t = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Clean the query param so a refresh doesn't re-scroll.
      const url = new URL(window.location.href);
      url.searchParams.delete("briefing");
      window.history.replaceState({}, "", url.toString());
    }, 150);
    return () => window.clearTimeout(t);
  }, [data]);

  if (isLoading) {
    return (
      <div className="mx-4 mt-3 mb-1">
        <Card className="border border-[#0cc9a9]/30 bg-gradient-to-br from-[#0cc9a9]/10 to-transparent">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) return null;

  const isMorning = data.type === "morning";
  const Icon = isMorning ? Sun : Moon;
  const accent = isMorning ? "text-amber-400" : "text-indigo-300";
  const label = isMorning ? "Morning Briefing" : "Evening Debrief";
  const content = (data.content || {}) as BriefingContent;

  return (
    <div ref={cardRef} className="mx-4 mt-3 mb-1" data-testid="coach-briefing-card">
      <Card className="border border-[#0cc9a9]/30 bg-gradient-to-br from-[#0cc9a9]/10 to-transparent overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-background/40 ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              {data.source === "fallback" && (
                <span className="text-[10px] text-muted-foreground italic">offline</span>
              )}
            </div>
            <Link
              href="/coach/briefings"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              data-testid="link-briefing-history"
            >
              History <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {content.greeting && (
            <h3 className="text-foreground font-semibold text-base mb-1">
              {content.greeting}
            </h3>
          )}
          {content.summary && (
            <p className="text-sm text-muted-foreground mb-3">{content.summary}</p>
          )}

          {content.focus && content.focus.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#0cc9a9]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Focus
                </span>
              </div>
              <ul className="space-y-1">
                {content.focus.map((f, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-[#0cc9a9] mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.nudges && content.nudges.length > 0 && (
            <div className="mb-2">
              <ul className="space-y-1">
                {content.nudges.map((n, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="mt-0.5">·</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.watchout && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200">{content.watchout}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
