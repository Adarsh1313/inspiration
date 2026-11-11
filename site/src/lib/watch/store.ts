import type { SupabaseClient } from "@supabase/supabase-js";
import { signMedia } from "../cards-store";
import { newestFirst, type WatchItem, type WatchSource } from "./notes";

export const WATCH_COLUMNS = "id,source_url,source_type,title,author,duration_s,notes,rev,created_at,thumb_url,thumb_path";

export type WatchRow = Omit<WatchItem, "thumb"> & { thumb_url: string | null; thumb_path: string | null };

/** A displayable image for a row: YouTube's own URL, or a signed URL for a stored image. */
export function toItem(row: WatchRow, signed: Map<string, string>): WatchItem {
  const { thumb_url, thumb_path, ...rest } = row;
  return { ...rest, thumb: thumb_url ?? (thumb_path ? (signed.get(thumb_path) ?? null) : null) };
}

/** Every item, newest first, with thumbnails ready to show. */
export async function readWatchItems(supabase: SupabaseClient): Promise<WatchItem[]> {
  const { data, error } = await supabase.from("watch_items").select(WATCH_COLUMNS);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WatchRow[];
  const signed = await signMedia(supabase, rows.map((r) => r.thumb_path));
  return newestFirst(rows.map((r) => toItem(r, signed)));
}

export async function findWatchByKey(supabase: SupabaseClient, key: string): Promise<{ id: string; title: string } | null> {
  const { data } = await supabase.from("watch_items").select("id,title").eq("canonical_key", key).maybeSingle();
  return data as { id: string; title: string } | null;
}

export type NewWatchItem = {
  source_url: string;
  canonical_key: string;
  source_type: WatchSource;
  title: string;
  author: string | null;
  thumb_url: string | null;
  thumb_path: string | null;
};

export async function insertWatchItem(supabase: SupabaseClient, item: NewWatchItem): Promise<{ id: string } | { duplicate: true }> {
  const { data, error } = await supabase.from("watch_items").insert(item).select("id").single();
  if (error) {
    if (error.code === "23505") return { duplicate: true };
    throw new Error(error.message);
  }
  return { id: data.id as string };
}

export async function countWatchItems(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("watch_items").select("id", { count: "exact", head: true });
  return count ?? 0;
}
