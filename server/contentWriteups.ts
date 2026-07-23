// ---------------------------------------------------------------------------
// Transcript-based write-ups for Mux learn videos.
//
// Once Mux has auto-captioned a video (see muxCaptions.ts), the spoken content
// is retrievable as a plain-text transcript at
//   https://stream.mux.com/{playbackId}/text/{trackId}.txt
// where trackId is the id of the asset's generated text track.
//
// This module turns that transcript into three pieces of written content on
// the learn_content_library row, so every Mux-hosted lab video gets a written
// companion for people who want to read rather than (or after) watch:
//   description   — 1-2 sentence blurb (also feeds the coach's tag search).
//                   Only filled when empty unless force=true, so hand-written
//                   copy is never clobbered.
//   summary       — one short paragraph, the "what this covers" read.
//   keyTakeaways  — 3-6 bullet points, the "confirmation of what you watched".
//   transcript    — the cleaned full transcript, stored so the video page can
//                   show a collapsible written version with no client-side Mux
//                   calls.
//
// Scope is deliberately narrow: ONLY learn_content_library rows that have a
// muxPlaybackId (the Mux-hosted lab videos). PDFs, articles and self-hosted
// videos are untouched — they have no Mux transcript.
//
// Entry point:
//   runWriteupBackfill({ dryRun, force }) — sweeps every Mux lab video.
//     dryRun=true  -> generate and RETURN proposals, write nothing (review).
//     force=true   -> regenerate even rows that already have a write-up, and
//                     overwrite existing descriptions.
//     Idempotent by default: skips rows that already have summary+takeaways,
//     and only fills a description when it's empty. Safe to re-run — it also
//     doubles as a "catch stragglers" pass once Mux finishes captioning a
//     freshly uploaded video (captions process asynchronously over minutes,
//     so a new video's transcript is usually ready on the next run).
//   Admin: POST /api/admin/content-writeups/backfill  { dryRun?, force? }
//
// Transcript fetch never blocks and never throws upward: a video with no
// caption track yet, or an unreachable transcript, is skipped with a reason.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { learnContentLibrary, learnTopics } from "@shared/schema";
import { aiCall } from "./ai";
import { getFeatureConfig } from "./aiProvider";

const MUX_API_BASE = "https://api.mux.com";
const MUX_STREAM_BASE = "https://stream.mux.com";

// Whisper transcripts of a several-minute talking-head video are a few
// thousand words; cap what we feed the model so a rare very long video can't
// blow the prompt budget. The full transcript is still stored in the DB.
const MAX_TRANSCRIPT_CHARS_FOR_AI = 24_000;

function muxAuthHeader(): string {
  const tokenId = process.env.MUX_TOKEN_ID || "";
  const tokenSecret = process.env.MUX_TOKEN_SECRET || "";
  return "Basic " + Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
}

type MuxTrack = {
  id?: string;
  type?: string; // 'video' | 'audio' | 'text'
  text_source?: string; // 'generated_vod' for auto captions
  status?: string; // 'ready' for a finished generated track
  language_code?: string;
};

type MuxAsset = {
  id: string;
  status?: string;
  tracks?: MuxTrack[];
  playback_ids?: Array<{ id: string }>;
};

/** Lists every asset in the Mux account, following pagination (max 50 pages). */
async function listAllAssets(): Promise<MuxAsset[]> {
  const { video } = await import("./mux");
  const out: MuxAsset[] = [];
  let page = 1;
  const limit = 100;
  while (page <= 50) {
    const res: any = await (video as any).assets.list({ limit, page } as any);
    const batch: MuxAsset[] = res?.data ?? res ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  return out;
}

/**
 * Picks the best text track to use as the transcript source: a ready,
 * auto-generated English track first, then any ready text track, then any
 * text track at all. Returns its id, or null if the asset has none.
 */
function transcriptTrackId(asset: MuxAsset): string | null {
  const texts = (asset.tracks || []).filter((t) => t.type === "text" && t.id);
  if (texts.length === 0) return null;
  const ready = texts.filter((t) => t.status === undefined || t.status === "ready");
  const pool = ready.length > 0 ? ready : texts;
  const generatedEn = pool.find(
    (t) => t.text_source === "generated_vod" && (t.language_code || "en").startsWith("en"),
  );
  const generated = pool.find((t) => t.text_source === "generated_vod");
  return (generatedEn || generated || pool[0]).id || null;
}

/** playbackId -> textTrackId for every asset that has a usable text track. */
async function buildTranscriptTrackMap(): Promise<Map<string, string>> {
  const assets = await listAllAssets();
  const map = new Map<string, string>();
  for (const asset of assets) {
    const trackId = transcriptTrackId(asset);
    if (!trackId) continue;
    for (const p of asset.playback_ids || []) {
      if (p.id) map.set(p.id, trackId);
    }
  }
  return map;
}

/**
 * Strips WebVTT scaffolding (header, NOTE blocks, cue numbers, timestamp
 * lines) and de-duplicates immediately repeated lines, leaving readable prose.
 * The .txt endpoint usually returns clean text already; this is defensive so
 * we're robust if a track serves VTT-flavoured text.
 */
function cleanTranscript(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  const kept: string[] = [];
  let last = "";
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (/^WEBVTT/i.test(l)) continue;
    if (/^NOTE(\s|$)/.test(l)) continue;
    if (/^\d+$/.test(l)) continue; // cue number
    if (/-->/.test(l)) continue; // timestamp line
    if (l === last) continue; // collapse duplicate consecutive cues
    kept.push(l);
    last = l;
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/** Fetches and cleans the transcript for a playback+track pair. */
async function fetchTranscript(playbackId: string, trackId: string): Promise<string> {
  const url = `${MUX_STREAM_BASE}/${playbackId}/text/${trackId}.txt`;
  const res = await fetch(url, { headers: { Authorization: muxAuthHeader() } });
  if (!res.ok) {
    throw new Error(`transcript fetch ${res.status} for ${playbackId}/${trackId}`);
  }
  const text = await res.text();
  return cleanTranscript(text);
}

const writeupSchema = z.object({
  description: z.string().default(""),
  summary: z.string().default(""),
  keyTakeaways: z.array(z.string()).default([]),
});
type Writeup = z.infer<typeof writeupSchema>;

async function resolveProviderConfig(): Promise<{ provider?: string; model?: string }> {
  try {
    const config = await getFeatureConfig("recovery_coach");
    if (config) return { provider: config.provider, model: config.model };
  } catch {}
  return {};
}

async function generateWriteup(
  title: string,
  topicTitle: string | null | undefined,
  transcript: string,
  provider?: string,
  model?: string,
): Promise<Writeup | null> {
  const clipped = transcript.slice(0, MAX_TRANSCRIPT_CHARS_FOR_AI);
  const prompt = `You write the written companion for a wellness/fitness education video inside an executive health app. You are given the video's automatic transcript (speech-to-text, so it may have small errors — infer sensibly, never quote it verbatim). Produce clean, on-brand written content a member can read instead of, or right after, watching — especially to confirm in writing what the video covered.

VIDEO
Title: "${title}"
Topic: "${topicTitle || "(none)"}"

TRANSCRIPT
"""
${clipped}
"""

Write three things:
1. description — ONE to TWO plain sentences (max ~280 characters) that say what the video is about and who it helps. Neutral, no hype, no "in this video".
2. summary — ONE short paragraph (3-5 sentences) covering the main thread of the video in your own words. Written for someone deciding whether to watch, or reminding themselves afterwards.
3. keyTakeaways — 3 to 6 short bullet points, each a single concrete, standalone point or action a member should remember. No numbering, no leading dashes, one idea per bullet.

Rules:
- British English. Warm, direct, practical. No filler, no "this video will".
- Only use what's actually in the transcript. If it's too thin for a real takeaway, give fewer bullets rather than padding.
- Do not invent statistics, studies, or claims not spoken in the video.

Respond ONLY with JSON: {"description": string, "summary": string, "keyTakeaways": string[]}`;

  const result = await aiCall<Writeup>({
    feature: "content_writeup",
    prompt,
    schema: writeupSchema as z.ZodType<Writeup>,
    provider,
    model,
    maxTokens: 900,
    temperature: 0.3,
    timeoutMs: 40_000,
  });
  return result.data;
}

export interface WriteupProposal {
  id: number;
  title: string;
  playbackId: string;
  description: string;
  summary: string;
  keyTakeaways: string[];
  transcriptChars: number;
  descriptionWasEmpty: boolean;
  wrote: boolean;
}

export interface WriteupBackfillReport {
  muxVideos: number;
  generated: number;
  wrote: number;
  skippedAlreadyDone: number;
  skippedNoTranscriptYet: number;
  skippedEmptyTranscript: number;
  failed: Array<{ id: number; title: string; error: string }>;
  dryRun: boolean;
  force: boolean;
  proposals: WriteupProposal[];
}

function normaliseTakeaways(items: string[]): string[] {
  return (items || [])
    .map((s) => String(s || "").replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Sweep every Mux-hosted lab video and generate its written companion from the
 * Mux transcript. See the module header for dryRun / force semantics.
 * Sequential on purpose — gentle on the AI provider, report stays ordered, and
 * at ~50 videos it's a couple of minutes and pennies.
 */
export async function runWriteupBackfill(
  opts: { dryRun?: boolean; force?: boolean } = {},
): Promise<WriteupBackfillReport> {
  const dryRun = opts.dryRun === true;
  const force = opts.force === true;
  const report: WriteupBackfillReport = {
    muxVideos: 0,
    generated: 0,
    wrote: 0,
    skippedAlreadyDone: 0,
    skippedNoTranscriptYet: 0,
    skippedEmptyTranscript: 0,
    failed: [],
    dryRun,
    force,
    proposals: [],
  };

  const [rows, trackMap] = await Promise.all([
    db
      .select({
        id: learnContentLibrary.id,
        title: learnContentLibrary.title,
        description: learnContentLibrary.description,
        muxPlaybackId: learnContentLibrary.muxPlaybackId,
        summary: learnContentLibrary.summary,
        keyTakeaways: learnContentLibrary.keyTakeaways,
        topicTitle: learnTopics.title,
      })
      .from(learnContentLibrary)
      .leftJoin(learnTopics, eq(learnContentLibrary.topicId, learnTopics.id))
      .where(isNotNull(learnContentLibrary.muxPlaybackId)),
    buildTranscriptTrackMap(),
  ]);

  const { provider, model } = await resolveProviderConfig();

  for (const row of rows) {
    const playbackId = String(row.muxPlaybackId);
    report.muxVideos++;

    const alreadyDone =
      !!row.summary &&
      Array.isArray(row.keyTakeaways) &&
      row.keyTakeaways.length > 0;
    if (alreadyDone && !force) {
      report.skippedAlreadyDone++;
      continue;
    }

    const trackId = trackMap.get(playbackId);
    if (!trackId) {
      // Captions not generated / not finished processing yet.
      report.skippedNoTranscriptYet++;
      continue;
    }

    try {
      const transcript = await fetchTranscript(playbackId, trackId);
      if (!transcript || transcript.length < 40) {
        report.skippedEmptyTranscript++;
        continue;
      }

      const writeup = await generateWriteup(row.title, row.topicTitle, transcript, provider, model);
      if (!writeup) {
        report.failed.push({ id: row.id, title: row.title, error: "no write-up returned" });
        continue;
      }
      report.generated++;

      const takeaways = normaliseTakeaways(writeup.keyTakeaways);
      const descWasEmpty = !row.description || row.description.trim().length === 0;
      const newDescription =
        (descWasEmpty || force) && writeup.description.trim()
          ? writeup.description.trim()
          : row.description || null;
      const newSummary = writeup.summary.trim() || null;

      const proposal: WriteupProposal = {
        id: row.id,
        title: row.title,
        playbackId,
        description: newDescription || "",
        summary: newSummary || "",
        keyTakeaways: takeaways,
        transcriptChars: transcript.length,
        descriptionWasEmpty: descWasEmpty,
        wrote: false,
      };

      if (!dryRun) {
        await db
          .update(learnContentLibrary)
          .set({
            description: newDescription,
            summary: newSummary,
            keyTakeaways: takeaways.length > 0 ? takeaways : null,
            transcript,
          })
          .where(eq(learnContentLibrary.id, row.id));
        proposal.wrote = true;
        report.wrote++;
        console.log(`[content-writeups] wrote ${row.id} "${row.title}" (${takeaways.length} takeaways)`);
      } else {
        console.log(`[content-writeups] (dry run) ${row.id} "${row.title}" (${takeaways.length} takeaways)`);
      }

      report.proposals.push(proposal);
    } catch (e: any) {
      report.failed.push({ id: row.id, title: row.title, error: String(e?.message || e) });
      console.error(`[content-writeups] failed for ${row.id} "${row.title}":`, e?.message || e);
    }
  }

  console.log(
    `[content-writeups] backfill done (${dryRun ? "dry run" : "write"}${force ? ", force" : ""}): ` +
      `${report.muxVideos} Mux videos, ${report.generated} generated, ${report.wrote} written, ` +
      `${report.skippedAlreadyDone} already done, ${report.skippedNoTranscriptYet} no transcript yet, ` +
      `${report.skippedEmptyTranscript} empty transcript, ${report.failed.length} failed.`,
  );
  return report;
}
