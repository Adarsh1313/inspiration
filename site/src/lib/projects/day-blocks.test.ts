import { describe, expect, it } from "vitest";
import {
  allFilename, blockFilename, blockMarkdown, cardView, continueList, indent, nextSeq, pickColour,
  projectForRemote, slugify, todayIST, toMarkdown, unticketed, type Entry,
} from "./day-blocks";

const entry = (over: Partial<Entry> = {}): Entry => ({ id: "e", day: "2026-11-11", seq: 1, text: "- a", rev: 1, ticketed_at: null, issues: [], ...over });
const at = (iso: string) => new Date(iso);

describe("todayIST", () => {
  it("rolls over at 18:30 UTC", () => {
    expect(todayIST(at("2026-11-11T18:29:00Z"))).toBe("2026-11-11");
    expect(todayIST(at("2026-11-11T18:31:00Z"))).toBe("2026-11-12");
  });
});

describe("cardView", () => {
  const now = at("2026-11-11T10:00:00Z");

  it("binds the editor to today's untickted entry and lists older days as blocks, newest first", () => {
    const view = cardView([entry({ id: "old", day: "2026-11-09" }), entry({ id: "today" }), entry({ id: "mid", day: "2026-11-10" })], now);
    expect(view.open?.id).toBe("today");
    expect(view.blocks.map((b) => b.entry.id)).toEqual(["mid", "old"]);
    expect(view.blocks[0].label).toBe("10 Nov");
  });

  it("turns yesterday's open text into a block after midnight IST", () => {
    const view = cardView([entry()], at("2026-11-11T18:31:00Z"));
    expect(view.open).toBeNull();
    expect(view.blocks.map((b) => b.label)).toEqual(["11 Nov"]);
  });

  it("leaves nothing behind for empty entries", () => {
    const view = cardView([entry({ text: "  \n" })], at("2026-11-12T10:00:00Z"));
    expect(view.open).toBeNull();
    expect(view.blocks).toEqual([]);
  });

  it("locks a ticketed entry into a block and numbers the day's blocks", () => {
    const issues = [{ number: 3, title: "t", url: "u" }];
    const view = cardView([entry({ id: "a", ticketed_at: "2026-11-11T09:00:00Z", issues }), entry({ id: "b", seq: 2, text: "- later" })], now);
    expect(view.open?.id).toBe("b");
    expect(view.blocks).toHaveLength(1);
    expect(view.blocks[0]).toMatchObject({ label: "11 Nov · 1", ticketed: true, issues });
  });

  it("labels two ticketed blocks on one day with their seq", () => {
    const t = "2026-11-11T09:00:00Z";
    const view = cardView([entry({ id: "a", ticketed_at: t }), entry({ id: "b", seq: 2, ticketed_at: t })], now);
    expect(view.open).toBeNull();
    expect(view.blocks.map((b) => b.label)).toEqual(["11 Nov · 2", "11 Nov · 1"]);
  });
});

describe("nextSeq", () => {
  it("is one past the day's highest seq", () => {
    expect(nextSeq([], "2026-11-11")).toBe(1);
    expect(nextSeq([entry(), entry({ seq: 2 }), entry({ day: "2026-11-10", seq: 5 })], "2026-11-11")).toBe(3);
  });
});

describe("unticketed", () => {
  it("skips ticketed and empty entries, oldest first", () => {
    const list = unticketed([
      entry({ id: "new", day: "2026-11-11" }),
      entry({ id: "done", day: "2026-11-09", ticketed_at: "x" }),
      entry({ id: "blank", day: "2026-11-08", text: " " }),
      entry({ id: "old", day: "2026-11-10" }),
    ]);
    expect(list.map((e) => e.id)).toEqual(["old", "new"]);
  });
});

describe("continueList", () => {
  it("continues a dash list", () => {
    expect(continueList("- one", 5)).toEqual({ text: "- one\n- ", caret: 8 });
  });
  it("continues numbers and renumbers what follows", () => {
    expect(continueList("1. a\n2. b", 4)).toEqual({ text: "1. a\n2. \n3. b", caret: 8 });
  });
  it("keeps indent", () => {
    expect(continueList("  * x", 5)).toEqual({ text: "  * x\n  * ", caret: 10 });
  });
  it("ends the list on an empty item", () => {
    expect(continueList("- a\n- ", 6)).toEqual({ text: "- a\n", caret: 4 });
  });
  it("splits the line at the caret", () => {
    expect(continueList("- ab", 3)).toEqual({ text: "- a\n- b", caret: 6 });
  });
  it("ignores plain text", () => {
    expect(continueList("hello", 5)).toBeNull();
  });
});

describe("indent", () => {
  it("indents and outdents list lines", () => {
    expect(indent("- a", { start: 3, end: 3 }, 1)).toEqual({ text: "  - a", start: 5, end: 5 });
    expect(indent("  - a", { start: 5, end: 5 }, -1)).toEqual({ text: "- a", start: 3, end: 3 });
  });
  it("handles several lines", () => {
    const r = indent("- a\n- b\nplain", { start: 0, end: 7 }, 1);
    expect(r?.text).toBe("  - a\n  - b\nplain");
  });
  it("does not outdent past column 0", () => {
    expect(indent("- a", { start: 1, end: 1 }, -1)?.text).toBe("- a");
  });
  it("leaves non-list lines to the browser", () => {
    expect(indent("plain", { start: 0, end: 0 }, 1)).toBeNull();
  });
});

describe("export", () => {
  const entries = [entry({ id: "a", day: "2026-11-10", text: "old" }), entry({ id: "b", text: "new" })];

  it("puts the newest day first", () => {
    expect(toMarkdown({ name: "Portfolio" }, entries)).toBe("# Portfolio\n\n## 2026-11-11\n\nnew\n\n\n## 2026-11-10\n\nold\n\n");
  });
  it("names the files", () => {
    expect(blockFilename("portfolio", entries[1], "md")).toBe("portfolio-2026-11-11.md");
    expect(blockFilename("portfolio", entry({ seq: 2 }), "txt")).toBe("portfolio-2026-11-11-2.txt");
    expect(allFilename("portfolio")).toBe("portfolio-all.md");
  });
  it("mentions issues on ticketed blocks", () => {
    const md = blockMarkdown(entry({ ticketed_at: "x", issues: [{ number: 4, title: "t", url: "https://x/4" }] }));
    expect(md).toContain("[#4](https://x/4)");
  });
});

describe("projectForRemote", () => {
  const projects = [{ slug: "a", repo: "Adarsh1313/Inspiration" }, { slug: "b", repo: null }];
  it.each([
    "https://github.com/adarsh1313/inspiration",
    "https://github.com/Adarsh1313/Inspiration.git",
    "git@github.com:adarsh1313/INSPIRATION.git",
  ])("matches %s", (url) => expect(projectForRemote(projects, url)?.slug).toBe("a"));
  it("returns null for strangers", () => {
    expect(projectForRemote(projects, "https://github.com/x/y.git")).toBeNull();
    expect(projectForRemote(projects, "not a url")).toBeNull();
  });
});

describe("slugify and pickColour", () => {
  it("slugifies names", () => expect(slugify("  Email Tracker!  ")).toBe("email-tracker"));
  it("picks the least-used colour", () => {
    expect(pickColour([])).toBe("yellow");
    expect(pickColour(["yellow", "pink", "green", "blue", "yellow"])).toBe("apricot");
    expect(pickColour(["yellow", "pink", "green", "blue", "apricot", "yellow"])).toBe("pink");
  });
});
