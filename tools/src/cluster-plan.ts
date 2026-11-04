// Pure helpers behind /cluster-thoughts: check a proposed clustering and place the new frames on the wall.

// Keep in sync with site/src/lib/wall (WALL, tidy layout constants).
const WALL = { width: 1600, height: 1000 };
const FRAME_W = 596;
const FRAME_MIN_H = 368;
const GAP = 40;
const NOTE_SIZE = 128;
const PAD_TOP = 76;
const PAD_BOTTOM = 24;
const PITCH = 140;
const COLUMNS = 4;

export type Cluster = { name: string; noteIds: string[] };
export type Rect = { x: number; y: number; w: number; h: number };

type Checked = { ok: true; value: Cluster[] } | { ok: false; errors: string[] };

export function validateClusters(input: unknown, knownNoteIds: Set<string>): Checked {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, errors: ["Expected a non-empty array of { name, noteIds } groups."] };

  const errors: string[] = [];
  const value: Cluster[] = [];
  const seenNames = new Set<string>();
  const placed = new Map<string, number>();

  input.forEach((raw, i) => {
    const n = i + 1;
    const item = raw as { name?: unknown; noteIds?: unknown };
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const ids = Array.isArray(item?.noteIds) ? (item.noteIds as unknown[]).filter((x): x is string => typeof x === "string") : [];

    if (!name) errors.push(`#${n}: the group needs a name.`);
    else if (seenNames.has(name.toLowerCase())) errors.push(`#${n}: duplicate group name "${name}".`);
    else seenNames.add(name.toLowerCase());

    if (ids.length === 0) errors.push(`#${n}: the group has no notes.`);
    for (const id of ids) {
      if (!knownNoteIds.has(id)) errors.push(`#${n}: unknown note id ${id}.`);
      else if (placed.has(id)) errors.push(`#${n}: note ${id} is in more than one group (also #${placed.get(id)}).`);
      else placed.set(id, n);
    }
    value.push({ name, noteIds: ids });
  });

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Height a frame needs for `count` notes in rows of four. */
function frameHeight(count: number): number {
  const rows = Math.max(1, Math.ceil(count / COLUMNS));
  return Math.max(FRAME_MIN_H, PAD_TOP + (rows - 1) * PITCH + NOTE_SIZE + PAD_BOTTOM);
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;

/**
 * One frame per entry in `counts` (its note count), placed in a two-wide grid from the top left,
 * skipping space taken by `existing` frames. Returns null when the wall has no room.
 */
export function layoutFrames(counts: number[], existing: Rect[]): Rect[] | null {
  const placed: Rect[] = [];
  for (const count of counts) {
    const h = frameHeight(count);
    let spot: Rect | null = null;
    for (let y = GAP; y + h <= WALL.height && !spot; y += 8) {
      for (let x = GAP; x + FRAME_W <= WALL.width && !spot; x += FRAME_W + GAP) {
        const r = { x, y, w: FRAME_W, h };
        if (![...existing, ...placed].some((o) => overlaps(r, o))) spot = r;
      }
    }
    if (!spot) return null;
    placed.push(spot);
  }
  return placed;
}
