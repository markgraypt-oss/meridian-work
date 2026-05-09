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
const EQUIPMENT_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Full gym", phrase: "full gym access" },
  { label: "Home gym", phrase: "home gym setup" },
  { label: "Bodyweight", phrase: "bodyweight only" },
  { label: "Dumbbells", phrase: "with dumbbells" },
  { label: "Kettlebell", phrase: "with a kettlebell" },
  { label: "Bands", phrase: "with resistance bands" },
];
const GOAL_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "General strength", phrase: "general strength" },
  { label: "Hypertrophy", phrase: "hypertrophy" },
  { label: "Max strength", phrase: "max strength" },
  { label: "Power", phrase: "power" },
  { label: "Conditioning", phrase: "conditioning" },
  { label: "Endurance", phrase: "muscular endurance" },
  { label: "Mobility", phrase: "mobility and stretching" },
];
const DIFFICULTY_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Beginner", phrase: "beginner level" },
  { label: "Intermediate", phrase: "intermediate level" },
  { label: "Advanced", phrase: "advanced level" },
];
const LENGTH_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "2 weeks", phrase: "2 weeks" },
  { label: "4 weeks", phrase: "4 weeks" },
  { label: "6 weeks", phrase: "6 weeks" },
  { label: "8 weeks", phrase: "8 weeks" },
];
const FREQUENCY_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "2 days/week", phrase: "2 days a week" },
  { label: "3 days/week", phrase: "3 days a week" },
  { label: "4 days/week", phrase: "4 days a week" },
  { label: "5 days/week", phrase: "5 days a week" },
];
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
  "e.g. 4 week glutes programme, 3 days a week, full gym, 60 min sessions",
  "e.g. push/pull/legs split, 6 weeks, hard sessions, 60 min each",
  "e.g. 3 day circuit programme, easy on the lower back, dumbbells only",
  "e.g. build strength and a bit of conditioning, intermediate, 4 weeks",
];

// Parse programme dimensions from the user's prompt. Each parser returns
// undefined when nothing relevant was mentioned, so the caller can fall back
// to defaults (4 weeks, 3 days/week, 45 min, general_strength, full_gym,
// intermediate).
function parseWeeks(text: string): number | undefined {
  const m = text.match(/(\d+)\s*weeks?\b/i);
  if (!m) return undefined;
  return Math.max(1, Math.min(8, parseInt(m[1], 10)));
}
function parseDaysPerWeek(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:x|times|days?)\s*(?:a|per|\/)?\s*week\b/i);
  if (!m) return undefined;
  return Math.max(1, Math.min(7, parseInt(m[1], 10)));
}
function parseDuration(text: string): number | undefined {
  const minMatch = text.match(/(\d+)\s*(?:min|minute|mins|minutes)\b/i);
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  let v: number | undefined;
  if (minMatch) v = parseInt(minMatch[1], 10);
  else if (hourMatch) v = Math.round(parseFloat(hourMatch[1]) * 60);
  if (v === undefined) return undefined;
  return Math.max(10, Math.min(180, v));
}
function parseGoal(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bhypertrophy\b|\bmuscle (gain|growth|building)\b/.test(t)) return "hypertrophy";
  if (/\bmax(imal)? strength\b|\bpowerlifting\b/.test(t)) return "max_strength";
  if (/\bpower\b|\bexplosive\b/.test(t)) return "power";
  if (/\bhiit\b/.test(t)) return "hiit";
  if (/\bconditioning\b|\bcardio\b/.test(t)) return "conditioning";
  if (/\bendurance\b/.test(t)) return "muscular_endurance";
  if (/\bmobility\b|\bstretch/.test(t)) return "mobility_stretching";
  if (/\bcorrective\b|\brehab\b/.test(t)) return "corrective";
  if (/\brecovery\b/.test(t)) return "active_recovery";
  if (/\bstrength\b/.test(t)) return "general_strength";
  return undefined;
}
function parseEquipment(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bbodyweight\b|\bno equipment\b/.test(t)) return "bodyweight";
  if (/\bhome gym\b|\bat home\b/.test(t)) return "home_gym";
  if (/\bfull gym\b|\bcommercial gym\b|\bgym access\b/.test(t)) return "full_gym";
  return undefined;
}
function parseDifficulty(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\badvanced\b|\bexperienced\b/.test(t)) return "advanced";
  if (/\bbeginner\b|\bnew to\b|\bnovice\b/.test(t)) return "beginner";
  if (/\bintermediate\b/.test(t)) return "intermediate";
  return undefined;
}

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

  // Compose any prefill into the single prompt textarea. We fold structured
  // prefill fields (goal, equipment, etc.) into natural-language phrases so
  // the prompt is the one source of truth shown to the user.
  const composeInitialPrompt = (p?: AiProgrammePrefill | null): string => {
    if (!p) return "";
    if (p.promptBody) return p.promptBody;
    const parts: string[] = [];
    if (p.notes) parts.push(p.notes);
    if (p.weeks) parts.push(`${p.weeks} weeks`);
    if (p.daysPerWeek) parts.push(`${p.daysPerWeek} days a week`);
    if (p.sessionDuration) parts.push(`${p.sessionDuration} minute sessions`);
    if (p.goal && p.goal !== "general_strength") parts.push(p.goal.replace(/_/g, " "));
    if (p.equipment && p.equipment !== "full_gym") parts.push(p.equipment.replace(/_/g, " "));
    if (p.difficulty && p.difficulty !== "intermediate") parts.push(`${p.difficulty} level`);
    if (p.audience) parts.push(`audience: ${p.audience}`);
    if (p.contraindications) parts.push(`avoid ${p.contraindications}`);
    return parts.join(", ");
  };

  const [prompt, setPrompt] = useState(composeInitialPrompt(prefill));
  const [showOptions, setShowOptions] = useState(false);
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [targetUserId, setTargetUserId] = useState<string>("__none__");

  // Refresh the prompt when a fresh prefill arrives and the dialog is closed,
  // mirroring the workout-builder pattern.
  useEffect(() => {
    if (!prefill || open) return;
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
      // The prompt is the source of truth. Pull every dimension out of it,
      // falling back to sensible defaults when the user didn't say:
      //   weeks: 4, days/week: 3, session: 45 min (in the 45-60 min target
      //   band), goal: general_strength, equipment: full_gym, difficulty:
      //   intermediate. Workout style defaults to regular unless the prompt
      //   asks for circuit / interval / HIIT.
      const promptText = prompt.trim();
      const resolvedWeeks = parseWeeks(promptText) ?? 4;
      const resolvedDays = parseDaysPerWeek(promptText) ?? 3;
      const resolvedDuration = parseDuration(promptText) ?? 45;
      const resolvedGoal = parseGoal(promptText) ?? "general_strength";
      const resolvedEquipment = parseEquipment(promptText) ?? "full_gym";
      const resolvedDifficulty = parseDifficulty(promptText) ?? "intermediate";

      const res = await apiRequest("POST", "/api/ai/programmes/generate", {
        goal: resolvedGoal,
        equipment: resolvedEquipment,
        weeks: resolvedWeeks,
        daysPerWeek: resolvedDays,
        sessionDuration: resolvedDuration,
        difficulty: resolvedDifficulty,
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
            <Textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              rows={5}
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
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Length</p>
                  {renderChipRow(LENGTH_CHIPS)}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Frequency</p>
                  {renderChipRow(FREQUENCY_CHIPS)}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Goal</p>
                  {renderChipRow(GOAL_CHIPS)}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Equipment</p>
                  {renderChipRow(EQUIPMENT_CHIPS)}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Difficulty</p>
                  {renderChipRow(DIFFICULTY_CHIPS)}
                </div>
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

            {!userMode && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="ai-target-user" className="text-xs text-muted-foreground">Target user (optional)</Label>
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

            <p className="text-[11px] text-muted-foreground">
              Up to 8 weeks per generation. Defaults: 4 weeks, 3 days/week, 45 to 60 min sessions, regular workouts.
            </p>
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
