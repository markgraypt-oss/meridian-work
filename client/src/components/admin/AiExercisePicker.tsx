import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw } from "lucide-react";
import type { ExerciseLibraryItem } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: ExerciseLibraryItem) => void;
}

export default function AiExercisePicker({ open, onOpenChange, onPick }: Props) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });

  const filtered = (data || []).filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-ai-exercise-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Swap exercise
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search exercise library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-exercise-search"
        />
        <ScrollArea className="h-[360px] border rounded-md p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading library…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No exercises match.</div>
          ) : (
            <ul className="space-y-1">
              {filtered.map(ex => (
                <li key={ex.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => { onPick(ex); onOpenChange(false); }}
                    data-testid={`button-pick-exercise-${ex.id}`}
                  >
                    <div>
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(ex.mainMuscle || []).join(", ")}
                        {ex.equipment?.length ? ` · ${ex.equipment.join(", ")}` : ""}
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
