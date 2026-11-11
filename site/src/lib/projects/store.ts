import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry } from "./day-blocks";

export type Project = {
  id: string;
  slug: string;
  name: string;
  repo: string | null;
  colour: string;
  position: number;
  archived_at: string | null;
};
export type ProjectEntry = Entry & { project_id: string };

export const PROJECT_COLUMNS = "id,slug,name,repo,colour,position,archived_at";
export const ENTRY_COLUMNS = "id,project_id,day,seq,text,rev,ticketed_at,issues";

/** Every project (active and archived, in board order) with all their entries. */
export async function readProjects(supabase: SupabaseClient): Promise<{ projects: Project[]; entries: ProjectEntry[] }> {
  const [projects, entries] = await Promise.all([
    supabase.from("projects").select(PROJECT_COLUMNS).order("position").order("created_at"),
    supabase.from("project_entries").select(ENTRY_COLUMNS).order("day", { ascending: false }).order("seq", { ascending: false }),
  ]);
  if (projects.error) throw new Error(projects.error.message);
  return { projects: (projects.data ?? []) as Project[], entries: (entries.data ?? []) as ProjectEntry[] };
}

export async function countActiveProjects(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).is("archived_at", null);
  return count ?? 0;
}
