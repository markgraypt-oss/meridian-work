import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Scale, Plus, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BodyweightEntry {
  id: number;
  weight: number;
  date: string;
  notes: string | null;
}

export function BodyweightSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newNotes, setNewNotes] = useState("");
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<BodyweightEntry[]>({
    queryKey: ["/api/progress/bodyweight"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { weight: number; date: string; notes?: string }) => {
      return apiRequest("/api/progress/bodyweight", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/bodyweight"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setIsAddOpen(false);
      setNewWeight("");
      setNewNotes("");
      toast({ title: "Weight entry added" });
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/progress/bodyweight/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/bodyweight"] });
      toast({ title: "Entry deleted" });
    },
  });

  const handleAdd = () => {
    if (!newWeight) return;
    addMutation.mutate({
      weight: parseFloat(newWeight),
      date: newDate,
      notes: newNotes || undefined,
    });
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
    weight: e.weight,
    fullDate: e.date,
  }));

  const rollingAverage = calculateRollingAverage(sortedEntries, 7);

  const currentWeight = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].weight : 0;
  const startWeight = sortedEntries.length > 0 ? sortedEntries[0].weight : 0;
  const weightChange = currentWeight - startWeight;
  const lowestWeight = sortedEntries.length > 0 ? Math.min(...sortedEntries.map(e => e.weight)) : 0;
  const highestWeight = sortedEntries.length > 0 ? Math.max(...sortedEntries.map(e => e.weight)) : 0;
  const weightChangePct = startWeight > 0 ? Math.abs(((currentWeight - startWeight) / startWeight) * 100).toFixed(1) : "0";
  const lastEntryDate = sortedEntries.length > 0 ? format(new Date(sortedEntries[sortedEntries.length - 1].date), "dd MMM") : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Bodyweight</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90" data-testid="button-add-weight">
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add Weight Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="75.5"
                  data-testid="input-weight"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-weight-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Morning weight, after workout, etc."
                  data-testid="input-weight-notes"
                />
              </div>
              <Button 
                onClick={handleAdd} 
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                disabled={addMutation.isPending}
                data-testid="button-save-weight"
              >
                {addMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sortedEntries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Weight Entries</h3>
            <p className="text-muted-foreground">Track your bodyweight to see trends over time.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Scale className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{currentWeight}kg</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                {weightChange < 0 ? (
                  <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                ) : weightChange > 0 ? (
                  <TrendingUp className="w-6 h-6 mx-auto text-red-500 mb-2" />
                ) : (
                  <Minus className="w-6 h-6 mx-auto text-gray-500 mb-2" />
                )}
                <p className="text-2xl font-bold text-foreground">
                  {weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)}kg
                </p>
                <p className="text-xs text-muted-foreground">Change</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <TrendingDown className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{lowestWeight}kg</p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{highestWeight}kg</p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Weight Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0cc9a9" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#0cc9a9" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
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
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 2', 'dataMax + 2']}
                      tickFormatter={(value) => `${value}`}
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
                      formatter={(value: number) => [`${value}kg`, 'Weight']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#0cc9a9" 
                      strokeWidth={2}
                      fill="url(#weightGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#0cc9a9', stroke: '#0cc9a9' }}
                    />
                    {chartData.length > 0 && (
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="none"
                        fill="none"
                        dot={(props: any) => {
                          if (props.index === chartData.length - 1) {
                            return (
                              <g>
                                <circle cx={props.cx} cy={props.cy} r={8} fill="#0cc9a9" fillOpacity={0.2} stroke="#0cc9a9" strokeWidth={0} />
                                <circle cx={props.cx} cy={props.cy} r={5} fill="#0cc9a9" stroke="hsl(var(--card))" strokeWidth={2} />
                                <text x={props.cx} y={props.cy - 14} textAnchor="middle" fill="#0cc9a9" fontSize={11} fontWeight={700}>
                                  {lastEntryDate}
                                </text>
                              </g>
                            );
                          }
                          return <g />;
                        }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {sortedEntries.length >= 2 && (
                <div className="mt-4 py-2 px-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-foreground font-medium">
                    Your weight is {weightChange < 0 ? "down" : weightChange > 0 ? "up" : "unchanged"}{" "}
                    <span className={weightChange < 0 ? "text-green-400" : weightChange > 0 ? "text-red-400" : "text-muted-foreground"}>
                      {weightChangePct}%
                    </span>{" "}
                    since your first entry
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {[...sortedEntries].reverse().slice(0, 20).map((entry) => (
                  <div key={entry.id} className="p-3 flex items-center justify-between" data-testid={`weight-entry-${entry.id}`}>
                    <div>
                      <p className="font-medium text-foreground">{entry.weight}kg</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.date), "dd MMM yyyy")}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground">{entry.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(entry.id)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`button-delete-weight-${entry.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function calculateRollingAverage(entries: BodyweightEntry[], days: number) {
  if (entries.length < days) return entries.map(e => e.weight);
  
  return entries.map((_, i) => {
    const start = Math.max(0, i - days + 1);
    const subset = entries.slice(start, i + 1);
    const avg = subset.reduce((sum, e) => sum + e.weight, 0) / subset.length;
    return avg;
  });
}
