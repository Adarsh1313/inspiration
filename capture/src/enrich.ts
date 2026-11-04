import { KINDS, SHELVES, type Kind, type Shelf } from "./types";

/** One approved enrichment, as written by a Claude Code session after Adarsh OKs the table. */
export type Enrichment = {
  slug: string;
  summary: string;
  tags: string[];
  mood: { variance: number; motion: number; density: number };
  fits?: string[];
  stack?: string[];
  reuse?: string;
  video_description?: string;
  kind?: Kind;
  shelf?: Shelf;
  browse_notes?: string;
  item_count?: number;
  /** Slugs of related cards. */
  related?: string[];
  /** Clear the "needs review" flag and make the card active (default true). */
  activate?: boolean;
};

export type EnrichmentCheck = { ok: true; value: Enrichment } | { ok: false; errors: string[] };

const isInt = (n: unknown): n is number => Number.isInteger(n);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Checks one enrichment before it touches the database. */
export function validateEnrichment(input: unknown): EnrichmentCheck {
  const e = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof e.slug !== "string" || !e.slug) errors.push("slug is required");
  if (typeof e.summary !== "string" || e.summary.trim().length < 10) errors.push("summary needs at least a sentence");
  else if (e.summary.length > 400) errors.push("summary is over 400 characters");
  if (!strings(e.tags) || e.tags.length === 0 || e.tags.length > 8) errors.push("tags must be 1 to 8 strings");
  else if (e.tags.some((t) => !/^[a-z0-9][a-z0-9-]*$/.test(t))) errors.push("tags must be lowercase kebab-case");

  const mood = e.mood as Record<string, unknown> | undefined;
  for (const k of ["variance", "motion", "density"]) {
    const v = mood?.[k];
    if (!isInt(v) || v < 1 || v > 10) errors.push(`mood.${k} must be a whole number from 1 to 10`);
  }
  for (const k of ["fits", "stack", "related"]) if (e[k] !== undefined && !strings(e[k])) errors.push(`${k} must be a list of strings`);
  for (const k of ["reuse", "video_description", "browse_notes"]) if (e[k] !== undefined && typeof e[k] !== "string") errors.push(`${k} must be text`);
  if (e.kind !== undefined && !(KINDS as readonly string[]).includes(e.kind as string)) errors.push("kind is not a known kind");
  if (e.shelf !== undefined && !(SHELVES as readonly string[]).includes(e.shelf as string)) errors.push("shelf is not a known shelf");
  if (e.item_count !== undefined && (!isInt(e.item_count) || e.item_count < 0)) errors.push("item_count must be a whole number");

  return errors.length ? { ok: false, errors } : { ok: true, value: { ...(e as Enrichment), summary: (e.summary as string).trim() } };
}
