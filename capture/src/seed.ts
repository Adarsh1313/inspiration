import type { Kind, Shelf } from "./types";

export type SeedCard = {
  title: string;
  /** Null for the one row that has no link yet. */
  url: string | null;
  shelf: Shelf;
  /** Set when the seed says what the card is, otherwise the pipeline's guess stands. */
  kind: Kind | null;
  /** Rows marked "confirm" or with no URL need Adarsh's review. */
  needsReview: boolean;
  note: string;
};

const SHELF_BY_NAME: Record<string, Shelf> = {
  "agent skills": "agent-skills",
  "motion and interactions": "motion-interactions",
  "landing pages and portfolios": "landing-pages-portfolios",
  "backgrounds and assets": "backgrounds-assets",
  typography: "typography",
  "tools and directories": "tools-directories",
  "talks and people": "talks-people",
  "anti-slop": "anti-slop",
};

/** Site rows on these shelves are living collections ("directories"). */
const DIRECTORY_SHELVES = new Set<Shelf>(["landing-pages-portfolios", "backgrounds-assets"]);

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/** Reads the table in docs/seed-references.md. */
export function parseSeed(markdown: string): SeedCard[] {
  const cards: SeedCard[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const [shelfName, cardCell, source = "", note = ""] = splitRow(line);
    const shelf = SHELF_BY_NAME[shelfName?.toLowerCase()];
    if (!shelf || !cardCell) continue; // header and separator rows

    const link = cardCell.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    const title = link ? link[1] : cardCell;
    const url = link ? link[2] : null;
    const isDirectory = /^directory$/i.test(source) || (/^site$/i.test(source) && DIRECTORY_SHELVES.has(shelf));
    const person = /account/i.test(source);

    cards.push({
      title,
      url,
      shelf,
      kind: person ? "person" : isDirectory ? "directory" : null,
      needsReview: url === null || /\bconfirm\b/i.test(note),
      note,
    });
  }
  return cards;
}
