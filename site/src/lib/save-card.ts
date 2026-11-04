import { newCard, slugify, uniqueSlug, type CaptureStep, type Draft, type NewCard, type SaveOverrides } from "@hub/capture";

export type ExistingCard = { slug: string; title: string };

export type CardRow = NewCard & { poster_sm?: string; poster_lg?: string };

/** The only things saveCard needs from storage. Supabase backs it in production, a Map in tests. */
export interface CardStore {
  findByKey(key: string): Promise<ExistingCard | null>;
  /** Slugs that start with `base`, so a new slug can avoid them. */
  slugsStartingWith(base: string): Promise<Set<string>>;
  /** Throws DuplicateKeyError when the canonical key (or slug) is taken. */
  insertCard(row: CardRow): Promise<{ id: string }>;
  queueSteps(cardId: string, steps: CaptureStep[]): Promise<void>;
  uploadImage(bytes: Uint8Array, ext: string, mime: string): Promise<string>;
}

export class DuplicateKeyError extends Error {
  constructor(readonly column: "canonical_key" | "slug") {
    super(`duplicate ${column}`);
  }
}

export type SaveInput = {
  draft: Draft;
  overrides?: SaveOverrides;
  image?: { bytes: Uint8Array; ext: string; mime: string };
  needsReview?: boolean;
};

export type SaveResult = { ok: true; slug: string; id: string } | { ok: false; duplicate: ExistingCard };

/** Saves a previewed draft as a `draft` card and queues its worker steps. Rejects duplicates by canonical key. */
export async function saveCard(store: CardStore, input: SaveInput): Promise<SaveResult> {
  const existing = await store.findByKey(input.draft.canonicalKey);
  if (existing) return { ok: false, duplicate: existing };

  const posterPath = input.image ? await store.uploadImage(input.image.bytes, input.image.ext, input.image.mime) : undefined;
  const title = (input.overrides?.title ?? input.draft.title).trim();
  const base = slugify(title || input.draft.canonicalUrl.replace(/^https?:\/\//, ""));

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = uniqueSlug(base, await store.slugsStartingWith(base));
    const { card, steps } = newCard({ draft: input.draft, overrides: input.overrides, slug, hasImage: !!posterPath, needsReview: input.needsReview });
    try {
      const { id } = await store.insertCard(posterPath ? { ...card, poster_sm: posterPath, poster_lg: posterPath } : card);
      await store.queueSteps(id, steps);
      return { ok: true, slug, id };
    } catch (e) {
      if (!(e instanceof DuplicateKeyError)) throw e;
      if (e.column === "canonical_key") {
        const raced = await store.findByKey(input.draft.canonicalKey);
        if (raced) return { ok: false, duplicate: raced };
      }
      // slug race: loop and pick the next free slug
    }
  }
  throw new Error("Could not find a free slug.");
}
