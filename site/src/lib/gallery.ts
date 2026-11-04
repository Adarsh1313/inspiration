// Pure gallery logic: URL filters, shelf grouping and counts. No React, no Supabase.
import { SHELVES, type Shelf, type SourceType } from "@hub/capture";

export const SOURCE_FILTERS = ["x", "github", "site", "youtube"] as const;
export type SourceFilter = (typeof SOURCE_FILTERS)[number];

export const MOOD_KEYS = ["variance", "motion", "density"] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];
export type Range = { min: number; max: number };

/** Mood buckets offered as chips. Any other `min-max` in the URL still works. */
export const MOOD_BUCKETS = [
  { label: "Low", range: { min: 1, max: 3 } },
  { label: "Mid", range: { min: 4, max: 7 } },
  { label: "High", range: { min: 8, max: 10 } },
] as const;

export type GalleryCard = {
  slug: string;
  title: string;
  author: string | null;
  source_type: SourceType;
  source_url: string | null;
  kind: string;
  shelf: Shelf;
  status: "draft" | "active" | "archived";
  pinned: boolean;
  summary: string | null;
  tags: string[];
  mood: Partial<Record<MoodKey, number>>;
  media_status: "pending" | "ready" | "failed";
  media_error: string | null;
  needs_review: boolean;
  item_count: number | null;
  added_at: string;
  /** Signed URLs, made on the server. */
  posterUrl: string | null;
  previewUrl: string | null;
};

export type Filters = {
  source?: SourceFilter;
  tags: string[];
  mood: Partial<Record<MoodKey, Range>>;
  archived: boolean;
};

export const NO_FILTERS: Filters = { tags: [], mood: {}, archived: false };

export function sourceFilterOf(type: SourceType): SourceFilter {
  if (type === "x-post") return "x";
  if (type === "github") return "github";
  if (type === "youtube") return "youtube";
  return "site"; // reddit, linkedin, video and plain sites
}

/** `7-10` is a range, a lone `7` means "7 or more". Values clamp to 1-10. */
export function parseRange(text: string | null | undefined): Range | undefined {
  const m = text?.trim().match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) return undefined;
  const clamp = (n: number) => Math.min(10, Math.max(1, n));
  const min = clamp(Number(m[1]));
  const max = m[2] != null ? clamp(Number(m[2])) : 10;
  return min <= max ? { min, max } : { min: max, max: min };
}

export function parseFilters(params: URLSearchParams): Filters {
  const source = params.get("source")?.toLowerCase();
  const tags = (params.get("tag") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const mood: Filters["mood"] = {};
  for (const key of MOOD_KEYS) {
    const range = parseRange(params.get(key));
    if (range) mood[key] = range;
  }
  return {
    source: (SOURCE_FILTERS as readonly string[]).includes(source ?? "") ? (source as SourceFilter) : undefined,
    tags: [...new Set(tags)],
    mood,
    archived: params.get("archived") === "1",
  };
}

/** The query string for a set of filters ("" when none), so a filtered view can be shared. */
export function buildQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.source) p.set("source", f.source);
  if (f.tags.length) p.set("tag", f.tags.join(","));
  for (const key of MOOD_KEYS) {
    const r = f.mood[key];
    if (r) p.set(key, `${r.min}-${r.max}`);
  }
  if (f.archived) p.set("archived", "1");
  const text = p.toString().replace(/%2C/g, ",");
  return text ? `?${text}` : "";
}

export function sameRange(a: Range | undefined, b: Range | undefined): boolean {
  return !!a && !!b && a.min === b.min && a.max === b.max;
}

export function isFiltered(f: Filters): boolean {
  return !!f.source || f.tags.length > 0 || Object.keys(f.mood).length > 0;
}

function inView(c: GalleryCard, archived: boolean): boolean {
  return archived ? c.status === "archived" : c.status !== "archived";
}

/** Cards that pass the Archived toggle only (before the chip filters). */
export function visibleCards(cards: GalleryCard[], archived: boolean): GalleryCard[] {
  return cards.filter((c) => inView(c, archived));
}

export function applyFilters(cards: GalleryCard[], f: Filters): GalleryCard[] {
  return visibleCards(cards, f.archived)
    .filter((c) => !f.source || sourceFilterOf(c.source_type) === f.source)
    .filter((c) => f.tags.every((t) => c.tags.some((x) => x.toLowerCase() === t)))
    .filter((c) =>
      MOOD_KEYS.every((key) => {
        const r = f.mood[key];
        if (!r) return true;
        const v = c.mood[key];
        return typeof v === "number" && v >= r.min && v <= r.max;
      }),
    )
    .sort(byPinnedThenNewest);
}

export function byPinnedThenNewest(a: GalleryCard, b: GalleryCard): number {
  return Number(b.pinned) - Number(a.pinned) || b.added_at.localeCompare(a.added_at);
}

export type ShelfGroup = { shelf: Shelf; cards: GalleryCard[]; shown: number; total: number };

/** Shelves in fixed order. `total` counts the shelf before chip filters, `shown` after. Empty shelves are dropped. */
export function groupByShelf(all: GalleryCard[], filtered: GalleryCard[], archived: boolean): ShelfGroup[] {
  const base = visibleCards(all, archived);
  return SHELVES.map((shelf) => {
    const cards = filtered.filter((c) => c.shelf === shelf);
    return { shelf, cards, shown: cards.length, total: base.filter((c) => c.shelf === shelf).length };
  }).filter((g) => g.shown > 0);
}

/** Non-archived card counts per shelf, for the side nav. */
export function shelfCounts(cards: Pick<GalleryCard, "shelf" | "status">[]): Record<Shelf, number> {
  const counts = Object.fromEntries(SHELVES.map((s) => [s, 0])) as Record<Shelf, number>;
  for (const c of cards) if (c.status !== "archived") counts[c.shelf]++;
  return counts;
}

/** Most-used tags among the given cards, for the tag chips. Active filter tags always stay in the list. */
export function topTags(cards: GalleryCard[], keep: string[], limit = 12): string[] {
  const freq = new Map<string, number>();
  for (const c of cards) for (const t of new Set(c.tags.map((x) => x.toLowerCase()))) freq.set(t, (freq.get(t) ?? 0) + 1);
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  return [...new Set([...keep, ...ranked])].slice(0, Math.max(limit, keep.length));
}

export function isShelf(value: string): value is Shelf {
  return (SHELVES as readonly string[]).includes(value);
}

/** Next gives page searchParams as an object; this turns it into URLSearchParams for parseFilters. */
export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") out.set(k, v);
  else if (Array.isArray(v) && v[0] != null) out.set(k, v[0]);
  return out;
}
