// Upload helper for audio files (e.g. guided meditations).
//
// Mirrors uploadImageFile but for audio: it accepts audio/* files, allows a
// much larger size limit, reports progress, and uploads directly to Replit
// Object Storage via the shared presigned-URL flow (POST /api/uploads/request-url
// -> PUT to storage -> POST /api/uploads/finalize-acl). Returns the objectPath
// that should be stored as the meditation's audioUrl.

const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200MB

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac"];

function looksLikeAudio(file: File): boolean {
  if (file.type && file.type.startsWith("audio/")) return true;
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function putWithProgress(
  uploadURL: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadURL, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${xhr.status} ${xhr.statusText || "error"})`));
    };
    xhr.onerror = () => reject(new Error("Storage upload failed (network error)"));
    xhr.send(file);
  });
}

export async function uploadAudioFile(
  file: File,
  options?: { visibility?: "public" | "private"; onProgress?: (pct: number) => void },
): Promise<string> {
  if (!looksLikeAudio(file)) {
    throw new Error("Only audio files are allowed (mp3, m4a, wav, aac, ogg)");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("File too large (max 200MB)");
  }

  const requestRes = await fetch("/api/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!requestRes.ok) {
    let message = `Could not get upload URL (${requestRes.status} ${requestRes.statusText})`;
    try {
      const data = await requestRes.json();
      if (data?.error) message = data.error;
      else if (data?.message) message = data.message;
    } catch {}
    throw new Error(message);
  }

  const { uploadURL, objectPath } = await requestRes.json();
  if (!uploadURL || !objectPath) {
    throw new Error("Upload URL response was incomplete");
  }

  await putWithProgress(uploadURL, file, options?.onProgress);

  // Meditation audio is played by all users, so default to public visibility.
  const visibility = options?.visibility ?? "public";
  try {
    await fetch("/api/uploads/finalize-acl", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath, visibility }),
    });
  } catch {
    // non-fatal: file is uploaded, ACL just isn't set
  }

  return objectPath;
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Could not upload audio";
}
