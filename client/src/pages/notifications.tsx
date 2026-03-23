import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NotificationPreferences {
  id: number;
  workoutReminders: boolean;
  habitReminders: boolean;
  dailyCheckInPrompts: boolean;
  badgeAlerts: boolean;
  programUpdates: boolean;
  hydrationReminders: boolean;
  supplementReminders: boolean;
  bodyMapReassessment: boolean;
  positionRotation: boolean;
  emailWorkoutSummary: boolean;
  emailWeeklyProgress: boolean;
  emailProgramReminders: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/user/notifications'],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest('PATCH', '/api/user/notifications', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/notifications'] });
    },
    onError: () => {
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleValueChange = (key: keyof NotificationPreferences, value: string) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32 ml-4" />
        </div>
        <div className="pt-14 mx-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4">
        <button 
          onClick={() => setLocation('/profile')}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground ml-2">Notifications</h1>
      </div>

      <div className="pt-16 mx-4 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-0">Push Notifications</h2>
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            <NotificationToggle
              id="workout-reminders"
              label="Workout Reminders"
              description="Get reminded about your scheduled workouts"
              checked={prefs?.workoutReminders ?? true}
              onCheckedChange={(checked) => handleToggle('workoutReminders', checked)}
            />
            <NotificationToggle
              id="habit-reminders"
              label="Habit Reminders"
              description="Daily reminders to complete your habits"
              checked={prefs?.habitReminders ?? true}
              onCheckedChange={(checked) => handleToggle('habitReminders', checked)}
            />
            <NotificationToggle
              id="daily-check-in"
              label="Daily Check-in Prompts"
              description="Reminders to complete your daily check-in"
              checked={prefs?.dailyCheckInPrompts ?? true}
              onCheckedChange={(checked) => handleToggle('dailyCheckInPrompts', checked)}
            />
            <NotificationToggle
              id="badge-alerts"
              label="Badge/Achievement Alerts"
              description="Get notified when you earn new badges"
              checked={prefs?.badgeAlerts ?? true}
              onCheckedChange={(checked) => handleToggle('badgeAlerts', checked)}
            />
            <NotificationToggle
              id="program-updates"
              label="Program Updates"
              description="Updates about your enrolled programs"
              checked={prefs?.programUpdates ?? true}
              onCheckedChange={(checked) => handleToggle('programUpdates', checked)}
            />
            <NotificationToggle
              id="hydration-reminders"
              label="Hydration Reminders"
              description="Periodic reminders to drink water"
              checked={prefs?.hydrationReminders ?? true}
              onCheckedChange={(checked) => handleToggle('hydrationReminders', checked)}
            />
            <NotificationToggle
              id="supplement-reminders"
              label="Supplement Stack Reminders"
              description="Notifications based on your supplement schedule (morning, afternoon, evening)"
              checked={prefs?.supplementReminders ?? false}
              onCheckedChange={(checked) => handleToggle('supplementReminders', checked)}
            />
            <NotificationToggle
              id="body-map-reminders"
              label="Body Map Reassessment"
              description="Configure frequency in Body Map > History > Settings"
              checked={prefs?.bodyMapReassessment ?? false}
              onCheckedChange={(checked) => handleToggle('bodyMapReassessment', checked)}
            />
            <NotificationToggle
              id="position-rotation"
              label="Position Rotation"
              description="Configure interval in Recovery > Desk Health > Rotation"
              checked={prefs?.positionRotation ?? false}
              onCheckedChange={(checked) => handleToggle('positionRotation', checked)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Email Notifications</h2>
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            <NotificationToggle
              id="email-workout-summary"
              label="Workout Summary"
              description="Receive email summaries of your completed workouts"
              checked={prefs?.emailWorkoutSummary ?? true}
              onCheckedChange={(checked) => handleToggle('emailWorkoutSummary', checked)}
            />
            <NotificationToggle
              id="email-weekly-progress"
              label="Weekly Progress Report"
              description="Get a weekly email with your progress stats"
              checked={prefs?.emailWeeklyProgress ?? true}
              onCheckedChange={(checked) => handleToggle('emailWeeklyProgress', checked)}
            />
            <NotificationToggle
              id="email-program-reminders"
              label="Program Reminders"
              description="Email reminders about your program schedule"
              checked={prefs?.emailProgramReminders ?? true}
              onCheckedChange={(checked) => handleToggle('emailProgramReminders', checked)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quiet Hours</h2>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="quiet-hours" className="text-base font-medium">Enable Quiet Hours</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Pause notifications during set hours
                </p>
              </div>
              <Switch
                id="quiet-hours"
                checked={prefs?.quietHoursEnabled ?? false}
                onCheckedChange={(checked) => handleToggle('quietHoursEnabled', checked)}
              />
            </div>
            
            {prefs?.quietHoursEnabled && (
              <div className="mt-4 pt-4 border-t border-border flex gap-4">
                <div>
                  <Label htmlFor="quiet-start" className="text-sm text-muted-foreground">Start</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={prefs?.quietHoursStart ?? "22:00"}
                    onChange={(e) => handleValueChange('quietHoursStart', e.target.value)}
                    className="mt-1 w-28 bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end" className="text-sm text-muted-foreground">End</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={prefs?.quietHoursEnd ?? "07:00"}
                    onChange={(e) => handleValueChange('quietHoursEnd', e.target.value)}
                    className="mt-1 w-28 bg-background"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center px-4 pb-4">
          Timing and frequency settings are configured within each feature section. Supplement reminders follow your supplement stack schedule.
        </p>
      </div>
    </div>
  );
}

function NotificationToggle({ 
  id, 
  label, 
  description, 
  checked, 
  onCheckedChange 
}: { 
  id: string; 
  label: string; 
  description: string; 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex-1 pr-4">
        <Label htmlFor={id} className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
