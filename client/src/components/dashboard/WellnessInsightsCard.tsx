import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronRight } from "lucide-react";

export default function WellnessInsightsCard() {
  const [, navigate] = useLocation();
  return (
    <Card
      className="p-4 flex items-start justify-between hover:bg-foreground/5 active:bg-foreground/10 transition-colors cursor-pointer border border-[#0cc9a9]/30"
      onClick={() => navigate("/weekly-checkin#wellness-insights")}
      data-testid="card-wellness-insights-link"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[#0cc9a9] flex-shrink-0" />
          <p className="text-base font-medium text-foreground">Wellness insights</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Trends, patterns, and actions from your check-in data.
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 mt-0.5" />
    </Card>
  );
}
