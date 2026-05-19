import cors from 'cors';
import express, { type Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { video } from "./mux";
import { runProfileImageMigrationOnce, seedMeditationsOnce, runSchemaSelfHealOnce, seedAiPromptsOnce, repairBodyweightGoalUnitsOnce } from "./startupMigrations";

const app = express();

app.use(cors({ origin: true, credentials: true }));

app.post("/api/mux/uploads", async (req, res) => {
  try {
    const upload = await video.uploads.create({
      new_asset_settings: {
        playback_policy: ["signed"],
      },
      cors_origin: "*",
    });
    res.json({
      uploadId: upload.id,
      uploadUrl: upload.url,
    });
  } catch (error) {
    console.error("Mux upload error:", error);
    res.status(500).json({ error: "Failed to create upload link" });
  }
});

// Most endpoints take small JSON. Image-upload endpoints opt-in to a higher
// limit at the route level. The previous 50mb global was a denial-of-service
// surface (an attacker could spam huge bodies and exhaust memory).
const LARGE_BODY_PATHS = [
  "/api/workday/analyze-desk",
  "/api/admin/workday/desk-references",
  "/api/users/me/profile-image",
  "/api/admin/companies",
  "/api/progress/pictures",
  "/api/my/recipes/ideas-from-photo",
  "/api/my/recipes/expand-idea",
];
// Pre-parser per-IP throttle on the large-body AI photo routes. Sits in front
// of the JSON parser so that an unauthenticated attacker can't repeatedly
// stream 12 MB bodies into memory before the route's auth/rate-limit kicks
// in. The per-user AI rate limiter still applies inside the route itself.
const largeBodyIpLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip),
  message: { message: "Too many requests. Slow down and try again." },
});
app.use((req, res, next) => {
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  if (!isLarge) return next();
  return largeBodyIpLimit(req, res, next);
});

app.use((req, res, next) => {
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  const limit = isLarge ? "12mb" : "2mb";
  return express.json({ limit })(req, res, () =>
    express.urlencoded({ extended: false, limit })(req, res, next),
  );
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Fire-and-forget: convert any base64 profile pictures left in the DB to
    // cloud storage. Idempotent — does nothing on subsequent boots once done.
    runSchemaSelfHealOnce()
      .catch((e) => {
        console.error("[startup-migration] schema self-heal failed:", e);
      })
      .then(() => {
        // Run table-dependent migrations only after self-heal has had a chance
        // to create any missing tables.
        runProfileImageMigrationOnce().catch((e) => {
          console.error("[startup-migration] profile-images failed:", e);
        });
        seedMeditationsOnce().catch((e) => {
          console.error("[startup-migration] meditations failed:", e);
        });
        seedAiPromptsOnce().catch((e) => {
          console.error("[startup-migration] ai-prompts failed:", e);
        });
        repairBodyweightGoalUnitsOnce().catch((e) => {
          console.error("[startup-migration] bodyweight-goal-repair failed:", e);
        });
      });
    import("./aiGeneratorMigration").then(({ runAiGeneratorMigrationOnce }) => {
      runAiGeneratorMigrationOnce().catch((e) => {
        console.error("[startup-migration] ai-generator failed:", e);
      });
    }).catch((e) => console.error("[startup-migration] ai-generator import failed:", e));
    // Start wearables sync scheduler
    import("./wearables/scheduler").then(({ startWearableScheduler }) => {
      startWearableScheduler();
    }).catch((e) => console.error("[startup] wearables scheduler failed:", e));
    // Start daily morning training briefing scheduler
    import("./scheduledBriefings").then(({ startBriefingScheduler }) => {
      startBriefingScheduler();
    }).catch((e) => console.error("[startup] briefings scheduler failed:", e));
    // Start Monday weekly check-in email scheduler
    import("./weeklyCheckinScheduler").then(({ startWeeklyCheckinScheduler }) => {
      startWeeklyCheckinScheduler();
    }).catch((e) => console.error("[startup] weekly check-in scheduler failed:", e));
  });
})();