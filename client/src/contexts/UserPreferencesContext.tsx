import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface UserPreferences {
  weightUnit: "kg" | "lbs";
  distanceUnit: "km" | "mi";
  timeFormat: "12h" | "24h";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  restTimerSounds: boolean;
  countdownBeeps: boolean;
}

const defaultPreferences: UserPreferences = {
  weightUnit: "kg",
  distanceUnit: "km",
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
  restTimerSounds: true,
  countdownBeeps: true,
};

interface UserPreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType>({
  preferences: defaultPreferences,
  isLoading: true,
});

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
  });

  const preferences: UserPreferences = {
    weightUnit: data?.weightUnit || defaultPreferences.weightUnit,
    distanceUnit: data?.distanceUnit || defaultPreferences.distanceUnit,
    timeFormat: data?.timeFormat || defaultPreferences.timeFormat,
    dateFormat: data?.dateFormat || defaultPreferences.dateFormat,
    restTimerSounds: data?.restTimerSounds ?? defaultPreferences.restTimerSounds,
    countdownBeeps: data?.countdownBeeps ?? defaultPreferences.countdownBeeps,
  };

  return (
    <UserPreferencesContext.Provider value={{ preferences, isLoading }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}
