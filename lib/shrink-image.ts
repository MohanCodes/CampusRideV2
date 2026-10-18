// Phone photos are 3 to 10 MB, and a form posted to the server can only carry a few (Next allows 1 MB by default and
// Vercel 4.5 MB). So the browser shrinks the photo first. The server still resizes to 512 px and strips metadata
// (lib/avatar.ts); this only has to get it small enough to send. Redrawing on a canvas also drops location and camera data.

export const SHRINK_MAX_EDGE = 1024;
export const SHRINK_QUALITY = 0.85;

/** The size that fits inside `max` on the long edge, never enlarging. */
export function fitWithin(width: number, height: number, max = SHRINK_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest <= 0) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Returns a smaller JPEG of the photo, or the original file if this browser can't do it. */
export async function shrinkPhoto(file: File): Promise<File> {
  try {
    // "from-image" turns the photo upright the way its camera recorded it, since the canvas drops that note.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", SHRINK_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
