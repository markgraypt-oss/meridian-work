import type { Express } from "express";
import multer from "multer";
import crypto from "crypto";
import { isAuthenticated } from "../replitAuth";
import {
  ADAPTERS,
  PROVIDER_LABELS,
  buildRedirectUri,
  disconnectProvider,
  getAdapter,
  getConnections,
  syncProvider,
  upsertConnection,
} from "./index";
import { parseAppleHealthExport } from "./appleHealth";
import type { WearableProvider } from "./types";

const PROVIDERS: WearableProvider[] = ["oura", "whoop", "google_fit", "apple_health"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// OAuth state is stored on the user's *session* (not a global map) so that the
// callback can only be completed by the same browser that initiated the flow.
// This prevents account-linking CSRF / session-swap attacks where one user
// could trick another into binding wearable tokens to a different account.
type OAuthState = { state: string; provider: WearableProvider; userId: string; redirectUri: string; expiresAt: number };
declare module "express-session" {
  interface SessionData {
    wearableOauth?: OAuthState;
  }
}

export function registerWearableRoutes(app: Express) {
  // Catalog: providers + whether configured
  app.get("/api/wearables/providers", isAuthenticated, async (_req, res) => {
    const out = PROVIDERS.map((p) => {
      const a = getAdapter(p);
      return {
        provider: p,
        label: PROVIDER_LABELS[p],
        oauth: !!a?.authUrl,
        configured: p === "apple_health" ? true : !!a?.isConfigured(),
      };
    });
    res.json(out);
  });

  // List user's connections (with public-safe fields)
  app.get("/api/wearables/connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conns = await getConnections(userId);
      res.json(conns.map((c) => ({
        provider: c.provider,
        status: c.status,
        connectedAt: c.connectedAt,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastSyncError: c.lastSyncError,
        scopes: c.scopes,
      })));
    } catch (err) {
      console.error("[wearables] list connections error", err);
      res.status(500).json({ message: "Failed to fetch wearable connections" });
    }
  });

  // Begin OAuth flow: returns a redirect URL
  app.get("/api/wearables/connect/:provider", isAuthenticated, async (req: any, res) => {
    const provider = req.params.provider as WearableProvider;
    const adapter = getAdapter(provider);
    if (!adapter || !adapter.authUrl) {
      return res.status(400).json({ message: "Provider does not support OAuth" });
    }
    if (!adapter.isConfigured()) {
      return res.status(503).json({ message: `${PROVIDER_LABELS[provider]} is not configured. Admin must set credentials.` });
    }
    const userId = req.user.claims.sub;
    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = buildRedirectUri(req, provider);
    req.session.wearableOauth = { state, provider, userId, redirectUri, expiresAt: Date.now() + 10 * 60 * 1000 };
    await new Promise<void>((resolve, reject) => req.session.save((err: any) => (err ? reject(err) : resolve())));
    const url = adapter.authUrl(state, redirectUri);
    res.json({ url });
  });

  // OAuth callback. Requires an authenticated session and validates the state
  // bound to that session. Rejects if the callback is opened in a different
  // browser/session than initiated the flow, or for a different user.
  app.get("/api/wearables/callback/:provider", isAuthenticated, async (req: any, res) => {
    const provider = req.params.provider as WearableProvider;
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;
    const sessionUserId = req.user?.claims?.sub;
    const stored = req.session?.wearableOauth as OAuthState | undefined;

    const closeWindow = (msg: string, ok: boolean) => {
      res.setHeader("Content-Type", "text/html");
      res.send(`<!doctype html><html><body style="font-family:system-ui;padding:24px;background:#0a0a0a;color:#fff;text-align:center"><h2>${ok ? "Connected" : "Connection failed"}</h2><p>${msg}</p><script>setTimeout(()=>{window.close(); if(window.opener){window.opener.postMessage({type:'wearable_oauth_done', provider:'${provider}', ok:${ok}}, '*');}}, 1500)</script></body></html>`);
    };

    if (error) {
      console.error(`[wearables] OAuth error from ${provider}:`, error);
      return closeWindow(`Provider returned: ${error}`, false);
    }
    // Bind: state must exist on this session, match the query state (constant-
    // time compare), match the provider, belong to the currently authenticated
    // user, and not be expired.
    const stateValid = !!(
      code && state && stored &&
      stored.state.length === state.length &&
      crypto.timingSafeEqual(Buffer.from(stored.state), Buffer.from(state)) &&
      stored.provider === provider &&
      stored.userId === sessionUserId &&
      stored.expiresAt > Date.now()
    );
    if (!stateValid) {
      console.warn(`[wearables] OAuth state mismatch for ${provider} (sessionUser=${sessionUserId}, storedUser=${stored?.userId})`);
      delete req.session.wearableOauth;
      return closeWindow("OAuth state invalid or expired. Please try connecting again from this browser.", false);
    }
    delete req.session.wearableOauth;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));

    const adapter = getAdapter(provider);
    if (!adapter || !adapter.exchangeCode) return closeWindow("Adapter unavailable.", false);

    try {
      const tokens = await adapter.exchangeCode(code!, stored!.redirectUri);
      await upsertConnection(stored!.userId, provider, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        providerUserId: tokens.providerUserId ?? null,
        scopes: tokens.scopes ?? null,
        status: "connected",
      });
      // Fire-and-forget initial sync
      syncProvider(stored!.userId, provider, { trigger: "oauth_callback" }).catch((e) => console.error("[wearables] initial sync failed", e));
      return closeWindow(`${PROVIDER_LABELS[provider]} connected. You can close this tab.`, true);
    } catch (err: any) {
      console.error(`[wearables] OAuth exchange failed for ${provider}:`, err);
      return closeWindow(`Failed to complete connection: ${err?.message || err}`, false);
    }
  });

  // Disconnect (?deleteData=1 also deletes synced metrics)
  app.post("/api/wearables/disconnect/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      const deleteData = req.query.deleteData === "1" || req.body?.deleteData === true;
      await disconnectProvider(userId, provider, deleteData);
      res.json({ ok: true });
    } catch (err) {
      console.error("[wearables] disconnect error", err);
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  // Manual sync
  app.post("/api/wearables/sync/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider as WearableProvider;
      const result = await syncProvider(userId, provider, { trigger: "manual" });
      res.json(result);
    } catch (err: any) {
      console.error("[wearables] manual sync error", err);
      res.status(500).json({ message: "Sync failed", error: err?.message });
    }
  });

  // Apple Health: upload export.zip
  app.post("/api/wearables/apple-health/upload", isAuthenticated, upload.single("export"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded (field name 'export')" });

      const metrics = parseAppleHealthExport(file.buffer);
      await upsertConnection(userId, "apple_health", { status: "connected" });
      const { upsertDailyMetrics } = await import("./index");
      const written = await upsertDailyMetrics(userId, "apple_health", metrics);
      await syncProvider(userId, "apple_health", { trigger: "manual" });
      res.json({ daysParsed: metrics.length, daysWritten: written });
    } catch (err: any) {
      console.error("[wearables] apple health upload error", err);
      res.status(500).json({ message: "Failed to parse Apple Health export", error: err?.message });
    }
  });

  // Today panel: most recent normalised day across providers
  app.get("/api/wearables/today", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getRecentWearableMetrics } = await import("./index");
      const { rows, bestProviderByDate } = await getRecentWearableMetrics(userId, 14);
      // Pick the most recent date with a wearable record so the Today card
      // doesn't disappear when sync is a few days behind (timezone slips,
      // missed scheduled syncs, etc.).
      const sortedDates = Array.from(bestProviderByDate.keys()).sort((a, b) => b.localeCompare(a));
      const pickDate = sortedDates[0] || new Date().toISOString().slice(0, 10);
      const provider = bestProviderByDate.get(pickDate);
      const row = rows.find((r) => r.date === pickDate && r.provider === provider) || null;
      res.json({
        date: pickDate,
        source: provider ? PROVIDER_LABELS[provider as WearableProvider] : null,
        provider,
        metrics: row,
      });
    } catch (err) {
      console.error("[wearables] today error", err);
      res.status(500).json({ message: "Failed to fetch today metrics" });
    }
  });
}
