export type WallNote = {
  id: string;
  text: string;
  colour: string;
  pinned: boolean;
  x: number;
  y: number;
  rotation: number;
  z: number;
  group_id: string | null;
  created_at: string;
};

export type WallGroup = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  created_at: string;
};

/** Logical wall size in pixels. Notes and frames are positioned in these units. */
export const WALL = { width: 1600, height: 1000 } as const;

export const NOTE_COLUMNS = "id,text,colour,pinned,x,y,rotation,z,group_id,created_at";

/** Stacking order: pinned notes above the rest, then by z. */
export function stackOrder(a: WallNote, b: WallNote): number {
  return Number(a.pinned) - Number(b.pinned) || a.z - b.z;
}
