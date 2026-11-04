import { describe, expect, it } from "vitest";
import { layoutFrames, validateClusters } from "./cluster-plan";

const known = new Set(["n1", "n2", "n3", "n4"]);

describe("validateClusters", () => {
  it("accepts named groups of known notes", () => {
    const r = validateClusters([{ name: "Setup", noteIds: ["n1", "n2"] }, { name: "Pricing", noteIds: ["n3"] }], known);
    expect(r).toEqual({ ok: true, value: [{ name: "Setup", noteIds: ["n1", "n2"] }, { name: "Pricing", noteIds: ["n3"] }] });
  });

  it("trims names", () => {
    const r = validateClusters([{ name: "  Setup ", noteIds: ["n1"] }], known);
    expect(r.ok && r.value[0].name).toBe("Setup");
  });

  it("rejects anything that is not an array of groups", () => {
    expect(validateClusters({ name: "x" }, known).ok).toBe(false);
    expect(validateClusters([], known).ok).toBe(false);
  });

  it("rejects an empty name, an empty group and unknown notes", () => {
    const r = validateClusters([{ name: "", noteIds: ["n1"] }, { name: "B", noteIds: [] }, { name: "C", noteIds: ["zzz"] }], known);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("#1") && e.includes("name"))).toBe(true);
      expect(r.errors.some((e) => e.includes("#2") && e.includes("no notes"))).toBe(true);
      expect(r.errors.some((e) => e.includes("#3") && e.includes("zzz"))).toBe(true);
    }
  });

  it("rejects a note placed in two groups and duplicate group names", () => {
    const r = validateClusters([{ name: "A", noteIds: ["n1"] }, { name: "a", noteIds: ["n1", "n2"] }], known);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("n1") && e.includes("more than one"))).toBe(true);
      expect(r.errors.some((e) => e.includes("duplicate"))).toBe(true);
    }
  });
});

describe("layoutFrames", () => {
  it("lays new frames in a 2-wide grid from the top left", () => {
    const f = layoutFrames([4, 4, 4], []) ?? [];
    expect(f.map((x) => [x.x, x.y])).toEqual([[40, 40], [676, 40], [40, 448]]);
    expect(f.every((x) => x.w === 596 && x.h === 368)).toBe(true);
  });

  it("makes a frame taller when it holds more than two rows of notes", () => {
    const [f] = layoutFrames([9], []) ?? []; // 3 rows: 76 + 2 * 140 + 128 + 24 = 508
    expect(f.h).toBe(508);
  });

  it("skips slots taken by existing frames", () => {
    const f = layoutFrames([3], [{ x: 40, y: 40, w: 596, h: 368 }]);
    expect([f?.[0].x, f?.[0].y]).toEqual([676, 40]);
  });

  it("returns null when the wall has no room", () => {
    expect(layoutFrames([1, 1, 1, 1, 1, 1, 1, 1], [])).toBeNull();
  });
});
