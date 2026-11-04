const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", times: "×",
};

/** Decodes named and numeric (decimal and hex) HTML entities. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

/** Drops t.co links and collapses whitespace; used for X post text. */
export function cleanPostText(text: string): string {
  return collapse(decodeEntities(text).replace(/https?:\/\/t\.co\/\w+/g, ""));
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  siteName?: string;
  canonical?: string;
};

/** Reads Open Graph / Twitter / plain meta tags from the head of an HTML page. */
export function parseMeta(html: string, baseUrl: string): PageMeta {
  const head = html.slice(0, 200_000);
  const meta = new Map<string, string>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? "").toLowerCase();
    if (key && a.content && !meta.has(key)) meta.set(key, a.content);
  }
  let canonical: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.rel?.toLowerCase() === "canonical" && a.href) canonical = a.href;
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const abs = (u?: string) => {
    if (!u) return undefined;
    try {
      return new URL(u, baseUrl).href;
    } catch {
      return undefined;
    }
  };
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find(Boolean);

  return {
    title: collapse(pick("og:title", "twitter:title") ?? (titleTag ? decodeEntities(titleTag) : "")) || undefined,
    description: collapse(pick("og:description", "twitter:description", "description") ?? "") || undefined,
    image: abs(pick("og:image", "og:image:url", "twitter:image", "twitter:image:src")),
    video: abs(pick("og:video:secure_url", "og:video:url", "og:video")),
    siteName: pick("og:site_name"),
    canonical: abs(canonical ?? meta.get("og:url")),
  };
}
