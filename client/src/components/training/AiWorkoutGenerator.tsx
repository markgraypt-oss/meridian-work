import { useState } from "react";
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
import { Loader2, Sparkles, RefreshCw, Plus, Trash2 } from "lucide-react";
import type { ExerciseLibraryItem } from "@shared/schema";
import AiExercisePicker from "@/components/admin/AiExercisePicker";

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
}

interface Props { triggerLabel?: string }

export default function AiWorkoutGenerator({ triggerLabel = "Generate today's workout" }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const [equipment, setEquipment] = useState("bodyweight");
  const [duration, setDuration] = useState(30);
  const [difficulty, setDifficulty] = useState("beginner");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [contraindicationsText, setContraindicationsText] = useState("");
  const [scheduleForToday, setScheduleForToday] = useState(true);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pickerCtx, setPickerCtx] = useState<{ blockIdx: number; exIdx: number } | null>(null);

  const { data: exerciseLibrary } = useQuery<ExerciseLibraryItem[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });
  const exerciseById = new Map((exerciseLibrary || []).map(e => [e.id, e]));

  const generate = useMutation({
    mutationFn: async () => {
      const contraindications = contraindicationsText
        .split(",").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/ai/workouts/generate", {
        equipment, duration, difficulty,
        focus: focus || undefined,
        notes: notes || undefined,
        contraindications,
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

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="button-generate-todays-workout"
        className="w-full sm:w-auto"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isBusy) { setOpen(v); if (!v) setPreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-workout-generator">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate today's workout
            </DialogTitle>
            <DialogDescription>
              Tell us what you have today; we'll build a session from your exercise library and tune it to your current burnout / discomfort signals.
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-equipment">Equipment</Label>
                  <Select value={equipment} onValueChange={setEquipment}>
                    <SelectTrigger id="user-equipment" data-testid="select-user-equipment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_gym">Full gym</SelectItem>
                      <SelectItem value="home_gym">Home gym</SelectItem>
                      <SelectItem value="bodyweight">Bodyweight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="user-difficulty" data-testid="select-user-difficulty"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-duration">Duration (min)</Label>
                  <Input id="user-duration" type="number" min={5} max={180} value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10) || 5)}
                    data-testid="input-user-duration" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-focus">Focus (optional)</Label>
                  <Input id="user-focus" value={focus} onChange={(e) => setFocus(e.target.value)}
                    placeholder="e.g. upper body"
                    data-testid="input-user-focus" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-contra">Avoid (comma separated)</Label>
                <Input id="user-contra" value={contraindicationsText} onChange={(e) => setContraindicationsText(e.target.value)}
                  placeholder="e.g. shoulders, jumping"
                  data-testid="input-user-contraindications" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-notes">Notes (optional)</Label>
                <Textarea id="user-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. low impact only, tight on time"
                  data-testid="textarea-user-notes" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scheduleForToday} onChange={(e) => setScheduleForToday(e.target.checked)}
                  data-testid="checkbox-schedule-today" />
                Place into today's slot when saved
              </label>
            </div>
          ) : (
            <div className="space-y-3 py-2" data-testid="ai-workout-preview">
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
                <Button onClick={() => generate.mutate()} disabled={isBusy} data-testid="button-user-ai-generate">
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
