import { describe, expect, it } from "vitest";
import { sortNotes, NOTE_COLOURS, type Note } from "./notes";

const n = (id: string, over: Partial<Note> = {}): Note => ({
  id,
  text: id,
  colour: "yellow",
  tag: null,
  pinned: false,
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("sortNotes", () => {
  it("puts pinned notes first, then newest first", () => {
    const sorted = sortNotes([
      n("old", { created_at: "2026-01-01T00:00:00Z" }),
      n("new", { created_at: "2026-03-01T00:00:00Z" }),
      n("pinned-old", { pinned: true, created_at: "2025-01-01T00:00:00Z" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["pinned-old", "new", "old"]);
  });

  it("does not mutate its input", () => {
    const input = [n("a"), n("b", { pinned: true })];
    sortNotes(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("NOTE_COLOURS", () => {
  it("starts with the default colour", () => {
    expect(NOTE_COLOURS[0]).toBe("yellow");
  });
});
