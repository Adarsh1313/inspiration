import { describe, expect, it } from "vitest";
import { mergeMood, parseCardEdit } from "./card-edit";

const ok = { title: " Orbkit ", summary: " Rings. ", shelf: "motion-interactions", tags: "Hover, easing,hover", variance: "7", motion: "", density: "3" };

describe("parseCardEdit", () => {
  it("trims, lowercases and dedupes tags, and treats a blank dial as removed", () => {
    expect(parseCardEdit(ok)).toEqual({
      ok: true,
      value: { title: "Orbkit", summary: "Rings.", shelf: "motion-interactions", tags: ["hover", "easing"], mood: { variance: 7, motion: null, density: 3 } },
    });
  });
  it("rejects an empty title, an unknown shelf and out-of-range dials", () => {
    expect(parseCardEdit({ ...ok, title: " " })).toMatchObject({ ok: false });
    expect(parseCardEdit({ ...ok, shelf: "nope" })).toMatchObject({ ok: false });
    expect(parseCardEdit({ ...ok, motion: "11" })).toMatchObject({ ok: false, error: expect.stringContaining("Motion") });
    expect(parseCardEdit({ ...ok, density: "2.5" })).toMatchObject({ ok: false });
  });
});

describe("mergeMood", () => {
  it("sets edited dials, removes blank ones and keeps extension keys", () => {
    expect(mergeMood({ variance: 2, motion: 5, warmth: 8 }, { variance: 7, motion: null, density: 3 })).toEqual({ variance: 7, density: 3, warmth: 8 });
  });
});
