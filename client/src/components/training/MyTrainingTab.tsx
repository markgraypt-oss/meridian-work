import { useState } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, Target, ChevronRight, Plus, MoreVertical, Eye, Trash2, CalendarDays } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function MyTrainingTab() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [historyYear, setHistoryYear] = useState<number | null>(null);
  const [cancelEnrollmentId, setCancelEnrollmentId] = useState<number | null>(null);
  const [rescheduleEnrollment, setRescheduleEnrollment] = useState<{ id: number; currentDate: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");

  const rescheduleMutation = useMutation({
    mutationFn: async ({ enrollmentId, startDate }: { enrollmentId: number; startDate: string }) => {
      await apiRequest("PATCH", `/api/enrollments/${enrollmentId}/reschedule`, { startDate });
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/my-programs/timeline"] });
      toast({ title: "Start date updated", description: "Your programme has been rescheduled." });
      setRescheduleEnrollment(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update the start date.", variant: "destructive" });
    },
  });

  const cancelScheduledMutation = useMutation({
    mutationFn: async (enrollmentId: number) => {
      await apiRequest("DELETE", `/api/my-programs/${enrollmentId}`);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/my-programs/timeline"] });
      queryClient.removeQueries({ queryKey: ["/api/my-programs"] });
      toast({ title: "Programme cancelled", description: "Your scheduled programme has been removed." });
      setCancelEnrollmentId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel the programme.", variant: "destructive" });
      setCancelEnrollmentId(null);
    },
  });

  const { data: timeline, isLoading } = useQuery<any>({
    queryKey: ["/api/my-programs/timeline"],
    retry: false,
  });

  const removeSupplementaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/my-programs/supplementary", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-programs/timeline"] });
      toast({
        title: "Supplementary programme removed",
        description: "Your supplementary programme has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove supplementary programme.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your training...</p>
        </div>
      </div>
    );
  }

  const currentProgramme = timeline?.current;
  const currentSupplementary = timeline?.currentSupplementary;
  const scheduledProgrammes = timeline?.scheduled || [];
  const completedProgrammes = timeline?.completed || [];
  const completedSupplementary = timeline?.completedSupplementary || [];
  
  // Combine all completed programs (main and supplementary) and sort by end date (most recent first)
  // Use enrollment ID as tiebreaker for programs with same end date
  const allCompletedProgrammes = [...completedProgrammes, ...completedSupplementary].sort((a, b) => {
    const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
    const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
    
    if (dateB !== dateA) {
      return dateB - dateA; // Most recent first
    }
    
    // If dates are equal, sort by enrollment ID descending (higher ID = more recent)
    return b.id - a.id;
  });

  const formatGoal = (goal?: string) => {
    if (!goal) return '';
    return goal.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatEquipment = (equipment?: string) => {
    if (!equipment) return '';
    return equipment.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const calculateCompletionPercentage = (workoutsCompleted: number, totalWorkouts: number) => {
    if (!totalWorkouts) return 0;
    const percentage = Math.round((workoutsCompleted / totalWorkouts) * 100);
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0 and 100
  };

  return (
    <div className="space-y-6">
      <div>
        {!currentProgramme ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Active Programme</h3>
              <p className="text-muted-foreground mb-4">
                You haven't enrolled in a training programme yet. Browse our programmes to get started!
              </p>
              <Button 
                onClick={() => navigate('/training/programmes')}
                className="btn-primary"
                data-testid="button-browse-programs"
              >
                Browse Programmes
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card 
            className="hover:shadow-lg transition-shadow overflow-hidden border-2 border-primary/20"
            data-testid="card-current-program"
          >
            <div className="flex flex-col">
              <CardContent className="w-full p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge className="mb-3" variant="default">
                      Active
                    </Badge>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {currentProgramme.programTitle}
                    </h3>
                    <Badge variant="secondary" className="mb-2">
                      {formatGoal(currentProgramme.programGoal)}
                    </Badge>
                  </div>
                  <Badge className="bg-primary text-primary-foreground">
                    1/1
                  </Badge>
                </div>

                {/* Progress Section */}
                <div className="mb-4 p-4 bg-background rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Progress</span>
                    <span className="text-sm font-bold text-primary" data-testid="text-completion-percentage">
                      {calculateCompletionPercentage(currentProgramme.workoutsCompleted, currentProgramme.totalWorkouts)}% Complete
                    </span>
                  </div>
                  <div className="flex h-2 w-full bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-[#0cc9a9] transition-all" style={{ width: `${Math.min(calculateCompletionPercentage(currentProgramme.workoutsCompleted, currentProgramme.totalWorkouts), 100)}%` }}></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {currentProgramme.workoutsCompleted} of {currentProgramme.totalWorkouts} workouts completed
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Timeline</p>
                    <p className="font-medium text-sm text-foreground">
                      {format(new Date(currentProgramme.startDate), 'dd MMM')} - {format(new Date(currentProgramme.endDate), 'dd MMM')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Equipment</p>
                    <p className="font-medium text-sm text-foreground">{formatEquipment(currentProgramme.programEquipment)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Duration</p>
                    <p className="font-medium text-sm text-foreground">{currentProgramme.programWeeks} weeks</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Difficulty</p>
                    <p className="font-medium text-sm capitalize text-foreground">{currentProgramme.programDifficulty}</p>
                  </div>
                </div>

                <Button 
                  onClick={() => navigate(`/program-hub/${currentProgramme.id}`)}
                  className="btn-primary w-full md:w-auto"
                  data-testid="button-view-current-program"
                >
                  View Programme
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </div>
          </Card>
        )}
      </div>

      {/* Supplementary Programme Section */}
      <div>
        <Card className="bg-card border-border border-2 border-purple-200/50">
          {/* Header with enrollment count */}
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground mb-1" data-testid="heading-supplementary-program">
              Supplementary Programmes
            </h2>
            <p className="text-sm text-muted-foreground">
              Add mobility programmes or injury protocols alongside your main training
            </p>
          </div>

          <CardContent className="p-6">
            {!Array.isArray(currentSupplementary) || currentSupplementary.length === 0 ? (
              /* Empty state */
              <div className="text-center py-8">
                <Plus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-2">No Programmes Enrolled</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Add a mobility programme or injury protocol to complement your main training.
                </p>
              </div>
            ) : (
              /* Grid of compact programme tiles */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentSupplementary.map((supp: any, index: number) => (
                  <div 
                    key={supp.id}
                    className="bg-background rounded-lg border border-border overflow-hidden hover:border-purple-400/50 transition-colors"
                    data-testid={`card-supplementary-program-${supp.id}`}
                  >
                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-foreground line-clamp-1 flex-1">
                          {supp.programTitle}
                        </h3>
                        <Badge className="bg-primary text-primary-foreground shrink-0 ml-2">
                          {index + 1}/3
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {formatGoal(supp.programGoal)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {supp.programWeeks} weeks
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Progress</span>
                          <span className="text-xs font-medium text-primary" data-testid={`text-supplementary-completion-${supp.id}`}>
                            {calculateCompletionPercentage(supp.workoutsCompleted, supp.totalWorkouts)}%
                          </span>
                        </div>
                        <Progress 
                          value={calculateCompletionPercentage(supp.workoutsCompleted, supp.totalWorkouts)} 
                          className="h-1.5"
                          data-testid={`progress-supplementary-completion-${supp.id}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {supp.workoutsCompleted}/{supp.totalWorkouts} workouts
                        </p>
                      </div>
                      
                      {/* Quick stats */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(supp.startDate), 'dd MMM')}
                        </div>
                        <span className="capitalize">{supp.programDifficulty}</span>
                      </div>
                      
                      <Button 
                        onClick={() => navigate(`/program-hub/${supp.id}`)}
                        size="sm"
                        className="w-full btn-primary"
                        data-testid={`button-view-supplementary-program-${supp.id}`}
                      >
                        View Programme
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduled/Upcoming Programmes Section */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1" data-testid="heading-scheduled-programs">
            Upcoming Programmes
          </h2>
          <p className="text-muted-foreground text-sm">
            Your scheduled training blocks and planned programmes
          </p>
        </div>

        {scheduledProgrammes.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Scheduled Programmes</h3>
              <p className="text-muted-foreground mb-4">
                Plan ahead by scheduling your next training programme or rest week.
              </p>
              <Button 
                onClick={() => navigate("/training/schedule-programme")}
                variant="outline"
                data-testid="button-schedule-first-program"
              >
                Schedule a Programme
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scheduledProgrammes.map((program: any, index: number) => (
              <Card 
                key={program.id} 
                className="hover:shadow-md transition-shadow relative"
                data-testid={`card-scheduled-program-${program.id}`}
              >
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/program-hub/${program.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Programme
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const d = new Date(program.startDate);
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        setRescheduleDate(iso);
                        setRescheduleEnrollment({ id: program.id, currentDate: iso });
                      }}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Edit Start Date
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setCancelEnrollmentId(program.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                      <img 
                        src={program.programImageUrl || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200"} 
                        alt={program.programTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-xs shrink-0 bg-primary text-primary-foreground border-0">
                          {formatGoal(program.programGoal)}
                        </Badge>
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-1.5">
                        {program.programTitle}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted border border-border rounded-md px-2 py-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(program.startDate), 'dd MMM yyyy')}</span>
                        </div>
                        {program.programWeeks && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted border border-border rounded-md px-2 py-1">
                            <Clock className="h-3 w-3" />
                            <span>{program.programWeeks} weeks</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground bg-muted border border-border rounded-md px-2 py-1 capitalize">
                          {program.programDifficulty}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Programme History Section */}
      {allCompletedProgrammes.length > 0 && (
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-neutral-dark mb-1" data-testid="heading-program-history">
                Programme History
              </h2>
              <p className="text-sm text-gray-600">
                Your completed programmes and achievements
              </p>
            </div>
            {(() => {
              const years = Array.from(new Set(allCompletedProgrammes.map((p: any) => {
                const d = p.endDate ? new Date(p.endDate) : new Date(p.startDate);
                return d.getFullYear();
              }))).sort((a: number, b: number) => b - a);
              return (
                <div className="flex gap-1">
                  <button
                    onClick={() => setHistoryYear(null)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${historyYear === null ? 'bg-[#0cc9a9] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    All
                  </button>
                  {years.map((year: number) => (
                    <button
                      key={year}
                      onClick={() => setHistoryYear(year)}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${historyYear === year ? 'bg-[#0cc9a9] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {allCompletedProgrammes
                  .filter((program: any) => {
                    if (!historyYear) return true;
                    const d = program.endDate ? new Date(program.endDate) : new Date(program.startDate);
                    return d.getFullYear() === historyYear;
                  })
                  .map((program: any) => {
                  const completionRate = calculateCompletionPercentage(program.workoutsCompleted, program.totalWorkouts);
                  const isSupplementary = program.programType === 'supplementary';
                  return (
                    <div 
                      key={program.id}
                      className="flex items-center justify-between py-3 border-b last:border-b-0 hover:bg-muted/50 rounded-lg px-3 -mx-3 transition-colors cursor-pointer"
                      onClick={() => navigate(`/programme-history/${program.id}`)}
                      data-testid={`history-item-${program.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground truncate">
                            {program.programTitle}
                          </h4>
                          {isSupplementary ? (
                            <Badge variant="outline" className="text-xs bg-purple-500/15 text-purple-400 border-purple-500/30">
                              Supplementary
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-400 border-blue-500/30">
                              Main
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>
                              {format(new Date(program.startDate), 'MMM dd')} - {program.endDate ? format(new Date(program.endDate), 'MMM dd, yyyy') : 'Present'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium">{program.workoutsCompleted}/{program.totalWorkouts} workouts</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <div className={`text-lg font-bold ${completionRate === 100 ? 'text-green-600' : 'text-[#0cc9a9]'}`}>
                            {completionRate}%
                          </div>
                          <div className="text-xs text-muted-foreground">complete</div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={rescheduleEnrollment !== null} onOpenChange={(open) => !open && setRescheduleEnrollment(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Start Date</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              id="start-date"
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              min={todayLocalStr()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRescheduleEnrollment(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!rescheduleDate || rescheduleMutation.isPending}
              onClick={() => rescheduleEnrollment && rescheduleMutation.mutate({ enrollmentId: rescheduleEnrollment.id, startDate: rescheduleDate })}
            >
              {rescheduleMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelEnrollmentId !== null} onOpenChange={(open) => !open && setCancelEnrollmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Programme?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the programme from your schedule. You can re-schedule it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep It</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelEnrollmentId && cancelScheduledMutation.mutate(cancelEnrollmentId)}
            >
              Cancel Programme
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
