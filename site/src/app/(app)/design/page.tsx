import type { Metadata } from "next";
import { DraftList, type CardSummary } from "@/components/draft-list";
import { PageHeader } from "@/components/page-header";
import { PasteBar } from "@/components/paste-bar";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Design" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await serverClient();
  const { data } = await supabase
    .from("cards")
    .select("slug,title,source_type,status,media_status,media_error,needs_review,added_at")
    .neq("status", "archived")
    .order("added_at", { ascending: false })
    .limit(60);

  return (
    <>
      <PageHeader title="Design" lede="A private library of design references: motion clips, layouts, components and the people behind them." />
      <PasteBar />
      <DraftList cards={(data ?? []) as CardSummary[]} />
    </>
  );
}
