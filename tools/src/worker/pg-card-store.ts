import { DuplicateKeyError, type CardRow, type CardStore } from "@hub/capture";
import type pg from "pg";
import type { MediaStore } from "./media-store";

/** CardStore over the hub_worker role (migration 0005 gives it insert on cards and capture_tasks). */
export class PgCardStore implements CardStore {
  constructor(
    private readonly client: pg.Client,
    private readonly media?: MediaStore,
  ) {}

  async findByKey(key: string) {
    const { rows } = await this.client.query<{ slug: string; title: string }>("select slug, title from public.cards where canonical_key = $1", [key]);
    return rows[0] ?? null;
  }

  async slugsStartingWith(base: string) {
    const escaped = base.replace(/[\\%_]/g, "\\$&");
    const { rows } = await this.client.query<{ slug: string }>("select slug from public.cards where slug like $1", [`${escaped}%`]);
    return new Set(rows.map((r) => r.slug));
  }

  async insertCard(row: CardRow) {
    const keys = Object.keys(row);
    const cols = keys.join(", ");
    const params = keys.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const { rows } = await this.client.query<{ id: string }>(`insert into public.cards (${cols}) values (${params}) returning id`, Object.values(row));
      return { id: rows[0].id };
    } catch (e) {
      const err = e as { code?: string; constraint?: string };
      if (err.code === "23505") throw new DuplicateKeyError(err.constraint?.includes("canonical_key") ? "canonical_key" : "slug");
      throw e;
    }
  }

  async queueSteps(cardId: string, steps: string[]) {
    for (const step of steps) {
      await this.client.query("insert into public.capture_tasks (card_id, step) values ($1, $2) on conflict (card_id, step) do nothing", [cardId, step]);
    }
  }

  async uploadImage(bytes: Uint8Array, ext: string, mime: string) {
    if (!this.media) throw new Error("Storage is not configured (HUB_S3_* in .env.local).");
    return this.media.put("refs", bytes, ext, mime);
  }
}
