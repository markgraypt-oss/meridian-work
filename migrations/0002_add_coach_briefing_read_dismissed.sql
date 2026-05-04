-- Add read/dismissed timestamps to coach_briefings so the briefing's
-- read state can persist across devices once it's surfaced in the
-- Coach FAB panel rather than the dashboard card.
ALTER TABLE "coach_briefings"
  ADD COLUMN IF NOT EXISTS "read_at" timestamp;
--> statement-breakpoint
ALTER TABLE "coach_briefings"
  ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp;
