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
import { Trophy, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ConfigKey = "activities" | "weeklyCaps" | "streakBonuses" | "levels" | "trackActivities";

type StreakTrack = "checkin" | "movement" | "recovery" | "nutrition";

type ActivityRule = {
  basePoints: number;
  dailyCap?: number;
  curve?: "workout";
  track?: StreakTrack;
};

type WeeklyCaps = { soft1: number; soft1Multiplier: number; soft2: number; soft2Multiplier: number };
type StreakBonus = { days: number; multiplier: number };
type LevelDef = { level: number; name: string; minPoints: number };

type EngagementConfig = {
  activities: Record<string, ActivityRule>;
  weeklyCaps: WeeklyCaps;
  streakBonuses: StreakBonus[];
  levels: LevelDef[];
  trackActivities: Record<string, string[]>;
};

type ConfigValueMap = {
  activities: EngagementConfig["activities"];
  weeklyCaps: EngagementConfig["weeklyCaps"];
  streakBonuses: EngagementConfig["streakBonuses"];
  levels: EngagementConfig["levels"];
  trackActivities: EngagementConfig["trackActivities"];
};

const isNonNegFinite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const isFiniteInRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

function validateActivities(value: EngagementConfig["activities"]): string | null {
  for (const name of Object.keys(value)) {
    const rule = value[name];
    if (!isNonNegFinite(rule.basePoints)) {
      return `Activity "${name}" basePoints must be a non-negative number`;
    }
    if (rule.dailyCap !== undefined && !isNonNegFinite(rule.dailyCap)) {
      return `Activity "${name}" dailyCap must be a non-negative number`;
    }
  }
  return null;
}

function validateWeeklyCaps(c: WeeklyCaps): string | null {
  if (!isNonNegFinite(c.soft1) || !isNonNegFinite(c.soft2)) {
    return "Weekly cap thresholds must be non-negative numbers";
  }
  if (!isFiniteInRange(c.soft1Multiplier, 0, 1) || !isFiniteInRange(c.soft2Multiplier, 0, 1)) {
    return "Weekly cap multipliers must be between 0 and 1";
  }
  if (c.soft2 < c.soft1) return "Soft cap 2 must be greater than or equal to soft cap 1";
  if (c.soft2Multiplier > c.soft1Multiplier) {
    return "Soft cap 2 multiplier should be lower than soft cap 1 (more reduction)";
  }
  return null;
}

function validateStreakBonuses(value: StreakBonus[]): string | null {
  for (const b of value) {
    if (!isNonNegFinite(b.days)) return "Streak bonus days must be non-negative";
    if (!Number.isFinite(b.multiplier) || b.multiplier < 1) {
      return "Streak bonus multiplier must be >= 1";
    }
  }
  return null;
}

function validateLevels(value: LevelDef[]): string | null {
  if (value.length === 0) return "Levels must be a non-empty list";
  const sorted = [...value].sort((a, b) => a.level - b.level);
  let prev = -Infinity;
  for (const l of sorted) {
    if (!Number.isFinite(l.level) || !isNonNegFinite(l.minPoints)) {
      return "Each level needs a numeric level and non-negative minPoints";
    }
    if (!l.name || typeof l.name !== "string") return "Each level needs a name";
    if (l.minPoints <= prev && prev !== -Infinity) {
      return "Level thresholds (minPoints) must be strictly increasing";
    }
    prev = l.minPoints;
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
    case "weeklyCaps":
      return validateWeeklyCaps(value as WeeklyCaps);
    case "streakBonuses":
      return validateStreakBonuses(value as StreakBonus[]);
    case "levels":
      return validateLevels(value as LevelDef[]);
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
  const update = (name: string, field: "basePoints" | "dailyCap", v: string) => {
    const num = v === "" ? undefined : Number(v);
    const current = value[name];
    const nextRule: ActivityRule = { ...current };
    if (field === "basePoints") {
      nextRule.basePoints = num ?? 0;
    } else if (num === undefined) {
      delete nextRule.dailyCap;
    } else {
      nextRule.dailyCap = num;
    }
    onChange({ ...value, [name]: nextRule });
  };
  return (
    <div className="space-y-3">
      {Object.entries(value).map(([name, rule]) => (
        <div key={name} className="grid grid-cols-12 gap-2 items-end" data-testid={`activity-row-${name}`}>
          <div className="col-span-5">
            <Label className="text-xs text-muted-foreground">{name}</Label>
            <div className="text-xs text-muted-foreground/70">
              {rule.track ? `track: ${rule.track}` : "no track"}{rule.curve ? ` · ${rule.curve} curve` : ""}
            </div>
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Base points</Label>
            <Input
              type="number"
              min={0}
              value={rule.basePoints}
              onChange={(e) => update(name, "basePoints", e.target.value)}
              data-testid={`input-base-${name}`}
            />
          </div>
          <div className="col-span-4">
            <Label className="text-xs">Daily cap</Label>
            <Input
              type="number"
              min={0}
              value={rule.dailyCap ?? ""}
              placeholder="none"
              onChange={(e) => update(name, "dailyCap", e.target.value)}
              data-testid={`input-cap-${name}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyCapsEditor({
  value,
  onChange,
}: {
  value: EngagementConfig["weeklyCaps"];
  onChange: (v: EngagementConfig["weeklyCaps"]) => void;
}) {
  const set = (k: keyof EngagementConfig["weeklyCaps"], v: string) =>
    onChange({ ...value, [k]: Number(v) });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Soft cap 1 (points)</Label>
        <Input type="number" min={0} value={value.soft1} onChange={(e) => set("soft1", e.target.value)} data-testid="input-soft1" />
      </div>
      <div>
        <Label className="text-xs">Soft cap 1 multiplier</Label>
        <Input type="number" step="0.05" min={0} max={1} value={value.soft1Multiplier} onChange={(e) => set("soft1Multiplier", e.target.value)} data-testid="input-soft1-mult" />
      </div>
      <div>
        <Label className="text-xs">Soft cap 2 (points)</Label>
        <Input type="number" min={0} value={value.soft2} onChange={(e) => set("soft2", e.target.value)} data-testid="input-soft2" />
      </div>
      <div>
        <Label className="text-xs">Soft cap 2 multiplier</Label>
        <Input type="number" step="0.05" min={0} max={1} value={value.soft2Multiplier} onChange={(e) => set("soft2Multiplier", e.target.value)} data-testid="input-soft2-mult" />
      </div>
    </div>
  );
}

function StreakBonusesEditor({
  value,
  onChange,
}: {
  value: EngagementConfig["streakBonuses"];
  onChange: (v: EngagementConfig["streakBonuses"]) => void;
}) {
  const update = (i: number, field: "days" | "multiplier", v: string) => {
    const next = value.map((b, idx) => (idx === i ? { ...b, [field]: Number(v) } : b));
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={i} className="grid grid-cols-2 gap-3" data-testid={`bonus-row-${i}`}>
          <div>
            <Label className="text-xs">Days threshold</Label>
            <Input type="number" min={0} value={b.days} onChange={(e) => update(i, "days", e.target.value)} data-testid={`input-bonus-days-${i}`} />
          </div>
          <div>
            <Label className="text-xs">Multiplier (≥ 1)</Label>
            <Input type="number" step="0.05" min={1} value={b.multiplier} onChange={(e) => update(i, "multiplier", e.target.value)} data-testid={`input-bonus-mult-${i}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelsEditor({
  value,
  onChange,
}: {
  value: EngagementConfig["levels"];
  onChange: (v: EngagementConfig["levels"]) => void;
}) {
  const update = (i: number, field: "level" | "name" | "minPoints", v: string) => {
    const next = value.map((l, idx) =>
      idx === i ? { ...l, [field]: field === "name" ? v : Number(v) } : l,
    );
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-2" data-testid={`level-row-${i}`}>
          <div className="col-span-2">
            <Label className="text-xs">Level</Label>
            <Input type="number" min={1} value={l.level} onChange={(e) => update(i, "level", e.target.value)} data-testid={`input-level-num-${i}`} />
          </div>
          <div className="col-span-6">
            <Label className="text-xs">Name</Label>
            <Input value={l.name} onChange={(e) => update(i, "name", e.target.value)} data-testid={`input-level-name-${i}`} />
          </div>
          <div className="col-span-4">
            <Label className="text-xs">Min points</Label>
            <Input type="number" min={0} value={l.minPoints} onChange={(e) => update(i, "minPoints", e.target.value)} data-testid={`input-level-min-${i}`} />
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
          <span>Edit point values, weekly caps, streak bonuses, levels and per-track activity mapping.</span>
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
              title="Activity points"
              description="Base points and per-day caps for each activity type."
              initial={data.activities}
              onSaved={handleSaved}
              render={(v, set) => <ActivitiesEditor value={v} onChange={set} />}
            />
            <ConfigSection
              cfgKey="weeklyCaps"
              title="Weekly soft caps"
              description="Once weekly points cross a threshold, new awards are scaled down by the multiplier."
              initial={data.weeklyCaps}
              onSaved={handleSaved}
              render={(v, set) => <WeeklyCapsEditor value={v} onChange={set} />}
            />
            <ConfigSection
              cfgKey="streakBonuses"
              title="Streak bonus multipliers"
              description="Higher streaks unlock larger point multipliers (multiplier must be ≥ 1)."
              initial={data.streakBonuses}
              onSaved={handleSaved}
              render={(v, set) => <StreakBonusesEditor value={v} onChange={set} />}
            />
            <ConfigSection
              cfgKey="levels"
              title="Level thresholds"
              description="Total points needed to reach each level. Thresholds must strictly increase."
              initial={data.levels}
              onSaved={handleSaved}
              render={(v, set) => <LevelsEditor value={v} onChange={set} />}
            />
            <ConfigSection
              cfgKey="trackActivities"
              title="Per-track activity mapping"
              description="Which activity types contribute to each streak track. Comma-separated."
              initial={data.trackActivities}
              onSaved={handleSaved}
              render={(v, set) => <TrackActivitiesEditor value={v} onChange={set} />}
            />
          </>
        )}
      </div>
    </div>
  );
}
