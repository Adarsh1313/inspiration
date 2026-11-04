import Link from "next/link";
import { SHELVES, type Shelf } from "@hub/capture";
import { SHELF_LABEL } from "@/lib/source-labels";

/** Mobile only: shelves as a scrolling chip row (the side nav shelf list is hidden on phones). */
export function ShelfChips({ counts, current }: { counts: Record<Shelf, number>; current?: Shelf }) {
  return (
    <nav className="shelf-chips" aria-label="Shelves">
      <Link href="/design" className={current ? "chip chip-btn chip-idle" : "chip chip-btn"} aria-current={current ? undefined : "page"}>
        All
      </Link>
      {SHELVES.map((s) => (
        <Link key={s} href={`/design/${s}`} className={current === s ? "chip chip-btn" : "chip chip-btn chip-idle"} aria-current={current === s ? "page" : undefined}>
          {SHELF_LABEL[s]} · {counts[s]}
        </Link>
      ))}
    </nav>
  );
}
