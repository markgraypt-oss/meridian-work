import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { ChevronRight, Clock, Dumbbell, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Workout } from "@shared/schema";

export default function TrainingYoga() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { data: yogaClasses = [], isLoading: classesLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "yoga"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=yoga");
      return res.json();
    },
  });

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

  const hasContent = yogaClasses.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader onBack={() => navigate("/training/programme-library")} title="Yoga Library" />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 mt-2">
            <p className="text-muted-foreground">Explore guided yoga sessions for strength, flexibility, and mindfulness.</p>
          </div>

          {classesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : hasContent ? (
            <div className="space-y-4">
              {yogaClasses.map((yogaClass) => (
                <Card
                  key={yogaClass.id}
                  className="p-4 bg-card border-border cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/training/workout/${yogaClass.id}`)}
                  data-testid={`card-yoga-${yogaClass.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(yogaClass as any).imageUrl ? (
                        <img src={(yogaClass as any).imageUrl} alt={yogaClass.title} className="w-full h-full object-cover" />
                      ) : yogaClass.workoutType === 'video' ? (
                        <Play className="w-8 h-8 text-foreground" />
                      ) : (
                        <Dumbbell className="w-8 h-8 text-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{yogaClass.title}</h3>
                      {yogaClass.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{yogaClass.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {yogaClass.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {yogaClass.duration} mins
                          </span>
                        )}
                        {yogaClass.difficulty && (
                          <span className="capitalize">{yogaClass.difficulty}</span>
                        )}
                        {yogaClass.workoutType && (
                          <span className="bg-muted px-2 py-0.5 rounded capitalize">
                            {yogaClass.workoutType}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 bg-blue-900 border-blue-700">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-2">Yoga Content In Development</h3>
                  <p className="text-sm text-blue-100">
                    We're building a comprehensive yoga library featuring guided sessions, techniques, and practices tailored for executive health and performance. Coming soon with video demonstrations and personalised recommendations.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
      
    </div>
  );
}
