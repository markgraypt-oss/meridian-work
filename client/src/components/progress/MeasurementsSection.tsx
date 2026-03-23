import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ruler, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BodyMeasurement {
  id: number;
  date: string;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  leftArm: number | null;
  rightArm: number | null;
  leftThigh: number | null;
  rightThigh: number | null;
  neck: number | null;
  notes: string | null;
}

const MEASUREMENT_COLORS: { [key: string]: string } = {
  waist: "#ef4444",
  chest: "#3b82f6",
  hips: "#10b981",
  leftArm: "#0cc9a9",
  rightArm: "#f97316",
  leftThigh: "#8b5cf6",
  rightThigh: "#a855f7",
  neck: "#6b7280",
};

const MEASUREMENT_LABELS: { [key: string]: string } = {
  waist: "Waist",
  chest: "Chest",
  hips: "Hips",
  leftArm: "L Arm",
  rightArm: "R Arm",
  leftThigh: "L Thigh",
  rightThigh: "R Thigh",
  neck: "Neck",
};

export function MeasurementsSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [measurements, setMeasurements] = useState({
    waist: "",
    chest: "",
    hips: "",
    leftArm: "",
    rightArm: "",
    leftThigh: "",
    rightThigh: "",
    neck: "",
  });
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<BodyMeasurement[]>({
    queryKey: ["/api/progress/measurements"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/progress/measurements", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/measurements"] });
      setIsAddOpen(false);
      setMeasurements({
        waist: "", chest: "", hips: "", leftArm: "", rightArm: "", leftThigh: "", rightThigh: "", neck: ""
      });
      toast({ title: "Measurements added" });
    },
    onError: () => {
      toast({ title: "Failed to add measurements", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    const data: any = { date: newDate };
    Object.entries(measurements).forEach(([key, value]) => {
      if (value) data[key] = parseFloat(value);
    });
    addMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sortedEntries = entries 
    ? [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const chartData = sortedEntries.map((e) => ({
    date: format(new Date(e.date), "dd MMM"),
    waist: e.waist,
    chest: e.chest,
    hips: e.hips,
    leftArm: e.leftArm,
    rightArm: e.rightArm,
    leftThigh: e.leftThigh,
    rightThigh: e.rightThigh,
    neck: e.neck,
  }));

  const latestEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
  const firstEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

  const calculateChange = (key: keyof BodyMeasurement) => {
    if (!latestEntry || !firstEntry) return null;
    const latest = latestEntry[key] as number | null;
    const first = firstEntry[key] as number | null;
    if (latest === null || first === null) return null;
    return latest - first;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Body Measurements</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90" data-testid="button-add-measurements">
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Measurements</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-measurement-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(MEASUREMENT_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label} (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={measurements[key as keyof typeof measurements]}
                      onChange={(e) => setMeasurements({ ...measurements, [key]: e.target.value })}
                      placeholder="0.0"
                      data-testid={`input-${key}`}
                    />
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleAdd} 
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                disabled={addMutation.isPending}
                data-testid="button-save-measurements"
              >
                {addMutation.isPending ? "Saving..." : "Save Measurements"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sortedEntries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Ruler className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Measurements</h3>
            <p className="text-muted-foreground">Track your body measurements to see changes over time.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latestEntry && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Latest Measurements</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(latestEntry.date), "dd MMM yyyy")}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(MEASUREMENT_LABELS).map(([key, label]) => {
                    const value = latestEntry[key as keyof BodyMeasurement];
                    const change = calculateChange(key as keyof BodyMeasurement);
                    if (value === null) return null;
                    
                    return (
                      <div key={key} className="text-center p-2 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold text-foreground">{value}cm</p>
                        {change !== null && change !== 0 && (
                          <Badge 
                            variant="secondary" 
                            className={change < 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}
                          >
                            {change > 0 ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {change > 0 ? "+" : ""}{change.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Measurement Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(value) => `${value}`}
                      tickLine={false}
                      axisLine={false}
                      width={35}
                      tickCount={4}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    {Object.entries(MEASUREMENT_COLORS).map(([key, color]) => (
                      <Area 
                        key={key}
                        type="monotone" 
                        dataKey={key} 
                        name={MEASUREMENT_LABELS[key]}
                        stroke={color} 
                        strokeWidth={2}
                        fill="none"
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
