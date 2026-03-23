import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { SYSTEM_HABITS } from "./goals-habit-data";

export default function GoalsHabits() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Goal Templates" onBack={() => window.history.back()} />

      <div className="px-6 pt-4 space-y-3">
        {SYSTEM_HABITS.map((habit) => (
          <button
            key={habit.id}
            type="button"
            onClick={() => setLocation(`/goals/habits/${habit.id}`)}
            className="w-full p-4 bg-white dark:bg-card rounded-xl flex items-center gap-4 transition-all shadow-sm hover:shadow-md hover:border-[#0cc9a9] border border-border"
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${habit.color}`}>
              {habit.icon}
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-semibold text-sm">{habit.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{habit.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
