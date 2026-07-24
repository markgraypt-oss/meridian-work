const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadImageFile(
  file: File,
  options?: { visibility?: "public" | "private" },
): Promise<string> {
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("File too large (max 10MB)");
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
