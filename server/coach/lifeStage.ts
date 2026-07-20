// ---------------------------------------------------------------------------
// Life-stage awareness for every AI coaching surface.
//
// The app collects date of birth and gender in the user profile. This module
// turns those two fields into (a) a guidance block injected into AI prompts so
// the coach speaks to the user's actual life stage (a 22-year-old man and a
// 55-year-old woman get meaningfully different advice), and (b) search-term
// hints so education content relevant to their life stage surfaces first.
//
// Consumed by:
//   1. aiProvider.getUserDataContext  — central injection: coach chat,
//      briefings, proactive greeting, nutrition, recovery, burnout insight,
//      check-in insights, workout adaptation all flow through it
//   2. weeklyCheckin.generatePatternsNarrative — compact brief appended
//   3. coach/contentSearch.extractContentIntent — life-stage search hint
//
// Editing rules: this is coaching guidance, not medical advice. Keep the
// framing rules intact (never assume symptoms, never diagnose, never
// patronise). Wording changes are welcome; run them past Mark first.
// ---------------------------------------------------------------------------

export type SexKey = "male" | "female";
export type AgeBand = "18-29" | "30-44" | "45-59" | "60-74" | "75+";

export interface LifeStage {
  age: number | null;
  sex: SexKey | null;
  band: AgeBand | null;
  /** True when gender is explicitly "prefer not to say" — never nudge. */
  sexWithheld: boolean;
}

// --- Profile parsing -------------------------------------------------------

/** Map free-text gender values to a coaching sex key. Non-binary and
 *  "prefer not to say" intentionally return null → neutral guidance. */
export function normalizeSex(gender: string | null | undefined): SexKey | null {
  const g = String(gender || "").trim().toLowerCase();
  if (g === "male" || g === "man" || g === "m") return "male";
  if (g === "female" || g === "woman" || g === "f") return "female";
  return null;
}

/** Age from a YYYY-MM-DD (or ISO timestamp) DOB string. Null if unparseable. */
export function computeAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const raw = String(dateOfBirth).slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!y || !mo || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 && age <= 120 ? age : null;
}

export function getAgeBand(age: number | null): AgeBand | null {
  if (age === null || age < 18) return null;
  if (age <= 29) return "18-29";
  if (age <= 44) return "30-44";
  if (age <= 59) return "45-59";
  if (age <= 74) return "60-74";
  return "75+";
}

export function getLifeStage(user: {
  dateOfBirth?: string | null;
  gender?: string | null;
}): LifeStage {
  const age = computeAge(user?.dateOfBirth);
  const sex = normalizeSex(user?.gender);
  const g = String(user?.gender || "").trim().toLowerCase();
  return {
    age,
    sex,
    band: getAgeBand(age),
    sexWithheld: g === "prefer not to say",
  };
}

// --- Guidance modules ------------------------------------------------------
// Written in the app's coaching voice: evidence-based, measured, suggestion
// not instruction. Each module is context the coach WEAVES IN, never recites.

const FRAMING_RULES = `HOW TO USE THIS LIFE-STAGE CONTEXT (always follow):
- Weave it in naturally. Never recite it, never open with "as a woman your age" or similar labels.
- Treat life-stage factors as possibilities to explore, never assumptions. Ask gently before attributing a symptom to age or hormones, and never attribute everything to one cause.
- Age is context, not a limitation. Never patronise, never treat older users as fragile by default. Many are highly capable and should be coached ambitiously.
- Hormonal, screening, and medication topics: share general evidence-based context only, then suggest a GP or relevant specialist. Never diagnose, never recommend for or against any treatment.`;

const GUIDANCE: Record<SexKey, Record<AgeBand, string>> = {
  male: {
    "18-29": `Men 18-29: peak recovery capacity and training response. This is the prime window to build lifetime muscle and bone through progressive resistance training, and to groove good movement quality before load climbs. Injury prevention and form fundamentals beat intensity chasing. Sleep is often the weak link at this age (late nights, irregular schedules) and quietly caps progress. Alcohol meaningfully blunts recovery and sleep quality. Habits built now compound for decades, so consistency matters more than any single programme. Young men often under-report stress and low mood; take openings to check in on mental wellbeing seriously and without drama.`,
    "30-44": `Men 30-44: recovery starts to slow subtly, and life load (career, family) usually peaks. Time-efficient training and the minimal effective dose matter more than volume; short consistent sessions beat sporadic big ones. Warm-ups earn their time now, soft-tissue injuries become more common when skipped. Testosterone declines gradually from the 30s, but sleep, resistance training, and healthy body composition strongly moderate this; lifestyle is the first lever, not supplements. Desk-bound stretches of the day, stress, and shrinking sleep are the usual hidden drags on energy. An aerobic base (easy zone-2 style work) protects long-term heart health.`,
    "45-59": `Men 45-59: preserving muscle is now a priority, age-related muscle loss picks up from the 40s and resistance training 2-3 times a week is the single highest-leverage habit. Cardiovascular risk rises through this decade: steady aerobic work, blood pressure awareness, and routine health checks (cholesterol, blood pressure, age-appropriate screening) are worth encouraging in a low-key way. Recovery genuinely takes longer, planned easier days prevent the injury cycle. Joints appreciate variation (grip changes, range adjustments) rather than abandoning loading. Metabolism and body composition shift; alcohol hits sleep and recovery harder than it did at 30. Sleep quality often dips in this decade and is worth working on directly.`,
    "60-74": `Men 60-74: muscle power (moving with speed) declines faster than strength, so where movement quality allows, include controlled faster-intent work (sit-to-stand quickly, brisk hill walks, light medicine-ball throws). Keep progressive resistance training central, it remains highly effective at this age. Balance work protects independence and is easy to fold into sessions. Bone density benefits from loading and impact appropriate to the joints. Recovery windows lengthen: 48 hours between hard sessions on the same muscle groups is a sensible default. Warm-ups should be longer and more gradual. If dizziness, chest symptoms, new pain, or medication questions come up, route to a GP promptly. Coach ambitiously, capability at this age is often underestimated, including by the user themselves.`,
    "75+": `Men 75+: the big rocks are leg strength, grip strength, and balance, they protect independence and are all trainable at any age. Sit-to-stand ability is a great everyday benchmark. Falls prevention is a priority: balance practice, unhurried transitions, good footwear, strength through the hips and ankles. Daily movement (walking, gardening, stairs) counts and compounds; celebrate it. Progress in smaller steps with longer adaptation time, and treat unusual fatigue, dizziness, or new symptoms as a prompt to check with a GP, especially where medications are involved. Purpose, routine, and social connection are performance factors at every age but especially now. Never talk down; coach the person, not the birth year.`,
  },
  female: {
    "18-29": `Women 18-29: peak bone-building years, bone density built through the 20s via resistance and impact training is banked for life, so strength work now is a genuinely long-term investment. The menstrual cycle can meaningfully shift energy, sleep, and mood across the month; training through all phases works well, with intensity adjusted by feel rather than rigid rules. If cycle tracking data is available, use it. Be alert to the combination of high training load and under-fuelling (persistent fatigue, missed or absent periods, recurring injuries or illness): treat it as a health signal worth raising kindly, suggest professional support, and never reinforce restrictive eating patterns. Hormonal contraception affects individuals differently (mood, energy); acknowledge without medical advice. Anchor coaching in performance and capability, not aesthetics.`,
    "30-44": `Women 30-44: strength and bone maintenance remain high-leverage, keep progressive resistance training central. Life load often peaks (career, possibly young children), so time-efficient sessions and realistic consistency beat ambitious plans. If pregnancy or postpartum comes up, be supportive and general, and route programming questions to appropriate professionals (midwife, GP, pelvic health physio); pelvic floor symptoms after childbirth are common, trainable, and worth professional attention, never something to just live with. Cycle-linked energy shifts remain relevant. From the late 30s onward, perimenopause can begin: cycle changes, sleep disruption, or mood shifts may appear years before periods stop. Hold it as one gentle possibility among several, never a default explanation.`,
    "45-59": `Women 45-59: perimenopause and menopause are likely relevant in this decade (average age of menopause is around 51), and this context should inform, not dominate, coaching. Falling oestrogen can bring hot flushes and night sweats (a major driver of broken sleep), mood changes, brain fog, joint aches, and a shift in body composition toward the middle, and it accelerates bone and muscle loss. Two practical consequences: resistance training becomes the single most valuable habit of this decade (muscle, bone, metabolic health, mood), and sleep strategies deserve direct attention (cool room, wind-down routine, caffeine and alcohol timing). Recovery takes a little longer; stress management punches above its weight because high stress amplifies symptoms. If symptoms are affecting quality of life, mention that effective support exists, including HRT for many women, as a factual option to discuss with a GP or menopause specialist, without recommending for or against. Critically: never assume any individual woman is symptomatic, ask gently, and never attribute every issue to menopause.`,
    "60-74": `Women 60-74: after menopause, bone health moves to the centre, women lose bone faster than men and fracture risk is significantly higher, so resistance training plus appropriate impact and balance work is the core prescription. Muscle power declines faster than strength; where joints allow, include controlled faster-intent movements (brisk sit-to-stands, step-ups). Cardiovascular risk rises after menopause toward parity with men, making aerobic work and routine health checks quietly important. Recovery windows lengthen, plan easier days rather than pushing through. Pelvic health remains relevant and trainable; signpost a pelvic health physio where symptoms come up. Joint-friendly variations keep loading sustainable. Coach ambitiously, capability at this age is routinely underestimated.`,
    "75+": `Women 75+: falls and fracture prevention lead, because bone fragility makes falls higher-consequence; the answer is not less movement but smarter movement: balance practice, leg and hip strength, grip work, unhurried transitions, good footwear. Sit-to-stand ability is a great everyday benchmark. Daily movement counts and compounds, celebrate walking, stairs, gardening. Progress in smaller steps with longer adaptation. Treat unusual fatigue, dizziness, or new symptoms as a prompt to check with a GP, especially alongside medications. Purpose, routine, and social connection are real wellbeing levers. Never talk down; coach the person, not the birth year.`,
  },
};

// Neutral fallback when age is known but sex is unknown, non-binary, or withheld.
const NEUTRAL_GUIDANCE: Record<AgeBand, string> = {
  "18-29": `Adults 18-29: peak recovery and adaptation, the prime window to build lifetime strength, bone, and movement quality. Form and consistency beat intensity chasing; sleep and alcohol are the usual hidden limiters. Habits built now compound for decades.`,
  "30-44": `Adults 30-44: recovery slows subtly while life load peaks. Time-efficient training, warm-ups, an aerobic base, and protecting sleep are the levers. Consistency beats volume.`,
  "45-59": `Adults 45-59: preserving muscle and bone becomes a priority, resistance training 2-3 times a week is the highest-leverage habit. Recovery takes longer, cardiovascular health and sleep quality deserve direct attention, and routine health checks are worth encouraging.`,
  "60-74": `Adults 60-74: keep progressive resistance training central, add balance work and, where joints allow, controlled faster-intent movement for power. Longer warm-ups and recovery windows. Coach ambitiously, capability is often underestimated.`,
  "75+": `Adults 75+: leg strength, grip, and balance protect independence and are trainable at any age. Daily movement counts; progress in smaller steps. New symptoms or dizziness route to a GP. Never patronise.`,
};

// --- Prompt block builders -------------------------------------------------

const PROFILE_NUDGE = `The user's age and/or gender is not set in their profile. Give solid general-population advice. If, and only if, tailoring by age or life stage would clearly improve your answer, you may ONCE in a conversation briefly and warmly mention that adding date of birth or gender under Profile > Edit Profile lets you tailor advice to their life stage. Check the conversation history first: if you have already mentioned it, never repeat it. Never pressure, never make it a condition of helping.`;

const PROFILE_NUDGE_WITHHELD = `The user has chosen not to share their gender. Respect this completely: give inclusive, general-population advice and NEVER ask about or reference gender, sex, or hormones unless the user raises them first.`;

function describeUser(stage: LifeStage): string {
  const sexWord = stage.sex === "male" ? "man" : stage.sex === "female" ? "woman" : "person";
  if (stage.age !== null && stage.sex) return `The user is a ${stage.age}-year-old ${sexWord}.`;
  if (stage.age !== null) return `The user is ${stage.age} years old.`;
  if (stage.sex) return `The user is a ${sexWord} (age not provided).`;
  return "";
}

/**
 * Full life-stage block for AI prompts. Returns '' only when there is truly
 * nothing useful to say (should not happen; missing data yields the nudge).
 */
export function buildLifeStageContext(user: {
  dateOfBirth?: string | null;
  gender?: string | null;
} | null | undefined): string {
  const stage = getLifeStage(user || {});
  const parts: string[] = ["\n\nUSER LIFE-STAGE CONTEXT:"];

  const desc = describeUser(stage);
  if (desc) parts.push(desc);

  if (stage.band && stage.sex) {
    parts.push(GUIDANCE[stage.sex][stage.band]);
    parts.push(FRAMING_RULES);
  } else if (stage.band) {
    parts.push(NEUTRAL_GUIDANCE[stage.band]);
    parts.push(FRAMING_RULES);
    if (stage.sexWithheld) parts.push(PROFILE_NUDGE_WITHHELD);
    else parts.push(PROFILE_NUDGE);
  } else {
    // No usable age. Sex-only guidance is too thin to stereotype from;
    // stay neutral and (unless withheld) invite profile completion.
    if (stage.sexWithheld) parts.push(PROFILE_NUDGE_WITHHELD);
    else parts.push(PROFILE_NUDGE);
  }

  return parts.join("\n");
}

/**
 * One-line brief for compact prompts (weekly check-in, intent extraction).
 * Returns '' when age is unknown.
 */
export function buildLifeStageBrief(user: {
  dateOfBirth?: string | null;
  gender?: string | null;
} | null | undefined): string {
  const stage = getLifeStage(user || {});
  if (stage.age === null) return "";
  const desc = describeUser(stage);
  const hints: string[] = [];
  if (stage.sex === "female" && stage.band === "45-59") {
    hints.push("perimenopause or menopause may be relevant (e.g. sleep disruption, recovery, mood) but must never be assumed");
  }
  if (stage.band === "60-74" || stage.band === "75+") {
    hints.push("consider recovery time, bone and muscle preservation, and balance; never treat age as fragility");
  }
  if (stage.sex === "female" && (stage.band === "60-74" || stage.band === "75+")) {
    hints.push("post-menopausal bone health is a priority");
  }
  return hints.length > 0
    ? `${desc} Life-stage lens: ${hints.join("; ")}.`
    : desc;
}

/**
 * Search-term hints for education content retrieval, aligned with
 * CONTENT_VOCAB labels so they match how content is tagged. Used to bias the
 * intent extractor, not to force recommendations.
 */
export function getLifeStageSearchTerms(user: {
  dateOfBirth?: string | null;
  gender?: string | null;
} | null | undefined): string[] {
  const stage = getLifeStage(user || {});
  if (!stage.band) return [];
  const terms: string[] = [];
  if (stage.sex === "female") {
    if (stage.band === "30-44") terms.push("hormones", "pelvic floor");
    if (stage.band === "45-59") terms.push("menopause", "perimenopause", "hormones", "bone health");
    if (stage.band === "60-74" || stage.band === "75+") terms.push("bone health", "balance", "muscle loss", "healthy ageing");
  } else if (stage.sex === "male") {
    if (stage.band === "45-59") terms.push("heart health", "muscle loss");
    if (stage.band === "60-74" || stage.band === "75+") terms.push("balance", "muscle loss", "healthy ageing", "bone health");
  } else {
    if (stage.band === "60-74" || stage.band === "75+") terms.push("balance", "muscle loss", "healthy ageing");
  }
  return terms;
}
