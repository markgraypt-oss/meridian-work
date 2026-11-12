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
  // Garmin: parsed by its own express.json with a bigger limit (summaries
  // can carry per-15-second heart rate samples).
  "/api/wearables/garmin/webhook",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (RAW_BODY_PATHS.includes(req.path)) return next();
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  const limit = isLarge ? "12mb" : "2mb";
  return express.json({ limit })(req, res, () =>
    express.urlencoded({ extended: false, limit })(req, res, next),
  );
});

// Response-size watchdog. On 8 Nov 2026 two endpoints were found sending
// 1.75 MB and 1 MB to the phone on every refresh, which stalled the app for
// seconds at a time, and nothing had flagged it. Anything over the limit is
// logged with its path, and the biggest responses since start are kept for
// /api/admin/response-sizes, so an oversized payload is seen before users
// feel it.
export const OVERSIZED_RESPONSE_BYTES = 250 * 1024;
export const responseSizeLog: { path: string; bytes: number; at: string }[] = [];
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith("/api/")) return next();
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(body) ?? "");
      if (bytes > OVERSIZED_RESPONSE_BYTES) {
        const path = req.route?.path ? req.baseUrl + req.route.path : req.path;
        logger.warn({ path, bytes, kb: Math.round(bytes / 1024) }, "[response-size] oversized API response");
        const existing = responseSizeLog.find((r) => r.path === path);
        if (existing) { if (bytes > existing.bytes) { existing.bytes = bytes; existing.at = new Date().toISOString(); } }
        else responseSizeLog.push({ path, bytes, at: new Date().toISOString() });
        responseSizeLog.sort((x, y) => y.bytes - x.bytes);
        if (responseSizeLog.length > 50) responseSizeLog.length = 50;
      }
    } catch {}
    return originalJson(body);
  }) as any;
  next();
});

// No image is ever saved into the database as base64 text. Any write that
// carries one in an image field has it moved to object storage first, and the
// route sees the stored path instead. Progress photos handle their own (they
// are private and owned by the user), so that path is left alone.
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  if (!["POST", "PUT", "PATCH"].includes(req.method) || !req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/progress/pictures")) return next();
  try {
    const { replaceInlineImagesInBody } = await import("./imageNormalise");
    const replaced = await replaceInlineImagesInBody(req.body);
    if (replaced.length) logger.info({ path: req.path, fields: replaced }, "[images] inline image moved to storage");
  } catch (err: any) {
    logger.error({ err }, "[images] inline image middleware failed");
  }
  next();
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
