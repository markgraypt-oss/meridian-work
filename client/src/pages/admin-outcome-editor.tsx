import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Plus, Trash2, Search, X, GripVertical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BodyMapOutcome, ExerciseLibraryItem, Program } from "@shared/schema";
import { MAIN_MUSCLE_OPTIONS, EQUIPMENT_OPTIONS, MOVEMENT_OPTIONS, MOVEMENT_PATTERN_OPTIONS, MOVEMENT_TYPE_OPTIONS, MECHANICS_OPTIONS, LEVEL_OPTIONS } from "@/components/admin/exerciseFilterConstants";
import { getMovementOptionsForArea } from "@shared/bodyMapDefaults";

type BodyMapArea = {
  id: number;
  name: string;
  displayName: string;
};

// Type for substitution pool (single pool per outcome)
type SubstitutionPool = {
  allowedPatterns: string[];
  substituteExerciseIds: number[];
  coachingNote: string;
};

export default function AdminOutcomeEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  // Parse ID from URL path: /admin/outcome-editor/5 or /admin/outcome-editor/new
  // Use window.location.pathname directly for reliability
  const pathname = window.location.pathname;
  const pathSegments = pathname.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  const outcomeId = lastSegment && lastSegment !== "new" && !isNaN(parseInt(lastSegment)) ? parseInt(lastSegment) : null;
  const isEditing = outcomeId !== null;
  
  const [step, setStep] = useState<1 | 2>(1);
  
  // Get areaId and returnUrl from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const areaId = urlParams.get('areaId') ? parseInt(urlParams.get('areaId')!) : null;
  const returnUrl = urlParams.get('returnUrl') || '/admin';

  const handleBack = () => {
    navigate(returnUrl);
  };

  // Form state
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPriority, setFormPriority] = useState("1");
  const [formSeverityMin, setFormSeverityMin] = useState("0");
  const [formSeverityMax, setFormSeverityMax] = useState("10");
  const [formTrainingImpact, setFormTrainingImpact] = useState("normal");
  const [formMovementImpact, setFormMovementImpact] = useState("");
  const [formTriggersFollowUp, setFormTriggersFollowUp] = useState(false);
  const [formFollowUpQuestion, setFormFollowUpQuestion] = useState("Which movements cause discomfort?");
  const [formFollowUpAnswers, setFormFollowUpAnswers] = useState<{ value: string; label: string; orderIndex: number }[]>([]);
  
  // Content fields
  const [formWhatsGoingOn, setFormWhatsGoingOn] = useState("");
  const [formTrainingGuidance, setFormTrainingGuidance] = useState("");
  const [formDailyMovement, setFormDailyMovement] = useState("");
  const [formDeskWorkTips, setFormDeskWorkTips] = useState("");
  const [formThingsToWatch, setFormThingsToWatch] = useState("");
  const [formCheckInAgain, setFormCheckInAgain] = useState(""); // Legacy - kept for backwards compatibility
  const [formReassessInDays, setFormReassessInDays] = useState<number | null>(null); // 1-30 days for reassessment reminder

  // Programme Impact fields (Step 2 bottom)
  const [formShowProgrammeImpact, setFormShowProgrammeImpact] = useState(false);
  const [formProgrammeImpactSummary, setFormProgrammeImpactSummary] = useState("");
  const [formFlaggingMovementPatterns, setFormFlaggingMovementPatterns] = useState<string[]>([]);
  const [formFlaggingEquipment, setFormFlaggingEquipment] = useState<string[]>([]);
  const [formFlaggingLevel, setFormFlaggingLevel] = useState<string[]>([]);
  const [formFlaggingMechanics, setFormFlaggingMechanics] = useState<string[]>([]);
  const [formFlaggingMuscles, setFormFlaggingMuscles] = useState<string[]>([]);
  const [formFlaggingExcludeTags, setFormFlaggingExcludeTags] = useState<string[]>([]);
  const [formFlaggingNote, setFormFlaggingNote] = useState("");
  // Single substitution pool (replaces multi-rule structure)
  const [formSubstitutionAllowedPatterns, setFormSubstitutionAllowedPatterns] = useState<string[]>([]);
  const [formSubstitutionExerciseIds, setFormSubstitutionExerciseIds] = useState<number[]>([]);
  const [formSubstitutionCoachingNote, setFormSubstitutionCoachingNote] = useState("");
  const [formRecommendRecoveryProgramme, setFormRecommendRecoveryProgramme] = useState(false);
  const [formRecoveryProgrammeId, setFormRecoveryProgrammeId] = useState<number | null>(null);
  const [formRecoveryProgrammeReason, setFormRecoveryProgrammeReason] = useState("");
  const [formRestoreOnReassessment, setFormRestoreOnReassessment] = useState(true);
  
  // Exercise picker state with filters
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseFilters, setExerciseFilters] = useState<{
    movementPattern: string[];
    movementType: string[];
    mainMuscle: string[];
    equipment: string[];
    level: string[];
    mechanics: string[];
  }>({
    movementPattern: [],
    movementType: [],
    mainMuscle: [],
    equipment: [],
    level: [],
    mechanics: [],
  });
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  
  // Drag and drop state for substitute exercises reordering
  const [draggedExerciseId, setDraggedExerciseId] = useState<number | null>(null);

  // Fixed Movement Question options
  const FIXED_MOVEMENT_OPTIONS = [
    { id: "none", label: "No, movement feels normal" },
    { id: "slight", label: "A little restricted" },
    { id: "significant", label: "Yes, it limits movement" },
  ];

  // Fetch existing outcome if editing
  const { data: outcome, isLoading } = useQuery<BodyMapOutcome>({
    queryKey: ["/api/body-map-config/outcomes", outcomeId],
    queryFn: async () => {
      const res = await fetch(`/api/body-map-config/outcomes/${outcomeId}`);
      if (!res.ok) throw new Error("Failed to fetch outcome");
      return res.json();
    },
    enabled: isEditing && outcomeId !== null,
  });

  // Fetch exercises for substitution rule picker
  const { data: exercises = [] } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
  });

  // Fetch recovery programmes (filtered to recovery type)
  const { data: allPrograms = [] } = useQuery<Program[]>({
    queryKey: ["/api/programs"],
  });
  const recoveryPrograms = allPrograms.filter(p => p.sourceType === "recovery" || p.goal === "recovery");

  // Fetch body map areas to get the current area's name
  const { data: bodyMapAreas = [] } = useQuery<BodyMapArea[]>({
    queryKey: ["/api/body-map-config/areas"],
  });

  // Get current body area (from areaId param or from loaded outcome)
  const currentAreaId = areaId || outcome?.bodyAreaId;
  const currentArea = bodyMapAreas.find(a => a.id === currentAreaId);
  const availableMovementOptions = currentArea ? getMovementOptionsForArea(currentArea.name) : [];

  // Populate form when outcome loads
  useEffect(() => {
    if (outcome) {
      setFormName(outcome.name);
      setFormDisplayName(outcome.displayName || "");
      setFormPriority(outcome.priority?.toString() || "1");
      setFormSeverityMin(outcome.severityMin?.toString() || "0");
      setFormSeverityMax(outcome.severityMax?.toString() || "10");
      setFormTrainingImpact(outcome.trainingImpact || "normal");
      setFormMovementImpact(outcome.movementImpact || "");
      setFormTriggersFollowUp(outcome.triggersFollowUp || false);
      setFormFollowUpQuestion(outcome.followUpQuestion || "Which movements cause discomfort?");
      // Filter out legacy answers that don't match current catalogue options
      const storedAnswers = outcome.followUpAnswers as any[] || [];
      const validAnswers = storedAnswers.filter(a => 
        availableMovementOptions.some(opt => opt.id === a.value)
      );
      setFormFollowUpAnswers(validAnswers);
      setFormWhatsGoingOn(outcome.whatsGoingOn || "");
      setFormTrainingGuidance(outcome.trainingGuidance || "");
      setFormDailyMovement(outcome.dailyMovement || "");
      setFormDeskWorkTips(outcome.deskWorkTips || "");
      setFormThingsToWatch(outcome.thingsToWatch || "");
      setFormCheckInAgain(outcome.checkInAgain || ""); // Legacy field
      setFormReassessInDays(outcome.reassessInDays ?? null); // New reassessment reminder field
      // Programme Impact fields
      setFormShowProgrammeImpact(outcome.showProgrammeImpact || false);
      setFormProgrammeImpactSummary(outcome.programmeImpactSummary || "");
      setFormFlaggingMovementPatterns(outcome.flaggingMovementPatterns || []);
      setFormFlaggingEquipment(outcome.flaggingEquipment || []);
      setFormFlaggingLevel(outcome.flaggingLevel || []);
      setFormFlaggingMechanics(outcome.flaggingMechanics || []);
      setFormFlaggingMuscles(outcome.flaggingMuscles || []);
      setFormFlaggingExcludeTags(outcome.flaggingExcludeTags || []);
      setFormFlaggingNote(outcome.flaggingNote || "");
      // Load substitution pool from legacy rules array or new pool structure
      const storedPool = outcome.substitutionRules as SubstitutionPool | SubstitutionPool[] | null;
      if (storedPool) {
        if (Array.isArray(storedPool) && storedPool.length > 0) {
          // Legacy: merge ALL rules into single pool (union of patterns, exercises, concatenate notes)
          const mergedPatterns = new Set<string>();
          const mergedExerciseIds = new Set<number>();
          const coachingNotes: string[] = [];
          
          storedPool.forEach(rule => {
            (rule.allowedPatterns || []).forEach(p => mergedPatterns.add(p));
            (rule.substituteExerciseIds || []).forEach(id => mergedExerciseIds.add(id));
            if (rule.coachingNote) coachingNotes.push(rule.coachingNote);
          });
          
          setFormSubstitutionAllowedPatterns(Array.from(mergedPatterns));
          setFormSubstitutionExerciseIds(Array.from(mergedExerciseIds));
          setFormSubstitutionCoachingNote(coachingNotes.join(" | "));
        } else if (!Array.isArray(storedPool)) {
          // New structure: single pool object
          setFormSubstitutionAllowedPatterns(storedPool.allowedPatterns || []);
          setFormSubstitutionExerciseIds(storedPool.substituteExerciseIds || []);
          setFormSubstitutionCoachingNote(storedPool.coachingNote || "");
        }
      }
      setFormRecommendRecoveryProgramme(outcome.recommendRecoveryProgramme || false);
      setFormRecoveryProgrammeId(outcome.recoveryProgrammeId || null);
      setFormRecoveryProgrammeReason(outcome.recoveryProgrammeReason || "");
      setFormRestoreOnReassessment(outcome.restoreOnReassessment ?? true);
    }
  }, [outcome, availableMovementOptions]);

  // Auto-enable triggersFollowUp when training impact is limited or cannot_train
  useEffect(() => {
    if (formTrainingImpact === "limited" || formTrainingImpact === "cannot_train") {
      setFormTriggersFollowUp(true);
    } else {
      setFormTriggersFollowUp(false);
    }
  }, [formTrainingImpact]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/body-map-config/outcomes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/outcomes"] });
      toast({ title: "Outcome created successfully" });
      navigate("/admin");
    },
    onError: (error: any) => {
      toast({ title: "Error creating outcome", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/body-map-config/outcomes/${outcomeId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/outcomes"] });
      toast({ title: "Outcome updated successfully" });
      navigate("/admin");
    },
    onError: (error: any) => {
      toast({ title: "Error updating outcome", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const data = {
      bodyAreaId: areaId || outcome?.bodyAreaId,
      name: formName,
      displayName: formDisplayName,
      priority: parseInt(formPriority),
      severityMin: parseInt(formSeverityMin),
      severityMax: parseInt(formSeverityMax),
      trainingImpact: formTrainingImpact,
      movementImpact: formMovementImpact || null,
      triggersFollowUp: formTriggersFollowUp,
      followUpQuestion: formTriggersFollowUp ? formFollowUpQuestion : null,
      followUpAnswers: formTriggersFollowUp ? formFollowUpAnswers : null,
      whatsGoingOn: formWhatsGoingOn,
      trainingGuidance: formTrainingGuidance,
      dailyMovement: formDailyMovement,
      deskWorkTips: formDeskWorkTips,
      thingsToWatch: formThingsToWatch,
      checkInAgain: formCheckInAgain, // Legacy field - kept for backwards compatibility
      reassessInDays: formReassessInDays, // New reassessment reminder field (1-30 days or null)
      // Programme Impact fields
      showProgrammeImpact: formShowProgrammeImpact,
      programmeImpactSummary: formShowProgrammeImpact ? formProgrammeImpactSummary : null,
      flaggingMovementPatterns: formShowProgrammeImpact ? formFlaggingMovementPatterns : null,
      flaggingEquipment: formShowProgrammeImpact ? formFlaggingEquipment : null,
      flaggingLevel: formShowProgrammeImpact ? formFlaggingLevel : null,
      flaggingMechanics: formShowProgrammeImpact ? formFlaggingMechanics : null,
      flaggingMuscles: formShowProgrammeImpact ? formFlaggingMuscles : null,
      flaggingExcludeTags: formShowProgrammeImpact ? formFlaggingExcludeTags : null,
      flaggingNote: formShowProgrammeImpact ? formFlaggingNote : null,
      // Store as single pool object (new structure)
      substitutionRules: formShowProgrammeImpact ? {
        allowedPatterns: formSubstitutionAllowedPatterns,
        substituteExerciseIds: formSubstitutionExerciseIds,
        coachingNote: formSubstitutionCoachingNote,
      } : null,
      recommendRecoveryProgramme: formRecommendRecoveryProgramme,
      recoveryProgrammeId: formRecommendRecoveryProgramme ? formRecoveryProgrammeId : null,
      recoveryProgrammeReason: formRecommendRecoveryProgramme ? formRecoveryProgrammeReason : null,
      restoreOnReassessment: formRestoreOnReassessment,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Helper functions for substitution pool
  const toggleSubstitutionExercise = (exerciseId: number) => {
    setFormSubstitutionExerciseIds(prev =>
      prev.includes(exerciseId)
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const clearExerciseFilters = () => {
    setExerciseFilters({
      movementPattern: [],
      movementType: [],
      mainMuscle: [],
      equipment: [],
      level: [],
      mechanics: [],
    });
  };

  // Drag and drop handlers for substitute exercise reordering
  const handleDragStart = (exerciseId: number) => {
    setDraggedExerciseId(exerciseId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedExerciseId === null || draggedExerciseId === targetId) return;
    
    const currentList = [...formSubstitutionExerciseIds];
    const draggedIndex = currentList.indexOf(draggedExerciseId);
    const targetIndex = currentList.indexOf(targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Remove dragged item and insert at target position
    currentList.splice(draggedIndex, 1);
    currentList.splice(targetIndex, 0, draggedExerciseId);
    
    setFormSubstitutionExerciseIds(currentList);
  };

  const handleDragEnd = () => {
    setDraggedExerciseId(null);
  };

  // Filter exercises based on search and filters
  const filteredExercises = exercises.filter(ex => {
    // Text search
    if (exerciseSearchQuery && !ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase())) {
      return false;
    }
    // Movement Pattern filter (checks exercise's movement array)
    if (exerciseFilters.movementPattern.length > 0) {
      const exMovements = ex.movement || [];
      if (!exerciseFilters.movementPattern.some(p => exMovements.includes(p))) {
        return false;
      }
    }
    // Movement Type filter
    if (exerciseFilters.movementType.length > 0) {
      const exMovements = ex.movement || [];
      if (!exerciseFilters.movementType.some(t => exMovements.includes(t))) {
        return false;
      }
    }
    // Main Muscle filter
    if (exerciseFilters.mainMuscle.length > 0) {
      const exMuscles = ex.mainMuscle || [];
      if (!exerciseFilters.mainMuscle.some(m => exMuscles.includes(m))) {
        return false;
      }
    }
    // Equipment filter
    if (exerciseFilters.equipment.length > 0) {
      const exEquipment = ex.equipment || [];
      if (!exerciseFilters.equipment.some(e => exEquipment.includes(e))) {
        return false;
      }
    }
    // Level filter
    if (exerciseFilters.level.length > 0) {
      if (!ex.level || !exerciseFilters.level.includes(ex.level)) {
        return false;
      }
    }
    // Mechanics filter
    if (exerciseFilters.mechanics.length > 0) {
      const exMechanics = ex.mechanics || [];
      if (!exerciseFilters.mechanics.some(m => exMechanics.includes(m))) {
        return false;
      }
    }
    return true;
  });

  if (isEditing && isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-muted-foreground">Loading outcome...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? "Edit" : "Create"} Outcome</h1>
            <p className="text-muted-foreground">Step {step} of 2</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>1</div>
          <div className="flex-1 h-1 bg-muted rounded">
            <div className={`h-full bg-primary rounded transition-all ${step === 2 ? "w-full" : "w-0"}`} />
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>2</div>
        </div>

        {/* Step 1: Basic Info + Conditions */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information & Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Internal Name</Label>
                    <Input 
                      id="name" 
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., shoulder_manageable"
                      data-testid="input-outcome-name" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used internally, never shown to users</p>
                  </div>
                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input 
                      id="displayName" 
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      placeholder="e.g., Manageable Shoulder Discomfort"
                      data-testid="input-outcome-display-name" 
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formPriority} onValueChange={setFormPriority}>
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
                    <Select value={formSeverityMin} onValueChange={setFormSeverityMin}>
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
                    <Select value={formSeverityMax} onValueChange={setFormSeverityMax}>
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
                  <Select value={formTrainingImpact} onValueChange={setFormTrainingImpact}>
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

                {/* Follow-up Question Editor */}
                {(formTrainingImpact === "limited" || formTrainingImpact === "cannot_train") && (
                  <div className="p-4 rounded-md border bg-muted/20 space-y-4">
                    <div className="pb-2 border-b">
                      <h4 className="font-medium text-sm">Follow-up Question (2b)</h4>
                      <p className="text-xs text-muted-foreground">Configure the question shown when movement is affected</p>
                    </div>
                    <div>
                      <Label htmlFor="followUpQuestion">Question Text</Label>
                      <Input 
                        id="followUpQuestion"
                        value={formFollowUpQuestion}
                        onChange={(e) => setFormFollowUpQuestion(e.target.value)}
                        placeholder="Which movements cause discomfort?"
                        data-testid="input-outcome-followup-question"
                      />
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Select which movements to include in the follow-up question</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        {currentArea ? `Available options for ${currentArea.displayName}:` : "Loading movement options..."}
                      </p>
                      
                      {availableMovementOptions.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {availableMovementOptions.map((option, index) => {
                            const isSelected = formFollowUpAnswers.some(a => a.value === option.id);
                            return (
                              <div key={option.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`movement-${option.id}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      const newAnswer = {
                                        value: option.id,
                                        label: option.label,
                                        orderIndex: formFollowUpAnswers.length,
                                      };
                                      setFormFollowUpAnswers([...formFollowUpAnswers, newAnswer]);
                                    } else {
                                      const updated = formFollowUpAnswers.filter(a => a.value !== option.id);
                                      setFormFollowUpAnswers(updated.map((a, i) => ({ ...a, orderIndex: i })));
                                    }
                                  }}
                                  data-testid={`checkbox-movement-${option.id}`}
                                />
                                <label
                                  htmlFor={`movement-${option.id}`}
                                  className="text-sm leading-none cursor-pointer"
                                >
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No movement options available for this body area.
                        </p>
                      )}
                      
                      {formFollowUpAnswers.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {formFollowUpAnswers.length} option{formFollowUpAnswers.length !== 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="movementImpact">Movement Question: Does this limit how you move?</Label>
                  <Select value={formMovementImpact} onValueChange={setFormMovementImpact}>
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

              </div>

              <Button 
                className="w-full" 
                onClick={() => setStep(2)}
                data-testid="button-continue"
              >
                Continue to Content
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Content Fields */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Content (shown to users)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="whatsGoingOn">What's going on</Label>
                <Textarea 
                  id="whatsGoingOn" 
                  value={formWhatsGoingOn}
                  onChange={(e) => setFormWhatsGoingOn(e.target.value)}
                  rows={3}
                  placeholder="Explain the situation in simple terms..."
                  data-testid="input-outcome-whats-going-on" 
                />
              </div>

              <div>
                <Label htmlFor="trainingGuidance">Training guidance</Label>
                <Textarea 
                  id="trainingGuidance" 
                  value={formTrainingGuidance}
                  onChange={(e) => setFormTrainingGuidance(e.target.value)}
                  rows={3}
                  placeholder="How should they approach training..."
                  data-testid="input-outcome-training-guidance" 
                />
              </div>

              <div>
                <Label htmlFor="dailyMovement">Daily movement</Label>
                <Textarea 
                  id="dailyMovement" 
                  value={formDailyMovement}
                  onChange={(e) => setFormDailyMovement(e.target.value)}
                  rows={3}
                  placeholder="Movement recommendations for daily life..."
                  data-testid="input-outcome-daily-movement" 
                />
              </div>

              <div>
                <Label htmlFor="deskWorkTips">Desk and work tips</Label>
                <Textarea 
                  id="deskWorkTips" 
                  value={formDeskWorkTips}
                  onChange={(e) => setFormDeskWorkTips(e.target.value)}
                  rows={3}
                  placeholder="Tips for working at a desk..."
                  data-testid="input-outcome-desk-tips" 
                />
              </div>

              <div>
                <Label htmlFor="thingsToWatch">Things to watch</Label>
                <Textarea 
                  id="thingsToWatch" 
                  value={formThingsToWatch}
                  onChange={(e) => setFormThingsToWatch(e.target.value)}
                  rows={3}
                  placeholder="Warning signs to monitor..."
                  data-testid="input-outcome-things-to-watch" 
                />
              </div>

              <div>
                <Label htmlFor="reassessInDays">Reassess Reminder (days)</Label>
                <Select 
                  value={formReassessInDays?.toString() || "none"}
                  onValueChange={(val) => setFormReassessInDays(val === "none" ? null : parseInt(val))}
                >
                  <SelectTrigger id="reassessInDays" data-testid="input-outcome-reassess-days">
                    <SelectValue placeholder="No reminder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No reminder</SelectItem>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day} {day === 1 ? "day" : "days"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Set how many days until the user receives an in-app reminder to reassess this area.
                </p>
              </div>

              {/* Programme Impact Section */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Programme Impact</h3>
                    <p className="text-sm text-muted-foreground">Configure how this outcome affects the user's training programme</p>
                  </div>
                  <Switch
                    checked={formShowProgrammeImpact}
                    onCheckedChange={setFormShowProgrammeImpact}
                    data-testid="switch-programme-impact"
                  />
                </div>

                {formShowProgrammeImpact && (
                  <div className="space-y-6 bg-muted/30 rounded-lg p-4">
                    {/* Summary */}
                    <div>
                      <Label htmlFor="programmeImpactSummary">Programme Impact Summary *</Label>
                      <Input
                        id="programmeImpactSummary"
                        value={formProgrammeImpactSummary}
                        onChange={(e) => setFormProgrammeImpactSummary(e.target.value)}
                        placeholder="e.g., Your training will be modified to avoid overhead movements"
                        data-testid="input-programme-impact-summary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">This will be shown to users on the results page</p>
                    </div>

                    {/* Flagging Rules */}
                    <div className="space-y-4">
                      <h4 className="font-medium border-b pb-2">Flagging Rules</h4>
                      <p className="text-sm text-muted-foreground">Define what exercises should be flagged for potential substitution</p>
                      
                      <Accordion type="multiple" className="w-full">
                        {/* Movement Patterns */}
                        <AccordionItem value="movement-patterns">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Movement Pattern</span>
                              {formFlaggingMovementPatterns.filter(p => MOVEMENT_PATTERN_OPTIONS.includes(p)).length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingMovementPatterns.filter(p => MOVEMENT_PATTERN_OPTIONS.includes(p)).length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {MOVEMENT_PATTERN_OPTIONS.map((pattern) => (
                                <label key={pattern} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingMovementPatterns.includes(pattern)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingMovementPatterns([...formFlaggingMovementPatterns, pattern]);
                                      } else {
                                        setFormFlaggingMovementPatterns(formFlaggingMovementPatterns.filter(p => p !== pattern));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{pattern}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Movement Types */}
                        <AccordionItem value="movement-types">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Movement Type</span>
                              {formFlaggingMovementPatterns.filter(p => MOVEMENT_TYPE_OPTIONS.includes(p)).length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingMovementPatterns.filter(p => MOVEMENT_TYPE_OPTIONS.includes(p)).length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {MOVEMENT_TYPE_OPTIONS.map((pattern) => (
                                <label key={pattern} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingMovementPatterns.includes(pattern)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingMovementPatterns([...formFlaggingMovementPatterns, pattern]);
                                      } else {
                                        setFormFlaggingMovementPatterns(formFlaggingMovementPatterns.filter(p => p !== pattern));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{pattern}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Equipment */}
                        <AccordionItem value="equipment">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Equipment</span>
                              {formFlaggingEquipment.length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingEquipment.length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {EQUIPMENT_OPTIONS.map((equip) => (
                                <label key={equip} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingEquipment.includes(equip)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingEquipment([...formFlaggingEquipment, equip]);
                                      } else {
                                        setFormFlaggingEquipment(formFlaggingEquipment.filter(e => e !== equip));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{equip}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Level */}
                        <AccordionItem value="level">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Difficulty levels</span>
                              {formFlaggingLevel.length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingLevel.length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {LEVEL_OPTIONS.map((level) => (
                                <label key={level} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingLevel.includes(level)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingLevel([...formFlaggingLevel, level]);
                                      } else {
                                        setFormFlaggingLevel(formFlaggingLevel.filter(l => l !== level));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{level}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Mechanics */}
                        <AccordionItem value="mechanics">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Mechanics</span>
                              {formFlaggingMechanics.length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingMechanics.length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {MECHANICS_OPTIONS.map((mech) => (
                                <label key={mech} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingMechanics.includes(mech)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingMechanics([...formFlaggingMechanics, mech]);
                                      } else {
                                        setFormFlaggingMechanics(formFlaggingMechanics.filter(m => m !== mech));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{mech}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Muscles */}
                        <AccordionItem value="muscles">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Muscles</span>
                              {formFlaggingMuscles.length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingMuscles.length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {MAIN_MUSCLE_OPTIONS.map((muscle) => (
                                <label key={muscle} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingMuscles.includes(muscle)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingMuscles([...formFlaggingMuscles, muscle]);
                                      } else {
                                        setFormFlaggingMuscles(formFlaggingMuscles.filter(m => m !== muscle));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{muscle}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Exclude Tags */}
                        <AccordionItem value="exclude-tags">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2">
                              <span>Exclude tags (prevent flagging)</span>
                              {formFlaggingExcludeTags.length > 0 && (
                                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                  {formFlaggingExcludeTags.length} selected
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {["warm-up", "mobility", "rehab", "stretching", "cooldown", "core"].map((tag) => (
                                <label key={tag} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                                  <Checkbox
                                    checked={formFlaggingExcludeTags.includes(tag)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setFormFlaggingExcludeTags([...formFlaggingExcludeTags, tag]);
                                      } else {
                                        setFormFlaggingExcludeTags(formFlaggingExcludeTags.filter(t => t !== tag));
                                      }
                                    }}
                                  />
                                  <span className="text-sm">{tag}</span>
                                </label>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      {/* Flagging Note */}
                      <div>
                        <Label htmlFor="flaggingNote">Flagging note (optional)</Label>
                        <Input
                          id="flaggingNote"
                          value={formFlaggingNote}
                          onChange={(e) => setFormFlaggingNote(e.target.value)}
                          placeholder="Plain language note about what may be affected"
                          data-testid="input-flagging-note"
                        />
                      </div>
                    </div>

                    {/* Substitution Pool */}
                    <div className="space-y-4">
                      <div className="border-b pb-2">
                        <h4 className="font-medium">Substitution Pool</h4>
                        <p className="text-sm text-muted-foreground">Define allowed replacement movement patterns and curated substitute exercises</p>
                      </div>

                      {/* Allowed Replacement Movement Patterns */}
                      <div>
                        <Label>Allowed replacement movement patterns</Label>
                        <p className="text-xs text-muted-foreground mb-2">Select movement patterns that can be used as alternatives when exercises are flagged</p>
                        <div className="flex flex-wrap gap-2">
                          {MOVEMENT_PATTERN_OPTIONS.map((pattern) => (
                            <label key={pattern} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                              <Checkbox
                                checked={formSubstitutionAllowedPatterns.includes(pattern)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormSubstitutionAllowedPatterns([...formSubstitutionAllowedPatterns, pattern]);
                                  } else {
                                    setFormSubstitutionAllowedPatterns(formSubstitutionAllowedPatterns.filter(p => p !== pattern));
                                  }
                                }}
                              />
                              <span className="text-sm">{pattern}</span>
                            </label>
                          ))}
                        </div>
                        {formSubstitutionAllowedPatterns.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {formSubstitutionAllowedPatterns.length} pattern{formSubstitutionAllowedPatterns.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>

                      {/* Substitute Exercises Picker */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Substitute exercises</Label>
                            <p className="text-xs text-muted-foreground">Select specific exercises that can be used as substitutes</p>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowExercisePicker(!showExercisePicker)}
                          >
                            {showExercisePicker ? "Hide Picker" : "Add Exercises"}
                          </Button>
                        </div>

                        {/* Selected exercises as reorderable list */}
                        {formSubstitutionExerciseIds.length > 0 && (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-sm font-medium">Priority order</Label>
                              <p className="text-xs text-muted-foreground">Top item is chosen first when eligible</p>
                            </div>
                            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
                              {formSubstitutionExerciseIds.map((exId, index) => {
                                const exercise = exercises.find(e => e.id === exId);
                                if (!exercise) return null;
                                const movementPatterns = exercise.movement?.filter(m => 
                                  MOVEMENT_PATTERN_OPTIONS.includes(m)
                                ) || [];
                                const equipmentList = exercise.equipment || [];
                                const isDragging = draggedExerciseId === exId;
                                
                                return (
                                  <div
                                    key={exId}
                                    draggable
                                    onDragStart={() => handleDragStart(exId)}
                                    onDragOver={(e) => handleDragOver(e, exId)}
                                    onDragEnd={handleDragEnd}
                                    className={`flex items-center gap-3 p-2 rounded-md border bg-background cursor-grab active:cursor-grabbing transition-opacity ${
                                      isDragging ? 'opacity-50 border-primary' : 'border-border hover:border-muted-foreground/50'
                                    }`}
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{index + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{exercise.name}</p>
                                      {(movementPatterns.length > 0 || equipmentList.length > 0) && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {[...movementPatterns, ...equipmentList].slice(0, 3).join(' • ')}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0 hover:bg-destructive/20 hover:text-destructive"
                                      onClick={() => toggleSubstitutionExercise(exId)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Exercise Picker Panel */}
                        {showExercisePicker && (
                          <div className="border rounded-lg bg-background">
                            {/* Search bar */}
                            <div className="p-3 border-b">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Search exercises..."
                                  value={exerciseSearchQuery}
                                  onChange={(e) => setExerciseSearchQuery(e.target.value)}
                                  className="pl-9"
                                />
                              </div>
                            </div>

                            {/* Filter Accordions */}
                            <div className="p-3 border-b">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Filters</span>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={clearExerciseFilters}
                                  className="text-xs"
                                >
                                  Clear All
                                </Button>
                              </div>
                              <Accordion type="multiple" className="w-full">
                                {/* Movement Pattern */}
                                <AccordionItem value="picker-movementPattern">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Movement Pattern</span>
                                      {exerciseFilters.movementPattern.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.movementPattern.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.movementPattern.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                movementPattern: checked 
                                                  ? [...prev.movementPattern, opt]
                                                  : prev.movementPattern.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>

                                {/* Movement Type */}
                                <AccordionItem value="picker-movementType">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Movement Type</span>
                                      {exerciseFilters.movementType.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.movementType.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.movementType.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                movementType: checked 
                                                  ? [...prev.movementType, opt]
                                                  : prev.movementType.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>

                                {/* Main Muscle */}
                                <AccordionItem value="picker-mainMuscle">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Main Muscle</span>
                                      {exerciseFilters.mainMuscle.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.mainMuscle.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {MAIN_MUSCLE_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.mainMuscle.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                mainMuscle: checked 
                                                  ? [...prev.mainMuscle, opt]
                                                  : prev.mainMuscle.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>

                                {/* Equipment */}
                                <AccordionItem value="picker-equipment">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Equipment</span>
                                      {exerciseFilters.equipment.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.equipment.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {EQUIPMENT_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.equipment.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                equipment: checked 
                                                  ? [...prev.equipment, opt]
                                                  : prev.equipment.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>

                                {/* Level */}
                                <AccordionItem value="picker-level">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Level</span>
                                      {exerciseFilters.level.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.level.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {LEVEL_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.level.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                level: checked 
                                                  ? [...prev.level, opt]
                                                  : prev.level.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>

                                {/* Mechanics */}
                                <AccordionItem value="picker-mechanics">
                                  <AccordionTrigger className="text-sm py-2">
                                    <div className="flex items-center gap-2">
                                      <span>Mechanics</span>
                                      {exerciseFilters.mechanics.length > 0 && (
                                        <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                                          {exerciseFilters.mechanics.length}
                                        </span>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {MECHANICS_OPTIONS.map((opt) => (
                                        <label key={opt} className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80 text-xs">
                                          <Checkbox
                                            checked={exerciseFilters.mechanics.includes(opt)}
                                            onCheckedChange={(checked) => {
                                              setExerciseFilters(prev => ({
                                                ...prev,
                                                mechanics: checked 
                                                  ? [...prev.mechanics, opt]
                                                  : prev.mechanics.filter(x => x !== opt)
                                              }));
                                            }}
                                            className="h-3 w-3"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>

                            {/* Results count */}
                            <div className="px-3 py-2 border-b bg-muted/30 text-sm text-muted-foreground">
                              {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} found
                            </div>

                            {/* Exercise results list */}
                            <div className="max-h-60 overflow-y-auto">
                              {filteredExercises.slice(0, 50).map((ex) => (
                                <div
                                  key={ex.id}
                                  className={`px-3 py-2 cursor-pointer hover:bg-muted flex items-center justify-between border-b last:border-b-0 ${
                                    formSubstitutionExerciseIds.includes(ex.id) ? "bg-primary/10" : ""
                                  }`}
                                  onClick={() => toggleSubstitutionExercise(ex.id)}
                                >
                                  <div>
                                    <span className="text-sm font-medium">{ex.name}</span>
                                    {ex.movement && ex.movement.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {ex.movement.slice(0, 3).join(", ")}
                                        {ex.movement.length > 3 && ` +${ex.movement.length - 3}`}
                                      </p>
                                    )}
                                  </div>
                                  <Checkbox
                                    checked={formSubstitutionExerciseIds.includes(ex.id)}
                                    onCheckedChange={() => toggleSubstitutionExercise(ex.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              ))}
                              {filteredExercises.length === 0 && (
                                <p className="px-3 py-4 text-sm text-muted-foreground text-center">No exercises match your filters</p>
                              )}
                              {filteredExercises.length > 50 && (
                                <p className="px-3 py-2 text-xs text-muted-foreground text-center bg-muted/30">
                                  Showing first 50 results. Refine filters to see more.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coaching Note */}
                      <div>
                        <Label>Coaching note (optional)</Label>
                        <Input
                          value={formSubstitutionCoachingNote}
                          onChange={(e) => setFormSubstitutionCoachingNote(e.target.value)}
                          placeholder="Explain the substitution approach for this outcome"
                        />
                      </div>
                    </div>

                    {/* Recovery Programme Recommendation */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div>
                          <h4 className="font-medium">Recovery Programme Recommendation</h4>
                          <p className="text-xs text-muted-foreground">Optionally recommend a recovery programme</p>
                        </div>
                        <Switch
                          checked={formRecommendRecoveryProgramme}
                          onCheckedChange={setFormRecommendRecoveryProgramme}
                          data-testid="switch-recommend-recovery"
                        />
                      </div>

                      {formRecommendRecoveryProgramme && (
                        <div className="space-y-3">
                          <div>
                            <Label>Select recovery programme</Label>
                            <Select 
                              value={formRecoveryProgrammeId?.toString() || ""} 
                              onValueChange={(val) => setFormRecoveryProgrammeId(val ? parseInt(val) : null)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a recovery programme" />
                              </SelectTrigger>
                              <SelectContent>
                                {recoveryPrograms.map((prog) => (
                                  <SelectItem key={prog.id} value={prog.id.toString()}>{prog.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {recoveryPrograms.length === 0 && (
                              <p className="text-xs text-muted-foreground mt-1">No recovery programmes available. Create one first.</p>
                            )}
                          </div>
                          <div>
                            <Label>Reason (optional)</Label>
                            <Input
                              value={formRecoveryProgrammeReason}
                              onChange={(e) => setFormRecoveryProgrammeReason(e.target.value)}
                              placeholder="Why this programme is recommended"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reassessment Preference */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Restore original exercises on successful reassessment</Label>
                        <p className="text-xs text-muted-foreground">
                          When the user reassesses and no longer matches this outcome, restore their original exercises
                        </p>
                      </div>
                      <Switch
                        checked={formRestoreOnReassessment}
                        onCheckedChange={setFormRestoreOnReassessment}
                        data-testid="switch-restore-reassessment"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setStep(1)}
                  data-testid="button-back-step"
                >
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-outcome"
                >
                  {isEditing ? "Update" : "Create"} Outcome
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
