import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Utensils, PieChart, Pill, Droplets, Plus, Minus, ChevronRight, TrendingUp, Calculator, Check, Trash2, Edit2, X, Sparkles, Info, ChevronDown, ChevronUp, Flag, MoreHorizontal, RefreshCw, Settings, History, Calendar, Brain, Zap, BarChart3, BookOpen, ThumbsUp, ThumbsDown, Loader2, MessageSquare } from "lucide-react";

const isEatenToday = (ateTodayDate: Date | string | null): boolean => {
  if (!ateTodayDate) return false;
  const eatenDate = new Date(ateTodayDate);
  const today = new Date();
  return eatenDate.toDateString() === today.toDateString();
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import QuickAddMenu from "@/components/QuickAddMenu";
import RecipesList from "@/components/RecipesList";
import SupplementsTab from "@/components/SupplementsTab";
import type { Recipe, FoodLog, HydrationLog, HydrationGoal } from "@shared/schema";

interface ExtendedFoodLog extends FoodLog {
  servingSize?: number;
  servingSizeUnit?: string;
  servingQuantity?: number;
  sourceType?: string;
  sourceId?: number;
  mealLogId?: number;
}

interface NutritionData {
  goal: {
    calorieTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
  };
  logs: ExtendedFoodLog[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  mealBreakdown: Record<string, ExtendedFoodLog[]>;
}

interface SupplementWithStatus {
  id: number;
  name: string;
  dosage?: string | null;
  timeOfDay: string;
  takenToday: boolean;
  frequency?: number;
  lastTakenDate?: string | null;
}

const isSupplementDueToday = (supplement: SupplementWithStatus): boolean => {
  const frequency = supplement.frequency || 1;
  if (frequency === 1) return true;
  
  if (!supplement.lastTakenDate) return true;
  
  const lastTaken = new Date(supplement.lastTakenDate);
  lastTaken.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLastTaken = Math.floor((today.getTime() - lastTaken.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceLastTaken >= frequency;
};

const getTodayTimeOfDay = () => {
  const hour = new Date().getHours();
  return hour < 18 ? 'morning' : 'evening';
};

const getColorClass = (percentage: number) => {
  if (percentage < 33) return 'text-blue-500';
  if (percentage < 66) return 'text-cyan-400';
  return 'text-green-400';
};

// Recommended supplements list with detailed info
interface RecommendedSupplement {
  name: string;
  category: string;
  timeOfDay: string;
  description: string;
  benefits: string[];
  recommendedDose: string;
  suitableFor: string[];
  notSuitableFor: string[];
}

const RECOMMENDED_SUPPLEMENTS: RecommendedSupplement[] = [
  { 
    name: 'Vitamin D3', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Essential fat-soluble vitamin that supports bone health, immune function, and mood regulation.',
    benefits: ['Bone health', 'Immune support', 'Mood regulation', 'Muscle function'],
    recommendedDose: '2000-5000 IU daily',
    suitableFor: ['Most adults', 'Those with limited sun exposure', 'People in northern climates'],
    notSuitableFor: ['Those with hypercalcemia', 'Kidney disease (consult doctor)']
  },
  { 
    name: 'Omega-3 Fish Oil', 
    category: 'Essential Fats', 
    timeOfDay: 'morning',
    description: 'Essential fatty acids EPA and DHA that support heart, brain, and joint health.',
    benefits: ['Heart health', 'Brain function', 'Joint support', 'Reduces inflammation'],
    recommendedDose: '1000-3000mg EPA+DHA daily',
    suitableFor: ['Most adults', 'Athletes', 'Those with inflammation'],
    notSuitableFor: ['Fish allergy', 'Blood thinning medications (consult doctor)']
  },
  { 
    name: 'Magnesium Glycinate', 
    category: 'Minerals', 
    timeOfDay: 'evening',
    description: 'Highly absorbable form of magnesium that supports sleep, muscle relaxation, and stress relief.',
    benefits: ['Sleep quality', 'Muscle relaxation', 'Stress reduction', 'Nerve function'],
    recommendedDose: '200-400mg daily',
    suitableFor: ['Most adults', 'Those with sleep issues', 'Athletes', 'Stress/anxiety'],
    notSuitableFor: ['Kidney disease', 'Heart block']
  },
  { 
    name: 'Vitamin B Complex', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Group of 8 B vitamins essential for energy metabolism and nervous system function.',
    benefits: ['Energy production', 'Brain function', 'Red blood cell formation', 'Mood support'],
    recommendedDose: '1 capsule daily with food',
    suitableFor: ['Most adults', 'Vegetarians/vegans', 'Those with fatigue'],
    notSuitableFor: ['Generally safe for most people']
  },
  { 
    name: 'Zinc', 
    category: 'Minerals', 
    timeOfDay: 'evening',
    description: 'Essential mineral for immune function, wound healing, and hormone production.',
    benefits: ['Immune support', 'Wound healing', 'Testosterone support', 'Skin health'],
    recommendedDose: '15-30mg daily',
    suitableFor: ['Most adults', 'Athletes', 'Those with immune concerns'],
    notSuitableFor: ['Copper deficiency (long-term use)', 'Take separately from iron']
  },
  { 
    name: 'Vitamin C', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Powerful antioxidant that supports immune function and collagen synthesis.',
    benefits: ['Immune support', 'Antioxidant', 'Collagen production', 'Iron absorption'],
    recommendedDose: '500-1000mg daily',
    suitableFor: ['Most adults', 'Smokers', 'Those under stress'],
    notSuitableFor: ['Kidney stones history (high doses)', 'Hemochromatosis']
  },
  { 
    name: 'Probiotics', 
    category: 'Gut Health', 
    timeOfDay: 'morning',
    description: 'Beneficial bacteria that support digestive health and immune function.',
    benefits: ['Gut health', 'Digestion', 'Immune support', 'Mental wellbeing'],
    recommendedDose: '10-50 billion CFU daily',
    suitableFor: ['Most adults', 'After antibiotics', 'Digestive issues'],
    notSuitableFor: ['Severely immunocompromised', 'Critical illness']
  },
  { 
    name: 'Creatine Monohydrate', 
    category: 'Performance', 
    timeOfDay: 'morning',
    description: 'Most researched sports supplement for strength, power, and muscle building.',
    benefits: ['Strength gains', 'Muscle growth', 'Power output', 'Brain function'],
    recommendedDose: '3-5g daily',
    suitableFor: ['Athletes', 'Strength trainers', 'Older adults'],
    notSuitableFor: ['Kidney disease', 'Ensure adequate hydration']
  },
  { 
    name: 'Ashwagandha', 
    category: 'Adaptogens', 
    timeOfDay: 'evening',
    description: 'Adaptogenic herb that helps the body manage stress and supports hormonal balance.',
    benefits: ['Stress reduction', 'Sleep quality', 'Testosterone support', 'Anxiety relief'],
    recommendedDose: '300-600mg daily (KSM-66 extract)',
    suitableFor: ['Those with stress/anxiety', 'Athletes', 'Sleep issues'],
    notSuitableFor: ['Thyroid conditions', 'Pregnancy', 'Autoimmune diseases']
  },
  { 
    name: 'L-Theanine', 
    category: 'Focus', 
    timeOfDay: 'morning',
    description: 'Amino acid from tea that promotes calm focus without drowsiness.',
    benefits: ['Calm focus', 'Reduces anxiety', 'Improves sleep', 'Pairs well with caffeine'],
    recommendedDose: '100-200mg daily',
    suitableFor: ['Most adults', 'Those with anxiety', 'Coffee drinkers'],
    notSuitableFor: ['Generally very safe']
  },
  { 
    name: 'Collagen Peptides', 
    category: 'Recovery', 
    timeOfDay: 'morning',
    description: 'Protein that supports skin, joint, and connective tissue health.',
    benefits: ['Skin elasticity', 'Joint health', 'Hair/nail growth', 'Gut lining support'],
    recommendedDose: '10-20g daily',
    suitableFor: ['Most adults', 'Athletes', 'Aging skin concerns', 'Joint issues'],
    notSuitableFor: ['Generally safe', 'Avoid if allergic to source (bovine/marine)']
  },
  { 
    name: 'CoQ10', 
    category: 'Energy', 
    timeOfDay: 'morning',
    description: 'Coenzyme essential for cellular energy production and antioxidant protection.',
    benefits: ['Energy production', 'Heart health', 'Antioxidant', 'Statin side effect relief'],
    recommendedDose: '100-200mg daily',
    suitableFor: ['Those on statins', 'Heart concerns', 'Aging adults'],
    notSuitableFor: ['Blood thinners (consult doctor)']
  },
  { 
    name: 'Turmeric/Curcumin', 
    category: 'Anti-Inflammatory', 
    timeOfDay: 'afternoon',
    description: 'Powerful anti-inflammatory compound from turmeric root.',
    benefits: ['Reduces inflammation', 'Joint pain relief', 'Antioxidant', 'Brain health'],
    recommendedDose: '500-1000mg curcumin with piperine',
    suitableFor: ['Joint pain', 'Inflammation', 'Athletes'],
    notSuitableFor: ['Blood thinners', 'Gallbladder issues', 'Surgery (stop 2 weeks before)']
  },
  { 
    name: 'Melatonin', 
    category: 'Sleep', 
    timeOfDay: 'evening',
    description: 'Natural hormone that regulates sleep-wake cycles.',
    benefits: ['Sleep onset', 'Jet lag relief', 'Sleep quality', 'Antioxidant'],
    recommendedDose: '0.5-5mg 30min before bed',
    suitableFor: ['Sleep difficulties', 'Jet lag', 'Shift workers'],
    notSuitableFor: ['Pregnancy', 'Autoimmune conditions', 'Long-term use without breaks']
  },
  { 
    name: 'Electrolytes', 
    category: 'Hydration', 
    timeOfDay: 'morning',
    description: 'Essential minerals for hydration, muscle function, and nerve signaling.',
    benefits: ['Hydration', 'Muscle cramps prevention', 'Energy', 'Exercise performance'],
    recommendedDose: 'As needed with activity/sweating',
    suitableFor: ['Athletes', 'Heavy sweaters', 'Low-carb dieters', 'Hot climates'],
    notSuitableFor: ['Kidney disease', 'Heart failure (consult doctor)']
  },
  { 
    name: 'Iron', 
    category: 'Minerals', 
    timeOfDay: 'afternoon',
    description: 'Essential mineral for oxygen transport and energy production.',
    benefits: ['Energy levels', 'Oxygen transport', 'Cognitive function', 'Immune support'],
    recommendedDose: '18mg daily (varies by need)',
    suitableFor: ['Iron deficiency', 'Heavy menstruation', 'Vegetarians'],
    notSuitableFor: ['Hemochromatosis', 'Without confirmed deficiency']
  },
  { 
    name: 'Vitamin K2', 
    category: 'Vitamins', 
    timeOfDay: 'morning',
    description: 'Fat-soluble vitamin that directs calcium to bones and away from arteries.',
    benefits: ['Bone health', 'Arterial health', 'Dental health', 'Works with D3'],
    recommendedDose: '100-200mcg MK-7 daily',
    suitableFor: ['Those taking D3', 'Bone health concerns', 'Heart health'],
    notSuitableFor: ['Blood thinners (warfarin)', 'Consult doctor']
  },
  { 
    name: 'Alpha Lipoic Acid', 
    category: 'Antioxidants', 
    timeOfDay: 'afternoon',
    description: 'Universal antioxidant that supports cellular energy and blood sugar balance.',
    benefits: ['Antioxidant', 'Blood sugar support', 'Nerve health', 'Energy production'],
    recommendedDose: '300-600mg daily',
    suitableFor: ['Blood sugar concerns', 'Neuropathy', 'Antioxidant support'],
    notSuitableFor: ['Thyroid conditions', 'May lower blood sugar too much with meds']
  },
  { 
    name: 'Digestive Enzymes', 
    category: 'Gut Health', 
    timeOfDay: 'afternoon',
    description: 'Enzymes that aid digestion and nutrient absorption.',
    benefits: ['Digestion', 'Bloating relief', 'Nutrient absorption', 'Food tolerance'],
    recommendedDose: '1 capsule with meals',
    suitableFor: ['Digestive issues', 'Bloating', 'Aging adults'],
    notSuitableFor: ['Active ulcers', 'Pancreatitis']
  },
  { 
    name: 'Caffeine', 
    category: 'Energy', 
    timeOfDay: 'morning',
    description: 'Natural stimulant that enhances alertness, focus, and physical performance.',
    benefits: ['Energy', 'Focus', 'Exercise performance', 'Fat burning'],
    recommendedDose: '100-400mg daily (avoid after 2pm)',
    suitableFor: ['Most adults', 'Pre-workout', 'Productivity'],
    notSuitableFor: ['Anxiety', 'Sleep issues', 'Heart arrhythmias', 'Pregnancy']
  },
];

export default function Nutrition() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const goToSubPage = (path: string) => {
    sessionStorage.setItem('nutrition-returning-from-subpage', 'true');
    navigate(path);
  };
  
  // Format meal type labels (e.g., "breakfast_0" -> "Breakfast", "main_1" -> "Main")
  const formatMealType = (mealType: string) => {
    const baseType = mealType.split('_')[0];
    return baseType.charAt(0).toUpperCase() + baseType.slice(1);
  };
  
  // Modal states
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [quickAddMealCategory, setQuickAddMealCategory] = useState<string>('Meal 1');
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showRecommendedSupplements, setShowRecommendedSupplements] = useState(false);
  const [showSupplementDetails, setShowSupplementDetails] = useState(false);
  const [selectedSupplementInfo, setSelectedSupplementInfo] = useState<RecommendedSupplement | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Supplement add states
  const [customSupplementName, setCustomSupplementName] = useState('');
  const [supplementDosage, setSupplementDosage] = useState('');
  const [addingToTime, setAddingToTime] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<ExtendedFoodLog | null>(null);
  const [selectedMealCategory, setSelectedMealCategory] = useState<string>('meal 1');
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string>('morning');
  const [mealMenuOpen, setMealMenuOpen] = useState<string | null>(null);
  const [showMealCategoriesModal, setShowMealCategoriesModal] = useState(false);
  const [pendingMealCount, setPendingMealCount] = useState(4);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  // Form states
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [foodServingSize, setFoodServingSize] = useState('100');
  const [foodServingUnit, setFoodServingUnit] = useState('g');
  const [foodQuantity, setFoodQuantity] = useState('1');
  const [supplementName, setSupplementName] = useState('');
  
  // Hydration states
  const [goalInput, setGoalInput] = useState(3000);
  const [manualAmount, setManualAmount] = useState('');
  const [openMenuLogId, setOpenMenuLogId] = useState<number | null>(null);
  const [showHydrationLogs, setShowHydrationLogs] = useState(false);

  // Tab state - persist across unmount/remount so returning from recipe keeps tab
  const returningFromRecipe = sessionStorage.getItem('nutrition-returning-from-recipe');
  const returningFromSubPage = sessionStorage.getItem('nutrition-returning-from-subpage');
  const [activeTab, setActiveTab] = useState(() => {
    if (returningFromRecipe) {
      sessionStorage.removeItem('nutrition-returning-from-recipe');
      return sessionStorage.getItem('nutrition-active-tab') || 'ai-coach';
    }
    if (returningFromSubPage) {
      sessionStorage.removeItem('nutrition-returning-from-subpage');
      return sessionStorage.getItem('nutrition-active-tab') || 'ai-coach';
    }
    return 'ai-coach';
  });

  useEffect(() => {
    if (returningFromRecipe) {
      const savedScroll = sessionStorage.getItem('nutrition-scroll-position');
      if (savedScroll) {
        sessionStorage.removeItem('nutrition-scroll-position');
        const y = parseInt(savedScroll, 10);
        requestAnimationFrame(() => {
          setTimeout(() => window.scrollTo(0, y), 100);
        });
      }
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('nutrition-active-tab', tab);
    window.scrollTo(0, 0);
  };

  // AI Nutrition Insights states
  const [aiInsightsMode, setAiInsightsMode] = useState<string | null>(null);
  const [aiInsightsData, setAiInsightsData] = useState<any>(null);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const [aiFeedbackSent, setAiFeedbackSent] = useState<Record<string, boolean>>({});
  const [chatInput, setChatInput] = useState('');
  const [showChatInput, setShowChatInput] = useState(false);

  // Meal Plan states
  const [mealPlanDay, setMealPlanDay] = useState("1");
  const [mealPlanSettingsOpen, setMealPlanSettingsOpen] = useState(false);
  const [mealPlanSettings, setMealPlanSettings] = useState({
    caloriesPerDay: 2000,
    macroSplit: 'balanced',
    mealsPerDay: 4,
    dietaryPreference: 'no_preference',
    excludedIngredients: [] as string[],
  });
  // Queries
  const { data: recipes = [], isLoading: recipesLoading, error } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: nutritionData } = useQuery<NutritionData>({
    queryKey: ['/api/nutrition/today'],
    enabled: isAuthenticated,
  });

  const { data: supplements = [] } = useQuery<SupplementWithStatus[]>({
    queryKey: ['/api/supplements'],
    enabled: isAuthenticated,
  });

  const { data: hydrationStats } = useQuery<{
    totalMl: number;
    goalMl: number;
    percentage: number;
    logs: HydrationLog[];
    goal: HydrationGoal | undefined;
  }>({
    queryKey: ['/api/hydration/today'],
    enabled: isAuthenticated,
  });

  interface MealCategory {
    id: number;
    userId: string;
    name: string;
    displayOrder: number;
    isDefault: boolean;
  }

  const { data: mealCategories = [] } = useQuery<MealCategory[]>({
    queryKey: ['/api/nutrition/meal-categories'],
    enabled: isAuthenticated,
  });

  // Meal Plan Query
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

  const { data: mealPlanData, isLoading: mealPlanLoading } = useQuery<MealPlanData | null>({
    queryKey: ['/api/meal-plan'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Initialize meal plan settings from existing plan data
  useEffect(() => {
    if (mealPlanData?.plan) {
      setMealPlanSettings({
        caloriesPerDay: mealPlanData.plan.caloriesPerDay,
        macroSplit: mealPlanData.plan.macroSplit,
        mealsPerDay: mealPlanData.plan.mealsPerDay,
        dietaryPreference: mealPlanData.plan.dietaryPreference,
        excludedIngredients: mealPlanData.plan.excludedIngredients || [],
      });
    }
  }, [mealPlanData]);

  // Mutations
  const addFoodMutation = useMutation({
    mutationFn: async (data: { mealCategory: string; foodName: string; calories: number; protein?: number; carbs?: number; fat?: number }) => {
      return await apiRequest('POST', '/api/nutrition/food', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith('/api/nutrition/history') });
      toast({ title: "Success", description: "Food logged successfully!" });
      resetFoodForm();
      setShowFoodModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log food", variant: "destructive" });
    },
  });

  const updateFoodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PUT', `/api/nutrition/food/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith('/api/nutrition/history') });
      toast({ title: "Success", description: "Food updated successfully!" });
      resetFoodForm();
      setShowFoodModal(false);
      setEditingFood(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update food", variant: "destructive" });
    },
  });

  const deleteFoodMutation = useMutation({
    mutationFn: async ({ id, mealLogId }: { id: number; mealLogId?: number }) => {
      if (mealLogId) {
        return await apiRequest('DELETE', `/api/nutrition/meals/food/${id}`, {});
      }
      return await apiRequest('DELETE', `/api/nutrition/food/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith('/api/nutrition/history') });
      toast({ title: "Deleted", description: "Food entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete food", variant: "destructive" });
    },
  });

  const createMealCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/nutrition/meal-categories', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meal-categories'] });
      setNewCategoryName('');
      toast({ title: "Success", description: "Meal added!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add meal", variant: "destructive" });
    },
  });

  const updateMealCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return await apiRequest('PUT', `/api/nutrition/meal-categories/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meal-categories'] });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      toast({ title: "Success", description: "Meal renamed!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to rename meal", variant: "destructive" });
    },
  });

  const deleteMealCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/nutrition/meal-categories/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meal-categories'] });
      toast({ title: "Deleted", description: "Meal removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete meal", variant: "destructive" });
    },
  });

  const saveMealCountMutation = useMutation({
    mutationFn: async (targetCount: number) => {
      const currentCount = mealCategories.length || 4;
      
      if (targetCount > currentCount) {
        // Add meals
        for (let i = currentCount + 1; i <= targetCount; i++) {
          await apiRequest('POST', '/api/nutrition/meal-categories', { name: `Meal ${i}` });
        }
      } else if (targetCount < currentCount) {
        // Remove meals from the end
        const categoriesToDelete = mealCategories
          .slice(targetCount)
          .sort((a, b) => b.displayOrder - a.displayOrder);
        for (const cat of categoriesToDelete) {
          await apiRequest('DELETE', `/api/nutrition/meal-categories/${cat.id}`, {});
        }
      }
      return targetCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/meal-categories'] });
      setShowMealCategoriesModal(false);
      toast({ title: "Saved", description: "Meal settings updated!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update meals", variant: "destructive" });
    },
  });

  const addSupplementMutation = useMutation({
    mutationFn: async (data: { name: string; timeOfDay: string; dosage?: string }) => {
      return await apiRequest('POST', '/api/supplements', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      toast({ title: "Success", description: "Supplement added!" });
      setSupplementName('');
      setSupplementDosage('');
      setCustomSupplementName('');
      setAddingToTime(null);
      setShowSupplementModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add supplement", variant: "destructive" });
    },
  });

  const toggleSupplementMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/supplements/${id}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/streak'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle supplement", variant: "destructive" });
    },
  });

  const deleteSupplementMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/supplements/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements'] });
      toast({ title: "Deleted", description: "Supplement removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete supplement", variant: "destructive" });
    },
  });

  const addHydrationMutation = useMutation({
    mutationFn: async (amountMl: number) => {
      return await apiRequest('POST', '/api/hydration/log', {
        amountMl,
        timeOfDay: getTodayTimeOfDay(),
        fluidType: 'water',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Logged", description: `Water logged successfully!` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log water", variant: "destructive" });
    },
  });

  const setGoalMutation = useMutation({
    mutationFn: async (goalMl: number) => {
      return await apiRequest('POST', '/api/hydration/goal', {
        goalMl,
        isManuallySet: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Goal Updated", description: `Daily goal set to ${goalInput}ml` });
      setShowGoalModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set goal", variant: "destructive" });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      return await apiRequest('DELETE', `/api/hydration/log/${logId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hydration/today'] });
      toast({ title: "Deleted", description: "Log entry removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete log", variant: "destructive" });
    },
  });

  // Meal Plan Mutations
  const createMealPlanMutation = useMutation({
    mutationFn: async (data: typeof mealPlanSettings) => {
      return apiRequest('POST', '/api/meal-plan', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      setMealPlanSettingsOpen(false);
      toast({ title: 'Meal plan created!', description: 'Your 3-day meal plan has been generated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const regenerateMealPlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest('POST', `/api/meal-plan/${planId}/regenerate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      toast({ title: 'Meal plan refreshed!', description: 'Your meals have been updated.' });
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

  const markMealEatenMutation = useMutation({
    mutationFn: async ({ mealId, ateToday }: { mealId: number; ateToday: boolean }) => {
      return apiRequest('PATCH', `/api/meal-plan/meal/${mealId}/ate`, { ateToday });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nutrition/history'] });
      toast({ title: 'Meal logged!', description: 'Your nutrition totals have been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const aiInsightsMutation = useMutation({
    mutationFn: async (mode: string) => {
      const body: { mode: string; message?: string } = { mode };
      if (mode === 'chat' && chatInput) {
        body.message = chatInput;
      }
      const res = await apiRequest('POST', '/api/ai/nutrition-insights', body);
      return res.json();
    },
    onSuccess: (data, mode) => {
      setAiInsightsData(data);
      setAiInsightsMode(mode);
      setAiInsightsExpanded(true);
      if (mode === 'chat') {
        setChatInput('');
      }
    },
    onError: (error: Error) => {
      toast({ title: 'AI unavailable', description: error.message, variant: 'destructive' });
    },
  });

  const aiFeedbackMutation = useMutation({
    mutationFn: async ({ rating, aiMessage }: { rating: 'positive' | 'negative'; aiMessage: string }) => {
      return apiRequest('POST', '/api/ai-feedback', {
        feature: 'nutrition',
        rating,
        aiMessage,
        userMessage: aiInsightsMode,
        context: { mode: aiInsightsMode },
      });
    },
    onSuccess: (_, variables) => {
      setAiFeedbackSent(prev => ({ ...prev, [aiInsightsMode || '']: true }));
      toast({ title: variables.rating === 'positive' ? 'Thanks!' : 'Noted', description: 'Your feedback helps improve recommendations.' });
    },
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (isLoading || recipesLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading nutrition hub...</p>
        </div>
      </div>
    );
  }

  const resetFoodForm = () => {
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
  };

  const handleAddFood = () => {
    if (!foodName || !foodCalories) {
      toast({ title: "Error", description: "Name and calories are required", variant: "destructive" });
      return;
    }

    if (editingFood) {
      updateFoodMutation.mutate({
        id: editingFood.id,
        data: {
          mealCategory: selectedMealCategory,
          foodName,
          calories: parseInt(foodCalories),
          protein: foodProtein ? parseFloat(foodProtein) : 0,
          carbs: foodCarbs ? parseFloat(foodCarbs) : 0,
          fat: foodFat ? parseFloat(foodFat) : 0,
          servingSize: parseFloat(foodServingSize) || 100,
          servingSizeUnit: foodServingUnit,
          servingQuantity: parseFloat(foodQuantity) || 1,
        },
      });
    } else {
      addFoodMutation.mutate({
        mealCategory: selectedMealCategory,
        foodName,
        calories: parseInt(foodCalories),
        protein: foodProtein ? parseFloat(foodProtein) : 0,
        carbs: foodCarbs ? parseFloat(foodCarbs) : 0,
        fat: foodFat ? parseFloat(foodFat) : 0,
      });
    }
  };

  const handleEditFood = (food: ExtendedFoodLog) => {
    setEditingFood(food);
    setFoodName(food.foodName);
    setFoodCalories(food.calories.toString());
    setFoodProtein(food.protein?.toString() || '');
    setFoodCarbs(food.carbs?.toString() || '');
    setFoodFat(food.fat?.toString() || '');
    setFoodServingSize(food.servingSize?.toString() || '1');
    setFoodServingUnit(food.servingSizeUnit || 'serving');
    setFoodQuantity(food.servingQuantity?.toString() || '1');
    setSelectedMealCategory(food.mealCategory);
    setShowFoodModal(true);
  };
  
  const isRecipeBasedFood = editingFood?.sourceType === 'recipe';
  
  const recalculateRecipeMacros = (servingSize: number, quantity: number) => {
    if (isRecipeBasedFood && editingFood && editingFood.sourceId) {
      const recipe = recipes?.find(r => r.id === editingFood.sourceId);
      if (recipe) {
        const originalServingSize = editingFood.servingSize || 1;
        const originalQty = editingFood.servingQuantity || 1;
        const originalTotal = originalServingSize * originalQty;
        const newTotal = servingSize * quantity;
        const multiplier = newTotal / originalTotal;
        
        setFoodCalories(Math.round(editingFood.calories * multiplier).toString());
        setFoodProtein(((editingFood.protein || 0) * multiplier).toFixed(1));
        setFoodCarbs(((editingFood.carbs || 0) * multiplier).toFixed(1));
        setFoodFat(((editingFood.fat || 0) * multiplier).toFixed(1));
      }
    }
  };
  
  const handleServingSizeChange = (newServingSize: string) => {
    setFoodServingSize(newServingSize);
    const size = parseFloat(newServingSize) || 1;
    const qty = parseFloat(foodQuantity) || 1;
    recalculateRecipeMacros(size, qty);
  };
  
  const handleQuantityChange = (newQuantity: string) => {
    setFoodQuantity(newQuantity);
    const size = parseFloat(foodServingSize) || 1;
    const qty = parseFloat(newQuantity) || 1;
    recalculateRecipeMacros(size, qty);
  };

  const goal = nutritionData?.goal || { calorieTarget: 2000, proteinTarget: 150, carbsTarget: 200, fatTarget: 65 };
  const totals = nutritionData?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const mealBreakdown = nutritionData?.mealBreakdown || {};
  
  const caloriesRemaining = Math.max(0, goal.calorieTarget - totals.calories);
  const caloriePercentage = Math.min((totals.calories / goal.calorieTarget) * 100, 100);

  const hydrationGoal = hydrationStats?.goalMl || 3000;
  const hydrationCurrent = hydrationStats?.totalMl || 0;
  const hydrationPercentage = hydrationStats?.percentage || 0;

  const morningSupplements = supplements.filter(s => s.timeOfDay === 'morning' && (s.takenToday || isSupplementDueToday(s)));
  const afternoonSupplements = supplements.filter(s => s.timeOfDay === 'afternoon' && (s.takenToday || isSupplementDueToday(s)));
  const eveningSupplements = supplements.filter(s => s.timeOfDay === 'evening' && (s.takenToday || isSupplementDueToday(s)));

  const getMealCalories = (meal: ExtendedFoodLog[]) => meal.reduce((sum, f) => sum + (f.calories || 0), 0);

  const NUTRITION_TABS = [
    { id: "ai-coach", label: "AI Coach" },
    { id: "macro-tracker", label: "Macro Tracker" },
    { id: "supplements", label: "Supplements" },
    { id: "recipes", label: "Recipes" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/40">
        <div className="px-5 pt-4 pb-0">
          <h1 className="text-[28px] font-bold text-[#0cc9a9] tracking-tight">Nutrition</h1>
        </div>
        <div className="relative">
          <div className="flex gap-5 overflow-x-auto scrollbar-hide px-5 pt-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {NUTRITION_TABS.map(tab => (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors flex-shrink-0 ${activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0cc9a9] rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="pt-[88px]">
        <div className="px-5 pb-4 space-y-3">

        {activeTab === "ai-coach" && (
          <>
            <Card className="bg-card border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <Brain className="h-5 w-5 text-primary mr-2" />
                  Your AI Nutrition Coach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Get personalised nutrition guidance powered by AI. Ask questions, get meal suggestions based on your remaining macros, review your daily intake, spot weekly patterns, and discover recipes tailored to your goals.</p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {[
                { mode: 'next_meal', icon: Zap, label: 'What should I eat?', description: 'Suggests your next meal based on remaining macros and calories', color: 'text-green-400' },
                { mode: 'end_of_day', icon: BarChart3, label: 'Daily review', description: 'Grades your day with wins, improvements, and tips for tomorrow', color: 'text-blue-400' },
                { mode: 'weekly_patterns', icon: TrendingUp, label: 'Weekly patterns', description: 'Spots trends in your eating habits over the past 7 days', color: 'text-purple-400' },
                { mode: 'recipe_suggestions', icon: BookOpen, label: 'Smart recipes', description: 'Recommends recipes that fit your remaining nutritional needs', color: 'text-orange-400' },
              ].map(({ mode, icon: Icon, label, description, color }) => (
                <button
                  key={mode}
                  className={`flex flex-col gap-1.5 p-4 rounded-lg border transition-all text-left w-full ${
                    aiInsightsMode === mode ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                  }`}
                  onClick={() => aiInsightsMutation.mutate(mode)}
                  disabled={aiInsightsMutation.isPending}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground leading-snug">{description}</span>
                </button>
              ))}

              <button
                className={`flex flex-col gap-1.5 p-4 rounded-lg border transition-all text-left w-full ${
                  showChatInput ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                }`}
                onClick={() => setShowChatInput(true)}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-sm font-semibold">Ask anything</span>
                </div>
                <span className="text-xs text-muted-foreground leading-snug">Type a question and chat directly with your nutrition coach</span>
              </button>
            </div>

            {showChatInput && (
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask your nutrition coach..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      aiInsightsMutation.mutate('chat');
                    }
                  }}
                />
                <Button
                  onClick={() => aiInsightsMutation.mutate('chat')}
                  disabled={aiInsightsMutation.isPending || !chatInput.trim()}
                >
                  Send
                </Button>
              </div>
            )}

            {aiInsightsMutation.isPending && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Analyzing your nutrition data...</span>
              </div>
            )}

            {aiInsightsData && !aiInsightsMutation.isPending && (
              <Card className="bg-card">
                <CardContent className="pt-4 space-y-3">
                  {aiInsightsMode === 'next_meal' && aiInsightsData.data && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{aiInsightsData.data.summary}</p>
                      {aiInsightsData.data.remainingMacros && (
                        <div className="flex gap-3 text-xs">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded">{aiInsightsData.data.remainingMacros.calories} cal left</span>
                          <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded">{aiInsightsData.data.remainingMacros.protein}g protein</span>
                          <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded">{aiInsightsData.data.remainingMacros.carbs}g carbs</span>
                        </div>
                      )}
                      {aiInsightsData.data.suggestions?.map((s: any, i: number) => (
                        <div key={i} className="bg-background rounded-lg p-3 border-l-4 border-l-green-500/50">
                          <p className="text-sm font-medium">{s.meal}</p>
                          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                            <span>~{s.approxCalories} cal</span>
                            <span>~{s.approxProtein}g protein</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiInsightsMode === 'end_of_day' && aiInsightsData.data && (
                    <div className="space-y-3">
                      {aiInsightsData.data.grade && (
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold ${
                            aiInsightsData.data.grade === 'A' ? 'text-green-400' :
                            aiInsightsData.data.grade === 'B' ? 'text-blue-400' :
                            aiInsightsData.data.grade === 'C' ? 'text-[#0cc9a9]' : 'text-red-400'
                          }`}>{aiInsightsData.data.grade}</span>
                          <p className="text-sm text-muted-foreground">{aiInsightsData.data.summary}</p>
                        </div>
                      )}
                      {aiInsightsData.data.wins?.length > 0 && (
                        <div className="bg-green-500/5 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-400 mb-1">What went well</p>
                          {aiInsightsData.data.wins.map((w: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground">+ {w}</p>
                          ))}
                        </div>
                      )}
                      {aiInsightsData.data.improvements?.length > 0 && (
                        <div className="bg-orange-500/5 rounded-lg p-3">
                          <p className="text-xs font-medium text-orange-400 mb-1">Room to improve</p>
                          {aiInsightsData.data.improvements.map((imp: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground">{imp}</p>
                          ))}
                        </div>
                      )}
                      {aiInsightsData.data.tip && (
                        <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs font-medium text-primary mb-1">Tomorrow's tip</p>
                          <p className="text-xs text-muted-foreground">{aiInsightsData.data.tip}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {aiInsightsMode === 'weekly_patterns' && aiInsightsData.data && (
                    <div className="space-y-3">
                      {aiInsightsData.data.weeklyAverage && (
                        <div className="flex gap-3 text-xs">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded">Avg {aiInsightsData.data.weeklyAverage.calories} cal/day</span>
                          <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded">Avg {aiInsightsData.data.weeklyAverage.protein}g protein</span>
                        </div>
                      )}
                      {aiInsightsData.data.patterns?.map((p: any, i: number) => (
                        <div key={i} className="bg-background rounded-lg p-3 border-l-4 border-l-purple-500/50">
                          <p className="text-sm font-medium">{p.insight}</p>
                          <p className="text-xs text-muted-foreground mt-1">{p.impact}</p>
                          <p className="text-xs text-primary mt-1">{p.action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiInsightsMode === 'recipe_suggestions' && aiInsightsData.data && (
                    <div className="space-y-3">
                      {aiInsightsData.data.suggestions?.map((s: any, i: number) => (
                        <div key={i} className="bg-background rounded-lg p-3 border-l-4 border-l-orange-500/50">
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                          <div className="flex gap-2 mt-2 text-xs">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded">{s.calories} cal</span>
                            <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded">{s.protein}g P</span>
                            <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded">{s.carbs}g C</span>
                            <span className="bg-[#0cc9a9]/10 text-[#0cc9a9] px-2 py-1 rounded">{s.fat}g F</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 italic">{s.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiInsightsMode === 'chat' && aiInsightsData.data && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{aiInsightsData.data.summary || JSON.stringify(aiInsightsData.data)}</p>
                    </div>
                  )}

                  {aiInsightsData.data?.raw && (
                    <p className="text-sm text-muted-foreground">{aiInsightsData.data.summary}</p>
                  )}

                  {!aiFeedbackSent[aiInsightsMode || ''] && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Was this helpful?</span>
                      <div className="flex gap-2">
                        <button
                          className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
                          onClick={() => aiFeedbackMutation.mutate({ rating: 'positive', aiMessage: JSON.stringify(aiInsightsData.data) })}
                          disabled={aiFeedbackMutation.isPending}
                        >
                          <ThumbsUp className="h-4 w-4 text-muted-foreground hover:text-green-400" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          onClick={() => aiFeedbackMutation.mutate({ rating: 'negative', aiMessage: JSON.stringify(aiInsightsData.data) })}
                          disabled={aiFeedbackMutation.isPending}
                        >
                          <ThumbsDown className="h-4 w-4 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  )}
                  {aiFeedbackSent[aiInsightsMode || ''] && (
                    <p className="text-xs text-center text-muted-foreground pt-2 border-t border-border">Thanks for your feedback</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "macro-tracker" && (
          <>
        {/* Macro Tracking */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-base">
                <PieChart className="h-5 w-5 text-primary mr-2" />
                Macro Tracking
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToSubPage('/nutrition/graphs')}
                  data-testid="button-view-graphs"
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Calories Header */}
            <div>
              <h3 className="text-xl font-bold">Calories</h3>
              <p className="text-sm text-muted-foreground">Remaining = Goal - Food</p>
            </div>

            {/* Calorie Summary with Large Ring */}
            <div className="flex items-center justify-center gap-6">
              {/* Large Circular Progress - Centered */}
              <button 
                className="relative w-48 h-48 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => goToSubPage('/nutrition/graphs')}
                data-testid="button-calorie-circle"
              >
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192">
                  <circle
                    cx="96"
                    cy="96"
                    r="85"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="85"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 85}`}
                    strokeDashoffset={`${2 * Math.PI * 85 * (1 - caloriePercentage / 100)}`}
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{caloriesRemaining.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">Remaining</span>
                </div>
              </button>

              {/* Stats on the Right */}
              <div className="space-y-3 ml-4">
                {/* Base Goal */}
                <div className="flex items-start gap-3">
                  <Flag className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Base Goal</p>
                    <p className="text-base font-bold">{goal.calorieTarget.toLocaleString()}</p>
                  </div>
                </div>
                
                {/* Food */}
                <div className="flex items-start gap-3">
                  <Utensils className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Food</p>
                    <p className="text-base font-bold">{totals.calories}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Macro Bars */}
            <div className="space-y-3">
              {/* Protein */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Protein</span>
                  <span>{Math.round(totals.protein)}g / {goal.proteinTarget}g</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#0cc9a9] transition-all duration-300"
                    style={{ width: `${Math.min((totals.protein / goal.proteinTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Carbs */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Carbs</span>
                  <span>{Math.round(totals.carbs)}g / {goal.carbsTarget}g</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min((totals.carbs / goal.carbsTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Fat */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Fat</span>
                  <span>{Math.round(totals.fat)}g / {goal.fatTarget}g</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#0cc9a9] transition-all duration-300"
                    style={{ width: `${Math.min((totals.fat / goal.fatTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Meal Breakdown */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Meals</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => setShowMealCategoriesModal(true)}
                  data-testid="button-edit-meals"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {(mealCategories.length > 0 ? mealCategories : [{ id: 0, name: 'Meal 1', displayOrder: 0 }, { id: 1, name: 'Meal 2', displayOrder: 1 }, { id: 2, name: 'Meal 3', displayOrder: 2 }, { id: 3, name: 'Meal 4', displayOrder: 3 }]).map((category) => {
                const mealKey = category.name.toLowerCase() as keyof typeof mealBreakdown;
                const mealFoods = mealBreakdown[mealKey] || [];
                const mealCal = getMealCalories(mealFoods);
                const mealParam = category.name;
                
                return (
                  <div key={category.id} className="bg-background rounded-lg overflow-hidden border-l-4 border-l-primary/30">
                    {/* Header row - meal name and calories */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <span className="font-semibold">{category.name}</span>
                      <span className="text-muted-foreground">{mealCal}</span>
                    </div>
                    
                    {/* Food items */}
                    {mealFoods.length > 0 && (
                      <div className="px-4 pb-2 space-y-1">
                        {mealFoods.map((food) => (
                          <div key={food.id} className="flex items-start justify-between text-sm py-1">
                            <div className="flex-1">
                              <div className="font-medium truncate max-w-[180px]">{food.foodName}</div>
                              {((food as any).brand || (food as any).servingSize) && (
                                <div className="text-xs text-muted-foreground">
                                  {(food as any).brand && <span>{(food as any).brand}, </span>}
                                  {(food as any).servingSize && (
                                    <span>{(food as any).servingSize} {(food as any).servingSizeUnit === 'gram' ? 'g' : (food as any).servingSizeUnit}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{food.calories}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditFood(food);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFoodMutation.mutate({ id: food.id, mealLogId: (food as any).mealLogId });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Bottom row - plus button and 3-dot menu */}
                    <div className="flex items-center justify-between px-2 pb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToSubPage(`/nutrition/add-food?meal=${mealParam}`);
                        }}
                        data-testid={`button-add-${category.name.toLowerCase()}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMealMenuOpen(mealMenuOpen === category.name.toLowerCase() ? null : category.name.toLowerCase());
                        }}
                        data-testid={`button-menu-${category.name.toLowerCase()}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Meal Plan Section */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-base">
                <Calendar className="h-5 w-5 text-cyan-500 mr-2" />
                Meal Plan
              </CardTitle>
              <div className="flex items-center gap-1">
                {mealPlanData && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => regenerateMealPlanMutation.mutate(mealPlanData.plan.id)}
                    disabled={regenerateMealPlanMutation.isPending}
                    data-testid="btn-refresh-meal-plan"
                  >
                    <RefreshCw className={`h-5 w-5 ${regenerateMealPlanMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => goToSubPage('/nutrition/meal-plan-settings')}
                  data-testid="btn-meal-plan-settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!mealPlanData ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-cyan-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a personalized 3-day meal plan based on your goals
                </p>
                <Button 
                  onClick={() => goToSubPage('/nutrition/meal-plan-settings')}
                  className="bg-cyan-500 hover:bg-cyan-600"
                  data-testid="btn-create-meal-plan"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Meal Plan
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Tabs value={mealPlanDay} onValueChange={setMealPlanDay}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="1" data-testid="tab-day-1">DAY 1</TabsTrigger>
                    <TabsTrigger value="2" data-testid="tab-day-2">DAY 2</TabsTrigger>
                    <TabsTrigger value="3" data-testid="tab-day-3">DAY 3</TabsTrigger>
                  </TabsList>
                  
                  {mealPlanData.days.map((day) => (
                    <TabsContent key={day.id} value={day.dayIndex.toString()} className="mt-4 space-y-4">
                      <div className="text-center">
                        <span className="inline-block bg-[#0cc9a9] rounded-full px-4 py-2 text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {day.totalCalories}cal / {day.meals.reduce((sum, m) => sum + (m.protein || 0), 0)}g P / {day.meals.reduce((sum, m) => sum + (m.carbs || 0), 0)}g C / {day.meals.reduce((sum, m) => sum + (m.fat || 0), 0)}g F
                        </span>
                      </div>
                      
                      {day.meals.map((meal) => (
                        <div 
                          key={meal.id} 
                          className={`relative rounded-xl overflow-hidden border h-32 ${isEatenToday(meal.ateTodayDate) ? 'border-green-500/50' : 'border-border'}`}
                          data-testid={`meal-card-${meal.id}`}
                        >
                          {meal.recipe.imageUrl ? (
                            <img 
                              src={meal.recipe.imageUrl} 
                              alt={meal.recipe.title} 
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-muted flex items-center justify-center">
                              <Utensils className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                          {isEatenToday(meal.ateTodayDate) && (
                            <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                              <Check className="w-16 h-16 text-green-400 drop-shadow-lg" />
                            </div>
                          )}
                          <div className="absolute inset-0 p-3 flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-medium uppercase text-white/80 bg-black/40 px-2 py-1 rounded">
                                {formatMealType(meal.mealType)}
                              </span>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 border-0"
                                onClick={() => regenerateMealMutation.mutate(meal.id)}
                                disabled={regenerateMealMutation.isPending}
                                data-testid={`btn-refresh-meal-${meal.id}`}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 text-white ${regenerateMealMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                            <div className="flex items-end justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 
                                  className="font-semibold text-white text-sm leading-tight cursor-pointer hover:text-cyan-400 truncate"
                                  onClick={() => {
                                    sessionStorage.setItem('nutrition-returning-from-recipe', 'true');
                                    sessionStorage.setItem('nutrition-scroll-position', window.scrollY.toString());
                                    navigate(`/recipe/${meal.recipeId}`);
                                  }}
                                >
                                  {meal.recipe.title}
                                </h4>
                                <p className="text-xs text-white/70 mt-0.5">{meal.calories} Cal</p>
                              </div>
                              <Button
                                  variant={isEatenToday(meal.ateTodayDate) ? "default" : "outline"}
                                  size="sm"
                                  className={`h-7 text-xs ${isEatenToday(meal.ateTodayDate) ? "bg-green-500 hover:bg-green-600 border-green-500" : "border-white/50 text-white hover:bg-white/20 bg-black/30"}`}
                                  onClick={() => markMealEatenMutation.mutate({ mealId: meal.id, ateToday: !isEatenToday(meal.ateTodayDate) })}
                                  disabled={markMealEatenMutation.isPending}
                                  data-testid={`btn-ate-today-${meal.id}`}
                                >
                                  {isEatenToday(meal.ateTodayDate) ? 'EATEN' : 'ATE TODAY'}
                                </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {day.meals.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No meals for this day</p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}

        {activeTab === "supplements" && (
          <SupplementsTab />
        )}

        {activeTab === "recipes" && (
          <RecipesList />
        )}

        </div>
      </div>

      {/* Food Modal */}
      <Dialog open={showFoodModal} onOpenChange={setShowFoodModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFood ? 'Edit Food' : 'Log Food'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Meal</label>
              <Select value={selectedMealCategory} onValueChange={setSelectedMealCategory}>
                <SelectTrigger className="mt-1">
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
            {editingFood ? (
              <div>
                <label className="text-sm font-medium">Food Name</label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-foreground">{foodName}</p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Food Name *</label>
                <Input 
                  value={foodName} 
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g., Chicken Breast"
                  className="mt-1"
                />
              </div>
            )}
            {isRecipeBasedFood ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Serving Size</label>
                  <Input 
                    type="number"
                    value={foodServingSize} 
                    onChange={(e) => handleServingSizeChange(e.target.value)}
                    placeholder="1"
                    className="mt-1"
                    step="0.25"
                    min="0.25"
                  />
                  <p className="text-xs text-muted-foreground mt-1">servings per portion</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input 
                    type="number"
                    value={foodQuantity} 
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder="1"
                    className="mt-1"
                    step="1"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">number of portions</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-sm font-medium">Serving Size</label>
                  <Input 
                    type="number"
                    value={foodServingSize} 
                    onChange={(e) => setFoodServingSize(e.target.value)}
                    placeholder="100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <Select value={foodServingUnit} onValueChange={setFoodServingUnit}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <label className="text-sm font-medium">Quantity</label>
                  <Input 
                    type="number"
                    value={foodQuantity} 
                    onChange={(e) => setFoodQuantity(e.target.value)}
                    placeholder="1"
                    className="mt-1"
                    step="0.25"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Calories *</label>
              <Input 
                type="number"
                value={foodCalories} 
                onChange={(e) => setFoodCalories(e.target.value)}
                placeholder="e.g., 250"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Protein (g)</label>
                <Input 
                  type="number"
                  value={foodProtein} 
                  onChange={(e) => {
                    const newProtein = e.target.value;
                    setFoodProtein(newProtein);
                    const p = parseFloat(newProtein) || 0;
                    const c = parseFloat(foodCarbs) || 0;
                    const f = parseFloat(foodFat) || 0;
                    setFoodCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Carbs (g)</label>
                <Input 
                  type="number"
                  value={foodCarbs} 
                  onChange={(e) => {
                    const newCarbs = e.target.value;
                    setFoodCarbs(newCarbs);
                    const p = parseFloat(foodProtein) || 0;
                    const c = parseFloat(newCarbs) || 0;
                    const f = parseFloat(foodFat) || 0;
                    setFoodCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Fat (g)</label>
                <Input 
                  type="number"
                  value={foodFat} 
                  onChange={(e) => {
                    const newFat = e.target.value;
                    setFoodFat(newFat);
                    const p = parseFloat(foodProtein) || 0;
                    const c = parseFloat(foodCarbs) || 0;
                    const f = parseFloat(newFat) || 0;
                    setFoodCalories(String(Math.round(p * 4 + c * 4 + f * 9)));
                  }}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={handleAddFood}
              disabled={addFoodMutation.isPending || updateFoodMutation.isPending}
            >
              {editingFood ? 'Update Food' : 'Log Food'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplement Modal */}
      <Dialog open={showSupplementModal} onOpenChange={setShowSupplementModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Supplement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Supplement Name</label>
              <Input 
                value={supplementName} 
                onChange={(e) => setSupplementName(e.target.value)}
                placeholder="e.g., Vitamin D3"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Time of Day</label>
              <Select value={selectedTimeOfDay} onValueChange={setSelectedTimeOfDay}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={() => {
                if (supplementName) {
                  addSupplementMutation.mutate({ name: supplementName, timeOfDay: selectedTimeOfDay });
                }
              }}
              disabled={addSupplementMutation.isPending || !supplementName}
            >
              Add Supplement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hydration Goal Modal */}
      <Dialog open={showGoalModal} onOpenChange={setShowGoalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Hydration Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Daily Goal (ml)</label>
              <Input 
                type="number"
                value={goalInput} 
                onChange={(e) => setGoalInput(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              {[2000, 2500, 3000, 3500].map((val) => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  onClick={() => setGoalInput(val)}
                >
                  {val}ml
                </Button>
              ))}
            </div>
            <Button 
              className="w-full" 
              onClick={() => setGoalMutation.mutate(goalInput)}
              disabled={setGoalMutation.isPending}
            >
              Set Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Hydration Entry Modal */}
      <Dialog open={showManualInput} onOpenChange={setShowManualInput}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (ml)</label>
              <Input 
                type="number"
                value={manualAmount} 
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="Enter amount in ml"
                className="mt-1"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={() => {
                const amount = parseInt(manualAmount);
                if (amount > 0) {
                  addHydrationMutation.mutate(amount);
                  setManualAmount('');
                  setShowManualInput(false);
                }
              }}
              disabled={addHydrationMutation.isPending || !manualAmount}
            >
              Log Hydration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stacks Modal */}
      <Dialog open={showRecommendedSupplements} onOpenChange={setShowRecommendedSupplements}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Edit Supplement Stacks
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 space-y-4">
            {/* Add Custom Supplement */}
            <div className="bg-muted/30 rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Add Custom Supplement</h4>
              <div className="flex gap-2">
                <Input 
                  placeholder="Supplement name"
                  value={customSupplementName}
                  onChange={(e) => setCustomSupplementName(e.target.value)}
                  className="flex-1"
                />
                <Input 
                  placeholder="Dosage (e.g., 5g)"
                  value={supplementDosage}
                  onChange={(e) => setSupplementDosage(e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['morning', 'afternoon', 'evening'].map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      if (customSupplementName) {
                        addSupplementMutation.mutate({
                          name: customSupplementName,
                          timeOfDay: time,
                          dosage: supplementDosage || undefined,
                        });
                      }
                    }}
                    disabled={!customSupplementName || addSupplementMutation.isPending}
                  >
                    + {time.charAt(0).toUpperCase() + time.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Current Stacks */}
            {[
              { time: 'morning', label: 'Morning Stack', items: morningSupplements },
              { time: 'afternoon', label: 'Afternoon Stack', items: afternoonSupplements },
              { time: 'evening', label: 'Evening Stack', items: eveningSupplements },
            ].map(({ time, label, items }) => (
              <div key={time} className="bg-muted/30 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">{label}</h4>
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No supplements added</p>
                  ) : (
                    items.map((supp) => (
                      <div key={supp.id} className="flex items-center justify-between p-2 bg-background rounded">
                        <div>
                          <span className="text-sm">{supp.name}</span>
                          {supp.dosage && (
                            <span className="text-xs text-muted-foreground ml-2">({supp.dosage})</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteSupplementMutation.mutate(supp.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}

            {/* Recommended Supplements Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Add from Recommended
              </h4>
              <p className="text-xs text-muted-foreground mb-3">Tap supplement name for details, or add directly to a stack</p>
              <div className="space-y-2">
                {RECOMMENDED_SUPPLEMENTS.map((supp) => {
                  const isAlreadyAdded = supplements.some(s => s.name.toLowerCase() === supp.name.toLowerCase());
                  
                  if (isAlreadyAdded) return null;
                  
                  return (
                    <div 
                      key={supp.name} 
                      className="p-2 rounded-lg border bg-background"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          className="text-left flex-1"
                          onClick={() => {
                            setSelectedSupplementInfo(supp);
                            setShowSupplementDetails(true);
                          }}
                        >
                          <p className="font-medium text-sm text-primary hover:underline flex items-center gap-1">
                            {supp.name}
                            <Info className="h-3 w-3" />
                          </p>
                          <p className="text-xs text-muted-foreground">{supp.category} • {supp.recommendedDose}</p>
                        </button>
                        <div className="flex gap-1">
                          {['morning', 'afternoon', 'evening'].map((time) => (
                            <Button
                              key={time}
                              variant="outline"
                              size="sm"
                              className={`text-xs px-2 py-1 h-7 ${supp.timeOfDay === time ? 'border-primary text-primary' : ''}`}
                              onClick={() => {
                                addSupplementMutation.mutate(
                                  { name: supp.name, timeOfDay: time, dosage: supp.recommendedDose },
                                  {
                                    onSuccess: () => {
                                      toast({
                                        title: "Supplement added",
                                        description: `${supp.name} added to your ${time} stack`,
                                      });
                                    }
                                  }
                                );
                              }}
                              disabled={addSupplementMutation.isPending}
                            >
                              {time.charAt(0).toUpperCase() + time.slice(1, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplement Details Modal */}
      <Dialog open={showSupplementDetails} onOpenChange={setShowSupplementDetails}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-purple-500" />
              {selectedSupplementInfo?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSupplementInfo && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{selectedSupplementInfo.category}</p>
                <p className="text-sm mt-2">{selectedSupplementInfo.description}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Benefits</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedSupplementInfo.benefits.map((benefit, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{benefit}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">Recommended Dose</h4>
                <p className="text-sm text-primary">{selectedSupplementInfo.recommendedDose}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">Best Time to Take</h4>
                <p className="text-sm capitalize">{selectedSupplementInfo.timeOfDay}</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2 text-green-500">Suitable For</h4>
                <ul className="text-sm space-y-1">
                  {selectedSupplementInfo.suitableFor.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2 text-orange-500">Not Suitable For</h4>
                <ul className="text-sm space-y-1">
                  {selectedSupplementInfo.notSuitableFor.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <X className="h-3 w-3 text-orange-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Add to Stack</h4>
                <div className="space-y-2">
                  <Input 
                    placeholder={`Dosage (e.g., ${selectedSupplementInfo.recommendedDose})`}
                    value={supplementDosage}
                    onChange={(e) => setSupplementDosage(e.target.value)}
                  />
                  <div className="flex gap-2">
                    {['morning', 'afternoon', 'evening'].map((time) => (
                      <Button
                        key={time}
                        variant="outline"
                        className={`flex-1 ${selectedSupplementInfo.timeOfDay === time ? 'border-primary text-primary' : ''}`}
                        onClick={() => {
                          addSupplementMutation.mutate(
                            { 
                              name: selectedSupplementInfo.name, 
                              timeOfDay: time,
                              dosage: supplementDosage || selectedSupplementInfo.recommendedDose
                            },
                            {
                              onSuccess: () => {
                                setShowSupplementDetails(false);
                                setSupplementDosage('');
                              }
                            }
                          );
                        }}
                        disabled={addSupplementMutation.isPending}
                      >
                        {time.charAt(0).toUpperCase() + time.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Menu for food logging */}
      <QuickAddMenu 
        open={showQuickAddMenu}
        onClose={() => setShowQuickAddMenu(false)}
        initialView="meal"
        initialMealCategory={quickAddMealCategory}
      />

      {/* Edit Meal Categories Modal */}
      <Dialog open={showMealCategoriesModal} onOpenChange={(open) => {
        setShowMealCategoriesModal(open);
        if (open) {
          setPendingMealCount(mealCategories.length || 4);
        }
      }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Edit Meals</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-6 space-y-6">
            <p className="text-sm text-muted-foreground">How many meals do you track per day?</p>
            
            <div className="flex items-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full text-xl"
                onClick={() => setPendingMealCount(Math.max(1, pendingMealCount - 1))}
                disabled={pendingMealCount <= 1}
                data-testid="btn-decrease-meals"
              >
                <Minus className="h-6 w-6" />
              </Button>
              
              <div className="text-center">
                <span className="text-4xl font-bold">{pendingMealCount}</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingMealCount === 1 ? 'Meal' : 'Meals'}
                </p>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full text-xl"
                onClick={() => setPendingMealCount(Math.min(10, pendingMealCount + 1))}
                disabled={pendingMealCount >= 10}
                data-testid="btn-increase-meals"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
            
            <Button
              className="w-full"
              onClick={() => saveMealCountMutation.mutate(pendingMealCount)}
              disabled={saveMealCountMutation.isPending || pendingMealCount === (mealCategories.length || 4)}
              data-testid="btn-save-meals"
            >
              {saveMealCountMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meal Menu Bottom Sheet */}
      <Drawer open={!!mealMenuOpen} onOpenChange={(open) => !open && setMealMenuOpen(null)}>
        <DrawerContent>
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="capitalize">{mealMenuOpen}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-base"
              onClick={() => {
                const mealFoods = mealMenuOpen ? (mealBreakdown[mealMenuOpen as keyof typeof mealBreakdown] || []) : [];
                if (mealFoods.length === 0) {
                  toast({ title: "No foods", description: "Add some foods to this meal first", variant: "destructive" });
                  setMealMenuOpen(null);
                  return;
                }
                goToSubPage(`/nutrition/save-meal?meal=${mealMenuOpen}`);
                setMealMenuOpen(null);
              }}
              data-testid="btn-save-as-meal"
            >
              Save as Meal
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-base"
              onClick={() => setMealMenuOpen(null)}
            >
              Cancel
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
