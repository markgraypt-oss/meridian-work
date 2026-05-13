import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

type LegacyGoal = { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number } | null;

export default function MacroTargetsEdit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [calories, setCalories] = useState("");
  const [macroPreset, setMacroPreset] = useState<keyof typeof MACRO_PRESETS>("balanced");
  const [proteinGrams, setProteinGrams] = useState(150);
  const [carbsGrams, setCarbsGrams] = useState(200);
  const [fatGrams, setFatGrams] = useState(65);

  const { data: today } = useQuery<{ goal: LegacyGoal } & Record<string, any>>({
    queryKey: ["/api/nutrition/today"],
  });

  useEffect(() => {
    if (!today?.goal) return;
    setCalories((today.goal.calorieTarget || 2000).toString());
    setProteinGrams(clamp(snap(today.goal.proteinTarget || 150, SLIDER_LIMITS.protein.step), SLIDER_LIMITS.protein.min, SLIDER_LIMITS.protein.max));
    setCarbsGrams(clamp(snap(today.goal.carbsTarget || 200, SLIDER_LIMITS.carbs.step), SLIDER_LIMITS.carbs.min, SLIDER_LIMITS.carbs.max));
    setFatGrams(clamp(snap(today.goal.fatTarget || 65, SLIDER_LIMITS.fat.step), SLIDER_LIMITS.fat.min, SLIDER_LIMITS.fat.max));
  }, [today?.goal]);

  const computedCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  const targetCalories = parseInt(calories) || 0;
  const calorieDelta = targetCalories ? computedCalories - targetCalories : 0;
  const proteinPercent = computedCalories ? Math.round((proteinGrams * 4) / computedCalories * 100) : 0;
  const carbPercent = computedCalories ? Math.round((carbsGrams * 4) / computedCalories * 100) : 0;
  const fatPercent = computedCalories ? Math.round((fatGrams * 9) / computedCalories * 100) : 0;

  const snapSlidersTo = (cals: number, preset: keyof typeof MACRO_PRESETS) => {
    if (!cals) return;
    let ratios: { protein: number; carbs: number; fat: number };
    if (preset === "custom") {
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

  const handleMacroPresetSelect = (preset: keyof typeof MACRO_PRESETS) => {
    setMacroPreset(preset);
    snapSlidersTo(parseInt(calories) || computedCalories || 2000, preset);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (computedCalories < 800 || computedCalories > 6000) {
        throw new Error("Macros must total between 800 and 6000 calories");
      }
      return await apiRequest("POST", "/api/nutrition/goal", {
        calorieTarget: computedCalories,
        proteinTarget: proteinGrams,
        carbsTarget: carbsGrams,
        fatTarget: fatGrams,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/today"] });
      toast({ title: "Saved", description: "Macro tracker targets updated." });
      setLocation("/nutrition");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Macro Tracker Targets" onBack={() => setLocation("/nutrition")} />

      <div className="px-6 py-4 pb-32 space-y-6">
        <div className="p-3 border rounded-lg bg-muted/30 text-xs text-muted-foreground">
          These targets only affect what your Macro Tracker shows. They will not create or change any nutrition goal. Manage goals from the Goals section.
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Daily Calorie Target</Label>
          <Input
            type="number"
            value={calories}
            onChange={(e) => {
              const newVal = e.target.value;
              setCalories(newVal);
              setMacroPreset("custom");
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                const v = parseInt(newVal);
                if (v && v >= 800) snapSlidersTo(v, macroPreset);
              }, 700);
            }}
            placeholder="2500"
            data-testid="input-calories"
          />
          <p className="text-xs text-muted-foreground">
            Type your own target, or pick a Macro Preset below.
          </p>
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
          <MacroSlider label="Protein" color="text-green-500" rangeClassName="bg-green-500" thumbClassName="border-green-500"
            grams={proteinGrams} cals={proteinGrams * 4} limits={SLIDER_LIMITS.protein}
            onChange={(v) => { setProteinGrams(v); setMacroPreset("custom"); }} testId="slider-protein" />
          <MacroSlider label="Carbs" color="text-blue-500" rangeClassName="bg-blue-500" thumbClassName="border-blue-500"
            grams={carbsGrams} cals={carbsGrams * 4} limits={SLIDER_LIMITS.carbs}
            onChange={(v) => { setCarbsGrams(v); setMacroPreset("custom"); }} testId="slider-carbs" />
          <MacroSlider label="Fat" color="text-orange-500" rangeClassName="bg-orange-500" thumbClassName="border-orange-500"
            grams={fatGrams} cals={fatGrams * 9} limits={SLIDER_LIMITS.fat}
            onChange={(v) => { setFatGrams(v); setMacroPreset("custom"); }} testId="slider-fat" />
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || computedCalories < 800 || computedCalories > 6000}
            className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
            data-testid="button-save"
          >
            {mutation.isPending ? "Saving..." : "Save Macro Targets"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MacroSlider({ label, color, rangeClassName, thumbClassName, grams, cals, limits, onChange, testId }: {
  label: string; color: string; rangeClassName: string; thumbClassName: string;
  grams: number; cals: number; limits: { min: number; max: number; step: number };
  onChange: (v: number) => void; testId: string;
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
