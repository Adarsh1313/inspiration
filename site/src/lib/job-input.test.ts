import { describe, expect, it } from "vitest";
import { MAX_TEXT, jobIdentity, readJobInput } from "./job-input";

describe("readJobInput", () => {
  it("trims, ignores non-strings and caps the text", () => {
    expect(readJobInput({ url: " https://a.com/x ", text: " hi " })).toEqual({ url: "https://a.com/x", text: "hi" });
    expect(readJobInput({ url: 5, text: null })).toEqual({ url: "", text: "" });
    expect(readJobInput(null)).toEqual({ url: "", text: "" });
    expect(readJobInput({ text: "x".repeat(MAX_TEXT + 50) }).text).toHaveLength(MAX_TEXT);
  });
});

describe("jobIdentity", () => {
  it("prefers the link, then the text, then the screenshot", () => {
    const withLink = jobIdentity({ url: "https://www.linkedin.com/jobs/view/3912345678", text: "t" });
    expect(withLink?.key).toBe("job:linkedin:3912345678");
    expect(withLink?.link?.canonicalUrl).toBe("https://www.linkedin.com/jobs/view/3912345678");
    expect(jobIdentity({ url: "", text: "Designer" })?.key).toMatch(/^job:text:/);
    expect(jobIdentity({ url: "", text: "", image: new Uint8Array([1, 2]) })?.key).toMatch(/^job:text:/);
  });
  it("returns null when there is nothing to key on, and throws on an unsafe link", () => {
    expect(jobIdentity({ url: "", text: "" })).toBeNull();
    expect(() => jobIdentity({ url: "http://localhost/x", text: "" })).toThrow();
  });
  it("gives the same key to the same text", () => {
    expect(jobIdentity({ url: "", text: "A" })?.key).toBe(jobIdentity({ url: "", text: "A" })?.key);
  });
});
