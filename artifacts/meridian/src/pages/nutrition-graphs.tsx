import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import TopHeader from "@/components/TopHeader";
import { ChevronLeft, ChevronRight, ChevronDown, X, Check } from "lucide-react";
import { format, subDays, addDays, startOfWeek, endOfWeek, parseISO, isToday, isSameDay, setMonth, setYear, getMonth, getYear } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface HistoryEntry {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodLog {
  id: number;
  mealCategory: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type ViewMode = 'day' | 'week';
type TabType = 'calories' | 'nutrients' | 'macros';

const NUTRIENTS_LIST = [
  { name: 'Protein', key: 'protein', goal: 199 },
  { name: 'Carbohydrates', key: 'carbs', goal: 496 },
  { name: 'Fiber', key: 'fiber', goal: 38 },
  { name: 'Sugar', key: 'sugar', goal: 149 },
  { name: 'Fat', key: 'fat', goal: 132 },
  { name: 'Saturated Fat', key: 'saturatedFat', goal: 44 },
  { name: 'Polyunsaturated Fat', key: 'polyFat', goal: null },
  { name: 'Monounsaturated Fat', key: 'monoFat', goal: null },
  { name: 'Trans Fat', key: 'transFat', goal: 0 },
  { name: 'Cholesterol', key: 'cholesterol', goal: 300 },
  { name: 'Sodium', key: 'sodium', goal: 2300 },
  { name: 'Potassium', key: 'potassium', goal: 3500 },
  { name: 'Vitamin A', key: 'vitaminA', goal: 100 },
  { name: 'Vitamin C', key: 'vitaminC', goal: 100 },
  { name: 'Calcium', key: 'calcium', goal: 100 },
  { name: 'Iron', key: 'iron', goal: 100 },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function NutritionGraphs() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { formatDate } = useFormattedDate();
  const [activeTab, setActiveTab] = useState<TabType>('calories');
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [tempDay, setTempDay] = useState(new Date().getDate());
  const [tempMonth, setTempMonth] = useState(getMonth(new Date()));
  const [tempYear, setTempYear] = useState(getYear(new Date()));

  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ['/api/nutrition/history', { days: 7 }],
    queryFn: () => fetch('/api/nutrition/history?days=7', { credentials: 'include' }).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const { data: nutritionData } = useQuery<{ 
    goal: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number };
    totals: { calories: number; protein: number; carbs: number; fat: number };
    mealBreakdown: Record<string, FoodLog[]>;
  }>({
    queryKey: ['/api/nutrition/today', dateString],
    queryFn: () => fetch(`/api/nutrition/today?date=${dateString}`, { credentials: 'include' }).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const { data: mealCategories = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/nutrition/meal-categories'],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const goal = nutritionData?.goal || { calorieTarget: 2000, proteinTarget: 150, carbsTarget: 200, fatTarget: 65 };
  const totals = nutritionData?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const meals = nutritionData?.mealBreakdown || {};

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setSelectedDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
    } else {
      setSelectedDate(prev => direction === 'prev' ? subDays(prev, 7) : addDays(prev, 7));
    }
  };

  const getDateLabel = () => {
    if (viewMode === 'day') {
      if (isToday(selectedDate)) return 'Today';
      return formatDate(selectedDate, 'short');
    } else {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${formatDate(weekStart, 'monthDay')} - ${formatDate(weekEnd, 'monthDay')}`;
    }
  };

  const getMealCalories = (mealFoods: FoodLog[] | undefined) => {
    if (!mealFoods || !Array.isArray(mealFoods)) return 0;
    return mealFoods.reduce((sum, food) => sum + (food.calories || 0), 0);
  };

  const totalCalories = totals.calories;
  const caloriesRemaining = goal.calorieTarget - totals.calories;

  // Dynamic colors for meal categories
  const mealColors = ['#0cc9a9', '#22c55e', '#3b82f6', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];
  
  // Build mealData dynamically from user's meal categories
  const mealData = mealCategories.map((category, index) => {
    const categoryKey = category.name.toLowerCase();
    const mealFoods = meals[categoryKey] || [];
    return {
      name: category.name,
      value: getMealCalories(mealFoods),
      color: mealColors[index % mealColors.length],
    };
  });

  const macroData = [
    { name: 'Carbohydrates', grams: totals.carbs, color: '#22d3d1', goalPercent: 50 },
    { name: 'Fat', grams: totals.fat, color: '#c084fc', goalPercent: 30 },
    { name: 'Protein', grams: totals.protein, color: '#0cc9a9', goalPercent: 20 },
  ];

  const openDatePicker = () => {
    setTempDay(selectedDate.getDate());
    setTempMonth(getMonth(selectedDate));
    setTempYear(getYear(selectedDate));
    setShowDatePicker(true);
    setShowViewOptions(false);
  };

  const confirmDatePicker = () => {
    const newDate = new Date(tempYear, tempMonth, tempDay);
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };

  const totalMacroGrams = totals.protein + totals.carbs + totals.fat || 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Nutrition Trends" onBack={() => navigate("/nutrition")} />
      
      <div className="p-4 space-y-4">
        {/* Main Tabs: Calories, Nutrients, Macros */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calories">Calories</TabsTrigger>
            <TabsTrigger value="nutrients">Nutrients</TabsTrigger>
            <TabsTrigger value="macros">Macros</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* View Mode & Date Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('prev')}
            data-testid="button-prev-date"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex flex-col items-center relative">
            <button 
              className="flex items-center gap-1 text-sm text-muted-foreground"
              onClick={() => setShowViewOptions(!showViewOptions)}
            >
              {viewMode === 'day' ? 'Day View' : 'Week View'}
              <ChevronDown className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{getDateLabel()}</span>
            
            {/* View Options Dropdown */}
            {showViewOptions && (
              <div className="absolute top-full mt-2 bg-card border border-muted rounded-lg shadow-lg z-50 py-2 min-w-32">
                <button 
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-muted ${viewMode === 'day' ? 'text-primary' : ''}`}
                  onClick={() => { setViewMode('day'); setShowViewOptions(false); }}
                >
                  Day View
                </button>
                <button 
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-muted ${viewMode === 'week' ? 'text-primary' : ''}`}
                  onClick={() => { setViewMode('week'); setShowViewOptions(false); }}
                >
                  Week View
                </button>
                <div className="border-t border-muted my-1" />
                <button 
                  className="w-full px-4 py-2 text-sm text-left hover:bg-muted"
                  onClick={openDatePicker}
                >
                  Change Date
                </button>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('next')}
            disabled={isToday(selectedDate) && viewMode === 'day'}
            data-testid="button-next-date"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calories Tab Content */}
        {activeTab === 'calories' && (
          <div className="space-y-4">
            {/* Pie Chart Card */}
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex justify-center py-4">
                  <div className="relative w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={mealData.filter(m => m.value > 0).length > 0 ? mealData : [{ name: 'No data', value: 1, color: '#333' }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {(mealData.filter(m => m.value > 0).length > 0 ? mealData : [{ name: 'No data', value: 1, color: '#333' }]).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Meal Breakdown Legend */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {mealData.map((meal, i) => {
                    const percent = totalCalories > 0 ? Math.round((meal.value / totalCalories) * 100) : 0;
                    return (
                      <div key={meal.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meal.color }} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{meal.name}</p>
                          <p className="text-xs text-muted-foreground">{percent}% ({meal.value} cal)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Calorie Summary */}
            <Card className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-foreground">Total Calories</span>
                  <span className="text-sm font-semibold text-foreground">{totalCalories.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-foreground">Remaining</span>
                  <span className="text-sm font-semibold text-foreground">{caloriesRemaining.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-foreground">Daily Goal</span>
                  <span className="text-sm font-semibold text-[#0cc9a9]">{goal.calorieTarget.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Nutrients Tab Content */}
        {activeTab === 'nutrients' && (
          <Card className="border border-border">
            <CardContent className="p-0">
              {/* Header Row */}
              <div className="flex justify-between items-center px-4 py-3 bg-muted/50 border-b border-border">
                <span className="text-sm font-medium text-foreground">Nutrient</span>
                <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground w-36">
                  <span className="text-right">Total</span>
                  <span className="text-right">Goal</span>
                  <span className="text-right">Left</span>
                </div>
              </div>

              {/* Nutrient Rows */}
              {NUTRIENTS_LIST.map((nutrient, index) => {
                const total = nutrient.key === 'protein' ? totals.protein :
                             nutrient.key === 'carbs' ? totals.carbs :
                             nutrient.key === 'fat' ? totals.fat : 0;
                const goalVal = nutrient.goal;
                const left = goalVal !== null ? goalVal - total : null;
                const isOver = left !== null && left < 0;
                
                return (
                  <div 
                    key={nutrient.key} 
                    className={`flex justify-between items-center px-4 py-3 border-b border-border/50 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <span className="text-sm font-medium text-foreground">{nutrient.name}</span>
                    <div className="grid grid-cols-3 gap-4 text-sm w-36">
                      <span className="text-right font-medium text-foreground">{Math.round(total)}</span>
                      <span className="text-right text-muted-foreground">{goalVal !== null ? goalVal.toLocaleString() : '-'}</span>
                      <span className={`text-right font-medium ${isOver ? 'text-red-400' : 'text-foreground'}`}>
                        {left !== null ? Math.round(left) : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Macros Tab Content */}
        {activeTab === 'macros' && (
          <div className="space-y-4">
            {/* Pie Chart Card */}
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex justify-center py-4">
                  <div className="relative w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={macroData.some(m => m.grams > 0) ? macroData : [{ name: 'No data', grams: 1, color: '#333' }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="grams"
                        >
                          {(macroData.some(m => m.grams > 0) ? macroData : [{ name: 'No data', grams: 1, color: '#333' }]).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Macro Breakdown Card */}
            <Card className="border border-border">
              <CardContent className="p-0">
                {/* Header Row */}
                <div className="flex justify-between items-center px-4 py-3 bg-muted/50 border-b border-border">
                  <span className="text-sm font-medium text-foreground">Macro</span>
                  <div className="grid grid-cols-2 gap-8 text-xs font-medium text-muted-foreground w-32">
                    <span className="text-right">Actual</span>
                    <span className="text-right">Goal</span>
                  </div>
                </div>

                {/* Macro Rows */}
                {macroData.map((macro, index) => {
                  const percent = totalMacroGrams > 0 ? Math.round((macro.grams / totalMacroGrams) * 100) : 0;
                  const isOnTrack = Math.abs(percent - macro.goalPercent) <= 10;
                  return (
                    <div 
                      key={macro.name} 
                      className="flex justify-between items-center px-4 py-4 border-b border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: macro.color }} />
                        <div>
                          <span className="text-sm font-medium text-foreground">{macro.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({Math.round(macro.grams)}g)</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8 text-sm w-32">
                        <span className={`text-right font-semibold ${isOnTrack ? 'text-green-400' : 'text-foreground'}`}>{percent}%</span>
                        <span className="text-right text-[#0cc9a9] font-medium">{macro.goalPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Date Picker Bottom Sheet */}
      <Drawer open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DrawerContent>
          <div className="px-4 pb-8">
            <div className="flex items-center justify-between py-3 border-b border-muted">
              <Button variant="ghost" size="icon" onClick={() => setShowDatePicker(false)}>
                <X className="h-5 w-5" />
              </Button>
              <DrawerTitle>Change Date</DrawerTitle>
              <Button variant="ghost" size="icon" onClick={confirmDatePicker}>
                <Check className="h-5 w-5" />
              </Button>
            </div>
            
            <button
              className="w-full text-center text-primary py-3 hover:underline"
              onClick={() => {
                setSelectedDate(new Date());
                setShowDatePicker(false);
              }}
            >
              Today
            </button>
            
            <div className="relative flex justify-center gap-2 mt-2 overflow-hidden" style={{ height: '180px' }}>
              {/* Grey selection box - single line height in the middle */}
              <div 
                className="absolute left-2 right-2 rounded-md pointer-events-none"
                style={{ 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  height: '36px',
                  backgroundColor: 'rgba(100, 116, 139, 0.3)',
                  zIndex: 1
                }} 
              />
              
              {/* Top fade overlay */}
              <div 
                className="absolute inset-x-0 top-0 pointer-events-none"
                style={{ 
                  height: '72px',
                  background: 'linear-gradient(to bottom, hsl(var(--card)) 0%, hsl(var(--card)) 30%, transparent 100%)',
                  zIndex: 10
                }}
              />
              
              {/* Bottom fade overlay */}
              <div 
                className="absolute inset-x-0 bottom-0 pointer-events-none"
                style={{ 
                  height: '72px',
                  background: 'linear-gradient(to top, hsl(var(--card)) 0%, hsl(var(--card)) 30%, transparent 100%)',
                  zIndex: 10
                }}
              />
              
              {/* Day Picker - shows 2 above, selected, 2 below */}
              <div 
                className="flex flex-col items-center flex-1 cursor-ns-resize select-none"
                onWheel={(e) => {
                  e.preventDefault();
                  const accumulated = parseFloat(e.currentTarget.dataset.wheelAccum || '0') + e.deltaY;
                  if (Math.abs(accumulated) > 50) {
                    if (accumulated > 0) {
                      setTempDay(tempDay + 1 > 31 ? 1 : tempDay + 1);
                    } else {
                      setTempDay(tempDay - 1 < 1 ? 31 : tempDay - 1);
                    }
                    e.currentTarget.dataset.wheelAccum = '0';
                  } else {
                    e.currentTarget.dataset.wheelAccum = accumulated.toString();
                  }
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
                  const diff = startY - touch.clientY;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0) {
                      setTempDay(tempDay + 1 > 31 ? 1 : tempDay + 1);
                    } else {
                      setTempDay(tempDay - 1 < 1 ? 31 : tempDay - 1);
                    }
                    e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                  }
                }}
              >
                {[-2, -1, 0, 1, 2].map(offset => {
                  let day = tempDay + offset;
                  if (day < 1) day = 31 + day;
                  if (day > 31) day = day - 31;
                  const opacity = Math.abs(offset) === 2 ? 'opacity-30' : Math.abs(offset) === 1 ? 'opacity-60' : 'opacity-100';
                  return (
                    <button
                      key={offset}
                      className={`h-9 flex items-center justify-center text-lg w-full text-center text-muted-foreground ${opacity}`}
                      onClick={() => {
                        if (offset < 0) setTempDay(tempDay - 1 < 1 ? 31 : tempDay - 1);
                        if (offset > 0) setTempDay(tempDay + 1 > 31 ? 1 : tempDay + 1);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              
              {/* Month Picker */}
              <div 
                className="flex flex-col items-center flex-1 cursor-ns-resize select-none"
                onWheel={(e) => {
                  e.preventDefault();
                  const accumulated = parseFloat(e.currentTarget.dataset.wheelAccum || '0') + e.deltaY;
                  if (Math.abs(accumulated) > 50) {
                    if (accumulated > 0) {
                      setTempMonth(tempMonth + 1 > 11 ? 0 : tempMonth + 1);
                    } else {
                      setTempMonth(tempMonth - 1 < 0 ? 11 : tempMonth - 1);
                    }
                    e.currentTarget.dataset.wheelAccum = '0';
                  } else {
                    e.currentTarget.dataset.wheelAccum = accumulated.toString();
                  }
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
                  const diff = startY - touch.clientY;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0) {
                      setTempMonth(tempMonth + 1 > 11 ? 0 : tempMonth + 1);
                    } else {
                      setTempMonth(tempMonth - 1 < 0 ? 11 : tempMonth - 1);
                    }
                    e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                  }
                }}
              >
                {[-2, -1, 0, 1, 2].map(offset => {
                  let month = tempMonth + offset;
                  if (month < 0) month = 12 + month;
                  if (month > 11) month = month - 12;
                  const opacity = Math.abs(offset) === 2 ? 'opacity-30' : Math.abs(offset) === 1 ? 'opacity-60' : 'opacity-100';
                  return (
                    <button
                      key={offset}
                      className={`h-9 flex items-center justify-center text-lg w-full text-center text-muted-foreground ${opacity}`}
                      onClick={() => {
                        if (offset < 0) setTempMonth(tempMonth - 1 < 0 ? 11 : tempMonth - 1);
                        if (offset > 0) setTempMonth(tempMonth + 1 > 11 ? 0 : tempMonth + 1);
                      }}
                    >
                      {MONTHS[month]}
                    </button>
                  );
                })}
              </div>
              
              {/* Year Picker - 100 years back */}
              <div 
                className="flex flex-col items-center flex-1 cursor-ns-resize select-none"
                onWheel={(e) => {
                  e.preventDefault();
                  const accumulated = parseFloat(e.currentTarget.dataset.wheelAccum || '0') + e.deltaY;
                  const currentYear = getYear(new Date());
                  const minYear = currentYear - 100;
                  const maxYear = currentYear + 5;
                  if (Math.abs(accumulated) > 50) {
                    if (accumulated > 0 && tempYear < maxYear) {
                      setTempYear(tempYear + 1);
                    } else if (accumulated < 0 && tempYear > minYear) {
                      setTempYear(tempYear - 1);
                    }
                    e.currentTarget.dataset.wheelAccum = '0';
                  } else {
                    e.currentTarget.dataset.wheelAccum = accumulated.toString();
                  }
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
                  const diff = startY - touch.clientY;
                  const currentYear = getYear(new Date());
                  const minYear = currentYear - 100;
                  const maxYear = currentYear + 5;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0 && tempYear < maxYear) {
                      setTempYear(tempYear + 1);
                    } else if (diff < 0 && tempYear > minYear) {
                      setTempYear(tempYear - 1);
                    }
                    e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                  }
                }}
              >
                {[-2, -1, 0, 1, 2].map(offset => {
                  const year = tempYear + offset;
                  const currentYear = getYear(new Date());
                  const minYear = currentYear - 100;
                  const maxYear = currentYear + 5;
                  const opacity = Math.abs(offset) === 2 ? 'opacity-30' : Math.abs(offset) === 1 ? 'opacity-60' : 'opacity-100';
                  if (year < minYear || year > maxYear) return <div key={offset} className="h-9" />;
                  return (
                    <button
                      key={offset}
                      className={`h-9 flex items-center justify-center text-lg w-full text-center text-muted-foreground ${opacity}`}
                      onClick={() => {
                        if (offset < 0 && tempYear > minYear) setTempYear(tempYear - 1);
                        if (offset > 0 && tempYear < maxYear) setTempYear(tempYear + 1);
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
