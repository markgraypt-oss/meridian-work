import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface TimerData {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  lastUpdated: number;
}

interface TimerMap {
  [exerciseLogId: number]: TimerData;
}

interface WorkoutSessionContextType {
  timerMap: TimerMap;
  activeExerciseLogId: number | null;
  workoutLogId: number | null;
  startTimer: (exerciseLogId: number, seconds: number) => void;
  pauseTimer: (exerciseLogId: number) => void;
  resumeTimer: (exerciseLogId: number) => void;
  resetTimer: (exerciseLogId: number, seconds: number) => void;
  skipTimer: (exerciseLogId: number) => void;
  getTimer: (exerciseLogId: number) => TimerData | null;
  initWorkout: (logId: number) => void;
  clearWorkout: () => void;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextType | null>(null);

const STORAGE_KEY_PREFIX = 'workout_session_';

function getStorageKey(logId: number) {
  return `${STORAGE_KEY_PREFIX}${logId}`;
}

function saveToStorage(logId: number, timerMap: TimerMap, activeExerciseLogId: number | null) {
  try {
    sessionStorage.setItem(getStorageKey(logId), JSON.stringify({
      timerMap,
      activeExerciseLogId,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.error('Failed to save workout session:', e);
  }
}

function loadFromStorage(logId: number): { timerMap: TimerMap; activeExerciseLogId: number | null } | null {
  try {
    const data = sessionStorage.getItem(getStorageKey(logId));
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    const elapsed = (Date.now() - parsed.savedAt) / 1000;
    
    if (parsed.activeExerciseLogId && parsed.timerMap[parsed.activeExerciseLogId]?.isRunning) {
      const activeTimer = parsed.timerMap[parsed.activeExerciseLogId];
      const newRemaining = Math.max(0, activeTimer.remainingSeconds - elapsed);
      parsed.timerMap[parsed.activeExerciseLogId] = {
        ...activeTimer,
        remainingSeconds: Math.floor(newRemaining),
        isRunning: newRemaining > 0,
      };
    }
    
    return {
      timerMap: parsed.timerMap,
      activeExerciseLogId: parsed.activeExerciseLogId,
    };
  } catch (e) {
    console.error('Failed to load workout session:', e);
    return null;
  }
}

function clearStorage(logId: number) {
  try {
    sessionStorage.removeItem(getStorageKey(logId));
  } catch (e) {
    console.error('Failed to clear workout session:', e);
  }
}

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [timerMap, setTimerMap] = useState<TimerMap>({});
  const [activeExerciseLogId, setActiveExerciseLogId] = useState<number | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (activeExerciseLogId === null || !timerMap[activeExerciseLogId]?.isRunning) {
      clearTimerInterval();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimerMap(prev => {
        if (!activeExerciseLogId || !prev[activeExerciseLogId]) return prev;
        
        const timer = prev[activeExerciseLogId];
        if (timer.remainingSeconds <= 1) {
          const updated = {
            ...prev,
            [activeExerciseLogId]: {
              ...timer,
              isRunning: false,
              remainingSeconds: 0,
              lastUpdated: Date.now(),
            },
          };
          if (workoutLogId) saveToStorage(workoutLogId, updated, null);
          setActiveExerciseLogId(null);
          return updated;
        }
        
        const updated = {
          ...prev,
          [activeExerciseLogId]: {
            ...timer,
            remainingSeconds: timer.remainingSeconds - 1,
            lastUpdated: Date.now(),
          },
        };
        if (workoutLogId) saveToStorage(workoutLogId, updated, activeExerciseLogId);
        return updated;
      });
    }, 1000);

    return () => clearTimerInterval();
  }, [activeExerciseLogId, timerMap, workoutLogId, clearTimerInterval]);

  const initWorkout = useCallback((logId: number) => {
    setWorkoutLogId(logId);
    const saved = loadFromStorage(logId);
    if (saved) {
      setTimerMap(saved.timerMap);
      setActiveExerciseLogId(saved.activeExerciseLogId);
    } else {
      setTimerMap({});
      setActiveExerciseLogId(null);
    }
  }, []);

  const clearWorkout = useCallback(() => {
    if (workoutLogId) {
      clearStorage(workoutLogId);
    }
    setTimerMap({});
    setActiveExerciseLogId(null);
    setWorkoutLogId(null);
    clearTimerInterval();
  }, [workoutLogId, clearTimerInterval]);

  const startTimer = useCallback((exerciseLogId: number, seconds: number) => {
    setActiveExerciseLogId(exerciseLogId);
    setTimerMap(prev => {
      const updated = {
        ...prev,
        [exerciseLogId]: {
          remainingSeconds: seconds,
          totalSeconds: seconds,
          isRunning: true,
          lastUpdated: Date.now(),
        },
      };
      if (workoutLogId) saveToStorage(workoutLogId, updated, exerciseLogId);
      return updated;
    });
  }, [workoutLogId]);

  const pauseTimer = useCallback((exerciseLogId: number) => {
    setTimerMap(prev => {
      if (!prev[exerciseLogId]) return prev;
      const updated = {
        ...prev,
        [exerciseLogId]: {
          ...prev[exerciseLogId],
          isRunning: false,
          lastUpdated: Date.now(),
        },
      };
      if (workoutLogId) saveToStorage(workoutLogId, updated, null);
      return updated;
    });
    setActiveExerciseLogId(null);
  }, [workoutLogId]);

  const resumeTimer = useCallback((exerciseLogId: number) => {
    setTimerMap(prev => {
      if (!prev[exerciseLogId] || prev[exerciseLogId].remainingSeconds <= 0) return prev;
      const updated = {
        ...prev,
        [exerciseLogId]: {
          ...prev[exerciseLogId],
          isRunning: true,
          lastUpdated: Date.now(),
        },
      };
      if (workoutLogId) saveToStorage(workoutLogId, updated, exerciseLogId);
      return updated;
    });
    setActiveExerciseLogId(exerciseLogId);
  }, [workoutLogId]);

  const resetTimer = useCallback((exerciseLogId: number, seconds: number) => {
    setTimerMap(prev => {
      const updated = {
        ...prev,
        [exerciseLogId]: {
          remainingSeconds: seconds,
          totalSeconds: seconds,
          isRunning: false,
          lastUpdated: Date.now(),
        },
      };
      if (workoutLogId) saveToStorage(workoutLogId, updated, null);
      return updated;
    });
    if (activeExerciseLogId === exerciseLogId) {
      setActiveExerciseLogId(null);
    }
  }, [workoutLogId, activeExerciseLogId]);

  const skipTimer = useCallback((exerciseLogId: number) => {
    setTimerMap(prev => {
      if (!prev[exerciseLogId]) return prev;
      const updated = {
        ...prev,
        [exerciseLogId]: {
          ...prev[exerciseLogId],
          remainingSeconds: 0,
          isRunning: false,
          lastUpdated: Date.now(),
        },
      };
      if (workoutLogId) saveToStorage(workoutLogId, updated, null);
      return updated;
    });
    if (activeExerciseLogId === exerciseLogId) {
      setActiveExerciseLogId(null);
    }
  }, [workoutLogId, activeExerciseLogId]);

  const getTimer = useCallback((exerciseLogId: number): TimerData | null => {
    return timerMap[exerciseLogId] || null;
  }, [timerMap]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
    };
  }, [clearTimerInterval]);

  return (
    <WorkoutSessionContext.Provider value={{
      timerMap,
      activeExerciseLogId,
      workoutLogId,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      skipTimer,
      getTimer,
      initWorkout,
      clearWorkout,
    }}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession() {
  const context = useContext(WorkoutSessionContext);
  if (!context) {
    throw new Error('useWorkoutSession must be used within a WorkoutSessionProvider');
  }
  return context;
}
