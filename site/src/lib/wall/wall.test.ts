import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";
import { nextColour, WALL_COLOURS } from "./colour";
import { clampToWall, freeSpot, NOTE_SIZE, snapIntoGroup, type Box } from "./placement";

describe("nextColour", () => {
  it("never repeats either of the last two colours", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const recent = ["yellow", "pink"];
      expect(recent).not.toContain(nextColour(recent, {}, rng));
    }
  });

  it("favours the least-used colour", () => {
    const rng = mulberry32(7);
    const counts = { yellow: 9, pink: 9, green: 9, blue: 9, apricot: 0 };
    const picks = Array.from({ length: 300 }, () => nextColour([], counts, rng));
    const apricot = picks.filter((c) => c === "apricot").length;
    expect(apricot).toBeGreaterThan(150);
  });

  it("still varies when counts are equal", () => {
    const rng = mulberry32(3);
    const seen = new Set(Array.from({ length: 100 }, () => nextColour([], {}, rng)));
    expect(seen.size).toBeGreaterThan(3);
  });

  it("only returns known wall colours", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 50; i++) expect(WALL_COLOURS).toContain(nextColour(["blue"], {}, rng));
  });
});

const wall = { width: 1200, height: 800 };
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < NOTE_SIZE && Math.abs(a.y - b.y) < NOTE_SIZE;

describe("freeSpot", () => {
  it("returns a spot on the wall that overlaps no existing note", () => {
    const notes: Box[] = [
      { x: 600, y: 400 },
      { x: 740, y: 400 },
      { x: 460, y: 400 },
    ];
    const spot = freeSpot(notes, wall, mulberry32(2));
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeGreaterThanOrEqual(0);
    expect(spot.x).toBeLessThanOrEqual(wall.width - NOTE_SIZE);
    expect(spot.y).toBeLessThanOrEqual(wall.height - NOTE_SIZE);
    for (const n of notes) expect(overlaps(spot, n)).toBe(false);
  });

  it("still returns an on-wall spot when the wall is full", () => {
    const full: Box[] = [];
    for (let x = 0; x <= wall.width - NOTE_SIZE; x += NOTE_SIZE / 2)
      for (let y = 0; y <= wall.height - NOTE_SIZE; y += NOTE_SIZE / 2) full.push({ x, y });
    const spot = freeSpot(full, wall, mulberry32(4));
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.x).toBeLessThanOrEqual(wall.width - NOTE_SIZE);
  });
});

describe("clampToWall", () => {
  it("keeps a note fully on the wall", () => {
    expect(clampToWall({ x: -50, y: 5000 }, wall)).toEqual({ x: 0, y: wall.height - NOTE_SIZE });
    expect(clampToWall({ x: 100, y: 100 }, wall)).toEqual({ x: 100, y: 100 });
  });
});

describe("snapIntoGroup", () => {
  const groups = [
    { id: "a", x: 100, y: 100, w: 600, h: 400 },
    { id: "b", x: 800, y: 100, w: 300, h: 300 },
  ];

  it("returns the group whose frame contains the note centre", () => {
    expect(snapIntoGroup({ x: 200, y: 200 }, groups)).toBe("a");
    expect(snapIntoGroup({ x: 850, y: 150 }, groups)).toBe("b");
  });

  it("returns null when the centre is outside every frame", () => {
    expect(snapIntoGroup({ x: 20, y: 20 }, groups)).toBeNull();
    expect(snapIntoGroup({ x: 720, y: 450 }, groups)).toBeNull();
  });
});
