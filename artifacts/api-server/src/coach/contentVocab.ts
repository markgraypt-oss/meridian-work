// ---------------------------------------------------------------------------
// Canonical tag vocabulary for education content.
//
// This single list is shared by:
//   1. contentTagger.ts       — the AI tagger may ONLY apply labels from here
//   2. contentSearch.ts       — the chat intent extractor is steered towards
//                               these exact terms, so user language and
//                               content tags meet in the middle
//
// Editing rules: keep labels lowercase, in the words a USER would type when
// describing a problem or goal (symptom language beats trainer language).
// Adding a label here makes it available immediately; run the tag backfill
// with force=true to re-tag existing content against an updated list.
// The backfill report's `suggestedNewLabels` shows labels the AI wished it
// had — review and promote them into this list if they make sense.
// ---------------------------------------------------------------------------

export const CONTENT_VOCAB: string[] = [
  // Sleep
  "sleep",
  "insomnia",
  "evening routine",
  "sleep environment",
  "waking at night",

  // Energy
  "low energy",
  "fatigue",
  "afternoon slump",
  "morning routine",

  // Mind & stress
  "stress",
  "anxiety",
  "overwhelm",
  "burnout",
  "work pressure",
  "racing mind",
  "focus",
  "concentration",
  "motivation",
  "procrastination",
  "low mood",

  // Recovery & mindfulness
  "recovery",
  "rest days",
  "breathwork",
  "meditation",
  "mindfulness",
  "journalling",

  // Pain, posture & movement
  "lower back pain",
  "neck pain",
  "shoulder pain",
  "hip pain",
  "knee pain",
  "wrist pain",
  "headaches",
  "posture",
  "desk setup",
  "ergonomics",
  "sitting too much",
  "desk breaks",
  "working positions",
  "rotation schedule",
  "upper back pain",
  "eye strain",
  "stiffness",
  "mobility",
  "stretching",
  "injury prevention",

  // Training
  "strength training",
  "cardio",
  "workout basics",
  "exercise form",
  "warm up",
  "training consistency",
  "short workouts",
  "travel workouts",
  "beginner friendly",

  // Nutrition & hydration
  "nutrition basics",
  "protein",
  "meal planning",
  "emotional eating",
  "snacking",
  "hydration",
  "caffeine",
  "alcohol",
  "weight management",
  "eating out",

  // Lifestyle
  "screen time",
  "work life balance",
  "habit building",
  "goal setting",

  // Life stage (used by lifeStage.ts to surface age/sex-relevant content;
  // after adding labels here, re-run the tag backfill with force=true)
  "menopause",
  "perimenopause",
  "hormones",
  "bone health",
  "muscle loss",
  "balance",
  "healthy ageing",
  "heart health",
  "pelvic floor",
];

const VOCAB_SET = new Set(CONTENT_VOCAB.map((t) => t.toLowerCase()));

/** Case-insensitive filter of arbitrary strings down to canonical labels. */
export function toCanonicalTags(raw: string[], max: number = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw || []) {
    const t = String(r || "").trim().toLowerCase();
    if (!VOCAB_SET.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
