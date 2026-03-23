import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import TopHeader from '@/components/TopHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { HelpCircle, ChevronRight, X, Plus, Minus, Coffee, UtensilsCrossed, Cake } from 'lucide-react';

interface MealSlot {
  type: 'breakfast' | 'main' | 'dessert';
  sides?: number;
}

const CALORIE_OPTIONS = [1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500];

const MACRO_SPLITS = [
  { value: 'balanced', label: 'Balanced', description: '30% Protein, 40% Carb, 30% Fat' },
  { value: 'low_carb', label: 'Low Carb', description: '30% Protein, 20% Carb, 50% Fat' },
  { value: 'low_fat', label: 'Low Fat', description: '50% Protein, 30% Carb, 20% Fat' },
  { value: 'high_protein', label: 'High Protein', description: '40% Protein, 30% Carb, 30% Fat' },
];

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee, description: 'Morning meal' },
  { value: 'main', label: 'Main', icon: UtensilsCrossed, description: 'Lunch or dinner with optional sides' },
  { value: 'dessert', label: 'Dessert', icon: Cake, description: 'Sweet treat' },
];

const DIETARY_OPTIONS = [
  { value: 'no_preference', label: 'No Preference' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

const COMMON_EXCLUSIONS = ['Dairy', 'Gluten', 'Nuts', 'Soy', 'Eggs', 'Shellfish'];

const DEFAULT_MEAL_SLOTS: MealSlot[] = [
  { type: 'breakfast' },
  { type: 'main', sides: 0 },
  { type: 'main', sides: 0 },
];

export default function MealPlanSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    caloriesPerDay: 2000,
    macroSplit: 'balanced',
    mealSlots: DEFAULT_MEAL_SLOTS as MealSlot[],
    dietaryPreference: 'no_preference',
    excludedIngredients: [] as string[],
  });

  const [activeDrawer, setActiveDrawer] = useState<'calories' | 'macros' | 'dietary' | 'addMeal' | 'addSides' | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const { data: mealPlanData } = useQuery<{
    plan: {
      id: number;
      caloriesPerDay: number;
      macroSplit: string;
      mealsPerDay: number;
      mealSlots: MealSlot[] | null;
      dietaryPreference: string;
      excludedIngredients: string[];
    };
  }>({
    queryKey: ['/api/meal-plan'],
  });

  const { data: nutritionData } = useQuery<{
    goal: {
      calorieTarget: number;
    };
  }>({
    queryKey: ['/api/nutrition/today'],
  });

  const userCalorieTarget = nutritionData?.goal?.calorieTarget;

  useEffect(() => {
    if (mealPlanData?.plan) {
      const planMealSlots = mealPlanData.plan.mealSlots;
      setSettings({
        caloriesPerDay: mealPlanData.plan.caloriesPerDay,
        macroSplit: mealPlanData.plan.macroSplit,
        mealSlots: planMealSlots && planMealSlots.length >= 2 
          ? planMealSlots 
          : DEFAULT_MEAL_SLOTS,
        dietaryPreference: mealPlanData.plan.dietaryPreference,
        excludedIngredients: mealPlanData.plan.excludedIngredients || [],
      });
    }
  }, [mealPlanData]);

  const createMealPlanMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      return apiRequest('POST', '/api/meal-plan', {
        ...data,
        mealsPerDay: data.mealSlots.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      toast({ title: 'Meal plan created!', description: 'Your 7-day meal plan has been generated.' });
      navigate('/nutrition');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const regenerateMealPlanMutation = useMutation({
    mutationFn: async () => {
      if (!mealPlanData?.plan?.id) return;
      return apiRequest('POST', `/api/meal-plan/${mealPlanData.plan.id}/regenerate`, {
        ...settings,
        mealsPerDay: settings.mealSlots.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      toast({ title: 'Meal plan updated!', description: 'Your meal plan has been regenerated with new settings.' });
      navigate('/nutrition');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    if (mealPlanData?.plan) {
      regenerateMealPlanMutation.mutate();
    } else {
      createMealPlanMutation.mutate(settings);
    }
  };

  const getMacroLabel = (value: string) => {
    return MACRO_SPLITS.find(m => m.value === value)?.label || 'Balanced';
  };

  const getDietaryLabel = (value: string) => {
    return DIETARY_OPTIONS.find(d => d.value === value)?.label || 'No Preference';
  };

  const toggleExclusion = (ingredient: string) => {
    if (settings.excludedIngredients.includes(ingredient)) {
      setSettings({
        ...settings,
        excludedIngredients: settings.excludedIngredients.filter(i => i !== ingredient)
      });
    } else {
      setSettings({
        ...settings,
        excludedIngredients: [...settings.excludedIngredients, ingredient]
      });
    }
  };

  const addMealSlot = (type: MealSlot['type']) => {
    if (settings.mealSlots.length >= 5) return;
    
    const newSlot: MealSlot = type === 'main' ? { type, sides: 0 } : { type };
    setSettings({
      ...settings,
      mealSlots: [...settings.mealSlots, newSlot],
    });
    setActiveDrawer(null);
    
    if (type === 'main') {
      const newIndex = settings.mealSlots.length;
      setTimeout(() => {
        setSelectedSlotIndex(newIndex);
        setActiveDrawer('addSides');
      }, 100);
    }
  };

  const removeMealSlot = (index: number) => {
    if (settings.mealSlots.length <= 2) return;
    setSettings({
      ...settings,
      mealSlots: settings.mealSlots.filter((_, i) => i !== index),
    });
  };

  const updateMealSides = (index: number, sides: number) => {
    const newSlots = [...settings.mealSlots];
    newSlots[index] = { ...newSlots[index], sides };
    setSettings({ ...settings, mealSlots: newSlots });
  };

  const getMealTypeIcon = (type: string) => {
    const mealType = MEAL_TYPES.find(m => m.value === type);
    if (!mealType) return UtensilsCrossed;
    return mealType.icon;
  };

  const getMealTypeLabel = (type: string) => {
    const mealType = MEAL_TYPES.find(m => m.value === type);
    return mealType?.label || type;
  };

  const isPending = createMealPlanMutation.isPending || regenerateMealPlanMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-background border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground p-0"
            onClick={() => navigate('/nutrition')}
            data-testid="btn-cancel"
          >
            Cancel
          </Button>
          <h1 className="text-lg font-semibold">Nutrition Goal</h1>
          <Button 
            variant="ghost" 
            className="bg-[#0cc9a9] text-foreground font-semibold px-3 py-1 rounded hover:bg-[#0cc9a9]/90"
            onClick={handleSave}
            disabled={isPending}
            data-testid="btn-save"
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-2">Daily Nutrition Goal</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Changing this goal will regenerate Smart meal plan to match.
          </p>

          <div 
            className="flex items-center justify-between py-5 border-b border-border cursor-pointer"
            onClick={() => setActiveDrawer('calories')}
            data-testid="row-calories"
          >
            <span className="text-foreground">Calories per day</span>
            <span className="bg-[#0cc9a9] text-foreground font-medium px-2 py-0.5 rounded">{settings.caloriesPerDay}</span>
          </div>

          <div 
            className="flex items-center justify-between py-5 border-b border-border cursor-pointer"
            onClick={() => setActiveDrawer('macros')}
            data-testid="row-macros"
          >
            <span className="text-foreground">Macro split</span>
            <span className="bg-[#0cc9a9] text-foreground font-medium px-2 py-0.5 rounded">{getMacroLabel(settings.macroSplit)}</span>
          </div>

          <div 
            className="flex items-center justify-between py-5 border-b border-border cursor-pointer"
            onClick={() => setActiveDrawer('dietary')}
            data-testid="row-dietary"
          >
            <span className="text-foreground">Dietary preference</span>
            <div className="flex items-center gap-1">
              <span className="bg-[#0cc9a9] text-foreground font-medium px-2 py-0.5 rounded">{getDietaryLabel(settings.dietaryPreference)}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wide">Daily Meals</h2>
              <p className="text-xs text-muted-foreground">Min 2, max 5 meals per day</p>
            </div>
            <span className="text-sm text-muted-foreground">{settings.mealSlots.length}/5</span>
          </div>
          
          <div className="space-y-2 mb-4">
            {settings.mealSlots.map((slot, index) => {
              const Icon = getMealTypeIcon(slot.type);
              return (
                <Card key={index} className="bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{getMealTypeLabel(slot.type)}</p>
                          {slot.type === 'main' && (
                            <button 
                              className="text-xs text-primary hover:underline"
                              onClick={() => {
                                setSelectedSlotIndex(index);
                                setActiveDrawer('addSides');
                              }}
                            >
                              {slot.sides === 0 ? 'No sides' : slot.sides === 1 ? '+ 1 side' : '+ 2 sides'} 
                              <span className="text-muted-foreground ml-1">(tap to change)</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMealSlot(index)}
                        disabled={settings.mealSlots.length <= 2}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {settings.mealSlots.length < 5 && (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setActiveDrawer('addMeal')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Meal
            </Button>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4">Excluded Ingredients</h2>
          
          {settings.excludedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.excludedIngredients.map((ingredient) => (
                <Badge key={ingredient} className="flex items-center gap-1 bg-[#0cc9a9] text-foreground hover:bg-[#0cc9a9]/90">
                  {ingredient}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => toggleExclusion(ingredient)}
                  />
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {COMMON_EXCLUSIONS.filter(i => !settings.excludedIngredients.includes(i)).map((ingredient) => (
              <Badge
                key={ingredient}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => toggleExclusion(ingredient)}
              >
                + {ingredient}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Drawer open={activeDrawer === 'calories'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-center">Calories per day</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-80 overflow-y-auto">
            {(() => {
              const allOptions = userCalorieTarget && !CALORIE_OPTIONS.includes(userCalorieTarget)
                ? [...CALORIE_OPTIONS, userCalorieTarget].sort((a, b) => a - b)
                : CALORIE_OPTIONS;
              
              return allOptions.map((cal) => {
                const isUserGoal = cal === userCalorieTarget && !CALORIE_OPTIONS.includes(userCalorieTarget);
                return (
                  <div
                    key={cal}
                    className={`py-4 px-6 border-b border-border/50 cursor-pointer hover:bg-muted/50 ${settings.caloriesPerDay === cal ? 'bg-[#0cc9a9]/20 font-medium' : ''}`}
                    onClick={() => {
                      setSettings({ ...settings, caloriesPerDay: cal });
                      setActiveDrawer(null);
                    }}
                    data-testid={`option-calories-${cal}`}
                  >
                    {isUserGoal ? (
                      <div className="flex items-center justify-between">
                        <span>{cal}</span>
                        <span className="text-xs bg-[#0cc9a9] text-foreground px-2 py-0.5 rounded">My Goal</span>
                      </div>
                    ) : (
                      cal
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'macros'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-center">Macro split</DrawerTitle>
          </DrawerHeader>
          <div className="pb-6">
            {MACRO_SPLITS.map((macro) => (
              <div
                key={macro.value}
                className={`py-4 px-6 border-b border-border/50 cursor-pointer hover:bg-muted/50 ${settings.macroSplit === macro.value ? 'bg-[#0cc9a9]/20 font-medium' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, macroSplit: macro.value });
                  setActiveDrawer(null);
                }}
                data-testid={`option-macro-${macro.value}`}
              >
                {macro.label} ({macro.description})
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'dietary'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-center">Dietary preference</DrawerTitle>
          </DrawerHeader>
          <div className="pb-6">
            {DIETARY_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={`py-4 px-6 border-b border-border/50 cursor-pointer hover:bg-muted/50 ${settings.dietaryPreference === option.value ? 'bg-[#0cc9a9]/20 font-medium' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, dietaryPreference: option.value });
                  setActiveDrawer(null);
                }}
                data-testid={`option-dietary-${option.value}`}
              >
                {option.label}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'addMeal'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-center">Add Meal Type</DrawerTitle>
          </DrawerHeader>
          <div className="pb-6">
            {MEAL_TYPES.map((mealType) => {
              const Icon = mealType.icon;
              return (
                <div
                  key={mealType.value}
                  className="flex items-center gap-4 py-4 px-6 border-b border-border/50 cursor-pointer hover:bg-muted/50"
                  onClick={() => addMealSlot(mealType.value as MealSlot['type'])}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{mealType.label}</p>
                    <p className="text-xs text-muted-foreground">{mealType.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'addSides'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="text-center">Number of Sides</DrawerTitle>
          </DrawerHeader>
          <div className="pb-6">
            {[0, 1, 2].map((num) => (
              <div
                key={num}
                className={`py-4 px-6 border-b border-border/50 cursor-pointer hover:bg-muted/50 ${selectedSlotIndex !== null && settings.mealSlots[selectedSlotIndex]?.sides === num ? 'bg-[#0cc9a9]/20 font-medium' : ''}`}
                onClick={() => {
                  if (selectedSlotIndex !== null) {
                    updateMealSides(selectedSlotIndex, num);
                    setActiveDrawer(null);
                    setSelectedSlotIndex(null);
                  }
                }}
              >
                {num === 0 ? 'No sides (main dish only)' : num === 1 ? '1 side dish' : '2 side dishes'}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
