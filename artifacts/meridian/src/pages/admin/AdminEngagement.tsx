import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Trophy, Save, RotateCcw, AlertTriangle, Bell } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ConfigKey = "activities" | "trackActivities";

type StreakTrack = "checkin" | "movement" | "recovery" | "nutrition";

function PushTestCard() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await apiRequest("POST", "/api/admin/test-push");
      const data = await res.json();
      const ch = data.channels ?? {};
      setStatus(`inApp:${ch.inApp} | email:${ch.email} | push:${ch.push}`);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-dashed border-blue-300 dark:border-blue-700">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" /> Push Notification Testing
        </CardTitle>
        <CardDescription>Send a test push to your device to verify Expo delivery and deep-link routing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" size="sm" disabled={loading} onClick={send}>
          {loading ? "Sending…" : `Send test push → "Morning briefing ready"`}
        </Button>
        {status && (
          <p className="text-xs font-mono text-muted-foreground">{status}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Points and levels were retired 25 Aug 2026. What's left to tune is which
// activity feeds which streak track.
type ActivityRule = {
  track?: StreakTrack;
};

type EngagementConfig = {
  activities: Record<string, ActivityRule>;
  trackActivities: Record<string, string[]>;
};

type ConfigValueMap = {
  activities: EngagementConfig["activities"];
  trackActivities: EngagementConfig["trackActivities"];
};

const VALID_TRACKS = ["checkin", "movement", "recovery", "nutrition"];

function validateActivities(value: EngagementConfig["activities"]): string | null {
  for (const name of Object.keys(value)) {
    const rule = value[name];
    if (rule.track !== undefined && !VALID_TRACKS.includes(rule.track)) {
      return `Activity "${name}" has an unknown track "${rule.track}"`;
    }
  }
  return null;
}

function validateTrackActivities(value: Record<string, string[]>): string | null {
  for (const track of Object.keys(value)) {
    if (!Array.isArray(value[track])) return `Track "${track}" must map to a list of activities`;
  }
  return null;
}

function validateConfig<K extends ConfigKey>(key: K, value: ConfigValueMap[K]): string | null {
  switch (key) {
    case "activities":
      return validateActivities(value as EngagementConfig["activities"]);
    case "trackActivities":
      return validateTrackActivities(value as Record<string, string[]>);
    default:
      return null;
  }
}

function ActivitiesEditor({
  value,
  onChange,
}: {
  value: EngagementConfig["activities"];
  onChange: (v: EngagementConfig["activities"]) => void;
}) {
  const update = (name: string, track: string) => {
    const nextRule: ActivityRule = { ...value[name] };
    if (track === "none") delete nextRule.track;
    else nextRule.track = track as StreakTrack;
    onChange({ ...value, [name]: nextRule });
  };
  return (
    <div className="space-y-3">
      {Object.entries(value).map(([name, rule]) => (
        <div key={name} className="grid grid-cols-12 gap-2 items-center" data-testid={`activity-row-${name}`}>
          <div className="col-span-7">
            <Label className="text-xs text-muted-foreground">{name.replace(/_/g, " ")}</Label>
          </div>
          <div className="col-span-5">
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={rule.track ?? "none"}
              onChange={(e) => update(name, e.target.value)}
              data-testid={`select-track-${name}`}
            >
              <option value="none">No streak</option>
              {VALID_TRACKS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackActivitiesEditor({
  value,
  onChange,
}: {
  value: EngagementConfig["trackActivities"];
  onChange: (v: EngagementConfig["trackActivities"]) => void;
}) {
  const update = (track: string, csv: string) => {
    const list = csv.split(",").map((s) => s.trim()).filter(Boolean);
    onChange({ ...value, [track]: list });
  };
  return (
    <div className="space-y-2">
      {Object.entries(value).map(([track, list]) => (
        <div key={track} data-testid={`track-row-${track}`}>
          <Label className="text-xs capitalize">{track}</Label>
          <Input
            value={list.join(", ")}
            onChange={(e) => update(track, e.target.value)}
            placeholder="comma,separated,activity_types"
            data-testid={`input-track-${track}`}
          />
        </div>
      ))}
    </div>
  );
}

function ConfigSection<K extends ConfigKey>({
  cfgKey,
  title,
  description,
  initial,
  render,
  onSaved,
}: {
  cfgKey: K;
  title: string;
  description: string;
  initial: EngagementConfig[K];
  render: (value: EngagementConfig[K], setValue: (v: EngagementConfig[K]) => void) => React.ReactNode;
  onSaved: (cfg: EngagementConfig) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState<EngagementConfig[K]>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/engagement/config", {
        key: cfgKey,
        value,
      });
      return res.json() as Promise<EngagementConfig>;
    },
    onSuccess: (cfg) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engagement/config"] });
      onSaved(cfg);
      toast({ title: "Saved", description: `${title} updated.` });
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Could not save changes";
      toast({
        title: "Save failed",
        description,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const v = validateConfig(cfgKey, value);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Card data-testid={`section-${cfgKey}`}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {render(value, setValue)}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400" data-testid={`error-${cfgKey}`}>
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(initial);
              setError(null);
            }}
            disabled={!dirty || mutation.isPending}
            data-testid={`button-reset-${cfgKey}`}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || mutation.isPending}
            data-testid={`button-save-${cfgKey}`}
          >
            <Save className="h-4 w-4 mr-1" />
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminEngagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<EngagementConfig>({
    queryKey: ["/api/admin/engagement/config"],
  });

  const handleSaved = (cfg: EngagementConfig) => {
    queryClient.setQueryData(["/api/admin/engagement/config"], cfg);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader title="Engagement Tunables" onBack={() => navigate("/admin")} />
      <div className="px-5 pt-14 space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-[#0cc9a9]" />
          <span>Edit which activities feed which streak track. Points and levels were retired on 25 Aug 2026.</span>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-red-400">
              Failed to load config. You may not have admin access.
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <ConfigSection
              cfgKey="activities"
              title="Activity → streak track"
              description="Which streak each activity feeds. Points and levels were retired; streaks are what remain."
              initial={data.activities}
              onSaved={handleSaved}
              render={(v, set) => <ActivitiesEditor value={v} onChange={set} />}
            />
            <ConfigSection
              cfgKey="trackActivities"
              title="Per-track activity mapping"
              description="Which activity types contribute to each streak track. Comma-separated."
              initial={data.trackActivities}
              onSaved={handleSaved}
              render={(v, set) => <TrackActivitiesEditor value={v} onChange={set} />}
            />
            <Card className="border-dashed border-orange-300 dark:border-orange-700">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-orange-500" /> Badge Testing</CardTitle>
                <CardDescription>Reset a badge notification so the celebration modal fires again on mobile.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await apiRequest("POST", "/api/admin/user-badges/11/unnotify");
                      const data = await res.json();
                      toast({ title: "Badge reset", description: `Row ${data.id} → notified: ${data.notified}` });
                    } catch (e) {
                      toast({ title: "Failed", description: String(e), variant: "destructive" });
                    }
                  }}
                >
                  Reset "Flexibility Seeker" (row 11) → unnotified
                </Button>
              </CardContent>
            </Card>
            <PushTestCard />
          </>
        )}
      </div>
    </div>
  );
}
