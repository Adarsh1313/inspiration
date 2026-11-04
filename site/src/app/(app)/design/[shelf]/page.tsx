import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/gallery/filter-bar";
import { ShelfChips } from "@/components/gallery/shelf-chips";
import { ShelfSection } from "@/components/gallery/shelf-section";
import { readGalleryCards } from "@/lib/cards-store";
import { applyFilters, groupByShelf, isFiltered, isShelf, parseFilters, shelfCounts, toSearchParams, topTags, visibleCards } from "@/lib/gallery";
import { SHELF_LABEL } from "@/lib/source-labels";
import { serverClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ shelf: string }> }): Promise<Metadata> {
  const { shelf } = await params;
  return { title: isShelf(shelf) ? SHELF_LABEL[shelf] : "Design" };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ shelf: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shelf } = await params;
  if (!isShelf(shelf)) notFound();

  const filters = parseFilters(toSearchParams(await searchParams));
  const all = await readGalleryCards(await serverClient()).catch(() => null);

  const inShelf = all ? all.filter((c) => c.shelf === shelf) : [];
  const base = visibleCards(inShelf, filters.archived);
  const group = all ? groupByShelf(inShelf, applyFilters(inShelf, filters), filters.archived)[0] : undefined;

  return (
    <>
      <PageHeader title={SHELF_LABEL[shelf]} lede="One shelf of the design library." />
      {all && <ShelfChips counts={shelfCounts(all)} current={shelf} />}
      {all && (
        <FilterBar
          basePath={`/design/${shelf}`}
          filters={filters}
          tags={topTags(base, filters.tags)}
          archivedCount={inShelf.filter((c) => c.status === "archived").length}
        />
      )}

      {!all && <p className="error" role="alert">Could not load the library. Check the connection and refresh.</p>}
      {all && !group && (
        <div className="placeholder">
          {isFiltered(filters) ? "Nothing matches these filters." : filters.archived ? "No archived cards on this shelf." : "Nothing on this shelf yet."}
        </div>
      )}
      {group && <ShelfSection group={group} link={false} firstShelf />}
    </>
  );
}
