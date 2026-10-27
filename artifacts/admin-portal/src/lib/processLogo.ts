// Prepares a company logo for the mobile app before it is uploaded.
//
// The app shows the logo in a 150 x 36 box at the top of Home. Logos arrive in
// every shape: big empty margins, a solid background box, phone-camera sizes.
// This does three things so every logo fills that box the same way:
//   1. Trims empty margins (transparent edges, or a solid colour that runs
//      round the whole edge), so the logo itself fills the box, not padding.
//   2. Resizes to at most 600 x 144 (4x the app box, sharp on every phone)
//      and never enlarges a small image.
//   3. Saves as PNG, keeping any transparency.
// It returns notes the admin should see, e.g. a solid background box.

export type ProcessedLogo = {
  file: File;
  width: number;
  height: number;
  notes: string[];
};

const MAX_W = 600;
const MAX_H = 144;
const MIN_W_SHARP = 300; // below this width the logo can look soft on the phone
const TOLERANCE = 24;    // colour difference still treated as "the same background"

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image file")); };
    img.src = url;
  });
}

export async function processLogo(file: File): Promise<ProcessedLogo> {
  const img = await loadImage(file);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error("That image file is empty");

  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, w, h).data;
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  // What counts as background: transparent, or the colour all four corners share.
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const near = (a: number[], b: number[]) =>
    Math.abs(a[0] - b[0]) <= TOLERANCE && Math.abs(a[1] - b[1]) <= TOLERANCE && Math.abs(a[2] - b[2]) <= TOLERANCE && Math.abs(a[3] - b[3]) <= TOLERANCE;
  const allTransparent = corners.every((c) => c[3] < 16);
  const solidBg = !allTransparent && corners.every((c) => near(c, corners[0]) && c[3] > 240) ? corners[0] : null;
  const bgR = solidBg ? solidBg[0] : 0, bgG = solidBg ? solidBg[1] : 0, bgB = solidBg ? solidBg[2] : 0;

  // Bounding box of everything that is not background (flat loop: large photos stay fast).
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const a = data[i + 3];
      if (a < 16) continue;
      if (solidBg && Math.abs(data[i] - bgR) <= TOLERANCE && Math.abs(data[i + 1] - bgG) <= TOLERANCE && Math.abs(data[i + 2] - bgB) <= TOLERANCE) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; } // nothing found: keep it all

  // A little breathing room so the logo doesn't touch the edge.
  const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.03);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;

  const scale = Math.min(1, MAX_W / cw, MAX_H / ch);
  const ow = Math.max(1, Math.round(cw * scale)), oh = Math.max(1, Math.round(ch * scale));

  const out = document.createElement("canvas");
  out.width = ow; out.height = oh;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, minX, minY, cw, ch, 0, 0, ow, oh);

  const blob: Blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save the logo"))), "image/png"));
  const name = (file.name.replace(/\.[^.]+$/, "") || "logo") + ".png";

  const notes: string[] = [];
  if (solidBg) {
    notes.push("This logo has a solid background colour, so it shows as a box in the app. A PNG with a transparent background looks cleaner.");
  }
  if (ow < MIN_W_SHARP && oh < MAX_H) {
    notes.push(`This logo is small (${ow} x ${oh} pixels) and may look soft on phones. A file at least 600 pixels wide looks sharp.`);
  }

  return { file: new File([blob], name, { type: "image/png" }), width: ow, height: oh, notes };
}
