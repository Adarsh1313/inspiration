export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Vercel functions accept 4.5 MB bodies

export type SniffedImage = { ext: string; mime: string };

/** Identifies png/jpeg/webp/gif by magic bytes, never by the claimed type. */
export function sniffImage(b: Uint8Array): SniffedImage | null {
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 8 && b[0] === 0x89 && at(1, "PNG")) return { ext: "png", mime: "image/png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return { ext: "webp", mime: "image/webp" };
  if (b.length >= 6 && (at(0, "GIF87a") || at(0, "GIF89a"))) return { ext: "gif", mime: "image/gif" };
  return null;
}
