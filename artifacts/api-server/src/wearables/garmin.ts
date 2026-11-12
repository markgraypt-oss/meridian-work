import crypto from "crypto";
import type { WearableAdapter, OAuthTokens, NormalisedDailyMetrics } from "./types";

// Garmin Connect Developer Program (Starter Access), OAuth 2.0 with PKCE.
// Garmin is PUSH ONLY: data is never pulled. Garmin POSTs summaries to
// /api/wearables/garmin/webhook as the user syncs their watch, and
// parseGarminPush() below turns them into daily metrics and workouts.
// Specs: Garmin "OAuth2.0 PKCE Specification 2.0", "Health API 2.1",
// "Activity API 2.1" (developer portal, confidential).

const AUTH_URL = "https://connect.garmin.com/oauth2Confirm";
const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const API_BASE = "https://apis.garmin.com/partner-gateway/rest";

// PKCE without storing anything: the code verifier is derived from the
// HMAC-signed OAuth state, so the callback can rebuild it from the `state`
// Garmin sends back. Only this server can compute it (needs SESSION_SECRET).
// base64url of a SHA-256 digest is 43 characters, the PKCE minimum.
export function garminCodeVerifier(state: string): string {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update("garmin-pkce:" + state)
    .digest("base64url");
}

function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Garmin recommends treating tokens as expiring 600s early.
function expiresAtFrom(expiresIn: any): Date | null {
  const s = Number(expiresIn);
  if (!Number.isFinite(s) || s <= 0) return null;
  return new Date(Date.now() + Math.max(60, s - 600) * 1000);
}

async function tokenRequest(params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams({
    client_id: process.env.GARMIN_CLIENT_ID || "",
    client_secret: process.env.GARMIN_CLIENT_SECRET || "",
    ...params,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Garmin token ${params.grant_type} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function garminGetPermissions(accessToken: string): Promise<string[] | null> {
  try {
    const r = await fetch(`${API_BASE}/user/permissions`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const j: any = await r.json();
    return Array.isArray(j?.permissions) ? j.permissions.map(String) : null;
  } catch {
    return null;
  }
}

// Garmin's terms REQUIRE calling this when the user disconnects inside our app.
export async function garminDeleteRegistration(accessToken: string): Promise<void> {
  const r = await fetch(`${API_BASE}/user/registration`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok && r.status !== 404) {
    throw new Error(`Garmin delete registration failed: ${r.status} ${await r.text()}`);
  }
}

export const garminAdapter: WearableAdapter = {
  provider: "garmin",

  isConfigured() {
    return !!(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET);
  },

  authUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.GARMIN_CLIENT_ID || "",
      code_challenge: codeChallenge(garminCodeVerifier(state)),
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string, state?: string): Promise<OAuthTokens> {
    if (!state) throw new Error("Garmin token exchange needs the OAuth state (PKCE verifier)");
    const json = await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: garminCodeVerifier(state),
      redirect_uri: redirectUri,
    });
    // Garmin's API user id. Pushes identify the user by this, so the webhook
    // cannot map data to our user without it: fail the connect if it's missing.
    const idRes = await fetch(`${API_BASE}/user/id`, { headers: { Authorization: `Bearer ${json.access_token}` } });
    if (!idRes.ok) throw new Error(`Garmin user id lookup failed: ${idRes.status} ${await idRes.text()}`);
    const idJson: any = await idRes.json();
    if (!idJson?.userId) throw new Error("Garmin user id lookup returned no userId");
    const permissions = await garminGetPermissions(json.access_token);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresAtFrom(json.expires_in),
      providerUserId: String(idJson.userId),
      scopes: permissions,
    };
  },

  // Garmin returns a NEW refresh token on every refresh; the old one is then
  // spent. Refresh tokens last about 3 months, so the hourly scheduler keeps
  // the chain alive (see syncProvider's garmin branch).
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const json = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: expiresAtFrom(json.expires_in),
    };
  },
  // No fetchDaily: Garmin does not allow pulling data (push only).
};

export interface GarminWorkoutInput {
  startedAt: string;
  endedAt?: string | null;
  type?: string | null;
  durationMinutes?: number | null;
  distanceMeters?: number | null;
  activeEnergyKcal?: number | null;
  averageHeartRate?: number | null;
  localDate: string; // the user's day the workout belongs to
  summaryId?: string | null;
}

export interface GarminUserBatch {
  metrics: NormalisedDailyMetrics[];
  workouts: GarminWorkoutInput[];
}

export interface ParsedGarminPush {
  byUser: Map<string, GarminUserBatch>;
  deregistrations: string[];
  permissionChanges: { userId: string; permissions: string[] }[];
  ignoredTypes: string[];
}

const num = (v: any): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const mins = (secs: any): number | null => {
  const s = num(secs);
  return s != null && s > 0 ? Math.round(s / 60) : null;
};
// The user's local day for an instant: Garmin gives UTC seconds plus the
// device's display offset.
const localDay = (startSecs: any, offsetSecs: any): string | null => {
  const s = num(startSecs);
  if (s == null) return null;
  return new Date((s + (num(offsetSecs) ?? 0)) * 1000).toISOString().slice(0, 10);
};

// Turn one Garmin push body into per-Garmin-user daily metrics and workouts.
// Each summary type fills only its own fields; upsertDailyMetrics keeps the
// other fields for that day, so dailies, sleeps and HRV arriving in separate
// pushes build up one row. Garmin re-sends a summary when it has newer data
// for the same period; the newer values overwrite the older ones.
export function parseGarminPush(body: any): ParsedGarminPush {
  const byUser = new Map<string, GarminUserBatch>();
  const out: ParsedGarminPush = { byUser, deregistrations: [], permissionChanges: [], ignoredTypes: [] };
  if (!body || typeof body !== "object") return out;

  const batch = (uid: string) => {
    if (!byUser.has(uid)) byUser.set(uid, { metrics: [], workouts: [] });
    return byUser.get(uid)!;
  };
  // One metrics object per (user, date) inside this push.
  const dayRows = new Map<string, NormalisedDailyMetrics>();
  const day = (uid: string, date: string) => {
    const k = uid + "|" + date;
    if (!dayRows.has(k)) {
      const m: NormalisedDailyMetrics = { date, raw: null };
      dayRows.set(k, m);
      batch(uid).metrics.push(m);
    }
    return dayRows.get(k)!;
  };

  for (const [type, list] of Object.entries(body)) {
    if (!Array.isArray(list)) continue;
    switch (type) {
      case "deregistrations":
        for (const r of list as any[]) if (r?.userId) out.deregistrations.push(String(r.userId));
        break;

      case "userPermissionsChange":
        for (const r of list as any[]) {
          if (r?.userId) out.permissionChanges.push({ userId: String(r.userId), permissions: Array.isArray(r.permissions) ? r.permissions.map(String) : [] });
        }
        break;

      case "dailies":
        for (const r of list as any[]) {
          const uid = r?.userId ? String(r.userId) : null;
          const date = r?.calendarDate || localDay(r?.startTimeInSeconds, r?.startTimeOffsetInSeconds);
          if (!uid || !date) continue;
          const d = day(uid, date);
          if (num(r.steps) != null) d.steps = Math.max(0, Math.round(r.steps));
          const rhr = num(r.restingHeartRateInBeatsPerMinute);
          if (rhr != null && rhr > 0) d.restingHrBpm = Math.round(rhr);
          const active = (num(r.moderateIntensityDurationInSeconds) ?? 0) + (num(r.vigorousIntensityDurationInSeconds) ?? 0);
          if (active > 0) d.activeMinutes = Math.round(active / 60);
          if (num(r.activeKilocalories) != null) d.caloriesBurned = Math.max(0, Math.round(r.activeKilocalories));
        }
        break;

      case "sleeps":
        // Oldest first, so a later record for the same day wins.
        for (const r of [...(list as any[])].sort((a, b) => (num(a?.startTimeInSeconds) ?? 0) - (num(b?.startTimeInSeconds) ?? 0))) {
          const uid = r?.userId ? String(r.userId) : null;
          const date = r?.calendarDate || localDay(num(r?.startTimeInSeconds) != null ? r.startTimeInSeconds + (num(r.durationInSeconds) ?? 0) : null, r?.startTimeOffsetInSeconds);
          if (!uid || !date) continue;
          // OFF_WRIST: Garmin had no heart rate data, so there are no stages.
          if (r.validation === "OFF_WRIST") continue;
          const d = day(uid, date);
          const deep = mins(r.deepSleepDurationInSeconds);
          const light = mins(r.lightSleepDurationInSeconds);
          const rem = mins(r.remSleepInSeconds);
          const asleep = (deep ?? 0) + (light ?? 0) + (rem ?? 0);
          // Time asleep = deep + light + REM, the same rule as WHOOP.
          d.sleepMinutes = asleep > 0 ? asleep : null;
          d.sleepDeepMinutes = deep;
          d.sleepLightMinutes = light;
          d.sleepRemMinutes = rem;
          d.sleepAwakeMinutes = mins(r.awakeDurationInSeconds);
          const score = num(r.overallSleepScore?.value);
          if (score != null) d.sleepScore = Math.round(score);
        }
        break;

      case "hrv":
        for (const r of list as any[]) {
          const uid = r?.userId ? String(r.userId) : null;
          const date = r?.calendarDate;
          const v = num(r?.lastNightAvg);
          if (!uid || !date || v == null || v <= 0) continue;
          day(uid, date).hrvMs = Math.round(v); // overnight RMSSD in ms
        }
        break;

      case "userMetrics":
        for (const r of list as any[]) {
          const uid = r?.userId ? String(r.userId) : null;
          const date = r?.calendarDate;
          const v = num(r?.vo2Max);
          if (!uid || !date || v == null || v <= 0) continue;
          day(uid, date).vo2MaxMlKgMin = v;
        }
        break;

      case "activities":
      case "manuallyUpdatedActivities":
        for (const r of list as any[]) {
          const uid = r?.userId ? String(r.userId) : null;
          const start = num(r?.startTimeInSeconds);
          const date = localDay(start, r?.startTimeOffsetInSeconds);
          if (!uid || start == null || !date) continue;
          // A multisport parent wraps its child activities; count the children only.
          if (r.isParent === true) continue;
          const dur = num(r.durationInSeconds);
          batch(uid).workouts.push({
            startedAt: new Date(start * 1000).toISOString(),
            endedAt: dur != null ? new Date((start + dur) * 1000).toISOString() : null,
            type: r.activityType ? String(r.activityType).toLowerCase() : null,
            durationMinutes: dur != null ? Math.round(dur / 60) : null,
            distanceMeters: num(r.distanceInMeters),
            activeEnergyKcal: num(r.activeKilocalories),
            averageHeartRate: num(r.averageHeartRateInBeatsPerMinute),
            localDate: date,
            summaryId: r.summaryId != null ? String(r.summaryId) : null,
          });
        }
        break;

      default:
        out.ignoredTypes.push(type);
    }
  }
  return out;
}
