import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subDays, subMonths, startOfMonth, isAfter, parseISO } from "date-fns";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
type MetricKey = 
  | "steps" 
  | "sleep" 
  | "bodyWeight" 
  | "bodyFat" 
  | "photos" 
  | "caloricIntake" 
  | "restingHR" 
  | "bloodPressure" 
  | "leanBodyMass" 
  | "caloricBurn";

interface ProgressDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricKey: MetricKey;
  label: string;
  icon: React.ElementType;
  color: string;
  endpoint: string;
  unit: string;
}

const timeRanges: TimeRange[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

function getDateCutoff(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "1W": return subDays(now, 7);
    case "1M": return subMonths(now, 1);
    case "3M": return subMonths(now, 3);
    case "6M": return subMonths(now, 6);
    case "1Y": return subMonths(now, 12);
    case "ALL": return new Date(0);
  }
}

const addEntrySchemas: Record<MetricKey, z.ZodObject<any>> = {
  steps: z.object({
    date: z.string().min(1, "Date is required"),
    steps: z.coerce.number().min(0, "Steps must be positive"),
    goal: z.coerce.number().optional(),
  }),
  sleep: z.object({
    date: z.string().min(1, "Date is required"),
    hours: z.coerce.number().min(0).max(24, "Hours must be 0-24"),
    quality: z.coerce.number().min(1).max(10).optional(),
  }),
  bodyWeight: z.object({
    date: z.string().min(1, "Date is required"),
    weight: z.coerce.number().min(0, "Weight must be positive"),
  }),
  bodyFat: z.object({
    date: z.string().min(1, "Date is required"),
    percentage: z.coerce.number().min(0).max(100, "Percentage must be 0-100"),
  }),
  photos: z.object({
    date: z.string().min(1, "Date is required"),
  }),
  caloricIntake: z.object({
    date: z.string().min(1, "Date is required"),
    calories: z.coerce.number().min(0, "Calories must be positive"),
  }),
  restingHR: z.object({
    date: z.string().min(1, "Date is required"),
    bpm: z.coerce.number().min(30).max(200, "BPM must be 30-200"),
  }),
  bloodPressure: z.object({
    date: z.string().min(1, "Date is required"),
    systolic: z.coerce.number().min(50).max(250, "Systolic must be 50-250"),
    diastolic: z.coerce.number().min(30).max(150, "Diastolic must be 30-150"),
  }),
  leanBodyMass: z.object({
    date: z.string().min(1, "Date is required"),
    mass: z.coerce.number().min(0, "Mass must be positive"),
  }),
  caloricBurn: z.object({
    date: z.string().min(1, "Date is required"),
    calories: z.coerce.number().min(0, "Calories must be positive"),
  }),
};

function getValueFromEntry(entry: any, metricKey: MetricKey): number {
  switch (metricKey) {
    case "steps": return entry.steps;
    case "sleep": return entry.hours;
    case "bodyWeight": return entry.weight;
    case "bodyFat": return entry.percentage;
    case "photos": return 1;
    case "caloricIntake": return entry.calories;
    case "restingHR": return entry.bpm;
    case "bloodPressure": return entry.systolic;
    case "leanBodyMass": return entry.mass;
    case "caloricBurn": return entry.calories;
  }
}

function formatEntryDisplay(entry: any, metricKey: MetricKey): string {
  switch (metricKey) {
    case "steps": return `${entry.steps.toLocaleString()} steps`;
    case "sleep": return `${entry.hours}h${entry.quality ? ` (Q: ${entry.quality}/10)` : ""}`;
    case "bodyWeight": return `${entry.weight} kg`;
    case "bodyFat": return `${entry.percentage}%`;
    case "photos": return "Photo";
    case "caloricIntake": return `${entry.calories.toLocaleString()} kcal`;
    case "restingHR": return `${entry.bpm} bpm`;
    case "bloodPressure": return `${entry.systolic}/${entry.diastolic} mmHg`;
    case "leanBodyMass": return `${entry.mass} kg`;
    case "caloricBurn": return `${entry.calories.toLocaleString()} kcal`;
  }
}

function AddEntryForm({ 
  metricKey, 
  endpoint,
  onSuccess 
}: { 
  metricKey: MetricKey; 
  endpoint: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const schema = addEntrySchemas[metricKey];
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      ...(metricKey === "steps" && { steps: 0, goal: 10000 }),
      ...(metricKey === "sleep" && { hours: 7 }),
      ...(metricKey === "bodyWeight" && { weight: 0 }),
      ...(metricKey === "bodyFat" && { percentage: 0 }),
      ...(metricKey === "caloricIntake" && { calories: 0 }),
      ...(metricKey === "restingHR" && { bpm: 60 }),
      ...(metricKey === "bloodPressure" && { systolic: 120, diastolic: 80 }),
      ...(metricKey === "leanBodyMass" && { mass: 0 }),
      ...(metricKey === "caloricBurn" && { calories: 0 }),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({ title: "Entry added successfully" });
      onSuccess();
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add entry", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  if (metricKey === "photos") {
    return (
      <div className="text-center text-muted-foreground py-4">
        To add photos, please use the Progress Photos section.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-entry-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {metricKey === "steps" && (
          <>
            <FormField
              control={form.control}
              name="steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-steps" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-goal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "sleep" && (
          <>
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.5" {...field} data-testid="input-entry-hours" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={"quality" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality (1-10, optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="10" {...field} data-testid="input-entry-quality" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "bodyWeight" && (
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-weight" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "bodyFat" && (
          <FormField
            control={form.control}
            name="percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body Fat (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-percentage" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "caloricIntake" && (
          <FormField
            control={form.control}
            name="calories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Calories</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-calories" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "restingHR" && (
          <FormField
            control={form.control}
            name="bpm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BPM</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-bpm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "bloodPressure" && (
          <>
            <FormField
              control={form.control}
              name="systolic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Systolic (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-systolic" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diastolic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diastolic (mmHg)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} data-testid="input-entry-diastolic" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {metricKey === "leanBodyMass" && (
          <FormField
            control={form.control}
            name="mass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lean Mass (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} data-testid="input-entry-mass" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {metricKey === "caloricBurn" && (
          <FormField
            control={form.control}
            name="calories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Calories Burned</FormLabel>
                <FormControl>
                  <Input type="number" {...field} data-testid="input-entry-calories-burn" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button 
          type="submit" 
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black font-semibold"
          disabled={mutation.isPending}
          data-testid="button-submit-entry"
        >
          {mutation.isPending ? "Adding..." : "Add Entry"}
        </Button>
      </form>
    </Form>
  );
}

export default function ProgressDetailModal({
  isOpen,
  onClose,
  metricKey,
  label,
  icon: Icon,
  color,
  endpoint,
  unit,
}: ProgressDetailModalProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: [endpoint],
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `${endpoint}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({ title: "Entry deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete entry", variant: "destructive" });
    },
  });

  const cutoffDate = getDateCutoff(timeRange);
  const filteredEntries = entries.filter(entry => {
    const entryDate = parseISO(entry.date);
    return isAfter(entryDate, cutoffDate);
  });

  const chartData = [...filteredEntries]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(entry => ({
      date: format(parseISO(entry.date), "dd MMM"),
      value: getValueFromEntry(entry, metricKey),
      fullDate: entry.date,
    }));

  const groupedByMonth = filteredEntries.reduce((acc, entry) => {
    const monthKey = format(parseISO(entry.date), "MMMM yyyy");
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border" data-testid="modal-progress-detail">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <DialogTitle className="text-xl">{label}</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            {timeRanges.map(range => (
              <TabsTrigger 
                key={range} 
                value={range}
                className="text-xs"
                data-testid={`tab-range-${range}`}
              >
                {range}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : chartData.length > 0 ? (
          <div className="h-48 w-full" data-testid="chart-progress">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0cc9a9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0cc9a9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={{ stroke: '#333' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={{ stroke: '#333' }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f1f1f', 
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0cc9a9" 
                  strokeWidth={2}
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground" data-testid="text-no-data">
            No data for this time period
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-foreground">History</h4>
            <Button
              size="sm"
              className="bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black"
              onClick={() => setShowAddForm(!showAddForm)}
              data-testid="button-toggle-add-form"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          </div>

          {showAddForm && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <AddEntryForm 
                metricKey={metricKey} 
                endpoint={endpoint}
                onSuccess={() => setShowAddForm(false)}
              />
            </div>
          )}

          {sortedMonths.length === 0 ? (
            <p className="text-muted-foreground text-center py-4" data-testid="text-no-entries">No entries yet</p>
          ) : (
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {sortedMonths.map(month => (
                <div key={month}>
                  <h5 className="text-sm font-medium text-muted-foreground mb-2" data-testid={`text-month-header-${month.replace(/\s+/g, '-').toLowerCase()}`}>{month}</h5>
                  <div className="space-y-2">
                    {groupedByMonth[month]
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((entry: any) => (
                        <div 
                          key={entry.id} 
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          data-testid={`entry-${metricKey}-${entry.id}`}
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {formatEntryDisplay(entry, metricKey)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(entry.date), "d MMM yyyy")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(entry.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-entry-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
