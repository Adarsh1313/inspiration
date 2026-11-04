// Production wiring for the worker: real network, yt-dlp, Playwright and Reddit.
import { createWriteStream, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { lookup } from "node:dns/promises";
import { assertPublicUrl, draft, isBlockedIp } from "@hub/capture";
import { run } from "./ffmpeg";
import type { MediaStore } from "./media-store";
import { HttpError, ToolError } from "./retry";
import { parseVtt, redditMediaFromInfo } from "./sources";
import type { Deps } from "./steps";
import type { TaskStore } from "./tasks";

const UA = "Mozilla/5.0 (compatible; HubWorker/0.1; personal use)";
const MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024;

async function download(url: string, dest: string): Promise<{ contentType: string }> {
  const signal = AbortSignal.timeout(120_000);
  let res: Response | undefined;
  let current = url;
  // Follow redirects by hand so every hop is checked, not just the first URL.
  for (let hop = 0; hop <= 5; hop++) {
    const safe = assertPublicUrl(current);
    const ips = (await lookup(safe.hostname.replace(/^[|]$/g, ""), { all: true })).map((a) => a.address);
    if (ips.length === 0 || ips.some(isBlockedIp)) throw new ToolError("That address is not public.");
    res = await fetch(safe, { headers: { "user-agent": UA }, signal, redirect: "manual" });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      current = new URL(next, safe).href;
      continue;
    }
    break;
  }
  if (!res || (res.status >= 300 && res.status < 400)) throw new ToolError("Too many redirects.");
  if (!res.ok || !res.body) throw new HttpError(res.status);
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_DOWNLOAD_BYTES) throw new ToolError("That file is over 300 MB.");
  let total = 0;
  const capped = Readable.fromWeb(res.body as never).on("data", (c: Buffer) => {
    total += c.length;
    if (total > MAX_DOWNLOAD_BYTES) capped.destroy(new ToolError("That file is over 300 MB."));
  });
  await pipeline(capped, createWriteStream(dest));
  return { contentType: res.headers.get("content-type") ?? "" };
}

function newestFile(dir: string, prefix: string): string | null {
  const names = readdirSync(dir).filter((n) => n.startsWith(prefix) && !n.endsWith(".part"));
  return names.length ? join(dir, names[0]) : null;
}

async function ytdlp(args: string[]): Promise<void> {
  await run("yt-dlp", ["--no-playlist", "--no-warnings", ...args], { timeoutMs: 10 * 60_000 });
}

const ytdlpDeps: Deps["ytdlp"] = {
  async video(url, dir) {
    const out = join(dir, "ytdlp.%(ext)s");
    const base = ["-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4", "-o", out];
    try {
      await ytdlp([...base, url]);
    } catch (e) {
      if (e instanceof ToolError && e.missing) throw e;
      await ytdlp([...base, "--cookies-from-browser", "chrome", url]); // only after a plain attempt failed
    }
    return newestFile(dir, "ytdlp.");
  },
  async transcript(url, dir) {
    await ytdlp(["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,en", "--sub-format", "vtt", "-o", join(dir, "subs.%(ext)s"), url]);
    const file = newestFile(dir, "subs.");
    return file ? parseVtt(readFileSync(file, "utf8")) || null : null;
  },
};

export async function updateYtdlp(log: (m: string) => void): Promise<void> {
  try {
    await run("yt-dlp", ["-U"], { timeoutMs: 120_000 });
  } catch (e) {
    log(`yt-dlp update skipped: ${e instanceof Error ? e.message : e}`);
  }
}

/** Screenshots with a persistent browser profile, so logins you did once in it are remembered. */
function screenshotter(profileDir: string): Deps["screenshot"] {
  return async (url, dest) => {
    assertPublicUrl(url);
    let chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      throw new ToolError("Playwright is not installed. Run: pnpm --filter tools exec playwright install chromium", true);
    }
    mkdirSync(profileDir, { recursive: true });
    const context = await chromium.launchPersistentContext(profileDir, { headless: true, viewport: { width: 1440, height: 900 } });
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.screenshot({ path: dest, type: "png" });
    } finally {
      await context.close();
    }
  };
}

/** Reddit script app (OAuth password grant). Unauthenticated .json has been blocked since May 2026. */
function redditClient(env: NodeJS.ProcessEnv): Deps["redditMedia"] | undefined {
  const { HUB_REDDIT_CLIENT_ID: id, HUB_REDDIT_CLIENT_SECRET: secret, HUB_REDDIT_USERNAME: user, HUB_REDDIT_PASSWORD: pass } = env;
  if (!id || !secret || !user || !pass) return undefined;
  const agent = `hub-worker/0.1 by ${user}`;
  let token: Promise<string> | undefined;
  const getToken = () =>
    (token ??= (async () => {
      const res = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded", "user-agent": agent },
        body: new URLSearchParams({ grant_type: "password", username: user, password: pass }),
      });
      if (!res.ok) throw new HttpError(res.status === 403 ? 401 : res.status, "Reddit login failed");
      return ((await res.json()) as { access_token: string }).access_token;
    })());

  return async (sourceUrl) => {
    const post = sourceUrl.match(/comments\/([a-z0-9]+)/i)?.[1] ?? sourceUrl.match(/redd\.it\/([a-z0-9]+)/i)?.[1];
    if (!post) return null;
    const res = await fetch(`https://oauth.reddit.com/api/info?id=t3_${post}&raw_json=1`, { headers: { authorization: `Bearer ${await getToken()}`, "user-agent": agent } });
    if (!res.ok) throw new HttpError(res.status);
    return redditMediaFromInfo(await res.json());
  };
}

export function productionDeps(opts: { tasks: TaskStore; media: MediaStore; workDir: string; log: (m: string) => void; env?: NodeJS.ProcessEnv }): Deps {
  const env = opts.env ?? process.env;
  mkdirSync(opts.workDir, { recursive: true });
  const profile = join(opts.workDir, "..", "profile");
  return {
    tasks: opts.tasks,
    media: opts.media,
    workDir: opts.workDir,
    draft: (url) => draft(url, { fetch, timeoutMs: 15_000 }),
    download,
    screenshot: screenshotter(profile),
    ytdlp: ytdlpDeps,
    redditMedia: redditClient(env),
    log: opts.log,
  };
}
