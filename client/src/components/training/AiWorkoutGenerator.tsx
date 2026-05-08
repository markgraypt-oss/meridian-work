import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseLibraryItem } from "@shared/schema";

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
  inputs: Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// Convert the AI-generated workout into the flat `ExerciseData[]` shape that
// the WOD builder reads from sessionStorage. Mirrors how build-wod.tsx
// rehydrates blocks from the workout-edit API (single → setsCount = sets.length;
// multi-exercise blocks share a generated blockGroupId).
// ---------------------------------------------------------------------------
type DurationType = "timer" | "text";
type ExerciseType = "strength" | "timed_strength" | "general" | "endurance" | "cardio" | "timed";

interface SeedExercise {
  id: string;
  kind: "exercise" | "rest";
  exerciseLibraryId: number | null;
  exerciseName: string;
  imageUrl: string | null;
  muxPlaybackId: string | null;
  blockType: "single" | "superset" | "triset" | "circuit";
  blockGroupId?: string;
  section: "warmup" | "main";
  position: number;
  restPeriod: string;
  setsCount: number;
  targetReps: string;
  targetDuration: string;
  durationType: DurationType;
  exerciseType: ExerciseType;
}

const TIME_BASED_TYPES = new Set(["timed", "timed_strength", "general", "cardio"]);

function genWorkoutToSeedExercises(
  workout: GenWorkout,
  library: ExerciseLibraryItem[],
): SeedExercise[] {
  const libById = new Map(library.map((e) => [e.id, e]));
  const out: SeedExercise[] = [];
  let counter = 0;
  // Drop any warm-up blocks the AI returns. The builder's Warm Up section
  // stays visible and empty so the user can add their own warm-up.
  const blocks = (workout.blocks || []).filter((b) => b.section !== "warmup");
  for (const block of blocks) {
    const isMulti = block.blockType && block.blockType !== "single";
    const groupId = isMulti
      ? `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`
      : undefined;
    for (const ex of block.exercises || []) {
      const lib = libById.get(ex.exerciseLibraryId);
      const exerciseType = ((lib?.exerciseType as ExerciseType) || "strength") as ExerciseType;
      const isTimeBased = TIME_BASED_TYPES.has(exerciseType);
      const sets = ex.sets || [];
      const firstSet = sets[0] || {};
      counter += 1;
      out.push({
        id: `ai-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`,
        kind: "exercise",
        exerciseLibraryId: ex.exerciseLibraryId,
        exerciseName: lib?.name || `Exercise #${ex.exerciseLibraryId}`,
        imageUrl: lib?.imageUrl ?? null,
        muxPlaybackId: lib?.muxPlaybackId ?? null,
        blockType: block.blockType || "single",
        blockGroupId: groupId,
        section: block.section === "warmup" ? "warmup" : "main",
        position: out.filter((e) => e.section === (block.section === "warmup" ? "warmup" : "main")).length,
        restPeriod: block.rest || "60s",
        setsCount: Math.max(1, sets.length),
        targetReps: firstSet.reps != null ? String(firstSet.reps) : "",
        targetDuration: isTimeBased
          ? (firstSet.duration != null ? String(firstSet.duration) : "30 sec")
          : (firstSet.duration != null ? String(firstSet.duration) : ""),
        durationType: isTimeBased ? "timer" : "text",
        exerciseType,
      });
    }
  }
  return out;
}

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

  // The exercise library is needed to enrich the AI output (names/thumbnails,
  // exerciseType for sets/reps vs time-based handling) before handing it to
  // the WOD builder. Loaded as soon as the dialog opens.
  const { data: exerciseLibrary = [] } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });

  const generate = useMutation({
    mutationFn: async () => {
      // Make sure the exercise library has loaded before we generate, so the
      // seed we hand to the WOD builder has real names/types instead of
      // "Exercise #<id>" placeholders.
      if (exerciseLibrary.length === 0) {
        const cached = await queryClient.fetchQuery<ExerciseLibraryItem[]>({
          queryKey: ["/api/exercises"],
        });
        if (cached) {
          // fetchQuery returns the latest data; nothing else to do — useQuery
          // will pick it up on the next render too.
        }
      }
      // Pull a duration out of the prompt ("20 min", "45 minute workout",
      // "1 hour"). Falls back to 30 minutes when nothing usable is found.
      const promptText = prompt.trim();
      const minMatch = promptText.match(/(\d+)\s*(?:min|minute|mins|minutes)\b/i);
      const hourMatch = promptText.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
      let parsedDuration = 30;
      if (minMatch) parsedDuration = parseInt(minMatch[1], 10);
      else if (hourMatch) parsedDuration = Math.round(parseFloat(hourMatch[1]) * 60);
      const requestedDuration = Math.max(5, Math.min(180, parsedDuration));
      const res = await apiRequest("POST", "/api/ai/workouts/generate", {
        notes: promptText,
        difficulty: "intermediate",
        duration: requestedDuration,
      });
      const json = (await res.json()) as PreviewResponse;
      // Stash so onSuccess can pass it on to the WOD save flow as a floor.
      (json as any).__requestedDuration = requestedDuration;
      return json;
    },
    onSuccess: (data) => {
      // Always pull the freshest library snapshot from the cache to avoid a
      // stale closure (e.g. library finished loading between mutate() and
      // onSuccess).
      const lib =
        queryClient.getQueryData<ExerciseLibraryItem[]>(["/api/exercises"]) ||
        exerciseLibrary;
      // Convert the generated workout into the WOD builder's seed format and
      // hand off via sessionStorage. The builder rehydrates from `wodExercises`
      // on mount, exactly like its existing "load saved workout" round-trip.
      const seed = genWorkoutToSeedExercises(data.data, lib);
      if (seed.length === 0) {
        toast({
          title: "No exercises generated",
          description: "The AI didn't produce any exercises. Try a different prompt.",
          variant: "destructive",
        });
        return;
      }
      try {
        sessionStorage.setItem("wodExercises", JSON.stringify(seed));
        sessionStorage.removeItem("selectedExerciseId");
        sessionStorage.removeItem("wodInsertSection");
        // Hand the AI's stated duration (and the user's requested duration)
        // to the builder so the saved workout-log honours it instead of
        // relying purely on the per-set heuristic.
        const aiDuration = Number(data?.data?.duration) || 0;
        const requested = Number((data as any)?.__requestedDuration) || 0;
        const hint = Math.max(aiDuration, requested);
        if (hint > 0) {
          sessionStorage.setItem("wodDurationHint", String(hint));
        } else {
          sessionStorage.removeItem("wodDurationHint");
        }
      } catch {
        // sessionStorage unavailable (private browsing, quota, etc.). Tell the
        // user instead of silently opening an empty builder.
        toast({
          title: "Couldn't open in builder",
          description:
            "Your browser blocked saving the workout to this tab. Try again, or disable private/incognito mode.",
          variant: "destructive",
        });
        return;
      }
      // Pick a return path the user can naturally cancel back to. WorkoutsTab
      // lives at /training; fall back to current path if we're elsewhere.
      const fromPath = (typeof window !== "undefined" && window.location.pathname) || "/training";
      // Default to Regular. Switch to Circuit or Interval ONLY when the user
      // asked for it in their prompt. Supersets/trisets still work inside
      // Regular mode, so we don't flip just because the AI grouped a block.
      const promptLower = prompt.toLowerCase();
      const asksForInterval = /\b(interval|intervals|tabata|emom|amrap)\b/.test(promptLower);
      const asksForCircuit = /\b(circuit|circuits|hiit)\b/.test(promptLower);
      const wodType = asksForInterval ? "interval" : asksForCircuit ? "circuit" : "regular";
      setOpen(false);
      navigate(
        `/build-wod?type=${wodType}&category=workout&from=${encodeURIComponent(fromPath)}`,
      );
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const isBusy = generate.isPending;

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

      <Dialog open={open} onOpenChange={(v) => { if (!isBusy) setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-workout-generator">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate today's workout
            </DialogTitle>
            <DialogDescription>
              Describe what you want. We'll pick exercises from your library and open the result in the workout builder so you can fine-tune it.
            </DialogDescription>
          </DialogHeader>

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
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isBusy}>Cancel</Button>
            <Button
              onClick={() => generate.mutate()}
              disabled={isBusy || prompt.trim().length === 0}
              data-testid="button-user-ai-generate"
            >
              {generate.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
                : <>Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
