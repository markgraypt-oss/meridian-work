import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { MyTrainingTab } from "@/components/training/MyTrainingTab";
import TopHeader from "@/components/TopHeader";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrainingMainProgramme() {
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="My Programme" onBack={() => navigate("/training")} />
      
      <div className="p-4 pt-16">
        <div className="max-w-7xl mx-auto">
          <MyTrainingTab />
        </div>
      </div>
      
    </div>
  );
}
