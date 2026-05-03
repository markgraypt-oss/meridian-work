import { db } from "../db";
import { wearableConnections } from "@shared/schema";
import { eq, and, or, isNull, lt } from "drizzle-orm";
import { syncProvider } from "./index";
import type { WearableProvider } from "./types";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // hourly tick
const SYNC_STALE_MS = 6 * 60 * 60 * 1000; // re-sync if last sync older than 6h

let started = false;

async function tick() {
  try {
    const cutoff = new Date(Date.now() - SYNC_STALE_MS);
    const due = await db.select().from(wearableConnections).where(
      and(
        eq(wearableConnections.status, "connected"),
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
