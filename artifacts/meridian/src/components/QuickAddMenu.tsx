import { useState, useEffect } from "react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Utensils, MapPin, Image, Scale, ChevronLeft, Droplets, Calendar, X, Loader2, Search, Plus, Clock, History, BookmarkPlus, ChefHat, ScanBarcode } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WorkoutSelector from "@/components/calendar/WorkoutSelector";
import ActivityLogForm from "@/components/ActivityLogForm";
import CalendarPopup from "@/components/CalendarPopup";
import HydrationModal from "@/components/HydrationModal";

interface QuickAddMenuProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  initialView?: ViewType;
  initialMealCategory?: string;
}

type ViewType = 'menu' | 'workout' | 'meal' | 'photo' | 'bodyStats' | 'hydration';

export default function QuickAddMenu({ open, onClose, selectedDate: initialDate = new Date(), onDateSelect, initialView, initialMealCategory }: QuickAddMenuProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  // Get current path (without query params) to pass as "from" for navigation back
  const currentPath = location.split('?')[0];
  const [currentView, setCurrentView] = useState<ViewType>(initialView || 'menu');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHydrationModal, setShowHydrationModal] = useState(false);
  // Internal state to track selected date - allows changing date within the menu
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  
  // Meal form state
  const [mealCategory, setMealCategory] = useState(initialMealCategory || 'Meal 1');
  
  // Reset view and category when opening with initial values
  useEffect(() => {
    if (open) {
      if (initialView) setCurrentView(initialView);
      if (initialMealCategory) setMealCategory(initialMealCategory);
    }
  }, [open, initialView, initialMealCategory]);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  
  const resetMealForm = () => {
    setMealCategory(mealOptions[0] || 'Meal 1');
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setBrand('');
    setServingSize('100');
    setServingSizeUnit('g');
    setServingQuantity('1');
    setMealTime('');
    setActiveTab('manual');
    setSearchQuery('');
  };
  
  // Food form additional state
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingSizeUnit, setServingSizeUnit] = useState('g');
  const [servingQuantity, setServingQuantity] = useState('1');
  const [mealTime, setMealTime] = useState('');
  const [activeTab, setActiveTab] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Meal categories (same source as the macro tracker)
  const { data: mealCategories = [] } = useQuery<{ id: number; name: string; displayOrder: number }[]>({
    queryKey: ['/api/nutrition/meal-categories'],
  });
  const mealOptions = mealCategories.length > 0
    ? mealCategories.map(c => c.name)
    : ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4'];

  // Queries for history, saved meals, and recipes
  const { data: foodHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/nutrition/history'],
    enabled: currentView === 'meal',
  });
  
  const { data: savedMeals = [] } = useQuery<any[]>({
    queryKey: ['/api/nutrition/saved-meals'],
    enabled: currentView === 'meal',
  });
  
  const { data: recipes = [] } = useQuery<any[]>({
    queryKey: ['/api/recipes'],
    enabled: currentView === 'meal',
  });
  
  const filteredHistory = searchQuery 
    ? foodHistory.filter((f: any) => 
        f.foodName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : foodHistory;
    
  const filteredRecipes = searchQuery
    ? recipes.filter((r: any) =>
        r.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recipes;
  
  // Enhanced food mutation using new API
  const addFoodMutation = useMutation({
    mutationFn: async (data: { mealName: string; foodName: string; brand?: string; servingSize: number; servingSizeUnit: string; servingQuantity: number; calories: number; protein: number; carbs: number; fat: number }) => {
      return await apiRequest('POST', '/api/nutrition/meals/food', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/food'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/history'] });
      toast({ title: "Success", description: "Food logged successfully!" });
      resetMealForm();
      handleClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log food", variant: "destructive" });
    },
  });
  
  // Add recipe to meal
  const addRecipeMutation = useMutation({
    mutationFn: async ({ recipeId, mealName, servings }: { recipeId: number; mealName: string; servings: number }) => {
      return await apiRequest('POST', `/api/nutrition/recipes/${recipeId}/log`, { mealName, servings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/food'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      toast({ title: "Success", description: "Recipe added to meal!" });
      resetMealForm();
      handleClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add recipe", variant: "destructive" });
    },
  });
  
  // Add saved meal to log
  const addSavedMealMutation = useMutation({
    mutationFn: async ({ savedMealId, mealName, servings }: { savedMealId: number; mealName: string; servings: number }) => {
      return await apiRequest('POST', `/api/nutrition/saved-meals/${savedMealId}/log`, { mealName, servings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/food'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      toast({ title: "Success", description: "Saved meal added!" });
      resetMealForm();
      handleClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add saved meal", variant: "destructive" });
    },
  });
  
  // Reset selected date when menu opens
  useEffect(() => {
    if (open) {
      setSelectedDate(initialDate);
    }
  }, [open, initialDate]);
  
  const getDateButtonText = () => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const selectedStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (todayStr === selectedStr) return 'Today';
    
    const daysAhead = differenceInDays(selectedDate, today);
    if (daysAhead > 0) {
      return `${daysAhead} day${daysAhead === 1 ? '' : 's'}`;
    }
    
    return format(selectedDate, 'MMM d');
  };
  
  const dateButtonText = getDateButtonText();

  const handleClose = () => {
    setCurrentView('menu');
    onClose();
  };

  const handleWorkout = () => {
    setCurrentView('workout');
  };

  const handleMeal = () => {
    setCurrentView('meal');
  };

  const handleBodyMap = () => {
    handleClose();
    // Navigate to body map page with date param and source path for navigation back
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLocation(`/training/body-map?date=${dateStr}&from=${encodeURIComponent(currentPath)}`);
  };

  const handlePhotos = () => {
    handleClose();
    // Navigate to progress photos page with selected date and source path
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLocation(`/my-progress/photos?date=${dateStr}&from=${encodeURIComponent(currentPath)}`);
  };

  const handleBodyStats = () => {
    handleClose();
    // Navigate to progress add entry page with selected date and source path
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLocation(`/my-progress/add?date=${dateStr}&from=${encodeURIComponent(currentPath)}`);
  };

  const handleWater = () => {
    setShowHydrationModal(true);
  };

  const handleBackToMenu = () => {
    setCurrentView('menu');
  };

  const handleSelectWorkout = (workout: any) => {
    handleClose();
    
    // If it's a programme workout (has enrollmentId), navigate to programme workout view
    if (workout.enrollmentId && workout.week && workout.day) {
      setLocation(`/workout-detail/${workout.enrollmentId}/${workout.week}/${workout.day}`);
    } else if (workout.id) {
      // For library workouts, navigate to training workout detail
      // Extract numeric ID if it's prefixed
      const workoutId = typeof workout.id === 'string' && workout.id.includes('-') 
        ? workout.id.split('-').pop() 
        : workout.id;
      setLocation(`/training/workout/${workoutId}`);
    }
  };

  // CRITICAL: Return null when not open - this applies to ALL views
  if (!open) return null;

  // Show workout selector
  if (currentView === 'workout') {
    return (
      <WorkoutSelector
        selectedDate={selectedDate}
        onBack={handleBackToMenu}
        onSelectWorkout={handleSelectWorkout}
      />
    );
  }

  // Show simplified meal form
  if (currentView === 'meal') {
    const handleSubmitMeal = () => {
      if (!foodName) {
        toast({ title: "Error", description: "Food name is required", variant: "destructive" });
        return;
      }
      addFoodMutation.mutate({
        mealName: mealCategory,
        foodName,
        brand: undefined,
        servingSize: parseFloat(servingSize) || 100,
        servingSizeUnit: servingSizeUnit,
        servingQuantity: parseFloat(servingQuantity) || 1,
        calories: parseInt(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      });
    };
    
    const handleScanBarcode = () => {
      toast({ title: "Coming Soon", description: "Barcode scanning will be available in the mobile app", variant: "default" });
    };
    
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-card rounded-2xl max-w-md w-full shadow-2xl border border-border">
          <div className="bg-card text-foreground px-6 py-4 flex items-center justify-between rounded-t-2xl border-b border-border">
            <h1 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Utensils className="h-5 w-5" />
              Log Food
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToMenu}
              className="text-foreground hover:bg-muted h-8 w-8"
              data-testid="button-close-meal-modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Meal Category */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Meal</Label>
              <Select value={mealCategory} onValueChange={setMealCategory}>
                <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-meal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {mealOptions.map(name => (
                    <SelectItem key={name} value={name} className="text-foreground">{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Food Name with Barcode Scanner */}
            <div>
              <Label htmlFor="foodName" className="text-muted-foreground">Food Name</Label>
              <div className="flex gap-2">
                <Input
                  id="foodName"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g., Chicken Breast"
                  className="flex-1 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-food-name"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleScanBarcode}
                  className="border-border text-muted-foreground hover:bg-card hover:text-primary"
                  data-testid="button-scan-barcode"
                >
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Serving Size / Unit / Quantity */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-muted-foreground">Serving Size</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={servingSize}
                  onChange={(e) => setServingSize(e.target.value)}
                  placeholder="100"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-serving-size"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Unit</Label>
                <Select value={servingSizeUnit} onValueChange={setServingSizeUnit}>
                  <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-serving-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                    <SelectItem value="cup">cup</SelectItem>
                    <SelectItem value="tbsp">tbsp</SelectItem>
                    <SelectItem value="tsp">tsp</SelectItem>
                    <SelectItem value="piece">piece</SelectItem>
                    <SelectItem value="serving">serving</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground">Quantity</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={servingQuantity}
                  onChange={(e) => setServingQuantity(e.target.value)}
                  placeholder="1"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-serving-quantity"
                />
              </div>
            </div>

            {/* Calories */}
            <div>
              <Label htmlFor="calories" className="text-muted-foreground">Calories</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="0"
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-meal-calories"
              />
            </div>
            
            {/* Macros */}
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
                  placeholder="0"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
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
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
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
                  placeholder="0"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-meal-fat"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleBackToMenu}
                className="flex-1 border-border text-muted-foreground hover:bg-card"
                data-testid="button-cancel-meal"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitMeal}
                disabled={addFoodMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
                data-testid="button-save-meal"
              >
                {addFoodMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Food'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show photo form
  if (currentView === 'photo') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="bg-card text-foreground px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToMenu}
            className="text-foreground hover:bg-muted"
            data-testid="button-back-photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">Log Progress Photo</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 bg-white overflow-auto p-6">
          <ActivityLogForm
            activityType="photo"
            selectedDate={selectedDate}
            onSuccess={handleClose}
            onCancel={handleBackToMenu}
          />
        </div>
      </div>
    );
  }

  // Show body stats form
  if (currentView === 'bodyStats') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="bg-card text-foreground px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToMenu}
            className="text-foreground hover:bg-muted"
            data-testid="button-back-bodystats"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">Log Body Stats</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 bg-white overflow-auto p-6">
          <ActivityLogForm
            activityType="bodyStats"
            selectedDate={selectedDate}
            onSuccess={handleClose}
            onCancel={handleBackToMenu}
          />
        </div>
      </div>
    );
  }

  // Show menu
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/75 z-50"
        onClick={handleClose}
        data-testid="overlay-action-menu"
      >
        {/* Date Picker Button - Top Right Corner */}
        <div className="fixed top-6 right-5 z-50" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCalendar(true)}
            className="text-foreground hover:bg-white/20 flex items-center gap-2"
            data-testid="button-date-picker"
          >
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">{dateButtonText}</span>
          </Button>
        </div>

        <div 
          className="fixed bottom-6 right-5 flex flex-col items-end gap-1"
          onClick={(e) => e.stopPropagation()}
          data-testid="dialog-action-menu"
        >
          <ActionButton
            icon={<Dumbbell className="h-6 w-6" />}
            label="Workout"
            colour="bg-blue-500"
            onClick={handleWorkout}
            testId="button-action-workout"
          />
          <ActionButton
            icon={<Utensils className="h-6 w-6" />}
            label="Meal"
            colour="bg-orange-500"
            onClick={handleMeal}
            testId="button-action-meal"
          />
          <ActionButton
            icon={<Droplets className="h-6 w-6" />}
            label="Water"
            colour="bg-cyan-500"
            onClick={handleWater}
            testId="button-action-water"
          />
          <ActionButton
            icon={<MapPin className="h-6 w-6" />}
            label="Body Map"
            colour="bg-purple-500"
            onClick={handleBodyMap}
            testId="button-action-bodymap"
          />
          <ActionButton
            icon={<Image className="h-6 w-6" />}
            label="Photos"
            colour="bg-[#0cc9a9]"
            onClick={handlePhotos}
            testId="button-action-photos"
          />
          <ActionButton
            icon={<Scale className="h-6 w-6" />}
            label="Body stats"
            colour="bg-teal-500"
            onClick={handleBodyStats}
            testId="button-action-body-stats"
          />
        </div>
      </div>

      <CalendarPopup
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          onDateSelect?.(date);
          setShowCalendar(false);
        }}
      />

      <HydrationModal 
        open={showHydrationModal}
        onClose={() => setShowHydrationModal(false)}
      />
    </>
  );
}

function ActionButton({ 
  icon, 
  label, 
  colour, 
  onClick,
  testId 
}: { 
  icon: React.ReactNode; 
  label: string; 
  colour: string; 
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-2 p-3 rounded-xl transition-colors"
      data-testid={testId}
    >
      <span className="text-lg font-bold text-white whitespace-nowrap text-right flex-1 drop-shadow-lg" style={{textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'}}>{label}</span>
      <div className={`${colour} p-3 rounded-full text-white flex-shrink-0`}>
        {icon}
      </div>
    </button>
  );
}
