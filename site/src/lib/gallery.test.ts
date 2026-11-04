import { describe, expect, it } from "vitest";
import { isChecklistCard, applyFilters, buildQuery, groupByShelf, isFiltered, parseFilters, parseRange, shelfCounts, sourceFilterOf, topTags, type GalleryCard } from "./gallery";

const card = (slug: string, over: Partial<GalleryCard> = {}): GalleryCard => ({
  slug,
  title: slug,
  author: null,
  source_type: "x-post",
  source_url: null,
  kind: "animation",
  shelf: "motion-interactions",
  status: "active",
  pinned: false,
  summary: null,
  tags: [],
  mood: {},
  media_status: "ready",
  media_error: null,
  needs_review: false,
  item_count: null,
  added_at: "2026-01-01T00:00:00Z",
  posterUrl: null,
  previewUrl: null,
  ...over,
});

const q = (s: string) => parseFilters(new URLSearchParams(s));

describe("parseRange", () => {
  it("reads ranges, treats a lone number as 'at least', and clamps", () => {
    expect(parseRange("3-6")).toEqual({ min: 3, max: 6 });
    expect(parseRange("7")).toEqual({ min: 7, max: 10 });
    expect(parseRange("0-99")).toEqual({ min: 1, max: 10 });
    expect(parseRange("9-2")).toEqual({ min: 2, max: 9 });
  });
  it("ignores junk", () => {
    expect(parseRange("high")).toBeUndefined();
    expect(parseRange("")).toBeUndefined();
    expect(parseRange(null)).toBeUndefined();
  });
});

describe("parseFilters / buildQuery", () => {
  it("round-trips a filtered view through the URL", () => {
    const f = q("source=github&tag=hover,Easing&motion=8-10&archived=1");
    expect(f).toEqual({ source: "github", tags: ["hover", "easing"], mood: { motion: { min: 8, max: 10 } }, archived: true });
    expect(buildQuery(f)).toBe("?source=github&tag=hover,easing&motion=8-10&archived=1");
    expect(q(buildQuery(f).slice(1))).toEqual(f);
  });
  it("drops unknown sources and gives an empty query for no filters", () => {
    expect(q("source=tiktok").source).toBeUndefined();
    expect(buildQuery(q(""))).toBe("");
    expect(isFiltered(q("tag=a"))).toBe(true);
    expect(isFiltered(q("archived=1"))).toBe(false);
  });
});

describe("sourceFilterOf", () => {
  it("groups reddit, linkedin and video under Site", () => {
    expect(sourceFilterOf("x-post")).toBe("x");
    expect(sourceFilterOf("youtube")).toBe("youtube");
    expect(sourceFilterOf("reddit")).toBe("site");
    expect(sourceFilterOf("linkedin")).toBe("site");
  });
});

describe("applyFilters", () => {
  const cards = [
    card("a", { tags: ["hover"], mood: { motion: 9 }, added_at: "2026-01-03T00:00:00Z" }),
    card("b", { source_type: "github", tags: ["hover", "easing"], mood: { motion: 4 }, added_at: "2026-01-02T00:00:00Z" }),
    card("c", { status: "archived" }),
    card("d", { pinned: true, added_at: "2026-01-01T00:00:00Z" }),
  ];

  it("hides archived cards by default and shows only them under Archived", () => {
    expect(applyFilters(cards, q("")).map((c) => c.slug)).toEqual(["d", "a", "b"]);
    expect(applyFilters(cards, q("archived=1")).map((c) => c.slug)).toEqual(["c"]);
  });
  it("filters by source, tags (all must match) and mood range", () => {
    expect(applyFilters(cards, q("source=github")).map((c) => c.slug)).toEqual(["b"]);
    expect(applyFilters(cards, q("tag=hover,easing")).map((c) => c.slug)).toEqual(["b"]);
    expect(applyFilters(cards, q("motion=8-10")).map((c) => c.slug)).toEqual(["a"]);
  });
  it("leaves out cards with no value for a mood dial that is being filtered", () => {
    expect(applyFilters(cards, q("density=1-10"))).toEqual([]);
  });
});

describe("groupByShelf", () => {
  const cards = [card("a"), card("b", { shelf: "typography" }), card("c", { shelf: "typography", tags: ["x"] }), card("z", { status: "archived" })];

  it("keeps shelf order, drops empty shelves and counts shown of total", () => {
    const filtered = applyFilters(cards, q("tag=x"));
    const groups = groupByShelf(cards, filtered, false);
    expect(groups.map((g) => [g.shelf, g.shown, g.total])).toEqual([["typography", 1, 2]]);
  });
});

describe("shelfCounts", () => {
  it("counts non-archived cards per shelf", () => {
    const counts = shelfCounts([card("a"), card("b", { status: "draft" }), card("c", { status: "archived" })]);
    expect(counts["motion-interactions"]).toBe(2);
    expect(counts.typography).toBe(0);
  });
});

describe("topTags", () => {
  it("ranks by use and keeps active tags even when rare", () => {
    const cards = [card("a", { tags: ["x", "y"] }), card("b", { tags: ["x"] })];
    expect(topTags(cards, ["rare"], 2)).toEqual(["rare", "x"]);
  });
});

describe("isChecklistCard", () => {
  it("holds for the anti-slop shelf and for slop slugs wherever the card is shelved", () => {
    expect(isChecklistCard({ shelf: "anti-slop", slug: "anything" })).toBe(true);
    expect(isChecklistCard({ shelf: "typography", slug: "design-slop-indicators" })).toBe(true);
    expect(isChecklistCard({ shelf: "typography", slug: "orbkit" })).toBe(false);
  });
});
