import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";

const base = { hasSession: false, readToken: "s3cret", token: null as string | null };

describe("decideAccess", () => {
  it("lets anyone reach the login page and robots.txt", () => {
    expect(decideAccess({ ...base, pathname: "/login" })).toEqual({ type: "allow" });
    expect(decideAccess({ ...base, pathname: "/robots.txt" })).toEqual({ type: "allow" });
  });

  it("redirects a logged-out visitor on pages to /login", () => {
    for (const pathname of ["/", "/design", "/design/layout", "/r/orbkit", "/jobs", "/notepad"]) {
      expect(decideAccess({ ...base, pathname })).toEqual({ type: "redirect-login" });
    }
  });

  it("lets a logged-in visitor see pages", () => {
    expect(decideAccess({ ...base, hasSession: true, pathname: "/design" })).toEqual({ type: "allow" });
  });

  it("returns 401 on machine routes without a token", () => {
    for (const pathname of ["/llms.txt", "/api/refs.json", "/r/orbkit.md"]) {
      expect(decideAccess({ ...base, pathname })).toEqual({ type: "unauthorized" });
    }
  });

  it("returns 401 on machine routes with a wrong token", () => {
    expect(decideAccess({ ...base, pathname: "/llms.txt", token: "nope" })).toEqual({ type: "unauthorized" });
  });

  it("allows machine routes with the right token", () => {
    expect(decideAccess({ ...base, pathname: "/llms.txt", token: "s3cret" })).toEqual({ type: "allow" });
    expect(decideAccess({ ...base, pathname: "/r/orbkit.md", token: "s3cret" })).toEqual({ type: "allow" });
  });

  it("never accepts a token when none is configured", () => {
    expect(decideAccess({ ...base, readToken: "", pathname: "/llms.txt", token: "" })).toEqual({ type: "unauthorized" });
    expect(decideAccess({ ...base, readToken: undefined, pathname: "/llms.txt", token: "x" })).toEqual({ type: "unauthorized" });
  });

  it("ignores the token on normal pages", () => {
    expect(decideAccess({ ...base, pathname: "/design", token: "s3cret" })).toEqual({ type: "redirect-login" });
  });

  it("returns 401 (not a redirect) for other API routes without a session", () => {
    expect(decideAccess({ ...base, pathname: "/api/capture" })).toEqual({ type: "unauthorized" });
    expect(decideAccess({ ...base, pathname: "/api/capture", token: "s3cret" })).toEqual({ type: "unauthorized" });
  });

  it("lets a session reach machine routes", () => {
    expect(decideAccess({ ...base, hasSession: true, pathname: "/api/refs.json" })).toEqual({ type: "allow" });
  });
});
