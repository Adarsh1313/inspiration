import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PasteBar } from "@/components/paste-bar";
import { FilterBar } from "@/components/gallery/filter-bar";
import { ShelfChips } from "@/components/gallery/shelf-chips";
import { ShelfSection } from "@/components/gallery/shelf-section";
import { readGalleryCards } from "@/lib/cards-store";
import { applyFilters, groupByShelf, isFiltered, parseFilters, shelfCounts, toSearchParams, topTags, visibleCards } from "@/lib/gallery";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Design" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(toSearchParams(await searchParams));
  const all = await readGalleryCards(await serverClient()).catch(() => null);

  const base = all ? visibleCards(all, filters.archived) : [];
  const groups = all ? groupByShelf(all, applyFilters(all, filters), filters.archived) : [];

  return (
    <>
      <PageHeader title="Design" lede="A private library of design references: motion clips, layouts, components and the people behind them." />
      <PasteBar />
      {all && <ShelfChips counts={shelfCounts(all)} />}
      {all && (
        <FilterBar
          basePath="/design"
          filters={filters}
          tags={topTags(base, filters.tags)}
          archivedCount={all.filter((c) => c.status === "archived").length}
        />
      )}

      {!all && <p className="error" role="alert">Could not load the library. Check the connection and refresh.</p>}
      {all && groups.length === 0 && (
        <div className="placeholder">
          {isFiltered(filters) ? "Nothing matches these filters." : filters.archived ? "No archived cards." : "Nothing saved yet. Paste a link above."}
        </div>
      )}
      {groups.map((g, i) => (
        <ShelfSection key={g.shelf} group={g} firstShelf={i === 0} />
      ))}
    </>
  );
}
