import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Enrollment = {
  id: number;
  programId: number;
  programTitle: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  workoutsCompleted: number;
  totalWorkouts: number;
  programWeeks: number;
};

type Timeline = {
  current: Enrollment | null;
  scheduled: Enrollment[];
  completed: Enrollment[];
  currentSupplementary: Enrollment[];
  scheduledSupplementary: Enrollment[];
  completedSupplementary: Enrollment[];
};

type ClientUser = { id: string; firstName?: string | null; email?: string | null } | null;

function fmt(d: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

export function ClientProgrammesDialog({ user, open, onClose }: { user: ClientUser; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const userId = user?.id;
  const name = user?.firstName || user?.email || "client";

  const timeline = useQuery<Timeline>({
    queryKey: ["/api/admin/users", userId, "timeline"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/users/${userId}/timeline`);
      if (!r.ok) throw new Error("Failed to load client programmes");
      return r.json();
    },
    enabled: !!userId && open,
  });

  const programmes = useQuery<any[]>({
    queryKey: ["/api/programs", "assign"],
    queryFn: async () => {
      const r = await fetch("/api/programs");
      if (!r.ok) throw new Error("Failed to load programmes");
      return r.json();
    },
    enabled: open,
  });

  const [progId, setProgId] = useState("");
  const [ptype, setPtype] = useState<"main" | "supplementary">("main");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [startDate, setStartDate] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/users", userId, "timeline"] });

  const assign = useMutation({
    mutationFn: async () => {
      const body: any = { programId: Number(progId), programType: ptype };
      if (ptype === "main" && when === "schedule" && startDate) body.startDate = startDate;
      return apiRequest("POST", `/api/admin/users/${userId}/enroll`, body);
    },
    onSuccess: () => {
      invalidate();
      setProgId("");
      toast({ title: "Programme assigned" });
    },
    onError: (e: any) => toast({ title: "Couldn't assign programme", description: e.message, variant: "destructive" }),
  });

  const changeLength = useMutation({
    mutationFn: async (vars: { enrollmentId: number; body: any }) =>
      apiRequest("PATCH", `/api/admin/enrollments/${vars.enrollmentId}/length`, vars.body),
    onSuccess: () => {
      invalidate();
      toast({ title: "Programme length updated" });
    },
    onError: (e: any) => toast({ title: "Couldn't update length", description: e.message, variant: "destructive" }),
  });

  const t = timeline.data;
  const progList = programmes.data || [];

  const statusLabel = (s: string) => (s === "ended" ? "Ended early" : s === "completed" ? "Completed" : s);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}'s programmes</DialogTitle>
        </DialogHeader>

        {timeline.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            {/* CURRENT */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Current programme</h3>
              {t?.current ? (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="font-medium">{t.current.programTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(t.current.startDate)} → {fmt(t.current.endDate)} · {t.current.workoutsCompleted}/{t.current.totalWorkouts} workouts done
                    </p>
                  </div>
                  <ExtendControls enrollment={t.current} onExtend={(body) => changeLength.mutate({ enrollmentId: t.current!.id, body })} pending={changeLength.isPending} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active programme.</p>
              )}
            </section>

            {/* NEXT / SCHEDULED */}
            {t && t.scheduled.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Queued next</h3>
                <div className="space-y-2">
                  {t.scheduled.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-sm">{e.programTitle}</p>
                      <p className="text-xs text-muted-foreground">Starts {fmt(e.startDate)} — switches over automatically</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SUPPLEMENTARY */}
            {t && t.currentSupplementary.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Supplementary</h3>
                <div className="space-y-2">
                  {t.currentSupplementary.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-sm">{e.programTitle}</p>
                      <p className="text-xs text-muted-foreground">{fmt(e.startDate)} → {fmt(e.endDate)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ASSIGN */}
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Assign a programme</h3>
              <div className="space-y-2">
                <Label className="text-xs">Programme</Label>
                <Select value={progId} onValueChange={setProgId}>
                  <SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger>
                  <SelectContent>
                    {progList.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}{p.visibility === "private" ? " (Private)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Select value={ptype} onValueChange={(v) => setPtype(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main programme</SelectItem>
                      <SelectItem value="supplementary">Supplementary (runs alongside)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ptype === "main" && (
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">When</Label>
                    <Select value={when} onValueChange={(v) => setWhen(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="now">Start now (replace current)</SelectItem>
                        <SelectItem value="schedule">Schedule for later</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {ptype === "main" && when === "schedule" && (
                <div className="space-y-2">
                  <Label className="text-xs">Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">It sits behind the current programme and switches over on this date.</p>
                </div>
              )}
              <Button
                type="button"
                disabled={!progId || assign.isPending || (ptype === "main" && when === "schedule" && !startDate)}
                onClick={() => assign.mutate()}
              >
                Assign
              </Button>
            </section>

            {/* HISTORY */}
            {t && t.completed.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2">History</h3>
                <div className="space-y-2">
                  {t.completed.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium text-sm">{e.programTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {statusLabel(e.status)} · {fmt(e.completedAt || e.endDate)} · {e.workoutsCompleted}/{e.totalWorkouts} done
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${e.status === "ended" ? "text-amber-600" : "text-emerald-600"}`}>
                        {statusLabel(e.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExtendControls({ enrollment, onExtend, pending }: { enrollment: Enrollment; onExtend: (body: any) => void; pending: boolean }) {
  const [weeks, setWeeks] = useState("2");
  const [endDate, setEndDate] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <div className="space-y-1">
        <Label className="text-xs">Extend by</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} className="w-20" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          <span className="text-xs text-muted-foreground">weeks</span>
          <Button type="button" size="sm" variant="outline" disabled={pending || !weeks} onClick={() => onExtend({ extendWeeks: Number(weeks) })}>Extend</Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Or end on</Label>
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button type="button" size="sm" variant="outline" disabled={pending || !endDate} onClick={() => onExtend({ endDate })}>Set end</Button>
        </div>
      </div>
    </div>
  );
}
