"use server";

import { revalidatePath } from "next/cache";
import { mergeMood, parseCardEdit, type CardEditInput } from "@/lib/card-edit";
import { serverClient } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FAILED: ActionResult = { ok: false, error: "That did not save. Try again." };

async function update(slug: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await serverClient();
  const { data, error } = await supabase.from("cards").update(patch).eq("slug", slug).select("slug");
  if (error || !data?.length) return FAILED;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPinned(slug: string, pinned: boolean): Promise<ActionResult> {
  return update(slug, { pinned });
}

/** Archiving hides a card from the grid and from agents. Restoring puts it back as active. */
export async function setArchived(slug: string, archived: boolean): Promise<ActionResult> {
  return update(slug, { status: archived ? "archived" : "active" });
}

/** Removes the card's media from Storage first, then the row (its capture tasks go with it). */
export async function deleteCard(slug: string): Promise<ActionResult> {
  const supabase = await serverClient();
  const { data: card } = await supabase.from("cards").select("poster_sm,poster_lg,preview,original").eq("slug", slug).maybeSingle();
  if (!card) return { ok: false, error: "That card is already gone." };

  const paths = [...new Set([card.poster_sm, card.poster_lg, card.preview, card.original].filter((p): p is string => !!p))];
  if (paths.length) {
    const { error } = await supabase.storage.from("media").remove(paths);
    if (error) return { ok: false, error: "Could not remove the card's media, so nothing was deleted." };
  }
  const { error } = await supabase.from("cards").delete().eq("slug", slug);
  if (error) return FAILED;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCard(slug: string, input: CardEditInput): Promise<ActionResult> {
  const parsed = parseCardEdit(input);
  if (!parsed.ok) return parsed;
  const { title, summary, shelf, tags, mood } = parsed.value;

  const supabase = await serverClient();
  const { data: existing } = await supabase.from("cards").select("mood").eq("slug", slug).maybeSingle();
  if (!existing) return { ok: false, error: "That card no longer exists." };
  return update(slug, { title, summary: summary || null, shelf, tags, mood: mergeMood(existing.mood ?? {}, mood) });
}
