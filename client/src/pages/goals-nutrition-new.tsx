import { useState, useEffect } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Check, AlertCircle } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";

const MACRO_PRESETS = {
  balanced: { protein: 30, carbs: 40, fat: 30, label: "Balanced", description: "30% protein, 40% carbs, 30% fat" },
  high_protein: { protein: 40, carbs: 30, fat: 30, label: "High Protein", description: "40% protein, 30% carbs, 30% fat" },
  low_carb: { protein: 35, carbs: 20, fat: 45, label: "Low Carb", description: "35% protein, 20% carbs, 45% fat" },
  low_fat: { protein: 35, carbs: 50, fat: 15, label: "Low Fat", description: "35% protein, 50% carbs, 15% fat" },
  custom: { protein: 33, carbs: 34, fat: 33, label: "Custom", description: "Set your own macro split" },
};

const CALORIE_GOALS = [
  { id: "mild_deficit", label: "Mild Deficit", description: "Gradual fat loss", adjustment: -250, badge: "-250 cal" },
  { id: "moderate_deficit", label: "Moderate Deficit", description: "Steady fat loss", adjustment: -500, badge: "-500 cal" },
  { id: "maintenance", label: "Maintenance", description: "Maintain current weight", adjustment: 0, badge: "0 cal" },
  { id: "mild_surplus", label: "Mild Surplus", description: "Lean muscle gain", adjustment: 250, badge: "+250 cal" },
  { id: "moderate_surplus", label: "Moderate Surplus", description: "Muscle building", adjustment: 500, badge: "+500 cal" },
  { id: "custom", label: "Custom", description: "Set your own target", adjustment: 0, badge: "Custom" },
];

export default function GoalsNutritionNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  
  const [tdeeAge, setTdeeAge] = useState("");
  const [tdeeWeight, setTdeeWeight] = useState("");
  const [tdeeHeight, setTdeeHeight] = useState("");
  const [tdeeSex, setTdeeSex] = useState<"male" | "female">("male");
  const [tdeeActivity, setTdeeActivity] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  
  const [calculatedTDEE, setCalculatedTDEE] = useState<number | null>(null);
  const [selectedCalorieGoal, setSelectedCalorieGoal] = useState<string | null>(null);
  const [customCalories, setCustomCalories] = useState("");
  const [finalCalories, setFinalCalories] = useState<number | null>(null);
  
  const [macroPreset, setMacroPreset] = useState<keyof typeof MACRO_PRESETS>("balanced");
  const [proteinPercent, setProteinPercent] = useState(30);
  const [carbPercent, setCarbPercent] = useState(40);
  const [fatPercent, setFatPercent] = useState(30);

  // Fetch goals to check for existing nutrition goal and pre-fill weight
  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  // Check if a nutrition goal already exists
  const existingNutritionGoal = goals.find(g => g.type === "nutrition" && !g.isCompleted);

  // Fetch latest bodyweight entry as fallback
  const { data: latestBodyweight } = useQuery<{ weight: number; unit: string } | null>({
    queryKey: ["/api/progress/bodyweight/latest"],
  });

  // Fetch user profile for height, DOB (age), and gender
  const { data: userProfile } = useQuery<{
    height: number | null;
    heightUnit: string | null;
    dateOfBirth: string | null;
    gender: string | null;
  }>({
    queryKey: ["/api/user/profile"],
  });

  // Pre-fill height from user profile
  useEffect(() => {
    if (tdeeHeight) return; // Don't override if user already entered a value
    
    if (userProfile?.height) {
      // If stored in ft (inches), convert to cm
      if (userProfile.heightUnit === "ft") {
        const cm = Math.round(userProfile.height * 2.54);
        setTdeeHeight(cm.toString());
      } else {
        setTdeeHeight(userProfile.height.toString());
      }
    }
  }, [userProfile]);

  // Pre-fill age from user profile DOB
  useEffect(() => {
    if (tdeeAge) return; // Don't override if user already entered a value
    
    if (userProfile?.dateOfBirth) {
      const birthDate = new Date(userProfile.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age > 0 && age < 120) {
        setTdeeAge(age.toString());
      }
    }
  }, [userProfile]);

  // Pre-fill sex from user profile gender
  useEffect(() => {
    if (userProfile?.gender === "male" || userProfile?.gender === "female") {
      setTdeeSex(userProfile.gender);
    }
  }, [userProfile]);

  // Pre-fill weight from bodyweight goal or latest log
  useEffect(() => {
    if (tdeeWeight) return; // Don't override if user already entered a value
    
    // First try to get weight from bodyweight goal
    const bodyweightGoal = goals.find(g => g.type === "bodyweight" && !g.isCompleted);
    if (bodyweightGoal?.currentValue) {
      setTdeeWeight(bodyweightGoal.currentValue.toString());
      return;
    }
    
    // Fallback to latest bodyweight log
    if (latestBodyweight?.weight) {
      setTdeeWeight(latestBodyweight.weight.toString());
    }
  }, [goals, latestBodyweight]);

  const calculateTDEE = () => {
    const age = parseInt(tdeeAge);
    const weight = parseFloat(tdeeWeight);
    const height = parseFloat(tdeeHeight);
    
    if (!age || !weight || !height) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    const activityMultipliers = { 
      sedentary: 1.2, 
      light: 1.375, 
      moderate: 1.55, 
      active: 1.725, 
      very_active: 1.9 
    };
    
    let bmr = tdeeSex === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    
    let tdee = Math.round(bmr * activityMultipliers[tdeeActivity]);
    setCalculatedTDEE(tdee);
    setStep(2);
  };

  const handleCalorieGoalSelect = (goalId: string) => {
    setSelectedCalorieGoal(goalId);
    
    if (goalId === "custom") {
      setFinalCalories(null);
    } else if (calculatedTDEE) {
      const goal = CALORIE_GOALS.find(g => g.id === goalId);
      if (goal) {
        setFinalCalories(calculatedTDEE + goal.adjustment);
      }
    }
  };

  const handleCustomCaloriesSubmit = () => {
    const cals = parseInt(customCalories);
    if (!cals || cals < 1000 || cals > 6000) {
      toast({ title: "Error", description: "Please enter a valid calorie target (1000-6000)", variant: "destructive" });
      return;
    }
    setFinalCalories(cals);
  };

  const proceedToMacros = () => {
    if (!finalCalories) {
      toast({ title: "Error", description: "Please select a calorie goal first", variant: "destructive" });
      return;
    }
    setStep(3);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!finalCalories) throw new Error("No calorie target set");
      
      const goalData = {
        type: "nutrition",
        title: "Daily Nutrition Target",
        description: `${finalCalories} calories with ${MACRO_PRESETS[macroPreset].label} macro split`,
        targetValue: finalCalories,
        currentValue: 0,
        unit: "kcal",
        nutritionCalories: finalCalories,
        calorieGoalType: selectedCalorieGoal || "custom",
        macroPreset: macroPreset,
        proteinPercent: proteinPercent,
        carbPercent: carbPercent,
        fatPercent: fatPercent,
        startDate: todayLocalStr(),
      };
      
      return await apiRequest("POST", "/api/goals", goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Success", description: "Nutrition goal created!" });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create goal", variant: "destructive" });
    },
  });

  const handleMacroPresetSelect = (preset: keyof typeof MACRO_PRESETS) => {
    setMacroPreset(preset);
    if (preset !== "custom") {
      setProteinPercent(MACRO_PRESETS[preset].protein);
      setCarbPercent(MACRO_PRESETS[preset].carbs);
      setFatPercent(MACRO_PRESETS[preset].fat);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      setLocation("/goals");
    } else {
      setStep(step - 1);
    }
  };

  const getStepTitle = () => {
    if (step === 1) return "Calculate Your Calories";
    if (step === 2) return "Choose Your Goal";
    return "Set Your Macros";
  };

  // Show loading state
  if (goalsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="New Nutrition Goal" onBack={() => setLocation("/goals")} />
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Show message if nutrition goal already exists
  if (existingNutritionGoal) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Nutrition Goal" onBack={() => setLocation("/goals")} />
        <div className="px-6 py-8">
          <div className="p-6 border rounded-lg bg-[#0cc9a9]/10 border-[#0cc9a9]/30 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-[#0cc9a9] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-lg mb-1">You already have a nutrition goal</h3>
                <p className="text-muted-foreground text-sm">
                  Only one nutrition goal can be active at a time. You can edit your existing goal or delete it to create a new one.
                </p>
              </div>
            </div>
            
            <div className="pt-2 space-y-3">
              <div className="p-4 border rounded-lg bg-background/50">
                <div className="text-sm text-muted-foreground mb-1">Current Goal</div>
                <div className="font-medium">{existingNutritionGoal.title}</div>
                <div className="text-sm text-muted-foreground">{existingNutritionGoal.description}</div>
              </div>
              
              <Button
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
                onClick={() => setLocation(`/goals/nutrition/edit/${existingNutritionGoal.id}`)}
                data-testid="button-edit-existing-goal"
              >
                Edit Existing Goal
              </Button>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/goals")}
                data-testid="button-back-to-goals"
              >
                Back to Goals
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopHeader 
        title={getStepTitle()}
        onBack={handleBack}
      />

      <div className="px-4 py-2">
        <div className="flex gap-1 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-[#0cc9a9]" : "bg-muted"}`}
            />
          ))}
        </div>
        {step === 1 && (
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="h-8 w-8 text-[#0cc9a9] shrink-0" />
            <p className="text-muted-foreground text-sm">
              Enter your details to calculate your daily calorie needs
            </p>
          </div>
        )}
      </div>

      <div className="px-6 pb-32">
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Age</Label>
                  <Input
                    type="number"
                    value={tdeeAge}
                    onChange={(e) => setTdeeAge(e.target.value)}
                    placeholder="30"
                    data-testid="input-tdee-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Weight (kg)</Label>
                  <Input
                    type="number"
                    value={tdeeWeight}
                    onChange={(e) => setTdeeWeight(e.target.value)}
                    placeholder="80"
                    data-testid="input-tdee-weight"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Height (cm)</Label>
                  <Input
                    type="number"
                    value={tdeeHeight}
                    onChange={(e) => setTdeeHeight(e.target.value)}
                    placeholder="175"
                    data-testid="input-tdee-height"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Sex</Label>
                  <Select value={tdeeSex} onValueChange={(v: "male" | "female") => setTdeeSex(v)}>
                    <SelectTrigger data-testid="select-tdee-sex">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Activity Level</Label>
                <Select value={tdeeActivity} onValueChange={(v: any) => setTdeeActivity(v)}>
                  <SelectTrigger data-testid="select-tdee-activity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary (desk job)</SelectItem>
                    <SelectItem value="light">Light (1-2x/week)</SelectItem>
                    <SelectItem value="moderate">Moderate (3-5x/week)</SelectItem>
                    <SelectItem value="active">Active (6-7x/week)</SelectItem>
                    <SelectItem value="very_active">Very Active (2x/day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={calculateTDEE}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
              data-testid="button-calculate-tdee"
            >
              Calculate Calories
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {calculatedTDEE && (
              <div className="text-center mb-6 p-4 bg-[#0cc9a9]/10 rounded-lg border border-[#0cc9a9]/30">
                <div className="text-sm text-muted-foreground mb-1">Your Maintenance Calories</div>
                <div className="text-3xl font-bold text-[#0cc9a9]">{calculatedTDEE} cal</div>
              </div>
            )}

            <div className="space-y-3">
              {CALORIE_GOALS.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => handleCalorieGoalSelect(goal.id)}
                  className={`w-full p-4 border rounded-lg text-left transition-all ${
                    selectedCalorieGoal === goal.id
                      ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  data-testid={`button-calorie-goal-${goal.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{goal.label}</div>
                      <div className="text-xs text-muted-foreground">{goal.description}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      goal.adjustment < 0 
                        ? "bg-red-500/20 text-red-400" 
                        : goal.adjustment > 0 
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {goal.badge}
                    </span>
                  </div>
                  {selectedCalorieGoal === goal.id && goal.id !== "custom" && calculatedTDEE && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-sm">
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-semibold text-[#0cc9a9]">{calculatedTDEE + goal.adjustment} cal/day</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {selectedCalorieGoal === "custom" && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm">Enter Your Calorie Target</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={customCalories}
                    onChange={(e) => setCustomCalories(e.target.value)}
                    placeholder="e.g., 2000"
                    data-testid="input-custom-calories"
                  />
                  <Button
                    onClick={handleCustomCaloriesSubmit}
                    variant="outline"
                    data-testid="button-apply-custom-calories"
                  >
                    Apply
                  </Button>
                </div>
                {finalCalories && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <Check className="h-4 w-4" />
                    Target set to {finalCalories} cal/day
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={proceedToMacros}
              disabled={!finalCalories}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
              data-testid="button-proceed-macros"
            >
              Continue to Macro Split
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6 p-4 bg-[#0cc9a9]/10 rounded-lg border border-[#0cc9a9]/30">
              <div className="text-sm text-muted-foreground mb-1">Your Daily Calorie Target</div>
              <div className="text-3xl font-bold text-[#0cc9a9]">{finalCalories} cal</div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Macro Split</Label>
              <div className="space-y-2">
                {(Object.keys(MACRO_PRESETS) as Array<keyof typeof MACRO_PRESETS>).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleMacroPresetSelect(preset)}
                    className={`w-full p-4 border rounded-lg text-left transition-all ${
                      macroPreset === preset
                        ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    data-testid={`button-macro-${preset}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{MACRO_PRESETS[preset].label}</span>
                      <span className="text-xs text-muted-foreground">{MACRO_PRESETS[preset].description}</span>
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
                {proteinPercent + carbPercent + fatPercent !== 100 && (
                  <div className="text-xs text-red-500">
                    Total: {proteinPercent + carbPercent + fatPercent}% (must be 100%)
                  </div>
                )}
              </div>
            )}

            {finalCalories && (
              <div className="p-4 border rounded-lg bg-[#0cc9a9]/5 space-y-3">
                <div className="text-sm font-medium">Daily Targets</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xl font-bold text-green-500">
                      {Math.round((finalCalories * proteinPercent / 100) / 4)}g
                    </div>
                    <div className="text-xs text-muted-foreground">Protein ({proteinPercent}%)</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-500">
                      {Math.round((finalCalories * carbPercent / 100) / 4)}g
                    </div>
                    <div className="text-xs text-muted-foreground">Carbs ({carbPercent}%)</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-orange-500">
                      {Math.round((finalCalories * fatPercent / 100) / 9)}g
                    </div>
                    <div className="text-xs text-muted-foreground">Fat ({fatPercent}%)</div>
                  </div>
                </div>
              </div>
            )}

            {tdeeWeight && (
              <div className="p-4 border rounded-lg bg-green-500/10 border-green-500/30">
                <div className="text-sm font-medium text-green-400 mb-1">Protein Guidance</div>
                <div className="text-xs text-muted-foreground">
                  For optimal results, aim for 1.3-2.0g of protein per kg of bodyweight.
                  Based on {tdeeWeight}kg, that's {Math.round(parseFloat(tdeeWeight) * 1.3)}-{Math.round(parseFloat(tdeeWeight) * 2.0)}g daily.
                </div>
              </div>
            )}

            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || (macroPreset === "custom" && proteinPercent + carbPercent + fatPercent !== 100)}
              className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
              data-testid="button-create-goal"
            >
              {mutation.isPending ? "Creating..." : "Create Nutrition Goal"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
