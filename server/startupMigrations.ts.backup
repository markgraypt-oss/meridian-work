import { storage } from "./storage";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";

let hasRunProfileImages = false;
let hasRunMeditationSeed = false;
let hasRunSchemaSelfHeal = false;
let hasRunBodyweightGoalUnitRepair = false;
let hasRunRecipeMacrosNormalize = false;
let hasRunDedupeCheckIns = false;

/**
 * Idempotent self-heal for schema columns that the app needs but that may not
 * have been applied to production yet via the Publish-time schema diff.
 * Each statement uses IF NOT EXISTS so it's safe to run on every boot.
 */
const SELF_HEAL_DDL: string[] = [
  // workday rotation: pause-without-remove
  `ALTER TABLE workday_user_profiles ADD COLUMN IF NOT EXISTS active_positions text[]`,

  // Wearables: required by burnout score computation
  `CREATE TABLE IF NOT EXISTS wearable_connections (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     provider text NOT NULL,
     status text NOT NULL DEFAULT 'connected',
     access_token_enc text,
     refresh_token_enc text,
     token_expires_at timestamp,
     provider_user_id text,
     scopes text[],
     connected_at timestamp DEFAULT now(),
     last_sync_at timestamp,
     last_sync_status text,
     last_sync_error text,
     meta jsonb,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS wearable_metrics_daily (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     provider text NOT NULL,
     date text NOT NULL,
     sleep_minutes integer,
     sleep_deep_minutes integer,
     sleep_rem_minutes integer,
     sleep_light_minutes integer,
     sleep_awake_minutes integer,
     sleep_score integer,
     hrv_ms integer,
     resting_hr_bpm integer,
     steps integer,
     active_minutes integer,
     calories_burned integer,
     readiness_score integer,
     strain_score integer,
     workout_count integer,
     raw jsonb,
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wearable_metrics_user_date_provider_idx
     ON wearable_metrics_daily (user_id, date, provider)`,

  // Meditations content table (seeded by seedMeditationsOnce)
  `CREATE TABLE IF NOT EXISTS meditations (
     id serial PRIMARY KEY,
     title text NOT NULL,
     description text,
     category text NOT NULL,
     duration_min integer NOT NULL,
     audio_url text,
     tags text[],
     is_active boolean NOT NULL DEFAULT true,
     order_index integer DEFAULT 0,
     created_at timestamp DEFAULT now()
   )`,

  // Notification preferences: daily cap + per-category × per-channel toggles
  `ALTER TABLE notification_preferences
     ADD COLUMN IF NOT EXISTS daily_cap integer DEFAULT 8,
     ADD COLUMN IF NOT EXISTS in_app_training boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS in_app_recovery boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS in_app_nutrition boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS in_app_coach boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS in_app_admin boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS email_training boolean DEFAULT false,
     ADD COLUMN IF NOT EXISTS email_recovery boolean DEFAULT false,
     ADD COLUMN IF NOT EXISTS email_nutrition boolean DEFAULT false,
     ADD COLUMN IF NOT EXISTS email_coach boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS email_admin boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS push_training boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS push_recovery boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS push_nutrition boolean DEFAULT false,
     ADD COLUMN IF NOT EXISTS push_coach boolean DEFAULT true,
     ADD COLUMN IF NOT EXISTS push_admin boolean DEFAULT false`,

  // Phase 1b: conditional perceived-control question (stress ≥4 or overwhelmed/anxious checked)
  `ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS perceived_control_score integer`,
  `ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS perceived_control_trigger_met boolean DEFAULT false`,
  `ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS notes_analysis jsonb`,

  // Badges: collection split (current vs legacy)
  `ALTER TABLE badges ADD COLUMN IF NOT EXISTS collection varchar NOT NULL DEFAULT 'current'`,

  // Micro-resets: exercise type (timed vs reps) so users can pick how long/how many
  `ALTER TABLE workday_micro_resets ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'timed'`,

  // Workday schedule blocks + working hours (Task 60). Required by /api/workday/profile.
  `ALTER TABLE workday_user_profiles
     ADD COLUMN IF NOT EXISTS workday_start text,
     ADD COLUMN IF NOT EXISTS workday_end text,
     ADD COLUMN IF NOT EXISTS workday_days text[],
     ADD COLUMN IF NOT EXISTS schedule_blocks jsonb DEFAULT NULL`,

  // Workday schedule repeat cap. null = loop until workdayEnd; 1-10 = N runs.
  `ALTER TABLE workday_user_profiles ADD COLUMN IF NOT EXISTS schedule_repeats integer`,

  // AI Prompt Library (seeded by seedAiPromptsOnce). Drives the curated
  // executive-wellness presets in the AI Workout & Programme Builders.
  `CREATE TABLE IF NOT EXISTS ai_prompts (
     id serial PRIMARY KEY,
     kind varchar NOT NULL,
     title varchar NOT NULL,
     description text NOT NULL,
     icon_name varchar DEFAULT 'Sparkles',
     prompt_body text NOT NULL,
     prefill jsonb,
     sort_order integer NOT NULL DEFAULT 0,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_prompts_kind_order ON ai_prompts (kind, sort_order)`,

  // Coach briefings: read/dismiss timestamps + context snapshot + source.
  // The original table predates these columns, so production rows + queries
  // fail with "column read_at does not exist" until backfilled.
  `ALTER TABLE coach_briefings
     ADD COLUMN IF NOT EXISTS read_at timestamp,
     ADD COLUMN IF NOT EXISTS dismissed_at timestamp,
     ADD COLUMN IF NOT EXISTS context_snapshot jsonb,
     ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai'`,

  // Daily Readiness: table predates the feature flag being on in prod,
  // so the table may not exist yet. Both /today and /history fail with
  // "relation daily_readiness_history does not exist" until created.
  `CREATE TABLE IF NOT EXISTS daily_readiness_history (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     date varchar NOT NULL,
     sleep_input real,
     pain_input real,
     energy_input real,
     nutrition_input real,
     movement_input real,
     recovery_input real,
     input_count integer NOT NULL DEFAULT 0,
     score integer,
     algorithm_version varchar NOT NULL DEFAULT 'v1',
     created_at timestamp DEFAULT now(),
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_readiness_user_date ON daily_readiness_history (user_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_readiness_user ON daily_readiness_history (user_id)`,

  // Workouts: new fields to align with programme builder vocabulary.
  // - goal mirrors the programmes goal vocabulary (strength, hypertrophy, etc.)
  // - equipment_level: single chosen equipment level
  // - categories: chip multi-select (gym/home/travel/female_specific)
  // - target_areas: chip multi-select (full_body/upper_body/lower_body/push/pull/legs/glutes/core)
  `ALTER TABLE workouts
     ADD COLUMN IF NOT EXISTS goal text,
     ADD COLUMN IF NOT EXISTS equipment_level text,
     ADD COLUMN IF NOT EXISTS categories text[],
     ADD COLUMN IF NOT EXISTS target_areas text[]`,

  // Badge system v2: food_logs source tracking for barcode scan badge
  `ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'`,

  // Weekly check-ins: dedupe any (user_id, week_start) duplicates created by
  // race conditions in getOrCreateCurrentWeeklyCheckinV2, then enforce
  // uniqueness so it can't recur. Keeps the HIGHEST id per (user, week) —
  // the most recently generated payload (most up-to-date data).
  `DELETE FROM weekly_checkins w
     USING weekly_checkins w2
     WHERE w.user_id = w2.user_id
       AND w.week_start = w2.week_start
       AND w.id < w2.id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_checkins_user_week_unique
     ON weekly_checkins (user_id, week_start)`,

  // One-time cleanup: delete any past-week snapshots whose payload was
  // generated BEFORE the week actually ended (Monday-morning scheduler bug).
  // They contained zero/partial data. Deleting forces a fresh aggregation on
  // the next view via getOrCreateCurrentWeeklyCheckinV2 / upgradeWeeklyCheckinIfStale.
  // Safe to run repeatedly: only matches rows where generated_at < week_end
  // (week_end = week_start + 7 days) AND the week is no longer current.
  `DELETE FROM weekly_checkins
     WHERE generated_at < (week_start + interval '7 days')
       AND (week_start + interval '7 days') <= now()`,

  // Badge system v2: workday break log tracker (desk break streak badges)
  `CREATE TABLE IF NOT EXISTS workday_break_logs (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     break_type text NOT NULL DEFAULT 'reminder',
     logged_at timestamp DEFAULT now(),
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_workday_break_logs_user ON workday_break_logs (user_id)`,

  // Phase 1c: physiological snapshots — per-computation early-warning evidence
  `CREATE TABLE IF NOT EXISTS physiological_snapshots (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     computed_at timestamp NOT NULL DEFAULT now(),
     hrv_z_score real,
     rhr_z_score real,
     baseline_calibrated boolean NOT NULL DEFAULT false,
     warning_fired boolean NOT NULL DEFAULT false,
     warning_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
     score integer,
     tier text,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS physiological_snapshots_user_computed_idx
     ON physiological_snapshots (user_id, computed_at)`,

  // Badge system v2: AI insight read tracker
  `CREATE TABLE IF NOT EXISTS ai_insight_reads (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     insight_type text NOT NULL,
     insight_key text,
     read_at timestamp DEFAULT now(),
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_insight_reads_user ON ai_insight_reads (user_id)`,

  // Multi-PDF support: documents attached to content library items
  `CREATE TABLE IF NOT EXISTS learn_content_documents (
     id serial PRIMARY KEY,
     content_library_item_id integer NOT NULL REFERENCES learn_content_library(id) ON DELETE CASCADE,
     title text NOT NULL,
     file_url text NOT NULL,
     created_at timestamp DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_learn_content_documents_item ON learn_content_documents (content_library_item_id)`,
];

export async function runSchemaSelfHealOnce(): Promise<void> {
  if (hasRunSchemaSelfHeal) return;
  hasRunSchemaSelfHeal = true;
  for (const sql of SELF_HEAL_DDL) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.error("[startup-migration] self-heal failed:", sql, err?.message || err);
    }
  }
  console.log(`[startup-migration] schema self-heal complete (${SELF_HEAL_DDL.length} stmts)`);
}

const SEED_MEDITATIONS = [
  { title: "Morning Calm", durationMin: 5, category: "Focus", description: "Start your day with clarity and intention", tags: ["morning", "focus", "energy"] },
  { title: "Stress Relief", durationMin: 10, category: "Relaxation", description: "Release tension and find your center", tags: ["stress", "relax", "breathwork"] },
  { title: "Body Scan", durationMin: 15, category: "Awareness", description: "Connect with your body from head to toe", tags: ["awareness", "tension", "recovery"] },
  { title: "Evening Wind Down", durationMin: 8, category: "Sleep", description: "Prepare your mind for restful sleep", tags: ["sleep", "evening", "wind-down"] },
  { title: "Focus Boost", durationMin: 7, category: "Focus", description: "Sharpen concentration before deep work", tags: ["focus", "work", "clarity"] },
  { title: "Compassion Practice", durationMin: 12, category: "Emotional", description: "Cultivate kindness toward yourself and others", tags: ["emotional", "compassion", "mood"] },
];

// AI Prompt Library seed: ~14 workout + ~7 programme presets curated for
// busy executives. Run once when ai_prompts is empty so admins can edit/add.
let hasRunAiPromptSeed = false;
const SEED_AI_PROMPTS = [
  // ---------------- WORKOUT (single-session) ----------------
  { kind: "workout", title: "20-min hotel-room reset", description: "Bodyweight strength + mobility for between meetings.", iconName: "Hotel",
    promptBody: "Build a 20-minute bodyweight workout I can do in a hotel room. Mix push, pull and lower-body movements with mobility transitions. Keep impact low so I won't disturb the room below.",
    prefill: { duration: 20, equipment: "bodyweight", difficulty: "intermediate", focus: "full body", notes: "low impact, no jumping" } },
  { kind: "workout", title: "Pre-flight mobility flush", description: "15 min mobility before a long-haul flight.", iconName: "Plane",
    promptBody: "Design a 15-minute mobility session focused on hips, thoracic spine and ankles to prep me for an 8+ hour flight.",
    prefill: { duration: 15, equipment: "bodyweight", difficulty: "beginner", focus: "mobility", notes: "hips, T-spine, ankles" } },
  { kind: "workout", title: "Post-flight recovery", description: "Restore circulation and posture after long travel.", iconName: "Plane",
    promptBody: "Build a 25-minute restorative session to reverse hours of sitting after a long flight. Emphasise hip openers, decompression and gentle activation.",
    prefill: { duration: 25, equipment: "bodyweight", difficulty: "beginner", focus: "recovery", notes: "post-travel, gentle" } },
  { kind: "workout", title: "Lunchtime energy boost", description: "30-min full-body lift to refire focus.", iconName: "Zap",
    promptBody: "Generate a 30-minute full-body strength workout that leaves me energised, not wrecked, for the rest of the workday.",
    prefill: { duration: 30, equipment: "full_gym", difficulty: "intermediate", focus: "full body", notes: "leave energy in the tank" } },
  { kind: "workout", title: "Stress-melt mobility", description: "Slow, breath-led movement to drop the day.", iconName: "Wind",
    promptBody: "Create a 20-minute slow mobility flow with breath cues to downshift after a stressful day.",
    prefill: { duration: 20, equipment: "bodyweight", difficulty: "beginner", focus: "mobility", notes: "calming, breath-led" } },
  { kind: "workout", title: "Posture rescue", description: "Counter the desk hunch in 20 minutes.", iconName: "User",
    promptBody: "Build a 20-minute corrective routine targeting upper-back, scapular control and hip flexor length to undo a long day at the desk.",
    prefill: { duration: 20, equipment: "bodyweight", difficulty: "beginner", focus: "posture", notes: "upper back, scaps, hip flexors" } },
  { kind: "workout", title: "Strong & quick (45 min)", description: "Compact strength session, full gym.", iconName: "Dumbbell",
    promptBody: "Generate a 45-minute strength workout using compound lifts. Keep rest tight and pair accessories so I can finish on time.",
    prefill: { duration: 45, equipment: "full_gym", difficulty: "intermediate", focus: "strength", notes: "compound focus, supersets ok" } },
  { kind: "workout", title: "HIIT before breakfast", description: "Short, sharp metabolic hit.", iconName: "Flame",
    promptBody: "Build a 20-minute HIIT session, mostly bodyweight, that I can do fasted before breakfast without trashing recovery.",
    prefill: { duration: 20, equipment: "bodyweight", difficulty: "intermediate", focus: "conditioning", notes: "fasted-friendly" } },
  { kind: "workout", title: "Lower-back-friendly core", description: "Build trunk strength without aggravating the back.", iconName: "Shield",
    promptBody: "Design a 25-minute core workout that strengthens the trunk without spinal flexion. Avoid sit-ups and crunches.",
    prefill: { duration: 25, equipment: "bodyweight", difficulty: "intermediate", focus: "core", notes: "no spinal flexion, lower-back friendly" } },
  { kind: "workout", title: "Knee-friendly lower body", description: "Build legs without loading the knees hard.", iconName: "Footprints",
    promptBody: "Create a 35-minute lower-body workout that avoids deep knee flexion under load. Prefer hinge patterns and isometrics.",
    prefill: { duration: 35, equipment: "home_gym", difficulty: "intermediate", focus: "lower body", notes: "knee-friendly, prefer hinge" } },
  { kind: "workout", title: "Shoulder-safe upper body", description: "Push/pull with shoulder-friendly variations.", iconName: "Shield",
    promptBody: "Build a 35-minute upper-body workout using shoulder-friendly variations (neutral grip, scapular control). Avoid overhead pressing.",
    prefill: { duration: 35, equipment: "home_gym", difficulty: "intermediate", focus: "upper body", notes: "no overhead press, neutral grip" } },
  { kind: "workout", title: "Travel band workout", description: "Resistance band only, hotel-friendly.", iconName: "Briefcase",
    promptBody: "Generate a 30-minute full-body workout using only a single resistance band. Cover push, pull, hinge and squat patterns.",
    prefill: { duration: 30, equipment: "bodyweight", difficulty: "intermediate", focus: "full body", notes: "resistance band only" } },
  { kind: "workout", title: "Active recovery walk-and-flow", description: "Easy day, low intensity.", iconName: "Heart",
    promptBody: "Build a 30-minute easy-day session combining mobility, light loaded carries and breathwork for active recovery.",
    prefill: { duration: 30, equipment: "bodyweight", difficulty: "beginner", focus: "recovery", notes: "low intensity" } },
  { kind: "workout", title: "Boardroom-day quick fix", description: "12-min desk-side movement snack.", iconName: "Briefcase",
    promptBody: "Build a 12-minute movement snack I can do in office attire next to my desk. Focus on circulation and posture.",
    prefill: { duration: 12, equipment: "bodyweight", difficulty: "beginner", focus: "mobility", notes: "office attire, no equipment" } },

  // ---------------- PROGRAMME (multi-week) ----------------
  { kind: "programme", title: "4-week executive strength", description: "3x/week, full gym, balanced strength build.", iconName: "Dumbbell",
    promptBody: "Build a 4-week strength programme for someone with limited time who can train 3 days per week in a full gym. Compound lifts, balanced upper/lower split, progressive overload.",
    prefill: { goal: "general_strength", equipment: "full_gym", weeks: 4, daysPerWeek: 3, sessionDuration: 45, difficulty: "intermediate", audience: "busy professionals" } },
  { kind: "programme", title: "6-week home-gym hypertrophy", description: "4x/week dumbbells & bench muscle build.", iconName: "Home",
    promptBody: "Design a 6-week hypertrophy programme using only dumbbells and a bench. 4 sessions per week, 45 minutes each, body-part split.",
    prefill: { goal: "hypertrophy", equipment: "home_gym", weeks: 6, daysPerWeek: 4, sessionDuration: 45, difficulty: "intermediate", audience: "home-gym lifters" } },
  { kind: "programme", title: "4-week travel-proof bodyweight", description: "Bodyweight, 4x/week, anywhere.", iconName: "Plane",
    promptBody: "Create a 4-week bodyweight programme for someone who travels constantly. 4 short sessions per week, no equipment, scalable difficulty.",
    prefill: { goal: "general_strength", equipment: "bodyweight", weeks: 4, daysPerWeek: 4, sessionDuration: 30, difficulty: "intermediate", audience: "frequent travellers" } },
  { kind: "programme", title: "6-week desk-worker mobility reset", description: "Daily 20-min mobility build.", iconName: "User",
    promptBody: "Build a 6-week mobility programme for a desk worker. 5 short sessions per week emphasising hips, thoracic spine, shoulders and hip flexors.",
    prefill: { goal: "mobility_stretching", equipment: "bodyweight", weeks: 6, daysPerWeek: 5, sessionDuration: 20, difficulty: "beginner", audience: "desk workers" } },
  { kind: "programme", title: "8-week return-to-lifting", description: "Gentle re-entry after a layoff.", iconName: "RefreshCw",
    promptBody: "Design an 8-week return-to-lifting programme for someone coming back after 3 months off. Start light, progress conservatively, 3 days per week.",
    prefill: { goal: "general_strength", equipment: "full_gym", weeks: 8, daysPerWeek: 3, sessionDuration: 40, difficulty: "beginner", audience: "returning lifters" } },
  { kind: "programme", title: "4-week conditioning kickstart", description: "Build aerobic base + work capacity.", iconName: "Flame",
    promptBody: "Build a 4-week conditioning programme combining steady-state and intervals. 4 sessions per week, mixed equipment, intermediate level.",
    prefill: { goal: "conditioning", equipment: "home_gym", weeks: 4, daysPerWeek: 4, sessionDuration: 35, difficulty: "intermediate", audience: "executives building work capacity" } },
  { kind: "programme", title: "6-week corrective for lower back", description: "Rebuild trunk + hip control.", iconName: "Shield",
    promptBody: "Design a 6-week corrective programme for someone with chronic low-back tightness. Avoid spinal flexion, emphasise glutes, deep core, hip mobility. 4 short sessions per week.",
    prefill: { goal: "corrective", equipment: "bodyweight", weeks: 6, daysPerWeek: 4, sessionDuration: 25, difficulty: "beginner", audience: "lower-back-sensitive users" } },
];

export async function seedAiPromptsOnce(): Promise<void> {
  if (hasRunAiPromptSeed) return;
  hasRunAiPromptSeed = true;
  try {
    const existing = await storage.listAiPrompts(undefined, true);
    if (existing.length > 0) return;
    let workoutOrder = 0;
    let programmeOrder = 0;
    for (const p of SEED_AI_PROMPTS) {
      const sortOrder = p.kind === "workout" ? workoutOrder++ : programmeOrder++;
      await storage.createAiPrompt({
        kind: p.kind,
        title: p.title,
        description: p.description,
        iconName: p.iconName,
        promptBody: p.promptBody,
        prefill: p.prefill,
        sortOrder,
        isActive: true,
      });
    }
    console.log(`[startup-migration] seeded ${SEED_AI_PROMPTS.length} AI prompts`);
  } catch (err: any) {
    console.error("[startup-migration] AI prompt seed failed:", err?.message || err);
  }
}

export async function seedMeditationsOnce(): Promise<void> {
  if (hasRunMeditationSeed) return;
  hasRunMeditationSeed = true;
  try {
    const existing = await storage.getMeditations();
    if (existing.length > 0) return;
    let order = 0;
    for (const m of SEED_MEDITATIONS) {
      await storage.createMeditation({ ...m, orderIndex: order++, isActive: true });
    }
    console.log(`[startup-migration] seeded ${SEED_MEDITATIONS.length} meditations`);
  } catch (err: any) {
    console.error("[startup-migration] meditation seed failed:", err?.message || err);
  }
}

async function uploadBufferAsPublicProfileImage(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const svc = new ObjectStorageService();
  const privateDir = svc.getPrivateObjectDir();
  const trimmedDir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const entityId = `profile-images/${randomUUID()}`;
  const fullPath = `${trimmedDir}/${entityId}`;
  const parts = fullPath.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, {
    contentType,
    metadata: {
      contentType,
      metadata: {
        "custom:aclPolicy": JSON.stringify({ owner: "system", visibility: "public" }),
      },
    },
    resumable: false,
  });
  return `/objects/${entityId}`;
}

/**
 * Convert any user.profileImageUrl values still stored as base64 data URLs into
 * Object Storage entries with a public ACL. Also clears legacy /uploads/* paths
 * that no longer resolve. Safe to call on every boot — does nothing if the DB
 * has no remaining legacy values.
 */
export async function runProfileImageMigrationOnce(): Promise<void> {
  if (hasRunProfileImages) return;
  hasRunProfileImages = true;

  // Skip entirely if Object Storage is not configured (e.g. local dev without
  // the integration). The endpoint is still callable manually if needed.
  if (!process.env.PRIVATE_OBJECT_DIR || !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
    return;
  }

  let allUsers;
  try {
    allUsers = await storage.getAllUsers();
  } catch (e) {
    console.error("[startup-migration] could not list users:", e);
    return;
  }

  const candidates = allUsers.filter(
    (u) => u.profileImageUrl && (u.profileImageUrl.startsWith("data:") || u.profileImageUrl.startsWith("/uploads/")),
  );
  if (candidates.length === 0) return;

  console.log(`[startup-migration] profile-images: ${candidates.length} user(s) need migration`);

  let migrated = 0;
  let cleared = 0;
  const skipped: string[] = [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (const u of candidates) {
    const url = u.profileImageUrl as string;
    try {
      if (url.startsWith("data:")) {
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) {
          skipped.push(u.id);
          continue;
        }
        const mime = m[1];
        const buf = Buffer.from(m[2], "base64");
        const objectPath = await uploadBufferAsPublicProfileImage(buf, mime);
        await storage.updateUser(u.id, { profileImageUrl: objectPath });
        migrated++;
      } else if (url.startsWith("/uploads/")) {
        await storage.updateUser(u.id, { profileImageUrl: null as any });
        cleared++;
      }
    } catch (e: any) {
      errors.push({ userId: u.id, error: e?.message || String(e) });
    }
  }

  console.log(
    `[startup-migration] profile-images done: migrated=${migrated} clearedLegacyUploads=${cleared} skippedUnparseable=${skipped.length} errors=${errors.length}`,
  );
  if (skipped.length) console.log("[startup-migration] skipped userIds:", skipped);
  if (errors.length) console.log("[startup-migration] errors:", errors);
}

/**
 * One-time repair: bodyweight goals whose unit was not applied during sync.
 * Before the fix, syncBodyweightGoals compared raw kg entries directly against
 * goal values stored in lbs (or any other unit), producing wrong progress %,
 * wrong currentValue, and false completions.
 *
 * This runs once on boot, repairs ALL bodyweight goals (including those already
 * falsely marked isCompleted=true, which the normal sync skips), then sets the
 * flag so it never runs again in this process lifetime.
 */
export async function repairBodyweightGoalUnitsOnce(): Promise<void> {
  if (hasRunBodyweightGoalUnitRepair) return;
  hasRunBodyweightGoalUnitRepair = true;

  try {
    // 1. Get all bodyweight goals (completed or not) across all users
    const goalsRes = await pool.query(
      `SELECT id, user_id, target_value, starting_value, current_value, unit, is_completed, progress
       FROM goals
       WHERE type = 'bodyweight' AND target_value IS NOT NULL`
    );

    if (goalsRes.rows.length === 0) {
      console.log("[startup-migration] bodyweight-goal-repair: no goals found, skip");
      return;
    }

    // 2. Fetch latest bodyweight entry per user in a single query (always in kg)
    const weightsRes = await pool.query(
      `SELECT DISTINCT ON (user_id) user_id, weight, date
       FROM bodyweight_entries
       ORDER BY user_id, date DESC`
    );
    const latestByUser = new Map<string, number>();
    for (const row of weightsRes.rows) {
      latestByUser.set(row.user_id, parseFloat(row.weight));
    }

    let repaired = 0;
    let skipped = 0;

    for (const goal of goalsRes.rows) {
      const latestWeightKg = latestByUser.get(goal.user_id);
      if (latestWeightKg === undefined) { skipped++; continue; }

      const goalUnit = (goal.unit || "kg").toLowerCase();
      const latestWeight = goalUnit === "lbs"
        ? Math.round(latestWeightKg * 2.20462 * 10) / 10
        : latestWeightKg;

      const startWeight = parseFloat(goal.starting_value) || parseFloat(goal.current_value) || latestWeight;
      const targetWeight = parseFloat(goal.target_value);
      const totalDiff = Math.abs(startWeight - targetWeight);
      const currentDiff = Math.abs(latestWeight - targetWeight);

      let progress = 0;
      if (totalDiff > 0) {
        progress = Math.round(((totalDiff - currentDiff) / totalDiff) * 100);
        progress = Math.max(0, Math.min(100, progress));
      }

      const isWeightLoss = startWeight > targetWeight;
      const isCompleted = isWeightLoss ? latestWeight <= targetWeight : latestWeight >= targetWeight;

      // Only update rows where something is actually wrong to avoid unnecessary writes
      const currentValueWrong = Math.abs(parseFloat(goal.current_value) - latestWeight) > 0.05;
      const progressWrong = parseInt(goal.progress) !== progress;
      const completedWrong = !!goal.is_completed !== isCompleted;

      if (!currentValueWrong && !progressWrong && !completedWrong) { skipped++; continue; }

      await pool.query(
        `UPDATE goals
         SET current_value = $1, progress = $2, is_completed = $3,
             completed_at = CASE WHEN $3 = false THEN NULL ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [latestWeight, progress, isCompleted, goal.id]
      );
      repaired++;
    }

    console.log(`[startup-migration] bodyweight-goal-repair: repaired=${repaired} skipped=${skipped}`);
  } catch (e: any) {
    console.error("[startup-migration] bodyweight-goal-repair failed:", e?.message || e);
  }
}

/**
 * Production-only, one-time fix: recipes whose macros were stored as totals
 * instead of per-serving values.
 *
 * Guard: calories > 600 AND servings > 1 targets exactly the 70 affected rows
 * confirmed in prod. After dividing, calories will be ≤ 600 per serving, so
 * re-running this is a safe no-op. Dev recipes (already per-serving, ≤ 600)
 * are unaffected even if this somehow runs there.
 *
 * Only runs when NODE_ENV === 'production' so it never touches the dev DB.
 */
let hasRunBadgesV2 = false;

const BADGES_V2 = [
  // ONBOARDING (4)
  { name: "Welcome Aboard", description: "Complete your onboarding setup", category: "onboarding", tier: "bronze", icon: "🎉", requirement: JSON.stringify({ type: "achievement", metric: "onboarding_done", target: 1 }), sortOrder: 1 },
  { name: "First Check-In", description: "Complete your first daily check-in", category: "onboarding", tier: "bronze", icon: "✅", requirement: JSON.stringify({ type: "count", metric: "check_ins_total", target: 1 }), sortOrder: 2 },
  { name: "Profile Set", description: "Complete your profile with a photo and name", category: "onboarding", tier: "bronze", icon: "👤", requirement: JSON.stringify({ type: "achievement", metric: "profile_complete", target: 1 }), sortOrder: 3 },
  { name: "All Systems Go", description: "Set up a goal, a habit, and a supplement", category: "onboarding", tier: "silver", icon: "🚀", requirement: JSON.stringify({ type: "achievement", metric: "all_systems_go", target: 1 }), sortOrder: 4 },
  // BREATHWORK (9)
  { name: "First Breath", description: "Complete your first breathwork session", category: "breathwork", tier: "bronze", icon: "💨", requirement: JSON.stringify({ type: "count", metric: "breathwork_sessions", target: 1 }), sortOrder: 10 },
  { name: "Breath Seeker", description: "Complete 5 breathwork sessions", category: "breathwork", tier: "bronze", icon: "🌬️", requirement: JSON.stringify({ type: "count", metric: "breathwork_sessions", target: 5 }), sortOrder: 11 },
  { name: "Breath Warrior", description: "Complete 12 breathwork sessions", category: "breathwork", tier: "silver", icon: "💪", requirement: JSON.stringify({ type: "count", metric: "breathwork_sessions", target: 12 }), sortOrder: 12 },
  { name: "Breath Master", description: "Complete 25 breathwork sessions", category: "breathwork", tier: "gold", icon: "🔥", requirement: JSON.stringify({ type: "count", metric: "breathwork_sessions", target: 25 }), sortOrder: 13 },
  { name: "Breath Legend", description: "Complete 50 breathwork sessions", category: "breathwork", tier: "platinum", icon: "⚡", requirement: JSON.stringify({ type: "count", metric: "breathwork_sessions", target: 50 }), sortOrder: 14 },
  { name: "30 Mins Breathed", description: "Accumulate 30 minutes of breathwork", category: "breathwork", tier: "bronze", icon: "⏱️", requirement: JSON.stringify({ type: "duration", metric: "breathwork_minutes", target: 30 }), sortOrder: 15 },
  { name: "5 Hours Breathed", description: "Accumulate 5 hours of breathwork", category: "breathwork", tier: "silver", icon: "⌛", requirement: JSON.stringify({ type: "duration", metric: "breathwork_minutes", target: 300 }), sortOrder: 16 },
  { name: "25 Hours Breathed", description: "Accumulate 25 hours of breathwork", category: "breathwork", tier: "gold", icon: "🌟", requirement: JSON.stringify({ type: "duration", metric: "breathwork_minutes", target: 1500 }), sortOrder: 17 },
  { name: "50 Hours Breathed", description: "Accumulate 50 hours of breathwork", category: "breathwork", tier: "platinum", icon: "💎", requirement: JSON.stringify({ type: "duration", metric: "breathwork_minutes", target: 3000 }), sortOrder: 18 },
  // WORKOUT (9)
  { name: "First Workout", description: "Complete your first workout", category: "workout", tier: "bronze", icon: "🏋️", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 1 }), sortOrder: 20 },
  { name: "Getting Started", description: "Complete 10 workouts", category: "workout", tier: "bronze", icon: "🏃", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 10 }), sortOrder: 21 },
  { name: "Dedicated", description: "Complete 25 workouts", category: "workout", tier: "silver", icon: "💪", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 25 }), sortOrder: 22 },
  { name: "Committed", description: "Complete 50 workouts", category: "workout", tier: "silver", icon: "🎯", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 50 }), sortOrder: 23 },
  { name: "Century Club", description: "Complete 100 workouts", category: "workout", tier: "gold", icon: "💯", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 100 }), sortOrder: 24 },
  { name: "Iron Will", description: "Complete 200 workouts", category: "workout", tier: "gold", icon: "🔩", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 200 }), sortOrder: 25 },
  { name: "Unstoppable", description: "Complete 300 workouts", category: "workout", tier: "platinum", icon: "⚡", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 300 }), sortOrder: 26 },
  { name: "Legendary", description: "Complete 400 workouts", category: "workout", tier: "platinum", icon: "🏆", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 400 }), sortOrder: 27 },
  { name: "Elite Status", description: "Complete 500 workouts", category: "workout", tier: "platinum", icon: "💎", requirement: JSON.stringify({ type: "count", metric: "workouts", target: 500 }), sortOrder: 28 },
  // STRETCHING (5)
  { name: "First Stretch", description: "Complete your first stretching session", category: "stretching", tier: "bronze", icon: "🧘", requirement: JSON.stringify({ type: "count", metric: "stretching_workouts", target: 1 }), sortOrder: 30 },
  { name: "Flexibility Seeker", description: "Complete 5 stretching sessions", category: "stretching", tier: "bronze", icon: "🤸", requirement: JSON.stringify({ type: "count", metric: "stretching_workouts", target: 5 }), sortOrder: 31 },
  { name: "Limber Up", description: "Complete 10 stretching sessions", category: "stretching", tier: "silver", icon: "🌀", requirement: JSON.stringify({ type: "count", metric: "stretching_workouts", target: 10 }), sortOrder: 32 },
  { name: "Flexible", description: "Complete 20 stretching sessions", category: "stretching", tier: "gold", icon: "✨", requirement: JSON.stringify({ type: "count", metric: "stretching_workouts", target: 20 }), sortOrder: 33 },
  { name: "Mobility Master", description: "Complete 50 stretching sessions", category: "stretching", tier: "platinum", icon: "🏅", requirement: JSON.stringify({ type: "count", metric: "stretching_workouts", target: 50 }), sortOrder: 34 },
  // YOGA (5)
  { name: "First Flow", description: "Complete your first yoga session", category: "yoga", tier: "bronze", icon: "🧘", requirement: JSON.stringify({ type: "count", metric: "yoga_workouts", target: 1 }), sortOrder: 40 },
  { name: "Yoga Beginner", description: "Complete 5 yoga sessions", category: "yoga", tier: "bronze", icon: "🌿", requirement: JSON.stringify({ type: "count", metric: "yoga_workouts", target: 5 }), sortOrder: 41 },
  { name: "Yoga Regular", description: "Complete 15 yoga sessions", category: "yoga", tier: "silver", icon: "🌸", requirement: JSON.stringify({ type: "count", metric: "yoga_workouts", target: 15 }), sortOrder: 42 },
  { name: "Yoga Devotee", description: "Complete 30 yoga sessions", category: "yoga", tier: "gold", icon: "🌺", requirement: JSON.stringify({ type: "count", metric: "yoga_workouts", target: 30 }), sortOrder: 43 },
  { name: "Yoga Master", description: "Complete 60 yoga sessions", category: "yoga", tier: "platinum", icon: "💎", requirement: JSON.stringify({ type: "count", metric: "yoga_workouts", target: 60 }), sortOrder: 44 },
  // MEDITATION (5)
  { name: "First Sit", description: "Complete your first meditation session", category: "meditation", tier: "bronze", icon: "🕯️", requirement: JSON.stringify({ type: "count", metric: "meditation_sessions", target: 1 }), sortOrder: 50 },
  { name: "Mindful Start", description: "Complete 5 meditation sessions", category: "meditation", tier: "bronze", icon: "🌙", requirement: JSON.stringify({ type: "count", metric: "meditation_sessions", target: 5 }), sortOrder: 51 },
  { name: "Present Mind", description: "Complete 15 meditation sessions", category: "meditation", tier: "silver", icon: "☯️", requirement: JSON.stringify({ type: "count", metric: "meditation_sessions", target: 15 }), sortOrder: 52 },
  { name: "Deep Practice", description: "Complete 30 meditation sessions", category: "meditation", tier: "gold", icon: "🔮", requirement: JSON.stringify({ type: "count", metric: "meditation_sessions", target: 30 }), sortOrder: 53 },
  { name: "Meditation Master", description: "Complete 60 meditation sessions", category: "meditation", tier: "platinum", icon: "💎", requirement: JSON.stringify({ type: "count", metric: "meditation_sessions", target: 60 }), sortOrder: 54 },
  // NUTRITION (8)
  { name: "First Meal Logged", description: "Log your first meal", category: "nutrition", tier: "bronze", icon: "🥗", requirement: JSON.stringify({ type: "count", metric: "food_logs_total", target: 1 }), sortOrder: 60 },
  { name: "First Scan", description: "Log a food item via barcode scan", category: "nutrition", tier: "bronze", icon: "📷", requirement: JSON.stringify({ type: "count", metric: "barcode_scans", target: 1 }), sortOrder: 61 },
  { name: "Macro Tracker", description: "Log food for 7 consecutive days", category: "nutrition", tier: "silver", icon: "📊", requirement: JSON.stringify({ type: "streak", metric: "nutrition_log_streak", target: 7 }), sortOrder: 62 },
  { name: "Nutrition Devotee", description: "Log food for 30 consecutive days", category: "nutrition", tier: "gold", icon: "🌱", requirement: JSON.stringify({ type: "streak", metric: "nutrition_log_streak", target: 30 }), sortOrder: 63 },
  { name: "Protein Hitter", description: "Hit your protein target 7 days in a row", category: "nutrition", tier: "silver", icon: "💪", requirement: JSON.stringify({ type: "streak", metric: "protein_target_streak", target: 7 }), sortOrder: 64 },
  { name: "Hydration Habit", description: "Hit your hydration goal 7 days in a row", category: "nutrition", tier: "silver", icon: "💧", requirement: JSON.stringify({ type: "streak", metric: "hydration_streak", target: 7 }), sortOrder: 65 },
  { name: "Stay Hydrated", description: "Hit your hydration goal 30 days in a row", category: "nutrition", tier: "gold", icon: "🌊", requirement: JSON.stringify({ type: "streak", metric: "hydration_streak", target: 30 }), sortOrder: 66 },
  { name: "Recipe Saver", description: "Save your first recipe", category: "nutrition", tier: "bronze", icon: "📌", requirement: JSON.stringify({ type: "count", metric: "recipes_saved", target: 1 }), sortOrder: 67 },
  // SLEEP (4)
  { name: "Rested", description: "Average 7+ hours of sleep over 7 days", category: "sleep", tier: "silver", icon: "😴", requirement: JSON.stringify({ type: "achievement", metric: "sleep_avg_7day_hours_7", target: 1 }), sortOrder: 70 },
  { name: "Sleep Champion", description: "Average 7+ hours of sleep over 30 days", category: "sleep", tier: "gold", icon: "🛌", requirement: JSON.stringify({ type: "achievement", metric: "sleep_avg_30day_hours_7", target: 1 }), sortOrder: 71 },
  { name: "Quality Sleeper", description: "Achieve a sleep score of 80+ for 5 nights in a row", category: "sleep", tier: "silver", icon: "⭐", requirement: JSON.stringify({ type: "streak", metric: "sleep_score_streak_80", target: 5 }), sortOrder: 72 },
  { name: "Sleep Pro", description: "Achieve a sleep score of 80+ for 30 nights in a row", category: "sleep", tier: "gold", icon: "🌙", requirement: JSON.stringify({ type: "streak", metric: "sleep_score_streak_80", target: 30 }), sortOrder: 73 },
  // HABITS (5)
  { name: "First Habit", description: "Start your first habit", category: "habits", tier: "bronze", icon: "📋", requirement: JSON.stringify({ type: "count", metric: "habits_total", target: 1 }), sortOrder: 80 },
  { name: "Habit Builder", description: "Complete a 21-day habit cycle", category: "habits", tier: "silver", icon: "🔨", requirement: JSON.stringify({ type: "count", metric: "habit_cycles_21", target: 1 }), sortOrder: 81 },
  { name: "Habit Master", description: "Complete a 60-day habit cycle", category: "habits", tier: "gold", icon: "🎯", requirement: JSON.stringify({ type: "count", metric: "habit_cycles_60", target: 1 }), sortOrder: 82 },
  { name: "Multi-Tasker", description: "Maintain 3+ habits for 7 consecutive days", category: "habits", tier: "silver", icon: "⚙️", requirement: JSON.stringify({ type: "achievement", metric: "habits_concurrent_3_7days", target: 7 }), sortOrder: 83 },
  { name: "Habit Hero", description: "Complete 5 total habit cycles", category: "habits", tier: "gold", icon: "🦸", requirement: JSON.stringify({ type: "count", metric: "habit_cycles_total", target: 5 }), sortOrder: 84 },
  // CHECK-IN (5)
  { name: "Week Strong", description: "Check in for 7 consecutive days", category: "checkin", tier: "bronze", icon: "📅", requirement: JSON.stringify({ type: "streak", metric: "check_in_streak", target: 7 }), sortOrder: 90 },
  { name: "Two Weeks Solid", description: "Check in for 14 consecutive days", category: "checkin", tier: "silver", icon: "🗓️", requirement: JSON.stringify({ type: "streak", metric: "check_in_streak", target: 14 }), sortOrder: 91 },
  { name: "Month In", description: "Check in for 30 consecutive days", category: "checkin", tier: "gold", icon: "📆", requirement: JSON.stringify({ type: "streak", metric: "check_in_streak", target: 30 }), sortOrder: 92 },
  { name: "100 Days Aware", description: "Check in for 100 consecutive days", category: "checkin", tier: "platinum", icon: "🔮", requirement: JSON.stringify({ type: "streak", metric: "check_in_streak", target: 100 }), sortOrder: 93 },
  { name: "Year of Awareness", description: "Check in for 365 consecutive days", category: "checkin", tier: "platinum", icon: "💎", requirement: JSON.stringify({ type: "streak", metric: "check_in_streak", target: 365 }), sortOrder: 94 },
  // PROGRAMME (5)
  { name: "First Enrollment", description: "Enrol in your first programme", category: "programme", tier: "bronze", icon: "📝", requirement: JSON.stringify({ type: "count", metric: "programme_enrollments", target: 1 }), sortOrder: 100 },
  { name: "Programme Graduate", description: "Complete your first programme", category: "programme", tier: "silver", icon: "🎓", requirement: JSON.stringify({ type: "count", metric: "programmes_completed", target: 1 }), sortOrder: 101 },
  { name: "Serial Finisher", description: "Complete 5 programmes", category: "programme", tier: "gold", icon: "🏅", requirement: JSON.stringify({ type: "count", metric: "programmes_completed", target: 5 }), sortOrder: 102 },
  { name: "Perfect Record", description: "Complete every programme you've enrolled in (minimum 3)", category: "programme", tier: "platinum", icon: "💫", requirement: JSON.stringify({ type: "achievement", metric: "programme_perfect_record", target: 1 }), sortOrder: 103 },
  { name: "Programme Legend", description: "Complete 10 programmes", category: "programme", tier: "platinum", icon: "🏆", requirement: JSON.stringify({ type: "count", metric: "programmes_completed", target: 10 }), sortOrder: 104 },
  // LEARNING (7)
  { name: "First Lesson", description: "Watch your first educational video", category: "learning", tier: "bronze", icon: "📚", requirement: JSON.stringify({ type: "count", metric: "videos_watched", target: 1 }), sortOrder: 110 },
  { name: "Curious Mind", description: "Watch 5 educational videos", category: "learning", tier: "bronze", icon: "🔍", requirement: JSON.stringify({ type: "count", metric: "videos_watched", target: 5 }), sortOrder: 111 },
  { name: "Knowledge Seeker", description: "Watch 15 educational videos", category: "learning", tier: "silver", icon: "🧠", requirement: JSON.stringify({ type: "count", metric: "videos_watched", target: 15 }), sortOrder: 112 },
  { name: "Scholar", description: "Watch 30 educational videos", category: "learning", tier: "gold", icon: "🎓", requirement: JSON.stringify({ type: "count", metric: "videos_watched", target: 30 }), sortOrder: 113 },
  { name: "Path Finder", description: "Complete your first learning path", category: "learning", tier: "silver", icon: "🗺️", requirement: JSON.stringify({ type: "count", metric: "learning_paths_completed", target: 1 }), sortOrder: 114 },
  { name: "Path Master", description: "Complete 5 learning paths", category: "learning", tier: "gold", icon: "🌐", requirement: JSON.stringify({ type: "count", metric: "learning_paths_completed", target: 5 }), sortOrder: 115 },
  { name: "Bookmark Collector", description: "Save 10 bookmarks", category: "learning", tier: "bronze", icon: "🔖", requirement: JSON.stringify({ type: "count", metric: "bookmarks_count", target: 10 }), sortOrder: 116 },
  // GOALS (6)
  { name: "Goal Getter", description: "Achieve a bodyweight or custom goal", category: "goals", tier: "silver", icon: "🎯", requirement: JSON.stringify({ type: "achievement", metric: "bodyweight_goal_achieved", target: 1 }), sortOrder: 120 },
  { name: "Clean Slate", description: "Log 30 consecutive alcohol-free days", category: "goals", tier: "gold", icon: "🥂", requirement: JSON.stringify({ type: "streak", metric: "alcohol_free_streak", target: 30 }), sortOrder: 121 },
  { name: "Big Picture", description: "Complete your first goal", category: "goals", tier: "gold", icon: "🖼️", requirement: JSON.stringify({ type: "count", metric: "goals_completed", target: 1 }), sortOrder: 122 },
  { name: "Nutrition Goal", description: "Log food for 14 consecutive days", category: "goals", tier: "gold", icon: "🥦", requirement: JSON.stringify({ type: "streak", metric: "nutrition_log_streak", target: 14 }), sortOrder: 123 },
  { name: "Well Rested", description: "Average 7+ hours of sleep over 42 days", category: "goals", tier: "platinum", icon: "🌙", requirement: JSON.stringify({ type: "achievement", metric: "sleep_avg_42day_hours_7", target: 1 }), sortOrder: 124 },
  { name: "Consistent Effort", description: "Complete 3 goals", category: "goals", tier: "silver", icon: "✅", requirement: JSON.stringify({ type: "count", metric: "goals_completed", target: 3 }), sortOrder: 125 },
  // DESK HEALTH (4)
  { name: "Desk Detective", description: "Complete your first desk scan", category: "desk", tier: "bronze", icon: "🖥️", requirement: JSON.stringify({ type: "count", metric: "desk_scans", target: 1 }), sortOrder: 130 },
  { name: "Schedule Set", description: "Set up your workday profile", category: "desk", tier: "bronze", icon: "⏰", requirement: JSON.stringify({ type: "achievement", metric: "workday_setup_done", target: 1 }), sortOrder: 131 },
  // BODY MAP (5)
  { name: "First Assessment", description: "Log your first body map entry", category: "bodymap", tier: "bronze", icon: "🗺️", requirement: JSON.stringify({ type: "count", metric: "body_map_assessments", target: 1 }), sortOrder: 140 },
  { name: "Body Aware", description: "Log 5 body map entries", category: "bodymap", tier: "silver", icon: "👁️", requirement: JSON.stringify({ type: "count", metric: "body_map_assessments", target: 5 }), sortOrder: 141 },
  { name: "Recovery Champion", description: "Accept your first recovery plan", category: "bodymap", tier: "silver", icon: "🏥", requirement: JSON.stringify({ type: "count", metric: "recovery_plans_completed", target: 1 }), sortOrder: 142 },
  { name: "On the Mend", description: "Reduce pain severity in a logged area", category: "bodymap", tier: "gold", icon: "💚", requirement: JSON.stringify({ type: "achievement", metric: "pain_score_reduced", target: 1 }), sortOrder: 143 },
  { name: "Recovery Master", description: "Accept 5 recovery plans", category: "bodymap", tier: "gold", icon: "🔬", requirement: JSON.stringify({ type: "count", metric: "recovery_plans_completed", target: 5 }), sortOrder: 144 },
  // BURNOUT (4)
  { name: "Self-Aware", description: "Generate your first burnout score", category: "burnout", tier: "bronze", icon: "🧩", requirement: JSON.stringify({ type: "count", metric: "burnout_scores_count", target: 1 }), sortOrder: 150 },
  { name: "In the Green", description: "Maintain a low burnout score for 14 days", category: "burnout", tier: "silver", icon: "🌿", requirement: JSON.stringify({ type: "streak", metric: "burnout_lowest_tier_days", target: 14 }), sortOrder: 151 },
  { name: "Bounce Back", description: "Recover from a high burnout score to low", category: "burnout", tier: "gold", icon: "🌅", requirement: JSON.stringify({ type: "achievement", metric: "burnout_bounced_back", target: 1 }), sortOrder: 152 },
  { name: "Steady State", description: "Maintain a low burnout score for 60 days", category: "burnout", tier: "platinum", icon: "🏔️", requirement: JSON.stringify({ type: "streak", metric: "burnout_lowest_tier_days", target: 60 }), sortOrder: 153 },
  // STREAK (3)
  { name: "Week Warrior", description: "Maintain a 7-day activity streak", category: "streak", tier: "bronze", icon: "⚔️", requirement: JSON.stringify({ type: "streak", metric: "activity_streak", target: 7 }), sortOrder: 160 },
  { name: "Monthly Marvel", description: "Maintain a 30-day activity streak", category: "streak", tier: "gold", icon: "🌟", requirement: JSON.stringify({ type: "streak", metric: "activity_streak", target: 30 }), sortOrder: 161 },
  { name: "Century Streak", description: "Maintain a 100-day activity streak", category: "streak", tier: "platinum", icon: "💯", requirement: JSON.stringify({ type: "streak", metric: "activity_streak", target: 100 }), sortOrder: 162 },
  // SUPPLEMENT (4)
  { name: "First Stack", description: "Add your first supplement", category: "supplement", tier: "bronze", icon: "💊", requirement: JSON.stringify({ type: "count", metric: "supplements_total", target: 1 }), sortOrder: 170 },
  { name: "Supplement Starter", description: "Take supplements for 7 consecutive days", category: "supplement", tier: "bronze", icon: "🌿", requirement: JSON.stringify({ type: "streak", metric: "supplement_streak", target: 7 }), sortOrder: 171 },
  { name: "Supplement Devotee", description: "Take supplements for 14 consecutive days", category: "supplement", tier: "silver", icon: "🔬", requirement: JSON.stringify({ type: "streak", metric: "supplement_streak", target: 14 }), sortOrder: 172 },
  { name: "Supplement Master", description: "Take supplements for 30 consecutive days", category: "supplement", tier: "gold", icon: "💉", requirement: JSON.stringify({ type: "streak", metric: "supplement_streak", target: 30 }), sortOrder: 173 },
  // AI (6)
  { name: "AI Curious", description: "Send your first message to the AI coach", category: "ai", tier: "bronze", icon: "🤖", requirement: JSON.stringify({ type: "count", metric: "ai_coach_messages", target: 1 }), sortOrder: 180 },
  { name: "AI Regular", description: "Send 10 messages to the AI coach", category: "ai", tier: "silver", icon: "💬", requirement: JSON.stringify({ type: "count", metric: "ai_coach_messages", target: 10 }), sortOrder: 181 },
  { name: "AI Power User", description: "Send 50 messages to the AI coach", category: "ai", tier: "gold", icon: "⚡", requirement: JSON.stringify({ type: "count", metric: "ai_coach_messages", target: 50 }), sortOrder: 182 },
  { name: "First AI Recipe", description: "Generate your first AI recipe", category: "ai", tier: "bronze", icon: "🍽️", requirement: JSON.stringify({ type: "count", metric: "ai_recipes_created", target: 1 }), sortOrder: 183 },
  { name: "Recipe Inventor", description: "Generate 10 AI recipes", category: "ai", tier: "silver", icon: "👨‍🍳", requirement: JSON.stringify({ type: "count", metric: "ai_recipes_created", target: 10 }), sortOrder: 184 },
  { name: "AI Insights", description: "Read 5 AI-generated insights", category: "ai", tier: "bronze", icon: "💡", requirement: JSON.stringify({ type: "count", metric: "ai_insight_reads", target: 5 }), sortOrder: 185 },
  // DAILY READINESS (7)
  { name: "Peak State", description: "Hit Peak (85+) readiness for 3 days in a row", category: "readiness", tier: "bronze", icon: "⚡", requirement: JSON.stringify({ type: "streak", metric: "readiness_peak_streak", target: 3 }), sortOrder: 190 },
  { name: "Locked In", description: "7 days in a row at Peak readiness", category: "readiness", tier: "silver", icon: "🔥", requirement: JSON.stringify({ type: "streak", metric: "readiness_peak_streak", target: 7 }), sortOrder: 191 },
  { name: "In the Zone", description: "14 days in a row at Peak readiness", category: "readiness", tier: "gold", icon: "🚀", requirement: JSON.stringify({ type: "streak", metric: "readiness_peak_streak", target: 14 }), sortOrder: 192 },
  { name: "Untouchable", description: "30 days in a row at Peak readiness", category: "readiness", tier: "platinum", icon: "👑", requirement: JSON.stringify({ type: "streak", metric: "readiness_peak_streak", target: 30 }), sortOrder: 193 },
  { name: "Peak Performer", description: "Reached Peak readiness 10 times", category: "readiness", tier: "bronze", icon: "⭐", requirement: JSON.stringify({ type: "count", metric: "readiness_peak_days", target: 10 }), sortOrder: 194 },
  { name: "Pillar of Health", description: "Reached Peak readiness 50 times", category: "readiness", tier: "gold", icon: "💎", requirement: JSON.stringify({ type: "count", metric: "readiness_peak_days", target: 50 }), sortOrder: 195 },
  { name: "Perfect Day", description: "Scored a perfect 100 on Daily Readiness", category: "readiness", tier: "platinum", icon: "💯", requirement: JSON.stringify({ type: "count", metric: "readiness_perfect_days", target: 1 }), sortOrder: 196 },
];

export async function seedBadgesV2Once(): Promise<void> {
  if (hasRunBadgesV2) return;
  hasRunBadgesV2 = true;

  try {
    // Sentinel: fully seeded when current collection has >= 97 active badges.
    // Name-based checks are fragile (a stray legacy row can match); count is robust.
    const sentinel = await pool.query(
      `SELECT COUNT(*)::int AS c FROM badges WHERE collection = 'current' AND is_active = true`
    );
    if (Number(sentinel.rows[0]?.c) >= 97) {
      console.log("[startup-migration] badges-v2: already seeded, skipping");
      return;
    }

    // Retire all active current badges to legacy (preserves user_badges FK references)
    await pool.query(
      `UPDATE badges SET is_active = false, collection = 'legacy' WHERE collection = 'current' AND is_active = true`
    );

    // Sync the serial sequence to avoid PK collisions with existing legacy rows
    await pool.query(
      `SELECT setval('badges_id_seq', COALESCE((SELECT MAX(id) FROM badges), 0))`
    );

    // Insert all v2 badges
    for (const b of BADGES_V2) {
      await pool.query(
        `INSERT INTO badges (name, description, category, tier, icon, requirement, collection, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'current', $7, true)`,
        [b.name, b.description, b.category, b.tier, b.icon, b.requirement, b.sortOrder]
      );
    }

    console.log(`[startup-migration] badges-v2: seeded ${BADGES_V2.length} badges`);
  } catch (e: any) {
    console.error("[startup-migration] badges-v2 failed:", e?.message || e);
  }
}

// One-shot retirement of dropped desk badges (Stand Up, Movement Marshal).
// Idempotent — safe to leave in place. Retires to legacy collection so any
// existing user_badges FK references are preserved.
let hasRunRetireDeskBadges = false;
export async function retireDroppedDeskBadgesOnce(): Promise<void> {
  if (hasRunRetireDeskBadges) return;
  hasRunRetireDeskBadges = true;
  try {
    const result = await pool.query(
      `UPDATE badges SET is_active = false, collection = 'legacy'
       WHERE name IN ('Stand Up', 'Movement Marshal')
         AND collection = 'current'`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[startup-migration] retire-desk-badges: retired ${result.rowCount} badges`);
    }
  } catch (e: any) {
    console.error("[startup-migration] retire-desk-badges failed:", e?.message || e);
  }
}

let hasRunReadinessBadges = false;
export async function seedReadinessBadgesOnce(): Promise<void> {
  if (hasRunReadinessBadges) return;
  hasRunReadinessBadges = true;

  try {
    const existing = await pool.query(
      `SELECT COUNT(*)::int AS c FROM badges WHERE category = 'readiness' AND collection = 'current' AND is_active = true`
    );
    if (Number(existing.rows[0]?.c) >= 7) {
      console.log("[startup-migration] readiness-badges: already seeded, skipping");
      return;
    }

    const readinessBadges = BADGES_V2.filter(b => b.category === 'readiness');
    for (const b of readinessBadges) {
      await pool.query(
        `INSERT INTO badges (name, description, category, tier, icon, requirement, collection, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'current', $7, true)
         ON CONFLICT DO NOTHING`,
        [b.name, b.description, b.category, b.tier, b.icon, b.requirement, b.sortOrder]
      );
    }
    console.log(`[startup-migration] readiness-badges: seeded ${readinessBadges.length} badges`);
  } catch (e: any) {
    console.error("[startup-migration] readiness-badges failed:", e?.message || e);
  }
}

export async function fixHabitTemplateDescriptionsOnce(): Promise<void> {
  try {
    const stepsDesc = `Steps are the foundation of what is known as NEAT, or non-exercise activity thermogenesis. This is the energy your body burns through everything you do outside of formal training, and for most people it accounts for more daily calorie expenditure than their workouts.\n\n  Beyond fat loss, consistent walking improves cardiovascular health, regulates blood sugar, supports recovery, and meaningfully reduces all-cause mortality.\n\n  For anyone with a desk-bound role, it is one of the highest-leverage habits available. You set your own daily target based on your lifestyle and goals, and the benefits come from consistency over weeks and months.`;
    const stepsShort = `Daily steps are one of the most effective and accessible levers for cardiovascular health, body composition, and sustained energy.`;
    const hydrationDesc = `Hydration is one of the simplest performance levers available, and one of the most consistently neglected. By the time you feel thirsty, your body is already mildly dehydrated, and at that level cognitive function, focus, mood, and physical output are already measurably reduced.\n\n  Adequate intake supports circulation, temperature regulation, digestion, and brain function. It also reduces the headaches and afternoon energy dips that many people attribute to workload or stress.\n\n  For most adults, two to three litres a day is a sensible baseline, with more needed in hot weather, during hard training, or after travel. You set your own daily target in the app and track your intake against it.`;
    const hydrationShort = `Even mild dehydration impairs cognitive function, focus, and physical performance, often before you feel thirsty.`;

    // Update habit_templates
    await pool.query(
      `UPDATE habit_templates SET description = $1, short_description = $2
       WHERE id = 2 AND (description IS DISTINCT FROM $1 OR short_description IS DISTINCT FROM $2)`,
      [stepsDesc, stepsShort]
    );
    await pool.query(
      `UPDATE habit_templates SET description = $1, short_description = $2
       WHERE id = 36 AND (description IS DISTINCT FROM $1 OR short_description IS DISTINCT FROM $2)`,
      [hydrationDesc, hydrationShort]
    );

    // Also update any existing user habits copied from these templates (description is copied at enrolment)
    await pool.query(
      `UPDATE habits SET description = $1
       WHERE template_id = 2 AND description IS DISTINCT FROM $1`,
      [stepsDesc]
    );
    await pool.query(
      `UPDATE habits SET description = $1
       WHERE template_id = 36 AND description IS DISTINCT FROM $1`,
      [hydrationDesc]
    );

    console.log("[startup-migration] habit-template-descriptions: updated templates and user habits");
  } catch (e: any) {
    console.error("[startup-migration] habit-template-descriptions failed:", e?.message || e);
  }
}

/**
 * One-time deduplication: removes older duplicate check-ins (keeps newest per
 * user per calendar day) and enforces the constraint at the DB level with a
 * unique index. Safe to run repeatedly — the index creation is IF NOT EXISTS
 * and the delete CTE is a no-op when no duplicates exist.
 */
export async function dedupeCheckInsOnce(): Promise<void> {
  if (hasRunDedupeCheckIns) return;
  hasRunDedupeCheckIns = true;

  try {
    // Delete duplicates: keep only the row with the highest created_at per user+day
    const del = await pool.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY user_id, DATE(check_in_date) ORDER BY created_at DESC) AS rn
        FROM check_ins
      )
      DELETE FROM check_ins
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `);
    if ((del.rowCount ?? 0) > 0) {
      console.log(`[startup-migration] dedupe-check-ins: removed ${del.rowCount} duplicate rows`);
    }

    // Create the unique index to prevent future duplicates
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS check_ins_user_day_unique
        ON check_ins (user_id, DATE(check_in_date))
    `);
    console.log(`[startup-migration] dedupe-check-ins: unique index check_ins_user_day_unique ensured`);
  } catch (e: any) {
    console.error("[startup-migration] dedupe-check-ins failed:", e?.message || e);
  }
}

export async function normalizeRecipeMacrosOnce(): Promise<void> {
  if (hasRunRecipeMacrosNormalize) return;
  hasRunRecipeMacrosNormalize = true;

  if (process.env.NODE_ENV !== "production") {
    console.log("[startup-migration] recipe-macros-normalize: skipped (not production)");
    return;
  }

  try {
    const result = await pool.query(`
      UPDATE recipes
      SET
        calories = ROUND(calories::numeric / servings),
        protein  = ROUND(protein::numeric  / servings),
        carbs    = ROUND(carbs::numeric    / servings),
        fat      = ROUND(fat::numeric      / servings)
      WHERE servings > 1
        AND calories > 600
    `);
    console.log(`[startup-migration] recipe-macros-normalize: updated ${result.rowCount} recipes`);
  } catch (e: any) {
    console.error("[startup-migration] recipe-macros-normalize failed:", e?.message || e);
  }
}

