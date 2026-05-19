import { storage } from "./storage";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";

let hasRunProfileImages = false;
let hasRunMeditationSeed = false;
let hasRunSchemaSelfHeal = false;
let hasRunBodyweightGoalUnitRepair = false;

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
    promptBody: "Build a 4-week strength programme for a busy executive who can train 3 days per week in a full gym. Compound lifts, balanced upper/lower split, progressive overload.",
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
