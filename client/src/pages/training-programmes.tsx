import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bookmark, ChevronRight, Target } from "lucide-react";
import { FilterSheet } from "@/components/training/FilterSheet";
import TopHeader from "@/components/TopHeader";
import type { Programme } from "@shared/schema";

const sectionLabels: Record<string, string> = {
  all: "All Programmes",
  gym: "Gym",
  home: "Home",
  great_for_travel: "Great for Travel",
  female_specific: "Female Specific",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const equipmentLabels: Record<string, string> = {
  no_equipment: "No Equipment",
  bodyweight: "Bodyweight",
  bands_only: "Bands Only",
  kettlebell_only: "Kettlebell Only",
  dumbbell_only: "Dumbbell Only",
  db_bench_only: "DB/Bench Only",
  full_gym: "Full Gym",
};

export default function TrainingProgrammes() {
  const [, navigate] = useLocation();
  const params = useParams<{ section?: string }>();
  const section = params.section || "view_all";
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    difficulty: "All Levels",
    equipment: "All Equipment",
    tag: "All Tags",
  });

  const pageTitle = sectionLabels[section] || "All Programmes";

  const { data: programs = [], isLoading } = useQuery<Programme[]>({
    queryKey: ["/api/programs", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/programs`);
      return res.json();
    },
    retry: false,
  });

  const filterBySection = (list: Programme[]): Programme[] => {
    switch (section) {
      case "gym":
        return list.filter((p) => (p.category || []).includes("gym"));
      case "home":
        return list.filter((p) => (p.category || []).includes("home"));
      case "great_for_travel":
        return list.filter((p) => (p.category || []).includes("travel"));
      case "female_specific":
        return list.filter((p) => (p.category || []).includes("female_specific"));
      case "all":
      default:
        return list;
    }
  };

  let displayPrograms = filterBySection(programs);

  if (filters.difficulty && filters.difficulty !== "All Levels") {
    displayPrograms = displayPrograms.filter(
      (p) => p.difficulty === filters.difficulty.toLowerCase()
    );
  }

  if (filters.equipment && filters.equipment !== "All Equipment") {
    displayPrograms = displayPrograms.filter(
      (p) => p.equipment === filters.equipment
    );
  }

  if (filters.tag && filters.tag !== "All Tags") {
    displayPrograms = displayPrograms.filter(
      (p) => (p.tags || []).includes(filters.tag)
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayPrograms = displayPrograms.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader onBack={() => navigate("/training?tab=programmes")} title={pageTitle} />

      <div className="px-5 pt-4">
        <div className="max-w-7xl mx-auto space-y-4">
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
            <FilterSheet
              filters={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              filterOptions={[
                {
                  label: "Difficulty",
                  value: "difficulty",
                  options: [
                    { label: "All Levels", value: "All Levels" },
                    { label: "Beginner", value: "beginner" },
                    { label: "Intermediate", value: "intermediate" },
                    { label: "Advanced", value: "advanced" },
                  ],
                },
                {
                  label: "Equipment",
                  value: "equipment",
                  options: [
                    { label: "All Equipment", value: "All Equipment" },
                    { label: "No Equipment", value: "no_equipment" },
                    { label: "Bodyweight", value: "bodyweight" },
                    { label: "Bands Only", value: "bands_only" },
                    { label: "Kettlebell Only", value: "kettlebell_only" },
                    { label: "Dumbbell Only", value: "dumbbell_only" },
                    { label: "DB/Bench Only", value: "db_bench_only" },
                    { label: "Full Gym", value: "full_gym" },
                  ],
                },
                {
                  label: "Tags",
                  value: "tag",
                  options: [
                    { label: "All Tags", value: "All Tags" },
                    { label: "Beginner", value: "beginner" },
                    { label: "Intermediate", value: "intermediate" },
                    { label: "Advanced", value: "advanced" },
                    { label: "Full Body", value: "full_body" },
                    { label: "Upper Body", value: "upper_body" },
                    { label: "Lower Body", value: "lower_body" },
                    { label: "Time Efficient", value: "time_efficient" },
                    { label: "Free Weights Only", value: "free_weights_only" },
                    { label: "Cardio", value: "cardio" },
                  ],
                },
              ]}
              onClearFilters={() => setFilters({ difficulty: "All Levels", equipment: "All Equipment", tag: "All Tags" })}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : displayPrograms.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No programmes found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayPrograms.map((program) => (
                <Card
                  key={program.id}
                  className="p-3 rounded-xl bg-card border border-border/60 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/training/programme/${program.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-muted overflow-hidden">
                      {program.imageUrl ? (
                        <img
                          src={program.imageUrl}
                          alt={program.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                          <Target className="h-5 w-5 text-white/30" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-bold text-foreground truncate">
                        {program.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {program.difficulty && (
                          <span className="text-xs text-muted-foreground">
                            {difficultyLabels[program.difficulty] || program.difficulty}
                          </span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {program.weeks} weeks
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {program.trainingDaysPerWeek}x/wk
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {equipmentLabels[program.equipment] || program.equipment}
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
  );
}