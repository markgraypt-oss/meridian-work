import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ExerciseForDuration {
  sets?: { duration?: string | number; reps?: string }[];
  durationType?: 'text' | 'timer';
  duration?: string | number;
}

interface BlockForDuration {
  section: string;
  blockType: string;
  exercises: ExerciseForDuration[];
  rest?: string;
  rounds?: number;
  restAfterRound?: string;
}

interface WorkoutForDuration {
  workoutType?: string;
  exercises?: ExerciseForDuration[];
  blocks?: BlockForDuration[];
  circuitRounds?: number;
  intervalRounds?: number;
}

function parseRestToSeconds(rest?: string): number {
  if (!rest) return 0;
  const match = rest.match(/(\d+)/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  if (rest.toLowerCase().includes('min')) {
    return value * 60;
  }
  return value;
}

export function parseDurationToSeconds(duration?: string | number): number {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  
  const lowerDuration = duration.toLowerCase();
  let totalSeconds = 0;
  
  const minMatch = lowerDuration.match(/(\d+)\s*min/);
  if (minMatch) {
    totalSeconds += parseInt(minMatch[1]) * 60;
  }
  
  const secMatch = lowerDuration.match(/(\d+)\s*sec/);
  if (secMatch) {
    totalSeconds += parseInt(secMatch[1]);
  }
  
  if (!minMatch && !secMatch) {
    const numMatch = duration.match(/(\d+)/);
    if (numMatch) {
      totalSeconds = parseInt(numMatch[1]);
    }
  }
  
  return totalSeconds;
}

export function calculateWorkoutDuration(workout: WorkoutForDuration): number {
  const workoutType = workout.workoutType || 'regular';
  
  if (workoutType === 'interval' && workout.blocks && workout.blocks.length > 0) {
    return calculateIntervalDuration(workout.blocks);
  }
  
  if (workoutType === 'circuit') {
    const circuitRounds = workout.intervalRounds || workout.circuitRounds || 3;
    return calculateCircuitDuration(workout.exercises || [], circuitRounds);
  }
  
  return calculateRegularDuration(workout.exercises || [], workout.blocks);
}

function calculateIntervalDuration(blocks: BlockForDuration[]): number {
  let totalSeconds = 0;
  
  const isWarmup = (section: string) => section === 'warmup' || section === 'warm_up';
  const mainBlocks = blocks.filter(b => !isWarmup(b.section));
  const warmupBlocks = blocks.filter(b => isWarmup(b.section));
  
  for (const block of warmupBlocks) {
    for (const exercise of block.exercises) {
      totalSeconds += calculateExerciseTime(exercise);
    }
    totalSeconds += parseRestToSeconds(block.rest);
  }
  
  for (const block of mainBlocks) {
    const rounds = block.rounds || 3;
    let blockTime = 0;
    
    for (const exercise of block.exercises) {
      blockTime += calculateExerciseTime(exercise);
    }
    
    totalSeconds += blockTime * rounds;
    
    totalSeconds += parseRestToSeconds(block.restAfterRound) * (rounds - 1);
    
    totalSeconds += parseRestToSeconds(block.rest);
  }
  
  return Math.ceil(totalSeconds / 60);
}

function calculateCircuitDuration(exercises: ExerciseForDuration[], rounds: number): number {
  let exerciseTime = 0;
  
  for (const exercise of exercises) {
    exerciseTime += calculateExerciseTime(exercise);
  }
  
  const totalSeconds = exerciseTime * rounds;
  return Math.ceil(totalSeconds / 60);
}

function calculateRegularDuration(exercises: ExerciseForDuration[], blocks?: BlockForDuration[]): number {
  let totalSeconds = 0;
  
  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      for (const exercise of block.exercises) {
        totalSeconds += calculateExerciseTime(exercise);
      }
      totalSeconds += parseRestToSeconds(block.rest);
    }
  } else {
    for (const exercise of exercises) {
      totalSeconds += calculateExerciseTime(exercise);
    }
  }
  
  const minutes = Math.ceil(totalSeconds / 60);
  return Math.max(minutes, exercises.length * 2);
}

function calculateExerciseTime(exercise: ExerciseForDuration): number {
  const sets = exercise.sets || [];
  let totalTime = 0;
  
  for (const set of sets) {
    if (exercise.durationType === 'timer' && set.duration) {
      totalTime += parseDurationToSeconds(set.duration);
    } else {
      const reps = parseInt(set.reps || '10') || 10;
      totalTime += reps * 3;
    }
  }
  
  if (sets.length === 0) {
    if (exercise.durationType === 'timer' && exercise.duration) {
      totalTime = parseDurationToSeconds(exercise.duration);
    } else {
      totalTime = 60;
    }
  }
  
  return totalTime;
}
