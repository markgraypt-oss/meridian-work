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

    import("./startupMigrations").then(({ runSchemaSelfHealOnce, runProfileImageMigrationOnce, seedMeditationsOnce, seedAiPromptsOnce, repairBodyweightGoalUnitsOnce, normalizeRecipeMacrosOnce, seedBadgesV2Once, retireDroppedDeskBadgesOnce, fixHabitTemplateDescriptionsOnce, seedReadinessBadgesOnce, dedupeCheckInsOnce, backfillContentTagsOnce }) => {
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
  });
})();
