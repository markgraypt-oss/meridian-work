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
import { Download, RotateCcw, User } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BodyMapLog } from "@shared/schema";
import BodyDiagram from "@/components/BodyDiagram";
import TopHeader from "@/components/TopHeader";

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

export default function BodyMapOld() {
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

  const { data: bodyMapLogs = [], isLoading: logsLoading, error } = useQuery<BodyMapLog[]>({
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

  if (isLoading || logsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading body map...</p>
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

  const exportToPDF = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Body Part,Pain Level,Injury Type,Recovery Status,Notes\n"
      + filteredLogs.map(log => 
          `${new Date(log.createdAt!).toLocaleDateString()},${log.bodyPart},${log.painLevel},${log.injuryType},${log.recoveryStatus},"${log.notes || ''}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "body_map_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPainColor = (painLevel: number) => {
    if (painLevel >= 7) return "bg-red-500";
    if (painLevel >= 4) return "bg-[#0cc9a9]";
    return "bg-green-500";
  };

  const getPainLabel = (painLevel: number) => {
    if (painLevel >= 7) return "High Pain";
    if (painLevel >= 4) return "Moderate";
    return "Mild";
  };

  const getRecoveryRecommendations = (bodyPart: string) => {
    const recommendations: Record<string, { title: string; description: string }> = {
      "Lower Back": {
        title: "Lower Back Protocol",
        description: "15-minute mobility routine focusing on hip flexors and glutes."
      },
      "Right Shoulder": {
        title: "Posture Correction",
        description: "Strengthen posterior chain with targeted exercises."
      },
      "Neck": {
        title: "Neck Relief",
        description: "Gentle stretches and strengthening for cervical spine."
      },
      "Knee": {
        title: "Knee Stability",
        description: "Quad and glute strengthening with mobility work."
      }
    };

    return recommendations[bodyPart] || {
      title: "General Recovery",
      description: "Rest, ice, and gentle movement as tolerated."
    };
  };

  const recentLogs = bodyMapLogs.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopHeader title="Body Map" />
      
      <section className="pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  <div className="flex items-center justify-center space-x-6 text-sm">
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
                      onClick={exportToPDF}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredLogs.length > 0 ? (
                    <div className="space-y-3">
                      {filteredLogs.slice(0, 5).map((log) => (
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
        </div>
      </section>

      {/* Pain Logging Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Log Pain Point</DialogTitle>
            <DialogDescription>
              Record details about your pain or injury for tracking and recovery monitoring.
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
              
              <FormField
                control={form.control}
                name="painLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pain Level (1-10)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pain level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            {level} - {level <= 3 ? 'Mild' : level <= 6 ? 'Moderate' : 'Severe'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Describe the pain, when it started, what triggers it..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLogMutation.isPending}>
                  {createLogMutation.isPending ? "Logging..." : "Log Pain Point"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
