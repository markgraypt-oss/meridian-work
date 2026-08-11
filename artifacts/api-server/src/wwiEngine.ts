// Workforce Wellbeing Index (WWI) engine.
// Spec: claude_workforce-wellbeing-index-spec.md. Health domains only.
// CONTAINMENT: builds ONLY from the floored reporting engine output.
// Never reads engagement/points data, product usage, or Daily Readiness.
// Personal-only scores are inputs a person sees, never cohort ingredients.

import type { CompanyReport, EffectiveReportSettings } from "./reportingEngine";

export type WwiState = "empty" | "thin" | "full";
export type WwiStatus = "steady" | "mixed" | "strained";
export type WwiConfidence = "low" | "medium" | "high";

export interface WwiComponent {
  metric: string;
  rawAverage: number;      // on its native 1-5 scale
  lowerIsBetter: boolean;
  contribution: number;    // 0-100, higher is healthier
}

export interface MentalWellbeingDomain {
  domain: "mental_wellbeing";
  state: WwiState;
  score: number | null;            // 0-100, higher is healthier, felt layer ONLY
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
  const parts: WwiComponent[] = [];
  if (m.avgMood != null) parts.push({ metric: "mood", rawAverage: m.avgMood, lowerIsBetter: false, contribution: contribution(m.avgMood, false) });
  if (m.avgEnergy != null) parts.push({ metric: "energy", rawAverage: m.avgEnergy, lowerIsBetter: false, contribution: contribution(m.avgEnergy, false) });
  if (m.avgStress != null) parts.push({ metric: "stress", rawAverage: m.avgStress, lowerIsBetter: true, contribution: contribution(m.avgStress, true) });
  if (m.avgClarity != null) parts.push({ metric: "clarity", rawAverage: m.avgClarity, lowerIsBetter: false, contribution: contribution(m.avgClarity, false) });

  if (!parts.length) {
    base.emptyReason = "Check-ins in this window contain no core wellbeing scores.";
    return base;
  }

  const score = round1(parts.reduce((s, p) => s + p.contribution, 0) / parts.length);
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
