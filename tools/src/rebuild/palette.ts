// Sampled palette from raw RGB pixels. Pure: ffmpeg hands over downscaled frames, this picks the dominant colours.

export type PaletteColour = { hex: string; share: number };

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** Buckets pixels to 4 bits per channel, then merges buckets that look alike, and returns the biggest `count` colours. */
export function quantizePalette(rgb: Uint8Array, count = 6, mergeDistance = 48): PaletteColour[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const total = Math.floor(rgb.length / 3);
  if (total === 0) return [];
  for (let i = 0; i < total; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.n++;
    } else buckets.set(key, { r, g, b, n: 1 });
  }

  const means = [...buckets.values()]
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, n: c.n }))
    .sort((x, y) => y.n - x.n);

  const merged: { r: number; g: number; b: number; n: number }[] = [];
  for (const c of means) {
    const near = merged.find((m) => Math.hypot(m.r - c.r, m.g - c.g, m.b - c.b) <= mergeDistance);
    if (near) {
      const n = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / n;
      near.g = (near.g * near.n + c.g * c.n) / n;
      near.b = (near.b * near.n + c.b * c.n) / n;
      near.n = n;
    } else merged.push({ ...c });
  }

  return merged
    .sort((x, y) => y.n - x.n)
    .slice(0, count)
    .map((c) => ({ hex: toHex(Math.round(c.r), Math.round(c.g), Math.round(c.b)), share: Math.round((c.n / total) * 1000) / 1000 }));
}
