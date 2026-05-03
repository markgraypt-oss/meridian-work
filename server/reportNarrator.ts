import crypto from "crypto";
import { z } from "zod";
import { db } from "./db";
import { reportNarratives } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { aiCall } from "./ai";
import { getEffectiveReportSettings } from "./reportingEngine";
import type { CompanyReport } from "./reportingEngine";

export const ExecutiveSummarySchema = z.object({
  headline: z.string().max(200),
  summary: z.string().max(800),
  highlights: z.array(z.string().max(280)).max(5),
  risks: z.array(z.string().max(280)).max(5),
  recommendations: z.array(z.string().max(280)).max(5),
  caveats: z.array(z.string().max(200)).max(3).optional().default([]),
});
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;

export interface NarrativeResult {
  narrative: ExecutiveSummary | null;
  cached: boolean;
  suppressed: boolean;
  suppressionReason?: string;
  snapshotHash: string;
  windowKey: string;
  cohortSize: number;
  provider?: string | null;
  model?: string | null;
  createdAt?: Date | null;
  validationOutcome?: string;
  safetyFlags?: string[];
  error?: string;
}

// A small, stable projection of the report used for both the prompt and the
// snapshot hash. Excludes any user-identifying fields by construction (the
// reporting engine already returns aggregates).
function buildSnapshot(report: CompanyReport) {
  return {
    company: report.companyName,
    window: report.window,
    totalUsers: report.totalUsersInCompany,
    participation: report.participation,
    metrics: report.metrics,
    previousMetrics: report.previousMetrics,
    trends: report.trends,
    risks: report.risks,
    bodyMapStats: report.bodyMapStats,
    burnoutStats: report.burnoutStats,
  };
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = canonicalize(obj[k]);
      return acc;
    }, {});
}

export function computeSnapshotHash(report: CompanyReport): string {
  const json = JSON.stringify(canonicalize(buildSnapshot(report)));
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 32);
}

export function buildWindowKey(report: CompanyReport, customStart?: string, customEnd?: string): string {
  if (customStart && customEnd) return `custom:${customStart}_${customEnd}`;
  return report.window || "30d";
}

const SYSTEM_GUARDRAILS = `You are an executive workplace wellbeing analyst.

Hard rules:
- Speak ONLY about the aggregate cohort. Never reference individuals, single users, names, departments, or roles.
- Never make medical diagnoses, prescribe treatment, or claim to "cure" conditions.
- If the data is sparse, say so plainly in caveats.
- Use cautious, evidence-aware language ("indicates", "may suggest"). Avoid alarmism.
- No demographic inferences. No legal advice. No HR/disciplinary recommendations.
- Output MUST be raw JSON matching the requested schema. No prose, no markdown.`;

function buildPrompt(report: CompanyReport): string {
  const snapshot = buildSnapshot(report);
  return `${SYSTEM_GUARDRAILS}

Schema (return EXACTLY this shape):
{
  "headline": string (<=160 chars, plain text),
  "summary": string (<=600 chars, 2-3 sentences),
  "highlights": string[] (0-5 short bullet points of positives or neutral observations),
  "risks": string[] (0-5 short bullet points of concerns, ranked by severity),
  "recommendations": string[] (0-5 short, generic, non-medical actions a wellbeing lead could take),
  "caveats": string[] (0-3 data-quality notes, e.g. low participation, short window)
}

Report snapshot (anonymous aggregates):
${JSON.stringify(snapshot, null, 2)}

Return ONLY the JSON object.`;
}

async function findCachedNarrative(companyName: string, windowKey: string, snapshotHash: string, maxAgeMin: number) {
  const rows = await db
    .select()
    .from(reportNarratives)
    .where(and(
      eq(reportNarratives.companyName, companyName),
      eq(reportNarratives.windowKey, windowKey),
      eq(reportNarratives.snapshotHash, snapshotHash),
    ))
    .orderBy(desc(reportNarratives.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.createdAt!).getTime();
  if (ageMs > maxAgeMin * 60_000) return null;
  return row;
}

export async function getCachedExecutiveSummary(report: CompanyReport, customStart?: string, customEnd?: string): Promise<NarrativeResult | null> {
  const settings = await getEffectiveReportSettings(report.companyName);
  const snapshotHash = computeSnapshotHash(report);
  const windowKey = buildWindowKey(report, customStart, customEnd);
  const cohortSize = report.metrics?.uniqueUsers ?? 0;

  // Enforce current k-anonymity policy BEFORE returning anything from cache.
  // If thresholds tighten after a narrative was cached, we must not serve it.
  if (!report.eligible || cohortSize < settings.minCohortSize) {
    const reason = !report.eligible
      ? (report.reason || "Report not eligible for narration")
      : `Active cohort (${cohortSize}) below minimum size of ${settings.minCohortSize} required for AI narrative.`;
    return {
      narrative: null,
      cached: false,
      suppressed: true,
      suppressionReason: reason,
      snapshotHash,
      windowKey,
      cohortSize,
    };
  }

  const cached = await findCachedNarrative(report.companyName, windowKey, snapshotHash, settings.narrativeMaxAgeMinutes);
  if (!cached) return null;
  // Defense-in-depth: if the persisted cohort size is now below the active
  // threshold, don't serve the cached narrative either.
  if (cached.cohortSize < settings.minCohortSize) {
    return {
      narrative: null,
      cached: false,
      suppressed: true,
      suppressionReason: `Cached cohort (${cached.cohortSize}) below current minimum size of ${settings.minCohortSize}.`,
      snapshotHash,
      windowKey,
      cohortSize,
    };
  }
  return {
    narrative: cached.suppressed ? null : (cached.narrative as ExecutiveSummary),
    cached: true,
    suppressed: cached.suppressed,
    suppressionReason: cached.suppressed ? "Cohort below minimum size for AI narrative" : undefined,
    snapshotHash,
    windowKey,
    cohortSize: cached.cohortSize,
    provider: cached.provider,
    model: cached.model,
    createdAt: cached.createdAt,
  };
}

export async function generateExecutiveSummary(
  report: CompanyReport,
  options: { force?: boolean; userId?: string | null; customStart?: string; customEnd?: string } = {}
): Promise<NarrativeResult> {
  const settings = await getEffectiveReportSettings(report.companyName);
  const snapshotHash = computeSnapshotHash(report);
  const windowKey = buildWindowKey(report, options.customStart, options.customEnd);
  const cohortSize = report.metrics?.uniqueUsers ?? 0;

  // Suppress narrative entirely when cohort below k-anonymity threshold OR when
  // the report itself was suppressed (eligible=false).
  if (!report.eligible || cohortSize < settings.minCohortSize) {
    const reason = !report.eligible
      ? (report.reason || "Report not eligible for narration")
      : `Active cohort (${cohortSize}) below minimum size of ${settings.minCohortSize} required for AI narrative.`;
    // Don't cache a suppression — settings may change. Return live result.
    return {
      narrative: null,
      cached: false,
      suppressed: true,
      suppressionReason: reason,
      snapshotHash,
      windowKey,
      cohortSize,
    };
  }

  if (!options.force) {
    const cached = await getCachedExecutiveSummary(report, options.customStart, options.customEnd);
    if (cached) return cached;
  }

  const prompt = buildPrompt(report);
  const result = await aiCall<ExecutiveSummary>({
    feature: "report_narrator",
    userId: options.userId ?? null,
    prompt,
    schema: ExecutiveSummarySchema as unknown as z.ZodType<ExecutiveSummary>,
    maxTokens: 900,
    temperature: 0.3,
  });

  if (!result.data) {
    return {
      narrative: null,
      cached: false,
      suppressed: false,
      snapshotHash,
      windowKey,
      cohortSize,
      validationOutcome: result.validationOutcome,
      safetyFlags: result.safetyFlags,
      error: result.error || "AI narrator returned no valid JSON",
    };
  }

  // Persist (upsert by unique key — when forcing a regenerate we replace the row).
  try {
    await db
      .insert(reportNarratives)
      .values({
        companyName: report.companyName,
        windowKey,
        snapshotHash,
        narrative: result.data,
        provider: null,
        model: null,
        cohortSize,
        suppressed: false,
      })
      .onConflictDoUpdate({
        target: [reportNarratives.companyName, reportNarratives.windowKey, reportNarratives.snapshotHash],
        set: {
          narrative: result.data,
          cohortSize,
          suppressed: false,
          createdAt: new Date(),
        },
      });
  } catch (err: any) {
    console.error("[reportNarrator] cache persist failed:", err?.message);
  }

  return {
    narrative: result.data,
    cached: false,
    suppressed: false,
    snapshotHash,
    windowKey,
    cohortSize,
    validationOutcome: result.validationOutcome,
    safetyFlags: result.safetyFlags,
    createdAt: new Date(),
  };
}
