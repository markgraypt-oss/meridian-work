import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Calendar, Clock, Dumbbell, Target } from "lucide-react";

interface RecoveryPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recoveryPlanId: number;
  recoveryProgrammeId: number | null;
  onDecision: (decision: 'accepted' | 'declined') => void;
  isDecisionPending?: boolean;
}

export function RecoveryPlanDialog({ 
  open, 
  onOpenChange, 
  recoveryPlanId, 
  recoveryProgrammeId,
  onDecision,
  isDecisionPending = false
}: RecoveryPlanDialogProps) {
  const { toast } = useToast();

  // Fetch recovery programme details
  const { data: programme, isLoading: programmeLoading } = useQuery<{
    id: number;
    title: string;
    description: string;
    weeks: number;
    trainingDaysPerWeek: number;
    duration: number;
    difficulty: string;
    imageUrl?: string;
    goal?: string;
    equipment?: string;
  }>({
    queryKey: [`/api/programs/${recoveryProgrammeId}`],
    enabled: open && !!recoveryProgrammeId,
  });

  // Fetch programme workouts
  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<any[]>({
    queryKey: [`/api/programs/${recoveryProgrammeId}/workouts`],
    enabled: open && !!recoveryProgrammeId,
  });

  const isLoading = programmeLoading || workoutsLoading;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!programme) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recovery Programme</DialogTitle>
            <DialogDescription>Programme details not available.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Get unique workouts for the schedule display
  const uniqueWorkouts = workouts.reduce((acc: any[], workout: any) => {
    if (!acc.find(w => w.name === workout.name)) {
      acc.push(workout);
    }
    return acc;
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner': return 'bg-green-500/20 text-green-400';
      case 'intermediate': return 'bg-[#0cc9a9]/20 text-[#0cc9a9]';
      case 'advanced': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-recovery-programme">
        <DialogHeader>
          <DialogTitle className="text-xl">{programme.title}</DialogTitle>
          <DialogDescription>
            A recovery programme tailored to help address your discomfort
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Programme Overview Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">{programme.weeks} weeks</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Frequency</p>
                <p className="font-medium">{programme.trainingDaysPerWeek}x per week</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Dumbbell className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Workouts</p>
                <p className="font-medium">{workouts.length} total</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Session</p>
                <p className="font-medium">{programme.duration} min</p>
              </div>
            </div>
          </div>

          {/* Difficulty Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Difficulty:</span>
            <Badge className={getDifficultyColor(programme.difficulty)}>
              {programme.difficulty}
            </Badge>
          </div>

          {/* Description */}
          {programme.description && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{programme.description}</p>
            </div>
          )}

          {/* Workout Schedule Preview */}
          {uniqueWorkouts.length > 0 && (
            <Card className="border-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Programme Workouts</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {uniqueWorkouts.slice(0, 5).map((workout: any, index: number) => (
                    <li key={index} className="flex items-center gap-2 text-sm min-w-0">
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="truncate">{workout.name}</span>
                    </li>
                  ))}
                  {uniqueWorkouts.length > 5 && (
                    <li className="text-sm text-muted-foreground">
                      +{uniqueWorkouts.length - 5} more workouts
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons - Accept/Decline */}
        <div className="flex gap-3 pt-4 border-t mt-4">
          <Button
            variant="outline"
            onClick={() => onDecision('declined')}
            disabled={isDecisionPending}
            className="flex-1"
            data-testid="button-decline-programme"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Decline
          </Button>
          <Button
            onClick={() => onDecision('accepted')}
            disabled={isDecisionPending}
            className="flex-1"
            data-testid="button-accept-programme"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isDecisionPending ? "..." : "Accept"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
