// ---------------------------------------------------------------------------
// Auto-generated captions for Mux videos.
//
// Mux generates English captions (OpenAI Whisper) for on-demand assets at no
// extra charge. Captions are embedded in the HLS manifest, so every player
// that streams stream.mux.com/{playbackId}.m3u8 (mobile learn player, workout
// videos) gets a CC option with zero client changes. The caption text is also
// retrievable as a plain-text transcript — the future upgrade path for
// transcript-based content tagging and search.
//
// Two entry points:
//   runCaptionBackfill()             — one-off sweep, scoped to assets that
//                                      are actually used in-app (learn
//                                      content, path content, video workouts;
//                                      exercise demo clips are deliberately
//                                      excluded — usually no speech). Enables
//                                      captions on any ready asset with an
//                                      audio track and no text track yet.
//                                      Rate-limit aware: paced requests + 429
//                                      retry with exponential backoff. Safe to
//                                      re-run; captioned assets are skipped.
//                                      Admin: POST /api/admin/mux-captions/backfill
//   ensureCaptionsForPlaybackId(id)  — fire-and-forget hook called when
//                                      content is registered in-app with a
//                                      muxPlaybackId, so future uploads get
//                                      captions without any manual step.
//
// Mux processes captions asynchronously (video.asset.track.ready webhook,
// text_source "generated_vod"); expect them to appear on videos within
// minutes of a run. Failures here must never block content creation.
// ---------------------------------------------------------------------------

import { video } from "./mux";

const MUX_API_BASE = "https://api.mux.com";

// Pacing between generate-subtitles calls, and backoff schedule for 429s.
// Mux rate-limits bursts; ~2 requests/second stays comfortably under it.
const REQUEST_SPACING_MS = 500;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function muxAuthHeader(): string {
  const tokenId = process.env.MUX_TOKEN_ID || "";
  const tokenSecret = process.env.MUX_TOKEN_SECRET || "";
  return "Basic " + Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
}

type MuxTrack = {
  id?: string;
  type?: string; // 'video' | 'audio' | 'text'
  text_source?: string; // 'generated_vod' for auto captions
  language_code?: string;
};

type MuxAsset = {
  id: string;
  status?: string; // 'preparing' | 'ready' | 'errored'
  duration?: number;
  tracks?: MuxTrack[];
  playback_ids?: Array<{ id: string }>;
};

export interface CaptionBackfillReport {
  assetsScanned: number;
  inAppAssets: number;
  captionsRequested: number;
  skippedAlreadyCaptioned: number;
  skippedNoAudioTrack: number;
  skippedNotReady: number;
  skippedNotInApp: number;
  failed: Array<{ assetId: string; error: string }>;
}

function hasTextTrack(asset: MuxAsset): boolean {
  return (asset.tracks || []).some((t) => t.type === "text");
}

function audioTrackId(asset: MuxAsset): string | null {
  const track = (asset.tracks || []).find((t) => t.type === "audio");
  return track?.id || null;
}

/**
 * Asks Mux to generate English captions on one asset's audio track.
 * REST call (POST /video/v1/assets/{id}/tracks/{audioTrackId}/generate-subtitles)
 * rather than an SDK helper so behaviour is independent of SDK version.
 * Retries 429s with exponential backoff; throws after the schedule runs out.
 */
async function requestGeneratedSubtitles(assetId: string, trackId: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `${MUX_API_BASE}/video/v1/assets/${assetId}/tracks/${trackId}/generate-subtitles`,
      {
        method: "POST",
        headers: {
          Authorization: muxAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generated_subtitles: [{ language_code: "en", name: "English (auto)" }],
        }),
      },
    );
    if (res.ok) return;

    const body = await res.text().catch(() => "");
    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt];
      console.log(`[mux-captions] rate limited, waiting ${delay / 1000}s (attempt ${attempt + 1})`);
      await sleep(delay);
      continue;
    }
    throw new Error(`Mux generate-subtitles ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Lists every asset in the Mux account, following pagination. */
async function listAllAssets(): Promise<MuxAsset[]> {
  const out: MuxAsset[] = [];
  let page = 1;
  const limit = 100;
  // Manual pagination keeps us compatible with any @mux/mux-node version.
  // Hard cap of 50 pages (5,000 assets) as a runaway guard.
  while (page <= 50) {
    const res: any = await video.assets.list({ limit, page } as any);
    const batch: MuxAsset[] = res?.data ?? res ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  return out;
}

/**
 * Playback IDs of every video actually used in the app: learn content, path
 * content, and video workouts. Exercise demo clips are deliberately excluded
 * (short, usually speech-free — captions would be noise).
 */
async function getInAppPlaybackIds(): Promise<Set<string>> {
  const { db } = await import("./db");
  const { isNotNull } = await import("drizzle-orm");
  const schema = await import("@shared/schema");
  const ids = new Set<string>();

  const sources: Array<{ table: any; column: any }> = [
    { table: schema.learnContentLibrary, column: schema.learnContentLibrary.muxPlaybackId },
    { table: schema.pathContentItems, column: schema.pathContentItems.muxPlaybackId },
    { table: schema.workouts, column: schema.workouts.muxPlaybackId },
  ];

  for (const src of sources) {
    try {
      const rows = await db
        .select({ playbackId: src.column })
        .from(src.table)
        .where(isNotNull(src.column));
      for (const r of rows) {
        if (r.playbackId) ids.add(String(r.playbackId));
      }
    } catch (e: any) {
      console.error("[mux-captions] failed reading playback IDs from a table:", e?.message || e);
    }
  }

  return ids;
}

/**
 * Sweep: enable captions on every ready, caption-less, in-app asset with an
 * audio track. Paced to respect Mux rate limits (expect roughly 2 assets per
 * second, so a few minutes for a large library). Safe to re-run any time —
 * already-captioned assets are skipped, so it doubles as a "catch any
 * stragglers" button after a partial run.
 */
export async function runCaptionBackfill(): Promise<CaptionBackfillReport> {
  const report: CaptionBackfillReport = {
    assetsScanned: 0,
    inAppAssets: 0,
    captionsRequested: 0,
    skippedAlreadyCaptioned: 0,
    skippedNoAudioTrack: 0,
    skippedNotReady: 0,
    skippedNotInApp: 0,
    failed: [],
  };

  const [assets, inAppIds] = await Promise.all([listAllAssets(), getInAppPlaybackIds()]);
  report.assetsScanned = assets.length;

  for (const asset of assets) {
    try {
      const isInApp = (asset.playback_ids || []).some((p) => inAppIds.has(p.id));
      if (!isInApp) {
        report.skippedNotInApp++;
        continue;
      }
      report.inAppAssets++;

      if (asset.status !== "ready") {
        report.skippedNotReady++;
        continue;
      }
      if (hasTextTrack(asset)) {
        report.skippedAlreadyCaptioned++;
        continue;
      }
      const trackId = audioTrackId(asset);
      if (!trackId) {
        report.skippedNoAudioTrack++;
        continue;
      }
      await requestGeneratedSubtitles(asset.id, trackId);
      report.captionsRequested++;
      console.log(`[mux-captions] requested captions for asset ${asset.id} (${report.captionsRequested} so far)`);
      await sleep(REQUEST_SPACING_MS);
    } catch (e: any) {
      report.failed.push({ assetId: asset.id, error: String(e?.message || e) });
      console.error(`[mux-captions] failed for asset ${asset.id}:`, e?.message || e);
    }
  }

  return report;
}

/**
 * Ensures one video (looked up by playback ID) has captions. Called
 * fire-and-forget when content is registered in-app, so newly uploaded videos
 * get captions automatically. Quietly does nothing if the asset already has a
 * text track, isn't ready yet, or can't be found.
 */
export async function ensureCaptionsForPlaybackId(playbackId: string | null | undefined): Promise<void> {
  if (!playbackId) return;
  try {
    const assets = await listAllAssets();
    const asset = assets.find((a) => a.playback_ids?.some((p) => p.id === playbackId));
    if (!asset) {
      console.log(`[mux-captions] no asset found for playback ${playbackId}`);
      return;
    }
    if (asset.status !== "ready" || hasTextTrack(asset)) return;
    const trackId = audioTrackId(asset);
    if (!trackId) return;
    await requestGeneratedSubtitles(asset.id, trackId);
    console.log(`[mux-captions] requested captions for asset ${asset.id} (playback ${playbackId})`);
  } catch (e: any) {
    // Never let caption plumbing affect content creation.
    console.error("[mux-captions] ensureCaptionsForPlaybackId failed:", e?.message || e);
  }
}
