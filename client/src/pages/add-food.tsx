import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ScanBarcode, Plus, History, BookmarkPlus, ChefHat, Search, Check, ChevronLeft, Clock, Edit2 } from "lucide-react";

interface FoodHistoryItem {
  id: number;
  foodName: string;
  brand?: string | null;
  defaultServingSize: number;
  defaultServingSizeUnit: string;
  caloriesPer100: number;
  proteinPer100?: number;
  carbsPer100?: number;
  fatPer100?: number;
  timesUsed?: number;
  lastUsedAt?: string;
}

interface SelectedItem {
  id: number;
  type: "food" | "recipe" | "saved_meal";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingSizeUnit: string;
  brand?: string | null;
  recipeId?: number;
  savedMealId?: number;
}

interface SavedMealItem {
  id: number;
  foodName: string;
  brand?: string | null;
  servingSize: number;
  servingSizeUnit: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export default function AddFood() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [mealCategory, setMealCategory] = useState("meal 1");
  const [activeTab, setActiveTab] = useState("manual");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Manual form state
  const [foodName, setFoodName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("100");
  const [servingSizeUnit, setServingSizeUnit] = useState("gram");
  const [servingQuantity, setServingQuantity] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Detail view state
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [detailServings, setDetailServings] = useState("1");
  const [detailTime, setDetailTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  // Quick add feedback state
  const [quickAddSuccess, setQuickAddSuccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meal = params.get("meal");
    if (meal) {
      setMealCategory(meal.toLowerCase());
    }
  }, []);

  const { data: savedMeals = [] } = useQuery<any[]>({
    queryKey: ["/api/nutrition/saved-meals"],
  });

  const { data: recipes = [] } = useQuery<any[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: foodHistory = [] } = useQuery<FoodHistoryItem[]>({
    queryKey: ["/api/nutrition/food-history"],
  });

  // Fetch saved meal items when a saved meal is selected
  const { data: savedMealDetail } = useQuery<{ template: any; items: SavedMealItem[] }>({
    queryKey: ["/api/nutrition/saved-meals", selectedItem?.savedMealId],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/saved-meals/${selectedItem?.savedMealId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saved meal");
      return res.json();
    },
    enabled: !!selectedItem?.savedMealId,
  });

  const filteredHistory = searchQuery
    ? foodHistory.filter((f) =>
        f.foodName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : foodHistory;

  const filteredRecipes = searchQuery
    ? recipes.filter((r: any) =>
        r.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recipes;

  const addFoodMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/nutrition/meals/food", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/food-history"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add food", variant: "destructive" });
    },
  });

  const addRecipeMutation = useMutation({
    mutationFn: async (data: { recipeId: number; mealName: string; servings: number }) => {
      return await apiRequest("POST", `/api/nutrition/recipes/${data.recipeId}/log`, {
        mealName: data.mealName,
        servings: data.servings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/today"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add recipe", variant: "destructive" });
    },
  });

  const addSavedMealMutation = useMutation({
    mutationFn: async (data: { savedMealId: number; mealName: string; servings: number }) => {
      return await apiRequest("POST", `/api/nutrition/saved-meals/${data.savedMealId}/log`, {
        mealName: data.mealName,
        servings: data.servings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/today"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add saved meal", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!foodName || !calories) {
      toast({ title: "Error", description: "Name and calories are required", variant: "destructive" });
      return;
    }
    addFoodMutation.mutate({
      mealName: mealCategory,
      foodName,
      brand: brand || undefined,
      servingSize: parseFloat(servingSize) || 100,
      servingSizeUnit,
      servingQuantity: parseFloat(servingQuantity) || 1,
      calories: parseInt(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Food added successfully" });
        navigate("/nutrition");
      }
    });
  };

  // Quick add handlers with visual feedback
  const handleQuickAdd = (item: any, itemType: "food" | "recipe" | "saved_meal", itemKey: string) => {
    const key = `${itemType}-${itemKey}`;
    const itemName = item.foodName || item.title || item.name;
    
    const onSuccessHandler = () => {
      toast({ title: "Added", description: `${itemName} added to ${mealCategory}` });
      setQuickAddSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setQuickAddSuccess(prev => ({ ...prev, [key]: false }));
      }, 1500);
    };
    
    if (itemType === "food") {
      addFoodMutation.mutate({
        mealName: mealCategory,
        foodName: item.foodName || item.title,
        brand: item.brand || undefined,
        servingSize: item.servingSize || 100,
        servingSizeUnit: item.servingSizeUnit || "gram",
        servingQuantity: 1,
        calories: item.calories,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
      }, { onSuccess: onSuccessHandler });
    } else if (itemType === "recipe") {
      addRecipeMutation.mutate({
        recipeId: item.id,
        mealName: mealCategory,
        servings: 1,
      }, { onSuccess: onSuccessHandler });
    } else if (itemType === "saved_meal") {
      addSavedMealMutation.mutate({
        savedMealId: item.id,
        mealName: mealCategory,
        servings: 1,
      }, { onSuccess: onSuccessHandler });
    }
  };

  // Open detail view
  const openDetailView = (item: any, itemType: "food" | "recipe" | "saved_meal") => {
    // Handle different item types with their respective field names
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    
    if (itemType === "saved_meal") {
      // Saved meals use totalCalories, totalProtein, etc.
      calories = item.totalCalories || 0;
      protein = item.totalProtein || 0;
      carbs = item.totalCarbs || 0;
      fat = item.totalFat || 0;
    } else if (itemType === "recipe") {
      // Recipe stores total macros, calculate per serving
      const servings = item.servings || 1;
      calories = Math.round((item.calories || 0) / servings);
      protein = Math.round(((item.protein || 0) / servings) * 10) / 10;
      carbs = Math.round(((item.carbs || 0) / servings) * 10) / 10;
      fat = Math.round(((item.fat || 0) / servings) * 10) / 10;
    } else {
      // Regular food item
      calories = item.calories || 0;
      protein = item.protein || 0;
      carbs = item.carbs || 0;
      fat = item.fat || 0;
    }
    
    setSelectedItem({
      id: item.id,
      type: itemType,
      name: item.foodName || item.title || item.name,
      calories,
      protein,
      carbs,
      fat,
      servingSize: item.servingSize || item.defaultServings || 1,
      servingSizeUnit: item.servingSizeUnit || "serving",
      brand: item.brand,
      recipeId: itemType === "recipe" ? item.id : undefined,
      savedMealId: itemType === "saved_meal" ? item.id : undefined,
    });
    setDetailServings("1");
  };

  // Add from detail view
  const handleDetailAdd = () => {
    if (!selectedItem) return;
    
    const servings = parseFloat(detailServings) || 1;

    if (selectedItem.type === "food" || selectedItem.type === "saved_meal" && !selectedItem.savedMealId) {
      addFoodMutation.mutate({
        mealName: mealCategory,
        foodName: selectedItem.name,
        brand: selectedItem.brand || undefined,
        servingSize: selectedItem.servingSize,
        servingSizeUnit: selectedItem.servingSizeUnit,
        servingQuantity: servings,
        calories: Math.round(selectedItem.calories * servings),
        protein: Math.round(selectedItem.protein * servings * 10) / 10,
        carbs: Math.round(selectedItem.carbs * servings * 10) / 10,
        fat: Math.round(selectedItem.fat * servings * 10) / 10,
      }, {
        onSuccess: () => {
          toast({ title: "Added", description: `${selectedItem.name} added to ${mealCategory}` });
          setSelectedItem(null);
        }
      });
    } else if (selectedItem.type === "recipe" && selectedItem.recipeId) {
      addRecipeMutation.mutate({
        recipeId: selectedItem.recipeId,
        mealName: mealCategory,
        servings,
      }, {
        onSuccess: () => {
          toast({ title: "Added", description: `${selectedItem.name} added to ${mealCategory}` });
          setSelectedItem(null);
        }
      });
    } else if (selectedItem.type === "saved_meal" && selectedItem.savedMealId) {
      addSavedMealMutation.mutate({
        savedMealId: selectedItem.savedMealId,
        mealName: mealCategory,
        servings,
      }, {
        onSuccess: () => {
          toast({ title: "Added", description: `${selectedItem.name} added to ${mealCategory}` });
          setSelectedItem(null);
        }
      });
    }
  };

  const handleScanBarcode = () => {
    toast({ title: "Coming Soon", description: "Barcode scanning will be available in the mobile app" });
  };

  // Calculate adjusted nutrition for detail view
  const servingsMultiplier = parseFloat(detailServings) || 1;
  const adjustedCalories = selectedItem ? Math.round(selectedItem.calories * servingsMultiplier) : 0;
  const adjustedProtein = selectedItem ? Math.round(selectedItem.protein * servingsMultiplier * 10) / 10 : 0;
  const adjustedCarbs = selectedItem ? Math.round(selectedItem.carbs * servingsMultiplier * 10) / 10 : 0;
  const adjustedFat = selectedItem ? Math.round(selectedItem.fat * servingsMultiplier * 10) / 10 : 0;

  // Calculate macro percentages
  const totalMacroCalories = (adjustedProtein * 4) + (adjustedCarbs * 4) + (adjustedFat * 9);
  const proteinPercent = totalMacroCalories > 0 ? Math.round((adjustedProtein * 4 / totalMacroCalories) * 100) : 0;
  const carbsPercent = totalMacroCalories > 0 ? Math.round((adjustedCarbs * 4 / totalMacroCalories) * 100) : 0;
  const fatPercent = totalMacroCalories > 0 ? Math.round((adjustedFat * 9 / totalMacroCalories) * 100) : 0;

  // Render Detail View
  if (selectedItem) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Header with back and add buttons - flush with top */}
        <div className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => setSelectedItem(null)} 
              className="p-1"
              data-testid="button-detail-back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold">Add Food</h1>
            <button 
              onClick={handleDetailAdd}
              disabled={addFoodMutation.isPending || addRecipeMutation.isPending || addSavedMealMutation.isPending}
              className="p-1 text-primary"
              data-testid="button-detail-add"
            >
              {(addFoodMutation.isPending || addRecipeMutation.isPending || addSavedMealMutation.isPending) ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Check className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-1">
          {/* Food Name */}
          <h2 className="text-lg font-bold py-2 border-b border-border">{selectedItem.name}</h2>

          {/* Serving Size */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Serving Size</span>
            <span className="text-primary font-medium">
              {selectedItem.servingSize} {selectedItem.servingSizeUnit === "gram" ? "g" : selectedItem.servingSizeUnit}
            </span>
          </div>

          {/* Number of Servings */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Number of Servings</span>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={detailServings}
              onChange={(e) => setDetailServings(e.target.value)}
              className="w-20 text-right text-primary font-medium bg-card border-border"
              data-testid="input-detail-servings"
            />
          </div>

          {/* Time */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Time</span>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={detailTime}
                onChange={(e) => setDetailTime(e.target.value)}
                className="w-28 text-primary font-medium bg-card border-border"
                data-testid="input-detail-time"
              />
            </div>
          </div>

          {/* Meal */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Meal</span>
            <Select value={mealCategory} onValueChange={setMealCategory}>
              <SelectTrigger className="w-32 bg-card border-border text-primary" data-testid="select-detail-meal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meal 1">Meal 1</SelectItem>
                <SelectItem value="meal 2">Meal 2</SelectItem>
                <SelectItem value="meal 3">Meal 3</SelectItem>
                <SelectItem value="meal 4">Meal 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nutrition Summary */}
          <div className="flex items-center justify-between pt-4">
            {/* Calorie Circle */}
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                {/* Protein arc (cyan) */}
                <circle 
                  cx="50" cy="50" r="40" fill="none" 
                  stroke="#22d3ee" strokeWidth="8"
                  strokeDasharray={`${proteinPercent * 2.51} 251`}
                  strokeDashoffset="0"
                />
                {/* Carbs arc (purple) */}
                <circle 
                  cx="50" cy="50" r="40" fill="none" 
                  stroke="#a855f7" strokeWidth="8"
                  strokeDasharray={`${carbsPercent * 2.51} 251`}
                  strokeDashoffset={`${-proteinPercent * 2.51}`}
                />
                {/* Fat arc (yellow) */}
                <circle 
                  cx="50" cy="50" r="40" fill="none" 
                  stroke="#0cc9a9" strokeWidth="8"
                  strokeDasharray={`${fatPercent * 2.51} 251`}
                  strokeDashoffset={`${-(proteinPercent + carbsPercent) * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{adjustedCalories}</span>
                <span className="text-xs text-muted-foreground">cal</span>
              </div>
            </div>

            {/* Macro breakdown */}
            <div className="flex-1 grid grid-cols-3 gap-4 ml-6">
              <div className="text-center">
                <p className="text-cyan-400 text-sm font-medium">{proteinPercent}%</p>
                <p className="text-lg font-bold">{adjustedProtein}g</p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </div>
              <div className="text-center">
                <p className="text-purple-400 text-sm font-medium">{carbsPercent}%</p>
                <p className="text-lg font-bold">{adjustedCarbs}g</p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </div>
              <div className="text-center">
                <p className="text-[#0cc9a9] text-sm font-medium">{fatPercent}%</p>
                <p className="text-lg font-bold">{adjustedFat}g</p>
                <p className="text-xs text-muted-foreground">Fat</p>
              </div>
            </div>
          </div>

          {/* Meal Items Section - for saved meals */}
          {selectedItem.type === "saved_meal" && savedMealDetail?.items && savedMealDetail.items.length > 0 && (
            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Meal Items</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-primary"
                  onClick={() => navigate(`/nutrition/edit-saved-meal/${selectedItem.savedMealId}`)}
                  data-testid="button-edit-meal-items"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="space-y-2">
                {savedMealDetail.items.map((item) => {
                  const unitDisplay = item.servingSizeUnit === "gram" ? "g" : item.servingSizeUnit;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <p className="font-medium">{item.foodName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.brand && `${item.brand}, `}
                          {item.servingSize} {unitDisplay}
                        </p>
                      </div>
                      <span className="text-muted-foreground">{item.calories}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render list item with quick add button
  const renderListItem = (
    item: any,
    itemType: "food" | "recipe" | "saved_meal",
    itemKey: string,
    displayName: string,
    subtitle: string,
    calorieDisplay: string,
    calorieSubtitle?: string
  ) => {
    const key = `${itemType}-${itemKey}`;
    const isSuccess = quickAddSuccess[key];

    return (
      <div
        key={itemKey}
        className="flex items-center justify-between p-3 bg-card hover:bg-muted rounded-lg transition-colors"
        data-testid={`item-${itemType}-${itemKey}`}
      >
        <button
          onClick={() => openDetailView(item, itemType)}
          className="flex-1 text-left"
          data-testid={`button-detail-${itemType}-${itemKey}`}
        >
          <p className="font-medium">{displayName}</p>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-primary font-medium">{calorieDisplay}</p>
            {calorieSubtitle && <p className="text-muted-foreground text-xs">{calorieSubtitle}</p>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdd(item, itemType, itemKey);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              isSuccess 
                ? "bg-green-500 text-white" 
                : "bg-primary/20 text-primary hover:bg-primary/30"
            }`}
            data-testid={`button-quickadd-${itemType}-${itemKey}`}
          >
            {isSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header - flush with top */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate("/nutrition")} 
            className="p-1"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Add Food</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Barcode Scanner Button */}
        <Button
          variant="outline"
          onClick={handleScanBarcode}
          className="w-full h-12 border-dashed border-2 border-primary/50 text-primary hover:bg-primary/10"
          data-testid="button-scan-barcode"
        >
          <ScanBarcode className="h-5 w-5 mr-2" />
          Scan Barcode
        </Button>

        {/* Meal Category */}
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Add to meal</Label>
          <Select value={mealCategory} onValueChange={setMealCategory}>
            <SelectTrigger className="bg-card border-border" data-testid="select-meal-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meal 1">Meal 1</SelectItem>
              <SelectItem value="meal 2">Meal 2</SelectItem>
              <SelectItem value="meal 3">Meal 3</SelectItem>
              <SelectItem value="meal 4">Meal 4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-14 z-40 bg-background -mx-4 px-4 pb-2 pt-1">
            <TabsList className="grid grid-cols-4 bg-card w-full">
              <TabsTrigger value="manual" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                <Plus className="h-3 w-3 mr-1" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                <History className="h-3 w-3 mr-1" />
                History
              </TabsTrigger>
              <TabsTrigger value="saved" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                <BookmarkPlus className="h-3 w-3 mr-1" />
                Saved
              </TabsTrigger>
              <TabsTrigger value="recipes" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-black">
                <ChefHat className="h-3 w-3 mr-1" />
                Recipes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="foodName" className="text-muted-foreground">Food Name *</Label>
              <Input
                id="foodName"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g., Chicken Breast"
                className="bg-card border-border"
                data-testid="input-food-name"
              />
            </div>

            <div>
              <Label htmlFor="brand" className="text-muted-foreground">Brand (optional)</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Tyson"
                className="bg-card border-border"
                data-testid="input-food-brand"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="servingSize" className="text-muted-foreground">Serving Size</Label>
                <Input
                  id="servingSize"
                  type="number"
                  value={servingSize}
                  onChange={(e) => setServingSize(e.target.value)}
                  placeholder="100"
                  className="bg-card border-border"
                  data-testid="input-serving-size"
                />
              </div>
              <div>
                <Label htmlFor="servingSizeUnit" className="text-muted-foreground">Unit</Label>
                <Select value={servingSizeUnit} onValueChange={setServingSizeUnit}>
                  <SelectTrigger className="bg-card border-border" data-testid="select-serving-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gram">g</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="cup">cup</SelectItem>
                    <SelectItem value="tbsp">tbsp</SelectItem>
                    <SelectItem value="tsp">tsp</SelectItem>
                    <SelectItem value="piece">piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="servingQuantity" className="text-muted-foreground">Quantity</Label>
                <Input
                  id="servingQuantity"
                  type="number"
                  step="0.5"
                  value={servingQuantity}
                  onChange={(e) => setServingQuantity(e.target.value)}
                  placeholder="1"
                  className="bg-card border-border"
                  data-testid="input-serving-quantity"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="calories" className="text-muted-foreground">Calories *</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="165"
                className="bg-card border-border"
                data-testid="input-meal-calories"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-calculates from macros below</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="protein" className="text-muted-foreground">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  step="0.1"
                  value={protein}
                  onChange={(e) => {
                    const newProtein = e.target.value;
                    setProtein(newProtein);
                    const p = parseFloat(newProtein) || 0;
                    const c = parseFloat(carbs) || 0;
                    const f = parseFloat(fat) || 0;
                    setCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="31"
                  className="bg-card border-border"
                  data-testid="input-meal-protein"
                />
              </div>
              <div>
                <Label htmlFor="carbs" className="text-muted-foreground">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  step="0.1"
                  value={carbs}
                  onChange={(e) => {
                    const newCarbs = e.target.value;
                    setCarbs(newCarbs);
                    const p = parseFloat(protein) || 0;
                    const c = parseFloat(newCarbs) || 0;
                    const f = parseFloat(fat) || 0;
                    setCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="0"
                  className="bg-card border-border"
                  data-testid="input-meal-carbs"
                />
              </div>
              <div>
                <Label htmlFor="fat" className="text-muted-foreground">Fat (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  step="0.1"
                  value={fat}
                  onChange={(e) => {
                    const newFat = e.target.value;
                    setFat(newFat);
                    const p = parseFloat(protein) || 0;
                    const c = parseFloat(carbs) || 0;
                    const f = parseFloat(newFat) || 0;
                    setCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="3.6"
                  className="bg-card border-border"
                  data-testid="input-meal-fat"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={addFoodMutation.isPending}
              className="w-full h-12 bg-primary hover:bg-primary/90"
              data-testid="button-save-food"
            >
              {addFoodMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Food"
              )}
            </Button>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your food history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
                data-testid="input-search-history"
              />
            </div>

            <div className="space-y-2">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No food history yet</p>
                  <p className="text-sm">Foods you add will appear here for quick re-adding</p>
                </div>
              ) : filteredHistory.map((item) => {
                const unitDisplay = item.defaultServingSizeUnit === "gram" ? "g" : item.defaultServingSizeUnit;
                const servingCals = Math.round((item.caloriesPer100 / 100) * item.defaultServingSize);
                const subtitle = item.brand 
                  ? `${servingCals} cal, ${item.defaultServingSize}${unitDisplay}, ${item.brand}`
                  : `${servingCals} cal, ${item.defaultServingSize}${unitDisplay}`;
                
                return renderListItem(
                  {
                    ...item,
                    servingSize: item.defaultServingSize,
                    servingSizeUnit: item.defaultServingSizeUnit,
                    calories: servingCals,
                    protein: Math.round((item.proteinPer100 || 0) / 100 * item.defaultServingSize),
                    carbs: Math.round((item.carbsPer100 || 0) / 100 * item.defaultServingSize),
                    fat: Math.round((item.fatPer100 || 0) / 100 * item.defaultServingSize),
                  },
                  "food",
                  item.id.toString(),
                  item.foodName,
                  subtitle,
                  `${servingCals} cal`
                );
              })}
            </div>
          </TabsContent>

          {/* Saved Meals Tab */}
          <TabsContent value="saved" className="mt-4">
            {savedMeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookmarkPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved meals yet</p>
                <p className="text-sm">Create meal templates to quickly log multiple foods at once</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedMeals.map((meal: any) => 
                  renderListItem(
                    meal,
                    "saved_meal",
                    meal.id.toString(),
                    meal.name,
                    meal.description || "Saved meal",
                    `${meal.totalCalories || 0} cal`,
                    "per serving"
                  )
                )}
              </div>
            )}
          </TabsContent>

          {/* Recipes Tab */}
          <TabsContent value="recipes" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
                data-testid="input-search-recipes"
              />
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recipes found</p>
                <p className="text-sm">Add recipes from the Nutrition section to log them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRecipes.map((recipe: any) => 
                  renderListItem(
                    recipe,
                    "recipe",
                    recipe.id.toString(),
                    recipe.title,
                    `${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""} | ${recipe.totalTime || 0} min`,
                    `${recipe.caloriesPerServing || recipe.calories || 0} cal`,
                    "per serving"
                  )
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
