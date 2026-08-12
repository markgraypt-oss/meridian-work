// Workforce Wellbeing Index (WWI) engine.
// Spec: claude_workforce-wellbeing-index-spec.md. Health domains only.
// CONTAINMENT: builds ONLY from the floored reporting engine output.
// Never reads engagement/points data, product usage, or Daily Readiness.
// Personal-only scores are inputs a person sees, never cohort ingredients.

import type { CompanyReport, EffectiveReportSettings, TrendDirection } from "./reportingEngine";

export type WwiState = "empty" | "thin" | "full";
export type WwiStatus = "steady" | "mixed" | "strained";
export type WwiConfidence = "low" | "medium" | "high";

export interface WwiComponent {
  metric: string;
  rawAverage: number;      // on its native 1-5 scale
  lowerIsBetter: boolean;
  contribution: number;    // 0-100, higher is healthier
  previousContribution: number | null;  // same metric, previous window (0-100), null if no prior
  trend: TrendDirection | null;          // improving/stable/declining vs previous window
}

// Direction of change between two 0-100 health contributions (higher = healthier).
// Uses a small dead-band so tiny wobble reads as "stable".
function trendFrom(current: number, previous: number | null): TrendDirection | null {
  if (previous == null) return null;
  const d = current - previous;
  if (d >= 2) return "improving";
  if (d <= -2) return "declining";
  return "stable";
}

export interface MentalWellbeingDomain {
  domain: "mental_wellbeing";
  state: WwiState;
  score: number | null;            // 0-100, higher is healthier, felt layer ONLY
  previousScore: number | null;    // felt score for the previous window, null if no prior
  scoreTrend: TrendDirection | null; // headline direction vs previous window
  status: WwiStatus | null;        // after the burnout override guard
  guardApplied: boolean;           // true when burnout tail capped the status
  confidence: WwiConfidence | null;
  components: WwiComponent[];      // transparent composition of the score
  symptomSignals: {                // shown as signals, NOT part of the score
    anxiousPercent: number | null;
    overwhelmedPercent: number | null;
    fatiguePercent: number | null;
  } | null;
  burnout: {
    reportable: boolean;
    avgScore: number | null;       // 0-100, lower is better
    previousAvgScore: number | null;
    worsening: boolean | null;     // computed from the two numbers, never from labels
    usersAssessed: number;
    confidence: WwiConfidence;
    riskBands: { optimal: number; mild: number; moderate: number; high: number; severe: number } | null;
    severeTail: number;            // people in high + severe bands
    topDrivers: { key: string; label: string; count: number }[];
  } | null;
  divergence: string | null;
  emptyReason: string | null;
  activeContributors: number;
  requiredContributors: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Normalise a 1-5 check-in average to a 0-100 health contribution.
function contribution(avg: number, lowerIsBetter: boolean): number {
  const c = lowerIsBetter ? ((5 - avg) / 4) * 100 : ((avg - 1) / 4) * 100;
  return round1(clamp(c, 0, 100));
}

function coverageConfidence(contributors: number, totalUsers: number): WwiConfidence {
  if (totalUsers <= 0) return "low";
  const rate = contributors / totalUsers;
  if (rate < 0.25) return "low";
  if (rate < 0.6) return "medium";
  return "high";
}

export function computeMentalWellbeing(
  report: CompanyReport,
  settings: EffectiveReportSettings
): MentalWellbeingDomain {
  const m = report.metrics;
  const activeContributors = m?.uniqueUsers ?? 0;
  const required = settings.minActiveUsers;

  const base: MentalWellbeingDomain = {
    domain: "mental_wellbeing",
    state: "empty",
    score: null,
    previousScore: null,
    scoreTrend: null,
    status: null,
    guardApplied: false,
    confidence: null,
    components: [],
    symptomSignals: null,
    burnout: null,
    divergence: null,
    emptyReason: null,
    activeContributors,
    requiredContributors: required,
  };

  // EMPTY STATE: below floor or no data. No score, no fabricated zero or fifty.
  if (!report.eligible || !m || activeContributors < required) {
    base.emptyReason = `Not enough data to report yet. ${activeContributors} of ${report.totalUsersInCompany} people active in this window; at least ${required} needed.`;
    return base;
  }

  // FELT LAYER: the clean pulse. Feeds the headline. Burnout is NOT in here,
  // because burnout is partly computed from the same stress/fatigue signals and
  // averaging the two would count the same distress twice.
  const pm = report.previousMetrics;
  const comp = (metric: string, avg: number, prevAvg: number | null | undefined, lowerIsBetter: boolean): WwiComponent => {
    const cur = contribution(avg, lowerIsBetter);
    const prev = prevAvg != null ? contribution(prevAvg, lowerIsBetter) : null;
    return { metric, rawAverage: avg, lowerIsBetter, contribution: cur, previousContribution: prev, trend: trendFrom(cur, prev) };
  };

  const parts: WwiComponent[] = [];
  if (m.avgMood != null) parts.push(comp("mood", m.avgMood, pm?.avgMood, false));
  if (m.avgEnergy != null) parts.push(comp("energy", m.avgEnergy, pm?.avgEnergy, false));
  if (m.avgStress != null) parts.push(comp("stress", m.avgStress, pm?.avgStress, true));
  if (m.avgClarity != null) parts.push(comp("clarity", m.avgClarity, pm?.avgClarity, false));

  if (!parts.length) {
    base.emptyReason = "Check-ins in this window contain no core wellbeing scores.";
    return base;
  }

  const score = round1(parts.reduce((s, p) => s + p.contribution, 0) / parts.length);
  // Previous felt score: average of the previous-window contributions, using only
  // the metrics that actually have a prior value (like-for-like comparison).
  const prevParts = parts.filter(p => p.previousContribution != null);
  const previousScore = prevParts.length
    ? round1(prevParts.reduce((s, p) => s + (p.previousContribution as number), 0) / prevParts.length)
    : null;
  let status: WwiStatus = score >= 70 ? "steady" : score >= 50 ? "mixed" : "strained";

  // BURNOUT LAYER: flagship diagnostic, own floor, own confidence.
  // All comparisons computed from numbers, never from direction labels.
  const b = report.burnoutStats;
  let burnout: MentalWellbeingDomain["burnout"] = null;
  let guardApplied = false;
  if (b && b.avgScore != null && b.usersAssessed >= settings.minCohortSize) {
    const severeTail = (b.riskBands?.high ?? 0) + (b.riskBands?.severe ?? 0);
    const worsening = b.previousAvgScore != null ? b.avgScore > b.previousAvgScore : null;
    burnout = {
      reportable: true,
      avgScore: b.avgScore,
      previousAvgScore: b.previousAvgScore,
      worsening,
      usersAssessed: b.usersAssessed,
      confidence: coverageConfidence(b.usersAssessed, activeContributors),
      riskBands: b.riskBands ?? null,
      severeTail,
      topDrivers: b.topDrivers ?? [],
    };
    // EARNED-GREEN GUARD: the tail governs, not the mean. A severe cluster
    // forbids a healthy read regardless of the felt average.
    if ((b.riskBands?.severe ?? 0) > 0 && status !== "strained") {
      status = "strained"; guardApplied = true;
    } else if ((b.riskBands?.high ?? 0) > 0 && status === "steady") {
      status = "mixed"; guardApplied = true;
    }
    // WITHIN-DOMAIN DIVERGENCE: feeling fine while structural markers worsen.
    if (score >= 65 && worsening === true) {
      base.divergence = "The workforce reports feeling okay, but structural burnout markers are worsening.";
    }
  } else if (b && b.avgScore != null) {
    burnout = {
      reportable: false,
      avgScore: null,
      previousAvgScore: null,
      worsening: null,
      usersAssessed: b.usersAssessed,
      confidence: "low",
      riskBands: null,
      severeTail: 0,
      topDrivers: [],
    };
  }

  base.state = burnout && burnout.reportable ? "full" : "thin";
  base.score = score;
  base.previousScore = previousScore;
  base.scoreTrend = trendFrom(score, previousScore);
  base.status = status;
  base.guardApplied = guardApplied;
  base.confidence = coverageConfidence(activeContributors, report.totalUsersInCompany);
  base.components = parts;
  base.symptomSignals = {
    anxiousPercent: m.anxiousPercent,
    overwhelmedPercent: m.overwhelmedPercent,
    fatiguePercent: m.fatiguePercent,
  };
  base.burnout = burnout;
  return base;
}


export interface PhysicalStrainDomain {
  domain: "physical_strain";
  state: WwiState;
  score: number | null;            // 0-100, higher is healthier
  status: WwiStatus | null;
  confidence: WwiConfidence | null;
  headlineWeight: "modest";        // spec: modest weight into the composite, strong section
  framing: string;                 // always "among contributors", never "the workforce"
  contributors: number;            // distinct people who logged body-map data in window
  requiredContributors: number;
  painPrevalencePercent: number | null;   // % of CONTRIBUTORS with severity >= threshold
  avgSeverity: number | null;             // 0-10 among significant reports
  worseningPrevalence: boolean | null;    // numeric comparison, company-denominator trend
  worseningSeverity: boolean | null;
  components: { metric: string; value: number; contribution: number }[];
  // Areas arrive already double-floored by the reporting engine:
  // severity >= threshold AND >= 5 distinct reporters per area.
  areas: { bodyPart: string; distinctReporters: number; avgSeverity: number }[];
  emptyReason: string | null;
}

export function computePhysicalStrain(
  report: CompanyReport,
  settings: EffectiveReportSettings
): PhysicalStrainDomain {
  const bm = report.bodyMapStats;
  const contributors = bm?.usersWithAssessments ?? 0;
  const required = settings.minActiveUsers;

  const base: PhysicalStrainDomain = {
    domain: "physical_strain",
    state: "empty",
    score: null,
    status: null,
    confidence: null,
    headlineWeight: "modest",
    framing: "Among staff logging musculoskeletal data, not the whole workforce.",
    contributors,
    requiredContributors: required,
    painPrevalencePercent: null,
    avgSeverity: null,
    worseningPrevalence: null,
    worseningSeverity: null,
    components: [],
    areas: [],
    emptyReason: null,
  };

  // EMPTY STATE: domain floor is distinct body-map contributors, not check-ins.
  if (!report.eligible || !bm || contributors < required) {
    base.emptyReason = `Not enough body-map data to report yet. ${contributors} of ${report.totalUsersInCompany} people logged musculoskeletal data in this window; at least ${required} needed.`;
    return base;
  }

  // Prevalence AMONG CONTRIBUTORS (framing discipline), from distinct-person counts.
  const prevalence = round1(clamp((bm.usersWithPain / contributors) * 100, 0, 100));
  const parts: PhysicalStrainDomain["components"] = [
    { metric: "pain_free_share", value: prevalence, contribution: round1(100 - prevalence) },
  ];
  if (bm.avgSeverity != null) {
    parts.push({ metric: "severity", value: bm.avgSeverity, contribution: round1(clamp(100 - bm.avgSeverity * 10, 0, 100)) });
  }
  const score = round1(parts.reduce((s, c) => s + c.contribution, 0) / parts.length);

  base.state = (bm.topBodyAreas?.length ?? 0) > 0 ? "full" : "thin";
  base.score = score;
  base.status = score >= 70 ? "steady" : score >= 50 ? "mixed" : "strained";
  base.confidence = coverageConfidence(contributors, report.totalUsersInCompany);
  base.painPrevalencePercent = prevalence;
  base.avgSeverity = bm.avgSeverity;
  // Numeric comparisons only, never direction labels.
  base.worseningPrevalence = bm.previousUsersReportingPainPercent != null
    ? bm.usersReportingPainPercent > bm.previousUsersReportingPainPercent : null;
  base.worseningSeverity = (bm.avgSeverity != null && bm.previousAvgSeverity != null)
    ? bm.avgSeverity > bm.previousAvgSeverity : null;
  base.components = parts;
  base.areas = (bm.topBodyAreas ?? []).map(a => ({
    bodyPart: a.bodyPart,
    distinctReporters: a.count,
    avgSeverity: a.avgSeverity,
  }));
  return base;
}
