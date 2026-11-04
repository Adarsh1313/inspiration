// Pure: card rows in, file tree out. The writer in sync.ts does the I/O.

import { cardMarkdown, oneLine, type MirrorCard, type Mood } from "@hub/capture";

export type { MirrorCard, Mood };

export type Mirror = { files: Record<string, string> };

const MAX_SUMMARY_CHARS = 110; // keeps a whole line near 40 tokens

/** Rough token estimate (about 4 characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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

function indexLine(c: MirrorCard): string {
  const text = oneLine(c.summary ?? "") || oneLine(c.title);
  return `${c.slug} | ${c.kind} | ${moodShort(c.mood)} | ${trim(text, MAX_SUMMARY_CHARS)}`;
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
