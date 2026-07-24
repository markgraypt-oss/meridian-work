import type { WearableAdapter, OAuthTokens, NormalisedDailyMetrics } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/fitness/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
];

export const googleFitAdapter: WearableAdapter = {
  provider: "google_fit",

  isConfigured() {
    return !!(process.env.GOOGLE_FIT_CLIENT_ID && process.env.GOOGLE_FIT_CLIENT_SECRET);
  },

  authUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.GOOGLE_FIT_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Google Fit token exchange failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: json.scope ? String(json.scope).split(" ") : null,
    };
  },

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Google Fit refresh failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async fetchDaily(accessToken: string, fromDate: string, toDate: string): Promise<NormalisedDailyMetrics[]> {
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const startMs = new Date(`${fromDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${toDate}T23:59:59Z`).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Aggregate steps + active minutes + calories per day
    const aggBody = {
      aggregateBy: [
        { dataTypeName: "com.google.step_count.delta" },
        { dataTypeName: "com.google.active_minutes" },
        { dataTypeName: "com.google.calories.expended" },
        { dataTypeName: "com.google.heart_rate.bpm" },
      ],
      bucketByTime: { durationMillis: dayMs },
      startTimeMillis: startMs,
      endTimeMillis: endMs,
    };

    const aggRes = await fetch(`${API_BASE}/dataset:aggregate`, {
      method: "POST",
      headers,
      body: JSON.stringify(aggBody),
    });
    if (!aggRes.ok) throw new Error(`Google Fit aggregate ${aggRes.status}: ${await aggRes.text()}`);
    const agg: any = await aggRes.json();

    // Sleep sessions
    const sleepUrl = `${API_BASE}/sessions?startTime=${encodeURIComponent(new Date(startMs).toISOString())}&endTime=${encodeURIComponent(new Date(endMs).toISOString())}&activityType=72`;
    const sleepRes = await fetch(sleepUrl, { headers });
    const sleepJson: any = sleepRes.ok ? await sleepRes.json() : { session: [] };

    // Workout sessions (any non-sleep, non-still activity counts as a workout)
    const workoutUrl = `${API_BASE}/sessions?startTime=${encodeURIComponent(new Date(startMs).toISOString())}&endTime=${encodeURIComponent(new Date(endMs).toISOString())}`;
    const workoutRes = await fetch(workoutUrl, { headers });
    const workoutJson: any = workoutRes.ok ? await workoutRes.json() : { session: [] };
    // Google Fit activity types that represent workouts (excluding sleep=72, still=3, in_vehicle=0)
    const NON_WORKOUT = new Set([0, 3, 72, 109, 110, 111, 112]);

    const byDate = new Map<string, NormalisedDailyMetrics>();
    const ensure = (d: string) => {
      if (!byDate.has(d)) byDate.set(d, { date: d, raw: {} });
      return byDate.get(d)!;
    };

    for (const bucket of agg.bucket || []) {
      const day = new Date(parseInt(bucket.startTimeMillis, 10)).toISOString().slice(0, 10);
      const d = ensure(day);
      for (const ds of bucket.dataset || []) {
        const dt = ds.dataSourceId || "";
        const total = (ds.point || []).reduce((sum: number, p: any) => {
          const v = (p.value || []).reduce((s: number, x: any) => s + (x.intVal ?? x.fpVal ?? 0), 0);
          return sum + v;
        }, 0);
        const points = (ds.point || []).flatMap((p: any) => (p.value || []).map((x: any) => x.fpVal ?? x.intVal ?? null)).filter((v: any) => v != null);
        if (dt.includes("step_count")) d.steps = total || null;
        else if (dt.includes("active_minutes")) d.activeMinutes = total || null;
        else if (dt.includes("calories")) d.caloriesBurned = total ? Math.round(total) : null;
        else if (dt.includes("heart_rate")) {
          if (points.length > 0) d.restingHrBpm = Math.round(Math.min(...points));
        }
      }
    }
    for (const s of workoutJson.session || []) {
      const at = parseInt(s.activityType, 10);
      if (Number.isNaN(at) || NON_WORKOUT.has(at)) continue;
      const endTs = parseInt(s.endTimeMillis, 10);
      const day = new Date(endTs).toISOString().slice(0, 10);
      const d = ensure(day);
      d.workoutCount = (d.workoutCount || 0) + 1;
    }
    for (const s of sleepJson.session || []) {
      const startTs = parseInt(s.startTimeMillis, 10);
      const endTs = parseInt(s.endTimeMillis, 10);
      const day = new Date(endTs).toISOString().slice(0, 10);
      const d = ensure(day);
      const minutes = Math.round((endTs - startTs) / 60000);
      d.sleepMinutes = (d.sleepMinutes || 0) + minutes;
      (d.raw as any).sleepSessions = (d.raw as any).sleepSessions || [];
      (d.raw as any).sleepSessions.push(s);
    }
    return Array.from(byDate.values());
  },
};
