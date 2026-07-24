import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, ChevronRight, BookmarkPlus, Utensils, X, Loader2 } from "lucide-react";
import TopHeader from "@/components/TopHeader";

interface SavedMealItem {
  id: number;
  savedMealId: number;
  foodName: string;
  brand?: string | null;
  servingSize: number;
  servingSizeUnit: string;
  servingQuantity: number;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

interface SavedMealTemplate {
  id: number;
  userId: string;
  name: string;
  description?: string | null;
  items?: SavedMealItem[];
}

export default function MyMeals() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<SavedMealTemplate | null>(null);
  
  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [foodBrand, setFoodBrand] = useState("");
  const [servingSize, setServingSize] = useState("100");
  const [servingSizeUnit, setServingSizeUnit] = useState("gram");
  const [servingQuantity, setServingQuantity] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const { data: savedMealsRaw = [], isLoading } = useQuery<SavedMealTemplate[]>({
    queryKey: ['/api/nutrition/saved-meals'],
  });
  
  const [savedMealsWithItems, setSavedMealsWithItems] = useState<SavedMealTemplate[]>([]);
  
  const fetchAllMealDetails = async () => {
    const mealsWithItems = await Promise.all(
      savedMealsRaw.map(async (meal) => {
        try {
          const response = await fetch(`/api/nutrition/saved-meals/${meal.id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            return { ...data.template, items: data.items || [] };
          }
        } catch (e) {
          console.error("Failed to fetch meal details:", e);
        }
        return meal;
      })
    );
    setSavedMealsWithItems(mealsWithItems);
  };
  
  useEffect(() => {
    if (savedMealsRaw.length > 0) {
      fetchAllMealDetails();
    }
  }, [savedMealsRaw]);
  
  const savedMeals = savedMealsWithItems.length > 0 ? savedMealsWithItems : savedMealsRaw;

  const createMealMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return await apiRequest('POST', '/api/nutrition/saved-meals', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/saved-meals'] });
      toast({ title: "Success", description: "Saved meal created!" });
      setShowCreateModal(false);
      resetMealForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create saved meal", variant: "destructive" });
    },
  });

  const updateMealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; description?: string } }) => {
      return await apiRequest('PUT', `/api/nutrition/saved-meals/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/saved-meals'] });
      toast({ title: "Success", description: "Saved meal updated!" });
      setShowEditModal(false);
      setSelectedMeal(null);
      resetMealForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update saved meal", variant: "destructive" });
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/nutrition/saved-meals/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/saved-meals'] });
      toast({ title: "Deleted", description: "Saved meal removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete saved meal", variant: "destructive" });
    },
  });

  const addFoodItemMutation = useMutation({
    mutationFn: async ({ mealId, data }: { mealId: number; data: any }) => {
      return await apiRequest('POST', `/api/nutrition/saved-meals/${mealId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/saved-meals'] });
      if (selectedMeal) {
        fetchMealDetails(selectedMeal.id);
      }
      toast({ title: "Success", description: "Food item added!" });
      setShowAddFoodModal(false);
      resetFoodForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add food item", variant: "destructive" });
    },
  });

  const deleteFoodItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest('DELETE', `/api/nutrition/saved-meals/items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/saved-meals'] });
      if (selectedMeal) {
        fetchMealDetails(selectedMeal.id);
      }
      toast({ title: "Deleted", description: "Food item removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete food item", variant: "destructive" });
    },
  });

  const fetchMealDetails = async (mealId: number) => {
    try {
      const response = await fetch(`/api/nutrition/saved-meals/${mealId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedMeal({
          ...data.template,
          items: data.items || [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch meal details:", error);
    }
  };

  const resetMealForm = () => {
    setMealName("");
    setMealDescription("");
  };

  const resetFoodForm = () => {
    setFoodName("");
    setFoodBrand("");
    setServingSize("100");
    setServingSizeUnit("gram");
    setServingQuantity("1");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const handleCreateMeal = () => {
    if (!mealName.trim()) {
      toast({ title: "Error", description: "Meal name is required", variant: "destructive" });
      return;
    }
    createMealMutation.mutate({
      name: mealName,
      description: mealDescription || undefined,
    });
  };

  const handleUpdateMeal = () => {
    if (!selectedMeal || !mealName.trim()) {
      toast({ title: "Error", description: "Meal name is required", variant: "destructive" });
      return;
    }
    updateMealMutation.mutate({
      id: selectedMeal.id,
      data: {
        name: mealName,
        description: mealDescription || undefined,
      },
    });
  };

  const handleAddFoodItem = () => {
    if (!selectedMeal || !foodName.trim() || !calories) {
      toast({ title: "Error", description: "Food name and calories are required", variant: "destructive" });
      return;
    }
    addFoodItemMutation.mutate({
      mealId: selectedMeal.id,
      data: {
        foodName,
        brand: foodBrand || undefined,
        servingSize: parseFloat(servingSize) || 100,
        servingSizeUnit,
        servingQuantity: parseFloat(servingQuantity) || 1,
        calories: parseInt(calories) || 0,
        protein: protein ? parseFloat(protein) : 0,
        carbs: carbs ? parseFloat(carbs) : 0,
        fat: fat ? parseFloat(fat) : 0,
      },
    });
  };

  const openEditModal = (meal: SavedMealTemplate) => {
    setMealName(meal.name);
    setMealDescription(meal.description || "");
    fetchMealDetails(meal.id);
    setShowEditModal(true);
  };

  const calculateMealTotals = (items: SavedMealItem[] = []) => {
    return items.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading saved meals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="My Saved Meals" onBack={() => navigate("/nutrition")} />
      
      <div className="p-4 space-y-4">
        <Button
          onClick={() => {
            resetMealForm();
            setShowCreateModal(true);
          }}
          className="w-full bg-primary hover:bg-primary/90"
          data-testid="button-create-saved-meal"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Saved Meal
        </Button>

        {savedMeals.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="py-12 text-center">
              <BookmarkPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Saved Meals Yet</h3>
              <p className="text-muted-foreground text-sm">
                Create meal templates to quickly log your favorite food combinations
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {savedMeals.map((meal) => {
              const totals = calculateMealTotals(meal.items);
              const itemCount = meal.items?.length || 0;
              return (
                <Card key={meal.id} className="bg-card cursor-pointer" onClick={() => openEditModal(meal)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{meal.name}</h3>
                          {itemCount > 0 && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                              {itemCount} item{itemCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {meal.description && (
                          <p className="text-sm text-muted-foreground">{meal.description}</p>
                        )}
                        {itemCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {totals.calories} cal | P:{Math.round(totals.protein)}g C:{Math.round(totals.carbs)}g F:{Math.round(totals.fat)}g
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(meal);
                          }}
                          data-testid={`button-edit-meal-${meal.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMealMutation.mutate(meal.id);
                          }}
                          data-testid={`button-delete-meal-${meal.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Saved Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-slate-300">Meal Name *</Label>
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., My Breakfast Bowl"
                className="bg-card border-border text-foreground"
                data-testid="input-meal-name"
              />
            </div>
            <div>
              <Label className="text-slate-300">Description (optional)</Label>
              <Input
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                placeholder="e.g., High protein morning meal"
                className="bg-card border-border text-foreground"
                data-testid="input-meal-description"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border-border text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMeal}
                disabled={createMealMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
                data-testid="button-save-new-meal"
              >
                {createMealMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Meal"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) setSelectedMeal(null);
      }}>
        <DialogContent className="bg-background border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Saved Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-slate-300">Meal Name *</Label>
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., My Breakfast Bowl"
                className="bg-card border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-slate-300">Description (optional)</Label>
              <Input
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                placeholder="e.g., High protein morning meal"
                className="bg-card border-border text-foreground"
              />
            </div>
            
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">Food Items</h4>
                <Button
                  size="sm"
                  onClick={() => {
                    resetFoodForm();
                    setShowAddFoodModal(true);
                  }}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="button-add-food-to-meal"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Food
                </Button>
              </div>
              
              {(!selectedMeal?.items || selectedMeal.items.length === 0) ? (
                <div className="text-center py-6 text-slate-400">
                  <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No food items yet</p>
                  <p className="text-xs">Add foods to build your meal template</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedMeal.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-lg">
                      <div className="flex-1">
                        <p className="text-foreground font-medium">{item.foodName}</p>
                        {item.brand && <p className="text-slate-400 text-xs">{item.brand}</p>}
                        <p className="text-slate-500 text-xs">
                          {item.servingQuantity} × {item.servingSize}{item.servingSizeUnit === 'gram' ? 'g' : item.servingSizeUnit}
                        </p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-primary font-medium">{item.calories} cal</p>
                        <p className="text-slate-400 text-xs">
                          P:{item.protein || 0}g C:{item.carbs || 0}g F:{item.fat || 0}g
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteFoodItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {selectedMeal.items.length > 0 && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-slate-300 font-medium">Meal Totals</p>
                      {(() => {
                        const totals = calculateMealTotals(selectedMeal.items);
                        return (
                          <p className="text-primary text-sm">
                            {totals.calories} cal | P:{Math.round(totals.protein)}g C:{Math.round(totals.carbs)}g F:{Math.round(totals.fat)}g
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1 border-border text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMeal}
                disabled={updateMealMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {updateMealMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFoodModal} onOpenChange={setShowAddFoodModal}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Food Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-slate-300">Food Name *</Label>
              <Input
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g., Chicken Breast"
                className="bg-card border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-slate-300">Brand (optional)</Label>
              <Input
                value={foodBrand}
                onChange={(e) => setFoodBrand(e.target.value)}
                placeholder="e.g., Tyson"
                className="bg-card border-border text-foreground"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-300">Serving Size</Label>
                <Input
                  type="number"
                  value={servingSize}
                  onChange={(e) => setServingSize(e.target.value)}
                  placeholder="100"
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-slate-300">Unit</Label>
                <Select value={servingSizeUnit} onValueChange={setServingSizeUnit}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="gram" className="text-foreground">g</SelectItem>
                    <SelectItem value="oz" className="text-foreground">oz</SelectItem>
                    <SelectItem value="ml" className="text-foreground">ml</SelectItem>
                    <SelectItem value="cup" className="text-foreground">cup</SelectItem>
                    <SelectItem value="tbsp" className="text-foreground">tbsp</SelectItem>
                    <SelectItem value="tsp" className="text-foreground">tsp</SelectItem>
                    <SelectItem value="piece" className="text-foreground">piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Quantity</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={servingQuantity}
                  onChange={(e) => setServingQuantity(e.target.value)}
                  placeholder="1"
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Calories *</Label>
              <Input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="165"
                className="bg-card border-border text-foreground"
              />
              <p className="text-xs text-slate-500 mt-1">Auto-calculates from macros below</p>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-300">Protein (g)</Label>
                <Input
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
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-slate-300">Carbs (g)</Label>
                <Input
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
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-slate-300">Fat (g)</Label>
                <Input
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
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddFoodModal(false)}
                className="flex-1 border-border text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddFoodItem}
                disabled={addFoodItemMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {addFoodItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add Food"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
