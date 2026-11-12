import type { Express } from "express";
import express from "express";
import multer from "multer";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import crypto from "crypto";
import { isAuthenticated } from "../replitAuth";
import {
  ADAPTERS,
  PROVIDER_LABELS,
  buildRedirectUri,
  buildWebhookUrl,
  disconnectProvider,
  getAdapter,
  getConnections,
  syncProvider,
  getConnectionByProviderUser,
  getConnectionsByProvider,
  upsertConnection,
  upsertWearableWorkouts,
  getWearableWorkouts,
  processGarminPush,
  disconnectGarmin,
  setGarminAiConsent,
} from "./index";
import { z } from 'zod';
import { parseAppleHealthExport } from "./appleHealth";
import type { WearableProvider } from "./types";

const PROVIDERS: WearableProvider[] = ["oura", "whoop", "garmin", "google_fit", "apple_health"];

// Apple Health export.zip. 60 MB compressed is far above a real export (most
// are 5 to 30 MB). The XML inside is capped again in appleHealth.ts.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });

// One export is parsed at a time, and each person gets two attempts an hour:
// parsing holds the whole XML in memory, so two uploads at once could take the
// server down with it.
let appleHealthParseBusy = false;
const appleHealthUploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 2,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => "ah:" + (req.user?.claims?.sub || ipKeyGenerator(req.ip)),
  message: { message: "Two Apple Health uploads an hour is the limit. Please try again later." },
});

// OAuth state is carried in an HMAC-signed token rather than the session,
// because the mobile in-app browser that handles the OAuth redirect does NOT
// share the app's session cookie. The token encodes the provider, userId,
// redirectUri and expiry, and is signed with SESSION_SECRET. The callback
// verifies the signature (timing-safe) and expiry — an attacker cannot forge a
// valid token without the secret, so this is as safe as the session approach
// while actually working cross-browser.
interface OAuthStatePayload {
  provider: WearableProvider;
  userId: string;
  redirectUri: string;
  expiresAt: number;
  // Garmin only: the AI consent choice made on the consent step before connecting.
  aiConsent?: boolean;
}

// The OAuth state token is signed with SESSION_SECRET. With no secret, anyone
// could forge a state and attach their wearable to someone else's account, so
// the server refuses to start rather than fall back to a known string.
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not set; the wearables OAuth flow cannot be signed. Refusing to start.");
}
const OAUTH_STATE_SECRET: string = process.env.SESSION_SECRET;

function signOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", OAUTH_STATE_SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

function verifyOAuthState(token: string): OAuthStatePayload | null {
  try {
    const decoded = decodeURIComponent(token);
    const dot = decoded.lastIndexOf(".");
    if (dot < 0) return null;
    const body = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const expected = crypto.createHmac("sha256", OAUTH_STATE_SECRET).update(body).digest("hex");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const json = Buffer.from(body, "base64url").toString("utf8");
    return JSON.parse(json) as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function registerWearableRoutes(app: Express) {

  // ── Oura webhook ──────────────────────────────────────────────────────────
  // Oura's flow differs from WHOOP's:
  //  1) SUBSCRIPTION VERIFICATION (GET): when we create a subscription, Oura
  //     sends a GET with a `verification_token` + `challenge`; we must echo the
  //     challenge back as JSON to activate the subscription.
  //  2) EVENT (POST): Oura POSTs { event_type, data_type, object_id, user_id? }
  //     signed with x-oura-signature (HMAC-SHA256 of the raw body using the
  //     client secret). Events do NOT reliably carry our app user, so we re-sync
  //     all connected Oura users over a short window. Fine at launch scale.
  app.get("/api/wearables/oura/webhook", (req: any, res) => {
    const challenge = req.query.challenge;
    if (challenge) {
      console.log("[oura-webhook] verification challenge received");
      return res.status(200).json({ challenge });
    }
    return res.status(400).json({ message: "Missing challenge" });
  });

  app.post(
    "/api/wearables/oura/webhook",
    express.raw({ type: "*/*" }),
    async (req: any, res) => {
      try {
        const secret = process.env.OURA_CLIENT_SECRET || "";
        const sig = req.header("x-oura-signature");
        const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
        if (!secret || !sig) {
          return res.status(401).json({ message: "Missing signature" });
        }
        // Oura signs x-oura-timestamp + raw body (no separator) with the client
        // secret and sends an UPPERCASE hex digest. The old check signed the body
        // alone in lowercase, so every Oura push was rejected (fixed 11 Nov 2026).
        const ts = req.header("x-oura-timestamp") || "";
        const hmacHex = (input: Buffer) =>
          crypto.createHmac("sha256", secret).update(input).digest("hex").toUpperCase();
        const given = Buffer.from(String(sig).toUpperCase());
        const matches = (hex: string) => {
          const b = Buffer.from(hex);
          return given.length === b.length && crypto.timingSafeEqual(given, b);
        };
        const ok =
          (ts && matches(hmacHex(Buffer.concat([Buffer.from(ts, "utf8"), raw])))) ||
          matches(hmacHex(raw));
        if (!ok) {
          console.warn(`[oura-webhook] signature mismatch (timestamp ${ts ? "present" : "missing"})`);
          return res.status(401).json({ message: "Bad signature" });
        }

        // Ack immediately, sync in background.
        res.status(200).json({ ok: true });

        const evt = JSON.parse(raw.toString("utf8"));
        // Only bother re-syncing for data types we actually store.
        const dt = String(evt?.data_type || "");
        const relevant = ["sleep", "daily_sleep", "daily_readiness", "daily_activity", "workout"];
        if (dt && !relevant.includes(dt)) {
          console.log(`[oura-webhook] ignoring data_type ${dt}`);
          return;
        }

        // AUTOSCALE RULE: finish the syncs BEFORE the ack (see WHOOP handler).
        const conns = await getConnectionsByProvider("oura");
        for (const conn of conns) {
          if (conn.status !== "connected" && conn.status !== "needs_reauth") continue;
          try {
            await syncProvider(conn.userId, "oura", { trigger: "webhook", days: 2 });
            console.log(`[oura-webhook] synced ${conn.userId} (${dt || evt?.event_type})`);
          } catch (e: any) {
            console.error("[oura-webhook] sync failed:", e?.message);
          }
        }
      } catch (err: any) {
        console.error("[oura-webhook] handler error:", err?.message);
        if (!res.headersSent) res.status(200).json({ ok: true });
      }
    },
  );

  // One-time admin route to CREATE the Oura subscription. Oura has no dashboard
  // toggle; the subscription is created via an authenticated API call. Call this
  // once per data type after deploy. Admin-gated.
  app.post("/api/wearables/oura/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const me = await import("../storage").then((m) => m.storage.getUser(req.user.claims.sub));
      if (!me?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const dataType = String(req.body?.dataType || "daily_readiness");
      const callbackUrl = buildWebhookUrl("oura");
      const verificationToken = process.env.OURA_CLIENT_SECRET || "";

      const resp = await fetch("https://api.ouraring.com/v2/webhook/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.OURA_CLIENT_ID || "",
          "x-client-secret": process.env.OURA_CLIENT_SECRET || "",
        },
        body: JSON.stringify({
          callback_url: callbackUrl,
          verification_token: verificationToken,
          event_type: "update",
          data_type: dataType,
        }),
      });
      const text = await resp.text();
      return res.status(resp.ok ? 200 : 400).json({ status: resp.status, body: text });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message });
    }
  });

  // WHOOP webhook. WHOOP POSTs { user_id, id, type, trace_id } when new data is
  // computed (e.g. recovery.updated, sleep.updated). We verify the HMAC-SHA256
  // signature over (X-WHOOP-Signature-Timestamp + raw body) using the app's
  // client secret, map user_id -> our connection, and re-sync a short window.
  // express.raw is required so the signature is computed over the exact bytes.
  app.post(
    "/api/wearables/whoop/webhook",
    express.raw({ type: "*/*" }),
    async (req: any, res) => {
      try {
        const secret = process.env.WHOOP_CLIENT_SECRET || "";
        const sig = req.header("X-WHOOP-Signature");
        const ts = req.header("X-WHOOP-Signature-Timestamp");
        const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
        if (!secret || !sig || !ts) {
          return res.status(401).json({ message: "Missing signature" });
        }
        // Reject stale timestamps (>5 min) to blunt replay.
        const tsNum = parseInt(ts, 10);
        if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
          return res.status(401).json({ message: "Stale timestamp" });
        }
        const expected = crypto
          .createHmac("sha256", secret)
          .update(ts + raw.toString("utf8"))
          .digest("base64");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          console.warn("[whoop-webhook] signature mismatch");
          return res.status(401).json({ message: "Bad signature" });
        }

        // AUTOSCALE RULE: do ALL work BEFORE responding. This deployment is
        // autoscale — CPU is only guaranteed while a request is in flight.
        // Background work after the ack gets frozen mid-operation, and a
        // freeze during a token refresh loses the rotated token and gets the
        // whole family revoked (the overnight disconnects). WHOOP tolerates a
        // few seconds and retries politely; the sync is idempotent + locked.
        const evt = JSON.parse(raw.toString("utf8"));
        const whoopUserId = evt?.user_id != null ? String(evt.user_id) : null;
        if (!whoopUserId) return res.status(200).json({ ok: true });

        const conn = await getConnectionByProviderUser("whoop", whoopUserId);
        if (!conn) {
          console.warn(`[whoop-webhook] no connection for whoop user_id ${whoopUserId}`);
          return res.status(200).json({ ok: true });
        }
        try {
          await syncProvider(conn.userId, "whoop", { trigger: "webhook", days: 2 });
          console.log(`[whoop-webhook] synced ${conn.userId} (${evt?.type})`);
        } catch (e: any) {
          console.error("[whoop-webhook] sync failed:", e?.message);
        }
        res.status(200).json({ ok: true });
      } catch (err: any) {
        console.error("[whoop-webhook] handler error:", err?.message);
        if (!res.headersSent) res.status(200).json({ ok: true });
      }
    },
  );
  // Garmin push. Garmin POSTs JSON summaries ({ dailies: [...] },
  // { sleeps: [...] }, { activities: [...] }, { deregistrations: [...] } ...)
  // to this one URL, set per summary type in Garmin's endpoint tool. Pushes
  // are not signed; each carries a garmin-client-id header, which must be
  // ours. Garmin wants a 200 within 30 seconds and retries hourly for 7 days
  // on anything else. Storing a push takes well under that, so it is stored
  // first: on a database error the reply is 500 and Garmin resends, instead
  // of the data being lost behind an early 200. If storing ever takes over
  // 20 seconds, the 200 goes out and storing carries on.
  app.post(
    "/api/wearables/garmin/webhook",
    express.json({ limit: "25mb" }),
    async (req: any, res) => {
      const expected = process.env.GARMIN_CLIENT_ID || "";
      const got = String(req.header("garmin-client-id") || "");
      if (!expected || got !== expected) {
        console.warn(`[garmin-webhook] rejected: client id ${got ? "mismatch" : "missing"} (ip ${req.ip})`);
        res.status(401).json({ message: "Unknown client" });
        return;
      }
      let replied = false;
      const timer = setTimeout(() => {
        if (!replied) { replied = true; res.status(200).json({ ok: true }); }
      }, 20_000);
      try {
        const r = await processGarminPush(req.body);
        console.log(`[garmin-webhook] users=${r.users} days=${r.days} workouts=${r.workouts} unknownUsers=${r.unknownUsers} deregistered=${r.deregistered}${r.ignoredTypes.length ? ` ignored=${r.ignoredTypes.join(",")}` : ""}`);
        if (!replied) { replied = true; res.status(200).json({ ok: true }); }
      } catch (err: any) {
        console.error("[garmin-webhook] store failed:", err?.message || err);
        if (!replied) { replied = true; res.status(500).json({ message: "Store failed, please retry" }); }
      } finally {
        clearTimeout(timer);
      }
    },
  );

  // Garmin AI consent switch (Wearables & Integrations). Body { granted }.
  app.post("/api/wearables/garmin/ai-consent", isAuthenticated, async (req: any, res) => {
    try {
      const granted = req.body?.granted === true;
      const ok = await setGarminAiConsent(req.user.claims.sub, granted);
      if (!ok) { res.status(404).json({ message: "Garmin is not connected" }); return; }
      res.json({ ok: true, aiConsent: granted });
    } catch (err: any) {
      console.error("[garmin] ai-consent error", err?.message || err);
      res.status(500).json({ message: "Could not save your choice. Please try again." });
    }
  });

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
        ...(c.provider === "garmin" ? { aiConsent: (c.meta as any)?.aiConsent?.granted === true } : {}),
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

    // Mutual exclusion: Oura, WHOOP and Garmin are all full physiological
    // providers (sleep, HRV, resting heart rate). Two at once would mean
    // competing sources for the same signals, so only one may be connected at
    // a time; the user must disconnect one before connecting another.
    const TRACKERS: WearableProvider[] = ["oura", "whoop", "garmin"];
    if (TRACKERS.includes(provider)) {
      const conns = await getConnections(userId);
      const otherConn = conns.find((c) => c.provider !== provider && TRACKERS.includes(c.provider as WearableProvider) && c.status === "connected");
      if (otherConn) {
        const other = otherConn.provider as WearableProvider;
        return res.status(409).json({
          message: `Disconnect ${PROVIDER_LABELS[other]} first. You can only connect one of Oura, WHOOP or Garmin at a time.`,
        });
      }
    }

    const redirectUri = buildRedirectUri(req, provider);
    // Stateless signed-state token. The mobile in-app browser does NOT share
    // the app's session cookie, so we cannot store state on req.session and
    // read it back in the callback. Instead we encode all the state into an
    // HMAC-signed token that the callback can verify without any session.
    const aiConsent = provider === "garmin" ? (req.query.aiConsent === "1" || req.query.aiConsent === "true") : undefined;
    const signedState = signOAuthState({ provider, userId, redirectUri, expiresAt: Date.now() + 10 * 60 * 1000, ...(aiConsent !== undefined ? { aiConsent } : {}) });
    const url = adapter.authUrl(signedState, redirectUri);
    res.json({ url });
  });

  // OAuth callback. Stateless: the security comes entirely from the HMAC-signed
  // state token (it encodes provider + userId + redirectUri + expiry and is
  // signed with SESSION_SECRET). No session is required, which is essential for
  // the mobile flow where the callback lands in a browser tab with no app
  // session cookie. An attacker cannot forge a valid token without the secret.
  app.get("/api/wearables/callback/:provider", async (req: any, res) => {
    const provider = req.params.provider as WearableProvider;
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    const closeWindow = (msg: string, ok: boolean) => {
      const deepLink = `meridian://wearables/callback?provider=${provider}&ok=${ok}&msg=${encodeURIComponent(msg)}`;
      res.redirect(deepLink);
    };

    if (error) {
      console.error(`[wearables] OAuth error from ${provider}:`, error);
      return closeWindow(`Provider returned: ${error}`, false);
    }

    const payload = state ? verifyOAuthState(state) : null;
    const stateValid = !!(
      code && payload &&
      payload.provider === provider &&
      payload.expiresAt > Date.now()
    );
    if (!stateValid) {
      console.warn(`[wearables] OAuth state invalid for ${provider} (verified=${!!payload})`);
      return closeWindow("OAuth state invalid or expired. Please try connecting again.", false);
    }

    const adapter = getAdapter(provider);
    if (!adapter || !adapter.exchangeCode) return closeWindow("Adapter unavailable.", false);

    try {
      const tokens = await adapter.exchangeCode(code!, payload!.redirectUri, state);
      await upsertConnection(payload!.userId, provider, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        providerUserId: tokens.providerUserId ?? null,
        scopes: tokens.scopes ?? null,
        status: "connected",
        ...(provider === "garmin" ? { meta: { aiConsent: { granted: payload!.aiConsent === true, at: new Date().toISOString() } } } : {}),
      });
      // Initial backfill, fired after a short delay so the connection row is
      // fully committed first.
      setTimeout(() => {
        syncProvider(payload!.userId, provider, { trigger: "oauth_callback" }).catch((e) => console.error("[wearables] initial sync failed", e));
      }, 3000);
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
      if (provider === "garmin") await disconnectGarmin(userId);
      else await disconnectProvider(userId, provider, deleteData);
      res.json({ ok: true });
    } catch (err) {
      console.error("[wearables] disconnect error", err);
      res.status(500).json({ message: "Failed to disconnect" });
    }
  });

  // Manual sync. Optional body { days } (1-90, default 7) for deep
  // re-imports — e.g. re-pulling history after a mapping fix.
  app.post("/api/wearables/sync/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider as WearableProvider;
      const reqDays = parseInt(String(req.body?.days ?? ""), 10);
      const days = Number.isFinite(reqDays) ? Math.min(Math.max(reqDays, 1), 90) : undefined;
      const result = await syncProvider(userId, provider, { trigger: "manual", ...(days ? { days } : {}) });
      res.json(result);
    } catch (err: any) {
      console.error("[wearables] manual sync error", err);
      res.status(500).json({ message: "Sync failed", error: err?.message });
    }
  });

  // Apple Health: upload export.zip
  app.post("/api/wearables/apple-health/upload", isAuthenticated, appleHealthUploadLimit, upload.single("export"), async (req: any, res) => {
    const userId = req.user.claims.sub;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded (field name 'export')" });
    if (appleHealthParseBusy) {
      return res.status(429).json({ message: "Another Apple Health export is being processed. Please try again in a minute." });
    }
    appleHealthParseBusy = true;
    try {
      const metrics = parseAppleHealthExport(file.buffer);
      await upsertConnection(userId, "apple_health", { status: "connected" });
      const { upsertDailyMetrics } = await import("./index");
      const written = await upsertDailyMetrics(userId, "apple_health", metrics);
      await syncProvider(userId, "apple_health", { trigger: "manual" });
      return res.json({ daysParsed: metrics.length, daysWritten: written });
    } catch (err: any) {
      console.error("[wearables] apple health upload error", err?.message || err);
      return res.status(500).json({ message: "Failed to parse Apple Health export", error: err?.message });
    } finally {
      appleHealthParseBusy = false;
    }
  });

  // Apple Health: mobile HealthKit JSON sync
  // Accepts structured day-level metrics and per-workout records from the mobile app.
  // Fully idempotent — the mobile app can safely re-send any date range.
  const mobileMetricSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sleepMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepDeepMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepRemMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepLightMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepAwakeMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepScore: z.number().int().min(0).max(100).optional().nullable(),
    steps: z.number().int().nonnegative().optional().nullable(),
    activeEnergyKcal: z.number().nonnegative().optional().nullable(),
    exerciseMinutes: z.number().int().nonnegative().optional().nullable(),
    restingHeartRate: z.number().int().nonnegative().optional().nullable(),
    hrvMs: z.number().int().nonnegative().optional().nullable(),
    vo2MaxMlKgMin: z.number().nonnegative().optional().nullable(),
  });

  const mobileWorkoutSchema = z.object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional().nullable(),
    type: z.string().max(64).optional().nullable(),
    durationMinutes: z.number().int().nonnegative().optional().nullable(),
    distanceMeters: z.number().int().nonnegative().optional().nullable(),
    activeEnergyKcal: z.number().nonnegative().optional().nullable(),
    averageHeartRate: z.number().int().nonnegative().optional().nullable(),
  });

  const mobileSyncBodySchema = z.object({
    metrics: z.array(mobileMetricSchema).max(366).default([]),
    workouts: z.array(mobileWorkoutSchema).max(500).default([]),
  });

  // Piggyback OAuth-provider pull on every mobile push. Apple Health arrives
  // the moment the phone opens the app, but WHOOP/Oura are PULLED by the
  // server — previously only when the last sync was >6h old. Every morning
  // that meant Apple's overnight data landed instantly while WHOOP's sat on
  // WHOOP's servers for hours, so the per-metric priority merge had only an
  // Apple row to choose and the app showed Apple sleep/HRV/RHR until midday.
  // Pulling WHOOP/Oura whenever the phone pushes keeps them at least as fresh
  // as Apple, so the priority rule always has WHOOP data to prefer.
  // Guarded to at most one pull per provider per 10 minutes.
  const PIGGYBACK_MIN_GAP_MS = 10 * 60 * 1000;
  async function piggybackOauthSync(userId: string): Promise<void> {
    try {
      const conns = await getConnections(userId);
      for (const conn of conns) {
        if (conn.provider !== "whoop" && conn.provider !== "oura") continue;
        if (conn.status === "disconnected") continue;
        const last = conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : 0;
        if (Date.now() - last < PIGGYBACK_MIN_GAP_MS) continue;
        // Awaited: on autoscale the process may freeze the moment the HTTP
        // response goes out, so the refresh must complete inside the request.
        try {
          await syncProvider(userId, conn.provider as WearableProvider, { trigger: "mobile_piggyback", days: 3 });
        } catch (e: any) {
          console.error(`[wearables] piggyback ${conn.provider} sync failed:`, e?.message || e);
        }
      }
    } catch (e: any) {
      console.error("[wearables] piggyback check failed:", e?.message || e);
    }
  }

  app.post("/api/wearables/apple-health/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const parsed = mobileSyncBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sync payload", errors: parsed.error.flatten() });
      }

      const { metrics, workouts } = parsed.data;

      // Mark connection as active
      await upsertConnection(userId, "apple_health", { status: "connected" });

      // Map mobile metric field names to the NormalisedDailyMetrics interface
      const { upsertDailyMetrics } = await import("./index");
      const normalisedMetrics = metrics.map((m) => ({
        date: m.date,
        sleepMinutes: m.sleepMinutes ?? null,
        sleepDeepMinutes: m.sleepDeepMinutes ?? null,
        sleepRemMinutes: m.sleepRemMinutes ?? null,
        sleepLightMinutes: m.sleepLightMinutes ?? null,
        sleepAwakeMinutes: m.sleepAwakeMinutes ?? null,
        sleepScore: m.sleepScore ?? null,
        steps: m.steps ?? null,
        caloriesBurned: m.activeEnergyKcal != null ? Math.round(m.activeEnergyKcal) : null,
        activeMinutes: m.exerciseMinutes ?? null,
        restingHrBpm: m.restingHeartRate ?? null,
        hrvMs: m.hrvMs ?? null,
        vo2MaxMlKgMin: m.vo2MaxMlKgMin ?? null,
        workoutCount: null,
        raw: m,
      }));

      const daysWritten = await upsertDailyMetrics(userId, "apple_health", normalisedMetrics);

      // Upsert per-workout records
      const workoutsWritten = await upsertWearableWorkouts(userId, "apple_health", workouts);

      // Determine the latest successfully synced date from the metrics batch
      const dates = metrics.map((m) => m.date).filter(Boolean).sort();
      const latestSyncedDate = dates[dates.length - 1] ?? null;

      console.log(`[wearables] apple-health/sync user=${userId} days=${daysWritten} workouts=${workoutsWritten}`);

      // Pull WHOOP/Oura now so they are as fresh as the Apple data that just
      // arrived. AWAITED: on autoscale, background work after the response can
      // be frozen mid-token-refresh, which kills the token family. Usually a
      // no-op (10-min guard); costs a couple of seconds when it fires.
      await piggybackOauthSync(userId);

      res.json({ daysWritten, workoutsWritten, latestSyncedDate });
    } catch (err: any) {
      console.error("[wearables] apple-health/sync error", err);
      res.status(500).json({ message: "Failed to sync Apple Health data", error: err?.message });
    }
  });

  // Health Connect (Android): mobile sync endpoint.
  // Mirrors the Apple Health endpoint above — same payload shape, same
  // normalisation, same idempotent upserts. Provider id is "google_fit" so
  // Android Health Connect data flows into the same wearable tables and is
  // visible everywhere existing google_fit data is shown.
  const hcMetricSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sleepMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepDeepMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepRemMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepLightMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepAwakeMinutes: z.number().int().nonnegative().optional().nullable(),
    sleepScore: z.number().int().min(0).max(100).optional().nullable(),
    steps: z.number().int().nonnegative().optional().nullable(),
    activeEnergyKcal: z.number().nonnegative().optional().nullable(),
    exerciseMinutes: z.number().int().nonnegative().optional().nullable(),
    restingHeartRate: z.number().int().nonnegative().optional().nullable(),
    hrvMs: z.number().int().nonnegative().optional().nullable(),
    vo2MaxMlKgMin: z.number().nonnegative().optional().nullable(),
  });

  const hcWorkoutSchema = z.object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional().nullable(),
    type: z.string().max(64).optional().nullable(),
    durationMinutes: z.number().int().nonnegative().optional().nullable(),
    distanceMeters: z.number().int().nonnegative().optional().nullable(),
    activeEnergyKcal: z.number().nonnegative().optional().nullable(),
    averageHeartRate: z.number().int().nonnegative().optional().nullable(),
  });

  const hcSyncBodySchema = z.object({
    metrics: z.array(hcMetricSchema).max(366).default([]),
    workouts: z.array(hcWorkoutSchema).max(500).default([]),
  });

  app.post("/api/wearables/health-connect/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const parsed = hcSyncBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sync payload", errors: parsed.error.flatten() });
      }

      const { metrics, workouts } = parsed.data;

      // Mark Android Health Connect connection as active (provider id: google_fit).
      await upsertConnection(userId, "google_fit", { status: "connected" });

      // Map mobile metric field names to the NormalisedDailyMetrics interface.
      const { upsertDailyMetrics } = await import("./index");
      const normalisedMetrics = metrics.map((m) => ({
        date: m.date,
        sleepMinutes: m.sleepMinutes ?? null,
        sleepDeepMinutes: m.sleepDeepMinutes ?? null,
        sleepRemMinutes: m.sleepRemMinutes ?? null,
        sleepLightMinutes: m.sleepLightMinutes ?? null,
        sleepAwakeMinutes: m.sleepAwakeMinutes ?? null,
        sleepScore: m.sleepScore ?? null,
        steps: m.steps ?? null,
        caloriesBurned: m.activeEnergyKcal != null ? Math.round(m.activeEnergyKcal) : null,
        activeMinutes: m.exerciseMinutes ?? null,
        restingHrBpm: m.restingHeartRate ?? null,
        hrvMs: m.hrvMs ?? null,
        vo2MaxMlKgMin: m.vo2MaxMlKgMin ?? null,
        workoutCount: null,
        raw: m,
      }));

      const daysWritten = await upsertDailyMetrics(userId, "google_fit", normalisedMetrics);

      // Per-workout records.
      const workoutsWritten = await upsertWearableWorkouts(userId, "google_fit", workouts);

      const dates = metrics.map((m) => m.date).filter(Boolean).sort();
      const latestSyncedDate = dates[dates.length - 1] ?? null;

      console.log(`[wearables] health-connect/sync user=${userId} days=${daysWritten} workouts=${workoutsWritten}`);

      // Same freshness rule as iOS: pull WHOOP/Oura now (awaited — see above).
      await piggybackOauthSync(userId);

      res.json({ daysWritten, workoutsWritten, latestSyncedDate });
    } catch (err: any) {
      console.error("[wearables] health-connect/sync error", err);
      res.status(500).json({ message: "Failed to sync Health Connect data", error: err?.message });
    }
  });

  // Wearable workouts: fetch per-workout records (all providers)
  // Mobile and web can use this to build a unified training history alongside workoutLogs.
  app.get("/api/wearables/workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(Number(req.query.limit) || 20, 200);
      const provider = req.query.provider as WearableProvider | undefined;
      const workouts = await getWearableWorkouts(userId, limit, provider);
      res.json(workouts);
    } catch (err: any) {
      console.error("[wearables] workouts fetch error", err);
      res.status(500).json({ message: "Failed to fetch wearable workouts" });
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
