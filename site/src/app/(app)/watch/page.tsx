import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { WatchBoard } from "@/components/watch/watch-board";
import { serverClient } from "@/lib/supabase";
import { readWatchItems } from "@/lib/watch/store";

export const metadata: Metadata = { title: "Watch notes" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  const items = await readWatchItems(await serverClient()).catch(() => []);
  return (
    <>
      <PageHeader title="YouTube and X notes" lede="Paste a video or post, then keep the notes you took while watching." />
      <WatchBoard initialItems={items} initialOpenId={typeof item === "string" ? item : null} />
    </>
  );
}
