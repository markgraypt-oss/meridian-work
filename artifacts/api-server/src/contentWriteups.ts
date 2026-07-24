// ---------------------------------------------------------------------------
// Transcript-based write-ups for Mux learn videos.  (self-contained edition)
//
// Once Mux has auto-captioned a video (muxCaptions.ts), the spoken content is
// retrievable as a plain-text transcript at
//   https://stream.mux.com/{playbackId}/text/{trackId}.txt
// where trackId is the id of the asset's generated text track.
//
// This turns that transcript into written content on the learn_content_library
// row, so every Mux-hosted lab video gets a written companion:
//   description   — 1-2 sentence blurb (only filled when empty unless force).
//   summary       — one short paragraph.
//   key_takeaways — 3-6 bullet points.
//   transcript    — cleaned full transcript, stored for the on-page reader.
//
// Deliberately self-contained: it creates the three columns itself (ALTER TABLE
// ... ADD COLUMN IF NOT EXISTS) and reads/writes them with plain SQL, so it
// needs no schema-file changes and no server reboot. Scope: ONLY
// learn_content_library rows with a mux_playback_id.
//
//   runWriteupBackfill({ dryRun, force })
//     dryRun=true  -> generate and RETURN proposals, write nothing.
//     force=true   -> regenerate rows already done, overwrite descriptions.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { pool } from "./db";
import { aiCall } from "./ai";
import { getFeatureConfig } from "./aiProvider";

const MUX_STREAM_BASE = "https://stream.mux.com";
const MAX_TRANSCRIPT_CHARS_FOR_AI = 24_000;

type MuxTrack = { id?: string; type?: string; text_source?: string; status?: string; language_code?: string };
type MuxAsset = { id: string; status?: string; tracks?: MuxTrack[]; playback_ids?: Array<{ id: string }> };

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

function transcriptTrackId(asset: MuxAsset): string | null {
  const texts = (asset.tracks || []).filter((t) => t.type === "text" && t.id);
  if (texts.length === 0) return null;
  const ready = texts.filter((t) => t.status === undefined || t.status === "ready");
  const pool2 = ready.length > 0 ? ready : texts;
  const generatedEn = pool2.find(
    (t) => t.text_source === "generated_vod" && (t.language_code || "en").startsWith("en"),
  );
  const generated = pool2.find((t) => t.text_source === "generated_vod");
  return (generatedEn || generated || pool2[0]).id || null;
}

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

function cleanTranscript(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  const kept: string[] = [];
  let last = "";
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (/^WEBVTT/i.test(l)) continue;
    if (/^NOTE(\s|$)/.test(l)) continue;
    if (/^\d+$/.test(l)) continue;
    if (/-->/.test(l)) continue;
    if (l === last) continue;
    kept.push(l);
    last = l;
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchTranscript(playbackId: string, trackId: string): Promise<string> {
  // Public playback assets: the transcript on the stream.mux.com delivery
  // domain needs NO auth header (sending one makes Mux 400). Try .txt, then
  // fall back to the .vtt form and strip cues in cleanTranscript().
  const base = `${MUX_STREAM_BASE}/${playbackId}/text/${trackId}`;
  let res = await fetch(`${base}.txt`);
  if (!res.ok) res = await fetch(`${base}.vtt`);
  if (!res.ok) throw new Error(`transcript fetch ${res.status} for ${playbackId}/${trackId}`);
  return cleanTranscript(await res.text());
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

/** Creates the three columns if missing — safe to run every time. */
async function ensureColumns(): Promise<void> {
  await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS summary text`);
  await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS key_takeaways text[]`);
  await pool.query(`ALTER TABLE learn_content_library ADD COLUMN IF NOT EXISTS transcript text`);
}

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

  await ensureColumns();

  const [{ rows }, trackMap] = await Promise.all([
    pool.query(
      `SELECT l.id, l.title, l.description, l.mux_playback_id, l.summary, l.key_takeaways,
              t.title AS topic_title
         FROM learn_content_library l
         LEFT JOIN learn_topics t ON l.topic_id = t.id
        WHERE l.mux_playback_id IS NOT NULL`,
    ),
    buildTranscriptTrackMap(),
  ]);

  const { provider, model } = await resolveProviderConfig();

  for (const row of rows as any[]) {
    const playbackId = String(row.mux_playback_id);
    report.muxVideos++;

    const alreadyDone =
      !!row.summary && Array.isArray(row.key_takeaways) && row.key_takeaways.length > 0;
    if (alreadyDone && !force) {
      report.skippedAlreadyDone++;
      continue;
    }

    const trackId = trackMap.get(playbackId);
    if (!trackId) {
      report.skippedNoTranscriptYet++;
      continue;
    }

    try {
      const transcript = await fetchTranscript(playbackId, trackId);
      if (!transcript || transcript.length < 40) {
        report.skippedEmptyTranscript++;
        continue;
      }

      const writeup = await generateWriteup(row.title, row.topic_title, transcript, provider, model);
      if (!writeup) {
        report.failed.push({ id: row.id, title: row.title, error: "no write-up returned" });
        continue;
      }
      report.generated++;

      const takeaways = normaliseTakeaways(writeup.keyTakeaways);
      const descWasEmpty = !row.description || String(row.description).trim().length === 0;
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
        await pool.query(
          `UPDATE learn_content_library
              SET description = $1, summary = $2, key_takeaways = $3, transcript = $4
            WHERE id = $5`,
          [newDescription, newSummary, takeaways.length > 0 ? takeaways : null, transcript, row.id],
        );
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
