import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Search, ChevronRight, Trophy } from "lucide-react";
import { useLocation } from "wouter";

interface ExerciseWithPR {
  id: number;
  name: string;
  exerciseType: string;
  maxWeight: number | null;
  maxReps: number | null;
  volume: number | null;
  oneRepMax: number | null;
  fiveRepMax: number | null;
  tenRepMax: number | null;
}

const ITEMS_PER_PAGE = 15;

export default function ProgressExercisePRs() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data: exercises, isLoading } = useQuery<ExerciseWithPR[]>({
    queryKey: ["/api/progress/exercise-prs-list"],
  });

  const filteredExercises = useMemo(() => {
    if (!exercises) return [];
    
    return exercises
      .filter(ex => {
        const hasData = ex.maxWeight !== null || ex.maxReps !== null || ex.volume !== null;
        const isCorrectType = ex.exerciseType === "strength" || ex.exerciseType === "endurance";
        const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        return hasData && isCorrectType && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, searchQuery]);

  const displayedExercises = useMemo(() => {
    return filteredExercises.slice(0, displayCount);
  }, [filteredExercises, displayCount]);

  const hasMore = displayCount < filteredExercises.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
    }
  }, [hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [searchQuery]);

  const formatBestValue = (exercise: ExerciseWithPR): string => {
    if (exercise.maxWeight !== null) return `${exercise.maxWeight}kg`;
    if (exercise.maxReps !== null) return `${exercise.maxReps} reps`;
    if (exercise.volume !== null) {
      if (exercise.volume >= 1000) return `${(exercise.volume / 1000).toFixed(1)}t`;
      return `${exercise.volume}kg`;
    }
    return "-";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Exercise PRs</h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Exercise PRs</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-exercises"
          />
        </div>

        {filteredExercises.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Exercises Found</h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No exercises match your search."
                  : "Complete workouts to start tracking personal records."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {displayedExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/progress/exercise-pr/${exercise.id}`)}
                data-testid={`exercise-pr-row-${exercise.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{exercise.name}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
            
            {hasMore && (
              <div ref={loadMoreRef} className="py-4 text-center">
                <Skeleton className="h-16 w-full" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
