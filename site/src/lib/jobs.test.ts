import { describe, expect, it } from "vitest";
import { countByStatus, isJobStatus, parseJobFields, parseJobFilter } from "./jobs";

describe("parseJobFields", () => {
  it("trims, blanks become null, and keeps a valid date", () => {
    expect(parseJobFields({ company: " Acme ", role: " Designer ", location: "", postedAt: "2026-03-04" })).toEqual({
      ok: true,
      value: { company: "Acme", role: "Designer", location: null, postedAt: "2026-03-04" },
    });
  });
  it("accepts a company with no role, and a role with no company", () => {
    expect(parseJobFields({ company: "Acme" })).toMatchObject({ ok: true });
    expect(parseJobFields({ role: "Designer" })).toMatchObject({ ok: true });
  });
  it("rejects an empty posting and a malformed date", () => {
    expect(parseJobFields({})).toMatchObject({ ok: false });
    expect(parseJobFields({ role: "x", postedAt: "04/03/2026" })).toMatchObject({ ok: false });
  });
  it("caps long text", () => {
    const r = parseJobFields({ role: "x".repeat(500) });
    expect(r.ok && r.value.role.length).toBe(200);
  });
});

describe("statuses", () => {
  it("knows the four statuses and ignores anything else in the filter", () => {
    expect(isJobStatus("applied")).toBe(true);
    expect(isJobStatus("rejected")).toBe(false);
    expect(parseJobFilter("closed")).toBe("closed");
    expect(parseJobFilter("nope")).toBeUndefined();
    expect(parseJobFilter(null)).toBeUndefined();
  });
  it("counts rows per status", () => {
    expect(countByStatus([{ status: "applied" }, { status: "applied" }, { status: "closed" }])).toEqual({ "to-apply": 0, applied: 2, interviewing: 0, closed: 1 });
  });
});
