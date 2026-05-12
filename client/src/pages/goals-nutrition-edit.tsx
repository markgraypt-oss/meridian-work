import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  keto: { protein: 25, carbs: 5, fat: 70, label: "Keto", description: "25% protein, 5% carbs, 70% fat" },
  low_fat: { protein: 35, carbs: 50, fat: 15, label: "Low Fat", description: "35% protein, 50% carbs, 15% fat" },
  custom: { protein: 33, carbs: 34, fat: 33, label: "Custom", description: "Set each macro by dragging the sliders" },
};

const SLIDER_LIMITS = {
  protein: { min: 30, max: 400, step: 5 },
  carbs: { min: 0, max: 700, step: 5 },
  fat: { min: 10, max: 250, step: 5 },
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;

export default function GoalsNutritionEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const goalId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();

  const [selectedCalorieGoal, setSelectedCalorieGoal] = useState<string>("custom");
  const [baseCalories, setBaseCalories] = useState<number>(0);
  const [calories, setCalories] = useState("");
  const [macroPreset, setMacroPreset] = useState<keyof typeof MACRO_PRESETS>("balanced");
  const [proteinGrams, setProteinGrams] = useState(150);
  const [carbsGrams, setCarbsGrams] = useState(200);
  const [fatGrams, setFatGrams] = useState(65);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const calorieDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: goal, isLoading } = useQuery<Goal>({
    queryKey: [`/api/goals/${goalId}`],
    enabled: !!goalId,
  });

  useEffect(() => {
    if (goal) {
      const goalCalories = goal.nutritionCalories || 0;
      setCalories(goalCalories.toString());
      setMacroPreset((goal.macroPreset as keyof typeof MACRO_PRESETS) || "balanced");

      // Recover the user's maintenance calories so adjustment buttons work
      // correctly (e.g. switching Mild → Moderate Deficit subtracts from
      // maintenance, not from the previously saved target).
      const savedCalorieGoalType = (goal as any).calorieGoalType;
      const savedAdjustment = CALORIE_GOALS.find(g => g.id === savedCalorieGoalType)?.adjustment ?? 0;
      setBaseCalories(goalCalories - savedAdjustment);
      setSelectedCalorieGoal(savedCalorieGoalType || "custom");

      // Prefer saved grams; otherwise derive from saved percentages and calories
      const initProtein = goal.proteinGrams ?? (goalCalories && goal.proteinPercent ? Math.round((goalCalories * goal.proteinPercent / 100) / 4) : 150);
      const initCarbs = goal.carbsGrams ?? (goalCalories && goal.carbPercent ? Math.round((goalCalories * goal.carbPercent / 100) / 4) : 200);
      const initFat = goal.fatGrams ?? (goalCalories && goal.fatPercent ? Math.round((goalCalories * goal.fatPercent / 100) / 9) : 65);
      setProteinGrams(clamp(snap(initProtein, SLIDER_LIMITS.protein.step), SLIDER_LIMITS.protein.min, SLIDER_LIMITS.protein.max));
      setCarbsGrams(clamp(snap(initCarbs, SLIDER_LIMITS.carbs.step), SLIDER_LIMITS.carbs.min, SLIDER_LIMITS.carbs.max));
      setFatGrams(clamp(snap(initFat, SLIDER_LIMITS.fat.step), SLIDER_LIMITS.fat.min, SLIDER_LIMITS.fat.max));
    }
  }, [goal]);

  // Re-snap sliders to current preset whenever the calorie target changes
  // (e.g. user switches Calorie Adjustment). No-op for Custom preset so the
  // user keeps their hand-set values.
  const snapSlidersTo = (cals: number, preset: keyof typeof MACRO_PRESETS) => {
    if (!cals) return;
    let ratios: { protein: number; carbs: number; fat: number };
    if (preset === "custom") {
      // Preserve current macro ratios and rescale to the new calorie target
      const currentCals = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
      if (!currentCals) return;
      ratios = {
        protein: (proteinGrams * 4) / currentCals * 100,
        carbs: (carbsGrams * 4) / currentCals * 100,
        fat: (fatGrams * 9) / currentCals * 100,
      };
    } else {
      ratios = MACRO_PRESETS[preset];
    }
    setProteinGrams(clamp(snap(Math.round((cals * ratios.protein / 100) / 4), SLIDER_LIMITS.protein.step), SLIDER_LIMITS.protein.min, SLIDER_LIMITS.protein.max));
    setCarbsGrams(clamp(snap(Math.round((cals * ratios.carbs / 100) / 4), SLIDER_LIMITS.carbs.step), SLIDER_LIMITS.carbs.min, SLIDER_LIMITS.carbs.max));
    setFatGrams(clamp(snap(Math.round((cals * ratios.fat / 100) / 9), SLIDER_LIMITS.fat.step), SLIDER_LIMITS.fat.min, SLIDER_LIMITS.fat.max));
  };

  const computedCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  const targetCalories = parseInt(calories) || 0;
  const calorieDelta = targetCalories ? computedCalories - targetCalories : 0;

  const proteinPercent = computedCalories ? Math.round((proteinGrams * 4) / computedCalories * 100) : 0;
  const carbPercent = computedCalories ? Math.round((carbsGrams * 4) / computedCalories * 100) : 0;
  const fatPercent = computedCalories ? Math.round((fatGrams * 9) / computedCalories * 100) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const cals = computedCalories;
      if (cals < 800 || cals > 6000) {
        throw new Error("Macros must total between 800 and 6000 calories");
      }

      const goalData = {
        nutritionCalories: cals,
        targetValue: cals,
        calorieGoalType: selectedCalorieGoal,
        macroPreset: macroPreset,
        proteinPercent,
        carbPercent,
        fatPercent,
        proteinGrams,
        carbsGrams,
        fatGrams,
        description: `${cals} calories with ${MACRO_PRESETS[macroPreset].label} macro split`,
      };

      return await apiRequest("PATCH", `/api/goals/${goalId}`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/today"] });
      toast({ title: "Success", description: "Nutrition goal updated!" });
      setLocation("/goals");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update goal", variant: "destructive" });
    },
  });

  const handleCalorieGoalSelect = (id: string) => {
    setSelectedCalorieGoal(id);
    if (id !== "custom" && baseCalories > 0) {
      const selected = CALORIE_GOALS.find(g => g.id === id);
      if (selected) {
        const newCals = baseCalories + selected.adjustment;
        setCalories(newCals.toString());
        snapSlidersTo(newCals, macroPreset);
      }
    }
  };

  const handleMacroPresetSelect = (preset: keyof typeof MACRO_PRESETS) => {
    setMacroPreset(preset);
    snapSlidersTo(parseInt(calories) || computedCalories || 2000, preset);
  };

  const handleSaveClick = () => setShowConfirmDialog(true);
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
      <TopHeader title="Nutrition Goal" onBack={() => setLocation("/goals")} />

      <div className="px-6 py-4 pb-32 space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Daily Calorie Target</Label>
          <Input
            type="number"
            value={calories}
            onChange={(e) => {
              const newVal = e.target.value;
              setCalories(newVal);
              setSelectedCalorieGoal("custom");
              if (calorieDebounceRef.current) clearTimeout(calorieDebounceRef.current);
              calorieDebounceRef.current = setTimeout(() => {
                const val = parseInt(newVal);
                if (val && val >= 800) snapSlidersTo(val, macroPreset);
              }, 700);
            }}
            placeholder="2500"
            data-testid="input-calories"
          />
          <p className="text-xs text-muted-foreground">
            Type your own target, or pick a Calorie Adjustment below to set it for you.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Calorie Adjustment</Label>
          <div className="space-y-2">
            {CALORIE_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleCalorieGoalSelect(g.id)}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedCalorieGoal === g.id
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid={`button-calorie-goal-${g.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      g.adjustment < 0
                        ? "bg-red-500/20 text-red-400"
                        : g.adjustment > 0
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {g.badge}
                    </span>
                    {selectedCalorieGoal === g.id && <Check className="h-4 w-4 text-[#0cc9a9]" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Macro Preset</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MACRO_PRESETS) as (keyof typeof MACRO_PRESETS)[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMacroPresetSelect(key)}
                className={`p-3 border rounded-lg text-left transition-all ${
                  macroPreset === key
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/10 ring-1 ring-[#0cc9a9]"
                    : "border-border hover:border-muted-foreground"
                }`}
                data-testid={`button-preset-${key}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{MACRO_PRESETS[key].label}</div>
                  {macroPreset === key && <Check className="h-4 w-4 text-[#0cc9a9]" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{MACRO_PRESETS[key].description}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tap a preset to snap the sliders, then drag any slider to fine-tune.
          </p>
        </div>

        <div className="p-4 border rounded-lg bg-muted/20 space-y-5">
          <MacroSlider
            label="Protein"
            color="text-green-500"
            rangeClassName="bg-green-500"
            thumbClassName="border-green-500"
            grams={proteinGrams}
            cals={proteinGrams * 4}
            limits={SLIDER_LIMITS.protein}
            onChange={(v) => { setProteinGrams(v); setMacroPreset("custom"); }}
            testId="slider-protein"
          />
          <MacroSlider
            label="Carbs"
            color="text-blue-500"
            rangeClassName="bg-blue-500"
            thumbClassName="border-blue-500"
            grams={carbsGrams}
            cals={carbsGrams * 4}
            limits={SLIDER_LIMITS.carbs}
            onChange={(v) => { setCarbsGrams(v); setMacroPreset("custom"); }}
            testId="slider-carbs"
          />
          <MacroSlider
            label="Fat"
            color="text-orange-500"
            rangeClassName="bg-orange-500"
            thumbClassName="border-orange-500"
            grams={fatGrams}
            cals={fatGrams * 9}
            limits={SLIDER_LIMITS.fat}
            onChange={(v) => { setFatGrams(v); setMacroPreset("custom"); }}
            testId="slider-fat"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Daily Targets</Label>
          {computedCalories > 0 && (
            <div className="h-4 w-full rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500" style={{ width: `${proteinPercent}%` }} />
              <div className="h-full bg-blue-500" style={{ width: `${carbPercent}%` }} />
              <div className="h-full bg-orange-500" style={{ width: `${fatPercent}%` }} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg" data-testid="text-total-calories">{computedCalories}</div>
              <div className="text-muted-foreground text-xs">Calories</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-500">{proteinGrams}g</div>
              <div className="text-muted-foreground text-xs">Protein {proteinPercent}%</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-500">{carbsGrams}g</div>
              <div className="text-muted-foreground text-xs">Carbs {carbPercent}%</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-orange-500">{fatGrams}g</div>
              <div className="text-muted-foreground text-xs">Fat {fatPercent}%</div>
            </div>
          </div>
          {targetCalories > 0 && Math.abs(calorieDelta) >= 25 && (
            <div className={`text-xs text-center ${calorieDelta > 0 ? "text-orange-400" : "text-blue-400"}`}>
              {calorieDelta > 0 ? `+${calorieDelta}` : calorieDelta} cal vs your {targetCalories} cal target
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border pb-24">
          <Button
            onClick={handleSaveClick}
            disabled={mutation.isPending || computedCalories < 800 || computedCalories > 6000}
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
              Save {computedCalories} calories — {proteinGrams}g protein, {carbsGrams}g carbs, {fatGrams}g fat?
              This will update what your Macro Tracker shows.
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

function MacroSlider({
  label,
  color,
  rangeClassName,
  thumbClassName,
  grams,
  cals,
  limits,
  onChange,
  testId,
}: {
  label: string;
  color: string;
  rangeClassName: string;
  thumbClassName: string;
  grams: number;
  cals: number;
  limits: { min: number; max: number; step: number };
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="text-sm">
          <span className={`font-semibold ${color}`}>{grams}g</span>
          <span className="text-muted-foreground ml-2 text-xs">{cals} cal</span>
        </div>
      </div>
      <Slider
        value={[grams]}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        onValueChange={(v) => onChange(v[0])}
        rangeClassName={rangeClassName}
        thumbClassName={thumbClassName}
        data-testid={testId}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{limits.min}g</span>
        <span>{limits.max}g</span>
      </div>
    </div>
  );
}
