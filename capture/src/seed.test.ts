import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSeed } from "./seed";

const cards = parseSeed(readFileSync(new URL("../../docs/seed-references.md", import.meta.url), "utf8"));

describe("parseSeed", () => {
  it("finds all 50 seed cards", () => expect(cards).toHaveLength(50));

  it("flags 'confirm' rows and the row with no URL for review", () => {
    const flagged = cards.filter((c) => c.needsReview).map((c) => c.title);
    expect(flagged.sort()).toEqual(["AI design skills (landing-page skill)", "Directoryyy", "Doop", "Dotmatrix", "Orbkit", "nays1_ post"].sort());
    expect(cards.find((c) => c.url === null)?.title).toBe("AI design skills (landing-page skill)");
  });

  it("keeps the person card and strips nothing from URLs", () => {
    const p = cards.find((c) => c.title === "@zzzzshawn")!;
    expect(p).toMatchObject({ url: "https://x.com/zzzzshawn", kind: "person", shelf: "talks-people" });
    expect(cards.find((c) => c.title === "Scroll Shaders")?.url).toBe("https://scrollshaders.com");
  });

  it("marks directories", () => {
    expect(cards.find((c) => c.title === "Bencho")?.kind).toBe("directory");
    expect(cards.find((c) => c.title === "Land-book")?.kind).toBe("directory");
    expect(cards.find((c) => c.title === "Easings.net")?.kind).toBeNull();
  });

  it("covers every shelf", () => {
    expect(new Set(cards.map((c) => c.shelf)).size).toBe(8);
  });
});

import { offlineDraft } from "./seed";
import { validateEnrichment } from "./enrich";

describe("offlineDraft", () => {
  it("builds a draft from the seed row alone, keeping the seed's shelf and kind", () => {
    const orbkit = cards.find((c) => c.title === "Orbkit")!;
    expect(offlineDraft(orbkit)).toMatchObject({ canonicalKey: "site:orbkit.zzzzshawn.cloud", title: "Orbkit", suggestedShelf: "tools-directories", sourceType: "site" });
    const bencho = offlineDraft(cards.find((c) => c.title === "Bencho")!);
    expect(bencho.kind).toBe("directory");
    expect(offlineDraft(cards.find((c) => c.title === "@zzzzshawn")!)).toMatchObject({ kind: "person", canonicalKey: "x-user:zzzzshawn" });
  });

  it("makes a keyed placeholder for the row with no link", () => {
    const d = offlineDraft(cards.find((c) => c.url === null)!);
    expect(d.canonicalUrl).toBe("");
    expect(d.canonicalKey).toBe("seed:ai-design-skills-landing-page-skill");
  });

  it("gives every seed card a distinct key", () => {
    const keys = cards.map((c) => offlineDraft(c).canonicalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("validateEnrichment", () => {
  const good = { slug: "loader", summary: "A pre-loader with a counting number and a wipe.", tags: ["loader", "counter"], mood: { variance: 4, motion: 8, density: 3 } };
  it("accepts a complete enrichment", () => expect(validateEnrichment(good)).toMatchObject({ ok: true }));
  it("rejects bad moods, tags and unknown shelves with reasons", () => {
    const r = validateEnrichment({ ...good, tags: ["Loader Thing"], mood: { variance: 11, motion: 2.5, density: 3 }, shelf: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
  });
});
