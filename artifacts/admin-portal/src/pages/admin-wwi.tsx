import { useState, type ReactNode, type CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert, Info, Users, Download,
  Smile, Zap, Flame, Lightbulb, Wind, CloudRain, BatteryLow, Moon, Hand, Briefcase, Bone, CircleAlert, CircleHelp,
  Lock, Building2, type LucideIcon,
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

// Shape of /api/admin/companies rows we care about (client logo uploaded in Company Management).
type CompanyRecord = {
  id: number;
  name: string;
  logoUrl: string | null;
};

// ---- Brand palette (light page) ----
// The Meridian brand is deep navy + brass gold. This page is deliberately light so it reads
// as a company report, even though the rest of the admin shell is dark.

const NAVY = "#111d2e";        // brand navy (email banner field)
const GOLD = "#b8874a";        // brass gold, darkened enough to read on white (brand tint is #d4a574)
const GOLD_SOFT = "#d4a574";   // brand gold for fills and borders
const PAGE_BG = "#f4f5f7";
const CARD_BG = "#ffffff";
const LINE = "#e3e7ec";
const INK = NAVY;              // primary text
const INK_SOFT = "#4b5563";    // secondary text (passes AA on white)
const TILE_BG = "#f8f9fb";

const GOOD = "#1f9d63";
const WARN = "#d9860b";
const BAD = "#d63c3c";
const NEUTRAL = "#8a94a3";

const STATUS_META: Record<WwiStatus, { label: string; color: string; blurb: string }> = {
  steady: { label: "Steady", color: GOOD, blurb: "In the healthy range." },
  mixed: { label: "Mixed", color: WARN, blurb: "Some strain showing. Worth watching." },
  strained: { label: "Strained", color: BAD, blurb: "Clear strain across the team. Act on it." },
};

const METRIC_META: Record<string, { icon: LucideIcon; color: string; label: string; blurb: string }> = {
  mood: { icon: Smile, color: "#d6467f", label: "Mood", blurb: "How positive people feel" },
  energy: { icon: Zap, color: "#d9860b", label: "Energy", blurb: "Physical and mental energy" },
  stress: { icon: Flame, color: "#e0641f", label: "Stress", blurb: "Pressure people are under" },
  clarity: { icon: Lightbulb, color: "#2f6fd6", label: "Clarity", blurb: "Ability to think clearly and focus" },
};

const BAND_META: { key: "optimal" | "mild" | "moderate" | "high" | "severe"; label: string; color: string }[] = [
  { key: "optimal", label: "Optimal", color: GOOD },
  { key: "mild", label: "Mild", color: "#7cb342" },
  { key: "moderate", label: "Moderate", color: WARN },
  { key: "high", label: "High", color: "#e0641f" },
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
  "--muted": "#eef0f3",
  "--muted-foreground": INK_SOFT,
  "--border": LINE,
  "--input": LINE,
  "--popover": CARD_BG,
  "--popover-foreground": INK,
  "--accent": "#eef0f3",
  "--accent-foreground": INK,
  colorScheme: "light",
} as CSSProperties;

const LIGHT_POPOVER = "bg-white text-[#111d2e] border-[#e3e7ec] shadow-lg";

// ---- Helpers ----

function humanizeMetric(metric: string): string {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusFromScore(score: number): WwiStatus {
  return score >= 70 ? "steady" : score >= 50 ? "mixed" : "strained";
}

function scoreHex(score: number | null): string {
  if (score === null) return NEUTRAL;
  return STATUS_META[statusFromScore(score)].color;
}

function severityHex(sev: number): string {
  if (sev >= 7) return BAD;
  if (sev >= 4) return "#e0641f";
  return GOOD;
}

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : "n/a";
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

// ---- Small building blocks ----

function SectionHeading({ title, hint, right, size = "md" }: { title: string; hint?: string; right?: ReactNode; size?: "md" | "sm" }) {
  return (
    <div className={`flex items-end justify-between gap-3 border-b-2 pb-2.5 ${size === "md" ? "mb-4" : "mb-3"}`} style={{ borderColor: `${GOLD_SOFT}66` }}>
      <div>
        <h3 className={`font-extrabold uppercase tracking-[0.14em] ${size === "md" ? "text-base" : "text-[13px]"}`} style={{ color: GOLD }}>
          {title}
        </h3>
        {hint && <p className="text-sm mt-1 leading-snug" style={{ color: INK_SOFT }}>{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function IconTile({ icon: Icon, color, size = 40 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{ width: size, height: size, background: `${color}14`, border: `1px solid ${color}40` }}
    >
      <Icon style={{ color, width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

function Pill({ color, children, strong = false, help }: { color: string; children: ReactNode; strong?: boolean; help?: string }) {
  const body = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 whitespace-nowrap ${strong ? "text-sm font-bold uppercase tracking-wide" : "text-[13px] font-semibold"} ${help ? "cursor-help" : ""}`}
      style={{ color, background: `${color}14`, border: `1px solid ${color}55` }}
    >
      {children}
    </span>
  );
  if (!help) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent className={`max-w-xs text-[13px] leading-snug ${LIGHT_POPOVER}`}>{help}</TooltipContent>
    </Tooltip>
  );
}

function StateBadge({ state }: { state: WwiState }) {
  const map: Record<WwiState, { label: string; color: string; help: string }> = {
    full: { label: "Complete data", color: GOOD, help: "Enough people contributed for every part of this section to be reported." },
    thin: { label: "Limited data", color: WARN, help: "The headline can be reported, but some parts are below the anonymity floor and are hidden." },
    empty: { label: "Not enough data", color: NEUTRAL, help: "Too few people contributed in this window for anything to be reported safely." },
  };
  const s = map[state];
  return <Pill color={s.color} help={s.help}>{s.label}</Pill>;
}

function StatusPill({ status }: { status: WwiStatus | null }) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <Pill color={m.color} strong help={m.blurb}>
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </Pill>
  );
}

function ConfidencePill({ confidence }: { confidence: WwiConfidence | null }) {
  if (!confidence) return null;
  const color = confidence === "high" ? GOOD : confidence === "medium" ? "#2f6fd6" : WARN;
  const label = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  return (
    <Pill color={color} help="Confidence reflects how much of the company contributed data in this window. High means 60% or more of staff, medium 25 to 60%, low under 25%.">
      {label} confidence <CircleHelp className="h-3.5 w-3.5 opacity-70" />
    </Pill>
  );
}

// Signed change vs the previous window. Values are on a higher-is-healthier scale.
function TrendChip({ current, previous, suffix = "vs last period" }: { current: number | null; previous: number | null; suffix?: string }) {
  if (current === null || previous === null) {
    return (
      <Pill color={NEUTRAL}><Minus className="h-3.5 w-3.5" /> First period</Pill>
    );
  }
  const d = Math.round(current - previous);
  if (d === 0) return <Pill color={NEUTRAL}>No change {suffix}</Pill>;
  const up = d > 0;
  const color = up ? GOOD : BAD;
  return (
    <Pill color={color}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{d} {suffix}
    </Pill>
  );
}

function WorsePill({ worsening }: { worsening: boolean | null }) {
  if (worsening === null) return <Pill color={NEUTRAL}><Minus className="h-3.5 w-3.5" /> First period</Pill>;
  const color = worsening ? BAD : GOOD;
  return (
    <Pill color={color}>
      {worsening ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {worsening ? "Worse than last period" : "Not worse than last period"}
    </Pill>
  );
}

// Where a 0-100 score sits across the three status bands.
function ScoreBandBar({ score, color }: { score: number; color: string }) {
  const left = Math.max(0, Math.min(100, score));
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${BAD} 0%, ${BAD} 50%, ${WARN} 50%, ${WARN} 70%, ${GOOD} 70%, ${GOOD} 100%)`, opacity: 0.85 }}>
        <span
          className="absolute -top-[5px] h-[22px] w-[22px] rounded-full border-[3px] border-white shadow-md"
          style={{ left: `calc(${left}% - 11px)`, background: color }}
        />
      </div>
      <div className="relative mt-2 h-4 text-xs font-semibold" style={{ color: INK_SOFT }}>
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
    <div className="rounded-2xl p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${color}12 0%, ${TILE_BG} 60%)`, border: `1px solid ${color}44` }}>
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="shrink-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-1" style={{ color: INK_SOFT }}>{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-black tracking-tight leading-none" style={{ color }}>
              {score !== null ? score.toFixed(0) : "n/a"}
            </span>
            <span className="text-lg font-semibold" style={{ color: INK_SOFT }}>/ 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <ConfidencePill confidence={confidence} />
            {previous !== undefined && <TrendChip current={score} previous={previous ?? null} />}
          </div>
          <p className="text-[15px] mt-3 leading-relaxed" style={{ color: INK }}>{explainer}</p>
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
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: TILE_BG, border: `1px solid ${LINE}` }}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: color ?? GOLD }} />}
        <span className="text-[15px] font-bold" style={{ color: INK }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-black leading-none" style={{ color: color ?? INK }}>{value}</span>
        {unit && <span className="text-sm font-semibold" style={{ color: INK_SOFT }}>{unit}</span>}
      </div>
      {sub && <p className="text-sm" style={{ color: INK_SOFT }}>{sub}</p>}
      {children}
    </div>
  );
}

function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "#e6e9ee" }}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

function EmptyDomain({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed p-5" style={{ borderColor: LINE, background: TILE_BG }}>
      <IconTile icon={Icon} color={NEUTRAL} />
      <div>
        <p className="text-[15px] font-bold" style={{ color: INK }}>Not enough data to report yet</p>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: INK_SOFT }}>{message}</p>
      </div>
    </div>
  );
}

function Card({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl p-5 sm:p-7 space-y-7 scroll-mt-20" style={{ background: CARD_BG, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(17,29,46,0.04), 0 8px 24px rgba(17,29,46,0.05)" }}>
      {children}
    </section>
  );
}

function CardHeader({ icon, title, subtitle, right }: { icon: LucideIcon; title: string; subtitle: string; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3.5">
        <IconTile icon={icon} color={NAVY} size={48} />
        <div>
          <h2 className="text-2xl font-extrabold leading-tight" style={{ color: INK }}>{title}</h2>
          <p className="text-[15px] mt-0.5" style={{ color: INK_SOFT }}>{subtitle}</p>
        </div>
      </div>
      {right}
    </header>
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
    <div className="flex items-start gap-4 rounded-xl px-5 py-4" style={{ background: "#fff8ec", border: `1px solid ${GOLD_SOFT}` }}>
      <IconTile icon={AlertTriangle} color={GOLD} size={40} />
      <div className="min-w-0">
        <p className="text-base font-extrabold" style={{ color: GOLD }}>
          Why this is rated {finalLabel}, not {rawLabel}
        </p>
        <p className="text-[15px] mt-1.5 leading-relaxed" style={{ color: INK }}>
          On the wellbeing score alone this team would read <strong>{rawLabel}</strong>. But {cause}, and the rating is capped at{" "}
          <strong>{cap}</strong> while anyone sits there. A cluster of people at serious risk outweighs a decent average. Bring
          those people down a band and the rating follows.
        </p>
      </div>
    </div>
  );
}

function CompositionRow({ c }: { c: WwiComponent }) {
  const meta = METRIC_META[c.metric] ?? { icon: Activity, color: NAVY, label: humanizeMetric(c.metric), blurb: "" };
  const color = scoreHex(c.contribution);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: TILE_BG, border: `1px solid ${LINE}` }}>
      <IconTile icon={meta.icon} color={meta.color} size={44} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base font-bold" style={{ color: INK }}>{meta.label}</span>
          {meta.blurb && <span className="text-sm" style={{ color: INK_SOFT }}>{meta.blurb}</span>}
        </div>
        <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>
          Team average <span className="font-semibold" style={{ color: INK }}>{c.rawAverage.toFixed(1)}</span> out of 5
          {c.lowerIsBetter && <span>. Lower is better</span>}
        </p>
        <div className="mt-2.5 max-w-md"><Bar value={c.contribution} color={color} height={7} /></div>
      </div>
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-3xl font-black leading-none" style={{ color }}>{c.contribution.toFixed(0)}</span>
          <span className="text-sm font-semibold" style={{ color: INK_SOFT }}>/ 100</span>
        </div>
        <div className="mt-2"><TrendChip current={c.contribution} previous={c.previousContribution} suffix="vs last" /></div>
      </div>
    </div>
  );
}

function SignalTile({ icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: number | null }) {
  return (
    <div className="rounded-xl p-4" style={{ background: TILE_BG, border: `1px solid ${LINE}` }}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} color={color} size={36} />
        <p className="text-[15px] font-bold" style={{ color: INK }}>{label}</p>
      </div>
      <p className="text-4xl font-black leading-none mt-4" style={{ color: INK }}>{pct(value)}</p>
      <p className="text-sm mt-1.5" style={{ color: INK_SOFT }}>Share of check-ins</p>
    </div>
  );
}

function BurnoutBlock({ b }: { b: NonNullable<MentalWellbeingDomain["burnout"]> }) {
  const rb = b.riskBands;
  const total = rb ? Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe) : 1;
  const avgColor = b.avgScore === null ? NEUTRAL : b.avgScore >= 60 ? BAD : b.avgScore >= 40 ? WARN : GOOD;
  const confColor = b.confidence === "high" ? GOOD : b.confidence === "medium" ? "#2f6fd6" : WARN;
  return (
    <div id="burnout" className="rounded-2xl p-5 sm:p-6 scroll-mt-20" style={{ background: "linear-gradient(180deg, #fbf7f1 0%, #ffffff 100%)", border: `1px solid ${GOLD_SOFT}` }}>
      <SectionHeading
        title="Burnout Index"
        hint="Structural burnout risk from the monthly assessment. Reported separately so the same distress isn't counted twice."
        right={
          <Pill color={confColor}>
            <Users className="h-3.5 w-3.5" /> {b.usersAssessed} assessed, {b.confidence} confidence
          </Pill>
        }
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <StatTile
          icon={ShieldAlert}
          label="Average burnout score"
          value={b.avgScore !== null ? b.avgScore.toFixed(0) : "n/a"}
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
        <div className="mt-6">
          <SectionHeading size="sm" title="Risk distribution" hint="How many people sit in each burnout band" />
          <div className="flex h-8 rounded-lg overflow-hidden" style={{ background: "#e6e9ee" }}>
            {BAND_META.map((bm) => {
              const n = rb[bm.key];
              if (n <= 0) return null;
              return (
                <div
                  key={bm.key}
                  className="flex items-center justify-center text-sm font-bold text-white"
                  style={{ width: `${(n / total) * 100}%`, background: bm.color, minWidth: 26 }}
                  title={`${bm.label}: ${n}`}
                >
                  {n}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {BAND_META.map((bm) => (
              <div key={bm.key} className="rounded-lg px-2 py-2.5 text-center" style={{ background: CARD_BG, border: `1px solid ${LINE}` }}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: bm.color }} />
                  <span className="text-xl font-black leading-none" style={{ color: bm.color }}>{rb[bm.key]}</span>
                </div>
                <p className="text-xs font-semibold mt-1.5" style={{ color: INK_SOFT }}>{bm.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {b.topDrivers.length > 0 && (
        <div className="mt-6">
          <SectionHeading size="sm" title="What's driving it" hint="Number of people reporting each driver" />
          <div className="flex flex-wrap gap-2">
            {b.topDrivers.map((t) => {
              const Icon = driverIcon(t.key, t.label);
              return (
                <span key={t.key} className="inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1.5" style={{ background: CARD_BG, border: `1px solid ${LINE}` }}>
                  <Icon className="h-4 w-4" style={{ color: GOLD }} />
                  <span className="text-sm font-semibold" style={{ color: INK }}>{t.label}</span>
                  <span className="text-sm font-black rounded-full px-2.5 py-0.5" style={{ color: NAVY, background: `${GOLD_SOFT}55` }}>{t.count}</span>
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
      <CardHeader icon={Brain} title="Mental Wellbeing" subtitle="How the team says it feels, from daily check-ins" right={<StateBadge state={d.state} />} />

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
              <SectionHeading title="What makes up the score" hint="Each check-in question, converted to a 0 to 100 health score. The four are averaged equally." />
              <div className="space-y-2.5">
                {d.components.map((c) => <CompositionRow key={c.metric} c={c} />)}
              </div>
            </div>
          )}

          {d.symptomSignals && (
            <div>
              <SectionHeading title="Symptom signals" hint="How often people ticked these in check-ins. Early-warning signals only, they don't feed the score." />
              <div className="grid sm:grid-cols-3 gap-3">
                <SignalTile icon={Wind} color="#7c4dcc" label="Anxious" value={d.symptomSignals.anxiousPercent} />
                <SignalTile icon={CloudRain} color="#1e88c7" label="Overwhelmed" value={d.symptomSignals.overwhelmedPercent} />
                <SignalTile icon={BatteryLow} color="#e0641f" label="Fatigue" value={d.symptomSignals.fatiguePercent} />
              </div>
            </div>
          )}

          {d.burnout && d.burnout.reportable && <BurnoutBlock b={d.burnout} />}

          {d.burnout && !d.burnout.reportable && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 text-[15px]" style={{ background: TILE_BG, border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: GOLD }} />
              <span>Burnout isn't reported yet. Only {people(d.burnout.usersAssessed)} completed the assessment in this window, which is below the anonymity floor.</span>
            </div>
          )}

          {d.divergence && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3.5 text-[15px]" style={{ background: "#eef4fb", border: "1px solid #c5d8f0", color: INK }}>
              <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#2f6fd6" }} />
              <span>{d.divergence}</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---- Physical Strain ----

function AreaRow({ a }: { a: PhysicalStrainDomain["areas"][number] }) {
  const color = severityHex(a.avgSeverity);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-4 py-3.5" style={{ background: TILE_BG, border: `1px solid ${LINE}` }}>
      <IconTile icon={Bone} color={color} size={44} />
      <div className="min-w-0">
        <p className="text-base font-bold" style={{ color: INK }}>{humanizeMetric(a.bodyPart)}</p>
        <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>{people(a.distinctReporters)} reported pain here</p>
        <div className="mt-2.5 max-w-md"><Bar value={a.avgSeverity * 10} color={color} height={7} /></div>
      </div>
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1">
          <span className="text-3xl font-black leading-none" style={{ color }}>{a.avgSeverity.toFixed(1)}</span>
          <span className="text-sm font-semibold" style={{ color: INK_SOFT }}>/ 10</span>
        </div>
        <p className="text-xs font-semibold mt-2" style={{ color: INK_SOFT }}>Average severity</p>
      </div>
    </div>
  );
}

function PhysicalStrainCard({ d }: { d: PhysicalStrainDomain }) {
  const prevColor = d.painPrevalencePercent === null ? NEUTRAL : d.painPrevalencePercent >= 50 ? BAD : d.painPrevalencePercent >= 25 ? WARN : GOOD;
  const sevColor = d.avgSeverity === null ? NEUTRAL : severityHex(d.avgSeverity);
  return (
    <Card id="physical">
      <CardHeader icon={Activity} title="Physical Strain" subtitle="Aches and pain among staff who log body-map data, not the whole workforce" right={<StateBadge state={d.state} />} />

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

          <div className="inline-flex items-center gap-2 text-[15px] rounded-full px-4 py-2" style={{ background: TILE_BG, border: `1px solid ${LINE}`, color: INK }}>
            <Users className="h-4 w-4" style={{ color: GOLD }} />
            <span><strong>{d.contributors}</strong> people logged body-map data <span style={{ color: INK_SOFT }}>({d.requiredContributors}+ needed to report)</span></span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <StatTile icon={Hand} label="Pain prevalence" value={pct(d.painPrevalencePercent)} sub="Of contributors reported pain" color={prevColor}>
              <Bar value={d.painPrevalencePercent ?? 0} color={prevColor} height={7} />
              <div><WorsePill worsening={d.worseningPrevalence} /></div>
            </StatTile>
            <StatTile icon={Flame} label="Average severity" value={d.avgSeverity !== null ? d.avgSeverity.toFixed(1) : "n/a"} unit="/ 10" sub="Among those reporting pain" color={sevColor}>
              <Bar value={(d.avgSeverity ?? 0) * 10} color={sevColor} height={7} />
              <div><WorsePill worsening={d.worseningSeverity} /></div>
            </StatTile>
          </div>

          {d.areas.length > 0 && (
            <div>
              <SectionHeading title="Where it hurts" hint="Only areas with 5 or more separate reporters are shown, so nobody can be singled out." />
              <div className="space-y-2.5">
                {d.areas.map((a) => <AreaRow key={a.bodyPart} a={a} />)}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---- At a glance ----

function GlanceTile({ icon, label, value, unit, status, sub, targetId, color }: {
  icon: LucideIcon; label: string; value: string; unit?: string; status?: WwiStatus | null; sub: string; targetId: string; color: string;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(targetId)}
      className="text-left rounded-2xl p-5 flex flex-col items-start justify-start transition-shadow hover:shadow-md focus:outline-none focus:ring-2"
      style={{ background: CARD_BG, border: `1px solid ${LINE}`, borderTop: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <IconTile icon={icon} color={NAVY} size={34} />
        <span className="text-[15px] font-bold" style={{ color: INK }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-5xl font-black leading-none" style={{ color }}>{value}</span>
        {unit && <span className="text-sm font-semibold" style={{ color: INK_SOFT }}>{unit}</span>}
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {status && <StatusPill status={status} />}
        <span className="text-sm" style={{ color: INK_SOFT }}>{sub}</span>
      </div>
    </button>
  );
}

function AtAGlance({ data }: { data: WwiResponse }) {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const b = m.burnout;
  const mColor = m.status ? STATUS_META[m.status].color : NEUTRAL;
  const pColor = p.status ? STATUS_META[p.status].color : NEUTRAL;
  const bColor = !b || !b.reportable ? NEUTRAL : b.severeTail > 0 ? BAD : GOOD;
  return (
    <div>
      <SectionHeading title="At a glance" hint="Select a tile to jump to the detail" />
      <div className="grid sm:grid-cols-3 gap-3">
        <GlanceTile
          icon={Brain} label="Mental Wellbeing" targetId="mental" color={mColor}
          value={m.score !== null ? m.score.toFixed(0) : "n/a"} unit={m.score !== null ? "/ 100" : undefined}
          status={m.status} sub={m.state === "empty" ? "Not enough data" : `${m.activeContributors} people checked in`}
        />
        <GlanceTile
          icon={ShieldAlert} label="Burnout risk" targetId="burnout" color={bColor}
          value={b && b.reportable ? String(b.severeTail) : "n/a"} unit={b && b.reportable ? `of ${b.usersAssessed} people` : undefined}
          sub={b && b.reportable ? `At high or severe risk. Average score ${b.avgScore !== null ? b.avgScore.toFixed(0) : "n/a"}, lower is better` : "Not enough assessments yet"}
        />
        <GlanceTile
          icon={Activity} label="Physical Strain" targetId="physical" color={pColor}
          value={p.score !== null ? p.score.toFixed(0) : "n/a"} unit={p.score !== null ? "/ 100" : undefined}
          status={p.status} sub={p.state === "empty" ? "Not enough data" : `${p.contributors} people logged body-map data`}
        />
      </div>
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

const WORDMARK_SRC = `${import.meta.env.BASE_URL}meridianwork-wordmark.png`;

// ---- Printable / PDF report ----

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function deltaChip(cur: number | null, prev: number | null): string {
  if (cur === null || prev === null) return '<span style="color:#6b7280;font-size:11px">First period</span>';
  const d = Math.round(cur - prev);
  if (d === 0) return '<span style="color:#6b7280;font-size:11px">No change vs last period</span>';
  const up = d > 0;
  return `<span style="color:${up ? GOOD : BAD};font-size:11px;font-weight:700">${up ? "▲ +" : "▼ "}${d} vs last period</span>`;
}

function bar(widthPct: number, color: string): string {
  const w = Math.max(0, Math.min(100, widthPct));
  return `<div style="height:8px;border-radius:6px;background:#e6e9ee;overflow:hidden;width:120px"><span style="display:block;height:100%;width:${w}%;background:${color};border-radius:6px"></span></div>`;
}

function guardCopy(m: MentalWellbeingDomain): string {
  const rb = m.burnout?.riskBands;
  if (!m.guardApplied || m.score === null || !m.status || !rb) return "";
  const rawLabel = STATUS_META[statusFromScore(m.score)].label;
  const finalLabel = STATUS_META[m.status].label;
  const cause = rb.severe > 0 ? `${people(rb.severe)} in the severe burnout band` : `${people(rb.high)} in the high burnout band`;
  return `Rated ${finalLabel} rather than ${rawLabel}. The wellbeing score alone would read ${rawLabel}, but with ${cause} the rating is capped. A cluster at serious risk outweighs a decent average.`;
}

function buildReportHtml(data: WwiResponse, windowLabel: string, dateStr: string, logoUrl: string | null): string {
  const m = data.domains.mentalWellbeing;
  const p = data.domains.physicalStrain;
  const company = escapeHtml(data.companyName);
  const origin = window.location.origin;
  const strainCol = (v: number) => (v >= 60 ? "#e0641f" : v >= 40 ? WARN : GOOD);
  const statusCol = (s: WwiStatus | null) => (s ? STATUS_META[s].color : NEUTRAL);
  const h = (t: string, extra = "") => `<div style="font-size:11.5px;text-transform:uppercase;letter-spacing:.9px;color:${GOLD};margin:18px 0 6px;font-weight:800;border-bottom:2px solid ${GOLD_SOFT}66;padding-bottom:4px">${t}${extra}</div>`;

  const rowGrid = (left: string, mid: string, right: string) =>
    `<div style="display:grid;grid-template-columns:1fr 120px 150px;align-items:center;gap:14px;padding:9px 0;border-top:1px solid #e6e9ee">
      <div style="font-size:14px;color:${NAVY}">${left}</div><div>${mid}</div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">${right}</div></div>`;

  let mentalHtml = "";
  if (m.state === "empty") {
    mentalHtml = `<p style="color:#6b7280;font-size:13px">${escapeHtml(m.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const comp = m.components.map((c) => {
      const label = `<b>${escapeHtml(METRIC_META[c.metric]?.label ?? humanizeMetric(c.metric))}</b> <span style="color:#6b7280;font-size:12px">team average ${c.rawAverage.toFixed(1)} / 5${c.lowerIsBetter ? ", lower is better" : ""}</span>`;
      const val = `<span style="font-weight:800;color:${scoreHex(c.contribution)}">${c.contribution.toFixed(0)} / 100</span>${deltaChip(c.contribution, c.previousContribution)}`;
      return rowGrid(label, bar(c.contribution, scoreHex(c.contribution)), val);
    }).join("");
    const ss = m.symptomSignals;
    const sig = ss ? [["Feeling anxious", ss.anxiousPercent], ["Feeling overwhelmed", ss.overwhelmedPercent], ["Fatigue", ss.fatiguePercent]]
      .map(([l, v]) => rowGrid(l as string, "", `<span style="font-weight:800">${v !== null ? (v as number).toFixed(1) + "%" : "n/a"}</span>`)).join("") : "";
    let burn = "";
    if (m.burnout && m.burnout.reportable && m.burnout.riskBands) {
      const b = m.burnout; const rb = b.riskBands!;
      const total = Math.max(1, rb.optimal + rb.mild + rb.moderate + rb.high + rb.severe);
      const seg = (n: number, c: string, lbl: string) => n > 0 ? `<span style="display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;width:${(n / total) * 100}%;background:${c}" title="${lbl}">${n}</span>` : "";
      const chips = b.topDrivers.map((t) => `<span style="background:#fff;border:1px solid #e6e9ee;border-radius:999px;padding:4px 11px;font-size:12px;color:${NAVY}">${escapeHtml(t.label)} <b style="background:${GOLD_SOFT}55;border-radius:999px;padding:1px 7px">${t.count}</b></span>`).join("");
      burn = `<div style="background:#fbf7f1;border:1px solid ${GOLD_SOFT};border-radius:11px;padding:16px;margin-top:12px">
        ${h(`Burnout Index`, ` <span style="text-transform:none;font-weight:600;letter-spacing:0;color:#6b7280">${b.usersAssessed} assessed, ${b.confidence} confidence</span>`)}
        <div style="display:flex;gap:26px;margin-bottom:10px">
          <div><div style="font-size:11px;color:#6b7280">Average score, lower is better</div><div style="font-size:22px;font-weight:900">${b.avgScore !== null ? b.avgScore.toFixed(0) : "n/a"}</div></div>
          <div><div style="font-size:11px;color:#6b7280">People at high or severe risk</div><div style="font-size:22px;font-weight:900;color:${BAD}">${b.severeTail} of ${b.usersAssessed}</div></div>
        </div>
        <div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:8px">${BAND_META.map((bm) => seg(rb[bm.key], bm.color, bm.label)).join("")}</div>
        <div style="font-size:11.5px;color:${NAVY};margin-bottom:10px">Optimal ${rb.optimal} · Mild ${rb.mild} · Moderate ${rb.moderate} · High ${rb.high} · Severe ${rb.severe}</div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px">What's driving it (people reporting each)</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${chips}</div></div>`;
    }
    const gc = guardCopy(m);
    const guard = gc ? `<div style="background:#fff8ec;color:${GOLD};border:1px solid ${GOLD_SOFT};border-radius:9px;padding:9px 12px;font-size:12.5px;margin:10px 0;font-weight:600">${escapeHtml(gc)}</div>` : "";
    mentalHtml = `
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:42px;font-weight:900;color:${statusCol(m.status)}">${m.score !== null ? m.score.toFixed(0) : "n/a"}</span><span style="color:#6b7280;font-size:14px">/ 100, wellbeing score</span><span style="margin-left:auto;text-align:right"><div style="font-weight:900;color:${statusCol(m.status)};font-size:14px;text-transform:uppercase">${m.status ?? ""}</div><div style="font-size:12px">${deltaChip(m.score, m.previousScore)}</div></span></div>
      <p style="color:#6b7280;font-size:12px;margin:0 0 4px">The average of how people rate their mood, energy, stress and clarity in check-ins. Higher is healthier. Burnout is assessed separately.</p>
      ${guard}
      ${h("What makes up the score")}${comp}
      ${h("Symptom signals", ' <span style="text-transform:none;font-weight:500;letter-spacing:0;color:#6b7280">(early-warning signals, not part of the score)</span>')}${sig}
      ${burn}`;
  }

  let physHtml = "";
  if (p.state === "empty") {
    physHtml = `<p style="color:#6b7280;font-size:13px">${escapeHtml(p.emptyReason || "Not enough data yet.")}</p>`;
  } else {
    const areas = p.areas.map((a) => rowGrid(`<b>${escapeHtml(humanizeMetric(a.bodyPart))}</b> <span style="color:#6b7280;font-size:12px">${a.distinctReporters} people</span>`, bar(a.avgSeverity * 10, strainCol(a.avgSeverity * 10)), `<span style="font-weight:800">${a.avgSeverity.toFixed(1)} / 10</span>`)).join("");
    const worse = (b: boolean | null) => b === null ? '<span style="color:#6b7280">first period</span>' : b ? `<span style="color:${BAD};font-weight:700">worse than last period</span>` : `<span style="color:${GOOD};font-weight:700">not worse than last period</span>`;
    physHtml = `
      <p style="color:#6b7280;font-size:12.5px;margin:0 0 2px">${escapeHtml(p.framing)} Modest weight in the overall picture.</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin:6px 0 2px"><span style="font-size:42px;font-weight:900;color:${statusCol(p.status)}">${p.score !== null ? p.score.toFixed(0) : "n/a"}</span><span style="color:#6b7280;font-size:14px">/ 100, physical strain score</span><span style="margin-left:auto;font-weight:900;color:${statusCol(p.status)};font-size:14px;text-transform:uppercase">${p.status ?? ""}</span></div>
      <p style="color:#6b7280;font-size:12.5px">${p.contributors} people logged body-map data (${p.requiredContributors}+ needed to report)</p>
      ${rowGrid("<b>Pain prevalence</b>, " + worse(p.worseningPrevalence), bar(p.painPrevalencePercent || 0, BAD), `<span style="font-weight:800">${p.painPrevalencePercent !== null ? p.painPrevalencePercent.toFixed(1) + "%" : "n/a"}</span>`)}
      ${rowGrid("<b>Average severity (0 to 10)</b>, " + worse(p.worseningSeverity), bar((p.avgSeverity || 0) * 10, "#e0641f"), `<span style="font-weight:800">${p.avgSeverity !== null ? p.avgSeverity.toFixed(1) : "n/a"}</span>`)}
      ${h("Where it hurts", ' <span style="text-transform:none;font-weight:500;letter-spacing:0;color:#6b7280">(areas with 5 or more separate reporters)</span>')}${areas}`;
  }

  const clientLogo = logoUrl ? `<img src="${escapeHtml(logoUrl.startsWith("http") ? logoUrl : origin + logoUrl)}" alt="${company}" style="height:44px;width:44px;border-radius:10px;object-fit:cover;background:#fff;border:1px solid rgba(255,255,255,.3)">` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wellbeing Index, ${company}</title>
<style>@page{margin:14mm} body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;color:${NAVY};margin:0;line-height:1.5}
.card{border:1px solid #e6e9ee;border-radius:14px;padding:20px 22px;margin:0 0 18px;break-inside:avoid}
.h1{font-size:18px;font-weight:800;margin:0 0 4px}</style></head>
<body>
<div style="background:${NAVY};color:#fff;padding:22px 26px;border-radius:14px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:16px">
  <div>
    <img src="${origin}${WORDMARK_SRC}" alt="MeridianWork" style="height:26px;display:block;margin-bottom:12px">
    <div style="font-size:22px;font-weight:800">Workforce Wellbeing Index</div>
    <div style="opacity:.85;font-size:13px;margin-top:6px">${company} · ${escapeHtml(windowLabel)} · generated ${escapeHtml(dateStr)}</div>
  </div>
  ${clientLogo}
</div>
<div class="card"><div class="h1">Mental Wellbeing</div>${mentalHtml}</div>
<div class="card"><div class="h1">Physical Strain</div>${physHtml}</div>
<p style="color:#6b7280;font-size:11px">Figures are aggregated across the anonymity floor (10 or more contributors) and contain no individually identifiable information.</p>
</body></html>`;
}

function downloadReport(data: WwiResponse, windowLabel: string, logoUrl: string | null) {
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  const selectedRecord = Array.isArray(companyRecords)
    ? companyRecords.find((c) => c.name?.trim().toLowerCase() === selectedCompany?.trim().toLowerCase())
    : undefined;
  const clientLogo = selectedRecord?.logoUrl ?? null;

  return (
    <div className="min-h-screen" style={{ ...LIGHT_VARS, background: PAGE_BG, color: INK }}>
      <TopHeader title="Wellbeing Index" onBack={() => navigate("/admin")} />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pt-16 sm:pt-16 pb-32">
        {/* Brand banner: navy field carrying the MeridianWork wordmark */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: NAVY, boxShadow: "0 10px 30px rgba(17,29,46,0.18)" }}>
          <div className="px-6 sm:px-8 pt-6 pb-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="min-w-0">
                <img src={WORDMARK_SRC} alt="MeridianWork" className="h-8 w-auto mb-5" />
                <h1 className="text-3xl font-black text-white leading-tight tracking-tight">Workforce Wellbeing Index</h1>
                <p className="text-[15px] mt-2 max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
                  Team-level health signals, built only from wellbeing data. Every figure sits above an anonymity floor, so no individual is ever identifiable.
                </p>
              </div>
              {data && (
                <div className="flex sm:flex-col items-start sm:items-end gap-3 shrink-0">
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    {clientLogo ? (
                      <img src={clientLogo} alt={data.companyName} className="h-11 w-11 rounded-lg object-cover bg-white" />
                    ) : (
                      <div className="h-11 w-11 rounded-lg flex items-center justify-center text-base font-black" style={{ background: GOLD_SOFT, color: NAVY }}>
                        {initials(data.companyName) || <Building2 className="h-5 w-5" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-base font-bold text-white leading-tight truncate max-w-[220px]">{data.companyName}</p>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {selectedSummary ? `${selectedSummary.userCount} people · ` : ""}{windowLabel}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1" style={{ color: GOLD_SOFT, border: `1px solid ${GOLD_SOFT}66` }}>
                    <Lock className="h-3.5 w-3.5" /> Anonymised, 10-person floor
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD_SOFT}66 60%, transparent)` }} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Select value={selectedCompany || ""} onValueChange={(v) => setSelectedCompany(v)}>
            <SelectTrigger className="bg-white border-[#e3e7ec] text-[#111d2e] w-auto max-w-[220px] sm:max-w-[280px] h-10 text-[15px]">
              <SelectValue placeholder="Select a company" className="truncate" />
            </SelectTrigger>
            <SelectContent className={LIGHT_POPOVER}>
              {companies.map((c) => (
                <SelectItem key={c.companyName} value={c.companyName} className="text-[#111d2e] focus:bg-[#eef0f3] focus:text-[#111d2e]">
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
            <SelectTrigger className="bg-white border-[#e3e7ec] text-[#111d2e] w-auto sm:w-44 h-10 text-[15px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={LIGHT_POPOVER}>
              <SelectItem value="7" className="text-[#111d2e] focus:bg-[#eef0f3] focus:text-[#111d2e]">Last 7 days</SelectItem>
              <SelectItem value="30" className="text-[#111d2e] focus:bg-[#eef0f3] focus:text-[#111d2e]">Last 30 days</SelectItem>
              <SelectItem value="90" className="text-[#111d2e] focus:bg-[#eef0f3] focus:text-[#111d2e]">Last 90 days</SelectItem>
              <SelectItem value="custom" className="text-[#111d2e] focus:bg-[#eef0f3] focus:text-[#111d2e]">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {data && !isFetching && !error && (
            <button
              onClick={() => downloadReport(data, windowLabel, clientLogo)}
              className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-md text-[15px] font-bold transition-opacity hover:opacity-90 sm:ml-auto text-white"
              style={{ background: NAVY }}
              title="Open a printable report, then use your browser's Save as PDF"
            >
              <Download className="h-4 w-4" style={{ color: GOLD_SOFT }} /> Download PDF
            </button>
          )}
        </div>

        {timeWindow === "custom" && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}>
              From
              <input
                type="date"
                value={customStartDate}
                max={customEndDate || undefined}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-[#e3e7ec] rounded-md px-2 py-1.5 text-sm text-[#111d2e]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}>
              To
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || undefined}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-[#e3e7ec] rounded-md px-2 py-1.5 text-sm text-[#111d2e]"
              />
            </label>
            <span className="text-sm" style={{ color: INK_SOFT }}>Range must be at least 7 days.</span>
          </div>
        )}

        {!selectedCompany && (
          <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "#cfd5dd", background: CARD_BG }}>
            <div className="mx-auto mb-3 w-fit"><IconTile icon={Brain} color={NAVY} size={52} /></div>
            <p className="text-base font-bold" style={{ color: INK }}>Select a company to view its Wellbeing Index</p>
            <p className="text-sm mt-1" style={{ color: INK_SOFT }}>Mental wellbeing, burnout risk and physical strain, reported at team level.</p>
          </div>
        )}

        {selectedCompany && isFetching && (
          <div className="rounded-2xl p-10 text-center text-[15px]" style={{ background: CARD_BG, border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Loading…
          </div>
        )}

        {selectedCompany && !isFetching && error && (
          <div className="rounded-2xl p-4 text-[15px]" style={{ background: "#fdecec", border: `1px solid ${BAD}55`, color: BAD }}>
            {(error as Error).message}
          </div>
        )}

        {selectedCompany && !isFetching && !error && data && (
          <div className="space-y-6">
            <AtAGlance data={data} />
            <MentalWellbeingCard d={data.domains.mentalWellbeing} />
            <PhysicalStrainCard d={data.domains.physicalStrain} />
            <p className="text-sm text-center pt-2" style={{ color: INK_SOFT }}>
              {data.companyName} · {windowLabel} · figures aggregated above the anonymity floor
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
