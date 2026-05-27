// ====================================================================
// NOTES ANALYSER
// ====================================================================
// Parses free-text check-in notes into structured signals using AI.
// Output feeds three places:
//
//   1. Burnout engine    — modest score contribution (severity + red flags)
//   2. AI coach          — heavy context input (specific stressors, history)
//   3. Early warning UI  — critical for making narratives specific not generic
//
// Design principles:
//
//   - Honest structure: we extract what the user actually wrote, not what
//     we wish they'd written. Empty arrays are valid outputs.
//
//   - Verbatim phrases: severity indicators, chronicity markers, protective
//     factors, and red flags are stored as the user's own words. This is
//     what makes downstream narratives specific. Generic categorical
//     labels alone would lose the texture.
//
//   - Versioned schema: the analyserVersion field lets us re-analyse old
//     notes later if we improve the prompt or extraction logic.
//
//   - Hash-based skip: when notes are unchanged between submissions
//     (e.g. user edited an existing check-in without changing notes),
//     we can skip re-analysis by comparing notesHash.
//
//   - Failure-safe: returns null on any error. The check-in still saves.
//     A missing analysis is recoverable; a failed check-in is not.
// ====================================================================

import { createHash } from "crypto";
import { analyzeText, getDefaultConfig } from "./aiProvider";

export const NOTES_ANALYSER_VERSION = "v1";

export type StressorCategory =
  | 'work'
  | 'training'
  | 'relationships'
  | 'health'
  | 'financial'
  | 'sleep'
  | 'family'
  | 'other';

export type NotesSeverityLevel = 'none' | 'mild' | 'moderate' | 'high' | 'severe';

export interface NotesAnalysis {
  stressorCategories: StressorCategory[];
  severityLevel: NotesSeverityLevel;
  severityIndicators: string[];   // verbatim phrases
  chronicityMarkers: string[];    // verbatim phrases
  protectiveFactors: string[];    // verbatim phrases
  redFlagPhrases: string[];       // verbatim phrases
  analysedAt: string;             // ISO timestamp
  analyserVersion: string;
  notesHash: string;
}

// Hash the notes string to allow skip-re-analysis on identical inputs.
// Trims and lowercases first so whitespace-only differences don't matter.
function hashNotes(notes: string): string {
  return createHash('sha256').update(notes.trim().toLowerCase()).digest('hex');
}

// The prompt. This is the single most important piece of this whole file.
// It is engineered to:
//   - Return strict JSON only (no preamble, no markdown fences)
//   - Use verbatim phrases for the *Indicators / *Markers / *Factors / *Phrases arrays
//   - Stay tight on category labels (no improvisation)
//   - Be honest about absence — empty arrays beat hallucinated content
//   - Apply severity carefully — "tired today" is not the same as "I can't do this anymore"
function buildPrompt(notes: string): string {
  return `You are extracting structured burnout-relevant signals from a user's daily check-in notes for a fitness and wellbeing coaching app. The user is writing about how they actually feel and what is going on in their life.

Return ONLY a JSON object matching this exact schema, with no other text, no markdown fences, no explanation:

{
  "stressorCategories": string[],   // pick from: work, training, relationships, health, financial, sleep, family, other
  "severityLevel": string,          // one of: none, mild, moderate, high, severe
  "severityIndicators": string[],   // verbatim phrases from the notes that drove the severity rating
  "chronicityMarkers": string[],    // verbatim phrases indicating time/duration (e.g. "for weeks", "today", "all month", "ongoing")
  "protectiveFactors": string[],    // verbatim phrases describing positive coping or buffers (e.g. "had a great session", "walk with the dog helped", "weekend away coming up")
  "redFlagPhrases": string[]        // verbatim phrases signalling crisis-level distress, hopelessness, wanting to quit, or feeling trapped
}

Rules:
1. Use the user's exact words for all verbatim arrays. Do not paraphrase, summarise, or improve their phrasing.
2. Empty arrays are valid. If the user mentioned no protective factors, return an empty array — do not invent them.
3. Be conservative on severity. Reserve "high" and "severe" for genuine distress. "Bit tired today" is mild. "Haven't slept properly in three weeks and I'm losing it" is high.
4. stressorCategories: only include categories the user actually wrote about. Do not infer absent stressors.
5. redFlagPhrases is for genuine crisis signals only (hopelessness, isolation language, wanting to give up, can't go on). Day-to-day stress complaints do NOT belong here.
6. If notes are very short (e.g. "fine", "ok", a single emoji), return: severityLevel "none", all arrays empty.
7. If notes are entirely positive (e.g. "great day, felt strong"), return: severityLevel "none", stressorCategories empty, protectiveFactors populated.

Notes to analyse:
"""
${notes}
"""

Return JSON only.`;
}

// Parse the AI's response into a typed object. Tolerant of common drift:
// stripped markdown fences, leading whitespace, trailing commentary.
function parseAnalysis(rawResponse: string): Partial<NotesAnalysis> | null {
  try {
    // Strip common wrapping
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      // Remove ```json or ``` prefix and trailing ```
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    // Find the first { and last } to extract just the JSON object if there is preamble/postamble
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonSlice);

    // Light validation — coerce missing arrays to [] and bad severity to 'none'
    const validSeverity: NotesSeverityLevel[] = ['none', 'mild', 'moderate', 'high', 'severe'];
    const validCategories: StressorCategory[] = ['work', 'training', 'relationships', 'health', 'financial', 'sleep', 'family', 'other'];

    return {
      stressorCategories: Array.isArray(parsed.stressorCategories)
        ? parsed.stressorCategories.filter((c: any) => validCategories.includes(c))
        : [],
      severityLevel: validSeverity.includes(parsed.severityLevel) ? parsed.severityLevel : 'none',
      severityIndicators: Array.isArray(parsed.severityIndicators)
        ? parsed.severityIndicators.filter((s: any) => typeof s === 'string')
        : [],
      chronicityMarkers: Array.isArray(parsed.chronicityMarkers)
        ? parsed.chronicityMarkers.filter((s: any) => typeof s === 'string')
        : [],
      protectiveFactors: Array.isArray(parsed.protectiveFactors)
        ? parsed.protectiveFactors.filter((s: any) => typeof s === 'string')
        : [],
      redFlagPhrases: Array.isArray(parsed.redFlagPhrases)
        ? parsed.redFlagPhrases.filter((s: any) => typeof s === 'string')
        : [],
    };
  } catch (err) {
    console.error('[notes-analyser] Failed to parse AI response:', err, 'Raw:', rawResponse?.slice(0, 500));
    return null;
  }
}

// Public API: analyse a notes string. Returns null on any failure or empty input.
// Designed to be called synchronously from the check-in submit handler.
export async function analyseNotes(notes: string | null | undefined): Promise<NotesAnalysis | null> {
  if (!notes || notes.trim().length < 3) {
    // Too short to analyse meaningfully (single word, emoji, etc.)
    return null;
  }

  try {
    const config = getDefaultConfig();
    const startedAt = Date.now();

    const response = await analyzeText(
      {
        prompt: buildPrompt(notes),
        maxTokens: 800,    // schema is tight; 800 is comfortable headroom
        temperature: 0.1,  // low temperature for consistent structured extraction
      },
      config.provider,
      config.model,
    );

    const elapsed = Date.now() - startedAt;
    const parsed = parseAnalysis(response.text);
    if (!parsed) {
      console.warn('[notes-analyser] Could not parse response, returning null');
      return null;
    }

    const result: NotesAnalysis = {
      stressorCategories: parsed.stressorCategories ?? [],
      severityLevel: parsed.severityLevel ?? 'none',
      severityIndicators: parsed.severityIndicators ?? [],
      chronicityMarkers: parsed.chronicityMarkers ?? [],
      protectiveFactors: parsed.protectiveFactors ?? [],
      redFlagPhrases: parsed.redFlagPhrases ?? [],
      analysedAt: new Date().toISOString(),
      analyserVersion: NOTES_ANALYSER_VERSION,
      notesHash: hashNotes(notes),
    };

    console.log(`[notes-analyser] Analysed in ${elapsed}ms: severity=${result.severityLevel}, categories=[${result.stressorCategories.join(',')}], redFlags=${result.redFlagPhrases.length}`);

    return result;
  } catch (err) {
    console.error('[notes-analyser] Analysis failed:', err);
    return null;
  }
}

// Helper for the check-in submit handler: skips re-analysis if notes haven't
// changed (compared by hash) and we already have a valid analysis.
export async function analyseNotesWithCache(
  notes: string | null | undefined,
  existingAnalysis: NotesAnalysis | null | undefined,
): Promise<NotesAnalysis | null> {
  if (!notes || notes.trim().length < 3) return null;
  const newHash = hashNotes(notes);
  if (existingAnalysis && existingAnalysis.notesHash === newHash && existingAnalysis.analyserVersion === NOTES_ANALYSER_VERSION) {
    // Notes unchanged and analysed by current version — reuse existing.
    return existingAnalysis;
  }
  return analyseNotes(notes);
}

// ====================================================================
// AGGREGATION ACROSS RECENT CHECK-INS
// ====================================================================
// Rolls up the last 14 days of notes analyses into a summary the burnout
// engine can reason about. This is what turns per-check-in analysis into
// patterns:
//
//   - "stressor mentioned twice this week" beats "stressor mentioned once 3 weeks ago"
//   - "struggling to switch off" appearing across 3 notes is a meaningful signal
//   - red flag in any recent note matters, regardless of how recent
//
// Window choice (14 days):
//   - Long enough that "recurring" means something (typical user writes
//     meaningful notes ~3x/week, so 14 days = ~6 entries)
//   - Short enough that resolved stressors fall out — a work crisis from
//     3 weeks ago shouldn't colour today's driver narratives
//   - Aligns with the 14-sample calibration window used for physiological
//     baselines for codebase consistency
// ====================================================================

const AGGREGATION_WINDOW_DAYS = 14;
const RECURRING_THRESHOLD = 2; // appears in 2+ recent notes to be "recurring"

export interface NotesAggregate {
  analysisCount: number;           // how many recent check-ins had non-null analysis
  daysWithSeverity: {
    none: number;
    mild: number;
    moderate: number;
    high: number;
    severe: number;
  };
  recurringCategories: { category: StressorCategory; count: number }[];
  recurringPhrases: { phrase: string; count: number }[];
  chronicityCount: number;         // how many had chronicity markers
  protectiveCount: number;         // how many mentioned protective factors
  redFlagCount: number;            // critical — any > 0 should escalate
  mostRecentSeverity: NotesSeverityLevel | null;
  mostRecentCategories: StressorCategory[];
  mostRecentAnalysedAt: string | null;
}

// Build the aggregate from a raw array of stored notes_analysis JSONB blobs.
// The route handler is responsible for fetching the rows; this function is
// pure so it's easy to test and reason about.
export function aggregateNotesAnalyses(
  analyses: (NotesAnalysis | null | undefined)[],
): NotesAggregate {
  const valid = analyses.filter((a): a is NotesAnalysis => a !== null && a !== undefined);

  const daysWithSeverity = { none: 0, mild: 0, moderate: 0, high: 0, severe: 0 };
  const categoryCounts: Map<StressorCategory, number> = new Map();
  // Phrase counts are case-insensitive to catch "Work pressure" and "work pressure"
  // as the same recurring phrase, but we keep the original casing for display.
  const phraseCounts: Map<string, { display: string; count: number }> = new Map();

  let chronicityCount = 0;
  let protectiveCount = 0;
  let redFlagCount = 0;

  // Sort by analysedAt descending so "most recent" is index 0
  const sortedDesc = [...valid].sort((a, b) =>
    (b.analysedAt || '').localeCompare(a.analysedAt || '')
  );

  for (const a of sortedDesc) {
    if (a.severityLevel && daysWithSeverity[a.severityLevel] !== undefined) {
      daysWithSeverity[a.severityLevel]++;
    }
    for (const cat of a.stressorCategories || []) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    // Phrase aggregation uses severity indicators specifically — those are
    // the phrases that drove burnout-relevant interpretation. We deliberately
    // skip chronicity/protective/redFlag arrays here to keep the recurring
    // phrase signal focused on stressor language.
    for (const phrase of a.severityIndicators || []) {
      const key = phrase.toLowerCase().trim();
      if (!key) continue;
      const existing = phraseCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        phraseCounts.set(key, { display: phrase.trim(), count: 1 });
      }
    }
    if ((a.chronicityMarkers || []).length > 0) chronicityCount++;
    if ((a.protectiveFactors || []).length > 0) protectiveCount++;
    if ((a.redFlagPhrases || []).length > 0) redFlagCount++;
  }

  const recurringCategories = Array.from(categoryCounts.entries())
    .filter(([, count]) => count >= RECURRING_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  const recurringPhrases = Array.from(phraseCounts.values())
    .filter((v) => v.count >= RECURRING_THRESHOLD)
    .sort((a, b) => b.count - a.count)
    .map((v) => ({ phrase: v.display, count: v.count }));

  const mostRecent = sortedDesc[0];

  return {
    analysisCount: valid.length,
    daysWithSeverity,
    recurringCategories,
    recurringPhrases,
    chronicityCount,
    protectiveCount,
    redFlagCount,
    mostRecentSeverity: mostRecent?.severityLevel ?? null,
    mostRecentCategories: mostRecent?.stressorCategories ?? [],
    mostRecentAnalysedAt: mostRecent?.analysedAt ?? null,
  };
}

// Helper: filter analyses to the aggregation window using their analysedAt.
// Exported so the route handler can use the same window logic consistently.
export function filterToAggregationWindow(
  analyses: (NotesAnalysis | null | undefined)[],
): (NotesAnalysis | null | undefined)[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AGGREGATION_WINDOW_DAYS);
  return analyses.filter((a) => {
    if (!a || !a.analysedAt) return false;
    return new Date(a.analysedAt) >= cutoff;
  });
}

