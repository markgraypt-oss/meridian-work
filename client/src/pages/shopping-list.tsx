import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ShoppingList, ShoppingListItem } from "@shared/schema";

const SECTION_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  other: "Other",
};
const SECTION_ORDER = ["produce", "protein", "dairy", "bakery", "pantry", "frozen", "other"];

type EditorState =
  | { mode: "add" }
  | { mode: "edit"; index: number }
  | null;

export default function ShoppingListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<{ name: string; section: string; quantity: string }>({
    name: "",
    section: "other",
    quantity: "",
  });

  const { data, isLoading } = useQuery<{
    list: ShoppingList | null;
    planId: number | null;
  }>({
    queryKey: ["/api/shopping-list"],
  });

  const list = data?.list || null;
  const items = useMemo(() => (list?.items as ShoppingListItem[]) || [], [list]);

  const grouped = useMemo(() => {
    const map: Record<string, { item: ShoppingListItem; index: number }[]> = {};
    items.forEach((it, index) => {
      const s = it.section in SECTION_LABELS ? it.section : "other";
      (map[s] = map[s] || []).push({ item: it, index });
    });
    return SECTION_ORDER.filter((s) => map[s]?.length).map((s) => ({ section: s, entries: map[s] }));
  }, [items]);

  const remaining = items.filter((i) => !i.checked).length;

  const updateMutation = useMutation({
    mutationFn: async (next: ShoppingListItem[]) => {
      if (!list) return;
      return apiRequest("PATCH", `/api/shopping-list/${list.id}`, { items: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/shopping-list/regenerate", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      toast({ title: "Shopping list regenerated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to regenerate", description: err.message, variant: "destructive" });
    },
  });

  const toggle = (idx: number) => {
    const next = items.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it));
    updateMutation.mutate(next);
  };

  const clearChecked = () => {
    const next = items.map((it) => ({ ...it, checked: false }));
    updateMutation.mutate(next);
  };

  const openAdd = () => {
    setForm({ name: "", section: "other", quantity: "" });
    setEditor({ mode: "add" });
  };

  const openEdit = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    setForm({ name: it.name, section: it.section, quantity: it.quantity || "" });
    setEditor({ mode: "edit", index: idx });
  };

  const closeEditor = () => setEditor(null);

  const submitEditor = async () => {
    if (!editor) return;
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const section = form.section in SECTION_LABELS ? form.section : "other";
    const quantity = form.quantity.trim();

    let next: ShoppingListItem[];
    if (editor.mode === "add") {
      const newItem: ShoppingListItem = {
        name,
        section,
        quantity: quantity || undefined,
        recipeIds: [],
        checked: false,
      };
      next = [...items, newItem];
    } else {
      next = items.map((it, i) =>
        i === editor.index
          ? { ...it, name, section, quantity: quantity || undefined }
          : it,
      );
    }
    try {
      await updateMutation.mutateAsync(next);
      closeEditor();
    } catch {
      // onError toast already shown; keep dialog open so user can retry.
    }
  };

  const deleteItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    updateMutation.mutate(next);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-background border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/meal-plan")}
            data-testid="btn-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Shopping List</h1>
          <div className="flex items-center">
            {data?.planId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={openAdd}
                data-testid="btn-add-item"
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending || !data?.planId}
              data-testid="btn-regenerate"
            >
              <RefreshCw className={`w-5 h-5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : !data?.planId ? (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No active meal plan. Create one to generate a shopping list.</p>
              <Button onClick={() => navigate("/nutrition/meal-plan-settings")}>Create meal plan</Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-muted-foreground">No items yet.</p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                  Generate list
                </Button>
                <Button variant="outline" onClick={openAdd} data-testid="btn-add-item-empty">
                  <Plus className="w-4 h-4 mr-1" /> Add item
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{remaining} of {items.length} remaining</span>
                {list?.aiGenerated && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="w-3 h-3" /> AI
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={clearChecked} data-testid="btn-clear">
                Reset
              </Button>
            </div>

            <div className="space-y-4">
              {grouped.map(({ section, entries }) => (
                <div key={section}>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {SECTION_LABELS[section]}
                  </h2>
                  <Card>
                    <CardContent className="p-0">
                      {entries.map(({ item: it, index: idx }) => {
                        return (
                          <div
                            key={`${section}-${idx}`}
                            className="flex items-start gap-3 p-3 border-b border-border/50 last:border-b-0"
                            data-testid={`row-item-${idx}`}
                          >
                            <Checkbox
                              checked={it.checked}
                              onCheckedChange={() => toggle(idx)}
                              className="mt-0.5"
                              data-testid={`checkbox-item-${idx}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium capitalize ${it.checked ? "line-through text-muted-foreground" : ""}`}>
                                {it.name}
                              </p>
                              {it.quantity && (
                                <p className={`text-xs text-muted-foreground ${it.checked ? "line-through" : ""}`}>
                                  {it.quantity}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => openEdit(idx)}
                              disabled={updateMutation.isPending}
                              data-testid={`btn-edit-item-${idx}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => deleteItem(idx)}
                              disabled={updateMutation.isPending}
                              data-testid={`btn-delete-item-${idx}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.mode === "edit" ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Olive oil"
                data-testid="input-item-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="e.g. 2 cups, 300g"
                data-testid="input-item-quantity"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-section">Section</Label>
              <Select
                value={form.section}
                onValueChange={(v) => setForm({ ...form, section: v })}
              >
                <SelectTrigger id="item-section" data-testid="select-item-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTION_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor} data-testid="btn-cancel-item">
              Cancel
            </Button>
            <Button
              onClick={submitEditor}
              disabled={updateMutation.isPending}
              data-testid="btn-save-item"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
