import { describe, expect, it } from "vitest";
import { onLoad, onRemote, onSaveResult, wordCount } from "./notepad-sync";

describe("onLoad (open the page, maybe with an offline draft)", () => {
  it("uses the server text when there is no local draft", () => {
    expect(onLoad(null, { text: "server", rev: 3 })).toEqual({ text: "server", rev: 3, dirty: false });
  });

  it("uses the server text when the local draft was already synced", () => {
    const local = { text: "old", baseRev: 2, dirty: false };
    expect(onLoad(local, { text: "server", rev: 3 })).toEqual({ text: "server", rev: 3, dirty: false });
  });

  it("keeps an offline edit and pushes it when the server has not moved", () => {
    const local = { text: "typed offline", baseRev: 3, dirty: true };
    expect(onLoad(local, { text: "server", rev: 3 })).toEqual({ text: "typed offline", rev: 3, dirty: true });
  });

  it("archives an offline edit as a conflict copy when the server moved on", () => {
    const local = { text: "typed offline", baseRev: 2, dirty: true };
    expect(onLoad(local, { text: "server", rev: 3 })).toEqual({
      text: "server",
      rev: 3,
      dirty: false,
      archive: "typed offline",
    });
  });

  it("does not archive an offline edit that matches the server text", () => {
    const local = { text: "same", baseRev: 1, dirty: true };
    expect(onLoad(local, { text: "same", rev: 3 })).toEqual({ text: "same", rev: 3, dirty: false });
  });
});

describe("onRemote (realtime update from another device)", () => {
  it("adopts a newer remote version when nothing is unsaved", () => {
    expect(onRemote({ text: "a", rev: 1, dirty: false }, { text: "b", rev: 2 })).toEqual({ text: "b", rev: 2, dirty: false });
  });

  it("ignores echoes of our own save and stale versions", () => {
    const current = { text: "a", rev: 2, dirty: false };
    expect(onRemote(current, { text: "a", rev: 2 })).toBeNull();
    expect(onRemote(current, { text: "old", rev: 1 })).toBeNull();
  });

  it("leaves unsaved typing alone; the next save settles the conflict", () => {
    expect(onRemote({ text: "typing", rev: 1, dirty: true }, { text: "b", rev: 2 })).toBeNull();
  });
});

describe("onSaveResult", () => {
  it("records the new revision on success", () => {
    expect(onSaveResult("mine", { ok: true, text: "mine", rev: 5 })).toEqual({ text: "mine", rev: 5, dirty: false });
  });

  it("archives my text and adopts the server's when another device won", () => {
    expect(onSaveResult("mine", { ok: false, text: "theirs", rev: 6 })).toEqual({
      text: "theirs",
      rev: 6,
      dirty: false,
      archive: "mine",
    });
  });

  it("does not archive when the winning text is identical", () => {
    expect(onSaveResult("same", { ok: false, text: "same", rev: 6 })).toEqual({ text: "same", rev: 6, dirty: false });
  });
});

describe("wordCount", () => {
  it("counts words split by any whitespace", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("  \n ")).toBe(0);
    expect(wordCount("one two\nthree\tfour")).toBe(4);
  });
});
