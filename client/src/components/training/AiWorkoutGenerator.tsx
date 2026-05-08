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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseLibraryItem } from "@shared/schema";
import AiExercisePicker from "@/components/admin/AiExercisePicker";
import AiSafetyFlags from "@/components/ai/AiSafetyFlags";

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
interface PreviewResponse {
  inputs: Record<string, unknown> & { burnoutScore?: number; bodyMap?: Array<{ bodyPart: string; severity: number }> };
  data: GenWorkout;
  logId?: number;
  safetyFlags?: string[];
  validationOutcome?: "valid" | "repaired" | "invalid" | "no_schema" | "error" | "timeout";
}

export interface AiWorkoutPrefill {
  equipment?: string;
  duration?: number;
  difficulty?: string;
  focus?: string;
  notes?: string;
  contraindications?: string;
  promptBody?: string;
}

interface Props {
  triggerLabel?: string;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefill?: AiWorkoutPrefill | null;
}

// ---------------------------------------------------------------------------
// Quick-option chip groups. Tapping a chip appends a natural-language phrase
// to the prompt (or toggles it off if it's already there). The prompt textbox
// remains the single source of truth that gets sent to the AI.
// ---------------------------------------------------------------------------
const EQUIPMENT_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Bodyweight", phrase: "bodyweight only" },
  { label: "Dumbbells", phrase: "with dumbbells" },
  { label: "Kettlebell", phrase: "with a kettlebell" },
  { label: "Bands", phrase: "with resistance bands" },
  { label: "Full gym", phrase: "full gym access" },
];
const DURATION_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "15 min", phrase: "15 minutes" },
  { label: "30 min", phrase: "30 minutes" },
  { label: "45 min", phrase: "45 minutes" },
  { label: "60 min", phrase: "60 minutes" },
];
const TARGET_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Full body", phrase: "full body" },
  { label: "Upper body", phrase: "upper body focus" },
  { label: "Lower body", phrase: "lower body focus" },
  { label: "Push", phrase: "push focus" },
  { label: "Pull", phrase: "pull focus" },
  { label: "Legs", phrase: "legs focus" },
  { label: "Glutes", phrase: "glutes focus" },
  { label: "Core", phrase: "core focus" },
];
const INTENSITY_CHIPS: Array<{ label: string; phrase: string }> = [
  { label: "Easy", phrase: "easy intensity" },
  { label: "Moderate", phrase: "moderate intensity" },
  { label: "Hard", phrase: "hard intensity" },
];

const PLACEHOLDERS = [
  "e.g. 30 minute glutes session, dumbbells only, no jumping",
  "e.g. quick 20 min full-body circuit, moderate intensity",
  "e.g. heavy upper body day, full gym, 45 min",
  "e.g. low impact mobility, 20 min, my left shoulder is sore",
];

export default function AiWorkoutGenerator({
  triggerLabel = "Generate today's workout",
  hideTrigger = false,
  open: openProp,
  onOpenChange,
  prefill,
}: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInternal(v);
    onOpenChange?.(v);
  };

  // Single prompt is the source of truth. Prefills (from prompt library or
  // elsewhere) get composed into the prompt up-front.
  const composeInitialPrompt = (p?: AiWorkoutPrefill | null): string => {
    if (!p) return "";
    if (p.promptBody) return p.promptBody;
    if (p.notes) return p.notes;
    const parts: string[] = [];
    if (p.duration) parts.push(`${p.duration} minutes`);
    if (p.equipment) parts.push(p.equipment.replace(/_/g, " "));
    if (p.focus) parts.push(`${p.focus} focus`);
    if (p.difficulty) parts.push(`${p.difficulty} intensity`);
    if (p.contraindications) parts.push(`avoid ${p.contraindications}`);
    return parts.join(", ");
  };

  const [prompt, setPrompt] = useState(composeInitialPrompt(prefill));
  const [showOptions, setShowOptions] = useState(false);
  const [scheduleForToday, setScheduleForToday] = useState(true);
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // When the parent feeds in a fresh prefill (e.g. user picked another prompt
  // from the library) and the dialog is closed, refresh the prompt body.
  useEffect(() => {
    if (!prefill || open) return;
    setPrompt(composeInitialPrompt(prefill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, open]);

  /** Toggle a chip phrase in the prompt: append if missing, remove if present. */
  function toggleChip(phrase: string) {
    setPrompt(prev => {
      const trimmed = prev.trim();
      const lower = trimmed.toLowerCase();
      const phraseLower = phrase.toLowerCase();
      if (lower.includes(phraseLower)) {
        // Remove the phrase (and any surrounding ", " separator).
        const re = new RegExp(`(?:,\\s*)?${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`, "i");
        return trimmed.replace(re, "").replace(/^,\s*/, "").trim();
      }
      return trimmed.length === 0 ? phrase : `${trimmed}, ${phrase}`;
    });
    // Refocus textarea so user can keep typing.
    setTimeout(() => promptRef.current?.focus(), 0);
  }

  function isChipActive(phrase: string): boolean {
    return prompt.toLowerCase().includes(phrase.toLowerCase());
  }

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pickerCtx, setPickerCtx] = useState<{ blockIdx: number; exIdx: number } | null>(null);

  const { data: exerciseLibrary } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });
  const exerciseById = new Map((exerciseLibrary || []).map(e => [e.id, e]));

  const generate = useMutation({
    mutationFn: async () => {
      // Pass the prompt as `notes` so the existing backend keeps working.
      // Duration is left at the backend default (30) so the AI infers it
      // from the prompt itself (e.g. "20 min" / "45 minute session").
      const res = await apiRequest("POST", "/api/ai/workouts/generate", {
        notes: prompt.trim(),
        difficulty: "intermediate",
        duration: 30,
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
      const res = await apiRequest("POST", "/api/ai/workouts/save", {
        inputs: preview.inputs,
        data: preview.data,
        logId: preview.logId,
        scheduleForToday,
      });
      return await res.json();
    },
    onSuccess: (workout: any) => {
      toast({ title: "Workout saved", description: `${workout.title} is ready to perform.` });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/today-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
      setOpen(false);
      setPreview(null);
      navigate(`/training/workout/${workout.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const isBusy = generate.isPending || save.isPending;

  function updatePreview(mut: (w: GenWorkout) => GenWorkout) {
    if (!preview) return;
    setPreview({ ...preview, data: mut(JSON.parse(JSON.stringify(preview.data))) });
  }
  function patchExercise(bIdx: number, eIdx: number, patch: Partial<GenExercise>) {
    updatePreview(w => { Object.assign(w.blocks[bIdx].exercises[eIdx], patch); return w; });
  }
  function patchSet(bIdx: number, eIdx: number, sIdx: number, patch: Partial<GenSet>) {
    updatePreview(w => { Object.assign(w.blocks[bIdx].exercises[eIdx].sets[sIdx], patch); return w; });
  }
  function addSet(bIdx: number, eIdx: number) {
    updatePreview(w => {
      const ex = w.blocks[bIdx].exercises[eIdx];
      ex.sets.push({ ...ex.sets[ex.sets.length - 1] });
      return w;
    });
  }
  function removeSet(bIdx: number, eIdx: number, sIdx: number) {
    updatePreview(w => {
      const ex = w.blocks[bIdx].exercises[eIdx];
      if (ex.sets.length > 1) ex.sets.splice(sIdx, 1);
      return w;
    });
  }

  const renderChipRow = (chips: typeof EQUIPMENT_CHIPS) => (
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
          data-testid={`chip-${c.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          data-testid="button-generate-todays-workout"
          className="w-full sm:w-auto"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!isBusy) { setOpen(v); if (!v) setPreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-workout-generator">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate today's workout
            </DialogTitle>
            <DialogDescription>
              Describe what you want. We'll pick exercises from your library and adjust for how you're feeling today.
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
                data-testid="textarea-workout-prompt"
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
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Equipment</p>
                    {renderChipRow(EQUIPMENT_CHIPS)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration</p>
                    {renderChipRow(DURATION_CHIPS)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target area</p>
                    {renderChipRow(TARGET_CHIPS)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Intensity</p>
                    {renderChipRow(INTENSITY_CHIPS)}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scheduleForToday} onChange={(e) => setScheduleForToday(e.target.checked)}
                  data-testid="checkbox-schedule-today" />
                Place into today's slot when saved
              </label>
            </div>
          ) : (
            <div className="space-y-3 py-2" data-testid="ai-workout-preview">
              <AiSafetyFlags safetyFlags={preview.safetyFlags} validationOutcome={preview.validationOutcome} />
              <div className="space-y-2">
                <Input
                  value={preview.data.name}
                  onChange={(e) => updatePreview(w => { w.name = e.target.value; return w; })}
                  className="text-lg font-semibold"
                  data-testid="input-edit-workout-name"
                />
                <div className="text-xs text-muted-foreground">
                  {preview.data.duration} min · {preview.data.category} · {preview.data.difficulty}
                  {typeof preview.inputs.burnoutScore === "number" && <> · burnout {preview.inputs.burnoutScore}/100</>}
                </div>
              </div>

              <div className="border rounded-md p-3 max-h-[420px] overflow-y-auto space-y-3 text-sm">
                {preview.data.blocks.map((b, bIdx) => (
                  <div key={bIdx} className="border-l pl-3 space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">{b.section} · {b.blockType}</div>
                    {b.exercises.map((ex, eIdx) => {
                      const lib = exerciseById.get(ex.exerciseLibraryId);
                      return (
                        <div key={eIdx} className="border rounded p-2 space-y-2 bg-muted/30">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{lib?.name || `Exercise #${ex.exerciseLibraryId}`}</div>
                            <Button size="sm" variant="ghost" onClick={() => setPickerCtx({ blockIdx: bIdx, exIdx: eIdx })}
                              data-testid={`button-user-swap-${bIdx}-${eIdx}`}>
                              <RefreshCw className="h-3 w-3 mr-1" />Swap
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {ex.sets.map((s, sIdx) => (
                              <div key={sIdx} className="grid grid-cols-12 gap-1 items-center">
                                <span className="col-span-1 text-xs text-muted-foreground">#{sIdx + 1}</span>
                                <Input className="col-span-3 h-8" placeholder="reps"
                                  value={s.reps?.toString() ?? ""}
                                  onChange={(e) => patchSet(bIdx, eIdx, sIdx, { reps: e.target.value })}
                                  data-testid={`input-user-set-reps-${bIdx}-${eIdx}-${sIdx}`} />
                                <Input className="col-span-3 h-8" placeholder="duration"
                                  value={s.duration?.toString() ?? ""}
                                  onChange={(e) => patchSet(bIdx, eIdx, sIdx, { duration: e.target.value })} />
                                <Input className="col-span-4 h-8" placeholder="rest"
                                  value={s.rest ?? ""}
                                  onChange={(e) => patchSet(bIdx, eIdx, sIdx, { rest: e.target.value })} />
                                <Button size="sm" variant="ghost" className="col-span-1 h-8 w-8 p-0"
                                  onClick={() => removeSet(bIdx, eIdx, sIdx)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button size="sm" variant="outline" onClick={() => addSet(bIdx, eIdx)}
                              data-testid={`button-user-add-set-${bIdx}-${eIdx}`}>
                              <Plus className="h-3 w-3 mr-1" />Add set
                            </Button>
                          </div>
                          <Input placeholder="load (optional)" value={ex.load ?? ""}
                            onChange={(e) => patchExercise(bIdx, eIdx, { load: e.target.value })} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!preview ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isBusy}>Cancel</Button>
                <Button
                  onClick={() => generate.mutate()}
                  disabled={isBusy || prompt.trim().length === 0}
                  data-testid="button-user-ai-generate"
                >
                  {generate.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <>Generate</>}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPreview(null)} disabled={isBusy}>Regenerate</Button>
                <Button onClick={() => save.mutate()} disabled={isBusy} data-testid="button-user-ai-save">
                  {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <>Save Workout</>}
                </Button>
              </>
            )}
          </DialogFooter>

          <AiExercisePicker
            open={pickerCtx !== null}
            onOpenChange={(v) => { if (!v) setPickerCtx(null); }}
            onPick={(item) => {
              if (!pickerCtx) return;
              patchExercise(pickerCtx.blockIdx, pickerCtx.exIdx, { exerciseLibraryId: item.id });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
