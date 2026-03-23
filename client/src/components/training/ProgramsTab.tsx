import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Target, Dumbbell, ChevronRight, Plus, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Programme } from "@shared/schema";

type SectionConfig = {
  key: string;
  title: string;
  filter: (p: Programme) => boolean;
};

const sections: SectionConfig[] = [
  {
    key: "all",
    title: "All Programmes",
    filter: () => true,
  },
  {
    key: "gym",
    title: "Gym",
    filter: (p) => (p.category || []).includes("gym"),
  },
  {
    key: "home",
    title: "Home",
    filter: (p) => (p.category || []).includes("home"),
  },
  {
    key: "great_for_travel",
    title: "Great for Travel",
    filter: (p) => (p.category || []).includes("travel"),
  },
  {
    key: "female_specific",
    title: "Female Specific",
    filter: (p) => (p.category || []).includes("female_specific"),
  },
];

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function ProgrammesTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [conflictState, setConflictState] = useState<any>(null);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [programmeToEnroll, setProgrammeToEnroll] = useState<{ id: number, type: 'main' | 'supplementary' } | null>(null);

  const { data: programs = [], isLoading: programsLoading, error } = useQuery<Programme[]>({
    queryKey: ["/api/programs", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/programs`);
      return res.json();
    },
    retry: false,
  });

  const { data: userCreatedPrograms = [] } = useQuery<any[]>({
    queryKey: ["/api/user-programmes"],
    retry: false,
  });

  const deleteUserProgramMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/user-programmes/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-programmes"] });
      toast({ title: "Programme deleted", description: "Your custom programme has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete programme.", variant: "destructive" });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async ({ programId, programType, forceReplace }: { programId: number, programType: 'main' | 'supplementary', forceReplace?: boolean }) => {
      const endpoint = programType === 'supplementary' 
        ? `/api/programs/${programId}/enroll-supplementary`
        : `/api/programs/${programId}/enroll`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReplace: forceReplace || false }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          const error: any = new Error(data.message);
          error.code = data.code;
          error.status = res.status;
          error.existingEnrollment = data.existingEnrollment;
          throw error;
        }
        throw new Error(data.message || "Failed to enroll");
      }
      return data;
    },
    onSuccess: (enrollment, { programType }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/today-workout"] });
      toast({
        title: "Success",
        description: programType === 'supplementary' 
          ? "Supplementary program added successfully!"
          : "You've been enrolled in the program!",
      });
      setSelectedProgramme(null);
      setConflictState(null);
      setProgrammeToEnroll(null);
      if (programType === 'main') {
        navigate(`/program-hub/${enrollment.id}`);
      }
    },
    onError: (error: any) => {
      if (error.code === 'PROGRAMME_CONFLICT' && error.status === 409) {
        setConflictState(error.existingEnrollment);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to enroll in program. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmReplace = () => {
    if (programmeToEnroll) {
      enrollMutation.mutate({ 
        programId: programmeToEnroll.id, 
        programType: programmeToEnroll.type,
        forceReplace: true 
      });
    }
  };

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading programmes...</p>
        </div>
      </div>
    );
  }

  const sortedByNew = [...programs].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const getSectionProgrammes = (section: SectionConfig): Programme[] => {
    const source = section.key === "new" ? sortedByNew : programs;
    const filtered = source.filter(section.filter);
    if (section.key === "view_all") return filtered.slice(0, 9);
    return filtered.slice(0, 9);
  };

  return (
    <>
      <div className="space-y-6">
        {/* My Created Programmes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">My Created Programmes</h3>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-[#0cc9a9] font-medium flex items-center gap-0.5 h-auto p-0 hover:bg-transparent"
              onClick={() => navigate("/training/create-programme")}
            >
              <Plus className="w-3.5 h-3.5" /> Create New
            </Button>
          </div>

          {userCreatedPrograms.length === 0 ? (
            <div
              className="flex items-center justify-center h-[120px] rounded-xl border border-dashed border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => navigate("/training/create-programme")}
            >
              <div className="text-center">
                <Plus className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">Build your own programme</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {userCreatedPrograms.map((program: any) => (
                <div
                  key={program.id}
                  className="flex-shrink-0 w-[45vw] max-w-[220px] cursor-pointer group relative"
                  onClick={() => navigate(`/training/programme/${program.id}`)}
                >
                  <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted group-hover:scale-[1.02] transition-transform duration-200 shadow-sm">
                    {program.imageUrl ? (
                      <img
                        src={program.imageUrl}
                        alt={program.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                        <Target className="w-10 h-10 text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h4 className="text-white font-bold text-base leading-tight line-clamp-2 mb-1">
                        {program.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-white/70">
                        <span className="text-xs">
                          {program.trainingDaysPerWeek || 0} workouts
                        </span>
                        <span className="text-white/40">·</span>
                        <span className="text-xs">
                          {difficultyLabels[program.difficulty] || program.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {sections.map((section) => {
          const sectionProgrammes = getSectionProgrammes(section);
          return (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">{section.title}</h3>
                {sectionProgrammes.length > 4 && (
                  <button
                    onClick={() => navigate(`/training/programmes/${section.key}`)}
                    className="text-xs text-[#0cc9a9] font-medium flex items-center gap-0.5"
                  >
                    See All <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {sectionProgrammes.length === 0 ? (
                <div className="flex items-center justify-center h-[120px] rounded-xl border border-dashed border-border/50 bg-muted/20">
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {sectionProgrammes.map((program) => (
                  <div
                    key={program.id}
                    className="flex-shrink-0 w-[45vw] max-w-[220px] cursor-pointer group"
                    onClick={() => navigate(`/training/programme/${program.id}`)}
                  >
                    <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted group-hover:scale-[1.02] transition-transform duration-200 shadow-sm">
                      {program.imageUrl ? (
                        <img
                          src={program.imageUrl}
                          alt={program.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                          <Target className="w-10 h-10 text-white/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="text-white font-bold text-base leading-tight line-clamp-2 mb-1">
                          {program.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-white/70">
                          <span className="text-xs">
                            {program.trainingDaysPerWeek} workouts
                          </span>
                          <span className="text-white/40">·</span>
                          <span className="text-xs">
                            {difficultyLabels[program.difficulty] || program.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {sectionProgrammes.length >= 9 && (
                  <div
                    className="flex-shrink-0 w-[30vw] max-w-[140px] cursor-pointer group"
                    onClick={() => navigate(`/training/programmes/${section.key}`)}
                  >
                    <div className="relative rounded-xl overflow-hidden h-[280px] bg-muted/50 border border-border/50 flex flex-col items-center justify-center gap-2 group-hover:bg-muted transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#0cc9a9]/10 flex items-center justify-center">
                        <ChevronRight className="w-5 h-5 text-[#0cc9a9]" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">View All</span>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!conflictState} onOpenChange={(open) => !open && setConflictState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Main Programme?</AlertDialogTitle>
            <AlertDialogDescription>
              You currently have <strong>{conflictState?.programme?.title}</strong> as your active programme.
              {"\n\n"}
              Do you want to switch to <strong>{selectedProgramme?.title}</strong>? Your current programme will be marked as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-4">
            {conflictState?.programme && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium text-destructive">Current: {conflictState.programme.title}</p>
              </div>
            )}
            {selectedProgramme && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">New: {selectedProgramme.title}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel onClick={() => setConflictState(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmReplace}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-confirm-replace-programme"
            >
              Switch Programme
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}