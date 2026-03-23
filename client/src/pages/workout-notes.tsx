import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronLeft, Brain } from "lucide-react";

export default function WorkoutNotes() {
  const { logId } = useParams<{ logId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const { data: workoutLog, isLoading } = useQuery<{ id: number; workoutName: string; notes: string | null }>({
    queryKey: ['/api/workout-logs', logId],
    enabled: !!logId,
  });

  useEffect(() => {
    if (workoutLog?.notes) {
      setNotes(workoutLog.notes);
    }
  }, [workoutLog]);

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/workout-logs/${logId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs', logId] });
      toast({ title: "Notes saved" });
      navigate(`/active-workout/${logId}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notes", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate(`/active-workout/${logId}`)}
            className="flex items-center gap-1 text-foreground"
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          
          <h1 className="font-semibold">Coaching Notes</h1>
          
          <Button
            onClick={() => saveNotesMutation.mutate()}
            disabled={saveNotesMutation.isPending}
            size="sm"
            data-testid="button-save-notes"
          >
            {saveNotesMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-muted/40 border border-border">
          <Brain className="w-5 h-5 text-[#0cc9a9] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Your notes here are shared with your AI Coach. Log anything useful: how the session felt, pain or tightness, weight adjustments, exercises you want to swap. The more detail you add, the better your future recommendations become.
          </p>
        </div>
        
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Shoulder felt tight on overhead press, dropped weight by 5kg. Swapped barbell row for cable row. Energy was low today, probably need more sleep..."
          className="min-h-[300px] resize-none"
          data-testid="input-notes"
        />
      </div>
    </div>
  );
}
