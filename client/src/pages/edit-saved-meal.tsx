import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Trash2, Plus, Loader2 } from "lucide-react";

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

interface SavedMealTemplate {
  id: number;
  name: string;
  description?: string | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export default function EditSavedMeal() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const savedMealId = parseInt(params.id || "0");

  const [mealName, setMealName] = useState("");
  const [description, setDescription] = useState("");

  const { data: savedMealDetail, isLoading } = useQuery<{ template: SavedMealTemplate; items: SavedMealItem[] }>({
    queryKey: ["/api/nutrition/saved-meals", savedMealId],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/saved-meals/${savedMealId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saved meal");
      return res.json();
    },
    enabled: savedMealId > 0,
  });

  useEffect(() => {
    if (savedMealDetail?.template) {
      setMealName(savedMealDetail.template.name);
      setDescription(savedMealDetail.template.description || "");
    }
  }, [savedMealDetail]);

  const updateMealMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("PUT", `/api/nutrition/saved-meals/${savedMealId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/saved-meals"] });
      toast({ title: "Saved", description: "Meal updated successfully" });
      navigate("/nutrition/add-food?tab=saved");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update meal", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest("DELETE", `/api/nutrition/saved-meals/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/saved-meals", savedMealId] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/saved-meals"] });
      toast({ title: "Removed", description: "Food item removed from meal" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove item", variant: "destructive" });
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/nutrition/saved-meals/${savedMealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/saved-meals"] });
      toast({ title: "Deleted", description: "Meal deleted" });
      navigate("/nutrition");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete meal", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!mealName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for this meal", variant: "destructive" });
      return;
    }
    updateMealMutation.mutate({ name: mealName.trim(), description: description.trim() });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!savedMealDetail) {
    return (
      <div className="min-h-screen bg-background p-4">
        <p className="text-center text-muted-foreground">Meal not found</p>
      </div>
    );
  }

  const { template, items } = savedMealDetail;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate("/nutrition")} 
            className="p-1"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Edit Meal</h1>
          <button 
            onClick={handleSave}
            disabled={updateMealMutation.isPending}
            className="text-primary font-medium"
            data-testid="button-save"
          >
            {updateMealMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Name input */}
        <div>
          <Label className="text-muted-foreground text-sm">Meal Name</Label>
          <Input
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="e.g., Breakfast Bowl"
            className="bg-card border-border mt-1"
            data-testid="input-meal-name"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="text-muted-foreground text-sm">Description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quick and healthy breakfast"
            className="bg-card border-border mt-1"
            data-testid="input-description"
          />
        </div>

        {/* Nutrition Summary */}
        <div className="bg-card rounded-lg p-4">
          <h3 className="font-medium mb-3">Nutrition Summary</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{template.totalCalories}</p>
              <p className="text-xs text-muted-foreground">Calories</p>
            </div>
            <div>
              <p className="text-xl font-bold">{Math.round(template.totalProtein)}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div>
              <p className="text-xl font-bold">{Math.round(template.totalCarbs)}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div>
              <p className="text-xl font-bold">{Math.round(template.totalFat)}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </div>

        {/* Meal Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Meal Items</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-primary"
              onClick={() => toast({ title: "Coming Soon", description: "Add food to saved meal will be available soon" })}
              data-testid="button-add-item"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No items in this meal</p>
            ) : (
              items.map((item) => {
                const unitDisplay = item.servingSizeUnit === "gram" ? "g" : item.servingSizeUnit;
                return (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-card rounded-lg"
                    data-testid={`item-${item.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.foodName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.brand && `${item.brand}, `}
                        {item.servingSize} {unitDisplay}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{item.calories} cal</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                        disabled={deleteItemMutation.isPending}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Delete Meal Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (confirm("Are you sure you want to delete this meal?")) {
              deleteMealMutation.mutate();
            }
          }}
          disabled={deleteMealMutation.isPending}
          data-testid="button-delete-meal"
        >
          {deleteMealMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</>
          ) : (
            "Delete Meal"
          )}
        </Button>
      </div>
    </div>
  );
}
