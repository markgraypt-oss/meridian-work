import { useLocation } from "wouter";
import { getMuxThumbnailUrl } from "@/lib/mux";
import { saveScrollRestore } from "@/lib/scrollRestore";


// Extract only numeric reps from a string (e.g., "1 x each side" -> null, "8-12" -> "8-12", "10" -> "10")
function extractNumericReps(reps: string): string | null {
  if (!reps) return null;
  const trimmed = reps.trim();
  // Match patterns like "8", "8-12", "10-12", etc. (just numbers and optional hyphen range)
  const numericMatch = trimmed.match(/^(\d+(?:-\d+)?)$/);
  if (numericMatch) return numericMatch[1];
  // Also try to extract the first numeric pattern if mixed with text
  const extractMatch = trimmed.match(/^(\d+(?:-\d+)?)/);
  if (extractMatch && extractMatch[1] !== trimmed) {
    // Only return if there's additional text (meaning it's not purely numeric)
    return extractMatch[1];
  }
  return numericMatch ? numericMatch[1] : null;
}

// Check if a reps/duration value is distance-based (e.g., "30 metres", "20m")
function isDistanceBased(value: string): boolean {
  if (!value) return false;
  return /metre|meter|m\b/i.test(value);
}

// Format reps with "rep/reps" inserted after the number but before any additional text
// e.g., "1 x each side" -> "1 x rep each side", "8-12" -> "8-12 reps", "1" -> "1 rep"
// Distance values like "30 metres" are returned as-is without adding "reps"
function formatRepsDisplay(reps: string): string {
  if (!reps) return '';
  const trimmed = reps.trim();
  
  if (isDistanceBased(trimmed)) return trimmed;
  
  // Helper to determine singular or plural
  const getRepWord = (num: string) => num === '1' ? 'rep' : 'reps';
  
  // Check if it's just a number or range (e.g., "8", "8-12")
  if (/^\d+(?:-\d+)?$/.test(trimmed)) {
    return `${trimmed} ${getRepWord(trimmed)}`;
  }
  // Check for pattern like "1 x each side" - insert "rep/reps" after "x" or the number
  const match = trimmed.match(/^(\d+(?:-\d+)?)\s*(x?)\s*(.*)$/i);
  if (match) {
    const numPart = match[1];
    const xPart = match[2] ? ` ${match[2]}` : '';
    const textPart = match[3] ? ` ${match[3].trim()}` : '';
    return `${numPart}${xPart} ${getRepWord(numPart)}${textPart}`;
  }
  // Fallback: just append reps
  return `${trimmed} reps`;
}

// Helper to render text with white numbers and grey text
function renderWithWhiteNumbers(text: string) {
  if (!text) return null;
  
  const regex = /\d+(?:-\d+)?/g;
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match (grey)
    if (match.index > lastIndex) {
      result.push(
        <span key={keyIdx++} className="text-muted-foreground">
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    // Add the number (white)
    result.push(
      <span key={keyIdx++} className="text-foreground">
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text after last match (grey)
  if (lastIndex < text.length) {
    result.push(
      <span key={keyIdx++} className="text-muted-foreground">
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  // Wrap in a single span to preserve whitespace in flex containers
  return <span className="text-muted-foreground">{result}</span>;
}

interface ExerciseCardProps {
  exercise: any;
  index: number;
  workoutId?: string;
  label?: string;
  circuitRounds?: number;
  isIntervalWorkout?: boolean;
}

export function ExerciseCard({ exercise, index, workoutId, label, circuitRounds, isIntervalWorkout }: ExerciseCardProps) {
  const [, navigate] = useLocation();
  const displayName = exercise.exerciseName || exercise.name || "Unknown Exercise";
  const displayLabel = label || `${index + 1}A`;
  
  // Handle both old format (sets as number) and new format (sets as JSONB array)
  const setsArray = Array.isArray(exercise.sets) ? exercise.sets : [];
  const numSets = setsArray.length || parseInt(exercise.sets) || 0;
  
  // Check if this is a time-based exercise
  const isTimeBased = exercise.durationType === 'timer' || exercise.durationType === 'time';
  
  // Check if this is a 'general' type exercise (should only show duration, not reps)
  const isGeneralType = exercise.exerciseType === 'general';
  
  // Helper to parse duration string to seconds for comparison
  const parseDurationToSeconds = (duration: string): number => {
    if (!duration) return 0;
    const minMatch = duration.match(/(\d+)\s*min/i);
    const secMatch = duration.match(/(\d+)\s*sec/i);
    let seconds = 0;
    if (minMatch) seconds += parseInt(minMatch[1]) * 60;
    if (secMatch) seconds += parseInt(secMatch[1]);
    // If just a number, assume seconds
    if (!minMatch && !secMatch) {
      const numMatch = duration.match(/(\d+)/);
      if (numMatch) seconds = parseInt(numMatch[1]);
    }
    return seconds;
  };
  
  // Helper to format duration with proper singular/plural and spacing
  const formatDurationPlural = (duration: string): string => {
    if (!duration) return '';
    // Handle both singular and plural suffixes, ensure space after number
    return duration
      .replace(/(\d+)\s*secs?\b/gi, (_, num) => `${num} ${num === '1' ? 'sec' : 'secs'}`)
      .replace(/(\d+)\s*mins?\b/gi, (_, num) => `${num} ${num === '1' ? 'min' : 'mins'}`);
  };
  
  // For time-based exercises, get duration display with range
  const allDurations = setsArray.map((s: any) => s.duration).filter(Boolean) as string[];
  const uniqueDurations = Array.from(new Set(allDurations));
  let durationDisplay = '';
  if (uniqueDurations.length === 1) {
    durationDisplay = formatDurationPlural(uniqueDurations[0]);
  } else if (uniqueDurations.length > 1) {
    // Calculate min and max durations
    const durationsInSeconds = uniqueDurations.map(parseDurationToSeconds);
    const minSec = Math.min(...durationsInSeconds);
    const maxSec = Math.max(...durationsInSeconds);
    // Format as range (use secs if both under 60, otherwise use original format)
    if (maxSec < 60) {
      durationDisplay = `${minSec}-${maxSec} secs`;
    } else {
      // Find the original strings for min and max
      const minDuration = uniqueDurations.find(d => parseDurationToSeconds(d) === minSec) || `${minSec} sec`;
      const maxDuration = uniqueDurations.find(d => parseDurationToSeconds(d) === maxSec) || `${maxSec} sec`;
      durationDisplay = `${minDuration.replace(/\s*(sec|min)s?/i, '')}-${formatDurationPlural(maxDuration)}`;
    }
  }
  
  // Check if exercise uses distance (e.g., carries use metres)
  const allReps = setsArray.map((s: any) => s.reps).filter(Boolean);
  const allSetDurations = setsArray.map((s: any) => s.duration).filter(Boolean);
  const isDistanceExercise = displayName.toLowerCase().includes('carry') || 
    allReps.some((r: string) => isDistanceBased(r)) ||
    allSetDurations.some((d: string) => isDistanceBased(d));
  
  // For distance exercises, use the full reps/duration text (e.g., "30 metres")
  // For regular exercises, extract numeric only for the summary display
  let repsDisplay: string;
  if (isDistanceExercise) {
    const distanceValues = allSetDurations.length > 0 
      ? allSetDurations 
      : allReps;
    const uniqueDistances = Array.from(new Set(distanceValues));
    repsDisplay = uniqueDistances.length === 1 ? uniqueDistances[0] : (distanceValues[0] || '');
  } else {
    const allNumericReps = allReps.map((r: string) => extractNumericReps(r)).filter(Boolean) as string[];
    const uniqueNumericReps = Array.from(new Set(allNumericReps));
    repsDisplay = uniqueNumericReps.length === 1 
      ? uniqueNumericReps[0] 
      : uniqueNumericReps.length > 1 
        ? `${uniqueNumericReps[uniqueNumericReps.length - 1]}-${uniqueNumericReps[0]}` 
        : extractNumericReps(exercise.reps || '') || '';
  }

  // Determine if all sets are identical (hide breakdown if so)
  const allSetsIdentical = setsArray.length > 0 && (() => {
    const firstSet = JSON.stringify({ reps: setsArray[0]?.reps || '', duration: setsArray[0]?.duration || '' });
    return setsArray.every((s: any) => JSON.stringify({ reps: s.reps || '', duration: s.duration || '' }) === firstSet);
  })();

  return (
    <div className="bg-card border border-border rounded-lg py-2.5 px-4 w-full relative">
      {/* Badge in top left corner */}
      <div className="absolute top-0 left-0 bg-primary/20 text-primary rounded-br px-2 py-1">
        <span className="text-sm font-bold leading-none">{displayLabel}</span>
      </div>
      
      {/* Rest Time - bottom right corner (hidden when set to 'none') */}
      {exercise.rest && exercise.rest !== 'none' && !(numSets <= 1 && exercise.rest === 'No Rest') && (
        <div className="absolute bottom-3 right-4 text-right">
          {exercise.rest === 'No Rest' ? (
            <p className="text-sm font-semibold text-muted-foreground">No Rest</p>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">Rest</p>
              <p className="text-sm font-semibold text-foreground">{exercise.rest}</p>
            </>
          )}
        </div>
      )}
      
      {/* Top Row: Image + Name/Summary centered together */}
      <div className="flex gap-3 items-center ml-5">
        {/* Image */}
        <button
          onClick={() => {
            if (workoutId) {
              saveScrollRestore(workoutId, window.scrollY);
              navigate(`/exercise/${exercise.exerciseLibraryId}?returnTo=${encodeURIComponent(workoutId)}`);
            }
          }}
          className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
          data-testid={`img-exercise-${exercise.exerciseLibraryId}`}
        >
          {getMuxThumbnailUrl(exercise.muxPlaybackId) ? (
            <img 
              src={getMuxThumbnailUrl(exercise.muxPlaybackId, { width: 128 })!} 
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No video
            </div>
          )}
        </button>
        
        {/* Name + Summary */}
        <div className={`flex-1 ${exercise.rest && exercise.rest !== 'none' ? 'pr-16' : ''}`}>
          <button 
            onClick={() => {
              if (workoutId) {
                saveScrollRestore(workoutId, window.scrollY);
                navigate(`/exercise/${exercise.exerciseLibraryId}?returnTo=${encodeURIComponent(workoutId)}`);
              }
            }}
            className="font-bold text-foreground text-[15px] hover:text-primary transition-colors text-left leading-tight"
          >
            {displayName}
          </button>
          {(circuitRounds || numSets > 0) && (repsDisplay || durationDisplay) && (
            <div className="text-xs text-muted-foreground mt-1">
              {circuitRounds || numSets} {(circuitRounds || numSets) === 1 ? 'Set' : 'Sets'} x{' '}
              {isIntervalWorkout && durationDisplay ? (
                durationDisplay
              ) : isTimeBased && durationDisplay ? (
                <>
                  {durationDisplay}
                  {!isGeneralType && repsDisplay && (
                    <> x {repsDisplay} {repsDisplay === '1' ? 'Rep' : 'Reps'}</>
                  )}
                </>
              ) : repsDisplay ? (
                <>
                  {repsDisplay}
                  {!isDistanceExercise && (
                    <> {repsDisplay === '1' ? 'Rep' : 'Reps'}</>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
          
      {/* Sets Breakdown - only show when sets differ (hide for circuit, interval, and identical sets) */}
      {numSets > 0 && !circuitRounds && !isIntervalWorkout && !allSetsIdentical && (
        <div className="mt-3 ml-[calc(1.25rem+4rem+1.25rem)] flex">
          {/* Left column with continuous line and circles */}
          <div className="relative w-5 mr-2 flex flex-col items-center">
            {/* Continuous vertical line behind circles (if more than 1 set) */}
            {numSets > 1 && (
              <div 
                className="absolute left-1/2 -translate-x-1/2 w-px bg-[#0cc9a9]" 
                style={{ top: '8px', bottom: '8px' }} 
              />
            )}
            {/* Circles positioned along the line */}
            {(setsArray.length > 0 ? setsArray : Array.from({ length: numSets })).map((_: any, setIdx: number) => (
              <div 
                key={setIdx} 
                className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0 z-10 bg-white"
                style={{ marginBottom: setIdx < numSets - 1 ? '10px' : '0' }}
              >
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-white font-semibold leading-none">{setIdx + 1}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Right column with set details */}
          <div className="flex flex-col" style={{ gap: '10px' }}>
            {(setsArray.length > 0 ? setsArray : Array.from({ length: numSets })).map((set: any, setIdx: number) => (
              <span key={setIdx} className="text-sm h-4 flex items-center text-foreground">
                {setsArray.length > 0 ? (
                  isDistanceExercise ? (
                    <span>{set.duration && isDistanceBased(set.duration) ? set.duration : (set.reps && isDistanceBased(set.reps) ? set.reps : formatRepsDisplay(set.reps || set.duration))}</span>
                  ) : isTimeBased ? (
                    <>
                      <span>{formatDurationPlural(set.duration || '30 secs')}</span>
                      {!isGeneralType && set.reps && (
                        <>
                          <span className="text-muted-foreground">&nbsp;x&nbsp;</span>
                          <span>{formatRepsDisplay(set.reps)}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>{formatRepsDisplay(set.reps)}</span>
                  )
                ) : (
                  isTimeBased ? (
                    <>
                      <span>{formatDurationPlural(exercise.duration || '30 secs')}</span>
                      {!isGeneralType && exercise.reps && (
                        <>
                          <span className="text-muted-foreground">&nbsp;x&nbsp;</span>
                          <span>{formatRepsDisplay(exercise.reps)}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>{formatRepsDisplay(exercise.reps)}</span>
                  )
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
