// Auto-renews Oura webhook subscriptions before they expire.
// Oura stamps each subscription with an expiration_time ~90 days out and stops
// pushing once it lapses. There is no dashboard for this, so we manage it here:
// once a day, list our subscriptions and re-create any that expire within
// RENEW_WITHIN_DAYS. Re-creation (delete + create) resets the ~90-day clock and
// uses the same endpoints proven working at setup time.

const SUBSCRIPTION_URL = "https://api.ouraring.com/v2/webhook/subscription";
const CALLBACK_URL =
  "https://the-paradigm-project-coachmarkgray.replit.app/api/wearables/oura/webhook";
const DATA_TYPES = ["sleep", "daily_readiness", "daily_activity", "workout"];

const TICK_INTERVAL_MS = 6 * 60 * 60 * 1000; // check every 6h; cheap when nothing is due
const RENEW_WITHIN_DAYS = 14;

let started = false;

function ouraHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-id": process.env.OURA_CLIENT_ID || "",
    "x-client-secret": process.env.OURA_CLIENT_SECRET || "",
  };
}

async function listSubscriptions(): Promise<any[]> {
  const res = await fetch(SUBSCRIPTION_URL, { headers: ouraHeaders() });
  if (!res.ok) {
    console.error(`[oura-sub-scheduler] list failed ${res.status}: ${await res.text()}`);
    return [];
  }
  const json: any = await res.json();
  // Oura returns either an array or a { data: [...] } wrapper depending on version.
  return Array.isArray(json) ? json : (json?.data || []);
}

async function deleteSubscription(id: string): Promise<boolean> {
  const res = await fetch(`${SUBSCRIPTION_URL}/${id}`, {
    method: "DELETE",
    headers: ouraHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    console.error(`[oura-sub-scheduler] delete ${id} failed ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

async function createSubscription(dataType: string): Promise<boolean> {
  const res = await fetch(SUBSCRIPTION_URL, {
    method: "POST",
    headers: ouraHeaders(),
    body: JSON.stringify({
      callback_url: CALLBACK_URL,
      verification_token: process.env.OURA_CLIENT_SECRET || "",
      event_type: "update",
      data_type: dataType,
    }),
  });
  if (!res.ok) {
    console.error(`[oura-sub-scheduler] create ${dataType} failed ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

async function tick() {
  try {
    if (!process.env.OURA_CLIENT_ID || !process.env.OURA_CLIENT_SECRET) return;

    const subs = await listSubscriptions();
    const now = Date.now();
    const threshold = now + RENEW_WITHIN_DAYS * 24 * 60 * 60 * 1000;

    // Map existing subs by data_type so we can detect both expiring AND missing ones.
    const byType = new Map<string, any>();
    for (const s of subs) {
      if (s?.data_type) byType.set(s.data_type, s);
    }

    for (const dt of DATA_TYPES) {
      const existing = byType.get(dt);
      let needsRenew = false;

      if (!existing) {
        // Missing entirely (expired and dropped, or never created) — recreate.
        needsRenew = true;
        console.log(`[oura-sub-scheduler] ${dt} missing, creating`);
      } else {
        const exp = existing.expiration_time ? new Date(existing.expiration_time).getTime() : 0;
        if (!exp || exp < threshold) {
          needsRenew = true;
          console.log(`[oura-sub-scheduler] ${dt} expiring ${existing.expiration_time}, renewing`);
          await deleteSubscription(existing.id);
        }
      }

      if (needsRenew) {
        const ok = await createSubscription(dt);
        console.log(`[oura-sub-scheduler] ${dt} ${ok ? "renewed" : "renew FAILED"}`);
      }
    }
  } catch (err) {
    console.error("[oura-sub-scheduler] tick error", err);
  }
}

export function startOuraSubscriptionScheduler() {
  if (started) return;
  started = true;
  // First check 2 minutes after boot (offset from other schedulers), then every 6h.
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => tick().catch(() => {}), TICK_INTERVAL_MS);
  }, 120_000);
  console.log(`[oura-sub-scheduler] started (renew within ${RENEW_WITHIN_DAYS}d, 6h checks)`);
}
