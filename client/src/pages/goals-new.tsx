import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale, TrendingUp, Target, ListChecks, Plus, X, Check, Pencil } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, addWeeks } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { calculateWeightLossPlan } from "@shared/weightLossCalculator";


export default function GoalsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();
  
  const [goalType, setGoalType] = useState<"bodyweight" | "custom" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("kg");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<Array<{targetValue: string; dueDate: string; unit: string}>>([]);
  const [milestoneTarget, setMilestoneTarget] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneUnit, setMilestoneUnit] = useState("kg");
  const [selectedPace, setSelectedPace] = useState<"aggressive" | "moderate" | "lifestyleFriendly" | "ownPace" | null>(null);
  const [suggestedMilestones, setSuggestedMilestones] = useState<Array<{targetValue: string; dueDate: string; unit: string}>>([]);
  const [milestonesAccepted, setMilestonesAccepted] = useState<boolean | null>(null);
  const [editingMilestoneIdx, setEditingMilestoneIdx] = useState<number | null>(null);
  const [editMilestoneTarget, setEditMilestoneTarget] = useState("");
  const [editMilestoneDate, setEditMilestoneDate] = useState("");

  const { data: latestBodyweight } = useQuery<{ weight: number; unit: string } | null>({
    queryKey: ["/api/progress/bodyweight/latest"],
  });

  const { data: existingGoals = [] } = useQuery<any[]>({
    queryKey: ["/api/goals"],
  });
  const hasNutritionGoal = existingGoals.some(g => g.type === 'nutrition' && !g.isCompleted);
  const hasBodyweightGoal = existingGoals.some(g => g.type === 'bodyweight' && !g.isCompleted);

  useEffect(() => {
    if (latestBodyweight) {
      setCurrentValue(latestBodyweight.weight.toString());
      setUnit(latestBodyweight.unit || "kg");
    }
  }, [latestBodyweight]);

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
    
    const newMilestones: Array<{targetValue: string; dueDate: string; unit: string}> = [];
    
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

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest("POST", "/api/goals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Goal created",
        description: "Your goal has been created successfully",
      });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create goal",
        variant: "destructive",
      });
    },
  });

  const handleAddMilestone = () => {
    if (milestoneTarget && milestoneDate) {
      setMilestones(prev => [...prev, { 
        targetValue: milestoneTarget, 
        dueDate: milestoneDate, 
        unit: milestoneUnit 
      }]);
      setMilestoneTarget("");
      setMilestoneDate("");
    }
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const payload: any = {
      type: goalType,
      title: goalType === "bodyweight" 
        ? `Reach ${targetValue}${unit}` 
        : title,
      description: description || null,
      startDate: startDate || null,
      deadline: deadline || null,
      milestones: milestones.map(m => ({
        targetValue: m.targetValue,
        dueDate: m.dueDate,
        unit: m.unit,
      })),
    };

    if (goalType === "bodyweight") {
      payload.targetValue = parseFloat(targetValue) || null;
      payload.currentValue = parseFloat(currentValue) || null;
      payload.unit = unit;
      payload.startingValue = parseFloat(currentValue) || null;
    }

    mutation.mutate(payload);
  };

  const handleBack = () => {
    if (goalType) {
      setGoalType(null);
    } else {
      setLocation("/goals");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader 
        title={!goalType ? "Choose Goal Type" : goalType === "bodyweight" ? "Bodyweight Goal" : "Custom Goal"}
        onBack={handleBack}
      />

      <div className="pb-32">
        {!goalType && (
          <p className="text-muted-foreground text-sm text-center py-3 border-t border-border">
            Select the type of goal you want to create
          </p>
        )}
        <div className="px-6">
        {!goalType ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => !hasBodyweightGoal && setGoalType("bodyweight")}
              disabled={hasBodyweightGoal}
              className={`w-full p-6 rounded-xl flex items-center gap-4 transition-all shadow-sm border ${
                hasBodyweightGoal
                  ? "bg-muted/50 border-border cursor-not-allowed opacity-60"
                  : "bg-white dark:bg-card hover:shadow-md hover:border-[#0cc9a9] border-border"
              }`}
              data-testid="button-goal-type-bodyweight"
            >
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${hasBodyweightGoal ? "bg-muted" : "bg-[#0cc9a9]/10"}`}>
                <Scale className={`h-6 w-6 ${hasBodyweightGoal ? "text-muted-foreground" : "text-[#0cc9a9]"}`} />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Bodyweight Goal</span>
                  {hasBodyweightGoal && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {hasBodyweightGoal ? "You already have an active bodyweight goal" : "Set a target weight with milestones"}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => !hasNutritionGoal && setLocation("/goals/nutrition/new")}
              disabled={hasNutritionGoal}
              className={`w-full p-6 rounded-xl flex items-center gap-4 transition-all shadow-sm border ${
                hasNutritionGoal
                  ? "bg-muted/50 border-border cursor-not-allowed opacity-60"
                  : "bg-white dark:bg-card hover:shadow-md hover:border-[#0cc9a9] border-border"
              }`}
              data-testid="button-goal-type-nutrition"
            >
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${hasNutritionGoal ? "bg-muted" : "bg-green-500/10"}`}>
                <TrendingUp className={`h-6 w-6 ${hasNutritionGoal ? "text-muted-foreground" : "text-green-500"}`} />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Nutrition Goal</span>
                  {hasNutritionGoal && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {hasNutritionGoal ? "You already have an active nutrition goal" : "Calculate calories and set macro targets"}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLocation("/goals/habits")}
              className="w-full p-6 bg-white dark:bg-card rounded-xl flex items-center gap-4 transition-all shadow-sm hover:shadow-md hover:border-[#0cc9a9] border border-border"
              data-testid="button-goal-type-habits"
            >
              <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                <ListChecks className="h-6 w-6 text-violet-500" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold">Goal Templates</div>
                <div className="text-sm text-muted-foreground">Pick from a curated set of proven goals</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGoalType("custom")}
              className="w-full p-6 bg-white dark:bg-card rounded-xl flex items-center gap-4 transition-all shadow-sm hover:shadow-md hover:border-[#0cc9a9] border border-border"
              data-testid="button-goal-type-custom"
            >
              <div className="h-12 w-12 rounded-full bg-[#0cc9a9]/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-[#0cc9a9]" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold">Custom Goal</div>
                <div className="text-sm text-muted-foreground">Create your own goal from templates</div>
              </div>
            </button>
          </div>
        ) : goalType === "bodyweight" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Current Weight</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="80"
                  data-testid="input-current-weight"
                />
              </div>
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
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Target Weight</Label>
              <Input
                type="number"
                step="0.1"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="75"
                data-testid="input-target-weight"
              />
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
                    onClick={() => {
                      setSelectedPace("aggressive");
                      const weeks = Math.round(weightLossPlan.aggressive.weeksMidEstimate);
                      setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                      const start = parseFloat(currentValue);
                      const target = parseFloat(targetValue);
                      const generated = generateMilestones(weeks, start, target, unit);
                      setSuggestedMilestones(generated);
                      setMilestonesAccepted(null);
                    }}
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
                    onClick={() => {
                      setSelectedPace("moderate");
                      const weeks = Math.round(weightLossPlan.moderate.weeksMidEstimate);
                      setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                      const start = parseFloat(currentValue);
                      const target = parseFloat(targetValue);
                      const generated = generateMilestones(weeks, start, target, unit);
                      setSuggestedMilestones(generated);
                      setMilestonesAccepted(null);
                    }}
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
                    onClick={() => {
                      setSelectedPace("lifestyleFriendly");
                      const weeks = Math.round(weightLossPlan.lifestyleFriendly.weeksMidEstimate);
                      setDeadline(format(addWeeks(new Date(), weeks), "yyyy-MM-dd"));
                      const start = parseFloat(currentValue);
                      const target = parseFloat(targetValue);
                      const generated = generateMilestones(weeks, start, target, unit);
                      setSuggestedMilestones(generated);
                      setMilestonesAccepted(null);
                    }}
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
                    onClick={() => {
                      setSelectedPace("ownPace");
                      setDeadline("");
                      setSuggestedMilestones([]);
                      setMilestonesAccepted(null);
                    }}
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

            {selectedPace === "ownPace" && (
              <div className="space-y-2">
                <Label className="text-sm">Your Deadline</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  data-testid="input-deadline"
                />
              </div>
            )}

            {suggestedMilestones.length > 0 && milestonesAccepted === null && (
              <div className="space-y-3 pt-3 border-t border-[#0cc9a9]/30 bg-[#0cc9a9]/5 -mx-6 px-6 py-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-[#0cc9a9]">Suggested Milestones</Label>
                  <span className="text-xs text-muted-foreground">{suggestedMilestones.length} checkpoints</span>
                </div>
                
                <div className="space-y-2">
                  {suggestedMilestones.map((m, idx) => {
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
                        <div key={idx} className="p-3 bg-muted/50 rounded space-y-2" data-testid={`suggested-milestone-edit-${idx}`}>
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
                              type="button"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const updated = [...suggestedMilestones];
                                updated[idx] = {
                                  ...updated[idx],
                                  targetValue: editMilestoneTarget,
                                  dueDate: editMilestoneDate
                                };
                                setSuggestedMilestones(updated);
                                setEditingMilestoneIdx(null);
                              }}
                              data-testid={`button-save-milestone-${idx}`}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setEditingMilestoneIdx(null)}
                              data-testid={`button-cancel-edit-${idx}`}
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
                        className="flex items-center justify-between p-3 bg-muted/50 rounded text-sm"
                        data-testid={`suggested-milestone-${idx}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="bg-[#0cc9a9] text-black px-2 py-0.5 rounded text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <span>{m.targetValue}{m.unit} by {displayDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingMilestoneIdx(idx);
                              setEditMilestoneTarget(m.targetValue);
                              setEditMilestoneDate(m.dueDate);
                            }}
                            data-testid={`button-edit-milestone-${idx}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500"
                            onClick={() => {
                              const updated = suggestedMilestones.filter((_, i) => i !== idx);
                              setSuggestedMilestones(updated);
                              if (updated.length === 0) {
                                setMilestonesAccepted(false);
                              }
                            }}
                            data-testid={`button-remove-suggested-${idx}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
                    onClick={() => {
                      setMilestones(suggestedMilestones);
                      setMilestonesAccepted(true);
                    }}
                    data-testid="button-accept-milestones"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setMilestonesAccepted(false);
                      setSuggestedMilestones([]);
                    }}
                    data-testid="button-decline-milestones"
                  >
                    <X className="h-4 w-4 mr-1" />
                    No Thanks
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about your goal..."
                rows={2}
                data-testid="textarea-description"
              />
            </div>

            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-medium">Milestones (Optional)</Label>
              
              <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Target (e.g., 85)"
                    value={milestoneTarget}
                    onChange={(e) => setMilestoneTarget(e.target.value)}
                    data-testid="input-milestone-target"
                  />
                  <Select value={milestoneUnit} onValueChange={setMilestoneUnit}>
                    <SelectTrigger data-testid="select-milestone-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  data-testid="input-milestone-date"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddMilestone}
                  disabled={!milestoneTarget || !milestoneDate}
                  className="w-full"
                  data-testid="button-add-milestone"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              </div>

              {milestones.length > 0 && (
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
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded text-sm"
                        data-testid={`milestone-${idx}`}
                      >
                        <span>{m.targetValue} {m.unit} by {displayDate}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500"
                          onClick={() => handleRemoveMilestone(idx)}
                          data-testid={`button-remove-milestone-${idx}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !currentValue || !targetValue}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
              data-testid="button-create-goal"
            >
              {mutation.isPending ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm">Goal Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Run a marathon"
                data-testid="input-goal-title"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about your goal..."
                rows={3}
                data-testid="textarea-description"
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
                <Label className="text-sm">Deadline (Optional)</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  data-testid="input-deadline"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={mutation.isPending || !title}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
              data-testid="button-create-goal"
            >
              {mutation.isPending ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
