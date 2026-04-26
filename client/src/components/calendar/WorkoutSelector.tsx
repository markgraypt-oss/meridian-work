import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Hammer, MoreVertical, Dumbbell, Zap, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface WorkoutSelectorProps {
  selectedDate: Date;
  onBack: () => void;
  onSelectWorkout: (workout: any) => void;
}

type WorkoutType = 'regular' | 'circuit' | 'interval';
type MainTab = 'my-programme' | 'library' | 'saved' | 'my-workouts';
type LibrarySubFilter = 'workouts' | 'stretching' | 'yoga' | 'corrective';

const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: any }[] = [
  { id: 'regular', label: 'Regular', icon: Dumbbell },
  { id: 'circuit', label: 'Circuit', icon: RotateCcw },
  { id: 'interval', label: 'Interval', icon: Zap },
];

const LIBRARY_SUB_FILTERS: { id: LibrarySubFilter; label: string; routineType: string }[] = [
  { id: 'workouts', label: 'Workouts', routineType: 'workout' },
  { id: 'stretching', label: 'Mobility', routineType: 'stretching' },
  { id: 'yoga', label: 'Yoga', routineType: 'yoga' },
  { id: 'corrective', label: 'Corrective', routineType: 'corrective' },
];

export default function WorkoutSelector({ selectedDate, onBack, onSelectWorkout }: WorkoutSelectorProps) {
  const [, setLocation] = useLocation();
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('my-programme');
  const [librarySubFilter, setLibrarySubFilter] = useState<LibrarySubFilter>('workouts');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: workouts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workouts'],
  });

  const { data: myWorkouts = [], isLoading: isLoadingMine } = useQuery<any[]>({
    queryKey: ['/api/workouts/mine'],
  });

  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useQuery<any[]>({
    queryKey: ['/api/bookmarks'],
  });

  // Fetch programme timeline to get current enrollment
  const { data: programmeTimeline, isLoading: isLoadingTimeline } = useQuery<any>({
    queryKey: ['/api/my-programs/timeline'],
  });

  const currentEnrollmentId = programmeTimeline?.current?.id;

  // Fetch enrolled programme details (includes workouts)
  const { data: enrolledProgramDetails, isLoading: isLoadingProgramme } = useQuery<any>({
    queryKey: ['/api/my-programs', currentEnrollmentId],
    queryFn: async () => {
      const res = await fetch(`/api/my-programs/${currentEnrollmentId}`);
      if (!res.ok) throw new Error('Failed to fetch program');
      return res.json();
    },
    enabled: !!currentEnrollmentId,
  });

  // Extract unique workouts from enrolled programme (deduplicated by templateWorkoutId)
  const programmeWorkouts = useMemo(() => {
    const allProgrammeWorkouts = enrolledProgramDetails?.workouts || [];
    const seenTemplateIds = new Set<number>();
    return allProgrammeWorkouts
      .filter((workout: any) => {
        const templateId = workout.templateWorkoutId;
        if (seenTemplateIds.has(templateId)) return false;
        seenTemplateIds.add(templateId);
        return true;
      })
      .map((workout: any) => ({
        id: `programme-${workout.enrollmentWorkoutId || workout.templateWorkoutId}`,
        title: workout.name,
        imageUrl: workout.imageUrl,
        enrollmentId: currentEnrollmentId,
        enrollmentWorkoutId: workout.enrollmentWorkoutId,
        week: workout.week,
        day: workout.day,
      }));
  }, [enrolledProgramDetails, currentEnrollmentId]);

  // Admin-only library workouts (used by Library tab + sub-filters and as the lookup for Saved)
  const libraryWorkouts = useMemo(
    () => workouts.filter((w: any) => w.sourceType === 'admin' || !w.userId),
    [workouts]
  );

  // Saved workouts: bookmarked workout IDs cross-referenced with the workouts list
  const savedWorkouts = useMemo(() => {
    const bookmarkedIds = new Set(
      bookmarks
        .filter((b: any) => b.contentType === 'workout')
        .map((b: any) => b.contentId)
    );
    return workouts.filter((w: any) => bookmarkedIds.has(w.id));
  }, [bookmarks, workouts]);

  // Tab counts (only My Workouts shows a count, matching mobile)
  const myWorkoutsCount = myWorkouts.length;

  // Compute the visible list based on the active tab
  const baseList = useMemo(() => {
    switch (mainTab) {
      case 'my-programme':
        return programmeWorkouts;
      case 'library': {
        const targetRoutineType = LIBRARY_SUB_FILTERS.find(f => f.id === librarySubFilter)!.routineType;
        return libraryWorkouts.filter((w: any) => w.routineType === targetRoutineType);
      }
      case 'saved':
        return savedWorkouts;
      case 'my-workouts':
        return myWorkouts;
      default:
        return [];
    }
  }, [mainTab, librarySubFilter, programmeWorkouts, libraryWorkouts, savedWorkouts, myWorkouts]);

  // Apply search filter on top
  const filteredWorkouts = useMemo(() => {
    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.toLowerCase();
    return baseList.filter((w: any) => (w.title || '').toLowerCase().includes(q));
  }, [baseList, searchQuery]);

  const handleBuildWOD = () => {
    setShowTypeSheet(true);
  };

  const handleSelectType = (type: WorkoutType) => {
    setShowTypeSheet(false);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLocation(`/build-wod?type=${type}&date=${dateStr}`);
  };

  const isLoadingAnything =
    isLoading || isLoadingMine || isLoadingBookmarks || isLoadingTimeline || isLoadingProgramme;

  const emptyMessage = (() => {
    if (searchQuery.trim()) return 'No workouts match your search';
    switch (mainTab) {
      case 'my-programme':
        return 'No enrolled programme';
      case 'library':
        return 'No workouts in this category';
      case 'saved':
        return 'No saved workouts yet';
      case 'my-workouts':
        return 'You haven\'t built any workouts yet';
    }
  })();

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="bg-background text-foreground px-4 py-4 flex items-center justify-between border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-foreground hover:bg-muted"
          data-testid="button-back-workout"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-semibold">Workout</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground"
          data-testid="button-today"
        >
          TODAY
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-background text-foreground overflow-x-hidden overflow-y-auto">
        <div className="p-4 space-y-3 w-full box-border">
          {/* Build WOD Option */}
          <button
            onClick={handleBuildWOD}
            className="w-full flex items-center gap-4 bg-blue-500 hover:bg-blue-600 rounded-full py-4 px-6 transition-colors"
            data-testid="button-build-wod"
          >
            <div className="bg-white/20 p-3 rounded-full">
              <Hammer className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-white">Build WOD</p>
            </div>
          </button>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
              data-testid="input-search-workouts"
            />
          </div>

          {/* Main Tabs */}
          <div className="border-b border-border mt-2">
            <div className="flex gap-4 overflow-x-auto -mx-4 px-4 scrollbar-hide">
              {([
                { id: 'my-programme' as MainTab, label: 'My Programme' },
                { id: 'library' as MainTab, label: 'Library' },
                { id: 'saved' as MainTab, label: 'Saved' },
                { id: 'my-workouts' as MainTab, label: `My Workouts${myWorkoutsCount > 0 ? ` (${myWorkoutsCount})` : ''}` },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id)}
                  className={`pb-2 pt-1 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    mainTab === tab.id
                      ? 'border-[#0cc9a9] text-[#0cc9a9]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Library sub-filter pills (only when Library is the active tab) */}
          {mainTab === 'library' && (
            <div className="flex gap-1 mt-3 overflow-x-auto pb-2 -mx-4 px-4">
              {LIBRARY_SUB_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setLibrarySubFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    librarySubFilter === filter.id
                      ? 'bg-[#0cc9a9] text-black'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  data-testid={`filter-${filter.id}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}

          {/* Workout list */}
          <div className="mt-3">
            {isLoadingAnything ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
            ) : filteredWorkouts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">{emptyMessage}</p>
            ) : (
              filteredWorkouts.map((workout: any) => (
                <div
                  key={workout.id}
                  onClick={() => onSelectWorkout(workout)}
                  className="flex items-center gap-3 bg-card hover:bg-muted rounded-lg py-2 px-3 mb-2 transition-colors cursor-pointer border border-border"
                  data-testid={`workout-${workout.id}`}
                >
                  {/* Workout Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {workout.imageUrl ? (
                      <img
                        src={workout.imageUrl}
                        alt={workout.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <p className="flex-1 font-medium text-base truncate text-left">{workout.title}</p>
                  <div
                    className="text-muted-foreground flex-shrink-0 p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Workout Type Selection Bottom Sheet */}
      {showTypeSheet && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-end"
          onClick={() => setShowTypeSheet(false)}
        >
          <div
            className="w-full bg-card rounded-t-3xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-2" />

            {/* Header with Cancel */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={() => setShowTypeSheet(false)}
                className="text-[#0cc9a9] font-medium"
                data-testid="button-cancel-type"
              >
                Cancel
              </button>
              <h2 className="text-foreground font-semibold">Build your workout</h2>
              <div className="w-14" /> {/* Spacer for centering */}
            </div>

            {/* Options */}
            <div className="py-2 pb-6">
              {WORKOUT_TYPES.map((type, index) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  className={`w-full flex items-center py-4 px-6 hover:bg-muted transition-colors ${
                    index < WORKOUT_TYPES.length - 1 ? 'border-b border-border' : ''
                  }`}
                  data-testid={`button-type-${type.id}`}
                >
                  <span className="text-foreground text-lg">{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
