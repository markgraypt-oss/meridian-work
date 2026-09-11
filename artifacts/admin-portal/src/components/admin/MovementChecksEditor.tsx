import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MOVEMENT_PATTERN_OPTIONS } from "@/components/admin/exerciseFilterConstants";
import type { BodyMapArea } from "@shared/schema";

/**
 * The movement questions an assessment asks for one area.
 *
 * Each check is one question — "how does pushing overhead feel?" — shown
 * with a picture. The picture is the athlete's own programme exercise for
 * that pattern where they have one; the cue exercise here is the fallback.
 */
type MovementCheck = {
  key: string;
  label: string;
  patterns: string[];
  cueExerciseId?: number | null;
};

type LibraryExercise = {
  id: number;
  name: string;
  imageUrl?: string | null;
  muxPlaybackId?: string | null;
  movement?: string[] | null;
};

const LATERALITY = /^(Bilateral|Unilateral|Alternating|Contralateral|Ipsilateral)/;

function keyFromLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "check";
}

function thumb(e: LibraryExercise): string | null {
  return e.imageUrl || (e.muxPlaybackId ? `https://image.mux.com/${e.muxPlaybackId}/thumbnail.png?width=160` : null);
}

export function MovementChecksEditor({ area }: { area: BodyMapArea }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checks, setChecks] = useState<MovementCheck[]>([]);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState<Record<number, string>>({});

  useEffect(() => {
    const raw = (area as any).movementChecks;
    setChecks(Array.isArray(raw) ? raw.map((c: any) => ({
      key: String(c.key || ""),
      label: String(c.label || ""),
      patterns: Array.isArray(c.patterns) ? c.patterns.map(String) : [],
      cueExerciseId: c.cueExerciseId ?? null,
    })) : []);
    setDirty(false);
  }, [area.id, (area as any).movementChecks]);

  const { data: exercises = [] } = useQuery<LibraryExercise[]>({ queryKey: ["/api/exercises"] });
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const save = useMutation({
    mutationFn: async () => {
      const clean = checks
        .filter((c) => c.label.trim() && c.patterns.length > 0)
        .map((c) => ({ ...c, key: c.key || keyFromLabel(c.label), label: c.label.trim() }));
      await apiRequest("PUT", `/api/body-map-config/areas/${area.id}`, { movementChecks: clean });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-map-config/areas"] });
      setDirty(false);
      toast({ title: "Movement checks saved" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: e?.message, variant: "destructive" }),
  });

  const update = (i: number, patch: Partial<MovementCheck>) => {
    setChecks((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setChecks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };
  const remove = (i: number) => { setChecks((prev) => prev.filter((_, idx) => idx !== i)); setDirty(true); };
  const add = () => { setChecks((prev) => [...prev, { key: "", label: "", patterns: [], cueExerciseId: null }]); setDirty(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-lg font-semibold">Movement Checks — {area.displayName}</h3>
          <p className="text-sm text-muted-foreground">
            Asked one at a time after the severity, with a picture. The athlete answers Fine / Sore but manageable / Painful
            for each. Painful stops the pattern, manageable goes easier, fine is left alone (at 7–8 nothing is left
            completely alone; at 9–10 the questions are skipped and everything stops).
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            The picture is the athlete's own programme exercise for that pattern when they have one; the cue exercise below is the fallback.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={add}><Plus className="h-4 w-4 mr-2" />Add check</Button>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      {checks.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No movement checks for this area yet — the assessment falls back to the outcome's flag lists. Add the movements this area is involved in.
        </p>
      )}

      {checks.map((c, i) => {
        const cue = c.cueExerciseId ? byId.get(c.cueExerciseId) : null;
        const q = (search[i] || "").trim().toLowerCase();
        const matches = q.length >= 2
          ? exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8)
          : [];
        return (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === checks.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Question label</Label>
                      <Input
                        value={c.label}
                        placeholder="e.g. Pushing overhead"
                        onChange={(e) => update(i, { label: e.target.value, key: c.key || keyFromLabel(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Shown to the athlete as the movement name. Key: {c.key || keyFromLabel(c.label) || "—"}</p>
                    </div>
                    <div>
                      <Label>Fallback picture (cue exercise)</Label>
                      {cue ? (
                        <div className="flex items-center gap-3 mt-1">
                          {thumb(cue) ? <img src={thumb(cue)!} alt="" className="h-12 w-12 rounded object-cover bg-muted" /> : <div className="h-12 w-12 rounded bg-muted" />}
                          <div className="flex-1 text-sm">{cue.name}</div>
                          <Button variant="ghost" size="sm" onClick={() => update(i, { cueExerciseId: null })}>Change</Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            value={search[i] || ""}
                            placeholder="Search the library…"
                            onChange={(e) => setSearch((s) => ({ ...s, [i]: e.target.value }))}
                          />
                          {matches.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded border bg-popover shadow">
                              {matches.map((e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  onClick={() => { update(i, { cueExerciseId: e.id }); setSearch((s) => ({ ...s, [i]: "" })); }}
                                >
                                  {thumb(e) ? <img src={thumb(e)!} alt="" className="h-8 w-8 rounded object-cover bg-muted" /> : <div className="h-8 w-8 rounded bg-muted" />}
                                  <span className="flex-1">{e.name}</span>
                                  <span className="text-xs text-muted-foreground">{(e.movement || []).filter((m) => !LATERALITY.test(m)).join(", ")}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Movement patterns this question covers</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {MOVEMENT_PATTERN_OPTIONS.map((pattern) => (
                        <label key={pattern} className="flex items-center gap-2 bg-muted rounded px-2 py-1 cursor-pointer hover:bg-muted/80">
                          <Checkbox
                            checked={c.patterns.includes(pattern)}
                            onCheckedChange={(checked) => update(i, {
                              patterns: checked ? [...c.patterns, pattern] : c.patterns.filter((p) => p !== pattern),
                            })}
                          />
                          <span className="text-sm">{pattern}</span>
                        </label>
                      ))}
                    </div>
                    {c.patterns.length === 0 && <p className="text-xs text-destructive mt-1">Pick at least one pattern or this question does nothing.</p>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
