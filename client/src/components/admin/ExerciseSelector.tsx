import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ExerciseLibraryItem } from "@shared/schema";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "./exerciseFilterConstants";
import { getMuxThumbnailUrl } from "@/lib/mux";

interface ExerciseSelectorProps {
  exercises: ExerciseLibraryItem[];
  onAddExercise: (exerciseId: number) => void;
  hideMovementFilters?: boolean;
}

export function ExerciseSelector({ exercises, onAddExercise, hideMovementFilters }: ExerciseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMainMuscles, setSelectedMainMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(15);
  const PAGE_SIZE = 15;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleExerciseTap = useCallback((exerciseId: number) => {
    onAddExercise(exerciseId);
  }, [onAddExercise]);

  const filteredExercises = useMemo(() => {
    // Deduplicate exercises first (in case of query issues)
    const uniqueExercises = exercises.filter((exercise, index, self) => 
      index === self.findIndex((e) => e.id === exercise.id)
    );

    // Shortcut mappings for common exercise terms
    const shortcuts: Record<string, string> = {
      'kb': 'kettlebell',
      'bb': 'barbell',
      'db': 'dumbbell',
      'sa': 'single arm',
      'sl': 'single leg',
      'bw': 'bodyweight',
    };

    return uniqueExercises.filter((exercise) => {
      // Search by name - expand shortcuts and match ALL words in any order
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
      const expandedWords = searchWords.map(word => shortcuts[word] || word);
      const exerciseName = exercise.name.toLowerCase();
      const matchesSearch = expandedWords.length === 0 || expandedWords.every(word => exerciseName.includes(word));
      
      // Filter by main muscle
      const matchesMainMuscle = selectedMainMuscles.length === 0 || 
        selectedMainMuscles.some(muscle => exercise.mainMuscle?.includes(muscle));
      
      // Filter by equipment
      const matchesEquipment = selectedEquipment.length === 0 || 
        selectedEquipment.some(equip => exercise.equipment?.includes(equip));
      
      // Filter by movement
      const matchesMovement = selectedMovements.length === 0 || 
        selectedMovements.some(move => exercise.movement?.includes(move));
      
      // Filter by mechanics
      const matchesMechanics = selectedMechanics.length === 0 || 
        selectedMechanics.some(mech => exercise.mechanics?.includes(mech));
      
      // Filter by level
      const matchesLevel = selectedLevels.length === 0 || 
        (exercise.level && selectedLevels.includes(exercise.level));

      return matchesSearch && matchesMainMuscle && matchesEquipment && 
             matchesMovement && matchesMechanics && matchesLevel;
    });
  }, [exercises, searchTerm, selectedMainMuscles, selectedEquipment, selectedMovements, selectedMechanics, selectedLevels]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredExercises.length, visibleCount]);

  const toggleFilter = (value: string, current: string[], setter: (value: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
    setVisibleCount(PAGE_SIZE);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedMainMuscles([]);
    setSelectedEquipment([]);
    setSelectedMovements([]);
    setSelectedMechanics([]);
    setSelectedLevels([]);
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilters = searchTerm || selectedMainMuscles.length > 0 || selectedEquipment.length > 0 || 
                           selectedMovements.length > 0 || selectedMechanics.length > 0 || selectedLevels.length > 0;

  const toggleFilterSection = (section: string) => {
    const newSet = new Set(expandedFilters);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedFilters(newSet);
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-3 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises by name..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className="pl-9"
            data-testid="input-exercise-search"
          />
        </div>

        {/* Collapsible Filters */}
        <div className="space-y-2 border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Filters</h4>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
              Clear All
            </Button>
          )}
        </div>

        {/* Main Muscle Filter */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Main Muscle {selectedMainMuscles.length > 0 && `(${selectedMainMuscles.length})`}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {MAIN_MUSCLE_OPTIONS.map((muscle) => (
                <Badge
                  key={muscle}
                  variant={selectedMainMuscles.includes(muscle) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleFilter(muscle, selectedMainMuscles, setSelectedMainMuscles)}
                >
                  {muscle}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Equipment Filter */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Equipment {selectedEquipment.length > 0 && `(${selectedEquipment.length})`}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {EQUIPMENT_OPTIONS.map((equipment) => (
                <Badge
                  key={equipment}
                  variant={selectedEquipment.includes(equipment) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleFilter(equipment, selectedEquipment, setSelectedEquipment)}
                >
                  {equipment}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {!hideMovementFilters && (
          <>
            {/* Movement Pattern Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Movement Pattern {selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MOVEMENT_PATTERN_OPTIONS.map((movement) => (
                    <Badge
                      key={movement}
                      variant={selectedMovements.includes(movement) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(movement, selectedMovements, setSelectedMovements)}
                    >
                      {movement}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Movement Type Filter */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>Movement Type {selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length})`}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {MOVEMENT_TYPE_OPTIONS.map((movement) => (
                    <Badge
                      key={movement}
                      variant={selectedMovements.includes(movement) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(movement, selectedMovements, setSelectedMovements)}
                    >
                      {movement}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Mechanics Filter */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Mechanics {selectedMechanics.length > 0 && `(${selectedMechanics.length})`}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {MECHANICS_OPTIONS.map((mechanic) => (
                <Badge
                  key={mechanic}
                  variant={selectedMechanics.includes(mechanic) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleFilter(mechanic, selectedMechanics, setSelectedMechanics)}
                >
                  {mechanic}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Level Filter */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>Level {selectedLevels.length > 0 && `(${selectedLevels.length})`}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {LEVEL_OPTIONS.map((level) => (
                <Badge
                  key={level}
                  variant={selectedLevels.includes(level) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleFilter(level, selectedLevels, setSelectedLevels)}
                >
                  {level}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      </div>

      {/* Exercise List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} found
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7">
              Clear filters
            </Button>
          )}
        </div>
        {filteredExercises.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border rounded-md">
            <p>No exercises match your filters</p>
            {hasActiveFilters && (
              <Button variant="link" onClick={clearAllFilters} className="mt-2">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {filteredExercises.slice(0, visibleCount).map((exercise) => (
                <div
                  key={exercise.id}
                  onClick={() => handleExerciseTap(exercise.id)}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all bg-card hover:bg-accent active:bg-primary/10"
                  data-testid={`exercise-item-${exercise.id}`}
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-md overflow-hidden">
                    {(() => {
                      const thumbnailUrl = getMuxThumbnailUrl(exercise.muxPlaybackId, { width: 96, height: 96 });
                      if (thumbnailUrl) {
                        return (
                          <img
                            src={thumbnailUrl}
                            alt={exercise.name}
                            className="w-full h-full object-cover"
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          No video
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate text-sm" data-testid={`exercise-name-${exercise.id}`}>
                      {exercise.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">{exercise.level}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary shrink-0" />
                </div>
              ))}
            </div>

            {visibleCount < filteredExercises.length && (
              <div ref={sentinelRef} className="h-10 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
