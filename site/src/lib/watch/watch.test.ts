import { describe, expect, it } from "vitest";
import { acceptLink } from "./link";
import { filterItems, linkifyTimestamps, newestFirst, timeHref, withConflictCopy, type NotePart } from "./notes";

const VIDEO = "https://www.youtube.com/watch?v=abcdefghijk";
const times = (parts: NotePart[]) => parts.filter((p) => p.type === "time").map((p) => p.text);

describe("acceptLink", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abcdefghijk&utm_source=x", "youtube:", "yt:abcdefghijk"],
    ["https://youtu.be/abcdefghijk?si=zzz", "youtube:", "yt:abcdefghijk"],
    ["https://www.youtube.com/shorts/abcdefghijk", "youtube:", "yt:abcdefghijk"],
    ["https://x.com/someone/status/1234567890", "x-post:", "x:1234567890"],
    ["https://twitter.com/someone/status/1234567890?s=20", "x-post:", "x:1234567890"],
  ])("accepts %s", (url, prefix, key) => {
    const r = acceptLink(url);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(`${r.source}:`).toBe(prefix);
      expect(r.key).toBe(key);
    }
  });

  it("treats link variants as the same item", () => {
    const a = acceptLink("https://youtu.be/abcdefghijk");
    const b = acceptLink("https://www.youtube.com/watch?v=abcdefghijk&feature=share");
    expect(a.ok && b.ok && a.key === b.key).toBe(true);
  });

  it.each(["https://x.com/someone", "https://example.com/post", "https://github.com/a/b", "not a link", ""])("refuses %s", (url) => {
    const r = acceptLink(url);
    expect(r).toEqual({ ok: false, message: "Paste a YouTube or X link." });
  });
});

describe("linkifyTimestamps", () => {
  it("links m:ss and h:mm:ss with the right seconds", () => {
    const parts = linkifyTimestamps("start 0:05, key point 12:34 and 1:02:03 end", "youtube", VIDEO, null);
    expect(times(parts)).toEqual(["0:05", "12:34", "1:02:03"]);
    const seconds = parts.filter((p) => p.type === "time").map((p) => (p as { seconds: number }).seconds);
    expect(seconds).toEqual([5, 754, 3723]);
  });

  it("builds a link to that moment", () => {
    const part = linkifyTimestamps("12:34", "youtube", VIDEO, null)[0];
    expect(part).toMatchObject({ type: "time", href: `${VIDEO}&t=754` });
    expect(timeHref(VIDEO, 5)).toBe(`${VIDEO}&t=5`);
  });

  it("keeps the text around links intact", () => {
    const text = "a 1:00 b\n- 2:00 c";
    const rebuilt = linkifyTimestamps(text, "youtube", VIDEO, null).map((p) => p.text).join("");
    expect(rebuilt).toBe(text);
  });

  it.each(["3:45pm", "12:345", "ab12:34", "v1.12:34", "1:2:03", "99:99", "10:60"])("does not link %s", (text) => {
    expect(times(linkifyTimestamps(text, "youtube", VIDEO, null))).toEqual([]);
  });

  it("only links YouTube items", () => {
    expect(linkifyTimestamps("12:34", "x-post", "https://x.com/a/status/1", null)).toEqual([{ type: "text", text: "12:34" }]);
  });

  it("skips times past the video's length when known", () => {
    expect(times(linkifyTimestamps("5:00 and 20:00", "youtube", VIDEO, 600))).toEqual(["5:00"]);
  });

  it("returns one text part for empty notes", () => {
    expect(linkifyTimestamps("", "youtube", VIDEO, null)).toEqual([{ type: "text", text: "" }]);
  });
});

describe("filter and order", () => {
  const items = [
    { id: "a", source_type: "youtube" as const, created_at: "2026-11-01T00:00:00Z" },
    { id: "b", source_type: "x-post" as const, created_at: "2026-11-03T00:00:00Z" },
    { id: "c", source_type: "youtube" as const, created_at: "2026-11-02T00:00:00Z" },
  ];
  it("filters by source", () => {
    expect(filterItems(items, "all")).toHaveLength(3);
    expect(filterItems(items, "x").map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, "youtube").map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("puts the newest first without mutating", () => {
    expect(newestFirst(items).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(items[0].id).toBe("a");
  });
});

describe("withConflictCopy", () => {
  it("keeps the server notes and appends the local copy", () => {
    expect(withConflictCopy("theirs", "mine")).toBe("theirs\n\n--- copy from another device ---\nmine");
  });
  it("adds nothing when the copies match or mine is blank", () => {
    expect(withConflictCopy("same", "same")).toBe("same");
    expect(withConflictCopy("theirs", "  ")).toBe("theirs");
  });
});
