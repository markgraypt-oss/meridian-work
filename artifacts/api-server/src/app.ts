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

app.use(cors({ origin: true, credentials: true }));

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

app.use((req: Request, res: Response, next: NextFunction) => {
  const isLarge = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p));
  const limit = isLarge ? "12mb" : "2mb";
  return express.json({ limit })(req, res, () =>
    express.urlencoded({ extended: false, limit })(req, res, next),
  );
});

export default app;
