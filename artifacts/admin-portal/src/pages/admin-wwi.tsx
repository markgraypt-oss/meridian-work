import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Brain, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, Info, Users, Download } from "lucide-react";

// ---- Types (mirror artifacts/api-server/src/wwiEngine.ts) ----

type WwiState = "empty" | "thin" | "full";
type WwiStatus = "steady" | "mixed" | "strained";
type WwiConfidence = "low" | "medium" | "high";
type TrendDirection = "improving" | "stable" | "declining";

interface WwiComponent {
  metric: string;
  rawAverage: number;
  lowerIsBetter: boolean;
  contribution: number;
  previousContribution: number | null;
  trend: TrendDirection | null;
}

interface MentalWellbeingDomain {
  domain: "mental_wellbeing";
  state: WwiState;
  score: number | null;
  previousScore: number | null;
  scoreTrend: TrendDirection | null;
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

// Signed change vs the previous window. `current`/`previous` are on a scale where
// higher is healthier, so a positive delta is good (green).
function Delta({ current, previous, suffix = "vs prev" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current === null || previous === null) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> no prior data</span>;
  }
  const d = Math.round(current - previous);
  if (d === 0) return <span className="text-xs text-muted-foreground">±0 {suffix}</span>;
  const up = d > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{d} {suffix}
    </span>
  );
}

function BigScore({ score, previous, label }: { score: number | null; previous?: number | null; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${scoreColor(score)}`}>
          {score !== null ? score.toFixed(0) : "--"}
        </span>
        <span className="text-sm text-muted-foreground mb-1.5">/ 100 · {label}</span>
      </div>
      {previous !== undefined && <Delta current={score} previous={previous ?? null} suffix="vs last period" />}
    </div>
  );
}

function StatRow({ label, value, warn, current, previous }: { label: string; value: string; warn?: boolean; current?: number | null; previous?: number | null }) {
  const showDelta = current !== undefined && previous !== undefined;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3">
        {showDelta && <Delta current={current ?? null} previous={previous ?? null} />}
        <span className={`text-sm font-semibold ${warn ? "text-red-400" : "text-foreground"}`}>{value}</span>
      </span>
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
            <BigScore score={d.score} previous={d.previousScore} label="felt wellbeing" />
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
                    current={c.contribution}
                    previous={c.previousContribution}
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

// ---- Printable / PDF report ----

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function deltaChip(cur: number | null, prev: number | null): string {
  if (cur === null || prev === null) return '<span style="color:#7c8b88;font-size:11px">no prior data</span>';
  const d = Math.round(cur - prev);
  if (d === 0) return '<span style="color:#7c8b88;font-size:11px">±0 vs prev</span>';
  const up = d > 0;
  return `<span style="color:${up ? "#2f9e6f" : "#d9484b"};font-size:11px;font-weight:700">${up ? "▲ +" : "▼ "}${d} vs prev</span>`;
}

function bar(widthPct: number, color: string): string {
  const w = Math.max(0, Math.min(100, widthPct));
  return `<div style="height:8px;border-radius:6px;background:#eef2f1;overflow:hidden;width:120px"><span style="display:block;height:100%;width:${w}%;background:${color};border-radius:6px"></span></div>`;
}

function buildReportHtml(data: WwiResponse, windowLabel: string, dateStr: string): string {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const company = escapeHtml(data.companyName);
  const strainCol = (v: number) => (v >= 60 ? "#e07a3a" : v >= 40 ? "#e0a63a" : "#2f9e6f");

  const rowGrid = (left: string, mid: string, right: string) =>
    `<div style="display:grid;grid-template-columns:1fr 120px 150px;align-items:center;gap:14px;padding:9px 0;border-top:1px solid #e5eae8">
      <div style="font-size:14px;color:#12211f">${left}</div><div>${mid}</div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">${right}</div></div>`;

  let mentalHtml = "";
  if (m.state === "empty") {
    mentalHtml = `<p style="color:#7c8b88;font-size:13px">${escapeHtml(m.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const comp = m.components.map((c) => {
      const label = `${escapeHtml(humanizeMetric(c.metric))} <span style="color:#7c8b88;font-size:12px">avg ${c.rawAverage.toFixed(1)}${c.lowerIsBetter ? " · lower better" : ""}</span>`;
      const val = `<span style="font-weight:700">${c.contribution.toFixed(0)} / 100</span>${deltaChip(c.contribution, c.previousContribution)}`;
      return rowGrid(label, bar(c.contribution, "#0f9d8f"), val);
    }).join("");
    const ss = m.symptomSignals;
    const sig = ss ? [["Feeling anxious", ss.anxiousPercent], ["Feeling overwhelmed", ss.overwhelmedPercent], ["Fatigue", ss.fatiguePercent]]
      .map(([l, v]) => rowGrid(l as string, "", `<span style="font-weight:700">${v !== null ? (v as number).toFixed(1) + "%" : "—"}</span>`)).join("") : "";
    let burn = "";
    if (m.burnout && m.burnout.reportable && m.burnout.riskBands) {
      const b = m.burnout; const rb = b.riskBands!;
      const total = Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe);
      const seg = (n: number, c: string, lbl: string) => n > 0 ? `<span style="display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;width:${(n / total) * 100}%;background:${c}" title="${lbl}">${n}</span>` : "";
      const chips = b.topDrivers.map((t) => `<span style="background:#eef4f3;border:1px solid #e5eae8;border-radius:999px;padding:4px 11px;font-size:12px;color:#3f524f">${escapeHtml(t.label)} <b style="color:#12211f">${t.count}</b></span>`).join("");
      burn = `<div style="background:#f6f9f8;border-radius:11px;padding:16px;margin-top:8px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#7c8b88;font-weight:700;margin-bottom:10px">Burnout · ${b.usersAssessed} assessed</div>
        <div style="display:flex;gap:26px;margin-bottom:10px">
          <div><div style="font-size:11px;color:#7c8b88">Avg score · lower better</div><div style="font-size:20px;font-weight:800">${b.avgScore !== null ? b.avgScore.toFixed(0) : "—"}</div></div>
          <div><div style="font-size:11px;color:#7c8b88">Severe tail</div><div style="font-size:20px;font-weight:800;color:#d9484b">${b.severeTail} people</div></div>
        </div>
        <div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:8px">${seg(rb.optimal, "#2f9e6f", "Optimal")}${seg(rb.mild, "#8bbf5a", "Mild")}${seg(rb.moderate, "#e0a63a", "Moderate")}${seg(rb.high, "#e07a3a", "High")}${seg(rb.severe, "#d9484b", "Severe")}</div>
        <div style="font-size:11.5px;color:#3f524f;margin-bottom:10px">Optimal ${rb.optimal} · Mild ${rb.mild} · Moderate ${rb.moderate} · High ${rb.high} · Severe ${rb.severe}</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${chips}</div></div>`;
    }
    const guard = m.guardApplied ? `<div style="background:#fff6e8;color:#9a6a12;border:1px solid #f3e2c0;border-radius:9px;padding:9px 12px;font-size:12.5px;margin:10px 0">⚠ Status capped by the burnout guard — a severe burnout tail is holding the headline back.</div>` : "";
    mentalHtml = `
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:40px;font-weight:800;color:#0b6f66">${m.score !== null ? m.score.toFixed(0) : "—"}</span><span style="color:#7c8b88;font-size:14px">/ 100 · felt wellbeing</span><span style="margin-left:auto;text-align:right"><div style="font-weight:800;color:#e07a3a;font-size:14px">${(m.status || "").toUpperCase()}</div><div style="font-size:12px">${deltaChip(m.score, m.previousScore)}</div></span></div>
      ${guard}
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#7c8b88;margin:18px 0 6px;font-weight:700">Score composition</div>${comp}
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#7c8b88;margin:18px 0 6px;font-weight:700">Symptom signals</div>${sig}
      ${burn}`;
  }

  let physHtml = "";
  if (p.state === "empty") {
    physHtml = `<p style="color:#7c8b88;font-size:13px">${escapeHtml(p.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const areas = p.areas.map((a) => rowGrid(`${escapeHtml(humanizeMetric(a.bodyPart))} <span style="color:#7c8b88;font-size:12px">${a.distinctReporters} reporters</span>`, bar(a.avgSeverity * 10, strainCol(a.avgSeverity * 10)), `<span style="font-weight:700">sev ${a.avgSeverity.toFixed(1)}</span>`)).join("");
    const worse = (b: boolean | null) => b === null ? '<span style="color:#7c8b88">no prior</span>' : b ? '<span style="color:#d9484b;font-weight:700">↑ worsening</span>' : '<span style="color:#2f9e6f;font-weight:700">not worsening</span>';
    physHtml = `
      <p style="color:#7c8b88;font-size:12.5px;margin:0 0 2px">${escapeHtml(p.framing)} · modest weight in the composite</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:40px;font-weight:800;color:#0b6f66">${p.score !== null ? p.score.toFixed(0) : "—"}</span><span style="color:#7c8b88;font-size:14px">/ 100 · among contributors</span><span style="margin-left:auto;font-weight:800;color:#e07a3a;font-size:14px">${(p.status || "").toUpperCase()}</span></div>
      <p style="color:#7c8b88;font-size:12.5px">👥 ${p.contributors} of ${p.requiredContributors}+ people logged musculoskeletal data</p>
      ${rowGrid("Pain prevalence · " + worse(p.worseningPrevalence), bar(p.painPrevalencePercent || 0, "#e07a3a"), `<span style="font-weight:700">${p.painPrevalencePercent !== null ? p.painPrevalencePercent.toFixed(1) + "%" : "—"}</span>`)}
      ${rowGrid("Average severity (0–10) · " + worse(p.worseningSeverity), bar((p.avgSeverity || 0) * 10, "#e0a63a"), `<span style="font-weight:700">${p.avgSeverity !== null ? p.avgSeverity.toFixed(1) : "—"}</span>`)}
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#7c8b88;margin:18px 0 6px;font-weight:700">Top strain areas <span style="text-transform:none;font-weight:400">(≥5 distinct reporters each)</span></div>${areas}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wellbeing Index — ${company}</title>
<style>@page{margin:14mm} body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;color:#12211f;margin:0;line-height:1.5}
.card{border:1px solid #e5eae8;border-radius:14px;padding:20px 22px;margin:0 0 18px;break-inside:avoid}
.h1{font-size:17px;font-weight:700;margin:0 0 4px}</style></head>
<body>
<div style="background:linear-gradient(135deg,#0f9d8f,#0b6f66);color:#fff;padding:24px 26px;border-radius:14px;margin-bottom:18px">
  <div style="font-weight:700;font-size:15px">◈ Meridian</div>
  <div style="font-size:22px;font-weight:700;margin-top:8px">Workforce Wellbeing Index</div>
  <div style="opacity:.9;font-size:13px;margin-top:8px">${company} · ${escapeHtml(windowLabel)} · generated ${escapeHtml(dateStr)}</div>
</div>
<div class="card"><div class="h1">🧠 Mental Wellbeing</div>${mentalHtml}</div>
<div class="card"><div class="h1">💪 Physical Strain</div>${physHtml}</div>
<p style="color:#7c8b88;font-size:11px">Figures are aggregated across the anonymity floor (≥10 contributors) and contain no individually identifiable information.</p>
</body></html>`;
}

function downloadReport(data: WwiResponse, windowLabel: string) {
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const html = buildReportHtml(data, windowLabel, dateStr);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 350);
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
  const windowLabel =
    timeWindow === "custom" ? `${customStartDate} to ${customEndDate}` :
    timeWindow === "7" ? "Last 7 days" :
    timeWindow === "90" ? "Last 90 days" : "Last 30 days";

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

          {data && !isFetching && !error && (
            <button
              onClick={() => downloadReport(data, windowLabel)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[#0cc9a9]/15 text-[#0cc9a9] text-sm font-medium hover:bg-[#0cc9a9]/25 transition-colors sm:ml-auto"
              title="Open a printable report — use your browser's Save as PDF"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          )}
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
