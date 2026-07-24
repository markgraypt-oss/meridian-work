import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trophy } from "lucide-react";

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

