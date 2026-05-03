import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Trash2, Plus, Save, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CoachMemory } from "@shared/schema";

const CATEGORIES = ["preference", "constraint", "tried", "goal", "general"] as const;

const categoryColor: Record<string, string> = {
  preference: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  constraint: "bg-red-500/15 text-red-300 border-red-500/30",
  tried: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  goal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  general: "bg-muted text-muted-foreground border-border",
};

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

export default function CoachMemoryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CoachMemory[]>({ queryKey: ["/api/coach/memory"] });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editImportance, setEditImportance] = useState(3);

  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newImportance, setNewImportance] = useState(3);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/coach/memory"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const key = slugify(newKey || newValue.split(" ").slice(0, 4).join(" "));
      if (!key) throw new Error("Provide a name");
      if (!newValue.trim()) throw new Error("Provide a value");
      return apiRequest("POST", "/api/coach/memory", {
        key,
        value: newValue.trim(),
        category: newCategory,
        importance: newImportance,
      });
    },
    onSuccess: () => {
      invalidate();
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
      setNewCategory("general");
      setNewImportance(3);
      toast({ title: "Memory saved" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/coach/memory/${id}`, {
      value: editValue.trim(),
      category: editCategory,
      importance: editImportance,
    }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast({ title: "Memory updated" });
    },
    onError: (e: any) => toast({ title: "Could not update", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/coach/memory/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Memory removed" });
    },
  });

  const clearMut = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/coach/memory"),
    onSuccess: () => {
      invalidate();
      toast({ title: "All memories cleared" });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/profile")}
              className="p-1.5 rounded-md hover:bg-muted"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-foreground">Coach memory</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd((v) => !v)}
            data-testid="button-add-memory"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Durable facts your coach remembers about you. Edit or remove anything that is wrong or stale.
        </p>

        {showAdd && (
          <Card className="mb-3 border-[#0cc9a9]/30">
            <CardContent className="p-4 space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Name (snake_case, optional)</label>
                <Input
                  placeholder="e.g. lactose_intolerant"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  data-testid="input-new-key"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Memory</label>
                <Textarea
                  placeholder="e.g. Trains in the morning before 7am"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  rows={2}
                  data-testid="input-new-value"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger data-testid="select-new-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Importance (1-5)</label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={newImportance}
                    onChange={(e) => setNewImportance(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 3)))}
                    data-testid="input-new-importance"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending} data-testid="button-save-new">
                  {createMut.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No memories yet. As you chat with the coach, durable facts about you appear here.
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {data?.map((m) => {
            const isEditing = editingId === m.id;
            return (
              <Card key={m.id} data-testid={`memory-${m.id}`}>
                <CardContent className="p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={editImportance}
                          onChange={(e) => setEditImportance(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 3)))}
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => updateMut.mutate(m.id)} disabled={updateMut.isPending}>
                          <Save className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${categoryColor[m.category] || categoryColor.general}`}>
                            {m.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">imp {m.importance}/5</span>
                          <span className="text-[10px] text-muted-foreground italic">{m.source}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingId(m.id);
                              setEditValue(m.value);
                              setEditCategory(m.category);
                              setEditImportance(m.importance);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            data-testid={`button-edit-${m.id}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMut.mutate(m.id)}
                            className="p-1 text-muted-foreground hover:text-red-400"
                            data-testid={`button-delete-${m.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{m.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{m.key}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {data && data.length > 0 && (
          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full text-red-400 hover:text-red-300 border-red-700"
              onClick={() => {
                if (confirm("Clear all coach memories? This cannot be undone.")) clearMut.mutate();
              }}
              data-testid="button-clear-all"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Clear all memories
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
