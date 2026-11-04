// One card as markdown with frontmatter. Shared by the local mirror (tools) and the /r/<slug>.md route (site).

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

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function moodFull(m: Mood): string {
  const parts = (["variance", "motion", "density"] as const).filter((k) => m[k] != null).map((k) => `${k}: ${m[k]}`);
  return `{${parts.join(", ")}}`;
}

function list(items: string[]): string {
  return `[${items.join(", ")}]`;
}

export function cardMarkdown(c: MirrorCard): string {
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
