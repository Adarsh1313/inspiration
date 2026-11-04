export const NOTE_SIZE = 128; // wall pixels; matches --note-size
export type Point = { x: number; y: number };
export type Box = Point; // a note's top-left corner
export type Wall = { width: number; height: number };
export type Frame = { id: string; x: number; y: number; w: number; h: number };

export function clampToWall(p: Point, wall: Wall): Point {
  return {
    x: Math.min(Math.max(p.x, 0), Math.max(0, wall.width - NOTE_SIZE)),
    y: Math.min(Math.max(p.y, 0), Math.max(0, wall.height - NOTE_SIZE)),
  };
}

const overlaps = (a: Point, b: Point) => Math.abs(a.x - b.x) < NOTE_SIZE && Math.abs(a.y - b.y) < NOTE_SIZE;

/** A spot near the wall's centre where a new note overlaps no other, scanning outward in rings. */
export function freeSpot(notes: Box[], wall: Wall, rng: () => number): Point {
  const cx = (wall.width - NOTE_SIZE) / 2;
  const cy = (wall.height - NOTE_SIZE) / 2;
  const step = NOTE_SIZE / 2;
  const maxRing = Math.ceil(Math.max(wall.width, wall.height) / step);

  for (let ring = 0; ring <= maxRing; ring++) {
    const candidates: Point[] = [];
    for (let dx = -ring; dx <= ring; dx++)
      for (let dy = -ring; dy <= ring; dy++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) candidates.push({ x: cx + dx * step, y: cy + dy * step });
    // Shuffle the ring so repeated adds do not always pick the same side.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const c of candidates) {
      const p = clampToWall(c, wall);
      if (p.x === c.x && p.y === c.y && !notes.some((n) => overlaps(p, n))) return p;
    }
  }
  return clampToWall({ x: cx + (rng() - 0.5) * NOTE_SIZE, y: cy + (rng() - 0.5) * NOTE_SIZE }, wall);
}

/** The frame containing a note's centre, or null. Later frames win when frames overlap. */
export function snapIntoGroup(note: Point, frames: Frame[]): string | null {
  const cx = note.x + NOTE_SIZE / 2;
  const cy = note.y + NOTE_SIZE / 2;
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h) return f.id;
  }
  return null;
}
