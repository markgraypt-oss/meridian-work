import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function GoalsCustomEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const goalId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");

  const { data: goal, isLoading } = useQuery<Goal>({
    queryKey: ["/api/goals", goalId],
    enabled: !!goalId,
  });

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || "");
      setDescription(goal.description || "");
      setStartDate(goal.startDate ? format(new Date(goal.startDate), "yyyy-MM-dd") : "");
      setDeadline(goal.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd") : "");
    }
  }, [goal]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("Please enter a goal title");
      }
      
      const goalData = {
        title: title.trim(),
        description: description.trim() || null,
        startDate: startDate || null,
        deadline: deadline || null,
      };
      
      return await apiRequest("PATCH", `/api/goals/${goalId}`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Success", description: "Goal updated!" });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update goal", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopHeader 
        title="Edit Goal"
        onBack={() => setLocation("/goals")}
      />

      <div className="px-6 py-4 pb-32 space-y-6">
        <div className="space-y-2">
          <Label className="text-sm">Goal Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My goal"
            data-testid="input-title"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Description (Optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your goal..."
            rows={3}
            data-testid="input-description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-start-date"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Deadline</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="input-deadline"
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border pb-24">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim()}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
            data-testid="button-save"
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
