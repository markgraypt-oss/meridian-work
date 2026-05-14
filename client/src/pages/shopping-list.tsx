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
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ShoppingList, ShoppingListItem } from "@shared/schema";

const MEAL_TYPE_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  snack: 3,
  dinner: 4,
  main: 5,
  side: 6,
};

// Stored mealType may carry a slot suffix like "breakfast_0" or "main_1".
const baseMealType = (t?: string | null) => (t ? t.split("_")[0].toLowerCase() : "");

const formatMealType = (t?: string | null) => {
  const b = baseMealType(t);
  if (!b) return "";
  return b.charAt(0).toUpperCase() + b.slice(1);
};

type EditorState =
  | { mode: "add" }
  | { mode: "edit"; index: number }
  | null;

interface MealGroup {
  key: string;
  mealPlanMealId: number | null;
  dayIndex: number | null;
  mealType: string | null;
  recipeTitle: string | null;
  entries: { item: ShoppingListItem; index: number }[];
}

export default function ShoppingListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<{
    name: string;
    quantity: string;
    mealPlanMealId: string; // "" = Extras
  }>({
    name: "",
    quantity: "",
    mealPlanMealId: "",
  });

  const { data, isLoading } = useQuery<{
    list: ShoppingList | null;
    planId: number | null;
  }>({
    queryKey: ["/api/shopping-list"],
  });

  const list = data?.list || null;
  const items = useMemo(() => (list?.items as ShoppingListItem[]) || [], [list]);

  // Group by mealPlanMealId. Items without one go into "Extras".
  const grouped = useMemo<MealGroup[]>(() => {
    const map = new Map<string, MealGroup>();
    items.forEach((it, index) => {
      const key = it.mealPlanMealId ? `meal-${it.mealPlanMealId}` : "extras";
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          mealPlanMealId: it.mealPlanMealId ?? null,
          dayIndex: it.dayIndex ?? null,
          mealType: it.mealType ?? null,
          recipeTitle: it.recipeTitle ?? null,
          entries: [],
        };
        map.set(key, g);
      }
      g.entries.push({ item: it, index });
    });

    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      // Extras always last
      if (a.key === "extras") return 1;
      if (b.key === "extras") return -1;
      const da = a.dayIndex ?? 999;
      const db = b.dayIndex ?? 999;
      if (da !== db) return da - db;
      const ma = MEAL_TYPE_ORDER[baseMealType(a.mealType)] ?? 99;
      const mb = MEAL_TYPE_ORDER[baseMealType(b.mealType)] ?? 99;
      if (ma !== mb) return ma - mb;
      return (a.mealPlanMealId ?? 0) - (b.mealPlanMealId ?? 0);
    });
    return groups;
  }, [items]);

  // Fetch meal plan details so the editor's meal selector covers every meal in
  // the plan, not just meals that already have ingredient items in the list.
  const { data: mealPlanData } = useQuery<any>({
    queryKey: ["/api/meal-plan"],
    enabled: !!data?.planId,
  });

  const mealOptions = useMemo(() => {
    const out: { id: number; label: string; sort: number }[] = [];
    const seen = new Set<number>();

    // Prefer meals from the live plan
    const planDays = (mealPlanData?.days as any[]) || [];
    planDays.forEach((d: any) => {
      (d.meals || []).forEach((m: any) => {
        if (!m?.id || seen.has(m.id)) return;
        seen.add(m.id);
        const day = d.dayIndex ? `Day ${d.dayIndex}` : "";
        const type = formatMealType(m.mealType);
        const title = m.recipe?.title || "";
        const label = [day, type, title].filter(Boolean).join(" · ");
        const sort =
          (d.dayIndex ?? 999) * 100 +
          (MEAL_TYPE_ORDER[baseMealType(m.mealType)] ?? 99);
        out.push({ id: m.id, label, sort });
      });
    });

    // Fall back to any meals referenced only by existing items
    items.forEach((it) => {
      if (!it.mealPlanMealId || seen.has(it.mealPlanMealId)) return;
      seen.add(it.mealPlanMealId);
      const day = it.dayIndex ? `Day ${it.dayIndex}` : "";
      const type = formatMealType(it.mealType);
      const title = it.recipeTitle || "";
      const label = [day, type, title].filter(Boolean).join(" · ");
      const sort =
        (it.dayIndex ?? 999) * 100 +
        (MEAL_TYPE_ORDER[baseMealType(it.mealType)] ?? 99);
      out.push({ id: it.mealPlanMealId, label, sort });
    });

    return out.sort((a, b) => a.sort - b.sort);
  }, [items, mealPlanData]);

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

  const toggleGroup = (group: MealGroup, allChecked: boolean) => {
    const indices = new Set(group.entries.map((e) => e.index));
    const next = items.map((it, i) =>
      indices.has(i) ? { ...it, checked: !allChecked } : it,
    );
    updateMutation.mutate(next);
  };

  const clearChecked = () => {
    const next = items.map((it) => ({ ...it, checked: false }));
    updateMutation.mutate(next);
  };

  const openAdd = () => {
    setForm({ name: "", quantity: "", mealPlanMealId: "" });
    setEditor({ mode: "add" });
  };

  const openEdit = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    setForm({
      name: it.name,
      quantity: it.quantity || "",
      mealPlanMealId: it.mealPlanMealId ? String(it.mealPlanMealId) : "",
    });
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
    const quantity = form.quantity.trim();
    const mealId = form.mealPlanMealId ? parseInt(form.mealPlanMealId) : undefined;
    // Look up meal context from existing items first, then the live plan.
    let sourceMeal:
      | { recipeId?: number; dayIndex?: number; mealType?: string; recipeTitle?: string }
      | undefined;
    if (mealId) {
      const fromItems = items.find((it) => it.mealPlanMealId === mealId);
      if (fromItems) {
        sourceMeal = {
          recipeId: fromItems.recipeId,
          dayIndex: fromItems.dayIndex,
          mealType: fromItems.mealType,
          recipeTitle: fromItems.recipeTitle,
        };
      } else {
        const planDays = (mealPlanData?.days as any[]) || [];
        for (const d of planDays) {
          const m = (d.meals || []).find((mm: any) => mm.id === mealId);
          if (m) {
            sourceMeal = {
              recipeId: m.recipe?.id,
              dayIndex: d.dayIndex,
              mealType: m.mealType,
              recipeTitle: m.recipe?.title,
            };
            break;
          }
        }
      }
    }

    let next: ShoppingListItem[];
    if (editor.mode === "add") {
      const newItem: ShoppingListItem = {
        name,
        quantity: quantity || undefined,
        mealPlanMealId: mealId,
        recipeId: sourceMeal?.recipeId,
        dayIndex: sourceMeal?.dayIndex,
        mealType: sourceMeal?.mealType,
        recipeTitle: sourceMeal?.recipeTitle,
        manual: true,
        checked: false,
      };
      next = [...items, newItem];
    } else {
      next = items.map((it, i) =>
        i === editor.index
          ? {
              ...it,
              name,
              quantity: quantity || undefined,
              mealPlanMealId: mealId,
              recipeId: sourceMeal?.recipeId,
              dayIndex: sourceMeal?.dayIndex,
              mealType: sourceMeal?.mealType,
              recipeTitle: sourceMeal?.recipeTitle,
              manual: true,
            }
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
            onClick={() => navigate("/nutrition")}
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
              <span className="text-sm text-muted-foreground">{remaining} of {items.length} remaining</span>
              <Button variant="ghost" size="sm" onClick={clearChecked} data-testid="btn-clear">
                Reset
              </Button>
            </div>

            <div className="space-y-4">
              {grouped.map((group) => {
                const allChecked = group.entries.every((e) => e.item.checked);
                const isExtras = group.key === "extras";
                const checkedCount = group.entries.filter((e) => e.item.checked).length;
                return (
                  <div key={group.key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        {isExtras ? (
                          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                            Extras
                          </h2>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {group.dayIndex && (
                              <Badge
                                variant="secondary"
                                className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] uppercase tracking-wide"
                              >
                                Day {group.dayIndex} · {formatMealType(group.mealType || "")}
                              </Badge>
                            )}
                            <h2 className="text-sm font-semibold truncate">
                              {group.recipeTitle || "Meal"}
                            </h2>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {checkedCount}/{group.entries.length}
                      </span>
                    </div>
                    <Card>
                      <CardContent className="p-0">
                        {group.entries.map(({ item: it, index: idx }) => (
                          <div
                            key={`${group.key}-${idx}`}
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
                              {it.quantity && it.quantity.toLowerCase() !== it.name.toLowerCase() && (
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
                        ))}
                        <div className="px-3 py-2 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => toggleGroup(group, allChecked)}
                            disabled={updateMutation.isPending}
                            data-testid={`btn-toggle-group-${group.key}`}
                          >
                            {allChecked ? "Uncheck all" : "Check all"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
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
            {mealOptions.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="item-meal">Meal</Label>
                <Select
                  value={form.mealPlanMealId || "extras"}
                  onValueChange={(v) =>
                    setForm({ ...form, mealPlanMealId: v === "extras" ? "" : v })
                  }
                >
                  <SelectTrigger id="item-meal" data-testid="select-item-meal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extras">Extras</SelectItem>
                    {mealOptions.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
