import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { saveScrollPosition } from "@/hooks/use-scroll-restoration";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, SlidersHorizontal, Clock, ChevronRight, X, ChevronLeft } from "lucide-react";
import type { Recipe } from "@shared/schema";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "breakfast", label: "Breakfast" },
  { id: "main", label: "Main" },
  { id: "dessert", label: "Dessert" },
  { id: "side", label: "Side" },
];

const PREP_TIME_OPTIONS = [
  { value: 15, label: "Under 15 min" },
  { value: 30, label: "Under 30 min" },
  { value: 60, label: "Under 1 hour" },
  { value: 120, label: "Under 2 hours" },
];

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Keto",
  "Paleo",
  "Gluten-free",
  "Dairy-free",
  "Low-carb",
  "High protein",
];

const INGREDIENT_OPTIONS = [
  "Chicken",
  "Beef",
  "Fish",
  "Pork",
  "Seafood",
  "Eggs",
  "Tofu",
  "Vegetables",
  "Fruit",
  "Grains",
];

export default function Recipes() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [maxPrepTime, setMaxPrepTime] = useState<number | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const toggleDietary = (diet: string) => {
    setSelectedDietary((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const toggleIngredient = (ingredient: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((i) => i !== ingredient)
        : [...prev, ingredient]
    );
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = recipe.title.toLowerCase().includes(query);
        const matchesIngredients = recipe.ingredients?.some((ing) =>
          ing.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesIngredients) return false;
      }

      if (selectedCategory !== "all" && recipe.category !== selectedCategory) {
        return false;
      }

      if (maxPrepTime) {
        if ((recipe.totalTime || 0) > maxPrepTime) return false;
      }

      if (selectedDietary.length > 0) {
        const recipeDietaryPrefs = (recipe as any).dietaryPreferences || [];
        const hasMatchingDiet = selectedDietary.some((diet) =>
          recipeDietaryPrefs.some((pref: string) => pref.toLowerCase() === diet.toLowerCase())
        );
        if (!hasMatchingDiet) return false;
      }

      if (selectedIngredients.length > 0) {
        const recipeKeyIngredients = (recipe as any).keyIngredients || [];
        const hasMatchingIngredient = selectedIngredients.some((ing) =>
          recipeKeyIngredients.some((key: string) => key.toLowerCase() === ing.toLowerCase())
        );
        if (!hasMatchingIngredient) return false;
      }

      return true;
    });
  }, [recipes, searchQuery, selectedCategory, maxPrepTime, selectedDietary, selectedIngredients]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setMaxPrepTime(null);
    setSelectedDietary([]);
    setSelectedIngredients([]);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "all" ||
    maxPrepTime ||
    selectedDietary.length > 0 ||
    selectedIngredients.length > 0;

  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (maxPrepTime ? 1 : 0) +
    selectedDietary.length +
    selectedIngredients.length;

  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "breakfast":
        return "bg-[#0cc9a9]/10 text-[#0cc9a9] border-[#0cc9a9]";
      case "main":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "dessert":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "side":
        return "bg-green-100 text-green-700 border-green-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 hover:bg-muted rounded-full"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold absolute left-1/2 -translate-x-1/2">Recipes</h1>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative" data-testid="button-filters">
                <SlidersHorizontal className="h-5 w-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Prep Time</h3>
                  <div className="space-y-2">
                    {PREP_TIME_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`time-${option.value}`}
                          checked={maxPrepTime === option.value}
                          onCheckedChange={(checked) =>
                            setMaxPrepTime(checked ? option.value : null)
                          }
                        />
                        <label htmlFor={`time-${option.value}`} className="text-sm cursor-pointer">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Dietary Preference</h3>
                  <div className="space-y-2">
                    {DIETARY_OPTIONS.map((diet) => (
                      <div key={diet} className="flex items-center space-x-2">
                        <Checkbox
                          id={`diet-${diet}`}
                          checked={selectedDietary.includes(diet)}
                          onCheckedChange={() => toggleDietary(diet)}
                        />
                        <label htmlFor={`diet-${diet}`} className="text-sm cursor-pointer">
                          {diet}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Key Ingredients</h3>
                  <div className="space-y-2">
                    {INGREDIENT_OPTIONS.map((ingredient) => (
                      <div key={ingredient} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ing-${ingredient}`}
                          checked={selectedIngredients.includes(ingredient)}
                          onCheckedChange={() => toggleIngredient(ingredient)}
                        />
                        <label htmlFor={`ing-${ingredient}`} className="text-sm cursor-pointer">
                          {ingredient}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full mb-2"
                  onClick={() => setFilterOpen(false)}
                  data-testid="button-apply-filters"
                >
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    clearFilters();
                    setFilterOpen(false);
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="h-14" />
      <div className="sticky top-14 z-40 bg-background px-4 pt-3 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes or ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-recipes"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex space-x-2 pb-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full flex-shrink-0"
                data-testid={`button-category-${category.id}`}
              >
                {category.label}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="px-4">
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filters: {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}</span>
            {selectedCategory !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {formatCategory(selectedCategory)}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory("all")} />
              </Badge>
            )}
            {maxPrepTime && (
              <Badge variant="secondary" className="gap-1">
                Under {maxPrepTime} min
                <X className="h-3 w-3 cursor-pointer" onClick={() => setMaxPrepTime(null)} />
              </Badge>
            )}
            {selectedDietary.map((diet) => (
              <Badge key={diet} variant="secondary" className="gap-1">
                {diet}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleDietary(diet)} />
              </Badge>
            ))}
            {selectedIngredients.map((ing) => (
              <Badge key={ing} variant="secondary" className="gap-1">
                {ing}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleIngredient(ing)} />
              </Badge>
            ))}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                "{searchQuery}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No recipes found</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/recipe/${recipe.id}`)}
              data-testid={`card-recipe-${recipe.id}`}
            >
              <div className="flex gap-4">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Badge
                    variant="outline"
                    className={`mb-1 text-xs ${getCategoryColor(recipe.category)}`}
                  >
                    {formatCategory(recipe.category)}
                  </Badge>
                  <h3 className="font-semibold truncate" data-testid={`text-recipe-title-${recipe.id}`}>
                    {recipe.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{recipe.totalTime || 0}min</span>
                    </div>
                    <span>{recipe.calories} cal</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground self-center flex-shrink-0" />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
