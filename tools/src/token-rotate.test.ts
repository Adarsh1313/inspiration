import { describe, expect, it } from "vitest";
import { newToken, setEnvLine } from "./token-rotate";

describe("setEnvLine", () => {
  it("replaces an existing value and leaves other lines alone", () => {
    expect(setEnvLine("A=1\nHUB_READ_TOKEN=old\nB=2\n", "HUB_READ_TOKEN", "new")).toBe("A=1\nHUB_READ_TOKEN=new\nB=2\n");
  });

  it("appends when the key is missing, even if the file has no trailing newline", () => {
    expect(setEnvLine("A=1", "HUB_READ_TOKEN", "t")).toBe("A=1\nHUB_READ_TOKEN=t\n");
    expect(setEnvLine("", "HUB_READ_TOKEN", "t")).toBe("HUB_READ_TOKEN=t\n");
  });

  it("does not treat $ in a value as a replacement pattern", () => {
    expect(setEnvLine("HUB_READ_TOKEN=a\n", "HUB_READ_TOKEN", "x$&y")).toBe("HUB_READ_TOKEN=x$&y\n");
  });
});

describe("newToken", () => {
  it("is long, url-safe and different each time", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newToken()).not.toBe(a);
  });
});
