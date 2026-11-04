import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ThoughtsBoard } from "@/components/thoughts-board";
import type { Note } from "@/lib/notes";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Thoughts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await serverClient();
  const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Thoughts" lede="A board of sticky notes for loose ideas. Press N to add one." />
      <ThoughtsBoard initial={(data ?? []) as Note[]} />
    </>
  );
}
