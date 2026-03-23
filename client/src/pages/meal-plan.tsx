import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RefreshCw, Check, Settings, Plus, ChevronLeft, Flame, Beef, Wheat, Droplet, X, Calendar, Utensils } from "lucide-react";
import type { Recipe } from "@shared/schema";

interface MealPlanMeal {
  id: number;
  mealPlanDayId: number;
  mealType: string;
  recipeId: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  position: number;
  ateToday: boolean | null;
  ateTodayDate: Date | null;
  recipe: Recipe;
}

interface MealPlanDay {
  id: number;
  mealPlanId: number;
  dayIndex: number;
  totalCalories: number;
  meals: MealPlanMeal[];
}

interface MealPlan {
  id: number;
  userId: string;
  caloriesPerDay: number;
  macroSplit: string;
  mealsPerDay: number;
  dietaryPreference: string;
  excludedIngredients: string[] | null;
  isActive: boolean;
}

interface MealPlanData {
  plan: MealPlan;
  days: MealPlanDay[];
}

const MACRO_SPLITS = [
  { id: 'balanced', name: 'Balanced', ratio: '40/30/30' },
  { id: 'high_protein', name: 'High Protein', ratio: '30/40/30' },
  { id: 'low_carb', name: 'Low Carb', ratio: '25/35/40' },
  { id: 'keto', name: 'Keto', ratio: '5/25/70' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MealPlanPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedDay, setSelectedDay] = useState("1");

  const { data: mealPlanData, isLoading, error } = useQuery<MealPlanData | null>({
    queryKey: ['/api/meal-plan'],
    enabled: !!user,
  });

  const regeneratePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest('POST', `/api/meal-plan/${planId}/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      toast({ title: 'Meal plan refreshed!', description: 'Your meals have been updated with new recipes.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const regenerateMealMutation = useMutation({
    mutationFn: async (mealId: number) => {
      return apiRequest('POST', `/api/meal-plan/meal/${mealId}/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      toast({ title: 'Meal updated!', description: 'A new recipe has been selected.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markEatenMutation = useMutation({
    mutationFn: async ({ mealId, ateToday }: { mealId: number; ateToday: boolean }) => {
      return apiRequest('PATCH', `/api/meal-plan/meal/${mealId}/ate`, { ateToday });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/history'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Parse base type from mealType (e.g., "breakfast_0" -> "breakfast", "side_1" -> "side")
  const getBaseType = (mealType: string) => {
    const parts = mealType.split('_');
    return parts[0];
  };

  const getMealTypeLabel = (mealType: string) => {
    const baseType = getBaseType(mealType);
    if (baseType === 'side') return 'Side';
    const labels: Record<string, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      main: 'Main',
    };
    return labels[baseType] || mealType;
  };

  const getMealTypeIcon = (mealType: string) => {
    const baseType = getBaseType(mealType);
    if (baseType === 'side') return '🥗';
    const icons: Record<string, string> = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙',
      snack: '🍎',
      main: '🍽️',
    };
    return icons[baseType] || '🍽️';
  };

  const isSideMeal = (mealType: string) => getBaseType(mealType) === 'side';

  // Group meals by slot - mains with their sides together
  // mealType format: "type_slotIndex" (e.g., "breakfast_0", "main_1", "side_1")
  const groupMealsBySlot = (meals: MealPlanMeal[]): MealPlanMeal[][] => {
    const groups: Map<number, MealPlanMeal[]> = new Map();
    
    // Sort by position first
    const sortedMeals = [...meals].sort((a, b) => a.position - b.position);
    
    sortedMeals.forEach((meal) => {
      // Extract slot index from mealType (last part after underscore)
      const parts = meal.mealType.split('_');
      const slotIndex = parts.length > 1 ? parseInt(parts[parts.length - 1]) : meal.position;
      
      if (!groups.has(slotIndex)) {
        groups.set(slotIndex, []);
      }
      groups.get(slotIndex)!.push(meal);
    });
    
    // Sort each group: main first, then sides
    const result: MealPlanMeal[][] = [];
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
    
    for (const key of sortedKeys) {
      const group = groups.get(key)!;
      // Sort: non-sides first
      group.sort((a, b) => {
        const aIsSide = isSideMeal(a.mealType);
        const bIsSide = isSideMeal(b.mealType);
        if (aIsSide && !bIsSide) return 1;
        if (!aIsSide && bIsSide) return -1;
        return 0;
      });
      result.push(group);
    }
    
    return result;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.history.back()} className="text-zinc-400 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">Meal Plan</h1>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/');
    return null;
  }

  const currentDay = mealPlanData?.days.find(d => d.dayIndex === parseInt(selectedDay));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.history.back()} className="text-zinc-400 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Meal Plan</h1>
      </div>
      
      <div className="p-4 space-y-4">
        {!mealPlanData ? (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Create Your Meal Plan</h3>
              <p className="text-zinc-400 text-sm mb-4">
                Get a personalized 7-day meal plan based on your calorie goals, dietary preferences, and meal structure.
              </p>
              <Button 
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
                onClick={() => navigate('/meal-plan-settings')}
                data-testid="button-create-plan"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Meal Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  {mealPlanData.plan.caloriesPerDay} cal/day
                </Badge>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                  {MACRO_SPLITS.find(s => s.id === mealPlanData.plan.macroSplit)?.name || 'Custom'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => regeneratePlanMutation.mutate(mealPlanData.plan.id)}
                  disabled={regeneratePlanMutation.isPending}
                  className="text-zinc-400 hover:text-white"
                  data-testid="button-refresh-plan"
                >
                  <RefreshCw className={`w-5 h-5 ${regeneratePlanMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-zinc-400 hover:text-white"
                  onClick={() => navigate('/meal-plan-settings')}
                  data-testid="button-settings"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <Tabs value={selectedDay} onValueChange={setSelectedDay} className="w-full">
              <TabsList className="grid w-full grid-cols-7 bg-zinc-900 p-1">
                {DAY_LABELS.map((label, index) => (
                  <TabsTrigger 
                    key={index + 1}
                    value={(index + 1).toString()} 
                    className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black text-zinc-400"
                    data-testid={`tab-day-${index + 1}`}
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {mealPlanData.days.map((day) => (
                <TabsContent key={day.id} value={day.dayIndex.toString()} className="mt-4 space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-zinc-400">
                      Total: <span className="text-cyan-400 font-medium">{day.totalCalories} cal</span>
                    </p>
                  </div>

                  {groupMealsBySlot(day.meals).map((mealGroup, groupIndex) => (
                    <div key={groupIndex} className={mealGroup.length > 1 ? 'border border-cyan-500/30 rounded-lg overflow-hidden' : ''}>
                      {mealGroup.map((meal, mealIndex) => (
                        <Card 
                          key={meal.id} 
                          className={`bg-zinc-900/50 overflow-hidden ${meal.ateToday ? 'opacity-60' : ''} ${
                            mealGroup.length > 1 
                              ? 'border-0 border-b border-zinc-800 last:border-b-0 rounded-none' 
                              : 'border-zinc-800'
                          }`}
                          data-testid={`card-meal-${meal.id}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-stretch">
                              <div className={`flex-shrink-0 relative ${isSideMeal(meal.mealType) ? 'w-16 h-16' : 'w-24 h-24'}`}>
                                {meal.recipe.imageUrl ? (
                                  <img 
                                    src={meal.recipe.imageUrl} 
                                    alt={meal.recipe.title} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <Utensils className={isSideMeal(meal.mealType) ? 'w-5 h-5 text-zinc-600' : 'w-8 h-8 text-zinc-600'} />
                                  </div>
                                )}
                                {meal.ateToday && (
                                  <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                                    <Check className={isSideMeal(meal.mealType) ? 'w-5 h-5 text-green-400' : 'w-8 h-8 text-green-400'} />
                                  </div>
                                )}
                              </div>
                              <div className={`flex-1 ${isSideMeal(meal.mealType) ? 'p-2' : 'p-3'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-zinc-500 ${isSideMeal(meal.mealType) ? 'text-[10px]' : 'text-xs'}`}>
                                    {getMealTypeIcon(meal.mealType)} {getMealTypeLabel(meal.mealType)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-zinc-500 hover:text-cyan-400"
                                    onClick={() => regenerateMealMutation.mutate(meal.id)}
                                    disabled={regenerateMealMutation.isPending}
                                    data-testid={`button-refresh-meal-${meal.id}`}
                                  >
                                    <RefreshCw className={`w-3 h-3 ${regenerateMealMutation.isPending ? 'animate-spin' : ''}`} />
                                  </Button>
                                </div>
                                <h4 
                                  className={`font-medium text-white mb-1 line-clamp-1 cursor-pointer hover:text-cyan-400 ${isSideMeal(meal.mealType) ? 'text-xs' : 'text-sm mb-2'}`}
                                  onClick={() => navigate(`/recipes/${meal.recipeId}`)}
                                >
                                  {meal.recipe.title}
                                </h4>
                                <div className={`flex items-center gap-2 ${isSideMeal(meal.mealType) ? 'text-[10px]' : 'text-xs gap-3'}`}>
                                  <span className="text-orange-400 flex items-center gap-1">
                                    <Flame className="w-3 h-3" />
                                    {meal.calories}
                                  </span>
                                  <span className="text-red-400 flex items-center gap-1">
                                    <Beef className="w-3 h-3" />
                                    {meal.protein}g
                                  </span>
                                  {!isSideMeal(meal.mealType) && (
                                    <>
                                      <span className="text-[#0cc9a9] flex items-center gap-1">
                                        <Wheat className="w-3 h-3" />
                                        {meal.carbs}g
                                      </span>
                                      <span className="text-blue-400 flex items-center gap-1">
                                        <Droplet className="w-3 h-3" />
                                        {meal.fat}g
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                className={`w-12 flex items-center justify-center border-l border-zinc-800 ${
                                  meal.ateToday 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-zinc-800/50 text-zinc-500 hover:text-white hover:bg-zinc-700'
                                }`}
                                onClick={() => markEatenMutation.mutate({ mealId: meal.id, ateToday: !meal.ateToday })}
                                data-testid={`button-toggle-eaten-${meal.id}`}
                              >
                                <Check className="w-5 h-5" />
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))}

                  {day.meals.length === 0 && (
                    <div className="text-center py-8 text-zinc-500">
                      <p>No meals for this day</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
