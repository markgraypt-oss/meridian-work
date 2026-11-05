import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS: an explicit allowlist. `origin: true` reflected ANY website's origin
// with credentials, so any page a logged-in admin visited could call this API
// as them and read the answers. The admin portal is served from this same
// origin (no CORS needed); the website's public forms post without
// credentials; the mobile app sends no Origin header at all.
const CORS_ALLOWED = new Set(
  [
    "https://meridian.work",
    "https://www.meridian.work",
    "https://api.meridian.work",
    "https://meridian-work-eu.replit.app",
    ...(process.env.CORS_EXTRA_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  ],
);
const isDev = process.env.NODE_ENV !== "production";
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // native app, curl, same-origin
      if (CORS_ALLOWED.has(origin)) return cb(null, true);
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      if (/\.replit\.dev$/.test(new URL(origin).hostname)) return cb(null, true); // Replit workspace preview
      return cb(null, false);
    },
    credentials: true,
  }),
);

const LARGE_BODY_PATHS = [
  "/api/workday/analyze-desk",
  "/api/admin/workday/desk-references",
  "/api/users/me/profile-image",
  "/api/admin/companies",
  "/api/progress/pictures",
  "/api/my/recipes/ideas-from-photo",
  "/api/my/recipes/expand-idea",
];

const largeBodyIpLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip),
  message: { message: "Too many requests. Slow down and try again." },
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  if (!isLarge) return next();
  return largeBodyIpLimit(req, res, next);
});

// Webhook endpoints verify an HMAC signature over the EXACT raw bytes, so the
// global JSON parser must not touch them — it was consuming the stream and
// handing the route a parsed Object, which made Buffer.from() throw and every
// WHOOP/Oura webhook crash before it could trigger a sync (broken since the
// webhooks shipped). These paths use their own express.raw() at the route.
const RAW_BODY_PATHS = [
  "/api/wearables/whoop/webhook",
  "/api/wearables/oura/webhook",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (RAW_BODY_PATHS.includes(req.path)) return next();
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  const limit = isLarge ? "12mb" : "2mb";
  return express.json({ limit })(req, res, () =>
    express.urlencoded({ extended: false, limit })(req, res, next),
  );
});

// Global error handler — catches anything that escapes route try/catch blocks
// (including unhandled async throws in Express 5). Returns JSON so the client
// always gets a parseable error body rather than Express's default plain-text
// "Internal Server Error" response.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err?.message ?? "Internal Server Error";
  logger.error({ err, status }, "[global-error-handler]");
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

export default app;
