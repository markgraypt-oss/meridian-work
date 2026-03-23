import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Loader2 } from "lucide-react";

interface NutritionData {
  goal: {
    calorieTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  mealBreakdown: {
    breakfast: FoodItem[];
    lunch: FoodItem[];
    dinner: FoodItem[];
    snacks: FoodItem[];
  };
}

interface FoodItem {
  id: number;
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  brand?: string;
  servingSize?: number;
  servingSizeUnit?: string;
}

export default function SaveMeal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [mealName, setMealName] = useState("");
  const [mealCategory, setMealCategory] = useState<string>("breakfast");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meal = params.get("meal");
    if (meal) {
      setMealCategory(meal.toLowerCase());
    }
  }, []);

  const { data: nutritionData } = useQuery<NutritionData>({
    queryKey: ['/api/nutrition/today'],
  });

  const mealFoods = nutritionData?.mealBreakdown?.[mealCategory as keyof typeof nutritionData.mealBreakdown] || [];

  const totalCalories = mealFoods.reduce((sum, f) => sum + (f.calories || 0), 0);
  const totalProtein = mealFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarbs = mealFoods.reduce((sum, f) => sum + (f.carbs || 0), 0);
  const totalFat = mealFoods.reduce((sum, f) => sum + (f.fat || 0), 0);

  const saveMealMutation = useMutation({
    mutationFn: async (data: { name: string; items: any[] }) => {
      return await apiRequest("POST", "/api/nutrition/saved-meals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/saved-meals"] });
      toast({ title: "Meal saved!", description: "You can now quickly add this meal from the Saved tab" });
      navigate("/nutrition");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save meal", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!mealName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for this meal", variant: "destructive" });
      return;
    }

    if (mealFoods.length === 0) {
      toast({ title: "No foods", description: "Add some foods first", variant: "destructive" });
      return;
    }

    const items = mealFoods.map(food => ({
      foodName: food.foodName,
      brand: food.brand || null,
      servingSize: food.servingSize || 100,
      servingSizeUnit: food.servingSizeUnit || "gram",
      calories: food.calories,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
    }));

    saveMealMutation.mutate({ name: mealName, items });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header with back, title, and save */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate("/nutrition")}
            className="p-1"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Save as Meal</h1>
          <button
            onClick={handleSave}
            disabled={saveMealMutation.isPending}
            className="text-primary font-semibold"
            data-testid="button-save-meal"
          >
            {saveMealMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Name input - flush with header */}
      <div className="px-4 py-3 bg-card">
        <Input
          placeholder="Name Your Meal"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          className="text-lg h-12 bg-background border-border"
          data-testid="input-meal-name"
        />
      </div>

      <div className="p-4 space-y-6">

        <div className="flex items-center justify-around py-4 bg-card rounded-lg">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto">
              <svg className="w-16 h-16 -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-primary"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * 0.25}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold">{totalCalories}</span>
                <span className="text-xs text-muted-foreground">cal</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-green-500">Carbs</div>
            <div className="font-semibold">{Math.round(totalCarbs)} g</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[#0cc9a9]">Fat</div>
            <div className="font-semibold">{Math.round(totalFat)} g</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-red-500">Protein</div>
            <div className="font-semibold">{Math.round(totalProtein)} g</div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Meal Items</h3>
          <div className="space-y-2">
            {mealFoods.map((food) => (
              <div key={food.id} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                <div>
                  <div className="font-medium">{food.foodName}</div>
                  {food.brand && (
                    <div className="text-xs text-muted-foreground">{food.brand}</div>
                  )}
                  {food.servingSize && (
                    <div className="text-xs text-muted-foreground">
                      {food.servingSize} {food.servingSizeUnit === "gram" ? "g" : food.servingSizeUnit}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground">{food.calories}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
