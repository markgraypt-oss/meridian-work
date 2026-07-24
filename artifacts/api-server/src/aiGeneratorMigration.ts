import { sql } from "drizzle-orm";
import { db } from "./db";

let hasRun = false;

/**
 * Idempotent boot-time migration for AI Programme & Workout Generator.
 * Adds new columns and the program_generations audit table without requiring
 * a drizzle-kit push (which hangs in this repo per existing project notes).
 */
export async function runAiGeneratorMigrationOnce(): Promise<void> {
  if (hasRun) return;
  hasRun = true;
  try {
    await db.execute(sql`
      ALTER TABLE programs
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS generation_inputs jsonb;
    `);
    await db.execute(sql`
      ALTER TABLE workouts
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS generation_inputs jsonb;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS program_generations (
        id serial PRIMARY KEY,
        user_id varchar,
        kind text NOT NULL,
        inputs jsonb NOT NULL,
        raw_response jsonb,
        provider text,
        model text,
        program_id integer,
        workout_id integer,
        ai_call_log_id integer,
        created_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_program_generations_user
        ON program_generations(user_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_program_generations_created_at
        ON program_generations(created_at);
    `);
  } catch (e: any) {
    console.error("[startup-migration] ai-generator failed:", e?.message || e);
  }
}
