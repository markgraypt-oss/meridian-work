import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Hammer, MoreVertical, Dumbbell, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface WorkoutSelectorProps {
  selectedDate: Date;
  onBack: () => void;
  onSelectWorkout: (workout: any) => void;
}

type WorkoutType = 'regular' | 'circuit' | 'interval';
type LibraryFilter = 'my-programme' | 'workouts' | 'stretching' | 'yoga' | 'corrective';

const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: any }[] = [
  { id: 'regular', label: 'Regular', icon: Dumbbell },
  { id: 'circuit', label: 'Circuit', icon: RotateCcw },
  { id: 'interval', label: 'Interval', icon: Zap },
];

const LIBRARY_FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'my-programme', label: 'My Programme' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'stretching', label: 'Mobility' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'corrective', label: 'Corrective' },
];

export default function WorkoutSelector({ selectedDate, onBack, onSelectWorkout }: WorkoutSelectorProps) {
  const [, setLocation] = useLocation();
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('my-programme');
  
  const { data: workouts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workouts'],
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
  const allProgrammeWorkouts = enrolledProgramDetails?.workouts || [];
  const seenTemplateIds = new Set<number>();
  const programmeWorkouts = allProgrammeWorkouts
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

  // Filter workouts based on selected library filter
  const filteredWorkouts = libraryFilter === 'my-programme' 
    ? programmeWorkouts 
    : workouts.filter((workout: any) => {
        const title = (workout.title || '').toLowerCase();
        
        switch (libraryFilter) {
          case 'stretching':
            return title.includes('stretch') || title.includes('mobility');
          case 'yoga':
            return title.includes('yoga');
          case 'corrective':
            return title.includes('corrective');
          case 'workouts':
          default:
            // Show workouts that are NOT stretching, yoga, or corrective
            return !title.includes('stretch') && 
                   !title.includes('mobility') && 
                   !title.includes('yoga') && 
                   !title.includes('corrective');
        }
      });

  const handleBuildWOD = () => {
    setShowTypeSheet(true);
  };

  const handleSelectType = (type: WorkoutType) => {
    setShowTypeSheet(false);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLocation(`/build-wod?type=${type}&date=${dateStr}`);
  };

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

            {/* Workout Library */}
            {!(isLoading || isLoadingTimeline || isLoadingProgramme) && (
              <div className="mt-6">
                <h3 className="text-muted-foreground text-sm mb-3">WORKOUT LIBRARY</h3>
                
                {/* Filter Buttons */}
                <div className="flex gap-1 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
                  {LIBRARY_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setLibraryFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        libraryFilter === filter.id
                          ? 'bg-[#0cc9a9] text-black'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      data-testid={`filter-${filter.id}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                
                {filteredWorkouts.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center">
                    {libraryFilter === 'my-programme' ? 'No enrolled programme' : 'No workouts in this category'}
                  </p>
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
            )}
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
