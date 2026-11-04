import { clamp01, easeInOutCubic, quadBezier } from "./motion";
import { NOTE_SIZE, type Point } from "./placement";

export const FLIGHT_S = 0.85; // one note's flight
export const STAGGER_S = 0.032; // delay between notes
export const LIFT_SCALE = 1.06;
const PAD_X = 24; // frame left to first note
const PAD_TOP = 76; // frame top to first row (room for the label)
const PAD_BOTTOM = 24;
const PITCH = 140; // distance between notes
const COLUMNS = 4;
const MAX_TILT = 1.5; // degrees
const MAX_CURVE = 120; // control point distance off the straight line

export type TidyNote = { id: string; group_id: string | null; x: number; y: number; rotation: number; created_at: string };
export type TidyFrame = { id: string; x: number; y: number; w: number; h: number };
export type Pose = Point & { rotation: number };
export type FlightPlan = { id: string; from: Pose; to: Pose; control: Point; delay: number };
export type TidyPlan = { flights: FlightPlan[]; frames: { id: string; h: number }[] };

/**
 * Plan the sort: every grouped note flies to a slot in rows of four inside its frame,
 * theme by theme, in list order, 32 ms apart. Frames that are too short get taller.
 */
export function planTidy(notes: TidyNote[], frames: TidyFrame[], rng: () => number): TidyPlan {
  const flights: FlightPlan[] = [];
  const grown: { id: string; h: number }[] = [];
  let order = 0;

  for (const frame of frames) {
    const members = notes.filter((n) => n.group_id === frame.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    if (members.length === 0) continue;

    const rows = Math.ceil(members.length / COLUMNS);
    const needed = PAD_TOP + (rows - 1) * PITCH + NOTE_SIZE + PAD_BOTTOM;
    if (needed > frame.h) grown.push({ id: frame.id, h: needed });

    members.forEach((n, i) => {
      const to: Pose = {
        x: frame.x + PAD_X + (i % COLUMNS) * PITCH,
        y: frame.y + PAD_TOP + Math.floor(i / COLUMNS) * PITCH,
        rotation: Math.round((rng() * 2 - 1) * MAX_TILT * 10) / 10,
      };
      const from: Pose = { x: n.x, y: n.y, rotation: n.rotation };

      // Control point: the midpoint pushed sideways by a seeded amount.
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const push = (rng() * 2 - 1) * MAX_CURVE;
      const control = { x: (from.x + to.x) / 2 + (-dy / len) * push, y: (from.y + to.y) / 2 + (dx / len) * push };

      flights.push({ id: n.id, from, to, control, delay: order++ * STAGGER_S });
    });
  }
  return { flights, frames: grown };
}

export type FlightState = Pose & { scale: number };

/** Where a note is `t` seconds after the tidy started: before its delay it stays, after landing it rests at its slot. */
export function flightAt(f: FlightPlan, t: number): FlightState {
  const u = clamp01((t - f.delay) / FLIGHT_S);
  if (u <= 0) return { ...f.from, scale: 1 };
  if (u >= 1) return { ...f.to, scale: 1 };
  const e = easeInOutCubic(u);
  const p = quadBezier(f.from, f.control, f.to, e);
  return {
    x: p.x,
    y: p.y,
    rotation: f.from.rotation + (f.to.rotation - f.from.rotation) * e,
    scale: 1 + (LIFT_SCALE - 1) * Math.sin(Math.PI * u),
  };
}

/** Seconds until the last note has landed. */
export function planDuration(plan: TidyPlan): number {
  return plan.flights.length ? plan.flights[plan.flights.length - 1].delay + FLIGHT_S : 0;
}
