import { describe, expect, it } from "vitest";
import { buildMirror, estimateTokens, type MirrorCard } from "./mirror";

const card = (slug: string, over: Partial<MirrorCard> = {}): MirrorCard => ({
  slug,
  title: `Title ${slug}`,
  kind: "animation",
  shelf: "motion-interactions",
  status: "active",
  pinned: false,
  summary: "A short summary of what this reference shows.",
  mood: { variance: 7, motion: 8, density: 3 },
  tags: ["motion"],
  fits: [],
  stack: [],
  used_in: [],
  source_url: `https://example.com/${slug}`,
  source_type: "site",
  reuse: null,
  notes: null,
  video_description: null,
  browse_notes: null,
  picks: [],
  poster_sm: null,
  preview: null,
  ...over,
});

const index = (cards: MirrorCard[]) => buildMirror(cards).files["INDEX.md"];
const lines = (text: string) => text.split("\n").slice(1).filter((l) => l.includes(" | "));

describe("INDEX.md", () => {
  it("has one `slug | kind | mood | summary` line per card", () => {
    const [line] = lines(index([card("orbkit")]));
    expect(line).toBe("orbkit | animation | v7 m8 d3 | A short summary of what this reference shows.");
  });

  it("lists active cards only", () => {
    const out = index([card("a"), card("b", { status: "draft" }), card("c", { status: "archived" })]);
    expect(lines(out).map((l) => l.split(" | ")[0])).toEqual(["a"]);
  });

  it("puts pinned cards first, then slug order", () => {
    const out = index([card("b"), card("a"), card("z", { pinned: true })]);
    expect(lines(out).map((l) => l.split(" | ")[0])).toEqual(["z", "a", "b"]);
  });

  it("writes a dash when mood is unknown and keeps the line on one row", () => {
    const [line] = lines(index([card("x", { mood: {}, summary: "Two\nlines" })]));
    expect(line).toBe("x | animation | - | Two lines");
  });

  it("falls back to the title when a card has no summary yet", () => {
    const [line] = lines(index([card("x", { summary: null, title: "Just a title" })]));
    expect(line.endsWith("| Just a title")).toBe(true);
  });

  it("keeps a line to about 40 tokens by trimming long summaries", () => {
    const long = "word ".repeat(200);
    const [line] = lines(index([card("x", { summary: long })]));
    expect(estimateTokens(line)).toBeLessThanOrEqual(45);
    expect(line.endsWith("…")).toBe(true);
  });

  it("keeps a 30-card index under about 1,500 tokens", () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(`card-${i}`, { summary: "word ".repeat(100) }));
    expect(estimateTokens(index(cards))).toBeLessThan(1500);
  });
});

describe("refs/<slug>/card.md", () => {
  it("writes frontmatter and notes for each non-archived... active card", () => {
    const { files } = buildMirror([card("orbkit", { reuse: "Copy the easing.", tags: ["motion", "orb"] })]);
    const md = files["refs/orbkit/card.md"];
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain("slug: orbkit");
    expect(md).toContain("kind: animation");
    expect(md).toContain("shelf: motion-interactions");
    expect(md).toContain("tags: [motion, orb]");
    expect(md).toContain("mood: {variance: 7, motion: 8, density: 3}");
    expect(md).toContain("## What to reuse\n\nCopy the easing.");
  });

  it("skips draft and archived cards", () => {
    const { files } = buildMirror([card("d", { status: "draft" }), card("a", { status: "archived" })]);
    expect(Object.keys(files).filter((f) => f.startsWith("refs/"))).toEqual([]);
  });

  it("lists directory picks with their notes", () => {
    const { files } = buildMirror([
      card("dir", { kind: "directory", browse_notes: "Filter by Motion.", picks: [{ url: "https://x.test/a", note: "nice hero", saved_at: "2026-01-01" }] }),
    ]);
    const md = files["refs/dir/card.md"];
    expect(md).toContain("## Browse notes\n\nFilter by Motion.");
    expect(md).toContain("- https://x.test/a: nice hero");
  });

  it("points at media files by name when they exist", () => {
    const { files } = buildMirror([card("m", { poster_sm: "abc.jpg", preview: "abc.mp4" })]);
    const md = files["refs/m/card.md"];
    expect(md).toContain("poster: poster.jpg");
    expect(md).toContain("preview: preview.mp4");
  });
});
