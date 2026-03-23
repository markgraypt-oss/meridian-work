import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Download, RotateCcw, User, AlertTriangle } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BodyMapLog } from "@shared/schema";
import BodyDiagram from "@/components/BodyDiagram";

const injuryLogSchema = z.object({
  bodyPart: z.string().min(1, "Body part is required"),
  painLevel: z.number().min(1).max(10),
  injuryType: z.enum(["strain", "sprain", "tightness", "tear", "inflammation", "other"]),
  recoveryStatus: z.enum(["acute", "recovering", "recovered", "chronic"]),
  notes: z.string().optional(),
  x: z.number(),
  y: z.number(),
  view: z.enum(["front", "back"]),
});

type InjuryLogFormData = z.infer<typeof injuryLogSchema>;

export default function BodyMap() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<"front" | "back">("front");
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; bodyPart: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBodyPart, setFilterBodyPart] = useState<string>("all");

  const form = useForm<InjuryLogFormData>({
    resolver: zodResolver(injuryLogSchema),
    defaultValues: {
      bodyPart: "",
      painLevel: 5,
      injuryType: "other",
      recoveryStatus: "acute",
      notes: "",
      x: 0,
      y: 0,
      view: "front",
    },
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: bodyMapLogs = [], error } = useQuery<BodyMapLog[]>({
    queryKey: ["/api/body-map"],
    retry: false,
    enabled: isAuthenticated,
  });

  const createLogMutation = useMutation({
    mutationFn: async (data: InjuryLogFormData) => {
      const response = await fetch("/api/body-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create log");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      toast({
        title: "Success",
        description: "Injury log recorded successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record injury log",
        variant: "destructive",
      });
    },
  });

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading body map...</p>
        </div>
      </div>
    );
  }

  const handleBodyPartClick = (bodyPart: string, x: number, y: number, view: "front" | "back") => {
    setSelectedPoint({ x, y, bodyPart });
    form.setValue("bodyPart", bodyPart);
    form.setValue("x", x);
    form.setValue("y", y);
    form.setValue("view", view);
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InjuryLogFormData) => {
    createLogMutation.mutate(data);
  };

  const filteredLogs = bodyMapLogs.filter(log => {
    if (filterStatus !== "all" && log.recoveryStatus !== filterStatus) return false;
    if (filterBodyPart !== "all" && log.bodyPart !== filterBodyPart) return false;
    return true;
  });

  const uniqueBodyParts = Array.from(new Set(bodyMapLogs.map(log => log.bodyPart)));

  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Body Part,Pain Level,Injury Type,Recovery Status,Notes\n"
      + filteredLogs.map(log => 
          `${new Date(log.createdAt!).toLocaleDateString()},${log.bodyPart},${log.painLevel},${log.injuryType},${log.recoveryStatus},"${log.notes || ''}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "injury_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-neutral-dark mb-4">Interactive Body Map</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Track pain points, log injuries, and monitor recovery progress with detailed analytics.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Body Map Interface */}
            <div className="lg:col-span-2">
              <Card className="bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Body Diagram</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={currentView === "front" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentView("front")}
                      >
                        <User className="h-4 w-4 mr-1" />
                        Front
                      </Button>
                      <Button
                        variant={currentView === "back" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentView("back")}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex justify-center mb-6">
                    <BodyDiagram 
                      view={currentView}
                      onBodyPartClick={handleBodyPartClick}
                      existingLogs={bodyMapLogs}
                    />
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center justify-center space-x-6 text-sm flex-wrap">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
                      <span>Severe (8-10)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                      <span>High (6-7)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#0cc9a9] rounded-full mr-2"></div>
                      <span>Moderate (4-5)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#0cc9a9] rounded-full mr-2"></div>
                      <span>Mild (2-3)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
                      <span>Minimal (1)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Injury Log Panel */}
            <div className="space-y-6">
              <Card className="bg-white shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Injuries</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredLogs.length > 0 ? (
                    <div className="space-y-3">
                      {filteredLogs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-medium">{log.bodyPart}</span>
                            <div className="text-sm text-gray-600">
                              Pain: {log.painLevel}/10 • {log.injuryType}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(log.createdAt!).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={log.recoveryStatus === 'recovered' ? 'default' : 
                                      log.recoveryStatus === 'recovering' ? 'secondary' : 'destructive'}
                            >
                              {log.recoveryStatus}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No injury logs recorded yet.</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Quick Stats */}
              <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">Injury Overview</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Active Issues:</span>
                      <span className="font-bold">
                        {bodyMapLogs.filter(log => log.recoveryStatus === 'acute').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recovering:</span>
                      <span className="font-bold">
                        {bodyMapLogs.filter(log => log.recoveryStatus === 'recovering').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Logs:</span>
                      <span className="font-bold">{bodyMapLogs.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Detailed Log Table */}
          <Card className="bg-white shadow-sm mt-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Injury Log History</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="acute">Acute</SelectItem>
                      <SelectItem value="recovering">Recovering</SelectItem>
                      <SelectItem value="recovered">Recovered</SelectItem>
                      <SelectItem value="chronic">Chronic</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterBodyPart} onValueChange={setFilterBodyPart}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by body part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Body Parts</SelectItem>
                      {uniqueBodyParts.map(part => (
                        <SelectItem key={part} value={part}>{part}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Body Part</th>
                        <th className="text-left py-2">Pain Level</th>
                        <th className="text-left py-2">Injury Type</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 text-sm">
                            {new Date(log.createdAt!).toLocaleDateString()}
                          </td>
                          <td className="py-3 font-medium">{log.bodyPart}</td>
                          <td className="py-3">
                            <div className="flex items-center space-x-2">
                              <span>{log.painLevel}/10</span>
                              <div className={`w-3 h-3 rounded-full ${
                                log.painLevel >= 8 ? 'bg-red-600' :
                                log.painLevel >= 6 ? 'bg-orange-500' :
                                log.painLevel >= 4 ? 'bg-[#0cc9a9]' :
                                log.painLevel >= 2 ? 'bg-[#0cc9a9]' : 'bg-green-600'
                              }`}></div>
                            </div>
                          </td>
                          <td className="py-3 capitalize">{log.injuryType}</td>
                          <td className="py-3">
                            <Badge 
                              variant={log.recoveryStatus === 'recovered' ? 'default' : 
                                      log.recoveryStatus === 'recovering' ? 'secondary' : 'destructive'}
                            >
                              {log.recoveryStatus}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm text-gray-600 max-w-xs truncate">
                            {log.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No injury logs match your filters.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Injury Log Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Injury / Pain Point</DialogTitle>
            <DialogDescription>
              Record details about your injury or pain point for tracking and analysis.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="bodyPart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Part</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="painLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pain Level: {field.value}/10</FormLabel>
                      <FormControl>
                        <input
                          type="range"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          max={10}
                          min={1}
                          step={1}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(field.value / 10) * 100}%, #e5e7eb ${(field.value / 10) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="injuryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Injury Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="strain">Strain</SelectItem>
                          <SelectItem value="sprain">Sprain</SelectItem>
                          <SelectItem value="tightness">Tightness</SelectItem>
                          <SelectItem value="tear">Tear</SelectItem>
                          <SelectItem value="inflammation">Inflammation</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="recoveryStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recovery Status</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="acute" id="acute" />
                          <Label htmlFor="acute">Acute</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="recovering" id="recovering" />
                          <Label htmlFor="recovering">Recovering</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="recovered" id="recovered" />
                          <Label htmlFor="recovered">Recovered</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="chronic" id="chronic" />
                          <Label htmlFor="chronic">Chronic</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe the injury, circumstances, or treatment..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLogMutation.isPending}
                >
                  {createLogMutation.isPending ? "Recording..." : "Record Injury"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}