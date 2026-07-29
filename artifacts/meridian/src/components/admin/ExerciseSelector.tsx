import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, Plus, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const FILTER_KEYS = ['muscle', 'equipment', 'pattern', 'type', 'mechanics', 'level'] as const;
type FilterKey = typeof FILTER_KEYS[number];

export function ExerciseSelector({ exercises, onAddExercise, hideMovementFilters }: ExerciseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMainMuscles, setSelectedMainMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedMechanics, setSelectedMechanics] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState<Set<FilterKey>>(new Set());
  const [visibleCount, setVisibleCount] = useState(15);
  const PAGE_SIZE = 15;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const activeFilterKeys: FilterKey[] = hideMovementFilters
    ? ['muscle', 'equipment', 'mechanics', 'level']
    : [...FILTER_KEYS];

  const anyFilterOpen = openFilters.size > 0;

  const toggleAll = () => {
    if (anyFilterOpen) {
      setOpenFilters(new Set());
    } else {
      setOpenFilters(new Set(activeFilterKeys));
    }
  };

  const toggleFilterSection = (key: FilterKey) => {
    setOpenFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExerciseTap = useCallback((exerciseId: number) => {
    onAddExercise(exerciseId);
  }, [onAddExercise]);

  const filteredExercises = useMemo(() => {
    const uniqueExercises = exercises.filter((exercise, index, self) =>
      index === self.findIndex((e) => e.id === exercise.id)
    );

    const shortcuts: Record<string, string> = {
      'kb': 'kettlebell',
      'bb': 'barbell',
      'db': 'dumbbell',
      'sa': 'single arm',
      'sl': 'single leg',
      'bw': 'bodyweight',
    };

    return uniqueExercises.filter((exercise) => {
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
      const expandedWords = searchWords.map(word => shortcuts[word] || word);
      const exerciseName = exercise.name.toLowerCase();
      const matchesSearch = expandedWords.length === 0 || expandedWords.every(word => exerciseName.includes(word));

      const matchesMainMuscle = selectedMainMuscles.length === 0 ||
        selectedMainMuscles.some(muscle => exercise.mainMuscle?.includes(muscle));

      const matchesEquipment = selectedEquipment.length === 0 ||
        selectedEquipment.some(equip => exercise.equipment?.includes(equip));

      const matchesMovement = selectedMovements.length === 0 ||
        selectedMovements.some(move => exercise.movement?.includes(move));

      const matchesMechanics = selectedMechanics.length === 0 ||
        selectedMechanics.some(mech => exercise.mechanics?.includes(mech));

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

  return (
    <div className="flex flex-col h-full">
      {/* ── Non-scrolling top: search + filters ── */}
      <div className="flex-shrink-0 space-y-3 pb-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
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
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
                  Clear All
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="flex items-center gap-1 text-xs"
              >
                <ChevronsUpDown className="h-3 w-3" />
                {anyFilterOpen ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>
          </div>

          {/* Main Muscle */}
          <Collapsible open={openFilters.has('muscle')} onOpenChange={() => toggleFilterSection('muscle')}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Main Muscle {selectedMainMuscles.length > 0 && `(${selectedMainMuscles.length})`}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('muscle') ? 'rotate-180' : ''}`} />
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

          {/* Equipment */}
          <Collapsible open={openFilters.has('equipment')} onOpenChange={() => toggleFilterSection('equipment')}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Equipment {selectedEquipment.length > 0 && `(${selectedEquipment.length})`}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('equipment') ? 'rotate-180' : ''}`} />
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
              {/* Movement Pattern */}
              <Collapsible open={openFilters.has('pattern')} onOpenChange={() => toggleFilterSection('pattern')}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span>Movement Pattern {selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_PATTERN_OPTIONS.includes(m)).length})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('pattern') ? 'rotate-180' : ''}`} />
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

              {/* Movement Type */}
              <Collapsible open={openFilters.has('type')} onOpenChange={() => toggleFilterSection('type')}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span>Movement Type {selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length > 0 && `(${selectedMovements.filter(m => MOVEMENT_TYPE_OPTIONS.includes(m)).length})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('type') ? 'rotate-180' : ''}`} />
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

          {/* Mechanics */}
          <Collapsible open={openFilters.has('mechanics')} onOpenChange={() => toggleFilterSection('mechanics')}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Mechanics {selectedMechanics.length > 0 && `(${selectedMechanics.length})`}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('mechanics') ? 'rotate-180' : ''}`} />
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

          {/* Level */}
          <Collapsible open={openFilters.has('level')} onOpenChange={() => toggleFilterSection('level')}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span>Level {selectedLevels.length > 0 && `(${selectedLevels.length})`}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.has('level') ? 'rotate-180' : ''}`} />
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

      {/* ── Scrolling exercise list ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20">
        <div className="pt-1">
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
    </div>
  );
}
