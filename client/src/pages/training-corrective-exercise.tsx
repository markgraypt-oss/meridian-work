import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { ChevronRight, Clock, Dumbbell, Play, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Program, Workout } from "@shared/schema";

export default function TrainingCorrectiveExercise() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("programmes");

  const { data: correctiveProgrammes = [], isLoading: programmesLoading } = useQuery<Program[]>({
    queryKey: ["/api/programs", "corrective"],
    queryFn: async () => {
      const res = await fetch("/api/programs?programmeType=corrective");
      return res.json();
    },
  });

  const { data: correctiveRoutines = [], isLoading: routinesLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", "corrective"],
    queryFn: async () => {
      const res = await fetch("/api/workouts?routineType=corrective");
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

  const isContentLoading = programmesLoading || routinesLoading;
  const hasContent = correctiveProgrammes.length > 0 || correctiveRoutines.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader onBack={() => navigate("/training/programme-library")} title="Corrective Exercise Library" />
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 mt-2">
            <p className="text-muted-foreground">Targeted exercises to address movement patterns, imbalances, and injury prevention.</p>
          </div>

          {isContentLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : hasContent ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-card">
                <TabsTrigger value="programmes" className="data-[state=active]:bg-primary data-[state=active]:text-foreground">
                  Programmes ({correctiveProgrammes.length})
                </TabsTrigger>
                <TabsTrigger value="routines" className="data-[state=active]:bg-primary data-[state=active]:text-foreground">
                  Routines ({correctiveRoutines.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="programmes" className="space-y-4">
                {correctiveProgrammes.length > 0 ? (
                  correctiveProgrammes.map((programme) => (
                    <Card
                      key={programme.id}
                      className="p-4 bg-card border-border cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/training/programme/${programme.id}`)}
                      data-testid={`card-programme-${programme.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-8 h-8 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{programme.title}</h3>
                          {programme.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{programme.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {programme.weeks && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {programme.weeks} weeks
                              </span>
                            )}
                            {programme.difficulty && (
                              <span className="capitalize">{programme.difficulty}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No corrective programmes available yet.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="routines" className="space-y-4">
                {correctiveRoutines.length > 0 ? (
                  correctiveRoutines.map((routine) => (
                    <Card
                      key={routine.id}
                      className="p-4 bg-card border-border cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/training/workout/${routine.id}`)}
                      data-testid={`card-routine-${routine.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#0cc9a9] to-orange-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {(routine as any).imageUrl ? (
                            <img src={(routine as any).imageUrl} alt={routine.title} className="w-full h-full object-cover" />
                          ) : routine.workoutType === 'video' ? (
                            <Play className="w-8 h-8 text-foreground" />
                          ) : (
                            <Dumbbell className="w-8 h-8 text-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{routine.title}</h3>
                          {routine.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{routine.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {routine.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {routine.duration} mins
                              </span>
                            )}
                            {routine.difficulty && (
                              <span className="capitalize">{routine.difficulty}</span>
                            )}
                            {routine.workoutType && (
                              <span className="bg-muted px-2 py-0.5 rounded capitalize">
                                {routine.workoutType}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No corrective routines available yet.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="p-6 bg-blue-900 border-blue-700">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-2">Corrective Exercise In Development</h3>
                  <p className="text-sm text-blue-100">
                    We're building a specialised library of corrective exercises designed to address common movement dysfunctions and imbalances. Each exercise includes detailed technique guidance, progression options, and integration with your body map assessments.
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
