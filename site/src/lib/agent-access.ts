// Pure helpers for the machine routes: /llms.txt, /r/<slug>.md and /api/refs.json.
import { SHELVES, type MirrorCard } from "@hub/capture";

/** A card as the machine routes see it (a MirrorCard plus the fields JSON and JSON-LD need). */
export type AgentCard = MirrorCard & {
  author: string | null;
  description: string | null;
  added_at: string;
  media_status: "pending" | "ready" | "failed";
};

export type RefsQuery = { shelf?: string; kind?: string; tag?: string; status?: string };

export type RefSummary = {
  slug: string;
  title: string;
  kind: string;
  shelf: string;
  status: string;
  tags: string[];
  mood: MirrorCard["mood"];
  summary: string | null;
  source_url: string | null;
  url: string;
  md_url: string;
};

/** Which token the caller used, so links in the output keep working for them. */
export type LinkContext = { baseUrl: string; queryToken?: string | null };

function withToken(url: string, token?: string | null): string {
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

export const cardUrl = (c: { slug: string }, ctx: LinkContext) => withToken(`${ctx.baseUrl}/r/${c.slug}`, ctx.queryToken);
export const cardMdUrl = (c: { slug: string }, ctx: LinkContext) => withToken(`${ctx.baseUrl}/r/${c.slug}.md`, ctx.queryToken);

export function parseRefsQuery(params: URLSearchParams): RefsQuery {
  const get = (k: string) => params.get(k)?.trim().toLowerCase() || undefined;
  return { shelf: get("shelf"), kind: get("kind"), tag: get("tag"), status: get("status") };
}

/** Filters cards. With no `status`, only active cards are returned (drafts and archived stay hidden from agents). */
export function filterRefs(cards: AgentCard[], q: RefsQuery): AgentCard[] {
  const status = q.status ?? "active";
  return cards
    .filter((c) => (status === "all" ? true : c.status === status))
    .filter((c) => !q.shelf || c.shelf === q.shelf)
    .filter((c) => !q.kind || c.kind === q.kind)
    .filter((c) => !q.tag || c.tags.some((t) => t.toLowerCase() === q.tag))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.slug.localeCompare(b.slug));
}

export function toRefSummary(c: AgentCard, ctx: LinkContext): RefSummary {
  return {
    slug: c.slug,
    title: c.title,
    kind: c.kind,
    shelf: c.shelf,
    status: c.status,
    tags: c.tags,
    mood: c.mood,
    summary: c.summary,
    source_url: c.source_url,
    url: cardUrl(c, ctx),
    md_url: cardMdUrl(c, ctx),
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The /llms.txt body: a hub summary, then one line and link per active card. */
export function renderLlmsTxt(cards: AgentCard[], ctx: LinkContext): string {
  const active = filterRefs(cards, {});
  const lines = [
    "# inspiration",
    "",
    "> Adarsh's private library of design references: motion clips, layouts, components, skills and the people behind them. Read-only for agents.",
    "",
    "Each card has a markdown page (`/r/<slug>.md`). `/api/refs.json` lists cards as JSON and accepts `shelf`, `kind`, `tag` and `status` filters.",
    "Mood dials are variance, motion and density, each 1 to 10. Cards are references to learn from, not templates to copy.",
    "",
    `Shelves: ${SHELVES.join(", ")}.`,
  ];
  for (const shelf of SHELVES) {
    const inShelf = active.filter((c) => c.shelf === shelf);
    if (inShelf.length === 0) continue;
    lines.push("", `## ${shelf}`, "");
    for (const c of inShelf) {
      const blurb = oneLine(c.summary ?? "");
      lines.push(`- [${oneLine(c.title) || c.slug}](${cardMdUrl(c, ctx)})${c.kind ? ` (${c.kind})` : ""}${blurb ? `: ${blurb}` : ""}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** schema.org JSON-LD for the card page: VideoObject when the card has a clip, otherwise CreativeWork. */
export function cardJsonLd(c: AgentCard, ctx: LinkContext): Record<string, unknown> {
  const video = !!c.preview;
  return {
    "@context": "https://schema.org",
    "@type": video ? "VideoObject" : "CreativeWork",
    name: c.title,
    description: c.summary ?? c.description ?? undefined,
    url: cardUrl(c, ctx),
    sameAs: c.source_url ?? undefined,
    keywords: c.tags.length ? c.tags.join(", ") : undefined,
    author: c.author ? { "@type": "Person", name: c.author } : undefined,
    dateCreated: c.added_at,
    ...(video ? { uploadDate: c.added_at, transcript: c.video_description ?? undefined } : {}),
  };
}

/** JSON-LD is embedded in a script tag, so `<` must not appear raw. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
