import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TopHeader from "@/components/TopHeader";
import { Clock, Target, Dumbbell, Calendar, AlertCircle, Heart, ChevronLeft, ChevronRight, Check, Zap, MoreVertical } from "lucide-react";
import type { Programme, Workout } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProgrammePreviewDialog } from "@/components/ProgramPreviewDialog";

const goalLabels: Record<string, string> = {
  strength: "Strength",
  max_strength: "Max Strength",
  hypertrophy: "Hypertrophy",
  power: "Power",
  functional_strength: "Functional Strength",
  conditioning: "Conditioning",
  hiit: "HIIT",
  mobility: "Mobility",
  corrective: "Corrective",
  yoga: "Yoga",
};


const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function TrainingProgrammeOverview() {
  const [match, params] = useRoute("/training/programme/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Post-enrolment Body Map safety check state
  const [showBodyMapModal, setShowBodyMapModal] = useState(false);
  const [newEnrollmentId, setNewEnrollmentId] = useState<number | null>(null);
  const [activeIssue, setActiveIssue] = useState<{ outcomeId: number; bodyMapLogId: number; bodyArea: string } | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [substitutionSelections, setSubstitutionSelections] = useState<Record<number, number>>({});
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const programmeId = params?.id ? parseInt(params.id) : null;

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

  const { data: programme, isLoading: isProgrammeLoading } = useQuery({
    queryKey: ["/api/programs", programmeId],
    queryFn: async () => {
      const response = await fetch(`/api/programs/${programmeId}`);
      if (!response.ok) throw new Error("Failed to fetch programme");
      return response.json() as Promise<Programme>;
    },
    enabled: !!programmeId && isAuthenticated,
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["/api/bookmarks"],
    retry: false,
  });

  // Check for active main programme enrollment
  const { data: timeline } = useQuery({
    queryKey: ["/api/my-programs/timeline"],
    enabled: isAuthenticated,
  });

  // Determine if user has an active main programme (that's different from the one they're viewing)
  const hasActiveMainProgramme = timeline?.current && timeline.current.programId !== programmeId;
  const activeMainProgrammeName = timeline?.current?.programName;

  // If enrolled in this programme, pass enrollment ID so workout counts use enrolled data
  const enrolledInThisProgramme = timeline?.current?.programId === programmeId;
  const activeEnrollmentId = enrolledInThisProgramme ? timeline?.current?.id : null;

  const { data: workouts = [] } = useQuery({
    queryKey: ["/api/programs", programmeId, "workouts", activeEnrollmentId],
    queryFn: async () => {
      const url = activeEnrollmentId
        ? `/api/programs/${programmeId}/workouts?enrollmentId=${activeEnrollmentId}`
        : `/api/programs/${programmeId}/workouts`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch workouts");
      return response.json() as Promise<Workout[]>;
    },
    enabled: !!programmeId && isAuthenticated && timeline !== undefined,
  });

  // Pre-fetch body map active issue for instant modal display after enrollment
  const { data: bodyMapActiveIssue } = useQuery({
    queryKey: ["/api/body-map/active-issue"],
    queryFn: async () => {
      const response = await fetch('/api/body-map/active-issue', { credentials: 'include' });
      if (!response.ok) return { active: false };
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch preview data when we have both enrollmentId and outcomeId
  const { data: previewDataQuery, isLoading: isPreviewLoading } = useQuery({
    queryKey: ["/api/programme-modifications/preview", newEnrollmentId, activeIssue?.outcomeId],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/programme-modifications/preview", {
        outcomeId: activeIssue!.outcomeId,
        enrollmentId: newEnrollmentId
      });
      if (!res.ok) throw new Error("Failed to fetch preview");
      return res.json();
    },
    enabled: !!newEnrollmentId && !!activeIssue?.outcomeId && showBodyMapModal,
  });

  // Update preview data and selections when query completes
  // Now uses exerciseId as key since exercises are grouped (each unique exercise shown once)
  useEffect(() => {
    if (previewDataQuery && !previewData) {
      setPreviewData(previewDataQuery);
      // Initialize selections by exerciseId (not instance) since exercises are now grouped
      const initialSelections: Record<number, number> = {};
      for (const flagged of previewDataQuery.flaggedExercises || []) {
        if (previewDataQuery.substituteOptions?.length > 0) {
          initialSelections[flagged.exerciseId] = previewDataQuery.substituteOptions[0].id;
        } else {
          initialSelections[flagged.exerciseId] = flagged.exerciseId;
        }
      }
      setSubstitutionSelections(initialSelections);
    }
  }, [previewDataQuery, previewData]);

  const isFavourited = (pid: number) => {
    return bookmarks.some((b: any) => b.contentType === 'programme' && b.contentId === pid);
  };

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bookmarks", {
        contentType: "programme",
        contentId: programmeId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Added to favourites",
        description: "Programme has been added to your favourites.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add to favourites.",
        variant: "destructive",
      });
    },
  });

  const unfavoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/bookmarks/program/${programmeId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({
        title: "Removed from favourites",
        description: "Programme has been removed from your favourites.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove from favourites.",
        variant: "destructive",
      });
    },
  });

  const toggleFavourite = () => {
    if (programmeId) {
      if (isFavourited(programmeId)) {
        unfavoriteMutation.mutate();
      } else {
        favoriteMutation.mutate();
      }
    }
  };


  const isUserCreated = programme?.sourceType === 'user_created';

  const deleteUserProgramMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/user-programmes/${programmeId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-programmes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({ title: "Programme deleted", description: "Your custom programme has been removed." });
      navigate("/training?tab=programmes");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete programme.", variant: "destructive" });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async ({ programType, forceReplace = false }: { programType: "main" | "supplementary", forceReplace?: boolean }) => {
      const endpoint =
        programType === "supplementary"
          ? `/api/programs/${programmeId}/enroll-supplementary`
          : `/api/programs/${programmeId}/enroll`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceReplace }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          // Return conflict response without throwing
          return { conflict: true, status: 409 };
        }
        throw new Error(error.message || "Failed to enrol");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data?.conflict) {
        setShowConflictDialog(true);
        return;
      }
      if (data) {
        // Store the new enrollmentId
        const enrollmentId = data.id;
        setNewEnrollmentId(enrollmentId);
        
        // Check for active Body Map issue (only for main programmes)
        // Use pre-fetched data for instant response
        const enrollType = (programme?.programmeType === 'stretching' || programme?.programmeType === 'corrective') 
          ? 'supplementary' 
          : 'main';
        
        if (enrollType === 'main' && bodyMapActiveIssue?.active && bodyMapActiveIssue?.outcomeId) {
          // Active Body Map issue found - show modal immediately
          // Preview data will be loaded via React Query and display loading state
          setActiveIssue({
            outcomeId: bodyMapActiveIssue.outcomeId,
            bodyMapLogId: bodyMapActiveIssue.bodyMapLogId,
            bodyArea: bodyMapActiveIssue.bodyArea
          });
          setShowBodyMapModal(true);
          queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
          return; // Don't navigate yet - wait for modal action
        }
        
        // No active issue or not a main programme - navigate as usual
        toast({
          title: "Success",
          description: "You have successfully enrolled in the programme.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
        navigate("/training");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to accept programme modifications for the new enrollment
  const acceptModificationsMutation = useMutation({
    mutationFn: async (data: { 
      outcomeId: number; 
      enrollmentId: number; 
      selections?: Array<{ exerciseInstanceId: number; chosenSubstituteExerciseId: number }> 
    }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/accept", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      const { substitutionsApplied, substitutionsFailed } = response;
      let description = `${substitutionsApplied} exercise${substitutionsApplied !== 1 ? 's' : ''} updated.`;
      if (substitutionsFailed > 0) {
        description += ` ${substitutionsFailed} couldn't be substituted.`;
      }
      toast({ title: "Changes applied", description });
      setShowBodyMapModal(false);
      setPreviewData(null);
      setSubstitutionSelections({});
      queryClient.invalidateQueries({ queryKey: ['/api/user/enrollments'] });
      navigate("/training");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply changes. Please try again.", variant: "destructive" });
    }
  });

  // Helper to cycle to the next substitute option (now keyed by exerciseId)
  const cycleSubstitute = (exerciseId: number, direction: 'next' | 'prev') => {
    if (!previewData?.substituteOptions) return;
    
    // Build option list: all substitutes + "keep current" (original exerciseId) at the end
    const substituteIds = previewData.substituteOptions.map((s: any) => s.id).filter((id: number) => id !== exerciseId);
    const optionIds = [...substituteIds, exerciseId]; // Include "Keep current" at end
    
    if (optionIds.length <= 1) return;
    
    const currentSelection = substitutionSelections[exerciseId];
    let currentIndex = optionIds.findIndex(id => id === currentSelection);
    
    // If current selection not found, default to first option
    if (currentIndex === -1) currentIndex = 0;
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % optionIds.length;
    } else {
      newIndex = currentIndex <= 0 ? optionIds.length - 1 : currentIndex - 1;
    }
    
    setSubstitutionSelections(prev => ({
      ...prev,
      [exerciseId]: optionIds[newIndex]
    }));
  };

  // Handle apply changes from modal
  const handleApplyChanges = () => {
    if (!activeIssue || !newEnrollmentId) return;
    
    // Build selections: each exerciseId selection must be expanded to all its instanceIds
    // Filter out "keep current" choices (where substitute matches original exerciseId)
    const selections: Array<{ exerciseInstanceId: number; chosenSubstituteExerciseId: number }> = [];
    
    for (const [exerciseIdStr, substituteId] of Object.entries(substitutionSelections)) {
      if (substituteId === undefined || substituteId === null) continue;
      
      const exerciseId = parseInt(exerciseIdStr);
      // Find the flagged exercise entry (now grouped by exerciseId)
      const flagged = previewData?.flaggedExercises?.find(
        (f: any) => f.exerciseId === exerciseId
      );
      
      // Only include if the chosen substitute is different from the original
      if (flagged && substituteId !== flagged.exerciseId) {
        // Expand to all instance IDs for this exercise
        const instanceIds = flagged.instanceIds || [flagged.exerciseInstanceId];
        for (const instanceId of instanceIds) {
          selections.push({
            exerciseInstanceId: instanceId,
            chosenSubstituteExerciseId: substituteId
          });
        }
      }
    }
    
    // If no actual substitutions selected (all kept as-is), treat as "skip"
    if (selections.length === 0) {
      toast({ title: "Got it", description: "No changes made - exercises kept as is." });
      setShowBodyMapModal(false);
      setPreviewData(null);
      setSubstitutionSelections({});
      navigate("/training");
      return;
    }
    
    acceptModificationsMutation.mutate({
      outcomeId: activeIssue.outcomeId,
      enrollmentId: newEnrollmentId,
      selections
    });
  };

  // Handle keep as is from modal
  const handleKeepAsIs = () => {
    toast({ title: "Got it", description: "Your programme will stay as is." });
    setShowBodyMapModal(false);
    setPreviewData(null);
    setSubstitutionSelections({});
    navigate("/training");
  };

  const handleEnroll = (forceReplace = false) => {
    setIsEnrolling(true);
    // Stretching and corrective programmes enroll as supplementary
    const enrollType = (programme?.programmeType === 'stretching' || programme?.programmeType === 'corrective') 
      ? 'supplementary' 
      : 'main';
    enrollMutation.mutate({ programType: enrollType, forceReplace });
    setIsEnrolling(false);
  };

  if (isLoading || isProgrammeLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!match || !programme) {
    return (
      <div className="min-h-screen bg-background p-6">
        <TopHeader title="Programme" onBack={() => navigate("/training?tab=programmes")} />
        <div className="text-center mt-12">
          <p className="text-muted-foreground">Programme not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title={programme.title} 
        onBack={() => navigate("/training?tab=programmes")}
        rightMenuButton={
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFavourite}
              className="p-2 hover:bg-accent rounded-full transition-colors"
              data-testid={`button-favorite-program-${programme.id}`}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isFavourited(programme.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                }`}
              />
            </button>
            {isUserCreated && (
              <button
                onClick={() => setShowActionSheet(true)}
                className="p-2 hover:bg-accent rounded-full transition-colors"
              >
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>
        }
      />

      <div className="p-4 pt-16">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Description Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{programme.description}</p>
            </CardContent>
          </Card>

          {/* Info Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Duration Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Duration</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-foreground">{programme.weeks}</p>
                  <p className="text-sm text-foreground">weeks</p>
                </div>
              </CardContent>
            </Card>

            {/* Workouts per Week Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Workouts per Week</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-bold text-foreground">
                    {(() => {
                      const uniqueNames = new Set(workouts.map((w: any) => w.name).filter(Boolean));
                      return uniqueNames.size || programme.trainingDaysPerWeek || 0;
                    })()}
                  </p>
                  <p className="text-sm text-foreground">sessions</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Programme Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Programme Focus Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Programme Focus</span>
                </div>
                <Badge className="w-fit">
                  <Target className="w-3 h-3 mr-1" />
                  {goalLabels[programme.goal] || programme.goal}
                </Badge>
              </CardContent>
            </Card>

            {/* Difficulty Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Difficulty</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {difficultyLabels[programme.difficulty] || programme.difficulty}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Workouts Section */}
          {workouts.length > 0 && (() => {
            const uniqueWorkouts = Array.from(
              new Map(workouts.map((w) => [w.name, w])).values()
            );
            return (
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold text-foreground">Workouts</h3>
                  <div className="space-y-3">
                    {uniqueWorkouts.map((workout) => (
                      <button
                        key={workout.id}
                        onClick={() => {
                          if (activeEnrollmentId && timeline?.current) {
                            const currentWeek = timeline.current.weekNumber || 1;
                            navigate(`/workout-detail/${activeEnrollmentId}/${currentWeek}/${workout.dayNumber}`);
                          } else {
                            navigate(`/training/workout/${workout.id}`);
                          }
                        }}
                        className="w-full text-left bg-muted rounded-lg border border-border hover:border-primary hover:bg-slate-650 transition-colors cursor-pointer flex gap-3 items-stretch overflow-hidden h-[72px]"
                      >
                        {/* Image Container - Square thumbnail */}
                        <div className="flex-shrink-0 w-[72px] h-[72px] bg-muted overflow-hidden flex items-center justify-center rounded-l-lg">
                          {workout.imageUrl ? (
                            <img
                              src={workout.imageUrl}
                              alt={workout.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Dumbbell className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        
                        {/* Content - Padding only on right */}
                        <div className="flex-grow px-3 py-2.5 flex flex-col justify-center min-w-0 overflow-hidden">
                          <p className="text-base font-bold text-foreground leading-snug truncate">{workout.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-0.5">
                              <Dumbbell className="w-3.5 h-3.5" />
                              {workout.exerciseCount || 0} exercises
                            </span>
                            <span>|</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3.5 h-3.5" />
                              ~{workout.estimatedDuration || 0} min
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Weekly Schedule Visual */}
          {workouts.length > 0 && (() => {
            const workoutDays = new Map<number, string>();
            workouts.forEach((w: any) => {
              if (w.dayNumber && !workoutDays.has(w.dayNumber)) {
                workoutDays.set(w.dayNumber, w.name);
              }
            });
            return (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-3">Weekly Schedule</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const isWorkoutDay = workoutDays.has(day);
                      return (
                        <div
                          key={day}
                          className={`flex flex-col items-center rounded-lg border-2 py-2.5 px-1 ${
                            isWorkoutDay
                              ? "border-primary bg-primary/10"
                              : "border-slate-300 dark:border-slate-600 bg-muted/40"
                          }`}
                        >
                          <span className={`text-[10px] font-bold mb-1.5 ${
                            isWorkoutDay ? "text-primary" : "text-muted-foreground"
                          }`}>
                            Day {day}
                          </span>
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              isWorkoutDay
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60"
                            }`}
                          >
                            {isWorkoutDay ? (
                              <Dumbbell className="w-3.5 h-3.5" />
                            ) : (
                              <span className="text-[8px] font-medium text-muted-foreground">Rest</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">Workout</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-muted/60 border border-border" />
                      <span className="text-xs text-muted-foreground">Rest</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Start Programme Button */}
          <Button
            onClick={() => {
              // For main programmes, check if user already has an active main programme
              const isSupplementary = programme.programmeType === 'stretching' || programme.programmeType === 'corrective';
              if (!isSupplementary && hasActiveMainProgramme) {
                setShowConflictDialog(true);
              } else {
                setIsConfirmDialogOpen(true);
              }
            }}
            disabled={isEnrolling}
            size="lg"
            className="w-full"
          >
            {isEnrolling 
              ? "Starting..." 
              : (programme.programmeType === 'stretching' || programme.programmeType === 'corrective')
                ? "Add as Supplementary Programme"
                : "Start Programme"
            }
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {isConfirmDialogOpen && programme && (
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <AlertDialogContent className="w-[90%] max-w-md bg-card border-border">
            <AlertDialogHeader className="space-y-4">
              <AlertDialogTitle className="text-xl font-bold text-foreground">
                Start {programme.title}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
                You're about to start this {programme.weeks}-week programme. Your first workout will be available immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsConfirmDialogOpen(false)}
                className="flex-1 px-4 py-2 text-base font-semibold bg-muted hover:bg-muted text-foreground rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  handleEnroll(false);
                }}
                className="flex-1 px-4 py-2 text-base font-semibold bg-primary hover:bg-primary/90 text-foreground rounded"
              >
                Start Programme
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showConflictDialog && programme && (
        <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
          <AlertDialogContent className="w-[90%] max-w-md bg-card border-border">
            <AlertDialogHeader className="space-y-4">
              <AlertDialogTitle className="text-xl font-bold text-foreground">
                Switch to {programme.title}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
                You're currently enrolled in {activeMainProgrammeName || "another programme"}. Switching will end that programme and start {programme.title} instead. Your workout history will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowConflictDialog(false)}
                className="flex-1 px-4 py-2 text-base font-semibold bg-muted hover:bg-muted text-foreground rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConflictDialog(false);
                  handleEnroll(true);
                }}
                className="flex-1 px-4 py-2 text-base font-semibold bg-primary hover:bg-primary/90 text-foreground rounded"
              >
                Switch Programme
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Post-enrolment Body Map Safety Check Modal */}
      <Dialog open={showBodyMapModal} onOpenChange={(open) => {
        if (!open) {
          handleKeepAsIs();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Programme Enrolled Successfully</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You're now enrolled in {programme?.title}. Based on your recent body assessment ({activeIssue?.bodyArea}), we found some exercises that may need adjustment.
            </DialogDescription>
          </DialogHeader>
          
          {/* Success indicator */}
          <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg mb-2">
            <Check className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-400">Enrollment complete - review exercise options below</span>
          </div>

          {/* Loading state while preview data loads */}
          {isPreviewLoading && !previewData ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading exercise suggestions...</p>
            </div>
          ) : previewData && previewData.flaggedExercises && previewData.flaggedExercises.length > 0 ? (
            <div className="space-y-4">
              {previewData.flaggedExercises.map((flagged: any) => {
                const selectedSubstituteId = substitutionSelections[flagged.exerciseId];
                const isKeepCurrent = selectedSubstituteId === flagged.exerciseId;
                const selectedSubstitute = previewData.substituteOptions?.find((s: any) => s.id === selectedSubstituteId);
                
                const substitutes = previewData.substituteOptions?.filter((s: any) => s.id !== flagged.exerciseId) || [];
                const optionIds = [...substitutes.map((s: any) => s.id), flagged.exerciseId];
                const currentIndex = optionIds.findIndex(id => id === selectedSubstituteId);
                const totalOptions = optionIds.length;
                
                return (
                  <div key={`${flagged.exerciseId}`} className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {flagged.exerciseImageUrl ? (
                        <img src={flagged.exerciseImageUrl} alt={flagged.exerciseName} className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-600 flex items-center justify-center">
                          <Dumbbell className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{flagged.exerciseName}</p>
                        <p className="text-xs text-[#0cc9a9]">{flagged.reason}</p>
                      </div>
                    </div>
                    
                    {totalOptions > 1 && (
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => cycleSubstitute(flagged.exerciseId, 'prev')}
                          className="p-1 h-8 w-8"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex-1 bg-slate-600 rounded p-2 flex flex-col items-center justify-center gap-1">
                          {isKeepCurrent ? (
                            <>
                              <p className="text-xs text-muted-foreground">Option {currentIndex + 1} of {totalOptions}</p>
                              <p className="text-sm text-muted-foreground">Keep Current</p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                {selectedSubstitute?.imageUrl ? (
                                  <img src={selectedSubstitute.imageUrl} alt={selectedSubstitute.name} className="w-6 h-6 rounded object-cover" />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-slate-500 flex items-center justify-center">
                                    <Dumbbell className="h-3 w-3 text-slate-300" />
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">Option {currentIndex + 1} of {totalOptions}</p>
                              </div>
                              <p className="text-sm text-foreground text-center">{selectedSubstitute?.name || 'Loading...'}</p>
                            </>
                          )}
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => cycleSubstitute(flagged.exerciseId, 'next')}
                          className="p-1 h-8 w-8"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleKeepAsIs}
                  className="flex-1"
                  disabled={acceptModificationsMutation.isPending}
                >
                  Skip for now
                </Button>
                <Button 
                  onClick={handleApplyChanges}
                  className="flex-1"
                  disabled={acceptModificationsMutation.isPending}
                >
                  {acceptModificationsMutation.isPending ? "Applying..." : "Apply selected changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-foreground font-medium">No exercises need to be changed</p>
              <p className="text-sm text-muted-foreground">Your programme is all set!</p>
              <Button onClick={handleKeepAsIs} className="mt-4">
                Continue
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showActionSheet && (
        <div className="fixed inset-0 z-50" onClick={() => setShowActionSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 animate-in slide-in-from-bottom duration-200">
            <div className="bg-white rounded-t-2xl px-4 pt-2 pb-8 max-w-lg mx-auto">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <button
                className="w-full text-left py-3.5 text-[15px] font-medium text-black border-b border-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionSheet(false);
                  navigate(`/training/edit-programme/${programmeId}`);
                }}
              >
                Edit Programme
              </button>
              <button
                className="w-full text-left py-3.5 text-[15px] font-medium text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionSheet(false);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete Programme
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Programme</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this programme? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteUserProgramMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
