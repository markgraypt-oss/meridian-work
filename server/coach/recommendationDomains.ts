import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  coachRecommendations,
  programs,
  workdayAchesFixes,
  workdayMicroResets,
  workdayPositions,
} from "@shared/schema";
import type { UserStateSnapshot } from "./userState";

// ---------------------------------------------------------------------------
// Universal recommendation domains for the AI coach.
//
// Each domain the coach can recommend from is described here: how to search
// it, how a candidate is presented in the prompt shortlist, and how a marker
// ref resolves into a validated, tappable card with a deep-link route.
//
// Domain keys are the marker grammar: [[REC micro_reset:7]], [[REC
// programme:12]], [[REC action:setup_rotation]]. Education content ('video' |
// 'path') keeps its original implementation in contentSearch.ts and is
// composed with these domains by recommendationEngine.ts.
//
// Adding a domain in future = add a search fn + a resolver case + (usually)
// one line in the intent extractor's domain list. Nothing else changes.
// ---------------------------------------------------------------------------

export type DomainKey =
  | "video"
  | "path"
  | "micro_reset"
  | "position"
  | "ache_fix"
  | "programme"
  | "action";

export type RecRef = { domain: DomainKey; id: number | null; key: string | null };

/**
 * Unified card payload. Keeps every field the mobile education cards already
 * use (type/id/title/topic/contentType/durationMins/difficulty/route) so
 * existing rendering keeps working, and adds domain/subtitle for the new
 * card types.
 */
export type ResolvedRec = {
  recId: number;
  domain: DomainKey;
  type: string; // legacy alias of domain ('video' | 'path' for education)
  id: number | null;
  key: string | null;
  title: string;
  subtitle: string | null;
  topic: string | null;
  contentType: string | null;
  durationMins: number | null;
  difficulty: string | null;
  route: string;
};

export type DomainCandidate = {
  domain: Exclude<DomainKey, "video" | "path" | "action">;
  id: number;
  title: string;
  promptLine: string; // full shortlist line, including the [domain:id] ref
  score: number;
};

// --- shared scoring -------------------------------------------------------

function normaliseTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms || []) {
    const t = String(raw || "").trim().toLowerCase();
    if (t.length < 2 || t.length > 60 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Substring match in BOTH directions so short enum-ish fields still hit:
 * term "neck pain" matches field "neck" and field "neck stretches" matches
 * term "neck". Word-level fallback catches "stiff neck" vs "neck".
 */
function fieldScore(terms: string[], fields: Array<{ v: string | null | undefined; w: number }>): number {
  let score = 0;
  for (const term of terms) {
    const termWords = term.split(/\s+/).filter((w) => w.length >= 3);
    for (const { v, w } of fields) {
      if (!v) continue;
      const f = v.toLowerCase();
      if (f.includes(term) || term.includes(f)) {
        score += w;
      } else if (termWords.some((tw) => f.includes(tw))) {
        score += w * 0.5;
      }
    }
  }
  return score;
}

function ilikeConds(terms: string[], cols: any[]) {
  return terms.flatMap((t) => {
    const pat = `%${t}%`;
    return cols.map((c) => (typeof c === "function" ? c(pat) : ilike(c, pat)));
  });
}

// --- workday domain -------------------------------------------------------

const TARGET_AREA_LABELS: Record<string, string> = {
  neck: "neck",
  upper_back: "upper back",
  lower_back: "lower back",
  hips: "hips",
  wrists: "wrists",
};

export async function searchWorkday(rawTerms: string[], limit: number = 6): Promise<DomainCandidate[]> {
  const terms = normaliseTerms(rawTerms);
  const out: DomainCandidate[] = [];

  // Micro-resets
  try {
    const conds = terms.length
      ? or(
          ...ilikeConds(terms, [
            workdayMicroResets.name,
            workdayMicroResets.description,
            workdayMicroResets.targetArea,
          ]),
        )
      : undefined;
    const rows = await db
      .select()
      .from(workdayMicroResets)
      .where(conds ? and(eq(workdayMicroResets.isActive, true), conds) : eq(workdayMicroResets.isActive, true))
      .limit(100);
    for (const r of rows) {
      const areaLabel = TARGET_AREA_LABELS[r.targetArea] || r.targetArea;
      const score =
        terms.length === 0
          ? 1
          : fieldScore(terms, [
              { v: r.name, w: 3 },
              { v: areaLabel, w: 3 },
              { v: r.targetArea, w: 2.5 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      const secs = r.exerciseType === "timed" ? `${r.duration}s` : `${r.duration} reps`;
      out.push({
        domain: "micro_reset",
        id: r.id,
        title: r.name,
        score,
        promptLine: `- [micro_reset:${r.id}] "${r.name}" | 2-min desk micro-reset | targets: ${areaLabel} | ${secs}`,
      });
    }
  } catch (e: any) {
    console.error("[coach-recs] micro-reset search failed:", e?.message || e);
  }

  // Working positions
  try {
    const conds = terms.length
      ? or(...ilikeConds(terms, [workdayPositions.name, workdayPositions.description, workdayPositions.positionType]))
      : undefined;
    const rows = await db
      .select()
      .from(workdayPositions)
      .where(conds ? and(eq(workdayPositions.isActive, true), conds) : eq(workdayPositions.isActive, true))
      .limit(50);
    for (const r of rows) {
      const score =
        terms.length === 0
          ? 0.5
          : fieldScore(terms, [
              { v: r.name, w: 3 },
              { v: r.positionType, w: 2 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      out.push({
        domain: "position",
        id: r.id,
        title: r.name,
        score,
        promptLine: `- [position:${r.id}] "${r.name}" | desk working position (${r.positionType})`,
      });
    }
  } catch (e: any) {
    console.error("[coach-recs] position search failed:", e?.message || e);
  }

  // Aches & fixes
  try {
    const conds = terms.length
      ? or(
          ...ilikeConds(terms, [
            workdayAchesFixes.title,
            workdayAchesFixes.description,
            workdayAchesFixes.issueType,
          ]),
        )
      : undefined;
    const rows = await db
      .select()
      .from(workdayAchesFixes)
      .where(conds ? and(eq(workdayAchesFixes.isActive, true), conds) : eq(workdayAchesFixes.isActive, true))
      .limit(50);
    for (const r of rows) {
      const issueLabel = (r.issueType || "").replace(/_/g, " ");
      const score =
        terms.length === 0
          ? 0.5
          : fieldScore(terms, [
              { v: r.title, w: 3 },
              { v: issueLabel, w: 3 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      out.push({
        domain: "ache_fix",
        id: r.id,
        title: r.title,
        score,
        promptLine: `- [ache_fix:${r.id}] "${r.title}" | desk ache guide (${issueLabel}): causes, setup factors and relief movements`,
      });
    }
  } catch (e: any) {
    console.error("[coach-recs] aches-fixes search failed:", e?.message || e);
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// --- programme domain -----------------------------------------------------

/** Programme goals suppressed while Recovery Mode is active. */
const HIGH_INTENSITY_GOALS = new Set(["hiit", "power", "conditioning", "max_strength"]);

export async function searchProgrammes(
  rawTerms: string[],
  state: UserStateSnapshot | null,
  limit: number = 5,
): Promise<DomainCandidate[]> {
  const terms = normaliseTerms(rawTerms);
  const out: DomainCandidate[] = [];

  try {
    let rows: Array<typeof programs.$inferSelect>;
    const conds = terms.length
      ? or(
          ...ilikeConds(terms, [
            programs.title,
            programs.description,
            programs.goal,
            programs.whoItsFor,
            (pat: string) => sql`${programs.tags}::text ILIKE ${pat}`,
            (pat: string) => sql`${programs.category}::text ILIKE ${pat}`,
          ]),
        )
      : undefined;

    if (conds) {
      rows = await db
        .select()
        .from(programs)
        .where(and(eq(programs.programmeType, "main"), eq(programs.sourceType, "manual"), conds))
        .limit(150);
    } else {
      rows = [];
    }
    // Browse fallback: "I want a new programme" often carries generic terms.
    if (rows.length === 0) {
      rows = await db
        .select()
        .from(programs)
        .where(and(eq(programs.programmeType, "main"), eq(programs.sourceType, "manual")))
        .orderBy(desc(programs.id))
        .limit(30);
    }

    const activeProgrammeId = state?.training.activeEnrollment?.programId ?? null;
    for (const r of rows) {
      if (r.id === activeProgrammeId) continue; // never re-recommend the current programme
      if (state?.burnout.recoveryMode && HIGH_INTENSITY_GOALS.has(r.goal)) continue; // hard gate
      const tagsText = Array.isArray(r.tags) ? r.tags.join(" ") : "";
      const categoryText = Array.isArray(r.category) ? r.category.join(" ") : "";
      const score =
        terms.length === 0
          ? 1
          : fieldScore(terms, [
              { v: r.title, w: 3 },
              { v: r.goal?.replace(/_/g, " "), w: 2.5 },
              { v: tagsText, w: 2.5 },
              { v: categoryText, w: 2 },
              { v: r.whoItsFor, w: 1.5 },
              { v: r.description, w: 1 },
            ]);
      if (score <= 0) continue;
      const bits = [
        `[programme:${r.id}] "${r.title}"`,
        `goal: ${r.goal.replace(/_/g, " ")}`,
        `${r.weeks} weeks, ${r.trainingDaysPerWeek}x/week, ~${r.duration} min sessions`,
        r.difficulty,
        `equipment: ${r.equipment.replace(/_/g, " ")}`,
        r.whoItsFor ? `for: ${String(r.whoItsFor).slice(0, 90)}` : null,
      ].filter(Boolean);
      out.push({
        domain: "programme",
        id: r.id,
        title: r.title,
        score,
        promptLine: `- ${bits.join(" | ")}`,
      });
    }
  } catch (e: any) {
    console.error("[coach-recs] programme search failed:", e?.message || e);
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// --- action registry ------------------------------------------------------

export type RecAction = {
  key: string;
  title: string; // verb-led card title
  description: string; // one line for the prompt shortlist
  route: string;
  /** Only actions whose state test passes ever enter the shortlist. */
  eligible: (state: UserStateSnapshot) => boolean;
  /** Cheap relevance test against the extracted intent. */
  matches: (terms: string[], domains: string[]) => boolean;
};

const termsHaveAny = (terms: string[], needles: string[]) =>
  terms.some((t) => needles.some((n) => t.includes(n) || n.includes(t)));

export const ACTION_REGISTRY: RecAction[] = [
  {
    key: "setup_rotation",
    title: "Set up your rotation planner",
    description:
      "guided setup of a position-rotation schedule for the workday (pick positions + change interval + reminders)",
    route: "/recovery/desk-health/rotation",
    eligible: (s) => !s.workday.hasRotation,
    matches: (_terms, domains) => domains.includes("workday"),
  },
  {
    key: "desk_scan",
    title: "Run an AI desk scan",
    description: "camera-based ergonomic analysis of the user's desk setup with a score and priority fixes",
    route: "/recovery/desk-health/scan",
    eligible: (s) => s.workday.lastDeskScanDaysAgo === null || s.workday.lastDeskScanDaysAgo > 60,
    matches: (terms, domains) =>
      domains.includes("workday") || termsHaveAny(terms, ["desk setup", "ergonomics", "posture", "monitor"]),
  },
  {
    key: "log_body_map",
    title: "Log this in your body map",
    description:
      "structured pain/stiffness assessment (area, severity, triggers) that unlocks tailored recovery guidance",
    route: "/body-map",
    eligible: (s) => s.pain.lastLogDaysAgo === null || s.pain.lastLogDaysAgo > 7,
    matches: (terms) =>
      termsHaveAny(terms, [
        "pain", "ache", "stiff", "sore", "injury", "neck", "back", "shoulder", "hip", "knee", "wrist", "headache",
      ]),
  },
  {
    key: "create_programme",
    title: "Create your own programme",
    description: "build a custom training programme (AI-assisted) matched to goal, equipment and schedule",
    route: "/training/create-programme",
    eligible: (s) => !s.training.activeEnrollment,
    matches: (_terms, domains) => domains.includes("programme"),
  },
  {
    key: "weekly_checkin",
    title: "Do this week's check-in",
    description: "weekly reflection that reviews trends and generates the user's suggestions for next week",
    route: "/weekly-checkin",
    eligible: (s) => !s.checkins.weeklyDoneThisWeek,
    matches: (terms) =>
      termsHaveAny(terms, ["check in", "checkin", "progress", "review", "how am i doing", "reflect"]),
  },
];

export function relevantActions(state: UserStateSnapshot, terms: string[], domains: string[]): RecAction[] {
  return ACTION_REGISTRY.filter((a) => a.matches(terms, domains) && a.eligible(state)).slice(0, 3);
}

// --- resolvers ------------------------------------------------------------

async function logShown(
  userId: string,
  itemType: string,
  itemId: number | null,
  itemKey: string | null,
  route: string,
  source: string,
): Promise<number> {
  try {
    const [row] = await db
      .insert(coachRecommendations)
      .values({ userId, itemType, itemId, itemKey, route, source })
      .returning({ id: coachRecommendations.id });
    return row?.id ?? 0;
  } catch (e: any) {
    console.error("[coach-recs] failed to log recommendation:", e?.message || e);
    return 0;
  }
}

/**
 * Resolves one non-education marker ref into a validated card. Returns null
 * when the ref doesn't correspond to real, active content — invalid markers
 * must never reach the client.
 */
export async function resolveDomainRef(
  userId: string,
  ref: RecRef,
  source: string,
): Promise<ResolvedRec | null> {
  try {
    switch (ref.domain) {
      case "micro_reset": {
        if (!ref.id) return null;
        const [r] = await db.select().from(workdayMicroResets).where(eq(workdayMicroResets.id, ref.id)).limit(1);
        if (!r || r.isActive === false) return null;
        const route = `/recovery/desk-health/micro-resets?highlight=${r.id}`;
        const recId = await logShown(userId, "micro_reset", r.id, null, route, source);
        const areaLabel = TARGET_AREA_LABELS[r.targetArea] || r.targetArea;
        return {
          recId,
          domain: "micro_reset",
          type: "micro_reset",
          id: r.id,
          key: null,
          title: r.name,
          subtitle: `Desk micro-reset · ${areaLabel}`,
          topic: null,
          contentType: null,
          durationMins: r.exerciseType === "timed" ? Math.max(1, Math.round((r.duration || 60) / 60)) : null,
          difficulty: null,
          route,
        };
      }
      case "position": {
        if (!ref.id) return null;
        const [r] = await db.select().from(workdayPositions).where(eq(workdayPositions.id, ref.id)).limit(1);
        if (!r || r.isActive === false) return null;
        const route = `/recovery/desk-health/position/${r.id}`;
        const recId = await logShown(userId, "position", r.id, null, route, source);
        return {
          recId,
          domain: "position",
          type: "position",
          id: r.id,
          key: null,
          title: r.name,
          subtitle: `Working position · ${r.positionType}`,
          topic: null,
          contentType: null,
          durationMins: null,
          difficulty: null,
          route,
        };
      }
      case "ache_fix": {
        if (!ref.id) return null;
        const [r] = await db.select().from(workdayAchesFixes).where(eq(workdayAchesFixes.id, ref.id)).limit(1);
        if (!r || r.isActive === false) return null;
        const route = `/recovery/desk-health/ache/${r.id}`;
        const recId = await logShown(userId, "ache_fix", r.id, null, route, source);
        return {
          recId,
          domain: "ache_fix",
          type: "ache_fix",
          id: r.id,
          key: null,
          title: r.title,
          subtitle: `Aches & fixes · ${(r.issueType || "").replace(/_/g, " ")}`,
          topic: null,
          contentType: null,
          durationMins: null,
          difficulty: null,
          route,
        };
      }
      case "programme": {
        if (!ref.id) return null;
        const [r] = await db.select().from(programs).where(eq(programs.id, ref.id)).limit(1);
        if (!r) return null;
        const route = `/training/programme/${r.id}`;
        const recId = await logShown(userId, "programme", r.id, null, route, source);
        return {
          recId,
          domain: "programme",
          type: "programme",
          id: r.id,
          key: null,
          title: r.title,
          subtitle: `${r.weeks}-week programme · ${r.goal.replace(/_/g, " ")}`,
          topic: null,
          contentType: null,
          durationMins: r.duration ?? null,
          difficulty: r.difficulty ?? null,
          route,
        };
      }
      case "action": {
        if (!ref.key) return null;
        const action = ACTION_REGISTRY.find((a) => a.key === ref.key);
        if (!action) return null;
        const recId = await logShown(userId, "action", null, action.key, action.route, source);
        return {
          recId,
          domain: "action",
          type: "action",
          id: null,
          key: action.key,
          title: action.title,
          subtitle: "In the app",
          topic: null,
          contentType: null,
          durationMins: null,
          difficulty: null,
          route: action.route,
        };
      }
      default:
        return null;
    }
  } catch (e: any) {
    console.error("[coach-recs] failed to resolve ref:", ref, e?.message || e);
    return null;
  }
}
