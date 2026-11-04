import { describe, expect, it } from "vitest";
import { DuplicateKeyError, saveCard, type CardRow, type CardStore } from "./save-card";
import type { CaptureStep, Draft } from "./types";

function memoryStore() {
  const cards: (CardRow & { id: string })[] = [];
  const tasks: { cardId: string; step: CaptureStep }[] = [];
  const uploads: string[] = [];
  const store: CardStore = {
    async findByKey(key) {
      const c = cards.find((x) => x.canonical_key === key);
      return c ? { slug: c.slug, title: c.title } : null;
    },
    async slugsStartingWith(base) {
      return new Set(cards.map((c) => c.slug).filter((s) => s.startsWith(base)));
    },
    async insertCard(row) {
      if (cards.some((c) => c.canonical_key === row.canonical_key)) throw new DuplicateKeyError("canonical_key");
      if (cards.some((c) => c.slug === row.slug)) throw new DuplicateKeyError("slug");
      const id = `id-${cards.length + 1}`;
      cards.push({ ...row, id });
      return { id };
    },
    async queueSteps(cardId, steps) {
      steps.forEach((step) => tasks.push({ cardId, step }));
    },
    async uploadImage(_b, ext) {
      const path = `refs/abc.${ext}`;
      uploads.push(path);
      return path;
    },
  };
  return { store, cards, tasks, uploads };
}

const xDraft: Draft = {
  canonicalUrl: "https://x.com/a/status/1",
  canonicalKey: "x:1",
  sourceType: "x-post",
  title: "Pre-loader animation",
  author: "@a",
  description: "desc",
  posterUrl: "https://p/x.jpg",
  mediaUrl: "https://v/x.mp4",
  suggestedShelf: "motion-interactions",
  kind: "animation",
  errors: [],
};

describe("saveCard", () => {
  it("saves a draft card as media-pending and queues the right steps", async () => {
    const m = memoryStore();
    const r = await saveCard(m.store, { draft: xDraft });
    expect(r).toMatchObject({ ok: true, slug: "pre-loader-animation" });
    expect(m.cards[0]).toMatchObject({ status: "draft", media_status: "pending", shelf: "motion-interactions", kind: "animation", needs_review: false });
    expect(m.tasks.map((t) => t.step)).toEqual(["download", "poster", "preview"]);
  });

  it("applies the edits made on the preview", async () => {
    const m = memoryStore();
    await saveCard(m.store, { draft: xDraft, overrides: { title: "Loader", shelf: "backgrounds-assets", description: "mine" } });
    expect(m.cards[0]).toMatchObject({ slug: "loader", title: "Loader", shelf: "backgrounds-assets", description: "mine" });
  });

  it("rejects a duplicate and points at the existing card", async () => {
    const m = memoryStore();
    await saveCard(m.store, { draft: xDraft });
    const again = await saveCard(m.store, { draft: { ...xDraft, title: "other" } });
    expect(again).toEqual({ ok: false, duplicate: { slug: "pre-loader-animation", title: "Pre-loader animation" } });
    expect(m.cards).toHaveLength(1);
  });

  it("gives colliding titles distinct slugs", async () => {
    const m = memoryStore();
    await saveCard(m.store, { draft: xDraft });
    const r = await saveCard(m.store, { draft: { ...xDraft, canonicalKey: "x:2", canonicalUrl: "https://x.com/a/status/2" } });
    expect(r).toMatchObject({ ok: true, slug: "pre-loader-animation-2" });
  });

  it("uses a pasted image as the poster and queues nothing", async () => {
    const m = memoryStore();
    await saveCard(m.store, { draft: { ...xDraft, errors: [{ code: "blocked", message: "x" }] }, image: { bytes: new Uint8Array([1]), ext: "png", mime: "image/png" } });
    expect(m.cards[0]).toMatchObject({ media_status: "ready", poster_sm: "refs/abc.png", poster_lg: "refs/abc.png" });
    expect(m.tasks).toEqual([]);
  });

  it("falls back to the link when there is no title", async () => {
    const m = memoryStore();
    const r = await saveCard(m.store, { draft: { ...xDraft, title: "" } });
    expect(r).toMatchObject({ ok: true, slug: "x-com-a-status-1" });
    expect(m.cards[0].title).toBe("https://x.com/a/status/1");
  });
});
