// Pure logic for the Watch notes page: timestamp links, filtering and ordering. No I/O.

export type WatchSource = "youtube" | "x-post";
export type WatchFilter = "all" | "youtube" | "x";

export type WatchItem = {
  id: string;
  source_url: string;
  source_type: WatchSource;
  title: string;
  author: string | null;
  duration_s: number | null;
  notes: string;
  rev: number;
  created_at: string;
  /** A displayable image URL (YouTube's own, or a signed URL for a stored X image), or null. */
  thumb: string | null;
};

export const FILTER_LABEL: Record<WatchFilter, string> = { all: "All", youtube: "YouTube", x: "X" };
export const FILTERS = Object.keys(FILTER_LABEL) as WatchFilter[];

export function filterItems<T extends { source_type: WatchSource }>(items: T[], filter: WatchFilter): T[] {
  if (filter === "all") return items;
  return items.filter((i) => i.source_type === (filter === "x" ? "x-post" : "youtube"));
}

export function newestFirst<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

export type NotePart = { type: "text"; text: string } | { type: "time"; text: string; seconds: number; href: string };

// h:mm:ss or m:ss, standing alone: not glued to a letter, digit, colon or dot on either side.
const TIMESTAMP = /(?<![\w:.])(?:(\d{1,2}):([0-5]\d):([0-5]\d)|(\d{1,3}):([0-5]\d))(?![\w:])/g;

/** The video URL opened at `seconds`. */
export function timeHref(videoUrl: string, seconds: number): string {
  const url = new URL(videoUrl);
  url.searchParams.set("t", String(seconds));
  return url.toString();
}

/**
 * Split notes into plain text and timestamp links. Links appear only for YouTube items,
 * and only when the time fits inside the video (when its length is known).
 */
export function linkifyTimestamps(text: string, source: WatchSource, videoUrl: string, durationS: number | null): NotePart[] {
  if (source !== "youtube") return [{ type: "text", text }];
  const parts: NotePart[] = [];
  let last = 0;
  for (const m of text.matchAll(TIMESTAMP)) {
    const seconds = m[1] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[4]) * 60 + Number(m[5]);
    if (durationS !== null && seconds > durationS) continue;
    const start = m.index ?? 0;
    if (start > last) parts.push({ type: "text", text: text.slice(last, start) });
    parts.push({ type: "time", text: m[0], seconds, href: timeHref(videoUrl, seconds) });
    last = start + m[0].length;
  }
  if (last < text.length || parts.length === 0) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

/** After a sync conflict: the server's notes, then the local copy under a divider so nothing is lost. */
export function withConflictCopy(serverText: string, mine: string): string {
  if (mine === serverText || mine.trim() === "") return serverText;
  return `${serverText.replace(/\s+$/, "")}\n\n--- copy from another device ---\n${mine}`;
}
