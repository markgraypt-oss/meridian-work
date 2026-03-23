import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import TopHeader from "@/components/TopHeader";
import programmesImage from "@assets/v2eg_1768216517608.png";
import workoutsImage from "@assets/stock_images/workout_training_exe_0da03e3a.jpg";
import stretchingImage from "@assets/stock_images/stretching_and_mobil_a3a6fa27.jpg";
import yogaImage from "@assets/stock_images/yoga_practice_medita_1860c0f2.jpg";
import correctiveImage from "@assets/stock_images/corrective_exercise__d108b175.jpg";

export default function TrainingLibrary() {
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
      <TopHeader onBack={() => navigate("/training")} title="Programme & Workout Library" />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Description Section */}
          <div className="mb-6 mt-2">
            <p className="text-muted-foreground">Explore the complete collection of strength programmes and individual workouts.</p>
          </div>

          {/* Card Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => navigate("/training/programmes")}
              className="group transition-all"
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-40">
                <div 
                  className="h-full relative flex items-center"
                  style={{
                    backgroundImage: `url(${programmesImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-colors"></div>
                  <div className="relative p-6 z-10">
                    <h2 className="text-3xl font-bold text-foreground">Programmes</h2>
                  </div>
                </div>
              </Card>
            </button>

            <button
              onClick={() => navigate("/training/workouts")}
              className="group transition-all"
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-40">
                <div 
                  className="h-full relative flex items-center"
                  style={{
                    backgroundImage: `url(${workoutsImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-colors"></div>
                  <div className="relative p-6 z-10">
                    <h2 className="text-3xl font-bold text-foreground">Workouts</h2>
                  </div>
                </div>
              </Card>
            </button>

            <button
              onClick={() => navigate("/training/stretching-mobility")}
              className="group transition-all"
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-40">
                <div 
                  className="h-full relative flex items-center"
                  style={{
                    backgroundImage: `url(${stretchingImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-colors"></div>
                  <div className="relative p-6 z-10">
                    <h2 className="text-3xl font-bold text-foreground">Stretching & Mobility</h2>
                  </div>
                </div>
              </Card>
            </button>

            <button
              onClick={() => navigate("/training/yoga")}
              className="group transition-all"
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-40">
                <div 
                  className="h-full relative flex items-center"
                  style={{
                    backgroundImage: `url(${yogaImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-colors"></div>
                  <div className="relative p-6 z-10">
                    <h2 className="text-3xl font-bold text-foreground">Yoga</h2>
                  </div>
                </div>
              </Card>
            </button>

            <button
              onClick={() => navigate("/training/corrective-exercise")}
              className="group transition-all"
            >
              <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-40">
                <div 
                  className="h-full relative flex items-center"
                  style={{
                    backgroundImage: `url(${correctiveImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/35 transition-colors"></div>
                  <div className="relative p-6 z-10">
                    <h2 className="text-3xl font-bold text-foreground">Corrective Exercise</h2>
                  </div>
                </div>
              </Card>
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
