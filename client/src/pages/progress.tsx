import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { WorkoutHistorySection } from "@/components/progress/WorkoutHistorySection";
import { ExercisePRsSection } from "@/components/progress/ExercisePRsSection";
import { 
  Dumbbell, 
  Trophy, 
  ChevronLeft,
  Award
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const SECTIONS = [
  { id: "workouts", label: "Workouts", icon: Dumbbell },
  { id: "prs", label: "PRs", icon: Trophy },
];

export default function Progress() {
  const [activeTab, setActiveTab] = useState("workouts");
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Progress</h1>
            <div className="ml-auto">
              <Link href="/achievements">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Award className="h-4 w-4 text-[#0cc9a9]" />
                  <span className="text-sm">Badges</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-14 z-40 bg-background border-b border-border">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="h-auto bg-transparent gap-2 px-4 py-2 justify-start">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black"
                    data-testid={`tab-${section.id}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{section.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <div className="px-4 py-6 pb-24">
          <TabsContent value="workouts" className="mt-0">
            <WorkoutHistorySection />
          </TabsContent>
          
          <TabsContent value="prs" className="mt-0">
            <ExercisePRsSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
