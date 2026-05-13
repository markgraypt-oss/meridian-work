import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type StyleId = "airfryer" | "high-protein";

type Candidate = {
  id: number;
  title: string;
  category: string;
  totalTime: number;
  calories: number;
  protein: number;
  imageUrl: string | null;
  signal: string;
};

const STYLE_LABEL: Record<StyleId, string> = {
  "airfryer": "Air fryer",
  "high-protein": "High protein",
};

function CandidateList({ style, open }: { style: StyleId; open: boolean }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{ candidates: Candidate[] }>({
    queryKey: ["/api/admin/recipe-tag-candidates", style],
    queryFn: async () => {
      const res = await fetch(`/api/admin/recipe-tag-candidates?style=${style}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Couldn't load candidates");
      return res.json();
    },
    enabled: open,
  });

  const candidates = data?.candidates ?? [];

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id))
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/recipe-tags", {
        recipeIds: Array.from(selected),
        tag: style,
      });
      return (await res.json()) as { updated: number };
    },
    onSuccess: ({ updated }) => {
      toast({
        title: "Tags saved",
        description: `${updated} recipe${updated === 1 ? "" : "s"} tagged as ${STYLE_LABEL[style]}.`,
      });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recipe-tag-candidates", style] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Couldn't save tags", description, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No untagged candidates for {STYLE_LABEL[style]} right now. Nice work.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={toggleAll}
          data-testid={`toggle-all-${style}`}
        >
          {selected.size === candidates.length ? "Clear selection" : "Select all"}
        </button>
        <span className="text-muted-foreground">
          {selected.size} of {candidates.length} selected
        </span>
      </div>

      <ScrollArea className="h-[420px] pr-2">
        <div className="space-y-2">
          {candidates.map((c) => {
            const checked = selected.has(c.id);
            return (
              <label
                key={c.id}
                htmlFor={`cand-${style}-${c.id}`}
                className="flex gap-3 p-3 rounded-md border bg-card hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox
                  id={`cand-${style}-${c.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(c.id)}
                  data-testid={`cand-${style}-${c.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.category} • {c.totalTime} min • {c.calories} cal • {Number(c.protein).toFixed(0)}g protein
                  </div>
                  {c.signal && (
                    <div className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                      {c.signal}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={selected.size === 0 || saveMutation.isPending}
          data-testid={`save-tags-${style}`}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            `Tag ${selected.size} as ${STYLE_LABEL[style]}`
          )}
        </Button>
      </div>
    </div>
  );
}

export function RecipeTagBackfillDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<StyleId>("airfryer");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-tag-backfill">
          <Tag className="h-4 w-4 mr-2" />
          Tag backfill
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tag library recipes</DialogTitle>
          <DialogDescription>
            Tick the recipes that genuinely belong to each style, then save. Only library
            recipes are shown, and ones already tagged are filtered out.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as StyleId)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="airfryer">Air fryer</TabsTrigger>
            <TabsTrigger value="high-protein">High protein</TabsTrigger>
          </TabsList>
          <TabsContent value="airfryer" className="mt-4">
            <CandidateList style="airfryer" open={open && tab === "airfryer"} />
          </TabsContent>
          <TabsContent value="high-protein" className="mt-4">
            <CandidateList style="high-protein" open={open && tab === "high-protein"} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
