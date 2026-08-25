import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[process] Unhandled promise rejection (kept alive)");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[process] Uncaught exception (kept alive)");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  const server = await registerRoutes(app);

  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    logger.info({ port }, "Server listening");

    import("./startupMigrations").then(({ runSchemaSelfHealOnce, runProfileImageMigrationOnce, seedMeditationsOnce, seedAiPromptsOnce, repairBodyweightGoalUnitsOnce, normalizeRecipeMacrosOnce, seedBadgesV2Once, retireDroppedDeskBadgesOnce, fixHabitTemplateDescriptionsOnce, seedReadinessBadgesOnce, dedupeCheckInsOnce, backfillContentTagsOnce, revokeEmptyBurnoutBadgesOnce, revokeEmptyAiBadgesOnce, revokeInvalidPerfectRecordOnce, seedLabTopicCoversOnce, seedLabPathCoversOnce, seedLabLifeStageOnce, stripEmDashesFromDescriptionsOnce, restoreRecipeImagesFromUploadsOnce, reconcileBreathworkDurationsOnce, seedBreathworkTechniquesV2Once, backfillBriefingConversationsOnce }) => {
      runSchemaSelfHealOnce()
        .catch((e: any) => logger.error({ e }, "[startup-migration] schema self-heal failed"))
        .then(() => {
          runProfileImageMigrationOnce().catch((e: any) => logger.error({ e }, "[startup-migration] profile-images failed"));
          seedMeditationsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] meditations failed"));
          seedAiPromptsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] ai-prompts failed"));
          repairBodyweightGoalUnitsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] bodyweight-goal-repair failed"));
          normalizeRecipeMacrosOnce().catch((e: any) => logger.error({ e }, "[startup-migration] recipe-macros-normalize failed"));
          seedBadgesV2Once().catch((e: any) => logger.error({ e }, "[startup-migration] badges-v2 failed"));
          retireDroppedDeskBadgesOnce().catch((e: any) => logger.error({ e }, "[startup-migration] retire-desk-badges failed"));
          fixHabitTemplateDescriptionsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] habit-template-descriptions failed"));
          seedReadinessBadgesOnce().catch((e: any) => logger.error({ e }, "[startup-migration] readiness-badges failed"));
          dedupeCheckInsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] dedupe-check-ins failed"));
          backfillContentTagsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] content-tag backfill failed"));
          revokeEmptyBurnoutBadgesOnce().catch((e: any) => logger.error({ e }, "[startup-migration] revoke empty burnout badges failed"));
          revokeEmptyAiBadgesOnce().catch((e: any) => logger.error({ e }, "[startup-migration] revoke empty AI badges failed"));
          revokeInvalidPerfectRecordOnce().catch((e: any) => logger.error({ e }, "[startup-migration] revoke invalid Perfect Record failed"));
          seedLabTopicCoversOnce().catch((e: any) => logger.error({ e }, "[startup-migration] lab topic covers failed"));
          seedLabPathCoversOnce().catch((e: any) => logger.error({ e }, "[startup-migration] lab path covers failed"));
          seedLabLifeStageOnce().catch((e: any) => logger.error({ e }, "[startup-migration] lab life-stage failed"));
          stripEmDashesFromDescriptionsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] strip em dashes from descriptions failed"));
          restoreRecipeImagesFromUploadsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] recipe-images restore failed"));
          reconcileBreathworkDurationsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] breathwork-durations failed"));
          seedBreathworkTechniquesV2Once().catch((e: any) => logger.error({ e }, "[startup-migration] breathwork-techniques-v2 failed"));
          backfillBriefingConversationsOnce().catch((e: any) => logger.error({ e }, "[startup-migration] briefing-conversation-backfill failed"));
        });
    }).catch((e: any) => logger.error({ e }, "[startup-migration] startup migrations import failed"));

    // Content write-ups backfill: description + summary/takeaways/transcript for
    // Mux lab videos, once per database (production included). Ensures the columns
    // exist so the patched API never errors, then populates them via AI.
    import("./startupMigrations").then(({ backfillWriteupsOnce }) => {
      backfillWriteupsOnce().catch((e) => {
        console.error("[startup-migration] content write-ups backfill failed:", e);
      });
    }).catch((e) => console.error("[startup-migration] content write-ups import failed:", e));
    import("./aiGeneratorMigration").then(({ runAiGeneratorMigrationOnce }) => {
      runAiGeneratorMigrationOnce().catch((e: any) => logger.error({ e }, "[startup-migration] ai-generator failed"));
    }).catch((e: any) => logger.error({ e }, "[startup] ai-generator import failed"));

    // WWI demo cohort: seeds an isolated "WWI Demo" company so the Wellbeing
    // Index page can be shown fully populated. Idempotent (skips if present).
    import("./wwiDemoSeed").then(({ seedWwiDemoOnce }) => {
      seedWwiDemoOnce().catch((e: any) => logger.error({ e }, "[startup-migration] wwi-demo failed"));
    }).catch((e: any) => logger.error({ e }, "[startup-migration] wwi-demo import failed"));

    // Workforce Rewards (Phase 1a): create the reward tables on boot if missing.
    import("./rewardsEngine").then(({ ensureRewardsSchemaOnce }) => {
      ensureRewardsSchemaOnce().catch((e: any) => logger.error({ e }, "[startup] rewards schema ensure failed"));
    }).catch((e: any) => logger.error({ e }, "[startup] rewards engine import failed"));

    import("./microResetSeed").then(({ runMicroResetImport }) => {
      runMicroResetImport({ skipCaptions: true }).then((r: any) => {
        if (r.inserted > 0) {
          logger.info({ inserted: r.inserted, skipped: r.skippedExisting }, "[startup-migration] micro-reset seed done");
        }
      }).catch((e: any) => logger.error({ e }, "[startup-migration] micro-reset seed failed"));
    }).catch((e: any) => logger.error({ e }, "[startup] micro-reset seed import failed"));

    import("./wearables/scheduler").then(({ startWearableScheduler }) => {
      startWearableScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] wearables scheduler failed"));

    import("./ouraSubscriptionScheduler").then(({ startOuraSubscriptionScheduler }) => {
      startOuraSubscriptionScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] oura subscription scheduler failed"));

    // Engagement activity log: create it and backfill from the retired
    // points_transactions ledger if it's empty.
    import("./engagementEngine").then(({ ensureActivityLogOnce }) => {
      ensureActivityLogOnce().catch((e: any) => logger.error({ e }, "[startup] activity log ensure failed"));
    }).catch((e: any) => logger.error({ e }, "[startup] engagement engine import failed"));

    import("./rewardsScheduler").then(({ startRewardsScheduler }) => {
      startRewardsScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] rewards scheduler failed"));

    import("./baselineScheduler").then(({ startBaselineScheduler }) => {
      startBaselineScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] baseline scheduler failed"));

    import("./scheduledBriefings").then(({ startBriefingScheduler }) => {
      startBriefingScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] briefings scheduler failed"));

    import("./weeklyCheckinScheduler").then(({ startWeeklyCheckinScheduler }) => {
      startWeeklyCheckinScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] weekly check-in scheduler failed"));

    import("./pushNotificationScheduler").then(({ startPushNotificationScheduler }) => {
      startPushNotificationScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] push notification scheduler failed"));

    import("./accountabilityEngine").then(({ startAccountabilityEngine }) => {
      startAccountabilityEngine();
    }).catch((e: any) => logger.error({ e }, "[startup] accountability engine failed"));

    import("./community").then(({ startCommunityScheduler }) => {
      startCommunityScheduler();
    }).catch((e: any) => logger.error({ e }, "[startup] community scheduler failed"));
  });
})();
