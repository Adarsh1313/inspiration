"use server";

import { revalidatePath } from "next/cache";
import { parseLocalUrl, parseRepo } from "@/lib/projects/day-blocks";
import { serverClient } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FAIL: ActionResult = { ok: false, error: "That did not save. Try again." };

function nav() {
  revalidatePath("/", "layout"); // the side nav shows the active count
}

/** Edit a past block's text from its menu. Blank text is refused: use Delete. */
export async function editEntry(id: string, text: string): Promise<ActionResult> {
  if (text.trim() === "") return { ok: false, error: "A block can't be empty. Delete it instead." };
  const supabase = await serverClient();
  const cur = await supabase.from("project_entries").select("rev").eq("id", id).maybeSingle();
  if (cur.error || !cur.data) return FAIL;
  const { error } = await supabase.from("project_entries").update({ text, rev: cur.data.rev + 1, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? FAIL : { ok: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const { error } = await (await serverClient()).from("project_entries").delete().eq("id", id);
  return error ? FAIL : { ok: true };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const { error } = await (await serverClient()).from("projects").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return FAIL;
  nav();
  return { ok: true };
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const supabase = await serverClient();
  const last = await supabase.from("projects").select("position").is("archived_at", null).order("position", { ascending: false }).limit(1);
  const position = (last.data?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("projects").update({ archived_at: null, position }).eq("id", id);
  if (error) return FAIL;
  nav();
  return { ok: true };
}

/** `ids` is the new order of the active projects. */
export async function reorderProjects(ids: string[]): Promise<ActionResult> {
  const supabase = await serverClient();
  const results = await Promise.all(ids.map((id, position) => supabase.from("projects").update({ position }).eq("id", id)));
  return results.some((r) => r.error) ? FAIL : { ok: true };
}

/** Accepts `owner/name` or a GitHub URL, and a local dev address (`3000`, `localhost:3000`). Empty values clear them. */
export async function setProjectLinks(id: string, repoInput: string, localInput: string): Promise<ActionResult & { repo?: string | null; local_url?: string | null }> {
  const repo = repoInput.trim() === "" ? null : parseRepo(repoInput);
  if (repoInput.trim() !== "" && !repo) return { ok: false, error: "Use owner/name, like Adarsh1313/resurface." };
  const local_url = localInput.trim() === "" ? null : parseLocalUrl(localInput);
  if (localInput.trim() !== "" && !local_url) return { ok: false, error: "Use a local address like localhost:3000." };
  const { error } = await (await serverClient()).from("projects").update({ repo, local_url }).eq("id", id);
  return error ? FAIL : { ok: true, repo, local_url };
}
