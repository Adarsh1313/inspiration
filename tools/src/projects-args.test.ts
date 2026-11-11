import { describe, expect, it } from "vitest";
import { parseArgs, parseIssues } from "./projects-args";

describe("parseArgs", () => {
  it("splits flags from positionals", () => {
    expect(parseArgs(["a", "--name", "X Y", "b", "--repo", "o/n"])).toEqual({ positional: ["a", "b"], flags: { name: "X Y", repo: "o/n" } });
  });
  it("rejects a flag with no value", () => {
    expect(() => parseArgs(["--name"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--name", "--repo", "x"])).toThrow(/needs a value/);
  });
});

describe("parseIssues", () => {
  it("accepts issue links", () => {
    expect(parseIssues('[{"number":3,"title":"t","url":"u"}]')).toEqual([{ number: 3, title: "t", url: "u" }]);
  });
  it("rejects bad input", () => {
    expect(() => parseIssues("nope")).toThrow(/valid JSON/);
    expect(() => parseIssues("{}")).toThrow(/array/);
    expect(() => parseIssues('[{"number":"3"}]')).toThrow(/number, title and url/);
  });
});
