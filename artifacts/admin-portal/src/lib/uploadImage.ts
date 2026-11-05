const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

// Phones show these images in cards a few hundred pixels wide, but admins
// upload phone-camera originals (a 5.7 MB PNG was taking a minute to appear
// on the Aches & Fixes screen). Every upload is resized to at most 1600 px on
// the long side and saved as JPEG (or PNG when it has transparency) before
// it goes anywhere. Logos use their own trim-and-resize (processLogo.ts).
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.84;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image file")); };
    img.src = url;
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Sample a grid of pixels; a fully opaque image can be saved as JPEG.
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
}

export async function shrinkImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  let img: HTMLImageElement;
  try { img = await loadImage(file); } catch { return file; }
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const tw = Math.round(w * scale), th = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, tw, th);
  const keepPng = file.type === "image/png" && hasTransparency(ctx, tw, th);
  const type = keepPng ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, type, keepPng ? undefined : JPEG_QUALITY));
  if (!blob) return file;
  // Only swap in the smaller version; never make a file bigger.
  if (scale === 1 && blob.size >= file.size) return file;
  const name = file.name.replace(/\.[a-z0-9]+$/i, "") + (keepPng ? ".png" : ".jpg");
  return new File([blob], name, { type });
}

export async function uploadImageFile(
  file: File,
  options?: { visibility?: "public" | "private"; skipResize?: boolean },
): Promise<string> {
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("File too large (max 25MB)");
  }
  if (!options?.skipResize) {
    file = await shrinkImageForUpload(file);
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

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });

  if (!putRes.ok) {
    throw new Error(
      `Storage upload failed (${putRes.status} ${putRes.statusText || "error"})`,
    );
  }

  if (options?.visibility) {
    try {
      await fetch("/api/uploads/finalize-acl", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath, visibility: options.visibility }),
      });
    } catch {
      // non-fatal: image is uploaded, ACL just isn't set
    }
  }

  return objectPath;
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Could not upload image";
}
