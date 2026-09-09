import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert, Info, Users, Download,
  Smile, Zap, Flame, Lightbulb, Wind, CloudRain, BatteryLow, Moon, Hand, Briefcase, Bone, CircleAlert, CircleHelp,
  Lock, type LucideIcon,
} from "lucide-react";

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

// ---- Brand + palette ----
// Brass gold is the Meridian brand accent (navy + warm gold); teal is the admin-portal primary.

const GOLD = "#d4a574";
const TEAL = "#0cc9a9";

const GOOD = "#34d399";   // healthy / steady
const WARN = "#fbbf24";   // mixed
const BAD = "#f87171";    // strained

const STATUS_META: Record<WwiStatus, { label: string; color: string; blurb: string }> = {
  steady: { label: "Steady", color: GOOD, blurb: "In the healthy range." },
  mixed: { label: "Mixed", color: WARN, blurb: "Some strain showing — worth watching." },
  strained: { label: "Strained", color: BAD, blurb: "Clear strain across the team — act on it." },
};

const METRIC_META: Record<string, { icon: LucideIcon; color: string; label: string; blurb: string }> = {
  mood: { icon: Smile, color: "#f472b6", label: "Mood", blurb: "How positive people feel" },
  energy: { icon: Zap, color: "#fbbf24", label: "Energy", blurb: "Physical and mental energy" },
  stress: { icon: Flame, color: "#fb923c", label: "Stress", blurb: "Pressure people are under" },
  clarity: { icon: Lightbulb, color: "#60a5fa", label: "Clarity", blurb: "Ability to think clearly and focus" },
};

const BAND_META: { key: "optimal" | "mild" | "moderate" | "high" | "severe"; label: string; color: string }[] = [
  { key: "optimal", label: "Optimal", color: GOOD },
  { key: "mild", label: "Mild", color: "#a3e635" },
  { key: "moderate", label: "Moderate", color: WARN },
  { key: "high", label: "High", color: "#fb923c" },
  { key: "severe", label: "Severe", color: BAD },
];

function driverIcon(key: string, label: string): LucideIcon {
  const k = `${key} ${label}`.toLowerCase();
  if (k.includes("sleep")) return Moon;
  if (k.includes("control")) return Hand;
  if (k.includes("stress")) return Flame;
  if (k.includes("workload") || k.includes("work")) return Briefcase;
  if (k.includes("recovery")) return BatteryLow;
  return CircleAlert;
}

// ---- Helpers ----

function humanizeMetric(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusFromScore(score: number): WwiStatus {
  return score >= 70 ? "steady" : score >= 50 ? "mixed" : "strained";
}

function scoreHex(score: number | null): string {
  if (score === null) return "#94a3b8";
  return STATUS_META[statusFromScore(score)].color;
}

function severityHex(sev: number): string {
  if (sev >= 7) return BAD;
  if (sev >= 4) return "#fb923c";
  return GOOD;
}

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : "—";
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

// ---- Small building blocks ----

function SectionHeading({ title, hint, right, size = "md" }: { title: string; hint?: string; right?: ReactNode; size?: "md" | "sm" }) {
  return (
    <div className={`flex items-end justify-between gap-3 border-b pb-2 ${size === "md" ? "mb-4" : "mb-3"}`} style={{ borderColor: `${GOLD}33` }}>
      <div>
        <h3 className={`font-bold uppercase tracking-[0.14em] ${size === "md" ? "text-[15px]" : "text-xs"}`} style={{ color: GOLD }}>
          {title}
        </h3>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function IconTile({ icon: Icon, color, size = 40 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: `${color}1f`, border: `1px solid ${color}40` }}
    >
      <Icon style={{ color, width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

function StateBadge({ state }: { state: WwiState }) {
  const map: Record<WwiState, { label: string; color: string }> = {
    full: { label: "Full report", color: TEAL },
    thin: { label: "Limited data", color: WARN },
    empty: { label: "Not enough data", color: "#94a3b8" },
  };
  const s = map[state];
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: s.color, background: `${s.color}1f`, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

function StatusPill({ status }: { status: WwiStatus | null }) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide px-3 py-1 rounded-full"
      style={{ color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function ConfidencePill({ confidence }: { confidence: WwiConfidence | null }) {
  if (!confidence) return null;
  const color = confidence === "high" ? GOOD : confidence === "medium" ? TEAL : WARN;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full cursor-help" style={{ color, background: `${color}14`, border: `1px solid ${color}40` }}>
          {confidence} confidence <CircleHelp className="h-3 w-3 opacity-70" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        Confidence reflects how much of the company contributed data in this window. High = 60% or more of staff, medium = 25–60%, low = under 25%.
      </TooltipContent>
    </Tooltip>
  );
}

// Signed change vs the previous window. Values are on a higher-is-healthier scale.
function TrendChip({ current, previous, suffix = "vs last period" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current === null || previous === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
        <Minus className="h-3 w-3" /> first period
      </span>
    );
  }
  const d = Math.round(current - previous);
  if (d === 0) {
    return <span className="inline-flex items-center text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">no change {suffix}</span>;
  }
  const up = d > 0;
  const color = up ? GOOD : BAD;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: `${color}1a` }}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{d} {suffix}
    </span>
  );
}

function WorsePill({ worsening }: { worsening: boolean | null }) {
  if (worsening === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
        <Minus className="h-3 w-3" /> first period
      </span>
    );
  }
  const color = worsening ? BAD : GOOD;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: `${color}1a` }}>
      {worsening ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {worsening ? "worse than last period" : "not worse than last period"}
    </span>
  );
}

// Where a 0-100 score sits across the three status bands.
function ScoreBandBar({ score, color }: { score: number; color: string }) {
  const left = Math.max(0, Math.min(100, score));
  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${BAD} 0%, ${BAD} 50%, ${WARN} 50%, ${WARN} 70%, ${GOOD} 70%, ${GOOD} 100%)`, opacity: 0.9 }}>
        <span
          className="absolute -top-[5px] h-5 w-5 rounded-full border-[3px] border-background shadow-md"
          style={{ left: `calc(${left}% - 10px)`, background: color }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] font-medium text-muted-foreground">
        <span className="absolute left-0">0</span>
        <span className="absolute" style={{ left: "25%", transform: "translateX(-50%)", color: BAD }}>Strained</span>
        <span className="absolute" style={{ left: "50%", transform: "translateX(-50%)" }}>50</span>
        <span className="absolute" style={{ left: "60%", transform: "translateX(-50%)", color: WARN }}>Mixed</span>
        <span className="absolute" style={{ left: "70%", transform: "translateX(-50%)" }}>70</span>
        <span className="absolute" style={{ left: "85%", transform: "translateX(-50%)", color: GOOD }}>Steady</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}

function Headline({
  score, previous, status, confidence, label, explainer,
}: {
  score: number | null; previous?: number | null; status: WwiStatus | null; confidence: WwiConfidence | null; label: string; explainer: string;
}) {
  // The number takes the FINAL rating's colour (after the burnout guard), so it always agrees with the status pill.
  const color = status ? STATUS_META[status].color : scoreHex(score);
  return (
    <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${color}14 0%, transparent 60%)`, border: `1px solid ${color}33` }}>
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-extrabold tracking-tight leading-none" style={{ color }}>
              {score !== null ? score.toFixed(0) : "—"}
            </span>
            <span className="text-lg text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <ConfidencePill confidence={confidence} />
            {previous !== undefined && <TrendChip current={score} previous={previous ?? null} />}
          </div>
          <p className="text-sm text-foreground/80 mt-2.5 leading-relaxed">{explainer}</p>
          {score !== null && <ScoreBandBar score={score} color={color} />}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label, value, unit, sub, color, children, icon: Icon,
}: {
  label: string; value: string; unit?: string; sub?: string; color?: string; children?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl bg-background border border-border p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: color ?? TEAL }} />}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold leading-none" style={{ color: color ?? "var(--foreground)" }}>{value}</span>
        {unit && <span className="text-sm text-muted-foreground font-medium">{unit}</span>}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}

function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full rounded-full bg-muted overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function EmptyDomain({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed border-border bg-background p-5">
      <IconTile icon={Icon} color="#94a3b8" />
      <div>
        <p className="text-sm font-semibold text-foreground">Not enough data to report yet</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// ---- Mental Wellbeing ----

function GuardNotice({ d }: { d: MentalWellbeingDomain }) {
  const rb = d.burnout?.riskBands;
  if (!d.guardApplied || d.score === null || !d.status || !rb) return null;
  const rawStatus = statusFromScore(d.score);
  const rawLabel = STATUS_META[rawStatus].label;
  const finalLabel = STATUS_META[d.status].label;
  const cause = rb.severe > 0
    ? `${people(rb.severe)} ${rb.severe === 1 ? "is" : "are"} in the severe burnout band`
    : `${people(rb.high)} ${rb.high === 1 ? "is" : "are"} in the high burnout band`;
  const cap = rb.severe > 0 ? "Strained" : "Mixed";
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3.5" style={{ background: `${WARN}14`, border: `1px solid ${WARN}4d` }}>
      <IconTile icon={AlertTriangle} color={WARN} size={36} />
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: WARN }}>
          Why this is rated {finalLabel}, not {rawLabel}
        </p>
        <p className="text-sm text-foreground/85 mt-1 leading-relaxed">
          On the wellbeing score alone this team would read <strong>{rawLabel}</strong>. But {cause}, and the rating is capped at{" "}
          <strong>{cap}</strong> while anyone sits there — a cluster of people at serious risk outweighs a decent average. Bring
          those people down a band and the rating follows.
        </p>
      </div>
    </div>
  );
}

function CompositionRow({ c }: { c: WwiComponent }) {
  const meta = METRIC_META[c.metric] ?? { icon: Activity, color: TEAL, label: humanizeMetric(c.metric), blurb: "" };
  const color = scoreHex(c.contribution);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl bg-background border border-border px-4 py-3">
      <IconTile icon={meta.icon} color={meta.color} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-foreground">{meta.label}</span>
          {meta.blurb && <span className="text-xs text-muted-foreground">{meta.blurb}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Team average <span className="text-foreground/80 font-medium">{c.rawAverage.toFixed(1)}</span> out of 5
          {c.lowerIsBetter && <span> · lower is better</span>}
        </p>
        <div className="mt-2 max-w-md"><Bar value={c.contribution} color={color} height={6} /></div>
      </div>
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-2xl font-extrabold leading-none" style={{ color }}>{c.contribution.toFixed(0)}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <div className="mt-1.5"><TrendChip current={c.contribution} previous={c.previousContribution} suffix="" /></div>
      </div>
    </div>
  );
}

function SignalTile({ icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-background border border-border p-4 flex items-center gap-3">
      <IconTile icon={icon} color={color} size={44} />
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none text-foreground">{pct(value)}</p>
        <p className="text-sm font-medium text-foreground mt-1">{label}</p>
        <p className="text-xs text-muted-foreground">of check-ins</p>
      </div>
    </div>
  );
}

function BurnoutBlock({ b }: { b: NonNullable<MentalWellbeingDomain["burnout"]> }) {
  const rb = b.riskBands;
  const total = rb ? Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe) : 1;
  const avgColor = b.avgScore === null ? "#94a3b8" : b.avgScore >= 60 ? BAD : b.avgScore >= 40 ? WARN : GOOD;
  return (
    <div className="rounded-2xl p-5" style={{ background: "linear-gradient(180deg, rgba(212,165,116,0.06) 0%, transparent 100%)", border: `1px solid ${GOLD}33` }}>
      <SectionHeading
        title="Burnout Index"
        hint="Structural burnout risk from the monthly assessment. Reported separately so the same distress isn't counted twice."
        right={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2.5 py-1 rounded-full bg-muted">
            <Users className="h-3.5 w-3.5" /> {b.usersAssessed} assessed · <span style={{ color: b.confidence === "high" ? GOOD : b.confidence === "medium" ? TEAL : WARN }}>{b.confidence} confidence</span>
          </span>
        }
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <StatTile
          icon={ShieldAlert}
          label="Average burnout score"
          value={b.avgScore !== null ? b.avgScore.toFixed(0) : "—"}
          unit="/ 100"
          sub="Lower is better"
          color={avgColor}
        >
          <div><WorsePill worsening={b.worsening} /></div>
        </StatTile>
        <StatTile
          icon={AlertTriangle}
          label="People at high or severe risk"
          value={String(b.severeTail)}
          unit={`of ${b.usersAssessed}`}
          sub={b.severeTail > 0 ? "These are the people holding the rating down." : "Nobody in the top two risk bands."}
          color={b.severeTail > 0 ? BAD : GOOD}
        />
      </div>

      {rb && (
        <div className="mt-5">
          <SectionHeading size="sm" title="Risk distribution" hint="How many people sit in each burnout band" />
          <div className="flex h-7 rounded-lg overflow-hidden bg-muted">
            {BAND_META.map((bm) => {
              const n = rb[bm.key];
              if (n <= 0) return null;
              return (
                <div
                  key={bm.key}
                  className="flex items-center justify-center text-xs font-bold text-black/80"
                  style={{ width: `${(n / total) * 100}%`, background: bm.color, minWidth: 22 }}
                  title={`${bm.label}: ${n}`}
                >
                  {n}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {BAND_META.map((bm) => (
              <div key={bm.key} className="rounded-lg bg-background border border-border px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: bm.color }} />
                  <span className="text-lg font-extrabold leading-none" style={{ color: bm.color }}>{rb[bm.key]}</span>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mt-1">{bm.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {b.topDrivers.length > 0 && (
        <div className="mt-5">
          <SectionHeading size="sm" title="What's driving it" hint="Number of people reporting each driver" />
          <div className="flex flex-wrap gap-2">
            {b.topDrivers.map((t) => {
              const Icon = driverIcon(t.key, t.label);
              return (
                <span key={t.key} className="inline-flex items-center gap-2 rounded-full bg-background border border-border pl-2.5 pr-1.5 py-1.5">
                  <Icon className="h-4 w-4" style={{ color: GOLD }} />
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                  <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ color: GOLD, background: `${GOLD}26` }}>{t.count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MentalWellbeingCard({ d }: { d: MentalWellbeingDomain }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={Brain} color={TEAL} size={44} />
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">Mental Wellbeing</h2>
            <p className="text-sm text-muted-foreground">How the team says it feels, from daily check-ins</p>
          </div>
        </div>
        <StateBadge state={d.state} />
      </header>

      {d.state === "empty" ? (
        <EmptyDomain
          icon={Brain}
          message={d.emptyReason ?? `${d.activeContributors} of ${d.requiredContributors} contributors needed before this can be reported.`}
        />
      ) : (
        <>
          <Headline
            label="Wellbeing score"
            score={d.score}
            previous={d.previousScore}
            status={d.status}
            confidence={d.confidence}
            explainer="The average of how people rate their mood, energy, stress and clarity in check-ins. Higher is healthier. Burnout is assessed separately below and is not part of this number."
          />

          <GuardNotice d={d} />

          {d.components.length > 0 && (
            <div>
              <SectionHeading title="What makes up the score" hint="Each check-in question, converted to a 0–100 health score. The four are averaged equally." />
              <div className="space-y-2">
                {d.components.map((c) => <CompositionRow key={c.metric} c={c} />)}
              </div>
            </div>
          )}

          {d.symptomSignals && (
            <div>
              <SectionHeading title="Symptom signals" hint="How often people ticked these in check-ins. Shown as early-warning signals — they don't feed the score." />
              <div className="grid sm:grid-cols-3 gap-3">
                <SignalTile icon={Wind} color="#a78bfa" label="Feeling anxious" value={d.symptomSignals.anxiousPercent} />
                <SignalTile icon={CloudRain} color="#38bdf8" label="Feeling overwhelmed" value={d.symptomSignals.overwhelmedPercent} />
                <SignalTile icon={BatteryLow} color="#fb923c" label="Fatigue" value={d.symptomSignals.fatiguePercent} />
              </div>
            </div>
          )}

          {d.burnout && d.burnout.reportable && <BurnoutBlock b={d.burnout} />}

          {d.burnout && !d.burnout.reportable && (
            <div className="flex items-start gap-3 rounded-xl bg-background border border-border px-4 py-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: TEAL }} />
              <span>Burnout isn't reported yet — only {people(d.burnout.usersAssessed)} completed the assessment in this window, which is below the anonymity floor.</span>
            </div>
          )}

          {d.divergence && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: `${TEAL}0f`, border: `1px solid ${TEAL}33` }}>
              <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: TEAL }} />
              <span className="text-foreground/85">{d.divergence}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---- Physical Strain ----

function AreaRow({ a }: { a: PhysicalStrainDomain["areas"][number] }) {
  const color = severityHex(a.avgSeverity);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl bg-background border border-border px-4 py-3">
      <IconTile icon={Bone} color={color} />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-foreground">{humanizeMetric(a.bodyPart)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{people(a.distinctReporters)} reported pain here</p>
        <div className="mt-2 max-w-md"><Bar value={a.avgSeverity * 10} color={color} height={6} /></div>
      </div>
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-2xl font-extrabold leading-none" style={{ color }}>{a.avgSeverity.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">/ 10</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">avg severity</p>
      </div>
    </div>
  );
}

function PhysicalStrainCard({ d }: { d: PhysicalStrainDomain }) {
  const prevColor = d.painPrevalencePercent === null ? "#94a3b8" : d.painPrevalencePercent >= 50 ? BAD : d.painPrevalencePercent >= 25 ? WARN : GOOD;
  const sevColor = d.avgSeverity === null ? "#94a3b8" : severityHex(d.avgSeverity);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon={Activity} color={TEAL} size={44} />
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">Physical Strain</h2>
            <p className="text-sm text-muted-foreground">Aches and pain among staff who log body-map data — not the whole workforce</p>
          </div>
        </div>
        <StateBadge state={d.state} />
      </header>

      {d.state === "empty" ? (
        <EmptyDomain
          icon={Activity}
          message={d.emptyReason ?? `${d.contributors} of ${d.requiredContributors} people need to log body-map data before this can be reported.`}
        />
      ) : (
        <>
          <Headline
            label="Physical strain score"
            score={d.score}
            status={d.status}
            confidence={d.confidence}
            explainer="Built from how many contributors report pain and how severe it is. Higher is healthier. This carries a modest weight in the overall picture because it only covers people who log body-map data."
          />

          <div className="inline-flex items-center gap-2 text-sm text-foreground/85 rounded-full bg-background border border-border px-3 py-1.5">
            <Users className="h-4 w-4" style={{ color: TEAL }} />
            <span><strong>{d.contributors}</strong> people logged body-map data <span className="text-muted-foreground">({d.requiredContributors}+ needed to report)</span></span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <StatTile
              icon={Hand}
              label="Pain prevalence"
              value={pct(d.painPrevalencePercent)}
              sub="of contributors reported pain"
              color={prevColor}
            >
              <Bar value={d.painPrevalencePercent ?? 0} color={prevColor} height={6} />
              <div><WorsePill worsening={d.worseningPrevalence} /></div>
            </StatTile>
            <StatTile
              icon={Flame}
              label="Average severity"
              value={d.avgSeverity !== null ? d.avgSeverity.toFixed(1) : "—"}
              unit="/ 10"
              sub="among those reporting pain"
              color={sevColor}
            >
              <Bar value={(d.avgSeverity ?? 0) * 10} color={sevColor} height={6} />
              <div><WorsePill worsening={d.worseningSeverity} /></div>
            </StatTile>
          </div>

          {d.areas.length > 0 && (
            <div>
              <SectionHeading title="Where it hurts" hint="Only areas with 5 or more separate reporters are shown, so nobody can be singled out." />
              <div className="space-y-2">
                {d.areas.map((a) => <AreaRow key={a.bodyPart} a={a} />)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
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
  if (cur === null || prev === null) return '<span style="color:#7c8b88;font-size:11px">first period</span>';
  const d = Math.round(cur - prev);
  if (d === 0) return '<span style="color:#7c8b88;font-size:11px">no change vs prev</span>';
  const up = d > 0;
  return `<span style="color:${up ? "#2f9e6f" : "#d9484b"};font-size:11px;font-weight:700">${up ? "▲ +" : "▼ "}${d} vs prev</span>`;
}

function bar(widthPct: number, color: string): string {
  const w = Math.max(0, Math.min(100, widthPct));
  return `<div style="height:8px;border-radius:6px;background:#eef2f1;overflow:hidden;width:120px"><span style="display:block;height:100%;width:${w}%;background:${color};border-radius:6px"></span></div>`;
}

function guardCopy(m: MentalWellbeingDomain): string {
  const rb = m.burnout?.riskBands;
  if (!m.guardApplied || m.score === null || !m.status || !rb) return "";
  const rawLabel = STATUS_META[statusFromScore(m.score)].label;
  const finalLabel = STATUS_META[m.status].label;
  const cause = rb.severe > 0 ? `${people(rb.severe)} in the severe burnout band` : `${people(rb.high)} in the high burnout band`;
  return `Rated ${finalLabel} rather than ${rawLabel}: the wellbeing score alone would read ${rawLabel}, but with ${cause} the rating is capped — a cluster at serious risk outweighs a decent average.`;
}

function buildReportHtml(data: WwiResponse, windowLabel: string, dateStr: string): string {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const company = escapeHtml(data.companyName);
  const strainCol = (v: number) => (v >= 60 ? "#e07a3a" : v >= 40 ? "#e0a63a" : "#2f9e6f");
  const h = (t: string, extra = "") => `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#b8895a;margin:18px 0 6px;font-weight:800">${t}${extra}</div>`;

  const rowGrid = (left: string, mid: string, right: string) =>
    `<div style="display:grid;grid-template-columns:1fr 120px 150px;align-items:center;gap:14px;padding:9px 0;border-top:1px solid #e5eae8">
      <div style="font-size:14px;color:#12211f">${left}</div><div>${mid}</div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">${right}</div></div>`;

  let mentalHtml = "";
  if (m.state === "empty") {
    mentalHtml = `<p style="color:#7c8b88;font-size:13px">${escapeHtml(m.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const comp = m.components.map((c) => {
      const label = `${escapeHtml(METRIC_META[c.metric]?.label ?? humanizeMetric(c.metric))} <span style="color:#7c8b88;font-size:12px">team avg ${c.rawAverage.toFixed(1)} / 5${c.lowerIsBetter ? " · lower better" : ""}</span>`;
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
        ${h(`Burnout Index · ${b.usersAssessed} assessed`)}
        <div style="display:flex;gap:26px;margin-bottom:10px">
          <div><div style="font-size:11px;color:#7c8b88">Average score · lower better</div><div style="font-size:20px;font-weight:800">${b.avgScore !== null ? b.avgScore.toFixed(0) : "—"}</div></div>
          <div><div style="font-size:11px;color:#7c8b88">People at high or severe risk</div><div style="font-size:20px;font-weight:800;color:#d9484b">${b.severeTail} of ${b.usersAssessed}</div></div>
        </div>
        <div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:8px">${seg(rb.optimal, "#2f9e6f", "Optimal")}${seg(rb.mild, "#8bbf5a", "Mild")}${seg(rb.moderate, "#e0a63a", "Moderate")}${seg(rb.high, "#e07a3a", "High")}${seg(rb.severe, "#d9484b", "Severe")}</div>
        <div style="font-size:11.5px;color:#3f524f;margin-bottom:10px">Optimal ${rb.optimal} · Mild ${rb.mild} · Moderate ${rb.moderate} · High ${rb.high} · Severe ${rb.severe}</div>
        <div style="font-size:11px;color:#7c8b88;margin-bottom:6px">What's driving it (people reporting each)</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${chips}</div></div>`;
    }
    const gc = guardCopy(m);
    const guard = gc ? `<div style="background:#fff6e8;color:#9a6a12;border:1px solid #f3e2c0;border-radius:9px;padding:9px 12px;font-size:12.5px;margin:10px 0">⚠ ${escapeHtml(gc)}</div>` : "";
    mentalHtml = `
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:40px;font-weight:800;color:#0b6f66">${m.score !== null ? m.score.toFixed(0) : "—"}</span><span style="color:#7c8b88;font-size:14px">/ 100 · wellbeing score</span><span style="margin-left:auto;text-align:right"><div style="font-weight:800;color:#e07a3a;font-size:14px">${(m.status || "").toUpperCase()}</div><div style="font-size:12px">${deltaChip(m.score, m.previousScore)}</div></span></div>
      <p style="color:#7c8b88;font-size:12px;margin:0 0 4px">The average of how people rate their mood, energy, stress and clarity in check-ins. Higher is healthier. Burnout is assessed separately.</p>
      ${guard}
      ${h("What makes up the score")}${comp}
      ${h("Symptom signals", ' <span style="text-transform:none;font-weight:400">(early-warning signals — not part of the score)</span>')}${sig}
      ${burn}`;
  }

  let physHtml = "";
  if (p.state === "empty") {
    physHtml = `<p style="color:#7c8b88;font-size:13px">${escapeHtml(p.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const areas = p.areas.map((a) => rowGrid(`${escapeHtml(humanizeMetric(a.bodyPart))} <span style="color:#7c8b88;font-size:12px">${a.distinctReporters} people</span>`, bar(a.avgSeverity * 10, strainCol(a.avgSeverity * 10)), `<span style="font-weight:700">${a.avgSeverity.toFixed(1)} / 10</span>`)).join("");
    const worse = (b: boolean | null) => b === null ? '<span style="color:#7c8b88">first period</span>' : b ? '<span style="color:#d9484b;font-weight:700">↑ worse than last period</span>' : '<span style="color:#2f9e6f;font-weight:700">not worse than last period</span>';
    physHtml = `
      <p style="color:#7c8b88;font-size:12.5px;margin:0 0 2px">${escapeHtml(p.framing)} Modest weight in the overall picture.</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:40px;font-weight:800;color:#0b6f66">${p.score !== null ? p.score.toFixed(0) : "—"}</span><span style="color:#7c8b88;font-size:14px">/ 100 · physical strain score</span><span style="margin-left:auto;font-weight:800;color:#e07a3a;font-size:14px">${(p.status || "").toUpperCase()}</span></div>
      <p style="color:#7c8b88;font-size:12.5px">👥 ${p.contributors} people logged body-map data (${p.requiredContributors}+ needed to report)</p>
      ${rowGrid("Pain prevalence · " + worse(p.worseningPrevalence), bar(p.painPrevalencePercent || 0, "#e07a3a"), `<span style="font-weight:700">${p.painPrevalencePercent !== null ? p.painPrevalencePercent.toFixed(1) + "%" : "—"}</span>`)}
      ${rowGrid("Average severity (0–10) · " + worse(p.worseningSeverity), bar((p.avgSeverity || 0) * 10, "#e0a63a"), `<span style="font-weight:700">${p.avgSeverity !== null ? p.avgSeverity.toFixed(1) : "—"}</span>`)}
      ${h("Where it hurts", ' <span style="text-transform:none;font-weight:400">(areas with 5+ separate reporters)</span>')}${areas}`;
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

  const selectedSummary = companies.find((c) => c.companyName === selectedCompany);

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Wellbeing Index" onBack={() => navigate("/admin")} />
      <div className="max-w-4xl mx-auto p-4 pt-16 pb-32">
        {/* Page banner */}
        <div
          className="rounded-2xl p-5 sm:p-6 mb-5 relative overflow-hidden"
          style={{ background: `linear-gradient(120deg, ${TEAL}1f 0%, #141920 55%, ${GOLD}14 100%)`, border: `1px solid ${TEAL}33` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] mb-1" style={{ color: GOLD }}>Meridian · Analytics</p>
              <h1 className="text-2xl font-extrabold text-foreground leading-tight">Workforce Wellbeing Index</h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
                Team-level health signals, built only from wellbeing data. Every figure sits above an anonymity floor, so no individual is ever identifiable.
              </p>
            </div>
            {data && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 border border-border px-2.5 py-1 text-foreground/90">
                  <Users className="h-3.5 w-3.5" style={{ color: TEAL }} /> {data.companyName}{selectedSummary ? ` · ${selectedSummary.userCount} people` : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 border border-border px-2.5 py-1 text-foreground/90">
                  <Lock className="h-3.5 w-3.5" style={{ color: GOLD }} /> anonymised · {data.window} window
                </span>
              </div>
            )}
          </div>
        </div>

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
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors sm:ml-auto text-black"
              style={{ background: TEAL }}
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
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto mb-3 w-fit"><IconTile icon={Brain} color={TEAL} size={48} /></div>
            <p className="text-sm font-semibold text-foreground">Select a company to view its Wellbeing Index</p>
            <p className="text-xs text-muted-foreground mt-1">Mental wellbeing, burnout risk and physical strain, reported at team level.</p>
          </div>
        )}

        {selectedCompany && isFetching && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {selectedCompany && !isFetching && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {(error as Error).message}
          </div>
        )}

        {selectedCompany && !isFetching && !error && data && (
          <div className="space-y-5">
            <MentalWellbeingCard d={data.domains.mentalWellbeing} />
            <PhysicalStrainCard d={data.domains.physicalStrain} />
            <p className="text-xs text-muted-foreground text-center pt-2">
              {data.companyName} · {data.window} window · figures aggregated above the anonymity floor
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
