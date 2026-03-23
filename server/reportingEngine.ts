import { db } from "./db";
import { users, checkIns, bodyMapLogs, burnoutScores } from "@shared/schema";
import { eq, and, gte, lte, sql, count, avg, sum, isNotNull, ne, inArray, desc } from "drizzle-orm";

const MIN_USERS_THRESHOLD = 5;

export type TimeWindow = "7" | "30" | "90";
export type TrendDirection = "improving" | "stable" | "declining";
export type RiskLevel = "low" | "moderate" | "high";

export interface CompanySummary {
  companyName: string;
  userCount: number;
  eligible: boolean;
}

export interface AggregateMetrics {
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
}

export interface TrendData {
  mood: TrendDirection;
  energy: TrendDirection;
  stress: TrendDirection;
  sleep: TrendDirection;
  clarity: TrendDirection;
}

export interface RiskSignals {
  recoveryRisk: RiskLevel;
  cognitiveStrainRisk: RiskLevel;
  emotionalStrainRisk: RiskLevel;
  recoveryFactors: string[];
  cognitiveFactors: string[];
  emotionalFactors: string[];
}

export interface ParticipationData {
  totalUsersInCompany: number;
  activeUsersInWindow: number;
  participationRate: number;
  changeVsPrevious: number | null;
}

export interface MonthOverMonthData {
  currentMonth: string;
  previousMonth: string;
  current: AggregateMetrics | null;
  previous: AggregateMetrics | null;
  currentParticipation: ParticipationData | null;
  previousParticipation: ParticipationData | null;
}

export interface BodyMapStats {
  usersReportingPainPercent: number;
  totalAssessments: number;
  avgSeverity: number | null;
  topBodyAreas: { bodyPart: string; count: number; avgSeverity: number; trend?: TrendDirection }[];
  painPercentTrend: TrendDirection | null;
  severityTrend: TrendDirection | null;
  previousUsersReportingPainPercent: number | null;
  previousAvgSeverity: number | null;
}

export interface BurnoutStats {
  avgScore: number | null;
  usersAssessed: number;
  totalCheckIns: number;
  trajectoryDistribution: { stable: number; rising: number; elevated: number; recovering: number };
  topDrivers: { key: string; label: string; count: number }[];
  riskBands: { optimal: number; mild: number; moderate: number; high: number; severe: number };
  previousAvgScore: number | null;
  trend: TrendDirection | null;
}

export interface CompanyReport {
  companyName: string;
  window: string;
  eligible: boolean;
  reason?: string;
  totalUsersInCompany: number;
  metrics: AggregateMetrics | null;
  previousMetrics: AggregateMetrics | null;
  trends: TrendData | null;
  risks: RiskSignals | null;
  participation: ParticipationData | null;
  monthOverMonth: MonthOverMonthData | null;
  bodyMapStats: BodyMapStats | null;
  burnoutStats: BurnoutStats | null;
}

function getDateRange(windowDays: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - windowDays);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getPreviousDateRange(windowDays: number): { start: Date; end: Date } {
  const end = new Date();
  end.setDate(end.getDate() - windowDays);
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - windowDays * 2);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function getCompanyUserIds(companyName: string): Promise<string[]> {
  const companyUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyName, companyName), eq(users.isAdmin, false)));
  return companyUsers.map((u) => u.id);
}

async function computeMetrics(
  userIds: string[],
  startDate: Date,
  endDate: Date
): Promise<AggregateMetrics | null> {
  if (userIds.length === 0) return null;

  const parameterizedIds = sql.join(userIds.map(id => sql`${id}`), sql`, `);

  const result = await db.execute(sql`
    SELECT
      AVG(mood_score)::float AS avg_mood,
      AVG(energy_score)::float AS avg_energy,
      AVG(stress_score)::float AS avg_stress,
      AVG(sleep_score)::float AS avg_sleep,
      AVG(clarity_score)::float AS avg_clarity,
      COUNT(*)::int AS total_check_ins,
      COUNT(DISTINCT user_id)::int AS unique_users,
      (SUM(CASE WHEN headache = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS headache_pct,
      (SUM(CASE WHEN alcohol = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS alcohol_pct,
      (SUM(CASE WHEN sick = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS sick_pct,
      (SUM(CASE WHEN pain_or_injury = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS pain_injury_pct,
      (SUM(CASE WHEN anxious = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS anxious_pct,
      (SUM(CASE WHEN overwhelmed = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS overwhelmed_pct,
      (SUM(CASE WHEN fatigue = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS fatigue_pct,
      (SUM(CASE WHEN fatigue_trigger_met = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS fatigue_trigger_pct,
      (SUM(CASE WHEN exercised_yesterday = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS exercised_pct,
      (SUM(CASE WHEN caffeine_after_2pm = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS caffeine_pct,
      (SUM(CASE WHEN practiced_mindfulness = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS mindfulness_pct,
      (SUM(CASE WHEN emotionally_stable = true THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100) AS emotionally_stable_pct
    FROM check_ins
    WHERE user_id IN (${parameterizedIds})
      AND check_in_date >= ${startDate}
      AND check_in_date <= ${endDate}
  `);

  const row = (result as any).rows?.[0] || (result as any)[0];
  if (!row || Number(row.total_check_ins) === 0) return null;

  return {
    avgMood: row.avg_mood ? Math.round(row.avg_mood * 100) / 100 : null,
    avgEnergy: row.avg_energy ? Math.round(row.avg_energy * 100) / 100 : null,
    avgStress: row.avg_stress ? Math.round(row.avg_stress * 100) / 100 : null,
    avgSleep: row.avg_sleep ? Math.round(row.avg_sleep * 100) / 100 : null,
    avgClarity: row.avg_clarity ? Math.round(row.avg_clarity * 100) / 100 : null,
    headachePercent: row.headache_pct ? Math.round(row.headache_pct * 10) / 10 : 0,
    alcoholPercent: row.alcohol_pct ? Math.round(row.alcohol_pct * 10) / 10 : 0,
    sickPercent: row.sick_pct ? Math.round(row.sick_pct * 10) / 10 : 0,
    painOrInjuryPercent: row.pain_injury_pct ? Math.round(row.pain_injury_pct * 10) / 10 : 0,
    anxiousPercent: row.anxious_pct ? Math.round(row.anxious_pct * 10) / 10 : 0,
    overwhelmedPercent: row.overwhelmed_pct ? Math.round(row.overwhelmed_pct * 10) / 10 : 0,
    fatiguePercent: row.fatigue_pct ? Math.round(row.fatigue_pct * 10) / 10 : 0,
    fatigueTriggerPercent: row.fatigue_trigger_pct ? Math.round(row.fatigue_trigger_pct * 10) / 10 : 0,
    exercisedYesterdayPercent: row.exercised_pct ? Math.round(row.exercised_pct * 10) / 10 : 0,
    caffeineAfter2pmPercent: row.caffeine_pct ? Math.round(row.caffeine_pct * 10) / 10 : 0,
    practicedMindfulnessPercent: row.mindfulness_pct ? Math.round(row.mindfulness_pct * 10) / 10 : 0,
    emotionallyStablePercent: row.emotionally_stable_pct ? Math.round(row.emotionally_stable_pct * 10) / 10 : 0,
    totalCheckIns: Number(row.total_check_ins),
    uniqueUsers: Number(row.unique_users),
  };
}

function computeTrends(
  current: AggregateMetrics | null,
  previous: AggregateMetrics | null
): TrendData | null {
  if (!current || !previous) return null;

  const threshold = 0.2;

  function direction(
    curr: number | null,
    prev: number | null,
    invertedBetter = false
  ): TrendDirection {
    if (curr === null || prev === null) return "stable";
    const diff = curr - prev;
    if (Math.abs(diff) < threshold) return "stable";
    if (invertedBetter) {
      return diff > 0 ? "declining" : "improving";
    }
    return diff > 0 ? "improving" : "declining";
  }

  return {
    mood: direction(current.avgMood, previous.avgMood),
    energy: direction(current.avgEnergy, previous.avgEnergy),
    stress: direction(current.avgStress, previous.avgStress, true),
    sleep: direction(current.avgSleep, previous.avgSleep),
    clarity: direction(current.avgClarity, previous.avgClarity),
  };
}

function computeRiskSignals(metrics: AggregateMetrics | null): RiskSignals | null {
  if (!metrics) return null;

  const recoveryFactors: string[] = [];
  const cognitiveFactors: string[] = [];
  const emotionalFactors: string[] = [];

  if (metrics.avgSleep !== null && metrics.avgSleep <= 2.5)
    recoveryFactors.push("Low sleep quality");
  if (metrics.avgEnergy !== null && metrics.avgEnergy <= 2.5)
    recoveryFactors.push("Low energy levels");
  if (metrics.fatiguePercent !== null && metrics.fatiguePercent > 40)
    recoveryFactors.push("High fatigue rates");
  if (metrics.painOrInjuryPercent !== null && metrics.painOrInjuryPercent > 30)
    recoveryFactors.push("Elevated pain/injury reports");
  if (metrics.sickPercent !== null && metrics.sickPercent > 20)
    recoveryFactors.push("Elevated sickness reports");

  if (metrics.avgClarity !== null && metrics.avgClarity <= 2.5)
    cognitiveFactors.push("Low mental clarity");
  if (metrics.headachePercent !== null && metrics.headachePercent > 30)
    cognitiveFactors.push("High headache rates");
  if (metrics.caffeineAfter2pmPercent !== null && metrics.caffeineAfter2pmPercent > 40)
    cognitiveFactors.push("High late caffeine consumption");
  if (metrics.avgStress !== null && metrics.avgStress >= 3.5)
    cognitiveFactors.push("Elevated stress levels");

  if (metrics.avgStress !== null && metrics.avgStress >= 3.5)
    emotionalFactors.push("High stress levels");
  if (metrics.anxiousPercent !== null && metrics.anxiousPercent > 30)
    emotionalFactors.push("High anxiety rates");
  if (metrics.overwhelmedPercent !== null && metrics.overwhelmedPercent > 30)
    emotionalFactors.push("High overwhelm rates");
  if (metrics.avgMood !== null && metrics.avgMood <= 2.5)
    emotionalFactors.push("Low mood scores");
  if (metrics.emotionallyStablePercent !== null && metrics.emotionallyStablePercent < 60)
    emotionalFactors.push("Low emotional stability");

  function riskLevel(factors: string[]): RiskLevel {
    if (factors.length >= 3) return "high";
    if (factors.length >= 1) return "moderate";
    return "low";
  }

  return {
    recoveryRisk: riskLevel(recoveryFactors),
    cognitiveStrainRisk: riskLevel(cognitiveFactors),
    emotionalStrainRisk: riskLevel(emotionalFactors),
    recoveryFactors,
    cognitiveFactors,
    emotionalFactors,
  };
}

async function computeBodyMapStats(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  totalUsers: number,
  prevStartDate: Date,
  prevEndDate: Date
): Promise<BodyMapStats | null> {
  if (userIds.length === 0) return null;

  const SEVERITY_THRESHOLD = 4;
  const parameterizedIds = sql.join(userIds.map(id => sql`${id}`), sql`, `);

  const summaryResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_assessments,
      AVG(severity)::float AS avg_severity,
      COUNT(DISTINCT user_id)::int AS users_with_assessments,
      COUNT(DISTINCT CASE WHEN severity >= ${SEVERITY_THRESHOLD} THEN user_id END)::int AS users_with_pain
    FROM body_map_logs
    WHERE user_id IN (${parameterizedIds})
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
  `);

  const summary = (summaryResult as any).rows?.[0] || (summaryResult as any)[0];
  if (!summary || Number(summary.total_assessments) === 0) {
    return {
      usersReportingPainPercent: 0,
      totalAssessments: 0,
      avgSeverity: null,
      topBodyAreas: [],
      painPercentTrend: null,
      severityTrend: null,
      previousUsersReportingPainPercent: null,
      previousAvgSeverity: null,
    };
  }

  const prevSummaryResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_assessments,
      AVG(severity)::float AS avg_severity,
      COUNT(DISTINCT CASE WHEN severity >= ${SEVERITY_THRESHOLD} THEN user_id END)::int AS users_with_pain
    FROM body_map_logs
    WHERE user_id IN (${parameterizedIds})
      AND created_at >= ${prevStartDate}
      AND created_at <= ${prevEndDate}
  `);
  const prevSummary = (prevSummaryResult as any).rows?.[0] || (prevSummaryResult as any)[0];

  const topAreasResult = await db.execute(sql`
    SELECT
      body_part,
      COUNT(*)::int AS report_count,
      AVG(severity)::float AS avg_severity
    FROM body_map_logs
    WHERE user_id IN (${parameterizedIds})
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND severity >= ${SEVERITY_THRESHOLD}
    GROUP BY body_part
    ORDER BY report_count DESC
    LIMIT 5
  `);

  const topAreas = ((topAreasResult as any).rows || topAreasResult) as any[];

  const prevTopAreasResult = await db.execute(sql`
    SELECT
      body_part,
      COUNT(*)::int AS report_count,
      AVG(severity)::float AS avg_severity
    FROM body_map_logs
    WHERE user_id IN (${parameterizedIds})
      AND created_at >= ${prevStartDate}
      AND created_at <= ${prevEndDate}
      AND severity >= ${SEVERITY_THRESHOLD}
    GROUP BY body_part
  `);
  const prevTopAreas = ((prevTopAreasResult as any).rows || prevTopAreasResult) as any[];
  const prevAreaMap: Record<string, { count: number; avgSeverity: number }> = {};
  prevTopAreas.forEach((a: any) => {
    prevAreaMap[a.body_part] = { count: Number(a.report_count), avgSeverity: Number(a.avg_severity) };
  });

  const currentPainPct = totalUsers > 0
    ? Math.round((Number(summary.users_with_pain) / totalUsers) * 1000) / 10
    : 0;
  const currentAvgSev = summary.avg_severity ? Math.round(summary.avg_severity * 10) / 10 : null;

  let previousPainPct: number | null = null;
  let previousAvgSev: number | null = null;
  let painPercentTrend: TrendDirection | null = null;
  let severityTrend: TrendDirection | null = null;

  if (prevSummary && Number(prevSummary.total_assessments) > 0) {
    previousPainPct = totalUsers > 0
      ? Math.round((Number(prevSummary.users_with_pain) / totalUsers) * 1000) / 10
      : 0;
    previousAvgSev = prevSummary.avg_severity ? Math.round(prevSummary.avg_severity * 10) / 10 : null;

    const painDiff = currentPainPct - previousPainPct;
    if (Math.abs(painDiff) < 2) painPercentTrend = "stable";
    else painPercentTrend = painDiff > 0 ? "declining" : "improving";

    if (currentAvgSev !== null && previousAvgSev !== null) {
      const sevDiff = currentAvgSev - previousAvgSev;
      if (Math.abs(sevDiff) < 0.3) severityTrend = "stable";
      else severityTrend = sevDiff > 0 ? "declining" : "improving";
    }
  }

  return {
    usersReportingPainPercent: currentPainPct,
    totalAssessments: Number(summary.total_assessments),
    avgSeverity: currentAvgSev,
    topBodyAreas: topAreas.map((a: any) => {
      const prev = prevAreaMap[a.body_part];
      let trend: TrendDirection;
      if (prev) {
        const countDiff = Number(a.report_count) - prev.count;
        if (Math.abs(countDiff) <= 1) trend = "stable";
        else trend = countDiff > 0 ? "declining" : "improving";
      } else {
        trend = "declining";
      }
      return {
        bodyPart: a.body_part,
        count: Number(a.report_count),
        avgSeverity: Math.round(Number(a.avg_severity) * 10) / 10,
        trend,
      };
    }),
    painPercentTrend,
    severityTrend,
    previousUsersReportingPainPercent: previousPainPct,
    previousAvgSeverity: previousAvgSev,
  };
}

function generateInterpretations(
  metrics: AggregateMetrics | null,
  trends: TrendData | null,
  risks: RiskSignals | null
): string[] {
  if (!metrics) return [];
  const narratives: string[] = [];

  if (trends) {
    if (trends.stress === "declining" && (trends.sleep === "declining" || trends.energy === "declining")) {
      narratives.push(
        "Stress has risen while sleep and/or energy have declined. This combination is commonly associated with reduced recovery and increased burnout risk."
      );
    }
    if (trends.clarity === "declining" && trends.mood === "stable") {
      narratives.push(
        "Mental clarity scores have declined despite stable mood, suggesting cognitive overload rather than emotional distress."
      );
    }
    if (trends.mood === "improving" && trends.energy === "improving") {
      narratives.push(
        "Both mood and energy are trending upward, indicating positive momentum across the team."
      );
    }
  }

  if (risks) {
    if (risks.recoveryRisk === "high") {
      narratives.push(
        `Recovery risk is high. Contributing factors: ${risks.recoveryFactors.join(", ").toLowerCase()}.`
      );
    }
    if (risks.cognitiveStrainRisk === "high") {
      narratives.push(
        `Cognitive strain risk is high. Contributing factors: ${risks.cognitiveFactors.join(", ").toLowerCase()}.`
      );
    }
    if (risks.emotionalStrainRisk === "high") {
      narratives.push(
        `Emotional strain risk is high. Contributing factors: ${risks.emotionalFactors.join(", ").toLowerCase()}.`
      );
    }
  }

  return narratives;
}

export async function getCompanySummaries(): Promise<CompanySummary[]> {
  const result = await db.execute(sql`
    SELECT
      company_name,
      COUNT(*)::int AS total_users,
      COUNT(*) FILTER (WHERE is_admin = false)::int AS non_admin_count
    FROM users
    WHERE company_name IS NOT NULL
      AND company_name != ''
    GROUP BY company_name
    ORDER BY company_name
  `);

  const rows = (result as any).rows || result;
  return (rows as any[]).map((row: any) => ({
    companyName: row.company_name,
    userCount: Number(row.total_users),
    eligible: Number(row.non_admin_count) >= MIN_USERS_THRESHOLD,
  }));
}

async function computeBurnoutStats(
  userIds: string[],
  startDate: Date,
  endDate: Date,
  prevStartDate: Date,
  prevEndDate: Date
): Promise<BurnoutStats | null> {
  if (userIds.length === 0) return null;

  const latestScoresSubquery = db
    .select({
      userId: burnoutScores.userId,
      score: burnoutScores.score,
      trajectory: burnoutScores.trajectory,
      topDrivers: burnoutScores.topDrivers,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${burnoutScores.userId} ORDER BY ${burnoutScores.computedDate} DESC)`.as('rn'),
    })
    .from(burnoutScores)
    .where(
      and(
        inArray(burnoutScores.userId, userIds),
        gte(burnoutScores.computedDate, startDate),
        lte(burnoutScores.computedDate, endDate)
      )
    )
    .as('latest');

  const currentRows = await db
    .select()
    .from(latestScoresSubquery)
    .where(eq(latestScoresSubquery.rn, 1));

  if (currentRows.length === 0) return null;

  const scores = currentRows.map(r => r.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const trajectoryDist = { stable: 0, rising: 0, elevated: 0, recovering: 0 };
  currentRows.forEach(r => {
    const t = r.trajectory as keyof typeof trajectoryDist;
    if (t in trajectoryDist) trajectoryDist[t]++;
  });

  const riskBands = { optimal: 0, mild: 0, moderate: 0, high: 0, severe: 0 };
  scores.forEach(s => {
    if (s <= 20) riskBands.optimal++;
    else if (s <= 40) riskBands.mild++;
    else if (s <= 60) riskBands.moderate++;
    else if (s <= 80) riskBands.high++;
    else riskBands.severe++;
  });

  const driverCounts: Record<string, { label: string; count: number }> = {};
  currentRows.forEach(r => {
    const drivers = (r.topDrivers as any[]) || [];
    drivers.forEach((d: any) => {
      const key = d.key || d.label;
      if (!driverCounts[key]) driverCounts[key] = { label: d.label || key, count: 0 };
      driverCounts[key].count++;
    });
  });
  const topDrivers = Object.entries(driverCounts)
    .map(([key, val]) => ({ key, label: val.label, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const prevLatestSubquery = db
    .select({
      userId: burnoutScores.userId,
      score: burnoutScores.score,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${burnoutScores.userId} ORDER BY ${burnoutScores.computedDate} DESC)`.as('rn'),
    })
    .from(burnoutScores)
    .where(
      and(
        inArray(burnoutScores.userId, userIds),
        gte(burnoutScores.computedDate, prevStartDate),
        lte(burnoutScores.computedDate, prevEndDate)
      )
    )
    .as('prev_latest');

  const prevRows = await db
    .select()
    .from(prevLatestSubquery)
    .where(eq(prevLatestSubquery.rn, 1));

  let previousAvgScore: number | null = null;
  let trend: TrendDirection | null = null;

  if (prevRows.length > 0) {
    const prevScores = prevRows.map(r => r.score);
    previousAvgScore = Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length);
    const diff = avgScore - previousAvgScore;
    if (diff > 3) trend = "declining";
    else if (diff < -3) trend = "improving";
    else trend = "stable";
  }

  const burnoutParamIds = sql.join(userIds.map(id => sql`${id}`), sql`, `);
  const burnoutCheckInsResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM burnout_scores
    WHERE user_id IN (${burnoutParamIds})
      AND computed_date >= ${startDate}
      AND computed_date <= ${endDate}
  `);
  const burnoutCheckInsRow = (burnoutCheckInsResult as any).rows?.[0] || (burnoutCheckInsResult as any)[0];
  const totalBurnoutCheckIns = burnoutCheckInsRow ? Number(burnoutCheckInsRow.total) : 0;

  return {
    avgScore,
    usersAssessed: currentRows.length,
    totalCheckIns: totalBurnoutCheckIns,
    trajectoryDistribution: trajectoryDist,
    topDrivers,
    riskBands,
    previousAvgScore,
    trend,
  };
}

export async function getCompanyReport(
  companyName: string,
  windowDays: number = 30,
  monthStr?: string,
  customStart?: Date,
  customEnd?: Date
): Promise<CompanyReport> {
  const userIds = await getCompanyUserIds(companyName);
  const totalUsersInCompany = userIds.length;

  if (totalUsersInCompany < MIN_USERS_THRESHOLD) {
    return {
      companyName,
      window: `${windowDays}d`,
      eligible: false,
      reason: `Minimum ${MIN_USERS_THRESHOLD} non-admin users required for anonymous reporting. Currently ${totalUsersInCompany} user(s).`,
      totalUsersInCompany,
      metrics: null,
      previousMetrics: null,
      trends: null,
      risks: null,
      participation: null,
      monthOverMonth: null,
      bodyMapStats: null,
      burnoutStats: null,
    };
  }

  const { start, end } = customStart && customEnd
    ? { start: customStart, end: customEnd }
    : getDateRange(windowDays);
  const { start: prevStart, end: prevEnd } = customStart && customEnd
    ? (() => {
        const diffMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        prevEnd.setHours(23, 59, 59, 999);
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        prevStart.setHours(0, 0, 0, 0);
        return { start: prevStart, end: prevEnd };
      })()
    : getPreviousDateRange(windowDays);

  const currentMetrics = await computeMetrics(userIds, start, end);
  const previousMetrics = await computeMetrics(userIds, prevStart, prevEnd);

  const trends = computeTrends(currentMetrics, previousMetrics);
  const risks = computeRiskSignals(currentMetrics);

  const activeUsers = currentMetrics?.uniqueUsers || 0;
  const prevActiveUsers = previousMetrics?.uniqueUsers || 0;
  const participationRate = totalUsersInCompany > 0
    ? Math.round((activeUsers / totalUsersInCompany) * 1000) / 10
    : 0;
  const prevParticipationRate = totalUsersInCompany > 0
    ? Math.round((prevActiveUsers / totalUsersInCompany) * 1000) / 10
    : 0;

  const participation: ParticipationData = {
    totalUsersInCompany,
    activeUsersInWindow: activeUsers,
    participationRate,
    changeVsPrevious: previousMetrics
      ? Math.round((participationRate - prevParticipationRate) * 10) / 10
      : null,
  };

  let monthOverMonth: MonthOverMonthData | null = null;
  if (monthStr) {
    const [yearStr, monthNumStr] = monthStr.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthNumStr) - 1;
    const currentMonthRange = getMonthRange(year, month);
    const prevMonthRange = getMonthRange(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);

    const currentMonthMetrics = await computeMetrics(userIds, currentMonthRange.start, currentMonthRange.end);
    const prevMonthMetrics = await computeMetrics(userIds, prevMonthRange.start, prevMonthRange.end);

    const cmActive = currentMonthMetrics?.uniqueUsers || 0;
    const pmActive = prevMonthMetrics?.uniqueUsers || 0;
    const cmRate = totalUsersInCompany > 0 ? Math.round((cmActive / totalUsersInCompany) * 1000) / 10 : 0;
    const pmRate = totalUsersInCompany > 0 ? Math.round((pmActive / totalUsersInCompany) * 1000) / 10 : 0;

    monthOverMonth = {
      currentMonth: monthStr,
      previousMonth: month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, "0")}`,
      current: currentMonthMetrics,
      previous: prevMonthMetrics,
      currentParticipation: {
        totalUsersInCompany,
        activeUsersInWindow: cmActive,
        participationRate: cmRate,
        changeVsPrevious: prevMonthMetrics ? Math.round((cmRate - pmRate) * 10) / 10 : null,
      },
      previousParticipation: {
        totalUsersInCompany,
        activeUsersInWindow: pmActive,
        participationRate: pmRate,
        changeVsPrevious: null,
      },
    };
  }

  const interpretations = generateInterpretations(currentMetrics, trends, risks);
  const bodyMapStats = await computeBodyMapStats(userIds, start, end, totalUsersInCompany, prevStart, prevEnd);
  const burnoutStats = await computeBurnoutStats(userIds, start, end, prevStart, prevEnd);

  return {
    companyName,
    window: `${windowDays}d`,
    eligible: true,
    totalUsersInCompany,
    metrics: currentMetrics,
    previousMetrics,
    trends,
    risks,
    participation,
    monthOverMonth,
    bodyMapStats,
    burnoutStats,
  };
}
