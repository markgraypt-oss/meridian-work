import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { format, addDays } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import type { BodyMapLog, BodyMapArea, BodyMapGuidanceRule, BodyMapMovementOption, BodyMapOutcome, ReassessmentReminder } from "@shared/schema";
import EnhancedBodyMap from "@/components/EnhancedBodyMap";
import { RecoveryPlanDialog } from "@/components/RecoveryPlanDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopHeader from "@/components/TopHeader";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Check, History, AlertTriangle, Clock, Trash2, Info, ArrowLeftRight, Dumbbell, RotateCcw, MoreVertical, Settings, Bell, Sparkles, Send, ThumbsUp, ThumbsDown, Loader2, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { ExerciseLibraryItem, Program } from "@shared/schema";
import { MOVEMENT_LIMITATIONS_BY_AREA } from "@shared/bodyMapDefaults";

const BODY_AREAS = [
  { id: "neck", label: "Neck" },
  { id: "shoulder", label: "Shoulder" },
  { id: "elbow", label: "Elbow" },
  { id: "wrist_hand", label: "Wrist and hand" },
  { id: "upper_back", label: "Upper back" },
  { id: "lower_back", label: "Lower back" },
  { id: "hip", label: "Hip" },
  { id: "quadriceps", label: "Quadriceps (front of thigh)" },
  { id: "hamstrings", label: "Hamstrings (back of thigh)" },
  { id: "knee", label: "Knee" },
  { id: "calf", label: "Calf" },
  { id: "ankle_foot", label: "Ankle and foot" },
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

type Step = "area" | "side" | "severity" | "movement" | "movement_followup" | "training" | "trigger" | "results" | "history" | "history_detail" | "settings";

interface AssessmentData {
  bodyArea: string;
  bodyAreaLabel: string;
  side: string;
  severity: number;
  movementImpact: string;
  movementLimitations: string[];
  trainingImpact: string;
  primaryTrigger: string;
  x: number;
  y: number;
  view: "front" | "back";
}

interface SubstitutionPool {
  allowedPatterns?: string[];
  substituteExerciseIds?: number[];
  coachingNote?: string;
}

interface GuidanceResult {
  areaConfirmation: string;
  whatsBehindThis: string;
  trainingGuidance: string;
  dailyGuidance: string;
  deskGuidance: string;
  cautions: string[];
  reassessmentDays: number;
  showProgrammeImpact: boolean;
  programmeImpactSummary: string | null;
  substitutionPool: SubstitutionPool | null;
  flaggingRules: {
    movementPatterns: string[];
    equipment: string[];
    level: string[];
    mechanics: string[];
    muscles: string[];
    excludeTags: string[];
  } | null;
  recommendRecoveryProgramme: boolean;
  recoveryProgrammeId: number | null;
  recoveryProgrammeReason: string | null;
  matchedOutcomeId: number | null;
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

function generateGuidance(data: AssessmentData): GuidanceResult {
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
  
  if (trainingImpact === "cannot_train") {
    trainingGuidance = "Avoid loading this area temporarily. Substitute with exercises that don't stress this region.";
  } else if (trainingImpact === "limited") {
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
    showProgrammeImpact: false,
    programmeImpactSummary: null,
    substitutionPool: null,
    flaggingRules: null,
    recommendRecoveryProgramme: false,
    recoveryProgrammeId: null,
    recoveryProgrammeReason: null,
    matchedOutcomeId: null,
  };
}

interface BodyMapUnifiedProps {
  onExit?: () => void;
  initialArea?: string | null;
  embedded?: boolean;
}

export default function BodyMapUnified({ onExit, initialArea, embedded = false }: BodyMapUnifiedProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { formatDate, formatDateTime } = useFormattedDate();
  const [step, setStep] = useState<Step>("area");
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [mapView, setMapView] = useState<"front" | "back">("front");
  const [severityConfirmed, setSeverityConfirmed] = useState(false);
  const [savedLogId, setSavedLogId] = useState<number | null>(null);
  const [recoveryPlanId, setRecoveryPlanId] = useState<number | null>(null);
  const [isRecoveryPlanDialogOpen, setIsRecoveryPlanDialogOpen] = useState(false);
  const [isReviewChangesDialogOpen, setIsReviewChangesDialogOpen] = useState(false);
  const [modificationsStatus, setModificationsStatus] = useState<'none' | 'accepted' | 'declined'>('none');
  const [recoveryPlanStatus, setRecoveryPlanStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [restorationStatus, setRestorationStatus] = useState<'none' | 'restored' | 'kept'>('none');
  const [guidanceResult, setGuidanceResult] = useState<GuidanceResult | null>(null);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<BodyMapLog | null>(null);
  
  // Recovery Coach state
  const [recoveryCoachOpen, setRecoveryCoachOpen] = useState(false);
  const [recoveryCoachMessages, setRecoveryCoachMessages] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  const [recoveryCoachInput, setRecoveryCoachInput] = useState('');
  const [recoveryCoachLoading, setRecoveryCoachLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({});

  // History edit mode state
  const [isHistoryEditMode, setIsHistoryEditMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // State for exercise substitution selection
  const [substitutionSelections, setSubstitutionSelections] = useState<Record<number, number>>({});
  const [previewData, setPreviewData] = useState<{
    flaggedExercises: Array<{
      exerciseInstanceId: number;
      exerciseId: number;
      exerciseName: string;
      exerciseImageUrl: string | null;
      workoutName: string;
      weekNumber: number;
      dayNumber: number;
      reason: string;
      reasonType: 'movement_pattern' | 'equipment' | 'level';
    }>;
    substituteOptions: Array<{
      id: number;
      name: string;
      movementPatterns: string[];
      equipment: string[];
      imageUrl: string | null;
    }>;
    enrollmentId: number | null;
    flaggingCriteria: {
      movementPatterns: string[];
      equipment: string[];
      levels: string[];
    };
  } | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    bodyArea: "",
    bodyAreaLabel: "",
    side: "",
    severity: 5,
    movementImpact: "",
    movementLimitations: [],
    trainingImpact: "",
    primaryTrigger: "",
    x: 0,
    y: 0,
    view: "front",
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

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const { data: bodyMapLogs = [] } = useQuery<BodyMapLog[]>({
    queryKey: ["/api/body-map"],
    enabled: isAuthenticated,
  });

  // Fetch body areas from admin configuration
  const { data: configuredAreas = [] } = useQuery<BodyMapArea[]>({
    queryKey: ["/api/body-map-config/areas"],
  });

  // Fetch universal guidance rules
  const { data: guidanceRules = [] } = useQuery<BodyMapGuidanceRule[]>({
    queryKey: ["/api/body-map-config/guidance-rules"],
  });

  // Fetch due reassessment reminders to show badges on body areas
  const { data: dueReminders = [] } = useQuery<ReassessmentReminder[]>({
    queryKey: ["/api/reassessment-reminders/due"],
    enabled: isAuthenticated,
  });

  // Fetch notification preferences for body map settings
  const { data: notificationPrefs } = useQuery<{
    bodyMapReassessment: boolean;
    bodyMapFrequencyDays: number;
  }>({
    queryKey: ["/api/user/notifications"],
    enabled: isAuthenticated,
  });

  // Body map settings state
  const [bodyMapSettings, setBodyMapSettings] = useState({
    reassessmentEnabled: false,
    frequencyDays: 14,
  });

  // Sync settings state with fetched preferences
  useEffect(() => {
    if (notificationPrefs) {
      setBodyMapSettings({
        reassessmentEnabled: notificationPrefs.bodyMapReassessment ?? false,
        frequencyDays: notificationPrefs.bodyMapFrequencyDays ?? 14,
      });
    }
  }, [notificationPrefs]);

  // Mutation to update body map settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { bodyMapReassessment?: boolean; bodyMapFrequencyDays?: number }) => {
      return apiRequest('PATCH', '/api/user/notifications', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/notifications'] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  // Create a set of body areas that have due reminders
  const dueAreas = new Set(dueReminders.map(r => r.bodyArea));

  // Handle initialArea prop - auto-select area and go to side selection
  useEffect(() => {
    if (initialArea && step === "area" && configuredAreas.length > 0) {
      const area = configuredAreas.find(a => a.name === initialArea);
      if (area) {
        setAssessmentData(prev => ({ 
          ...prev, 
          bodyArea: area.name, 
          bodyAreaLabel: area.displayName || area.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          x: 0, y: 0, view: "front" 
        }));
        setStep("side");
      }
    }
  }, [initialArea, step, configuredAreas]);

  // Fetch all exercises for displaying substitute exercise names in the dialog
  const { data: allExercises = [] } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: isAuthenticated && step === "results",
  });

  // Fetch all programs for displaying recovery programme name in the dialog
  const { data: allPrograms = [] } = useQuery<Program[]>({
    queryKey: ["/api/programs"],
    enabled: isAuthenticated && step === "results",
  });

  // Track recovery programme ID separately in state (persists after guidanceResult changes)
  const [savedRecoveryProgrammeId, setSavedRecoveryProgrammeId] = useState<number | null>(null);
  
  // Sync recovery programme ID from guidanceResult when available
  useEffect(() => {
    if (guidanceResult?.recoveryProgrammeId) {
      setSavedRecoveryProgrammeId(guidanceResult.recoveryProgrammeId);
    }
  }, [guidanceResult?.recoveryProgrammeId]);
  
  // Use saved ID for queries
  const recoveryProgrammeId = savedRecoveryProgrammeId;
  
  // Fetch recovery programme details when we have a recoveryProgrammeId
  const { data: recoveryProgramme } = useQuery<{
    id: number;
    title: string;
    description: string;
    weeks: number;
    trainingDaysPerWeek: number;
    duration: number;
    difficulty: string;
    imageUrl?: string;
  }>({
    queryKey: [`/api/programs/${recoveryProgrammeId}`],
    enabled: isAuthenticated && step === "results" && !!recoveryProgrammeId,
  });

  // Fetch programme workouts count
  const { data: programmeWorkouts = [] } = useQuery<any[]>({
    queryKey: [`/api/programs/${recoveryProgrammeId}/workouts`],
    enabled: isAuthenticated && step === "results" && !!recoveryProgrammeId,
  });

  // Fetch pending recovery plan for Programme Impact section
  const { data: pendingRecoveryPlan, refetch: refetchPendingPlan } = useQuery<{
    hasPendingPlan: boolean;
    recoveryPlanId: number | null;
    modificationsCount: number;
    planTitle?: string;
  }>({
    queryKey: ["/api/recovery-plans/pending"],
    enabled: isAuthenticated && step === "results",
  });

  // Mutation to reject all modifications (Keep my programme as is)
  const rejectAllMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest(`/api/recovery-plans/${planId}/reject-all`, "POST");
    },
    onSuccess: () => {
      toast({ title: "Got it", description: "Your programme will stay as is." });
      refetchPendingPlan();
      queryClient.invalidateQueries({ queryKey: ['/api/recovery-plans'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  });

  // Mutation to preview flagged exercises for user selection
  const previewModificationsMutation = useMutation({
    mutationFn: async (data: { outcomeId: number }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/preview", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      setPreviewData(response);
      // Initialize selections with first substitute for each flagged exercise
      const initialSelections: Record<number, number> = {};
      if (response.flaggedExercises && response.substituteOptions?.length > 0) {
        response.flaggedExercises.forEach((flagged: any) => {
          // Find first substitute that isn't the same as the flagged exercise
          const validSubstitute = response.substituteOptions.find(
            (sub: any) => sub.id !== flagged.exerciseId
          );
          if (validSubstitute) {
            initialSelections[flagged.exerciseInstanceId] = validSubstitute.id;
          }
        });
      }
      setSubstitutionSelections(initialSelections);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to load exercise preview.", variant: "destructive" });
    }
  });

  // Mutation to accept programme modifications (Apply changes)
  const acceptModificationsMutation = useMutation({
    mutationFn: async (data: { outcomeId: number; bodyMapLogId?: number; selections?: Array<{ exerciseInstanceId: number; chosenSubstituteExerciseId: number }> }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/accept", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      const { substitutionsApplied, substitutionsFailed } = response;
      let description = `${substitutionsApplied} exercise${substitutionsApplied !== 1 ? 's' : ''} updated.`;
      if (substitutionsFailed > 0) {
        description += ` ${substitutionsFailed} couldn't be substituted (no valid alternatives).`;
      }
      toast({ title: "Changes applied", description });
      setModificationsStatus('accepted');
      setIsReviewChangesDialogOpen(false);
      setIsConfirmDialogOpen(false);
      setPreviewData(null);
      setSubstitutionSelections({});
      queryClient.invalidateQueries({ queryKey: ['/api/user/enrollments'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply changes. Please try again.", variant: "destructive" });
    }
  });

  // Mutation to decline programme modifications (Keep as is)
  const declineModificationsMutation = useMutation({
    mutationFn: async (data: { outcomeId: number; bodyMapLogId?: number }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/decline", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Got it", description: "Your programme will stay as is." });
      setModificationsStatus('declined');
      setIsReviewChangesDialogOpen(false);
      setPreviewData(null);
      setSubstitutionSelections({});
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  });

  // Mutation to accept/decline recovery plan (separate from programme modifications)
  const recoveryPlanDecisionMutation = useMutation({
    mutationFn: async (data: { recoveryPlanId: number; decision: 'accepted' | 'declined' }) => {
      const res = await apiRequest("POST", "/api/recovery-plan-decision", data);
      return res.json();
    },
    onSuccess: (response: any, variables) => {
      const { decision } = variables;
      setRecoveryPlanStatus(decision);
      setIsRecoveryPlanDialogOpen(false);
      if (decision === 'accepted') {
        toast({ 
          title: "Recovery programme accepted", 
          description: response.recoveryEnrolled ? "Recovery programme added to your training." : "Recovery programme saved."
        });
      } else {
        toast({ title: "Recovery programme declined" });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/user/enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recovery-plans/pending'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  });

  // Step 5: State for restorable substitutions
  const [restorableData, setRestorableData] = useState<{
    hasRestorable: boolean;
    matchedOutcomeId?: number;
    modificationRecordId?: number;
    substitutions?: Array<{
      id: number;
      exerciseInstanceId: number;
      originalExerciseId: number;
      originalExerciseName: string;
      originalImageUrl: string | null;
      substitutedExerciseId: number;
      substitutedExerciseName: string;
      substitutedImageUrl: string | null;
      workoutName: string;
    }>;
  } | null>(null);
  
  // Restoration dialog state
  const [isRestorationDialogOpen, setIsRestorationDialogOpen] = useState(false);
  const [restorationSelections, setRestorationSelections] = useState<Record<number, boolean>>({}); // id -> true = restore original
  const [restorationConfirmStep, setRestorationConfirmStep] = useState<'select' | 'confirm'>('select');

  // Step 5: Mutation to restore original exercises (selective)
  const restoreSubstitutionsMutation = useMutation({
    mutationFn: async (data: { matchedOutcomeId: number; bodyMapLogId: number; mappingIdsToRestore?: number[]; modificationRecordId?: number }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/restore", data);
      return res.json();
    },
    onSuccess: (response: any) => {
      const restoredCount = response.restoredCount || 0;
      const keptCount = response.keptCount || 0;
      let description = "";
      if (restoredCount > 0 && keptCount > 0) {
        description = `${restoredCount} exercise${restoredCount !== 1 ? 's' : ''} restored, ${keptCount} kept as substitutes.`;
      } else if (restoredCount > 0) {
        description = `${restoredCount} exercise${restoredCount !== 1 ? 's' : ''} restored to original.`;
      } else {
        description = "All substitutes have been kept.";
      }
      toast({ title: "Changes Applied", description });
      setRestorationStatus('restored');
      setRestorableData(null);
      setIsRestorationDialogOpen(false);
      setRestorationConfirmStep('select');
      setRestorationSelections({});
      queryClient.invalidateQueries({ queryKey: ['/api/user/enrollments'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply changes. Please try again.", variant: "destructive" });
    }
  });

  // Step 5: Mutation to keep current setup (mark as cleared but don't restore)
  const keepCurrentSetupMutation = useMutation({
    mutationFn: async (data: { matchedOutcomeId: number; bodyMapLogId: number }) => {
      const res = await apiRequest("POST", "/api/programme-modifications/keep-current", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "All Set", description: "Your current exercise setup will be kept." });
      setRestorationStatus('kept');
      setRestorableData(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  });

  // Step 5: Fetch restorable substitutions when results are shown
  const fetchRestorableSubstitutions = async (bodyArea: string) => {
    try {
      const res = await fetch(`/api/programme-modifications/restorable?bodyArea=${encodeURIComponent(bodyArea)}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRestorableData(data);
      }
    } catch (error) {
      console.error("Error fetching restorable substitutions:", error);
    }
  };

  // Helper to cycle to the next substitute option for a flagged exercise
  // Options: [...substitute options, Keep current (original exercise at end)]
  const cycleSubstitute = (exerciseInstanceId: number, exerciseId: number, direction: 'next' | 'prev') => {
    if (!previewData?.substituteOptions) return;
    
    // Create options array: substitutes first, then "Keep current" (original exercise ID) at end
    const substitutes = previewData.substituteOptions.filter(s => s.id !== exerciseId);
    // Options array: substitutes followed by original exercise ID (keep current) at the end
    const optionIds = [...substitutes.map(s => s.id), exerciseId];
    if (optionIds.length <= 1) return; // Only "keep current" available, no substitutes
    
    const currentSelection = substitutionSelections[exerciseInstanceId];
    const currentIndex = optionIds.findIndex(id => id === currentSelection);
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % optionIds.length;
    } else {
      newIndex = currentIndex <= 0 ? optionIds.length - 1 : currentIndex - 1;
    }
    
    setSubstitutionSelections(prev => ({
      ...prev,
      [exerciseInstanceId]: optionIds[newIndex]
    }));
  };

  // Find the numeric area ID for the selected body area
  const selectedAreaConfig = configuredAreas.find(a => a.name === assessmentData.bodyArea);
  
  // Fetch outcomes from API for selected area
  // IMPORTANT: queryKey[0] must be the full URL - the default fetcher uses it directly
  const { data: areaOutcomes = [] } = useQuery<BodyMapOutcome[]>({
    queryKey: [`/api/body-map-config/areas/${selectedAreaConfig?.id}/outcomes`],
    enabled: !!selectedAreaConfig?.id,
    staleTime: 0, // Always refetch
  });

  // Find outcome that triggers follow-up based on severity and training impact
  // The wizard flow is: severity → movement → training → movement_followup → results
  // Training is now collected BEFORE movement_followup, so we can filter by it
  const findFollowUpOutcome = (): BodyMapOutcome | null => {
    if (!areaOutcomes.length) return null;
    
    const { severity, trainingImpact } = assessmentData;
    
    // Map user's training impact answer to outcome values
    const trainingMap: Record<string, string> = {
      "normal": "normal",
      "limited": "limited",
      "cannot_train": "cannot_train",
      "stopped": "stopped"
    };
    const mappedTraining = trainingMap[trainingImpact] || trainingImpact;
    
    // Find outcomes that trigger follow-up and match severity range + training impact
    const matchingOutcomes = areaOutcomes
      .filter(o => o.isActive && o.triggersFollowUp)
      .filter(o => severity >= (o.severityMin ?? 0) && severity <= (o.severityMax ?? 10))
      .filter(o => !o.trainingImpact || o.trainingImpact === mappedTraining)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    return matchingOutcomes.length > 0 ? matchingOutcomes[0] : null;
  };

  const followUpOutcome = findFollowUpOutcome();

  // Check if any outcome triggers a follow-up question
  // This function computes the matching outcome fresh with the passed trainingImpact value
  const shouldShowFollowUp = (movementImpact: string, trainingImpact: string): boolean => {
    if (!areaOutcomes.length) return false;
    
    const { severity } = assessmentData;
    
    // Map user's training impact answer to outcome values
    const trainingMap: Record<string, string> = {
      "normal": "normal",
      "limited": "limited",
      "cannot_train": "cannot_train",
      "stopped": "stopped"
    };
    const mappedTraining = trainingMap[trainingImpact] || trainingImpact;
    
    // Find outcomes that trigger follow-up and match conditions
    const matchingOutcome = areaOutcomes
      .filter(o => o.isActive && o.triggersFollowUp)
      .filter(o => severity >= (o.severityMin ?? 0) && severity <= (o.severityMax ?? 10))
      .filter(o => !o.trainingImpact || o.trainingImpact === mappedTraining)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    
    // Only show follow-up if there's a matching outcome with actual follow-up content
    if (matchingOutcome && matchingOutcome.followUpQuestion && 
        Array.isArray(matchingOutcome.followUpAnswers) && matchingOutcome.followUpAnswers.length > 0) {
      return true;
    }
    // Fallback: show follow-up if training is limited/cannot_train even without configured outcome
    if (!matchingOutcome && (trainingImpact === "limited" || trainingImpact === "cannot_train")) {
      return true;
    }
    return false;
  };

  // Get movement options - ALWAYS use the shared catalogue for the body area
  // The outcome's followUpAnswers is metadata for guidance/analytics, NOT for controlling UI options
  const movementOptions = MOVEMENT_LIMITATIONS_BY_AREA[assessmentData.bodyArea] || [];
  
  // Get the custom follow-up question text if available
  const followUpQuestionText = followUpOutcome?.followUpQuestion || "Which movements cause discomfort?";

  // Use configured areas if available, fallback to hardcoded
  const bodyAreas = configuredAreas.length > 0 
    ? configuredAreas.sort((a, b) => a.orderIndex - b.orderIndex).map(a => ({ id: a.name, label: a.displayName, description: a.description }))
    : BODY_AREAS.map(a => ({ ...a, description: null }));

  // Find the best matching outcome based on all assessment conditions
  const findMatchingOutcome = (data: AssessmentData): BodyMapOutcome | null => {
    if (!areaOutcomes.length) return null;
    
    const { severity, trainingImpact, movementImpact } = data;
    
    // Map training impact values
    const trainingMap: Record<string, string> = {
      "normal": "normal",
      "limited": "limited",
      "cannot_train": "cannot_train",
      "stopped": "stopped"
    };
    const mappedTraining = trainingMap[trainingImpact] || trainingImpact;
    
    // Find outcomes that match all conditions
    const matchingOutcomes = areaOutcomes
      .filter(o => o.isActive)
      .filter(o => severity >= (o.severityMin ?? 0) && severity <= (o.severityMax ?? 10))
      .filter(o => !o.trainingImpact || o.trainingImpact === mappedTraining)
      .filter(o => !o.movementImpact || o.movementImpact === movementImpact)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    return matchingOutcomes.length > 0 ? matchingOutcomes[0] : null;
  };

  // Generate guidance using database rules
  const generateGuidanceFromRules = (data: AssessmentData): GuidanceResult => {
    const { bodyAreaLabel, side, severity, movementImpact, trainingImpact, primaryTrigger } = data;
    
    const sideText = side === "both" ? "Both sides" : `${side.charAt(0).toUpperCase() + side.slice(1)} side`;
    const areaConfirmation = `${sideText} ${bodyAreaLabel.toLowerCase()} discomfort`;
    
    // Check for matching outcome first (new outcomes-based system)
    const matchedOutcome = findMatchingOutcome(data);
    
    // Get "What's behind this" from configured area or outcome
    const configuredArea = configuredAreas.find(a => a.name === data.bodyArea || a.displayName === bodyAreaLabel);
    let whatsBehindThis = matchedOutcome?.whatsGoingOn || configuredArea?.description || generateGuidance(data).whatsBehindThis;
    
    // Find matching guidance rules (legacy system)
    const findMatchingRule = (ruleType: string, field: string, value: string | number): string | null => {
      const relevantRules = guidanceRules
        .filter(r => r.ruleType === ruleType && r.conditionField === field)
        .sort((a, b) => b.priority - a.priority);
      
      for (const rule of relevantRules) {
        if (rule.conditionOperator === "equals" && rule.conditionValue === String(value)) {
          return rule.guidanceText;
        }
        if (rule.conditionOperator === "range") {
          const min = parseInt(rule.conditionValue);
          const max = rule.conditionValueMax ? parseInt(rule.conditionValueMax) : min;
          if (typeof value === "number" && value >= min && value <= max) {
            return rule.guidanceText;
          }
        }
      }
      return null;
    };
    
    // Use outcome content if available, otherwise fall back to legacy rules
    let trainingGuidance = matchedOutcome?.trainingGuidance 
      || findMatchingRule("training", "trainingImpact", trainingImpact)
      || findMatchingRule("training", "severity", severity)
      || generateGuidance(data).trainingGuidance;
    
    let dailyGuidance = matchedOutcome?.dailyMovement
      || findMatchingRule("daily", "movementImpact", movementImpact)
      || findMatchingRule("daily", "severity", severity)
      || generateGuidance(data).dailyGuidance;
    
    let deskGuidance = matchedOutcome?.deskWorkTips
      || findMatchingRule("desk", "trigger", primaryTrigger)
      || generateGuidance(data).deskGuidance;
    
    // Cautions - use outcome content or collect all matching caution rules
    let cautions: string[] = [];
    if (matchedOutcome?.thingsToWatch) {
      cautions.push(matchedOutcome.thingsToWatch);
    } else {
      const severityCaution = findMatchingRule("caution", "severity", severity);
      if (severityCaution) cautions.push(severityCaution);
      const movementCaution = findMatchingRule("caution", "movementImpact", movementImpact);
      if (movementCaution) cautions.push(movementCaution);
    }
    
    if (cautions.length === 0) {
      cautions.push("No major cautions at this time - continue with awareness");
    }
    
    // Reassessment days - use new reassessInDays field, fallback to legacy checkInAgain or hardcoded logic
    let reassessmentDays: number | null = null;
    if (matchedOutcome?.reassessInDays) {
      // New field: use directly
      reassessmentDays = matchedOutcome.reassessInDays;
    } else if (matchedOutcome?.checkInAgain) {
      // Legacy: parse from text field
      const checkInMatch = matchedOutcome.checkInAgain.match(/(\d+)/);
      if (checkInMatch) {
        reassessmentDays = parseInt(checkInMatch[1]);
      }
    }
    // Fallback to hardcoded logic if no outcome-based value
    if (reassessmentDays === null) {
      reassessmentDays = 7;
      if (severity >= 7) reassessmentDays = 2;
      else if (severity >= 4) reassessmentDays = 4;
    }
    
    // Extract substitution pool from outcome
    let substitutionPool: SubstitutionPool | null = null;
    const storedPool = matchedOutcome?.substitutionRules as SubstitutionPool | SubstitutionPool[] | null;
    if (storedPool) {
      if (Array.isArray(storedPool) && storedPool.length > 0) {
        // Legacy: merge all rules into single pool
        const mergedPatterns = new Set<string>();
        const mergedExerciseIds = new Set<number>();
        const coachingNotes: string[] = [];
        storedPool.forEach(rule => {
          (rule.allowedPatterns || []).forEach(p => mergedPatterns.add(p));
          (rule.substituteExerciseIds || []).forEach(id => mergedExerciseIds.add(id));
          if (rule.coachingNote) coachingNotes.push(rule.coachingNote);
        });
        substitutionPool = {
          allowedPatterns: Array.from(mergedPatterns),
          substituteExerciseIds: Array.from(mergedExerciseIds),
          coachingNote: coachingNotes.join(" | "),
        };
      } else if (!Array.isArray(storedPool)) {
        substitutionPool = storedPool;
      }
    }

    // Extract flagging rules from outcome
    const flaggingRules = matchedOutcome ? {
      movementPatterns: matchedOutcome.flaggingMovementPatterns || [],
      equipment: matchedOutcome.flaggingEquipment || [],
      level: matchedOutcome.flaggingLevel || [],
      mechanics: matchedOutcome.flaggingMechanics || [],
      muscles: matchedOutcome.flaggingMuscles || [],
      excludeTags: matchedOutcome.flaggingExcludeTags || [],
    } : null;

    return {
      areaConfirmation,
      whatsBehindThis,
      trainingGuidance,
      dailyGuidance,
      deskGuidance,
      cautions,
      reassessmentDays,
      showProgrammeImpact: matchedOutcome?.showProgrammeImpact || false,
      programmeImpactSummary: matchedOutcome?.programmeImpactSummary || null,
      substitutionPool,
      flaggingRules,
      recommendRecoveryProgramme: matchedOutcome?.recommendRecoveryProgramme || false,
      recoveryProgrammeId: matchedOutcome?.recoveryProgrammeId || null,
      recoveryProgrammeReason: matchedOutcome?.recoveryProgrammeReason || null,
      matchedOutcomeId: matchedOutcome?.id || null,
    };
  };

  const saveAssessmentMutation = useMutation({
    mutationFn: async (data: AssessmentData) => {
      const response = await apiRequest("POST", "/api/body-map", {
        bodyPart: data.bodyAreaLabel,
        severity: data.severity,
        x: data.x,
        y: data.y,
        view: data.view,
        side: data.side,
        movementImpact: data.movementImpact,
        movementLimitations: data.movementLimitations.length > 0 ? data.movementLimitations : null,
        trainingImpact: data.trainingImpact,
        primaryTrigger: data.primaryTrigger,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      
      if (data.id) {
        setSavedLogId(data.id);
      }
      
      if (data.recoveryPlanId) {
        setRecoveryPlanId(data.recoveryPlanId);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save assessment",
        variant: "destructive",
      });
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/body-map/log/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      toast({
        title: "Deleted",
        description: "Assessment deleted successfully",
      });
      setSelectedHistoryLog(null);
      setStep("history");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete assessment",
        variant: "destructive",
      });
    },
  });

  const deleteMultipleAssessmentsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("DELETE", `/api/body-map/log/${id}`, {}))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map"] });
      toast({
        title: "Deleted",
        description: `${selectedLogIds.size} assessment${selectedLogIds.size !== 1 ? 's' : ''} deleted successfully`,
      });
      setSelectedLogIds(new Set());
      setIsHistoryEditMode(false);
      setIsDeleteConfirmOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete assessments",
        variant: "destructive",
      });
    },
  });

  const handleAreaSelectFromList = (areaId: string, areaLabel: string) => {
    setAssessmentData(prev => ({ ...prev, bodyArea: areaId, bodyAreaLabel: areaLabel, x: 0, y: 0, view: "front" }));
    setStep("side");
  };

  const handleAreaSelectFromMap = (bodyPart: string, x: number, y: number, view: "front" | "back") => {
    const matchedArea = bodyAreas.find(a => 
      bodyPart.toLowerCase().includes(a.id.replace(/_/g, ' ')) || 
      a.label.toLowerCase() === bodyPart.toLowerCase()
    );
    setAssessmentData(prev => ({ 
      ...prev, 
      bodyArea: matchedArea?.id || bodyPart.toLowerCase().replace(/\s+/g, '_'), 
      bodyAreaLabel: bodyPart,
      x, y, view 
    }));
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
        // Go to training first, then follow-up if needed
        setStep("training");
        break;
      case "training":
        // After training, check if we should show follow-up based on outcome + training impact
        if (shouldShowFollowUp(assessmentData.movementImpact, assessmentData.trainingImpact)) {
          setStep("movement_followup");
        } else {
          // Go directly to results
          const guidance = generateGuidanceFromRules(assessmentData);
          setGuidanceResult(guidance);
          saveAssessmentMutation.mutate(assessmentData, {
            onSuccess: (data) => {
              if (data.id) {
                setSavedLogId(data.id);
              }
              setStep("results");
            }
          });
        }
        break;
      case "movement_followup":
        // Go directly to results
        const guidanceFollowup = generateGuidanceFromRules(assessmentData);
        setGuidanceResult(guidanceFollowup);
        saveAssessmentMutation.mutate(assessmentData, {
          onSuccess: (data) => {
            if (data.id) {
              setSavedLogId(data.id);
            }
            setStep("results");
          }
        });
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
      case "movement_followup":
        setStep("training");
        break;
      case "results":
        if (shouldShowFollowUp(assessmentData.movementImpact, assessmentData.trainingImpact)) {
          setStep("movement_followup");
        } else {
          setStep("training");
        }
        break;
      case "history":
        setStep("area");
        break;
      case "history_detail":
        setStep("history");
        break;
      case "settings":
        setStep("history");
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
      movementLimitations: [],
      trainingImpact: "",
      primaryTrigger: "",
      x: 0,
      y: 0,
      view: "front",
    });
    setSeverityConfirmed(false);
    setGuidanceResult(null);
    setSavedLogId(null);
    setRestorableData(null);
    setModificationsStatus('none');
    setRestorationStatus('none');
    setIsRestorationDialogOpen(false);
    setRestorationSelections({});
    setRestorationConfirmStep('select');
    setRecoveryCoachOpen(false);
    setRecoveryCoachMessages([]);
    setRecoveryCoachInput('');
    setRecoveryCoachLoading(false);
    setFeedbackGiven({});
    setStep("area");
  };

  const sendRecoveryCoachMessage = async (messageText?: string) => {
    const text = messageText || recoveryCoachInput.trim();
    if (!text || recoveryCoachLoading) return;

    const userMsg = { role: 'user' as const, content: text };
    const newMessages = [...recoveryCoachMessages, userMsg];
    setRecoveryCoachMessages(newMessages);
    setRecoveryCoachInput('');
    setRecoveryCoachLoading(true);

    try {
      const response = await apiRequest('POST', '/api/recovery-coach/chat', {
        message: text,
        assessmentContext: {
          bodyArea: assessmentData.bodyAreaLabel,
          side: assessmentData.side,
          severity: assessmentData.severity,
          movementImpact: assessmentData.movementImpact,
          trainingImpact: assessmentData.trainingImpact,
          trigger: assessmentData.primaryTrigger,
          guidanceContent: guidanceResult ? {
            whatsBehindThis: guidanceResult.whatsBehindThis,
            trainingGuidance: guidanceResult.trainingGuidance,
            dailyGuidance: guidanceResult.dailyGuidance,
            deskGuidance: guidanceResult.deskGuidance,
            cautions: guidanceResult.cautions,
          } : undefined,
        },
        conversationHistory: newMessages,
      });
      const data = await response.json();
      setRecoveryCoachMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch {
      toast({ title: "Could not reach the Recovery Coach right now", variant: "destructive" });
      setRecoveryCoachMessages(recoveryCoachMessages);
      setRecoveryCoachInput(text);
    } finally {
      setRecoveryCoachLoading(false);
    }
  };

  const getRecoveryFeedbackKey = (content: string, idx: number) => `${idx}-${content.slice(0, 50)}`;

  const submitAiFeedback = async (feedbackKey: string, rating: 'positive' | 'negative', aiMessage: string, userMessage?: string) => {
    if (feedbackGiven[feedbackKey]) return;
    setFeedbackGiven(prev => ({ ...prev, [feedbackKey]: rating }));
    try {
      await apiRequest('POST', '/api/ai-feedback', {
        feature: 'recovery_coach',
        rating,
        aiMessage,
        userMessage,
        context: {
          bodyArea: assessmentData.bodyAreaLabel,
          severity: assessmentData.severity,
          matchedOutcomeId: guidanceResult?.matchedOutcomeId,
        },
      });
    } catch {
      // silently fail - feedback is non-critical
    }
  };
  
  // Initialize restoration selections when opening dialog (default all to restore)
  const openRestorationDialog = () => {
    if (restorableData?.substitutions) {
      const initialSelections: Record<number, boolean> = {};
      restorableData.substitutions.forEach(sub => {
        initialSelections[sub.id] = true; // Default to restore original
      });
      setRestorationSelections(initialSelections);
      setRestorationConfirmStep('select');
      setIsRestorationDialogOpen(true);
    }
  };
  
  // Toggle all restoration selections
  const toggleAllRestorations = (restoreAll: boolean) => {
    if (restorableData?.substitutions) {
      const newSelections: Record<number, boolean> = {};
      restorableData.substitutions.forEach(sub => {
        newSelections[sub.id] = restoreAll;
      });
      setRestorationSelections(newSelections);
    }
  };
  
  // Check if all are selected for restore - compute from current selections state
  const allSelectedForRestore = restorableData?.substitutions?.length 
    ? restorableData.substitutions.every(sub => restorationSelections[sub.id] === true)
    : false;

  // Recompute guidance when outcomes load (fixes async timing issue)
  useEffect(() => {
    if (step === "results" && areaOutcomes.length > 0 && assessmentData.bodyArea) {
      const guidance = generateGuidanceFromRules(assessmentData);
      setGuidanceResult(guidance);
    }
  }, [areaOutcomes, step]);

  // Step 5: Fetch restorable substitutions when results are shown
  // Only fetch if this assessment has NO training impact (restoration flow)
  // Training impact is determined by the outcome configuration, NOT severity
  useEffect(() => {
    if (step === "results" && assessmentData.bodyArea && guidanceResult && savedLogId) {
      // Check if this outcome has training impact based on admin configuration:
      // - showProgrammeImpact must be true AND
      // - Must have flagging rules OR substitution exercises defined
      const pool = guidanceResult.substitutionPool;
      const flagging = guidanceResult.flaggingRules;
      const hasSubstitutes = (pool?.substituteExerciseIds?.length || 0) > 0;
      const hasFlaggingRules = (flagging?.movementPatterns?.length || 0) > 0 ||
                               (flagging?.muscles?.length || 0) > 0 ||
                               (flagging?.equipment?.length || 0) > 0 ||
                               (flagging?.level?.length || 0) > 0 ||
                               (flagging?.mechanics?.length || 0) > 0;
      
      const hasTrainingImpact = guidanceResult.showProgrammeImpact && (hasFlaggingRules || hasSubstitutes);
      
      // If NO training impact, this is a "cleared" state - show restoration flow
      if (!hasTrainingImpact) {
        fetchRestorableSubstitutions(assessmentData.bodyArea);
      }
    }
  }, [step, assessmentData.bodyArea, guidanceResult?.showProgrammeImpact, guidanceResult?.flaggingRules, guidanceResult?.substitutionPool, savedLogId]);

  const canProceed = () => {
    switch (step) {
      case "severity":
        return severityConfirmed;
      case "movement":
        return !!assessmentData.movementImpact;
      case "movement_followup":
        return assessmentData.movementLimitations.length > 0;
      case "training":
        return !!assessmentData.trainingImpact;
      default:
        return true;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const getHeaderBackAction = () => {
    if (step === "area") {
      return onExit;
    }
    if (step === "results") {
      return undefined;
    }
    if (step === "history") {
      return () => setStep("area");
    }
    if (step === "history_detail") {
      return () => setStep("history");
    }
    if (step === "settings") {
      return () => setStep("history");
    }
    return handleBack;
  };
  
  return (
    <div className={embedded ? "" : "bg-background min-h-screen"}>
      {!embedded && <TopHeader title="Body Map" onBack={getHeaderBackAction()} />}
      
      <div className={embedded ? "" : "px-4 py-4"}>
        <div className="max-w-lg mx-auto">
          
          {/* Step: Area Selection */}
          {step === "area" && (
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v) => {
                if (v === "history") {
                  setStep("history");
                } else {
                  setActiveTab(v as "list" | "map");
                }
              }} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="list" data-testid="tab-list" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">Text List</TabsTrigger>
                  <TabsTrigger value="map" data-testid="tab-map" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">Body Map</TabsTrigger>
                  <TabsTrigger value="history" data-testid="button-history" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">History</TabsTrigger>
                </TabsList>

                <h1 className="text-lg font-semibold text-foreground mt-2 mb-4">
                  Where are you feeling discomfort today?
                </h1>

                <TabsContent value="list" className="space-y-2">
                  {bodyAreas.map((area) => (
                    <Card 
                      key={area.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleAreaSelectFromList(area.id, area.label)}
                      data-testid={`area-${area.id}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-foreground">{area.label}</span>
                        {dueAreas.has(area.id) && (
                          <Badge variant="destructive" className="text-xs">
                            Due
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="map">
                  <Card>
                    <CardContent className="p-4">
                      <EnhancedBodyMap
                        view={mapView}
                        onBodyPartClick={handleAreaSelectFromMap}
                        existingLogs={bodyMapLogs}
                        onViewToggle={() => setMapView(mapView === "front" ? "back" : "front")}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step: Side Selection */}
          {step === "side" && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground mb-2">
                  Which side is affected?
                </h1>
                <p className="text-muted-foreground text-sm">{assessmentData.bodyAreaLabel}</p>
              </div>

              <div className="space-y-3">
                {SIDES.map((side) => (
                  <Card 
                    key={side.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
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

          {/* Step: Severity */}
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
                  {(() => {
                    const s = assessmentData.severity;
                    const col = s >= 7 ? '#ef4444' : s >= 4 ? '#0cc9a9' : '#22c55e';
                    const pct = ((s - 1) / 9) * 100;
                    return (
                      <input
                        type="range"
                        value={s}
                        onChange={(e) => handleSeverityChange([parseInt(e.target.value)])}
                        min={1}
                        max={10}
                        step={1}
                        className="severity-slider w-full"
                        data-testid="slider-severity"
                        ref={(el) => {
                          if (el) {
                            el.style.setProperty('--severity-color', col);
                            el.style.background = `linear-gradient(to right, ${col} 0%, ${col} ${pct}%, #d1d5db ${pct}%, #d1d5db 100%)`;
                          }
                        }}
                      />
                    );
                  })()}
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

          {/* Step: Movement Impact */}
          {step === "movement" && (() => {
            // Get movement question and options from area config, fallback to defaults
            const areaMovementOptions = selectedAreaConfig?.movementOptions as { id: string; label: string; orderIndex: number }[] | null;
            const currentMovementOptions = (areaMovementOptions && areaMovementOptions.length >= 2) 
              ? areaMovementOptions.sort((a, b) => a.orderIndex - b.orderIndex)
              : MOVEMENT_IMPACT_OPTIONS;
            const currentMovementQuestion = selectedAreaConfig?.movementQuestion || "Does this limit how you move?";
            
            return (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-xl font-semibold text-foreground mb-2">
                    {currentMovementQuestion}
                  </h1>
                </div>

                <RadioGroup
                  value={assessmentData.movementImpact}
                  onValueChange={(value) => setAssessmentData(prev => ({ ...prev, movementImpact: value }))}
                  className="space-y-3"
                >
                  {currentMovementOptions.map((option) => (
                    <Card 
                      key={option.id} 
                      className={`cursor-pointer transition-colors ${assessmentData.movementImpact === option.id ? 'border-primary bg-primary/10' : ''}`}
                      onClick={() => setAssessmentData(prev => ({ ...prev, movementImpact: option.id }))}
                    >
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
            );
          })()}

          {/* Step: Movement Follow-up (only shown when movement is restricted) */}
          {step === "movement_followup" && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground mb-2">
                  {followUpQuestionText}
                </h1>
                <p className="text-muted-foreground text-sm">Select all that apply</p>
              </div>

              <div className="space-y-3">
                {movementOptions.map((option) => {
                  const isSelected = assessmentData.movementLimitations.includes(option.id);
                  return (
                    <Card 
                      key={option.id} 
                      className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/10' : ''}`}
                      onClick={() => {
                        setAssessmentData(prev => ({
                          ...prev,
                          movementLimitations: isSelected
                            ? prev.movementLimitations.filter(m => m !== option.id)
                            : [...prev.movementLimitations, option.id]
                        }));
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div 
                            className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <Label className="flex-1 cursor-pointer text-foreground" data-testid={`movement-limitation-${option.id}`}>
                            {option.label}
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* All of the above option */}
                {movementOptions.length > 0 && (
                  <Card 
                    className={`cursor-pointer transition-colors ${
                      assessmentData.movementLimitations.length === movementOptions.length 
                        ? 'border-primary bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      const allOptions = movementOptions.map(o => o.id);
                      const allSelected = assessmentData.movementLimitations.length === allOptions.length;
                      setAssessmentData(prev => ({
                        ...prev,
                        movementLimitations: allSelected ? [] : allOptions
                      }));
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            assessmentData.movementLimitations.length === movementOptions.length 
                              ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {assessmentData.movementLimitations.length === movementOptions.length && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <Label className="flex-1 cursor-pointer text-foreground" data-testid="movement-limitation-all">
                          All of the above
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
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

          {/* Step: Training Impact */}
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
                  <Card 
                    key={option.id} 
                    className={`cursor-pointer transition-colors ${assessmentData.trainingImpact === option.id ? 'border-primary bg-primary/10' : ''}`}
                    onClick={() => setAssessmentData(prev => ({ ...prev, trainingImpact: option.id }))}
                  >
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

          {/* Step: Results */}
          {step === "results" && guidanceResult && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-bold text-foreground mb-2">
                  Your Personalized Guidance
                </h1>
              </div>

              <div className="space-y-5">
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-primary font-medium text-lg">{guidanceResult.areaConfirmation}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">What's Usually Behind This</h3>
                  <p className="text-muted-foreground text-sm">{guidanceResult.whatsBehindThis}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Training Guidance</h3>
                  <p className="text-muted-foreground text-sm">{guidanceResult.trainingGuidance}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Daily Movement</h3>
                  <p className="text-muted-foreground text-sm">{guidanceResult.dailyGuidance}</p>
                </div>

                {guidanceResult.deskGuidance && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Desk & Work Tips</h3>
                    <p className="text-muted-foreground text-sm">{guidanceResult.deskGuidance}</p>
                  </div>
                )}

                <div className="bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/20 rounded-lg p-4">
                  <h3 className="font-semibold text-[#0cc9a9] dark:text-[#0cc9a9] mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Things to Watch
                  </h3>
                  <ul className="text-sm text-[#0cc9a9] dark:text-[#0cc9a9] space-y-1">
                    {guidanceResult.cautions.map((caution, i) => (
                      <li key={i}>• {caution}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Reassess in {guidanceResult.reassessmentDays} day{guidanceResult.reassessmentDays !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reassess on {formatDate(addDays(new Date(), guidanceResult.reassessmentDays), 'full')}
                    </p>
                  </div>
                </div>

                {/* Recovery Coach Section */}
                <div className="border border-primary/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setRecoveryCoachOpen(!recoveryCoachOpen)}
                    className="w-full bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 flex items-center justify-between hover:from-primary/15 hover:to-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-foreground text-sm">Recovery Coach</h3>
                        <p className="text-xs text-muted-foreground">Ask questions about your assessment</p>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${recoveryCoachOpen ? 'rotate-90' : ''}`} />
                  </button>

                  {recoveryCoachOpen && (
                    <div className="border-t border-primary/20">
                      {recoveryCoachMessages.length === 0 && (
                        <div className="p-4 space-y-3">
                          <p className="text-xs text-muted-foreground text-center">Tap a question or type your own</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              `Why does my ${assessmentData.bodyAreaLabel?.toLowerCase() || 'area'} hurt?`,
                              "What stretches should I do?",
                              "Can I still train?",
                              "How long until it improves?",
                            ].map((suggestion) => (
                              <button
                                key={suggestion}
                                onClick={() => sendRecoveryCoachMessage(suggestion)}
                                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {recoveryCoachMessages.length > 0 && (
                        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                          {recoveryCoachMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                                <div className={`rounded-2xl px-3 py-2 text-sm ${
                                  msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                    : 'bg-muted text-foreground rounded-bl-md'
                                }`}>
                                  {msg.content}
                                </div>
                                {msg.role === 'assistant' && (() => {
                                  const fbKey = getRecoveryFeedbackKey(msg.content, i);
                                  return (
                                    <div className="flex items-center gap-1 mt-1 ml-1">
                                      <button
                                        onClick={() => submitAiFeedback(fbKey, 'positive', msg.content, recoveryCoachMessages[i - 1]?.content)}
                                        className={`p-1 rounded hover:bg-muted transition-colors ${feedbackGiven[fbKey] === 'positive' ? 'text-green-500' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                                        disabled={!!feedbackGiven[fbKey]}
                                      >
                                        <ThumbsUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => submitAiFeedback(fbKey, 'negative', msg.content, recoveryCoachMessages[i - 1]?.content)}
                                        className={`p-1 rounded hover:bg-muted transition-colors ${feedbackGiven[fbKey] === 'negative' ? 'text-red-500' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                                        disabled={!!feedbackGiven[fbKey]}
                                      >
                                        <ThumbsDown className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                          {recoveryCoachLoading && (
                            <div className="flex justify-start">
                              <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-t border-border p-3 flex gap-2">
                        <input
                          type="text"
                          value={recoveryCoachInput}
                          onChange={(e) => setRecoveryCoachInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendRecoveryCoachMessage()}
                          placeholder="Ask about your assessment..."
                          className="flex-1 bg-muted rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          disabled={recoveryCoachLoading}
                        />
                        <Button
                          size="icon"
                          className="rounded-full h-9 w-9 shrink-0"
                          onClick={() => sendRecoveryCoachMessage()}
                          disabled={!recoveryCoachInput.trim() || recoveryCoachLoading}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 5: Suggested Restorations Section
                    Shown when:
                    1. This is a NEW assessment (savedLogId is set)
                    2. Assessment indicates cleared state (severity = 0 or no programme impact)
                    3. AND there are restorable substitutions from a previous assessment
                */}
                {savedLogId && restorableData?.hasRestorable && restorableData.substitutions && restorableData.substitutions.length > 0 && (
                  <div className="bg-green-500/10 dark:bg-green-900/20 rounded-lg p-4" data-testid="section-suggested-restorations">
                    <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Suggested Restorations
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                      Great news! Your previous issue appears to be cleared. You can now restore your original exercises that were substituted.
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mb-4">
                      {restorableData.substitutions.length} exercise{restorableData.substitutions.length !== 1 ? 's' : ''} can be restored
                    </p>
                    <Button 
                      onClick={openRestorationDialog}
                      className="w-full"
                      data-testid="button-view-original-exercises"
                    >
                      View Original Exercises
                    </Button>
                  </div>
                )}

                {/* Restoration Confirmation - Shows after user decides on restorations */}
                {savedLogId && restorationStatus !== 'none' && (
                  <div className={`rounded-lg p-4 ${
                    restorationStatus === 'restored' 
                      ? 'bg-green-500/10 dark:bg-green-900/20' 
                      : 'bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/20'
                  }`} data-testid="section-restoration-confirmation">
                    <div className="flex items-center gap-2">
                      {restorationStatus === 'restored' ? (
                        <>
                          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <div>
                            <h3 className="font-semibold text-green-700 dark:text-green-400">Original Exercises Restored</h3>
                            <p className="text-sm text-green-600 dark:text-green-300">Your programme has been updated with the original exercises.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Check className="h-5 w-5 text-[#0cc9a9] dark:text-[#0cc9a9]" />
                          <div>
                            <h3 className="font-semibold text-[#0cc9a9] dark:text-[#0cc9a9]">Current Setup Kept</h3>
                            <p className="text-sm text-[#0cc9a9] dark:text-[#0cc9a9]">Your programme will continue with the current exercise selections.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Programme Impact Section - shown above Recovery Programme
                    Only shown when:
                    1. showProgrammeImpact is enabled for the matched outcome
                    2. AND EITHER: at least one allowed pattern OR at least one substitute exercise exists
                */}
                {(() => {
                  const pool = guidanceResult.substitutionPool;
                  const hasPatterns = (pool?.allowedPatterns?.length || 0) > 0;
                  const hasExercises = (pool?.substituteExerciseIds?.length || 0) > 0;
                  const shouldShow = guidanceResult.showProgrammeImpact && (hasPatterns || hasExercises);
                  
                  if (!shouldShow) return null;
                  
                  return (
                    <div className="bg-primary/10 rounded-lg p-4" data-testid="section-programme-impact">
                      <h3 className="font-semibold text-foreground mb-2">Programme Impact</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        {guidanceResult.programmeImpactSummary || "Based on your assessment, some adjustments may help keep training comfortable."}
                      </p>
                      <Button 
                        onClick={() => {
                          if (modificationsStatus === 'none') {
                            setIsReviewChangesDialogOpen(true);
                            if (guidanceResult.matchedOutcomeId) {
                              previewModificationsMutation.mutate({ outcomeId: guidanceResult.matchedOutcomeId });
                            }
                          }
                        }}
                        className={`w-full ${
                          modificationsStatus === 'accepted' 
                            ? 'bg-green-600 hover:bg-green-600 cursor-default' 
                            : modificationsStatus === 'declined'
                            ? 'bg-[#0cc9a9] hover:bg-[#0cc9a9] cursor-default'
                            : ''
                        }`}
                        disabled={modificationsStatus !== 'none'}
                        data-testid="button-review-changes"
                      >
                        {modificationsStatus === 'accepted' 
                          ? 'Changes accepted' 
                          : modificationsStatus === 'declined'
                          ? 'No changes applied'
                          : 'Review changes'}
                      </Button>
                    </div>
                  );
                })()}

                {/* Recovery Programme Section - Show programme card with details */}
                {recoveryPlanId && recoveryProgramme && (
                  <div className="border border-primary/30 rounded-lg overflow-hidden" data-testid="section-recovery-plan">
                    <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
                      <h3 className="font-semibold text-foreground">Recovery Programme</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="font-medium text-lg text-foreground">{recoveryProgramme.title}</h4>
                        {recoveryProgramme.description && (
                          <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{recoveryProgramme.description}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">Length</span>
                          <p className="font-medium">{recoveryProgramme.weeks} weeks</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">Frequency</span>
                          <p className="font-medium">{recoveryProgramme.trainingDaysPerWeek}x per week</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">Workouts</span>
                          <p className="font-medium">{programmeWorkouts.length} total</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">Duration</span>
                          <p className="font-medium">{recoveryProgramme.duration} min each</p>
                        </div>
                      </div>
                      
                      {recoveryPlanStatus === 'pending' ? (
                        <Button 
                          variant="outline"
                          onClick={() => setIsRecoveryPlanDialogOpen(true)}
                          className="w-full"
                          data-testid="button-view-recovery-plan"
                        >
                          View recovery programme
                        </Button>
                      ) : (
                        <Button 
                          className={`w-full cursor-default ${
                            recoveryPlanStatus === 'accepted' 
                              ? 'bg-green-600 hover:bg-green-600' 
                              : 'bg-muted hover:bg-muted text-muted-foreground'
                          }`}
                          disabled
                          data-testid="button-recovery-plan-status"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {recoveryPlanStatus === 'accepted' ? 'Programme accepted' : 'Programme declined'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setStep("history")} 
                    className="flex-1"
                    data-testid="button-view-history"
                  >
                    View History
                  </Button>
                  <Button 
                    onClick={resetAssessment} 
                    className="flex-1"
                    data-testid="button-done"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: History */}
          {step === "history" && (() => {
            // Group logs by body part
            const sortedLogs = [...bodyMapLogs].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
            const groupedLogs = sortedLogs.reduce((groups, log) => {
              const key = log.bodyPart || 'Unknown';
              if (!groups[key]) groups[key] = [];
              groups[key].push(log);
              return groups;
            }, {} as Record<string, typeof bodyMapLogs>);
            
            const allLogIds = sortedLogs.map(log => log.id);
            const allSelected = allLogIds.length > 0 && allLogIds.every(id => selectedLogIds.has(id));
            
            const toggleLogSelection = (id: number) => {
              const newSet = new Set(selectedLogIds);
              if (newSet.has(id)) {
                newSet.delete(id);
              } else {
                newSet.add(id);
              }
              setSelectedLogIds(newSet);
            };
            
            const toggleSelectAll = () => {
              if (allSelected) {
                setSelectedLogIds(new Set());
              } else {
                setSelectedLogIds(new Set(allLogIds));
              }
            };
            
            return (
              <div className="space-y-4">
                <Tabs value="history" onValueChange={(v) => {
                  if (v !== "history") {
                    setActiveTab(v as "list" | "map");
                    setStep("area");
                  }
                }} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="list" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">Text List</TabsTrigger>
                    <TabsTrigger value="map" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">Body Map</TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-[#0cc9a9] data-[state=active]:text-black">History</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex justify-between items-center">
                  <h1 className="text-xl font-semibold text-foreground">
                    Assessment History
                  </h1>
                  
                  {bodyMapLogs.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="history-menu-button">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setIsHistoryEditMode(!isHistoryEditMode);
                            if (isHistoryEditMode) {
                              setSelectedLogIds(new Set());
                            }
                          }}
                          data-testid="toggle-edit-mode"
                        >
                          {isHistoryEditMode ? "Cancel Edit" : "Edit"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setStep("settings")}
                          data-testid="open-settings"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Notification Settings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {isHistoryEditMode && bodyMapLogs.length > 0 && (
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedLogIds.size > 0 
                          ? `${selectedLogIds.size} selected` 
                          : "Select all"}
                      </span>
                    </div>
                    {selectedLogIds.size > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        data-testid="delete-selected-button"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({selectedLogIds.size})
                      </Button>
                    )}
                  </div>
                )}

                {bodyMapLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <p>No assessments logged yet. Start your first assessment to track your progress.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedLogs).map(([bodyPart, logs]) => (
                      <div key={bodyPart} className="space-y-3">
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                          {bodyPart}
                        </h2>
                        <div className="space-y-2">
                          {logs.map((log) => (
                            <Card 
                              key={log.id} 
                              className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                                selectedLogIds.has(log.id) ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => {
                                if (isHistoryEditMode) {
                                  toggleLogSelection(log.id);
                                } else {
                                  setSelectedHistoryLog(log);
                                  setStep("history_detail");
                                }
                              }}
                              data-testid={`history-log-${log.id}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  {isHistoryEditMode && (
                                    <Checkbox 
                                      checked={selectedLogIds.has(log.id)}
                                      onCheckedChange={() => toggleLogSelection(log.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                      data-testid={`log-checkbox-${log.id}`}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h3 className="font-semibold text-foreground" data-testid={`log-body-part-${log.id}`}>
                                          {log.bodyPart}
                                          {log.side && ` (${log.side})`}
                                        </h3>
                                        <p className="text-sm text-muted-foreground" data-testid={`log-date-${log.id}`}>
                                          {log.createdAt ? formatDateTime(new Date(log.createdAt)) : "Unknown date"}
                                        </p>
                                      </div>
                                      <span
                                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                                          log.severity >= 7 ? "text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400" :
                                          log.severity >= 4 ? "text-[#0cc9a9] bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/10 dark:text-[#0cc9a9]" :
                                          "text-green-600 bg-green-100 dark:bg-green-950 dark:text-green-400"
                                        }`}
                                        data-testid={`log-severity-${log.id}`}
                                      >
                                        {getSeverityLabel(log.severity)} ({log.severity}/10)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Step: History Detail */}
          {step === "history_detail" && selectedHistoryLog && (() => {
            const logGuidance = generateGuidanceFromRules({
              bodyArea: selectedHistoryLog.bodyPart?.toLowerCase().replace(/\s+/g, '_') || '',
              bodyAreaLabel: selectedHistoryLog.bodyPart || '',
              side: selectedHistoryLog.side || 'both',
              severity: selectedHistoryLog.severity,
              movementImpact: selectedHistoryLog.movementImpact || 'none',
              movementLimitations: (selectedHistoryLog as any).movementLimitations || [],
              trainingImpact: selectedHistoryLog.trainingImpact || 'none',
              primaryTrigger: selectedHistoryLog.primaryTrigger || 'during_day',
              x: selectedHistoryLog.x || 0,
              y: selectedHistoryLog.y || 0,
              view: (selectedHistoryLog.view as "front" | "back") || 'front',
            });
            
            return (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-foreground" data-testid="history-detail-title">
                    {selectedHistoryLog.bodyPart}
                    {selectedHistoryLog.side && ` (${selectedHistoryLog.side})`}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="history-detail-date">
                    {selectedHistoryLog.createdAt ? formatDateTime(new Date(selectedHistoryLog.createdAt)) : "Unknown date"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${getSeverityColor(selectedHistoryLog.severity)}`}>
                    {selectedHistoryLog.severity}/10
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedHistoryLog.severity >= 7 ? "text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400" :
                    selectedHistoryLog.severity >= 4 ? "text-[#0cc9a9] bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/10 dark:text-[#0cc9a9]" :
                    "text-green-600 bg-green-100 dark:bg-green-950 dark:text-green-400"
                  }`}>
                    {getSeverityLabel(selectedHistoryLog.severity)}
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">What's Usually Behind This</h3>
                    <p className="text-muted-foreground text-sm">{logGuidance.whatsBehindThis}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Training Guidance</h3>
                    <p className="text-muted-foreground text-sm">{logGuidance.trainingGuidance}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Daily Movement</h3>
                    <p className="text-muted-foreground text-sm">{logGuidance.dailyGuidance}</p>
                  </div>

                  {logGuidance.deskGuidance && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Desk & Work Tips</h3>
                      <p className="text-muted-foreground text-sm">{logGuidance.deskGuidance}</p>
                    </div>
                  )}

                  <div className="bg-[#0cc9a9]/10 dark:bg-[#0cc9a9]/20 rounded-lg p-4">
                    <h3 className="font-semibold text-[#0cc9a9] dark:text-[#0cc9a9] mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Things to Watch
                    </h3>
                    <ul className="text-sm text-[#0cc9a9] dark:text-[#0cc9a9] space-y-1">
                      {logGuidance.cautions.map((caution, i) => (
                        <li key={i}>• {caution}</li>
                      ))}
                    </ul>
                  </div>

                  {(() => {
                    // Use stored reassessmentDays if available, otherwise fall back to calculated value
                    const storedDays = (selectedHistoryLog as any).reassessmentDays;
                    const displayDays = storedDays || logGuidance.reassessmentDays;
                    
                    return (
                      <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Reassess in {displayDays} day{displayDays !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedHistoryLog.createdAt 
                              ? `Due on ${formatDate(addDays(new Date(selectedHistoryLog.createdAt), displayDays), 'full')}`
                              : 'Check back to track your progress'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this assessment?")) {
                        deleteAssessmentMutation.mutate(selectedHistoryLog.id);
                      }
                    }}
                    disabled={deleteAssessmentMutation.isPending}
                    className="w-full"
                    data-testid="button-delete-assessment"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteAssessmentMutation.isPending ? "Deleting..." : "Delete Assessment"}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Step: Settings */}
          {step === "settings" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-[#0cc9a9]" />
                <h1 className="text-xl font-semibold text-foreground">
                  Body Map Settings
                </h1>
              </div>

              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-[#0cc9a9]" />
                      <div>
                        <Label className="text-foreground font-medium">Reassessment Reminders</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Get notified when it's time to reassess a pain area
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={bodyMapSettings.reassessmentEnabled}
                      onCheckedChange={(checked) => {
                        setBodyMapSettings(prev => ({ ...prev, reassessmentEnabled: checked }));
                        updateSettingsMutation.mutate({ bodyMapReassessment: checked });
                      }}
                      className="data-[state=checked]:bg-[#0cc9a9]"
                      data-testid="toggle-reassessment"
                    />
                  </div>

                  {bodyMapSettings.reassessmentEnabled && (
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-[#0cc9a9]" />
                          <Label className="text-foreground font-medium">Reminder Frequency</Label>
                        </div>
                        <Badge variant="outline" className="text-[#0cc9a9] border-[#0cc9a9]">
                          {bodyMapSettings.frequencyDays} days
                        </Badge>
                      </div>
                      <Slider
                        value={[bodyMapSettings.frequencyDays]}
                        onValueChange={([value]) => setBodyMapSettings(prev => ({ ...prev, frequencyDays: value }))}
                        onValueCommit={([value]) => {
                          updateSettingsMutation.mutate({ bodyMapFrequencyDays: value });
                        }}
                        min={7}
                        max={30}
                        step={7}
                        className="w-full"
                        data-testid="slider-frequency"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>7 days</span>
                        <span>14 days</span>
                        <span>21 days</span>
                        <span>30 days</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        After logging a pain point, you'll be reminded to check in after this many days.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setStep("history")}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to History
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* Recovery Plan Dialog */}
      {recoveryPlanId && (
        <RecoveryPlanDialog
          open={isRecoveryPlanDialogOpen}
          onOpenChange={setIsRecoveryPlanDialogOpen}
          recoveryPlanId={recoveryPlanId}
          recoveryProgrammeId={recoveryProgrammeId || null}
          onDecision={(decision) => {
            recoveryPlanDecisionMutation.mutate({ recoveryPlanId, decision });
          }}
          isDecisionPending={recoveryPlanDecisionMutation.isPending}
        />
      )}

      {/* Review Changes Dialog with Per-Exercise Selection */}
      <Dialog 
        open={isReviewChangesDialogOpen} 
        onOpenChange={(open) => {
          setIsReviewChangesDialogOpen(open);
          if (open && guidanceResult?.matchedOutcomeId) {
            previewModificationsMutation.mutate({ outcomeId: guidanceResult.matchedOutcomeId });
          }
          if (!open) {
            setPreviewData(null);
            setSubstitutionSelections({});
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-review-changes">
          <DialogHeader>
            <DialogTitle>Suggested Changes</DialogTitle>
            <DialogDescription className="sr-only">
              Review and select exercise substitutions for your programme
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            {/* Loading State */}
            {previewModificationsMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                Loading exercise preview...
              </div>
            )}

            {/* Flagged Exercises Section - Shows criteria tags */}
            {previewData && previewData.flaggedExercises.length > 0 && previewData.flaggingCriteria && (
              <div>
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#0cc9a9]" />
                  Flagged Exercises
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {previewData.flaggingCriteria.movementPatterns?.length > 0 && (
                    <p>• Exercises with movement patterns: {previewData.flaggingCriteria.movementPatterns.join(', ')}</p>
                  )}
                  {previewData.flaggingCriteria.equipment?.length > 0 && (
                    <p>• Exercises using equipment: {previewData.flaggingCriteria.equipment.join(', ')}</p>
                  )}
                  {previewData.flaggingCriteria.levels?.length > 0 && (
                    <p>• Difficulty levels: {previewData.flaggingCriteria.levels.join(', ')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Exercise Substitutions with Cycling UI - Week 1 only */}
            {previewData && previewData.flaggedExercises.length > 0 && (() => {
              const week1Exercises = previewData.flaggedExercises.filter(f => f.weekNumber === 1);
              if (week1Exercises.length === 0) return null;
              
              return (
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-primary" />
                    Suggested Substitutes ({week1Exercises.length})
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use the arrows to cycle through alternative exercises for each flagged item.
                  </p>
                  <div className="space-y-4">
                    {week1Exercises.map((flagged) => {
                      const substitutes = previewData.substituteOptions.filter(s => s.id !== flagged.exerciseId);
                      const selectedSubId = substitutionSelections[flagged.exerciseInstanceId];
                      const isKeepCurrent = selectedSubId === flagged.exerciseId;
                      const selectedSub = isKeepCurrent ? null : previewData.substituteOptions.find(s => s.id === selectedSubId);
                      // Total options = substitutes + 1 (Keep Current at end)
                      const totalOptions = substitutes.length + 1;
                      // Current index: substitutes are 0 to N-1, Keep Current is N (last)
                      const currentOptionIndex = isKeepCurrent ? totalOptions : substitutes.findIndex(s => s.id === selectedSubId) + 1;
                      
                      return (
                        <div key={flagged.exerciseInstanceId} className="bg-muted/40 border border-muted rounded-xl p-4 space-y-3">
                          {/* Flagged Exercise with flag icon and thumbnail */}
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-[#0cc9a9] flex-shrink-0" />
                            {flagged.exerciseImageUrl ? (
                              <img 
                                src={flagged.exerciseImageUrl} 
                                alt={flagged.exerciseName}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">
                                {flagged.workoutName}
                              </p>
                              <p className="font-medium text-foreground">
                                {flagged.exerciseName}
                              </p>
                            </div>
                          </div>
                          
                          {/* Substitute Selector with thumbnail - includes "Keep current" option */}
                          {substitutes.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => cycleSubstitute(flagged.exerciseInstanceId, flagged.exerciseId, 'prev')}
                                className="p-1 rounded hover:bg-muted transition-colors"
                              >
                                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                              </button>
                              <div className={`flex-1 rounded-lg p-2 flex items-center gap-3 ${isKeepCurrent ? 'bg-muted/50 border border-muted' : 'bg-primary/10'}`}>
                                {isKeepCurrent ? (
                                  <>
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                      <Check className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-sm">Keep Current</p>
                                      <p className="text-xs text-muted-foreground">
                                        Option {currentOptionIndex} of {totalOptions}
                                      </p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {selectedSub?.imageUrl ? (
                                      <img 
                                        src={selectedSub.imageUrl} 
                                        alt={selectedSub.name}
                                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center flex-shrink-0">
                                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-sm truncate">
                                        {selectedSub?.name || "No substitute selected"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Option {currentOptionIndex} of {totalOptions}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => cycleSubstitute(flagged.exerciseInstanceId, flagged.exerciseId, 'next')}
                                className="p-1 rounded hover:bg-muted transition-colors"
                              >
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No valid substitutes available
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* No Flagged Exercises */}
            {previewData && previewData.flaggedExercises.length === 0 && !previewModificationsMutation.isPending && (
              <div className="text-center py-4">
                <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-foreground font-medium">No exercises need to be changed</p>
                <p className="text-sm text-muted-foreground">
                  Your current programme doesn't contain any exercises that match the flagging criteria.
                </p>
              </div>
            )}


            {/* Coaching Note */}
            {guidanceResult?.substitutionPool?.coachingNote && (
              <div className="text-sm bg-primary/5 rounded p-3">
                <p className="text-muted-foreground italic">
                  "{guidanceResult.substitutionPool.coachingNote}"
                </p>
              </div>
            )}

            {/* Accept/Decline Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button 
                onClick={() => {
                  if (guidanceResult?.matchedOutcomeId) {
                    declineModificationsMutation.mutate({ 
                      outcomeId: guidanceResult.matchedOutcomeId,
                    });
                  } else {
                    setIsReviewChangesDialogOpen(false);
                    setPreviewData(null);
                    setSubstitutionSelections({});
                  }
                }}
                className="flex-1"
                variant="outline"
                disabled={declineModificationsMutation.isPending || acceptModificationsMutation.isPending}
                data-testid="button-decline-changes"
              >
                {declineModificationsMutation.isPending ? "Processing..." : "Keep as is"}
              </Button>
              <Button 
                onClick={() => {
                  if (previewData && previewData.flaggedExercises.length > 0) {
                    setIsConfirmDialogOpen(true);
                  } else if (guidanceResult?.matchedOutcomeId && previewData) {
                    // Filter out "keep current" selections (where subId equals original exerciseId)
                    const selections = Object.entries(substitutionSelections)
                      .filter(([instanceId, subId]) => {
                        const flagged = previewData.flaggedExercises.find(
                          (f: any) => f.exerciseInstanceId === parseInt(instanceId)
                        );
                        return flagged && subId !== flagged.exerciseId;
                      })
                      .map(([instanceId, subId]) => ({
                        exerciseInstanceId: parseInt(instanceId),
                        chosenSubstituteExerciseId: subId
                      }));
                    acceptModificationsMutation.mutate({ 
                      outcomeId: guidanceResult.matchedOutcomeId,
                      selections
                    });
                  }
                }}
                className="flex-1"
                disabled={!guidanceResult?.matchedOutcomeId || acceptModificationsMutation.isPending || declineModificationsMutation.isPending || previewModificationsMutation.isPending}
                data-testid="button-accept-changes"
              >
                {acceptModificationsMutation.isPending ? "Applying..." : "Apply changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-confirm-changes">
          <DialogHeader>
            <DialogTitle>Confirm changes</DialogTitle>
            <DialogDescription className="sr-only">
              Confirm the exercise substitutions you selected
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {(() => {
              // Only count Week 1 exercise instances (matches what user selects in the UI)
              const week1Exercises = previewData?.flaggedExercises.filter(f => f.weekNumber === 1) || [];
              const changedInstances: Array<{ instanceId: number; name: string; subName: string; workoutName: string }> = [];
              week1Exercises.forEach((flagged) => {
                const selectedSubId = substitutionSelections[flagged.exerciseInstanceId];
                // Skip if keeping current (selectedSubId equals original exercise)
                if (selectedSubId === flagged.exerciseId) return;
                
                const selectedSub = previewData?.substituteOptions.find(s => s.id === selectedSubId);
                changedInstances.push({
                  instanceId: flagged.exerciseInstanceId,
                  name: flagged.exerciseName,
                  subName: selectedSub?.name || "No substitute",
                  workoutName: flagged.workoutName
                });
              });
              const changeCount = changedInstances.length;
              
              return (
                <>
                  {changeCount > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        You're about to replace {changeCount} exercise{changeCount !== 1 ? 's' : ''} in your programme. This action cannot be undone.
                      </p>
                      
                      {/* Summary of changes - all instances being replaced */}
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {changedInstances.map((instance) => (
                          <div key={instance.instanceId} className="text-sm bg-muted/30 rounded p-2">
                            <span className="line-through opacity-60">{instance.name}</span>
                            <ChevronRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                            <span className="text-primary font-medium">{instance.subName}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You've chosen to keep all exercises as-is. No changes will be made to your programme.
                    </p>
                  )}
                </>
              );
            })()}

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={acceptModificationsMutation.isPending}
              >
                Go back
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  if (guidanceResult?.matchedOutcomeId && previewData) {
                    // Filter out "keep current" selections (where subId equals original exerciseId)
                    const selections = Object.entries(substitutionSelections)
                      .filter(([instanceId, subId]) => {
                        const flagged = previewData.flaggedExercises.find(
                          (f: any) => f.exerciseInstanceId === parseInt(instanceId)
                        );
                        return flagged && subId !== flagged.exerciseId;
                      })
                      .map(([instanceId, subId]) => ({
                        exerciseInstanceId: parseInt(instanceId),
                        chosenSubstituteExerciseId: subId
                      }));
                    acceptModificationsMutation.mutate({ 
                      outcomeId: guidanceResult.matchedOutcomeId,
                      selections
                    });
                  }
                }}
                disabled={acceptModificationsMutation.isPending}
                data-testid="button-confirm-apply"
              >
                {acceptModificationsMutation.isPending ? "Applying..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restoration Selection Dialog */}
      <Dialog 
        open={isRestorationDialogOpen} 
        onOpenChange={(open) => {
          setIsRestorationDialogOpen(open);
          if (!open) {
            setRestorationConfirmStep('select');
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-restoration">
          <DialogHeader>
            <DialogTitle>
              {restorationConfirmStep === 'select' ? 'Original Exercises' : 'Confirm Restoration'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select which exercises to restore to their original versions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {restorationConfirmStep === 'select' ? (
              <>
                {/* Restore All Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Restore All</p>
                    <p className="text-xs text-muted-foreground">Select all original exercises</p>
                  </div>
                  <Switch 
                    checked={allSelectedForRestore}
                    onCheckedChange={(checked) => toggleAllRestorations(checked)}
                  />
                </div>

                {/* Individual Exercise Cards */}
                <div className="space-y-3">
                  {restorableData?.substitutions?.map((sub) => (
                    <div 
                      key={sub.id} 
                      className="rounded-xl p-4 bg-muted/30 border border-white/20"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-muted-foreground">{sub.workoutName}</p>
                        <Switch 
                          checked={restorationSelections[sub.id] ?? false}
                          onCheckedChange={(checked) => {
                            setRestorationSelections(prev => ({
                              ...prev,
                              [sub.id]: checked
                            }));
                          }}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        {/* Current substitute */}
                        <div className={`flex items-center gap-3 min-h-[56px] transition-opacity ${restorationSelections[sub.id] ? 'opacity-50' : ''}`}>
                          {sub.substitutedImageUrl ? (
                            <img 
                              src={sub.substitutedImageUrl} 
                              alt={sub.substitutedExerciseName}
                              className="w-14 h-14 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Dumbbell className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${restorationSelections[sub.id] ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                              {sub.substitutedExerciseName}
                            </p>
                            <p className="text-xs text-muted-foreground">Current</p>
                          </div>
                        </div>
                        
                        {/* Original exercise */}
                        <div className={`flex items-center gap-3 min-h-[56px] p-2 -mx-2 rounded-lg transition-all ${restorationSelections[sub.id] ? 'bg-primary/10 border border-primary/40' : 'opacity-50'}`}>
                          {sub.originalImageUrl ? (
                            <img 
                              src={sub.originalImageUrl} 
                              alt={sub.originalExerciseName}
                              className="w-14 h-14 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Dumbbell className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${restorationSelections[sub.id] ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                              {sub.originalExerciseName}
                            </p>
                            <p className="text-xs text-muted-foreground">Original</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirm Selection Button */}
                <Button 
                  onClick={() => setRestorationConfirmStep('confirm')}
                  className="w-full"
                  data-testid="button-continue-restoration"
                >
                  Continue
                </Button>
              </>
            ) : (
              <>
                {/* Confirmation Step */}
                {(() => {
                  const toRestore = restorableData?.substitutions?.filter(sub => restorationSelections[sub.id]) || [];
                  const toKeep = restorableData?.substitutions?.filter(sub => !restorationSelections[sub.id]) || [];
                  
                  return (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {toRestore.length > 0 && toKeep.length > 0 
                          ? `You're restoring ${toRestore.length} exercise${toRestore.length !== 1 ? 's' : ''} and keeping ${toKeep.length} substitute${toKeep.length !== 1 ? 's' : ''}.`
                          : toRestore.length > 0
                          ? `You're restoring ${toRestore.length} exercise${toRestore.length !== 1 ? 's' : ''} to their original versions.`
                          : `You're keeping all current substitutes.`
                        }
                      </p>
                      
                      {toRestore.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-green-600 dark:text-green-400">Restoring to Original:</h4>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {toRestore.map(sub => (
                              <div key={sub.id} className="text-sm bg-green-500/10 rounded p-2 flex items-center gap-2">
                                <span className="text-muted-foreground truncate flex-1">{sub.substitutedExerciseName}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-green-600 dark:text-green-400 font-medium truncate flex-1">{sub.originalExerciseName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {toKeep.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Keeping Current:</h4>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {toKeep.map(sub => (
                              <div key={sub.id} className="text-sm bg-muted/30 rounded p-2">
                                <span className="text-foreground">{sub.substitutedExerciseName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setRestorationConfirmStep('select')}
                    disabled={restoreSubstitutionsMutation.isPending}
                  >
                    Go back
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      if (restorableData?.matchedOutcomeId && savedLogId) {
                        const mappingIdsToRestore = Object.entries(restorationSelections)
                          .filter(([_, restore]) => restore)
                          .map(([id, _]) => parseInt(id));
                        restoreSubstitutionsMutation.mutate({ 
                          matchedOutcomeId: restorableData.matchedOutcomeId, 
                          bodyMapLogId: savedLogId,
                          mappingIdsToRestore,
                          modificationRecordId: restorableData.modificationRecordId
                        });
                      }
                    }}
                    disabled={restoreSubstitutionsMutation.isPending}
                    data-testid="button-confirm-restoration"
                  >
                    {restoreSubstitutionsMutation.isPending ? "Applying..." : "Confirm"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessments</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLogIds.size} assessment{selectedLogIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMultipleAssessmentsMutation.mutate(Array.from(selectedLogIds));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMultipleAssessmentsMutation.isPending}
            >
              {deleteMultipleAssessmentsMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
