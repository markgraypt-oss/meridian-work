-- migrations/0002_add_pending_tables.sql
  --
  -- Adds tables defined in shared/schema.ts that were missing from the live DB
  -- as of the meditations rollout. Without these, startup logged
  --   [startup-migration] meditation seed failed: relation "meditations" does not exist
  -- and several features (notifications, push, recommendations, wearables,
  -- weekly check-ins, points, reports, shopping lists, AI call logs, etc.)
  -- could not function.
  --
  -- Idempotent: every CREATE uses IF NOT EXISTS; every foreign key is guarded
  -- with a pg_constraint check. Safe to re-run.
  --
  -- Also adds the (user_id, week_start) UNIQUE constraint on weekly_checkins
-- defined in shared/schema.ts to prevent duplicate weekly check-ins per user.
--
-- Apply non-interactively with:
  --   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0002_add_pending_tables.sql
  --
  -- This is preferred over `npm run db:push`, which prompts whether new
  -- tables (e.g. ai_call_logs) are renames of pre-existing legacy tables
  -- (appointments, program_exercises) and risks data loss if answered wrong.
  --
  
CREATE TABLE IF NOT EXISTS "ai_call_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar,
        "feature" text NOT NULL,
        "provider" text,
        "model" text,
        "prompt_hash" varchar,
        "prompt_tokens" integer,
        "completion_tokens" integer,
        "total_tokens" integer,
        "latency_ms" integer,
        "validation_outcome" text,
        "safety_flags" text[],
        "error_message" text,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
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
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_config" (
        "key" varchar PRIMARY KEY NOT NULL,
        "value" jsonb NOT NULL,
        "description" text,
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meditations" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "category" text NOT NULL,
        "duration_min" integer NOT NULL,
        "audio_url" text,
        "tags" text[],
        "is_active" boolean DEFAULT true NOT NULL,
        "order_index" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "data" jsonb,
        "in_app_delivered_at" timestamp DEFAULT now(),
        "email_delivered_at" timestamp,
        "push_delivered_at" timestamp,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_transactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "activity_type" varchar NOT NULL,
        "base_points" integer NOT NULL,
        "multiplier" real DEFAULT 1 NOT NULL,
        "awarded_points" integer NOT NULL,
        "capped_reason" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_generations" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar,
        "kind" text NOT NULL,
        "inputs" jsonb NOT NULL,
        "raw_response" jsonb,
        "provider" text,
        "model" text,
        "program_id" integer,
        "workout_id" integer,
        "ai_call_log_id" integer,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" text,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation_dismissals" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "content_type" text NOT NULL,
        "content_id" integer NOT NULL,
        "until" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendations" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "content_type" text NOT NULL,
        "content_id" integer NOT NULL,
        "score" integer DEFAULT 50 NOT NULL,
        "rationale" text NOT NULL,
        "rank" integer DEFAULT 0 NOT NULL,
        "source" text DEFAULT 'ai' NOT NULL,
        "generated_at" timestamp DEFAULT now() NOT NULL
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_narrative_feedback" (
        "id" serial PRIMARY KEY NOT NULL,
        "narrative_id" integer,
        "company_name" varchar NOT NULL,
        "window_key" varchar NOT NULL,
        "snapshot_hash" varchar NOT NULL,
        "reported_by_user_id" varchar,
        "category" varchar NOT NULL,
        "comment" text,
        "provider" varchar,
        "model" varchar,
        "validation_outcome" varchar,
        "safety_flags" text[],
        "status" varchar DEFAULT 'open' NOT NULL,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_narratives" (
        "id" serial PRIMARY KEY NOT NULL,
        "company_name" varchar NOT NULL,
        "window_key" varchar NOT NULL,
        "snapshot_hash" varchar NOT NULL,
        "narrative" jsonb NOT NULL,
        "provider" varchar,
        "model" varchar,
        "validation_outcome" varchar,
        "safety_flags" text[],
        "cohort_size" integer NOT NULL,
        "suppressed" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "company_name" varchar,
        "min_cohort_size" integer DEFAULT 5 NOT NULL,
        "severity_threshold" integer DEFAULT 4 NOT NULL,
        "trend_threshold" real DEFAULT 0.2 NOT NULL,
        "burnout_bands" jsonb DEFAULT '[20,40,60,80]'::jsonb NOT NULL,
        "narrative_max_age_minutes" integer DEFAULT 60 NOT NULL,
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopping_lists" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "meal_plan_id" integer NOT NULL,
        "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "ai_generated" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_points" (
        "user_id" varchar PRIMARY KEY NOT NULL,
        "total_points" integer DEFAULT 0 NOT NULL,
        "week_points" integer DEFAULT 0 NOT NULL,
        "week_start" varchar,
        "level" integer DEFAULT 1 NOT NULL,
        "level_name" varchar DEFAULT 'Explorer' NOT NULL,
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_track_streaks" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "track" varchar NOT NULL,
        "current_streak" integer DEFAULT 0 NOT NULL,
        "longest_streak" integer DEFAULT 0 NOT NULL,
        "last_activity_date" varchar,
        "freezes_available" integer DEFAULT 0 NOT NULL,
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wearable_connections" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "provider" text NOT NULL,
        "status" text DEFAULT 'connected' NOT NULL,
        "access_token_enc" text,
        "refresh_token_enc" text,
        "token_expires_at" timestamp,
        "provider_user_id" text,
        "scopes" text[],
        "connected_at" timestamp DEFAULT now(),
        "last_sync_at" timestamp,
        "last_sync_status" text,
        "last_sync_error" text,
        "meta" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wearable_metrics_daily" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "provider" text NOT NULL,
        "date" text NOT NULL,
        "sleep_minutes" integer,
        "sleep_deep_minutes" integer,
        "sleep_rem_minutes" integer,
        "sleep_light_minutes" integer,
        "sleep_awake_minutes" integer,
        "sleep_score" integer,
        "hrv_ms" integer,
        "resting_hr_bpm" integer,
        "steps" integer,
        "active_minutes" integer,
        "calories_burned" integer,
        "readiness_score" integer,
        "strain_score" integer,
        "workout_count" integer,
        "raw" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wearable_sync_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "provider" text NOT NULL,
        "status" text NOT NULL,
        "started_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "days_synced" integer DEFAULT 0,
        "error_message" text,
        "trigger" text
);;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_checkins" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "week_start" timestamp NOT NULL,
        "payload" jsonb NOT NULL,
        "accepted_suggestions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
        "dismissed_suggestions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
        "points_awarded_at" timestamp,
        "generated_at" timestamp DEFAULT now() NOT NULL
);;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_readiness_history_user_id_users_id_fk') THEN
      ALTER TABLE "daily_readiness_history" ADD CONSTRAINT "daily_readiness_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_users_id_fk') THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'points_transactions_user_id_users_id_fk') THEN
      ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_users_id_fk') THEN
      ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_dismissals_user_id_users_id_fk') THEN
      ALTER TABLE "recommendation_dismissals" ADD CONSTRAINT "recommendation_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_user_id_users_id_fk') THEN
      ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_narrative_feedback_narrative_id_report_narratives_id_fk') THEN
      ALTER TABLE "report_narrative_feedback" ADD CONSTRAINT "report_narrative_feedback_narrative_id_report_narratives_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."report_narratives"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_narrative_feedback_reported_by_user_id_users_id_fk') THEN
      ALTER TABLE "report_narrative_feedback" ADD CONSTRAINT "report_narrative_feedback_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_lists_user_id_users_id_fk') THEN
      ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_lists_meal_plan_id_meal_plans_id_fk') THEN
      ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_points_user_id_users_id_fk') THEN
      ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_track_streaks_user_id_users_id_fk') THEN
      ALTER TABLE "user_track_streaks" ADD CONSTRAINT "user_track_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wearable_connections_user_id_users_id_fk') THEN
      ALTER TABLE "wearable_connections" ADD CONSTRAINT "wearable_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wearable_metrics_daily_user_id_users_id_fk') THEN
      ALTER TABLE "wearable_metrics_daily" ADD CONSTRAINT "wearable_metrics_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wearable_sync_logs_user_id_users_id_fk') THEN
      ALTER TABLE "wearable_sync_logs" ADD CONSTRAINT "wearable_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weekly_checkins_user_id_users_id_fk') THEN
      ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_call_logs_feature" ON "ai_call_logs" USING btree ("feature");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_call_logs_created_at" ON "ai_call_logs" USING btree ("created_at");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_readiness_user_date" ON "daily_readiness_history" USING btree ("user_id","date");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_readiness_user" ON "daily_readiness_history" USING btree ("user_id");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_points_tx_user_date" ON "points_transactions" USING btree ("user_id","created_at");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_program_generations_user" ON "program_generations" USING btree ("user_id");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_program_generations_created_at" ON "program_generations" USING btree ("created_at");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rec_dismissals_user" ON "recommendation_dismissals" USING btree ("user_id");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_rec_dismissals_user_content" ON "recommendation_dismissals" USING btree ("user_id","content_type","content_id");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recommendations_user" ON "recommendations" USING btree ("user_id");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recommendations_user_type" ON "recommendations" USING btree ("user_id","content_type");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_recommendations_user_content" ON "recommendations" USING btree ("user_id","content_type","content_id");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_narrative_feedback_company" ON "report_narrative_feedback" USING btree ("company_name");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_narrative_feedback_snapshot" ON "report_narrative_feedback" USING btree ("snapshot_hash");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_narrative_feedback_status" ON "report_narrative_feedback" USING btree ("status");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_report_narrative_unique" ON "report_narratives" USING btree ("company_name","window_key","snapshot_hash");;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_narrative_company" ON "report_narratives" USING btree ("company_name");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_report_settings_company" ON "report_settings" USING btree ("company_name");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_report_settings_global_singleton" ON "report_settings" USING btree ("company_name") WHERE "report_settings"."company_name" IS NULL;;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_track_streak_unique" ON "user_track_streaks" USING btree ("user_id","track");;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wearable_metrics_user_date_provider_idx" ON "wearable_metrics_daily" USING btree ("user_id","date","provider");;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weekly_checkins_user_id_week_start_unique') THEN
    ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_week_start_unique" UNIQUE ("user_id", "week_start");
  END IF;
END $$;
