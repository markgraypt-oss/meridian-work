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
  searchProgrammes,
  searchWorkday,
  type DomainCandidate,
  type DomainKey,
  type RecAction,
  type RecRef,
  type ResolvedRec,
} from "./recommendationDomains";
import { formatUserStateBlock, getUserStateSnapshot, type UserStateSnapshot } from "./userState";

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

export type RecIntent = {
  wantsRecs: boolean;
  searchTerms: string[];
  domains: Array<"learn" | "workday" | "programme">;
  contentType: "video" | "path" | "any";
};

const recIntentSchema = z.object({
  wantsRecs: z.boolean(),
  searchTerms: z.array(z.string()).max(8).default([]),
  domains: z.array(z.enum(["learn", "workday", "programme"])).max(3).default([]),
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
): Promise<RecIntent> {
  const prompt = `You classify one chat message for an executive wellness app, deciding whether in-app recommendations could genuinely help with the user's CURRENT message, and from which areas.

Available recommendation domains:
- "learn": short educational videos, guides and learning paths (sleep, stress, nutrition habits, posture, breathwork, recovery, training principles, burnout, focus).
- "workday": desk health content — 2-minute micro-reset movements for desk aches (neck, upper back, lower back, hips, wrists), desk working positions, ache/fix guides, rotation planning. Choose when the user mentions desk work, sitting, posture, stiffness or aches from working.
- "programme": structured multi-week training programmes. Choose when the user wants a new training plan, asks what programme to do, or wants structure for their training.

Set wantsRecs=true when the user asks a how/why/what-should-I question about a health or performance topic, describes a struggle (poor sleep, stress, desk aches, low energy), or asks for content, exercises, or a plan. Set wantsRecs=false for app/logistics questions, greetings, pure data lookups ("what was my HRV yesterday"), scheduling, app feedback, or emotional venting where suggestions would feel dismissive.

domains: 1-3 domains that fit, most relevant first. Empty if wantsRecs is false.
searchTerms: 2 to 6 short lowercase keywords or phrases capturing the topics. STRONGLY prefer terms from this canonical tag list when any fit: ${CONTENT_VOCAB.join(", ")}. Add a term outside the list only when nothing on it applies.
contentType (learn domain only): "path" for a structured course, "video" for one quick thing to watch, otherwise "any".

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
): Promise<RecommendationContext> {
  let state: UserStateSnapshot | null = null;
  let stateBlock = "";
  let block = "";

  try {
    const [intent, snapshot] = await Promise.all([
      extractRecIntent(userId, message, recentHistory, provider, model),
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

    const wantLearn = intent.domains.includes("learn");
    const wantWorkday = intent.domains.includes("workday");
    const wantProgramme = intent.domains.includes("programme");

    const [education, workday, programmes] = await Promise.all([
      wantLearn
        ? searchEducationContent({ terms: intent.searchTerms, contentType: intent.contentType, limit: 6 }).catch(
            () => [] as EducationCandidate[],
          )
        : Promise.resolve([] as EducationCandidate[]),
      wantWorkday ? searchWorkday(intent.searchTerms, 6) : Promise.resolve([] as DomainCandidate[]),
      wantProgramme ? searchProgrammes(intent.searchTerms, state, 5) : Promise.resolve([] as DomainCandidate[]),
    ]);

    const actions = state ? relevantActions(state, intent.searchTerms, intent.domains) : [];

    block = await buildRecommendationBlock(userId, { education, workday, programmes, actions, state });
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
- If one or more of these genuinely help with what the user is discussing, weave the names naturally into your reply, then add one marker per recommendation on its own line at the very END of your reply, e.g. [[REC micro_reset:7]] or [[REC programme:12]] or [[REC action:setup_rotation]] (using the real refs above).
- Maximum 3 markers, and at most 2 from any single group. Only refs from the lists above. Never invent or guess refs.
- Prefer items matching the user's state (equipment, experience, current programme, pain areas). Prefer content the user has not completed. If a path is assigned and in progress, prefer its "next up" video.
- Recommend an action card only when it clearly moves the user forward on what they raised.
- If nothing fits well, use no markers at all. A forced recommendation is worse than none.${recoveryModeRule}
- Markers are machine-read and stripped before the user sees your reply. Do not mention, quote, or explain them.`;

  return [header, ...sections, rules].join("\n\n");
}

// --- marker parsing + resolution ------------------------------------------

const ALL_REC_MARKER_RE = /\[{1,2}\s*REC\s+([a-z_]+)\s*:\s*([a-z0-9_\-]+)\s*\]{1,2}/gi;

const NUMERIC_DOMAINS = new Set<DomainKey>(["video", "path", "micro_reset", "position", "ache_fix", "programme"]);
const VALID_DOMAINS = new Set<string>(["video", "path", "micro_reset", "position", "ache_fix", "programme", "action"]);

export function parseAllRecMarkers(text: string): { cleanText: string; refs: RecRef[] } {
  const refs: RecRef[] = [];
  const seen = new Set<string>();
  const cleanText = String(text || "")
    .replace(ALL_REC_MARKER_RE, (_m, rawDomain: string, rawId: string) => {
      const domain = rawDomain.toLowerCase();
      if (VALID_DOMAINS.has(domain)) {
        if (NUMERIC_DOMAINS.has(domain as DomainKey)) {
          const id = parseInt(rawId, 10);
          const dedupeKey = `${domain}:${id}`;
          if (Number.isFinite(id) && id > 0 && !seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            refs.push({ domain: domain as DomainKey, id, key: null });
          }
        } else {
          const dedupeKey = `${domain}:${rawId.toLowerCase()}`;
          if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            refs.push({ domain: domain as DomainKey, id: null, key: rawId.toLowerCase() });
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

  // Resolve education refs in one batch through the existing resolver.
  const eduRefs = capped
    .filter((r): r is RecRef & { id: number } => (r.domain === "video" || r.domain === "path") && !!r.id)
    .map((r) => ({ type: r.domain as "video" | "path", id: r.id }));
  const eduResolved =
    eduRefs.length > 0 ? await resolveEducationRefs(userId, eduRefs, source, MAX_CARDS).catch(() => []) : [];
  const eduByKey = new Map(eduResolved.map((r) => [`${r.type}:${r.id}`, r]));

  const out: ResolvedRec[] = [];
  for (const ref of capped) {
    if (out.length >= MAX_CARDS) break;
    if (ref.domain === "video" || ref.domain === "path") {
      const hit = eduByKey.get(`${ref.domain}:${ref.id}`);
      if (hit) {
        out.push({
          recId: hit.recId,
          domain: ref.domain,
          type: hit.type,
          id: hit.id,
          key: null,
          title: hit.title,
          subtitle: hit.topic ? `Education Lab · ${hit.topic}` : "Education Lab",
          topic: hit.topic,
          contentType: hit.contentType,
          durationMins: hit.durationMins,
          difficulty: hit.difficulty,
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
