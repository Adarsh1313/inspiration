import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { ToolError } from "./retry";

export function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = opts.timeoutMs ? setTimeout(() => child.kill(), opts.timeoutMs) : undefined;
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    child.on("error", (e: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      reject(e.code === "ENOENT" ? new ToolError(`${cmd} is not installed or not on PATH.`, true) : e);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new ToolError(`${cmd} failed (exit ${code}): ${stderr.trim().split("\n").slice(-3).join(" ")}`));
    });
  });
}

export const POSTER_SIZES = { sm: 480, lg: 960 } as const;
const PREVIEW_MAX_BYTES = 1_000_000;
const PREVIEW_MAX_SECONDS = 6;

/** Still frame at the given width, as JPEG. Videos use a representative frame from the first seconds. */
export async function makePoster(input: string, output: string, width: number, isVideo: boolean): Promise<void> {
  const filter = isVideo ? `thumbnail=60,scale='min(${width},iw)':-2` : `scale='min(${width},iw)':-2`;
  const args = (seek: string[]) => ["-y", "-v", "error", ...seek, "-i", input, "-vf", filter, "-frames:v", "1", "-q:v", "4", output];
  if (!isVideo) return void (await run("ffmpeg", args([])));

  // Clips shorter than the 1 s seek point produce no frame; fall back to the start.
  await run("ffmpeg", args(["-ss", "1"])).catch(() => {});
  if (statSafe(output) === 0) await run("ffmpeg", args([]));
}

function statSafe(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/** Muted, looping-friendly H.264 clip: at most 6 s and 1 MB, playable on iPhone. */
export async function makePreview(input: string, output: string): Promise<{ bytes: number; crf: number; width: number }> {
  const attempts = [
    { crf: 28, width: 720 },
    { crf: 32, width: 640 },
    { crf: 35, width: 540 },
    { crf: 38, width: 420 },
    { crf: 42, width: 360 },
  ];
  for (const { crf, width } of attempts) {
    await run("ffmpeg", [
      "-y", "-v", "error", "-t", String(PREVIEW_MAX_SECONDS), "-i", input, "-an",
      "-vf", `fps=24,scale='min(${width},iw)':-2`,
      "-c:v", "libx264", "-crf", String(crf), "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
    ]);
    const bytes = statSafe(output);
    if (bytes > 0 && bytes <= PREVIEW_MAX_BYTES) return { bytes, crf, width };
  }
  throw new ToolError("Could not get the hover clip under 1 MB.");
}

export type VideoInfo = { codec: string; width: number; height: number; duration: number };

export async function probe(file: string): Promise<VideoInfo | null> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,duration:format=duration", "-of", "json", file]);
    const j = JSON.parse(stdout) as { streams?: { codec_name?: string; width?: number; height?: number; duration?: string }[]; format?: { duration?: string } };
    const s = j.streams?.[0];
    if (!s) return null;
    return { codec: s.codec_name ?? "", width: s.width ?? 0, height: s.height ?? 0, duration: Number(s.duration ?? j.format?.duration ?? 0) };
  } catch {
    return null;
  }
}

/** True when the file has a moving-image stream with more than one frame worth of time (gifs and mp4s). */
export async function isVideo(file: string): Promise<boolean> {
  if (/\.(png|jpe?g|webp|avif|bmp)$/i.test(file)) return false;
  const info = await probe(file);
  return !!info && info.duration > 0;
}
