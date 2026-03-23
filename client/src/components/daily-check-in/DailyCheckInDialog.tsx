import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { X } from "lucide-react";
import type { InsertCheckIn, CheckIn } from "@shared/schema";

interface DailyCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkInToEdit?: CheckIn | null;
}

const SLIDER_LABELS = {
  mood: { 1: "VERY LOW", 2: "LOW", 3: "OK", 4: "GOOD", 5: "GREAT" },
  energy: { 1: "EXHAUSTED", 2: "LOW", 3: "OK", 4: "GOOD", 5: "ENERGISED" },
  stress: { 1: "VERY CALM", 2: "CALM", 3: "MODERATE", 4: "STRESSED", 5: "VERY STRESSED" },
  sleep: { 1: "TERRIBLE", 2: "POOR", 3: "OK", 4: "GOOD", 5: "GREAT" },
  clarity: { 1: "VERY UNCLEAR", 2: "FOGGY", 3: "OK", 4: "CLEAR", 5: "SHARP" },
};

const FEEDBACK_MESSAGES = [
  "Great work showing up for yourself.",
  "Consistency builds clarity.",
  "Logged. Your future self thanks you.",
  "Every check-in is a win.",
  "You're building better habits.",
];

const getBlueSliderGradient = (value: number | null, max: number = 5) => {
  if (value === null) return "linear-gradient(to right, #d1d5db 0%, #d1d5db 100%)";
  const percent = ((value - 1) / (max - 1)) * 100;
  return `linear-gradient(to right, #0cc9a9 0%, #0cc9a9 ${percent}%, #d1d5db ${percent}%, #d1d5db 100%)`;
};

export default function DailyCheckInDialog({ open, onOpenChange, checkInToEdit }: DailyCheckInDialogProps) {
  const { toast } = useToast();
  
  // Confirmation dialog state
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  
  // Section 1: Mood & Energy
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [energyScore, setEnergyScore] = useState<number | null>(null);
  
  // Section 2: Stress
  const [stressScore, setStressScore] = useState<number | null>(null);
  
  // Section 3: Yes/No questions
  const [headache, setHeadache] = useState<boolean | null>(null);
  const [alcohol, setAlcohol] = useState<boolean | null>(null);
  const [alcoholCount, setAlcoholCount] = useState<number>(1);
  const [sick, setSick] = useState<boolean | null>(null);
  const [painOrInjury, setPainOrInjury] = useState<boolean | null>(null);
  const [emotionallyStable, setEmotionallyStable] = useState<boolean | null>(null);
  const [anxious, setAnxious] = useState<boolean | null>(null);
  const [overwhelmed, setOverwhelmed] = useState<boolean | null>(null);
  const [exercisedYesterday, setExercisedYesterday] = useState<boolean | null>(null);
  const [caffeineAfter2pm, setCaffeineAfter2pm] = useState<boolean | null>(null);
  const [practicedMindfulness, setPracticedMindfulness] = useState<boolean | null>(null);
  
  // Conditional fatigue question
  const [fatigue, setFatigue] = useState<boolean | null>(null);
  const [showFatigueQuestion, setShowFatigueQuestion] = useState(false);
  
  // Section 4: Sleep & Clarity
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [clarityScore, setClarityScore] = useState<number | null>(null);
  
  // Section 5: Notes
  const [notes, setNotes] = useState("");
  
  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Fetch recent check-ins to check for consecutive low energy
  const { data: recentCheckIns } = useQuery<CheckIn[]>({
    queryKey: ["/api/check-ins/recent/3"],
    enabled: open && !checkInToEdit,
  });

  // Check for 3 consecutive days of low energy
  useEffect(() => {
    if (checkInToEdit?.fatigueTriggerMet) {
      setShowFatigueQuestion(true);
      return;
    }
    
    if (recentCheckIns && recentCheckIns.length >= 2) {
      const lowEnergyDays = recentCheckIns.slice(0, 2).filter(
        (c) => c.energyScore && c.energyScore <= 2
      );
      if (lowEnergyDays.length === 2 && energyScore !== null && energyScore <= 2) {
        setShowFatigueQuestion(true);
      } else {
        setShowFatigueQuestion(false);
        setFatigue(null);
      }
    }
  }, [recentCheckIns, energyScore, checkInToEdit]);

  // Populate form when editing
  useEffect(() => {
    if (checkInToEdit && open) {
      setMoodScore(checkInToEdit.moodScore ?? null);
      setEnergyScore(checkInToEdit.energyScore ?? null);
      setStressScore(checkInToEdit.stressScore ?? null);
      setSleepScore(checkInToEdit.sleepScore ?? null);
      setClarityScore(checkInToEdit.clarityScore ?? null);
      setHeadache(checkInToEdit.headache ?? false);
      setAlcohol(checkInToEdit.alcohol ?? false);
      setAlcoholCount(checkInToEdit.alcoholCount ?? 0);
      setSick(checkInToEdit.sick ?? false);
      setPainOrInjury(checkInToEdit.painOrInjury ?? false);
      setEmotionallyStable(checkInToEdit.emotionallyStable ?? true);
      setAnxious(checkInToEdit.anxious ?? false);
      setOverwhelmed(checkInToEdit.overwhelmed ?? false);
      setExercisedYesterday(checkInToEdit.exercisedYesterday ?? false);
      setCaffeineAfter2pm(checkInToEdit.caffeineAfter2pm ?? false);
      setPracticedMindfulness(checkInToEdit.practicedMindfulness ?? false);
      setFatigue(checkInToEdit.fatigue ?? null);
      setNotes(checkInToEdit.notes ?? "");
      if (checkInToEdit.fatigueTriggerMet) {
        setShowFatigueQuestion(true);
      }
    }
  }, [checkInToEdit, open]);

  const checkInMutation = useMutation({
    mutationFn: async (data: InsertCheckIn) => {
      return await apiRequest("POST", "/api/check-ins", data);
    },
    onSuccess: () => {
      const randomMessage = FEEDBACK_MESSAGES[Math.floor(Math.random() * FEEDBACK_MESSAGES.length)];
      setFeedbackMessage(randomMessage);
      setShowFeedback(true);
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/recent/3"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins"] });
      
      setTimeout(() => {
        onOpenChange(false);
        toast({
          title: "Check-in complete!",
          description: randomMessage,
        });
        resetForm();
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save check-in",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setMoodScore(null);
    setEnergyScore(null);
    setStressScore(null);
    setSleepScore(null);
    setClarityScore(null);
    setHeadache(null);
    setAlcohol(null);
    setAlcoholCount(1);
    setSick(null);
    setPainOrInjury(null);
    setEmotionallyStable(null);
    setAnxious(null);
    setOverwhelmed(null);
    setExercisedYesterday(null);
    setCaffeineAfter2pm(null);
    setPracticedMindfulness(null);
    setFatigue(null);
    setShowFatigueQuestion(false);
    setNotes("");
    setShowFeedback(false);
    setShowConfirmExit(false);
  };

  const handleSubmit = () => {
    if (moodScore === null || energyScore === null || stressScore === null || sleepScore === null || clarityScore === null) {
      toast({
        title: "Incomplete Check-In",
        description: "Please complete all sliders before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (showFatigueQuestion && fatigue === null) {
      toast({
        title: "Incomplete Check-In",
        description: "Please answer the fatigue question before submitting.",
        variant: "destructive",
      });
      return;
    }

    const localDateStr = format(new Date(), 'yyyy-MM-dd') + 'T12:00:00';
    
    const checkInData: InsertCheckIn = {
      userId: "",
      checkInDate: new Date(localDateStr),
      week: 1,
      moodScore,
      energyScore,
      stressScore,
      sleepScore,
      clarityScore,
      headache,
      alcohol,
      alcoholCount: alcohol ? alcoholCount : null,
      sick,
      painOrInjury,
      emotionallyStable,
      anxious,
      overwhelmed,
      exercisedYesterday,
      caffeineAfter2pm,
      practicedMindfulness,
      fatigue: showFatigueQuestion ? fatigue : null,
      fatigueTriggerMet: showFatigueQuestion,
      energyLevel: energyScore,
      stressManagement: "",
      notes,
      completed: true,
    } as InsertCheckIn;

    checkInMutation.mutate(checkInData);
  };

  const handleCloseClick = () => {
    setShowConfirmExit(true);
  };

  const handleConfirmSkip = () => {
    setShowConfirmExit(false);
    resetForm();
    onOpenChange(false);
  };

  const handleContinueCheckIn = () => {
    setShowConfirmExit(false);
  };

  const isFormComplete = moodScore !== null && energyScore !== null && stressScore !== null && sleepScore !== null && clarityScore !== null;

  if (!open) return null;

  // Confirmation dialog overlay
  if (showConfirmExit) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6 text-center">
          <h2 className="text-xl font-semibold text-foreground">Skip your check-in?</h2>
          <p className="text-base text-muted-foreground">Your progress won't be saved if you leave now.</p>
          <div className="space-y-3 pt-4">
            <Button 
              onClick={handleContinueCheckIn}
              className="w-full h-12 text-base font-medium bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black"
            >
              Complete Check-In
            </Button>
            <Button 
              onClick={handleConfirmSkip}
              variant="outline"
              className="w-full h-12 text-base font-medium border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Skip for Today
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Feedback screen
  if (showFeedback) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-5xl text-[#0cc9a9]">✓</div>
          <p className="text-xl font-semibold text-[#0cc9a9]">{feedbackMessage}</p>
          <p className="text-base text-muted-foreground">Your check-in has been saved</p>
        </div>
      </div>
    );
  }

  // Main check-in page
  return (
    <div className="fixed inset-0 z-[100] bg-background" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Header with X button */}
      <div className="p-4 flex items-center border-b border-border relative" style={{ flexShrink: 0 }}>
        <button 
          onClick={handleCloseClick}
          className="p-2 rounded-full hover:bg-muted transition-colors absolute left-2"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground w-full text-center">Daily Check-In</h1>
      </div>

      {/* Scrollable content */}
      <div className="px-5 pb-6" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
        <div className="max-w-lg mx-auto space-y-10">
          
          {/* SECTION 1: Mood & Energy */}
          <div className="space-y-6 pt-4">
            {/* Mood Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium text-foreground">How was your mood yesterday?</Label>
                <span 
                  className={`text-sm font-semibold text-[#0cc9a9] ${moodScore === null ? "invisible" : ""}`}
                  
                >
                  {moodScore !== null && SLIDER_LABELS.mood[moodScore as keyof typeof SLIDER_LABELS.mood]}
                </span>
              </div>
              <div 
                className="relative h-1.5 rounded-full" 
                style={{ background: getBlueSliderGradient(moodScore) }}
              >
                <Slider 
                  value={[moodScore ?? 3]} 
                  onValueChange={(v) => setMoodScore(v[0])} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="w-full h-1.5 [&_[role='slider']]:bg-white [&_[role='slider']]:border-0 [&_[role='slider']]:shadow-lg [&_[role='slider']]:h-5 [&_[role='slider']]:w-5 [&_span]:bg-transparent"
                />
              </div>
            </div>

            {/* Energy Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium text-foreground">How was your energy yesterday?</Label>
                <span 
                  className={`text-sm font-semibold text-[#0cc9a9] ${energyScore === null ? "invisible" : ""}`}
                  
                >
                  {energyScore !== null && SLIDER_LABELS.energy[energyScore as keyof typeof SLIDER_LABELS.energy]}
                </span>
              </div>
              <div 
                className="relative h-1.5 rounded-full" 
                style={{ background: getBlueSliderGradient(energyScore) }}
              >
                <Slider 
                  value={[energyScore ?? 3]} 
                  onValueChange={(v) => setEnergyScore(v[0])} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="w-full h-1.5 [&_[role='slider']]:bg-white [&_[role='slider']]:border-0 [&_[role='slider']]:shadow-lg [&_[role='slider']]:h-5 [&_[role='slider']]:w-5 [&_span]:bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Stress */}
          <div className="space-y-3 pt-4 border-t border-gray-400 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium text-foreground">How stressed did you feel yesterday?</Label>
              <span 
                className={`text-sm font-semibold text-[#0cc9a9] ${stressScore === null ? "invisible" : ""}`}
                
              >
                {stressScore !== null && SLIDER_LABELS.stress[stressScore as keyof typeof SLIDER_LABELS.stress]}
              </span>
            </div>
            <div 
              className="relative h-1.5 rounded-full" 
              style={{ background: getBlueSliderGradient(stressScore) }}
            >
              <Slider 
                value={[stressScore ?? 3]} 
                onValueChange={(v) => setStressScore(v[0])} 
                min={1} 
                max={5} 
                step={1} 
                className="w-full h-1.5 [&_[role='slider']]:bg-white [&_[role='slider']]:border-0 [&_[role='slider']]:shadow-lg [&_[role='slider']]:h-5 [&_[role='slider']]:w-5 [&_span]:bg-transparent"
              />
            </div>
          </div>

          {/* SECTION 3: Yes/No Questions */}
          <div className="space-y-4 pt-5 border-t border-gray-400 dark:border-gray-600">
            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Suffered a headache yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setHeadache(headache === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${headache === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setHeadache(headache === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${headache === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <Label className="text-base text-foreground">Consumed alcohol yesterday?</Label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setAlcohol(alcohol === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${alcohol === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                  <button type="button" onClick={() => setAlcohol(alcohol === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${alcohol === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
                </div>
              </div>
              {alcohol === true && (
                <div className="flex items-center gap-3 pl-4">
                  <Label className="text-sm text-muted-foreground">Number of drinks:</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAlcoholCount(Math.max(1, alcoholCount - 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-400 dark:border-gray-600 text-foreground hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="w-8 h-8 flex items-center justify-center text-center text-base font-medium bg-[#0cc9a9] text-black rounded">{alcoholCount}</span>
                    <button
                      type="button"
                      onClick={() => setAlcoholCount(Math.min(20, alcoholCount + 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-400 dark:border-gray-600 text-foreground hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Feel mentally strong today?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEmotionallyStable(emotionallyStable === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${emotionallyStable === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setEmotionallyStable(emotionallyStable === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${emotionallyStable === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Felt nervous or anxious yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setAnxious(anxious === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${anxious === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setAnxious(anxious === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${anxious === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Felt overwhelmed yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setOverwhelmed(overwhelmed === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${overwhelmed === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setOverwhelmed(overwhelmed === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${overwhelmed === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Exercised yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setExercisedYesterday(exercisedYesterday === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${exercisedYesterday === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setExercisedYesterday(exercisedYesterday === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${exercisedYesterday === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Consumed caffeine after 2pm yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCaffeineAfter2pm(caffeineAfter2pm === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${caffeineAfter2pm === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setCaffeineAfter2pm(caffeineAfter2pm === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${caffeineAfter2pm === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Practiced mindfulness yesterday?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPracticedMindfulness(practicedMindfulness === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${practicedMindfulness === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setPracticedMindfulness(practicedMindfulness === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${practicedMindfulness === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>
          </div>

          {/* CONDITIONAL: Fatigue Question */}
          {showFatigueQuestion && (
            <div className="space-y-3 pt-4 border-t border-gray-400 dark:border-gray-600">
              <Label className="text-base font-medium text-foreground block">Have you been experiencing fatigue?</Label>
              <div className="flex gap-3">
                <Button 
                  variant={fatigue === true ? "default" : "outline"} 
                  onClick={() => setFatigue(true)}
                  className={`flex-1 h-10 text-base ${fatigue === true ? "bg-[#0cc9a9] hover:bg-[#0aa0e0]" : "border-gray-600"}`}
                >
                  Yes
                </Button>
                <Button 
                  variant={fatigue === false ? "default" : "outline"} 
                  onClick={() => setFatigue(false)}
                  className={`flex-1 h-10 text-base ${fatigue === false ? "bg-[#0cc9a9] hover:bg-[#0aa0e0]" : "border-gray-600"}`}
                >
                  No
                </Button>
              </div>
            </div>
          )}

          {/* SECTION 4: Sleep & Mental Clarity */}
          <div className="space-y-6 pt-4 border-t border-gray-400 dark:border-gray-600">
            {/* Sleep Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium text-foreground">How was your sleep last night?</Label>
                <span 
                  className={`text-sm font-semibold text-[#0cc9a9] ${sleepScore === null ? "invisible" : ""}`}
                  
                >
                  {sleepScore !== null && SLIDER_LABELS.sleep[sleepScore as keyof typeof SLIDER_LABELS.sleep]}
                </span>
              </div>
              <div 
                className="relative h-1.5 rounded-full" 
                style={{ background: getBlueSliderGradient(sleepScore) }}
              >
                <Slider 
                  value={[sleepScore ?? 3]} 
                  onValueChange={(v) => setSleepScore(v[0])} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="w-full h-1.5 [&_[role='slider']]:bg-white [&_[role='slider']]:border-0 [&_[role='slider']]:shadow-lg [&_[role='slider']]:h-5 [&_[role='slider']]:w-5 [&_span]:bg-transparent"
                />
              </div>
            </div>

            {/* Mental Clarity Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium text-foreground">How clear does your mind feel?</Label>
                <span 
                  className={`text-sm font-semibold text-[#0cc9a9] ${clarityScore === null ? "invisible" : ""}`}
                  
                >
                  {clarityScore !== null && SLIDER_LABELS.clarity[clarityScore as keyof typeof SLIDER_LABELS.clarity]}
                </span>
              </div>
              <div 
                className="relative h-1.5 rounded-full" 
                style={{ background: getBlueSliderGradient(clarityScore) }}
              >
                <Slider 
                  value={[clarityScore ?? 3]} 
                  onValueChange={(v) => setClarityScore(v[0])} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="w-full h-1.5 [&_[role='slider']]:bg-white [&_[role='slider']]:border-0 [&_[role='slider']]:shadow-lg [&_[role='slider']]:h-5 [&_[role='slider']]:w-5 [&_span]:bg-transparent"
                />
              </div>
            </div>

            <div className="border-t border-gray-400 dark:border-gray-600 pt-4 mt-2">
              <div className="flex items-center justify-between py-2">
                <Label className="text-base text-foreground">Feel sick or unwell?</Label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setSick(sick === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${sick === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                  <button type="button" onClick={() => setSick(sick === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${sick === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-base text-foreground">Have pain or an injury?</Label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPainOrInjury(painOrInjury === true ? null : true)} className={`font-semibold px-3 py-1 rounded text-sm ${painOrInjury === true ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>Y</button>
                <button type="button" onClick={() => setPainOrInjury(painOrInjury === false ? null : false)} className={`font-semibold px-3 py-1 rounded text-sm ${painOrInjury === false ? 'bg-[#0cc9a9] text-black' : 'border border-gray-500 text-muted-foreground'}`}>N</button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Notes & Reflection */}
          <div className="space-y-3 pt-4 border-t border-gray-400 dark:border-gray-600">
            <h3 className="font-semibold text-base text-foreground">Notes & Reflection (Optional)</h3>
            <Textarea
              placeholder="This could be something you're grateful for or a space to journal your thoughts."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-base"
            />
          </div>

        </div>
      </div>

      {/* Sticky Submit Button */}
      <div className="px-5 py-4 border-t border-border bg-background" style={{ flexShrink: 0 }}>
        <div className="max-w-lg mx-auto">
          <Button 
            onClick={handleSubmit} 
            disabled={checkInMutation.isPending} 
            className="w-full h-12 text-base font-medium bg-[#0cc9a9] hover:bg-[#0aa0e0] disabled:opacity-50"
          >
            {checkInMutation.isPending ? "Saving..." : "Complete Check-In"}
          </Button>
        </div>
      </div>
    </div>
  );
}
