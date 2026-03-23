import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Footprints, Plus, TrendingUp, Target, Flame } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StepEntry {
  id: number;
  date: string;
  steps: number;
  distance: number | null;
  activeMinutes: number | null;
  notes: string | null;
}

const STEP_GOAL = 10000;

export function StepsSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<StepEntry[]>({
    queryKey: ["/api/progress/steps"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/progress/steps", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      setIsAddOpen(false);
      setSteps("");
      setDistance("");
      setActiveMinutes("");
      setNotes("");
      toast({ title: "Steps entry added" });
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/progress/steps/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/steps"] });
      toast({ title: "Entry deleted" });
    },
  });

  const handleAdd = () => {
    if (!steps) return;
    addMutation.mutate({
      date: newDate,
      steps: parseInt(steps),
      distance: distance ? parseFloat(distance) : undefined,
      activeMinutes: activeMinutes ? parseInt(activeMinutes) : undefined,
      notes: notes || undefined,
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

  const last7Days = sortedEntries.slice(-7);

  const chartData = last7Days.map((e) => ({
    date: format(new Date(e.date), "EEE"),
    steps: e.steps,
    fullDate: e.date,
  }));

  const avgSteps = sortedEntries.length > 0 
    ? sortedEntries.reduce((sum, e) => sum + e.steps, 0) / sortedEntries.length 
    : 0;
  const totalSteps = sortedEntries.reduce((sum, e) => sum + e.steps, 0);
  const daysOverGoal = sortedEntries.filter(e => e.steps >= STEP_GOAL).length;
  const bestDay = sortedEntries.length > 0 ? Math.max(...sortedEntries.map(e => e.steps)) : 0;
  const weeklyAvg = last7Days.length > 0 
    ? last7Days.reduce((sum, e) => sum + e.steps, 0) / last7Days.length 
    : 0;

  const formatSteps = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Steps</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90" data-testid="button-add-steps">
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add Steps Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-steps-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Steps</Label>
                <Input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="10000"
                  data-testid="input-steps"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Distance (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="7.5"
                    data-testid="input-steps-distance"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Active Minutes</Label>
                  <Input
                    type="number"
                    value={activeMinutes}
                    onChange={(e) => setActiveMinutes(e.target.value)}
                    placeholder="45"
                    data-testid="input-active-minutes"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Morning walk, gym, etc."
                  data-testid="input-steps-notes"
                />
              </div>
              <Button 
                onClick={handleAdd} 
                className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90"
                disabled={!steps || addMutation.isPending}
                data-testid="button-save-steps"
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
            <Footprints className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Step Data</h3>
            <p className="text-muted-foreground">Track your daily steps to monitor your activity.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Footprints className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{formatSteps(avgSteps)}</p>
                <p className="text-xs text-muted-foreground">Daily Avg</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{formatSteps(weeklyAvg)}</p>
                <p className="text-xs text-muted-foreground">7-Day Avg</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Target className="w-6 h-6 mx-auto text-[#0cc9a9] mb-2" />
                <p className="text-2xl font-bold text-foreground">{daysOverGoal}</p>
                <p className="text-xs text-muted-foreground">Days Hit Goal</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Flame className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{formatSteps(bestDay)}</p>
                <p className="text-xs text-muted-foreground">Best Day</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={formatSteps}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Steps']}
                    />
                    <ReferenceLine 
                      y={STEP_GOAL} 
                      stroke="#22c55e" 
                      strokeDasharray="5 5"
                      label={{ value: '10k Goal', position: 'right', fill: '#22c55e', fontSize: 10 }}
                    />
                    <Bar 
                      dataKey="steps" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {sortedEntries.length >= 2 && (
                <div className="mt-4 py-2 px-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-foreground font-medium">
                    Averaging <span className="text-blue-400">{formatSteps(Math.round(avgSteps))}</span> steps per day across {sortedEntries.length} entries
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
                {[...sortedEntries].reverse().slice(0, 14).map((entry) => (
                  <div key={entry.id} className="p-3 flex items-center justify-between" data-testid={`steps-entry-${entry.id}`}>
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.steps.toLocaleString()} steps
                        {entry.steps >= STEP_GOAL && " ✓"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.date), "dd MMM yyyy")}
                        {entry.distance && ` • ${entry.distance}km`}
                        {entry.activeMinutes && ` • ${entry.activeMinutes}min active`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(entry.id)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`button-delete-steps-${entry.id}`}
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
