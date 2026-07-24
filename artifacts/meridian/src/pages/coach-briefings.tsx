import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Sun, Moon, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import type { CoachBriefing } from "@shared/schema";

type BriefingContent = {
  greeting?: string;
  summary?: string;
  focus?: string[];
  nudges?: string[];
  watchout?: string | null;
};

export default function CoachBriefingsPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<CoachBriefing[]>({
    queryKey: ["/api/coach/briefings"],
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-md hover:bg-muted"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-foreground">Coach briefings</h1>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No briefings yet. They appear once your coach has generated one for the day.
            </CardContent>
          </Card>
        )}

        {data?.map((b) => {
          const c = (b.content || {}) as BriefingContent;
          const isMorning = b.type === "morning";
          const Icon = isMorning ? Sun : Moon;
          return (
            <Card key={b.id} data-testid={`briefing-${b.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isMorning ? "text-amber-400" : "text-indigo-300"}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isMorning ? "Morning" : "Evening"} · {b.briefingDate}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {b.createdAt ? format(new Date(b.createdAt), "p") : ""}
                  </span>
                </div>
                {c.greeting && <h3 className="font-semibold text-foreground text-sm mb-1">{c.greeting}</h3>}
                {c.summary && <p className="text-sm text-muted-foreground mb-2">{c.summary}</p>}
                {c.focus && c.focus.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {c.focus.map((f, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="text-[#0cc9a9] mt-0.5">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.nudges && c.nudges.length > 0 && (
                  <ul className="space-y-1">
                    {c.nudges.map((n, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="mt-0.5">·</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.watchout && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-200">{c.watchout}</p>
                  </div>
                )}
                {b.source === "fallback" && (
                  <p className="mt-2 text-[10px] italic text-muted-foreground">Generated from offline template</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
