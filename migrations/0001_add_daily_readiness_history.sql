-- Daily Readiness (Beta, User-Only) — see server/dailyReadiness.ts
-- One row per (user, date). Stores the six normalised inputs + the
-- computed 0-100 score so the algorithm can be re-run on history.
CREATE TABLE IF NOT EXISTS "daily_readiness_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "date" varchar NOT NULL,
  "sleep_input" real,
  "pain_input" real,
  "energy_input" real,
  "nutrition_input" real,
  "movement_input" real,
  "recovery_input" real,
  "input_count" integer DEFAULT 0 NOT NULL,
  "score" integer,
  "algorithm_version" varchar DEFAULT 'v1' NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "daily_readiness_history"
    ADD CONSTRAINT "daily_readiness_history_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_readiness_user_date"
  ON "daily_readiness_history" ("user_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_readiness_user"
  ON "daily_readiness_history" ("user_id");
