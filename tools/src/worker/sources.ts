import { decodeEntities } from "@hub/capture";

/** WebVTT captions to plain text: no cues, tags or the rolling duplicates auto-captions repeat. */
export function parseVtt(vtt: string): string {
  const lines: string[] = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || /^(Kind|Language|NOTE|STYLE):?/i.test(line) || line.includes("-->") || /^\d+$/.test(line)) continue;
    const text = decodeEntities(line.replace(/<[^>]+>/g, "")).trim();
    if (text && text !== lines[lines.length - 1]) lines.push(text);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

type RedditInfo = {
  data?: {
    children?: {
      data?: {
        secure_media?: { reddit_video?: { fallback_url?: string } };
        media?: { reddit_video?: { fallback_url?: string } };
        preview?: { images?: { source?: { url?: string } }[]; reddit_video_preview?: { fallback_url?: string } };
        url_overridden_by_dest?: string;
        thumbnail?: string;
      };
    }[];
  };
};

/** The clip and image to use from Reddit's /api/info answer. */
export function redditMediaFromInfo(info: RedditInfo): { mediaUrl: string | null; posterUrl: string | null } | null {
  const post = info.data?.children?.[0]?.data;
  if (!post) return null;
  const clip = post.secure_media?.reddit_video?.fallback_url ?? post.media?.reddit_video?.fallback_url ?? post.preview?.reddit_video_preview?.fallback_url;
  const image = post.preview?.images?.[0]?.source?.url;
  const direct = post.url_overridden_by_dest;
  const directIsClip = direct && /\.(gif|mp4|webm)(\?|$)/i.test(direct) ? direct : null;
  return {
    mediaUrl: clip?.split("?")[0] ?? directIsClip,
    posterUrl: image ? decodeEntities(image) : post.thumbnail?.startsWith("http") ? post.thumbnail : null,
  };
}
