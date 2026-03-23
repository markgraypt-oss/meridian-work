import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertTriangle } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

const CALORIE_GOALS = [
  { id: "mild_deficit", label: "Mild Deficit", description: "Gradual fat loss", adjustment: -250, badge: "-250 cal" },
  { id: "moderate_deficit", label: "Moderate Deficit", description: "Steady fat loss", adjustment: -500, badge: "-500 cal" },
  { id: "maintenance", label: "Maintenance", description: "Maintain current weight", adjustment: 0, badge: "0 cal" },
  { id: "mild_surplus", label: "Mild Surplus", description: "Lean muscle gain", adjustment: 250, badge: "+250 cal" },
  { id: "moderate_surplus", label: "Moderate Surplus", description: "Muscle building", adjustment: 500, badge: "+500 cal" },
  { id: "custom", label: "Custom", description: "Set your own target", adjustment: 0, badge: "Custom" },
];

const MACRO_PRESETS = {
  balanced: { protein: 30, carbs: 40, fat: 30, label: "Balanced", description: "30% protein, 40% carbs, 30% fat" },
  high_protein: { protein: 40, carbs: 30, fat: 30, label: "High Protein", description: "40% protein, 30% carbs, 30% fat" },
  low_carb: { protein: 35, carbs: 20, fat: 45, label: "Low Carb", description: "35% protein, 20% carbs, 45% fat" },
  low_fat: { protein: 35, carbs: 50, fat: 15, label: "Low Fat", description: "35% protein, 50% carbs, 15% fat" },
  custom: { protein: 33, carbs: 34, fat: 33, label: "Custom", description: "Set your own macro split" },
};

export default function GoalsNutritionEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const goalId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  
  const [selectedCalorieGoal, setSelectedCalorieGoal] = useState<string>("custom");
  const [baseCalories, setBaseCalories] = useState<number>(0);
  const [calories, setCalories] = useState("");
  const [macroPreset, setMacroPreset] = useState<keyof typeof MACRO_PRESETS>("balanced");
  const [proteinPercent, setProteinPercent] = useState(30);
  const [carbPercent, setCarbPercent] = useState(40);
  const [fatPercent, setFatPercent] = useState(30);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: goal, isLoading } = useQuery<Goal>({
    queryKey: [`/api/goals/${goalId}`],
    enabled: !!goalId,
  });

  useEffect(() => {
    if (goal) {
      const goalCalories = goal.nutritionCalories || 0;
      setCalories(goalCalories.toString());
      setBaseCalories(goalCalories);
      setMacroPreset((goal.macroPreset as keyof typeof MACRO_PRESETS) || "balanced");
      setProteinPercent(goal.proteinPercent || 30);
      setCarbPercent(goal.carbPercent || 40);
      setFatPercent(goal.fatPercent || 30);
      // Load saved calorie goal type or default to custom
      const savedCalorieGoalType = (goal as any).calorieGoalType;
      setSelectedCalorieGoal(savedCalorieGoalType || "custom");
    }
  }, [goal]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cals = parseInt(calories);
      if (!cals || cals < 1000 || cals > 6000) {
        throw new Error("Please enter a valid calorie target (1000-6000)");
      }
      
      const goalData = {
        nutritionCalories: cals,
        targetValue: cals,
        calorieGoalType: selectedCalorieGoal,
        macroPreset: macroPreset,
        proteinPercent: proteinPercent,
        carbPercent: carbPercent,
        fatPercent: fatPercent,
        description: `${cals} calories with ${MACRO_PRESETS[macroPreset].label} macro split`,
      };
      
      return await apiRequest("PATCH", `/api/goals/${goalId}`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Success", description: "Nutrition goal updated!" });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update goal", variant: "destructive" });
    },
  });

  const handleCalorieGoalSelect = (goalId: string) => {
    setSelectedCalorieGoal(goalId);
    if (goalId !== "custom" && baseCalories > 0) {
      const selectedGoal = CALORIE_GOALS.find(g => g.id === goalId);
      if (selectedGoal) {
        setCalories((baseCalories + selectedGoal.adjustment).toString());
      }
    }
  };

  const handleMacroPresetSelect = (preset: keyof typeof MACRO_PRESETS) => {
    setMacroPreset(preset);
    if (preset !== "custom") {
      setProteinPercent(MACRO_PRESETS[preset].protein);
      setCarbPercent(MACRO_PRESETS[preset].carbs);
      setFatPercent(MACRO_PRESETS[preset].fat);
    }
  };

  const calculateGrams = () => {
    const cals = parseInt(calories) || 0;
    return {
      protein: Math.round((cals * proteinPercent / 100) / 4),
      carbs: Math.round((cals * carbPercent / 100) / 4),
      fat: Math.round((cals * fatPercent / 100) / 9),
    };
  };

  const grams = calculateGrams();
  const macroTotal = proteinPercent + carbPercent + fatPercent;
  const isMacroValid = macroPreset !== "custom" || macroTotal === 100;

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
        title="Edit Nutrition Goal"
        onBack={() => setLocation("/goals")}
      />

      <div className="px-6 py-4 pb-32 space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Daily Calorie Target</Label>
          <Input
            type="number"
            value={calories}
            onChange={(e) => {
              setCalories(e.target.value);
              setSelectedCalorieGoal("custom");
            }}
            placeholder="2500"
            data-testid="input-calories"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Calorie Adjustment</Label>
          <div className="space-y-2">
            {CALORIE_GOALS.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => handleCalorieGoalSelect(goal.id)}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedCalorieGoal === goal.id
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid={`button-calorie-goal-${goal.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{goal.label}</div>
                    <div className="text-xs text-muted-foreground">{goal.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      goal.adjustment < 0 
                        ? "bg-red-500/20 text-red-400" 
                        : goal.adjustment > 0 
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {goal.badge}
                    </span>
                    {selectedCalorieGoal === goal.id && <Check className="h-4 w-4 text-[#0cc9a9]" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Macro Split</Label>
          <div className="space-y-2">
            {(Object.keys(MACRO_PRESETS) as (keyof typeof MACRO_PRESETS)[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMacroPresetSelect(key)}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  macroPreset === key
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid={`button-preset-${key}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{MACRO_PRESETS[key].label}</div>
                    <div className="text-xs text-muted-foreground">{MACRO_PRESETS[key].description}</div>
                  </div>
                  {macroPreset === key && <Check className="h-4 w-4 text-[#0cc9a9]" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {macroPreset === "custom" && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="text-sm text-muted-foreground">Must total 100%</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Protein %</Label>
                <Input
                  type="number"
                  value={proteinPercent}
                  onChange={(e) => setProteinPercent(parseInt(e.target.value) || 0)}
                  data-testid="input-protein-percent"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs %</Label>
                <Input
                  type="number"
                  value={carbPercent}
                  onChange={(e) => setCarbPercent(parseInt(e.target.value) || 0)}
                  data-testid="input-carb-percent"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat %</Label>
                <Input
                  type="number"
                  value={fatPercent}
                  onChange={(e) => setFatPercent(parseInt(e.target.value) || 0)}
                  data-testid="input-fat-percent"
                />
              </div>
            </div>
            {macroTotal !== 100 && (
              <div className="text-xs text-red-500">
                Total: {macroTotal}% (must be 100%)
              </div>
            )}
          </div>
        )}

        {parseInt(calories) > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Daily Targets</Label>
            <div className="h-4 w-full rounded-full overflow-hidden flex">
              <div className="h-full bg-[#0cc9a9]" style={{ width: `${proteinPercent}%` }} />
              <div className="h-full bg-blue-500" style={{ width: `${carbPercent}%` }} />
              <div className="h-full bg-orange-500" style={{ width: `${fatPercent}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div>
                  <span className="text-green-500 font-semibold">{proteinPercent}%</span>
                  <span className="text-muted-foreground ml-1">{grams.protein}g</span>
                </div>
                <div className="text-muted-foreground text-xs">Protein</div>
              </div>
              <div className="text-center">
                <div>
                  <span className="text-blue-500 font-semibold">{carbPercent}%</span>
                  <span className="text-muted-foreground ml-1">{grams.carbs}g</span>
                </div>
                <div className="text-muted-foreground text-xs">Carbs</div>
              </div>
              <div className="text-center">
                <div>
                  <span className="text-orange-500 font-semibold">{fatPercent}%</span>
                  <span className="text-muted-foreground ml-1">{grams.fat}g</span>
                </div>
                <div className="text-muted-foreground text-xs">Fat</div>
              </div>
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border pb-24">
          <Button
            onClick={handleSaveClick}
            disabled={mutation.isPending || !calories || !isMacroValid}
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
              Are you sure you want to update your nutrition goal? This will change your daily calorie and macro targets.
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
