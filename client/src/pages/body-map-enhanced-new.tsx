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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, User, RotateCcw } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BodyMapLog } from "@shared/schema";
import EnhancedBodyMap from "@/components/EnhancedBodyMap";
import { SeveritySlider } from "@/components/SeveritySlider";

const bodyPartSchema = z.object({
  bodyPart: z.string().min(1, "Body part is required"),
  severity: z.number().min(1).max(10),
  type: z.enum(["sore", "stiff"]),
  x: z.number(),
  y: z.number(),
  view: z.enum(["front", "back"]),
});

type BodyPartFormData = z.infer<typeof bodyPartSchema>;

export default function BodyMapEnhancedNew() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<"front" | "back">("front");
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; bodyPart: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBodyPart, setFilterBodyPart] = useState<string>("all");

  const form = useForm<BodyPartFormData>({
    resolver: zodResolver(bodyPartSchema),
    defaultValues: {
      bodyPart: "",
      severity: 5,
      type: "sore",
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

  const { data: bodyPartLogs = [], error } = useQuery<BodyMapLog[]>({
    queryKey: ["/api/body-map"],
    retry: false,
    enabled: isAuthenticated,
  });

  const createLogMutation = useMutation({
    mutationFn: async (data: BodyPartFormData) => {
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
        description: "Body status recorded successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to record body status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearBodyPartMutation = useMutation({
    mutationFn: async (bodyPart: string) => {
      const response = await fetch(`/api/body-map/${encodeURIComponent(bodyPart)}/${currentView}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to clear body part");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      toast({
        title: "Success",
        description: "Body part status cleared",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to clear body part status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BodyPartFormData) => {
    createLogMutation.mutate(data);
  };

  const handleBodyPartClick = (bodyPart: string, x: number, y: number, view: "front" | "back") => {
    setSelectedPoint({ x, y, bodyPart });
    form.setValue("bodyPart", bodyPart);
    form.setValue("x", x);
    form.setValue("y", y);
    form.setValue("view", view);
    setIsDialogOpen(true);
  };

  const handleClearBodyPart = (bodyPart: string) => {
    clearBodyPartMutation.mutate(bodyPart);
  };

  const exportToCSV = () => {
    if (bodyPartLogs.length === 0) {
      toast({
        title: "No Data",
        description: "No body map data to export",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = ["Date", "Body Part", "Severity", "Type", "View"];
    const csvData = bodyPartLogs.map(log => [
      new Date(log.createdAt!).toLocaleDateString(),
      log.bodyPart,
      log.severity,
      log.type,
      log.view
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `body-map-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle unauthorized error
  if (error && isUnauthorizedError(error as Error)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access the body map.</p>
          <Button onClick={() => window.location.href = "/api/login"}>
            Log In
          </Button>
        </div>
      </div>
    );
  }

  const currentViewLogs = bodyPartLogs.filter(log => log.view === currentView);
  const activeBodyParts = currentViewLogs.filter(log => log.severity >= 4);
  const uniqueBodyParts = bodyPartLogs.reduce((acc: string[], log) => {
    if (!acc.includes(log.bodyPart)) {
      acc.push(log.bodyPart);
    }
    return acc;
  }, []);

  const filteredLogs = bodyPartLogs.filter(log => {
    const statusMatch = filterStatus === "all" || 
      (filterStatus === "high" && log.severity >= 7) ||
      (filterStatus === "moderate" && log.severity >= 4 && log.severity < 7) ||
      (filterStatus === "mild" && log.severity < 4);
    
    const bodyPartMatch = filterBodyPart === "all" || log.bodyPart === filterBodyPart;
    
    return statusMatch && bodyPartMatch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Enhanced Interactive Body Map</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Advanced body mapping with sub-region targeting, diagnostic assessments, and personalized recommendations.
              Click on major body regions to zoom in and access detailed sub-areas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Enhanced Body Map */}
            <div className="lg:col-span-2">
              <Card className="bg-white shadow-sm h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      Interactive Body Map ({currentView})
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Button
                        variant={currentView === "front" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentView("front")}
                      >
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
                    <EnhancedBodyMap 
                      view={currentView}
                      onBodyPartClick={handleBodyPartClick}
                      existingLogs={bodyPartLogs}
                      onViewToggle={() => setCurrentView(currentView === "front" ? "back" : "front")}
                    />
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center justify-center space-x-6 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-600 rounded-full mr-2"></div>
                      <span>High (7-10)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-[#0cc9a9] rounded-full mr-2"></div>
                      <span>Moderate (4-6)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-600 rounded-full mr-2"></div>
                      <span>Mild (1-3)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Active Areas & Quick Actions */}
            <div className="space-y-6">
              <Card className="bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Active Areas ({currentView})</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeBodyParts.length > 0 ? (
                    <div className="space-y-3">
                      {activeBodyParts.map(log => (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-medium">{log.bodyPart}</span>
                            <div className="text-sm text-gray-600">
                              {log.type} • {log.severity}/10
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClearBodyPart(log.bodyPart)}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No high-priority areas marked. Click on body regions to add assessments.</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Quick Stats */}
              <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">Assessment Overview</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Areas Assessed:</span>
                      <span className="font-bold">{bodyPartLogs.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>High Priority:</span>
                      <span className="font-bold">
                        {bodyPartLogs.filter(log => log.severity >= 7).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Needs Attention:</span>
                      <span className="font-bold">
                        {bodyPartLogs.filter(log => log.severity >= 4 && log.severity < 7).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Export Button */}
              <Card className="bg-white shadow-sm">
                <CardContent className="p-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={exportToCSV}
                    disabled={bodyPartLogs.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Assessment Data
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Assessment History */}
          <Card className="bg-white shadow-sm mt-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assessment History</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="high">High (7-10)</SelectItem>
                      <SelectItem value="moderate">Moderate (4-6)</SelectItem>
                      <SelectItem value="mild">Mild (1-3)</SelectItem>
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
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Body Part
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(log.createdAt!).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {log.bodyPart}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <Badge variant={log.severity >= 7 ? 'destructive' : log.severity >= 4 ? 'secondary' : 'default'}>
                              {log.severity}/10
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {log.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {log.view}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No assessments match your filters.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Body Part Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How does your {form.watch("bodyPart")} feel?</DialogTitle>
            <DialogDescription>
              Record how this area is feeling today to track your wellness and get personalized recommendations.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="bodyPart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selected Area</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly className="bg-gray-50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How severe does it feel? ({field.value}/10)</FormLabel>
                    <FormControl>
                      <SeveritySlider
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="mt-2"
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      1-3: Mild • 4-6: Moderate • 7-10: High
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What type of discomfort?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sore">Sore (muscle fatigue, tenderness)</SelectItem>
                        <SelectItem value="stiff">Stiff (limited mobility, tight)</SelectItem>
                      </SelectContent>
                    </Select>
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
                  {createLogMutation.isPending ? "Saving..." : "Save Assessment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}