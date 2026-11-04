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
