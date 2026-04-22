import { storage } from "./storage";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { randomUUID } from "crypto";

let hasRunProfileImages = false;

async function uploadBufferAsPublicProfileImage(
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const svc = new ObjectStorageService();
  const privateDir = svc.getPrivateObjectDir();
  const trimmedDir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const entityId = `profile-images/${randomUUID()}`;
  const fullPath = `${trimmedDir}/${entityId}`;
  const parts = fullPath.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, {
    contentType,
    metadata: {
      contentType,
      metadata: {
        "custom:aclPolicy": JSON.stringify({ owner: "system", visibility: "public" }),
      },
    },
    resumable: false,
  });
  return `/objects/${entityId}`;
}

/**
 * Convert any user.profileImageUrl values still stored as base64 data URLs into
 * Object Storage entries with a public ACL. Also clears legacy /uploads/* paths
 * that no longer resolve. Safe to call on every boot — does nothing if the DB
 * has no remaining legacy values.
 */
export async function runProfileImageMigrationOnce(): Promise<void> {
  if (hasRunProfileImages) return;
  hasRunProfileImages = true;

  // Skip entirely if Object Storage is not configured (e.g. local dev without
  // the integration). The endpoint is still callable manually if needed.
  if (!process.env.PRIVATE_OBJECT_DIR || !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
    return;
  }

  let allUsers;
  try {
    allUsers = await storage.getAllUsers();
  } catch (e) {
    console.error("[startup-migration] could not list users:", e);
    return;
  }

  const candidates = allUsers.filter(
    (u) => u.profileImageUrl && (u.profileImageUrl.startsWith("data:") || u.profileImageUrl.startsWith("/uploads/")),
  );
  if (candidates.length === 0) return;

  console.log(`[startup-migration] profile-images: ${candidates.length} user(s) need migration`);

  let migrated = 0;
  let cleared = 0;
  const skipped: string[] = [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (const u of candidates) {
    const url = u.profileImageUrl as string;
    try {
      if (url.startsWith("data:")) {
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) {
          skipped.push(u.id);
          continue;
        }
        const mime = m[1];
        const buf = Buffer.from(m[2], "base64");
        const objectPath = await uploadBufferAsPublicProfileImage(buf, mime);
        await storage.updateUser(u.id, { profileImageUrl: objectPath });
        migrated++;
      } else if (url.startsWith("/uploads/")) {
        await storage.updateUser(u.id, { profileImageUrl: null as any });
        cleared++;
      }
    } catch (e: any) {
      errors.push({ userId: u.id, error: e?.message || String(e) });
    }
  }

  console.log(
    `[startup-migration] profile-images done: migrated=${migrated} clearedLegacyUploads=${cleared} skippedUnparseable=${skipped.length} errors=${errors.length}`,
  );
  if (skipped.length) console.log("[startup-migration] skipped userIds:", skipped);
  if (errors.length) console.log("[startup-migration] errors:", errors);
}
