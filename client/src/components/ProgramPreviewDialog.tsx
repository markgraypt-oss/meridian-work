import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Dumbbell, Calendar, Target, Users, Heart } from "lucide-react";
import { useLocation } from "wouter";
import type { Programme } from "@shared/schema";

interface ProgrammePreviewDialogProps {
  program: Programme | null;
  isOpen: boolean;
  onClose: () => void;
  onEnroll?: (programId: number, programType?: 'main' | 'supplementary') => void;
  isEnrolling?: boolean;
  onViewDetails?: (programId: number) => void;
  onToggleFavourite?: (programId: number) => void;
  isFavourited?: (programId: number) => boolean;
}

const goalLabels: Record<string, string> = {
  power: "Power",
  max_strength: "Max Strength",
  conditioning: "Conditioning",
  hiit: "HIIT",
  muscular_endurance: "Muscular Endurance",
  active_recovery: "Active Recovery",
  mobility_stretching: "Mobility/Stretching",
  recovery: "Recovery",
  hypertrophy: "Hypertrophy",
  general_strength: "General Strength",
  corrective_exercises: "Corrective Exercises",
  mobility: "Mobility",
  yoga: "Yoga",
};

const equipmentLabels: Record<string, string> = {
  home_gym: "Home Gym",
  full_gym: "Full Gym",
  bodyweight: "Bodyweight",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function ProgrammePreviewDialog({
  program,
  isOpen,
  onClose,
  onEnroll,
  isEnrolling = false,
  onViewDetails,
  onToggleFavourite,
  isFavourited,
}: ProgrammePreviewDialogProps) {
  const [, navigate] = useLocation();

  if (!program) return null;

  const handleEnroll = (programType: 'main' | 'supplementary' = 'main') => {
    if (onEnroll) {
      onEnroll(program.id, programType);
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(program.id);
    } else {
      navigate(`/training/programme/${program.id}`);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-program-preview">
        <div className="flex items-start justify-between mb-4">
          <DialogHeader className="flex-1">
            <DialogTitle className="text-2xl" data-testid="text-preview-title">
              {program.title}
            </DialogTitle>
          </DialogHeader>
          {onToggleFavourite && (
            <button
              onClick={() => onToggleFavourite(program.id)}
              className="p-2 hover:bg-accent rounded-full transition-colors flex-shrink-0"
              data-testid={`button-favorite-program-${program.id}`}
            >
              <Heart
                className={`h-6 w-6 transition-colors ${
                  isFavourited?.(program.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
              />
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Goal</h3>
              <Badge variant="secondary" data-testid="badge-preview-goal">
                <Target className="w-3 h-3 mr-1" />
                {goalLabels[program.goal] || program.goal}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
              <p className="text-sm" data-testid="text-preview-description">
                {program.description}
              </p>
            </div>

            {program.whoItsFor && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Who It's For</h3>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <p className="text-sm" data-testid="text-preview-who-its-for">
                    {program.whoItsFor}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Difficulty</h3>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      program.difficulty === "beginner"
                        ? "default"
                        : program.difficulty === "intermediate"
                        ? "secondary"
                        : "destructive"
                    }
                    data-testid="badge-preview-difficulty"
                  >
                    {difficultyLabels[program.difficulty] || program.difficulty}
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Equipment</h3>
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-preview-equipment">
                    {equipmentLabels[program.equipment] || program.equipment}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Duration</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-preview-duration">
                    {program.weeks} {program.weeks === 1 ? "week" : "weeks"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Workouts Per Week</h3>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-preview-workouts-per-week">
                    {program.trainingDaysPerWeek} workouts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isEnrolling}
            data-testid="button-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleViewDetails}
            disabled={isEnrolling}
            data-testid="button-preview-enroll"
          >
            {isEnrolling ? "Opening..." : "View Programme Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
