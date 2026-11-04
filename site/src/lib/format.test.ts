import { describe, expect, it } from "vitest";
import { capitalise, formatDate } from "./format";

describe("formatDate", () => {
  it("formats date-only and timestamp values the same way", () => {
    expect(formatDate("2026-03-04")).toBe("4 Mar 2026");
    expect(formatDate("2026-03-04T10:00:00")).toBe("4 Mar 2026");
  });
  it("returns null for missing or junk values", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("soon")).toBeNull();
  });
});

describe("capitalise", () => {
  it("uppercases the first letter only", () => {
    expect(capitalise("variance")).toBe("Variance");
    expect(capitalise("")).toBe("");
  });
});
