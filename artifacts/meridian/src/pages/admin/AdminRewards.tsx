// Workforce Rewards — company admin screen.
//
// PRIVACY: everything on this page is a COUNT, except the winners list, which
// shows a name only for a person who explicitly released it after winning.
// If you are adding a panel here, that rule is not negotiable — the whole
// employee-facing promise of the programme rests on it.

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, Users, Target, ShieldAlert, Ticket, Gift, RefreshCw,
  CheckCircle2, XCircle, Lock, AlertTriangle, Dices,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CompanySummary = { companyName: string; userCount: number; eligible: boolean };

type Program = {
  id: number;
  company_name: string;
  status: string;
  target_threshold: number;
  daily_step_cap: number;
  min_days_for_eligibility: number;
  winners_per_qualifiers: number;
  max_tickets_per_period: number;
  max_gap_days: number;
  anomaly_sd_multiplier: number;
  require_consent: boolean;
  weekly_perk: string | null;
  monthly_reward: string | null;
  yearly_reward: string | null;
  reward_cost_pence: number | null;
  budget_cap_pence: number | null;
  legal_acknowledged_at: string | null;
};

type Participation = {
  period: string;
  periodStart: string;
  periodEnd: string;
  daysCounted: number;
  target: string;
  totalMembers: number;
  enrolled: number;
  withStepAccess: number;
  evaluated: number;
  eligible: number;
  hitTarget: number;
  participationRate: number;
  enrolmentRate: number;
  flaggedForReview: number;
  totalTickets: number;
  avgStepsAcrossParticipants: number;
  projectedWinners: number;
  ineligibleBreakdown: { reason: string; count: number }[];
};

type Draw = {
  id: number;
  period_key: string;
  period_type: string;
  reward_description: string;
  qualifiers: number;
  total_tickets: number;
  winners_drawn: number;
  excluded_previous_winners: number;
  seed: string;
  algorithm: string;
  drawn_at: string;
  names_released: number;
};

type Fulfilment = {
  id: number;
  period_key: string;
  reward_description: string;
  status: string;
  admin_note: string | null;
  identity_released: boolean;
  winner_name: string | null;
  winner_email: string | null;
  awaitingConsent: boolean;
  declinedIdentity: boolean;
  created_at: string;
};

type Flagged = {
  id: number;
  period_key: string;
  days_with_data: number;
  capped_total_steps: string;
  avg_steps_per_day: number;
  anomaly_days: number;
  longest_gap_days: number;
};

const REASON_LABELS: Record<string, string> = {
  not_enrolled: "Not enrolled in the programme",
  no_step_access: "Enrolled but step access not granted",
  no_connected_device: "No connected device",
  insufficient_days: "Too few days of device data",
  sync_gap: "Device stopped syncing mid-period",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 10).slice(0, 7);
}

function monthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

function Stat({ label, value, sub, icon: Icon, tone }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {Icon ? <Icon className={`h-4 w-4 ${tone || "text-[#0cc9a9]"}`} /> : null}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone || "text-[#0cc9a9]"}`}>{value}</div>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminRewards() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>(currentMonth());
  const [draft, setDraft] = useState<Partial<Program>>({});

  const { data: companies = [] } = useQuery<CompanySummary[]>({
    queryKey: ["/api/admin/reports/companies"],
    enabled: !!user,
  });

  // A company admin only ever has their own company; pick it automatically.
  useEffect(() => {
    if (!company && companies.length > 0) setCompany(companies[0].companyName);
  }, [companies, company]);

  const enc = company ? encodeURIComponent(company) : "";
  const base = `/api/admin/rewards/company/${enc}`;

  const { data: program } = useQuery<Program>({ queryKey: [`${base}/program`], enabled: !!company });
  const { data: participation, isFetching: partLoading } = useQuery<Participation>({
    queryKey: [`${base}/participation`, period],
    queryFn: async () => (await apiRequest("GET", `${base}/participation?period=${period}`)).json(),
    enabled: !!company,
  });
  const { data: draws = [] } = useQuery<Draw[]>({ queryKey: [`${base}/draws`], enabled: !!company });
  const { data: fulfilments = [] } = useQuery<Fulfilment[]>({ queryKey: [`${base}/fulfilments`], enabled: !!company });
  const { data: flagged = [] } = useQuery<Flagged[]>({
    queryKey: [`${base}/flagged`, period],
    queryFn: async () => (await apiRequest("GET", `${base}/flagged?period=${period}`)).json(),
    enabled: !!company,
  });

  useEffect(() => { setDraft({}); }, [company]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: [`${base}/program`] });
    queryClient.invalidateQueries({ queryKey: [`${base}/participation`] });
    queryClient.invalidateQueries({ queryKey: [`${base}/draws`] });
    queryClient.invalidateQueries({ queryKey: [`${base}/fulfilments`] });
    queryClient.invalidateQueries({ queryKey: [`${base}/flagged`] });
  };

  const saveProgram = useMutation({
    mutationFn: async (patch: any) => (await apiRequest("PATCH", `${base}/program`, patch)).json(),
    onSuccess: () => { setDraft({}); refreshAll(); toast({ title: "Programme saved" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const evaluate = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${base}/evaluate?month=${period}`)).json(),
    onSuccess: (d: any) => {
      refreshAll();
      toast({
        title: "Evaluation complete",
        description: `${d.participation.hitTarget} of ${d.participation.eligible} eligible hit the target`,
      });
    },
    onError: (e: any) => toast({ title: "Evaluation failed", description: e?.message, variant: "destructive" }),
  });

  const runDraw = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${base}/draws/run`, { period })).json(),
    onSuccess: (d: any) => {
      refreshAll();
      toast({
        title: d.alreadyDrawn ? "Already drawn" : "Draw complete",
        description: d.alreadyDrawn
          ? "This period has a draw already — draws are immutable so it was left alone."
          : `${d.winners} winner(s) from ${d.entrants} qualifier(s).`,
      });
    },
    onError: (e: any) => toast({ title: "Draw failed", description: e?.message, variant: "destructive" }),
  });

  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: string }) =>
      (await apiRequest("POST", `${base}/flagged/${id}/review`, { decision })).json(),
    onSuccess: () => { refreshAll(); toast({ title: "Review recorded" }); },
    onError: (e: any) => toast({ title: "Review failed", description: e?.message, variant: "destructive" }),
  });

  const setFulfilment = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      (await apiRequest("PATCH", `${base}/fulfilments/${id}`, { status })).json(),
    onSuccess: () => { refreshAll(); toast({ title: "Fulfilment updated" }); },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user?.isAdmin) return <div className="p-8 text-muted-foreground">Admin access required.</div>;

  const p = program;
  const val = (k: keyof Program) => (draft[k] !== undefined ? draft[k] : p?.[k]) as any;
  const set = (k: keyof Program, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = Object.keys(draft).length > 0;
  const acknowledged = !!p?.legal_acknowledged_at;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-[#0cc9a9]" /> Workforce Rewards
          </h1>
          <p className="text-sm text-muted-foreground">
            Hit the target, earn tickets, win the draw. You see counts — never anyone's activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={company ?? undefined} onValueChange={setCompany}>
            <SelectTrigger className="w-[200px]" data-testid="select-rewards-company">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.companyName} value={c.companyName}>{c.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" data-testid="select-rewards-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => evaluate.mutate()}
            disabled={!company || evaluate.isPending}
            data-testid="button-rewards-evaluate"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${evaluate.isPending ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
        </div>
      </div>

      {!acknowledged && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6 flex flex-wrap items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-[260px]">
              <p className="font-medium">Legal and tax position not acknowledged</p>
              <p className="text-sm text-muted-foreground">
                Prizes such as a day off or a voucher can be taxable employee benefits (P11D), and a
                prize draw has its own rules. The employer owns that position, not Meridian.
                No draw will run until someone here acknowledges it. This is not legal advice —
                take your own.
              </p>
            </div>
            <Button
              onClick={() => saveProgram.mutate({ acknowledgeLegal: true })}
              disabled={saveProgram.isPending}
              data-testid="button-acknowledge-legal"
            >
              <Lock className="h-4 w-4 mr-2" /> I acknowledge
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---- Aggregate participation ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Enrolled" icon={Users}
          value={`${participation?.enrolled ?? 0}/${participation?.totalMembers ?? 0}`}
          sub={`${participation?.enrolmentRate ?? 0}% of the team opted in`}
        />
        <Stat
          label="Hit the target" icon={Target}
          value={`${participation?.hitTarget ?? 0}/${participation?.eligible ?? 0}`}
          sub={`${participation?.participationRate ?? 0}% of those taking part`}
        />
        <Stat
          label="Tickets earned" icon={Ticket}
          value={participation?.totalTickets ?? 0}
          sub={`${participation?.projectedWinners ?? 0} winner(s) at current rules`}
        />
        <Stat
          label="Flagged for review" icon={ShieldAlert}
          value={participation?.flaggedForReview ?? 0}
          tone={(participation?.flaggedForReview ?? 0) > 0 ? "text-amber-500" : undefined}
          sub="Held out of the draw until cleared"
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Who isn't in the running, and why</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {participation
              ? `${participation.period} · ${participation.periodStart} to ${participation.periodEnd} · ${participation.daysCounted} days counted · target ${participation.target}`
              : "—"}
          </p>
          {(participation?.ineligibleBreakdown?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              {partLoading ? "Loading…" : "Nobody is excluded this period."}
            </p>
          ) : (
            <div className="space-y-2">
              {participation!.ineligibleBreakdown.map((r) => (
                <div key={r.reason} className="flex items-center justify-between text-sm">
                  <span>{REASON_LABELS[r.reason] || r.reason}</span>
                  <Badge variant="secondary">{r.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Anti-cheat review ---- */}
      {flagged.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> Anti-cheat review ({flagged.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These results contain days well above that person's own normal, or above the daily cap.
              You're ruling on the numbers — no names, no individual activity.
            </p>
            {flagged.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                <div className="text-sm">
                  <span className="font-medium">Result #{f.id}</span>
                  <span className="text-muted-foreground">
                    {" "}· {f.anomaly_days} unusual day(s) · {Math.round(f.avg_steps_per_day).toLocaleString()} avg steps
                    {" "}· {f.days_with_data} days of data · longest gap {f.longest_gap_days}d
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: f.id, decision: "cleared" })}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Allow
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => review.mutate({ id: f.id, decision: "rejected" })}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ---- Draws ---- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Dices className="h-4 w-4" /> Draws</CardTitle>
          <Button
            onClick={() => runDraw.mutate()}
            disabled={!company || !acknowledged || runDraw.isPending}
            data-testid="button-run-draw"
          >
            Run the {period} draw
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            A draw is immutable once run, and every entry, ticket range and the random seed are stored —
            so a disputed result can be recomputed and checked. Last period's winners are excluded.
          </p>
          {draws.length === 0 ? (
            <p className="text-sm text-muted-foreground">No draws yet.</p>
          ) : (
            <div className="space-y-2">
              {draws.map((d) => (
                <div key={d.id} className="border rounded-md p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{d.period_key} — {d.reward_description}</div>
                    <Badge variant="secondary">{d.winners_drawn} winner(s)</Badge>
                  </div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {d.qualifiers} qualifiers · {d.total_tickets} tickets ·
                    {" "}{d.excluded_previous_winners} excluded as previous winners ·
                    {" "}{d.names_released} name(s) released
                  </div>
                  <div className="text-muted-foreground text-xs mt-1 font-mono break-all">
                    {d.algorithm} · seed {d.seed}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Fulfilment ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Fulfilment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            The reward is yours to give, so you approve it here. A winner's name appears only if they
            chose to share it — a winner who declined still gets the prize.
          </p>
          {fulfilments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to fulfil yet.</p>
          ) : (
            <div className="space-y-2">
              {fulfilments.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                  <div className="text-sm">
                    <div className="font-medium">
                      {f.winner_name || (f.declinedIdentity ? "Winner (name withheld)" : "Winner (awaiting their consent)")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {f.period_key} · {f.reward_description}
                      {f.winner_email ? ` · ${f.winner_email}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.status === "fulfilled" ? "default" : "secondary"}>{f.status}</Badge>
                    {f.status === "pending" && (
                      <Button size="sm" onClick={() => setFulfilment.mutate({ id: f.id, status: "approved" })}>Approve</Button>
                    )}
                    {f.status === "approved" && (
                      <Button size="sm" onClick={() => setFulfilment.mutate({ id: f.id, status: "fulfilled" })}>Mark fulfilled</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Programme settings ---- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Programme settings</CardTitle>
          <Button
            onClick={() => saveProgram.mutate(draft)}
            disabled={!dirty || saveProgram.isPending}
            data-testid="button-save-program"
          >
            Save changes
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Daily step target (average)</Label>
              <Input type="number" value={val("target_threshold") ?? ""} data-testid="input-target-threshold"
                onChange={(e) => set("target_threshold", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Averaged across the period.</p>
            </div>
            <div>
              <Label>Tickets per month (max)</Label>
              <Input type="number" value={val("max_tickets_per_period") ?? ""}
                onChange={(e) => set("max_tickets_per_period", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">One per week hit.</p>
            </div>
            <div>
              <Label>Qualifiers per winner</Label>
              <Input type="number" value={val("winners_per_qualifiers") ?? ""}
                onChange={(e) => set("winners_per_qualifiers", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">30 means ~1 winner per 30 qualifiers, minimum 1.</p>
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium">Rewards</p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Weekly perk (optional)</Label>
              <Input value={val("weekly_perk") ?? ""} placeholder="Leave blank for ticket-only"
                onChange={(e) => set("weekly_perk", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Only add one if it fits your culture — free coffee means nothing where coffee is already free.
              </p>
            </div>
            <div>
              <Label>Monthly draw prize</Label>
              <Input value={val("monthly_reward") ?? ""} onChange={(e) => set("monthly_reward", e.target.value)} />
            </div>
            <div>
              <Label>Prize cost (pence)</Label>
              <Input type="number" value={val("reward_cost_pence") ?? ""}
                onChange={(e) => set("reward_cost_pence", e.target.value === "" ? null : Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Used with the budget cap below.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Monthly budget cap (pence)</Label>
              <Input type="number" value={val("budget_cap_pence") ?? ""} placeholder="No cap"
                onChange={(e) => set("budget_cap_pence", e.target.value === "" ? null : Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Caps winners at cap ÷ prize cost. Blank = no ceiling.</p>
            </div>
          </div>

          <Separator />
          <p className="text-sm font-medium">Eligibility and anti-cheat</p>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Daily step cap</Label>
              <Input type="number" value={val("daily_step_cap") ?? ""}
                onChange={(e) => set("daily_step_cap", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Most a single day can contribute.</p>
            </div>
            <div>
              <Label>Minimum days of data</Label>
              <Input type="number" value={val("min_days_for_eligibility") ?? ""}
                onChange={(e) => set("min_days_for_eligibility", Number(e.target.value))} />
            </div>
            <div>
              <Label>Max sync gap (days)</Label>
              <Input type="number" value={val("max_gap_days") ?? ""}
                onChange={(e) => set("max_gap_days", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">A dead device isn't a sedentary month.</p>
            </div>
            <div>
              <Label>Anomaly threshold (SD)</Label>
              <Input type="number" step="0.5" value={val("anomaly_sd_multiplier") ?? ""}
                onChange={(e) => set("anomaly_sd_multiplier", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Flags days above the person's own normal.</p>
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Require explicit rewards consent</Label>
              <p className="text-xs text-muted-foreground">
                Strongly recommended. Rewards need individual tracking, which is a different legal basis
                from the anonymised Wellbeing Index. Turning this off evaluates everyone by default.
              </p>
            </div>
            <Switch checked={val("require_consent") !== false}
              onCheckedChange={(v) => set("require_consent", v)} data-testid="switch-require-consent" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Programme status</Label>
              <p className="text-xs text-muted-foreground">Paused stops evaluation and the nightly job.</p>
            </div>
            <Select value={val("status") ?? "active"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {acknowledged && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Legal and tax position acknowledged {new Date(p!.legal_acknowledged_at!).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
