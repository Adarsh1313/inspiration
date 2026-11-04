import { describe, expect, it } from "vitest";
import { cardJsonLd, cardMdUrl, filterRefs, jsonLdScript, parseRefsQuery, renderLlmsTxt, toRefSummary, type AgentCard } from "./agent-access";

const card = (slug: string, over: Partial<AgentCard> = {}): AgentCard => ({
  slug,
  title: `Title ${slug}`,
  kind: "animation",
  shelf: "motion-interactions",
  status: "active",
  pinned: false,
  summary: "A short summary.",
  mood: { variance: 7, motion: 8, density: 3 },
  tags: ["hover", "easing"],
  fits: [],
  stack: [],
  used_in: [],
  source_url: "https://x.com/a/status/1",
  source_type: "x-post",
  reuse: null,
  notes: null,
  video_description: null,
  browse_notes: null,
  picks: [],
  poster_sm: null,
  preview: null,
  author: null,
  description: null,
  added_at: "2026-01-01T00:00:00Z",
  media_status: "ready",
  ...over,
});

const ctx = { baseUrl: "https://hub.test" };

describe("filterRefs", () => {
  const cards = [
    card("b"),
    card("a", { pinned: true }),
    card("c", { shelf: "typography", kind: "typography", tags: ["Serif"] }),
    card("d", { status: "draft" }),
    card("e", { status: "archived" }),
  ];

  it("returns only active cards by default, pinned first then by slug", () => {
    expect(filterRefs(cards, {}).map((c) => c.slug)).toEqual(["a", "b", "c"]);
  });

  it("filters by shelf, kind and tag (tag is case-insensitive)", () => {
    expect(filterRefs(cards, { shelf: "typography" }).map((c) => c.slug)).toEqual(["c"]);
    expect(filterRefs(cards, { kind: "animation" }).map((c) => c.slug)).toEqual(["a", "b"]);
    expect(filterRefs(cards, { tag: "serif" }).map((c) => c.slug)).toEqual(["c"]);
  });

  it("can ask for a status, or all", () => {
    expect(filterRefs(cards, { status: "draft" }).map((c) => c.slug)).toEqual(["d"]);
    expect(filterRefs(cards, { status: "all" })).toHaveLength(5);
  });
});

describe("parseRefsQuery", () => {
  it("reads the four filters and ignores blanks", () => {
    expect(parseRefsQuery(new URLSearchParams("shelf=Typography&tag=&kind=layout"))).toEqual({ shelf: "typography", kind: "layout", tag: undefined, status: undefined });
  });
});

describe("renderLlmsTxt", () => {
  it("lists one line and md link per active card, grouped by shelf", () => {
    const text = renderLlmsTxt([card("orbkit"), card("draft-one", { status: "draft" })], ctx);
    expect(text).toContain("## motion-interactions");
    expect(text).toContain("- [Title orbkit](https://hub.test/r/orbkit.md) (animation): A short summary.");
    expect(text).not.toContain("draft-one");
  });

  it("keeps the caller's ?token= on every link so an agent can follow them", () => {
    const text = renderLlmsTxt([card("orbkit")], { ...ctx, queryToken: "t0k en" });
    expect(text).toContain("/r/orbkit.md?token=t0k%20en)");
  });

  it("stays small: 30 cards fit well under 3,000 tokens", () => {
    const many = Array.from({ length: 30 }, (_, i) => card(`card-${i}`, { summary: "x".repeat(110) }));
    expect(Math.ceil(renderLlmsTxt(many, ctx).length / 4)).toBeLessThan(3000);
  });
});

describe("toRefSummary", () => {
  it("includes page and markdown links", () => {
    const s = toRefSummary(card("orbkit"), ctx);
    expect(s.url).toBe("https://hub.test/r/orbkit");
    expect(s.md_url).toBe(cardMdUrl({ slug: "orbkit" }, ctx));
    expect(s.mood).toEqual({ variance: 7, motion: 8, density: 3 });
  });
});

describe("cardJsonLd", () => {
  it("is a CreativeWork without a clip and a VideoObject with one", () => {
    expect(cardJsonLd(card("a"), ctx)["@type"]).toBe("CreativeWork");
    const v = cardJsonLd(card("a", { preview: "p.mp4", video_description: "A ring spins." }), ctx);
    expect(v["@type"]).toBe("VideoObject");
    expect(v.transcript).toBe("A ring spins.");
  });

  it("escapes < so card text cannot close the script tag", () => {
    const out = jsonLdScript(cardJsonLd(card("a", { title: "</script><b>" }), ctx));
    expect(out).not.toContain("<");
  });
});
