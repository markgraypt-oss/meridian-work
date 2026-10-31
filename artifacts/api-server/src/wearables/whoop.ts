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
    // Capture WHOOP's numeric account user_id now. Webhooks identify the user
    // by this id, so without it we can't map an incoming event to our user.
    let providerUserId: string | null = null;
    try {
      const profRes = await fetch(`${API_BASE}/user/profile/basic`, {
        headers: { Authorization: `Bearer ${json.access_token}` },
      });
      if (profRes.ok) {
        const prof: any = await profRes.json();
        if (prof?.user_id != null) providerUserId = String(prof.user_id);
      }
    } catch {
      // Non-fatal: connection still works, webhook mapping falls back to a scan.
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: json.scope ? String(json.scope).split(" ") : null,
      providerUserId,
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

  async fetchDaily(accessToken: string, fromDate: string, toDate: string, tz?: string | null): Promise<NormalisedDailyMetrics[]> {
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

    const [sleepRecords, recRecords, workoutRecords, cycleRecords] = await Promise.all([
      fetchAll("/activity/sleep"),
      fetchAll("/recovery"),
      fetchAll("/activity/workout"),
      fetchAll("/cycle"),
    ]);
    const sleepJson = { records: sleepRecords };
    const recJson = { records: recRecords };
    const workoutJson = { records: workoutRecords };

    // DAY strain lives on the physiological cycle, NOT on workouts.
    // (Bug fixed 7 Aug 2026: strainScore used to come from individual
    // /activity/workout records — one workout's strain, last-write-wins —
    // so a real 18.7 day showed as 12.0.) Each recovery record carries the
    // cycle_id of the cycle it opens; that cycle's score.strain IS the day
    // strain for the recovery's day. Map cycle id → strain here, consume
    // in the recovery loop below.
    const strainByCycle = new Map<any, number>();
    for (const c of cycleRecords || []) {
      if (c?.id != null && c.score?.strain != null) {
        strainByCycle.set(c.id, c.score.strain);
      }
    }

    const byDate = new Map<string, NormalisedDailyMetrics>();
    // File each record on the USER'S local day. Keying on the UTC date put a
    // sleep that ended at 01:10 local on the previous day (23:10Z), where it
    // merged with the night before and left the real day empty.
    let dayFmt: Intl.DateTimeFormat | null = null;
    if (tz) {
      try { dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }); } catch { dayFmt = null; }
    }
    const dayOf = (iso: string) => {
      if (!iso) return "";
      if (dayFmt) {
        const t = new Date(iso);
        if (!isNaN(t.getTime())) return dayFmt.format(t); // en-CA gives YYYY-MM-DD
      }
      return iso.slice(0, 10);
    };
    const ensure = (d: string) => {
      if (!byDate.has(d)) byDate.set(d, { date: d, raw: {} });
      return byDate.get(d)!;
    };

    // One sleep entry per day. WHOOP sends naps (nap: true) and split nights
    // as separate records that end on the same date; they used to overwrite
    // each other, last write wins, so a nap could replace the whole night.
    // Now every record for a day is added up, and the sleep score comes from
    // the main (non-nap) sleep. Records are summed in start order so the
    // kept raw record is the main night, with the others listed beside it.
    const sleepSorted = [...(sleepJson.records || [])].sort((a: any, b: any) =>
      String(a?.start || "").localeCompare(String(b?.start || "")));
    for (const s of sleepSorted) {
      const day = dayOf(s.end || s.start || "");
      if (!day) continue;
      const d = ensure(day);
      const stage = s.score?.stage_summary || {};
      // Time asleep = light + deep + REM. This matches WHOOP's own "Hours of
      // Sleep" figure. Do NOT use (in_bed - awake): WHOOP buckets sleep latency
      // and no-data gaps outside total_awake_time_milli, so that formula runs
      // several minutes short of the real asleep total.
      const mins = (v: any) => (v ? Math.round(v / 60000) : 0);
      const light = mins(stage.total_light_sleep_time_milli);
      const deep = mins(stage.total_slow_wave_sleep_time_milli);
      const rem = mins(stage.total_rem_sleep_time_milli);
      const awake = mins(stage.total_awake_time_milli);
      const asleep = light + deep + rem;
      const add = (cur: number | null | undefined, v: number) => (v > 0 ? (cur || 0) + v : (cur ?? null));
      d.sleepMinutes = add(d.sleepMinutes, asleep);
      d.sleepDeepMinutes = add(d.sleepDeepMinutes, deep);
      d.sleepRemMinutes = add(d.sleepRemMinutes, rem);
      d.sleepLightMinutes = add(d.sleepLightMinutes, light);
      d.sleepAwakeMinutes = add(d.sleepAwakeMinutes, awake);
      const isNap = s.nap === true;
      const perf = s.score?.sleep_performance_percentage;
      if (!isNap && perf) d.sleepScore = Math.round(perf);
      else if (d.sleepScore == null && perf) d.sleepScore = Math.round(perf);
      const rawAny = d.raw as any;
      if (!isNap || !rawAny.sleep) {
        if (rawAny.sleep && rawAny.sleep !== s) rawAny.sleepExtra = [...(rawAny.sleepExtra || []), rawAny.sleep];
        rawAny.sleep = s;
      } else {
        rawAny.sleepExtra = [...(rawAny.sleepExtra || []), s];
      }
    }
    for (const r of recJson.records || []) {
      const day = dayOf(r.created_at || "");
      if (!day) continue;
      const d = ensure(day);
      d.readinessScore = r.score?.recovery_score != null ? Math.max(0, Math.round(r.score.recovery_score)) : null;
      d.hrvMs = r.score?.hrv_rmssd_milli != null ? Math.max(0, Math.round(r.score.hrv_rmssd_milli)) : null;
      d.restingHrBpm = r.score?.resting_heart_rate != null ? Math.max(0, Math.round(r.score.resting_heart_rate)) : null;
      // WHOOP day strain: the cycle this recovery opens accumulates the
      // day's strain (0-21, stored 0-210).
      const cycleStrain = r.cycle_id != null ? strainByCycle.get(r.cycle_id) : undefined;
      if (cycleStrain != null) {
        d.strainScore = Math.round(cycleStrain * 10);
      }
      (d.raw as any).recovery = r;
    }
    for (const w of workoutJson.records || []) {
      const day = dayOf(w.start || "");
      if (!day) continue;
      const d = ensure(day);
      d.workoutCount = (d.workoutCount || 0) + 1;
      // Workout strain is per-ACTIVITY, not the day total — it only stands
      // in when no cycle strain landed for the day (never overwrites it).
      const strain = w.score?.strain;
      if (strain != null && d.strainScore == null) {
        d.strainScore = Math.round(strain * 10);
      }
      d.caloriesBurned = (d.caloriesBurned || 0) + (w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : 0);
    }
    return Array.from(byDate.values());
  },
};
