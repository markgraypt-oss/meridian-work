import type { WearableAdapter, OAuthTokens, NormalisedDailyMetrics } from "./types";

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer/v2";

export const whoopAdapter: WearableAdapter = {
  provider: "whoop",

  isConfigured() {
    return !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  },

  authUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.WHOOP_CLIENT_ID || "",
      redirect_uri: redirectUri,
      scope: "read:recovery read:sleep read:workout read:cycles read:profile offline",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WHOOP_CLIENT_ID || "",
      client_secret: process.env.WHOOP_CLIENT_SECRET || "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Whoop token exchange failed: ${res.status} ${await res.text()}`);
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
      client_id: process.env.WHOOP_CLIENT_ID || "",
      client_secret: process.env.WHOOP_CLIENT_SECRET || "",
      scope: "offline",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Whoop refresh failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  },

  async fetchDaily(accessToken: string, fromDate: string, toDate: string): Promise<NormalisedDailyMetrics[]> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const start = `${fromDate}T00:00:00.000Z`;
    const end = `${toDate}T23:59:59.999Z`;
    // WHOOP returns at most 25 records per page with a `next_token` cursor.
    // Walk all pages so 30-day backfills aren't truncated for active users.
    const fetchAll = async (path: string): Promise<any[]> => {
      const records: any[] = [];
      let nextToken: string | undefined;
      for (let i = 0; i < 20; i++) { // hard cap 20 pages = 500 records / endpoint
        const params = new URLSearchParams({ start, end, limit: "25" });
        if (nextToken) params.set("nextToken", nextToken);
        const res = await fetch(`${API_BASE}${path}?${params.toString()}`, { headers });
        if (!res.ok) {
          if (path.includes("sleep")) throw new Error(`Whoop ${path} ${res.status}: ${await res.text()}`);
          return records;
        }
        const json: any = await res.json();
        records.push(...(json.records || []));
        nextToken = json.next_token;
        if (!nextToken) break;
      }
      return records;
    };

    const [sleepRecords, recRecords, workoutRecords] = await Promise.all([
      fetchAll("/activity/sleep"),
      fetchAll("/recovery"),
      fetchAll("/activity/workout"),
    ]);
    const sleepJson = { records: sleepRecords };
    const recJson = { records: recRecords };
    const workoutJson = { records: workoutRecords };

    const byDate = new Map<string, NormalisedDailyMetrics>();
    const dayOf = (iso: string) => (iso || "").slice(0, 10);
    const ensure = (d: string) => {
      if (!byDate.has(d)) byDate.set(d, { date: d, raw: {} });
      return byDate.get(d)!;
    };

    for (const s of sleepJson.records || []) {
      const day = dayOf(s.end || s.start || "");
      if (!day) continue;
      const d = ensure(day);
      const stage = s.score?.stage_summary || {};
      // Time asleep = light + deep + REM. This matches WHOOP's own "Hours of
      // Sleep" figure. Do NOT use (in_bed - awake): WHOOP buckets sleep latency
      // and no-data gaps outside total_awake_time_milli, so that formula runs
      // several minutes short of the real asleep total.
      const _light = stage.total_light_sleep_time_milli || 0;
      const _deep = stage.total_slow_wave_sleep_time_milli || 0;
      const _rem = stage.total_rem_sleep_time_milli || 0;
      const _asleepMilli = _light + _deep + _rem;
      d.sleepMinutes = _asleepMilli > 0 ? Math.round(_asleepMilli / 60000) : null;
      d.sleepDeepMinutes = stage.total_slow_wave_sleep_time_milli ? Math.round(stage.total_slow_wave_sleep_time_milli / 60000) : null;
      d.sleepRemMinutes = stage.total_rem_sleep_time_milli ? Math.round(stage.total_rem_sleep_time_milli / 60000) : null;
      d.sleepLightMinutes = stage.total_light_sleep_time_milli ? Math.round(stage.total_light_sleep_time_milli / 60000) : null;
      d.sleepAwakeMinutes = stage.total_awake_time_milli ? Math.round(stage.total_awake_time_milli / 60000) : null;
      d.sleepScore = s.score?.sleep_performance_percentage ? Math.round(s.score.sleep_performance_percentage) : null;
      (d.raw as any).sleep = s;
    }
    for (const r of recJson.records || []) {
      const day = dayOf(r.created_at || "");
      if (!day) continue;
      const d = ensure(day);
      d.readinessScore = r.score?.recovery_score != null ? Math.max(0, Math.round(r.score.recovery_score)) : null;
      d.hrvMs = r.score?.hrv_rmssd_milli != null ? Math.max(0, Math.round(r.score.hrv_rmssd_milli)) : null;
      d.restingHrBpm = r.score?.resting_heart_rate != null ? Math.max(0, Math.round(r.score.resting_heart_rate)) : null;
      (d.raw as any).recovery = r;
    }
    for (const w of workoutJson.records || []) {
      const day = dayOf(w.start || "");
      if (!day) continue;
      const d = ensure(day);
      d.workoutCount = (d.workoutCount || 0) + 1;
      const strain = w.score?.strain;
      if (strain != null) {
        d.strainScore = Math.round(strain * 10);
      }
      d.caloriesBurned = (d.caloriesBurned || 0) + (w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0);
    }
    return Array.from(byDate.values());
  },
};
