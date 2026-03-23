import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import TopHeader from "@/components/TopHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Brain, Heart, Users, Activity, BarChart3, Calendar as CalendarIcon, ChevronRight, Download, CheckCircle2, AlertCircle, Info, Lightbulb, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parse } from "date-fns";

type CompanySummary = {
  companyName: string;
  userCount: number;
  eligible: boolean;
};

type AggregateMetrics = {
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  avgSleep: number | null;
  avgClarity: number | null;
  headachePercent: number | null;
  alcoholPercent: number | null;
  sickPercent: number | null;
  painOrInjuryPercent: number | null;
  anxiousPercent: number | null;
  overwhelmedPercent: number | null;
  fatiguePercent: number | null;
  fatigueTriggerPercent: number | null;
  exercisedYesterdayPercent: number | null;
  caffeineAfter2pmPercent: number | null;
  practicedMindfulnessPercent: number | null;
  emotionallyStablePercent: number | null;
  totalCheckIns: number;
  uniqueUsers: number;
};

type TrendDirection = "improving" | "stable" | "declining";

type RiskLevel = "low" | "moderate" | "high";

type BodyMapStats = {
  usersReportingPainPercent: number;
  totalAssessments: number;
  avgSeverity: number | null;
  topBodyAreas: { bodyPart: string; count: number; avgSeverity: number; trend?: TrendDirection }[];
  painPercentTrend: TrendDirection | null;
  severityTrend: TrendDirection | null;
  previousUsersReportingPainPercent: number | null;
  previousAvgSeverity: number | null;
};

type BurnoutStats = {
  avgScore: number | null;
  usersAssessed: number;
  totalCheckIns: number;
  trajectoryDistribution: { stable: number; rising: number; elevated: number; recovering: number };
  topDrivers: { key: string; label: string; count: number }[];
  riskBands: { optimal: number; mild: number; moderate: number; high: number; severe: number };
  previousAvgScore: number | null;
  trend: TrendDirection | null;
};

type CompanyReport = {
  companyName: string;
  window: string;
  eligible: boolean;
  reason?: string;
  totalUsersInCompany: number;
  metrics: AggregateMetrics | null;
  previousMetrics: AggregateMetrics | null;
  trends: { mood: TrendDirection; energy: TrendDirection; stress: TrendDirection; sleep: TrendDirection; clarity: TrendDirection } | null;
  risks: {
    recoveryRisk: RiskLevel;
    cognitiveStrainRisk: RiskLevel;
    emotionalStrainRisk: RiskLevel;
    recoveryFactors: string[];
    cognitiveFactors: string[];
    emotionalFactors: string[];
  } | null;
  participation: {
    totalUsersInCompany: number;
    activeUsersInWindow: number;
    participationRate: number;
    changeVsPrevious: number | null;
  } | null;
  monthOverMonth: {
    currentMonth: string;
    previousMonth: string;
    current: AggregateMetrics | null;
    previous: AggregateMetrics | null;
  } | null;
  bodyMapStats: BodyMapStats | null;
  burnoutStats: BurnoutStats | null;
};

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === "improving") return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (direction === "declining") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function TrendBadge({ direction, label }: { direction: TrendDirection; label: string }) {
  const colors = {
    improving: "bg-green-500/20 text-green-400 border-green-500/30",
    stable: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    declining: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colors[direction]}`}>
      <TrendIcon direction={direction} />
      {label}
    </span>
  );
}

function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  const colors = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    moderate: "bg-[#0cc9a9]/20 text-[#0cc9a9] border-[#0cc9a9]/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${colors[level]}`}>
      {level === "high" && <AlertTriangle className="h-3 w-3" />}
      {label}: {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function ScoreCard({ label, value, suffix, icon: Icon, trend }: { label: string; value: number | null; suffix?: string; icon?: any; trend?: TrendDirection }) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-[#0cc9a9]" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-foreground">
          {value !== null ? value.toFixed(1) : "---"}
        </span>
        {suffix && <span className="text-sm text-muted-foreground mb-0.5">{suffix}</span>}
      </div>
      {trend && (
        <div className="mt-2">
          <TrendBadge direction={trend} label={trend} />
        </div>
      )}
    </div>
  );
}

function PercentCard({ label, value, threshold, invertWarning }: { label: string; value: number | null; threshold?: number; invertWarning?: boolean }) {
  const isWarning = value !== null && threshold !== undefined
    ? invertWarning ? value < threshold : value > threshold
    : false;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-card border border-border">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${isWarning ? "text-red-400" : "text-foreground"}`}>
        {value !== null ? `${value.toFixed(1)}%` : "---"}
      </span>
    </div>
  );
}

function formatBodyPart(part: string): string {
  return part
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getParticipationQuality(rate: number): { label: string; color: string; icon: any } {
  if (rate >= 75) return { label: "High", color: "text-green-400", icon: CheckCircle2 };
  if (rate >= 60) return { label: "Medium", color: "text-[#0cc9a9]", icon: Info };
  return { label: "Low", color: "text-amber-400", icon: AlertCircle };
}

function computeProtectiveScore(metrics: AggregateMetrics): { score: number; trend: string } {
  const exercised = metrics.exercisedYesterdayPercent ?? 0;
  const mindfulness = metrics.practicedMindfulnessPercent ?? 0;
  const stable = metrics.emotionallyStablePercent ?? 0;
  const lowCaffeine = 100 - (metrics.caffeineAfter2pmPercent ?? 0);
  const score = Math.round((exercised * 0.25 + mindfulness * 0.25 + stable * 0.25 + lowCaffeine * 0.25) * 10) / 10;
  let trend = "Moderate";
  if (score >= 60) trend = "Strong";
  else if (score < 40) trend = "Needs attention";
  return { score, trend };
}

function getRecommendedActions(risks: CompanyReport["risks"], metrics: AggregateMetrics | null): string[] {
  if (!risks || !metrics) return [];
  const actions: string[] = [];

  if (risks.recoveryRisk === "high") {
    actions.push("Consider reviewing workload distribution and promoting recovery practices across teams.");
  } else if (risks.recoveryRisk === "moderate") {
    actions.push("Monitor recovery signals closely and encourage regular breaks and sleep hygiene.");
  }

  if (risks.cognitiveStrainRisk === "high") {
    actions.push("Evaluate meeting load and deep-work time allocation. Consider cognitive wellness workshops.");
  } else if (risks.cognitiveStrainRisk === "moderate") {
    actions.push("Review afternoon scheduling patterns and encourage focus-time blocks.");
  }

  if (risks.emotionalStrainRisk === "high") {
    actions.push("Prioritise mental health support access and consider team resilience training.");
  } else if (risks.emotionalStrainRisk === "moderate") {
    actions.push("Ensure psychological safety channels are visible and accessible to all team members.");
  }

  if (metrics.exercisedYesterdayPercent !== null && metrics.exercisedYesterdayPercent < 30) {
    actions.push("Physical activity rates are low. Consider movement challenges or subsidised fitness options.");
  }

  if (metrics.practicedMindfulnessPercent !== null && metrics.practicedMindfulnessPercent < 15) {
    actions.push("Mindfulness adoption is minimal. Guided sessions or app access could improve uptake.");
  }

  return actions.slice(0, 4);
}

function getBurnoutConfidence(usersAssessed: number, totalUsers: number, totalCheckIns: number): { label: string; color: string; bgClass: string } {
  const participation = totalUsers > 0 ? (usersAssessed / totalUsers) * 100 : 0;

  if (participation >= 70) {
    return { label: "High", color: "text-muted-foreground", bgClass: "" };
  }
  if (participation >= 40) {
    return { label: "Medium", color: "text-muted-foreground", bgClass: "" };
  }
  return { label: "Low", color: "text-amber-400", bgClass: "bg-amber-500/10 border border-amber-500/20 rounded-lg p-3" };
}

function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function exportReportToCSV(report: CompanyReport, timeWindow: string, showMonthOverMonth: boolean, customStartDate?: string, customEndDate?: string) {
  const num = (v: number | null, dp = 2) => v !== null ? v.toFixed(dp) : "";
  const pct = (v: number | null, dp = 1) => v !== null ? v.toFixed(dp) : "";
  const e = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headerStyle = 'style="background-color:#1a1a2e;color:#0cc9a9;font-weight:bold;font-size:14px;padding:8px 12px;border:1px solid #333"';
  const labelStyle = 'style="background-color:#16213e;color:#e0e0e0;font-weight:bold;padding:6px 12px;border:1px solid #333"';
  const colHeaderStyle = 'style="background-color:#0f3460;color:#ffffff;font-weight:bold;padding:6px 12px;border:1px solid #333"';
  const cellStyle = 'style="background-color:#1a1a2e;color:#e0e0e0;padding:6px 12px;border:1px solid #333"';
  const emptyStyle = 'style="background-color:#0d1117;border:none"';

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:spreadsheet" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>td,th{mso-number-format:'\\@';}</style></head>
<body><table>`;

  const emptyRow = () => `<tr><td ${emptyStyle}></td><td ${emptyStyle}></td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
  const sectionHeader = (title: string, sub = "") => `<tr><td colspan="4" ${headerStyle}>${e(title)}${sub ? " " + e(sub) : ""}</td></tr>`;

  html += `<tr><td colspan="4" style="background-color:#0d1117;color:#0cc9a9;font-weight:bold;font-size:18px;padding:12px;border:none">Company Report Export</td></tr>`;
  html += emptyRow();
  html += `<tr><td ${labelStyle}>Company</td><td colspan="3" ${cellStyle}>${e(report.companyName)}</td></tr>`;
  let dateRangeStr = "";
  if (timeWindow === "custom" && customStartDate && customEndDate) {
    const startFmt = new Date(customStartDate).toLocaleDateString("en-GB");
    const endFmt = new Date(customEndDate).toLocaleDateString("en-GB");
    dateRangeStr = `${startFmt} - ${endFmt}`;
  } else {
    const days = parseInt(timeWindow) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    dateRangeStr = `${startDate.toLocaleDateString("en-GB")} - ${endDate.toLocaleDateString("en-GB")}`;
  }
  html += `<tr><td ${labelStyle}>Report Period</td><td colspan="3" ${cellStyle}>${e(report.window)}</td></tr>`;
  html += `<tr><td ${labelStyle}>Date Range</td><td colspan="3" ${cellStyle}>${e(dateRangeStr)}</td></tr>`;
  html += `<tr><td ${labelStyle}>Export Date</td><td colspan="3" ${cellStyle}>${new Date().toLocaleDateString("en-GB")}</td></tr>`;
  html += emptyRow();

  if (report.participation) {
    html += sectionHeader("PARTICIPATION");
    html += `<tr><td ${colHeaderStyle}>Metric</td><td ${colHeaderStyle}>Value</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Total Users</td><td ${cellStyle}>${report.participation.totalUsersInCompany}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Active in Window</td><td ${cellStyle}>${report.participation.activeUsersInWindow}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    const pQuality = getParticipationQuality(report.participation.participationRate);
    html += `<tr><td ${labelStyle}>Participation Rate</td><td ${cellStyle}>${report.participation.participationRate}%</td><td ${cellStyle}>${pQuality.label} quality</td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Change vs Previous Period</td><td ${cellStyle}>${report.participation.changeVsPrevious !== null ? report.participation.changeVsPrevious + "%" : "---"}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Total Check-ins</td><td ${cellStyle}>${report.metrics?.totalCheckIns ?? 0}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Unique Users Checked In</td><td ${cellStyle}>${report.metrics?.uniqueUsers ?? 0}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    if (report.participation.participationRate < 60) {
      html += `<tr><td colspan="4" style="background-color:#3d2800;color:#fbbf24;padding:6px 12px;border:1px solid #333">Note: Participation below 60% - data reliability may be reduced</td></tr>`;
    }
    html += emptyRow();
  }

  if (report.metrics) {
    const m = report.metrics;
    const t = report.trends;

    html += sectionHeader("CORE WELLBEING SCORES", "(1-5 scale)");
    html += `<tr><td ${colHeaderStyle}>Metric</td><td ${colHeaderStyle}>Score</td><td ${colHeaderStyle}>Trend</td><td ${emptyStyle}></td></tr>`;
    const scores = [
      { label: "Mood", val: m.avgMood, trend: t?.mood },
      { label: "Energy", val: m.avgEnergy, trend: t?.energy },
      { label: "Stress", val: m.avgStress, trend: t?.stress },
      { label: "Sleep", val: m.avgSleep, trend: t?.sleep },
      { label: "Clarity", val: m.avgClarity, trend: t?.clarity },
    ];
    for (const s of scores) {
      html += `<tr><td ${labelStyle}>${s.label}</td><td ${cellStyle}>${num(s.val)}</td><td ${cellStyle}>${s.trend ?? ""}</td><td ${emptyStyle}></td></tr>`;
    }
    html += emptyRow();

    html += sectionHeader("HEALTH SIGNALS", "(% of check-ins)");
    html += `<tr><td ${colHeaderStyle}>Signal</td><td ${colHeaderStyle}>% Reporting</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    const signals = [
      { label: "Headache", val: m.headachePercent },
      { label: "Alcohol Consumed", val: m.alcoholPercent },
      { label: "Sick", val: m.sickPercent },
      { label: "Pain / Injury", val: m.painOrInjuryPercent },
      { label: "Anxious", val: m.anxiousPercent },
      { label: "Overwhelmed", val: m.overwhelmedPercent },
      { label: "Fatigue", val: m.fatiguePercent },
      { label: "Fatigue Trigger Met", val: m.fatigueTriggerPercent },
    ];
    for (const s of signals) {
      html += `<tr><td ${labelStyle}>${s.label}</td><td ${cellStyle}>${pct(s.val)}${s.val !== null ? "%" : ""}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    }
    html += emptyRow();

    const pScore = computeProtectiveScore(m);
    html += sectionHeader("PROTECTIVE BEHAVIOURS", "(% of check-ins)");
    html += `<tr><td ${colHeaderStyle}>Composite Score</td><td ${colHeaderStyle}>${pScore.score} / 100</td><td ${colHeaderStyle}>${pScore.trend}</td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${colHeaderStyle}>Behaviour</td><td ${colHeaderStyle}>% Reporting</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    const behaviours = [
      { label: "Exercised Yesterday", val: m.exercisedYesterdayPercent },
      { label: "Practiced Mindfulness", val: m.practicedMindfulnessPercent },
      { label: "Emotionally Stable", val: m.emotionallyStablePercent },
      { label: "Caffeine After 2pm", val: m.caffeineAfter2pmPercent },
    ];
    for (const s of behaviours) {
      html += `<tr><td ${labelStyle}>${s.label}</td><td ${cellStyle}>${pct(s.val)}${s.val !== null ? "%" : ""}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    }
    html += emptyRow();
  }

  if (report.risks) {
    html += sectionHeader("RISK SIGNALS");
    html += `<tr><td ${colHeaderStyle}>Category</td><td ${colHeaderStyle}>Risk Level</td><td ${colHeaderStyle}>Contributing Factors</td><td ${emptyStyle}></td></tr>`;
    const risks = [
      { label: "Recovery", level: report.risks.recoveryRisk, factors: report.risks.recoveryFactors },
      { label: "Cognitive Strain", level: report.risks.cognitiveStrainRisk, factors: report.risks.cognitiveFactors },
      { label: "Emotional Strain", level: report.risks.emotionalStrainRisk, factors: report.risks.emotionalFactors },
    ];
    for (const r of risks) {
      html += `<tr><td ${labelStyle}>${r.label}</td><td ${cellStyle}>${r.level}</td><td ${cellStyle}>${e(r.factors.join("; ") || "No concerns")}</td><td ${emptyStyle}></td></tr>`;
    }
    html += emptyRow();

    const recActions = getRecommendedActions(report.risks, report.metrics);
    if (recActions.length > 0) {
      html += sectionHeader("RECOMMENDED ACTIONS");
      html += `<tr><td ${colHeaderStyle}>Action</td><td ${emptyStyle}></td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
      for (const action of recActions) {
        html += `<tr><td colspan="4" ${cellStyle}>${e(action)}</td></tr>`;
      }
      html += emptyRow();
    }
  }

  if (report.bodyMapStats) {
    html += sectionHeader("MUSCULOSKELETAL PAIN", "(severity 4+)");
    html += `<tr><td ${colHeaderStyle}>Metric</td><td ${colHeaderStyle}>Value</td><td ${colHeaderStyle}>Trend</td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Users Reporting Pain</td><td ${cellStyle}>${report.bodyMapStats.usersReportingPainPercent}%</td><td ${cellStyle}>${report.bodyMapStats.painPercentTrend ? report.bodyMapStats.painPercentTrend.charAt(0).toUpperCase() + report.bodyMapStats.painPercentTrend.slice(1) : "---"}</td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Total Assessments</td><td ${cellStyle}>${report.bodyMapStats.totalAssessments}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Average Severity</td><td ${cellStyle}>${report.bodyMapStats.avgSeverity !== null ? report.bodyMapStats.avgSeverity + " / 10" : "---"}</td><td ${cellStyle}>${report.bodyMapStats.severityTrend ? report.bodyMapStats.severityTrend.charAt(0).toUpperCase() + report.bodyMapStats.severityTrend.slice(1) : "---"}</td><td ${emptyStyle}></td></tr>`;
    if (report.bodyMapStats.topBodyAreas.length > 0) {
      html += emptyRow();
      html += `<tr><td ${colHeaderStyle}>Top Body Areas</td><td ${colHeaderStyle}>Reports</td><td ${colHeaderStyle}>Avg Severity</td><td ${colHeaderStyle}>Trend</td></tr>`;
      for (const area of report.bodyMapStats.topBodyAreas) {
        html += `<tr><td ${labelStyle}>${e(formatBodyPart(area.bodyPart))}</td><td ${cellStyle}>${area.count}</td><td ${cellStyle}>${area.avgSeverity} / 10</td><td ${cellStyle}>${area.trend ? area.trend.charAt(0).toUpperCase() + area.trend.slice(1) : "---"}</td></tr>`;
      }
    }
    html += emptyRow();
  }

  if (report.burnoutStats) {
    const bs = report.burnoutStats;
    html += sectionHeader("BURNOUT INDEX", "(0-100 scale)");
    html += `<tr><td ${colHeaderStyle}>Metric</td><td ${colHeaderStyle}>Value</td><td ${colHeaderStyle}>Previous</td><td ${colHeaderStyle}>Trend</td></tr>`;
    html += `<tr><td ${labelStyle}>Average Burnout Score</td><td ${cellStyle}>${bs.avgScore ?? "N/A"} / 100</td><td ${cellStyle}>${bs.previousAvgScore !== null ? bs.previousAvgScore + " / 100" : "N/A"}</td><td ${cellStyle}>${bs.trend ? bs.trend.charAt(0).toUpperCase() + bs.trend.slice(1) : "N/A"}</td></tr>`;
    html += `<tr><td ${labelStyle}>Users Assessed</td><td ${cellStyle}>${bs.usersAssessed}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Total Assessments</td><td ${cellStyle}>${bs.totalCheckIns}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    const bConf = getBurnoutConfidence(bs.usersAssessed, report.totalUsersInCompany, bs.totalCheckIns);
    const participation = report.totalUsersInCompany > 0 ? Math.round((bs.usersAssessed / report.totalUsersInCompany) * 100) : 0;
    html += `<tr><td ${labelStyle}>Confidence Level</td><td ${cellStyle}>${bConf.label}</td><td ${cellStyle}>${participation}% participation</td><td ${emptyStyle}></td></tr>`;
    html += emptyRow();
    html += `<tr><td ${colHeaderStyle}>Risk Band</td><td ${colHeaderStyle}>Users</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Optimal (0-20)</td><td ${cellStyle}>${bs.riskBands.optimal}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Mild (21-40)</td><td ${cellStyle}>${bs.riskBands.mild}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Moderate (41-60)</td><td ${cellStyle}>${bs.riskBands.moderate}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>High (61-80)</td><td ${cellStyle}>${bs.riskBands.high}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Severe (81-100)</td><td ${cellStyle}>${bs.riskBands.severe}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += emptyRow();
    html += `<tr><td ${colHeaderStyle}>Trajectory</td><td ${colHeaderStyle}>Users</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Stable</td><td ${cellStyle}>${bs.trajectoryDistribution.stable}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Rising</td><td ${cellStyle}>${bs.trajectoryDistribution.rising}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Elevated</td><td ${cellStyle}>${bs.trajectoryDistribution.elevated}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    html += `<tr><td ${labelStyle}>Recovering</td><td ${cellStyle}>${bs.trajectoryDistribution.recovering}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
    if (bs.topDrivers.length > 0) {
      html += emptyRow();
      html += `<tr><td ${colHeaderStyle}>Top Burnout Drivers</td><td ${colHeaderStyle}>Affected Users</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
      for (const d of bs.topDrivers) {
        html += `<tr><td ${labelStyle}>${e(d.label)}</td><td ${cellStyle}>${d.count}</td><td ${emptyStyle}></td><td ${emptyStyle}></td></tr>`;
      }
    }
    html += emptyRow();
  }

  if (showMonthOverMonth && report.monthOverMonth?.current && report.monthOverMonth?.previous) {
    const mom = report.monthOverMonth;
    html += sectionHeader("MONTH vs MONTH COMPARISON");
    html += `<tr><td ${colHeaderStyle}>Metric</td><td ${colHeaderStyle}>${e(mom.previousMonth)}</td><td ${colHeaderStyle}>${e(mom.currentMonth)}</td><td ${colHeaderStyle}>Change</td></tr>`;

    const coreMetrics = [
      { label: "Mood", prev: mom.previous!.avgMood, curr: mom.current!.avgMood },
      { label: "Energy", prev: mom.previous!.avgEnergy, curr: mom.current!.avgEnergy },
      { label: "Stress", prev: mom.previous!.avgStress, curr: mom.current!.avgStress },
      { label: "Sleep", prev: mom.previous!.avgSleep, curr: mom.current!.avgSleep },
      { label: "Clarity", prev: mom.previous!.avgClarity, curr: mom.current!.avgClarity },
    ];
    for (const r of coreMetrics) {
      const diff = r.prev !== null && r.curr !== null ? (r.curr - r.prev) : null;
      const diffStr = diff !== null ? (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)) : "";
      html += `<tr><td ${labelStyle}>${r.label}</td><td ${cellStyle}>${num(r.prev)}</td><td ${cellStyle}>${num(r.curr)}</td><td ${cellStyle}>${diffStr}</td></tr>`;
    }

    const pctMetrics = [
      { label: "Headache (%)", prev: mom.previous!.headachePercent, curr: mom.current!.headachePercent },
      { label: "Anxious (%)", prev: mom.previous!.anxiousPercent, curr: mom.current!.anxiousPercent },
      { label: "Overwhelmed (%)", prev: mom.previous!.overwhelmedPercent, curr: mom.current!.overwhelmedPercent },
      { label: "Fatigue (%)", prev: mom.previous!.fatiguePercent, curr: mom.current!.fatiguePercent },
      { label: "Pain/Injury (%)", prev: mom.previous!.painOrInjuryPercent, curr: mom.current!.painOrInjuryPercent },
      { label: "Exercised (%)", prev: mom.previous!.exercisedYesterdayPercent, curr: mom.current!.exercisedYesterdayPercent },
      { label: "Mindfulness (%)", prev: mom.previous!.practicedMindfulnessPercent, curr: mom.current!.practicedMindfulnessPercent },
    ];
    for (const r of pctMetrics) {
      const diff = r.prev !== null && r.curr !== null ? (r.curr! - r.prev!) : null;
      const diffStr = diff !== null ? (diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`) : "";
      html += `<tr><td ${labelStyle}>${r.label}</td><td ${cellStyle}>${pct(r.prev)}${r.prev !== null ? "%" : ""}</td><td ${cellStyle}>${pct(r.curr)}${r.curr !== null ? "%" : ""}</td><td ${cellStyle}>${diffStr}</td></tr>`;
    }
    html += emptyRow();
  }

  html += emptyRow();
  html += `<tr><td colspan="4" style="color:#888;font-style:italic;padding:8px 12px;border:none;background-color:#0d1117">All data is anonymous and aggregated. No individual user data is included.</td></tr>`;
  html += `</table></body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const companySlug = report.companyName.replace(/\s+/g, "_").toLowerCase();
  let fileStartDate: string, fileEndDate: string;
  if (timeWindow === "custom" && customStartDate && customEndDate) {
    fileStartDate = customStartDate;
    fileEndDate = customEndDate;
  } else {
    const days = parseInt(timeWindow) || 30;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    fileStartDate = start.toISOString().split("T")[0];
    fileEndDate = end.toISOString().split("T")[0];
  }
  a.href = url;
  a.download = `${companySlug}_report_${fileStartDate}_to_${fileEndDate}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<string>("30");
  const [showMonthOverMonth, setShowMonthOverMonth] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [customDateError, setCustomDateError] = useState<string>("");

  const { data: companies = [], isLoading: companiesLoading } = useQuery<CompanySummary[]>({
    queryKey: ["/api/admin/reports/companies"],
    enabled: !!user,
  });

  const monthParam = showMonthOverMonth ? getCurrentMonthStr() : undefined;

  const isCustomValid = timeWindow === "custom" && !!customStartDate && !!customEndDate && !customDateError;

  const { data: report, isLoading: reportLoading } = useQuery<CompanyReport>({
    queryKey: ["/api/admin/reports/company", selectedCompany, timeWindow, monthParam, customStartDate, customEndDate],
    queryFn: async () => {
      let url = `/api/admin/reports/company/${encodeURIComponent(selectedCompany!)}`;
      if (timeWindow === "custom" && customStartDate && customEndDate) {
        url += `?startDate=${customStartDate}&endDate=${customEndDate}`;
      } else {
        url += `?window=${timeWindow}`;
      }
      if (monthParam) url += `&month=${monthParam}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: !!(user && selectedCompany && (timeWindow !== "custom" || isCustomValid)),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopHeader title="Company Reports" onBack={() => navigate("/admin")} />
      <div className="max-w-4xl mx-auto p-4 pt-16 pb-32">
        <p className="text-sm text-muted-foreground mb-4">Anonymous aggregate wellness data</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Select value={selectedCompany || ""} onValueChange={(v) => setSelectedCompany(v)}>
            <SelectTrigger className="bg-card border-border text-foreground w-auto max-w-[220px] sm:max-w-[280px]">
              <SelectValue placeholder="Select a company" className="truncate" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {companies.map((c) => (
                <SelectItem key={c.companyName} value={c.companyName} className="text-foreground">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="truncate max-w-[140px]">{c.companyName}</span>
                    <span className="text-xs text-muted-foreground">({c.userCount} users)</span>
                    {!c.eligible && <span className="text-xs text-red-400">(min 5)</span>}
                  </span>
                </SelectItem>
              ))}
              {companies.length === 0 && !companiesLoading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No companies found</div>
              )}
            </SelectContent>
          </Select>

          <Select value={timeWindow} onValueChange={(v) => {
            setTimeWindow(v);
            if (v !== "custom") {
              setCustomDateError("");
            }
          }}>
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

          <Button
            variant={showMonthOverMonth ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMonthOverMonth(!showMonthOverMonth)}
            className={showMonthOverMonth ? "bg-[#0cc9a9] hover:bg-[#0cc9a9]/80 text-black" : "border-border text-muted-foreground hover:text-foreground"}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Month vs Month
          </Button>
        </div>

        {timeWindow === "custom" && (
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px] justify-start text-left font-normal border-border bg-card text-foreground hover:bg-card/80">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {customStartDate ? format(parse(customStartDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate ? parse(customStartDate, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          const val = format(date, "yyyy-MM-dd");
                          setCustomStartDate(val);
                          if (customEndDate) {
                            const diff = Math.ceil((new Date(customEndDate).getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                            setCustomDateError(diff < 7 ? "Range must be at least 7 days" : "");
                          }
                        }
                      }}
                      disabled={(date: Date) => date > new Date() || (customEndDate ? date > new Date(customEndDate) : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px] justify-start text-left font-normal border-border bg-card text-foreground hover:bg-card/80">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {customEndDate ? format(parse(customEndDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate ? parse(customEndDate, "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          const val = format(date, "yyyy-MM-dd");
                          setCustomEndDate(val);
                          if (customStartDate) {
                            const diff = Math.ceil((date.getTime() - new Date(customStartDate).getTime()) / (1000 * 60 * 60 * 24));
                            setCustomDateError(diff < 7 ? "Range must be at least 7 days" : "");
                          }
                        }
                      }}
                      disabled={(date: Date) => date > new Date() || (customStartDate ? date < new Date(customStartDate) : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {customDateError && (
              <p className="text-xs text-red-400">{customDateError}</p>
            )}
          </div>
        )}

        {report && report.eligible && report.metrics && (
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportReportToCSV(report, timeWindow, showMonthOverMonth, customStartDate, customEndDate)}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        )}

        {!selectedCompany && (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Select a company to view their anonymous wellness report</p>
              <p className="text-muted-foreground/70 text-sm mt-2">All data is aggregated - no individual user data is shown</p>
            </CardContent>
          </Card>
        )}

        {selectedCompany && reportLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0cc9a9]" />
          </div>
        )}

        {report && !report.eligible && (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-[#0cc9a9] mx-auto mb-4" />
              <p className="text-foreground text-lg font-medium mb-2">Insufficient Users for Anonymous Reporting</p>
              <p className="text-muted-foreground">{report.reason}</p>
            </CardContent>
          </Card>
        )}

        {report && report.eligible && report.metrics && (
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#0cc9a9]" />
                    Participation
                  </CardTitle>
                  {report.participation && (
                    <span className="text-sm text-muted-foreground">
                      {report.window} window
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {report.participation && (() => {
                  const quality = getParticipationQuality(report.participation.participationRate);
                  const QualityIcon = quality.icon;
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Total Users</p>
                          <p className="text-2xl font-bold text-foreground">{report.participation.totalUsersInCompany}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Active in Window</p>
                          <p className="text-2xl font-bold text-foreground">{report.participation.activeUsersInWindow}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Participation Rate</p>
                          <p className="text-2xl font-bold text-[#0cc9a9]">{report.participation.participationRate}%</p>
                          <span className={`inline-flex items-center gap-1 mt-1 text-xs ${quality.color}`}>
                            <QualityIcon className="h-3 w-3" />
                            {quality.label} quality
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">vs Previous Period</p>
                          <p className={`text-2xl font-bold ${
                            report.participation.changeVsPrevious === null ? "text-gray-500" :
                            report.participation.changeVsPrevious > 0 ? "text-green-400" :
                            report.participation.changeVsPrevious < 0 ? "text-red-400" : "text-gray-400"
                          }`}>
                            {report.participation.changeVsPrevious !== null
                              ? `${report.participation.changeVsPrevious > 0 ? "+" : ""}${report.participation.changeVsPrevious}%`
                              : "---"}
                          </p>
                        </div>
                      </div>
                      {report.participation.participationRate < 60 && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-300">
                            Participation is below 60%. Data reliability may be reduced. Consider initiatives to increase engagement with daily check-ins.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground/70">
                    Total check-ins in this window: {report.metrics.totalCheckIns} from {report.metrics.uniqueUsers} unique users
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#0cc9a9]" />
                  Core Wellbeing Scores
                  <span className="text-xs text-muted-foreground font-normal">(1-5 scale)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <ScoreCard label="Mood" value={report.metrics.avgMood} suffix="/5" trend={report.trends?.mood} />
                  <ScoreCard label="Energy" value={report.metrics.avgEnergy} suffix="/5" trend={report.trends?.energy} />
                  <ScoreCard label="Stress" value={report.metrics.avgStress} suffix="/5" trend={report.trends?.stress} />
                  <ScoreCard label="Sleep" value={report.metrics.avgSleep} suffix="/5" trend={report.trends?.sleep} />
                  <ScoreCard label="Clarity" value={report.metrics.avgClarity} suffix="/5" trend={report.trends?.clarity} />
                </div>
              </CardContent>
            </Card>

            {report.risks && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-[#0cc9a9]" />
                    Risk Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-[#0cc9a9]" />
                        <RiskBadge level={report.risks.recoveryRisk} label="Recovery" />
                      </div>
                      {report.risks.recoveryFactors.length > 0 ? (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {report.risks.recoveryFactors.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">No concerns detected</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-[#0cc9a9]" />
                        <RiskBadge level={report.risks.cognitiveStrainRisk} label="Cognitive" />
                      </div>
                      {report.risks.cognitiveFactors.length > 0 ? (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {report.risks.cognitiveFactors.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">No concerns detected</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-[#0cc9a9]" />
                        <RiskBadge level={report.risks.emotionalStrainRisk} label="Emotional" />
                      </div>
                      {report.risks.emotionalFactors.length > 0 ? (
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {report.risks.emotionalFactors.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">No concerns detected</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {report.risks && (() => {
              const actions = getRecommendedActions(report.risks, report.metrics);
              if (actions.length === 0) return null;
              return (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-[#0cc9a9]" />
                      Recommended Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-background border border-border">
                          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-[#0cc9a9]" />
                          <p className="text-sm text-muted-foreground">{action}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#0cc9a9]" />
                  Health Signals
                  <span className="text-xs text-muted-foreground font-normal">(% of check-ins reporting)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PercentCard label="Headache" value={report.metrics.headachePercent} threshold={30} />
                  <PercentCard label="Alcohol Consumed" value={report.metrics.alcoholPercent} threshold={40} />
                  <PercentCard label="Sick" value={report.metrics.sickPercent} threshold={20} />
                  <PercentCard label="Pain / Injury" value={report.metrics.painOrInjuryPercent} threshold={30} />
                  <PercentCard label="Anxious" value={report.metrics.anxiousPercent} threshold={30} />
                  <PercentCard label="Overwhelmed" value={report.metrics.overwhelmedPercent} threshold={30} />
                  <PercentCard label="Fatigue" value={report.metrics.fatiguePercent} threshold={40} />
                  <PercentCard label="Fatigue Trigger Met" value={report.metrics.fatigueTriggerPercent} threshold={30} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#0cc9a9]" />
                  Protective Behaviours
                  <span className="text-xs text-muted-foreground font-normal">(% of check-ins reporting)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const protective = computeProtectiveScore(report.metrics!);
                  const scoreColor = protective.score >= 60 ? "text-green-400" : protective.score >= 40 ? "text-[#0cc9a9]" : "text-amber-400";
                  return (
                    <div className="mb-4 p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Composite Score</p>
                          <p className={`text-2xl font-bold ${scoreColor}`}>
                            {protective.score}
                            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                          protective.trend === "Strong" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                          protective.trend === "Moderate" ? "bg-[#0cc9a9]/20 text-[#0cc9a9] border-[#0cc9a9]/30" :
                          "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}>
                          {protective.trend}
                        </span>
                      </div>
                      <div className="w-full bg-background rounded-full h-2 border border-border">
                        <div
                          className={`h-full rounded-full ${protective.score >= 60 ? "bg-green-400" : protective.score >= 40 ? "bg-[#0cc9a9]" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(protective.score, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-1.5">
                        Composite of Exercise + Mindfulness + Emotional Stability + Caffeine Awareness (equal weighting)
                      </p>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PercentCard label="Exercised Yesterday" value={report.metrics.exercisedYesterdayPercent} threshold={40} invertWarning />
                  <PercentCard label="Practiced Mindfulness" value={report.metrics.practicedMindfulnessPercent} threshold={20} invertWarning />
                  <PercentCard label="Emotionally Stable" value={report.metrics.emotionallyStablePercent} threshold={60} invertWarning />
                  <PercentCard label="Caffeine After 2pm" value={report.metrics.caffeineAfter2pmPercent} threshold={40} />
                </div>
              </CardContent>
            </Card>

            {report.bodyMapStats && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#0cc9a9]" />
                    Musculoskeletal Pain
                    <span className="text-xs text-muted-foreground font-normal">(severity 4+ from body map)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.bodyMapStats.totalAssessments === 0 ? (
                    <p className="text-muted-foreground text-center py-6">No body map assessments recorded in this period</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Users Reporting Pain</p>
                          <p className={`text-2xl font-bold ${report.bodyMapStats.usersReportingPainPercent > 30 ? "text-red-400" : "text-foreground"}`}>
                            {report.bodyMapStats.usersReportingPainPercent}%
                          </p>
                          {report.bodyMapStats.painPercentTrend && (
                            <TrendBadge direction={report.bodyMapStats.painPercentTrend} label={report.bodyMapStats.previousUsersReportingPainPercent !== null ? `was ${report.bodyMapStats.previousUsersReportingPainPercent}%` : report.bodyMapStats.painPercentTrend} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Total Assessments</p>
                          <p className="text-2xl font-bold text-foreground">{report.bodyMapStats.totalAssessments}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Avg Severity</p>
                          <p className="text-2xl font-bold text-foreground">
                            {report.bodyMapStats.avgSeverity !== null ? `${report.bodyMapStats.avgSeverity}/10` : "---"}
                          </p>
                          {report.bodyMapStats.severityTrend && (
                            <TrendBadge direction={report.bodyMapStats.severityTrend} label={report.bodyMapStats.previousAvgSeverity !== null ? `was ${report.bodyMapStats.previousAvgSeverity}/10` : report.bodyMapStats.severityTrend} />
                          )}
                        </div>
                      </div>
                      {report.bodyMapStats.topBodyAreas.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-2">Most Reported Areas (severity 4+)</p>
                          <div className="space-y-2">
                            {report.bodyMapStats.topBodyAreas.map((area) => (
                              <div key={area.bodyPart} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-foreground">{formatBodyPart(area.bodyPart)}</span>
                                  {area.trend && <TrendIcon direction={area.trend} />}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">{area.count} reports</span>
                                  <span className={`text-sm font-semibold ${area.avgSeverity >= 7 ? "text-red-400" : area.avgSeverity >= 5 ? "text-[#0cc9a9]" : "text-foreground"}`}>
                                    {area.avgSeverity}/10
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {report.burnoutStats && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Brain className="h-5 w-5 text-[#0cc9a9]" />
                    Burnout Index
                    <span className="text-xs text-muted-foreground font-normal">(0-100 scale)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Avg Burnout Score</p>
                      <p className={`text-2xl font-bold ${(report.burnoutStats.avgScore ?? 0) > 60 ? "text-red-400" : (report.burnoutStats.avgScore ?? 0) > 40 ? "text-orange-400" : "text-[#0cc9a9]"}`}>
                        {report.burnoutStats.avgScore ?? "N/A"}
                        <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                      </p>
                      {report.burnoutStats.trend && (
                        <TrendBadge direction={report.burnoutStats.trend} label={report.burnoutStats.trend === "improving" ? "Improving" : report.burnoutStats.trend === "declining" ? "Worsening" : "Stable"} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Users Assessed</p>
                      <p className="text-2xl font-bold text-foreground">{report.burnoutStats.usersAssessed}</p>
                    </div>
                    {report.burnoutStats.previousAvgScore !== null && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Previous Period</p>
                        <p className="text-2xl font-bold text-muted-foreground">
                          {report.burnoutStats.previousAvgScore}
                          <span className="text-sm font-normal"> / 100</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const confidence = getBurnoutConfidence(
                      report.burnoutStats!.usersAssessed,
                      report.totalUsersInCompany,
                      report.burnoutStats!.totalCheckIns
                    );
                    const isLow = confidence.label === "Low";
                    return (
                      <div className={`mb-6 ${isLow ? "flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3" : "px-1"}`}>
                        {isLow && <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-xs ${isLow ? "text-amber-300" : "text-muted-foreground"}`}>
                            Based on {report.burnoutStats!.totalCheckIns} check-ins from {report.burnoutStats!.usersAssessed} active users
                            {" - "}
                            <span className={`font-medium ${isLow ? "text-amber-400" : "text-muted-foreground"}`}>
                              {confidence.label} confidence
                            </span>
                            {" "}
                            ({Math.round((report.burnoutStats!.usersAssessed / report.totalUsersInCompany) * 100)}% participation)
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mb-6">
                    <p className="text-xs text-muted-foreground uppercase mb-3">Risk Distribution</p>
                    <div className="flex gap-1 h-6 rounded-lg overflow-hidden mb-2">
                      {[
                        { key: 'optimal' as const, color: 'bg-[#0cc9a9]', label: 'Optimal' },
                        { key: 'mild' as const, color: 'bg-[#0cc9a9]/60', label: 'Mild' },
                        { key: 'moderate' as const, color: 'bg-orange-400', label: 'Moderate' },
                        { key: 'high' as const, color: 'bg-orange-600', label: 'High' },
                        { key: 'severe' as const, color: 'bg-red-500', label: 'Severe' },
                      ].map(band => {
                        const count = report.burnoutStats!.riskBands[band.key];
                        const pct = report.burnoutStats!.usersAssessed > 0 ? (count / report.burnoutStats!.usersAssessed) * 100 : 0;
                        return pct > 0 ? (
                          <div key={band.key} className={`${band.color} relative group`} style={{ width: `${pct}%`, minWidth: count > 0 ? '8px' : '0' }} title={`${band.label}: ${count} users (${Math.round(pct)}%)`} />
                        ) : null;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {[
                        { key: 'optimal' as const, color: 'bg-[#0cc9a9]', label: 'Optimal (0-20)' },
                        { key: 'mild' as const, color: 'bg-[#0cc9a9]/60', label: 'Mild (21-40)' },
                        { key: 'moderate' as const, color: 'bg-orange-400', label: 'Moderate (41-60)' },
                        { key: 'high' as const, color: 'bg-orange-600', label: 'High (61-80)' },
                        { key: 'severe' as const, color: 'bg-red-500', label: 'Severe (81+)' },
                      ].map(band => (
                        <span key={band.key} className="flex items-center gap-1.5 text-muted-foreground">
                          <span className={`w-2.5 h-2.5 rounded-sm ${band.color}`} />
                          {band.label}: {report.burnoutStats!.riskBands[band.key]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-2">Trajectory</p>
                      <div className="space-y-1.5">
                        {[
                          { key: 'stable' as const, label: 'Stable', color: 'text-[#0cc9a9]' },
                          { key: 'recovering' as const, label: 'Recovering', color: 'text-green-400' },
                          { key: 'rising' as const, label: 'Rising', color: 'text-orange-400' },
                          { key: 'elevated' as const, label: 'Elevated', color: 'text-red-400' },
                        ].map(t => (
                          <div key={t.key} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                            <span className={`text-sm ${t.color}`}>{t.label}</span>
                            <span className="text-sm font-semibold text-foreground">{report.burnoutStats!.trajectoryDistribution[t.key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {report.burnoutStats.topDrivers.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-2">Top Drivers</p>
                        <div className="space-y-1.5">
                          {report.burnoutStats.topDrivers.map((d) => (
                            <div key={d.key} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                              <span className="text-sm text-foreground">{d.label}</span>
                              <span className="text-xs text-muted-foreground">{d.count} users</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {showMonthOverMonth && report.monthOverMonth && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-[#0cc9a9]" />
                    Month vs Month
                    <span className="text-xs text-muted-foreground font-normal">
                      {report.monthOverMonth.previousMonth} vs {report.monthOverMonth.currentMonth}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.monthOverMonth.current && report.monthOverMonth.previous ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-2 pr-4">Metric</th>
                            <th className="text-right py-2 px-3">{report.monthOverMonth.previousMonth}</th>
                            <th className="text-right py-2 px-3">{report.monthOverMonth.currentMonth}</th>
                            <th className="text-right py-2 pl-3">Change</th>
                          </tr>
                        </thead>
                        <tbody className="text-foreground">
                          {[
                            { label: "Mood", prev: report.monthOverMonth.previous.avgMood, curr: report.monthOverMonth.current.avgMood },
                            { label: "Energy", prev: report.monthOverMonth.previous.avgEnergy, curr: report.monthOverMonth.current.avgEnergy },
                            { label: "Stress", prev: report.monthOverMonth.previous.avgStress, curr: report.monthOverMonth.current.avgStress, inverted: true },
                            { label: "Sleep", prev: report.monthOverMonth.previous.avgSleep, curr: report.monthOverMonth.current.avgSleep },
                            { label: "Clarity", prev: report.monthOverMonth.previous.avgClarity, curr: report.monthOverMonth.current.avgClarity },
                          ].map((row) => {
                            const diff = row.prev !== null && row.curr !== null ? Math.round((row.curr - row.prev) * 100) / 100 : null;
                            const isPositive = diff !== null ? (row.inverted ? diff < 0 : diff > 0) : null;
                            return (
                              <tr key={row.label} className="border-b border-border/50">
                                <td className="py-2.5 pr-4 text-muted-foreground">{row.label}</td>
                                <td className="text-right py-2.5 px-3">{row.prev !== null ? row.prev.toFixed(2) : "---"}</td>
                                <td className="text-right py-2.5 px-3">{row.curr !== null ? row.curr.toFixed(2) : "---"}</td>
                                <td className={`text-right py-2.5 pl-3 font-medium ${
                                  diff === null ? "text-muted-foreground" :
                                  isPositive ? "text-green-400" :
                                  diff === 0 ? "text-gray-400" : "text-red-400"
                                }`}>
                                  {diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}` : "---"}
                                </td>
                              </tr>
                            );
                          })}
                          {[
                            { label: "Headache %", prev: report.monthOverMonth.previous.headachePercent, curr: report.monthOverMonth.current.headachePercent, inverted: true },
                            { label: "Anxious %", prev: report.monthOverMonth.previous.anxiousPercent, curr: report.monthOverMonth.current.anxiousPercent, inverted: true },
                            { label: "Overwhelmed %", prev: report.monthOverMonth.previous.overwhelmedPercent, curr: report.monthOverMonth.current.overwhelmedPercent, inverted: true },
                            { label: "Fatigue %", prev: report.monthOverMonth.previous.fatiguePercent, curr: report.monthOverMonth.current.fatiguePercent, inverted: true },
                            { label: "Pain/Injury %", prev: report.monthOverMonth.previous.painOrInjuryPercent, curr: report.monthOverMonth.current.painOrInjuryPercent, inverted: true },
                            { label: "Exercised %", prev: report.monthOverMonth.previous.exercisedYesterdayPercent, curr: report.monthOverMonth.current.exercisedYesterdayPercent },
                            { label: "Mindfulness %", prev: report.monthOverMonth.previous.practicedMindfulnessPercent, curr: report.monthOverMonth.current.practicedMindfulnessPercent },
                          ].map((row) => {
                            const diff = row.prev !== null && row.curr !== null ? Math.round((row.curr! - row.prev!) * 10) / 10 : null;
                            const isPositive = diff !== null ? (row.inverted ? diff < 0 : diff > 0) : null;
                            return (
                              <tr key={row.label} className="border-b border-border/50">
                                <td className="py-2.5 pr-4 text-muted-foreground">{row.label}</td>
                                <td className="text-right py-2.5 px-3">{row.prev !== null ? `${row.prev!.toFixed(1)}%` : "---"}</td>
                                <td className="text-right py-2.5 px-3">{row.curr !== null ? `${row.curr!.toFixed(1)}%` : "---"}</td>
                                <td className={`text-right py-2.5 pl-3 font-medium ${
                                  diff === null ? "text-muted-foreground" :
                                  isPositive ? "text-green-400" :
                                  diff === 0 ? "text-gray-400" : "text-red-400"
                                }`}>
                                  {diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : "---"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">No month-over-month data available yet</p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="bg-card/50 rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground/70 text-center">
                All data is anonymous and aggregated. Minimum 5 users required per company.
                No individual user data is accessible through this report.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
