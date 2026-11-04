import { planSteps } from "./draft";
import type { CaptureStep, Draft, Kind, Shelf } from "./types";

/** What Adarsh can change on the preview before saving. */
export type SaveOverrides = { title?: string; description?: string; shelf?: Shelf; kind?: Kind };

export function slugify(text: string, max = 48): string {
  const base = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return base || "card";
}

/** `base`, then `base-2`, `base-3`... skipping slugs that already exist. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export type NewCard = {
  slug: string;
  canonical_key: string;
  source_url: string;
  source_type: string;
  title: string;
  author: string | null;
  description: string;
  kind: Kind;
  shelf: Shelf;
  status: "draft";
  media_status: "pending" | "ready";
  needs_review: boolean;
};

export type NewCardInput = {
  draft: Draft;
  overrides?: SaveOverrides;
  slug: string;
  /** True when a pasted image is the preview, so no media work is queued. */
  hasImage?: boolean;
  needsReview?: boolean;
};

/** The row to insert for a saved draft, plus the worker steps to queue. */
export function newCard({ draft, overrides = {}, slug, hasImage = false, needsReview = false }: NewCardInput): { card: NewCard; steps: CaptureStep[] } {
  const title = (overrides.title ?? draft.title).trim() || draft.canonicalUrl;
  const card: NewCard = {
    slug,
    canonical_key: draft.canonicalKey,
    source_url: draft.canonicalUrl,
    source_type: draft.sourceType,
    title,
    author: draft.author,
    description: (overrides.description ?? draft.description).trim(),
    kind: overrides.kind ?? draft.kind,
    shelf: overrides.shelf ?? draft.suggestedShelf,
    status: "draft",
    media_status: hasImage ? "ready" : "pending",
    needs_review: needsReview,
  };
  return { card, steps: hasImage ? [] : planSteps(draft.sourceType, draft) };
}
