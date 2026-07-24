import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Bookmark, ChevronRight, Clock, Dumbbell } from "lucide-react";
import type { Workout } from "@shared/schema";
import { FilterSheet } from "@/components/training/FilterSheet";
import TopHeader from "@/components/TopHeader";

const categoryLabels: Record<string, string> = {
  new: "New",
  full_body: "Full Body",
  lower_body: "Lower Body",
  upper_body: "Upper Body",
  core: "Core",
  hiit: "HIIT",
  home_workout: "Home Workouts",
  bodyweight: "Bodyweight",
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility",
  recovery: "Recovery",
  morning: "Morning Stretch",
  post_workout: "Post-Workout",
  hip_mobility: "Hip Mobility",
  spine: "Spine & Back",
  beginner: "Beginner Flow",
  power: "Power Yoga",
  restorative: "Restorative",
  flexibility: "Flexibility",
  mindfulness: "Mindfulness",
  posture: "Posture",
  shoulder: "Shoulder",
  knee: "Knee & Ankle",
  lower_back: "Lower Back",
  balance: "Balance",
};

const routineTypeLabels: Record<string, string> = {
  workout: "Workouts",
  stretching: "Stretching & Mobility",
  yoga: "Yoga",
  corrective: "Corrective Exercise",
};

export default function TrainingWorkoutCategory() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams<{ routineType: string; category?: string }>();
  const routineType = params.routineType || "workout";
  const category = params.category;
  const [showSaved, setShowSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    difficulty: "All Levels",
    duration: "Any Length",
  });

  const pageTitle = category
    ? categoryLabels[category] || category
    : routineTypeLabels[routineType] || "Workouts";

  const { data: workouts = [], isLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", routineType, category, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ routineType });
      if (category && category !== "view_all" && category !== "new") {
        params.append('category', category);
      }
      if (filters.difficulty && filters.difficulty !== 'All Levels') {
        params.append('difficulty', filters.difficulty);
      }
      const res = await fetch(`/api/workouts?${params.toString()}`);
      const data = await res.json();
      if (category === "new") {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return data.filter((w: Workout) => w.createdAt && new Date(w.createdAt).getTime() >= oneWeekAgo);
      }
      return data;
    },
    retry: false,
  });

  const { data: bookmarks = [] } = useQuery<any[]>({
    queryKey: ["/api/bookmarks"],
    retry: false,
  });

  const isSaved = (workoutId: number) => {
    return bookmarks.some(b => b.contentType === 'workout' && b.contentId === workoutId);
  };

  const saveMutation = useMutation({
    mutationFn: async (workoutId: number) => {
      const res = await apiRequest("POST", "/api/bookmarks", {
        contentType: "workout",
        contentId: workoutId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Saved", description: "Workout saved." });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (workoutId: number) => {
      const res = await apiRequest("DELETE", `/api/bookmarks/workout/${workoutId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: "Removed", description: "Workout removed from saved." });
    },
  });

  const toggleSave = (workoutId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved(workoutId)) {
      unsaveMutation.mutate(workoutId);
    } else {
      saveMutation.mutate(workoutId);
    }
  };

  const savedIds = new Set(
    bookmarks.filter(b => b.contentType === 'workout').map(b => b.contentId)
  );

  const displayWorkouts = showSaved
    ? workouts.filter(w => savedIds.has(w.id))
    : workouts;

  const filteredWorkouts = searchQuery.trim()
    ? displayWorkouts.filter(w =>
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : displayWorkouts;

  const formatDifficulty = (d: string) => {
    return d.charAt(0).toUpperCase() + d.slice(1);
  };


  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader
        onBack={() => navigate("/training?tab=workouts")}
        title={pageTitle}
      />

      <div className="pt-12">
        <div className="sticky top-14 z-10 bg-background px-5 pb-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showSaved ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSaved(!showSaved)}
                className={`gap-1.5 flex-shrink-0 ${showSaved ? "bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black" : ""}`}
              >
                <Bookmark className={`h-4 w-4 ${showSaved ? "fill-current" : ""}`} />
                Saved
              </Button>
              <FilterSheet
                filters={filters}
                onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                filterOptions={[
                  {
                    label: "Difficulty",
                    value: "difficulty",
                    options: [
                      { label: "All Levels", value: "All Levels" },
                      { label: "Beginner", value: "beginner" },
                      { label: "Intermediate", value: "intermediate" },
                      { label: "Advanced", value: "advanced" }
                    ]
                  },
                  {
                    label: "Duration",
                    value: "duration",
                    options: [
                      { label: "Any Length", value: "Any Length" },
                      { label: "15-30 min", value: "15-30 min" },
                      { label: "30-45 min", value: "30-45 min" },
                      { label: "45+ min", value: "45+ min" }
                    ]
                  }
                ]}
                onClearFilters={() => setFilters({ difficulty: "All Levels", duration: "Any Length" })}
              />
            </div>
          </div>
        </div>

        <div className="px-5">
          <div className="max-w-7xl mx-auto space-y-4">
            {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <div className="text-center py-12">
              <Dumbbell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {showSaved ? "No saved workouts in this category." : "No workouts found."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWorkouts.map((workout) => (
                <Card
                  key={workout.id}
                  className="p-3 rounded-xl bg-card border border-border/60 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/training/workout/${workout.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-muted overflow-hidden">
                      {workout.imageUrl ? (
                        <img
                          src={workout.imageUrl}
                          alt={workout.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dumbbell className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-bold text-foreground truncate">
                        {workout.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {workout.difficulty && (
                          <span className="text-xs text-muted-foreground">
                            {formatDifficulty(workout.difficulty)}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(workout as any).estimatedDuration || workout.duration || 30} min
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
