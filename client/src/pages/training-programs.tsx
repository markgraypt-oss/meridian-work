import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgrammesTab } from "@/components/training/ProgramsTab";
import { WorkoutsTab } from "@/components/training/WorkoutsTab";
import { MyTrainingTab } from "@/components/training/MyTrainingTab";
import TopHeader from "@/components/TopHeader";
import { Dumbbell, BookOpen } from "lucide-react";

export default function Training() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("programs");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <TopHeader title="Training" />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Title Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-dark mb-2">Programme & Workout Library</h1>
            <p className="text-muted-foreground">Explore the complete collection of strength programmes and individual workouts.</p>
          </div>

          {/* Card Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setActiveTab("programs")}
              className={`group transition-all ${activeTab === "programs" ? "ring-2 ring-primary" : ""}`}
            >
              <Card className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-full ${activeTab === "programs" ? "shadow-lg" : ""}`}>
                <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                  <Dumbbell className="h-16 w-16 text-primary opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold text-neutral-dark">Programmes</h2>
                  <p className="text-muted-foreground text-sm mt-1">Structured training plans</p>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveTab("workouts")}
              className={`group transition-all ${activeTab === "workouts" ? "ring-2 ring-primary" : ""}`}
            >
              <Card className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-full ${activeTab === "workouts" ? "shadow-lg" : ""}`}>
                <div className="h-32 bg-gradient-to-br from-secondary/10 to-secondary/5 flex items-center justify-center group-hover:from-secondary/20 group-hover:to-secondary/10 transition-colors">
                  <BookOpen className="h-16 w-16 text-secondary opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold text-neutral-dark">Workouts</h2>
                  <p className="text-muted-foreground text-sm mt-1">Individual training sessions</p>
                </CardContent>
              </Card>
            </button>
          </div>

          {/* Content Area */}
          <Card className="overflow-hidden">
            <CardContent className="p-8">
              {activeTab === "programs" && <ProgrammesTab />}
              {activeTab === "workouts" && <WorkoutsTab />}
              {activeTab === "my-training" && <MyTrainingTab />}
            </CardContent>
          </Card>
        </div>
      </div>
      
    </div>
  );
}
