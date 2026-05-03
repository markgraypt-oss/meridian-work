import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Category = "training" | "recovery" | "nutrition" | "coach" | "admin";
type Channel = "inApp" | "email" | "push";

const CATEGORIES: { key: Category; label: string; description: string }[] = [
  { key: "training", label: "Training", description: "Workout reminders, programme updates, briefing" },
  { key: "recovery", label: "Recovery", description: "Hydration, position rotation, body map reassessment" },
  { key: "nutrition", label: "Nutrition", description: "Supplement reminders, meal/intake nudges" },
  { key: "coach", label: "AI Coach", description: "Daily check-in prompts, recommendations, summaries" },
  { key: "admin", label: "Account", description: "Badges, welcome, security & account events" },
];

interface NotificationPreferences {
  id: number;
  // Legacy fields kept for back-compat
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
  // Multi-channel toggles (one per category × channel)
  inAppTraining: boolean; emailTraining: boolean; pushTraining: boolean;
  inAppRecovery: boolean; emailRecovery: boolean; pushRecovery: boolean;
  inAppNutrition: boolean; emailNutrition: boolean; pushNutrition: boolean;
  inAppCoach: boolean; emailCoach: boolean; pushCoach: boolean;
  inAppAdmin: boolean; emailAdmin: boolean; pushAdmin: boolean;
  dailyCap: number;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

function fieldKey(category: Category, channel: Channel): keyof NotificationPreferences {
  const cap = category.charAt(0).toUpperCase() + category.slice(1);
  return `${channel}${cap}` as keyof NotificationPreferences;
}

// ----- Web Push helpers -----
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/user/notifications"],
  });

  const { data: vapid } = useQuery<{ publicKey: string | null }>({
    queryKey: ["/api/notifications/vapid-public-key"],
  });

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      } catch {}
    })();
  }, []);

  type PrefsUpdate = Partial<{
    [K in keyof NotificationPreferences]: NotificationPreferences[K];
  }>;

  const updateMutation = useMutation({
    mutationFn: async (updates: PrefsUpdate) =>
      apiRequest("PATCH", "/api/user/notifications", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
    },
    onError: () => {
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (category: Category) =>
      apiRequest("POST", "/api/notifications/test", { category }),
    onSuccess: () => {
      toast({ title: "Test sent", description: "Check the bell or your email/device." });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => toast({ title: "Test failed", variant: "destructive" }),
  });

  function handleToggle<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ): void {
    updateMutation.mutate({ [key]: value } as PrefsUpdate);
  }

  const enablePush = async () => {
    if (!vapid?.publicKey) {
      toast({ title: "Push not configured on server", variant: "destructive" });
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({ title: "This browser doesn't support push notifications", variant: "destructive" });
      return;
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ title: "Permission denied", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON() as any;
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setPushEnabled(true);
      toast({ title: "Push notifications enabled" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Couldn't enable push", description: e?.message, variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiRequest("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
      toast({ title: "Push notifications disabled" });
    } catch (e: any) {
      toast({ title: "Couldn't disable push", description: e?.message, variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  };

  if (isLoading || !prefs) {
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
          onClick={() => setLocation("/profile")}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground ml-2">Notifications</h1>
      </div>

      <div className="pt-16 mx-4 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Web Push</h2>
          <div className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
            <div className="pr-4">
              <Label className="text-base font-medium flex items-center gap-2">
                <BellRing className="h-4 w-4" /> Browser push notifications
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {pushEnabled
                  ? "This browser is subscribed. You'll receive native notifications."
                  : "Receive native notifications even when the tab is closed."}
              </p>
            </div>
            <Button
              variant={pushEnabled ? "outline" : "default"}
              onClick={pushEnabled ? disablePush : enablePush}
              disabled={pushBusy || !vapid?.publicKey}
              data-testid="button-toggle-push"
            >
              {pushEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Channels by category
          </h2>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr,auto,auto,auto,auto] items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <span>Category</span>
              <span className="w-12 text-center">In-app</span>
              <span className="w-12 text-center">Email</span>
              <span className="w-12 text-center">Push</span>
              <span className="w-10" />
            </div>
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="grid grid-cols-[1fr,auto,auto,auto,auto] items-center gap-3 px-4 py-3 border-t border-border first:border-t-0"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{cat.label}</div>
                  <div className="text-xs text-muted-foreground">{cat.description}</div>
                </div>
                {(["inApp", "email", "push"] as Channel[]).map((ch) => {
                  const k = fieldKey(cat.key, ch);
                  return (
                    <div key={ch} className="w-12 flex justify-center">
                      <Switch
                        checked={!!prefs[k]}
                        onCheckedChange={(v) => handleToggle(k, v)}
                        data-testid={`switch-${cat.key}-${ch}`}
                      />
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => testMutation.mutate(cat.key)}
                  disabled={testMutation.isPending}
                  data-testid={`button-test-${cat.key}`}
                  aria-label={`Send test ${cat.label} notification`}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Daily limit</h2>
          <div className="bg-card rounded-lg border border-border p-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-base font-medium">Maximum notifications per day</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Email and push will pause for the day once the limit is reached. In-app notifications are not capped.
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={50}
              value={prefs.dailyCap ?? 8}
              onChange={(e) => handleToggle("dailyCap", parseInt(e.target.value, 10) || 0)}
              className="w-20 bg-background"
              data-testid="input-daily-cap"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quiet hours</h2>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="quiet-hours" className="text-base font-medium">Enable quiet hours</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Pause email and push during these hours.
                </p>
              </div>
              <Switch
                id="quiet-hours"
                checked={prefs.quietHoursEnabled ?? false}
                onCheckedChange={(checked) => handleToggle("quietHoursEnabled", checked)}
                data-testid="switch-quiet-hours"
              />
            </div>
            {prefs.quietHoursEnabled && (
              <div className="mt-4 pt-4 border-t border-border flex gap-4">
                <div>
                  <Label htmlFor="quiet-start" className="text-sm text-muted-foreground">Start</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={prefs.quietHoursStart ?? "22:00"}
                    onChange={(e) => handleToggle("quietHoursStart", e.target.value)}
                    className="mt-1 w-28 bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-end" className="text-sm text-muted-foreground">End</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={prefs.quietHoursEnd ?? "07:00"}
                    onChange={(e) => handleToggle("quietHoursEnd", e.target.value)}
                    className="mt-1 w-28 bg-background"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center px-4 pb-4">
          Use the test buttons to verify each category. Your in-app feed is available from the bell in the header.
        </p>
      </div>
    </div>
  );
}
