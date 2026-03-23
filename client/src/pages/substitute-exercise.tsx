import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, SlidersHorizontal, Loader2, ChevronLeft } from "lucide-react";
import ExerciseFilterPanel from "@/components/training/ExerciseFilterPanel";
import ExerciseSearchInput from "@/components/training/ExerciseSearchInput";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "@/components/admin/exerciseFilterConstants";
import { getMuxThumbnailUrl } from "@/lib/mux";

export default function SubstituteExercise() {
  const { workoutLogId, exerciseIndex } = useParams<{ workoutLogId: string; exerciseIndex: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    mainMuscle: [], equipment: [], movement: [], mechanics: [], level: [],
  });
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({
    mainMuscle: [], equipment: [], movement: [], mechanics: [], level: [],
  });

  const [exercises, setExercises] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => setDebouncedSearchQuery(searchQuery));
    }, 300);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [searchQuery]);

  const buildQueryParams = (pageOffset: number) => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, values]) => {
      if (values.length > 0) params.append(key, values.join(","));
    });
    params.append("limit", ITEMS_PER_PAGE.toString());
    params.append("offset", pageOffset.toString());
    return params.toString();
  };

  const isActivelyTyping = searchQuery !== debouncedSearchQuery;
  const { isLoading: exercisesLoading, data: queryData, isFetching } = useQuery<any[]>({
    queryKey: ["/api/exercises", appliedFilters, debouncedSearchQuery, 0],
    queryFn: async () => {
      if (debouncedSearchQuery.trim()) {
        const res = await fetch(`/api/exercises/search?q=${encodeURIComponent(debouncedSearchQuery)}`);
        if (!res.ok) throw new Error("Failed to search exercises");
        return await res.json();
      }
      const res = await fetch(`/api/exercises?${buildQueryParams(0)}`);
      if (!res.ok) throw new Error("Failed to fetch exercises");
      return await res.json();
    },
    enabled: isAuthenticated && !isActivelyTyping,
    staleTime: 0,
  });

  useEffect(() => {
    if (queryData) {
      setExercises(queryData);
      if (debouncedSearchQuery.trim()) {
        setHasMore(false);
      } else {
        setOffset(ITEMS_PER_PAGE);
        setHasMore(queryData.length >= ITEMS_PER_PAGE);
      }
    }
  }, [queryData, debouncedSearchQuery]);

  const loadMoreExercises = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/exercises?${buildQueryParams(offset)}`);
      if (!res.ok) throw new Error("Failed to fetch exercises");
      const data = await res.json();
      if (data.length < ITEMS_PER_PAGE) setHasMore(false);
      setExercises(prev => [...prev, ...data]);
      setOffset(prev => prev + ITEMS_PER_PAGE);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, isLoadingMore, hasMore, appliedFilters]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMoreExercises(); },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [loadMoreExercises, hasMore, isLoadingMore]);

  const filterCategories = [
    { label: "Main Muscle", key: "mainMuscle", filterKey: "mainMuscle", options: MAIN_MUSCLE_OPTIONS },
    { label: "Equipment", key: "equipment", filterKey: "equipment", options: EQUIPMENT_OPTIONS },
    { label: "Movement Pattern", key: "movementPattern", filterKey: "movement", options: MOVEMENT_PATTERN_OPTIONS },
    { label: "Movement Type", key: "movementType", filterKey: "movement", options: MOVEMENT_TYPE_OPTIONS },
    { label: "Mechanics", key: "mechanics", filterKey: "mechanics", options: MECHANICS_OPTIONS },
    { label: "Level", key: "level", filterKey: "level", options: LEVEL_OPTIONS },
  ];

  const handleApplyFilters = () => {
    setAppliedFilters(selectedFilters);
    setShowFilterPanel(false);
    setExercises([]);
    setOffset(0);
    setHasMore(true);
  };

  const handleClearFilters = () => {
    const empty = { mainMuscle: [], equipment: [], movement: [], mechanics: [], level: [] };
    setSelectedFilters(empty);
    setAppliedFilters(empty);
    setSearchQuery("");
    setExercises([]);
    setOffset(0);
    setHasMore(true);
  };

  const handleSubstitute = () => {
    if (!selectedExercise) return;
    sessionStorage.setItem(
      `substitute_${workoutLogId}_${exerciseIndex}`,
      JSON.stringify({
        name: selectedExercise.name,
        id: selectedExercise.id,
        imageUrl: selectedExercise.imageUrl || null,
        muxPlaybackId: selectedExercise.muxPlaybackId || null,
      })
    );
    navigate(`/active-workout/${workoutLogId}`);
  };

  const handleCancel = () => {
    navigate(`/active-workout/${workoutLogId}`);
  };

  const activeFilterCount = Object.values(appliedFilters).flat().length;

  return (
    <div className="min-h-screen bg-background">
      {showFilterPanel && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowFilterPanel(false)} />
          <ExerciseFilterPanel
            categories={filterCategories}
            selectedFilters={selectedFilters}
            onFilterChange={(category, options) =>
              setSelectedFilters(prev => ({ ...prev, [category]: options }))
            }
            onClearFilters={handleClearFilters}
            onApply={handleApplyFilters}
          />
        </>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleCancel} className="text-sm font-medium text-foreground">
            Cancel
          </button>
          <h1 className="text-base font-semibold text-foreground">Substitute Exercise</h1>
          <button
            onClick={handleSubstitute}
            disabled={!selectedExercise}
            className={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${
              selectedExercise
                ? "bg-primary text-black"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Substitute
          </button>
        </div>

        {/* Search + Filter */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="flex-1">
            <ExerciseSearchInput searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-shrink-0"
            onClick={() => setShowFilterPanel(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
          </Button>
        </div>
      </div>

      {/* Exercise List */}
      <div className="px-4 py-3 space-y-2">
        {(exercisesLoading && exercises.length === 0) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading exercises...</span>
          </div>
        ) : exercises.length > 0 ? (
          exercises.map((exercise) => {
            const isSelected = selectedExercise?.id === exercise.id;
            return (
              <Card
                key={exercise.id}
                className={`cursor-pointer transition-all flex items-center overflow-hidden h-14 p-3 ${
                  isSelected
                    ? "border-primary border-2 bg-primary/5"
                    : "hover:shadow-md hover:border-primary"
                }`}
                onClick={() => setSelectedExercise(isSelected ? null : exercise)}
              >
                <div className="w-14 h-14 flex-shrink-0 -mx-3 -my-3 mr-3">
                  {getMuxThumbnailUrl(exercise.muxPlaybackId) ? (
                    <img
                      src={getMuxThumbnailUrl(exercise.muxPlaybackId, { width: 112 })!}
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Dumbbell className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-foreground text-sm truncate flex-1">{exercise.name}</h3>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ml-2">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {debouncedSearchQuery ? `No exercises found for "${debouncedSearchQuery}".` : "No exercises found."}
            </p>
          </Card>
        )}

        {isLoadingMore && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading more...</span>
          </div>
        )}
        <div ref={observerTarget} className="h-4" />
      </div>
    </div>
  );
}
