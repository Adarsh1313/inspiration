"use server";

import { revalidatePath } from "next/cache";
import { serverClient } from "@/lib/supabase";

export type WatchActionResult = { ok: true } | { ok: false; error: string };

/** Delete an item and its notes. A stored X image is removed too, unless a card or another item still uses it. */
export async function deleteWatchItem(id: string): Promise<WatchActionResult> {
  const supabase = await serverClient();
  const row = await supabase.from("watch_items").select("thumb_path").eq("id", id).maybeSingle();
  if (row.error) return { ok: false, error: "Could not delete that item." };
  const { error } = await supabase.from("watch_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete that item." };

  const path = row.data?.thumb_path as string | null | undefined;
  if (path) {
    const [others, cards] = await Promise.all([
      supabase.from("watch_items").select("id", { count: "exact", head: true }).eq("thumb_path", path),
      supabase.from("cards").select("id", { count: "exact", head: true }).or(`poster_sm.eq.${path},poster_lg.eq.${path}`),
    ]);
    if ((others.count ?? 0) === 0 && (cards.count ?? 0) === 0) await supabase.storage.from("media").remove([path]);
  }
  revalidatePath("/", "layout"); // the side nav shows the item count
  return { ok: true };
}
