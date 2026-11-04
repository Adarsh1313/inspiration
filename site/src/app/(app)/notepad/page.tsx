import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NotepadEditor } from "@/components/notepad-editor";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Notepad" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await serverClient();
  const { data } = await supabase.from("notepad").select("text, rev").eq("id", 1).maybeSingle();

  return (
    <>
      <PageHeader title="Notepad" lede="One page of text that follows you from phone to laptop." />
      <NotepadEditor initial={data ?? null} />
    </>
  );
}
