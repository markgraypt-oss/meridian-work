import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar as CalendarIcon,
  Plus,
  Edit,
  Trash2,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { 
  InjuryLog, 
  InsertInjuryLog, 
  DailySeverityLog, 
  InsertDailySeverityLog,
  RecoveryAction,
  InsertRecoveryAction,
  RecoveryCompliance,
  InsertRecoveryCompliance,
  RecoveryAlert
} from "@shared/schema";

export default function InjuryTrackingPage() {
  const [selectedInjury, setSelectedInjury] = useState<InjuryLog | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [severityValue, setSeverityValue] = useState([5]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { formatDate } = useFormattedDate();

  // Fetch injuries
  const { data: injuries = [], isLoading: injuriesLoading } = useQuery({
    queryKey: ["/api/injuries"],
  });

  // Fetch recovery alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/recovery-alerts"],
  });

  // Fetch severity logs for selected injury
  const { data: severityLogs = [] } = useQuery({
    queryKey: ["/api/injuries", selectedInjury?.id, "severity"],
    enabled: !!selectedInjury,
  });

  // Fetch recovery actions for selected injury
  const { data: recoveryActions = [] } = useQuery({
    queryKey: ["/api/injuries", selectedInjury?.id, "recovery-actions"],
    enabled: !!selectedInjury,
  });

  // Fetch injury analysis
  const { data: analysis } = useQuery({
    queryKey: ["/api/injuries", selectedInjury?.id, "analysis"],
    enabled: !!selectedInjury,
  });

  // Create injury mutation
  const createInjuryMutation = useMutation({
    mutationFn: async (data: InsertInjuryLog) => {
      const response = await fetch("/api/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create injury");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/injuries"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Injury logged successfully" });
    },
  });

  // Create severity log mutation
  const createSeverityMutation = useMutation({
    mutationFn: async (data: InsertDailySeverityLog) => {
      const response = await fetch(`/api/injuries/${data.injuryLogId}/severity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to log severity");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/injuries", selectedInjury?.id, "severity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/injuries", selectedInjury?.id, "analysis"] });
      toast({ title: "Severity logged successfully" });
    },
  });

  // Create recovery action mutation
  const createActionMutation = useMutation({
    mutationFn: async (data: InsertRecoveryAction) => {
      const response = await fetch(`/api/injuries/${data.injuryLogId}/recovery-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create recovery action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/injuries", selectedInjury?.id, "recovery-actions"] });
      setIsActionDialogOpen(false);
      toast({ title: "Recovery action created successfully" });
    },
  });

  // Mark compliance mutation
  const markComplianceMutation = useMutation({
    mutationFn: async ({ actionId, completed }: { actionId: number; completed: boolean }) => {
      const response = await fetch(`/api/recovery-actions/${actionId}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed,
          completedDate: new Date(),
          notes: completed ? "Completed via dashboard" : "Skipped via dashboard"
        }),
      });
      if (!response.ok) throw new Error("Failed to mark compliance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recovery-actions"] });
      toast({ title: "Compliance updated successfully" });
    },
  });

  const handleCreateInjury = (formData: FormData) => {
    const data: InsertInjuryLog = {
      bodyPart: formData.get("bodyPart") as string,
      view: formData.get("view") as "front" | "back",
      injuryType: formData.get("injuryType") as string,
      description: formData.get("description") as string,
      initialSeverity: parseInt(formData.get("initialSeverity") as string),
      currentSeverity: parseInt(formData.get("initialSeverity") as string),
      firstLoggedAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    createInjuryMutation.mutate(data);
  };

  const handleLogSeverity = () => {
    if (!selectedInjury) return;
    
    const data: InsertDailySeverityLog = {
      injuryLogId: selectedInjury.id,
      severity: severityValue[0],
      logDate: selectedDate || new Date(),
      notes: "Logged via dashboard",
    };
    createSeverityMutation.mutate(data);
  };

  const handleCreateAction = (formData: FormData) => {
    if (!selectedInjury) return;

    const data: InsertRecoveryAction = {
      injuryLogId: selectedInjury.id,
      actionType: formData.get("actionType") as string,
      description: formData.get("description") as string,
      frequency: formData.get("frequency") as string,
      duration: parseInt(formData.get("duration") as string),
      isActive: true,
      createdAt: new Date(),
    };
    createActionMutation.mutate(data);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingUp className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-[#0cc9a9]" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving": return "text-green-600";
      case "worsening": return "text-red-600";
      default: return "text-[#0cc9a9]";
    }
  };

  const formatSeverityData = (logs: DailySeverityLog[]) => {
    return logs.map(log => ({
      date: formatDate(new Date(log.logDate), "monthDay"),
      severity: log.severity,
      notes: log.notes,
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Injury Tracking & Recovery</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log New Injury
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log New Injury</DialogTitle>
            </DialogHeader>
            <form action={handleCreateInjury} className="space-y-4">
              <div>
                <Label htmlFor="bodyPart">Body Part</Label>
                <Input id="bodyPart" name="bodyPart" required />
              </div>
              <div>
                <Label htmlFor="view">View</Label>
                <Select name="view" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front</SelectItem>
                    <SelectItem value="back">Back</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="injuryType">Injury Type</Label>
                <Select name="injuryType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select injury type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strain">Strain</SelectItem>
                    <SelectItem value="sprain">Sprain</SelectItem>
                    <SelectItem value="pain">Pain</SelectItem>
                    <SelectItem value="stiffness">Stiffness</SelectItem>
                    <SelectItem value="inflammation">Inflammation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div>
                <Label htmlFor="initialSeverity">Initial Severity (1-10)</Label>
                <Input id="initialSeverity" name="initialSeverity" type="number" min="1" max="10" required />
              </div>
              <Button type="submit" disabled={createInjuryMutation.isPending}>
                {createInjuryMutation.isPending ? "Logging..." : "Log Injury"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Recovery Alerts
          </h2>
          {alerts.map((alert: RecoveryAlert) => (
            <Alert key={alert.id} className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.alertType}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Injuries List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Injuries</CardTitle>
          </CardHeader>
          <CardContent>
            {injuriesLoading ? (
              <div>Loading injuries...</div>
            ) : (
              <div className="space-y-2">
                {injuries.map((injury: InjuryLog) => (
                  <div
                    key={injury.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedInjury?.id === injury.id
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedInjury(injury)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{injury.bodyPart}</h3>
                        <p className="text-sm text-gray-600">{injury.injuryType}</p>
                        <Badge variant="outline" className="mt-1">
                          Severity: {injury.currentSeverity}/10
                        </Badge>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {formatDate(new Date(injury.lastUpdatedAt), "short")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Injury Details */}
        {selectedInjury && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedInjury.bodyPart} - {selectedInjury.injuryType}</span>
                {analysis && (
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(analysis.trend)}
                    <span className={`text-sm font-medium ${getTrendColor(analysis.trend)}`}>
                      {analysis.trend}
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="severity">Severity</TabsTrigger>
                  <TabsTrigger value="recovery">Recovery</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Description</Label>
                      <p className="text-sm">{selectedInjury.description || "No description"}</p>
                    </div>
                    <div>
                      <Label>First Logged</Label>
                      <p className="text-sm">{formatDate(new Date(selectedInjury.firstLoggedAt!), "full")}</p>
                    </div>
                  </div>
                  
                  {analysis && (
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{analysis.daysSinceLogged}</div>
                          <p className="text-xs text-gray-600">Days Since Logged</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{analysis.averageSeverity}</div>
                          <p className="text-xs text-gray-600">Average Severity</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">
                            {analysis.recommendAction ? "YES" : "NO"}
                          </div>
                          <p className="text-xs text-gray-600">Action Recommended</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="severity" className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label>Severity Level: {severityValue[0]}/10</Label>
                      <input
                        type="range"
                        value={severityValue[0] || 1}
                        onChange={(e) => setSeverityValue([parseInt(e.target.value)])}
                        max={10}
                        min={1}
                        step={1}
                        className="mt-2 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((severityValue[0] || 1) / 10) * 100}%, #e5e7eb ${((severityValue[0] || 1) / 10) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {selectedDate ? formatDate(selectedDate, "full") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button 
                      onClick={handleLogSeverity}
                      disabled={createSeverityMutation.isPending}
                    >
                      Log Severity
                    </Button>
                  </div>

                  {severityLogs.length > 0 && (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={formatSeverityData(severityLogs)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 10]} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="severity" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recovery" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Recovery Actions</h3>
                    <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Action
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Recovery Action</DialogTitle>
                        </DialogHeader>
                        <form action={handleCreateAction} className="space-y-4">
                          <div>
                            <Label htmlFor="actionType">Action Type</Label>
                            <Select name="actionType" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select action type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rest">Rest</SelectItem>
                                <SelectItem value="ice">Ice</SelectItem>
                                <SelectItem value="heat">Heat</SelectItem>
                                <SelectItem value="stretch">Stretch</SelectItem>
                                <SelectItem value="exercise">Exercise</SelectItem>
                                <SelectItem value="medication">Medication</SelectItem>
                                <SelectItem value="massage">Massage</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" />
                          </div>
                          <div>
                            <Label htmlFor="frequency">Frequency</Label>
                            <Select name="frequency" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="3x_week">3x per week</SelectItem>
                                <SelectItem value="every_other_day">Every other day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="duration">Duration (minutes)</Label>
                            <Input id="duration" name="duration" type="number" />
                          </div>
                          <Button type="submit" disabled={createActionMutation.isPending}>
                            {createActionMutation.isPending ? "Creating..." : "Create Action"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3">
                    {recoveryActions.map((action: RecoveryAction) => (
                      <Card key={action.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{action.actionType}</h4>
                              <p className="text-sm text-gray-600">{action.description}</p>
                              <div className="flex items-center space-x-4 mt-2">
                                <Badge variant="outline">{action.frequency}</Badge>
                                {action.duration && (
                                  <Badge variant="outline">{action.duration} min</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markComplianceMutation.mutate({ 
                                  actionId: action.id, 
                                  completed: true 
                                })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markComplianceMutation.mutate({ 
                                  actionId: action.id, 
                                  completed: false 
                                })}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-4">
                  {analysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Progress Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center space-x-2">
                            {getTrendIcon(analysis.trend)}
                            <span className={`font-medium ${getTrendColor(analysis.trend)}`}>
                              {analysis.trend.charAt(0).toUpperCase() + analysis.trend.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Based on severity trends over the last 14 days
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Recovery Recommendation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center space-x-2">
                            {analysis.recommendAction ? (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium">
                              {analysis.recommendAction ? "Action Needed" : "Continue Current Plan"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            {analysis.recommendAction 
                              ? "Consider increasing recovery efforts or seeking professional help"
                              : "Current recovery approach appears effective"
                            }
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}