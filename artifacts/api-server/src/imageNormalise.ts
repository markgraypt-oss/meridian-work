import { randomUUID } from "crypto";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient, ObjectNotFoundError } from "./replit_integrations/object_storage";

/**
 * Every image the app serves goes through here, so no screen can ever be
 * handed a 6 MB, 4000-pixel PNG again.
 *
 * Why this exists: on 5 Nov 2026 two testers' Android phones were killed by
 * the programme picker. Sixty programme covers had been uploaded as 6 MB
 * PNGs (275 MB in total); the phone decoded them at full size and ran out of
 * memory. The admin portal had been shrinking new uploads in the browser
 * since September, but images that reached storage any other way (older
 * uploads, AI-generated covers, scripts) were never touched.
 *
 * Rules, applied in one place:
 *   - longest edge at most MAX_EDGE pixels
 *   - re-encoded as JPEG (quality 82), or PNG only when it has transparency
 *   - GIF and SVG are left alone (animation, vectors)
 *   - anything already small and within bounds is left byte-for-byte as is
 *
 * Three callers:
 *   1. normaliseImageBuffer: server-side uploads (progress photos, profile
 *      images, migrations) before the bytes are saved.
 *   2. normaliseStoredObject: after an admin upload is finalised, the stored
 *      object is rewritten in place at the same path, so every link to it
 *      serves the small version.
 *   3. normaliseAllContentImages: an admin sweep over every image_url column
 *      in the database, for images that were already there.
 */

export const MAX_EDGE = 1600;
// Below this the file is left alone even if slightly over the edge limit; a
// re-encode would gain nothing worth the write.
export const SKIP_BELOW_BYTES = 350 * 1024;
const JPEG_QUALITY = 82;

type Normalised = {
  buffer: Buffer;
  contentType: string;
  changed: boolean;
  width: number;
  height: number;
  reason?: string;
};

async function loadSharp(): Promise<any | null> {
  try {
    const mod: any = await import("sharp");
    return mod.default || mod;
  } catch (err: any) {
    console.error("[images] sharp is not installed; images are stored as uploaded:", err?.message || err);
    return null;
  }
}

export async function normaliseImageBuffer(buffer: Buffer, contentType?: string | null): Promise<Normalised> {
  const ct = (contentType || "").toLowerCase();
  const unchanged = (reason: string, w = 0, h = 0): Normalised => ({ buffer, contentType: ct || "application/octet-stream", changed: false, width: w, height: h, reason });
  if (ct && !ct.startsWith("image/")) return unchanged("not an image");
  if (ct === "image/gif" || ct === "image/svg+xml") return unchanged("gif/svg left as is");
  const sharp = await loadSharp();
  if (!sharp) return unchanged("sharp unavailable");
  let meta: any;
  try {
    meta = await sharp(buffer, { failOn: "none" }).metadata();
  } catch {
    return unchanged("unreadable");
  }
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) return unchanged("no dimensions");
  if (meta.format === "gif" || meta.format === "svg") return unchanged("gif/svg left as is", width, height);
  const tooBig = Math.max(width, height) > MAX_EDGE;
  const heavy = buffer.length > SKIP_BELOW_BYTES;
  if (!tooBig && !heavy) return unchanged("already small", width, height);
  if (!tooBig && heavy && (meta.format === "jpeg" || meta.format === "webp") && buffer.length < 900 * 1024) {
    // A sub-megabyte JPEG within the pixel limit is fine as it is.
    return unchanged("acceptable", width, height);
  }
  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  if (tooBig) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const keepPng = !!meta.hasAlpha && meta.format === "png";
  const out: Buffer = keepPng
    ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
    : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  // Never make a file bigger.
  if (!tooBig && out.length >= buffer.length) return unchanged("re-encode not smaller", width, height);
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return {
    buffer: out,
    contentType: keepPng ? "image/png" : "image/jpeg",
    changed: true,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Rewrite one stored object in place if it is an oversized image. Keeps the
 * ACL metadata and the path, so nothing that links to it changes.
 */
export async function normaliseStoredObject(objectPath: string): Promise<{ objectPath: string; before: number; after: number; changed: boolean; reason?: string }> {
  const svc = new ObjectStorageService();
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || "");
  const size = Number(metadata.size || 0);
  if (!contentType.startsWith("image/")) return { objectPath, before: size, after: size, changed: false, reason: "not an image" };
  if (size > 0 && size < SKIP_BELOW_BYTES && contentType !== "image/png") {
    return { objectPath, before: size, after: size, changed: false, reason: "small" };
  }
  const [buffer] = await file.download();
  const result = await normaliseImageBuffer(buffer, contentType);
  if (!result.changed) return { objectPath, before: size, after: size, changed: false, reason: result.reason };
  const custom = (metadata.metadata || {}) as Record<string, string>;
  await file.save(result.buffer, {
    contentType: result.contentType,
    metadata: { contentType: result.contentType, metadata: custom },
    resumable: false,
  });
  return { objectPath, before: size, after: result.buffer.length, changed: true };
}

/**
 * Sweep every image URL column in the database and shrink what is stored
 * behind it. Only /objects/... paths are touched (that is where every upload
 * since the move to object storage lives). Safe to run again at any time.
 */
export async function normaliseAllContentImages(opts: { dryRun?: boolean; limit?: number } = {}): Promise<{
  scanned: number; changed: number; skipped: number; failed: number; savedBytes: number; columns: string[]; details: any[];
}> {
  const cols = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('image_url', 'cover_image_url', 'thumbnail_url', 'logo_url', 'profile_image_url')
      ORDER BY table_name`);
  const seen = new Set<string>();
  const columns: string[] = [];
  let scanned = 0, changed = 0, skipped = 0, failed = 0, savedBytes = 0;
  const details: any[] = [];
  const limit = opts.limit ?? 5000;
  for (const { table_name, column_name } of cols.rows) {
    columns.push(`${table_name}.${column_name}`);
    const rows = await pool.query(
      `SELECT DISTINCT ${column_name} AS url FROM ${table_name} WHERE ${column_name} LIKE '/objects/%'`);
    for (const { url } of rows.rows) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (scanned >= limit) break;
      scanned++;
      try {
        if (opts.dryRun) {
          const svc = new ObjectStorageService();
          const file = await svc.getObjectEntityFile(url);
          const [m] = await file.getMetadata();
          const size = Number(m.size || 0);
          if (size > SKIP_BELOW_BYTES && String(m.contentType || "").startsWith("image/")) {
            details.push({ url, table: table_name, size, wouldShrink: true });
            changed++;
          } else skipped++;
          continue;
        }
        const r = await normaliseStoredObject(url);
        if (r.changed) {
          changed++;
          savedBytes += Math.max(0, r.before - r.after);
          details.push({ url, table: table_name, before: r.before, after: r.after });
        } else skipped++;
      } catch (err: any) {
        failed++;
        if (!(err instanceof ObjectNotFoundError)) {
          details.push({ url, table: table_name, error: err?.message || String(err) });
        }
      }
    }
  }
  return { scanned, changed, skipped, failed, savedBytes, columns, details: details.slice(0, 200) };
}

// Re-exported so routes can reach the client without a second import path.
export { objectStorageClient };

// ---------------------------------------------------------------------------
// Inline (base64) images.
//
// On 8 Nov 2026 the programme list was found to be 1.75 MB, almost all of it
// ten programme covers stored as base64 text inside the image_url column.
// Every phone that opened the Movement tab downloaded, parsed, compared and
// wrote to disk 1.6 MB of image text on every refresh, which is what made the
// tabs and back buttons hang for seconds. An image belongs in object storage
// and the database holds its path, never its bytes.
// ---------------------------------------------------------------------------


const INLINE_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export function isInlineImage(value: unknown): value is string {
  return typeof value === "string" && value.length > 32 && value.startsWith("data:image/");
}

/**
 * Store a base64 data URL as a public object and return its /objects/... path.
 * The bytes go through normaliseImageBuffer first, so the stored copy is the
 * right size as well as the right place. Returns null if the text is not a
 * readable image.
 */
export async function storeInlineImage(dataUrl: string, folder = "content-images"): Promise<string | null> {
  const m = dataUrl.match(INLINE_RE);
  if (!m) return null;
  let buffer: Buffer = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  let contentType = m[1].toLowerCase();
  if (!buffer.length) return null;
  const norm = await normaliseImageBuffer(buffer, contentType);
  if (norm.changed) { buffer = norm.buffer; contentType = norm.contentType; }
  const svc = new ObjectStorageService();
  const privateDir = svc.getPrivateObjectDir();
  const trimmedDir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const entityId = `${folder}/${randomUUID()}`;
  const parts = `${trimmedDir}/${entityId}`.replace(/^\//, "").split("/");
  const file = objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
  const acl = JSON.stringify({ owner: "system", visibility: "public" });
  await file.save(buffer, { contentType, metadata: { contentType, metadata: { "custom:aclPolicy": acl } }, resumable: false });
  await file.setMetadata({ metadata: { "custom:aclPolicy": acl } });
  return `/objects/${entityId}`;
}

const IMAGE_FIELDS = ["imageUrl", "coverImageUrl", "thumbnailUrl", "logoUrl", "image_url", "cover_image_url"];

/**
 * Replace any inline image in the usual image fields of a request body with a
 * stored path, in place. Used as middleware on every JSON write, so no route
 * can save base64 into the database again. Fields that are deliberately
 * base64 (progress photos, AI photo analysis) use other names or paths and
 * are left alone.
 */
export async function replaceInlineImagesInBody(body: any): Promise<string[]> {
  const replaced: string[] = [];
  if (!body || typeof body !== "object") return replaced;
  const visit = async (obj: any, depth: number) => {
    if (!obj || typeof obj !== "object" || depth > 3) return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (IMAGE_FIELDS.includes(k) && isInlineImage(v)) {
        try {
          const path = await storeInlineImage(v);
          if (path) { obj[k] = path; replaced.push(k); }
        } catch (err: any) {
          console.error("[images] could not store inline image:", err?.message || err);
        }
      } else if (Array.isArray(v)) {
        for (const item of v) await visit(item, depth + 1);
      } else if (v && typeof v === "object") {
        await visit(v, depth + 1);
      }
    }
  };
  await visit(body, 0);
  return replaced;
}

/**
 * Sweep every image column in the database for inline base64 images and move
 * them to object storage. Safe to run again at any time.
 */
export async function inlineImagesToStorage(opts: { dryRun?: boolean } = {}): Promise<{
  found: number; moved: number; failed: number; details: any[];
}> {
  const cols = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN ('image_url', 'cover_image_url', 'thumbnail_url', 'logo_url', 'profile_image_url')
        AND data_type IN ('text', 'character varying')
      ORDER BY table_name`);
  let found = 0, moved = 0, failed = 0;
  const details: any[] = [];
  for (const { table_name, column_name } of cols.rows) {
    const rows = await pool.query(
      `SELECT id, ${column_name} AS url FROM ${table_name} WHERE ${column_name} LIKE 'data:image/%'`);
    for (const { id, url } of rows.rows) {
      found++;
      if (opts.dryRun) { details.push({ table: table_name, id, bytes: String(url).length }); continue; }
      try {
        const path = await storeInlineImage(String(url));
        if (!path) throw new Error("unreadable image data");
        await pool.query(`UPDATE ${table_name} SET ${column_name} = $1 WHERE id = $2`, [path, id]);
        moved++;
        details.push({ table: table_name, id, bytes: String(url).length, path });
      } catch (err: any) {
        failed++;
        details.push({ table: table_name, id, error: err?.message || String(err) });
      }
    }
  }
  return { found, moved, failed, details: details.slice(0, 200) };
}
