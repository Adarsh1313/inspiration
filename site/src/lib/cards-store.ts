import { createHash } from "node:crypto";
import { DuplicateKeyError, type CardStore, type Shelf } from "@hub/capture";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentCard } from "./agent-access";
import { shelfCounts, type GalleryCard } from "./gallery";
import { serverClient } from "./supabase";

type Client = Awaited<ReturnType<typeof serverClient>>;

/** CardStore backed by Supabase, as the signed-in owner (RLS applies). */
export function supabaseCardStore(supabase: Client): CardStore {
  return {
    async findByKey(key) {
      const { data, error } = await supabase.from("cards").select("slug,title").eq("canonical_key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async slugsStartingWith(base) {
      const { data, error } = await supabase.from("cards").select("slug").like("slug", `${base}%`);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.slug as string));
    },
    async insertCard(row) {
      const { data, error } = await supabase.from("cards").insert(row).select("id").single();
      if (error) {
        if (error.code === "23505") throw new DuplicateKeyError(error.message.includes("canonical_key") ? "canonical_key" : "slug");
        throw new Error(error.message);
      }
      return { id: data.id as string };
    },
    async queueSteps(cardId, steps) {
      if (steps.length === 0) return;
      const { error } = await supabase.from("capture_tasks").insert(steps.map((step) => ({ card_id: cardId, step })));
      if (error) throw new Error(error.message);
    },
    async uploadImage(bytes, ext, mime) {
      const path = `refs/${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: true });
      if (error) throw new Error(error.message);
      return path;
    },
  };
}

const AGENT_COLUMNS =
  "slug,title,kind,shelf,status,pinned,summary,mood,tags,fits,stack,used_in,source_url,source_type,reuse,notes,video_description,browse_notes,picks,poster_sm,preview,author,description,added_at,media_status";

/** Every card in the shape the machine routes use. Pass the service client: the caller is already authorised by the proxy. */
export async function readAgentCards(supabase: SupabaseClient): Promise<AgentCard[]> {
  const { data, error } = await supabase.from("cards").select(AGENT_COLUMNS);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AgentCard[];
}

// ---- Gallery reads (signed-in owner, RLS applies) ----

const GALLERY_COLUMNS =
  "slug,title,author,source_type,source_url,kind,shelf,status,pinned,summary,tags,mood,media_status,media_error,needs_review,item_count,added_at,poster_sm,preview";

type GalleryRow = Omit<GalleryCard, "posterUrl" | "previewUrl"> & { poster_sm: string | null; preview: string | null };

const SIGNED_URL_TTL = 60 * 60; // 1 h, per the spec

/** One batch call: object path → signed URL. Paths that fail to sign are left out. */
export async function signMedia(supabase: SupabaseClient, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data } = await supabase.storage.from("media").createSignedUrls(unique, SIGNED_URL_TTL);
  for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}

/** Every card for the gallery grid, with signed poster and clip URLs. */
export async function readGalleryCards(supabase: SupabaseClient): Promise<GalleryCard[]> {
  const { data, error } = await supabase.from("cards").select(GALLERY_COLUMNS);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GalleryRow[];
  const urls = await signMedia(supabase, rows.flatMap((r) => [r.poster_sm, r.preview]));
  return rows.map(({ poster_sm, preview, ...card }) => ({
    ...card,
    tags: card.tags ?? [],
    mood: card.mood ?? {},
    posterUrl: poster_sm ? (urls.get(poster_sm) ?? null) : null,
    previewUrl: preview ? (urls.get(preview) ?? null) : null,
  }));
}

export type CardPageData = {
  card: AgentCard & {
    id: string;
    fits: string[];
    stack: string[];
    related: string[];
    last_checked: string | null;
    item_count: number | null;
    needs_review: boolean;
    media_error: string | null;
    poster_lg: string | null;
    transcript: string | null;
  };
  posterUrl: string | null;
  previewUrl: string | null;
  related: { slug: string; title: string }[];
};

/** One card with everything its page needs. `null` when the slug is unknown. */
export async function readCardPage(supabase: SupabaseClient, slug: string): Promise<CardPageData | null> {
  const { data, error } = await supabase.from("cards").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const card = { ...data, tags: data.tags ?? [], mood: data.mood ?? {}, picks: data.picks ?? [], used_in: data.used_in ?? [], fits: data.fits ?? [], stack: data.stack ?? [], related: data.related ?? [] } as CardPageData["card"];
  const urls = await signMedia(supabase, [card.poster_lg ?? card.poster_sm, card.preview]);
  let related: CardPageData["related"] = [];
  if (card.related.length) {
    const res = await supabase.from("cards").select("slug,title").in("id", card.related).neq("status", "archived");
    related = (res.data ?? []) as CardPageData["related"];
  }
  return {
    card,
    posterUrl: urls.get(card.poster_lg ?? card.poster_sm ?? "") ?? null,
    previewUrl: card.preview ? (urls.get(card.preview) ?? null) : null,
    related,
  };
}

export type NavCounts = { design: number; shelves: Record<Shelf, number>; jobs: number; thoughts: number };

/** Counts for the side nav: one light query per area. Any failure counts as 0 so the shell never breaks. */
export async function readNavCounts(supabase: SupabaseClient): Promise<NavCounts> {
  const [cards, notes, jobs] = await Promise.all([
    supabase.from("cards").select("shelf,status").neq("status", "archived"),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("job_postings").select("id", { count: "exact", head: true }),
  ]);
  const shelves = shelfCounts((cards.data ?? []) as Pick<GalleryCard, "shelf" | "status">[]);
  return {
    design: (cards.data ?? []).length,
    shelves,
    jobs: jobs.count ?? 0,
    thoughts: notes.count ?? 0,
  };
}
