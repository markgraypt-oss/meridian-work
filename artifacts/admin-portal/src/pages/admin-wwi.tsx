import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as ChartTooltip,
} from "recharts";
import {
  Brain, Activity, TrendingUp, TrendingDown, Minus, Info, Users, Download,
  Smile, Zap, Flame, Lightbulb, Wind, CloudRain, BatteryLow, Moon, Hand, Briefcase, Bone, CircleAlert, CircleHelp,
  Lock, Building2, Presentation, X, type LucideIcon,
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

// Server domain is still called physical_strain. The score is higher-is-healthier, so the
// page labels it "Physical health". Calculation is unchanged.
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

// Shape of /api/admin/companies rows we care about (client logo uploaded in Company Management).
type CompanyRecord = {
  id: number;
  name: string;
  logoUrl: string | null;
};

type TrendPoint = { label: string; score: number | null };

// ---- Brand palette (matches the meridian.work V8 site) ----
// Cream canvas, white cards, navy ink, copper as the single accent.
// Status colours only appear as small dots and change labels.

const NAVY = "#111d2e";
const COPPER = "#a8743c";       // copper dark enough for text on cream/white
const COPPER_SOFT = "#d4a574";  // brand copper for fills, dots and outlines
const PAGE_BG = "#f5f1ea";
const CARD_BG = "#ffffff";
const PANEL_BG = "#faf7f2";
const LINE = "#e7e0d4";
const INK = NAVY;
const INK_SOFT = "#5b6472";
const TRACK = "#ece6db";

const GOOD = "#2e7d5b";
const WARN = "#c4891f";
const BAD = "#b4442f";
const NEUTRAL = "#8a8f98";

const STATUS_META: Record<WwiStatus, { label: string; color: string; blurb: string }> = {
  steady: { label: "Steady", color: GOOD, blurb: "Score 70 or above. In the healthy range." },
  mixed: { label: "Mixed", color: WARN, blurb: "Score 50 to 69. Some strain showing." },
  strained: { label: "Strained", color: BAD, blurb: "Score under 50, or people in the severe burnout band." },
};

const METRIC_META: Record<string, { icon: LucideIcon; label: string; blurb: string }> = {
  mood: { icon: Smile, label: "Mood", blurb: "How positive people feel" },
  energy: { icon: Zap, label: "Energy", blurb: "Physical and mental energy" },
  stress: { icon: Flame, label: "Stress", blurb: "Pressure people are under" },
  clarity: { icon: Lightbulb, label: "Clarity", blurb: "Ability to think clearly and focus" },
};

const BAND_META: { key: "optimal" | "mild" | "moderate" | "high" | "severe"; label: string; color: string }[] = [
  { key: "optimal", label: "Optimal", color: "#5f9a7d" },
  { key: "mild", label: "Mild", color: "#a7bf9a" },
  { key: "moderate", label: "Moderate", color: "#dcb979" },
  { key: "high", label: "High", color: "#c98450" },
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

// Scoped light theme: Tailwind v4 maps text-foreground etc. to these variables at the point of
// use, so overriding them on the page root re-skins every shadcn primitive inside it.
const LIGHT_VARS = {
  "--background": PAGE_BG,
  "--foreground": INK,
  "--card": CARD_BG,
  "--card-foreground": INK,
  "--muted": PANEL_BG,
  "--muted-foreground": INK_SOFT,
  "--border": LINE,
  "--input": LINE,
  "--popover": CARD_BG,
  "--popover-foreground": INK,
  "--accent": PANEL_BG,
  "--accent-foreground": INK,
  colorScheme: "light",
} as CSSProperties;

const LIGHT_POPOVER = "bg-white text-[#111d2e] border-[#e7e0d4] shadow-lg";

// ---- Helpers ----

function humanizeMetric(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusFromScore(score: number): WwiStatus {
  return score >= 70 ? "steady" : score >= 50 ? "mixed" : "strained";
}

function severityHex(sev: number): string {
  if (sev >= 7) return BAD;
  if (sev >= 4) return "#c98450";
  return GOOD;
}

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(0)}%` : "n/a";
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- Small building blocks ----

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]"
      style={{ color: COPPER, border: `1px solid ${COPPER_SOFT}` }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ eyebrow, title, hint, right }: { eyebrow?: string; title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        {eyebrow && <div className="mb-2"><Eyebrow>{eyebrow}</Eyebrow></div>}
        <h3 className="text-xl font-normal tracking-tight" style={{ color: INK }}>{title}</h3>
        {hint && <p className="text-sm mt-1 leading-snug" style={{ color: INK_SOFT }}>{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function IconDisc({ icon: Icon, size = 40 }: { icon: LucideIcon; size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: size, height: size, background: PANEL_BG, border: `1px solid ${LINE}` }}>
      <Icon style={{ color: NAVY, width: size * 0.45, height: size * 0.45 }} strokeWidth={1.6} />
    </div>
  );
}

function Help({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="cursor-help">{children}</span></TooltipTrigger>
      <TooltipContent className={`max-w-xs text-[13px] leading-snug ${LIGHT_POPOVER}`}>{text}</TooltipContent>
    </Tooltip>
  );
}

function StatusDot({ status }: { status: WwiStatus | null }) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <Help text={m.blurb}>
      <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: INK }}>
        <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
        {m.label}
      </span>
    </Help>
  );
}

function StateNote({ state }: { state: WwiState }) {
  const map: Record<WwiState, { label: string; help: string }> = {
    full: { label: "Complete data", help: "Enough people contributed for every part of this section to be reported." },
    thin: { label: "Limited data", help: "The headline can be reported, but some parts are below the anonymity floor and are hidden." },
    empty: { label: "Not enough data", help: "Too few people contributed in this window for anything to be reported safely." },
  };
  const s = map[state];
  return (
    <Help text={s.help}>
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: INK_SOFT }}>
        {s.label} <CircleHelp className="h-3.5 w-3.5 opacity-60" />
      </span>
    </Help>
  );
}

function ConfidenceNote({ confidence }: { confidence: WwiConfidence | null }) {
  if (!confidence) return null;
  const label = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return (
    <Help text="Confidence reflects how much of the company contributed data in this window. High means 60% or more of staff, medium 25 to 60%, low under 25%.">
      <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: INK_SOFT }}>
        {label} confidence <CircleHelp className="h-3.5 w-3.5 opacity-60" />
      </span>
    </Help>
  );
}

// Signed change vs the previous window. Values are on a higher-is-healthier scale.
function Change({ current, previous, suffix = "vs last period" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current === null || previous === null) {
    return <span className="inline-flex items-center gap-1 text-sm" style={{ color: NEUTRAL }}><Minus className="h-3.5 w-3.5" /> First period</span>;
  }
  const d = Math.round(current - previous);
  if (d === 0) return <span className="text-sm" style={{ color: NEUTRAL }}>No change {suffix}</span>;
  const up = d > 0;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: up ? GOOD : BAD }}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{d} {suffix}
    </span>
  );
}

function Worse({ worsening }: { worsening: boolean | null }) {
  if (worsening === null) return <span className="inline-flex items-center gap-1 text-sm" style={{ color: NEUTRAL }}><Minus className="h-3.5 w-3.5" /> First period</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: worsening ? BAD : GOOD }}>
      {worsening ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {worsening ? "Worse than last period" : "Not worse than last period"}
    </span>
  );
}

function BigNumber({ value, unit, size = "lg" }: { value: string; unit?: string; size?: "lg" | "md" | "sm" }) {
  const cls = size === "lg" ? "text-6xl" : size === "md" ? "text-5xl" : "text-3xl";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`${cls} font-light tracking-tight leading-none tabular-nums`} style={{ color: INK }}>{value}</span>
      {unit && <span className="text-sm" style={{ color: INK_SOFT }}>{unit}</span>}
    </div>
  );
}

// Where a 0-100 score sits across the three status bands.
function ScoreBandBar({ score }: { score: number }) {
  const left = Math.max(0, Math.min(100, score));
  return (
    <div className="mt-5 max-w-lg">
      <div className="relative h-1.5 rounded-full flex overflow-visible">
        <span className="h-full rounded-l-full" style={{ width: "50%", background: `${BAD}55` }} />
        <span className="h-full" style={{ width: "20%", background: `${WARN}55` }} />
        <span className="h-full rounded-r-full" style={{ width: "30%", background: `${GOOD}55` }} />
        <span className="absolute -top-[5px] h-4 w-4 rounded-full border-2 border-white" style={{ left: `calc(${left}% - 8px)`, background: NAVY, boxShadow: "0 1px 3px rgba(17,29,46,.3)" }} />
      </div>
      <div className="relative mt-2 h-4 text-xs" style={{ color: INK_SOFT }}>
        <span className="absolute left-0">0</span>
        <span className="absolute" style={{ left: "25%", transform: "translateX(-50%)" }}>Strained</span>
        <span className="absolute" style={{ left: "50%", transform: "translateX(-50%)" }}>50</span>
        <span className="absolute" style={{ left: "60%", transform: "translateX(-50%)" }}>Mixed</span>
        <span className="absolute" style={{ left: "70%", transform: "translateX(-50%)" }}>70</span>
        <span className="absolute" style={{ left: "85%", transform: "translateX(-50%)" }}>Steady</span>
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
  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-start">
      <div>
        <p className="text-sm mb-2" style={{ color: INK_SOFT }}>{label}</p>
        <BigNumber value={score !== null ? score.toFixed(0) : "n/a"} unit="/ 100" />
        <div className="mt-3"><StatusDot status={status} /></div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {previous !== undefined && <Change current={score} previous={previous ?? null} />}
          <ConfidenceNote confidence={confidence} />
        </div>
        <p className="text-[15px] mt-2.5 leading-relaxed" style={{ color: INK_SOFT }}>{explainer}</p>
        {score !== null && <ScoreBandBar score={score} />}
      </div>
    </div>
  );
}

function Bar({ value, color = NAVY, height = 6 }: { value: number; color?: string; height?: number }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: TRACK }}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function EmptyDomain({ icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed p-5" style={{ borderColor: LINE, background: PANEL_BG }}>
      <IconDisc icon={icon} />
      <div>
        <p className="text-[15px] font-medium" style={{ color: INK }}>Not enough data to report yet</p>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: INK_SOFT }}>{message}</p>
      </div>
    </div>
  );
}

function Card({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`rounded-2xl p-6 sm:p-8 scroll-mt-20 ${className}`} style={{ background: CARD_BG, border: `1px solid ${LINE}` }}>
      {children}
    </section>
  );
}

function CardHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 pb-6 mb-7" style={{ borderBottom: `1px solid ${LINE}` }}>
      <div>
        <div className="mb-3"><Eyebrow>{eyebrow}</Eyebrow></div>
        <h2 className="text-3xl font-light tracking-tight leading-tight" style={{ color: INK }}>{title}</h2>
        <p className="text-[15px] mt-1.5" style={{ color: INK_SOFT }}>{subtitle}</p>
      </div>
      {right}
    </header>
  );
}

// ---- Mental Wellbeing ----

function GuardNotice({ d }: { d: MentalWellbeingDomain }) {
  const rb = d.burnout?.riskBands;
  if (!d.guardApplied || d.score === null || !d.status || !rb) return null;
  const rawLabel = STATUS_META[statusFromScore(d.score)].label;
  const finalLabel = STATUS_META[d.status].label;
  const cause = rb.severe > 0
    ? `${people(rb.severe)} ${rb.severe === 1 ? "is" : "are"} in the severe burnout band`
    : `${people(rb.high)} ${rb.high === 1 ? "is" : "are"} in the high burnout band`;
  const cap = rb.severe > 0 ? "Strained" : "Mixed";
  return (
    <details className="group rounded-xl px-4 py-3 text-[15px]" style={{ background: PANEL_BG, border: `1px solid ${LINE}` }}>
      <summary className="flex items-center gap-2.5 cursor-pointer list-none" style={{ color: INK }}>
        <Info className="h-4 w-4 shrink-0" style={{ color: COPPER }} />
        <span>Rated {finalLabel}, not {rawLabel}, because {cause}.</span>
        <span className="ml-auto text-sm group-open:hidden" style={{ color: COPPER }}>Why</span>
      </summary>
      <p className="text-sm mt-2.5 pl-6 leading-relaxed" style={{ color: INK_SOFT }}>
        On the wellbeing score alone this team would read {rawLabel}. The rating is capped at {cap} while anyone sits in that band,
        because a group of people at serious risk outweighs a decent average. When those people move down a band, the rating follows.
      </p>
    </details>
  );
}

function CompositionRow({ c }: { c: WwiComponent }) {
  const meta = METRIC_META[c.metric] ?? { icon: Activity, label: humanizeMetric(c.metric), blurb: "" };
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4" style={{ borderTop: `1px solid ${LINE}` }}>
      <IconDisc icon={meta.icon} size={40} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base font-medium" style={{ color: INK }}>{meta.label}</span>
          {meta.blurb && <span className="text-sm" style={{ color: INK_SOFT }}>{meta.blurb}</span>}
        </div>
        <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>
          Team average {c.rawAverage.toFixed(1)} out of 5{c.lowerIsBetter ? ", lower is better" : ""}
        </p>
        <div className="mt-2.5 max-w-sm"><Bar value={c.contribution} /></div>
      </div>
      <div className="text-right">
        <BigNumber value={c.contribution.toFixed(0)} unit="/ 100" size="sm" />
        <div className="mt-1.5"><Change current={c.contribution} previous={c.previousContribution} suffix="vs last" /></div>
      </div>
    </div>
  );
}

function BurnoutBlock({ b }: { b: NonNullable<MentalWellbeingDomain["burnout"]> }) {
  const rb = b.riskBands;
  const total = rb ? Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe) : 1;
  return (
    <div id="burnout" className="rounded-2xl p-6 scroll-mt-20" style={{ background: PANEL_BG, border: `1px solid ${LINE}` }}>
      <SectionTitle
        eyebrow="Burnout"
        title="Burnout risk"
        hint="From the monthly burnout assessment. Reported separately from the wellbeing score so the same distress isn't counted twice."
        right={<span className="inline-flex items-center gap-1.5 text-sm" style={{ color: INK_SOFT }}><Users className="h-4 w-4" /> {b.usersAssessed} assessed, {b.confidence} confidence</span>}
      />

      <div className="grid sm:grid-cols-2 gap-6 py-2">
        <div>
          <p className="text-sm mb-2" style={{ color: INK_SOFT }}>People at high or severe risk</p>
          <BigNumber value={String(b.severeTail)} unit={`of ${b.usersAssessed}`} size="md" />
          <p className="text-sm mt-2" style={{ color: INK_SOFT }}>{b.severeTail > 0 ? "These are the people holding the rating down." : "Nobody in the top two risk bands."}</p>
        </div>
        <div className="sm:pl-6 sm:border-l" style={{ borderColor: LINE }}>
          <p className="text-sm mb-2" style={{ color: INK_SOFT }}>Average burnout score, lower is better</p>
          <BigNumber value={b.avgScore !== null ? b.avgScore.toFixed(0) : "n/a"} unit="/ 100" size="md" />
          <div className="mt-2"><Worse worsening={b.worsening} /></div>
        </div>
      </div>

      {rb && (
        <div className="mt-6">
          <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>People in each burnout band</p>
          <div className="flex h-7 rounded-md overflow-hidden" style={{ background: TRACK }}>
            {BAND_META.map((bm) => {
              const n = rb[bm.key];
              if (n <= 0) return null;
              return (
                <div key={bm.key} className="flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(n / total) * 100}%`, background: bm.color, minWidth: 24 }} title={`${bm.label}: ${n}`}>
                  {n}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {BAND_META.map((bm) => (
              <span key={bm.key} className="inline-flex items-center gap-1.5 text-sm" style={{ color: INK_SOFT }}>
                <span className="h-2 w-2 rounded-full" style={{ background: bm.color }} />
                {bm.label} <span className="font-medium tabular-nums" style={{ color: INK }}>{rb[bm.key]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {b.topDrivers.length > 0 && (
        <div className="mt-6">
          <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>What's driving it, by number of people reporting each</p>
          <div className="flex flex-wrap gap-2">
            {b.topDrivers.map((t) => {
              const Icon = driverIcon(t.key, t.label);
              return (
                <span key={t.key} className="inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1.5" style={{ background: CARD_BG, border: `1px solid ${LINE}` }}>
                  <Icon className="h-4 w-4" style={{ color: COPPER }} strokeWidth={1.7} />
                  <span className="text-sm" style={{ color: INK }}>{t.label}</span>
                  <span className="text-xs font-medium rounded-full px-2 py-0.5 tabular-nums" style={{ color: NAVY, background: `${COPPER_SOFT}40` }}>{t.count}</span>
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
    <Card id="mental">
      <CardHeader eyebrow="Detail" title="Mental wellbeing" subtitle="Mood, energy, stress and clarity across the team" right={<StateNote state={d.state} />} />

      {d.state === "empty" ? (
        <EmptyDomain icon={Brain} message={d.emptyReason ?? `${d.activeContributors} of ${d.requiredContributors} contributors needed before this can be reported.`} />
      ) : (
        <div className="space-y-8">
          <Headline
            label="Wellbeing score"
            score={d.score}
            previous={d.previousScore}
            status={d.status}
            confidence={d.confidence}
            explainer="The average of four scores: mood, energy, stress and clarity. Higher is healthier. Burnout is measured separately below and is not part of this number."
          />

          <GuardNotice d={d} />

          {d.components.length > 0 && (
            <div>
              <SectionTitle title="What makes up the score" hint="Each measure converted to a 0 to 100 score. The four are averaged equally." />
              <div style={{ borderBottom: `1px solid ${LINE}` }}>
                {d.components.map((c) => <CompositionRow key={c.metric} c={c} />)}
              </div>
            </div>
          )}

          {d.symptomSignals && (
            <div>
              <SectionTitle title="Symptom signals" hint="How often these were reported. Early warning signals only, they are not part of the score." />
              <div className="grid sm:grid-cols-3">
                {([
                  [Wind, "Anxious", d.symptomSignals.anxiousPercent],
                  [CloudRain, "Overwhelmed", d.symptomSignals.overwhelmedPercent],
                  [BatteryLow, "Fatigue", d.symptomSignals.fatiguePercent],
                ] as [LucideIcon, string, number | null][]).map(([Icon, label, v], i) => (
                  <div key={label} className={`py-3 ${i > 0 ? "sm:pl-6 sm:border-l" : ""}`} style={{ borderColor: LINE }}>
                    <p className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}><Icon className="h-4 w-4" style={{ color: COPPER }} strokeWidth={1.7} />{label}</p>
                    <div className="mt-2"><BigNumber value={pct(v)} size="sm" /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.burnout && d.burnout.reportable && <BurnoutBlock b={d.burnout} />}

          {d.burnout && !d.burnout.reportable && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 text-[15px]" style={{ background: PANEL_BG, border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: COPPER }} />
              <span>Burnout isn't reported yet. Only {people(d.burnout.usersAssessed)} completed the assessment in this window, which is below the anonymity floor.</span>
            </div>
          )}

          {d.divergence && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 text-[15px]" style={{ background: PANEL_BG, border: `1px solid ${LINE}`, color: INK }}>
              <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: COPPER }} />
              <span>{d.divergence}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- Physical health ----

function AreaRow({ a }: { a: PhysicalStrainDomain["areas"][number] }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4" style={{ borderTop: `1px solid ${LINE}` }}>
      <IconDisc icon={Bone} size={40} />
      <div className="min-w-0">
        <p className="text-base font-medium" style={{ color: INK }}>{humanizeMetric(a.bodyPart)}</p>
        <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>{people(a.distinctReporters)} reported pain here</p>
        <div className="mt-2.5 max-w-sm"><Bar value={a.avgSeverity * 10} color={severityHex(a.avgSeverity)} /></div>
      </div>
      <div className="text-right">
        <BigNumber value={a.avgSeverity.toFixed(1)} unit="/ 10" size="sm" />
        <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>Average severity</p>
      </div>
    </div>
  );
}

function PhysicalHealthCard({ d }: { d: PhysicalStrainDomain }) {
  return (
    <Card id="physical">
      <CardHeader eyebrow="Detail" title="Physical health" subtitle="Aches and pain among staff who log body-map data, not the whole workforce" right={<StateNote state={d.state} />} />

      {d.state === "empty" ? (
        <EmptyDomain icon={Activity} message={d.emptyReason ?? `${d.contributors} of ${d.requiredContributors} people need to log body-map data before this can be reported.`} />
      ) : (
        <div className="space-y-8">
          <Headline
            label="Physical health score"
            score={d.score}
            status={d.status}
            confidence={d.confidence}
            explainer={`Built from how many people report pain and how bad it is. Higher is healthier. Based on the ${d.contributors} people who logged body-map data (${d.requiredContributors} or more needed to report).`}
          />

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm mb-2" style={{ color: INK_SOFT }}>Reporting pain</p>
              <BigNumber value={pct(d.painPrevalencePercent)} size="md" />
              <p className="text-sm mt-2" style={{ color: INK_SOFT }}>Of people logging body-map data</p>
              <div className="mt-1.5"><Worse worsening={d.worseningPrevalence} /></div>
            </div>
            <div className="sm:pl-6 sm:border-l" style={{ borderColor: LINE }}>
              <p className="text-sm mb-2" style={{ color: INK_SOFT }}>Average severity</p>
              <BigNumber value={d.avgSeverity !== null ? d.avgSeverity.toFixed(1) : "n/a"} unit="/ 10" size="md" />
              <p className="text-sm mt-2" style={{ color: INK_SOFT }}>Among those reporting pain</p>
              <div className="mt-1.5"><Worse worsening={d.worseningSeverity} /></div>
            </div>
          </div>

          {d.areas.length > 0 && (
            <div>
              <SectionTitle title="Where it hurts" hint="Only areas with 5 or more separate people reporting are shown, so nobody can be singled out." />
              <div style={{ borderBottom: `1px solid ${LINE}` }}>
                {d.areas.map((a) => <AreaRow key={a.bodyPart} a={a} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- Overview ----

function OverviewStat({ label, value, unit, foot, targetId, first }: {
  label: string; value: string; unit?: string; foot: ReactNode; targetId: string; first?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(targetId)}
      className={`text-left py-2 sm:py-0 ${first ? "" : "sm:pl-8 sm:border-l"} focus:outline-none group`}
      style={{ borderColor: LINE }}
    >
      <p className="text-sm mb-3 group-hover:underline underline-offset-4" style={{ color: INK_SOFT }}>{label}</p>
      <BigNumber value={value} unit={unit} />
      <div className="mt-3 flex flex-col gap-1">{foot}</div>
    </button>
  );
}

function keyPoints(data: WwiResponse): string[] {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const b = m.burnout;
  const out: string[] = [];
  if (m.state !== "empty" && m.score !== null && m.status) {
    let s = `Wellbeing score is ${m.score.toFixed(0)} out of 100, rated ${STATUS_META[m.status].label}.`;
    if (m.previousScore !== null) {
      const d = Math.round(m.score - m.previousScore);
      s += d > 0 ? ` Up ${d} on the previous period.` : d < 0 ? ` Down ${-d} on the previous period.` : " The same as the previous period.";
    }
    out.push(s);
  }
  if (b && b.reportable) {
    const rb = b.riskBands;
    if (m.guardApplied && rb && rb.severe > 0) {
      out.push(`${people(rb.severe)} ${rb.severe === 1 ? "is" : "are"} in the severe burnout band, which holds the rating at Strained. ${b.severeTail} of ${b.usersAssessed} assessed are at high or severe risk.`);
    } else {
      out.push(`${b.severeTail} of ${b.usersAssessed} people assessed are at high or severe burnout risk.`);
    }
    const top = b.topDrivers[0];
    if (top) out.push(`The most reported burnout driver is ${top.label.toLowerCase()}, reported by ${people(top.count)}.`);
  }
  if (p.state !== "empty" && p.painPrevalencePercent !== null) {
    const area = p.areas[0];
    out.push(`${p.painPrevalencePercent.toFixed(0)}% of people logging body-map data report pain${area ? `, most often in the ${humanizeMetric(area.bodyPart).toLowerCase()}` : ""}.`);
  }
  return out;
}

function TrendChart({ points, loading }: { points: TrendPoint[]; loading: boolean }) {
  const has = points.some((p) => p.score !== null);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-sm" style={{ color: INK_SOFT }}>Wellbeing score by month, higher is healthier</p>
        <p className="text-xs" style={{ color: INK_SOFT }}>Last 6 months</p>
      </div>
      <div className="h-[220px]">
        {loading ? (
          <div className="h-full rounded-xl" style={{ background: PANEL_BG }} />
        ) : !has ? (
          <div className="h-full rounded-xl flex items-center justify-center text-sm text-center px-6" style={{ background: PANEL_BG, color: INK_SOFT }}>
            Not enough monthly data yet. Each month needs enough people above the anonymity floor.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 12 }} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 70, 100]} tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 12 }} />
              <ReferenceLine y={70} stroke={`${GOOD}88`} strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke={`${BAD}77`} strokeDasharray="4 4" />
              <ChartTooltip
                cursor={{ stroke: LINE }}
                contentStyle={{ borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13, color: INK }}
                formatter={(v) => [`${Math.round(Number(v))} / 100`, "Wellbeing score"]}
              />
              <Line type="monotone" dataKey="score" stroke={NAVY} strokeWidth={2} connectNulls={false}
                dot={{ r: 4, fill: COPPER_SOFT, stroke: NAVY, strokeWidth: 1.5 }} activeDot={{ r: 5, fill: COPPER_SOFT, stroke: NAVY }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {has && !loading && <p className="text-xs mt-2" style={{ color: INK_SOFT }}>Dashed lines: 70 and above is Steady, under 50 is Strained.</p>}
    </div>
  );
}

function Overview({ data, trend, trendLoading }: { data: WwiResponse; trend: TrendPoint[]; trendLoading: boolean }) {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const b = m.burnout;
  const points = keyPoints(data);
  return (
    <Card>
      <div className="mb-6"><Eyebrow>Overview</Eyebrow></div>
      <div className="grid sm:grid-cols-3 gap-6 pb-8" style={{ borderBottom: `1px solid ${LINE}` }}>
        <OverviewStat
          first label="Mental wellbeing" targetId="mental"
          value={m.score !== null ? m.score.toFixed(0) : "n/a"} unit={m.score !== null ? "/ 100" : undefined}
          foot={m.state === "empty" ? <span className="text-sm" style={{ color: INK_SOFT }}>Not enough data</span> : (
            <>
              <StatusDot status={m.status} />
              <Change current={m.score} previous={m.previousScore} />
            </>
          )}
        />
        <OverviewStat
          label="High or severe burnout risk" targetId="burnout"
          value={b && b.reportable ? String(b.severeTail) : "n/a"} unit={b && b.reportable ? `of ${b.usersAssessed} people` : undefined}
          foot={b && b.reportable ? (
            <>
              <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: INK }}>
                <span className="h-2 w-2 rounded-full" style={{ background: b.severeTail > 0 ? BAD : GOOD }} />
                {b.severeTail > 0 ? "Needs attention" : "Nobody at high risk"}
              </span>
              <Worse worsening={b.worsening} />
            </>
          ) : <span className="text-sm" style={{ color: INK_SOFT }}>Not enough assessments yet</span>}
        />
        <OverviewStat
          label="Physical health" targetId="physical"
          value={p.score !== null ? p.score.toFixed(0) : "n/a"} unit={p.score !== null ? "/ 100" : undefined}
          foot={p.state === "empty" ? <span className="text-sm" style={{ color: INK_SOFT }}>Not enough data</span> : (
            <>
              <StatusDot status={p.status} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Higher is healthier</span>
            </>
          )}
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 pt-8">
        <TrendChart points={trend} loading={trendLoading} />
        <div className="lg:pl-8 lg:border-l" style={{ borderColor: LINE }}>
          <p className="text-sm mb-3" style={{ color: INK_SOFT }}>Key points</p>
          {points.length === 0 ? (
            <p className="text-[15px]" style={{ color: INK_SOFT }}>Not enough data for this period yet.</p>
          ) : (
            <ol className="space-y-3">
              {points.map((t, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-3 text-[15px] leading-relaxed" style={{ color: INK }}>
                  <span className="text-sm tabular-nums pt-0.5" style={{ color: COPPER }}>{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
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

// Last 6 calendar months. The current month is only included once it has 7 days in it
// (the endpoint's minimum range). Months below the anonymity floor come back empty.
async function fetchTrend(company: string): Promise<TrendPoint[]> {
  const today = new Date();
  const months: { label: string; start: string; end: string | null }[] = [];
  for (let i = 5; i >= 0; i--) {
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const last = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const end = last > today ? today : last;
    const days = Math.ceil((end.getTime() - first.getTime()) / 86400000);
    months.push({ label: MONTHS[first.getMonth()]!, start: isoDay(first), end: days >= 7 ? isoDay(end) : null });
  }
  return Promise.all(months.map(async (mo) => {
    if (!mo.end) return { label: mo.label, score: null };
    try {
      const res = await fetch(buildWwiUrl(company, "custom", mo.start, mo.end), { credentials: "include" });
      if (!res.ok) return { label: mo.label, score: null };
      const j = (await res.json()) as WwiResponse;
      const mw = j.domains.mentalWellbeing;
      return { label: mo.label, score: mw.state === "empty" ? null : mw.score };
    } catch {
      return { label: mo.label, score: null };
    }
  }));
}

const WORDMARK_SRC = `${import.meta.env.BASE_URL}meridianwork-wordmark-navy.png`;

// ---- Printable / PDF report ----

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function deltaChip(cur: number | null, prev: number | null): string {
  if (cur === null || prev === null) return '<span style="color:#8a8f98;font-size:11px">First period</span>';
  const d = Math.round(cur - prev);
  if (d === 0) return '<span style="color:#8a8f98;font-size:11px">No change vs last period</span>';
  const up = d > 0;
  return `<span style="color:${up ? GOOD : BAD};font-size:11px;font-weight:600">${up ? "▲ +" : "▼ "}${d} vs last period</span>`;
}

function bar(widthPct: number, color: string): string {
  const w = Math.max(0, Math.min(100, widthPct));
  return `<div style="height:6px;border-radius:6px;background:${TRACK};overflow:hidden;width:120px"><span style="display:block;height:100%;width:${w}%;background:${color};border-radius:6px"></span></div>`;
}

function guardCopy(m: MentalWellbeingDomain): string {
  const rb = m.burnout?.riskBands;
  if (!m.guardApplied || m.score === null || !m.status || !rb) return "";
  const rawLabel = STATUS_META[statusFromScore(m.score)].label;
  const finalLabel = STATUS_META[m.status].label;
  const cause = rb.severe > 0 ? `${people(rb.severe)} in the severe burnout band` : `${people(rb.high)} in the high burnout band`;
  return `Rated ${finalLabel} rather than ${rawLabel}. The wellbeing score alone would read ${rawLabel}, but with ${cause} the rating is capped.`;
}

function buildReportHtml(data: WwiResponse, windowLabel: string, dateStr: string, logoUrl: string | null): string {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const company = escapeHtml(data.companyName);
  const origin = window.location.origin;
  const statusDot = (s: WwiStatus | null) => s ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600"><span style="width:8px;height:8px;border-radius:50%;background:${STATUS_META[s].color};display:inline-block"></span>${STATUS_META[s].label}</span>` : "";
  const h = (t: string, extra = "") => `<div style="font-size:15px;color:${NAVY};margin:20px 0 6px;font-weight:500">${t}${extra}</div>`;
  const big = (v: string, unit: string) => `<span style="font-size:44px;font-weight:300;letter-spacing:-1px;color:${NAVY}">${v}</span><span style="color:${INK_SOFT};font-size:13px;margin-left:4px">${unit}</span>`;

  const rowGrid = (left: string, mid: string, right: string) =>
    `<div style="display:grid;grid-template-columns:1fr 120px 150px;align-items:center;gap:14px;padding:9px 0;border-top:1px solid ${LINE}">
      <div style="font-size:13.5px;color:${NAVY}">${left}</div><div>${mid}</div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">${right}</div></div>`;

  let mentalHtml = "";
  if (m.state === "empty") {
    mentalHtml = `<p style="color:${INK_SOFT};font-size:13px">${escapeHtml(m.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const comp = m.components.map((c) => {
      const label = `<b style="font-weight:600">${escapeHtml(METRIC_META[c.metric]?.label ?? humanizeMetric(c.metric))}</b> <span style="color:${INK_SOFT};font-size:12px">team average ${c.rawAverage.toFixed(1)} / 5${c.lowerIsBetter ? ", lower is better" : ""}</span>`;
      const val = `<span style="font-weight:600">${c.contribution.toFixed(0)} / 100</span>${deltaChip(c.contribution, c.previousContribution)}`;
      return rowGrid(label, bar(c.contribution, NAVY), val);
    }).join("");
    const ss = m.symptomSignals;
    const sig = ss ? [["Anxious", ss.anxiousPercent], ["Overwhelmed", ss.overwhelmedPercent], ["Fatigue", ss.fatiguePercent]]
      .map(([l, v]) => rowGrid(l as string, "", `<span style="font-weight:600">${v !== null ? (v as number).toFixed(0) + "%" : "n/a"}</span>`)).join("") : "";
    let burn = "";
    if (m.burnout && m.burnout.reportable && m.burnout.riskBands) {
      const b = m.burnout; const rb = b.riskBands!;
      const total = Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe);
      const seg = (n: number, c: string, lbl: string) => n > 0 ? `<span style="display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;width:${(n / total) * 100}%;background:${c}" title="${lbl}">${n}</span>` : "";
      const chips = b.topDrivers.map((t) => `<span style="background:#fff;border:1px solid ${LINE};border-radius:999px;padding:4px 11px;font-size:12px;color:${NAVY}">${escapeHtml(t.label)} <b style="background:${COPPER_SOFT}40;border-radius:999px;padding:1px 7px;font-weight:600">${t.count}</b></span>`).join("");
      burn = `<div style="background:${PANEL_BG};border:1px solid ${LINE};border-radius:12px;padding:16px;margin-top:14px">
        ${h("Burnout risk", ` <span style="font-size:12px;color:${INK_SOFT}">${b.usersAssessed} assessed, ${b.confidence} confidence</span>`)}
        <div style="display:flex;gap:30px;margin-bottom:12px">
          <div><div style="font-size:11.5px;color:${INK_SOFT}">People at high or severe risk</div>${big(String(b.severeTail), `of ${b.usersAssessed}`)}</div>
          <div><div style="font-size:11.5px;color:${INK_SOFT}">Average burnout score, lower is better</div>${big(b.avgScore !== null ? b.avgScore.toFixed(0) : "n/a", "/ 100")}</div>
        </div>
        <div style="display:flex;height:22px;border-radius:5px;overflow:hidden;margin-bottom:8px">${BAND_META.map((bm) => seg(rb[bm.key], bm.color, bm.label)).join("")}</div>
        <div style="font-size:11.5px;color:${NAVY};margin-bottom:10px">Optimal ${rb.optimal} · Mild ${rb.mild} · Moderate ${rb.moderate} · High ${rb.high} · Severe ${rb.severe}</div>
        <div style="font-size:11px;color:${INK_SOFT};margin-bottom:6px">What's driving it (people reporting each)</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${chips}</div></div>`;
    }
    const gc = guardCopy(m);
    const guard = gc ? `<div style="background:${PANEL_BG};border:1px solid ${LINE};border-radius:9px;padding:9px 12px;font-size:12.5px;margin:10px 0;color:${NAVY}">${escapeHtml(gc)}</div>` : "";
    mentalHtml = `
      <div style="display:flex;align-items:flex-end;gap:16px;margin:4px 0">${big(m.score !== null ? m.score.toFixed(0) : "n/a", "/ 100")}<span style="margin-left:auto;text-align:right">${statusDot(m.status)}<div>${deltaChip(m.score, m.previousScore)}</div></span></div>
      <p style="color:${INK_SOFT};font-size:12px;margin:0 0 4px">The average of four scores: mood, energy, stress and clarity. Higher is healthier. Burnout is measured separately.</p>
      ${guard}
      ${h("What makes up the score")}${comp}
      ${h("Symptom signals", ` <span style="font-size:12px;color:${INK_SOFT}">(early warning signals, not part of the score)</span>`)}${sig}
      ${burn}`;
  }

  let physHtml = "";
  if (p.state === "empty") {
    physHtml = `<p style="color:${INK_SOFT};font-size:13px">${escapeHtml(p.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const areas = p.areas.map((a) => rowGrid(`<b style="font-weight:600">${escapeHtml(humanizeMetric(a.bodyPart))}</b> <span style="color:${INK_SOFT};font-size:12px">${a.distinctReporters} people</span>`, bar(a.avgSeverity * 10, severityHex(a.avgSeverity)), `<span style="font-weight:600">${a.avgSeverity.toFixed(1)} / 10</span>`)).join("");
    const worse = (b: boolean | null) => b === null ? `<span style="color:${INK_SOFT}">first period</span>` : b ? `<span style="color:${BAD};font-weight:600">worse than last period</span>` : `<span style="color:${GOOD};font-weight:600">not worse than last period</span>`;
    physHtml = `
      <p style="color:${INK_SOFT};font-size:12.5px;margin:0 0 2px">${escapeHtml(p.framing)}</p>
      <div style="display:flex;align-items:flex-end;gap:16px;margin:4px 0">${big(p.score !== null ? p.score.toFixed(0) : "n/a", "/ 100, higher is healthier")}<span style="margin-left:auto">${statusDot(p.status)}</span></div>
      <p style="color:${INK_SOFT};font-size:12.5px">${p.contributors} people logged body-map data (${p.requiredContributors} or more needed to report)</p>
      ${rowGrid("<b style=\"font-weight:600\">Reporting pain</b>, " + worse(p.worseningPrevalence), bar(p.painPrevalencePercent || 0, NAVY), `<span style="font-weight:600">${p.painPrevalencePercent !== null ? p.painPrevalencePercent.toFixed(0) + "%" : "n/a"}</span>`)}
      ${rowGrid("<b style=\"font-weight:600\">Average severity (0 to 10)</b>, " + worse(p.worseningSeverity), bar((p.avgSeverity || 0) * 10, NAVY), `<span style="font-weight:600">${p.avgSeverity !== null ? p.avgSeverity.toFixed(1) : "n/a"}</span>`)}
      ${h("Where it hurts", ` <span style="font-size:12px;color:${INK_SOFT}">(areas with 5 or more separate people reporting)</span>`)}${areas}`;
  }

  const kp = keyPoints(data).map((t, i) => `<div style="display:grid;grid-template-columns:24px 1fr;gap:8px;font-size:13px;margin:5px 0"><span style="color:${COPPER}">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(t)}</span></div>`).join("");
  const clientLogo = logoUrl ? `<img src="${escapeHtml(logoUrl.startsWith("http") ? logoUrl : origin + logoUrl)}" alt="${company}" style="height:44px;width:44px;border-radius:10px;object-fit:cover;background:#fff;border:1px solid ${LINE}">` : "";
  const floor = Math.max(m.requiredContributors, p.requiredContributors);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wellbeing Index, ${company}</title>
<style>@page{margin:14mm} body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:${NAVY};margin:0;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{border:1px solid ${LINE};border-radius:14px;padding:20px 22px;margin:0 0 16px;break-inside:avoid;background:#fff}
.h1{font-size:22px;font-weight:300;letter-spacing:-.3px;margin:0 0 8px}</style></head>
<body>
<div style="background:${PAGE_BG};padding:22px 26px;border-radius:14px;margin-bottom:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px">
  <div>
    <img src="${origin}${WORDMARK_SRC}" alt="MeridianWork" style="height:24px;display:block;margin-bottom:16px">
    <div style="font-size:26px;font-weight:300;letter-spacing:-.5px">Workforce Wellbeing Index</div>
    <div style="color:${INK_SOFT};font-size:13px;margin-top:4px">${company} · ${escapeHtml(windowLabel)} · generated ${escapeHtml(dateStr)}</div>
  </div>
  ${clientLogo}
</div>
${kp ? `<div class="card"><div class="h1">Key points</div>${kp}</div>` : ""}
<div class="card"><div class="h1">Mental wellbeing</div>${mentalHtml}</div>
<div class="card"><div class="h1">Physical health</div>${physHtml}</div>
<p style="color:${INK_SOFT};font-size:11px">Figures are aggregated above the anonymity floor (${floor} or more people) and contain no individually identifiable information.</p>
</body></html>`;
}

function downloadReport(data: WwiResponse, windowLabel: string, logoUrl: string | null) {
  const dateStr = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const html = buildReportHtml(data, windowLabel, dateStr, logoUrl);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 600);
}

export default function AdminWwi() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<string>("30");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPresent(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<CompanySummary[]>({
    queryKey: ["/api/admin/reports/companies"],
    enabled: !!user,
  });

  // Company records carry the client logo uploaded in Company Management. Optional: the page
  // works without it (initials fallback), so a failure here is swallowed.
  const { data: companyRecords = [] } = useQuery<CompanyRecord[]>({
    queryKey: ["/api/admin/companies"],
    enabled: !!user,
    retry: false,
  });

  const customValid = timeWindow !== "custom" || (!!customStartDate && !!customEndDate);
  const windowLabel =
    timeWindow === "custom" ? (customStartDate && customEndDate ? `${fmtDate(customStartDate)} to ${fmtDate(customEndDate)}` : "Custom range") :
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

  const { data: trend = [], isFetching: trendLoading } = useQuery<TrendPoint[]>({
    queryKey: ["/api/admin/reports/company", selectedCompany, "wwi-trend"],
    queryFn: () => fetchTrend(selectedCompany!),
    enabled: !!(user && selectedCompany),
    staleTime: 10 * 60 * 1000,
  });

  const selectedSummary = companies.find((c) => c.companyName === selectedCompany);
  const selectedRecord = Array.isArray(companyRecords)
    ? companyRecords.find((c) => c.name?.trim().toLowerCase() === selectedCompany?.trim().toLowerCase())
    : undefined;
  const clientLogo = selectedRecord?.logoUrl ?? null;
  const floor = data ? Math.max(data.domains.mentalWellbeing.requiredContributors, data.domains.physicalStrain.requiredContributors) : null;
  const ready = !!(selectedCompany && !isFetching && !error && data);

  return (
    <div
      className={present ? "fixed inset-0 z-[100] overflow-auto" : "min-h-screen"}
      style={{ ...LIGHT_VARS, background: PAGE_BG, color: INK }}
    >
      {!present && <TopHeader title="Wellbeing Index" onBack={() => navigate("/admin")} />}
      <div className={`max-w-5xl mx-auto px-4 sm:px-8 ${present ? "pt-10" : "pt-16 sm:pt-16"} pb-32`}>

        {!present && (
          <div className="flex flex-col gap-3 mb-8 pb-6" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedCompany || ""} onValueChange={(v) => setSelectedCompany(v)}>
                <SelectTrigger className="bg-white border-[#e7e0d4] text-[#111d2e] w-auto max-w-[220px] sm:max-w-[280px] h-10 text-[15px]">
                  <SelectValue placeholder="Select a company" className="truncate" />
                </SelectTrigger>
                <SelectContent className={LIGHT_POPOVER}>
                  {companies.map((c) => (
                    <SelectItem key={c.companyName} value={c.companyName} className="text-[#111d2e] focus:bg-[#faf7f2] focus:text-[#111d2e]">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="truncate max-w-[160px]">{c.companyName}</span>
                        <span className="text-xs" style={{ color: INK_SOFT }}>({c.userCount} users)</span>
                      </span>
                    </SelectItem>
                  ))}
                  {companies.length === 0 && !companiesLoading && (
                    <div className="px-3 py-2 text-sm" style={{ color: INK_SOFT }}>No companies found</div>
                  )}
                </SelectContent>
              </Select>

              <Select value={timeWindow} onValueChange={(v) => setTimeWindow(v)}>
                <SelectTrigger className="bg-white border-[#e7e0d4] text-[#111d2e] w-auto sm:w-44 h-10 text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={LIGHT_POPOVER}>
                  <SelectItem value="7" className="text-[#111d2e] focus:bg-[#faf7f2] focus:text-[#111d2e]">Last 7 days</SelectItem>
                  <SelectItem value="30" className="text-[#111d2e] focus:bg-[#faf7f2] focus:text-[#111d2e]">Last 30 days</SelectItem>
                  <SelectItem value="90" className="text-[#111d2e] focus:bg-[#faf7f2] focus:text-[#111d2e]">Last 90 days</SelectItem>
                  <SelectItem value="custom" className="text-[#111d2e] focus:bg-[#faf7f2] focus:text-[#111d2e]">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {ready && (
                <div className="flex gap-2 sm:ml-auto">
                  <button
                    onClick={() => setPresent(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-medium bg-white transition-colors hover:bg-[#faf7f2]"
                    style={{ border: `1px solid ${LINE}`, color: INK }}
                    title="Hide the menus and controls for clean screenshots. Press Esc to exit."
                  >
                    <Presentation className="h-4 w-4" style={{ color: COPPER }} /> Presentation view
                  </button>
                  <button
                    onClick={() => downloadReport(data!, windowLabel, clientLogo)}
                    className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-full text-sm font-medium transition-opacity hover:opacity-90 text-white"
                    style={{ background: NAVY }}
                    title="Open a printable report, then use your browser's Save as PDF"
                  >
                    <Download className="h-4 w-4" style={{ color: COPPER_SOFT }} /> Download PDF
                  </button>
                </div>
              )}
            </div>

            {timeWindow === "custom" && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}>
                  From
                  <input type="date" value={customStartDate} max={customEndDate || undefined} onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white border border-[#e7e0d4] rounded-md px-2 py-1.5 text-sm text-[#111d2e]" />
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}>
                  To
                  <input type="date" value={customEndDate} min={customStartDate || undefined} onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white border border-[#e7e0d4] rounded-md px-2 py-1.5 text-sm text-[#111d2e]" />
                </label>
                <span className="text-sm" style={{ color: INK_SOFT }}>Range must be at least 7 days.</span>
              </div>
            )}
          </div>
        )}

        {!selectedCompany && (
          <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: LINE, background: CARD_BG }}>
            <div className="mx-auto mb-4 w-fit"><IconDisc icon={Brain} size={52} /></div>
            <p className="text-lg font-normal" style={{ color: INK }}>Select a company to view its Wellbeing Index</p>
            <p className="text-sm mt-1" style={{ color: INK_SOFT }}>Mental wellbeing, burnout risk and physical health, reported at team level.</p>
          </div>
        )}

        {selectedCompany && isFetching && (
          <div className="rounded-2xl p-12 text-center text-[15px]" style={{ background: CARD_BG, border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Loading…
          </div>
        )}

        {selectedCompany && !isFetching && error && (
          <div className="rounded-2xl p-4 text-[15px]" style={{ background: "#fbefec", border: `1px solid ${BAD}44`, color: BAD }}>
            {(error as Error).message}
          </div>
        )}

        {ready && data && (
          <div className="space-y-6">
            <header className="pb-4">
              <div className="flex items-start justify-between gap-6">
                <img src={WORDMARK_SRC} alt="MeridianWork" className="h-9 w-auto -ml-1" />
                <div className="flex items-center gap-3">
                  <div className="text-right min-w-0">
                    <p className="text-[15px] font-medium leading-tight truncate max-w-[260px]" style={{ color: INK }}>{data.companyName}</p>
                    <p className="text-sm" style={{ color: INK_SOFT }}>
                      {selectedSummary ? `${selectedSummary.userCount} people · ` : ""}{windowLabel}
                    </p>
                  </div>
                  {clientLogo ? (
                    <img src={clientLogo} alt={data.companyName} className="h-11 w-11 rounded-xl object-cover bg-white" style={{ border: `1px solid ${LINE}` }} />
                  ) : (
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-medium" style={{ background: CARD_BG, border: `1px solid ${LINE}`, color: NAVY }}>
                      {initials(data.companyName) || <Building2 className="h-5 w-5" />}
                    </div>
                  )}
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-tight mt-10" style={{ color: INK }}>Workforce Wellbeing Index</h1>
              <p className="flex items-center gap-2 text-sm mt-3" style={{ color: INK_SOFT }}>
                <Lock className="h-3.5 w-3.5" style={{ color: COPPER }} />
                Anonymised. No figure is shown for groups smaller than {floor ?? 10} people.
              </p>
            </header>

            <Overview data={data} trend={trend} trendLoading={trendLoading} />
            <MentalWellbeingCard d={data.domains.mentalWellbeing} />
            <PhysicalHealthCard d={data.domains.physicalStrain} />
            <p className="text-sm text-center pt-2" style={{ color: INK_SOFT }}>
              {data.companyName} · {windowLabel} · figures aggregated above the anonymity floor
            </p>
          </div>
        )}
      </div>

      {present && (
        <button
          onClick={() => setPresent(false)}
          className="fixed bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}
        >
          <X className="h-3.5 w-3.5" /> Exit presentation view (Esc)
        </button>
      )}
    </div>
  );
}
