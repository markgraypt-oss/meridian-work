import { z } from "zod";
import { aiCall } from "../ai";
import { CONTENT_VOCAB } from "./contentVocab";
import {
  buildEducationLines,
  searchEducationContent,
  resolveRecommendations as resolveEducationRefs,
  type EducationCandidate,
} from "./contentSearch";
import {
  relevantActions,
  resolveDomainRef,
  searchBreathTechniques,
  searchExercises,
  searchHabitTemplates,
  searchMeditations,
  searchProgrammes,
  searchRecipes,
  searchWorkday,
  searchWorkouts,
  type DomainCandidate,
  type DomainKey,
  type RecAction,
  type RecRef,
  type ResolvedRec,
} from "./recommendationDomains";
import { formatUserStateBlock, getUserStateSnapshot, type UserStateSnapshot } from "./userState";
import { buildLifeStageBrief, getLifeStageSearchTerms } from "./lifeStage";

// ---------------------------------------------------------------------------
// Universal coach recommendation engine.
//
// Orchestrates, per chat message:
//   1. extractRecIntent      — ONE small schema-validated AI call (an extension
//      of the original education-only intent call, same cost) decides which
//      recommendation domains could help and with what search terms.
//   2. Fan-out search        — only the requested domains are searched, in
//      parallel, via plain SQL. The user-state snapshot loads alongside.
//   3. buildRecommendationBlock — one unified shortlist (grouped by domain,
//      stable [domain:id] refs, user status, eligible actions) plus the
//      marker rules and a compact USER STATE section.
//   4. parseAllRecMarkers / resolveAllRecommendations — generalises the
//      original [[REC video:12]] grammar to [[REC <domain>:<id|key>]].
//      Education refs resolve through contentSearch.ts; everything else
//      through recommendationDomains.ts. Only validated cards reach the
//      client; every card shown is logged to coach_recommendations.
//
// Every step fails soft: any error leaves the chat working without
// recommendations, exactly like the original education pipeline.
// ---------------------------------------------------------------------------

export const REC_INTENT_DOMAINS = [
  "learn",
  "workday",
  "programme",
  "workout",
  "exercise",
  "recipe",
  "meditation",
  "breath",
  "habit",
] as const;
export type RecIntentDomain = (typeof REC_INTENT_DOMAINS)[number];

export type RecIntent = {
  wantsRecs: boolean;
  searchTerms: string[];
  domains: RecIntentDomain[];
  contentType: "video" | "path" | "any";
};

const recIntentSchema = z.object({
  wantsRecs: z.boolean(),
  searchTerms: z.array(z.string()).max(8).default([]),
  domains: z.array(z.enum(REC_INTENT_DOMAINS)).max(3).default([]),
  contentType: z.enum(["video", "path", "any"]).default("any"),
});

const REC_KEYWORD_FALLBACK =
  /\b(video|videos|watch|learn|course|guide|programme|program|workout|desk|posture|stretch|micro.?reset|rotation|neck|back pain|stiff)\b/i;

/**
 * One small classification call covering every recommendation domain. Replaces
 * (and extends) contentSearch.extractContentIntent for the chat flow — same
 * model, same cost, one extra output field.
 */
export async function extractRecIntent(
  userId: string,
  message: string,
  recentHistory: string,
  provider?: string,
  model?: string,
  lifeStageHint?: string,
): Promise<RecIntent> {
  const lifeStageBlock = lifeStageHint
    ? `\n\nUser life-stage context: ${lifeStageHint}\nWhen the message topic could plausibly connect to their life stage (sleep, energy, mood, body changes, recovery, bone or joint concerns), include the relevant life-stage terms above among searchTerms so age-appropriate content surfaces. Do not force them onto unrelated topics.`
    : "";
  const prompt = `You classify one chat message for an executive wellness app, deciding whether in-app recommendations could genuinely help with the user's CURRENT message, and from which areas.

Available recommendation domains:
- "learn": short educational videos, guides and learning paths (sleep, stress, nutrition habits, posture, breathwork, recovery, training principles, burnout, focus).
- "workday": desk health content — 2-minute micro-reset movements for desk aches (neck, upper back, lower back, hips, wrists), desk working positions, ache/fix guides, rotation planning. Choose when the user mentions desk work, sitting, posture, stiffness or aches from working.
- "programme": structured multi-week training programmes. Choose when the user wants a new training plan, asks what programme to do, or wants structure for their training.
- "workout": single one-off workouts (strength, conditioning, mobility, stretching, corrective). Choose when the user wants something to do today or a quick session, not a multi-week plan.
- "exercise": individual exercises with video tutorials. Choose when the user asks about a specific movement, muscle, or exercise alternatives.
- "recipe": recipes with per-serving macros. Choose ONLY when the user explicitly asks about food, meals, recipes, or nutrition.
- "meditation": guided audio meditations (sleep, stress, focus, recovery). Choose for stress, racing mind, poor sleep, or when the user asks to relax or unwind.
- "breath": guided breathing techniques (relaxation, energy, focus, recovery). Choose for acute stress, pre-sleep wind-down, energy dips, or breathwork requests.
- "habit": small trackable daily habits. Choose when the user wants to build consistency or asks how to make something stick.

Set wantsRecs=true when the user asks a how/why/what-should-I question about a health or performance topic, describes a struggle (poor sleep, stress, desk aches, low energy), or asks for content, exercises, or a plan. Set wantsRecs=false for app/logistics questions, greetings, pure data lookups ("what was my HRV yesterday"), scheduling, app feedback, or emotional venting where suggestions would feel dismissive.

domains: 1-3 domains that fit, most relevant first. Empty if wantsRecs is false.
searchTerms: 2 to 6 short lowercase keywords or phrases capturing the topics. STRONGLY prefer terms from this canonical tag list when any fit: ${CONTENT_VOCAB.join(", ")}. Add a term outside the list only when nothing on it applies.
contentType (learn domain only): "path" for a structured course, "video" for one quick thing to watch, otherwise "any".${lifeStageBlock}

Recent conversation:
${recentHistory || "(none)"}

User message: "${message}"

Respond ONLY with JSON: {"wantsRecs": boolean, "searchTerms": string[], "domains": string[], "contentType": "video" | "path" | "any"}`;

  try {
    const result = await aiCall<RecIntent>({
      feature: "coach_content_search",
      userId,
      prompt,
      schema: recIntentSchema as z.ZodType<RecIntent>,
      provider,
      model,
      maxTokens: 250,
      temperature: 0,
      timeoutMs: 12_000,
    });
    if (result.data) {
      return {
        wantsRecs: result.data.wantsRecs,
        searchTerms: (result.data.searchTerms || []).slice(0, 8),
        domains: (result.data.domains || []).slice(0, 3),
        contentType: result.data.contentType || "any",
      };
    }
  } catch (e: any) {
    console.error("[coach-recs] intent extraction failed:", e?.message || e);
  }
  // Conservative fallback: learn-only, explicit-sounding requests.
  return {
    wantsRecs: REC_KEYWORD_FALLBACK.test(message),
    searchTerms: [],
    domains: ["learn"],
    contentType: "any",
  };
}

export type RecommendationContext = {
  block: string; // shortlist + rules, "" when nothing to offer
  stateBlock: string; // compact USER STATE section, "" on failure
  state: UserStateSnapshot | null;
};

/**
 * The one call the chat route makes before prompting the coach. Never throws.
 */
export async function gatherRecommendationContext(
  userId: string,
  message: string,
  recentHistory: string,
  provider?: string,
  model?: string,
  user?: any,
): Promise<RecommendationContext> {
  let state: UserStateSnapshot | null = null;
  let stateBlock = "";
  let block = "";

  try {
    // Life-stage hint biases search terms so age/sex-relevant content
    // (e.g. menopause, bone health) surfaces first. Fails soft.
    let lifeStageHint = "";
    try {
      const lifeStageTerms = user ? getLifeStageSearchTerms(user) : [];
      if (user && lifeStageTerms.length > 0) {
        lifeStageHint = `${buildLifeStageBrief(user)} Relevant life-stage terms: ${lifeStageTerms.join(", ")}.`;
      }
    } catch (e: any) {
      console.error("[coach-recs] life-stage hint failed:", e?.message || e);
    }

    const [intent, snapshot] = await Promise.all([
      extractRecIntent(userId, message, recentHistory, provider, model, lifeStageHint),
      getUserStateSnapshot(userId).catch(() => null),
    ]);
    state = snapshot;
    if (state) {
      const formatted = formatUserStateBlock(state);
      if (formatted) {
        stateBlock = `\n\nUSER STATE (live app data — personalise with this, reference it naturally):\n${formatted}`;
      }
    }

    if (!intent.wantsRecs || intent.domains.length === 0) {
      return { block: "", stateBlock, state };
    }

    const want = (d: RecIntentDomain) => intent.domains.includes(d);
    const none = Promise.resolve([] as DomainCandidate[]);

    const [education, workday, programmes, workoutsFound, exercises, recipesFound, meditationsFound, breath, habits] =
      await Promise.all([
        want("learn")
          ? searchEducationContent({ terms: intent.searchTerms, contentType: intent.contentType, limit: 6 }).catch(
              () => [] as EducationCandidate[],
            )
          : Promise.resolve([] as EducationCandidate[]),
        want("workday") ? searchWorkday(intent.searchTerms, 6) : none,
        want("programme") ? searchProgrammes(intent.searchTerms, state, 5) : none,
        want("workout") ? searchWorkouts(intent.searchTerms, state, 5) : none,
        want("exercise") ? searchExercises(intent.searchTerms, state, 5) : none,
        want("recipe") ? searchRecipes(intent.searchTerms, 5) : none,
        want("meditation") ? searchMeditations(intent.searchTerms, 4) : none,
        want("breath") ? searchBreathTechniques(intent.searchTerms, 4) : none,
        want("habit") ? searchHabitTemplates(intent.searchTerms, 4) : none,
      ]);

    const actions = state ? relevantActions(state, intent.searchTerms, intent.domains) : [];

    block = await buildRecommendationBlock(userId, {
      education,
      workday,
      programmes,
      workouts: workoutsFound,
      exercises,
      recipes: recipesFound,
      meditations: meditationsFound,
      breath,
      habits,
      actions,
      state,
    });
  } catch (e: any) {
    console.error("[coach-recs] gather failed:", e?.message || e);
  }

  return { block, stateBlock, state };
}

async function buildRecommendationBlock(
  userId: string,
  parts: {
    education: EducationCandidate[];
    workday: DomainCandidate[];
    programmes: DomainCandidate[];
    workouts: DomainCandidate[];
    exercises: DomainCandidate[];
    recipes: DomainCandidate[];
    meditations: DomainCandidate[];
    breath: DomainCandidate[];
    habits: DomainCandidate[];
    actions: RecAction[];
    state: UserStateSnapshot | null;
  },
): Promise<string> {
  const sections: string[] = [];

  if (parts.education.length > 0) {
    try {
      const { videoLines, pathLines } = await buildEducationLines(userId, parts.education);
      if (videoLines.length > 0) sections.push("Videos & guides:\n" + videoLines.join("\n"));
      if (pathLines.length > 0) sections.push("Learning paths:\n" + pathLines.join("\n"));
    } catch (e: any) {
      console.error("[coach-recs] education lines failed:", e?.message || e);
    }
  }

  if (parts.workday.length > 0) {
    sections.push("Desk health (Workday Wellness section):\n" + parts.workday.map((c) => c.promptLine).join("\n"));
  }
  if (parts.programmes.length > 0) {
    sections.push("Training programmes:\n" + parts.programmes.map((c) => c.promptLine).join("\n"));
  }
  if (parts.workouts.length > 0) {
    sections.push("Single workouts:\n" + parts.workouts.map((c) => c.promptLine).join("\n"));
  }
  if (parts.exercises.length > 0) {
    sections.push("Exercises (with video tutorials):\n" + parts.exercises.map((c) => c.promptLine).join("\n"));
  }
  if (parts.recipes.length > 0) {
    sections.push("Recipes (macros are per serving):\n" + parts.recipes.map((c) => c.promptLine).join("\n"));
  }
  if (parts.meditations.length > 0) {
    sections.push("Guided meditations:\n" + parts.meditations.map((c) => c.promptLine).join("\n"));
  }
  if (parts.breath.length > 0) {
    sections.push("Breathing techniques:\n" + parts.breath.map((c) => c.promptLine).join("\n"));
  }
  if (parts.habits.length > 0) {
    sections.push("Trackable habits:\n" + parts.habits.map((c) => c.promptLine).join("\n"));
  }
  if (parts.actions.length > 0) {
    sections.push(
      "App actions (features this user has NOT set up or done yet — only suggest when genuinely relevant):\n" +
        parts.actions.map((a) => `- [action:${a.key}] "${a.title}" | ${a.description}`).join("\n"),
    );
  }

  if (sections.length === 0) return "";

  const recoveryModeRule = parts.state?.burnout.recoveryMode
    ? "\n- RECOVERY MODE IS ACTIVE: only recommend recovery-supportive options (desk resets, gentle movement, education). Do not recommend intense training."
    : "";

  const header =
    "\n\nIN-APP RECOMMENDATIONS RETRIEVED FOR THIS MESSAGE (the only items you may recommend as cards):";
  const rules = `RECOMMENDATION RULES:
- If one or more of these genuinely help with what the user is discussing, weave the names naturally into your reply, then add one marker per recommendation on its own line at the very END of your reply, e.g. [[REC micro_reset:7]], [[REC programme:12]], [[REC meditation:5]], [[REC breath:box-breathing]] or [[REC action:setup_rotation]] (using the real refs above).
- Maximum 3 markers, and at most 2 from any single group. Only refs from the lists above. Never invent or guess refs.
- Prefer items matching the user's state (equipment, experience, current programme, pain areas). Prefer content the user has not completed. If a path is assigned and in progress, prefer its "next up" video.
- Recommend an action card only when it clearly moves the user forward on what they raised.
- If nothing fits well, use no markers at all. A forced recommendation is worse than none.${recoveryModeRule}
- Markers are machine-read and stripped before the user sees your reply. Do not mention, quote, or explain them.`;

  return [header, ...sections, rules].join("\n\n");
}

// --- marker parsing + resolution ------------------------------------------

const ALL_REC_MARKER_RE = /\[{1,2}\s*REC\s+([a-z_]+)\s*:\s*([a-z0-9_\-]+)\s*\]{1,2}/gi;

// "workout" and "recipe" markers come from the bulk library lists that
// getUserDataContext still injects (see the TAPPABLE RECOMMENDATION MARKERS
// prompt section in routes.ts); they resolve through contentSearch's
// extended resolver. "program" is accepted as an alt spelling of "programme".
const NUMERIC_DOMAINS = new Set<string>([
  "video", "path", "micro_reset", "position", "ache_fix", "programme", "workout", "exercise", "recipe", "meditation", "habit",
]);
// Key-based domains: "action" (registry keys) and "breath" (technique slugs).
const VALID_DOMAINS = new Set<string>([
  ...NUMERIC_DOMAINS, "program", "breath", "action",
]);

export function parseAllRecMarkers(text: string): { cleanText: string; refs: RecRef[] } {
  const refs: RecRef[] = [];
  const seen = new Set<string>();
  const cleanText = String(text || "")
    .replace(ALL_REC_MARKER_RE, (_m, rawDomain: string, rawId: string) => {
      const domain = rawDomain.toLowerCase() === "program" ? "programme" : rawDomain.toLowerCase();
      if (VALID_DOMAINS.has(domain)) {
        if (NUMERIC_DOMAINS.has(domain)) {
          const id = parseInt(rawId, 10);
          const dedupeKey = `${domain}:${id}`;
          if (Number.isFinite(id) && id > 0 && !seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            refs.push({ domain: domain as RecRef["domain"], id, key: null });
          }
        } else {
          const dedupeKey = `${domain}:${rawId.toLowerCase()}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            refs.push({ domain: domain as RecRef["domain"], id: null, key: rawId.toLowerCase() });
          }
        }
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanText, refs };
}

const MAX_CARDS = 3;

/**
 * Validates refs and hydrates them into cards, preserving the coach's order.
 * Education refs go through the original contentSearch resolver (which also
 * logs them); other domains resolve through recommendationDomains.
 */
export async function resolveAllRecommendations(
  userId: string,
  refs: RecRef[],
  source: string = "chat",
): Promise<ResolvedRec[]> {
  const capped = refs.slice(0, MAX_CARDS + 2); // small headroom for invalid refs

  // Resolve library-item refs (education + workout/recipe) in one batch
  // through contentSearch's extended resolver.
  const LIB_DOMAINS = new Set(["video", "path", "workout", "recipe"]);
  const libRefs = capped
    .filter((r): r is RecRef & { id: number } => LIB_DOMAINS.has(r.domain) && !!r.id)
    .map((r) => ({ type: r.domain as "video" | "path" | "workout" | "recipe", id: r.id }));
  const libResolved =
    libRefs.length > 0 ? await resolveEducationRefs(userId, libRefs, source, MAX_CARDS).catch(() => []) : [];
  const libByKey = new Map(libResolved.map((r) => [`${r.type}:${r.id}`, r]));

  const subtitleFor = (hit: (typeof libResolved)[number]): string | null => {
    switch (hit.type) {
      case "video":
      case "path":
        return hit.topic ? `Education Lab · ${hit.topic}` : "Education Lab";
      case "workout":
        return ["Workout", hit.topic].filter(Boolean).join(" · ");
      case "recipe":
        return ["Recipe", hit.topic, hit.extra || null].filter(Boolean).join(" · ");
      default:
        return null;
    }
  };

  const out: ResolvedRec[] = [];
  for (const ref of capped) {
    if (out.length >= MAX_CARDS) break;
    if (LIB_DOMAINS.has(ref.domain)) {
      const hit = libByKey.get(`${ref.domain}:${ref.id}`);
      if (hit) {
        out.push({
          recId: hit.recId,
          domain: ref.domain,
          type: hit.type,
          id: hit.id,
          key: null,
          title: hit.title,
          subtitle: subtitleFor(hit),
          topic: hit.topic,
          contentType: hit.contentType,
          durationMins: hit.durationMins,
          difficulty: hit.difficulty,
          extra: hit.extra ?? null,
          route: hit.route,
        });
      }
      continue;
    }
    const resolved = await resolveDomainRef(userId, ref, source);
    if (resolved) out.push(resolved);
  }
  return out;
}
