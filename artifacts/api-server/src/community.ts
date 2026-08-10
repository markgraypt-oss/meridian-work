// ---------------------------------------------------------------------------
// Meridian Community — Phase 1 (10 Aug 2026)
// Announcements feed + comments + reactions, challenge engine (programme /
// metric with personal targets), moderation (banned words + OpenAI + reports
// + blocks), lifecycle notifications via notify(), hourly scorer.
//
// Self-contained module (contentWriteups.ts precedent): owns its DDL via raw
// pool.query, no schema.ts tables needed for community_* tables. The ONLY
// shared-schema touchpoints are the 'community' notification category and the
// in_app/email/push_community preference columns (added in schema.ts + DDL here).
//
// Spec: claude/community-phase1-build-spec-10aug.md
// ---------------------------------------------------------------------------

import type { Express } from "express";
import { z } from "zod";
import { pool } from "./db";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";
import { notify } from "./notifications";

export const COMMUNITY_TERMS_VERSION = "1.0";

// ---------------------------------------------------------------------------
// Schema (raw DDL, CREATE/ALTER IF NOT EXISTS — same self-heal style as
// startupMigrations.ts, but owned here so the feature ships as one unit).
// ---------------------------------------------------------------------------

const COMMUNITY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS community_profiles (
    user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    avatar_url text,
    share_activity boolean NOT NULL DEFAULT false,
    is_banned boolean NOT NULL DEFAULT false,
    terms_version text NOT NULL,
    terms_accepted_at timestamp NOT NULL DEFAULT now(),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_posts (
    id serial PRIMARY KEY,
    user_id varchar NOT NULL,
    scope text NOT NULL DEFAULT 'announcement',
    challenge_id integer,
    body text NOT NULL,
    image_url text,
    is_pinned boolean NOT NULL DEFAULT false,
    is_hidden boolean NOT NULL DEFAULT false,
    hidden_reason text,
    edited_at timestamp,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_community_posts_scope ON community_posts (scope, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_community_posts_challenge ON community_posts (challenge_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS community_comments (
    id serial PRIMARY KEY,
    post_id integer NOT NULL,
    user_id varchar NOT NULL,
    body text NOT NULL,
    is_hidden boolean NOT NULL DEFAULT false,
    hidden_reason text,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments (post_id, created_at ASC)`,
  `CREATE TABLE IF NOT EXISTS community_reactions (
    id serial PRIMARY KEY,
    target_type text NOT NULL,
    target_id integer NOT NULL,
    user_id varchar NOT NULL,
    kind text NOT NULL DEFAULT 'like',
    created_at timestamp DEFAULT now(),
    CONSTRAINT uq_community_reaction UNIQUE (target_type, target_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS community_challenges (
    id serial PRIMARY KEY,
    title text NOT NULL,
    description text,
    cover_image_url text,
    type text NOT NULL,
    program_id integer,
    metric text,
    goal_mode text NOT NULL DEFAULT 'daily_target',
    daily_target integer,
    allow_personal_target boolean NOT NULL DEFAULT false,
    personal_target_options jsonb,
    start_date text NOT NULL,
    end_date text NOT NULL,
    grace_days integer NOT NULL DEFAULT 2,
    results_final_hours integer NOT NULL DEFAULT 48,
    prize_text text,
    rules_url text,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_challenge_participants (
    id serial PRIMARY KEY,
    challenge_id integer NOT NULL,
    user_id varchar NOT NULL,
    timezone text NOT NULL,
    personal_target integer,
    show_on_leaderboard boolean NOT NULL DEFAULT true,
    joined_at timestamp DEFAULT now(),
    left_at timestamp,
    CONSTRAINT uq_community_participant UNIQUE (challenge_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS community_challenge_scores (
    id serial PRIMARY KEY,
    challenge_id integer NOT NULL,
    user_id varchar NOT NULL,
    date_key text NOT NULL,
    value real NOT NULL DEFAULT 0,
    on_target boolean,
    source text,
    updated_at timestamp DEFAULT now(),
    CONSTRAINT uq_community_score UNIQUE (challenge_id, user_id, date_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_community_scores_challenge ON community_challenge_scores (challenge_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS community_reports (
    id serial PRIMARY KEY,
    reporter_user_id varchar NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'open',
    resolved_at timestamp,
    resolution_note text,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_blocks (
    id serial PRIMARY KEY,
    blocker_user_id varchar NOT NULL,
    blocked_user_id varchar NOT NULL,
    created_at timestamp DEFAULT now(),
    CONSTRAINT uq_community_block UNIQUE (blocker_user_id, blocked_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS community_banned_words (
    id serial PRIMARY KEY,
    word text NOT NULL UNIQUE,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS community_moderation_log (
    id serial PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    detail jsonb,
    created_at timestamp DEFAULT now()
  )`,
  // notify() channel toggles for the new 'community' category. Defaults: in-app
  // + push ON, email OFF (email fan-out is disabled app-wide anyway).
  `ALTER TABLE notification_preferences
     ADD COLUMN IF NOT EXISTS in_app_community boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS email_community boolean DEFAULT false,
     ADD COLUMN IF NOT EXISTS push_community boolean DEFAULT true`,
];

let ensurePromise: Promise<void> | null = null;
function ensureCommunitySchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      for (const ddl of COMMUNITY_DDL) {
        try {
          await pool.query(ddl);
        } catch (err: any) {
          console.error("[community] DDL failed:", err?.message || err);
        }
      }
      console.log(`[community] schema ensured (${COMMUNITY_DDL.length} stmts)`);
    })();
  }
  return ensurePromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateKeyInTz(d: Date, tz: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dateKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let k = start;
  let guard = 0;
  while (k <= end && guard < 400) {
    keys.push(k);
    k = addDaysToDateKey(k, 1);
    guard++;
  }
  return keys;
}

type ChallengeRow = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  type: string;
  programId: number | null;
  metric: string | null;
  goalMode: string;
  dailyTarget: number | null;
  allowPersonalTarget: boolean;
  personalTargetOptions: any;
  startDate: string;
  endDate: string;
  graceDays: number;
  resultsFinalHours: number;
  prizeText: string | null;
  rulesUrl: string | null;
  isPublished: boolean;
};

const CHALLENGE_COLS = `id, title, description, cover_image_url AS "coverImageUrl", type,
  program_id AS "programId", metric, goal_mode AS "goalMode", daily_target AS "dailyTarget",
  allow_personal_target AS "allowPersonalTarget", personal_target_options AS "personalTargetOptions",
  start_date AS "startDate", end_date AS "endDate", grace_days AS "graceDays",
  results_final_hours AS "resultsFinalHours", prize_text AS "prizeText", rules_url AS "rulesUrl",
  is_published AS "isPublished"`;

function challengeStatus(c: ChallengeRow, now = new Date()): "upcoming" | "active" | "scoring" | "final" {
  // Evaluated against UTC date keys; per-user local days are handled in scoring.
  const todayUtc = now.toISOString().slice(0, 10);
  if (todayUtc < c.startDate) return "upcoming";
  if (todayUtc <= c.endDate) return "active";
  const finalAt = new Date(new Date(`${c.endDate}T23:59:59Z`).getTime() + c.resultsFinalHours * 3600 * 1000);
  return now < finalAt ? "scoring" : "final";
}

async function getProfile(userId: string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT user_id AS "userId", display_name AS "displayName", avatar_url AS "avatarUrl",
            share_activity AS "shareActivity", is_banned AS "isBanned",
            terms_version AS "termsVersion", terms_accepted_at AS "termsAcceptedAt"
     FROM community_profiles WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** 403s (JOIN_REQUIRED / BANNED) if the user has no community profile or is banned. */
async function requireProfile(userId: string, res: any): Promise<any | null> {
  const profile = await getProfile(userId);
  if (!profile) {
    res.status(403).json({ code: "JOIN_REQUIRED", message: "Join the community first" });
    return null;
  }
  if (profile.isBanned) {
    res.status(403).json({ code: "BANNED", message: "Your community access has been suspended" });
    return null;
  }
  return profile;
}

async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const me = await storage.getUser(userId);
    return !!me?.isAdmin;
  } catch {
    return false;
  }
}

/** User ids hidden from `userId` (either direction of a block). */
async function blockedIdsFor(userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT blocked_user_id AS other FROM community_blocks WHERE blocker_user_id = $1
     UNION
     SELECT blocker_user_id AS other FROM community_blocks WHERE blocked_user_id = $1`,
    [userId],
  );
  return rows.map((r: any) => r.other);
}

async function modLog(actor: string, action: string, targetType: string | null, targetId: string | null, detail?: any) {
  try {
    await pool.query(
      `INSERT INTO community_moderation_log (actor, action, target_type, target_id, detail) VALUES ($1,$2,$3,$4,$5)`,
      [actor, action, targetType, targetId, detail ? JSON.stringify(detail) : null],
    );
  } catch (e) {
    console.error("[community] mod log failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Moderation: banned-word filter (hard reject) + OpenAI omni-moderation
// (auto-hide + auto-report; fail-open if the API is down). Apple 1.2 / Play UGC.
// ---------------------------------------------------------------------------

let bannedCache: { words: string[]; at: number } = { words: [], at: 0 };
async function getBannedWords(): Promise<string[]> {
  if (Date.now() - bannedCache.at < 5 * 60 * 1000) return bannedCache.words;
  try {
    const { rows } = await pool.query(`SELECT word FROM community_banned_words`);
    bannedCache = { words: rows.map((r: any) => String(r.word).toLowerCase()), at: Date.now() };
  } catch (e) {
    console.error("[community] banned words load failed:", e);
  }
  return bannedCache.words;
}

function containsBannedWord(text: string, words: string[]): string | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/gi, " ")} `;
  for (const w of words) {
    if (w && lower.includes(` ${w} `)) return w;
  }
  return null;
}

async function openAiModerate(text: string): Promise<{ flagged: boolean; categories?: string[] }> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return { flagged: false };
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text.slice(0, 8000) }),
    });
    if (!res.ok) return { flagged: false };
    const data: any = await res.json();
    const r = data?.results?.[0];
    if (!r) return { flagged: false };
    const categories = Object.entries(r.categories || {})
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    return { flagged: !!r.flagged, categories };
  } catch (e) {
    console.error("[community] moderation API failed (fail-open):", e);
    return { flagged: false };
  }
}

/**
 * Screens user text. Returns { rejected } (banned word — friendly 400),
 * or { autoHide } (AI-flagged — content saved hidden + auto-report), else clean.
 */
async function screenText(text: string): Promise<{ rejected?: string; autoHide?: string[] }> {
  const words = await getBannedWords();
  const hit = containsBannedWord(text, words);
  if (hit) return { rejected: hit };
  const ai = await openAiModerate(text);
  if (ai.flagged) return { autoHide: ai.categories || [] };
  return {};
}

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

/** Merged daily step/active-minute values across providers (MAX per day — providers overlap, never sum). */
async function metricValuesByDay(userId: string, metric: string, startKey: string, endKey: string): Promise<Map<string, number>> {
  const col = metric === "active_minutes" ? "active_minutes" : "steps";
  const { rows } = await pool.query(
    `SELECT date, MAX(COALESCE(${col}, 0))::float AS v
     FROM wearable_metrics_daily
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     GROUP BY date`,
    [userId, startKey, endKey],
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, Number(r.v) || 0);
  return map;
}

/** Completed workout timestamps → per-local-day counts (optionally scoped to a programme). */
async function workoutCountsByDay(
  userId: string,
  tz: string,
  startKey: string,
  endKey: string,
  programId: number | null,
): Promise<Map<string, number>> {
  // Fetch with a generous UTC window (±1 day) then bucket per participant-local day.
  const fromUtc = `${addDaysToDateKey(startKey, -1)}T00:00:00Z`;
  const toUtc = `${addDaysToDateKey(endKey, 2)}T00:00:00Z`;
  const params: any[] = [userId, fromUtc, toUtc];
  let progFilter = "";
  if (programId != null) {
    params.push(programId);
    progFilter = ` AND programme_id = $4`;
  }
  const { rows } = await pool.query(
    `SELECT completed_at AS "completedAt" FROM workout_logs
     WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
       AND completed_at >= $2 AND completed_at < $3${progFilter}`,
    params,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = dateKeyInTz(new Date(r.completedAt), tz);
    if (key >= startKey && key <= endKey) map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

async function scoreParticipant(c: ChallengeRow, p: { userId: string; timezone: string; personalTarget: number | null }, onlyLastDays?: number) {
  const now = new Date();
  const localToday = dateKeyInTz(now, p.timezone);
  let from = c.startDate;
  const to = c.endDate < localToday ? c.endDate : localToday;
  if (onlyLastDays && onlyLastDays > 0) {
    const cutoff = addDaysToDateKey(to, -(onlyLastDays - 1));
    if (cutoff > from) from = cutoff;
  }
  if (from > to) return;

  const target = p.personalTarget ?? c.dailyTarget ?? null;
  let byDay: Map<string, number>;
  let source: string;
  if (c.type === "programme") {
    byDay = await workoutCountsByDay(p.userId, p.timezone, from, to, c.programId);
    source = "workout";
  } else if (c.metric === "workouts") {
    byDay = await workoutCountsByDay(p.userId, p.timezone, from, to, null);
    source = "workout";
  } else {
    byDay = await metricValuesByDay(p.userId, c.metric || "steps", from, to);
    source = "wearable";
  }

  for (const key of dateKeysBetween(from, to)) {
    const value = byDay.get(key) || 0;
    const onTarget =
      c.goalMode === "daily_target" || c.goalMode === "completion"
        ? c.type === "programme" || c.metric === "workouts"
          ? value >= (target ?? 1)
          : target != null
            ? value >= target
            : null
        : null;
    await pool.query(
      `INSERT INTO community_challenge_scores (challenge_id, user_id, date_key, value, on_target, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT ON CONSTRAINT uq_community_score
       DO UPDATE SET value = EXCLUDED.value, on_target = EXCLUDED.on_target, source = EXCLUDED.source, updated_at = now()`,
      [c.id, p.userId, key, value, onTarget, source],
    );
  }
}

async function activeParticipants(challengeId: number): Promise<{ userId: string; timezone: string; personalTarget: number | null; showOnLeaderboard: boolean }[]> {
  const { rows } = await pool.query(
    `SELECT user_id AS "userId", timezone, personal_target AS "personalTarget", show_on_leaderboard AS "showOnLeaderboard"
     FROM community_challenge_participants WHERE challenge_id = $1 AND left_at IS NULL`,
    [challengeId],
  );
  return rows;
}

async function scorableChallenges(): Promise<ChallengeRow[]> {
  const { rows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE is_published = true`);
  return (rows as ChallengeRow[]).filter((c) => {
    const s = challengeStatus(c);
    return s === "active" || s === "scoring";
  });
}

async function runScoringPass(): Promise<void> {
  const challenges = await scorableChallenges();
  for (const c of challenges) {
    try {
      const parts = await activeParticipants(c.id);
      for (const p of parts) {
        try {
          await scoreParticipant(c, p);
        } catch (e) {
          console.error(`[community] scoring failed challenge=${c.id} user=${p.userId}:`, e);
        }
      }
    } catch (e) {
      console.error(`[community] scoring failed challenge=${c.id}:`, e);
    }
  }
}

// ── Lifecycle notifications (dedupe via notifications.data->>'communityEvent') ──

async function alreadyNotified(userId: string, eventKey: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM notifications WHERE user_id = $1 AND (data->>'communityEvent') = $2 LIMIT 1`,
    [userId, eventKey],
  );
  return rows.length > 0;
}

async function runLifecycleNotifications(): Promise<void> {
  const { rows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE is_published = true`);
  const now = new Date();
  for (const c of rows as ChallengeRow[]) {
    const status = challengeStatus(c, now);
    if (status === "final") {
      const finalAt = new Date(new Date(`${c.endDate}T23:59:59Z`).getTime() + c.resultsFinalHours * 3600 * 1000);
      // Skip long-finished challenges (older than 3 days past final) to keep the pass cheap.
      if (now.getTime() - finalAt.getTime() > 3 * 24 * 3600 * 1000) continue;
    }
    const parts = await activeParticipants(c.id);
    for (const p of parts) {
      try {
        const localToday = dateKeyInTz(now, p.timezone);
        let event: { key: string; title: string; body: string } | null = null;
        if (status === "upcoming" && addDaysToDateKey(localToday, 1) === c.startDate) {
          event = { key: `challenge:${c.id}:start`, title: `${c.title} starts tomorrow`, body: "Get ready — the challenge kicks off tomorrow. Good luck!" };
        } else if (status === "active" && localToday === addDaysToDateKey(c.endDate, -1)) {
          event = { key: `challenge:${c.id}:ending`, title: `${c.title} — final stretch`, body: "The challenge ends tomorrow. Finish strong!" };
        } else if (status === "final") {
          event = { key: `challenge:${c.id}:final`, title: `${c.title} — results are in`, body: "Final results are locked in. Open the challenge to see how you did." };
        }
        if (!event) continue;
        if (await alreadyNotified(p.userId, event.key)) continue;
        await notify({
          userId: p.userId,
          category: "community",
          title: event.title,
          body: event.body,
          data: { communityEvent: event.key, url: `/community/challenge/${c.id}` },
          disableEmail: true,
        });
      } catch (e) {
        console.error(`[community] lifecycle notify failed challenge=${c.id} user=${p.userId}:`, e);
      }
    }
  }
}

// ── Scheduler ──

const TICK_MS = 60 * 60 * 1000; // hourly
let schedulerStarted = false;

export function startCommunityScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setTimeout(() => {
    const tick = async () => {
      try {
        await ensureCommunitySchema();
        await runScoringPass();
        await runLifecycleNotifications();
      } catch (e) {
        console.error("[community] scheduler tick failed:", e);
      }
    };
    tick();
    setInterval(tick, TICK_MS);
  }, 120_000);
  console.log("[community] scheduler started (hourly scoring + lifecycle notifications)");
}

// ---------------------------------------------------------------------------
// Query helpers for feed/detail responses
// ---------------------------------------------------------------------------

const POST_SELECT = `
  p.id, p.user_id AS "userId", p.scope, p.challenge_id AS "challengeId", p.body,
  p.image_url AS "imageUrl", p.is_pinned AS "isPinned", p.created_at AS "createdAt", p.edited_at AS "editedAt",
  cp.display_name AS "authorName", cp.avatar_url AS "authorAvatarUrl",
  u.is_admin AS "authorIsAdmin",
  (SELECT count(*)::int FROM community_comments cc WHERE cc.post_id = p.id AND cc.is_hidden = false) AS "commentCount",
  (SELECT count(*)::int FROM community_reactions r WHERE r.target_type = 'post' AND r.target_id = p.id) AS "reactionCount"`;

const POST_JOINS = `
  LEFT JOIN community_profiles cp ON cp.user_id = p.user_id
  LEFT JOIN users u ON u.id = p.user_id`;

async function attachMyReactions(userId: string, posts: any[]): Promise<void> {
  if (posts.length === 0) return;
  const ids = posts.map((p) => p.id);
  const { rows } = await pool.query(
    `SELECT target_id AS id FROM community_reactions WHERE user_id = $1 AND target_type = 'post' AND target_id = ANY($2::int[])`,
    [userId, ids],
  );
  const mine = new Set(rows.map((r: any) => r.id));
  for (const p of posts) p.myReaction = mine.has(p.id);
}

function notInBlocked(paramIdx: number): string {
  return `p.user_id != ALL($${paramIdx}::varchar[])`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const joinSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  shareActivity: z.boolean().optional(),
});

const postSchema = z.object({
  scope: z.enum(["announcement", "challenge"]),
  challengeId: z.number().int().positive().optional(),
  body: z.string().trim().min(1).max(4000),
  imageUrl: z.string().max(1000).optional(),
  // announcement-only extras (admin):
  isPinned: z.boolean().optional(),
  sendPush: z.boolean().optional(),
});

const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

const challengeCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().max(4000).optional(),
  coverImageUrl: z.string().max(1000).optional(),
  type: z.enum(["programme", "metric"]),
  programId: z.number().int().positive().optional(),
  metric: z.enum(["steps", "active_minutes", "workouts"]).optional(),
  goalMode: z.enum(["daily_target", "total", "completion"]),
  dailyTarget: z.number().int().positive().optional(),
  allowPersonalTarget: z.boolean().optional(),
  personalTargetOptions: z.array(z.number().int().positive()).max(6).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  graceDays: z.number().int().min(0).max(10).optional(),
  resultsFinalHours: z.number().int().min(0).max(168).optional(),
  prizeText: z.string().max(2000).optional(),
  rulesUrl: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

const joinChallengeSchema = z.object({
  timezone: z.string().min(1).max(60),
  showOnLeaderboard: z.boolean().optional(),
  personalTarget: z.number().int().positive().optional(),
});

export function registerCommunityRoutes(app: Express): void {
  // Kick off schema creation immediately; every handler awaits readiness.
  ensureCommunitySchema().catch(() => {});

  const ready = (handler: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try {
      await ensureCommunitySchema();
      await handler(req, res);
    } catch (e) {
      console.error(`[community] ${req.method} ${req.path} failed:`, e);
      if (!res.headersSent) res.status(500).json({ message: "Community request failed" });
    }
  };

  // ── Identity ──────────────────────────────────────────────────────────────

  app.get("/api/community/me", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await getProfile(userId);
    if (!profile) {
      const u = await storage.getUser(userId);
      const suggested = u?.displayName || [u?.firstName, u?.lastName ? `${String(u.lastName)[0]}.` : null].filter(Boolean).join(" ") || null;
      return res.json({ joined: false, termsVersion: COMMUNITY_TERMS_VERSION, suggestedDisplayName: suggested });
    }
    res.json({ joined: true, termsVersion: COMMUNITY_TERMS_VERSION, profile });
  }));

  app.post("/api/community/join", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid join request", errors: parsed.error.flatten() });
    const { displayName, shareActivity } = parsed.data;

    const screen = await screenText(displayName);
    if (screen.rejected || screen.autoHide) {
      return res.status(400).json({ message: "That display name isn't allowed — please pick another." });
    }
    const u = await storage.getUser(userId);
    await pool.query(
      `INSERT INTO community_profiles (user_id, display_name, avatar_url, share_activity, terms_version, terms_accepted_at, updated_at)
       VALUES ($1,$2,$3,$4,$5, now(), now())
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name,
         share_activity = EXCLUDED.share_activity, terms_version = EXCLUDED.terms_version,
         terms_accepted_at = now(), updated_at = now()`,
      [userId, displayName, u?.profileImageUrl ?? null, shareActivity ?? false, COMMUNITY_TERMS_VERSION],
    );
    res.json({ ok: true, profile: await getProfile(userId) });
  }));

  app.put("/api/community/me", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const parsed = z.object({
      displayName: z.string().trim().min(2).max(40).optional(),
      avatarUrl: z.string().max(1000).nullable().optional(),
      shareActivity: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid update", errors: parsed.error.flatten() });
    const { displayName, avatarUrl, shareActivity } = parsed.data;
    if (displayName) {
      const screen = await screenText(displayName);
      if (screen.rejected || screen.autoHide) return res.status(400).json({ message: "That display name isn't allowed — please pick another." });
    }
    await pool.query(
      `UPDATE community_profiles SET
         display_name = COALESCE($2, display_name),
         avatar_url = CASE WHEN $3::boolean THEN $4 ELSE avatar_url END,
         share_activity = COALESCE($5, share_activity),
         updated_at = now()
       WHERE user_id = $1`,
      [userId, displayName ?? null, avatarUrl !== undefined, avatarUrl ?? null, shareActivity ?? null],
    );
    res.json({ ok: true, profile: await getProfile(userId) });
  }));

  // ── Feed & posts ──────────────────────────────────────────────────────────

  app.get("/api/community/feed", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);
    const cursor = parseInt(String(req.query.cursor ?? "0"), 10) || null;
    const blocked = await blockedIdsFor(userId);

    const pinned = cursor
      ? []
      : (await pool.query(
          `SELECT ${POST_SELECT} FROM community_posts p ${POST_JOINS}
           WHERE p.scope = 'announcement' AND p.is_pinned = true AND p.is_hidden = false AND ${notInBlocked(1)}
           ORDER BY p.created_at DESC LIMIT 5`,
          [blocked],
        )).rows;

    const params: any[] = [blocked, limit];
    let cursorFilter = "";
    if (cursor) {
      params.push(cursor);
      cursorFilter = ` AND p.id < $3`;
    }
    const { rows } = await pool.query(
      `SELECT ${POST_SELECT} FROM community_posts p ${POST_JOINS}
       WHERE p.scope = 'announcement' AND p.is_pinned = false AND p.is_hidden = false AND ${notInBlocked(1)}${cursorFilter}
       ORDER BY p.id DESC LIMIT $2`,
      params,
    );
    const items = [...pinned, ...rows];
    await attachMyReactions(userId, items);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
    res.json({ pinned, posts: rows, nextCursor, items });
  }));

  app.post("/api/community/posts", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid post", errors: parsed.error.flatten() });
    const { scope, challengeId, body, imageUrl, isPinned, sendPush } = parsed.data;

    const admin = await isAdminUser(userId);
    if (scope === "announcement" && !admin) return res.status(403).json({ message: "Only admins can post announcements" });
    if (scope === "challenge") {
      if (!challengeId) return res.status(400).json({ message: "challengeId required for challenge posts" });
      const { rows: cRows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE id = $1 AND is_published = true`, [challengeId]);
      if (!cRows[0]) return res.status(404).json({ message: "Challenge not found" });
      const { rows: pRows } = await pool.query(
        `SELECT id FROM community_challenge_participants WHERE challenge_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [challengeId, userId],
      );
      if (!pRows[0] && !admin) return res.status(403).json({ message: "Join the challenge to post in its thread" });
    }

    const screen = await screenText(body);
    if (screen.rejected) return res.status(400).json({ message: "Your post contains language that isn't allowed here." });
    const hidden = !!screen.autoHide;

    const { rows } = await pool.query(
      `INSERT INTO community_posts (user_id, scope, challenge_id, body, image_url, is_pinned, is_hidden, hidden_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [userId, scope, challengeId ?? null, body, imageUrl ?? null, scope === "announcement" ? !!isPinned : false, hidden, hidden ? "auto_moderation" : null],
    );
    const postId = rows[0].id;

    if (hidden) {
      await pool.query(
        `INSERT INTO community_reports (reporter_user_id, target_type, target_id, reason, status) VALUES ('system','post',$1,$2,'open')`,
        [String(postId), `Auto-flagged: ${(screen.autoHide || []).join(", ")}`],
      );
      await modLog("auto", "flagged", "post", String(postId), { categories: screen.autoHide });
      return res.status(202).json({ id: postId, held: true, message: "Your post is being reviewed before it appears." });
    }

    // Announcement push fan-out (background; respects per-user prefs/quiet/cap via notify()).
    if (scope === "announcement" && sendPush !== false) {
      (async () => {
        try {
          const { rows: members } = await pool.query(`SELECT user_id AS "userId" FROM community_profiles WHERE is_banned = false`);
          const title = "New in Community";
          const push = body.length > 120 ? `${body.slice(0, 117)}...` : body;
          for (const m of members) {
            if (m.userId === userId) continue;
            await notify({
              userId: m.userId,
              category: "community",
              title,
              body: push,
              data: { communityEvent: `announcement:${postId}`, url: `/community/post/${postId}` },
              disableEmail: true,
            }).catch(() => {});
          }
          console.log(`[community] announcement ${postId} push fan-out to ${members.length} members done`);
        } catch (e) {
          console.error("[community] announcement fan-out failed:", e);
        }
      })();
    }

    res.json({ id: postId, held: false });
  }));

  app.get("/api/community/posts/:id", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const blocked = await blockedIdsFor(userId);
    const { rows } = await pool.query(
      `SELECT ${POST_SELECT} FROM community_posts p ${POST_JOINS} WHERE p.id = $1 AND (p.is_hidden = false OR p.user_id = $2)`,
      [id, userId],
    );
    const post = rows[0];
    if (!post || blocked.includes(post.userId)) return res.status(404).json({ message: "Post not found" });
    await attachMyReactions(userId, [post]);
    const { rows: comments } = await pool.query(
      `SELECT c.id, c.user_id AS "userId", c.body, c.created_at AS "createdAt",
              cp.display_name AS "authorName", cp.avatar_url AS "authorAvatarUrl", u.is_admin AS "authorIsAdmin"
       FROM community_comments c
       LEFT JOIN community_profiles cp ON cp.user_id = c.user_id
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1 AND c.is_hidden = false AND c.user_id != ALL($2::varchar[])
       ORDER BY c.created_at ASC LIMIT 200`,
      [id, blocked],
    );
    res.json({ post, comments });
  }));

  app.post("/api/community/posts/:id/comments", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid comment", errors: parsed.error.flatten() });

    const { rows: postRows } = await pool.query(`SELECT id, user_id AS "userId" FROM community_posts WHERE id = $1 AND is_hidden = false`, [id]);
    if (!postRows[0]) return res.status(404).json({ message: "Post not found" });

    const screen = await screenText(parsed.data.body);
    if (screen.rejected) return res.status(400).json({ message: "Your comment contains language that isn't allowed here." });
    const hidden = !!screen.autoHide;

    const { rows } = await pool.query(
      `INSERT INTO community_comments (post_id, user_id, body, is_hidden, hidden_reason) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [id, userId, parsed.data.body, hidden, hidden ? "auto_moderation" : null],
    );
    if (hidden) {
      await pool.query(
        `INSERT INTO community_reports (reporter_user_id, target_type, target_id, reason, status) VALUES ('system','comment',$1,$2,'open')`,
        [String(rows[0].id), `Auto-flagged: ${(screen.autoHide || []).join(", ")}`],
      );
      await modLog("auto", "flagged", "comment", String(rows[0].id), { categories: screen.autoHide });
      return res.status(202).json({ id: rows[0].id, held: true, message: "Your comment is being reviewed before it appears." });
    }
    res.json({ id: rows[0].id, held: false });
  }));

  app.delete("/api/community/posts/:id", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const admin = await isAdminUser(userId);
    const { rowCount } = await pool.query(
      `UPDATE community_posts SET is_hidden = true, hidden_reason = $3 WHERE id = $1 AND ($2 OR user_id = $4)`,
      [id, admin, admin ? "admin_removed" : "author_deleted", userId],
    );
    if (!rowCount) return res.status(404).json({ message: "Post not found" });
    if (admin) await modLog("admin", "hidden", "post", String(id), { by: userId });
    res.json({ ok: true });
  }));

  app.delete("/api/community/comments/:id", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const admin = await isAdminUser(userId);
    const { rowCount } = await pool.query(
      `UPDATE community_comments SET is_hidden = true, hidden_reason = $3 WHERE id = $1 AND ($2 OR user_id = $4)`,
      [id, admin, admin ? "admin_removed" : "author_deleted", userId],
    );
    if (!rowCount) return res.status(404).json({ message: "Comment not found" });
    if (admin) await modLog("admin", "hidden", "comment", String(id), { by: userId });
    res.json({ ok: true });
  }));

  app.post("/api/community/reactions", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const parsed = z.object({
      targetType: z.enum(["post", "comment"]),
      targetId: z.number().int().positive(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid reaction", errors: parsed.error.flatten() });
    const { targetType, targetId } = parsed.data;
    const { rowCount } = await pool.query(
      `DELETE FROM community_reactions WHERE target_type = $1 AND target_id = $2 AND user_id = $3`,
      [targetType, targetId, userId],
    );
    if (!rowCount) {
      await pool.query(
        `INSERT INTO community_reactions (target_type, target_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [targetType, targetId, userId],
      );
    }
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c FROM community_reactions WHERE target_type = $1 AND target_id = $2`,
      [targetType, targetId],
    );
    res.json({ reacted: !rowCount, reactionCount: rows[0].c });
  }));

  // ── Challenges ────────────────────────────────────────────────────────────

  app.get("/api/community/challenges", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const { rows } = await pool.query(
      `SELECT ${CHALLENGE_COLS},
        (SELECT count(*)::int FROM community_challenge_participants pp WHERE pp.challenge_id = community_challenges.id AND pp.left_at IS NULL) AS "participantCount",
        (SELECT count(*)::int FROM community_challenge_participants pp WHERE pp.challenge_id = community_challenges.id AND pp.user_id = $1 AND pp.left_at IS NULL) AS "joinedFlag"
       FROM community_challenges WHERE is_published = true ORDER BY start_date DESC`,
      [userId],
    );
    const grouped: any = { active: [], upcoming: [], past: [] };
    for (const r of rows as any[]) {
      const status = challengeStatus(r as ChallengeRow);
      const item = { ...r, status, joined: r.joinedFlag > 0 };
      delete item.joinedFlag;
      if (status === "active" || status === "scoring") grouped.active.push(item);
      else if (status === "upcoming") grouped.upcoming.push(item);
      else grouped.past.push(item);
    }
    grouped.upcoming.sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
    res.json(grouped);
  }));

  app.get("/api/community/challenges/:id", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const { rows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE id = $1 AND is_published = true`, [id]);
    const c = rows[0] as ChallengeRow | undefined;
    if (!c) return res.status(404).json({ message: "Challenge not found" });
    const status = challengeStatus(c);

    const { rows: partRows } = await pool.query(
      `SELECT timezone, personal_target AS "personalTarget", show_on_leaderboard AS "showOnLeaderboard", joined_at AS "joinedAt"
       FROM community_challenge_participants WHERE challenge_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [id, userId],
    );
    const mine = partRows[0] ?? null;

    let myProgress: any = null;
    if (mine && (status === "active" || status === "scoring" || status === "final")) {
      // Refresh my own recent scores on-demand so "I just finished a workout" reflects immediately.
      if (status !== "final") {
        try {
          await scoreParticipant(c, { userId, timezone: mine.timezone, personalTarget: mine.personalTarget }, 3);
        } catch (e) {
          console.error("[community] self-refresh failed:", e);
        }
      }
      const { rows: scoreRows } = await pool.query(
        `SELECT date_key AS "dateKey", value, on_target AS "onTarget" FROM community_challenge_scores
         WHERE challenge_id = $1 AND user_id = $2 ORDER BY date_key ASC`,
        [id, userId],
      );
      const daysOnTarget = scoreRows.filter((r: any) => r.onTarget === true).length;
      const total = scoreRows.reduce((s: number, r: any) => s + Number(r.value || 0), 0);
      // Current streak with grace-day forgiveness, walking back from the latest scored day.
      let streak = 0;
      let graceUsed = 0;
      for (let i = scoreRows.length - 1; i >= 0; i--) {
        if (scoreRows[i].onTarget === true) streak++;
        else if (graceUsed < c.graceDays) { graceUsed++; }
        else break;
      }
      const totalDays = dateKeysBetween(c.startDate, c.endDate).length;
      myProgress = {
        days: scoreRows,
        daysOnTarget,
        total,
        streak,
        graceUsed,
        graceDays: c.graceDays,
        totalDays,
        target: mine.personalTarget ?? c.dailyTarget ?? null,
        showOnLeaderboard: mine.showOnLeaderboard,
      };
    }

    const { rows: countRows } = await pool.query(
      `SELECT count(*)::int AS c FROM community_challenge_participants WHERE challenge_id = $1 AND left_at IS NULL`,
      [id],
    );
    res.json({ ...c, status, participantCount: countRows[0].c, joined: !!mine, myProgress });
  }));

  app.post("/api/community/challenges/:id/join", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = joinChallengeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid join", errors: parsed.error.flatten() });
    const { rows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE id = $1 AND is_published = true`, [id]);
    const c = rows[0] as ChallengeRow | undefined;
    if (!c) return res.status(404).json({ message: "Challenge not found" });
    const status = challengeStatus(c);
    if (status === "scoring" || status === "final") return res.status(400).json({ message: "This challenge has ended" });

    let personalTarget: number | null = null;
    if (c.allowPersonalTarget && parsed.data.personalTarget) {
      const opts: number[] = Array.isArray(c.personalTargetOptions) ? c.personalTargetOptions : [];
      if (opts.length > 0 && !opts.includes(parsed.data.personalTarget)) {
        return res.status(400).json({ message: "Pick one of the offered targets" });
      }
      personalTarget = parsed.data.personalTarget;
    }

    await pool.query(
      `INSERT INTO community_challenge_participants (challenge_id, user_id, timezone, personal_target, show_on_leaderboard, joined_at, left_at)
       VALUES ($1,$2,$3,$4,$5, now(), NULL)
       ON CONFLICT ON CONSTRAINT uq_community_participant
       DO UPDATE SET timezone = EXCLUDED.timezone, personal_target = EXCLUDED.personal_target,
         show_on_leaderboard = EXCLUDED.show_on_leaderboard, left_at = NULL`,
      [id, userId, parsed.data.timezone, personalTarget, parsed.data.showOnLeaderboard ?? true],
    );
    res.json({ ok: true });
  }));

  app.post("/api/community/challenges/:id/leave", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await pool.query(
      `UPDATE community_challenge_participants SET left_at = now() WHERE challenge_id = $1 AND user_id = $2`,
      [id, userId],
    );
    res.json({ ok: true });
  }));

  app.get("/api/community/challenges/:id/leaderboard", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const { rows } = await pool.query(`SELECT ${CHALLENGE_COLS} FROM community_challenges WHERE id = $1 AND is_published = true`, [id]);
    const c = rows[0] as ChallengeRow | undefined;
    if (!c) return res.status(404).json({ message: "Challenge not found" });
    const blocked = await blockedIdsFor(userId);

    const orderExpr = c.goalMode === "total" ? `total DESC` : `"daysOnTarget" DESC, total DESC`;
    const { rows: board } = await pool.query(
      `SELECT p.user_id AS "userId", cp.display_name AS "displayName", cp.avatar_url AS "avatarUrl",
              p.personal_target AS "personalTarget",
              COALESCE(SUM(s.value), 0)::float AS total,
              COALESCE(SUM(CASE WHEN s.on_target THEN 1 ELSE 0 END), 0)::int AS "daysOnTarget"
       FROM community_challenge_participants p
       JOIN community_profiles cp ON cp.user_id = p.user_id AND cp.is_banned = false
       LEFT JOIN community_challenge_scores s ON s.challenge_id = p.challenge_id AND s.user_id = p.user_id
       WHERE p.challenge_id = $1 AND p.left_at IS NULL AND p.show_on_leaderboard = true
         AND p.user_id != ALL($2::varchar[])
       GROUP BY p.user_id, cp.display_name, cp.avatar_url, p.personal_target
       ORDER BY ${orderExpr}
       LIMIT 200`,
      [id, blocked],
    );
    const ranked = board.map((r: any, i: number) => ({ rank: i + 1, ...r, isMe: r.userId === userId }));
    const myRow = ranked.find((r: any) => r.isMe) ?? null;
    res.json({ goalMode: c.goalMode, leaderboard: ranked, me: myRow });
  }));

  app.get("/api/community/challenges/:id/posts", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const profile = await requireProfile(userId, res);
    if (!profile) return;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);
    const cursor = parseInt(String(req.query.cursor ?? "0"), 10) || null;
    const blocked = await blockedIdsFor(userId);
    const params: any[] = [id, blocked, limit];
    let cursorFilter = "";
    if (cursor) {
      params.push(cursor);
      cursorFilter = ` AND p.id < $4`;
    }
    const { rows } = await pool.query(
      `SELECT ${POST_SELECT} FROM community_posts p ${POST_JOINS}
       WHERE p.scope = 'challenge' AND p.challenge_id = $1 AND p.is_hidden = false
         AND p.user_id != ALL($2::varchar[])${cursorFilter}
       ORDER BY p.id DESC LIMIT $3`,
      params,
    );
    await attachMyReactions(userId, rows);
    res.json({ posts: rows, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
  }));

  // ── Safety: reports & blocks ──────────────────────────────────────────────

  app.post("/api/community/reports", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const parsed = z.object({
      targetType: z.enum(["post", "comment", "user"]),
      targetId: z.union([z.string(), z.number()]),
      reason: z.string().trim().min(1).max(1000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid report", errors: parsed.error.flatten() });
    const { targetType, targetId, reason } = parsed.data;
    await pool.query(
      `INSERT INTO community_reports (reporter_user_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)`,
      [userId, targetType, String(targetId), reason],
    );
    // Alert admins (in-app + push via their own prefs) so reports get "timely responses" (Apple 1.2).
    (async () => {
      try {
        const { rows: admins } = await pool.query(`SELECT id FROM users WHERE is_admin = true`);
        for (const a of admins) {
          await notify({
            userId: a.id,
            category: "admin",
            title: "Community report",
            body: `A ${targetType} was reported: "${reason.slice(0, 120)}"`,
            data: { communityReport: true, targetType, targetId: String(targetId) },
            disableEmail: true,
            force: true,
          }).catch(() => {});
        }
      } catch (e) {
        console.error("[community] report alert failed:", e);
      }
    })();
    res.json({ ok: true });
  }));

  app.get("/api/community/blocks", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const { rows } = await pool.query(
      `SELECT b.blocked_user_id AS "userId", cp.display_name AS "displayName", b.created_at AS "createdAt"
       FROM community_blocks b LEFT JOIN community_profiles cp ON cp.user_id = b.blocked_user_id
       WHERE b.blocker_user_id = $1 ORDER BY b.created_at DESC`,
      [userId],
    );
    res.json(rows);
  }));

  app.post("/api/community/blocks", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid block", errors: parsed.error.flatten() });
    if (parsed.data.userId === userId) return res.status(400).json({ message: "You can't block yourself" });
    await pool.query(
      `INSERT INTO community_blocks (blocker_user_id, blocked_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [userId, parsed.data.userId],
    );
    res.json({ ok: true });
  }));

  app.delete("/api/community/blocks/:userId", isAuthenticated, ready(async (req, res) => {
    const userId = req.user.claims.sub;
    await pool.query(
      `DELETE FROM community_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
      [userId, req.params.userId],
    );
    res.json({ ok: true });
  }));

  // ── Admin ─────────────────────────────────────────────────────────────────

  const adminOnly = (handler: (req: any, res: any) => Promise<any>) => ready(async (req: any, res: any) => {
    const userId = req.user.claims.sub;
    if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Admin only" });
    await handler(req, res);
  });

  app.post("/api/admin/community/challenges", isAuthenticated, adminOnly(async (req, res) => {
    const parsed = challengeCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid challenge", errors: parsed.error.flatten() });
    const d = parsed.data;
    if (d.endDate < d.startDate) return res.status(400).json({ message: "endDate must be after startDate" });
    if (d.type === "programme" && !d.programId) return res.status(400).json({ message: "programId required for programme challenges" });
    if (d.type === "metric" && !d.metric) return res.status(400).json({ message: "metric required for metric challenges" });
    const { rows } = await pool.query(
      `INSERT INTO community_challenges
        (title, description, cover_image_url, type, program_id, metric, goal_mode, daily_target,
         allow_personal_target, personal_target_options, start_date, end_date, grace_days,
         results_final_hours, prize_text, rules_url, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        d.title, d.description ?? null, d.coverImageUrl ?? null, d.type, d.programId ?? null,
        d.metric ?? null, d.goalMode, d.dailyTarget ?? null, d.allowPersonalTarget ?? false,
        d.personalTargetOptions ? JSON.stringify(d.personalTargetOptions) : null,
        d.startDate, d.endDate, d.graceDays ?? 2, d.resultsFinalHours ?? 48,
        d.prizeText ?? null, d.rulesUrl ?? null, d.isPublished ?? false,
      ],
    );
    res.json({ id: rows[0].id });
  }));

  app.patch("/api/admin/community/challenges/:id", isAuthenticated, adminOnly(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = challengeCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid update", errors: parsed.error.flatten() });
    const d = parsed.data as any;
    const cols: Record<string, string> = {
      title: "title", description: "description", coverImageUrl: "cover_image_url", type: "type",
      programId: "program_id", metric: "metric", goalMode: "goal_mode", dailyTarget: "daily_target",
      allowPersonalTarget: "allow_personal_target", startDate: "start_date", endDate: "end_date",
      graceDays: "grace_days", resultsFinalHours: "results_final_hours", prizeText: "prize_text",
      rulesUrl: "rules_url", isPublished: "is_published",
    };
    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, col] of Object.entries(cols)) {
      if (d[k] !== undefined) {
        vals.push(d[k]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (d.personalTargetOptions !== undefined) {
      vals.push(JSON.stringify(d.personalTargetOptions));
      sets.push(`personal_target_options = $${vals.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ message: "Nothing to update" });
    vals.push(id);
    const { rowCount } = await pool.query(`UPDATE community_challenges SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
    if (!rowCount) return res.status(404).json({ message: "Challenge not found" });
    res.json({ ok: true });
  }));

  app.get("/api/admin/community/challenges", isAuthenticated, adminOnly(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CHALLENGE_COLS},
        (SELECT count(*)::int FROM community_challenge_participants pp WHERE pp.challenge_id = community_challenges.id AND pp.left_at IS NULL) AS "participantCount"
       FROM community_challenges ORDER BY created_at DESC`,
    );
    res.json(rows.map((r: any) => ({ ...r, status: challengeStatus(r as ChallengeRow) })));
  }));

  app.patch("/api/admin/community/posts/:id", isAuthenticated, adminOnly(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = z.object({ isPinned: z.boolean().optional(), isHidden: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid update" });
    const { isPinned, isHidden } = parsed.data;
    const { rowCount } = await pool.query(
      `UPDATE community_posts SET
         is_pinned = COALESCE($2, is_pinned),
         is_hidden = COALESCE($3, is_hidden),
         hidden_reason = CASE WHEN $3 = true THEN 'admin_removed' WHEN $3 = false THEN NULL ELSE hidden_reason END
       WHERE id = $1`,
      [id, isPinned ?? null, isHidden ?? null],
    );
    if (!rowCount) return res.status(404).json({ message: "Post not found" });
    if (isHidden !== undefined) await modLog("admin", isHidden ? "hidden" : "unhidden", "post", String(id), { by: req.user.claims.sub });
    res.json({ ok: true });
  }));

  app.get("/api/admin/community/reports", isAuthenticated, adminOnly(async (req, res) => {
    const status = String(req.query.status ?? "open");
    const { rows } = await pool.query(
      `SELECT r.id, r.reporter_user_id AS "reporterUserId", r.target_type AS "targetType", r.target_id AS "targetId",
              r.reason, r.status, r.created_at AS "createdAt",
              CASE WHEN r.target_type = 'post' THEN (SELECT body FROM community_posts WHERE id = r.target_id::int)
                   WHEN r.target_type = 'comment' THEN (SELECT body FROM community_comments WHERE id = r.target_id::int)
                   ELSE NULL END AS "targetBody",
              CASE WHEN r.target_type = 'post' THEN (SELECT user_id FROM community_posts WHERE id = r.target_id::int)
                   WHEN r.target_type = 'comment' THEN (SELECT user_id FROM community_comments WHERE id = r.target_id::int)
                   ELSE r.target_id END AS "targetUserId"
       FROM community_reports r WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [status],
    );
    res.json(rows);
  }));

  app.patch("/api/admin/community/reports/:id", isAuthenticated, adminOnly(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = z.object({
      action: z.enum(["dismiss", "hide_content", "ban_user", "unhide_content"]),
      note: z.string().max(1000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid action" });
    const { action, note } = parsed.data;
    const { rows } = await pool.query(
      `SELECT id, target_type AS "targetType", target_id AS "targetId" FROM community_reports WHERE id = $1`,
      [id],
    );
    const report = rows[0];
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (action === "hide_content" || action === "unhide_content") {
      const hide = action === "hide_content";
      if (report.targetType === "post") {
        await pool.query(`UPDATE community_posts SET is_hidden = $2, hidden_reason = $3 WHERE id = $1`, [parseInt(report.targetId, 10), hide, hide ? "admin_removed" : null]);
      } else if (report.targetType === "comment") {
        await pool.query(`UPDATE community_comments SET is_hidden = $2, hidden_reason = $3 WHERE id = $1`, [parseInt(report.targetId, 10), hide, hide ? "admin_removed" : null]);
      }
      await modLog("admin", hide ? "hidden" : "unhidden", report.targetType, report.targetId, { reportId: id, by: req.user.claims.sub });
    } else if (action === "ban_user") {
      let targetUserId: string | null = null;
      if (report.targetType === "user") targetUserId = report.targetId;
      else if (report.targetType === "post") {
        const { rows: r2 } = await pool.query(`SELECT user_id FROM community_posts WHERE id = $1`, [parseInt(report.targetId, 10)]);
        targetUserId = r2[0]?.user_id ?? null;
      } else if (report.targetType === "comment") {
        const { rows: r2 } = await pool.query(`SELECT user_id FROM community_comments WHERE id = $1`, [parseInt(report.targetId, 10)]);
        targetUserId = r2[0]?.user_id ?? null;
      }
      if (targetUserId) {
        await pool.query(`UPDATE community_profiles SET is_banned = true, updated_at = now() WHERE user_id = $1`, [targetUserId]);
        await pool.query(`UPDATE community_posts SET is_hidden = true, hidden_reason = 'user_banned' WHERE user_id = $1`, [targetUserId]);
        await pool.query(`UPDATE community_comments SET is_hidden = true, hidden_reason = 'user_banned' WHERE user_id = $1`, [targetUserId]);
        await modLog("admin", "banned", "user", targetUserId, { reportId: id, by: req.user.claims.sub });
      }
    }
    await pool.query(
      `UPDATE community_reports SET status = $2, resolved_at = now(), resolution_note = $3 WHERE id = $1`,
      [id, action === "dismiss" ? "dismissed" : "actioned", note ?? null],
    );
    res.json({ ok: true });
  }));

  app.get("/api/admin/community/banned-words", isAuthenticated, adminOnly(async (_req, res) => {
    const { rows } = await pool.query(`SELECT id, word FROM community_banned_words ORDER BY word ASC`);
    res.json(rows);
  }));

  app.post("/api/admin/community/banned-words", isAuthenticated, adminOnly(async (req, res) => {
    const parsed = z.object({ word: z.string().trim().min(2).max(60) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid word" });
    await pool.query(`INSERT INTO community_banned_words (word) VALUES (lower($1)) ON CONFLICT DO NOTHING`, [parsed.data.word]);
    bannedCache = { words: [], at: 0 };
    res.json({ ok: true });
  }));

  app.delete("/api/admin/community/banned-words/:id", isAuthenticated, adminOnly(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await pool.query(`DELETE FROM community_banned_words WHERE id = $1`, [id]);
    bannedCache = { words: [], at: 0 };
    res.json({ ok: true });
  }));

  console.log("[community] routes registered");
}
