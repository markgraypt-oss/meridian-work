import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, X, Pencil, Check } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, addWeeks } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { calculateWeightLossPlan } from "@shared/weightLossCalculator";
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

type Milestone = { targetValue: string; dueDate: string; unit: string };

export default function GoalsBodyweightEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const goalId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("kg");
  const [deadline, setDeadline] = useState("");
  const [selectedPace, setSelectedPace] = useState<"aggressive" | "moderate" | "lifestyleFriendly" | "ownPace" | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [editingMilestoneIdx, setEditingMilestoneIdx] = useState<number | null>(null);
  const [editMilestoneTarget, setEditMilestoneTarget] = useState("");
  const [editMilestoneDate, setEditMilestoneDate] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: goal, isLoading } = useQuery<Goal>({
    queryKey: [`/api/goals/${goalId}`],
    enabled: !!goalId,
  });

  const { data: existingMilestones = [] } = useQuery<Array<{ id: number; targetValue: number; dueDate: string; unit: string | null }>>({
    queryKey: [`/api/goals/${goalId}/milestones`],
    enabled: !!goalId,
  });

  useEffect(() => {
    if (goal) {
      setTargetValue(goal.targetValue?.toString() || "");
      setCurrentValue(goal.currentValue?.toString() || "");
      setUnit(goal.unit || "kg");
      setDeadline(goal.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd") : "");
      setSelectedPace("ownPace");
    }
  }, [goal]);

  useEffect(() => {
    if (existingMilestones.length > 0) {
      setMilestones(existingMilestones.map(m => {
        let formattedDate = "";
        try {
          if (m.dueDate) {
            const dateStr = typeof m.dueDate === 'string' ? m.dueDate : String(m.dueDate);
            if (dateStr.includes('T')) {
              formattedDate = dateStr.split('T')[0];
            } else {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                formattedDate = format(d, "yyyy-MM-dd");
              }
            }
          }
        } catch {
          formattedDate = "";
        }
        return {
          targetValue: m.targetValue.toString(),
          dueDate: formattedDate,
          unit: m.unit || unit,
        };
      }));
    }
  }, [existingMilestones, unit]);

  const generateMilestones = (weeks: number, startWeight: number, targetWeight: number, selectedUnit: string) => {
    let numMilestones: number;
    if (weeks < 8) {
      numMilestones = 2;
    } else if (weeks <= 16) {
      numMilestones = Math.max(3, Math.ceil(weeks / 4));
    } else if (weeks <= 32) {
      numMilestones = Math.ceil(weeks / 4);
    } else {
      numMilestones = Math.ceil(weeks / 4.33);
    }
    numMilestones = Math.min(numMilestones, 12);
    
    const weightToLose = startWeight - targetWeight;
    const weightPerMilestone = weightToLose / (numMilestones + 1);
    const weeksPerMilestone = weeks / (numMilestones + 1);
    
    const newMilestones: Milestone[] = [];
    
    for (let i = 1; i <= numMilestones; i++) {
      const milestoneWeight = startWeight - (weightPerMilestone * i);
      const milestoneWeeks = Math.round(weeksPerMilestone * i);
      const milestoneDate = addWeeks(new Date(), milestoneWeeks);
      
      newMilestones.push({
        targetValue: milestoneWeight.toFixed(1),
        dueDate: format(milestoneDate, "yyyy-MM-dd"),
        unit: selectedUnit
      });
    }
    
    return newMilestones;
  };

  const weightLossPlan = (() => {
    const start = parseFloat(currentValue);
    const target = parseFloat(targetValue);
    if (!start || !target || start <= target) return null;
    return calculateWeightLossPlan(start, target);
  })();

  const handlePaceSelect = (pace: "aggressive" | "moderate" | "lifestyleFriendly" | "ownPace") => {
    setSelectedPace(pace);
    
    if (pace === "ownPace") {
      return;
    }
    
    if (weightLossPlan) {
      const paceData = weightLossPlan[pace];
      const weeks = Math.round(paceData.weeksMidEstimate);
      setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
      
      const start = parseFloat(currentValue);
      const target = parseFloat(targetValue);
      const generated = generateMilestones(weeks, start, target, unit);
      setMilestones(generated);
    }
  };

  const handleEditMilestone = (idx: number) => {
    setEditingMilestoneIdx(idx);
    setEditMilestoneTarget(milestones[idx].targetValue);
    setEditMilestoneDate(milestones[idx].dueDate);
  };

  const handleSaveMilestoneEdit = () => {
    if (editingMilestoneIdx !== null) {
      const updated = [...milestones];
      updated[editingMilestoneIdx] = {
        ...updated[editingMilestoneIdx],
        targetValue: editMilestoneTarget,
        dueDate: editMilestoneDate,
      };
      setMilestones(updated);
      setEditingMilestoneIdx(null);
    }
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const target = parseFloat(targetValue);
      const current = parseFloat(currentValue);
      
      if (!target || target <= 0) {
        throw new Error("Please enter a valid target weight");
      }
      if (!current || current <= 0) {
        throw new Error("Please enter a valid current weight");
      }
      
      const goalData = {
        targetValue: target,
        currentValue: current,
        unit,
        deadline: deadline || null,
      };
      
      return await apiRequest("PATCH", `/api/goals/${goalId}`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Success", description: "Bodyweight goal updated!" });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update goal", variant: "destructive" });
    },
  });

  const handleSaveClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    setShowConfirmDialog(false);
    mutation.mutate();
  };

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
        title="Edit Bodyweight Goal"
        onBack={() => setLocation("/goals")}
      />

      <div className="px-6 py-4 pb-32 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Current Weight</Label>
            <Input
              type="number"
              step="0.1"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="80"
              data-testid="input-current"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Target Weight</Label>
            <Input
              type="number"
              step="0.1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="75"
              data-testid="input-target"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Unit</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger data-testid="select-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lbs">lbs</SelectItem>
              </SelectContent>
            </Select>
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

        {weightLossPlan && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Choose Your Pace</Label>
              <span className="text-xs text-muted-foreground">{weightLossPlan.totalToLose}{unit} to lose</span>
            </div>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handlePaceSelect("aggressive")}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedPace === "aggressive"
                    ? "border-red-500 bg-red-500/10 ring-1 ring-red-500"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid="pace-aggressive"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-red-500">Aggressive</div>
                    <div className="text-xs text-muted-foreground">{weightLossPlan.aggressive.weeksFastEstimate}-{weightLossPlan.aggressive.weeksSlowEstimate} weeks</div>
                  </div>
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">~1% body weight/week</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePaceSelect("moderate")}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedPace === "moderate"
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid="pace-moderate"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-[#0cc9a9]">Moderate</div>
                    <div className="text-xs text-muted-foreground">{weightLossPlan.moderate.weeksFastEstimate}-{weightLossPlan.moderate.weeksSlowEstimate} weeks</div>
                  </div>
                  <span className="text-xs bg-[#0cc9a9]/20 text-[#0cc9a9] px-2 py-1 rounded">0.5-0.75kg/week</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePaceSelect("lifestyleFriendly")}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedPace === "lifestyleFriendly"
                    ? "border-green-500 bg-green-500/10 ring-1 ring-green-500"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid="pace-lifestyle"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-green-500">Lifestyle Friendly</div>
                    <div className="text-xs text-muted-foreground">{weightLossPlan.lifestyleFriendly.weeksFastEstimate}-{weightLossPlan.lifestyleFriendly.weeksSlowEstimate} weeks</div>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">0.25-0.5kg/week</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePaceSelect("ownPace")}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedPace === "ownPace"
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid="pace-own"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-[#0cc9a9]">Set My Own Pace</div>
                    <div className="text-xs text-muted-foreground">Choose your own deadline</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Milestones</Label>
              <span className="text-xs text-muted-foreground">{milestones.length} checkpoints</span>
            </div>
            
            <div className="space-y-2">
              {milestones.map((m, idx) => {
                let displayDate = m.dueDate;
                try {
                  const d = new Date(m.dueDate);
                  if (!isNaN(d.getTime())) {
                    displayDate = formatDate(d, "short");
                  }
                } catch {
                  displayDate = m.dueDate;
                }
                
                if (editingMilestoneIdx === idx) {
                  return (
                    <div key={idx} className="p-3 bg-muted/50 rounded space-y-2" data-testid={`milestone-edit-${idx}`}>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          value={editMilestoneTarget}
                          onChange={(e) => setEditMilestoneTarget(e.target.value)}
                          className="h-9"
                          data-testid={`input-edit-milestone-target-${idx}`}
                        />
                        <Input
                          type="date"
                          value={editMilestoneDate}
                          onChange={(e) => setEditMilestoneDate(e.target.value)}
                          className="h-9"
                          data-testid={`input-edit-milestone-date-${idx}`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveMilestoneEdit}
                          className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                          data-testid={`button-save-milestone-${idx}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingMilestoneIdx(null)}
                          data-testid={`button-cancel-milestone-${idx}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded"
                    data-testid={`milestone-${idx}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{m.targetValue}{m.unit}</div>
                      <div className="text-xs text-muted-foreground">{displayDate}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEditMilestone(idx)}
                        data-testid={`button-edit-milestone-${idx}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => handleRemoveMilestone(idx)}
                        data-testid={`button-remove-milestone-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border pb-24">
          <Button
            onClick={handleSaveClick}
            disabled={mutation.isPending || !targetValue || !currentValue}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
            data-testid="button-save"
          >
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#0cc9a9]" />
              Confirm Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update your bodyweight goal? This will change your target weight and milestones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
