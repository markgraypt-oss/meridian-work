import cors from 'cors';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { video } from "./mux";

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const IMAGE_FIELD_RE = /(image|photo|thumbnail|avatar|picture|logo|cover)/i;
const isBadImageUrl = (v: any) =>
  typeof v === 'string' && (v.startsWith('/uploads/') || v.trim() === '');
function scrubBrokenImageUrls(node: any): any {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = scrubBrokenImageUrls(node[i]);
    return node;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const val = node[k];
      if (IMAGE_FIELD_RE.test(k) && k.toLowerCase().endsWith('url') && isBadImageUrl(val)) {
        node[k] = null;
      } else if (val && typeof val === 'object') {
        scrubBrokenImageUrls(val);
      }
    }
  }
  return node;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    if (path.startsWith('/api')) {
      try { bodyJson = scrubBrokenImageUrls(bodyJson); } catch {}
    }
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
  });
})();