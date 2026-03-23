import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { WorkoutHistorySection } from "@/components/progress/WorkoutHistorySection";

export default function ProgressWorkouts() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-[#0cc9a9]">Workouts</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-24">
        <WorkoutHistorySection />
      </div>
    </div>
  );
}
