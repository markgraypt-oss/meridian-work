import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Check, Clock, History } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BodyMapLog } from "@shared/schema";
import { format } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";

const BODY_AREAS = [
  { id: "neck", label: "Neck", zone: { front: { x: 50, y: 12, w: 12, h: 6 } } },
  { id: "shoulder", label: "Shoulder", zone: { front: { x: 25, y: 18, w: 15, h: 8 }, back: { x: 25, y: 18, w: 15, h: 8 } } },
  { id: "elbow", label: "Elbow", zone: { front: { x: 15, y: 38, w: 10, h: 8 } } },
  { id: "wrist_hand", label: "Wrist and hand", zone: { front: { x: 10, y: 52, w: 12, h: 10 } } },
  { id: "upper_back", label: "Upper back", zone: { back: { x: 35, y: 20, w: 30, h: 12 } } },
  { id: "lower_back", label: "Lower back", zone: { back: { x: 35, y: 35, w: 30, h: 12 } } },
  { id: "hip", label: "Hip", zone: { front: { x: 30, y: 48, w: 20, h: 8 } } },
  { id: "quadriceps", label: "Quadriceps (front of thigh)", zone: { front: { x: 32, y: 55, w: 18, h: 15 } } },
  { id: "hamstrings", label: "Hamstrings (back of thigh)", zone: { back: { x: 32, y: 55, w: 18, h: 15 } } },
  { id: "knee", label: "Knee", zone: { front: { x: 35, y: 70, w: 15, h: 8 } } },
  { id: "calf", label: "Calf", zone: { back: { x: 35, y: 78, w: 15, h: 12 } } },
  { id: "ankle_foot", label: "Ankle and foot", zone: { front: { x: 35, y: 90, w: 15, h: 8 } } },
];

const SIDES = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "both", label: "Both" },
];

const MOVEMENT_IMPACT_OPTIONS = [
  { id: "none", label: "No, movement feels normal" },
  { id: "slight", label: "A little restricted" },
  { id: "significant", label: "Yes, it limits movement" },
];

const TRAINING_IMPACT_OPTIONS = [
  { id: "normal", label: "I can train as normal" },
  { id: "limited", label: "Some movements feel uncomfortable" },
  { id: "cannot_train", label: "I can't train like normal" },
];

const TRIGGER_OPTIONS = [
  { id: "rest", label: "At rest" },
  { id: "during_day", label: "During the day" },
  { id: "during_exercise", label: "During exercise" },
  { id: "after_sitting", label: "After long sitting" },
  { id: "all_time", label: "All the time" },
];

type Step = "area" | "side" | "severity" | "movement" | "training" | "trigger" | "results" | "history";

interface AssessmentData {
  bodyArea: string;
  bodyAreaLabel: string;
  side: string;
  severity: number;
  movementImpact: string;
  trainingImpact: string;
  primaryTrigger: string;
}

function getSeverityLabel(severity: number): string {
  if (severity <= 3) return "Mild";
  if (severity <= 6) return "Moderate";
  return "High";
}

function getSeverityColor(severity: number): string {
  if (severity <= 3) return "text-green-400";
  if (severity <= 6) return "text-[#0cc9a9]";
  return "text-red-400";
}

function generateGuidance(data: AssessmentData) {
  const { bodyAreaLabel, side, severity, movementImpact, trainingImpact, primaryTrigger } = data;
  
  const sideText = side === "both" ? "Both sides" : `${side.charAt(0).toUpperCase() + side.slice(1)} side`;
  const areaConfirmation = `${sideText} ${bodyAreaLabel.toLowerCase()} discomfort`;
  
  let whatsBehindThis = "";
  const bodyArea = data.bodyArea;
  switch (bodyArea) {
    case "neck":
      whatsBehindThis = "Neck discomfort often comes from tension, poor desk posture, or holding stress in the shoulders and upper back. It can also result from sleeping in an awkward position or looking down at screens for extended periods.";
      break;
    case "shoulder":
      whatsBehindThis = "Shoulder discomfort is commonly related to repetitive overhead movements, desk work posture, or tension carrying from the neck. It can also come from sleeping on one side or carrying heavy bags.";
      break;
    case "elbow":
      whatsBehindThis = "Elbow discomfort often develops from repetitive gripping or twisting motions, typing, or overuse during exercise. It typically builds gradually over time.";
      break;
    case "wrist_hand":
      whatsBehindThis = "Wrist and hand discomfort commonly comes from keyboard and mouse use, gripping activities, or repetitive motions. It may feel worse after long work sessions.";
      break;
    case "upper_back":
      whatsBehindThis = "Upper back discomfort often relates to rounded shoulders, poor desk ergonomics, or weak postural muscles. Prolonged sitting and screen work are common contributors.";
      break;
    case "lower_back":
      whatsBehindThis = "Lower back discomfort is frequently linked to prolonged sitting, weak core muscles, or poor lifting habits. Stress and lack of movement throughout the day can make it worse.";
      break;
    case "hip":
      whatsBehindThis = "Hip discomfort often comes from extended sitting, tight hip flexors, or imbalances from exercise. It can also relate to how you sit or stand throughout the day.";
      break;
    case "quadriceps":
      whatsBehindThis = "Front thigh discomfort typically relates to exercise load, sitting posture, or tightness from lack of stretching. It may feel more noticeable after workouts or long sitting periods.";
      break;
    case "hamstrings":
      whatsBehindThis = "Back of thigh discomfort often comes from sitting for long periods, exercise strain, or inadequate warm-up before activity. Tight hamstrings are common in desk workers.";
      break;
    case "knee":
      whatsBehindThis = "Knee discomfort can relate to exercise load, muscle imbalances around the knee, or extended sitting. Stairs and squatting movements often highlight the issue.";
      break;
    case "calf":
      whatsBehindThis = "Calf discomfort typically relates to standing or walking demands, footwear, or exercise load. Tight calves are common and often respond well to simple stretching.";
      break;
    case "ankle_foot":
      whatsBehindThis = "Ankle and foot discomfort often relates to footwear, standing time, or exercise load. It may also come from changes in activity level or walking surfaces.";
      break;
    default:
      whatsBehindThis = "This type of discomfort is often related to daily activities, posture, or exercise. Understanding when it shows up can help guide the right approach.";
  }
  
  let trainingGuidance = "";
  let dailyGuidance = "";
  let deskGuidance = "";
  
  if (severity <= 3) {
    trainingGuidance = "You can continue training as normal. Just stay aware of how this area feels during and after exercise.";
    dailyGuidance = "Normal movement is encouraged. Gentle stretching and regular position changes will help.";
  } else if (severity <= 6) {
    trainingGuidance = "Consider reducing load or volume for exercises that use this area. Listen to your body and back off if discomfort increases.";
    dailyGuidance = "Move within comfortable ranges. Take regular breaks and avoid staying in one position too long.";
  } else {
    trainingGuidance = "Avoid loading this area for now. Focus on other body parts in your training and prioritize recovery.";
    dailyGuidance = "Take it easy on this area. Prioritize rest and gentle movement only within comfortable limits.";
  }
  
  if (trainingImpact === "modify_avoid") {
    trainingGuidance = "Avoid loading this area temporarily. Substitute with exercises that don't stress this region.";
  } else if (trainingImpact === "careful") {
    trainingGuidance = "Use lighter loads and reduced volume. Pay attention to any increase in discomfort.";
  }
  
  if (movementImpact === "significant") {
    dailyGuidance = "Movement is significantly limited. Stay within pain-free ranges and avoid movements that provoke discomfort.";
  } else if (movementImpact === "slight") {
    dailyGuidance = "Move within comfortable ranges. Gentle stretching may help, but don't push into discomfort.";
  }
  
  if (primaryTrigger === "after_sitting") {
    deskGuidance = "Since this shows up after long sitting, focus on regular breaks. Stand and move every 30-45 minutes. Check your desk setup - screen height, chair position, and keyboard placement can all contribute.";
  } else if (primaryTrigger === "during_day") {
    deskGuidance = "Pay attention to your posture throughout the day. Regular micro-breaks and position changes can help prevent buildup.";
  }
  
  let cautions: string[] = [];
  if (severity >= 7) {
    cautions.push("Avoid exercises that load this area until discomfort reduces");
  }
  if (movementImpact === "significant") {
    cautions.push("Stay within pain-free movement ranges");
  }
  if (cautions.length === 0) {
    cautions.push("No major cautions at this time - continue with awareness");
  }
  
  let reassessmentDays = 7;
  if (severity >= 7) {
    reassessmentDays = 2;
  } else if (severity >= 4) {
    reassessmentDays = 4;
  }
  
  return {
    areaConfirmation,
    whatsBehindThis,
    trainingGuidance,
    dailyGuidance,
    deskGuidance,
    cautions,
    reassessmentDays,
  };
}

export default function BodyMapV1() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const { formatDateTime } = useFormattedDate();
  const [step, setStep] = useState<Step>("area");
  const [activeTab, setActiveTab] = useState<"text" | "map">("text");
  const [mapView, setMapView] = useState<"front" | "back">("front");
  const [severityConfirmed, setSeverityConfirmed] = useState(false);
  
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    bodyArea: "",
    bodyAreaLabel: "",
    side: "",
    severity: 5,
    movementImpact: "",
    trainingImpact: "",
    primaryTrigger: "",
  });

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
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: historyLogs = [] } = useQuery<BodyMapLog[]>({
    queryKey: ["/api/body-map"],
    enabled: isAuthenticated && step === "history",
  });

  const saveAssessmentMutation = useMutation({
    mutationFn: async (data: AssessmentData) => {
      const response = await apiRequest("POST", "/api/body-map/v1", {
        bodyPart: data.bodyArea,
        side: data.side,
        severity: data.severity,
        movementImpact: data.movementImpact,
        trainingImpact: data.trainingImpact,
        primaryTrigger: data.primaryTrigger,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      toast({ title: "Saved", description: "Your assessment has been recorded" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save assessment",
        variant: "destructive",
      });
    },
  });

  const handleAreaSelect = (areaId: string, areaLabel: string) => {
    setAssessmentData(prev => ({ ...prev, bodyArea: areaId, bodyAreaLabel: areaLabel }));
    setStep("side");
  };

  const handleSideSelect = (side: string) => {
    setAssessmentData(prev => ({ ...prev, side }));
    setStep("severity");
  };

  const handleSeverityChange = (value: number[]) => {
    setAssessmentData(prev => ({ ...prev, severity: value[0] }));
    setSeverityConfirmed(true);
  };

  const handleNext = () => {
    switch (step) {
      case "severity":
        setStep("movement");
        break;
      case "movement":
        setStep("training");
        break;
      case "training":
        setStep("trigger");
        break;
      case "trigger":
        saveAssessmentMutation.mutate(assessmentData);
        setStep("results");
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "side":
        setStep("area");
        break;
      case "severity":
        setStep("side");
        break;
      case "movement":
        setStep("severity");
        break;
      case "training":
        setStep("movement");
        break;
      case "trigger":
        setStep("training");
        break;
      case "results":
        setStep("trigger");
        break;
      case "history":
        setStep("area");
        break;
    }
  };

  const resetAssessment = () => {
    setAssessmentData({
      bodyArea: "",
      bodyAreaLabel: "",
      side: "",
      severity: 5,
      movementImpact: "",
      trainingImpact: "",
      primaryTrigger: "",
    });
    setSeverityConfirmed(false);
    setStep("area");
  };

  const canProceed = () => {
    switch (step) {
      case "severity":
        return severityConfirmed;
      case "movement":
        return !!assessmentData.movementImpact;
      case "training":
        return !!assessmentData.trainingImpact;
      case "trigger":
        return !!assessmentData.primaryTrigger;
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const guidance = step === "results" ? generateGuidance(assessmentData) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopHeader 
        title="Body Map" 
        onBack={step === "area" ? () => navigate("/recovery") : handleBack}
      />
      
      <div className="p-4">
        {step === "area" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("history")}
                data-testid="button-history"
                className="text-muted-foreground"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
            </div>
            
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Where are you feeling discomfort today?
              </h1>
              <p className="text-muted-foreground text-sm">
                Select from the list or tap on the body map
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                variant={activeTab === "text" ? "default" : "outline"}
                onClick={() => setActiveTab("text")}
                size="sm"
                data-testid="tab-text-selector"
              >
                Text List
              </Button>
              <Button
                variant={activeTab === "map" ? "default" : "outline"}
                onClick={() => setActiveTab("map")}
                size="sm"
                data-testid="tab-body-map"
              >
                Body Map
              </Button>
            </div>

            {activeTab === "text" && (
              <div className="grid gap-2">
                {BODY_AREAS.map((area) => (
                  <Card
                    key={area.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleAreaSelect(area.id, area.label)}
                    data-testid={`area-${area.id}`}
                  >
                    <CardContent className="p-4">
                      <span className="text-foreground">{area.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "map" && (
              <div className="space-y-4">
                <div className="flex gap-2 justify-center">
                  <Button
                    variant={mapView === "front" ? "default" : "outline"}
                    onClick={() => setMapView("front")}
                    size="sm"
                  >
                    Front
                  </Button>
                  <Button
                    variant={mapView === "back" ? "default" : "outline"}
                    onClick={() => setMapView("back")}
                    size="sm"
                  >
                    Back
                  </Button>
                </div>

                <div className="relative mx-auto w-64 h-96 bg-card rounded-xl border border-border overflow-hidden">
                  <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                    <ellipse cx="50" cy="10" rx="8" ry="9" fill="#374151" />
                    <rect x="38" y="18" width="24" height="30" rx="4" fill="#374151" />
                    <rect x="20" y="20" width="8" height="35" rx="3" fill="#374151" />
                    <rect x="72" y="20" width="8" height="35" rx="3" fill="#374151" />
                    <rect x="16" y="52" width="6" height="12" rx="2" fill="#374151" />
                    <rect x="78" y="52" width="6" height="12" rx="2" fill="#374151" />
                    <rect x="40" y="48" width="9" height="30" rx="3" fill="#374151" />
                    <rect x="51" y="48" width="9" height="30" rx="3" fill="#374151" />
                    <rect x="38" y="78" width="7" height="12" rx="2" fill="#374151" />
                    <rect x="55" y="78" width="7" height="12" rx="2" fill="#374151" />
                    
                    {BODY_AREAS.map((area) => {
                      const zone = mapView === "front" ? area.zone?.front : area.zone?.back;
                      if (!zone) return null;
                      return (
                        <rect
                          key={area.id}
                          x={zone.x}
                          y={zone.y}
                          width={zone.w}
                          height={zone.h}
                          fill="transparent"
                          className="cursor-pointer hover:fill-primary/30 transition-colors"
                          onClick={() => handleAreaSelect(area.id, area.label)}
                          data-testid={`map-zone-${area.id}`}
                        />
                      );
                    })}
                  </svg>
                  
                  <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-muted-foreground">
                    {mapView === "front" ? "Front view" : "Back view"} - Tap an area
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "side" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Which side?
              </h1>
              <p className="text-muted-foreground text-sm">
                {assessmentData.bodyAreaLabel}
              </p>
            </div>

            <div className="grid gap-3">
              {SIDES.map((side) => (
                <Card
                  key={side.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleSideSelect(side.id)}
                  data-testid={`side-${side.id}`}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-foreground text-lg">{side.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "severity" && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                How uncomfortable does this feel right now?
              </h1>
              <p className="text-muted-foreground text-sm">
                {assessmentData.bodyAreaLabel} ({assessmentData.side})
              </p>
            </div>

            <div className="space-y-6 px-4">
              <div className="text-center">
                <span className={`text-5xl font-bold ${getSeverityColor(assessmentData.severity)}`}>
                  {assessmentData.severity}
                </span>
                <p className={`text-lg mt-2 ${getSeverityColor(assessmentData.severity)}`}>
                  {getSeverityLabel(assessmentData.severity)}
                </p>
              </div>

              <div data-testid="severity-slider-container">
                <input
                  type="range"
                  value={assessmentData.severity}
                  onChange={(e) => handleSeverityChange([parseInt(e.target.value)])}
                  min={1}
                  max={10}
                  step={1}
                  className="severity-slider w-full"
                  data-testid="slider-severity"
                  style={{
                    "--severity-color": assessmentData.severity >= 7 ? '#ef4444' : assessmentData.severity >= 4 ? '#0cc9a9' : '#22c55e',
                    background: `linear-gradient(to right, ${assessmentData.severity >= 7 ? '#ef4444' : assessmentData.severity >= 4 ? '#0cc9a9' : '#22c55e'} 0%, ${assessmentData.severity >= 7 ? '#ef4444' : assessmentData.severity >= 4 ? '#0cc9a9' : '#22c55e'} ${((assessmentData.severity - 1) / 9) * 100}%, #e5e7eb ${((assessmentData.severity - 1) / 9) * 100}%, #e5e7eb 100%)`
                  } as React.CSSProperties}
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1-3 Mild</span>
                <span>4-6 Moderate</span>
                <span>7-10 High</span>
              </div>
              
              {!severityConfirmed && (
                <p className="text-center text-sm text-muted-foreground" data-testid="severity-instruction">
                  Adjust the slider to set your discomfort level
                </p>
              )}
            </div>

            <Button
              onClick={handleNext}
              className="w-full"
              size="lg"
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "movement" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Does this limit how you move?
              </h1>
            </div>

            <RadioGroup
              value={assessmentData.movementImpact}
              onValueChange={(value) => setAssessmentData(prev => ({ ...prev, movementImpact: value }))}
              className="space-y-3"
            >
              {MOVEMENT_IMPACT_OPTIONS.map((option) => (
                <Card key={option.id} className={`cursor-pointer transition-colors ${assessmentData.movementImpact === option.id ? 'border-primary bg-primary/10' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value={option.id} id={option.id} data-testid={`movement-${option.id}`} />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer text-foreground">
                        {option.label}
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              className="w-full"
              size="lg"
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "training" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                How does this affect training?
              </h1>
            </div>

            <RadioGroup
              value={assessmentData.trainingImpact}
              onValueChange={(value) => setAssessmentData(prev => ({ ...prev, trainingImpact: value }))}
              className="space-y-3"
            >
              {TRAINING_IMPACT_OPTIONS.map((option) => (
                <Card key={option.id} className={`cursor-pointer transition-colors ${assessmentData.trainingImpact === option.id ? 'border-primary bg-primary/10' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value={option.id} id={`training-${option.id}`} data-testid={`training-${option.id}`} />
                      <Label htmlFor={`training-${option.id}`} className="flex-1 cursor-pointer text-foreground">
                        {option.label}
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              className="w-full"
              size="lg"
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "trigger" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                When do you notice it most?
              </h1>
            </div>

            <RadioGroup
              value={assessmentData.primaryTrigger}
              onValueChange={(value) => setAssessmentData(prev => ({ ...prev, primaryTrigger: value }))}
              className="space-y-3"
            >
              {TRIGGER_OPTIONS.map((option) => (
                <Card key={option.id} className={`cursor-pointer transition-colors ${assessmentData.primaryTrigger === option.id ? 'border-primary bg-primary/10' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value={option.id} id={`trigger-${option.id}`} data-testid={`trigger-${option.id}`} />
                      <Label htmlFor={`trigger-${option.id}`} className="flex-1 cursor-pointer text-foreground">
                        {option.label}
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              className="w-full"
              size="lg"
              disabled={!canProceed()}
              data-testid="button-complete"
            >
              Complete Assessment <Check className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "results" && guidance && (
          <div className="space-y-6">
            <div className="text-center border-b border-border pb-4">
              <h1 className="text-2xl font-bold text-foreground capitalize">
                {guidance.areaConfirmation}
              </h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`text-lg font-semibold ${getSeverityColor(assessmentData.severity)}`}>
                  Severity: {assessmentData.severity}/10
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground">What's usually behind this</h3>
                <p className="text-muted-foreground text-sm">{guidance.whatsBehindThis}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-foreground">What this means today</h3>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-primary">Training</h4>
                    <p className="text-muted-foreground text-sm">{guidance.trainingGuidance}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-primary">Daily Movement</h4>
                    <p className="text-muted-foreground text-sm">{guidance.dailyGuidance}</p>
                  </div>
                  
                  {guidance.deskGuidance && (
                    <div>
                      <h4 className="text-sm font-medium text-primary">Desk Work</h4>
                      <p className="text-muted-foreground text-sm">{guidance.deskGuidance}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground">What to be careful with for now</h3>
                <ul className="space-y-1">
                  {guidance.cautions.map((caution, i) => (
                    <li key={i} className="text-muted-foreground text-sm flex items-start gap-2">
                      <span className="text-[#0cc9a9] mt-1">•</span>
                      <span>{caution}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Check back in</h3>
                  <p className="text-muted-foreground text-sm">
                    {guidance.reassessmentDays === 2 
                      ? "48-72 hours" 
                      : `${guidance.reassessmentDays} days`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={resetAssessment}
                variant="outline"
                className="flex-1"
                size="lg"
                data-testid="button-new-assessment"
              >
                New Assessment
              </Button>
              <Button
                onClick={() => navigate("/recovery")}
                className="flex-1"
                size="lg"
                data-testid="button-done"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {step === "history" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Assessment History
              </h1>
            </div>

            {historyLogs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No assessments yet</p>
                  <Button onClick={() => setStep("area")} className="mt-4">
                    Start Your First Assessment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {historyLogs.map((log, index) => (
                  <Card key={log.id} data-testid={`history-entry-${log.id}`}>
                    <CardContent className="p-4" data-testid={`history-card-${index}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-foreground capitalize" data-testid={`history-body-part-${index}`}>
                            {log.side ? `${log.side} ` : ""}{log.bodyPart?.replace(/_/g, " ")}
                          </h3>
                          <p className="text-muted-foreground text-sm" data-testid={`history-date-${index}`}>
                            {log.createdAt ? formatDateTime(new Date(log.createdAt)) : "Unknown date"}
                          </p>
                        </div>
                        <div className={`text-lg font-bold ${getSeverityColor(log.severity)}`} data-testid={`history-severity-${index}`}>
                          {log.severity}/10
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button
              onClick={() => setStep("area")}
              className="w-full"
              size="lg"
              data-testid="button-new-from-history"
            >
              New Assessment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
