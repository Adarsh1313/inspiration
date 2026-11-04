import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureStep, Draft } from "@hub/capture";
import { isVideo, makePoster, makePreview, POSTER_SIZES } from "./ffmpeg";
import type { MediaStore } from "./media-store";
import { classify, NoMediaError, ToolError } from "./retry";
import type { CardPatch, TaskStore, WorkerCard } from "./tasks";

/** Everything with side effects, injected so tests can run the steps for real without a network. */
export type Deps = {
  tasks: TaskStore;
  media: MediaStore;
  workDir: string;
  /** Re-reads the source link (the worker has no SSRF limits of its own to relax; it reuses the shared draft). */
  draft: (url: string) => Promise<Draft>;
  /** Saves a URL to a file. Throws HttpError for bad statuses. */
  download: (url: string, dest: string) => Promise<{ contentType: string }>;
  screenshot: (url: string, dest: string) => Promise<void>;
  /** Null result means "nothing there"; a thrown ToolError means the tool is missing or failed. */
  ytdlp: { video(url: string, dir: string): Promise<string | null>; transcript(url: string, dir: string): Promise<string | null> };
  redditMedia?: (url: string) => Promise<{ mediaUrl: string | null; posterUrl: string | null } | null>;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

export type StepContext = {
  card: WorkerCard;
  dir: string;
  deps: Deps;
  /** Local copy of the original once a step has fetched or made it. */
  original: string | null;
  draftOnce: () => Promise<Draft>;
};

export function makeContext(card: WorkerCard, deps: Deps): StepContext {
  const dir = join(deps.workDir, card.slug);
  mkdirSync(dir, { recursive: true });
  let pending: Promise<Draft> | undefined;
  return {
    card,
    dir,
    deps,
    original: null,
    draftOnce: () => (pending ??= deps.draft(card.source_url ?? "")),
  };
}

const MIME_BY_EXT: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", gif: "image/gif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

function extFor(contentType: string, url: string, fallback: string): string {
  const fromType = contentType.split(";")[0].trim().toLowerCase();
  const byType = Object.entries(MIME_BY_EXT).find(([, m]) => m === fromType)?.[0];
  if (byType) return byType === "jpeg" ? "jpg" : byType;
  const fromUrl = url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase();
  return fromUrl && MIME_BY_EXT[fromUrl] ? (fromUrl === "jpeg" ? "jpg" : fromUrl) : fallback;
}

async function uploadFile(ctx: StepContext, prefix: string, file: string, ext: string): Promise<string> {
  return ctx.deps.media.put(prefix, readFileSync(file), ext, MIME_BY_EXT[ext] ?? "application/octet-stream");
}

/** The original as a local file: made earlier in this run, or fetched back from Storage. */
async function localOriginal(ctx: StepContext): Promise<string | null> {
  if (ctx.original) return ctx.original;
  if (!ctx.card.original) return null;
  const ext = ctx.card.original.split(".").pop() ?? "bin";
  const file = join(ctx.dir, `original.${ext}`);
  writeFileSync(file, await ctx.deps.media.get(ctx.card.original));
  return (ctx.original = file);
}

async function patch(ctx: StepContext, p: CardPatch): Promise<void> {
  await ctx.deps.tasks.patchCard(ctx.card.id, p);
  Object.assign(ctx.card, p);
}

async function download(ctx: StepContext): Promise<void> {
  const { card, deps, dir } = ctx;
  const d = await ctx.draftOnce();
  let mediaUrl = d.mediaUrl;
  if (card.source_type === "reddit" && deps.redditMedia) mediaUrl = (await deps.redditMedia(card.source_url!))?.mediaUrl ?? mediaUrl;

  let file: string | null = null;
  let ext = "mp4";
  let failure: unknown = null;

  if (mediaUrl) {
    try {
      const dest = join(dir, "download");
      const { contentType } = await deps.download(mediaUrl, dest);
      ext = extFor(contentType, mediaUrl, "mp4");
      file = join(dir, `original.${ext}`);
      copyFileSync(dest, file);
    } catch (e) {
      if (classify(e) === "retry") throw e; // the retry loop handles flaky networks
      failure = e;
    }
  }
  // X and Reddit clips that the direct link could not give: let yt-dlp try (cookies only on its own failure).
  if (!file && (mediaUrl || card.source_type === "reddit") && card.source_url) {
    try {
      file = await deps.ytdlp.video(card.source_url, dir);
      if (file) ext = file.split(".").pop() ?? "mp4";
    } catch (e) {
      failure ??= e;
    }
  }
  if (!file) {
    if (failure) throw failure;
    deps.log?.(`${card.slug}: no downloadable media`);
    return;
  }
  ctx.original = file;
  await patch(ctx, { original: await uploadFile(ctx, "original", file, ext) });
}

async function screenshot(ctx: StepContext): Promise<void> {
  if (!ctx.card.source_url) throw new NoMediaError("This card has no link to screenshot.");
  const file = join(ctx.dir, "screenshot.png");
  await ctx.deps.screenshot(ctx.card.source_url, file);
  ctx.original = file;
  await patch(ctx, { original: await uploadFile(ctx, "original", file, "png") });
}

async function poster(ctx: StepContext): Promise<void> {
  let input = await localOriginal(ctx);
  if (!input) {
    const d = await ctx.draftOnce();
    if (!d.posterUrl) throw new NoMediaError("No preview image found. Paste a screenshot on the card instead.");
    const dest = join(ctx.dir, "poster-source");
    const { contentType } = await ctx.deps.download(d.posterUrl, dest);
    input = join(ctx.dir, `poster-source.${extFor(contentType, d.posterUrl, "jpg")}`);
    copyFileSync(dest, input);
  }
  const video = await isVideo(input);
  const out: Partial<Record<"sm" | "lg", string>> = {};
  for (const [size, width] of Object.entries(POSTER_SIZES) as ["sm" | "lg", number][]) {
    const file = join(ctx.dir, `poster-${size}.jpg`);
    await makePoster(input, file, width, video);
    out[size] = await uploadFile(ctx, "poster", file, "jpg");
  }
  await patch(ctx, { poster_sm: out.sm!, poster_lg: out.lg! });
}

async function preview(ctx: StepContext): Promise<void> {
  const input = await localOriginal(ctx);
  if (!input || !(await isVideo(input))) return; // images and screenshots have no hover clip
  const file = join(ctx.dir, "preview.mp4");
  await makePreview(input, file);
  await patch(ctx, { preview: await uploadFile(ctx, "preview", file, "mp4") });
}

async function transcript(ctx: StepContext): Promise<void> {
  if (!ctx.card.source_url) return;
  const text = await ctx.deps.ytdlp.transcript(ctx.card.source_url, ctx.dir);
  if (text) await patch(ctx, { transcript: text });
}

export const STEPS: Record<CaptureStep, (ctx: StepContext) => Promise<void>> = { download, screenshot, poster, preview, transcript };
