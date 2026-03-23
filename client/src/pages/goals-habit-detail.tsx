import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import TopHeader from "@/components/TopHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { SYSTEM_HABITS } from "./goals-habit-data";
import type { Habit, HabitTemplate } from "@shared/schema";

export const COMPANION_HABITS: Record<string, string> = {
  "30-day-alcohol-free": "Avoided Alcohol",
  "walk-450k-steps": "Hit Your Step Count",
  "30-day-stretch": "Evening Stretch",
  "consistent-wake-time-30-days": "Set a Consistent Wake Time",
};

export default function GoalsHabitDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const habit = SYSTEM_HABITS.find((h) => h.id === id);
  const companionHabitName = id ? COMPANION_HABITS[id] : undefined;

  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => {
    if (habit?.durationDays) {
      return format(addDays(new Date(), habit.durationDays), "yyyy-MM-dd");
    }
    return "";
  });
  const [showSheet, setShowSheet] = useState(false);
  const [createdGoalId, setCreatedGoalId] = useState<number | null>(null);
  const isStepsGoal = id === "walk-450k-steps";
  const [trackingMode, setTrackingMode] = useState<"habit" | "cumulative">("habit");

  useEffect(() => {
    if (habit?.durationDays && startDate) {
      setEndDate(format(addDays(new Date(startDate + "T00:00:00"), habit.durationDays), "yyyy-MM-dd"));
    }
  }, [startDate, habit?.durationDays]);

  const { data: userHabits = [] } = useQuery<Habit[]>({
    queryKey: ["/api/habits"],
    enabled: !!companionHabitName,
  });

  const { data: habitTemplates = [] } = useQuery<HabitTemplate[]>({
    queryKey: ["/api/habit-templates"],
    enabled: !!companionHabitName,
  });

  const alreadyHasCompanion = companionHabitName
    ? userHabits.some((h) => h.title.toLowerCase() === companionHabitName.toLowerCase())
    : true;

  const companionTemplate = companionHabitName
    ? habitTemplates.find((t) => t.title.toLowerCase() === companionHabitName.toLowerCase())
    : undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/goals", {
        type: "custom",
        title: habit!.title,
        description: habit!.description,
        startDate,
        deadline: endDate || null,
        templateId: id,
        ...(isStepsGoal ? { trackingMode } : {}),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      if (data?.id) setCreatedGoalId(data.id);
      if (isStepsGoal && trackingMode === "cumulative") {
        toast({ title: "Goal created", description: `"${habit!.title}" has been added to your goals.` });
        setLocation("/goals");
        return;
      }
      if (companionHabitName) {
        setShowSheet(true);
      } else {
        toast({ title: "Goal created", description: `"${habit!.title}" has been added to your goals.` });
        setLocation("/goals");
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create goal. Please try again.", variant: "destructive" });
    },
  });

  if (!habit) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopHeader title="Goal Template" onBack={() => window.history.back()} />
        <div className="px-6 pt-6 text-muted-foreground text-sm">Goal not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Goal Template" onBack={() => window.history.back()} />

      <div className="px-6 pt-6 space-y-6">
        <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${habit.color}`}>
              {habit.icon}
            </div>
            <h2 className="font-semibold text-lg leading-tight">{habit.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{habit.description}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">End Date</Label>
              {habit.durationDays && (
                <span className="text-xs text-muted-foreground">{habit.durationDays} days</span>
              )}
            </div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {isStepsGoal && (
          <div className="space-y-3">
            <Label className="text-sm">How would you like to track this goal?</Label>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setTrackingMode("habit")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  trackingMode === "habit"
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                    trackingMode === "habit" ? "border-[#0cc9a9]" : "border-muted-foreground/40"
                  }`}>
                    {trackingMode === "habit" && <div className="w-2.5 h-2.5 rounded-full bg-[#0cc9a9]" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Daily consistency (habit)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track via the "Hit Your Step Count" habit. Hit a minimum of 10,000 steps on 45 days within the goal period. Missing a day won't reset your progress.
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("cumulative")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  trackingMode === "cumulative"
                    ? "border-[#0cc9a9] bg-[#0cc9a9]/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                    trackingMode === "cumulative" ? "border-[#0cc9a9]" : "border-muted-foreground/40"
                  }`}>
                    {trackingMode === "cumulative" && <div className="w-2.5 h-2.5 rounded-full bg-[#0cc9a9]" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Total steps (cumulative)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track your total steps from Progress entries. Reach 450,000 steps by the end date. Some days can be higher to make up for lower days.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        <Button
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Creating..." : "Create Goal"}
        </Button>
      </div>

      <Sheet open={showSheet} onOpenChange={() => {}}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-10 [&>button:last-of-type]:hidden">
          {alreadyHasCompanion ? (
            <>
              <SheetHeader className="text-center mb-4">
                <SheetTitle>Goal Created</SheetTitle>
                <SheetDescription>
                  Your{" "}
                  <span className="font-semibold text-foreground">"{companionHabitName}"</span>{" "}
                  habit is already active and will automatically track your streak for this goal.
                </SheetDescription>
              </SheetHeader>
              <Button
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
                onClick={() => {
                  setShowSheet(false);
                  toast({ title: "Goal created", description: `"${habit.title}" has been added to your goals.` });
                  setLocation("/goals");
                }}
              >
                Got It
              </Button>
            </>
          ) : (
            <>
              <SheetHeader className="text-center mb-4">
                <SheetTitle>Link a Daily Habit</SheetTitle>
                <SheetDescription>
                  Add the{" "}
                  <span className="font-semibold text-foreground">"{companionHabitName}"</span>{" "}
                  habit to automatically track your streak for this goal.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
                  onClick={() => {
                    setShowSheet(false);
                    if (companionTemplate) {
                      const goalParam = createdGoalId ? `&goalId=${createdGoalId}` : "";
                      const daysParam = habit.durationDays ? `&days=${habit.durationDays}` : "";
                      setLocation(`/habit-detail/${companionTemplate.id}?from=goals${daysParam}${goalParam}`);
                    } else {
                      setLocation("/goals");
                    }
                  }}
                >
                  Add Habit
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowSheet(false);
                    toast({ title: "Goal created", description: `"${habit.title}" has been added to your goals.` });
                    setLocation("/goals");
                  }}
                >
                  Skip for Now
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
