import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Flame, Medal, Star, PartyPopper, Zap } from "lucide-react";

interface WorkoutRatingDialogProps {
  open: boolean;
  onComplete: (rating: number, notes?: string) => void;
  isPending?: boolean;
}

const RATING_LABELS: Record<number, { label: string; colour: string; description: string }> = {
  1: { label: "1", colour: "#22c55e", description: "Effortless" },
  2: { label: "2", colour: "#4ade80", description: "Very Easy" },
  3: { label: "3", colour: "#86efac", description: "Easy" },
  4: { label: "4", colour: "#fde047", description: "Moderate" },
  5: { label: "5", colour: "#0cc9a9", description: "Somewhat Hard" },
  6: { label: "6", colour: "#0cc9a9", description: "Hard" },
  7: { label: "7", colour: "#f97316", description: "Very Hard" },
  8: { label: "8", colour: "#ef4444", description: "Extremely Hard" },
  9: { label: "9", colour: "#dc2626", description: "Maximum Effort" },
  10: { label: "10", colour: "#991b1b", description: "Beyond Hard" },
};

export default function WorkoutRatingDialog({ open, onComplete, isPending }: WorkoutRatingDialogProps) {
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");

  const currentRating = RATING_LABELS[rating];

  const handleRatingChange = (newRating: number) => {
    setRating(Math.max(1, Math.min(10, newRating)));
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-card border-border" data-testid="dialog-workout-rating">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold text-foreground">
            Rate Your Workout
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative w-48 h-48">
            <svg 
              viewBox="0 0 200 200" 
              className="w-full h-full transform -rotate-90"
            >
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke={currentRating.colour}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(rating / 10) * 534} 534`}
                className="transition-all duration-300"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span 
                className="text-5xl font-bold transition-colors duration-300"
                style={{ color: currentRating.colour }}
                data-testid="text-rating-value"
              >
                {rating}
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                {currentRating.description}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full px-4">
            <span className="text-xs text-green-500 font-medium">Easy</span>
            <input
              type="range"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => handleRatingChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              style={{
                background: `linear-gradient(to right, #22c55e 0%, #0cc9a9 50%, #dc2626 100%)`,
              }}
              data-testid="slider-workout-rating"
            />
            <span className="text-xs text-red-500 font-medium">Hard</span>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                onClick={() => handleRatingChange(num)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  rating === num
                    ? "ring-2 ring-offset-2 ring-offset-card"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: RATING_LABELS[num].colour,
                  color: num <= 3 ? "#000" : "#fff",
                  ...(rating === num && { "--tw-ring-color": RATING_LABELS[num].colour } as React.CSSProperties),
                }}
                data-testid={`button-rating-${num}`}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="w-full space-y-2">
            <label className="text-sm text-muted-foreground">
              Workout notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did you feel? Any observations..."
              className="resize-none bg-background"
              rows={3}
              data-testid="textarea-workout-notes"
            />
          </div>

          <Button
            onClick={() => onComplete(rating, notes || undefined)}
            disabled={isPending}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9] text-black font-medium h-12"
            data-testid="button-complete-workout"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Complete Workout
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WorkoutCelebrationProps {
  open: boolean;
  onClose: () => void;
  summary: {
    totalVolume: number;
    totalTimeSeconds: number;
    durationSeconds: number;
    exerciseCount: number;
    workoutRating: number;
  };
  prs: Array<{
    type: 'weight' | 'reps' | 'volume' | 'first';
    exerciseName: string;
    value?: number;
    previous?: number;
    reps?: number;
    weight?: number;
  }>;
  workoutName: string;
}

export function WorkoutCelebration({ open, onClose, summary, prs, workoutName }: WorkoutCelebrationProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatVolume = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${kg.toFixed(0)}kg`;
  };

  const hasPRs = prs.filter(pr => pr.type !== 'first').length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border overflow-hidden" data-testid="dialog-workout-celebration">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#0cc9a9]/20 to-transparent" />
        </div>

        <div className="flex flex-col items-center gap-4 py-4 relative z-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0cc9a9] to-[#0cc9a9] flex items-center justify-center">
            <PartyPopper className="w-10 h-10 text-black" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Workout Complete!
            </h2>
            <p className="text-muted-foreground mt-1">
              {workoutName}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full mt-2">
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <Flame className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-lg font-bold text-foreground">
                {formatDuration(summary.durationSeconds)}
              </span>
              <span className="text-xs text-muted-foreground">Duration</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <Zap className="w-5 h-5 text-blue-500 mb-1" />
              <span className="text-lg font-bold text-foreground">
                {summary.exerciseCount}
              </span>
              <span className="text-xs text-muted-foreground">Exercises</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
              <Medal className="w-5 h-5 text-[#0cc9a9] mb-1" />
              <span className="text-lg font-bold text-foreground">
                {formatVolume(summary.totalVolume)}
              </span>
              <span className="text-xs text-muted-foreground">Volume</span>
            </div>
          </div>

          {hasPRs && (
            <div className="w-full mt-2">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-[#0cc9a9]" />
                <span className="font-medium text-foreground">New Personal Records!</span>
              </div>
              <div className="space-y-2">
                {prs.filter(pr => pr.type !== 'first').slice(0, 3).map((pr, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 bg-[#0cc9a9]/10 rounded-lg border border-[#0cc9a9]/30"
                  >
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#0cc9a9]" />
                      <span className="text-sm text-foreground truncate max-w-40">
                        {pr.exerciseName}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-[#0cc9a9]">
                      {pr.type === 'weight' && `${pr.value}kg`}
                      {pr.type === 'reps' && `${pr.value} reps`}
                      {pr.type === 'volume' && `${pr.value}kg vol`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Effort rating:</span>
            <div 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: RATING_LABELS[summary.workoutRating]?.colour || '#666',
                color: summary.workoutRating <= 3 ? '#000' : '#fff'
              }}
            >
              {summary.workoutRating}/10
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-12"
            data-testid="button-close-celebration"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
