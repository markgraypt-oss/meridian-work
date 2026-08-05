import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Scale,
  Footprints,
  Moon,
  Zap,
  Dumbbell,
  Apple,
  ShieldAlert,
  Flame,
  Ruler,
  Camera,
  Star,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint { date: string; value: number }

function MiniChart({
  title,
  icon: Icon,
  data,
  unit,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: DataPoint[];
  unit: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} width={35} unit={unit} />
              <Tooltip
                formatter={(v: number) => [`${v}${unit}`, title]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11 }}
              />
              <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();

  const { data: accessStatus } = useQuery<{ status: string }>({
    queryKey: [`/api/admin/coach-access/clients`],
    select: (d: any) => {
      const found = (d?.clients ?? []).find((c: any) => c.clientUserId === userId);
      return { status: found?.status ?? "none" };
    },
  });

  const isGranted = accessStatus?.status === "granted";

  const { data: bodyweight } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/bodyweight`],
    enabled: isGranted,
  });
  const { data: steps } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/steps`],
    enabled: isGranted,
  });
  const { data: sleep } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/sleep`],
    enabled: isGranted,
  });
  const { data: readiness } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/readiness`],
    enabled: isGranted,
  });
  const { data: caloricIntake } = useQuery<DataPoint[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/caloric-intake`],
    enabled: isGranted,
  });

  if (!isGranted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clients")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium">Access not granted</p>
            <p className="text-sm text-muted-foreground">
              This client has not yet consented to share their data. Send an access request from the
              Clients page.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/clients")}>
              Go to Clients
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Clients
        </Button>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Access granted</Badge>
      </div>

      {/* Charts row 1: bodyweight + steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MiniChart
          title="Bodyweight (90 days)"
          icon={Scale}
          data={bodyweight ?? []}
          unit="kg"
          color="hsl(var(--primary))"
        />
        <MiniChart
          title="Daily steps (30 days)"
          icon={Footprints}
          data={steps ?? []}
          unit=""
          color="#10b981"
        />
      </div>

      {/* Charts row 2: sleep + readiness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MiniChart
          title="Sleep (30 days)"
          icon={Moon}
          data={sleep ?? []}
          unit="h"
          color="#6366f1"
        />
        <MiniChart
          title="Readiness (30 days)"
          icon={Zap}
          data={readiness ?? []}
          unit=""
          color="#f59e0b"
        />
      </div>

      {/* Caloric intake chart */}
      <MiniChart
        title="Caloric intake (30 days)"
        icon={Flame}
        data={caloricIntake ?? []}
        unit=" kcal"
        color="#ef4444"
      />

      {/* Workouts + Nutrition tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Dumbbell className="h-4 w-4" />
              Recent workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutTable userId={userId!} enabled={isGranted} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Apple className="h-4 w-4" />
              Recent nutrition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NutritionTable userId={userId!} enabled={isGranted} />
          </CardContent>
        </Card>
      </div>

      {/* Body measurements table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Ruler className="h-4 w-4" />
            Body measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementsTable userId={userId!} enabled={isGranted} />
        </CardContent>
      </Card>

      {/* Progress photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Camera className="h-4 w-4" />
            Progress photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PhotosGrid userId={userId!} enabled={isGranted} />
        </CardContent>
      </Card>
    </div>
  );
}

function WorkoutTable({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { data } = useQuery<any[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/workouts`],
    enabled,
  });
  if (!data || data.length === 0)
    return <p className="text-xs text-muted-foreground text-center py-4">No workouts logged</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border">
          <th className="text-left pb-1 font-medium">Date</th>
          <th className="text-left pb-1 font-medium">Name</th>
          <th className="text-right pb-1 font-medium">Mins</th>
          <th className="text-right pb-1 font-medium">
            <Star className="h-3 w-3 inline" />
          </th>
        </tr>
      </thead>
      <tbody>
        {data.slice(0, 10).map((w, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-1 text-muted-foreground">{String(w.date ?? "").slice(0, 10)}</td>
            <td className="py-1 truncate max-w-[120px]">{w.name ?? "Workout"}</td>
            <td className="py-1 text-right">{w.durationMinutes ?? "—"}</td>
            <td className="py-1 text-right">{w.rating ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NutritionTable({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { data } = useQuery<any[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/nutrition`],
    enabled,
  });
  if (!data || data.length === 0)
    return <p className="text-xs text-muted-foreground text-center py-4">No nutrition logged</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border">
          <th className="text-left pb-1 font-medium">Date</th>
          <th className="text-right pb-1 font-medium">Calories</th>
          <th className="text-right pb-1 font-medium">Protein</th>
        </tr>
      </thead>
      <tbody>
        {data.slice(0, 8).map((n, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-1 text-muted-foreground">{String(n.date ?? "").slice(0, 10)}</td>
            <td className="py-1 text-right">{n.calories ?? "—"}</td>
            <td className="py-1 text-right">{n.protein ? `${n.protein}g` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MeasurementsTable({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { data } = useQuery<any[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/measurements`],
    enabled,
  });
  if (!data || data.length === 0)
    return <p className="text-xs text-muted-foreground text-center py-4">No measurements logged</p>;

  // Show the columns that have any data
  const cols: { key: string; label: string }[] = [
    { key: "waist", label: "Waist" },
    { key: "chest", label: "Chest" },
    { key: "hips", label: "Hips" },
    { key: "neck", label: "Neck" },
    { key: "shoulders", label: "Shoulders" },
    { key: "leftBicep", label: "L Bicep" },
    { key: "rightBicep", label: "R Bicep" },
    { key: "leftThigh", label: "L Thigh" },
    { key: "rightThigh", label: "R Thigh" },
    { key: "leftCalf", label: "L Calf" },
    { key: "rightCalf", label: "R Calf" },
  ].filter(c => data.some(r => r[c.key] != null));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left pb-1 font-medium whitespace-nowrap pr-3">Date</th>
            {cols.map(c => (
              <th key={c.key} className="text-right pb-1 font-medium whitespace-nowrap px-1">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((m, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-1 text-muted-foreground pr-3 whitespace-nowrap">
                {String(m.date ?? "").slice(0, 10)}
              </td>
              {cols.map(c => (
                <td key={c.key} className="py-1 text-right px-1">
                  {m[c.key] != null ? `${m[c.key]}cm` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhotosGrid({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { data } = useQuery<any[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/photos`],
    enabled,
  });
  if (!data || data.length === 0)
    return <p className="text-xs text-muted-foreground text-center py-4">No progress photos uploaded</p>;

  // Group by photoSetId to show sets together
  const setMap = new Map<string, any[]>();
  for (const p of data) {
    const arr = setMap.get(p.photoSetId) ?? [];
    arr.push(p);
    setMap.set(p.photoSetId, arr);
  }
  const sets = Array.from(setMap.entries()).slice(0, 8);

  return (
    <div className="space-y-4">
      {sets.map(([setId, photos]) => (
        <div key={setId}>
          <p className="text-xs text-muted-foreground mb-2">
            {String(photos[0]?.date ?? "").slice(0, 10)}
          </p>
          <div className="flex gap-2 flex-wrap">
            {photos.map((p: any) => (
              <div key={p.id} className="relative group">
                <img
                  src={p.imageUrl}
                  alt={p.category}
                  className="h-32 w-24 object-cover rounded-md border border-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1">
                  {p.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
