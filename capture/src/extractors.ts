import { cleanPostText, collapse, decodeEntities, parseMeta, stripTags, truncate } from "./html";
import { fetchJson, fetchOk, fetchText, type HttpOptions } from "./http";
import type { Normalised } from "./normalise";
import { CaptureError, type DraftError, type ErrorCode } from "./types";

/** What an extractor learns about a link. Draft fills in the shelf and kind. */
export type Extracted = {
  title: string;
  author: string | null;
  description: string;
  posterUrl: string | null;
  mediaUrl: string | null;
  /** Hints used for shelf and kind (e.g. "skill" in a repo's topics). */
  hints: string[];
  errors: DraftError[];
};

const empty = (): Extracted => ({ title: "", author: null, description: "", posterUrl: null, mediaUrl: null, hints: [], errors: [] });

export function toError(e: unknown): DraftError {
  if (e instanceof CaptureError) return { code: e.code, message: e.message };
  return { code: "failed" as ErrorCode, message: "Something went wrong reading that link." };
}

function postTitle(text: string): string {
  return truncate(cleanPostText(text), 90);
}

// ---------- X ----------

type FxMedia = { type?: string; url?: string; thumbnail_url?: string };
type FxTweet = { tweet?: { text?: string; author?: { name?: string; screen_name?: string }; media?: { all?: FxMedia[] } } };
type FxUser = { user?: { name?: string; screen_name?: string; description?: string; avatar_url?: string } };
type SyndicationTweet = {
  text?: string;
  user?: { name?: string; screen_name?: string };
  mediaDetails?: { type?: string; media_url_https?: string; video_info?: { variants?: { content_type?: string; bitrate?: number; url?: string }[] } }[];
};
type OEmbed = { author_name?: string; author_url?: string; html?: string; title?: string; thumbnail_url?: string };

/** The token the syndication endpoint expects (derived from the status id). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

async function xFromFxTwitter(user: string, id: string, http: HttpOptions): Promise<Extracted> {
  const data = await fetchJson<FxTweet>(`https://api.fxtwitter.com/${user}/status/${id}`, http);
  const t = data.tweet;
  if (!t?.text && !t?.author) throw new CaptureError("failed", "No post data.");
  const media = t.media?.all ?? [];
  const video = media.find((m) => m.type === "video" || m.type === "gif");
  const photo = media.find((m) => m.type === "photo");
  return {
    ...empty(),
    title: postTitle(t.text ?? ""),
    author: t.author?.screen_name ? `@${t.author.screen_name}` : null,
    description: cleanPostText(t.text ?? ""),
    posterUrl: video?.thumbnail_url ?? photo?.url ?? null,
    mediaUrl: video?.url ?? null,
  };
}

async function xFromSyndication(user: string, id: string, http: HttpOptions): Promise<Extracted> {
  const t = await fetchJson<SyndicationTweet>(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}`, http);
  if (!t.text && !t.user) throw new CaptureError("failed", "No post data.");
  const media = t.mediaDetails ?? [];
  const video = media.find((m) => m.type === "video" || m.type === "animated_gif");
  const best = (video?.video_info?.variants ?? [])
    .filter((v) => v.content_type === "video/mp4" && v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  return {
    ...empty(),
    title: postTitle(t.text ?? ""),
    author: `@${t.user?.screen_name ?? user}`,
    description: cleanPostText(t.text ?? ""),
    posterUrl: video?.media_url_https ?? media[0]?.media_url_https ?? null,
    mediaUrl: best?.url ?? null,
  };
}

async function xFromOEmbed(user: string, canonicalUrl: string, http: HttpOptions): Promise<Extracted> {
  const o = await fetchJson<OEmbed>(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(canonicalUrl)}`, http);
  const paragraph = o.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const text = cleanPostText(stripTags(paragraph));
  const handle = o.author_url?.split("/").filter(Boolean).pop() ?? user;
  return { ...empty(), title: postTitle(text), author: `@${handle}`, description: text };
}

export async function extractX(n: Normalised, http: HttpOptions): Promise<Extracted> {
  const [, user, , id] = new URL(n.canonicalUrl).pathname.split("/");
  const attempts: (() => Promise<Extracted>)[] = [
    () => xFromFxTwitter(user, id, http),
    () => xFromSyndication(user, id, http),
    () => xFromOEmbed(user, n.canonicalUrl, http),
  ];
  let last: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      last = e;
    }
  }
  return { ...empty(), title: `Post by @${user}`, author: `@${user}`, errors: [toError(last)] };
}

export async function extractXProfile(n: Normalised, http: HttpOptions): Promise<Extracted> {
  const user = new URL(n.canonicalUrl).pathname.split("/")[1];
  try {
    const data = await fetchJson<FxUser>(`https://api.fxtwitter.com/${user}`, http);
    const u = data.user;
    if (!u) throw new CaptureError("failed", "No profile data.");
    return {
      ...empty(),
      title: `@${u.screen_name ?? user}`,
      author: u.name ?? null,
      description: collapse(decodeEntities(u.description ?? "")),
      posterUrl: u.avatar_url?.replace("_normal", "_400x400") ?? null,
    };
  } catch (e) {
    return { ...empty(), title: `@${user}`, author: null, errors: [toError(e)] };
  }
}

// ---------- GitHub ----------

type GhRepo = { name?: string; full_name?: string; description?: string | null; owner?: { login?: string }; default_branch?: string; topics?: string[] };

const BADGE = /(shields\.io|badge|travis-ci|codecov|coveralls|github\.com\/[^/]+\/[^/]+\/workflows|sponsor|buymeacoffee|ko-fi|star-history|contrib\.rocks)/i;
const IMAGE_EXT = /\.(gif|png|jpe?g|webp|mp4|webm|mov)(\?|#|$)/i;

/** First meaningful image or clip in a README, resolved against the raw file host. */
export function firstReadmeMedia(markdown: string, owner: string, repo: string, branch: string): string | null {
  const found: { index: number; url: string }[] = [];
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) found.push({ index: m.index ?? 0, url: m[1] });
  for (const m of markdown.matchAll(/<(?:img|source|video)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) found.push({ index: m.index ?? 0, url: m[1] });
  found.sort((a, b) => a.index - b.index);

  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
  for (const { url } of found) {
    const raw = decodeEntities(url);
    if (BADGE.test(raw) || /\.svg(\?|#|$)/i.test(raw)) continue;
    let abs: string;
    try {
      const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//");
      abs = new URL(isAbsolute ? raw : raw.replace(/^\.?\//, ""), base).href;
    } catch {
      continue;
    }
    if (IMAGE_EXT.test(abs) || /github\.com\/user-attachments\//.test(abs)) return abs;
  }
  return null;
}

export async function extractGithub(n: Normalised, http: HttpOptions): Promise<Extracted> {
  const [owner, repo] = new URL(n.canonicalUrl).pathname.split("/").filter(Boolean);
  if (!repo) return extractOpenGraph(n, http);

  const ogImage = `https://opengraph.githubassets.com/1/${owner}/${repo}`;
  let info: GhRepo;
  try {
    info = await fetchJson<GhRepo>(`https://api.github.com/repos/${owner}/${repo}`, { ...http, headers: { accept: "application/vnd.github+json" } });
  } catch (e) {
    return { ...empty(), title: repo, author: owner, posterUrl: ogImage, errors: [toError(e)] };
  }

  const out: Extracted = {
    ...empty(),
    title: info.name ?? repo,
    author: info.owner?.login ?? owner,
    description: collapse(info.description ?? ""),
    posterUrl: ogImage,
    hints: [info.name ?? "", ...(info.topics ?? [])],
  };
  try {
    const readme = await fetchOk(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      ...http,
      headers: { accept: "application/vnd.github.raw+json" },
    });
    const media = firstReadmeMedia(readme.text, owner, repo, info.default_branch ?? "main");
    if (media) {
      if (/\.(gif|mp4|webm|mov)(\?|#|$)/i.test(media)) out.mediaUrl = media;
      out.posterUrl = media;
    }
    if (!out.description) {
      const line = readme.text.split("\n").map((l) => l.trim()).find((l) => l && !/^[#!<[>|`-]/.test(l));
      out.description = truncate(collapse(line ?? ""), 300);
    }
    out.hints.push(readme.text.slice(0, 800));
  } catch {
    // README is a bonus; the repo card still saves.
  }
  return out;
}

// ---------- YouTube ----------

export async function extractYoutube(n: Normalised, http: HttpOptions): Promise<Extracted> {
  const id = n.canonicalKey.replace(/^yt:/, "");
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try {
    const o = await fetchJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(n.canonicalUrl)}`, http);
    return { ...empty(), title: collapse(decodeEntities(o.title ?? "")), author: o.author_name ?? null, posterUrl: o.thumbnail_url ?? thumb };
  } catch (e) {
    return { ...empty(), title: "YouTube video", posterUrl: thumb, errors: [toError(e)] };
  }
}

// ---------- Open Graph (websites, Reddit, LinkedIn) ----------

const AUTHWALL_TITLE = /^(sign up|log ?in|join linkedin|linkedin: log in|just a moment|attention required|access denied)/i;

export async function extractOpenGraph(n: Normalised, http: HttpOptions): Promise<Extracted> {
  const fallbackTitle = new URL(n.canonicalUrl).hostname.replace(/^www\./, "");
  let res;
  try {
    res = await fetchText(n.canonicalUrl, http);
  } catch (e) {
    return { ...empty(), title: fallbackTitle, errors: [toError(e)] };
  }

  const wall = (code: ErrorCode, message: string): Extracted => ({ ...empty(), title: fallbackTitle, errors: [{ code, message }] });
  const authwallUrl = /\/(authwall|login|signin|uas\/login)\b/i.test(new URL(res.url).pathname);
  if (res.status === 404 || res.status === 410) return wall("not-found", "That link was not found.");
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999 || authwallUrl) {
    return wall(n.sourceType === "linkedin" || authwallUrl ? "authwall" : "blocked", "That page needs a login or blocked the preview. Paste a screenshot to use as the preview.");
  }
  if (res.status >= 400) return wall("failed", `The site answered ${res.status}.`);

  const meta = parseMeta(res.text, res.url);
  if (meta.title && AUTHWALL_TITLE.test(meta.title)) {
    return wall("authwall", "That page needs a login. Paste a screenshot to use as the preview.");
  }
  const out: Extracted = {
    ...empty(),
    title: meta.title ?? fallbackTitle,
    author: meta.siteName ?? null,
    description: truncate(meta.description ?? "", 400),
    posterUrl: meta.image ?? null,
    mediaUrl: meta.video && /\.(mp4|webm|mov)(\?|#|$)/i.test(meta.video) ? meta.video : null,
    hints: [meta.title ?? "", meta.description ?? ""],
  };
  if (!meta.title && !meta.description && !meta.image) out.errors.push({ code: "failed", message: "No preview information on that page." });
  return out;
}

export function extractVideoFile(n: Normalised): Extracted {
  const name = decodeURIComponent(new URL(n.canonicalUrl).pathname.split("/").pop() ?? "video");
  return { ...empty(), title: name, mediaUrl: n.canonicalUrl };
}
