import { assertPublicUrl } from "./ssrf";
import { CaptureError, type SourceType } from "./types";

export type Normalised = {
  canonicalUrl: string;
  /** Unique per reference. Two URL variants of the same thing share a key. */
  canonicalKey: string;
  sourceType: SourceType;
};

const X_HOSTS = new Set(["x.com", "twitter.com", "fxtwitter.com", "vxtwitter.com", "fixupx.com", "fixvx.com"]);
const YT_HOSTS = new Set(["youtube.com", "youtube-nocookie.com", "music.youtube.com"]);
const X_RESERVED = new Set(["home", "explore", "search", "i", "intent", "share", "settings", "messages", "notifications", "login", "compose", "hashtag"]);
const TRACKING = /^(utm_.*|mc_.*|fbclid|gclid|igshid|si|feature|ref|ref_src|ref_url|s|t)$/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)$/i;

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

function normaliseX(segments: string[]): Normalised | null {
  const [user, kind, id] = segments;
  if (!user || X_RESERVED.has(user.toLowerCase())) return null;
  if (kind === "status" && /^\d+$/.test(id ?? "")) {
    return { canonicalUrl: `https://x.com/${user}/status/${id}`, canonicalKey: `x:${id}`, sourceType: "x-post" };
  }
  if (segments.length === 1) {
    return { canonicalUrl: `https://x.com/${user}`, canonicalKey: `x-user:${user.toLowerCase()}`, sourceType: "x-post" };
  }
  return null;
}

function youtubeId(host: string, segments: string[], params: URLSearchParams): string | null {
  let id: string | null = null;
  if (host === "youtu.be") id = segments[0] ?? null;
  else if (YT_HOSTS.has(host)) {
    if (segments[0] === "watch") id = params.get("v");
    else if (["shorts", "embed", "live", "v"].includes(segments[0])) id = segments[1] ?? null;
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

/** Generic URL: strip tracking, drop the fragment, sort params, drop trailing slash. */
function normaliseGeneric(url: URL, host: string, sourceType: SourceType): Normalised {
  const params = new URLSearchParams();
  [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => params.append(k, v));
  const path = url.pathname.replace(/\/+$/, "");
  const query = params.toString();
  const rest = `${path}${query ? `?${query}` : ""}`;
  return {
    canonicalUrl: `${url.protocol}//${host}${rest}`,
    canonicalKey: `${sourceType === "site" ? "site" : sourceType}:${host}${rest}`,
    sourceType,
  };
}

/** Canonicalises a pasted URL and detects its source. Throws CaptureError for anything not a public http(s) link. */
export function normalise(raw: string): Normalised {
  let input = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = `https://${input}`;
  const url = assertPublicUrl(input);
  const host = bareHost(url.hostname);
  const segments = url.pathname.split("/").filter(Boolean);

  if (X_HOSTS.has(host) || host === "mobile.twitter.com") {
    const x = normaliseX(segments);
    if (x) return x;
  }

  const yt = youtubeId(host, segments, url.searchParams);
  if (yt) return { canonicalUrl: `https://www.youtube.com/watch?v=${yt}`, canonicalKey: `yt:${yt}`, sourceType: "youtube" };

  if (host === "github.com" && segments.length >= 1) {
    const [owner, repo] = segments;
    const name = repo ? `${owner}/${repo.replace(/\.git$/, "")}` : owner;
    return { canonicalUrl: `https://github.com/${name}`, canonicalKey: `gh:${name.toLowerCase()}`, sourceType: "github" };
  }

  if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it") {
    const post = host === "redd.it" ? segments[0] : segments[segments.indexOf("comments") + 1];
    if (post && /^[a-z0-9]+$/i.test(post) && (host === "redd.it" || segments.includes("comments"))) {
      const sub = segments[0] === "r" ? `/r/${segments[1]}` : "";
      const canonicalUrl = host === "redd.it" ? `https://redd.it/${post}` : `https://www.reddit.com${sub}/comments/${post}`;
      return { canonicalUrl, canonicalKey: `reddit:${post.toLowerCase()}`, sourceType: "reddit" };
    }
    return normaliseGeneric(url, "reddit.com", "reddit");
  }

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return normaliseGeneric(url, "www.linkedin.com", "linkedin");
  if (VIDEO_FILE.test(url.pathname)) return normaliseGeneric(url, host, "video");
  return normaliseGeneric(url, host, "site");
}

export function isCaptureError(e: unknown): e is CaptureError {
  return e instanceof CaptureError;
}
