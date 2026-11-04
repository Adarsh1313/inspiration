import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MediaStore } from "./worker/media-store";

export type MediaCard = { slug: string; status: string; poster_sm: string | null; preview: string | null; original: string | null };

const VIDEO_EXT = /\.(mp4|webm|mov|gif)$/i;

/** Where each media object lands inside refs/<slug>/. clip.mp4 is git-ignored; the rest are small. */
export function mirrorFiles(c: MediaCard): { path: string; object: string }[] {
  const files: { path: string; object: string }[] = [];
  if (c.poster_sm) files.push({ path: `refs/${c.slug}/poster.jpg`, object: c.poster_sm });
  if (c.preview) files.push({ path: `refs/${c.slug}/preview.mp4`, object: c.preview });
  if (c.original) {
    const ext = c.original.split(".").pop()!.toLowerCase();
    files.push({ path: `refs/${c.slug}/${VIDEO_EXT.test(c.original) ? (ext === "gif" ? "clip.gif" : "clip.mp4") : `original.${ext}`}`, object: c.original });
  }
  return files;
}

const MANIFEST = ".media-manifest.json";

/**
 * Copies media for active cards from Storage into the mirror. Mirror file names are fixed (poster.jpg...),
 * so a manifest records which Storage object each file came from; a file is re-copied when its object changed.
 */
export async function copyMedia(cards: MediaCard[], outDir: string, media: MediaStore): Promise<number> {
  const manifestPath = join(outDir, MANIFEST);
  let manifest: Record<string, string> = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    // first run or unreadable: start fresh
  }
  let copied = 0;
  for (const card of cards.filter((c) => c.status === "active")) {
    for (const f of mirrorFiles(card)) {
      const target = join(outDir, f.path);
      if (existsSync(target) && manifest[f.path] === f.object) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, await media.get(f.object));
      manifest[f.path] = f.object;
      copied++;
    }
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return copied;
}
