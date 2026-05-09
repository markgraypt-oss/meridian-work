import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseLibraryItem } from "@shared/schema";
import AiExercisePicker from "./AiExercisePicker";
import AiSafetyFlags from "@/components/ai/AiSafetyFlags";

export interface AiProgrammePrefill {
  goal?: string;
  equipment?: string;
  weeks?: number;
  daysPerWeek?: number;
  sessionDuration?: number;
  difficulty?: string;
  audience?: string;
  notes?: string;
  contraindications?: string;
  promptBody?: string;
}

// Quick-option chips: tapping a chip toggles its phrase in the prompt
// textarea. The prompt remains the single source of truth that gets sent.
const FOCUS_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Full body", phrase: "full body focus" },
  { label: "Upper body", phrase: "upper body focus" },
  { label: "Lower body", phrase: "lower body focus" },
  { label: "Push", phrase: "push focus" },
  { label: "Pull", phrase: "pull focus" },
  { label: "Legs", phrase: "legs focus" },
  { label: "Glutes", phrase: "glutes focus" },
  { label: "Core", phrase: "core focus" },
];
const STYLE_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Regular", phrase: "regular workouts" },
  { label: "Circuit", phrase: "circuit style" },
  { label: "Interval", phrase: "interval style" },
  { label: "HIIT", phrase: "HIIT style" },
];
const AVOID_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "No jumping", phrase: "no jumping" },
  { label: "No overhead", phrase: "no overhead pressing" },
  { label: "Easy on lower back", phrase: "easy on lower back" },
  { label: "Easy on knees", phrase: "easy on knees" },
];

const PLACEHOLDERS = [
  "e.g. emphasise glutes, mostly compound lifts, no jumping",
  "e.g. push/pull/legs split, hard sessions, 60 min each",
  "e.g. circuits 3x a week, easy on the lower back",
  "e.g. build strength + a bit of conditioning, full gym",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProgrammeType?: "main" | "stretching" | "corrective";
  /**
   * When true, render the user-facing variant: hides admin-only fields
   * (target user select), saves to /save-user (creates a user-owned programme),
   * and navigates to /training/programme/:id on success.
   */
  userMode?: boolean;
  prefill?: AiProgrammePrefill | null;
}

interface GenSet { reps?: string | number; duration?: string | number; rest?: string }
interface GenExercise {
  exerciseLibraryId: number;
  sets: GenSet[];
  load?: string | null;
  tempo?: string | null;
  notes?: string | null;
}
interface GenBlock {
  section: "warmup" | "main";
  blockType: "single" | "superset" | "triset" | "circuit";
  rest?: string | null;
  exercises: GenExercise[];
}
interface GenWorkout {
  name: string;
  description?: string | null;
  category: "strength" | "cardio" | "hiit" | "mobility" | "recovery";
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: number;
  blocks: GenBlock[];
}
interface GenDay { position: number; workouts: GenWorkout[] }
interface GenWeek { weekNumber: number; days: GenDay[] }
interface GenProgramme {
  title: string;
  description: string;
  goal: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  weeks: GenWeek[];
}
interface PreviewResponse {
  inputs: Record<string, unknown>;
  data: GenProgramme;
  logId?: number;
  safetyFlags?: string[];
  validationOutcome?: "valid" | "repaired" | "invalid" | "no_schema" | "error" | "timeout";
}

interface AdminUser { id: string; email: string | null; firstName: string | null; lastName: string | null }

export default function AiProgrammeWizard({ open, onOpenChange, defaultProgrammeType = "main", userMode = false, prefill }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Compose any prefill prose into the single prompt textarea.
  const composeInitialPrompt = (p?: AiProgrammePrefill | null): string => {
    if (!p) return "";
    if (p.promptBody) return p.promptBody;
    const parts: string[] = [];
    if (p.notes) parts.push(p.notes);
    if (p.audience) parts.push(`audience: ${p.audience}`);
    if (p.contraindications) parts.push(`avoid ${p.contraindications}`);
    return parts.join(", ");
  };

  const [goal, setGoal] = useState(prefill?.goal || "general_strength");
  const [equipment, setEquipment] = useState(prefill?.equipment || "full_gym");
  const [weeks, setWeeks] = useState(prefill?.weeks ?? 4);
  const [daysPerWeek, setDaysPerWeek] = useState(prefill?.daysPerWeek ?? 3);
  const [sessionDuration, setSessionDuration] = useState(prefill?.sessionDuration ?? 45);
  const [difficulty, setDifficulty] = useState(prefill?.difficulty || "beginner");
  const [prompt, setPrompt] = useState(composeInitialPrompt(prefill));
  const [showOptions, setShowOptions] = useState(false);
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [targetUserId, setTargetUserId] = useState<string>("__none__");

  // Sync form fields when prefill changes (prompt-library re-pick) and dialog
  // is currently closed — avoids clobbering edits the user is mid-typing.
  useEffect(() => {
    if (!prefill || open) return;
    if (prefill.goal) setGoal(prefill.goal);
    if (prefill.equipment) setEquipment(prefill.equipment);
    if (typeof prefill.weeks === "number") setWeeks(prefill.weeks);
    if (typeof prefill.daysPerWeek === "number") setDaysPerWeek(prefill.daysPerWeek);
    if (typeof prefill.sessionDuration === "number") setSessionDuration(prefill.sessionDuration);
    if (prefill.difficulty) setDifficulty(prefill.difficulty);
    setPrompt(composeInitialPrompt(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, open]);

  function toggleChip(phrase: string) {
    setPrompt(prev => {
      const trimmed = prev.trim();
      const lower = trimmed.toLowerCase();
      const phraseLower = phrase.toLowerCase();
      if (lower.includes(phraseLower)) {
        const re = new RegExp(`(?:,\\s*)?${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`, "i");
        return trimmed.replace(re, "").replace(/^,\s*/, "").trim();
      }
      return trimmed.length === 0 ? phrase : `${trimmed}, ${phrase}`;
    });
    setTimeout(() => promptRef.current?.focus(), 0);
  }
  function isChipActive(phrase: string): boolean {
    return prompt.toLowerCase().includes(phrase.toLowerCase());
  }
  const renderChipRow = (chips: typeof FOCUS_CHIPS) => (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(c => (
        <button
          key={c.label}
          type="button"
          onClick={() => toggleChip(c.phrase)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isChipActive(c.phrase)
              ? "bg-primary/15 border-primary text-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
          data-testid={`chip-programme-${c.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [pickerCtx, setPickerCtx] = useState<{ weekIdx: number; dayIdx: number; workoutIdx: number; blockIdx: number; exIdx: number } | null>(null);
  const [regenTarget, setRegenTarget] = useState<{ weekIdx: number; dayIdx: number; workoutIdx: number | null } | null>(null);

  const { data: exerciseLibrary } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });
  const exerciseById = new Map((exerciseLibrary || []).map(e => [e.id, e]));

  const { data: adminUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: open && !userMode,
  });

  const generate = useMutation({
    mutationFn: async () => {
      // Pull a duration out of the prompt ("60 min sessions", "45 minute
      // workouts", "1 hour"). If the user mentioned one, it overrides the
      // structured Session duration field. Otherwise we use the field, which
      // defaults to 45 min — within the 45 to 60 minute target band.
      const promptText = prompt.trim();
      const minMatch = promptText.match(/(\d+)\s*(?:min|minute|mins|minutes)\b/i);
      const hourMatch = promptText.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
      let resolvedDuration = sessionDuration;
      if (minMatch) resolvedDuration = parseInt(minMatch[1], 10);
      else if (hourMatch) resolvedDuration = Math.round(parseFloat(hourMatch[1]) * 60);
      resolvedDuration = Math.max(10, Math.min(180, resolvedDuration));

      const res = await apiRequest("POST", "/api/ai/programmes/generate", {
        goal, equipment, weeks, daysPerWeek,
        sessionDuration: resolvedDuration,
        difficulty,
        notes: promptText || undefined,
        programmeType: defaultProgrammeType,
        targetUserId: targetUserId !== "__none__" ? targetUserId : undefined,
      });
      return (await res.json()) as PreviewResponse;
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview to save");
      const endpoint = userMode ? "/api/ai/programmes/save-user" : "/api/ai/programmes/save";
      const res = await apiRequest("POST", endpoint, {
        inputs: preview.inputs,
        data: preview.data,
        logId: preview.logId,
      });
      return await res.json();
    },
    onSuccess: (program: any) => {
      toast({ title: "Programme created", description: `${program.title} saved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-programmes"] });
      onOpenChange(false);
      setPreview(null);
      navigate(userMode ? `/training/programme/${program.id}` : `/admin/programmes/${program.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const regenSection = useMutation({
    mutationFn: async (target: { weekIdx: number; dayIdx: number; workoutIdx: number | null }) => {
      if (!preview) throw new Error("No preview to regenerate");
      const week = preview.data.weeks[target.weekIdx];
      const day = week.days[target.dayIdx];
      const res = await apiRequest("POST", "/api/ai/programmes/regenerate-section", {
        inputs: preview.inputs,
        existingProgramme: preview.data,
        weekNumber: week.weekNumber,
        targetDayPosition: day.position,
        workoutIndex: target.workoutIdx,
      });
      return { result: await res.json(), target };
    },
    onSuccess: ({ result, target }) => {
      if (!result?.ok) {
        toast({ title: "Regeneration failed", description: result?.error || "Try again.", variant: "destructive" });
        return;
      }
      updatePreview(p => {
        const day = p.weeks[target.weekIdx]?.days[target.dayIdx];
        if (!day) return p;
        if (result.kind === "workout" && target.workoutIdx !== null) {
          day.workouts[target.workoutIdx] = result.data as GenWorkout;
        } else if (result.kind === "day") {
          day.workouts = (result.data.workouts || []) as GenWorkout[];
          day.position = result.data.position ?? day.position;
        }
        return p;
      });
      toast({ title: "Section regenerated", description: result.kind === "day" ? "Day updated." : "Workout updated." });
    },
    onError: (err: any) => {
      toast({ title: "Regeneration failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const isBusy = generate.isPending || save.isPending || regenSection.isPending;
  const isRegenerating = (weekIdx: number, dayIdx: number, workoutIdx: number | null) =>
    regenSection.isPending && regenTarget?.weekIdx === weekIdx && regenTarget?.dayIdx === dayIdx && regenTarget?.workoutIdx === workoutIdx;
  function triggerRegen(weekIdx: number, dayIdx: number, workoutIdx: number | null) {
    setRegenTarget({ weekIdx, dayIdx, workoutIdx });
    regenSection.mutate({ weekIdx, dayIdx, workoutIdx });
  }

  function updatePreview(mut: (p: GenProgramme) => GenProgramme) {
    if (!preview) return;
    setPreview({ ...preview, data: mut(JSON.parse(JSON.stringify(preview.data))) });
  }

  function patchExercise(weekIdx: number, dayIdx: number, wIdx: number, bIdx: number, eIdx: number, patch: Partial<GenExercise>) {
    updatePreview(p => {
      const ex = p.weeks[weekIdx].days[dayIdx].workouts[wIdx].blocks[bIdx].exercises[eIdx];
      Object.assign(ex, patch);
      return p;
    });
  }
  function patchSet(weekIdx: number, dayIdx: number, wIdx: number, bIdx: number, eIdx: number, sIdx: number, patch: Partial<GenSet>) {
    updatePreview(p => {
      const set = p.weeks[weekIdx].days[dayIdx].workouts[wIdx].blocks[bIdx].exercises[eIdx].sets[sIdx];
      Object.assign(set, patch);
      return p;
    });
  }
  function addSet(weekIdx: number, dayIdx: number, wIdx: number, bIdx: number, eIdx: number) {
    updatePreview(p => {
      const ex = p.weeks[weekIdx].days[dayIdx].workouts[wIdx].blocks[bIdx].exercises[eIdx];
      ex.sets.push({ ...ex.sets[ex.sets.length - 1] });
      return p;
    });
  }
  function removeSet(weekIdx: number, dayIdx: number, wIdx: number, bIdx: number, eIdx: number, sIdx: number) {
    updatePreview(p => {
      const ex = p.weeks[weekIdx].days[dayIdx].workouts[wIdx].blocks[bIdx].exercises[eIdx];
      if (ex.sets.length > 1) ex.sets.splice(sIdx, 1);
      return p;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isBusy) { onOpenChange(v); if (!v) setPreview(null); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-programme-wizard">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Programme with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need, then edit the draft before saving.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ai-goal">Goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger id="ai-goal" data-testid="select-ai-goal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_strength">General strength</SelectItem>
                    <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                    <SelectItem value="max_strength">Max strength</SelectItem>
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="conditioning">Conditioning</SelectItem>
                    <SelectItem value="hiit">HIIT</SelectItem>
                    <SelectItem value="muscular_endurance">Muscular endurance</SelectItem>
                    <SelectItem value="active_recovery">Active recovery</SelectItem>
                    <SelectItem value="mobility_stretching">Mobility / stretching</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-equipment">Equipment</Label>
                <Select value={equipment} onValueChange={setEquipment}>
                  <SelectTrigger id="ai-equipment" data-testid="select-ai-equipment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_gym">Full gym</SelectItem>
                    <SelectItem value="home_gym">Home gym</SelectItem>
                    <SelectItem value="bodyweight">Bodyweight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-difficulty">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="ai-difficulty" data-testid="select-ai-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-weeks">Weeks</Label>
                <Input id="ai-weeks" type="number" min={1} max={8} value={weeks}
                  onChange={(e) => setWeeks(Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1)))}
                  data-testid="input-ai-weeks" />
                <p className="text-[11px] text-muted-foreground mt-1">Max 8 weeks per generation. Clone & extend after to go longer.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-days">Training days / week</Label>
                <Input id="ai-days" type="number" min={1} max={7} value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(parseInt(e.target.value, 10) || 1)}
                  data-testid="input-ai-days" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-duration">Session duration (min)</Label>
                <Input id="ai-duration" type="number" min={10} max={180} value={sessionDuration}
                  onChange={(e) => setSessionDuration(parseInt(e.target.value, 10) || 10)}
                  data-testid="input-ai-duration" />
              </div>
            </div>
            {!userMode && (
              <div className="space-y-2">
                <Label htmlFor="ai-target-user">Target user (optional)</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger id="ai-target-user" data-testid="select-ai-target-user"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No specific user</SelectItem>
                    {(adminUsers || []).slice(0, 200).map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Anything else? (optional)</Label>
              <Textarea
                id="ai-prompt"
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="text-sm resize-none"
                data-testid="textarea-ai-prompt"
              />
              <button
                type="button"
                onClick={() => setShowOptions(v => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-quick-options"
              >
                {showOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Quick options
              </button>
              {showOptions && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Focus area</p>
                    {renderChipRow(FOCUS_CHIPS)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Workout style</p>
                    {renderChipRow(STYLE_CHIPS)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avoid</p>
                    {renderChipRow(AVOID_CHIPS)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2" data-testid="ai-preview">
            <AiSafetyFlags safetyFlags={preview.safetyFlags} validationOutcome={preview.validationOutcome} />
            <div className="space-y-2">
              <Input
                value={preview.data.title}
                onChange={(e) => updatePreview(p => { p.title = e.target.value; return p; })}
                className="text-lg font-semibold"
                data-testid="input-edit-programme-title"
              />
              <Textarea
                value={preview.data.description}
                onChange={(e) => updatePreview(p => { p.description = e.target.value; return p; })}
                rows={2}
                data-testid="textarea-edit-programme-description"
              />
            </div>

            <div className="flex flex-wrap gap-1" data-testid="ai-week-tabs">
              {preview.data.weeks.map((wk, wkIdx) => (
                <Button
                  key={wkIdx}
                  size="sm"
                  variant={activeWeek === wkIdx ? "default" : "outline"}
                  onClick={() => setActiveWeek(wkIdx)}
                  data-testid={`button-week-tab-${wk.weekNumber}`}
                >
                  Week {wk.weekNumber}
                </Button>
              ))}
            </div>

            <div className="border rounded-md p-3 max-h-[460px] overflow-y-auto space-y-4 text-sm">
              {(preview.data.weeks[activeWeek]?.days || []).map((day, dIdx) => (
                <div key={dIdx} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Day {day.position}</div>
                    <Button size="sm" variant="outline" disabled={isBusy}
                      onClick={() => triggerRegen(activeWeek, dIdx, null)}
                      data-testid={`button-regen-day-${activeWeek}-${dIdx}`}>
                      {isRegenerating(activeWeek, dIdx, null)
                        ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Regenerating…</>
                        : <><RefreshCw className="h-3 w-3 mr-1" />Regenerate day</>}
                    </Button>
                  </div>
                  {day.workouts.map((w, wIdx) => (
                    <div key={wIdx} className="space-y-2 ml-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={w.name}
                          onChange={(e) => updatePreview(p => { p.weeks[activeWeek].days[dIdx].workouts[wIdx].name = e.target.value; return p; })}
                          className="font-medium"
                          data-testid={`input-edit-workout-name-${activeWeek}-${dIdx}-${wIdx}`}
                        />
                        <Button size="sm" variant="outline" disabled={isBusy}
                          onClick={() => triggerRegen(activeWeek, dIdx, wIdx)}
                          data-testid={`button-regen-workout-${activeWeek}-${dIdx}-${wIdx}`}>
                          {isRegenerating(activeWeek, dIdx, wIdx)
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Regenerating…</>
                            : <><RefreshCw className="h-3 w-3 mr-1" />Regenerate workout</>}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">{w.category} · {w.duration}min · {w.difficulty}</div>
                      {w.blocks.map((b, bIdx) => (
                        <div key={bIdx} className="ml-2 border-l pl-3 space-y-2">
                          <div className="text-xs uppercase text-muted-foreground">{b.section} · {b.blockType}</div>
                          {b.exercises.map((ex, eIdx) => {
                            const lib = exerciseById.get(ex.exerciseLibraryId);
                            return (
                              <div key={eIdx} className="border rounded p-2 space-y-2 bg-muted/30">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium">{lib?.name || `Exercise #${ex.exerciseLibraryId}`}</div>
                                  <Button size="sm" variant="ghost"
                                    onClick={() => setPickerCtx({ weekIdx: activeWeek, dayIdx: dIdx, workoutIdx: wIdx, blockIdx: bIdx, exIdx: eIdx })}
                                    data-testid={`button-swap-${activeWeek}-${dIdx}-${wIdx}-${bIdx}-${eIdx}`}>
                                    <RefreshCw className="h-3 w-3 mr-1" />Swap
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  {ex.sets.map((s, sIdx) => (
                                    <div key={sIdx} className="grid grid-cols-12 gap-1 items-center">
                                      <span className="col-span-1 text-xs text-muted-foreground">#{sIdx + 1}</span>
                                      <Input className="col-span-3 h-8" placeholder="reps"
                                        value={s.reps?.toString() ?? ""}
                                        onChange={(e) => patchSet(activeWeek, dIdx, wIdx, bIdx, eIdx, sIdx, { reps: e.target.value })}
                                        data-testid={`input-set-reps-${activeWeek}-${dIdx}-${wIdx}-${bIdx}-${eIdx}-${sIdx}`} />
                                      <Input className="col-span-3 h-8" placeholder="duration"
                                        value={s.duration?.toString() ?? ""}
                                        onChange={(e) => patchSet(activeWeek, dIdx, wIdx, bIdx, eIdx, sIdx, { duration: e.target.value })} />
                                      <Input className="col-span-4 h-8" placeholder="rest"
                                        value={s.rest ?? ""}
                                        onChange={(e) => patchSet(activeWeek, dIdx, wIdx, bIdx, eIdx, sIdx, { rest: e.target.value })} />
                                      <Button size="sm" variant="ghost" className="col-span-1 h-8 w-8 p-0"
                                        onClick={() => removeSet(activeWeek, dIdx, wIdx, bIdx, eIdx, sIdx)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" onClick={() => addSet(activeWeek, dIdx, wIdx, bIdx, eIdx)}
                                    data-testid={`button-add-set-${activeWeek}-${dIdx}-${wIdx}-${bIdx}-${eIdx}`}>
                                    <Plus className="h-3 w-3 mr-1" />Add set
                                  </Button>
                                </div>
                                <Input placeholder="load (optional)" value={ex.load ?? ""}
                                  onChange={(e) => patchExercise(activeWeek, dIdx, wIdx, bIdx, eIdx, { load: e.target.value })} />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!preview ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>Cancel</Button>
              <Button onClick={() => generate.mutate()} disabled={isBusy} data-testid="button-ai-generate">
                {generate.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <>Generate</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={isBusy}>Regenerate</Button>
              <Button onClick={() => save.mutate()} disabled={isBusy} data-testid="button-ai-save">
                {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <>Save Programme</>}
              </Button>
            </>
          )}
        </DialogFooter>

        <AiExercisePicker
          open={pickerCtx !== null}
          onOpenChange={(v) => { if (!v) setPickerCtx(null); }}
          onPick={(item) => {
            if (!pickerCtx) return;
            patchExercise(pickerCtx.weekIdx, pickerCtx.dayIdx, pickerCtx.workoutIdx, pickerCtx.blockIdx, pickerCtx.exIdx, { exerciseLibraryId: item.id });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
