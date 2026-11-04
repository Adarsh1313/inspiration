import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaptureStep, Draft } from "@hub/capture";
import { beforeAll, describe, expect, it } from "vitest";
import { probe } from "./ffmpeg";
import { MemoryMediaStore } from "./media-store";
import { classify, HttpError, NoMediaError, ToolError, withRetry } from "./retry";
import { runPending } from "./run";
import { parseVtt, redditMediaFromInfo } from "./sources";
import type { Deps } from "./steps";
import { MemoryTaskStore } from "./tasks";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// Committed 8 s, 320x180 H.264 clip.
const fixture = fileURLToPath(new URL("../../fixtures/sample.mp4", import.meta.url));
let tmp: string;
let wideVideo: string;
let stillImage: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "hub-worker-test-"));
  if (!hasFfmpeg) return;
  wideVideo = join(tmp, "wide.mp4");
  stillImage = join(tmp, "still.jpg");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=duration=3:size=1280x720:rate=24", "-c:v", "libx264", "-pix_fmt", "yuv420p", wideVideo]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=800x600", "-frames:v", "1", stillImage]);
});

const baseDraft: Draft = {
  canonicalUrl: "https://x.com/a/status/1",
  canonicalKey: "x:1",
  sourceType: "x-post",
  title: "t",
  author: null,
  description: "",
  posterUrl: "https://img.example.com/poster.jpg",
  mediaUrl: "https://video.example.com/clip.mp4",
  suggestedShelf: "motion-interactions",
  kind: "animation",
  errors: [],
};

function setup(steps: CaptureStep[], over: Partial<Deps> = {}, videoPath?: string) {
  const tasks = new MemoryTaskStore();
  tasks.addCard({ id: "c1", slug: "loader", source_url: baseDraft.canonicalUrl }, steps);
  const media = new MemoryMediaStore();
  const sleeps: number[] = [];
  const deps: Deps = {
    tasks,
    media,
    workDir: join(tmp, `work-${Math.random().toString(36).slice(2)}`),
    draft: async () => baseDraft,
    download: async (url, dest) => {
      if (url.endsWith(".mp4")) {
        copyFileSync(videoPath ?? fixture, dest);
        return { contentType: "video/mp4" };
      }
      copyFileSync(stillImage, dest);
      return { contentType: "image/jpeg" };
    },
    screenshot: async () => {
      throw new Error("not used");
    },
    ytdlp: { video: async () => null, transcript: async () => null },
    sleep: async (ms) => void sleeps.push(ms),
    ...over,
  };
  return { tasks, media, deps, sleeps };
}

async function probeObject(media: MemoryMediaStore, path: string) {
  const f = join(tmp, path.replace(/\//g, "_"));
  writeFileSync(f, await media.get(path));
  return { info: await probe(f), bytes: readFileSync(f).byteLength };
}

describe.skipIf(!hasFfmpeg)("worker media steps (real ffmpeg)", () => {
  it("downloads, makes two poster sizes and an iPhone-safe hover clip, and marks the card ready", async () => {
    const { tasks, media, deps } = setup(["download", "poster", "preview"], {}, wideVideo);
    const summary = await runPending(deps);
    expect(summary).toMatchObject({ claimed: 3, done: 3, failed: 0, cards: 1 });

    const card = await tasks.getCard("c1");
    expect(card.original).toMatch(/^original\/[0-9a-f]{24}\.mp4$/);
    expect(card.poster_sm).not.toBe(card.poster_lg);
    expect((await probeObject(media, card.poster_sm!)).info?.width).toBe(480);
    expect((await probeObject(media, card.poster_lg!)).info?.width).toBe(960);

    const preview = await probeObject(media, card.preview!);
    expect(preview.info?.codec).toBe("h264");
    expect(preview.info!.duration).toBeLessThanOrEqual(6.1);
    expect(preview.bytes).toBeLessThanOrEqual(1_000_000);

    expect(tasks.cards.get("c1")).toMatchObject({ media_status: "ready", media_error: null });
    expect(tasks.tasks.every((t) => t.status === "done")).toBe(true);
  });

  it("trims an 8 s source to a clip of 6 s or less under 1 MB", async () => {
    const { tasks, media, deps } = setup(["download", "preview"]);
    await runPending(deps);
    const preview = await probeObject(media, (await tasks.getCard("c1")).preview!);
    expect(preview.info!.duration).toBeLessThanOrEqual(6.1);
    expect(preview.info!.duration).toBeGreaterThan(5);
    expect(preview.bytes).toBeLessThanOrEqual(1_000_000);
  });

  it("is idempotent: running the same steps again makes the same objects and no extras", async () => {
    const { tasks, media, deps } = setup(["download", "poster", "preview"]);
    await runPending(deps);
    const first = await tasks.getCard("c1");
    const count = media.objects.size;

    expect((await runPending(deps)).claimed).toBe(0); // nothing queued: exits immediately

    tasks.tasks.forEach((t) => Object.assign(t, { status: "queued", attempts: 0 }));
    await runPending(deps);
    const second = await tasks.getCard("c1");
    expect(second).toMatchObject({ original: first.original, poster_sm: first.poster_sm, poster_lg: first.poster_lg, preview: first.preview });
    expect(media.objects.size).toBe(count);
  });

  it("makes a poster from a page image when there is no clip, and skips the hover clip for stills", async () => {
    const { tasks, deps } = setup(["poster", "preview"], { draft: async () => ({ ...baseDraft, mediaUrl: null }) });
    expect(await runPending(deps)).toMatchObject({ done: 2, failed: 0 });
    const card = await tasks.getCard("c1");
    expect(card.poster_sm).toBeTruthy();
    expect(card.preview).toBeNull();
  });

  it("retries a flaky download, then succeeds", async () => {
    let n = 0;
    const { tasks, deps, sleeps } = setup(["download", "poster"], {
      download: async (url, dest) => {
        if (url.endsWith(".mp4") && ++n < 3) throw new HttpError(503);
        copyFileSync(url.endsWith(".mp4") ? fixture : stillImage, dest);
        return { contentType: url.endsWith(".mp4") ? "video/mp4" : "image/jpeg" };
      },
    });
    await runPending(deps);
    expect(n).toBe(3);
    expect(sleeps).toEqual([2000, 4000]);
    expect(tasks.tasks.find((t) => t.step === "download")).toMatchObject({ status: "done", attempts: 3 });
  });

  it("gives up after three tries, marks the card failed with the reason, and keeps the poster it could make", async () => {
    const { tasks, deps } = setup(["download", "poster"], {
      download: async (url, dest) => {
        if (url.endsWith(".mp4")) throw new HttpError(503);
        copyFileSync(stillImage, dest);
        return { contentType: "image/jpeg" };
      },
    });
    expect(await runPending(deps)).toMatchObject({ done: 1, failed: 1 });
    expect(tasks.tasks.find((t) => t.step === "download")).toMatchObject({ status: "failed", attempts: 3 });
    const card = tasks.cards.get("c1")!;
    expect(card.media_status).toBe("failed");
    expect(card.media_error).toContain("download: HTTP 503");
    expect(card.poster_sm).toBeTruthy();
  });

  it("does not retry a 404 and marks it failed on the first attempt", async () => {
    const { tasks, deps, sleeps } = setup(["download"], {
      download: async () => {
        throw new HttpError(404);
      },
    });
    await runPending(deps);
    expect(sleeps).toEqual([]);
    expect(tasks.tasks[0]).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("fails a poster step with a manual-image hint when no image exists anywhere", async () => {
    const { tasks, deps } = setup(["poster"], { draft: async () => ({ ...baseDraft, posterUrl: null, mediaUrl: null }) });
    await runPending(deps);
    expect(tasks.cards.get("c1")!.media_error).toMatch(/Paste a screenshot/);
  });

  it("lets yt-dlp rescue a clip the direct link refused", async () => {
    const { tasks, deps } = setup(["download", "poster"], {
      download: async (url, dest) => {
        if (url.endsWith(".mp4")) throw new HttpError(403);
        copyFileSync(stillImage, dest);
        return { contentType: "image/jpeg" };
      },
      ytdlp: {
        video: async (_url, dir) => {
          const f = join(dir, "ytdlp.mp4");
          copyFileSync(fixture, f);
          return f;
        },
        transcript: async () => null,
      },
    });
    await runPending(deps);
    expect(tasks.cards.get("c1")!.media_status).toBe("ready");
    expect(tasks.cards.get("c1")!.original).toMatch(/\.mp4$/);
  });

  it("reports a missing tool as a failure that is not retried", async () => {
    const { tasks, deps, sleeps } = setup(["download"], {
      download: async () => {
        throw new HttpError(403);
      },
      ytdlp: {
        video: async () => {
          throw new ToolError("yt-dlp is not installed or not on PATH.", true);
        },
        transcript: async () => null,
      },
    });
    await runPending(deps);
    expect(sleeps).toEqual([]);
    expect(tasks.tasks[0].status).toBe("failed");
  });

  it("keeps going when one card blows up, failing only that card's tasks", async () => {
    const { tasks, deps } = setup(["download"]);
    tasks.addCard({ id: "c2", slug: "second", source_url: baseDraft.canonicalUrl }, ["download"]);
    const getCard = tasks.getCard.bind(tasks);
    tasks.getCard = async (id) => {
      if (id === "c1") throw new Error("db blip");
      return getCard(id);
    };
    const summary = await runPending(deps);
    expect(summary).toMatchObject({ cards: 2, done: 1, failed: 1 });
    expect(tasks.tasks.find((t) => t.card_id === "c1")).toMatchObject({ status: "failed", last_error: "db blip" });
    expect(tasks.tasks.find((t) => t.card_id === "c2")?.status).toBe("done");
  });

  it("stores a YouTube transcript", async () => {
    const { tasks, deps } = setup(["transcript"], { ytdlp: { video: async () => null, transcript: async () => "hello world" } });
    await runPending(deps);
    expect(tasks.cards.get("c1")!.transcript).toBe("hello world");
  });
});

describe("retry classification (ported from Resurface)", () => {
  it.each([
    [500, "retry"],
    [503, "retry"],
    [408, "retry"],
    [429, "retry"],
    [401, "auth"],
    [403, "fail"],
    [404, "fail"],
    [422, "fail"],
  ])("HTTP %i is %s", (status, expected) => {
    expect(classify(new HttpError(status))).toBe(expected);
  });

  it("retries network errors and timeouts, never missing tools or empty media", () => {
    expect(classify(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("retry");
    expect(classify(new TypeError("fetch failed"))).toBe("retry");
    expect(classify(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("retry");
    expect(classify(new ToolError("missing", true))).toBe("fail");
    expect(classify(new NoMediaError())).toBe("fail");
    expect(classify(new Error("boom"))).toBe("fail");
  });

  it("withRetry stops at the first non-retryable error and counts attempts", async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        throw new HttpError(404);
      },
      { sleep: async () => {} },
    );
    expect(r).toMatchObject({ ok: false, attempts: 1, classification: "fail" });
    expect(n).toBe(1);
  });
});

describe("parsers", () => {
  it("turns auto-caption VTT into clean text without rolling duplicates", () => {
    const vtt = [
      "WEBVTT",
      "Kind: captions",
      "Language: en",
      "",
      "00:00:00.000 --> 00:00:02.000 align:start position:0%",
      "Stop creating<00:00:01.000><c> zombie</c> UIs",
      "",
      "00:00:02.000 --> 00:00:03.000",
      "Stop creating zombie UIs",
      "",
      "00:00:03.000 --> 00:00:05.000",
      "it&#39;s about taste &amp; craft",
    ].join("\n");
    expect(parseVtt(vtt)).toBe("Stop creating zombie UIs it's about taste & craft");
  });

  it("reads the Reddit video fallback and preview image from /api/info", () => {
    const info = {
      data: {
        children: [
          {
            data: {
              secure_media: { reddit_video: { fallback_url: "https://v.redd.it/abc/DASH_720.mp4?source=fallback" } },
              preview: { images: [{ source: { url: "https://preview.redd.it/x.jpg?a=1&amp;b=2" } }] },
            },
          },
        ],
      },
    };
    expect(redditMediaFromInfo(info)).toEqual({ mediaUrl: "https://v.redd.it/abc/DASH_720.mp4", posterUrl: "https://preview.redd.it/x.jpg?a=1&b=2" });
    expect(redditMediaFromInfo({ data: { children: [] } })).toBeNull();
  });
});
