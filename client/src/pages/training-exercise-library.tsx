import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, SlidersHorizontal, Loader2, ArrowUp } from "lucide-react";
import ExerciseFilterPanel from "@/components/training/ExerciseFilterPanel";
import ExerciseSearchInput from "@/components/training/ExerciseSearchInput";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "@/components/admin/exerciseFilterConstants";
import { getMuxThumbnailUrl } from "@/lib/mux";

export default function TrainingExerciseLibrary({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Parse filters and search from URL on mount
  const parseFiltersFromUrl = () => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
      mainMuscle: params.get('mainMuscle')?.split(',').filter(Boolean) || [],
      equipment: params.get('equipment')?.split(',').filter(Boolean) || [],
      movement: params.get('movement')?.split(',').filter(Boolean) || [],
      mechanics: params.get('mechanics')?.split(',').filter(Boolean) || [],
      level: params.get('level')?.split(',').filter(Boolean) || [],
    };
  };

  const parseSearchFromUrl = () => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return params.get('search') || '';
  };

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(parseFiltersFromUrl());
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>(parseFiltersFromUrl());
  
  useEffect(() => {
    const search = parseSearchFromUrl();
    setSearchQuery(search);
    setDebouncedSearchQuery(search);
  }, []);

  // Restore scroll position when returning from exercise detail
  useEffect(() => {
    const scrollPosition = sessionStorage.getItem('exerciseLibraryScrollPosition');
    if (scrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(scrollPosition, 10));
        sessionStorage.removeItem('exerciseLibraryScrollPosition');
      }, 100);
    }
  }, []);

  // Debounce search query with non-blocking transition
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearchQuery(searchQuery);
      });
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const exercisesGridRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 25;
  const SCROLL_THRESHOLD = window.innerHeight; // One viewport height

  // Sync URL with applied filters only (not search to prevent page refresh on each keystroke)
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.set(key, values.join(","));
      }
    });
    if (!embedded) {
      const queryString = params.toString();
      const newUrl = queryString ? `/training/exercise-library?${queryString}` : '/training/exercise-library';
      window.history.replaceState(null, '', newUrl);
    }
  }, [appliedFilters, embedded]);

  const buildQueryParams = (pageOffset: number) => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.append(key, values.join(","));
      }
    });
    params.append('limit', ITEMS_PER_PAGE.toString());
    params.append('offset', pageOffset.toString());
    return params.toString();
  };

  // Fetch initial batch of exercises (with search support)
  // Only enable when not actively typing (searchQuery matches debouncedSearchQuery)
  const isActivelyTyping = searchQuery !== debouncedSearchQuery;
  const { isLoading: exercisesLoading, data: queryData, isFetching } = useQuery<any[]>({
    queryKey: ['/api/exercises', appliedFilters, debouncedSearchQuery, 0],
    queryFn: async () => {
      // If search query exists, use search endpoint
      if (debouncedSearchQuery.trim()) {
        const url = `/api/exercises/search?q=${encodeURIComponent(debouncedSearchQuery)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to search exercises');
        const data = await res.json();
        return data || [];
      }
      
      // Otherwise use filter-based endpoint
      const queryParams = buildQueryParams(0);
      const url = `/api/exercises?${queryParams}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch exercises');
      return await res.json();
    },
    enabled: isAuthenticated && !isActivelyTyping,
    staleTime: 0, // Always refetch on query key change
  });

  // Sync exercises state from query data
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

  // Show searching state while fetching with a search query
  useEffect(() => {
    setIsSearching(isFetching && !!debouncedSearchQuery.trim());
  }, [isFetching, debouncedSearchQuery]);

  // Fetch more exercises when needed
  const loadMoreExercises = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const queryParams = buildQueryParams(offset);
      const url = `/api/exercises?${queryParams}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch exercises');
      const data = await res.json();
      
      if (data.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }
      
      setExercises(prev => [...prev, ...data]);
      setOffset(prev => prev + ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more exercises:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, isLoadingMore, hasMore, appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters(selectedFilters);
    setShowFilterPanel(false);
    setExercises([]);
    setOffset(0);
    setHasMore(true);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      mainMuscle: [],
      equipment: [],
      movement: [],
      mechanics: [],
      level: [],
    };
    setSelectedFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSearchQuery('');
    setExercises([]);
    setOffset(0);
    setHasMore(true);
  };

  // Intersection Observer for infinite scroll pagination
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreExercises();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [loadMoreExercises, hasMore, isLoadingMore]);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [SCROLL_THRESHOLD]);

  // Scroll to exercises section
  const scrollToExercises = () => {
    if (exercisesGridRef.current) {
      const element = exercisesGridRef.current;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const bannerHeight = 80; // Approximate banner height
      window.scrollTo({
        top: elementPosition - bannerHeight,
        behavior: 'smooth'
      });
    }
  };

  const filterCategories = [
    {
      label: "Main Muscle",
      key: "mainMuscle",
      filterKey: "mainMuscle",
      options: MAIN_MUSCLE_OPTIONS,
    },
    {
      label: "Equipment",
      key: "equipment",
      filterKey: "equipment",
      options: EQUIPMENT_OPTIONS,
    },
    {
      label: "Movement Pattern",
      key: "movementPattern",
      filterKey: "movement",
      options: MOVEMENT_PATTERN_OPTIONS,
    },
    {
      label: "Movement Type",
      key: "movementType",
      filterKey: "movement",
      options: MOVEMENT_TYPE_OPTIONS,
    },
    {
      label: "Mechanics",
      key: "mechanics",
      filterKey: "mechanics",
      options: MECHANICS_OPTIONS,
    },
    {
      label: "Level",
      key: "level",
      filterKey: "level",
      options: LEVEL_OPTIONS,
    },
  ];

  // Restore scroll position when exercises load
  useEffect(() => {
    if (!exercisesLoading && exercises.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('exerciseLibraryScrollPosition');
      if (savedScrollPosition) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScrollPosition, 10));
          sessionStorage.removeItem('exerciseLibraryScrollPosition');
        }, 0);
      }
    }
  }, [exercisesLoading, exercises.length]);

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
    }
  }, [isAuthenticated, isLoading, toast]);

  const isInitialLoading = isLoading || (exercisesLoading && exercises.length === 0 && !debouncedSearchQuery);
  if (isInitialLoading) {
    return (
      <div className={embedded ? "flex items-center justify-center py-12" : "min-h-screen w-full flex items-center justify-center bg-background"}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exercises...</p>
        </div>
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'intermediate':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'advanced':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const exerciseContent = (
    <>
      {showFilterPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFilterPanel(false)}
            data-testid="filter-panel-overlay"
          />
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
      
      <div className={embedded ? "" : "p-6"}>
        <div className="max-w-7xl mx-auto">
          {!embedded && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Exercise Library
              </h1>
              <p className="text-muted-foreground mb-8">
                Browse 1000+ exercises with video demonstrations and proper form guidance.
              </p>
            </>
          )}

          <div className={`sticky z-10 bg-background pb-3 ${embedded ? "top-[88px] -mx-5 px-5 pt-5" : "top-14 -mx-6 px-6 pt-2"}`}>
            <div className="flex items-center gap-2">
              <ExerciseSearchInput 
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowFilterPanel(true)}
                data-testid="button-open-exercise-filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          <div ref={exercisesGridRef} className="mb-6 space-y-4">
            {debouncedSearchQuery && (
              <h2 className="text-xl font-bold text-foreground">
                Search Results for "{debouncedSearchQuery}"
              </h2>
            )}
            {Object.entries(appliedFilters).some(([, values]) => values.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(appliedFilters).map(([key, values]) =>
                  values.map((value) => {
                    const category = filterCategories.find(c => c.filterKey === key || c.key === key);
                    const option = category?.options.find((o: any) => o.value === value || o === value);
                    const label = typeof option === 'object' ? option.label : option || value;
                    return (
                      <Badge
                        key={`${key}-${value}`}
                        variant="secondary"
                        className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 text-xs font-medium cursor-pointer hover:bg-primary/30"
                        onClick={() => {
                          const updated = { ...appliedFilters, [key]: appliedFilters[key].filter(v => v !== value) };
                          setAppliedFilters(updated);
                          setSelectedFilters(updated);
                          setExercises([]);
                          setOffset(0);
                          setHasMore(true);
                        }}
                      >
                        {label} ✕
                      </Badge>
                    );
                  })
                )}
                <Badge
                  variant="outline"
                  className="px-3 py-1 text-xs cursor-pointer hover:bg-muted"
                  onClick={handleClearFilters}
                >
                  Clear all
                </Badge>
              </div>
            )}
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Searching exercises...</span>
            </div>
          ) : exercises.length > 0 ? (
            <div className="space-y-2 mb-8">
              {exercises.map((exercise) => {
                const filterParams = new URLSearchParams();
                Object.entries(appliedFilters).forEach(([key, values]) => {
                  if (values.length > 0) {
                    filterParams.set(key, values.join(","));
                  }
                });
                const handleExerciseClick = () => {
                  sessionStorage.setItem('exerciseLibraryScrollPosition', window.scrollY.toString());
                  navigate(`/exercise/${exercise.id}`);
                };
                return (
                <Card 
                  key={exercise.id}
                  className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary flex items-center overflow-hidden h-14 p-3"
                  onClick={handleExerciseClick}
                  data-testid={`exercise-card-${exercise.id}`}
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

                  <h3 className="font-medium text-foreground text-sm truncate flex-1">
                    {exercise.name}
                  </h3>
                </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">
                {debouncedSearchQuery ? `No exercises found for "${debouncedSearchQuery}".` : 'No exercises found yet.'}
              </p>
              <p className="text-sm text-muted-foreground">
                {debouncedSearchQuery ? 'Try a different search term or clear filters.' : 'Exercises will appear here as they are added to your library.'}
              </p>
            </Card>
          )}

          {/* Loading indicator for pagination */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Loading more exercises...</span>
            </div>
          )}

          {/* Intersection observer target for pagination */}
          <div ref={observerTarget} className="h-2" />
        </div>
      </div>

      {showBackToTop && (
        <Button
          onClick={scrollToExercises}
          className="fixed bottom-28 right-5 z-40 rounded-full h-10 w-10 p-0 bg-primary hover:bg-primary/90 shadow-lg"
          aria-label="Back to exercises"
          data-testid="button-back-to-top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </>
  );

  if (embedded) {
    return exerciseContent;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader onBack={() => navigate("/training")} />
      <div className="pt-14">
        {exerciseContent}
      </div>
    </div>
  );
}
