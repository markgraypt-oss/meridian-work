import { storage } from "./storage";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

let hasRunProfileImages = false;
let hasRunMeditationSeed = false;
let hasRunSchemaSelfHeal = false;
let hasRunBodyweightGoalUnitRepair = false;
let hasRunRecipeMacrosNormalize = false;
let hasRunDedupeCheckIns = false;
let hasRunLabTopicCovers = false;
let hasRunLabPathCovers = false;

/**
 * Idempotent self-heal for schema columns that the app needs but that may not
 * have been applied to production yet via the Publish-time schema diff.
 * Each statement uses IF NOT EXISTS so it's safe to run on every boot.
 */
const SELF_HEAL_DDL: string[] = [
  // Admin report settings: table + anonymity-floor columns. This table was
  // never added to the self-heal, so create-if-missing here, then ensure the
  // min_active_users column exists on already-created tables.
  `CREATE TABLE IF NOT EXISTS report_settings (
     id serial PRIMARY KEY,
     company_name varchar,
     min_cohort_size integer NOT NULL DEFAULT 5,
     min_active_users integer NOT NULL DEFAULT 10,
     severity_threshold integer NOT NULL DEFAULT 4,
     trend_threshold real NOT NULL DEFAULT 0.2,
     burnout_bands jsonb NOT NULL DEFAULT '[20,40,60,80]'::jsonb,
     narrative_max_age_minutes integer NOT NULL DEFAULT 60,
     updated_at timestamp DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_report_settings_company ON report_settings (company_name)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_report_settings_global_singleton ON report_settings (company_name) WHERE company_name IS NULL`,
  `ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS min_active_users integer NOT NULL DEFAULT 10`,

  // Coach access consent (client grants/revokes a coach's read access).
  `CREATE TABLE IF NOT EXISTS coach_access_requests (
     id serial PRIMARY KEY,
     client_user_id varchar NOT NULL,
     coach_user_id varchar,
     status text NOT NULL DEFAULT 'pending',
     requested_at timestamp DEFAULT now(),
     responded_at timestamp
   )`,
  // Reconcile columns in case an OLDER coach_access_requests table already exists
  // in this database (e.g. from the retired layout) with a different shape — the
  // CREATE above is a no-op then, so bring every column the code selects up to
  // date. All nullable (no NOT NULL) so they apply even to a table with rows.
  `ALTER TABLE coach_access_requests ADD COLUMN IF NOT EXISTS client_user_id varchar`,
  `ALTER TABLE coach_access_requests ADD COLUMN IF NOT EXISTS coach_user_id varchar`,
  `ALTER TABLE coach_access_requests ADD COLUMN IF NOT EXISTS status text`,
  `ALTER TABLE coach_access_requests ALTER COLUMN status SET DEFAULT 'pending'`,
  `ALTER TABLE coach_access_requests ADD COLUMN IF NOT EXISTS requested_at timestamp DEFAULT now()`,
  `ALTER TABLE coach_access_requests ADD COLUMN IF NOT EXISTS responded_at timestamp`,
  `CREATE INDEX IF NOT EXISTS coach_access_client_idx ON coach_access_requests (client_user_id)`,

  // workday rotation: pause-without-remove
  `ALTER TABLE workday_user_profiles ADD COLUMN IF NOT EXISTS active_positions text[]`,
  `ALTER TABLE habits ADD COLUMN IF NOT EXISTS reminder_timezone_offset integer`,
  `ALTER TABLE coach_briefings ADD COLUMN IF NOT EXISTS conversation_id integer`,
  `ALTER TABLE meditations ADD COLUMN IF NOT EXISTS cover_image_url text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_seen_at timestamp`,

  // Private client programmes: library visibility + client role
  `ALTER TABLE programs ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'`,
  // Client programme management: record when an enrollment finished / was ended early
  `ALTER TABLE user_program_enrollments ADD COLUMN IF NOT EXISTS completed_at timestamp`,
  // AI programme review: cached coach review/feedback for the enrolled programme
  `ALTER TABLE user_program_enrollments ADD COLUMN IF NOT EXISTS review jsonb`,
  // Soft-delete for programmes that have client history (kept, just hidden)
  `ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`,

  // Coach chat education recommendations (tappable video/path cards)
  `CREATE TABLE IF NOT EXISTS coach_recommendations (
     id serial PRIMARY KEY,
     user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     item_type text NOT NULL,
     item_id integer NOT NULL,
     source text NOT NULL DEFAULT 'chat',
     shown_at timestamp DEFAULT now(),
     tapped_at timestamp
   )`,
  `CREATE INDEX IF NOT EXISTS idx_coach_recommendations_user ON coach_recommendations (user_id, shown_at)`,

  // Universal coach recommendations: item_type widens to any domain key,
  // slug/action recs use item_key (item_id becomes nullable), route stores
  // the resolved deep link for analytics.
  `ALTER TABLE coach_recommendations ADD COLUMN IF NOT EXISTS item_key text`,
  `ALTER TABLE coach_recommendations ADD COLUMN IF NOT EXISTS route text`,
  `ALTER TABLE coach_recommendations ALTER COLUMN item_id DROP NOT NULL`,

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
  `ALTER TABLE burnout_settings ADD COLUMN IF NOT EXISTS recovery_mode_report_seen_at timestamp`,
  `ALTER TABLE burnout_settings ADD COLUMN IF NOT EXISTS suggestion_dismissed_at timestamp`,
  `CREATE TABLE IF NOT EXISTS recovery_mode_periods (
    id serial PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at timestamp NOT NULL,
    scheduled_end_at timestamp NOT NULL,
    ended_at timestamp,
    end_reason varchar,
    score_at_start integer,
    tier_at_start varchar,
    created_at timestamp DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS recovery_mode_periods_user_started_idx ON recovery_mode_periods (user_id, started_at DESC)`,

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
  `ALTER TABLE daily_readiness_history ADD COLUMN IF NOT EXISTS sleep_raw real`,
  `ALTER TABLE daily_readiness_history ADD COLUMN IF NOT EXISTS energy_raw real`,
  `ALTER TABLE daily_readiness_history ADD COLUMN IF NOT EXISTS hrv_raw real`,
  `ALTER TABLE daily_readiness_history ADD COLUMN IF NOT EXISTS rhr_raw real`,
  `ALTER TABLE daily_readiness_history ADD COLUMN IF NOT EXISTS training_load_raw real`,

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

  // Location columns on users table — drive the weather block inside coach
  // briefings. Permission status tracks whether we have asked yet, so the
  // mobile app can show a one-time soft re-prompt after an initial decline
  // and never ask again after the second no.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat double precision`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng double precision`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_permission_status text DEFAULT 'never_asked'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone varchar`,

  // Custom check-in questions — user-defined Y/N questions for daily check-in
  `CREATE TABLE IF NOT EXISTS custom_check_in_questions (id SERIAL PRIMARY KEY, user_id VARCHAR NOT NULL REFERENCES users(id), label TEXT NOT NULL, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`,
  `ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS custom_responses JSONB`,

  // Physiological baselines table — ensure it exists before adding columns
  `CREATE TABLE IF NOT EXISTS user_physiological_baselines (id SERIAL PRIMARY KEY, user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE, hrv_baseline_ms REAL, hrv_std_dev_ms REAL, hrv_sample_count INTEGER NOT NULL DEFAULT 0, rhr_baseline_bpm REAL, rhr_std_dev_bpm REAL, rhr_sample_count INTEGER NOT NULL DEFAULT 0, sleep_duration_baseline_minutes REAL, sleep_duration_std_dev_minutes REAL, sleep_duration_sample_count INTEGER NOT NULL DEFAULT 0, is_calibrated BOOLEAN NOT NULL DEFAULT false, calibration_started_at TIMESTAMP, calibration_completed_at TIMESTAMP, days_until_calibrated INTEGER, last_computed_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,

  // Activity baselines — personalised training-load scoring
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS steps_baseline real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS steps_std_dev real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS steps_sample_count integer NOT NULL DEFAULT 0`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS active_minutes_baseline real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS active_minutes_std_dev real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS active_minutes_sample_count integer NOT NULL DEFAULT 0`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS calories_burned_baseline real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS calories_burned_std_dev real`,
  `ALTER TABLE user_physiological_baselines ADD COLUMN IF NOT EXISTS calories_burned_sample_count integer NOT NULL DEFAULT 0`,

  // Cycle tracker — private, opt-in, per-user only. Never surfaced in
  // company reports. Tables required by /api/cycle/* routes.
  `CREATE TABLE IF NOT EXISTS cycle_settings (
    id serial PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    avg_cycle_length integer NOT NULL DEFAULT 28,
    avg_period_length integer NOT NULL DEFAULT 5,
    updated_at timestamp DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cycle_settings_user_idx ON cycle_settings (user_id)`,
  `CREATE TABLE IF NOT EXISTS cycle_logs (
    id serial PRIMARY KEY,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start text NOT NULL,
    period_end text,
    flow varchar,
    symptoms text[],
    notes text,
    created_at timestamp DEFAULT NOW(),
    updated_at timestamp DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS cycle_logs_user_start_idx ON cycle_logs (user_id, period_start DESC)`,

  // Wearable connections: one row per (user, provider), enforced. The connect
  // flow was select-then-insert, so concurrent calls could create duplicate
  // rows — a zombie duplicate with dead tokens then fails refreshes forever
  // while the real row works, poisoning the UI and webhook lookups. Dedupe
  // (keep the newest row) then enforce uniqueness. Both statements are
  // idempotent — the DELETE removes nothing when there are no duplicates.
  `DELETE FROM wearable_connections a USING wearable_connections b
     WHERE a.user_id = b.user_id AND a.provider = b.provider AND a.id < b.id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wearable_connections_user_provider_uq
     ON wearable_connections (user_id, provider)`,
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
/**
 * Reconcile breathwork technique defaults so the advertised duration in the
 * hero card (default_duration_minutes) matches what default_rounds actually
 * produces (cycle seconds x rounds). Every seeded technique disagreed with
 * itself (e.g. Energizing Breath: "3 min" header, 20 rounds = ~40s). Where the
 * practice has a canonical prescription the rounds are kept and the label
 * corrected (4-7-8 = 4 cycles, Wim Hof = 30 breaths, one bhastrika round = 20
 * breaths); otherwise rounds are raised to honour the advertised time. NSDR and
 * Coherent are capped by the app's 50-round picker. Guarded per-slug on the
 * seeded breath pattern so admin-edited patterns are left untouched. Safe to
 * run repeatedly (IS DISTINCT FROM no-ops).
 */
export async function reconcileBreathworkDurationsOnce(): Promise<void> {
  // [slug, inhale, holdIn, exhale, holdEx, newRounds, newMinutes]
  const fixes: [string, number, number, number, number, number, number][] = [
    ['box-breathing',      4, 4, 4, 4, 19, 5],
    ['4-7-8-breathing',    4, 7, 8, 0,  4, 1],
    ['wim-hof',            2, 0, 2, 0, 30, 2],
    ['physiological-sigh', 2, 1, 6, 0, 13, 2],
    ['energizing-breath',  1, 0, 1, 0, 20, 1],
    ['coherent-breathing', 6, 0, 6, 0, 25, 5],
    ['alternate-nostril',  4, 0, 4, 0, 38, 5],
    ['deep-belly-breathing', 5, 0, 5, 0, 30, 5],
    ['power-breathing',    3, 2, 3, 0, 10, 1],
    ['recovery-breathing', 4, 0, 8, 0, 30, 6],
    ['focus-breathing',    4, 2, 4, 2, 20, 4],
    ['sleep-preparation',  4, 0, 7, 1, 40, 8],
    ['nsdr',               4, 0, 6, 2, 50, 10],
  ];
  try {
    let touched = 0;
    for (const [slug, inh, hIn, exh, hEx, rounds, minutes] of fixes) {
      const r = await pool.query(
        `UPDATE breath_techniques
         SET default_rounds = $2, default_duration_minutes = $3
         WHERE slug = $1
           AND inhale_seconds = $4 AND hold_after_inhale_seconds = $5
           AND exhale_seconds = $6 AND hold_after_exhale_seconds = $7
           AND (default_rounds IS DISTINCT FROM $2 OR default_duration_minutes IS DISTINCT FROM $3)`,
        [slug, rounds, minutes, inh, hIn, exh, hEx]
      );
      touched += r.rowCount || 0;
    }
    console.log(`[startup-migration] breathwork-durations: reconciled ${touched} technique(s)`);
  } catch (e: any) {
    console.error("[startup-migration] breathwork-durations failed:", e?.message || e);
  }
}

/**
 * Seed the five breathwork techniques added Aug 2026 (Humming Bee / Ocean
 * Breath / Pursed-Lip Reset / Cooling Breath / Extended Exhale) into databases
 * that were seeded before they existed. Insert-if-missing by slug, so it is
 * idempotent and never touches existing rows. All use existing categories, so
 * the mobile UI picks them up with no app change.
 */
export async function seedBreathworkTechniquesV2Once(): Promise<void> {
  const techniques = [
    {
      name: "Humming Bee",
      slug: "humming-bee",
      description: "An ancient yogic technique (Bhramari) using a soft humming exhale. The vibration and naturally extended exhale calm the nervous system unusually fast.",
      category: "relaxation",
      difficulty: "beginner",
      inhaleSeconds: 4,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 8,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 15,
      defaultDurationMinutes: 3,
      benefits: ["Calms anxiety quickly", "Naturally extends the exhale", "Supports nasal nitric oxide production", "Eases the transition to sleep"],
      instructions: ["Sit comfortably and close your eyes", "Inhale slowly through your nose", "Exhale with a soft, steady humming sound", "Feel the vibration in your face and chest", "Keep the hum smooth to the very end of the exhale"],
    },
    {
      name: "Ocean Breath",
      slug: "ocean-breath",
      description: "The classic yogic Ujjayi breath. A gentle constriction at the back of the throat creates a soft wave-like sound that anchors attention and steadies the mind.",
      category: "focus",
      difficulty: "beginner",
      inhaleSeconds: 5,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 5,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 30,
      defaultDurationMinutes: 5,
      benefits: ["Anchors wandering attention", "Steadies breathing under effort", "Pairs naturally with yoga and mobility work", "Builds breath awareness"],
      instructions: ["Sit tall or move through your practice", "Slightly constrict the back of your throat", "Breathe in and out through the nose", "Listen for a soft ocean-like sound", "Keep the sound even on inhale and exhale"],
    },
    {
      name: "Pursed-Lip Reset",
      slug: "pursed-lip-reset",
      description: "A clinically grounded pattern that slows the breath and keeps airways open longer. A fast desk reset when tension or breathlessness is building.",
      category: "recovery",
      difficulty: "beginner",
      inhaleSeconds: 2,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 4,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 20,
      defaultDurationMinutes: 2,
      benefits: ["Quick reset at your desk", "Slows a racing breath", "Improves breathing efficiency", "Useful during breathless moments"],
      instructions: ["Relax your neck and shoulders", "Breathe in through your nose for 2 seconds", "Purse your lips as if blowing out a candle", "Exhale slowly and gently for 4 seconds", "Let the exhale stay soft, never forced"],
    },
    {
      name: "Cooling Breath",
      slug: "cooling-breath",
      description: "A yogic cooling technique (Sitali). Inhaling through a rolled tongue or pursed lips cools the airway - ideal after hard sessions or in hot weather.",
      category: "recovery",
      difficulty: "beginner",
      inhaleSeconds: 4,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 6,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 18,
      defaultDurationMinutes: 3,
      benefits: ["Cools the body after training", "Calms post-workout breathing", "Helpful in hot weather", "Settles the nervous system"],
      instructions: ["Roll your tongue into a tube, or purse your lips", "Inhale slowly through the rolled tongue for 4 seconds", "Notice the cool air on the inhale", "Close your mouth and exhale through your nose for 6 seconds", "Repeat, keeping the breath smooth"],
    },
    {
      name: "Extended Exhale",
      slug: "extended-exhale",
      description: "The simplest way to switch the nervous system into rest mode: make the exhale longer than the inhale. An easy first step before techniques like 4-7-8.",
      category: "relaxation",
      difficulty: "beginner",
      inhaleSeconds: 4,
      holdAfterInhaleSeconds: 0,
      exhaleSeconds: 6,
      holdAfterExhaleSeconds: 0,
      defaultRounds: 24,
      defaultDurationMinutes: 4,
      benefits: ["Gentlest introduction to breathwork", "Activates the relaxation response", "No breath holds to manage", "Works almost anywhere"],
      instructions: ["Sit or lie down comfortably", "Breathe in through your nose for 4 seconds", "Exhale slowly through your nose or mouth for 6 seconds", "Keep the breath quiet and unforced", "Let each exhale release a little more tension"],
    },
  ];
  try {
    let added = 0;
    for (const t of techniques) {
      // Raw SQL naming ONLY the columns we set. The drizzle insert
      // (storage.createBreathTechnique) writes every column in the schema
      // definition, which 500s on production where the live table predates
      // some of them (schema drift). ON CONFLICT keeps this idempotent.
      const r = await pool.query(
        `INSERT INTO breath_techniques
           (slug, name, description, category, difficulty,
            inhale_seconds, hold_after_inhale_seconds, exhale_seconds, hold_after_exhale_seconds,
            default_rounds, default_duration_minutes, benefits, instructions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (slug) DO NOTHING`,
        [t.slug, t.name, t.description, t.category, t.difficulty,
         t.inhaleSeconds, t.holdAfterInhaleSeconds, t.exhaleSeconds, t.holdAfterExhaleSeconds,
         t.defaultRounds, t.defaultDurationMinutes, t.benefits, t.instructions]
      );
      added += r.rowCount || 0;
    }
    console.log(`[startup-migration] breathwork-techniques-v2: added ${added} technique(s)`);
  } catch (e: any) {
    console.error("[startup-migration] breathwork-techniques-v2 failed:", e?.message || e);
  }
}

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


// ---------------------------------------------------------------------------
// Content-tag backfill (production fix, Jul 2026).
//
// The AI tag backfills earlier this week were run from the Replit WORKSPACE
// shell, which talks to the DEV database — production's learn_content_library
// tags / learning_paths struggles were never refreshed with the current
// vocabulary (incl. the new life-stage labels: menopause, bone health, etc.),
// so the coach's tag-based education matching in prod runs on stale tags.
//
// This runs a FORCE re-tag once per database, then records a persistent flag
// so it never repeats (force = one AI call per item, ~hundreds — must not run
// every boot). The flag lives in a tiny system_flags table created here on
// demand. Fire-and-forget: runs in the background after boot, never blocks
// serving. Cost is a one-time re-tag of the whole library per environment.
// ---------------------------------------------------------------------------

let hasRunContentTagBackfill = false;
const CONTENT_TAG_BACKFILL_FLAG = "content_tag_backfill_lifestage_v1";

export async function backfillContentTagsOnce(): Promise<void> {
  if (hasRunContentTagBackfill) return;
  hasRunContentTagBackfill = true;

  try {
    // Persistent once-per-database marker table (safe on every boot).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);

    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [CONTENT_TAG_BACKFILL_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return; // already done in this database

    console.log("[startup-migration] content-tag backfill starting (force re-tag, once per database)...");
    const { runContentTagBackfill } = await import("./coach/contentTagger");
    const report = await runContentTagBackfill({ force: true });
    console.log(
      `[startup-migration] content-tag backfill complete: ${report.itemsTagged} items + ${report.pathsTagged} paths tagged, ${report.itemsFailed + report.pathsFailed} failed`,
    );

    // Only record the flag if the run didn't wholesale fail, so a transient
    // outage doesn't permanently skip the backfill.
    if (report.itemsFailed + report.pathsFailed < report.itemsTagged + report.pathsTagged + 1) {
      await pool.query(
        `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
        [CONTENT_TAG_BACKFILL_FLAG],
      );
    }
  } catch (e: any) {
    console.error("[startup-migration] content-tag backfill failed:", e?.message || e);
  }
}

// ------------------------------------------------------------------------------
// Content write-ups backfill (description + summary + key takeaways +
// transcript for Mux lab videos). The earlier manual run only reached the DEV
// database; this runs on the DEPLOYED server so PRODUCTION gets the data.
// Columns are ensured every boot (cheap, idempotent) so an API that selects
// them never 500s on a DB missing them; the expensive AI backfill runs once
// per database, guarded by a persistent system_flags marker.
// ---------------------------------------------------------------------------
let hasRunWriteupsBackfill = false;
const CONTENT_WRITEUPS_BACKFILL_FLAG = "content_writeups_backfill_v1";

export async function backfillWriteupsOnce(): Promise<void> {
  if (hasRunWriteupsBackfill) return;
  hasRunWriteupsBackfill = true;

  try {
    // Ensure the columns exist EVERY boot so a patched API that selects
    // summary/key_takeaways/transcript never errors on a DB missing them.
    await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS summary text`);
    await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS key_takeaways text[]`);
    await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS transcript text`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);
    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [CONTENT_WRITEUPS_BACKFILL_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return; // already done in this database

    console.log("[startup-migration] content write-ups backfill starting (once per database)...");
    const { runWriteupBackfill } = await import("./contentWriteups");
    const r: any = await runWriteupBackfill({ dryRun: false });
    const wrote = r?.wrote ?? 0;
    const failed = Array.isArray(r?.failed) ? r.failed.length : 0;
    console.log(`[startup-migration] content write-ups backfill complete: wrote ${wrote}, failed ${failed}`);

    // Record the flag unless the whole run failed (so a transient outage retries next boot).
    if (failed < wrote + 1) {
      await pool.query(
        `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
        [CONTENT_WRITEUPS_BACKFILL_FLAG],
      );
    }
  } catch (e: any) {
    console.error("[startup-migration] content write-ups backfill failed:", e?.message || e);
  }
}


let hasRunRevokeEmptyBurnoutBadges = false;
const REVOKE_EMPTY_BURNOUT_BADGES_FLAG = "revoke_empty_burnout_badges_v1";

// Corrective: the burnout engine persists a cold-start PLACEHOLDER row
// (score 0, data_source_count 0) the first time a user with no data opens the
// app. The badge stats used to count those rows, so brand-new users were
// wrongly awarded burnout badges ("Self-Aware" on a 0/0 score, and — via the
// same placeholder — "In the Green", "Bounce Back", "Steady State"). The stat
// queries now filter to data_source_count > 0, but awardBadge never revokes,
// so remove any of these four badges held by users who have NO real burnout
// score at all. Once per database, idempotent, guarded by system_flags.
export async function revokeEmptyBurnoutBadgesOnce(): Promise<void> {
  if (hasRunRevokeEmptyBurnoutBadges) return;
  hasRunRevokeEmptyBurnoutBadges = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);
    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [REVOKE_EMPTY_BURNOUT_BADGES_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const result = await pool.query(`
      DELETE FROM user_badges ub
      USING badges b
      WHERE ub.badge_id = b.id
        AND b.name IN ('Self-Aware', 'In the Green', 'Bounce Back', 'Steady State')
        AND NOT EXISTS (
          SELECT 1 FROM burnout_scores bs
          WHERE bs.user_id = ub.user_id AND bs.data_source_count > 0
        )
    `);
    console.log(`[startup-migration] revoke empty burnout badges: removed ${result.rowCount} wrongful badge(s)`);

    await pool.query(
      `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [REVOKE_EMPTY_BURNOUT_BADGES_FLAG],
    );
  } catch (e: any) {
    console.error("[startup-migration] revoke empty burnout badges failed:", e?.message || e);
  }
}

let hasRunRevokeEmptyAiBadges = false;
const REVOKE_EMPTY_AI_BADGES_FLAG = "revoke_empty_ai_badges_v1";

// Corrective: opening the AI coach seeds an assistant greeting message into a
// new conversation, and the badge stat used to count EVERY message (including
// that greeting), so "AI Curious" (and potentially AI Regular/Power User via
// repeated proactive greetings) fired without the user sending anything. The
// stat now counts only role='user' messages; strip any of these three badges
// from users whose real user-message count is below the badge's target.
export async function revokeEmptyAiBadgesOnce(): Promise<void> {
  if (hasRunRevokeEmptyAiBadges) return;
  hasRunRevokeEmptyAiBadges = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);
    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [REVOKE_EMPTY_AI_BADGES_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const result = await pool.query(`
      WITH um AS (
        SELECT user_id, COALESCE(SUM((
          SELECT COUNT(*) FROM jsonb_array_elements(messages) m WHERE m->>'role' = 'user'
        )), 0) AS user_msgs
        FROM coach_conversations GROUP BY user_id
      )
      DELETE FROM user_badges ub
      USING badges b
      WHERE ub.badge_id = b.id
        AND b.name IN ('AI Curious', 'AI Regular', 'AI Power User')
        AND COALESCE((SELECT user_msgs FROM um WHERE um.user_id = ub.user_id), 0) < CASE b.name
              WHEN 'AI Curious' THEN 1
              WHEN 'AI Regular' THEN 10
              WHEN 'AI Power User' THEN 50
            END
    `);
    console.log(`[startup-migration] revoke empty AI badges: removed ${result.rowCount} wrongful badge(s)`);

    await pool.query(
      `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [REVOKE_EMPTY_AI_BADGES_FLAG],
    );
  } catch (e: any) {
    console.error("[startup-migration] revoke empty AI badges failed:", e?.message || e);
  }
}

let hasRunRevokePerfectRecord = false;
const REVOKE_PERFECT_RECORD_FLAG = "revoke_invalid_perfect_record_v1";

// Corrective: "Perfect Record" (complete every programme you enrolled in, min 3)
// was awarded to users who had quit a programme — quitting DELETES the
// enrollment row, so completion_rate read 100%. The stat now also requires
// zero 'abandoned' recommendation events; remove the badge from anyone with a
// recorded quit or fewer than 3 completed programmes. Once per database.
export async function revokeInvalidPerfectRecordOnce(): Promise<void> {
  if (hasRunRevokePerfectRecord) return;
  hasRunRevokePerfectRecord = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);
    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [REVOKE_PERFECT_RECORD_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return;

    const result = await pool.query(`
      DELETE FROM user_badges ub
      USING badges b
      WHERE ub.badge_id = b.id
        AND b.name = 'Perfect Record'
        AND (
          (SELECT COUNT(*) FROM user_program_enrollments e
             WHERE e.user_id = ub.user_id AND e.status = 'completed') < 3
          OR EXISTS (SELECT 1 FROM recommendation_events re
             WHERE re.user_id = ub.user_id AND re.event_type = 'abandoned')
        )
    `);
    console.log(`[startup-migration] revoke invalid Perfect Record: removed ${result.rowCount} wrongful badge(s)`);

    await pool.query(
      `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [REVOKE_PERFECT_RECORD_FLAG],
    );
  } catch (e: any) {
    console.error("[startup-migration] revoke invalid Perfect Record failed:", e?.message || e);
  }
}

let hasRunStripEmDashesFromDescriptions = false;
const STRIP_EM_DASHES_DESCRIPTIONS_FLAG = "strip_em_dashes_descriptions_v1";

// One-off content cleanup: strip em dashes (U+2014) from every programme and
// workout description shown in the app and replace each with a comma, matching
// Mark's copy style. An em dash is used as a spaced pause ("the hinge is the
// star — done fresh"), so we collapse any whitespace around it into ", "
// ("the hinge is the star, done fresh"). Covers the content library
// (programs.description + who_its_for, programme_workouts.description,
// workouts.description) AND the per-user copies currently live in enrolled
// programmes (enrollment_workouts.description and the user's own
// custom_description override) so no existing enrolment keeps a stale em dash.
// Only rows that actually contain an em dash are touched. Once per database,
// idempotent, guarded by system_flags. NOTE: does not touch titles/names, and
// new AI-generated descriptions can reintroduce em dashes — see handoff notes.
export async function stripEmDashesFromDescriptionsOnce(): Promise<void> {
  if (hasRunStripEmDashesFromDescriptions) return;
  hasRunStripEmDashesFromDescriptions = true;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_flags (
        key text PRIMARY KEY,
        created_at timestamp DEFAULT now()
      )
    `);
    const existing = await pool.query(
      `SELECT 1 FROM system_flags WHERE key = $1 LIMIT 1`,
      [STRIP_EM_DASHES_DESCRIPTIONS_FLAG],
    );
    if ((existing.rowCount ?? 0) > 0) return;

    // Each target: [table, column]. Only descriptions/whoItsFor — never titles.
    const targets: [string, string][] = [
      ["programs", "description"],
      ["programs", "who_its_for"],
      ["programme_workouts", "description"],
      ["workouts", "description"],
      ["enrollment_workouts", "description"],
      ["user_enrollment_workout_customizations", "custom_description"],
    ];

    let total = 0;
    for (const [table, column] of targets) {
      // Replace [whitespace]* em-dash [whitespace]* with ", ". chr(8212) keeps
      // the em dash out of the source file so encoding can never mangle it.
      const result = await pool.query(
        `UPDATE ${table}
            SET ${column} = regexp_replace(
              ${column},
              '[[:space:]]*' || chr(8212) || '[[:space:]]*',
              ', ',
              'g'
            )
          WHERE ${column} LIKE '%' || chr(8212) || '%'`,
      );
      const n = result.rowCount ?? 0;
      total += n;
      console.log(`[startup-migration] strip em dashes: ${table}.${column} — ${n} row(s)`);
    }
    console.log(`[startup-migration] strip em dashes from descriptions: ${total} row(s) updated total`);

    await pool.query(
      `INSERT INTO system_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
      [STRIP_EM_DASHES_DESCRIPTIONS_FLAG],
    );
  } catch (e: any) {
    console.error("[startup-migration] strip em dashes from descriptions failed:", e?.message || e);
  }
}

// ── The Lab: topic covers ───────────────────────────────────────────────────
// One-time ingest of the object-hero topic covers into our OWN Object Storage,
// so the app never hotlinks an external CDN. Idempotent: only fills a topic
// whose image_url is still empty (never overwrites an admin-set cover), and
// re-tries any that failed on the next boot. Source URLs are long-lived signed
// links; once copied into Object Storage they are never fetched again.
const LAB_TOPIC_COVERS: { slug: string; url: string }[] = [
  { slug: "sleep", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__10/image-7a5f5c2f-ba45-4d53-9601-032a94165022.png?Expires=2100874914&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=0gHB2mBhPzm6LVtPjAgbbyJPb3Qs4mLdbY7pz3IPLm74nzGKkNY5sfOwijF3fgM0PKOSrt~Xx0~-s6fz8gieNAA3yu9ykcbCip~SUp2DL5sOwGnTG9wYLitwB9ctnGyOIZ8ptKdKXH696kLyGSP7nTiLdk9ekzptBf4UNeoL-T5ictuwwYKVob~EEAotfc-r7mCutG5PhxHzMs6fEmfTZxOkRpYqkPXDSDaVkI2ks~pvsZOvuMBMXDSXYxaXM6LaiQkZhj0jwDEYLxMsURmMazhfNTOPfgScv42Kz~KypIGw768HfpMgoCLaL42upEndOu-PvJIZw2wHFmJFtkkafg__" },
  { slug: "stress-burnout", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-6dbd92cc-6da5-4d95-b803-2780c3547bff.png?Expires=2100874914&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=pnH~KGVe4Sfdey2ZwsPQXx0mkml3Wb9sw0ds2E84WzoHHHQ6rroZMlpKQAs~YwPFuT1LZVAdOYPFb-BHACle8nUPBtcYdHDLqcwErnGTegxEpYtITA3mEEdptHnX5oWefkeBafJwjhSlkavrzvXzFjvW1p9K60ld7NNB0O7TMPM2-LNhVA-vGpOCzQUiEWg3X7Ov5LHDf1dMAufrF1oDAqsWmWRx1OMBsviup6Ny-2faC~jKbp0XFuMq1Ha01miKv34IY2f7Q55Y4XDwA57wj2Bz8seAhufUtu3S~MiryDtGGrn61axH8JpN0u6BEsOeV~AJG4c2xkCpTAJTRWWS4A__" },
  { slug: "movement", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__3/image-9e7de082-8d96-42d4-8800-d94e08945329.png?Expires=2100874914&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=rRRDkNbcQ~0-kngK1cWC0lfFYXNkPBtqumBoBsjub-PyAfxMdCvwf-u9fR1L~bsdxbS18ATQY1LyGWZw4G7~dsTdRiS7jy3euiFeFZrV9VCxX3rDpUs9GgCo27Bo6hLTvSEdrbsPp0VHIuVLIPAUSiNSzYHMgrnFgC5uVWgaK8tRWsfqWSIpI6iMMq6xDLQ4ggiZPEXzFxE5YCogQmgkhPu-SrBJndDZGxdogaJ62ElV-8DQxzEqGPesa3f4Wo9fFtVpCuCh1NISvZF0BMdD6sFjwAmc5Rsbhe8uLY69~EQlShjP7Uji8jVK5bmjhSQ8gkqcHmZ--kUmWwzCPcDwvg__" },
  { slug: "mindset", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-4e3d8fc3-4d63-41e1-a99e-98ed405c74d2.png?Expires=2100874919&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ufm1jgV0XxqAit~N3O7vbQxaSM2NT8OJNeqcUXqPB0i01UdP5alx9SXarsFCEese0kaZ0yydAYeFM8Vncm1Z5SEwQA42KD46Y78RiGLDFouR1O3X00XbiZ0RTEqGOsYUBzqYkXvuL12hE-a6Lxt5P26phNovgiEU65jI-p0n9~ru-~VKN7iWRqj~xry8gsGINWB3BAikAqqiU-mEQpoqi5yOoamBeCdVwheeSlB87GIDufS55ShP0HFgIAWZ7jmDWHXTz1a7-ihc9Y7oCIEmsvZf5JSaEy8x78em7dx5W3kLwMc0BbJzKiAM1HI9NYQXMoIyH-ItqeiHVcTWxCnOgw__" },
  { slug: "nutrition", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__7/image-477e1a4a-e147-4bac-8d85-414fa2e87d19.png?Expires=2100874924&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=Li4tcWls7dHihvR8dh1LIYE9iFhclNrHj7RBKUXnx2q~Hv7cA3UCpY6XkU44AlE0Mue-lnzgXq0C~0ZPQzbJSv7KZnQc2WNbuUTDLglg7THuYffd5E13nCgn4F~osyA2Ecvr2o9Yr5Sg5Iy-BDPif-eAsyEhkC7jXYNDPnDEf1AMXjXdDmZiV6B5CkNOH7fdHdTSkI4EDMBVyj3~Ve1TKiihCPXYg7-VCl6E6QcPBp8D-GfLA3ts6iLUlgNCBNlz3qHZZjeE71Dr~Ynit28vXdwhd2NjCFE3NW~kEpCLvGzbsXmL39kSzHtH-41xtHckUxznoSr7Q5Q91~zEAuMufw__" },
  { slug: "travel-routine", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-b416b366-6fb2-415d-9965-c6fe105cf2bf.png?Expires=2100874924&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=dCiUeSHbNOux2Zki7lCD0cK9~0sLighwL~1Lz-skwDw~fQppzu~SgyaY5AJJxGTkWbM4rcHvHT~eDz-oHYQI~I3L7JfaRJfLZw9gdRZh9xiAFCJ3k4-BuSQmzU99oaI0W58-FQMKs4qF65-9cTfyRfE04rXkC1oMUntZ2QVFXMTW1ssXQl2XQ-7lJTxwyoKgHy65U4y5-vJa2TES73ylljlRyuzZmtQuaNYy~tvIGpIDJBLHErWmnofT-qyxqB62A7TKnVU9jHLl-Q6T16xHIhn3zJFcjmJjtwe32iDGFsFdnfQlEkWZmcsIZiPYRBn34zmu2S-KPbXLZbJaNMIrWw__" },
  { slug: "productivity", url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/image-4ce18cdb-6d01-4a02-b704-01b320ff634a.png?Expires=2100874939&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=Rvs1b57dj55u6DD45IEKysVrxUKa3jhkVoyG0XGpuT0-MIQgz8s54UgFkSB1M-74D2NT0LSKrsqJnOZFyiLP7DmyalVxpGY4tr~kt3D~dQecTzyx8g2ZRugLwBhOGJN~O1fNcQ5n611nc8aCi1mfS6UUEXYhGF1TXBUVR1Q1LrBaa3kw~Ts2XK6WzCRVB6ifvtBLS-SVSvVMjB0KRkpeR0Ye13B402jDRbeP7lXV30OuIJLvUbqj8PkJIDY4zyUazkbPuVq5Sns7dK-x7r64dGc1hAGD32WIDuEU3lTzwYnSrth7~q3-n35Pkes1mxYGiEzQ9f0tVRI6R7y7wH-GDw__" },
];

async function uploadBufferAsPublicLabCover(buffer: Buffer, contentType: string): Promise<string> {
  const svc = new ObjectStorageService();
  const privateDir = svc.getPrivateObjectDir();
  const trimmedDir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const entityId = `lab-covers/${randomUUID()}`;
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

export async function seedLabTopicCoversOnce(): Promise<void> {
  if (hasRunLabTopicCovers) return;
  hasRunLabTopicCovers = true;
  try {
    for (const cover of LAB_TOPIC_COVERS) {
      try {
        const row = await pool.query(
          `SELECT id, image_url FROM learn_topics WHERE slug = $1 LIMIT 1`,
          [cover.slug],
        );
        if ((row.rowCount ?? 0) === 0) continue;
        const { id, image_url } = row.rows[0];
        // Skip only if it's already our hosted cover (/objects/...) or an
        // admin-set absolute URL. Legacy relative paths like "/7_...png" are
        // broken and get overwritten with the real cover.
        if (image_url) {
          const s = String(image_url).trim();
          if (s.startsWith("/objects/") || s.startsWith("http")) continue;
        }
        const resp = await fetch(cover.url);
        if (!resp.ok) {
          console.error(`[startup-migration] lab-cover fetch failed for ${cover.slug}: ${resp.status}`);
          continue;
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        const objectPath = await uploadBufferAsPublicLabCover(buffer, "image/png");
        await pool.query(`UPDATE learn_topics SET image_url = $1 WHERE id = $2`, [objectPath, id]);
        console.log(`[startup-migration] lab-cover set for ${cover.slug} -> ${objectPath}`);
      } catch (inner: any) {
        console.error(`[startup-migration] lab-cover failed for ${cover.slug}:`, inner?.message || inner);
      }
    }
  } catch (e: any) {
    console.error("[startup-migration] lab topic covers failed:", e?.message || e);
  }
}

// ── The Lab: path covers ────────────────────────────────────────────────────
// Same idempotent ingest as topic covers, but keyed by learning_paths.id.
// Append new { id, url } entries here as path covers are generated.
const LAB_PATH_COVERS: { id: number; url: string }[] = [
  { id: 12, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__4/image-090b79ba-742e-4cd7-a78f-daaa5118b91e.png?Expires=2100880399&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ZZLvDXSfcKp2wTa5WtU3ZPjcCP5v5lBZeREtuPIqQMXxmLR8rENK7QRgSNXMj7mS9SL7kvlgD3iSslrhk5NDN~Vq60vxEM-hPqCOJSn-wG7jMf1QCbwTFK8r2XrVXpCtin8s5HpbmBKkLfoeWSWRWelyyY6Ehlcdr0xgwb42UUwRvB00esnLsmh~~wZ-Jn2r2sny~c2osBZvjo01g-MLFC-dNf~pZxO2Hi1IkLhS7QOnQd3S9AVlZOp~v9joxXmjQADUNlJXrdQG07hLfRmxyCQ82Y6~we5gEhW9UUzzfglb252dBv994rePufc6Zxkg0LAdBUuFjIUr9YLrf4Ep1Q__" },
  { id: 28, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/image-1c054689-8f42-4088-9455-a7dead0529f0.png?Expires=2100880388&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ZteYps83OJ8C6xRHhMk3U99YK5VRkBTKk6e4ZxRd7LbzpHzP3SG2nsO9TS47ey6yePPsHWtuxuXo06ntrVm16kt5Or8ioiNLI4xn-nEpDvbrSwxmVENzUOFqjvOB~7fpoSuGZGNA7IByNAPg65km~xly9yzlRIPbpHj4I-Q5Kl4L~m1xqwY3MQsY1qC4bAX~wD0OWZy-HXG67BNSss-B~O5GRFFujCUhsFdoBCcttw6oBuaReX9Yq1v3Ocnt86ITh4fO-hcS1WleE6pANeh5u5OENMpJmdvy9vZordUA07rb~0W-n~DwfZT753Nn1Y6wKKH9tpVg5Y02QFx8OmW8nA__" },
  { id: 1, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-9aeef213-0e47-4efc-b0af-c4eb1bad3d12.png?Expires=2100945139&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=uRyP9ytLyilAIPmaFieaPwX9IdXXmu0WDp-iBptuF-wyUbdb6JDqSRxVn8-vbsQ7-009hJtgIT30bD4SqaUTmcH2kZzsJZgSUZugcf4CZO6KqBoqkHPmrMcRPvuWYJz~XjRvvvM7FQ-kRoSgYPntZCiLcSOUqirQZuCYwvQIwWJk7Y4ni2-9ZaSuSs-xq3hq0COX6jL64C1lu6QD46NL7Isi~T7OEObW-glFP4ozS2qjxR0-13qqTshFNDrZGErsjxQCTVrLw-yZEHXJyMmR2NJoLRO9A4kk7nHCM~hmCI1g6Ph7uyn~3PjtqcZtDA4jo3MHwtsgx2zszR5AcwhLrw__" },
  { id: 2, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-db54403e-a778-4cf1-bb2c-3e94395ba80e.png?Expires=2100945136&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ShLmnyEoYbp6-70y41z28tI~jCfQSsXS0YpeMg-BnfIm1Cifvsd~yF0EO28OLdrGsfh~W4Uw9b3VKBUWkzyFnHKcWwaTZxm~BX3WgO4Bs4u2lUlbfOWTDq5j5pyfW5HA9yzO5FPSc5eFZwmL94Pec8EQPxKNoN02~J2NmZ3cbDx9wHI38myMV0U5dZRl1HRLhQ0~WhBHQCTZ2AYwY6f3zlkPO0Aah4QJjAA33sNlyb7L9zZZFpDo6UAOZwEYL7NfbygvgsHw3WyWhirofcM7-7MRe0Hf7Qw5RjxNoPrEYPWy1VjiXHY6LVosFEFVmxQfjV05UumAouthviuQ-CsIwg__" },
  { id: 3, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-84ec9a0b-378c-4eab-ad40-9ae178423ef5.png?Expires=2100945148&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=mY1hHaQ2YJMVVS~3Jitls3DcHYSHS5XHzuiOCi9diIz7xWFcLBFj-359Qs2A8p~Eo0J4Di3pcESMYJMRc-bam0zG55iosMLj6IFyYIj0ymZ54ummUrEK8AiNy3djVk2K02GQ4PQboSgfOqXpk7R~LoSyn1NltfY8DXAznRl4ck59eFOFKcCYT4nMJm~T9qNZ8a2SyFxpAwfV3RBBkCtae~hdHXjjNaIj-exNEgT3nXIEloTedsCQcTNP3DxMe2NV~dmxPTbxk9o0CpGnmQS2pmSXo07zFeu0q-C7DAW6hHUGexwjlle~9iobSCQD3Ls9b-yTPEPDij8G-hxUnlgBeA__" },
  { id: 4, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__5/image-c0679fb6-061d-4791-9d85-5914e2b156aa.png?Expires=2100945142&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=Hb5FyDyI8AR5m06k82-EEdsEH4G~EZaBl~7GgSKR7-QtttH5QPNS2wHnh1RWQT6y39wGAqm6MuFv11WwMnEb7LfAzOTfY7fh5t9bYP5LQaK5MmTNjYvSYuian03dUPUAgzr4dZ819c-WM0lAIPCrG4mV7jOxB4yUQYE2yqlJYOjgBo8ACJ-Wale-2st3nCGfjnFYfiaRHb1jvQ3IBpY4c3w3AMkFhuTu6~T-S3kGTE3pPEHuUb-Q8M828fsEOgvkDjnYc0RDyWz-kL3yicBfz-zE6C2qXDYg9MDMigGirMAX76G5-N1nvfOXU0sdQ6gC8Nn97MHPblwyG3uFiciZNw__" },
  { id: 5, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__10/image-13523eea-bd30-4cae-b9be-e3a1b4f07bcd.png?Expires=2100945150&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=jGDgqGoUpssEOGZrZsxLQ8zV4Ks96oDLNU2FtGlBue3zagshh8wUsTDbyQhGanthPEmGOKRG3XUjRS25tR0m9jcLSKQ2PdfODXS1grqYhvCrGuo4epyq9pwvXVh2PKB5--PQuPkMARFZDwBVWkpDxu0NQ7-j5vHO4k2GZFsDNiwdSLzfMEdDIqAPmndv2VwsuR4Zp6MIyvIPGAI2PTD-yzsUmGhuhnS65yqUB0HVjAkEQoIBb5QLCaxycnmOagylWqhbni06ofcI7PMD2u81iYS2qkw~8vwziSsHYwJFa32647v99zFHBVoNsRm2eVs9o8hQ8YHI5nKTgVOwIwW8UA__" },
  { id: 6, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/image-12487675-6493-4fb3-9d96-7909cd12fa77.png?Expires=2100945149&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=W2UdlxyaU0J6qTf3HsDfqHvHPxSzLcarKcDVVzGNpZTrRsl~UQonVFvA-42WTCTFGerZOCCxWBn1kFi4F9p4azw7QsKfz~7aPgaj-rT05u-MYy8Y93~f623kWysQY9c~CCvtjLNmC-nMHth7EQOygNiEGNa5PPteZWKZU78MTdFRyyMJ6EJJanZ4j4RsVQJwzlrKs6v3-wRi15IvBvm6z-thnr573Yc2AEeHloP7OtlbwFPSBBMfC96cifQqxFfybuCiaIynpiEqZy55ruAOZVo~H~jaob0KyqM2M4u6G2qd64RKnfEVWKDyp-J66sT72ViSVIg3Ip14JjY0rEx17A__" },
  { id: 7, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-7edf0838-4c60-4c37-9fa9-60d2615312f7.png?Expires=2100945160&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=jF1ZrJKu7OgZxLGW-BS-LqFjwnDgsioaJnUoBb8fzmb4KPr2q4KjshB1Qx~wxOrxMfib3PDhuvMbgEhV09pQrdMf0gvr9m5x4EShuNnekp9kPZfQg6BkPJzxEqX5rDDkL9eRoXKoqyvM55aOdxtOk~IOXwS3NKjdzJFoOm50SsKxrZQ-g6SQzseBInNjsMbIyNAbxQjVDGvBkDRhw0EMakQ6ZbkBUk-JBbTkWEx8XG~fk8rVopBkmkGs4j2psAORuZhLSbRZBOo1lSvJDxZG1btI-m1hcq~yJz8rc81QOs2xfaLOeq2r-n6PybAdsToNY~P8pY8NP5LqPfvzYFtuCg__" },
  { id: 8, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/image-f39e7741-c26b-4bd9-98e8-3839d2a6c6c9.png?Expires=2100945159&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=Q3hMBDmZBDhu3E-ibv9IJluuJnaXYdxe81giZh5Os5iwEJFBw9~yVbRM9LGsOlkwp9vdbT-WBZQdcCiu0jTuNdvF5oSEQRFL60km40cbUZAoNGKle5ureI6WGseT4RiVb5USjBpfzroWbb6PT4eONJogOo0SH-~PQXoYVInJKwV30BWvwJhdttACV2uMCWBPhLNBxBC7Ek~Od2vTM4jqsLyB9CczyqaBCK5jWl5JSwylVCsJiseipnsjGKsKwWHBwUgFGKXeM0dZNBMS0qOHp16mnFr9EW~~vjrZYm~0QtEC-FR16PV-UsktjFtBu3Oj2jC-f6i9X7KxC3ur7HXMNw__" },
  { id: 9, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-a58ba6ee-a05e-46db-adc8-95ac1e5f4b65.png?Expires=2100945160&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=dgRCJ6~jOwPyYMx6Pwk~nvzdy~~HapXRSx1~JLa3G9CVvgOean2jGUCuR-nWTqS82a9k03BtOJSq0DYbLc0LmrEmEj6M5SroQ3U7Iqn4cYDlXmY1E-AFw1ciZ9Qr9PXTaXL7rAMaRGkG7ax9I3nLLkoZnq6SQgRfqL7DbFGR50kBKEE4FAFKN~22z3FSoe5Jv2qaU0Hr~ctq~EN7lzj9Af3t2zZEVCfuBbWxDn4GoKUrczICElF8F2SSmwqEGttUmhyE-HNElOe3Fhjr3ZSwZrs~kPJHGBzLYtnY1i~ciICGaUmmJYU3Go8KyZ8Xee3jokSdiiZF87Nxjqm5xocl3w__" },
  { id: 10, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/image-58014368-e08a-4176-97df-b0c284f29026.png?Expires=2100945161&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=EzPBnimewfSVenf1liJPMn-agmrhCMS~BrMV~LU9pamdQsx2O~aW4iMAumrRbQZjMMZYa3ipjWUUttdNDPmDDamvr1Y7Y4IJZxwv8g1C1RunVewe-CNNwNAa6ytAz~61VO-RAPLUKQMQTibfomjBDxM7vIG01PSjWF~ndj2Nz~M8C6Q~MV4ISeLCRpiyfBJMNzgSNv1qctISxMFsekuv4H3f2Yyitb~QY7jHKdvRpTFg-OcnjbhwTLczwN0YToBVAaJ0yO4sOIlKysPurgljXU2vNNOvapMpAG4yH7riRbBUzH3z0fYdy~~ITODNkCCRzrO-Di0kTkVdlj-hQUiehA__" },
  { id: 13, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__4/image-08d9afd8-7a76-434b-b05b-843906fc75c2.png?Expires=2100945176&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=P34-q9j6R4dkQhOKSkP1ykeC-rNAaOh0yNC7aylnxMVqWE0NQBwz~yMgBRcGuDx65hyQfOG4LKINOJY5zyCuPKJL0KOxtbQAkGHwEfSs42m2lK5g9OIchu2J0wmbiFhmhG3wDucs3jPuFbcl-TQ5-h9kke34WGo7KhMYWN4EuU0PjdTUyrnmprj~PKtkzMatW0e4j1ymAfSIBWBt9Kr6XOZBVReH0nSp02ioF~S3vP3FS4PRJOxTT751RkX~izu1py3TwPks8hhE99LIhs1pjSYBSsqa-PzYvYBqrJcOrI5lcwergRIZ1lSiAXaoNDBGvrlFaKUnSGvyVRIcHsvC9g__" },
  { id: 14, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__7/image-b3e98093-f4be-4b92-b95b-fff6bd265f1c.png?Expires=2100945181&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=rtzz1aP6RWAocvqRH58-lFQtmKk3uYwtNJD3Sjkau41KoRKes9TP1-qljBc9tLmanV04PGg4QVuQTkxFeTNG47ys~DAVVqYgMZxJ~3G4B-nJha9pqNSm3u6U3nDun03-sx~AQpoT-3Pti3GCruYICWv4V6gd~9EPaSDJBqCB1dG7MEHJGXQQP6k5W4sD3iCdWirhTm63ADMSEQ1GhCszMYJ0rQOaDWNZYJA6BUO3Oq5Qb-ENqEK2HC7UJqh4E0I6MW-gfP9v9nmm~I4mInI2fdygkJK2uturGKX9evjMrLx5xODLTdQP8BRei3c9YyM6Vz-PP4n2wcVo2iHtcnXRUQ__" },
  { id: 15, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/image-371859e8-b1fe-430b-b6c5-6960411bee9f.png?Expires=2100945180&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=k6qdkCIjtKhrDNnaBONdJOwXCmJkrDP9hcvqiN9NvqsSllfRF6tIjpcIO62qK2sneGLMZi0Hqxfoz-nCOn6HFxcIfpTLz-DWhF9Hlc6vcJ09pZsF1TGPkqHdx2U245zNauXcUrihxdQgG9qXSoS1s1Ggve9wADoLafuQoJcPpZSVPeUrbiVBWVZKmuEy8HA-ByanbBbr79u4Cs3ZYxeyhK5hyV6szPlwYoWQ07Kz4O2FBQc5rTsVLyPTRaeQaixcnFESYnWDRH0YrpFLSqXCtnKlKpZSrqrvsoz7-sRU93twWZOJrO5XDs7V9Cf7e1cEp8Ujer60yyEEAsuFwE-J9Q__" },
  { id: 16, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-69f7f1d4-f6c3-4f5e-b5c4-c5510fdde4e7.png?Expires=2100945184&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=FTVV5SUWhbJadfZwK0Vl-GCZX4~R210GaZbQ1yrMG~Un0GWhKrzInqYU8gSVCJImPrK5fUv8fkIv3qZoE0nyJfp7bF6c8IhTDNLVucoZyR7tyCPUXz3MMJE~wG9O2DqKmOx2FsQAmYWui9ykiXK3llWlt5H9VlQ4fecXieFmx6GqKGZiXeaksxyaxv7vua-SODq7ZKMEYvIH67Ny2mVSOD0gUOtTP7tNwCkvNt6GDocDmuyUpLTHX5~3DLiOXgqhM0GXF~d9iRQOEw2D3cF0tzncl7hdGLQOCaK1I3W758zJot4TOn3M3Yth5RyHpgtlxSWijdb56rg8d9ML5anYJg__" },
  { id: 17, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__5/image-68de3334-2c11-43f0-9610-bd3876b531b8.png?Expires=2100945188&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=d1YWMzGl6S1fJZdOL4ikv34v4IREXEng6dtbhCFlhdBjrb2QN99rcK5c-gyzBoRhSJxvnUjJNqZ9j4TdkNaFandkhMb1afVBP7GigeYqLrVuS8dBISlqXuUDqQCQ0N6YdtD9YYAflsUAbuUcSbv2wUomLmU2P0oL7FNDFJ1v8wGN0q2m-1nVNeM5I4WoYwcFIk7svD4Whx~FIqSYMNqrNrmUKZbd58ImVYS-JnWoO66yuCDE4VBp2t3eG6kw7cZj5wSG0P3pxSnB4TfBUQOcVWOQCW5Jy1UiymZ9~MOu~0AgkuEebqvaqA0oNfLM76OcGgQuhsXDa3HmxfUmBJgapw__" },
  { id: 18, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/image-bdd2bfa2-82ca-4a51-93d2-51ad4839e7a9.png?Expires=2100945196&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=pt72GXDthMIMd7Z29CUFZnfy0i1T-jQhE2TDz~ZPAi-rsyONYcb-CfTTfY7hN9nipKnFTiQ55wjAhj-vo8qERRgmMZ2QdaeIROkJHH2MfyhK~Vsh-SzN3cct4jbBfYT7GdvABmENWvdLspxOsfhsO01~pPmGPZxFpfdrFKClJfKSGcWHEGO5WY6gumaMYtJC4pDuaM90V1LFwIdp-lm23KaynsioOfvJurhgp3UA5F7sDGi0s~8Oc7LHC3X3s7u2gK19lV~ltullIfFkFZ7wapluDMfbMaubVTKSuyWFgfae5JbWJTiDk1nKBY-zG9TKuoSo13eBxmOubvBP47~sEg__" },
  { id: 19, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__9/image-c16eae8c-af77-413a-b586-d34c73de17a3.png?Expires=2100945196&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=1tx~UIp3KLo~0t0Go4w8Bl~mIQ44nT1746RMqSaafnZJyyiUfYJR~ebNNIWlgvvTeGt2XtQWWWCOgwRTkUqlpk0b4MxLOsMT6IpVbRhUIhfPLXZna8oB8zVhVuknCqNrkB-JKbKjQuzjQ3WSZUuVk5~lJiq6u3zhqY479NSzrcALU7H9zKNzYlqPhtbRvH9W8WxavSbSU8bSlql49jT03CFM1ZDbMj6WM2EW~4i6m-jJ7WiRdcSjS4IsWHlwgqhGMBPsIMD23yHCx7gUUkTR9kuZacfvaua-z3Jy3tvLoARFG70bPXQd8JYmM6HOlbebIf1hH0vvff7SAmv9Kx9ztg__" },
  { id: 24, url: "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__4/image-2b9dde7d-0698-49e7-8de2-c4b37dd7e8e3.png?Expires=2100945203&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=0sA~fVL2~Jf9uznne~5OToLca7S~UleuZ83~HJs29c4MW6pJnGWNnHFEgsOXyWO-akjH70tTW3YyKPrrD0ArzzwRNCn4GUetVi3T0uB7FlWMVUfg1fSt1zO8t~XzXAJdKev92JcMVv9O0HKd5KIK1TYaJ21L-ojPzd0XOzD1sfH4Xob9J0DScm~FWbOJ6Y7OExRqdLum~oLsIaNLJ7Ja09xIv41~k0LLZEaX4xmN0KJEqs9wQWuCBBGVBI8Obw6Jp5YstvNe1WPWP3kehw5WV1iB9yXteDS~Jx5HiyKXQAEKASs6cFXciqDNoBTYHymYo4UyXqdFPO9wfwz7flqXwA__" },
];

export async function seedLabPathCoversOnce(): Promise<void> {
  if (hasRunLabPathCovers) return;
  hasRunLabPathCovers = true;
  try {
    for (const cover of LAB_PATH_COVERS) {
      try {
        const row = await pool.query(
          `SELECT id, image_url FROM learning_paths WHERE id = $1 LIMIT 1`,
          [cover.id],
        );
        if ((row.rowCount ?? 0) === 0) continue;
        const { image_url } = row.rows[0];
        if (image_url) {
          const s = String(image_url).trim();
          if (s.startsWith("/objects/") || s.startsWith("http")) continue;
        }
        const resp = await fetch(cover.url);
        if (!resp.ok) {
          console.error(`[startup-migration] lab-path-cover fetch failed for path ${cover.id}: ${resp.status}`);
          continue;
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        const objectPath = await uploadBufferAsPublicLabCover(buffer, "image/png");
        await pool.query(`UPDATE learning_paths SET image_url = $1 WHERE id = $2`, [objectPath, cover.id]);
        console.log(`[startup-migration] lab-path-cover set for path ${cover.id} -> ${objectPath}`);
      } catch (inner: any) {
        console.error(`[startup-migration] lab-path-cover failed for path ${cover.id}:`, inner?.message || inner);
      }
    }
  } catch (e: any) {
    console.error("[startup-migration] lab path covers failed:", e?.message || e);
  }
}

// ── Recipe images: rescue legacy /uploads/recipes/* into Object Storage ──────
// The original recipe photos live in the Repl's (gitignored) public/uploads/recipes
// and uploads/recipes folders, so they were never part of the Autoscale build and
// the deployed server can't serve them (relative /uploads/* paths fall through to
// the SPA). This copies each still-local file into Object Storage (which the
// deployment CAN serve) and repoints the recipe's image_url to /objects/...
//
// It only does anything where the local files are present (i.e. run once from the
// Repl dev server) — the shared DB + Object Storage mean the deployed app then
// serves the restored images. On the deployed server the files are absent, so it
// harmlessly reports them missing and skips. Idempotent: rows already on /objects/
// or http are left alone.
let hasRunRecipeImageRestore = false;

async function uploadBufferAsPublicRecipeImage(buffer: Buffer, contentType: string): Promise<string> {
  const svc = new ObjectStorageService();
  const privateDir = svc.getPrivateObjectDir();
  const trimmedDir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const entityId = `recipe-images/${randomUUID()}`;
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

export async function restoreRecipeImagesFromUploadsOnce(): Promise<void> {
  if (hasRunRecipeImageRestore) return;
  hasRunRecipeImageRestore = true;
  if (!process.env.PRIVATE_OBJECT_DIR || !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) return;

  let rows;
  try {
    rows = await pool.query(
      `SELECT id, image_url FROM recipes WHERE image_url LIKE '/uploads/recipes/%'`,
    );
  } catch (e: any) {
    console.error("[startup-migration] recipe-images restore query failed:", e?.message || e);
    return;
  }
  if ((rows.rowCount ?? 0) === 0) return;

  const ctByExt: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif",
  };
  const exists = async (p: string) => { try { await fs.access(p); return true; } catch { return false; } };

  // The running server's cwd may be a build subdirectory, so locate the folder
  // that actually holds the recipe uploads: walk up from cwd (plus a couple of
  // known Repl roots) and check where the first file really is, then reuse that
  // base for every recipe.
  const sampleRel = String(rows.rows[0].image_url).replace(/^\//, "");
  const roots: string[] = [];
  {
    let dir = process.cwd();
    for (let i = 0; i < 8; i++) { roots.push(dir); const parent = path.resolve(dir, ".."); if (parent === dir) break; dir = parent; }
    if (process.env.HOME) roots.push(path.join(process.env.HOME, "workspace"));
    roots.push("/home/runner/workspace");
  }
  let baseDir: string | null = null;
  let usePublic = false;
  for (const root of roots) {
    if (await exists(path.resolve(root, "public", sampleRel))) { baseDir = root; usePublic = true; break; }
    if (await exists(path.resolve(root, sampleRel))) { baseDir = root; usePublic = false; break; }
  }
  console.log(`[startup-migration] recipe-images: cwd=${process.cwd()} home=${process.env.HOME ?? ""} baseDir=${baseDir ?? "none"} usePublic=${usePublic}`);
  if (!baseDir) {
    console.log("[startup-migration] recipe-images: could not locate the local uploads folder; nothing migrated");
    return;
  }

  let migrated = 0, missing = 0, errors = 0;

  for (const r of rows.rows) {
    const url = String(r.image_url);
    try {
      const rel = url.replace(/^\//, ""); // uploads/recipes/<file>
      const filePath = usePublic ? path.resolve(baseDir, "public", rel) : path.resolve(baseDir, rel);
      if (!(await exists(filePath))) { missing++; continue; }

      const buffer = await fs.readFile(filePath);
      const contentType = ctByExt[path.extname(filePath).toLowerCase()] || "image/png";
      const objectPath = await uploadBufferAsPublicRecipeImage(buffer, contentType);
      await pool.query(`UPDATE recipes SET image_url = $1 WHERE id = $2`, [objectPath, r.id]);
      migrated++;
    } catch (inner: any) {
      errors++;
      console.error(`[startup-migration] recipe-image restore failed for recipe ${r.id}:`, inner?.message || inner);
    }
  }
  console.log(`[startup-migration] recipe-images restore done: migrated=${migrated} missingLocalFile=${missing} errors=${errors}`);
}

// ── The Lab: life-stage & onboarding sections ───────────────────────────────
// Adds four new Lab topics — "Start Here" (new-user orientation), "For Men",
// "For Women" and "Over 50s" — with their paths and a set of "coming soon"
// placeholder lessons, so users can see what's planned before the videos are
// filmed. There is no API to create a topic, so this runs as a boot migration.
// Fully idempotent: topics are keyed by slug and paths by (topic, title) and
// are only created when absent; lessons are only added to a path that currently
// has no content, so re-runs never duplicate. Covers are added later (the tile
// falls back to its tint until then).
let hasRunLabLifeStage = false;

type LifeStagePath = { title: string; description: string; lessons: string[] };
type LifeStageTopic = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  orderIndex: number;
  paths: LifeStagePath[];
};

const LAB_LIFE_STAGE_TOPICS: LifeStageTopic[] = [
  {
    slug: "start-here",
    title: "Start Here",
    description: "New here? Get clear on what you want and how Meridian works for you.",
    icon: "🧭",
    orderIndex: 0,
    paths: [
      {
        title: "Getting Clear on What You Want",
        description: "Before the how, the what and the why — a short, honest look at where you are and where you want to go.",
        lessons: [
          "How Are You, Really?",
          "What You Want From Your Health",
          "Understanding Your Own Patterns",
          "Setting a Goal That Fits Your Life",
        ],
      },
      {
        title: "Getting the Most From Your AI Coach",
        description: "How to use your coach so it actually works for you.",
        lessons: [
          "What Your Coach Can Do",
          "How to Talk to Your Coach",
          "Turning a Conversation Into a Plan",
        ],
      },
    ],
  },
  {
    slug: "for-men",
    title: "For Men",
    description: "Health and training essentials for men.",
    icon: "♂️",
    orderIndex: 8,
    paths: [
      {
        title: "Men's Heart Health",
        description: "The single biggest health risk for most men — and the levers that move it.",
        lessons: [
          "Why Heart Health Matters",
          "Knowing Your Numbers",
          "Training Your Heart",
          "Eating for a Healthy Heart",
          "Stress, Sleep and Your Heart",
        ],
      },
      {
        title: "Men's Health Essentials",
        description: "The fundamentals of staying strong, lean and healthy through the years.",
        lessons: [
          "Building and Keeping Muscle",
          "Understanding Testosterone",
          "Why Belly Fat Matters",
          "Health Checks Worth Knowing About",
        ],
      },
    ],
  },
  {
    slug: "for-women",
    title: "For Women",
    description: "Health and training through every stage, from strength basics to menopause.",
    icon: "♀️",
    orderIndex: 9,
    paths: [
      {
        title: "Training Through Menopause",
        description: "What changes, why strength comes first, and how to protect your bones — capable, not fragile.",
        lessons: [
          "What Changes in Peri and Menopause",
          "Why Strength Training Comes First",
          "Protecting Your Bones",
          "Movement for Symptoms and Mood",
          "Protein and Nutrition Through Menopause",
        ],
      },
      {
        title: "Women's Health Essentials",
        description: "The fundamentals, minus the myths — strength, cycle, nutrition and pelvic health.",
        lessons: [
          "Strength Training: Myths and Truths",
          "Training With Your Cycle",
          "Iron, Protein and Bone Health",
          "Pelvic Floor Basics",
        ],
      },
    ],
  },
  {
    slug: "over-50s",
    title: "Over 50s",
    description: "Stay strong, capable and pain-free as you age.",
    icon: "🌿",
    orderIndex: 10,
    paths: [
      {
        title: "Eating Well After 50",
        description: "Fuelling your body for muscle, bone and energy as your needs change.",
        lessons: [
          "Protein as You Age",
          "Eating for Bone Density",
          "Muscle and Staying Strong",
          "Appetite, Hydration and Energy",
        ],
      },
      {
        title: "Strong and Pain-Free After 50",
        description: "Building real strength safely, with balance and joints in mind.",
        lessons: [
          "Setting Goals That Fit Your Age",
          "Building Strength Safely",
          "Balance and Staying on Your Feet",
          "Training Around Aches and Joints",
        ],
      },
    ],
  },
];

async function ensureLifeStageTopic(t: LifeStageTopic): Promise<number> {
  const existing = await pool.query(`SELECT id FROM learn_topics WHERE slug = $1 LIMIT 1`, [t.slug]);
  if ((existing.rowCount ?? 0) > 0) return existing.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO learn_topics (title, slug, description, icon, order_index, is_active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [t.title, t.slug, t.description, t.icon, t.orderIndex],
  );
  console.log(`[startup-migration] lab life-stage topic created: ${t.slug} -> ${ins.rows[0].id}`);
  return ins.rows[0].id;
}

async function ensureLifeStagePath(
  topicId: number,
  category: string,
  p: LifeStagePath,
  orderIndex: number,
): Promise<number> {
  const existing = await pool.query(
    `SELECT id FROM learning_paths WHERE topic_id = $1 AND title = $2 LIMIT 1`,
    [topicId, p.title],
  );
  if ((existing.rowCount ?? 0) > 0) return existing.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO learning_paths (title, description, topic_id, category, estimated_duration, order_index)
     VALUES ($1, $2, $3, $4, 0, $5) RETURNING id`,
    [p.title, p.description, topicId, category, orderIndex],
  );
  console.log(`[startup-migration] lab life-stage path created: "${p.title}" -> ${ins.rows[0].id}`);
  return ins.rows[0].id;
}

// Covers for the life-stage topics (by slug) and paths (by "slug::title"),
// ingested into our own Object Storage on boot — same pattern as the other Lab
// covers. Only fills a row whose image_url is still empty.
const LAB_LIFE_STAGE_TOPIC_COVERS: Record<string, string> = {
  "start-here": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__8/image-4b6f8c3d-2410-4a96-b2de-0ea12c8d8a96.png?Expires=2101056220&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=yKTWMJHo-NQBYkSGiMhJsapDTcDOBGLhovFJN87Bx4eG9X6QjjSPq3PE9k2rkkgckJuhUgT5WzkauPZGtPfx1EOPuMsqF7juChJsiaOsiBiFB4a4tvdwxSxtZlSwTEaLzSr2agjhe9FionwhrTp-7aY2KEOtSLPwjGTafviDVjSN-H3~97fzQPo0T~Ibw3e0PhdqvFBWbuDcoowBuxIP5AtelDLQxLs-JRed~-l4dLoy7gPA-OUrx6QidnC~xmu2vn-AZpfSNd2AbRRZJdrXxBqvYUMEUQbX7hwgxAeYRONbET-I6dcPPMQ~G92xSWwBFGq2Avg8ER0wD7HUXW5xaw__",
  "for-men": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__2/image-4a29b631-8e15-4082-af61-f1656040b201.png?Expires=2101056228&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=F~EyvyylfVu66o3gWObpKqmLMDhAfe14jKjj5BjJb5gLRWkMqqsRO~RV4MMfs-sqz8wg7--b851qv2szsjsvT9jNz8DjLecHr-804-tJyTvELsJDKL2lbScrQ2wiLEiV2kIOZePy4kjkqqzPGCQNdwgMcwYMVer0npKs82Ydkz1L3ugam4iGAaW69LWX~EcUwQ6ltBvdV9~WXo9fr~28fxAUmvTx5pP2pQIUrlzG0ndSYqLDFJd4M4Qe~65a3N7vtT4~EOqRCQBFZmazLM5Dy8FGUAxGoYVwvf7dCjNfB5x1-t~uSiIUQbekPNxpaqmQrgfNz4YcFwkkStdEtOtODw__",
  "for-women": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__9/image-a9eb5d9c-2ba0-443b-b198-07a3f34b61dc.png?Expires=2101056228&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=uPkqVbdNcAFR3~3klA1dOvr3M3p3mGQHpUvjCs3leJxy7kKHSX9LjHvgIy6KVgPVL1Ypy9dtm-uUQ3T-UmCIErYhFbUoe4nL3Hp84xz~HcaiEc-UTvKDGRVmskB4V1E2gRw7-SG49ohy11haP-7usObEhhmvy00ggzW3JXcttmEnhhI4SXg3Z42MqqhDDjVGiAmSM5o6~-HBVwXtkRd5Pwo5II0r3LqI338eb~2Ig2BzpbhRFdPgxMPOTkLs7yqDqI817YNVyVwcsunnM9vg0ID3brBtY8VfdWovL2L~tCnAe~8Xq18sYsHrRrfhPboGGfuDz3BrvRxuA~tCDM0JnQ__",
  "over-50s": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-9fef6dfa-1c70-4565-a5b3-870f7e2feebc.png?Expires=2101056234&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=SkrLUBbpHkQeUvDa9uTskRXmc8IQCpi2R74hkQS1JYEGi0LtlOiLXjRRq3Q3DisBCc5xqaKMCdAx-VTyJqCXVRuhsC8INAdam6TdmRUj1XS~cs5Rbpw7vJN9qpFiSQdoXeLIpRgXaHUL7o1gmL~HbCCXPHwU5UOPNi4DPcuf-AzObC57Nb3Cp5ps4xD49xYGsUhVmRe5XjTQh~ayzeknPF3kbUPny6uQu-~2U0Lv3p0-DQUY9OT~UvH7R7iGC2bhD5nbP9RBycl5KkWEG5A1Ifn2aIIY-2tXIqOJN3HS93tzCH6CjXvvGQ0nrcumNDM18Qvbq5TOc0FtbObQE4Cqxg__",
};

const LAB_LIFE_STAGE_PATH_COVERS: Record<string, string> = {
  "start-here::Getting Clear on What You Want": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-37894a09-3b7e-4e10-abfc-43aa64c52c34.png?Expires=2101056232&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=kuFpU7wPJlG3WMzAxk8tM43aeeWxvW4uStKsyUlG8uzpE~RveSab5DVwpnoktO-xiDzrRmz~WaXysyMlcekLop5qcSaLhEA0wenTEZ3Sn0VS8LdsCwWBsfixfUlmNtHmFzm0PegmWUgW8xLJ5iKXJLwrjzV7ojlGM-xb5N67HDZG2VgSoiGwg7MdJnYGPebpLBvxLBaCA4ykpph9gGfr1WRmpkUJ0azcLSiHg3LVgqPyA~RHks8m-bwKiJx0w1iBAls38ztyIoRumFqrR2BsyE2gjSB-E8iZXiCImciCAQgdurHPDdXW-40dqh0YrR~e9f9YznpblrGUNY16f5l7bA__",
  "start-here::Getting the Most From Your AI Coach": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__1/image-5991f388-7aae-42eb-b266-e05e1a397a8d.png?Expires=2101056243&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=uHG39sBZpD1fBl~utcFN5LAltAkVib90mau3r1xY3QrwwdZCMOuG0PFdzCVUSPkyMNtd8ljJgMYVlNbHzTpkyzYLGyOvDqThz2UlsFrmDbt2DJmWNylVa0oux7MXIZgZy7LcQjC~UL2rO1Mi3wvRDQz6S~8J8StHeEtiB5mudoyrOLJ-8LZd2bw-yAz7Z9bidVjyPn01To8irPEJdy9mcO-k7iWtR2O36E4Zqo-XW1ZpJp~3A4dt0xLxLiiFzsYWZTuVQsvBmzRc274LIVRMTMmbtQCQlxpCPNcXJsjlfEQroZnNhZK~xC8ZOrzCY3kKGsCYF-koHdWHK9efgzhYJA__",
  "for-men::Men's Heart Health": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__3/image-0efef156-278c-4ac8-8505-bf36bc116797.png?Expires=2101056245&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=LZQ2PJqll5M8FYfdc8JEZTlseLd3ZBf6HyZb9E8TS623h9zcjp40vmgxkUykUM9si5z1WLkJphFlVvk0S~t61z6n36KR7SQ9H8w7XpVXO4vaQr~OIiAj7wlqO9d1L8y-s1eBIphUkOwKBzWl8SVjF1NkbNELE6ulVtYgIyO4Ga0zyXOiMGFjCarPgHZLsZCzsNAVjXKdMyBI1bXBcV5i8VeV5phezlsr0s7NXMemKB5m7XA30tC0leLpOw0bdIe-~pybTypzUYauKr1GQOagyAYoLe3PXu7jn0LTZk2cKNKdd8sLyZg1VSyr2bO2RGumRWhEeXdOnNIqkX~8GwUFLA__",
  "for-men::Men's Health Essentials": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__5/image-17833be7-57f3-4460-a547-14f0121c7d88.png?Expires=2101056251&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=F7D88zf2YWscv2YBPjVrPCTzAivHDwImZDPYZVI7Oa8r0ilcOKu5u-eU5f1G4XSAyHtX1Jq30DRLAeV7PJUcHb6nLgatau6vmLFePjpVEjn2P-xTu3oOneDNLSbmcTEBFOZqHCqKKw3BxwLNJHaq3OKf2ES2AsJNkB7XjmbNVg4SVTH151njk2rK-JJ1M7~wuGR9327aRPQuACzpjI6qXygCfdD~hh3w9RV7luhX2zEGbDTIty-4rkit5uWFyvHqyR648UL9ZNRG-5CeR7oZnbIsnKNyKLzDUm6oJZElVtCku9SlnrDSJjF9kuxCEiAt7B9lXlsAXfFY6ONPFq-NCA__",
  "for-women::Training Through Menopause": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__9/image-cff40180-3e8c-4815-aa27-e748f7a5ec60.png?Expires=2101056264&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=hremvenA9caN7FwHGdzESpCrkIJpx8r2y0S9MZxaHACkZPtVqFoBaRPBSlXtRucHR8jbBD5xhhdrlq-uLghTZzfO2jrC35aJ1iLv4mTStnnrqepdg70IND1k~AZlvdsLlmrTwvEebAbr5iasM7mql3RKyXj6Qlctue4ND442RCuRBZAYjIW05VpKOkVwLjtv3b14c5245lAzcP~8Unvwl3HtpQn8~jwUfZjhENDiFHADc0Vq8ZXLHT8J2ONBYrTuIsa3BGO17XHgaXPl1FjEmPnn-UE2-6O1qIwVULoHy5ir7elnclkavH5scbkb-wDzuCVBk2dFdM5bqoovWYyxqg__",
  "for-women::Women's Health Essentials": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/image-798e7416-2fec-4902-a9a9-8de352a7f88e.png?Expires=2101056260&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=T6se4sVAbT-9xg3jjh7P2yOEWGXopUcvizmN4BbmLanVL6K0H3UhHwjBBDUXK7gSwybsesXarF~rmdBW42pizXqvuC33mzsdhNoU4yCUyKzScqrRpiNRntqCYsIHUDv9irZRuEDeCFTqehTex-7O0TY5Uk8sUBjM20UOeLx8OXqJewSjEfTgTTjg9U-LiCZ2YsFBXX39X7cRHNectuaLzrBCI12NlyopOLZEc0t2FTvQphZmZvbVGhmuWd0qOzh2~n3ZYOFXp6XHSF8sIylMckrtLtgeJn5zBkNSFfdbU1j1NombyUnwzg2WCZOO91WTN1OB1PzFepK-r4WZMe-uhQ__",
  "over-50s::Eating Well After 50": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__9/image-fbb08e84-0652-4569-932c-b43b2b98bb88.png?Expires=2101056269&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=ipwipmL9Fd2hQtsn6y01d9~BMoElxoLYIOVerKgQ~vSfjsR4FwbXe1aGJqqW0FwiYXfQ6kLlLA-Y1eNfqEKz7hVXvBkROigh4DpoPNQ5zkGrNwcVKk9gLf~D8fCogHcBEprjlEyJUPyvCyubf86LsA3iSke9lzDchkBz1j6E6R~XfdV9UcD4WE-IvKj-ZbWzdFoNy5TJg-7yi6ElxA6QMJ2VgZrxAd9oQTaJWLgcdOdSLF2Oj5afx9ji5KBLZxdTBpJJq9MXp5FJaRYsz-BJJfNlFyg8iRs2LujPW4xrg8amHLIME~DWxoOieTYP-kW6t6pmRRmm3XrlOVdhhp2DnQ__",
  "over-50s::Strong and Pain-Free After 50": "https://cms-toolkit-artifacts.artlist.io/content/-t-e-x-t_-t-o_-i-m-a-g-e-v1/media__6/image-a0f52d89-76ea-4465-9e2b-b47fe17751b2.png?Expires=2101056266&Key-Pair-Id=K2ZDLYDZI2R1DF&Signature=EOYWheSS6Ayg-mKwt4Hndg1YSTgsiK~-5TOOXDU-FnrZj21NtmSL3wXHFZVDYRnThfoVnhbrPEkfR~GaZ0Q6F5WvBk0zv4n5rQQtwpdqGjCpt2h6K5vCwGGiodAZVvh3-l05gyXCmNU6DKIA0O8-slAA4yBbHFyQ8v-iOwV68W7Iq~2GyNitgemm3-cdrOkHi1XaZsIPLDkvtpXZQ2QKQSgbe5D8rRSny2cXy9IKrSAc-2sEfmoyhuVK7x0-ATgcu1bB~3rZ5MFiUoERPEOWiB3vNzsPN81GKZx0brDvn5VW9udI9W5jzqncrCiQjhVH5LxDuUhT7psRF8rFBWZ9ug__",
};

async function ingestLifeStageCover(
  table: "learn_topics" | "learning_paths",
  id: number,
  url: string | undefined,
): Promise<void> {
  if (!url) return;
  try {
    const row = await pool.query(`SELECT image_url FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    if ((row.rowCount ?? 0) === 0) return;
    const current = row.rows[0].image_url;
    if (current) {
      const s = String(current).trim();
      if (s.startsWith("/objects/") || s.startsWith("http")) return; // already set
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[startup-migration] life-stage cover fetch failed for ${table} ${id}: ${resp.status}`);
      return;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const objectPath = await uploadBufferAsPublicLabCover(buffer, "image/png");
    await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2`, [objectPath, id]);
    console.log(`[startup-migration] life-stage cover set for ${table} ${id} -> ${objectPath}`);
  } catch (e: any) {
    console.error(`[startup-migration] life-stage cover failed for ${table} ${id}:`, e?.message || e);
  }
}

export async function seedLabLifeStageOnce(): Promise<void> {
  if (hasRunLabLifeStage) return;
  hasRunLabLifeStage = true;
  try {
    for (const topic of LAB_LIFE_STAGE_TOPICS) {
      try {
        const topicId = await ensureLifeStageTopic(topic);
        await ingestLifeStageCover("learn_topics", topicId, LAB_LIFE_STAGE_TOPIC_COVERS[topic.slug]);
        for (let pi = 0; pi < topic.paths.length; pi++) {
          const p = topic.paths[pi];
          const pathId = await ensureLifeStagePath(topicId, topic.slug, p, pi);
          await ingestLifeStageCover("learning_paths", pathId, LAB_LIFE_STAGE_PATH_COVERS[`${topic.slug}::${p.title}`]);
          // Only seed placeholders into a path that has no content yet, so a
          // re-run (or a later boot) never duplicates lessons.
          const existingContent = await storage.getPathContentFromLibrary(pathId);
          if ((existingContent?.length ?? 0) > 0) continue;
          for (let li = 0; li < p.lessons.length; li++) {
            const item = await storage.createContentLibraryItem({
              topicId,
              title: p.lessons[li],
              description: "Coming soon",
              contentType: "coming_soon",
              contentUrl: "coming-soon",
              isRequired: true,
            } as any);
            await storage.addContentToPath(pathId, item.id, li);
          }
          console.log(`[startup-migration] lab life-stage lessons seeded for path ${pathId} (${p.lessons.length})`);
        }
      } catch (inner: any) {
        console.error(`[startup-migration] lab life-stage failed for ${topic.slug}:`, inner?.message || inner);
      }
    }
  } catch (e: any) {
    console.error("[startup-migration] lab life-stage seed failed:", e?.message || e);
  }
}
