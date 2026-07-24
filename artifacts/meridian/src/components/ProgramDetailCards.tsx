import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Dumbbell, Target, Zap } from "lucide-react";
import { format, addWeeks } from "date-fns";
import WorkoutScheduleCalendar from "@/components/WorkoutScheduleCalendar";
import type { Program } from "@shared/schema";
import workoutImage1 from "@assets/1_1763807144487.png";
import workoutImage2 from "@assets/2_1763807144487.png";
import workoutImage3 from "@assets/3_1763807144487.png";

interface ProgrammeDetailCardsProps {
  program: Program;
  startDate?: string;
  workouts?: any[];
  showTimeline?: boolean;
  enrollmentId?: number;
}

export function ProgrammeDetailCards({
  program,
  startDate,
  workouts = [],
  showTimeline = false,
  enrollmentId
}: ProgrammeDetailCardsProps) {
  const [, navigate] = useLocation();
  const [selectedWeek, setSelectedWeek] = useState(1);

  const formatGoal = (goal: string) => {
    return goal.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Filter workouts to only show the selected week
  // If the selected week has no workouts, fall back to week 1's schedule (repeating pattern)
  let weekWorkouts = workouts.filter((workout: any) => workout.week === selectedWeek);
  if (weekWorkouts.length === 0 && selectedWeek > 1) {
    // Use week 1's schedule as the template for other weeks
    weekWorkouts = workouts.filter((workout: any) => workout.week === 1);
  }
  const distinctWorkouts = weekWorkouts.slice(0, 5);

  // Calculate end date if startDate is provided
  const getEndDate = () => {
    if (!startDate) return null;
    const start = new Date(startDate);
    return addWeeks(start, program.weeks);
  };

  return (
    <div>
      {/* Info Cards Row */}
      {showTimeline ? (
        // Timeline view (for enrolled programs)
        <div className="flex gap-4 mb-4">
          <Card className="bg-card flex-[2] flex flex-col justify-center min-h-[80px]">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Timeline</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                {startDate && getEndDate() ? (
                  <p className="font-semibold text-sm text-foreground">
                    {format(new Date(startDate), 'dd MMM')} - {format(getEndDate()!, 'dd MMM')}
                  </p>
                ) : (
                  <p className="font-semibold text-sm text-foreground">N/A</p>
                )}
                <p className="font-semibold text-sm bg-primary text-white px-3 py-1 rounded">
                  {program.weeks} weeks
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card flex-1 flex flex-col justify-center min-h-[80px]">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Dumbbell className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Total Workouts</p>
              </div>
              <p className="font-semibold text-lg text-foreground">
                {distinctWorkouts.length || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Duration view (for non-enrolled programs)
        <div className="flex gap-4 mb-4">
          <Card className="bg-card flex-[2] flex flex-col justify-center min-h-[80px]">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Duration</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <p className="font-semibold text-sm bg-primary text-white px-3 py-1 rounded">
                  {program.weeks} weeks
                </p>
                <p className="font-semibold text-sm text-foreground">
                  {program.duration} min
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card flex-1 flex flex-col justify-center min-h-[80px]">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Frequency</p>
              </div>
              <p className="font-semibold text-lg text-foreground">
                {program.trainingDaysPerWeek || 'N/A'} days/week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Info Row - Programme Focus and Difficulty */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-card min-h-[92px]">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Programme Focus</p>
            </div>
            <p className="font-semibold text-sm bg-primary text-white px-3 py-1 rounded capitalize inline-block">
              {formatGoal(program.goal)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card min-h-[92px]">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Difficulty</p>
            </div>
            <p className="font-semibold text-sm text-foreground capitalize mt-1">
              {program.difficulty}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workouts Section - Cards only */}
      {distinctWorkouts.length > 0 && (
        <div className="space-y-4 mb-8">
          {distinctWorkouts.map((workout: any, index: number) => (
            <Card 
              key={`${workout.week}-${workout.day}`}
              className="bg-card border-border hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
              onClick={() => navigate(`/workout-detail/${enrollmentId}/${workout.week}/${workout.day}`)}
              data-testid={`card-workout-${index}`}
            >
              <CardContent className="p-0 flex">
                {/* Image - 25% width */}
                <div className="w-1/4 flex items-center justify-center min-h-[80px] overflow-hidden">
                  <img 
                    src={[workoutImage1, workoutImage2, workoutImage3][index % 3]} 
                    alt={workout.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content - 75% width */}
                <div className="w-3/4 p-4 pl-6 flex flex-col justify-center">
                  {/* Workout Title */}
                  <h3 className="text-lg font-bold text-foreground mb-3">
                    {workout.name}
                  </h3>

                  {/* Exercise details summary */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" />
                      <span>{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span>|</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>~{workout.exercises.length * 2} min</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Weekly Schedule Calendar */}
      {distinctWorkouts.length > 0 && (
        <WorkoutScheduleCalendar 
          workouts={weekWorkouts} 
          enrollmentId={enrollmentId?.toString() || ''}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          totalWeeks={program.weeks}
        />
      )}
    </div>
  );
}
