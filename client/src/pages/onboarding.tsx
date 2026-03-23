import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SeveritySlider } from "@/components/SeveritySlider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  User,
  Dumbbell,
  Target,
  Rocket,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Heart,
  Activity,
  Zap,
  Flame,
  RotateCcw,
  Wind,
  BookOpen,
  Star,
  Play,
  Camera,
  Moon,
  Monitor,
  Clock,
  Calendar,
  MapPin,
  Scale,
  Smartphone,
  Watch,
  Settings,
  Save,
  Info,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MuxPlayer from "@mux/mux-player-react";
import { MOVEMENT_LIMITATIONS_BY_AREA } from "@shared/bodyMapDefaults";

const PHASE_LABELS = [
  "Welcome",
  "Safety",
  "Profile",
  "Coaching",
  "Recommendations",
  "Launch",
];

const SAFETY_QUESTIONS = [
  "Have you ever been told by a medical professional that you have a heart condition and should only exercise under medical supervision?",
  "Do you experience chest pain during physical activity?",
  "In the past month, have you experienced chest pain when not physically active?",
  "Do you ever lose consciousness, feel dizzy, or lose your balance during physical activity?",
  "Do you have any bone, joint, or musculoskeletal condition that could be made worse by exercise?",
  "Are you currently prescribed medication for a heart condition or blood pressure?",
  "Is there any other reason you are aware of why you should not take part in physical activity?",
];

const EQUIPMENT_OPTIONS = [
  "Full gym access",
  "Bodyweight only",
  "Dumbbells",
  "Barbell",
  "Resistance bands",
  "Cardio equipment",
  "Kettlebells",
  "Pull-up bar",
  "Bench",
  "Cable machine",
  "Suspension trainer",
  "Swiss ball",
  "Foam roller",
  "Lacrosse ball",
];

const GOAL_OPTIONS = [
  { id: "general_strength", label: "General Strength", icon: Dumbbell, description: "Build overall strength and resilience through balanced, functional training." },
  { id: "muscle_building", label: "Muscle Building", icon: Zap, description: "Progressive resistance training to increase lean muscle mass and definition." },
  { id: "weight_loss", label: "Weight Loss", icon: Flame, description: "Sustainable fat loss through structured training, nutrition and daily movement." },
  { id: "recovery_mobility", label: "Recovery & Mobility", icon: RotateCcw, description: "Improve joint health, flexibility and movement quality to feel looser and more capable." },
  { id: "conditioning", label: "Conditioning & Endurance", icon: Wind, description: "Boost cardiovascular fitness so you recover faster and handle stress better." },
  { id: "pain_management", label: "Pain Management", icon: Heart, description: "Targeted strategies to reduce pain, manage injuries and support long-term comfort." },
  { id: "active_recovery", label: "Active Recovery", icon: Activity, description: "Light movement, stretching and recovery work to keep your body feeling fresh." },
];

interface BodyArea {
  id: string;
  label: string;
  side: "left" | "right" | "both";
  severity: number;
  movementImpact: "none" | "slight" | "significant";
  movementLimitations: string[];
  trainingImpact: "normal" | "limited" | "cannot_train";
}

interface OnboardingData {
  safety: {
    ageConfirmed: boolean;
    safetyAnswers: (boolean | null)[];
    understandsNotMedicalAdvice: boolean;
    acceptsResponsibility: boolean;
    agreesToTerms: boolean;
    emailDocuments: boolean;
  };
  profile: {
    displayName: string;
    dateOfBirth: string;
    gender: string;
    profilePhoto: string;
    height: string;
    heightUnit: string;
    weight: string;
    weightUnit: string;
  };
  coaching: {
    experienceLevel: string;
    trainingEnvironment: string;
    equipment: string[];
    timeAvailability: string;
    workoutFrequency: string;
    sleepHours: string;
    stressLevel: string;
    deskBased: string;
    hasPainOrInjury: boolean | null;
    painAreas: BodyArea[];
    primaryGoal: string;
    movementScreening: {
      squatPain: boolean | null;
      kneeStairsPain: boolean | null;
      bendingPain: boolean | null;
      lowerBackPain: boolean | null;
      overheadPain: boolean | null;
      pushingShoulderPain: boolean | null;
      singleLegInstability: boolean | null;
      neckShoulderTension: boolean | null;
      optionalNotes: string;
    };
  };
  recommendations: {
    selectedProgramme: any | null;
    selectedGoal: { id: string; title: string; description: string; type?: string } | null;
    weightGoalData: { currentWeight: string; targetWeight: string; unit: string } | null;
    selectedLearningPath: any | null;
    selectedHabit: any | null;
  };
  preferences: {
    weightUnit: string;
    distanceUnit: string;
    timeFormat: string;
    notificationsEnabled: boolean;
  };
}

const PAIN_AREA_LIST = [
  { id: "head_neck", label: "Head / Neck" },
  { id: "shoulders", label: "Shoulders" },
  { id: "upper_back", label: "Upper Back" },
  { id: "lower_back", label: "Lower Back" },
  { id: "chest", label: "Chest" },
  { id: "arms", label: "Arms" },
  { id: "elbows", label: "Elbows" },
  { id: "wrists_hands", label: "Wrists / Hands" },
  { id: "hips", label: "Hips" },
  { id: "knees", label: "Knees" },
  { id: "ankles_feet", label: "Ankles / Feet" },
  { id: "other", label: "Other" },
];

const defaultData: OnboardingData = {
  safety: {
    ageConfirmed: false,
    safetyAnswers: Array(7).fill(null),
    understandsNotMedicalAdvice: false,
    acceptsResponsibility: false,
    agreesToTerms: false,
    emailDocuments: false,
  },
  profile: {
    displayName: "",
    dateOfBirth: "",
    gender: "",
    profilePhoto: "",
    height: "",
    heightUnit: "cm",
    weight: "",
    weightUnit: "kg",
  },
  coaching: {
    experienceLevel: "",
    trainingEnvironment: "",
    equipment: [],
    timeAvailability: "",
    workoutFrequency: "",
    sleepHours: "",
    stressLevel: "",
    deskBased: "",
    hasPainOrInjury: null,
    painAreas: [],
    primaryGoal: "",
    movementScreening: {
      squatPain: null,
      kneeStairsPain: null,
      bendingPain: null,
      lowerBackPain: null,
      overheadPain: null,
      pushingShoulderPain: null,
      singleLegInstability: null,
      neckShoulderTension: null,
      optionalNotes: "",
    },
  },
  recommendations: {
    selectedProgramme: null,
    selectedGoal: null,
    weightGoalData: null,
    selectedLearningPath: null,
    selectedHabit: null,
  },
  preferences: {
    weightUnit: "kg",
    distanceUnit: "km",
    timeFormat: "24h",
    notificationsEnabled: true,
  },
};

export default function Onboarding() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [saving, setSaving] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.onboardingStep && user.onboardingStep > 0 && !user.onboardingCompleted) {
        setCurrentStep(user.onboardingStep);
      }
      if (user.onboardingData && !user.onboardingCompleted) {
        setData((prev) => {
          const saved = user.onboardingData as Partial<OnboardingData>;
          return {
            ...prev,
            ...saved,
            coaching: {
              ...prev.coaching,
              ...(saved.coaching || {}),
              movementScreening: {
                ...prev.coaching.movementScreening,
                ...((saved.coaching as any)?.movementScreening || {}),
              },
            },
          };
        });
      }
    }
  }, [user, isLoading]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentStep, subStep]);

  const saveProgress = useCallback(
    async (step: number, stepData: object) => {
      setSaving(true);
      try {
        await apiRequest("PATCH", "/api/onboarding/progress", {
          step,
          data: stepData,
        });
      } catch (e) {
        console.error("Failed to save onboarding progress:", e);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const fetchRecommendations = useCallback(async () => {
    setLoadingRecs(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/recommendations", {
        intake: data.coaching,
      });
      const result = await res.json();
      setRecommendations(result);
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
      setRecommendations({ programmes: [], learningPaths: [], habits: [] });
    } finally {
      setLoadingRecs(false);
    }
  }, [data.coaching]);

  const handleComplete = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/complete", { data });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    } catch (e) {
      console.error("Failed to complete onboarding:", e);
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    if (currentStep === 2) {
      if (subStep < 1) {
        setSubStep(subStep + 1);
        return;
      }
    }
    if (currentStep === 3) {
      if (subStep < 12) {
        setSubStep(subStep + 1);
        return;
      }
    }
    if (currentStep === 4) {
      if (subStep < 3) {
        setSubStep(subStep + 1);
        return;
      }
    }
    if (currentStep === 5) {
      if (subStep < 2) {
        setSubStep(subStep + 1);
        return;
      }
    }

    const nextStep = currentStep + 1;
    await saveProgress(nextStep, data);
    setCurrentStep(nextStep);
    setSubStep(0);

    if (nextStep === 4) {
      fetchRecommendations();
    }
  };

  const goBack = () => {
    if (currentStep === 2 && subStep > 0) {
      setSubStep(subStep - 1);
      return;
    }
    if (currentStep === 3 && subStep > 0) {
      setSubStep(subStep - 1);
      return;
    }
    if (currentStep === 4 && subStep > 0) {
      setSubStep(subStep - 1);
      return;
    }
    if (currentStep === 5 && subStep > 0) {
      setSubStep(subStep - 1);
      return;
    }
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setSubStep(currentStep - 1 === 2 ? 1 : currentStep - 1 === 3 ? 12 : currentStep - 1 === 4 ? 3 : currentStep - 1 === 5 ? 2 : 0);
    }
  };


  const saveAndExit = async () => {
    await saveProgress(currentStep, data);
    navigate("/");
  };

  const toggleEquipment = (item: string) => {
    setData((prev) => ({
      ...prev,
      coaching: {
        ...prev.coaching,
        equipment: prev.coaching.equipment.includes(item)
          ? prev.coaching.equipment.filter((e) => e !== item)
          : [...prev.coaching.equipment, item],
      },
    }));
  };

  const addOrUpdatePainArea = (id: string, label: string) => {
    const existing = data.coaching.painAreas.find((a) => a.id === id);
    if (!existing) {
      setData((prev) => ({
        ...prev,
        coaching: {
          ...prev.coaching,
          painAreas: [
            ...prev.coaching.painAreas,
            {
              id,
              label,
              side: "both" as const,
              severity: 5,
              movementImpact: "none" as const,
              movementLimitations: [],
              trainingImpact: "normal" as const,
            },
          ],
        },
      }));
    }
  };

  const updatePainArea = (id: string, field: string, value: any) => {
    setData((prev) => ({
      ...prev,
      coaching: {
        ...prev.coaching,
        painAreas: prev.coaching.painAreas.map((a) =>
          a.id === id ? { ...a, [field]: value } : a,
        ),
      },
    }));
  };

  const removePainArea = (id: string) => {
    setData((prev) => ({
      ...prev,
      coaching: {
        ...prev.coaching,
        painAreas: prev.coaching.painAreas.filter((a) => a.id !== id),
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0cc9a9]" />
      </div>
    );
  }

  const canContinueStep1 =
    data.safety.ageConfirmed &&
    data.safety.safetyAnswers.every((a) => a !== null) &&
    data.safety.understandsNotMedicalAdvice &&
    data.safety.acceptsResponsibility &&
    data.safety.agreesToTerms;
  const canContinueStep2 =
    data.profile.displayName.trim() !== "" &&
    data.profile.dateOfBirth !== "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {currentStep > 0 && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm px-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between py-3">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>
              <button
                onClick={saveAndExit}
                disabled={saving}
                className="flex items-center gap-1.5 text-[#0cc9a9] hover:text-[#0cc9a9]/80 transition-colors text-sm font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                Save & finish later
              </button>
            </div>
            <div className="border-t border-border pt-3 pb-3">
              <div className="flex items-center gap-1 mb-1.5">
                {PHASE_LABELS.map((label, i) => {
                  const maxSubSteps: Record<number, number> = { 2: 1, 3: 9, 4: 3, 5: 2 };
                  const totalSubs = maxSubSteps[i] || 0;
                  const isComplete = i < currentStep;
                  const isCurrent = i === currentStep;
                  const fillPercent = isComplete ? 100 : isCurrent && totalSubs > 0 ? (subStep / totalSubs) * 100 : isCurrent ? 100 : 0;
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="h-3 w-full rounded-full border-2 border-[#0cc9a9]/30 p-[1px]">
                        <div className="h-full w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0cc9a9] transition-all duration-300"
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium transition-colors ${
                        i <= currentStep ? "text-[#0cc9a9]" : "text-muted-foreground"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-b border-border" />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8 pb-24">

        {currentStep === 0 && <WelcomePhase onStart={goNext} />}
        {currentStep === 1 && (
          <SafetyPhase
            data={data.safety}
            onChange={(safety) => setData((prev) => ({ ...prev, safety }))}
            canContinue={canContinueStep1}
            onContinue={goNext}
            saving={saving}
          />
        )}
        {currentStep === 2 && (
          <ProfilePhase
            subStep={subStep}
            data={data.profile}
            onChange={(profile) => setData((prev) => ({ ...prev, profile }))}
            canContinue={canContinueStep2}
            onContinue={goNext}
            saving={saving}
          />
        )}
        {currentStep === 3 && (
          <CoachingPhase
            subStep={subStep}
            data={data.coaching}
            onChange={(coaching) => setData((prev) => ({ ...prev, coaching }))}
            toggleEquipment={toggleEquipment}
            addOrUpdatePainArea={addOrUpdatePainArea}
            updatePainArea={updatePainArea}
            removePainArea={removePainArea}
            onContinue={goNext}
            saving={saving}
          />
        )}
        {currentStep === 4 && (
          <RecommendationsPhase
            subStep={subStep}
            recommendations={recommendations}
            loading={loadingRecs}
            data={data.recommendations}
            onChange={(recs) => setData((prev) => ({ ...prev, recommendations: recs }))}
            onContinue={goNext}
            saving={saving}
          />
        )}
        {currentStep === 5 && (
          <LaunchPhase
            subStep={subStep}
            data={data}
            preferences={data.preferences}
            onPreferencesChange={(preferences) =>
              setData((prev) => ({ ...prev, preferences }))
            }
            onContinue={goNext}
            onComplete={handleComplete}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

function WelcomePhase({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center min-h-[85vh] text-center px-4 pt-16">
      <h1 className="w-full max-w-sm text-4xl font-bold text-[#0cc9a9] text-center mb-8">Welcome to Meridian</h1>
      <div className="w-full max-w-sm mb-8 rounded-2xl overflow-hidden border border-border">
        <MuxPlayer
          ref={(el: any) => {
            if (el) {
              const muxEl = el as HTMLElement & { addEventListener: Function };
              muxEl.addEventListener("play", () => {
                try {
                  if (muxEl.requestFullscreen) {
                    muxEl.requestFullscreen();
                  } else if ((muxEl as any).webkitRequestFullscreen) {
                    (muxEl as any).webkitRequestFullscreen();
                  }
                } catch (e) {}
              }, { once: true });
            }
          }}
          playbackId="00R4502l6u9n02IzCX02l9L1rmWL392fjhEoVhXoh4VHuvA"
          metadata={{ video_title: "Welcome to Meridian" }}
          streamType="on-demand"
          accentColor="#0cc9a9"
          style={{ width: "100%", display: "block" }}
        />
      </div>

      <p className="text-foreground text-lg mb-6 max-w-sm">
        This short setup helps Meridian personalise your experience
      </p>

      <div className="w-full max-w-sm">
        <p className="text-muted-foreground text-sm mb-4 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Takes less than 8 minutes
        </p>
        <Button
          onClick={onStart}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black px-8 py-6 text-lg rounded-xl"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}

function SafetyPhase({
  data,
  onChange,
  canContinue,
  onContinue,
  saving,
}: {
  data: OnboardingData["safety"];
  onChange: (d: OnboardingData["safety"]) => void;
  canContinue: boolean;
  onContinue: () => void;
  saving: boolean;
}) {
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  const docContent: Record<string, { title: string; body: string }> = {
    terms: {
      title: "Terms and Conditions",
      body: "Terms and conditions content will be added here. This document outlines the rules and guidelines for using Meridian.",
    },
    privacy: {
      title: "Privacy Policy",
      body: "Privacy policy content will be added here. This document explains how Meridian collects, uses, and protects your personal data.",
    },
    waiver: {
      title: "Waiver",
      body: "Waiver content will be added here. This document covers liability and risk acknowledgement for physical activities.",
    },
    consent: {
      title: "Informed Consent",
      body: "Full informed consent document will be added here. This provides detailed information about the nature of guidance provided by Meridian.",
    },
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-4 mb-1">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-[#0cc9a9]" />
          <h2 className="text-2xl font-bold">Safety Check and Consent</h2>
        </div>
        <p className="text-foreground text-base">
          We need to run through a short safety check and confirm a few important points. This takes less than a minute.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Before we begin</h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            Meridian is designed to support your health, performance, and energy.
            To do that responsibly, we need to confirm a few important points.
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Age confirmation</h3>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm mb-4">Meridian is designed for adults.</p>
            <div className="flex items-start gap-3">
              <Checkbox
                id="age"
                checked={data.ageConfirmed}
                onCheckedChange={(c) =>
                  onChange({ ...data, ageConfirmed: c === true })
                }
                className="h-5 w-5 mt-0.5 shrink-0 border-2 border-[#6b7280] data-[state=checked]:bg-[#0cc9a9] data-[state=checked]:border-[#0cc9a9]"
              />
              <Label htmlFor="age" className="text-foreground cursor-pointer leading-relaxed">
                I confirm that I am 18 years of age or older
              </Label>
            </div>
            {!data.ageConfirmed && (
              <p className="text-muted-foreground text-xs mt-3">You must confirm your age to continue.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Physical Activity Readiness Questionnaire</h3>
        <p className="text-muted-foreground text-sm mb-4">Regular physical activity is fun and healthy, and increasingly more people are starting to become more active every day. Being more active is very safe for most people. However, some people should check with their doctor before they start becoming much more physically active.</p>
        <p className="text-muted-foreground text-sm mb-4">If you are planning to become much more physically active than you are now, start by answering the seven questions below. If you are between the ages of 19 and 69, the PAR-Q will tell you if you should check with your doctor before you start. If you are over 69 years of age, and you are not used to being very active, check with your doctor.</p>

        <div className="space-y-3">
          {SAFETY_QUESTIONS.map((q, i) => {
            const answer = data.safetyAnswers[i];
            return (
              <Card key={i} className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <p className="text-foreground text-sm leading-relaxed mb-3">{q}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newAnswers = [...data.safetyAnswers];
                        newAnswers[i] = true;
                        onChange({ ...data, safetyAnswers: newAnswers });
                      }}
                      className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        answer === true
                          ? "bg-[#0cc9a9]/20 border border-[#0cc9a9] text-[#0cc9a9]"
                          : "bg-muted border border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => {
                        const newAnswers = [...data.safetyAnswers];
                        newAnswers[i] = false;
                        onChange({ ...data, safetyAnswers: newAnswers });
                      }}
                      className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        answer === false
                          ? "bg-[#0cc9a9]/20 border border-[#0cc9a9] text-[#0cc9a9]"
                          : "bg-muted border border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Answering "Yes" does not stop you from using Meridian.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            This information is collected to help you make informed decisions about your own activity. Meridian does not assess risk, provide medical guidance, or determine what you should or should not do.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            You are responsible for choosing appropriate activities and intensity, and for stopping or modifying any activity if something does not feel right.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            If you have any concerns about your health or ability to exercise, you should consult a qualified medical professional before starting or changing your activity.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Informed consent</h3>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm mb-4">Please read the following carefully.</p>
            <p className="text-foreground text-sm leading-relaxed mb-4">
              Meridian provides general guidance on exercise, recovery, and wellbeing.
              It does not provide medical advice, diagnosis, or treatment.
            </p>
            <p className="text-foreground text-sm mb-3">By using Meridian, you understand and agree that:</p>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span>You are responsible for choosing appropriate intensity and activities</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span>You will stop or modify any activity if you experience pain, discomfort, or warning signs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span>You will seek professional advice if you have concerns about your health</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">•</span>
                <span>Meridian cannot monitor you in real time and relies on the information you provide</span>
              </li>
            </ul>
            <p className="text-[#0cc9a9] text-sm font-medium mt-4">Your wellbeing always comes first.</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Agreement</h3>
        <p className="text-muted-foreground text-sm mb-4">To continue, please confirm the following.</p>

        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-start gap-3">
              <Checkbox
                id="not-medical"
                checked={data.understandsNotMedicalAdvice}
                onCheckedChange={(c) =>
                  onChange({ ...data, understandsNotMedicalAdvice: c === true })
                }
                className="h-5 w-5 mt-0.5 shrink-0 border-2 border-[#6b7280] data-[state=checked]:bg-[#0cc9a9] data-[state=checked]:border-[#0cc9a9]"
              />
              <Label htmlFor="not-medical" className="text-foreground cursor-pointer leading-relaxed text-sm">
                I understand that Meridian does not provide medical advice
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="responsibility"
                checked={data.acceptsResponsibility}
                onCheckedChange={(c) =>
                  onChange({ ...data, acceptsResponsibility: c === true })
                }
                className="h-5 w-5 mt-0.5 shrink-0 border-2 border-[#6b7280] data-[state=checked]:bg-[#0cc9a9] data-[state=checked]:border-[#0cc9a9]"
              />
              <Label htmlFor="responsibility" className="text-foreground cursor-pointer leading-relaxed text-sm">
                I agree to take personal responsibility for my activity, including choosing appropriate intensity and stopping or modifying activity if I experience pain or warning signs
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="legal-terms"
                checked={data.agreesToTerms}
                onCheckedChange={(c) =>
                  onChange({ ...data, agreesToTerms: c === true })
                }
                className="h-5 w-5 mt-0.5 shrink-0 border-2 border-[#6b7280] data-[state=checked]:bg-[#0cc9a9] data-[state=checked]:border-[#0cc9a9]"
              />
              <Label htmlFor="legal-terms" className="text-foreground cursor-pointer leading-relaxed text-sm">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setOpenDoc("terms"); }}
                  className="text-[#0cc9a9] underline underline-offset-2 hover:text-[#0cc9a9]/80"
                >
                  Terms and Conditions
                </button>
                ,{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setOpenDoc("privacy"); }}
                  className="text-[#0cc9a9] underline underline-offset-2 hover:text-[#0cc9a9]/80"
                >
                  Privacy Policy
                </button>
                ,{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setOpenDoc("waiver"); }}
                  className="text-[#0cc9a9] underline underline-offset-2 hover:text-[#0cc9a9]/80"
                >
                  Waiver
                </button>
                , and{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setOpenDoc("consent"); }}
                  className="text-[#0cc9a9] underline underline-offset-2 hover:text-[#0cc9a9]/80"
                >
                  Informed Consent
                </button>
              </Label>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="email-docs"
                  checked={data.emailDocuments}
                  onCheckedChange={(c) =>
                    onChange({ ...data, emailDocuments: c === true })
                  }
                  className="h-5 w-5 mt-0.5 shrink-0 border-2 border-[#6b7280] data-[state=checked]:bg-[#0cc9a9] data-[state=checked]:border-[#0cc9a9]"
                />
                <Label htmlFor="email-docs" className="text-muted-foreground cursor-pointer leading-relaxed text-sm">
                  Email me copies of these documents
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={onContinue}
        disabled={!canContinue || saving}
        className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Continue
      </Button>

      <Dialog open={!!openDoc} onOpenChange={() => setOpenDoc(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {openDoc && docContent[openDoc]?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground text-sm leading-relaxed pt-2">
            {openDoc && docContent[openDoc]?.body}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfilePhase({
  subStep,
  data,
  onChange,
  canContinue,
  onContinue,
  saving,
}: {
  subStep: number;
  data: OnboardingData["profile"];
  onChange: (d: OnboardingData["profile"]) => void;
  canContinue: boolean;
  onContinue: () => void;
  saving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange({ ...data, profilePhoto: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (subStep === 0) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Your profile</h2>
          </div>
          <p className="text-foreground text-base">
            This helps personalise your experience. You can change any of this later.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-5">
            <div>
              <Label className="text-foreground text-sm">Display name</Label>
              <Input
                value={data.displayName}
                onChange={(e) => onChange({ ...data, displayName: e.target.value })}
                placeholder="How you'd like to be called"
                className="bg-muted border-border text-foreground mt-1"
              />
              <p className="text-muted-foreground text-xs mt-1.5">
                This is how your name appears in the app.
              </p>
            </div>

            <div>
              <Label className="text-foreground text-sm">Date of birth</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Select
                  value={data.dateOfBirth ? new Date(data.dateOfBirth).getDate().toString() : ""}
                  onValueChange={(day) => {
                    const current = data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(1990, 0, 1);
                    const m = data.dateOfBirth ? current.getMonth() : 0;
                    const y = data.dateOfBirth ? current.getFullYear() : 1990;
                    const maxDay = new Date(y, m + 1, 0).getDate();
                    const d = Math.min(parseInt(day), maxDay);
                    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    onChange({ ...data, dateOfBirth: dateStr });
                  }}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 31 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={data.dateOfBirth ? new Date(data.dateOfBirth).getMonth().toString() : ""}
                  onValueChange={(month) => {
                    const current = data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(1990, 0, 1);
                    const y = data.dateOfBirth ? current.getFullYear() : 1990;
                    const d = data.dateOfBirth ? current.getDate() : 1;
                    const m = parseInt(month);
                    const maxDay = new Date(y, m + 1, 0).getDate();
                    const safeD = Math.min(d, maxDay);
                    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(safeD).padStart(2, '0')}`;
                    onChange({ ...data, dateOfBirth: dateStr });
                  }}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={data.dateOfBirth ? new Date(data.dateOfBirth).getFullYear().toString() : ""}
                  onValueChange={(year) => {
                    const current = data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(1990, 0, 1);
                    const m = data.dateOfBirth ? current.getMonth() : 0;
                    const d = data.dateOfBirth ? current.getDate() : 1;
                    const y = parseInt(year);
                    const maxDay = new Date(y, m + 1, 0).getDate();
                    const safeD = Math.min(d, maxDay);
                    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(safeD).padStart(2, '0')}`;
                    onChange({ ...data, dateOfBirth: dateStr });
                  }}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground text-sm">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 80 }, (_, i) => {
                      const y = new Date().getFullYear() - 16 - i;
                      return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground text-xs mt-1.5">
                Used to ensure age-appropriate guidance.
              </p>
            </div>

            <div>
              <Label className="text-foreground text-sm">Gender</Label>
              <Select
                value={data.gender}
                onValueChange={(v) => onChange({ ...data, gender: v })}
              >
                <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-binary</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs mt-1.5">
                Used for general context only.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div
                  className="h-24 w-24 rounded-full bg-muted border-2 border-border overflow-hidden cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {data.profilePhoto ? (
                    <img
                      src={data.profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <button
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#0cc9a9] border-2 border-background flex items-center justify-center shadow-md hover:bg-[#0cc9a9]/90 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
              <p className="text-muted-foreground text-xs mt-3">
                Adding a photo helps make the app feel more personal.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={onContinue}
          disabled={!canContinue || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4 mb-1">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-[#0cc9a9]" />
          <h2 className="text-2xl font-bold">Additional details</h2>
          <span className="text-muted-foreground text-sm font-normal">(optional)</span>
        </div>
        <p className="text-foreground text-base">
          You can skip this for now. These details can be added later.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Height</Label>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => onChange({ ...data, heightUnit: "cm" })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    data.heightUnit === "cm"
                      ? "bg-[#0cc9a9] text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  cm
                </button>
                <button
                  onClick={() => onChange({ ...data, heightUnit: "ft" })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    data.heightUnit === "ft"
                      ? "bg-[#0cc9a9] text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  ft
                </button>
              </div>
            </div>
            <Input
              type="number"
              value={data.height}
              onChange={(e) => onChange({ ...data, height: e.target.value })}
              placeholder={data.heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"}
              className="bg-muted border-border text-foreground mt-1"
            />
            <p className="text-muted-foreground text-xs mt-1.5">
              Used for general tracking only.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Weight</Label>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => onChange({ ...data, weightUnit: "kg" })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    data.weightUnit === "kg"
                      ? "bg-[#0cc9a9] text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  kg
                </button>
                <button
                  onClick={() => onChange({ ...data, weightUnit: "lbs" })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    data.weightUnit === "lbs"
                      ? "bg-[#0cc9a9] text-black"
                      : "text-muted-foreground"
                  }`}
                >
                  lbs
                </button>
              </div>
            </div>
            <Input
              type="number"
              value={data.weight}
              onChange={(e) => onChange({ ...data, weight: e.target.value })}
              placeholder={data.weightUnit === "kg" ? "e.g. 75" : "e.g. 165"}
              className="bg-muted border-border text-foreground mt-1"
            />
            <p className="text-muted-foreground text-xs mt-1.5">
              Optional and editable at any time.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={onContinue}
        disabled={saving}
        className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Continue
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>

      <button
        onClick={onContinue}
        disabled={saving}
        className="w-full text-center text-muted-foreground text-sm hover:text-foreground transition-colors py-2"
      >
        Skip for now
      </button>
    </div>
  );
}

const AREA_TO_MOVEMENT_KEY: Record<string, string> = {
  head_neck: "neck",
  shoulders: "shoulder",
  upper_back: "upper_back",
  lower_back: "lower_back",
  chest: "upper_back",
  arms: "elbow",
  elbows: "elbow",
  wrists_hands: "wrist_hand",
  hips: "hip",
  knees: "knee",
  ankles_feet: "ankle_foot",
  other: "",
};

type AssessStep = "select" | "side" | "severity" | "movement" | "movement_detail" | "training";

function PainAssessmentFlow({
  painAreas,
  addOrUpdatePainArea,
  updatePainArea,
  removePainArea,
}: {
  painAreas: BodyArea[];
  addOrUpdatePainArea: (id: string, label: string) => void;
  updatePainArea: (id: string, field: string, value: any) => void;
  removePainArea: (id: string) => void;
}) {
  const [assessStep, setAssessStep] = useState<AssessStep>("select");
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [assessStep]);

  const currentArea = currentAreaId ? painAreas.find((a) => a.id === currentAreaId) : null;

  const handleSelectArea = (id: string, label: string) => {
    const existing = painAreas.find((a) => a.id === id);
    if (existing) {
      removePainArea(id);
      return;
    }
    addOrUpdatePainArea(id, label);
    setCurrentAreaId(id);
    setAssessStep("side");
  };

  const goBack = (step: AssessStep) => {
    if (step === "side") {
      if (currentAreaId) removePainArea(currentAreaId);
      setCurrentAreaId(null);
      setAssessStep("select");
    } else if (step === "severity") setAssessStep("side");
    else if (step === "movement") setAssessStep("severity");
    else if (step === "movement_detail") setAssessStep("movement");
    else if (step === "training") {
      if (currentArea && currentArea.movementImpact !== "none") setAssessStep("movement_detail");
      else setAssessStep("movement");
    }
  };

  const handleMovementNext = () => {
    if (currentArea && currentArea.movementImpact !== "none") {
      setAssessStep("movement_detail");
    } else {
      setAssessStep("training");
    }
  };

  const handleDone = () => {
    setCurrentAreaId(null);
    setAssessStep("select");
  };

  const getMovementOptions = () => {
    if (!currentAreaId) return [];
    const key = AREA_TO_MOVEMENT_KEY[currentAreaId] || "";
    return MOVEMENT_LIMITATIONS_BY_AREA[key] || [];
  };

  const toggleMovementLimitation = (limitId: string) => {
    if (!currentArea) return;
    const current = currentArea.movementLimitations || [];
    if (limitId === "all_of_the_above") {
      const allOptions = getMovementOptions().map((o) => o.id);
      updatePainArea(currentArea.id, "movementLimitations", allOptions);
      return;
    }
    const filtered = current.filter((id) => id !== "all_of_the_above");
    if (filtered.includes(limitId)) {
      updatePainArea(currentArea.id, "movementLimitations", filtered.filter((id) => id !== limitId));
    } else {
      updatePainArea(currentArea.id, "movementLimitations", [...filtered, limitId]);
    }
  };

  const stepHeader = (step: AssessStep) => (
    <div className="flex items-center gap-2 mb-1">
      <button onClick={() => goBack(step)} className="text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30">
        {currentArea?.label}
      </span>
    </div>
  );

  const nextButton = (onClick: () => void, label = "Continue assessment") => (
    <Button onClick={onClick} className="w-full bg-card hover:bg-muted border border-border text-foreground py-6 rounded-xl">
      {label}
      <ChevronRight className="w-5 h-5 ml-2" />
    </Button>
  );

  const optionButton = (selected: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border text-left transition-all ${
        selected ? "bg-[#0cc9a9]/20 border-[#0cc9a9]" : "bg-card border-border"
      }`}
    >
      <span className={`font-medium text-sm ${selected ? "text-[#0cc9a9]" : "text-foreground"}`}>{label}</span>
    </button>
  );

  if (assessStep === "side" && currentArea) {
    return (
      <div className="space-y-4">
        {stepHeader("side")}
        <p className="text-foreground text-base font-medium">Which side?</p>
        <div className="space-y-2">
          {optionButton(currentArea.side === "left", () => updatePainArea(currentArea.id, "side", "left"), "Left")}
          {optionButton(currentArea.side === "right", () => updatePainArea(currentArea.id, "side", "right"), "Right")}
          {optionButton(currentArea.side === "both", () => updatePainArea(currentArea.id, "side", "both"), "Both")}
        </div>
        {nextButton(() => setAssessStep("severity"))}
      </div>
    );
  }

  if (assessStep === "severity" && currentArea) {
    return (
      <div className="space-y-4">
        {stepHeader("severity")}
        <p className="text-foreground text-base font-medium">How uncomfortable does this feel right now?</p>
        <SeveritySlider
          value={currentArea.severity}
          onValueChange={(v) => updatePainArea(currentArea.id, "severity", typeof v === 'number' ? v : v[0])}
        />
        {nextButton(() => setAssessStep("movement"))}
      </div>
    );
  }

  if (assessStep === "movement" && currentArea) {
    return (
      <div className="space-y-4">
        {stepHeader("movement")}
        <p className="text-foreground text-base font-medium">Does this limit how you move?</p>
        <div className="space-y-2">
          {optionButton(currentArea.movementImpact === "none", () => updatePainArea(currentArea.id, "movementImpact", "none"), "No, movement feels normal")}
          {optionButton(currentArea.movementImpact === "slight", () => updatePainArea(currentArea.id, "movementImpact", "slight"), "A little restricted")}
          {optionButton(currentArea.movementImpact === "significant", () => updatePainArea(currentArea.id, "movementImpact", "significant"), "Yes, it limits movement")}
        </div>
        {nextButton(handleMovementNext)}
      </div>
    );
  }

  if (assessStep === "movement_detail" && currentArea) {
    const options = getMovementOptions();
    if (options.length === 0) {
      setAssessStep("training");
      return null;
    }
    return (
      <div className="space-y-4">
        {stepHeader("movement_detail")}
        <p className="text-foreground text-base font-medium">What movements cause you discomfort?</p>
        <p className="text-muted-foreground text-xs">Select all that apply.</p>
        <div className="space-y-2">
          {options.map((opt) => {
            const selected = (currentArea.movementLimitations || []).includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleMovementLimitation(opt.id)}
                className={`w-full p-3 rounded-xl border text-left text-sm font-medium transition-all ${
                  selected ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]" : "bg-card border-border text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {nextButton(() => setAssessStep("training"))}
      </div>
    );
  }

  if (assessStep === "training" && currentArea) {
    return (
      <div className="space-y-4">
        {stepHeader("training")}
        <p className="text-foreground text-base font-medium">How does this affect training?</p>
        <div className="space-y-2">
          {optionButton(currentArea.trainingImpact === "normal", () => updatePainArea(currentArea.id, "trainingImpact", "normal"), "I can train as normal")}
          {optionButton(currentArea.trainingImpact === "limited", () => updatePainArea(currentArea.id, "trainingImpact", "limited"), "Some movements feel uncomfortable")}
          {optionButton(currentArea.trainingImpact === "cannot_train", () => updatePainArea(currentArea.id, "trainingImpact", "cannot_train"), "I can't train like normal")}
        </div>
        {nextButton(handleDone, "Log area")}
      </div>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">Select an area to assess:</p>
      <div className="grid grid-cols-2 gap-2">
        {PAIN_AREA_LIST.map((area) => {
          const isLogged = painAreas.some((a) => a.id === area.id);
          return (
            <button
              key={area.id}
              onClick={() => handleSelectArea(area.id, area.label)}
              className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${
                isLogged
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground"
              }`}
            >
              {area.label}
            </button>
          );
        })}
      </div>

      {painAreas.length > 0 && (
        <div className="space-y-2 mt-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Logged areas
          </Label>
          {painAreas.map((area) => (
            <div
              key={area.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
            >
              <div>
                <span className="text-foreground text-sm font-medium">{area.label}</span>
                <span className="text-muted-foreground text-xs ml-2">{area.severity}/10</span>
              </div>
              <button
                onClick={() => removePainArea(area.id)}
                className="text-muted-foreground hover:text-red-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CoachingPhase({
  subStep,
  data,
  onChange,
  toggleEquipment,
  addOrUpdatePainArea,
  updatePainArea,
  removePainArea,
  onContinue,
  saving,
}: {
  subStep: number;
  data: OnboardingData["coaching"];
  onChange: (d: OnboardingData["coaching"]) => void;
  toggleEquipment: (item: string) => void;
  addOrUpdatePainArea: (id: string, label: string) => void;
  updatePainArea: (id: string, field: string, value: any) => void;
  removePainArea: (id: string) => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const EXPERIENCE_OPTIONS = [
    { value: "beginner", label: "Beginner", description: "New to training or returning after a long break" },
    { value: "intermediate", label: "Intermediate", description: "Trained before and reasonably comfortable with the basics" },
    { value: "experienced", label: "Experienced", description: "Trained consistently for years and confident with most exercises" },
  ];

  const singleSelectButton = (value: string, current: string, onSelect: () => void, children: React.ReactNode) => (
    <button
      key={value}
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border text-left transition-all ${
        current === value
          ? "bg-[#0cc9a9]/20 border-[#0cc9a9]"
          : "bg-card border-border hover:border-muted-foreground/50"
      }`}
    >
      {children}
    </button>
  );

  if (subStep === 0) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Training experience</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 1 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> How experienced are you with training?
          </p>
        </div>

        <div className="space-y-3">
          {EXPERIENCE_OPTIONS.map((opt) =>
            singleSelectButton(opt.value, data.experienceLevel, () => onChange({ ...data, experienceLevel: opt.value }),
              <div>
                <span className={`font-medium block ${data.experienceLevel === opt.value ? "text-[#0cc9a9]" : "text-foreground"}`}>
                  {opt.label}
                </span>
                <span className="text-muted-foreground text-xs mt-0.5 block">{opt.description}</span>
              </div>
            )
          )}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.experienceLevel || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 1) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Training location</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 2 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> Where will you mainly be training?
          </p>
        </div>

        <div className="space-y-3">
          {["Home", "Gym", "Both"].map((env) => (
            <button
              key={env}
              onClick={() => onChange({ ...data, trainingEnvironment: env.toLowerCase() })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.trainingEnvironment === env.toLowerCase()
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {env}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.trainingEnvironment || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 2) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Equipment access</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 3 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> What equipment do you have access to?
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq}
              onClick={() => toggleEquipment(eq)}
              className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                data.equipment.includes(eq)
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-muted-foreground hover:border-muted-foreground/50"
              }`}
            >
              {eq}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={data.equipment.length === 0 || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 3) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Time availability</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 4 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> How much time do you have per session?
          </p>
        </div>

        <div className="space-y-3">
          {["15-30 min", "30-45 min", "45-60 min", "60+ min"].map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...data, timeAvailability: t })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.timeAvailability === t
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.timeAvailability || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 4) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Workout frequency</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 5 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> How many days per week can you train?
          </p>
        </div>

        <div className="space-y-3">
          {["2 days", "3 days", "4 days", "5 days", "6+ days"].map((f) => (
            <button
              key={f}
              onClick={() => onChange({ ...data, workoutFrequency: f })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.workoutFrequency === f
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.workoutFrequency || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 5) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Moon className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Sleep</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 6 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> How many hours of sleep do you get?
          </p>
        </div>

        <div className="space-y-3">
          {["Under 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8+ hours"].map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...data, sleepHours: s })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.sleepHours === s
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.sleepHours || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 6) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Stress</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 7 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> How would you rate your stress levels?
          </p>
        </div>

        <div className="space-y-3">
          {["Low", "Moderate", "High", "Very high"].map((level) => (
            <button
              key={level}
              onClick={() => onChange({ ...data, stressLevel: level.toLowerCase() })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.stressLevel === level.toLowerCase()
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.stressLevel || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 7) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Desk-based work</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 8 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> Do you spend most of your day at a desk?
          </p>
        </div>

        <div className="space-y-3">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              onClick={() => onChange({ ...data, deskBased: opt.toLowerCase() })}
              className={`w-full p-4 rounded-xl border text-sm font-medium transition-all ${
                data.deskBased === opt.toLowerCase()
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                  : "bg-card border-border text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.deskBased || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 8) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Pain or limitations</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 9 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> Do you have any pain or movement issues?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onChange({ ...data, hasPainOrInjury: true })}
            className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
              data.hasPainOrInjury === true
                ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                : "bg-card border-border text-foreground"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onChange({ ...data, hasPainOrInjury: false, painAreas: [] })}
            className={`flex-1 p-4 rounded-xl border text-sm font-medium transition-all ${
              data.hasPainOrInjury === false
                ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
                : "bg-card border-border text-foreground"
            }`}
          >
            No
          </button>
        </div>

        {data.hasPainOrInjury === true && (
          <PainAssessmentFlow
            painAreas={data.painAreas}
            addOrUpdatePainArea={addOrUpdatePainArea}
            updatePainArea={updatePainArea}
            removePainArea={removePainArea}
          />
        )}

        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-muted-foreground text-xs leading-relaxed">
            This information is for awareness only. Meridian does not assess risk or determine appropriate activity. You are responsible for choosing what is appropriate for you.
          </p>
        </div>

        <Button
          onClick={onContinue}
          disabled={data.hasPainOrInjury === null || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 9) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Primary goal</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Question 10 of 10</span>
          <p className="text-foreground text-base">
            <span className="font-bold">Q:</span> What would you like to focus on?
          </p>
        </div>

        <div className="space-y-2">
          {GOAL_OPTIONS.map((goal) => {
            const Icon = goal.icon;
            const isSelected = data.primaryGoal === goal.id;
            const isExpanded = expandedGoalId === goal.id;
            return (
              <div
                key={goal.id}
                className={`w-full rounded-xl border transition-all overflow-hidden ${
                  isSelected
                    ? "bg-[#0cc9a9]/20 border-[#0cc9a9]"
                    : "bg-card border-border hover:border-muted-foreground/50"
                }`}
              >
                <button
                  onClick={() => onChange({ ...data, primaryGoal: goal.id })}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-[#0cc9a9]/30" : "bg-muted"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isSelected ? "text-[#0cc9a9]" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span
                    className={`font-medium flex-1 ${
                      isSelected ? "text-[#0cc9a9]" : "text-foreground"
                    }`}
                  >
                    {goal.label}
                  </span>
                  {isSelected && (
                    <Check className="w-5 h-5 text-[#0cc9a9] shrink-0" />
                  )}
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedGoalId(isExpanded ? null : goal.id);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isExpanded
                        ? "bg-[#0cc9a9]/20 text-[#0cc9a9]"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed pl-14">
                      {goal.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button
          onClick={onContinue}
          disabled={!data.primaryGoal || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  const screening = data.movementScreening;
  const updateScreening = (field: string, value: any) => {
    onChange({
      ...data,
      movementScreening: { ...data.movementScreening, [field]: value },
    });
  };

  const screeningYesNo = (field: string, current: boolean | null) => (
    <div className="flex gap-3">
      <button
        onClick={() => updateScreening(field, true)}
        className={`flex-1 p-3.5 rounded-xl border text-sm font-medium transition-all ${
          current === true
            ? "bg-[#0cc9a9]/20 border-[#0cc9a9] text-[#0cc9a9]"
            : "bg-card border-border text-foreground hover:border-muted-foreground/50"
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => updateScreening(field, false)}
        className={`flex-1 p-3.5 rounded-xl border text-sm font-medium transition-all ${
          current === false
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
            : "bg-card border-border text-foreground hover:border-muted-foreground/50"
        }`}
      >
        No
      </button>
    </div>
  );

  if (subStep === 10) {
    const screen1Complete = screening.squatPain !== null && screening.kneeStairsPain !== null && screening.bendingPain !== null && screening.lowerBackPain !== null;

    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Movement screening</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Lower body & spine</span>
          <p className="text-muted-foreground text-sm">
            These quick questions help us personalise your programme and avoid exercises that may cause discomfort.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Does squatting down to chair height cause pain or discomfort?</p>
            {screeningYesNo("squatPain", screening.squatPain)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Does stairs or downhill walking cause knee pain?</p>
            {screeningYesNo("kneeStairsPain", screening.kneeStairsPain)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Does bending forward (for example, to tie your shoes) cause discomfort?</p>
            {screeningYesNo("bendingPain", screening.bendingPain)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Do you regularly experience lower back discomfort after sitting or exercising?</p>
            {screeningYesNo("lowerBackPain", screening.lowerBackPain)}
          </div>
        </div>

        <Button
          onClick={onContinue}
          disabled={!screen1Complete || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 11) {
    const screen2Complete = screening.overheadPain !== null && screening.pushingShoulderPain !== null && screening.singleLegInstability !== null && screening.neckShoulderTension !== null;

    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Movement screening</h2>
          </div>
          <span className="inline-block bg-[#0cc9a9]/10 text-[#0cc9a9] text-xs font-medium px-3 py-1.5 rounded-full border border-[#0cc9a9]/30 mb-3">Upper body & stability</span>
          <p className="text-muted-foreground text-sm">
            Nearly there. A few more questions about upper body and balance.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Does lifting your arms fully overhead cause discomfort?</p>
            {screeningYesNo("overheadPain", screening.overheadPain)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Does a push-up or pressing movement cause shoulder pain?</p>
            {screeningYesNo("pushingShoulderPain", screening.pushingShoulderPain)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Do single-leg movements (like lunges or step-ups) feel unstable or painful?</p>
            {screeningYesNo("singleLegInstability", screening.singleLegInstability)}
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Do you frequently experience neck or upper shoulder tension?</p>
            {screeningYesNo("neckShoulderTension", screening.neckShoulderTension)}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label className="text-sm text-muted-foreground">Optional: Add anything else that may affect your training</Label>
          <Textarea
            value={screening.optionalNotes}
            onChange={(e) => updateScreening("optionalNotes", e.target.value.slice(0, 250))}
            placeholder="e.g. recovering from surgery, old ankle sprain..."
            className="bg-card border-border text-foreground resize-none h-20"
            maxLength={250}
          />
          <p className="text-xs text-muted-foreground text-right">{screening.optionalNotes.length}/250</p>
        </div>

        <Button
          onClick={onContinue}
          disabled={!screen2Complete || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  const hasAnyFlag = screening.squatPain || screening.kneeStairsPain || screening.bendingPain || screening.lowerBackPain || screening.overheadPain || screening.pushingShoulderPain || screening.singleLegInstability || screening.neckShoulderTension;

  const feedbackItems: string[] = [];
  if (screening.squatPain) feedbackItems.push("Deep squat variations will be limited");
  if (screening.kneeStairsPain) feedbackItems.push("High-impact leg exercises will be avoided");
  if (screening.bendingPain) feedbackItems.push("Heavy hinge movements will be adjusted");
  if (screening.lowerBackPain) feedbackItems.push("Spinal loading exercises will be modified");
  if (screening.overheadPain) feedbackItems.push("Overhead pressing will be reduced");
  if (screening.pushingShoulderPain) feedbackItems.push("Heavy pressing exercises will be adjusted");
  if (screening.singleLegInstability) feedbackItems.push("Advanced single-leg work will be limited");
  if (screening.neckShoulderTension) feedbackItems.push("Heavy pulling loads will be adjusted");

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4 mb-1">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-[#0cc9a9]" />
          <h2 className="text-2xl font-bold">
            {hasAnyFlag ? "We've adjusted your plan" : "Looking good"}
          </h2>
        </div>
      </div>

      {hasAnyFlag ? (
        <div className="space-y-4">
          <p className="text-foreground text-sm leading-relaxed">
            Based on your answers, we'll tailor your programme recommendations to work around these areas:
          </p>
          <div className="space-y-2">
            {feedbackItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-[#0cc9a9]/10 border border-[#0cc9a9]/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#0cc9a9] shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your AI coaches will also be aware of these areas and can suggest alternatives during your training.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium">No movement concerns flagged</p>
              <p className="text-xs text-muted-foreground mt-1">All exercise types are available for your programme recommendations.</p>
            </div>
          </div>
        </div>
      )}

      {screening.optionalNotes && (
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Your note:</p>
          <p className="text-sm text-foreground">{screening.optionalNotes}</p>
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={saving}
        className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        View Your Recommendations
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}

const ONBOARDING_GOALS = [
  { id: "functional-strength", title: "Improve Functional Strength", description: "Strengthen the core movement patterns your body relies on every day so you feel more powerful, stable and resilient.", type: "custom" },
  { id: "cardiovascular-fitness", title: "Improve Cardiovascular Fitness", description: "Increase aerobic capacity so you recover faster, handle stress better and feel more energised.", type: "custom" },
  { id: "move-better", title: "Move Better With Less Pain", description: "Improve mobility, control and joint health so your body feels smoother, looser and more capable.", type: "custom" },
  { id: "weight-loss", title: "Lose Weight", description: "Build a sustainable approach to body composition through training, nutrition and daily movement.", type: "bodyweight" },
  { id: "daily-movement", title: "Increase Daily Movement", description: "Add more steps and movement breaks to boost energy, improve health markers and support easier fat control.", type: "custom" },
  { id: "sleep-quality", title: "Improve Sleep Quality", description: "Build consistent routines that help you fall asleep faster, stay asleep longer and wake up with more energy.", type: "custom" },
  { id: "stable-energy", title: "Eat With Stable Energy", description: "Structure balanced meals that keep appetite, mood and blood sugar stable throughout the day.", type: "custom" },
  { id: "protein-target", title: "Hit a Daily Protein Target", description: "Reach a sustainable protein intake to support muscle, recovery and body composition.", type: "custom" },
  { id: "hydration", title: "Stay Hydrated Consistently", description: "Create hydration habits that support focus, performance and overall wellbeing.", type: "custom" },
  { id: "reduce-stress", title: "Reduce Stress Levels", description: "Use breath work and recovery strategies to keep energy high and improve emotional resilience.", type: "custom" },
  { id: "train-consistently", title: "Train Consistently", description: "Create a weekly training rhythm that builds momentum and removes the stop start cycle.", type: "custom" },
  { id: "desk-health", title: "Improve Desk Health", description: "Enhance posture, alignment and movement habits to minimise tension and feel better throughout the workday.", type: "custom" },
  { id: "mental-health", title: "Support Better Mental Health", description: "Develop habits that build clarity, emotional control and a calmer day to day experience.", type: "custom" },
  { id: "healthier-lifestyle", title: "Build a Healthier Lifestyle", description: "Integrate essential habits around movement, training, nutrition, sleep and recovery for long term wellbeing.", type: "custom" },
];

function ProgrammePreviewModal({ programId, open, onClose }: { programId: number | null; open: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentWorkoutIdx, setCurrentWorkoutIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (programId && open) {
      setLoading(true);
      setCurrentWorkoutIdx(0);
      fetch(`/api/programs/${programId}/preview`)
        .then((r) => r.json())
        .then((d) => setPreview(d))
        .catch(() => setPreview(null))
        .finally(() => setLoading(false));
    }
  }, [programId, open]);

  const workouts = preview?.workouts || [];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentWorkoutIdx < workouts.length - 1) {
        setCurrentWorkoutIdx(currentWorkoutIdx + 1);
      } else if (diff < 0 && currentWorkoutIdx > 0) {
        setCurrentWorkoutIdx(currentWorkoutIdx - 1);
      }
    }
  };

  const envLabel = (env: string) => {
    const map: Record<string, string> = { home_gym: "Home", bodyweight: "Home", full_gym: "Gym", mixed: "Mixed" };
    return map[env] || env;
  };

  const formatSets = (sets: any) => {
    if (!sets || !Array.isArray(sets)) return "";
    return sets.map((s: any, i: number) => {
      const reps = s.reps || s.duration || "";
      const rest = s.rest || "";
      return `${reps}${rest ? ` / ${rest} rest` : ""}`;
    }).join(", ");
  };

  const currentWorkout = workouts[currentWorkoutIdx];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background border-border p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#0cc9a9] mb-3" />
            <p className="text-muted-foreground text-sm">Loading programme details...</p>
          </div>
        ) : !preview ? (
          <div className="p-6 text-center text-muted-foreground">
            <p>Could not load programme details.</p>
          </div>
        ) : (
          <div>
            <div className="p-5 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">{preview.title}</h3>
              {preview.description && (
                <p className="text-muted-foreground text-sm mt-1">{preview.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {preview.equipment && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded">{envLabel(preview.equipment)}</span>
                )}
                {preview.weeks && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded">{preview.weeks} weeks</span>
                )}
                {preview.trainingDaysPerWeek && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded">{preview.trainingDaysPerWeek}x per week</span>
                )}
                {preview.difficulty && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded capitalize">{preview.difficulty}</span>
                )}
              </div>
            </div>

            {workouts.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <p>No workouts have been added to this programme yet.</p>
              </div>
            ) : (
              <div>
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Week 1 Workouts</h4>
                  <span className="text-xs text-muted-foreground">{currentWorkoutIdx + 1} of {workouts.length}</span>
                </div>

                <div className="flex justify-center gap-1.5 pb-3">
                  {workouts.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentWorkoutIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentWorkoutIdx ? "w-6 bg-[#0cc9a9]" : "w-1.5 bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>

                <div
                  className="px-5 pb-5"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {currentWorkout && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold text-foreground">{currentWorkout.name}</h5>
                          <span className="text-xs text-muted-foreground">Workout {currentWorkoutIdx + 1}</span>
                        </div>
                        {currentWorkout.description && (
                          <p className="text-muted-foreground text-xs mt-1">{currentWorkout.description}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {currentWorkout.category && (
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">{currentWorkout.category}</span>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-border">
                        {(currentWorkout.blocks || []).map((block: any, bi: number) => {
                          const isWarmup = block.section === "warmup";
                          const blockLabel = block.blockType === "superset" ? "Superset" : block.blockType === "triset" ? "Triset" : block.blockType === "circuit" ? "Circuit" : null;

                          return (
                            <div key={bi}>
                              {isWarmup && bi === 0 && (
                                <div className="px-4 pt-3 pb-1">
                                  <span className="text-xs font-semibold text-[#0cc9a9] uppercase tracking-wide">Warm Up</span>
                                </div>
                              )}
                              {!isWarmup && (currentWorkout.blocks || []).findIndex((b: any) => b.section !== "warmup") === bi && (
                                <div className="px-4 pt-3 pb-1">
                                  <span className="text-xs font-semibold text-[#0cc9a9] uppercase tracking-wide">Main</span>
                                </div>
                              )}
                              {blockLabel && (
                                <div className="px-4 pt-2">
                                  <span className="text-[10px] bg-[#0cc9a9]/10 text-[#0cc9a9] px-2 py-0.5 rounded-full font-medium">{blockLabel}</span>
                                </div>
                              )}
                              {(block.exercises || []).map((ex: any, ei: number) => (
                                <div key={ei} className="flex items-center gap-3 px-4 py-2.5">
                                  {ex.imageUrl ? (
                                    <img src={ex.imageUrl} alt={ex.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                      <Dumbbell className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{ex.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {Array.isArray(ex.sets) ? `${ex.sets.length} sets` : ex.sets || ""}
                                      {ex.tempo ? ` | ${ex.tempo}` : ""}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {block.rest && (
                                <div className="px-4 pb-2">
                                  <span className="text-[10px] text-muted-foreground">Rest: {block.rest}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {workouts.length > 1 && (
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => setCurrentWorkoutIdx(Math.max(0, currentWorkoutIdx - 1))}
                        disabled={currentWorkoutIdx === 0}
                        className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentWorkoutIdx(Math.min(workouts.length - 1, currentWorkoutIdx + 1))}
                        disabled={currentWorkoutIdx === workouts.length - 1}
                        className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecommendationsPhase({
  subStep,
  recommendations,
  loading,
  data,
  onChange,
  onContinue,
  saving,
}: {
  subStep: number;
  recommendations: any;
  loading: boolean;
  data: OnboardingData["recommendations"];
  onChange: (d: OnboardingData["recommendations"]) => void;
  onContinue: () => void;
  saving: boolean;
}) {
  const [previewProgramId, setPreviewProgramId] = useState<number | null>(null);

  if (loading || !recommendations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#0cc9a9] mb-4" />
        <p className="text-muted-foreground">Building your personalised recommendations...</p>
      </div>
    );
  }

  const programmes = recommendations.programmes || [];
  const paths = recommendations.learningPaths || [];
  const habits = recommendations.habits || [];

  if (subStep === 0) {
    const recommended = programmes.find((p: any) => p.recommended);
    const envLabel = (env: string) => {
      const map: Record<string, string> = { home_gym: "Home", bodyweight: "Home", full_gym: "Gym", mixed: "Mixed" };
      return map[env] || env;
    };

    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Dumbbell className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Choose your programme</h2>
          </div>
          <p className="text-foreground text-base">
            Based on what you've shared, here are programmes that fit you. Tap a card to select it, or tap "View details" to explore the workouts inside.
          </p>
        </div>

        {programmes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground bg-muted/50 rounded-xl border border-border">
            <p>No programmes available right now. You can explore the library later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programmes.slice(0, 3).map((prog: any, i: number) => {
              const isRec = prog.recommended || (i === 0 && !recommended);
              const isSelected = data.selectedProgramme?.id === prog.id;
              return (
                <div
                  key={prog.id || i}
                  className={`w-full rounded-xl border transition-all overflow-hidden ${
                    isSelected
                      ? "bg-[#0cc9a9]/20 border-[#0cc9a9] ring-1 ring-[#0cc9a9]"
                      : "bg-card border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <button
                    onClick={() => onChange({ ...data, selectedProgramme: isSelected ? null : prog })}
                    className="w-full text-left p-4"
                  >
                    {isRec && (
                      <span className="inline-block px-2 py-0.5 bg-[#0cc9a9]/20 text-[#0cc9a9] text-xs font-medium rounded-full mb-2">
                        <Star className="w-3 h-3 inline mr-1" />
                        Recommended
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{prog.title}</h4>
                        {prog.description && (
                          <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{prog.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
                          {prog.equipment && (
                            <span className="bg-muted px-2 py-0.5 rounded">{envLabel(prog.equipment)}</span>
                          )}
                          {(prog.trainingDaysPerWeek || prog.weeks) && (
                            <span className="bg-muted px-2 py-0.5 rounded">
                              {prog.trainingDaysPerWeek ? `${prog.trainingDaysPerWeek}x per week` : `${prog.weeks} weeks`}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-[#0cc9a9] shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                  {prog.id && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewProgramId(prog.id);
                        }}
                        className="flex items-center gap-1.5 text-xs text-[#0cc9a9] hover:text-[#0cc9a9]/80 transition-colors font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View details
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ProgrammePreviewModal
          programId={previewProgramId}
          open={previewProgramId !== null}
          onClose={() => setPreviewProgramId(null)}
        />

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              programmes.slice(0, 3).forEach((prog: any) => {
                if (prog.id) {
                  apiRequest("POST", "/api/recommendations/event", {
                    programId: prog.id,
                    eventType: "skipped",
                    source: "onboarding",
                  }).catch(() => {});
                }
              });
              onChange({ ...data, selectedProgramme: null });
              onContinue();
            }}
            className="flex-1 border-border text-muted-foreground hover:text-foreground py-6 rounded-xl"
          >
            Skip for now
          </Button>
          <Button
            onClick={() => {
              if (data.selectedProgramme) {
                programmes.slice(0, 3).forEach((prog: any) => {
                  if (prog.id && prog.id !== data.selectedProgramme.id) {
                    apiRequest("POST", "/api/recommendations/event", {
                      programId: prog.id,
                      eventType: "skipped",
                      source: "onboarding",
                    }).catch(() => {});
                  }
                });
              }
              onContinue();
            }}
            disabled={!data.selectedProgramme || saving}
            className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
          >
            Select
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (subStep === 1) {
    const isWeightGoal = data.selectedGoal?.type === "bodyweight";
    const weightData = data.weightGoalData || { currentWeight: "", targetWeight: "", unit: "kg" };
    const canContinueGoal = data.selectedGoal && (!isWeightGoal || (weightData.currentWeight && weightData.targetWeight));

    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Your main goal</h2>
          </div>
          <p className="text-foreground text-base">
            What is your main goal right now?
          </p>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {ONBOARDING_GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => {
                const newGoal = data.selectedGoal?.id === goal.id ? null : goal;
                onChange({
                  ...data,
                  selectedGoal: newGoal,
                  weightGoalData: newGoal?.type === "bodyweight" ? (data.weightGoalData || { currentWeight: "", targetWeight: "", unit: "kg" }) : null,
                });
              }}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                data.selectedGoal?.id === goal.id
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9]"
                  : "bg-card border-border hover:border-muted-foreground/50"
              }`}
            >
              <h4 className="font-semibold text-foreground text-sm">{goal.title}</h4>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{goal.description}</p>
            </button>
          ))}
        </div>

        {isWeightGoal && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-4 h-4 text-[#0cc9a9]" />
                <span className="text-sm font-medium text-foreground">Weight target</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => onChange({ ...data, weightGoalData: { ...weightData, unit: "kg" } })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    weightData.unit === "kg" ? "bg-[#0cc9a9]/20 text-[#0cc9a9] border border-[#0cc9a9]" : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  kg
                </button>
                <button
                  onClick={() => onChange({ ...data, weightGoalData: { ...weightData, unit: "lbs" } })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    weightData.unit === "lbs" ? "bg-[#0cc9a9]/20 text-[#0cc9a9] border border-[#0cc9a9]" : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  lbs
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Current weight</Label>
                  <Input
                    type="number"
                    placeholder={weightData.unit === "kg" ? "85" : "187"}
                    value={weightData.currentWeight}
                    onChange={(e) => onChange({ ...data, weightGoalData: { ...weightData, currentWeight: e.target.value } })}
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Target weight</Label>
                  <Input
                    type="number"
                    placeholder={weightData.unit === "kg" ? "78" : "172"}
                    value={weightData.targetWeight}
                    onChange={(e) => onChange({ ...data, weightGoalData: { ...weightData, targetWeight: e.target.value } })}
                    className="bg-muted border-border text-foreground mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={onContinue}
          disabled={!canContinueGoal || saving}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl disabled:opacity-50"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  if (subStep === 2) {
    const path = paths[0];

    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Learning path</h2>
          </div>
          <p className="text-foreground text-base">
            We recommend starting with this learning path based on your goals.
          </p>
        </div>

        {!path ? (
          <div className="p-6 text-center text-muted-foreground bg-muted/50 rounded-xl border border-border">
            <p>No learning paths available right now.</p>
          </div>
        ) : (
          <button
            onClick={() => onChange({ ...data, selectedLearningPath: data.selectedLearningPath?.id === path.id ? null : path })}
            className={`w-full text-left p-5 rounded-xl border transition-all ${
              data.selectedLearningPath?.id === path.id
                ? "bg-[#0cc9a9]/20 border-[#0cc9a9]"
                : "bg-card border-border hover:border-muted-foreground/50"
            }`}
          >
            <h4 className="font-semibold text-foreground text-lg">{path.title}</h4>
            {path.description && (
              <p className="text-muted-foreground text-sm mt-2">{path.description}</p>
            )}
            {path.category && (
              <span className="inline-block mt-3 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                {path.category}
              </span>
            )}
          </button>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onChange({ ...data, selectedLearningPath: null });
              onContinue();
            }}
            className="flex-1 border-border text-muted-foreground hover:text-foreground py-6 rounded-xl"
          >
            Skip for now
          </Button>
          <Button
            onClick={onContinue}
            disabled={saving}
            className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4 mb-1">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-6 h-6 text-[#0cc9a9]" />
          <h2 className="text-2xl font-bold">Your first habit</h2>
        </div>
        <p className="text-foreground text-base">
          Start small. Pick one habit to build into your routine.
        </p>
      </div>

      {habits.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground bg-muted/50 rounded-xl border border-border">
          <p>No habits available right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.slice(0, 3).map((habit: any, i: number) => (
            <button
              key={habit.id || i}
              onClick={() => onChange({ ...data, selectedHabit: data.selectedHabit?.id === habit.id ? null : habit })}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                data.selectedHabit?.id === habit.id
                  ? "bg-[#0cc9a9]/20 border-[#0cc9a9]"
                  : "bg-card border-border hover:border-muted-foreground/50"
              }`}
            >
              <h4 className="font-semibold text-foreground">{habit.title}</h4>
              {habit.description && (
                <p className="text-muted-foreground text-sm mt-1">{habit.description}</p>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-xs text-center">You can add more habits anytime from the Habits section.</p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            onChange({ ...data, selectedHabit: null });
            onContinue();
          }}
          className="flex-1 border-border text-muted-foreground hover:text-foreground py-6 rounded-xl"
        >
          Skip for now
        </Button>
        <Button
          onClick={onContinue}
          disabled={saving}
          className="flex-1 bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Continue
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

const ONBOARDING_INTEGRATIONS = [
  { id: "apple-health", name: "Apple Health", description: "Sync steps, sleep, and heart rate data", icon: Heart, comingSoon: true },
  { id: "google-fit", name: "Google Fit", description: "Sync activity and wellness data", icon: Activity, comingSoon: true },
  { id: "fitbit", name: "Fitbit", description: "Sync fitness and sleep tracking", icon: Watch, comingSoon: true },
  { id: "garmin", name: "Garmin", description: "Sync workouts and health metrics", icon: Watch, comingSoon: true },
  { id: "whoop", name: "WHOOP", description: "Sync strain, recovery, and sleep data", icon: Activity, comingSoon: true },
  { id: "oura", name: "Oura Ring", description: "Sync sleep and readiness scores", icon: Activity, comingSoon: true },
];

function LaunchPhase({
  subStep,
  data,
  preferences,
  onPreferencesChange,
  onContinue,
  onComplete,
  saving,
}: {
  subStep: number;
  data: OnboardingData;
  preferences: OnboardingData["preferences"];
  onPreferencesChange: (p: OnboardingData["preferences"]) => void;
  onContinue: () => void;
  onComplete: () => void;
  saving: boolean;
}) {
  if (subStep === 0) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Connect your devices</h2>
          </div>
          <p className="text-foreground text-base">
            Sync your fitness devices and apps to automatically track your health data.
          </p>
        </div>

        <div className="space-y-2">
          {ONBOARDING_INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0cc9a9]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#0cc9a9]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium text-sm">{integration.name}</span>
                      {integration.comingSoon && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{integration.description}</p>
                  </div>
                </div>
                <Switch disabled={integration.comingSoon} />
              </div>
            );
          })}
        </div>

        <div className="bg-muted/50 rounded-xl p-3 border border-border">
          <p className="text-muted-foreground text-xs">
            More integrations are being added. You can connect devices anytime from your profile settings.
          </p>
        </div>

        <Button
          onClick={onContinue}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
        <button
          onClick={onContinue}
          className="w-full text-center text-muted-foreground text-sm py-2 hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  if (subStep === 1) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4 mb-1">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-[#0cc9a9]" />
            <h2 className="text-2xl font-bold">Preferences</h2>
          </div>
          <p className="text-foreground text-base">
            Set your preferred units and notification settings. You can change these anytime.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 space-y-5">
            <h3 className="font-medium text-foreground text-sm">Units</h3>

            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Weight</Label>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => onPreferencesChange({ ...preferences, weightUnit: "kg" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.weightUnit === "kg" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  kg
                </button>
                <button
                  onClick={() => onPreferencesChange({ ...preferences, weightUnit: "lbs" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.weightUnit === "lbs" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  lbs
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Distance</Label>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => onPreferencesChange({ ...preferences, distanceUnit: "km" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.distanceUnit === "km" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  km
                </button>
                <button
                  onClick={() => onPreferencesChange({ ...preferences, distanceUnit: "miles" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.distanceUnit === "miles" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  miles
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5 space-y-5">
            <h3 className="font-medium text-foreground text-sm">Display</h3>

            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Time Format</Label>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => onPreferencesChange({ ...preferences, timeFormat: "12h" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.timeFormat === "12h" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  12h
                </button>
                <button
                  onClick={() => onPreferencesChange({ ...preferences, timeFormat: "24h" })}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    preferences.timeFormat === "24h" ? "bg-[#0cc9a9] text-black" : "text-muted-foreground"
                  }`}
                >
                  24h
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-foreground text-sm">Notifications</Label>
              <Switch
                checked={preferences.notificationsEnabled}
                onCheckedChange={(c) => onPreferencesChange({ ...preferences, notificationsEnabled: c })}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={onContinue}
          className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
        <button
          onClick={onContinue}
          className="w-full text-center text-muted-foreground text-sm py-2 hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  const summaryItems = [
    { label: "Profile created", value: null },
    { label: "Programme", value: data.recommendations.selectedProgramme?.title || "None selected" },
    {
      label: "Goal",
      value: data.recommendations.selectedGoal?.title || "None selected",
      extra: data.recommendations.weightGoalData?.targetWeight
        ? `(${data.recommendations.weightGoalData.currentWeight} → ${data.recommendations.weightGoalData.targetWeight} ${data.recommendations.weightGoalData.unit})`
        : null,
    },
    { label: "Learning path", value: data.recommendations.selectedLearningPath?.title || "None selected" },
    { label: "Habit", value: data.recommendations.selectedHabit?.title || "None selected" },
    { label: "Units", value: `${preferences.weightUnit} / ${preferences.distanceUnit}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center pt-4">
        <div className="w-16 h-16 rounded-full bg-[#0cc9a9]/20 flex items-center justify-center mb-4">
          <Rocket className="w-8 h-8 text-[#0cc9a9]" />
        </div>
        <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          {data.recommendations.selectedProgramme
            ? "Your programme is ready. Start your first session."
            : "Your profile is set up. Explore the platform at your own pace."}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-5 space-y-3">
          <h3 className="font-medium text-foreground text-xs uppercase tracking-wider mb-3">Summary</h3>
          {summaryItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <span className="text-muted-foreground text-sm">
                {item.value ? (
                  <>
                    {item.label}:{" "}
                    <span className="text-white">{item.value}</span>
                    {item.extra && (
                      <span className="text-muted-foreground text-xs ml-1">{item.extra}</span>
                    )}
                  </>
                ) : (
                  <span className="text-white">{item.label}</span>
                )}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={onComplete}
        disabled={saving}
        className="w-full bg-[#0cc9a9] hover:bg-[#0cc9a9]/90 text-black py-6 rounded-xl text-lg"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <Rocket className="w-5 h-5 mr-2" />
        )}
        {data.recommendations.selectedProgramme ? "Start Your First Session" : "Start Exploring"}
      </Button>
    </div>
  );
}
