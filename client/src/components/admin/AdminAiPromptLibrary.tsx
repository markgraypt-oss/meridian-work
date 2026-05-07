import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

type PromptKind = "workout" | "programme";

interface AiPrompt {
  id: number;
  kind: PromptKind | string;
  title: string;
  description: string;
  iconName: string | null;
  promptBody: string;
  prefill: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
}

function asPromptKind(v: string): PromptKind {
  return v === "programme" ? "programme" : "workout";
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Try again";
}

type FormState = {
  id?: number;
  kind: PromptKind;
  title: string;
  description: string;
  iconName: string;
  promptBody: string;
  prefillJson: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  kind: "workout",
  title: "",
  description: "",
  iconName: "Sparkles",
  promptBody: "",
  prefillJson: "{}",
  isActive: true,
};

export default function AdminAiPromptLibrary() {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: prompts = [], isLoading } = useQuery<AiPrompt[]>({
    queryKey: ["/api/ai/prompts", { includeInactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/ai/prompts?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
  });

  const grouped = useMemo(() => {
    const workout = prompts.filter(p => p.kind === "workout").sort((a, b) => a.sortOrder - b.sortOrder);
    const programme = prompts.filter(p => p.kind === "programme").sort((a, b) => a.sortOrder - b.sortOrder);
    return { workout, programme };
  }, [prompts]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/ai/prompts"], exact: false });

  const save = useMutation({
    mutationFn: async (state: FormState) => {
      let prefill: unknown = null;
      const trimmed = state.prefillJson.trim();
      if (trimmed) {
        try { prefill = JSON.parse(trimmed); }
        catch { throw new Error("Prefill must be valid JSON"); }
      }
      const payload = {
        kind: state.kind,
        title: state.title.trim(),
        description: state.description.trim(),
        iconName: state.iconName.trim() || "Sparkles",
        promptBody: state.promptBody.trim(),
        prefill,
        isActive: state.isActive,
      };
      if (state.id) {
        const res = await apiRequest("PATCH", `/api/ai/prompts/${state.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/ai/prompts", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      invalidate();
      setEditorOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      toast({ title: "Save failed", description: errMessage(err), variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/ai/prompts/${id}`);
      return res.json();
    },
    onSuccess: () => { toast({ title: "Deleted" }); invalidate(); },
    onError: (err: unknown) =>
      toast({ title: "Delete failed", description: errMessage(err), variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const res = await apiRequest("POST", "/api/ai/prompts/reorder", { orderedIds });
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err: unknown) =>
      toast({ title: "Reorder failed", description: errMessage(err), variant: "destructive" }),
  });

  const move = (kind: PromptKind, index: number, dir: -1 | 1) => {
    const list = (kind === "workout" ? grouped.workout : grouped.programme).map(p => p.id);
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    reorder.mutate(list);
  };

  const openCreate = (kind: PromptKind) => {
    setForm({ ...EMPTY_FORM, kind });
    setEditorOpen(true);
  };
  const openEdit = (p: AiPrompt) => {
    setForm({
      id: p.id,
      kind: asPromptKind(p.kind),
      title: p.title,
      description: p.description,
      iconName: p.iconName || "Sparkles",
      promptBody: p.promptBody,
      prefillJson: JSON.stringify(p.prefill ?? {}, null, 2),
      isActive: p.isActive,
    });
    setEditorOpen(true);
  };

  const renderList = (kind: PromptKind) => {
    const list = kind === "workout" ? grouped.workout : grouped.programme;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground capitalize">{kind} prompts</h3>
          <Button size="sm" onClick={() => openCreate(kind)} data-testid={`button-add-prompt-${kind}`}>
            <Plus className="h-4 w-4 mr-1" /> Add prompt
          </Button>
        </div>
        {list.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">No prompts yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {list.map((p, idx) => (
              <Card key={p.id} data-testid={`row-prompt-${p.id}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(kind, idx, -1)} disabled={idx === 0 || reorder.isPending}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(kind, idx, 1)} disabled={idx === list.length - 1 || reorder.isPending}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="h-3.5 w-3.5 text-[#0cc9a9]" />
                      <span className="font-semibold text-sm">{p.title}</span>
                      {!p.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.promptBody}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)} data-testid={`button-edit-prompt-${p.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm(`Delete "${p.title}"?`)) remove.mutate(p.id); }}
                      data-testid={`button-delete-prompt-${p.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">AI Prompt Library</h2>
        <p className="text-sm text-muted-foreground">
          Curated starting points shown in the AI Workout Builder and AI Programme Builder.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading prompts…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {renderList("workout")}
          {renderList("programme")}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(v) => { if (!save.isPending) setEditorOpen(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-prompt-editor">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit prompt" : "New prompt"}</DialogTitle>
            <DialogDescription>
              The prompt body is shown to the AI when the user picks this preset. Prefill is applied
              to the builder form fields.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm(f => ({ ...f, kind: asPromptKind(v) }))}>
                  <SelectTrigger data-testid="select-prompt-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workout">Workout</SelectItem>
                    <SelectItem value="programme">Programme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Icon name (lucide)</Label>
                <Input value={form.iconName} onChange={(e) => setForm(f => ({ ...f, iconName: e.target.value }))} data-testid="input-prompt-icon" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-prompt-title" />
            </div>
            <div className="space-y-1">
              <Label>Short description</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} data-testid="input-prompt-description" />
            </div>
            <div className="space-y-1">
              <Label>Prompt body (sent to AI)</Label>
              <Textarea rows={5} value={form.promptBody} onChange={(e) => setForm(f => ({ ...f, promptBody: e.target.value }))} data-testid="textarea-prompt-body" />
            </div>
            <div className="space-y-1">
              <Label>Prefill (JSON)</Label>
              <Textarea rows={6} className="font-mono text-xs" value={form.prefillJson} onChange={(e) => setForm(f => ({ ...f, prefillJson: e.target.value }))} data-testid="textarea-prompt-prefill" />
              <p className="text-[11px] text-muted-foreground">
                Workout fields: equipment, duration, difficulty, focus, notes, contraindications.
                Programme fields: goal, equipment, weeks, daysPerWeek, sessionDuration, difficulty, audience, notes, contraindications.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-active">Active</Label>
              <Switch id="prompt-active" checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} data-testid="switch-prompt-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={save.isPending}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.title.trim() || !form.promptBody.trim()} data-testid="button-save-prompt">
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
