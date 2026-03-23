import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ExerciseSearchInputProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const ExerciseSearchInput = memo(function ExerciseSearchInput({
  searchQuery,
  onSearchChange,
}: ExerciseSearchInputProps) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
          data-testid="input-exercise-search"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            data-testid="button-search-hints"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-foreground">Search by keywords or shortcuts</h4>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground font-medium">Exercise names:</p>
                <p className="text-xs text-muted-foreground pl-2">e.g., "Shoulder", "Dumbbell", "Push"</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Muscle groups:</p>
                <p className="text-xs text-muted-foreground pl-2">e.g., "Chest", "Biceps", "Glutes"</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Equipment:</p>
                <p className="text-xs text-muted-foreground pl-2">e.g., "Barbell", "Cable", "Bodyweight"</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Movement type:</p>
                <p className="text-xs text-muted-foreground pl-2">e.g., "Pull", "Core", "Cardio"</p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

export default ExerciseSearchInput;
