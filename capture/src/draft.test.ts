import { describe, expect, it } from "vitest";
import * as fx from "../fixtures/responses";
import { fakeFetch, type Route } from "../fixtures/responses";
import { draft, planSteps } from "./draft";
import { firstReadmeMedia, syndicationToken } from "./extractors";

const run = (url: string, routes: Record<string, Route>, extra: object = {}) => draft(url, { fetch: fakeFetch(routes), ...extra });
const down: Route = { status: 500, body: "boom" };

describe("draft: X", () => {
  it("reads title, author, poster and clip from FxTwitter", async () => {
    const d = await run(fx.X_URL, { "https://api.fxtwitter.com/": { json: fx.fxTweetVideo } });
    expect(d).toMatchObject({
      sourceType: "x-post",
      canonicalKey: `x:${fx.X_ID}`,
      title: "Pre-loader animation & counter built in one afternoon",
      author: "@DopeOblivion",
      posterUrl: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/thumb.jpg",
      mediaUrl: "https://video.twimg.com/ext_tw_video/1/vid/avc1/1280x720/clip.mp4",
      suggestedShelf: "motion-interactions",
      kind: "animation",
      errors: [],
    });
  });

  it("falls back to syndication and picks the highest-bitrate mp4", async () => {
    const log: string[] = [];
    const d = await draft(fx.X_URL, {
      fetch: fakeFetch({ "https://api.fxtwitter.com/": down, "https://cdn.syndication.twimg.com/": { json: fx.syndicationTweet } }, log),
    });
    expect(d.mediaUrl).toBe("https://video.twimg.com/high.mp4");
    expect(d.author).toBe("@DopeOblivion");
    expect(d.errors).toEqual([]);
    expect(log[1]).toContain(`id=${fx.X_ID}&token=${syndicationToken(fx.X_ID)}`);
  });

  it("falls back to oEmbed text when both JSON endpoints are down", async () => {
    const d = await run(fx.X_URL, {
      "https://api.fxtwitter.com/": down,
      "https://cdn.syndication.twimg.com/": down,
      "https://publish.twitter.com/oembed": { json: fx.oembedTweet },
    });
    expect(d.title).toBe("Pre-loader animation & counter pic.twitter.com/AbC123");
    expect(d.author).toBe("@DopeOblivion");
    expect(d.mediaUrl).toBeNull();
    expect(d.kind).toBe("layout");
    expect(d.errors).toEqual([]);
  });

  it("still returns a savable draft with an error when every layer fails", async () => {
    const d = await run(fx.X_URL, {
      "https://api.fxtwitter.com/": down,
      "https://cdn.syndication.twimg.com/": down,
      "https://publish.twitter.com/oembed": { status: 403 },
    });
    expect(d.title).toBe("Post by @DopeOblivion");
    expect(d.errors).toHaveLength(1);
    expect(d.errors[0].code).toBe("blocked");
  });

  it("makes a person card from a profile link", async () => {
    const d = await run("https://twitter.com/zzzzshawn", { "https://api.fxtwitter.com/zzzzshawn": { json: fx.fxUser } });
    expect(d).toMatchObject({ kind: "person", suggestedShelf: "talks-people", title: "@zzzzshawn", description: "Building Orbkit & Dotmatrix" });
    expect(d.posterUrl).toBe("https://pbs.twimg.com/profile_images/1/me_400x400.jpg");
    expect(planSteps(d.sourceType, d)).toEqual(["poster"]);
  });
});

describe("draft: GitHub", () => {
  const routes = (repo: object, readme: Route): Record<string, Route> => ({
    "https://api.github.com/repos/benjitaylor/skills/readme": readme,
    "https://api.github.com/repos/benjitaylor/skills": { json: repo },
    "https://api.github.com/repos/sloemo01/diorama/readme": readme,
    "https://api.github.com/repos/sloemo01/diorama": { json: repo },
  });

  it("takes the first README GIF, skipping badges, and flags skills", async () => {
    const d = await run("https://github.com/benjitaylor/skills", routes(fx.ghRepoSkill, { body: fx.ghReadme }));
    expect(d).toMatchObject({
      title: "skills",
      author: "benjitaylor",
      mediaUrl: "https://raw.githubusercontent.com/benjitaylor/skills/main/assets/demo.gif",
      posterUrl: "https://raw.githubusercontent.com/benjitaylor/skills/main/assets/demo.gif",
      suggestedShelf: "agent-skills",
      kind: "skill",
    });
    expect(planSteps(d.sourceType, d)).toEqual(["download", "poster", "preview"]);
  });

  it("uses the first sentence of the README when the repo has no description, and an attachment image as poster", async () => {
    const d = await run("https://github.com/sloemo01/diorama", routes(fx.ghRepoPlain, { body: fx.ghReadmePlain }));
    expect(d.description).toBe("Pixel-art diorama scenes in Three.js");
    expect(d.posterUrl).toBe("https://github.com/user-attachments/assets/abc-123");
    expect(d.mediaUrl).toBeNull();
    expect(d.suggestedShelf).toBe("tools-directories");
  });

  it("falls back to the GitHub social image when the README has no media", async () => {
    const d = await run("https://github.com/sloemo01/diorama", routes(fx.ghRepoPlain, { body: "# Diorama\n\nJust text" }));
    expect(d.posterUrl).toBe("https://opengraph.githubassets.com/1/sloemo01/diorama");
  });

  it("returns an error but keeps the social image when the repo is missing", async () => {
    const d = await run("https://github.com/nobody/nothing", { "https://api.github.com/": { status: 404 } });
    expect(d.errors[0].code).toBe("not-found");
    expect(d.posterUrl).toBe("https://opengraph.githubassets.com/1/nobody/nothing");
  });

  it("resolves relative and root-relative README paths", () => {
    expect(firstReadmeMedia("![x](/img/a.png)", "o", "r", "main")).toBe("https://raw.githubusercontent.com/o/r/main/img/a.png");
    expect(firstReadmeMedia('<img src="a/b.webp">', "o", "r", "dev")).toBe("https://raw.githubusercontent.com/o/r/dev/a/b.webp");
    expect(firstReadmeMedia("![b](https://img.shields.io/x.svg) ![l](logo.svg)", "o", "r", "main")).toBeNull();
  });
});

describe("draft: YouTube", () => {
  it("uses oEmbed and decodes entities", async () => {
    const d = await run("https://youtu.be/GLvFTMtw4Jk?si=abc", { "https://www.youtube.com/oembed": { json: fx.ytOembed } });
    expect(d).toMatchObject({
      title: "Stop creating zombie UIs & start shipping",
      author: "Config",
      kind: "talk",
      suggestedShelf: "talks-people",
      canonicalUrl: "https://www.youtube.com/watch?v=GLvFTMtw4Jk",
    });
    expect(planSteps(d.sourceType, d)).toEqual(["poster", "transcript"]);
  });

  it("still gives a thumbnail when oEmbed fails", async () => {
    const d = await run("https://youtu.be/GLvFTMtw4Jk", { "https://www.youtube.com/oembed": { status: 401 } });
    expect(d.posterUrl).toBe("https://i.ytimg.com/vi/GLvFTMtw4Jk/hqdefault.jpg");
    expect(d.errors[0].code).toBe("blocked");
  });
});

describe("draft: Open Graph sources", () => {
  it("reads a website's meta tags, decodes entities and resolves the image", async () => {
    const d = await run("http://land-book.com", { "http://land-book.com/": { body: fx.siteHtml, headers: { "content-type": "text/html" } } });
    expect(d).toMatchObject({
      sourceType: "site",
      title: "Land-book – Landing Pages",
      description: "Gallery of the best landing page design & inspiration",
      posterUrl: "http://land-book.com/img/og.png",
      author: "Land-book",
      errors: [],
    });
    expect(planSteps(d.sourceType, d)).toEqual(["screenshot", "poster"]);
  });

  it("reports an authwall for LinkedIn but keeps the link", async () => {
    const d = await run("https://www.linkedin.com/posts/someone_x-1", { "https://www.linkedin.com/": { body: fx.linkedinWallHtml } });
    expect(d.errors[0].code).toBe("authwall");
    expect(d.sourceType).toBe("linkedin");
    expect(d.title).toBe("linkedin.com");
  });

  it("reports an authwall when LinkedIn redirects to its login page", async () => {
    const d = await run("https://www.linkedin.com/posts/someone_x-1", {
      "https://www.linkedin.com/posts/": { status: 302, headers: { location: "https://www.linkedin.com/authwall?trk=x" } },
      "https://www.linkedin.com/authwall": { body: "<html></html>" },
    });
    expect(d.errors[0].code).toBe("authwall");
  });

  it("reports blocked for a 403 on Reddit", async () => {
    const d = await run("https://www.reddit.com/r/webdev/comments/1abc2d/x/", { "https://www.reddit.com/": { status: 403 } });
    expect(d.errors[0].code).toBe("blocked");
    expect(d.sourceType).toBe("reddit");
  });

  it("follows a redirect to the final page", async () => {
    const d = await run("http://old.example.com", {
      "http://old.example.com/": { status: 301, headers: { location: "https://new.example.com/home" } },
      "https://new.example.com/home": { body: fx.siteHtml },
    });
    expect(d.title).toBe("Land-book – Landing Pages");
  });

  it("times out slow sites with an inline error", async () => {
    const d = await run("https://slow.example.com", { "https://slow.example.com/": { throws: "abort" } }, { timeoutMs: 30 });
    expect(d.errors[0].code).toBe("timeout");
  });

  it("refuses oversize responses", async () => {
    const d = await run("https://big.example.com", { "https://big.example.com/": { body: "x".repeat(2000) } }, { maxBytes: 1000 });
    expect(d.errors[0].code).toBe("oversize");
  });

  it("reports network failure", async () => {
    const d = await run("https://down.example.com", { "https://down.example.com/": { throws: "network" } });
    expect(d.errors[0].code).toBe("failed");
  });
});

describe("draft: SSRF", () => {
  it("refuses private URLs outright, without any request", async () => {
    const log: string[] = [];
    await expect(draft("http://169.254.169.254/latest", { fetch: fakeFetch({}, log) })).rejects.toMatchObject({ code: "unsafe-url" });
    expect(log).toEqual([]);
  });

  it("does not follow a redirect into a private address", async () => {
    const log: string[] = [];
    const d = await draft("https://evil.example.com/go", {
      fetch: fakeFetch({ "https://evil.example.com/": { status: 302, headers: { location: "http://127.0.0.1:80/admin" } } }, log),
    });
    expect(d.errors[0].code).toBe("unsafe-url");
    expect(log).toEqual(["https://evil.example.com/go"]);
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const log: string[] = [];
    const d = await draft("https://rebind.example.com", {
      fetch: fakeFetch({ "https://rebind.example.com/": { body: fx.siteHtml } }, log),
      resolveHost: async () => ["10.1.2.3"],
    });
    expect(d.errors[0].code).toBe("unsafe-url");
    expect(log).toEqual([]);
  });
});
