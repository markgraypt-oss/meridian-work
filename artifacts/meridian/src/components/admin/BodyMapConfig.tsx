import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Target, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BodyMapArea, BodyMapOutcome, BodyMapMovementOption } from "@shared/schema";

export function BodyMapConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  // Read state from URL params if present (for restoring after navigation)
  const urlParams = new URLSearchParams(window.location.search);
  const areaIdFromUrl = urlParams.get('areaId') ? parseInt(urlParams.get('areaId')!) : null;
  const innerTabFromUrl = urlParams.get('innerTab') || "areas";
  const [activeTab, setActiveTab] = useState(areaIdFromUrl ? innerTabFromUrl : "areas");
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(areaIdFromUrl);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);

  // Dialog states
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [showMovementOptionDialog, setShowMovementOptionDialog] = useState(false);
  const [outcomeDialogStep, setOutcomeDialogStep] = useState<1 | 2>(1);

  // Editing states
  const [editingArea, setEditingArea] = useState<BodyMapArea | null>(null);
  const [editingOutcome, setEditingOutcome] = useState<BodyMapOutcome | null>(null);
  const [editingMovementOption, setEditingMovementOption] = useState<BodyMapMovementOption | null>(null);

  // Outcome form states (needed because Radix Select doesn't work with FormData)
  const [outcomeFormPriority, setOutcomeFormPriority] = useState<string>("1");
  const [outcomeFormSeverityMin, setOutcomeFormSeverityMin] = useState<string>("0");
  const [outcomeFormSeverityMax, setOutcomeFormSeverityMax] = useState<string>("10");
  const [outcomeFormTrainingImpact, setOutcomeFormTrainingImpact] = useState<string>("normal");
  const [outcomeFormMovementImpact, setOutcomeFormMovementImpact] = useState<string>(""); // Movement Question answer
  const [outcomeFormTriggersFollowUp, setOutcomeFormTriggersFollowUp] = useState<boolean>(false);
  const [outcomeFormFollowUpQuestion, setOutcomeFormFollowUpQuestion] = useState<string>("Which movements cause discomfort?");
  const [outcomeFormFollowUpAnswers, setOutcomeFormFollowUpAnswers] = useState<{ value: string; label: string; orderIndex: number }[]>([]);
  const [outcomeFormShowProgrammeImpact, setOutcomeFormShowProgrammeImpact] = useState<boolean>(false);

  // Fixed Movement Question - not editable, always the same
  const FIXED_MOVEMENT_QUESTION = "Does this limit how you move?";
  const FIXED_MOVEMENT_OPTIONS = [
    { id: "none", label: "No, movement feels normal" },
    { id: "slight", label: "A little restricted" },
    { id: "significant", label: "Yes, it limits movement" },
  ];

  // Fetch areas
  const { data: areas = [] } = useQuery<BodyMapArea[]>({
    queryKey: ["/api/body-map-config/areas"],
  });

  // Auto-select first area when areas load and no area is selected
  useEffect(() => {
    if (areas.length > 0 && !selectedAreaId) {
      setSelectedAreaId(areas[0].id);
    }
    // If selected area was deleted, select first available
    if (selectedAreaId && areas.length > 0 && !areas.find(a => a.id === selectedAreaId)) {
      setSelectedAreaId(areas[0].id);
    }
  }, [areas, selectedAreaId]);

  // Fetch outcomes for selected area
  const { data: outcomes = [] } = useQuery<BodyMapOutcome[]>({
    queryKey: [`/api/body-map-config/areas/${selectedAreaId}/outcomes`],
    enabled: !!selectedAreaId,
  });

  // Fetch movement options for selected area
  const { data: movementOptions = [] } = useQuery<BodyMapMovementOption[]>({
    queryKey: ['/api/body-map-config/areas', selectedAreaId, 'movement-options'],
    enabled: !!selectedAreaId,
  });

  // Area mutations
  const createAreaMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/body-map-config/areas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/areas"] });
      setShowAreaDialog(false);
      toast({ title: "Success", description: "Body area created successfully" });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/body-map-config/areas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/areas"] });
      setShowAreaDialog(false);
      setEditingArea(null);
      toast({ title: "Success", description: "Body area updated successfully" });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/body-map-config/areas/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/areas"] });
      if (selectedAreaId) setSelectedAreaId(null);
      toast({ title: "Success", description: "Body area deleted successfully" });
    },
  });

  // Outcome mutations
  const createOutcomeMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/body-map-config/outcomes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/body-map-config/areas/${selectedAreaId}/outcomes`] });
      setShowOutcomeDialog(false);
      toast({ title: "Success", description: "Outcome created successfully" });
    },
  });

  const updateOutcomeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/body-map-config/outcomes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/body-map-config/areas/${selectedAreaId}/outcomes`] });
      setShowOutcomeDialog(false);
      setEditingOutcome(null);
      toast({ title: "Success", description: "Outcome updated successfully" });
    },
  });

  const deleteOutcomeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/body-map-config/outcomes/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/body-map-config/areas/${selectedAreaId}/outcomes`] });
      toast({ title: "Success", description: "Outcome deleted successfully" });
    },
  });

  // Movement option mutations
  const createMovementOptionMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/body-map-config/movement-options", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/body-map-config/areas', selectedAreaId, 'movement-options'] });
      setShowMovementOptionDialog(false);
      toast({ title: "Success", description: "Movement option created successfully" });
    },
  });

  const updateMovementOptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/body-map-config/movement-options/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/body-map-config/areas', selectedAreaId, 'movement-options'] });
      setShowMovementOptionDialog(false);
      setEditingMovementOption(null);
      toast({ title: "Success", description: "Movement option updated successfully" });
    },
  });

  const deleteMovementOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/body-map-config/movement-options/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/body-map-config/areas', selectedAreaId, 'movement-options'] });
      toast({ title: "Success", description: "Movement option deleted successfully" });
    },
  });

  // Helper to initialize outcome form state
  const initOutcomeForm = (outcome: BodyMapOutcome | null) => {
    if (outcome) {
      setOutcomeFormPriority(outcome.priority?.toString() || "1");
      setOutcomeFormSeverityMin(outcome.severityMin?.toString() || "0");
      setOutcomeFormSeverityMax(outcome.severityMax?.toString() || "10");
      setOutcomeFormTrainingImpact(outcome.trainingImpact || "normal");
      setOutcomeFormMovementImpact(outcome.movementImpact || "");
      setOutcomeFormTriggersFollowUp(outcome.triggersFollowUp || false);
      setOutcomeFormFollowUpQuestion(outcome.followUpQuestion || "Which movements cause discomfort?");
      const answers = outcome.followUpAnswers as { value: string; label: string; orderIndex: number }[] | null;
      setOutcomeFormFollowUpAnswers(answers || []);
      setOutcomeFormShowProgrammeImpact(outcome.showProgrammeImpact || false);
    } else {
      setOutcomeFormPriority("1");
      setOutcomeFormSeverityMin("0");
      setOutcomeFormSeverityMax("10");
      setOutcomeFormTrainingImpact("normal");
      setOutcomeFormMovementImpact("");
      setOutcomeFormTriggersFollowUp(false);
      setOutcomeFormFollowUpQuestion("Which movements cause discomfort?");
      setOutcomeFormFollowUpAnswers([]);
      setOutcomeFormShowProgrammeImpact(false);
    }
  };

  // Form handlers
  const handleAreaSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      displayName: formData.get("displayName") as string,
      category: formData.get("category") as string,
      description: formData.get("description") as string || null,
      orderIndex: parseInt(formData.get("orderIndex") as string) || 0,
      isActive: true,
    };

    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, data });
    } else {
      createAreaMutation.mutate(data);
    }
  };

  const handleOutcomeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      bodyAreaId: selectedAreaId!,
      name: formData.get("name") as string,
      displayName: formData.get("displayName") as string,
      priority: parseInt(outcomeFormPriority) || 1,
      isActive: true,
      severityMin: parseInt(outcomeFormSeverityMin),
      severityMax: parseInt(outcomeFormSeverityMax),
      trainingImpact: outcomeFormTrainingImpact,
      movementImpact: outcomeFormMovementImpact || null,
      triggersFollowUp: outcomeFormTriggersFollowUp,
      followUpQuestion: outcomeFormTriggersFollowUp ? outcomeFormFollowUpQuestion : null,
      followUpAnswers: outcomeFormTriggersFollowUp ? outcomeFormFollowUpAnswers : null,
      showProgrammeImpact: outcomeFormShowProgrammeImpact,
      whatsGoingOn: formData.get("whatsGoingOn") as string || null,
      trainingGuidance: formData.get("trainingGuidance") as string || null,
      dailyMovement: formData.get("dailyMovement") as string || null,
      deskWorkTips: formData.get("deskWorkTips") as string || null,
      thingsToWatch: formData.get("thingsToWatch") as string || null,
      checkInAgain: formData.get("checkInAgain") as string || null,
    };

    if (editingOutcome) {
      updateOutcomeMutation.mutate({ id: editingOutcome.id, data });
    } else {
      createOutcomeMutation.mutate(data);
    }
  };

  const handleMovementOptionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      bodyAreaId: selectedAreaId!,
      value: formData.get("value") as string,
      label: formData.get("label") as string,
      orderIndex: parseInt(formData.get("orderIndex") as string) || 0,
      isActive: true,
    };

    if (editingMovementOption) {
      updateMovementOptionMutation.mutate({ id: editingMovementOption.id, data });
    } else {
      createMovementOptionMutation.mutate(data);
    }
  };

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Body Map Configuration</CardTitle>
        <CardDescription>
          Define coaching scenarios and guidance for body assessments. Select a body area to configure its outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="areas" data-testid="tab-areas">
              <Settings className="h-4 w-4 mr-2" />
              Areas
            </TabsTrigger>
            <TabsTrigger value="outcomes" data-testid="tab-outcomes" disabled={!selectedAreaId}>
              <Target className="h-4 w-4 mr-2" />
              Outcomes
            </TabsTrigger>
          </TabsList>

          {/* Areas Tab */}
          <TabsContent value="areas" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Body Areas ({areas.length} configured)</h3>
              <Button onClick={() => { setEditingArea(null); setShowAreaDialog(true); }} data-testid="button-add-area">
                <Plus className="h-4 w-4 mr-2" />
                Add Area
              </Button>
            </div>
            
            <div className="grid gap-2">
              {areas.sort((a, b) => a.orderIndex - b.orderIndex).map((area) => (
                <Card key={area.id} className={selectedAreaId === area.id ? "border-primary bg-primary/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div 
                        className="flex-1 cursor-pointer" 
                        onClick={() => {
                          setSelectedAreaId(area.id);
                          setActiveTab("outcomes");
                        }}
                      >
                        <h4 className="font-semibold">{area.displayName}</h4>
                        <p className="text-sm text-muted-foreground">{area.name} - {area.category}</p>
                        {area.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{area.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingArea(area); setShowAreaDialog(true); }} data-testid={`button-edit-area-${area.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAreaMutation.mutate(area.id)} data-testid={`button-delete-area-${area.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {areas.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No body areas configured. Add an area to get started.</p>
            )}
          </TabsContent>

          {/* Outcomes Tab - THE PRIMARY SECTION */}
          <TabsContent value="outcomes" className="space-y-4">
            {!selectedArea ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Select a body area from the Areas tab to configure outcomes.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Outcomes for {selectedArea?.displayName}</h3>
                    <p className="text-sm text-muted-foreground">
                      Define coaching scenarios users can land in based on their assessment answers
                    </p>
                  </div>
                  <Button onClick={() => navigate(`/admin/outcome-editor/new?areaId=${selectedAreaId}&returnUrl=${encodeURIComponent(`/admin?tab=body-map&areaId=${selectedAreaId}&innerTab=outcomes`)}`)} data-testid="button-add-outcome">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Outcome
                  </Button>
                </div>

            <div className="grid gap-3">
              {outcomes.sort((a, b) => b.priority - a.priority).map((outcome) => (
                <Card 
                  key={outcome.id} 
                  className={selectedOutcomeId === outcome.id ? "border-primary" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedOutcomeId(outcome.id === selectedOutcomeId ? null : outcome.id)}>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{outcome.displayName}</h4>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Priority: {outcome.priority}</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{outcome.name}</p>
                        
                        {/* Conditions summary */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(outcome.severityMin !== null || outcome.severityMax !== null) && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                              Severity: {outcome.severityMin ?? "Any"} - {outcome.severityMax ?? "Any"}
                            </span>
                          )}
                          {outcome.trainingImpact && (
                            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                              Training: {outcome.trainingImpact}
                            </span>
                          )}
                          {outcome.movementImpact && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                              Movement: {outcome.movementImpact}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/outcome-editor/${outcome.id}?returnUrl=${encodeURIComponent(`/admin?tab=body-map&areaId=${selectedAreaId}&innerTab=outcomes`)}`)} data-testid={`button-edit-outcome-${outcome.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteOutcomeMutation.mutate(outcome.id)} data-testid={`button-delete-outcome-${outcome.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content view */}
                    {selectedOutcomeId === outcome.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <h5 className="font-medium text-sm">Content Fields:</h5>
                        <div className="grid gap-2 text-sm">
                          {outcome.whatsGoingOn && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">What's going on:</span>
                              <p className="text-muted-foreground">{outcome.whatsGoingOn}</p>
                            </div>
                          )}
                          {outcome.trainingGuidance && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">Training guidance:</span>
                              <p className="text-muted-foreground">{outcome.trainingGuidance}</p>
                            </div>
                          )}
                          {outcome.dailyMovement && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">Daily movement:</span>
                              <p className="text-muted-foreground">{outcome.dailyMovement}</p>
                            </div>
                          )}
                          {outcome.deskWorkTips && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">Desk and work tips:</span>
                              <p className="text-muted-foreground">{outcome.deskWorkTips}</p>
                            </div>
                          )}
                          {outcome.thingsToWatch && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">Things to watch:</span>
                              <p className="text-muted-foreground">{outcome.thingsToWatch}</p>
                            </div>
                          )}
                          {outcome.checkInAgain && (
                            <div className="bg-muted p-2 rounded">
                              <span className="font-medium">When to check in again:</span>
                              <p className="text-muted-foreground">{outcome.checkInAgain}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {outcomes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No outcomes defined for this area. Add outcomes to define coaching scenarios.
              </p>
            )}
              </>
            )}
          </TabsContent>


        </Tabs>

        {/* Area Dialog */}
        <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingArea ? "Edit" : "Add"} Body Area</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAreaSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Internal Name</Label>
                <Input id="name" name="name" defaultValue={editingArea?.name} required data-testid="input-area-name" />
                <p className="text-xs text-muted-foreground mt-1">Used for internal reference (e.g., neck, shoulder)</p>
              </div>
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" name="displayName" defaultValue={editingArea?.displayName} required data-testid="input-area-display-name" />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue={editingArea?.category || "upper_body"}>
                  <SelectTrigger data-testid="select-area-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upper_body">Upper Body</SelectItem>
                    <SelectItem value="lower_body">Lower Body</SelectItem>
                    <SelectItem value="core">Core</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={editingArea?.description || ""} rows={3} data-testid="input-area-description" />
              </div>
              <div>
                <Label htmlFor="orderIndex">Order</Label>
                <Input id="orderIndex" name="orderIndex" type="number" defaultValue={editingArea?.orderIndex || 0} data-testid="input-area-order" />
              </div>

              <Button type="submit" className="w-full" data-testid="button-save-area">
                {editingArea ? "Update" : "Create"} Area
              </Button>
            </form>
          </DialogContent>
        </Dialog>


        {/* Outcome Dialog - THE PRIMARY DIALOG */}
        <Dialog open={showOutcomeDialog} onOpenChange={(open) => {
          setShowOutcomeDialog(open);
          if (!open) setOutcomeDialogStep(1);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOutcome ? "Edit" : "Add"} Outcome - Step {outcomeDialogStep} of 2</DialogTitle>
            </DialogHeader>
            
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                outcomeDialogStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>1</div>
              <div className="flex-1 h-1 bg-muted rounded">
                <div className={`h-full bg-primary rounded transition-all ${outcomeDialogStep === 2 ? "w-full" : "w-0"}`} />
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                outcomeDialogStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>2</div>
            </div>

            <form onSubmit={handleOutcomeSubmit} className="space-y-6">
              {/* Step 1: Basic Info + Conditions */}
              {outcomeDialogStep === 1 && (
                <>
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Internal Name</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      defaultValue={editingOutcome?.name} 
                      placeholder="e.g., shoulder_manageable"
                      required 
                      data-testid="input-outcome-name" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used internally, never shown to users</p>
                  </div>
                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input 
                      id="displayName" 
                      name="displayName" 
                      defaultValue={editingOutcome?.displayName} 
                      placeholder="e.g., Manageable Shoulder Discomfort"
                      required 
                      data-testid="input-outcome-display-name" 
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={outcomeFormPriority} onValueChange={setOutcomeFormPriority}>
                    <SelectTrigger data-testid="select-outcome-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Low</SelectItem>
                      <SelectItem value="2">2 - Medium</SelectItem>
                      <SelectItem value="3">3 - High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Higher priority outcomes are matched first when multiple match</p>
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <h4 className="font-semibold border-b pb-2">Conditions (all must match)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="severityMin">Severity Min</Label>
                    <Select value={outcomeFormSeverityMin} onValueChange={setOutcomeFormSeverityMin}>
                      <SelectTrigger data-testid="select-outcome-severity-min">
                        <SelectValue placeholder="Select min" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="severityMax">Severity Max</Label>
                    <Select value={outcomeFormSeverityMax} onValueChange={setOutcomeFormSeverityMax}>
                      <SelectTrigger data-testid="select-outcome-severity-max">
                        <SelectValue placeholder="Select max" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="trainingImpact">Training Impact</Label>
                  <Select 
                    value={outcomeFormTrainingImpact} 
                    onValueChange={(value) => {
                      setOutcomeFormTrainingImpact(value);
                      if (value === "limited" || value === "cannot_train") {
                        setOutcomeFormTriggersFollowUp(true);
                      } else {
                        setOutcomeFormTriggersFollowUp(false);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-outcome-training">
                      <SelectValue placeholder="Select impact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal - Can train as usual</SelectItem>
                      <SelectItem value="limited">Limited - Some movements uncomfortable</SelectItem>
                      <SelectItem value="cannot_train">Cannot Train - Unable to train normally</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Follow-up Question Editor - auto-shown when training impact is limited or cannot_train */}
                {(outcomeFormTrainingImpact === "limited" || outcomeFormTrainingImpact === "cannot_train") && (
                  <div className="p-4 rounded-md border bg-muted/20 space-y-4">
                    <div className="pb-2 border-b">
                      <h4 className="font-medium text-sm">Follow-up Question (2b)</h4>
                      <p className="text-xs text-muted-foreground">Configure the question shown when movement is affected</p>
                    </div>
                    <div>
                      <Label htmlFor="followUpQuestion">Question Text</Label>
                      <Input 
                        id="followUpQuestion"
                        value={outcomeFormFollowUpQuestion}
                        onChange={(e) => setOutcomeFormFollowUpQuestion(e.target.value)}
                        placeholder="Which movements cause discomfort?"
                        data-testid="input-outcome-followup-question"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label>Answer Options (multiple choice)</Label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const newAnswer = { 
                              value: `answer_${Date.now()}`, 
                              label: "", 
                              orderIndex: outcomeFormFollowUpAnswers.length 
                            };
                            setOutcomeFormFollowUpAnswers([...outcomeFormFollowUpAnswers, newAnswer]);
                          }}
                          data-testid="button-add-followup-answer"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Answer
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        {outcomeFormFollowUpAnswers.map((answer, index) => (
                          <div key={answer.value} className="flex gap-2 items-center">
                            <Input 
                              value={answer.label}
                              onChange={(e) => {
                                const updated = [...outcomeFormFollowUpAnswers];
                                updated[index] = { ...answer, label: e.target.value };
                                setOutcomeFormFollowUpAnswers(updated);
                              }}
                              placeholder={`Answer ${index + 1} (e.g., Squatting, Walking stairs)`}
                              className="flex-1"
                              data-testid={`input-followup-answer-${index}`}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                const updated = outcomeFormFollowUpAnswers.filter((_, i) => i !== index);
                                setOutcomeFormFollowUpAnswers(updated.map((a, i) => ({ ...a, orderIndex: i })));
                              }}
                              data-testid={`button-remove-followup-answer-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {outcomeFormFollowUpAnswers.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No answers yet. Add some answer options for the follow-up question.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Movement Question (Question 2) - Select the answer that triggers this outcome */}
                <div>
                  <Label htmlFor="movementImpact">Movement Question: {FIXED_MOVEMENT_QUESTION}</Label>
                  <Select 
                    value={outcomeFormMovementImpact} 
                    onValueChange={setOutcomeFormMovementImpact}
                  >
                    <SelectTrigger data-testid="select-outcome-movement">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIXED_MOVEMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Programme Impact Toggle */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="showProgrammeImpact" className="text-sm font-medium">Show Programme Impact</Label>
                    <p className="text-xs text-muted-foreground">
                      Display the Programme Impact section on results page when this outcome matches
                    </p>
                  </div>
                  <Switch
                    id="showProgrammeImpact"
                    checked={outcomeFormShowProgrammeImpact}
                    onCheckedChange={setOutcomeFormShowProgrammeImpact}
                    data-testid="switch-show-programme-impact"
                  />
                </div>
              </div>

              {/* Continue to Step 2 */}
              <Button 
                type="button" 
                className="w-full" 
                onClick={() => setOutcomeDialogStep(2)}
                data-testid="button-outcome-continue"
              >
                Continue to Content
              </Button>
                </>
              )}

              {/* Step 2: Content Fields */}
              {outcomeDialogStep === 2 && (
                <>
              <div className="space-y-4">
                <h4 className="font-semibold border-b pb-2">Content (shown to users)</h4>
                
                <div>
                  <Label htmlFor="whatsGoingOn">What's going on</Label>
                  <Textarea 
                    id="whatsGoingOn" 
                    name="whatsGoingOn" 
                    defaultValue={editingOutcome?.whatsGoingOn || ""} 
                    rows={3}
                    placeholder="Explain the situation in simple terms..."
                    data-testid="input-outcome-whats-going-on" 
                  />
                </div>

                <div>
                  <Label htmlFor="trainingGuidance">Training guidance</Label>
                  <Textarea 
                    id="trainingGuidance" 
                    name="trainingGuidance" 
                    defaultValue={editingOutcome?.trainingGuidance || ""} 
                    rows={3}
                    placeholder="How should they approach training..."
                    data-testid="input-outcome-training-guidance" 
                  />
                </div>

                <div>
                  <Label htmlFor="dailyMovement">Daily movement</Label>
                  <Textarea 
                    id="dailyMovement" 
                    name="dailyMovement" 
                    defaultValue={editingOutcome?.dailyMovement || ""} 
                    rows={3}
                    placeholder="Movement recommendations for daily life..."
                    data-testid="input-outcome-daily-movement" 
                  />
                </div>

                <div>
                  <Label htmlFor="deskWorkTips">Desk and work tips</Label>
                  <Textarea 
                    id="deskWorkTips" 
                    name="deskWorkTips" 
                    defaultValue={editingOutcome?.deskWorkTips || ""} 
                    rows={3}
                    placeholder="Tips for working at a desk..."
                    data-testid="input-outcome-desk-tips" 
                  />
                </div>

                <div>
                  <Label htmlFor="thingsToWatch">Things to watch</Label>
                  <Textarea 
                    id="thingsToWatch" 
                    name="thingsToWatch" 
                    defaultValue={editingOutcome?.thingsToWatch || ""} 
                    rows={3}
                    placeholder="Warning signs to monitor..."
                    data-testid="input-outcome-things-to-watch" 
                  />
                </div>

                <div>
                  <Label htmlFor="checkInAgain">When to check in again</Label>
                  <Textarea 
                    id="checkInAgain" 
                    name="checkInAgain" 
                    defaultValue={editingOutcome?.checkInAgain || ""} 
                    rows={2}
                    placeholder="When should they reassess..."
                    data-testid="input-outcome-check-in" 
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setOutcomeDialogStep(1)}
                  data-testid="button-outcome-back"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" data-testid="button-save-outcome">
                  {editingOutcome ? "Update" : "Create"} Outcome
                </Button>
              </div>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Movement Option Dialog */}
        <Dialog open={showMovementOptionDialog} onOpenChange={setShowMovementOptionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingMovementOption ? "Edit" : "Add"} Movement Option</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMovementOptionSubmit} className="space-y-4">
              <div>
                <Label htmlFor="value">Value (internal identifier)</Label>
                <Input 
                  id="value" 
                  name="value" 
                  defaultValue={editingMovementOption?.value || ""} 
                  placeholder="e.g., squatting, climbing_stairs"
                  required
                  data-testid="input-movement-option-value"
                />
                <p className="text-xs text-muted-foreground mt-1">Use lowercase with underscores, no spaces</p>
              </div>
              <div>
                <Label htmlFor="label">Label (displayed to users)</Label>
                <Input 
                  id="label" 
                  name="label" 
                  defaultValue={editingMovementOption?.label || ""} 
                  placeholder="e.g., Squatting, Climbing stairs"
                  required
                  data-testid="input-movement-option-label"
                />
              </div>
              <div>
                <Label htmlFor="orderIndex">Order Index</Label>
                <Input 
                  id="orderIndex" 
                  name="orderIndex" 
                  type="number"
                  defaultValue={editingMovementOption?.orderIndex || 0} 
                  data-testid="input-movement-option-order"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-save-movement-option">
                {editingMovementOption ? "Update" : "Create"} Movement Option
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
