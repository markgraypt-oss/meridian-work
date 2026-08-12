import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Brain, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, Info, Users } from "lucide-react";

// ---- Types (mirror artifacts/api-server/src/wwiEngine.ts) ----

type WwiState = "empty" | "thin" | "full";
type WwiStatus = "steady" | "mixed" | "strained";
type WwiConfidence = "low" | "medium" | "high";

interface WwiComponent {
  metric: string;
  rawAverage: number;
  lowerIsBetter: boolean;
  contribution: number;
}

interface MentalWellbeingDomain {
  domain: "mental_wellbeing";
  state: WwiState;
  score: number | null;
  status: WwiStatus | null;
  guardApplied: boolean;
  confidence: WwiConfidence | null;
  components: WwiComponent[];
  symptomSignals: {
    anxiousPercent: number | null;
    overwhelmedPercent: number | null;
    fatiguePercent: number | null;
  } | null;
  burnout: {
    reportable: boolean;
    avgScore: number | null;
    previousAvgScore: number | null;
    worsening: boolean | null;
    usersAssessed: number;
    confidence: WwiConfidence;
    riskBands: { optimal: number; mild: number; moderate: number; high: number; severe: number } | null;
    severeTail: number;
    topDrivers: { key: string; label: string; count: number }[];
  } | null;
  divergence: string | null;
  emptyReason: string | null;
  activeContributors: number;
  requiredContributors: number;
}

interface PhysicalStrainDomain {
  domain: "physical_strain";
  state: WwiState;
  score: number | null;
  status: WwiStatus | null;
  confidence: WwiConfidence | null;
  headlineWeight: "modest";
  framing: string;
  contributors: number;
  requiredContributors: number;
  painPrevalencePercent: number | null;
  avgSeverity: number | null;
  worseningPrevalence: boolean | null;
  worseningSeverity: boolean | null;
  components: { metric: string; value: number; contribution: number }[];
  areas: { bodyPart: string; distinctReporters: number; avgSeverity: number }[];
  emptyReason: string | null;
}

interface WwiResponse {
  companyName: string;
  window: string;
  domains: {
    mentalWellbeing: MentalWellbeingDomain;
    physicalStrain: PhysicalStrainDomain;
  };
}

type CompanySummary = {
  companyName: string;
  userCount: number;
  eligible: boolean;
};

// ---- Helpers ----

function humanizeMetric(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: WwiStatus | null): string {
  if (status === "steady") return "text-green-400";
  if (status === "mixed") return "text-amber-400";
  if (status === "strained") return "text-red-400";
  return "text-muted-foreground";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function StateBadge({ state }: { state: WwiState }) {
  const map: Record<WwiState, { label: string; cls: string }> = {
    full: { label: "Full report", cls: "bg-[#0cc9a9]/15 text-[#0cc9a9]" },
    thin: { label: "Limited data", cls: "bg-amber-500/15 text-amber-400" },
    empty: { label: "Not enough data", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[state];
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function StatusBadge({ status }: { status: WwiStatus | null }) {
  if (!status) return null;
  return (
    <span className={`text-xs font-semibold uppercase tracking-wide ${statusColor(status)}`}>
      {status}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: WwiConfidence | null }) {
  if (!confidence) return null;
  const cls =
    confidence === "high" ? "text-green-400" : confidence === "medium" ? "text-[#0cc9a9]" : "text-amber-400";
  return <span className={`text-xs ${cls}`}>{confidence} confidence</span>;
}

function BigScore({ score, label }: { score: number | null; label: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className={`text-4xl font-bold ${scoreColor(score)}`}>
        {score !== null ? score.toFixed(0) : "--"}
      </span>
      <span className="text-sm text-muted-foreground mb-1.5">/ 100 · {label}</span>
    </div>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${warn ? "text-red-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function WorseningPill({ worsening, label }: { worsening: boolean | null; label: string }) {
  if (worsening === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> {label}: no prior data
      </span>
    );
  }
  return worsening ? (
    <span className="inline-flex items-center gap-1 text-xs text-red-400">
      <TrendingUp className="h-3 w-3" /> {label}: worsening
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-green-400">
      <TrendingDown className="h-3 w-3" /> {label}: not worsening
    </span>
  );
}

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : "---";
}

// ---- Domain cards ----

function MentalWellbeingCard({ d }: { d: MentalWellbeingDomain }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#0cc9a9]" />
          <h2 className="text-lg font-semibold text-foreground">Mental Wellbeing</h2>
        </div>
        <StateBadge state={d.state} />
      </div>

      {d.state === "empty" ? (
        <p className="text-sm text-muted-foreground">
          {d.emptyReason ??
            `Not enough data yet. ${d.activeContributors} of ${d.requiredContributors} contributors needed.`}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <BigScore score={d.score} label="felt wellbeing" />
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={d.status} />
              <ConfidenceBadge confidence={d.confidence} />
            </div>
          </div>

          {d.guardApplied && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Status capped by the burnout guard — a severe burnout tail is holding the headline back.</span>
            </div>
          )}

          {d.components.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Score composition</p>
              <div className="space-y-1.5">
                {d.components.map((c) => (
                  <StatRow
                    key={c.metric}
                    label={`${humanizeMetric(c.metric)} (avg ${c.rawAverage.toFixed(1)}${c.lowerIsBetter ? ", lower better" : ""})`}
                    value={`${c.contribution.toFixed(0)} / 100`}
                  />
                ))}
              </div>
            </div>
          )}

          {d.symptomSignals && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Symptom signals <span className="normal-case">(shown as signals, not part of the score)</span>
              </p>
              <div className="space-y-1.5">
                <StatRow label="Feeling anxious" value={pct(d.symptomSignals.anxiousPercent)} />
                <StatRow label="Feeling overwhelmed" value={pct(d.symptomSignals.overwhelmedPercent)} />
                <StatRow label="Fatigue" value={pct(d.symptomSignals.fatiguePercent)} />
              </div>
            </div>
          )}

          {d.burnout && d.burnout.reportable && (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-[#0cc9a9]" />
                <p className="text-sm font-medium text-foreground">Burnout</p>
                <span className="text-xs text-muted-foreground">({d.burnout.usersAssessed} assessed · {d.burnout.confidence} confidence)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <StatRow label="Avg score (lower better)" value={d.burnout.avgScore !== null ? d.burnout.avgScore.toFixed(0) : "---"} />
                <StatRow label="Severe tail (people)" value={String(d.burnout.severeTail)} warn={d.burnout.severeTail > 0} />
              </div>
              <div className="mb-2">
                <WorseningPill worsening={d.burnout.worsening} label="Burnout" />
              </div>
              {d.burnout.riskBands && (
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  <span className="text-green-400">Optimal {d.burnout.riskBands.optimal}</span>
                  <span className="text-muted-foreground">Mild {d.burnout.riskBands.mild}</span>
                  <span className="text-amber-400">Moderate {d.burnout.riskBands.moderate}</span>
                  <span className="text-orange-400">High {d.burnout.riskBands.high}</span>
                  <span className="text-red-400">Severe {d.burnout.riskBands.severe}</span>
                </div>
              )}
              {d.burnout.topDrivers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {d.burnout.topDrivers.map((t) => (
                    <span key={t.key} className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      {t.label} ({t.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {d.divergence && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{d.divergence}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhysicalStrainCard({ d }: { d: PhysicalStrainDomain }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#0cc9a9]" />
          <h2 className="text-lg font-semibold text-foreground">Physical Strain</h2>
        </div>
        <StateBadge state={d.state} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {d.framing} <span className="text-muted-foreground/70">· modest weight in the composite</span>
      </p>

      {d.state === "empty" ? (
        <p className="text-sm text-muted-foreground">
          {d.emptyReason ??
            `Not enough body-map data yet. ${d.contributors} of ${d.requiredContributors} contributors needed.`}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <BigScore score={d.score} label="among contributors" />
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={d.status} />
              <ConfidenceBadge confidence={d.confidence} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {d.contributors} of {d.requiredContributors}+ people logged musculoskeletal data
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatRow label="Pain prevalence" value={pct(d.painPrevalencePercent)} />
            <StatRow label="Avg severity (0-10)" value={d.avgSeverity !== null ? d.avgSeverity.toFixed(1) : "---"} />
          </div>

          <div className="flex flex-wrap gap-3">
            <WorseningPill worsening={d.worseningPrevalence} label="Prevalence" />
            <WorseningPill worsening={d.worseningSeverity} label="Severity" />
          </div>

          {d.areas.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Top areas <span className="normal-case">(≥5 distinct reporters each)</span>
              </p>
              <div className="space-y-1.5">
                {d.areas.map((a) => (
                  <StatRow
                    key={a.bodyPart}
                    label={`${humanizeMetric(a.bodyPart)} · ${a.distinctReporters} reporters`}
                    value={`sev ${a.avgSeverity.toFixed(1)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Page ----

function buildWwiUrl(company: string, timeWindow: string, startDate: string, endDate: string): string {
  const base = `/api/admin/reports/company/${encodeURIComponent(company)}/wwi`;
  if (timeWindow === "custom" && startDate && endDate) {
    return `${base}?startDate=${startDate}&endDate=${endDate}`;
  }
  return `${base}?window=${timeWindow}`;
}

export default function AdminWwi() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<string>("30");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const { data: companies = [], isLoading: companiesLoading } = useQuery<CompanySummary[]>({
    queryKey: ["/api/admin/reports/companies"],
    enabled: !!user,
  });

  const customValid = timeWindow !== "custom" || (!!customStartDate && !!customEndDate);

  const { data, isFetching, error } = useQuery<WwiResponse>({
    queryKey: ["/api/admin/reports/company", selectedCompany, "wwi", timeWindow, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await fetch(buildWwiUrl(selectedCompany!, timeWindow, customStartDate, customEndDate), {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Failed to load (${res.status})`);
      }
      return res.json();
    },
    enabled: !!(user && selectedCompany && customValid),
  });

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Wellbeing Index" onBack={() => navigate("/admin")} />
      <div className="max-w-3xl mx-auto p-4 pt-16 pb-32">
        <p className="text-sm text-muted-foreground mb-4">
          Workforce Wellbeing Index — health domains only, built from the floored reporting engine.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Select value={selectedCompany || ""} onValueChange={(v) => setSelectedCompany(v)}>
            <SelectTrigger className="bg-card border-border text-foreground w-auto max-w-[220px] sm:max-w-[280px]">
              <SelectValue placeholder="Select a company" className="truncate" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {companies.map((c) => (
                <SelectItem key={c.companyName} value={c.companyName} className="text-foreground">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="truncate max-w-[160px]">{c.companyName}</span>
                    <span className="text-xs text-muted-foreground">({c.userCount} users)</span>
                  </span>
                </SelectItem>
              ))}
              {companies.length === 0 && !companiesLoading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No companies found</div>
              )}
            </SelectContent>
          </Select>

          <Select
            value={timeWindow}
            onValueChange={(v) => setTimeWindow(v)}
          >
            <SelectTrigger className="bg-card border-border text-foreground w-auto sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="7" className="text-foreground">Last 7 days</SelectItem>
              <SelectItem value="30" className="text-foreground">Last 30 days</SelectItem>
              <SelectItem value="90" className="text-foreground">Last 90 days</SelectItem>
              <SelectItem value="custom" className="text-foreground">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {timeWindow === "custom" && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={customStartDate}
                max={customEndDate || undefined}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-card border border-border rounded-md px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || undefined}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-card border border-border rounded-md px-2 py-1 text-sm text-foreground"
              />
            </label>
            <span className="text-xs text-muted-foreground">Range must be at least 7 days.</span>
          </div>
        )}

        {!selectedCompany && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Select a company to view its Wellbeing Index.
          </div>
        )}

        {selectedCompany && isFetching && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {selectedCompany && !isFetching && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {(error as Error).message}
          </div>
        )}

        {selectedCompany && !isFetching && !error && data && (
          <div className="space-y-4">
            <MentalWellbeingCard d={data.domains.mentalWellbeing} />
            <PhysicalStrainCard d={data.domains.physicalStrain} />
            <p className="text-xs text-muted-foreground text-center pt-2">
              {data.companyName} · {data.window} window
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
