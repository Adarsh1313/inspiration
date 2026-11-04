import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { listFrames } from "./media";
import { compareClips, measureClip, resolveSource } from "./run";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

let tmp: string;

/** A 4 s clip that flashes a full-frame box twice, in the given colour, starting at the given times. */
function makeClip(name: string, colour: string, flashes: number[], seconds = 4): string {
  const file = join(tmp, name);
  const boxes = flashes.map((t) => `drawbox=x=0:y=0:w=iw:h=ih:color=${colour}@1:t=fill:enable='between(t,${t},${t + 0.5})'`).join(",");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=black:s=320x180:r=24:d=${seconds}`, "-vf", boxes, "-c:v", "libx264", "-pix_fmt", "yuv420p", file]);
  return file;
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "hub-rebuild-test-"));
});

describe.skipIf(!hasFfmpeg)("exact rebuild loop (real ffmpeg)", () => {
  it("measures a clip: frames every 0.25 s, contact sheet, palette, beats and a motion spec", async () => {
    const clip = makeClip("source.mp4", "white", [1, 3]);
    const outDir = join(tmp, "refs", "flashy");
    const r = await measureClip({ file: clip, slug: "flashy", outDir });

    expect(r.frames).toBe(16); // 4 s at 4 per second
    expect(listFrames(r.framesDir)).toHaveLength(16);
    expect(existsSync(r.contactSheet)).toBe(true);
    expect(r.palette.map((c) => c.hex)).toContain("#000000");
    // Each flash is two beats: it comes on and it goes off.
    expect(r.onsets).toEqual([1, 1.5, 3, 3.5]);
    expect(JSON.parse(readFileSync(r.manifest, "utf8"))).toMatchObject({ frames: 16, intervalSeconds: 0.25, width: 320, height: 180 });
    expect(readFileSync(r.spec, "utf8")).toContain("# Motion spec: flashy");
  });

  it("never overwrites a motion spec that has been filled in, unless forced", async () => {
    const clip = makeClip("source2.mp4", "white", [1, 3]);
    const source = { file: clip, slug: "keep", outDir: join(tmp, "refs", "keep") };
    const first = await measureClip(source);
    writeFileSync(first.spec, "my findings");
    const again = await measureClip(source);
    expect(again.specWritten).toBe(false);
    expect(readFileSync(first.spec, "utf8")).toBe("my findings");
    expect((await measureClip(source, { force: true })).specWritten).toBe(true);
  });

  it("matches a rebuild with the same timing in different colours", async () => {
    const source = { file: makeClip("a.mp4", "white", [1, 3]), slug: "cmp", outDir: join(tmp, "refs", "cmp") };
    const rebuild = makeClip("a-red.mp4", "red", [1, 3]);
    const r = await compareClips(source, rebuild);
    expect(r.verdict).toBe("match");
    expect(existsSync(r.sheet)).toBe(true);
    expect(JSON.parse(readFileSync(r.report, "utf8")).verdict).toBe("match");
  });

  it("catches a rebuild that is half a second late and says so", async () => {
    const source = { file: makeClip("b.mp4", "white", [1, 3]), slug: "late", outDir: join(tmp, "refs", "late") };
    const late = makeClip("b-late.mp4", "white", [1.5, 3.5]);
    const r = await compareClips(source, late);
    expect(r.verdict).not.toBe("match");
    expect(r.lagSeconds).toBeCloseTo(0.5, 1);
    expect(r.notes.join(" ")).toContain("late");
  });

  it("catches a rebuild with a missing beat", async () => {
    const source = { file: makeClip("c.mp4", "white", [1, 3]), slug: "missing", outDir: join(tmp, "refs", "missing") };
    const r = await compareClips(source, makeClip("c-one.mp4", "white", [1]));
    expect(r.verdict).not.toBe("match");
    expect(r.notes.join(" ")).toContain("4 beats, the rebuild has 2");
  });
});

describe("resolveSource", () => {
  it("finds a card's original clip, and explains when a card only has a still image", () => {
    const refs = mkdtempSync(join(tmpdir(), "hub-refs-"));
    mkdirSync(join(refs, "has-clip"), { recursive: true });
    writeFileSync(join(refs, "has-clip", "original.mp4"), "x");
    mkdirSync(join(refs, "still-only"), { recursive: true });
    writeFileSync(join(refs, "still-only", "original.png"), "x");
    expect(resolveSource("has-clip", refs)).toMatchObject({ slug: "has-clip", file: join(refs, "has-clip", "original.mp4"), outDir: join(refs, "has-clip") });
    expect(() => resolveSource("still-only", refs)).toThrow(/no original clip/);
    expect(() => resolveSource("nope", refs)).toThrow(/No card/);
  });
});
