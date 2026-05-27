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
// AGGREGATION — summarise recent notes analyses for the burnout engine
// ====================================================================

export interface NotesAggregate {
  analysisCount: number;                 // how many analyses in the window
  severityCounts: Record<NotesSeverityLevel, number>;
  recurringCategories: string[];         // categories appearing ≥2 times
  recurringPhrases: string[];            // severityIndicators appearing ≥2 times (case-insensitive)
  redFlagCount: number;                  // total redFlagPhrases across all analyses
  mostRecentSeverity: NotesSeverityLevel | null;
  mostRecentCategories: string[];
}

/** Keep only analyses whose analysedAt falls within the cutoff window. */
export function filterToAggregationWindow(
  analyses: NotesAnalysis[],
  cutoffDate: Date,
): NotesAnalysis[] {
  return analyses.filter(a => {
    const d = new Date(a.analysedAt);
    return d.getTime() >= cutoffDate.getTime();
  });
}

/** Aggregate an array of notes analyses into a summary for the burnout engine. */
export function aggregateNotesAnalyses(analyses: NotesAnalysis[]): NotesAggregate {
  const severityCounts: Record<NotesSeverityLevel, number> = {
    none: 0, mild: 0, moderate: 0, high: 0, severe: 0,
  };

  const categoryFreq = new Map<string, number>();
  const phraseFreq = new Map<string, number>(); // lowercased for case-insensitive matching
  let redFlagCount = 0;
  let mostRecent: NotesAnalysis | null = null;

  for (const a of analyses) {
    severityCounts[a.severityLevel]++;

    for (const cat of a.stressorCategories) {
      categoryFreq.set(cat, (categoryFreq.get(cat) || 0) + 1);
    }

    for (const phrase of a.severityIndicators) {
      const key = phrase.trim().toLowerCase();
      if (key.length > 0) {
        phraseFreq.set(key, (phraseFreq.get(key) || 0) + 1);
      }
    }

    redFlagCount += a.redFlagPhrases.length;

    if (!mostRecent || new Date(a.analysedAt) > new Date(mostRecent.analysedAt)) {
      mostRecent = a;
    }
  }

  const recurringCategories = Array.from(categoryFreq.entries())
    .filter(([, count]) => count >= 2)
    .map(([cat]) => cat);

  const recurringPhrases = Array.from(phraseFreq.entries())
    .filter(([, count]) => count >= 2)
    .map(([phrase]) => phrase);

  return {
    analysisCount: analyses.length,
    severityCounts,
    recurringCategories,
    recurringPhrases,
    redFlagCount,
    mostRecentSeverity: mostRecent?.severityLevel ?? null,
    mostRecentCategories: mostRecent?.stressorCategories ?? [],
  };
}
