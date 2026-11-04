import Link from "next/link";
import { SHELF_LABEL } from "@/lib/source-labels";
import type { ShelfGroup } from "@/lib/gallery";
import { CardTile } from "./card-tile";

/** A shelf: heading, mono "n of n" count, then the grid. The first row loads eagerly for LCP. */
export function ShelfSection({ group, link = true, firstShelf = false }: { group: ShelfGroup; link?: boolean; firstShelf?: boolean }) {
  return (
    <section className="shelf" aria-labelledby={`shelf-${group.shelf}`}>
      <header className="shelf-head">
        <h2 id={`shelf-${group.shelf}`} className="shelf-title">
          {link ? <Link href={`/design/${group.shelf}`}>{SHELF_LABEL[group.shelf]}</Link> : SHELF_LABEL[group.shelf]}
        </h2>
        <span className="mono shelf-count">{group.shown} of {group.total}</span>
      </header>
      <div className="grid">
        {group.cards.map((c, i) => (
          <CardTile key={c.slug} card={c} priority={firstShelf && i < 4} />
        ))}
      </div>
    </section>
  );
}
