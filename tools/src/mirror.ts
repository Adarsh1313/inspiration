// Pure: card rows in, file tree out. The writer in sync.ts does the I/O.

export type Mood = { variance?: number; motion?: number; density?: number };

export type MirrorCard = {
  slug: string;
  title: string;
  kind: string;
  shelf: string;
  status: "draft" | "active" | "archived";
  pinned: boolean;
  summary: string | null;
  mood: Mood;
  tags: string[];
  fits: string[];
  stack: string[];
  used_in: string[];
  source_url: string | null;
  source_type: string;
  reuse: string | null;
  notes: string | null;
  video_description: string | null;
  browse_notes: string | null;
  picks: { url: string; note?: string; saved_at?: string }[];
  poster_sm: string | null;
  preview: string | null;
};

export type Mirror = { files: Record<string, string> };

const MAX_SUMMARY_CHARS = 110; // keeps a whole line near 40 tokens

/** Rough token estimate (about 4 characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

function moodShort(m: Mood): string {
  const parts = [
    m.variance != null && `v${m.variance}`,
    m.motion != null && `m${m.motion}`,
    m.density != null && `d${m.density}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "-";
}

function moodFull(m: Mood): string {
  const parts = (["variance", "motion", "density"] as const).filter((k) => m[k] != null).map((k) => `${k}: ${m[k]}`);
  return `{${parts.join(", ")}}`;
}

function list(items: string[]): string {
  return `[${items.join(", ")}]`;
}

function indexLine(c: MirrorCard): string {
  const text = oneLine(c.summary ?? "") || oneLine(c.title);
  return `${c.slug} | ${c.kind} | ${moodShort(c.mood)} | ${trim(text, MAX_SUMMARY_CHARS)}`;
}

function cardMarkdown(c: MirrorCard): string {
  const front = [
    `slug: ${c.slug}`,
    `title: ${oneLine(c.title)}`,
    `kind: ${c.kind}`,
    `shelf: ${c.shelf}`,
    `source_type: ${c.source_type}`,
    c.source_url && `source_url: ${c.source_url}`,
    `tags: ${list(c.tags)}`,
    `mood: ${moodFull(c.mood)}`,
    `fits: ${list(c.fits)}`,
    `stack: ${list(c.stack)}`,
    `used_in: ${list(c.used_in)}`,
    c.poster_sm && "poster: poster.jpg",
    c.preview && "preview: preview.mp4",
  ].filter(Boolean);

  const sections: string[] = [`---\n${front.join("\n")}\n---`, `# ${oneLine(c.title)}`];
  if (c.summary) sections.push(c.summary.trim());
  if (c.video_description) sections.push(`## What it looks like\n\n${c.video_description.trim()}`);
  if (c.reuse) sections.push(`## What to reuse\n\n${c.reuse.trim()}`);
  if (c.notes) sections.push(`## Notes\n\n${c.notes.trim()}`);
  if (c.browse_notes) sections.push(`## Browse notes\n\n${c.browse_notes.trim()}`);
  if (c.picks.length) {
    sections.push(`## Saved picks\n\n${c.picks.map((p) => `- ${p.url}${p.note ? `: ${p.note}` : ""}`).join("\n")}`);
  }
  return sections.join("\n\n") + "\n";
}

export function buildMirror(cards: MirrorCard[]): Mirror {
  const active = cards
    .filter((c) => c.status === "active")
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.slug.localeCompare(b.slug));

  const files: Record<string, string> = {
    "INDEX.md": ["slug | kind | mood | summary", ...active.map(indexLine)].join("\n") + "\n",
  };
  for (const c of active) files[`refs/${c.slug}/card.md`] = cardMarkdown(c);
  return { files };
}
