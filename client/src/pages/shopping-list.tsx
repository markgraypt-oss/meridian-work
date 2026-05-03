import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, RefreshCw, ShoppingCart, Sparkles } from "lucide-react";
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

export default function ShoppingListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    list: ShoppingList | null;
    planId: number | null;
  }>({
    queryKey: ["/api/shopping-list"],
  });

  const list = data?.list || null;
  const items = useMemo(() => (list?.items as ShoppingListItem[]) || [], [list]);

  const grouped = useMemo(() => {
    const map: Record<string, ShoppingListItem[]> = {};
    for (const it of items) {
      const s = it.section in SECTION_LABELS ? it.section : "other";
      (map[s] = map[s] || []).push(it);
    }
    return SECTION_ORDER.filter((s) => map[s]?.length).map((s) => ({ section: s, items: map[s] }));
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
              <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                Generate list
              </Button>
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
              {grouped.map(({ section, items: secItems }) => (
                <div key={section}>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    {SECTION_LABELS[section]}
                  </h2>
                  <Card>
                    <CardContent className="p-0">
                      {secItems.map((it) => {
                        const idx = items.indexOf(it);
                        return (
                          <label
                            key={`${section}-${idx}`}
                            className="flex items-start gap-3 p-3 border-b border-border/50 last:border-b-0 cursor-pointer"
                            data-testid={`row-item-${idx}`}
                          >
                            <Checkbox
                              checked={it.checked}
                              onCheckedChange={() => toggle(idx)}
                              className="mt-0.5"
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
                          </label>
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
    </div>
  );
}
