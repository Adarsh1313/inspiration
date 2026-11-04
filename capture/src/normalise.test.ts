import { describe, expect, it } from "vitest";
import { normalise } from "./normalise";

describe("normalise", () => {
  it("unifies X variants onto one canonical URL and status-id key", () => {
    const variants = [
      "https://twitter.com/DopeOblivion/status/2107492125827039596?s=20&t=abc",
      "https://x.com/DopeOblivion/status/2107492125827039596",
      "https://fxtwitter.com/DopeOblivion/status/2107492125827039596",
      "https://mobile.twitter.com/DopeOblivion/status/2107492125827039596/",
      "https://vxtwitter.com/DopeOblivion/status/2107492125827039596?utm_source=x",
    ].map(normalise);
    for (const v of variants) {
      expect(v.canonicalUrl).toBe("https://x.com/DopeOblivion/status/2107492125827039596");
      expect(v.canonicalKey).toBe("x:2107492125827039596");
      expect(v.sourceType).toBe("x-post");
    }
  });

  it("treats an X profile as its own reference", () => {
    expect(normalise("https://x.com/zzzzshawn")).toEqual({
      canonicalUrl: "https://x.com/zzzzshawn",
      canonicalKey: "x-user:zzzzshawn",
      sourceType: "x-post",
    });
  });

  it("unifies YouTube variants onto the video id", () => {
    const ids = [
      "https://youtu.be/GLvFTMtw4Jk?si=xyz",
      "https://www.youtube.com/watch?v=GLvFTMtw4Jk&feature=share&t=30",
      "https://m.youtube.com/shorts/GLvFTMtw4Jk",
      "https://www.youtube.com/embed/GLvFTMtw4Jk",
    ].map(normalise);
    for (const v of ids) {
      expect(v.canonicalUrl).toBe("https://www.youtube.com/watch?v=GLvFTMtw4Jk");
      expect(v.canonicalKey).toBe("yt:GLvFTMtw4Jk");
      expect(v.sourceType).toBe("youtube");
    }
  });

  it("keys GitHub by lowercase owner/repo and ignores deep paths", () => {
    const r = normalise("https://www.github.com/BenjiTaylor/Skills/tree/main/docs?utm_source=x");
    expect(r).toEqual({ canonicalUrl: "https://github.com/BenjiTaylor/Skills", canonicalKey: "gh:benjitaylor/skills", sourceType: "github" });
  });

  it("keys Reddit by post id", () => {
    const r = normalise("https://old.reddit.com/r/webdev/comments/1abc2d/some_title/?utm_name=x");
    expect(r.canonicalKey).toBe("reddit:1abc2d");
    expect(r.sourceType).toBe("reddit");
  });

  it("strips tracking params, fragment and trailing slash on websites, and sorts params", () => {
    const r = normalise("http://www.Land-book.com/gallery/?b=2&utm_campaign=x&a=1&fbclid=zzz#top");
    expect(r.canonicalUrl).toBe("http://land-book.com/gallery?a=1&b=2");
    expect(r.canonicalKey).toBe("site:land-book.com/gallery?a=1&b=2");
    expect(r.sourceType).toBe("site");
  });

  it("gives http and https the same site key", () => {
    expect(normalise("http://60fps.design").canonicalKey).toBe(normalise("https://60fps.design/").canonicalKey);
  });

  it("keeps meaningful query params like the Oversight free filter", () => {
    expect(normalise("https://supply.madebyoversight.com/sections?price=free#library").canonicalUrl).toBe(
      "https://supply.madebyoversight.com/sections?price=free",
    );
  });

  it("detects LinkedIn and direct video files", () => {
    expect(normalise("https://www.linkedin.com/posts/someone_x-activity-1/").sourceType).toBe("linkedin");
    expect(normalise("https://cdn.example.com/clip.mp4").sourceType).toBe("video");
  });

  it("does not mistake look-alike hosts for X or YouTube", () => {
    expect(normalise("https://notx.com/a/status/123").sourceType).toBe("site");
    expect(normalise("https://notyoutube.com/watch?v=GLvFTMtw4Jk").sourceType).toBe("site");
  });

  it("adds https when the scheme is missing", () => {
    expect(normalise("hairline.lucasmarkes.com/figures").canonicalUrl).toBe("https://hairline.lucasmarkes.com/figures");
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "http://localhost:3000/x",
    "http://127.0.0.1/x",
    "http://2130706433/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
    "http://user:pw@example.com/",
    "http://example.com:8080/",
    "http://intranet/",
    "not a url",
  ])("refuses %s", (bad) => {
    expect(() => normalise(bad)).toThrow();
  });
});
