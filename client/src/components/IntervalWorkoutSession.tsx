import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, SkipForward, SkipBack, Square, X, Lock, Dumbbell } from 'lucide-react';
import { parseDurationToSeconds } from '@/lib/utils';
import MuxPlayer from "@mux/mux-player-react";
import CircularTimer from './CircularTimer';

interface Exercise {
  id: number;
  exerciseName: string;
  sets: { duration?: string; reps?: string }[];
  imageUrl?: string | null;
  muxPlaybackId?: string | null;
}

interface Circuit {
  exercises: Exercise[];
  rounds: number;
  restAfterRound: string;
}

interface IntervalWorkoutSessionProps {
  circuits: Circuit[];
  startingCircuitIndex?: number;
  onComplete: () => void;
  onClose: (nextCircuitIndex?: number) => void;
}

type SessionPhase = 'getReady' | 'countdown' | 'exercise' | 'rest' | 'circuitComplete' | 'complete';

export default function IntervalWorkoutSession({
  circuits,
  startingCircuitIndex = 0,
  onComplete,
  onClose,
}: IntervalWorkoutSessionProps) {
  const [phase, setPhase] = useState<SessionPhase>('getReady');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [currentCircuitIndex, setCurrentCircuitIndex] = useState(startingCircuitIndex);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [countdownValue, setCountdownValue] = useState(3);
  
  const [totalWorkoutTime, setTotalWorkoutTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Lock controls state
  const [isLocked, setIsLocked] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  
  // Voice announcement tracking
  const [announcedHalfway, setAnnouncedHalfway] = useState(false);
  const [announcedTenSeconds, setAnnouncedTenSeconds] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  const currentCircuit = circuits[currentCircuitIndex];
  const currentExercise = currentCircuit?.exercises[currentExerciseIndex];

  // Calculate total workout time on mount
  useEffect(() => {
    let total = 0;
    circuits.forEach(circuit => {
      const exerciseTime = circuit.exercises.reduce((acc, ex) => {
        return acc + parseDurationToSeconds(ex.sets[0]?.duration || '30 sec');
      }, 0);
      const restTime = parseDurationToSeconds(circuit.restAfterRound || '60 sec');
      total += (exerciseTime * circuit.rounds) + (restTime * (circuit.rounds - 1));
    });
    setTotalWorkoutTime(total);
  }, [circuits]);

  const getExerciseDuration = (exercise: Exercise): number => {
    const duration = exercise.sets[0]?.duration || '30 sec';
    return parseDurationToSeconds(duration);
  };

  const getRestDuration = (): number => {
    if (!currentCircuit) return 60;
    return parseDurationToSeconds(currentCircuit.restAfterRound || '60 sec');
  };

  const getNextExercise = (): Exercise | null => {
    if (!currentCircuit?.exercises) return null;

    if (phase === 'rest') {
      if (currentRound < currentCircuit.rounds) {
        return currentCircuit.exercises[0];
      }
      return null;
    }

    if (currentExerciseIndex < currentCircuit.exercises.length - 1) {
      return currentCircuit.exercises[currentExerciseIndex + 1];
    }

    if (currentRound < currentCircuit.rounds) {
      return null; // Rest is next
    }

    return null;
  };

  const speakText = useCallback((text: string) => {
    try {
      if ('speechSynthesis' in window) {
        // Cancel any pending speech to prevent queue buildup
        window.speechSynthesis.cancel();
        
        // Small delay to ensure cancel completes before new speech
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.volume = 1;
          window.speechSynthesis.speak(utterance);
        }, 50);
      }
    } catch (e) {
      console.log('Speech synthesis not available');
    }
  }, []);

  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  const playStartBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.4;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  // Get Ready phase - show for 2 seconds then move to countdown
  useEffect(() => {
    if (phase === 'getReady') {
      speakText('Get Ready');
      const timer = setTimeout(() => {
        setPhase('countdown');
        setCountdownValue(3);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, speakText]);

  // Countdown phase - 3, 2, 1 with voice then start exercise
  useEffect(() => {
    if (phase === 'countdown') {
      if (countdownValue > 0) {
        // Use voice for countdown numbers (no beep to avoid interference)
        const numberWords = ['', 'one', 'two', 'three'];
        speakText(numberWords[countdownValue] || countdownValue.toString());
        const timer = setTimeout(() => {
          setCountdownValue(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Countdown finished, start first exercise
        playStartBeep();
        speakText('Go');
        if (currentCircuit?.exercises?.length) {
          const initialDuration = getExerciseDuration(currentCircuit.exercises[0]);
          setTimeRemaining(initialDuration);
          setTotalTime(initialDuration);
          setAnnouncedHalfway(false);
          setAnnouncedTenSeconds(false);
          setPhase('exercise');
          setIsRunning(true);
        }
      }
    }
  }, [phase, countdownValue, currentCircuit, playStartBeep, speakText]);

  const moveToNextPhase = useCallback(() => {
    playBeep();

    if (!currentCircuit || !currentCircuit.exercises || currentCircuit.exercises.length === 0) {
      // Empty circuit, try to move to next circuit
      if (currentCircuitIndex < circuits.length - 1) {
        setCurrentCircuitIndex(prev => prev + 1);
        setCurrentRound(1);
        setCurrentExerciseIndex(0);
        setPhase('getReady');
        setIsRunning(false);
        setIsPaused(false);
      } else {
        setPhase('complete');
        setIsRunning(false);
        onComplete();
      }
      return;
    }

    if (phase === 'exercise') {
      if (currentExerciseIndex < currentCircuit.exercises.length - 1) {
        // Move to next exercise
        setCurrentExerciseIndex(prev => prev + 1);
        setAnnouncedHalfway(false);
        setAnnouncedTenSeconds(false);
        const nextExercise = currentCircuit.exercises[currentExerciseIndex + 1];
        if (nextExercise) {
          const duration = getExerciseDuration(nextExercise);
          setTimeRemaining(duration);
          setTotalTime(duration);
        }
      } else {
        // Finished all exercises in this round
        if (currentRound < currentCircuit.rounds) {
          // Go to rest period
          setPhase('rest');
          speakText('Rest');
          const restDuration = getRestDuration();
          setTimeRemaining(restDuration);
          setTotalTime(restDuration);
        } else {
          // All rounds complete for this circuit
          console.log('All rounds complete!', { 
            currentCircuitIndex, 
            circuitsLength: circuits.length,
            isLastCircuit: currentCircuitIndex >= circuits.length - 1
          });
          if (currentCircuitIndex < circuits.length - 1) {
            // Show circuit complete screen with rest before next circuit
            setPhase('circuitComplete');
            setIsRunning(false);
            setIsPaused(false);
          } else {
            // All circuits complete - show the Well Done screen
            console.log('Setting phase to complete');
            setPhase('complete');
            setIsRunning(false);
            // Don't call onComplete() here - wait for user to press "Finish Workout"
          }
        }
      }
    } else if (phase === 'rest') {
      // Start next round
      setCurrentRound(prev => prev + 1);
      setCurrentExerciseIndex(0);
      setAnnouncedHalfway(false);
      setAnnouncedTenSeconds(false);
      setPhase('exercise');
      const firstExercise = currentCircuit.exercises[0];
      if (firstExercise) {
        const duration = getExerciseDuration(firstExercise);
        setTimeRemaining(duration);
        setTotalTime(duration);
      }
    }
  }, [phase, currentExerciseIndex, currentCircuit, currentRound, currentCircuitIndex, circuits, onComplete, playBeep, speakText]);

  // Main timer effect
  useEffect(() => {
    if (!isRunning || timeRemaining <= 0 || phase === 'getReady' || phase === 'countdown') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isRunning && timeRemaining <= 0 && (phase === 'exercise' || phase === 'rest')) {
        moveToNextPhase();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        if (prev === 4 || prev === 3 || prev === 2) {
          playBeep();
        }
        return prev - 1;
      });
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timeRemaining, phase, moveToNextPhase, playBeep]);

  // Halfway and 10 second announcements
  useEffect(() => {
    if (phase !== 'exercise' || !isRunning || totalTime === 0) return;
    
    const halfwayPoint = Math.floor(totalTime / 2);
    
    // Announce halfway
    if (timeRemaining === halfwayPoint && !announcedHalfway && totalTime > 10) {
      speakText("You're at the halfway stage");
      setAnnouncedHalfway(true);
    }
    
    // Announce 10 seconds remaining
    if (timeRemaining === 10 && !announcedTenSeconds && totalTime > 15) {
      speakText("10 seconds remaining");
      setAnnouncedTenSeconds(true);
    }
  }, [timeRemaining, totalTime, phase, isRunning, announcedHalfway, announcedTenSeconds, speakText]);

  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  const handleSkipForward = () => {
    setTimeRemaining(0);
  };

  const handleSkipBack = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
      const prevExercise = currentCircuit?.exercises[currentExerciseIndex - 1];
      if (prevExercise) {
        const duration = getExerciseDuration(prevExercise);
        setTimeRemaining(duration);
        setTotalTime(duration);
      }
    } else if (currentRound > 1) {
      setCurrentRound(prev => prev - 1);
      const lastIndex = (currentCircuit?.exercises.length || 1) - 1;
      setCurrentExerciseIndex(lastIndex);
      const lastExercise = currentCircuit?.exercises[lastIndex];
      if (lastExercise) {
        const duration = getExerciseDuration(lastExercise);
        setTimeRemaining(duration);
        setTotalTime(duration);
      }
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    onClose();
  };

  const handleLock = () => {
    setIsLocked(true);
    setSwipeProgress(0);
  };

  // Swipe to unlock handlers (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isLocked) return;
    setSwipeStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isLocked || swipeStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeStartX;
    const maxSwipe = 200;
    const progress = Math.min(Math.max(diff / maxSwipe, 0), 1);
    setSwipeProgress(progress);
  };

  const handleTouchEnd = () => {
    if (!isLocked) return;
    if (swipeProgress >= 0.8) {
      setIsLocked(false);
    }
    setSwipeProgress(0);
    setSwipeStartX(null);
  };

  // Swipe to unlock handlers (mouse for desktop) - using refs to track dragging state
  const isDraggingRef = useRef(false);
  const swipeTrackRef = useRef<HTMLDivElement>(null);

  const handleSwipeMouseDown = (e: React.MouseEvent) => {
    if (!isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setSwipeStartX(e.clientX);
  };

  // Use document-level mouse events for smooth tracking
  useEffect(() => {
    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || swipeStartX === null) return;
      const diff = e.clientX - swipeStartX;
      const maxSwipe = 180;
      const progress = Math.min(Math.max(diff / maxSwipe, 0), 1);
      setSwipeProgress(progress);
    };

    const handleDocumentMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (swipeProgress >= 0.8) {
        setIsLocked(false);
      }
      setSwipeProgress(0);
      setSwipeStartX(null);
    };

    if (isLocked) {
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [isLocked, swipeStartX, swipeProgress]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (totalWorkoutTime === 0) return 0;
    return (elapsedTime / totalWorkoutTime) * 100;
  };

  const getRemainingTime = (): number => {
    return Math.max(0, totalWorkoutTime - elapsedTime);
  };

  // Get progress bar color - transitions from primary blue to green as progress increases
  const getProgressBarColor = (): string => {
    const progress = getProgressPercentage();
    if (progress < 25) return 'bg-primary';
    if (progress < 50) return 'bg-teal-500';
    if (progress < 75) return 'bg-emerald-500';
    return 'bg-green-500';
  };

  // Check if timer is in last 5 seconds
  const isLastFiveSeconds = timeRemaining <= 5 && timeRemaining > 0;

  // Handler to start next circuit after rest
  const handleStartNextCircuit = () => {
    setCurrentCircuitIndex(prev => prev + 1);
    setCurrentRound(1);
    setCurrentExerciseIndex(0);
    setPhase('getReady');
  };

  const nextExercise = getNextExercise();

  // Get Ready Screen
  if (phase === 'getReady') {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1f2e] flex flex-col items-center justify-center">
        <h1 className="text-5xl md:text-7xl font-light text-white tracking-wider">
          GET
        </h1>
        <h1 className="text-5xl md:text-7xl font-light text-white tracking-wider">
          READY
        </h1>
      </div>
    );
  }

  // Countdown Screen
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1f2e] flex flex-col items-center justify-center">
        <span className="text-[180px] md:text-[240px] font-light text-gray-400">
          {countdownValue || 'GO'}
        </span>
      </div>
    );
  }

  // Circuit Complete Screen - transition to next circuit
  if (phase === 'circuitComplete') {
    const nextCircuitIndex = currentCircuitIndex + 1;
    const nextCircuit = circuits[nextCircuitIndex];
    
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1f2e] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-white">
            Circuit {currentCircuitIndex + 1} Complete!
          </h1>
          <p className="text-gray-400">
            Great work! Take a moment to rest before the next circuit.
          </p>
          
          {nextCircuit && (
            <div className="mt-8 p-4 bg-white/10 rounded-xl">
              <p className="text-sm text-gray-400 mb-2">Up Next</p>
              <h2 className="text-xl font-semibold text-primary">
                Circuit {nextCircuitIndex + 1}
              </h2>
              <p className="text-gray-300">
                {nextCircuit.exercises.length} exercises • {nextCircuit.rounds} rounds
              </p>
            </div>
          )}
          
          <Button 
            onClick={() => onClose(nextCircuitIndex)}
            size="lg" 
            className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-full"
          >
            Move On
          </Button>
        </div>
      </div>
    );
  }

  // Complete Screen - all circuits done
  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1f2e] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-white">Well Done!</h1>
          <p className="text-gray-400">
            You've completed all {circuits.length} circuit{circuits.length > 1 ? 's' : ''}.
          </p>
          <Button onClick={() => onClose()} size="lg" className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-full">
            Finish Workout
          </Button>
        </div>
      </div>
    );
  }

  // Exercise/Rest Screen
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Exercise Card at Top with Close Button */}
      {phase !== 'rest' && (
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onClose()}
              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              {currentExercise?.muxPlaybackId && currentExercise.muxPlaybackId.length >= 10 ? (
                <img
                  src={`https://image.mux.com/${currentExercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                  alt={currentExercise.exerciseName}
                  className="w-full h-full object-cover"
                />
              ) : currentExercise?.imageUrl ? (
                <img
                  src={currentExercise.imageUrl}
                  alt={currentExercise.exerciseName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Dumbbell className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">{currentExercise?.exerciseName}</h2>
              <p className="text-sm text-gray-500">
                {currentExercise?.sets[0]?.duration || '60 sec'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rest indicator for rest phase with Close Button */}
      {phase === 'rest' && (
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onClose()}
              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">😮‍💨</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Rest Period</h2>
              <p className="text-sm text-gray-500">Take a breather</p>
            </div>
          </div>
        </div>
      )}

      {/* Circular Timer - Main Focus - Large and close to edges */}
      <div className="flex-1 flex items-center justify-center bg-white px-4">
        <CircularTimer
          timeRemaining={timeRemaining}
          totalTime={totalTime}
          size={320}
          strokeWidth={16}
          isLastFiveSeconds={isLastFiveSeconds}
        />
      </div>

      {/* Up Next Section */}
      <div className="bg-white px-4 py-4 border-t border-gray-200">
        <p className="text-sm text-gray-500 mb-2">Up Next</p>
        <div className="flex items-center gap-3">
          {phase === 'rest' || nextExercise ? (
            <>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {(() => {
                  const upNextExercise = phase === 'rest' ? currentCircuit?.exercises[0] : nextExercise;
                  if (upNextExercise?.muxPlaybackId && upNextExercise.muxPlaybackId.length >= 10) {
                    return (
                      <img
                        src={`https://image.mux.com/${upNextExercise.muxPlaybackId}/thumbnail.jpg?width=120&height=120&fit_mode=smartcrop`}
                        alt="Next exercise"
                        className="w-full h-full object-cover"
                      />
                    );
                  } else if (upNextExercise?.imageUrl) {
                    return (
                      <img 
                        src={upNextExercise.imageUrl}
                        alt="Next exercise"
                        className="w-full h-full object-cover"
                      />
                    );
                  } else {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell className="w-6 h-6 text-gray-400" />
                      </div>
                    );
                  }
                })()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {phase === 'rest' 
                    ? currentCircuit?.exercises[0]?.exerciseName
                    : nextExercise?.exerciseName
                  }
                </p>
                <p className="text-sm text-gray-500">
                  {phase === 'rest'
                    ? currentCircuit?.exercises[0]?.sets[0]?.duration || '60 sec'
                    : nextExercise?.sets[0]?.duration || '60 sec'
                  }
                </p>
              </div>
            </>
          ) : (
            <p className="text-gray-500">
              {currentRound < (currentCircuit?.rounds || 1) ? 'Rest Period' : 'Final Exercise!'}
            </p>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-white px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between text-sm mb-2">
          <div>
            <p className="text-primary">Remaining</p>
            <p className="text-xl font-semibold text-gray-900">{formatTime(getRemainingTime())}</p>
          </div>
          <div className="text-right">
            <p className="text-primary">Completed</p>
            <p className={`text-xl font-semibold ${getProgressPercentage() >= 75 ? 'text-green-500' : 'text-gray-900'}`}>
              {Math.round(getProgressPercentage())}%
            </p>
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getProgressBarColor()} transition-all duration-500`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div 
        ref={controlsRef}
        className="bg-[#1a1f2e] px-6 py-4 safe-area-bottom relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Locked Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-[#1a1f2e] flex items-center justify-center z-10">
            <div className="relative w-full max-w-xs px-4">
              {/* Swipe track */}
              <div 
                ref={swipeTrackRef}
                className="bg-gray-700 rounded-full h-14 relative overflow-hidden select-none"
              >
                {/* Progress fill */}
                <div 
                  className="absolute inset-y-0 left-0 bg-primary/30 pointer-events-none"
                  style={{ width: `${swipeProgress * 100}%` }}
                />
                {/* Swipe button */}
                <div 
                  className="absolute top-1 bottom-1 left-1 w-12 bg-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{ transform: `translateX(${swipeProgress * 180}px)` }}
                  onMouseDown={handleSwipeMouseDown}
                >
                  <Lock className="w-5 h-5 text-white pointer-events-none" />
                </div>
                {/* Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white/70 text-sm ml-8">Swipe to unlock</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`flex items-center justify-between max-w-sm mx-auto ${isLocked ? 'opacity-0' : 'opacity-100'}`}>
          {/* Skip Back */}
          <button 
            onClick={handleSkipBack}
            disabled={isLocked}
            className="text-white/70 hover:text-white p-2 disabled:opacity-30"
            data-testid="button-skip-back"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          {/* Stop */}
          <button 
            onClick={handleStop}
            disabled={isLocked}
            className="text-white/70 hover:text-white p-2 disabled:opacity-30"
            data-testid="button-stop"
          >
            <Square className="w-6 h-6" />
          </button>

          {/* Lock */}
          <button 
            onClick={handleLock}
            disabled={isLocked}
            className="text-white/70 hover:text-white p-2 disabled:opacity-30"
            data-testid="button-lock"
          >
            <Lock className="w-6 h-6" />
          </button>

          {/* Play/Pause */}
          <button 
            onClick={isPaused ? handleResume : handlePause}
            disabled={isLocked}
            className="text-white/70 hover:text-white p-2 disabled:opacity-30"
            data-testid="button-pause-resume"
          >
            {isPaused ? (
              <Play className="w-7 h-7" />
            ) : (
              <Pause className="w-7 h-7" />
            )}
          </button>

          {/* Skip Forward */}
          <button 
            onClick={handleSkipForward}
            disabled={isLocked}
            className="text-white/70 hover:text-white p-2 disabled:opacity-30"
            data-testid="button-skip-forward"
          >
            <SkipForward className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
