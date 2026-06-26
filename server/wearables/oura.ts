import type { WearableAdapter, OAuthTokens, NormalisedDailyMetrics } from "./types";

const AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API_BASE = "https://api.ouraring.com/v2/usercollection";

export const ouraAdapter: WearableAdapter = {
  provider: "oura",

  isConfigured() {
    return !!(process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET);
  },

  authUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.OURA_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: "personal daily heartrate workout session",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID || "",
      client_secret: process.env.OURA_CLIENT_SECRET || "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Oura token exchange failed: ${res.status} ${await res.text()}`);
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
      client_id: process.env.OURA_CLIENT_ID || "",
      client_secret: process.env.OURA_CLIENT_SECRET || "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Oura refresh failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async fetchDaily(accessToken: string, fromDate: string, toDate: string): Promise<NormalisedDailyMetrics[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const qs = `?start_date=${fromDate}&end_date=${toDate}`;

    const [sleepRes, readinessRes, activityRes] = await Promise.all([
      fetch(`${API_BASE}/daily_sleep${qs}`, { headers }),
      fetch(`${API_BASE}/daily_readiness${qs}`, { headers }),
      fetch(`${API_BASE}/daily_activity${qs}`, { headers }),
    ]);
    // Sleep periods (for duration breakdowns)
    const sleepDetailRes = await fetch(`${API_BASE}/sleep${qs}`, { headers });
    // Workouts (Oura logs cardio/strength sessions)
    const workoutRes = await fetch(`${API_BASE}/workout${qs}`, { headers });

    if (!sleepRes.ok) throw new Error(`Oura daily_sleep ${sleepRes.status}: ${await sleepRes.text()}`);

    const sleepJson: any = await sleepRes.json();
    const readinessJson: any = readinessRes.ok ? await readinessRes.json() : { data: [] };
    const activityJson: any = activityRes.ok ? await activityRes.json() : { data: [] };
    const sleepDetailJson: any = sleepDetailRes.ok ? await sleepDetailRes.json() : { data: [] };
    const workoutJson: any = workoutRes.ok ? await workoutRes.json() : { data: [] };

    const byDate = new Map<string, NormalisedDailyMetrics>();
    const ensure = (d: string) => {
      if (!byDate.has(d)) byDate.set(d, { date: d, raw: {} });
      return byDate.get(d)!;
    };

    for (const r of sleepJson.data || []) {
      const d = ensure(r.day);
      d.sleepScore = r.score ?? null;
      (d.raw as any).dailySleep = r;
    }
    for (const r of readinessJson.data || []) {
      const d = ensure(r.day);
      d.readinessScore = r.score ?? null;
      (d.raw as any).readiness = r;
    }
    for (const r of activityJson.data || []) {
      const d = ensure(r.day);
      d.steps = r.steps != null ? Math.max(0, Math.round(r.steps)) : null;
      d.activeMinutes = (r.high_activity_time || 0) / 60 + (r.medium_activity_time || 0) / 60;
      d.activeMinutes = d.activeMinutes ? Math.round(d.activeMinutes) : null;
      d.caloriesBurned = r.active_calories != null ? Math.max(0, Math.round(r.active_calories)) : null;
      (d.raw as any).activity = r;
    }
    // Aggregate sleep periods per day for HRV/RHR/duration
    const periodsByDay = new Map<string, any[]>();
    for (const p of sleepDetailJson.data || []) {
      const day = p.day;
      if (!day) continue;
      if (!periodsByDay.has(day)) periodsByDay.set(day, []);
      periodsByDay.get(day)!.push(p);
    }
    for (const [day, periods] of Array.from(periodsByDay.entries())) {
      const d = ensure(day);
      const longest = periods.sort((a, b) => (b.total_sleep_duration || 0) - (a.total_sleep_duration || 0))[0];
      if (longest) {
        d.sleepMinutes = longest.total_sleep_duration ? Math.round(longest.total_sleep_duration / 60) : null;
        d.sleepDeepMinutes = longest.deep_sleep_duration ? Math.round(longest.deep_sleep_duration / 60) : null;
        d.sleepRemMinutes = longest.rem_sleep_duration ? Math.round(longest.rem_sleep_duration / 60) : null;
        d.sleepLightMinutes = longest.light_sleep_duration ? Math.round(longest.light_sleep_duration / 60) : null;
        d.sleepAwakeMinutes = longest.awake_time ? Math.round(longest.awake_time / 60) : null;
        d.hrvMs = longest.average_hrv != null ? Math.max(0, Math.round(longest.average_hrv)) : null;
        d.restingHrBpm = longest.lowest_heart_rate != null ? Math.max(0, Math.round(longest.lowest_heart_rate)) : null;
      }
    }
    for (const w of workoutJson.data || []) {
      const day = w.day || (w.start_datetime ? String(w.start_datetime).slice(0, 10) : null);
      if (!day) continue;
      const d = ensure(day);
      d.workoutCount = (d.workoutCount || 0) + 1;
      (d.raw as any).workouts = (d.raw as any).workouts || [];
      (d.raw as any).workouts.push(w);
    }
    return Array.from(byDate.values());
  },
};
