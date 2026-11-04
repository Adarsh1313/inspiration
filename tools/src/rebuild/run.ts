// The two commands of the exact-rebuild loop: measure a source clip, then compare a rebuild against it.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { probe } from "../worker/ffmpeg";
import { ToolError } from "../worker/retry";
import { contactSheet, extractFrames, readGrayFrames, readRgbPixels, stackSheets } from "./media";
import { compareMotion, motionEnergy, normalise, onsets, type MotionComparison } from "./motion";
import { quantizePalette, type PaletteColour } from "./palette";
import { motionSpecTemplate } from "./spec";

export const FRAME_INTERVAL = 0.25;
/** Motion is compared at 8 frames a second: finer than the 0.25 s frames, cheap to compute. */
export const COMPARE_FPS = 8;

const CLIP = /\.(mp4|webm|mov|m4v|gif)$/i;
const ORIGINALS = ["mp4", "webm", "mov", "m4v", "gif"];

/** A file path, or a card slug whose original clip is in the local mirror. */
export function resolveSource(arg: string, refsDir: string): { file: string; slug: string; outDir: string } {
  if (existsSync(arg) && CLIP.test(arg)) {
    const slug = basename(arg).replace(/\.[^.]+$/, "");
    return { file: arg, slug, outDir: join(refsDir, "..", "..", ".worker", "rebuild", slug) };
  }
  const cardDir = join(refsDir, arg);
  for (const ext of ORIGINALS) {
    const file = join(cardDir, `original.${ext}`);
    if (existsSync(file)) return { file, slug: arg, outDir: cardDir };
  }
  if (existsSync(cardDir)) {
    throw new ToolError(`${arg} has no original clip in the mirror (only a still image, or media is not captured yet). Run pnpm capture:pending, then pnpm sync.`);
  }
  throw new ToolError(`No card "${arg}" in design-library/refs and no clip at that path.`);
}

export type FramesResult = {
  slug: string;
  frames: number;
  framesDir: string;
  contactSheet: string;
  manifest: string;
  spec: string;
  specWritten: boolean;
  palette: PaletteColour[];
  onsets: number[];
};

/** Frames every 0.25 s, a contact sheet, a sampled palette, and a motion spec template to fill in. */
export async function measureClip(source: { file: string; slug: string; outDir: string }, { force = false } = {}): Promise<FramesResult> {
  const info = await probe(source.file);
  if (!info || info.duration <= 0) throw new ToolError(`${source.file} is not a moving clip.`);

  const framesDir = join(source.outDir, "frames");
  const frames = await extractFrames(source.file, framesDir, FRAME_INTERVAL);
  const sheet = join(framesDir, "contact-sheet.png");
  await contactSheet(framesDir, sheet);

  const palette = quantizePalette(await readRgbPixels(source.file));
  const energy = normalise(motionEnergy(await readGrayFrames(source.file, COMPARE_FPS)));
  const beats = onsets(energy, COMPARE_FPS);

  const manifest = join(framesDir, "manifest.json");
  writeFileSync(
    manifest,
    JSON.stringify({ source: basename(source.file), intervalSeconds: FRAME_INTERVAL, frames, width: info.width, height: info.height, durationSeconds: info.duration, palette, onsets: beats }, null, 2) + "\n",
  );

  // The spec is where the agent writes its findings, so a rerun never overwrites it.
  const spec = join(source.outDir, "motion-spec.md");
  const specWritten = force || !existsSync(spec);
  if (specWritten) {
    writeFileSync(
      spec,
      motionSpecTemplate({ slug: source.slug, source: basename(source.file), durationSeconds: info.duration, width: info.width, height: info.height, intervalSeconds: FRAME_INTERVAL, frameCount: frames, palette, onsets: beats }),
    );
  }
  return { slug: source.slug, frames, framesDir, contactSheet: sheet, manifest, spec, specWritten, palette, onsets: beats };
}

export type CompareResult = MotionComparison & { dir: string; sheet: string; report: string };

/** Compares a rendered rebuild against the source clip by timing and choreography, and saves a side-by-side sheet. */
export async function compareClips(source: { file: string; slug: string; outDir: string }, render: string): Promise<CompareResult> {
  if (!existsSync(render)) throw new ToolError(`No render at ${render}. Record one first: pnpm rebuild render <page.html> --out <render.mp4>`);
  const dir = join(source.outDir, "compare");
  mkdirSync(dir, { recursive: true });

  const [a, b] = await Promise.all([readGrayFrames(source.file, COMPARE_FPS), readGrayFrames(render, COMPARE_FPS)]);
  if (a.length < 3 || b.length < 3) throw new ToolError("A clip this short cannot be compared. Both need at least half a second of video.");
  const result = compareMotion(motionEnergy(a), motionEnergy(b), { fps: COMPARE_FPS });

  const sourceFrames = join(dir, "source-frames");
  const renderFrames = join(dir, "render-frames");
  await extractFrames(source.file, sourceFrames, FRAME_INTERVAL);
  await extractFrames(render, renderFrames, FRAME_INTERVAL);
  const top = join(dir, "source-sheet.png");
  const bottom = join(dir, "render-sheet.png");
  await contactSheet(sourceFrames, top);
  await contactSheet(renderFrames, bottom);
  const sheet = join(dir, "compare-sheet.png");
  await stackSheets(top, bottom, sheet);

  const report = join(dir, "compare.json");
  writeFileSync(report, JSON.stringify({ source: source.file, render, ...result }, null, 2) + "\n");
  return { ...result, dir, sheet, report };
}
