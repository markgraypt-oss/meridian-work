import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import TopHeader from '@/components/TopHeader';
import { useLocation } from 'wouter';
import { ExerciseSelector } from '@/components/admin/ExerciseSelector';

export default function SelectExercisePage() {
  const [, navigate] = useLocation();
  
  const { data: exercises = [] } = useQuery<any[]>({
    queryKey: ['/api/exercises'],
    retry: false,
  });

  const movementFilter = useMemo(() => {
    try {
      const stored = sessionStorage.getItem('wodMovementFilter');
      return stored ? JSON.parse(stored) as string[] : null;
    } catch { return null; }
  }, []);

  const filteredExercises = useMemo(() => {
    if (!movementFilter || movementFilter.length === 0) return exercises;
    return exercises.filter((ex: any) => 
      Array.isArray(ex.movement) && ex.movement.some((m: string) => movementFilter.includes(m))
    );
  }, [exercises, movementFilter]);

  const handleAddExercise = (exerciseId: number) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedExerciseId', exerciseId.toString());
      sessionStorage.setItem('returningFromExerciseSelection', 'true');
    }
    const returnPath = sessionStorage.getItem('exerciseSelectionReturnPath') || '/admin/create-workout';
    sessionStorage.removeItem('exerciseSelectionReturnPath');
    navigate(returnPath, { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <TopHeader 
        title="Select Exercise" 
        onBack={() => {
          sessionStorage.removeItem('selectedExerciseId');
          sessionStorage.removeItem('wodMovementFilter');
          const returnPath = sessionStorage.getItem('exerciseSelectionReturnPath') || '/admin/create-workout';
          sessionStorage.removeItem('exerciseSelectionReturnPath');
          navigate(returnPath, { replace: true });
        }}
      />
      
      <div className="flex-1 overflow-y-auto pt-14 px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <ExerciseSelector 
            exercises={filteredExercises}
            onAddExercise={handleAddExercise}
            hideMovementFilters={!!movementFilter}
          />
        </div>
      </div>
    </div>
  );
}
