import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

/** Copies media for active cards from Storage into the mirror. Existing files are left alone (names are hashed, so they never change). */
export async function copyMedia(cards: MediaCard[], outDir: string, media: MediaStore): Promise<number> {
  let copied = 0;
  for (const card of cards.filter((c) => c.status === "active")) {
    for (const f of mirrorFiles(card)) {
      const target = join(outDir, f.path);
      if (existsSync(target)) continue;
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, await media.get(f.object));
      copied++;
    }
  }
  return copied;
}
