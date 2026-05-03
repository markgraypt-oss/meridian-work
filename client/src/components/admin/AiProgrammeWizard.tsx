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
import AiExercisePicker from "./AiExercisePicker";
import AiSafetyFlags from "@/components/ai/AiSafetyFlags";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProgrammeType?: "main" | "stretching" | "corrective";
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

export default function AiProgrammeWizard({ open, onOpenChange, defaultProgrammeType = "main" }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [goal, setGoal] = useState("general_strength");
  const [equipment, setEquipment] = useState("full_gym");
  const [weeks, setWeeks] = useState(4);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [difficulty, setDifficulty] = useState("beginner");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [contraindicationsText, setContraindicationsText] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>("__none__");

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
    enabled: open,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const contraindications = contraindicationsText
        .split(",").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/ai/programmes/generate", {
        goal, equipment, weeks, daysPerWeek, sessionDuration, difficulty,
        audience: audience || undefined,
        notes: notes || undefined,
        programmeType: defaultProgrammeType,
        contraindications,
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
      const res = await apiRequest("POST", "/api/ai/programmes/save", {
        inputs: preview.inputs,
        data: preview.data,
        logId: preview.logId,
      });
      return await res.json();
    },
    onSuccess: (program: any) => {
      toast({ title: "Programme created", description: `${program.title} saved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      onOpenChange(false);
      setPreview(null);
      navigate(`/admin/programmes/${program.id}`);
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
            <div className="space-y-2">
              <Label htmlFor="ai-audience">Audience (optional)</Label>
              <Input id="ai-audience" value={audience} onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. busy professionals new to lifting"
                data-testid="input-ai-audience" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-contra">Contraindications (comma separated)</Label>
              <Input id="ai-contra" value={contraindicationsText} onChange={(e) => setContraindicationsText(e.target.value)}
                placeholder="e.g. lower back, knees"
                data-testid="input-ai-contraindications" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-notes">Coach notes (optional)</Label>
              <Textarea id="ai-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. emphasise posterior chain, no jumping"
                data-testid="textarea-ai-notes" />
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
