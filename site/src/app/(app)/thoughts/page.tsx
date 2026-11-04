import type { Metadata } from "next";
import { Wall } from "@/components/wall/wall";
import { NOTE_COLUMNS, type WallGroup, type WallNote } from "@/lib/wall/model";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Thoughts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await serverClient();
  const [notes, groups] = await Promise.all([
    supabase.from("notes").select(NOTE_COLUMNS).order("created_at"),
    supabase.from("note_groups").select("*").order("created_at"),
  ]);

  return <Wall initialNotes={(notes.data ?? []) as WallNote[]} initialGroups={(groups.data ?? []) as WallGroup[]} />;
}
