import { storage } from "./storage";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";

let hasRunProfileImages = false;
let hasRunMeditationSeed = false;
let hasRunSchemaSelfHeal = false;

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
