export const WALL_COLOURS = ["yellow", "pink", "green", "blue", "apricot"] as const;
export type WallColour = (typeof WALL_COLOURS)[number];

/**
 * Pick a colour for a new note: never either of the last two, and weighted toward
 * the colours least used on the wall.
 */
export function nextColour(recent: string[], counts: Record<string, number>, rng: () => number): WallColour {
  const lastTwo = recent.slice(-2);
  let pool = WALL_COLOURS.filter((c) => !lastTwo.includes(c));
  if (pool.length === 0) pool = [...WALL_COLOURS];

  const used = (c: string) => counts[c] ?? 0;
  const max = Math.max(...pool.map(used));
  const weights = pool.map((c) => max - used(c) + 1);
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
