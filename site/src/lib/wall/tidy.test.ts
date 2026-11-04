import { describe, expect, it } from "vitest";
import { easeInOutCubic, easeOutBack, quadBezier } from "./motion";
import { mulberry32 } from "./rng";
import { flightAt, planTidy, STAGGER_S, FLIGHT_S, type TidyFrame, type TidyNote } from "./tidy";

const note = (id: string, group: string | null, i: number, over: Partial<TidyNote> = {}): TidyNote => ({
  id,
  group_id: group,
  x: 300 + i * 7,
  y: 700 - i * 11,
  rotation: i % 2 ? 3 : -3,
  created_at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
  ...over,
});

const frames: TidyFrame[] = [
  { id: "A", x: 150, y: 130, w: 596, h: 368 },
  { id: "B", x: 1174, y: 130, w: 596, h: 368 },
];

describe("motion curves", () => {
  it("easings start at 0 and end at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeOutBack(0, 1.4)).toBeCloseTo(0);
    expect(easeOutBack(1, 1.4)).toBeCloseTo(1);
  });

  it("easeOutBack overshoots before settling", () => {
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49, 1.4)))).toBeGreaterThan(1);
  });

  it("quadBezier hits both ends and bends toward the control point", () => {
    const a = { x: 0, y: 0 }, c = { x: 50, y: 100 }, b = { x: 100, y: 0 };
    expect(quadBezier(a, c, b, 0)).toEqual(a);
    expect(quadBezier(a, c, b, 1)).toEqual(b);
    expect(quadBezier(a, c, b, 0.5)).toEqual({ x: 50, y: 50 });
  });
});

describe("planTidy", () => {
  const notes = [
    ...Array.from({ length: 6 }, (_, i) => note(`a${i}`, "A", i)),
    ...Array.from({ length: 2 }, (_, i) => note(`b${i}`, "B", i + 10)),
    note("loose", null, 20),
  ];
  const plan = planTidy(notes, frames, mulberry32(1));
  const byId = Object.fromEntries(plan.flights.map((f) => [f.id, f]));

  it("only moves grouped notes", () => {
    expect(plan.flights.map((f) => f.id).sort()).toEqual(["a0", "a1", "a2", "a3", "a4", "a5", "b0", "b1"]);
  });

  it("lays notes in rows of four inside the frame, in list order", () => {
    // frame left + 24, top + 76, 140 px apart
    expect(byId.a0.to).toMatchObject({ x: 174, y: 206 });
    expect(byId.a1.to).toMatchObject({ x: 314, y: 206 });
    expect(byId.a3.to).toMatchObject({ x: 594, y: 206 });
    expect(byId.a4.to).toMatchObject({ x: 174, y: 346 });
    expect(byId.b0.to).toMatchObject({ x: 1198, y: 206 });
  });

  it("flies theme by theme with a 32 ms stagger", () => {
    expect(STAGGER_S).toBeCloseTo(0.032);
    expect(byId.a0.delay).toBeCloseTo(0);
    expect(byId.a1.delay).toBeCloseTo(0.032);
    expect(byId.b0.delay).toBeCloseTo(6 * 0.032); // after all six of A
    expect(byId.b1.delay).toBeCloseTo(7 * 0.032);
  });

  it("settles each note at a small tilt", () => {
    for (const f of plan.flights) expect(Math.abs(f.to.rotation)).toBeLessThanOrEqual(1.5);
  });

  it("starts each flight where the note is now", () => {
    expect(byId.a2.from).toMatchObject({ x: notes[2].x, y: notes[2].y, rotation: notes[2].rotation });
  });

  it("keeps each flight's curve within 120 px of the straight line", () => {
    for (const f of plan.flights) {
      const mid = { x: (f.from.x + f.to.x) / 2, y: (f.from.y + f.to.y) / 2 };
      expect(Math.hypot(f.control.x - mid.x, f.control.y - mid.y)).toBeLessThanOrEqual(120.001);
    }
  });

  it("is deterministic for a fixed seed", () => {
    expect(planTidy(notes, frames, mulberry32(1))).toEqual(plan);
  });

  it("grows a frame that is too short for its rows", () => {
    const many = Array.from({ length: 13 }, (_, i) => note(`m${i}`, "A", i));
    const p = planTidy(many, [{ id: "A", x: 0, y: 0, w: 596, h: 368 }], mulberry32(2));
    // 4 rows: 76 + 3 * 140 + 128 + 24 = 648
    expect(p.frames).toEqual([{ id: "A", h: 648 }]);
  });

  it("leaves a frame alone when it already fits", () => {
    expect(plan.frames).toEqual([]);
  });
});

describe("flightAt", () => {
  const f = planTidy([note("n", "A", 0)], frames, mulberry32(3)).flights[0];

  it("sits at the start before it begins and at the end after it lands", () => {
    expect(flightAt(f, -1)).toMatchObject({ x: f.from.x, y: f.from.y, rotation: f.from.rotation, scale: 1 });
    expect(flightAt(f, f.delay + FLIGHT_S + 1)).toMatchObject({ x: f.to.x, y: f.to.y, rotation: f.to.rotation, scale: 1 });
  });

  it("lifts mid-flight", () => {
    expect(flightAt(f, f.delay + FLIGHT_S / 2).scale).toBeCloseTo(1.06, 2);
  });
});
