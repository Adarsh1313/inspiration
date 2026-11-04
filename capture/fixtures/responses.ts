// Recorded-shape responses for each source and fallback path. No network in tests.

export type Route = { status?: number; body?: string; json?: unknown; headers?: Record<string, string>; throws?: "abort" | "network"; delayMs?: number };

export function fakeFetch(routes: Record<string, Route>, log: string[] = []) {
  return async (input: string, init?: { signal?: AbortSignal }): Promise<Response> => {
    log.push(input);
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((k) => input.startsWith(k));
    if (!key) throw new Error(`unexpected request: ${input}`);
    const r = routes[key];
    if (r.throws === "network") throw new TypeError("fetch failed");
    if (r.throws === "abort" || r.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, r.delayMs ?? 60_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    const body = r.json !== undefined ? JSON.stringify(r.json) : (r.body ?? "");
    return new Response(body, { status: r.status ?? 200, headers: r.headers });
  };
}

export const X_ID = "2107492125827039596";
export const X_URL = `https://x.com/DopeOblivion/status/${X_ID}`;

export const fxTweetVideo = {
  code: 200,
  tweet: {
    text: "Pre-loader animation &amp; counter https://t.co/AbC123 built in one afternoon",
    author: { name: "Dope", screen_name: "DopeOblivion" },
    media: { all: [{ type: "video", url: "https://video.twimg.com/ext_tw_video/1/vid/avc1/1280x720/clip.mp4", thumbnail_url: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/thumb.jpg" }] },
  },
};

export const syndicationTweet = {
  text: "Pre-loader animation https://t.co/AbC123",
  user: { name: "Dope", screen_name: "DopeOblivion" },
  mediaDetails: [
    {
      type: "video",
      media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/thumb.jpg",
      video_info: {
        variants: [
          { content_type: "application/x-mpegURL", url: "https://video.twimg.com/playlist.m3u8" },
          { content_type: "video/mp4", bitrate: 832000, url: "https://video.twimg.com/low.mp4" },
          { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" },
        ],
      },
    },
  ],
};

export const oembedTweet = {
  author_name: "Dope",
  author_url: "https://twitter.com/DopeOblivion",
  html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Pre-loader animation &amp; counter <a href="https://t.co/AbC123">pic.twitter.com/AbC123</a></p>&mdash; Dope (@DopeOblivion) <a href="https://twitter.com/DopeOblivion/status/1">May 1</a></blockquote>',
};

export const fxUser = { code: 200, user: { name: "Shawn", screen_name: "zzzzshawn", description: "Building  Orbkit &amp; Dotmatrix", avatar_url: "https://pbs.twimg.com/profile_images/1/me_normal.jpg" } };

export const ghRepoSkill = {
  name: "skills",
  full_name: "benjitaylor/skills",
  description: "Skills for agents to design product UIs and animated demos",
  owner: { login: "benjitaylor" },
  default_branch: "main",
  topics: ["claude-code", "agent-skills"],
};

export const ghReadme = `# Skills

[![build](https://img.shields.io/github/actions/workflow/status/a/b/ci.yml)](https://github.com/a/b/actions)

![demo](./assets/demo.gif)

Some text.

<img src="docs/other.png" />
`;

export const ghRepoPlain = { name: "diorama", description: null, owner: { login: "sloemo01" }, default_branch: "master", topics: ["threejs"] };
export const ghReadmePlain = `# Diorama\n\nPixel-art diorama scenes in Three.js\n\n<p align="center"><img src="https://github.com/user-attachments/assets/abc-123" width="600"></p>\n`;

export const ytOembed = {
  title: "Stop creating zombie UIs &amp; start shipping",
  author_name: "Config",
  thumbnail_url: "https://i.ytimg.com/vi/GLvFTMtw4Jk/hqdefault.jpg",
};

export const siteHtml = `<!doctype html><html><head>
<title>Land-book | Landing page inspiration</title>
<meta property="og:title" content="Land-book &#8211; Landing Pages">
<meta property="og:description" content="Gallery of the best landing page design &amp; inspiration">
<meta property="og:image" content="/img/og.png">
<meta property="og:site_name" content="Land-book">
</head><body>hi</body></html>`;

export const linkedinWallHtml = `<html><head><title>Sign Up | LinkedIn</title><meta property="og:title" content="Sign Up | LinkedIn"></head></html>`;
