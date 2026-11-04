// ffmpeg and Playwright side of the exact-rebuild loop. The numbers are worked out in motion.ts and palette.ts.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run } from "../worker/ffmpeg";
import { ToolError } from "../worker/retry";

/** Runs a command and returns its raw stdout bytes (the shared run() decodes stdout as text, which breaks pixels). */
function runBinary(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    child.on("error", (e: NodeJS.ErrnoException) => reject(e.code === "ENOENT" ? new ToolError(`${cmd} is not installed or not on PATH.`, true) : e));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new ToolError(`${cmd} failed (exit ${code}): ${stderr.trim().split("\n").slice(-3).join(" ")}`));
    });
  });
}

const FRAME_FILE = /^f\d{4}\.png$/;

export function listFrames(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => FRAME_FILE.test(f)).sort() : [];
}

/** One PNG every `intervalSeconds` (default 0.25): f0001.png is t=0, f0002.png is t=0.25 and so on. Old frames are cleared first. */
export async function extractFrames(input: string, outDir: string, intervalSeconds = 0.25, maxWidth = 640): Promise<number> {
  mkdirSync(outDir, { recursive: true });
  for (const f of listFrames(outDir)) rmSync(join(outDir, f));
  await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-vf", `fps=${1 / intervalSeconds},scale='min(${maxWidth},iw)':-2`, join(outDir, "f%04d.png")]);
  const count = listFrames(outDir).length;
  if (count === 0) throw new ToolError("No frames could be read from that file.");
  return count;
}

/** One image of all the frames, row by row (`cols` per row), at most `maxFrames` of them. */
export async function contactSheet(framesDir: string, output: string, { cols = 6, thumbWidth = 240, maxFrames = 48 } = {}): Promise<{ cols: number; rows: number; step: number }> {
  const total = listFrames(framesDir).length;
  const step = Math.max(1, Math.ceil(total / maxFrames));
  const used = Math.ceil(total / step);
  const rows = Math.max(1, Math.ceil(used / cols));
  await run("ffmpeg", [
    "-y", "-v", "error", "-framerate", "1", "-i", join(framesDir, "f%04d.png"),
    "-vf", `select=not(mod(n\\,${step})),scale=${thumbWidth}:-2,tile=${cols}x${rows}:padding=2:color=gray`,
    "-frames:v", "1", output,
  ]);
  return { cols, rows, step };
}

/** Two sheets stacked, source on top, so one image shows both. */
export async function stackSheets(top: string, bottom: string, output: string, width = 1280): Promise<void> {
  await run("ffmpeg", ["-y", "-v", "error", "-i", top, "-i", bottom, "-filter_complex", `[0]scale=${width}:-2[a];[1]scale=${width}:-2[b];[a][b]vstack`, "-frames:v", "1", output]);
}

export const GRAY_W = 64;
export const GRAY_H = 36;

/** Tiny grayscale frames at `fps`, for measuring motion. */
export async function readGrayFrames(input: string, fps: number): Promise<Uint8Array[]> {
  const raw = await runBinary("ffmpeg", ["-v", "error", "-i", input, "-vf", `fps=${fps},scale=${GRAY_W}:${GRAY_H}:flags=area,format=gray`, "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  const size = GRAY_W * GRAY_H;
  const frames: Uint8Array[] = [];
  for (let at = 0; at + size <= raw.length; at += size) frames.push(new Uint8Array(raw.subarray(at, at + size)));
  return frames;
}

/** All pixels of a few tiny frames, for the palette. */
export async function readRgbPixels(input: string, fps = 2, width = 48, height = 27): Promise<Uint8Array> {
  const raw = await runBinary("ffmpeg", ["-v", "error", "-i", input, "-vf", `fps=${fps},scale=${width}:${height}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return new Uint8Array(raw);
}

export type RenderOptions = { seconds: number; width: number; height: number; output: string; trimSeconds?: number };

/** Records a page (a URL, or a local .html file) in a headless browser and saves it as an H.264 mp4. */
export async function renderPage(target: string, { seconds, width, height, output, trimSeconds = 0 }: RenderOptions): Promise<void> {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new ToolError("Playwright is not installed. Run: pnpm --filter tools exec playwright install chromium", true);
  }
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");

  const url = /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : pathToFileURL(resolve(target)).href;
  const dir = mkdtempSync(join(tmpdir(), "hub-render-"));
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir, size: { width, height } } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(seconds * 1000);
    const video = page.video();
    await context.close(); // the video file is only complete once the context closes
    const recorded = await video?.path();
    if (!recorded) throw new ToolError("The browser did not record a video.");
    mkdirSync(join(output, ".."), { recursive: true });
    await run("ffmpeg", ["-y", "-v", "error", ...(trimSeconds > 0 ? ["-ss", String(trimSeconds)] : []), "-i", recorded, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
