import { describe, expect, it } from "vitest";
import { compareMotion, correlationAtLag, motionEnergy, normalise, onsets } from "./motion";
import { quantizePalette } from "./palette";
import { motionSpecTemplate } from "./spec";

const gray = (value: number, size = 16) => new Uint8Array(size).fill(value);

/** A series with one bump (a beat) of `width` frames starting at `at`. */
const bump = (length: number, at: number, width: number, height = 1) => Array.from({ length }, (_, i) => (i >= at && i < at + width ? height : 0.02));

describe("motionEnergy", () => {
  it("is the mean change between consecutive frames, and has one fewer entry than frames", () => {
    const e = motionEnergy([gray(0), gray(0), gray(255), gray(255), gray(51)]);
    expect(e).toHaveLength(4);
    expect(e[0]).toBe(0);
    expect(e[1]).toBe(1);
    expect(e[2]).toBe(0);
    expect(e[3]).toBeCloseTo(0.8, 5);
  });
  it("returns nothing for a single frame", () => {
    expect(motionEnergy([gray(10)])).toEqual([]);
  });
});

describe("normalise / onsets", () => {
  it("scales to a peak of 1 and leaves a flat series at 0", () => {
    expect(normalise([0, 2, 4])).toEqual([0, 0.5, 1]);
    expect(normalise([0, 0, 0])).toEqual([0, 0, 0]);
  });
  it("finds the start of each beat", () => {
    const series = [...bump(8, 2, 2), ...bump(8, 3, 2)];
    expect(onsets(normalise(series), 4)).toEqual([0.75, 3]);
  });
});

describe("correlationAtLag", () => {
  it("peaks when the shift undoes the delay", () => {
    const a = bump(20, 5, 3);
    const b = bump(20, 8, 3);
    expect(correlationAtLag(a, b, 3)).toBeGreaterThan(0.99);
    expect(correlationAtLag(a, b, 0)).toBeLessThan(0.3);
  });
});

describe("compareMotion", () => {
  const fps = 8;
  const source = [...bump(16, 3, 4), ...bump(16, 3, 4, 0.6)];

  it("matches a rebuild with the same motion in different colours (different scale, same shape)", () => {
    const rebuild = source.map((v) => v * 0.4);
    const r = compareMotion(source, rebuild, { fps });
    expect(r.verdict).toBe("match");
    expect(r.lagSeconds).toBe(0);
    expect(r.notes).toEqual([]);
  });

  it("flags a late rebuild and says by how much", () => {
    const late = [0, 0, 0, 0, ...source];
    const r = compareMotion(source, late, { fps });
    expect(r.lagSeconds).toBeCloseTo(0.5, 2);
    expect(r.verdict).not.toBe("match");
    expect(r.notes.join(" ")).toContain("late");
  });

  it("flags a rebuild that is missing a beat", () => {
    const missing = [...bump(16, 3, 4), ...Array(16).fill(0.02)];
    const r = compareMotion(source, missing, { fps });
    expect(r.verdict).not.toBe("match");
    expect(r.notes.join(" ")).toContain("2 beats");
  });

  it("flags a different length", () => {
    const longer = [...source, ...Array(16).fill(0.02)];
    const r = compareMotion(source, longer, { fps });
    expect(r.verdict).not.toBe("match");
    expect(r.notes.join(" ")).toContain("longer");
  });

  it("says off for unrelated motion", () => {
    const other = Array.from({ length: 32 }, (_, i) => (i % 2 ? 1 : 0.1));
    expect(compareMotion(source, other, { fps }).verdict).toBe("off");
  });

  it("treats two static clips as a match and static against moving as off", () => {
    const flat = Array(20).fill(0);
    expect(compareMotion(flat, flat, { fps }).verdict).toBe("match");
    expect(compareMotion(flat, source.slice(0, 20), { fps }).verdict).toBe("off");
  });
});

describe("quantizePalette", () => {
  const px = (colours: [number, number, number, number][]) =>
    Uint8Array.from(colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b]).flat()));

  it("returns the dominant colours with their share, biggest first", () => {
    const palette = quantizePalette(px([[255, 255, 255, 60], [0, 0, 0, 30], [255, 0, 0, 10]]), 3);
    expect(palette.map((c) => c.hex)).toEqual(["#ffffff", "#000000", "#ff0000"]);
    expect(palette.map((c) => c.share)).toEqual([0.6, 0.3, 0.1]);
  });
  it("merges near-identical shades into one colour", () => {
    const palette = quantizePalette(px([[250, 250, 250, 50], [255, 255, 255, 50]]), 4);
    expect(palette).toHaveLength(1);
    expect(palette[0].share).toBe(1);
  });
  it("handles no pixels", () => {
    expect(quantizePalette(new Uint8Array())).toEqual([]);
  });
});

describe("motionSpecTemplate", () => {
  it("fills in what was measured and leaves the judgement calls as TODO", () => {
    const md = motionSpecTemplate({
      slug: "pre-loader",
      source: "original.mp4",
      durationSeconds: 4,
      width: 1280,
      height: 720,
      intervalSeconds: 0.25,
      frameCount: 16,
      palette: [{ hex: "#101010", share: 0.7 }],
      onsets: [0.5, 2.25],
    });
    expect(md).toContain("# Motion spec: pre-loader");
    expect(md).toContain("| 1 | 0.50 |");
    expect(md).toContain("| 2 | 2.25 |");
    expect(md).toContain("`#101010` 70.0%");
    expect(md).toContain("TODO");
    expect(md).toContain("pnpm rebuild compare pre-loader");
  });
});
