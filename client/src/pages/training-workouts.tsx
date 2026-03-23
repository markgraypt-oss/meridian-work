import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { WorkoutsTab } from "@/components/training/WorkoutsTab";
import TopHeader from "@/components/TopHeader";

export default function TrainingWorkouts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

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
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader onBack={() => navigate("/training/programme-library")} title="Workouts" />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 mt-2">
            <p className="text-muted-foreground">Individual training sessions you can do anytime.</p>
          </div>
          <WorkoutsTab />
        </div>
      </div>
      
    </div>
  );
}
