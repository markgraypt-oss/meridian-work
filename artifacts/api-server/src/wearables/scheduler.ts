import { db } from "../db";
import { wearableConnections } from "@workspace/db";
import { eq, and, or, isNull, lt } from "drizzle-orm";
import { syncProvider } from "./index";
import type { WearableProvider } from "./types";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // hourly tick
// Re-sync when the last sync is older than 50 minutes, so the hourly tick
// refreshes EVERY connection EVERY hour. The old 6h window meant WHOOP's
// overnight data could lag the phone-pushed Apple data by most of a morning,
// and the priority merge can only prefer WHOOP rows that actually exist.
// (The mobile-push piggyback in routes.ts covers the app-open case; this is
// the backstop for users who don't open the app.)
const SYNC_STALE_MS = 50 * 60 * 1000;

let started = false;

async function tick() {
  try {
    const cutoff = new Date(Date.now() - SYNC_STALE_MS);
    // Include BOTH "connected" and "needs_reauth" connections. A single failed
    // token refresh previously flipped a row to needs_reauth and the scheduler
    // then skipped it forever, so the token chain never recovered on its own and
    // the app silently fell back to a lower-priority source (e.g. Apple). We now
    // retry needs_reauth rows too; syncProvider -> refreshIfNeeded will recover
    // them when the refresh token is still valid, and only a genuine invalid_grant
    // keeps them parked.
    const due = await db.select().from(wearableConnections).where(
      and(
        or(
          eq(wearableConnections.status, "connected"),
          eq(wearableConnections.status, "needs_reauth"),
        ),
        or(isNull(wearableConnections.lastSyncAt), lt(wearableConnections.lastSyncAt, cutoff)),
      ),
    );
    if (due.length > 0) console.log(`[wearables-scheduler] syncing ${due.length} connections`);
    for (const conn of due) {
      if (conn.provider === "apple_health") continue; // upload-only
      try {
        await syncProvider(conn.userId, conn.provider as WearableProvider, { trigger: "scheduled" });
      } catch (e) {
        console.error(`[wearables-scheduler] sync failed for ${conn.userId}/${conn.provider}:`, e);
      }
    }
  } catch (err) {
    console.error("[wearables-scheduler] tick error", err);
  }
}

export function startWearableScheduler() {
  if (started) return;
  started = true;
  // Initial tick after 60s, then hourly
  setTimeout(() => { tick().catch(() => {}); setInterval(() => tick().catch(() => {}), SYNC_INTERVAL_MS); }, 60_000);
  console.log("[wearables-scheduler] started (hourly, stale=6h)");
}
