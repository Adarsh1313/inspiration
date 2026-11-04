import Link from "next/link";
import { MOOD_BUCKETS, MOOD_KEYS, SOURCE_FILTERS, buildQuery, sameRange, type Filters, type MoodKey } from "@/lib/gallery";
import { SOURCE_FILTER_LABEL } from "@/lib/source-labels";
import { capitalise } from "@/lib/format";

type Props = { basePath: string; filters: Filters; tags: string[]; archivedCount: number };

/** Filters live in the URL query, so every chip is a link and a filtered view can be shared. */
export function FilterBar({ basePath, filters, tags, archivedCount }: Props) {
  const to = (next: Filters) => `${basePath}${buildQuery(next)}`;
  const chip = (active: boolean) => (active ? "chip chip-btn" : "chip chip-btn chip-idle");

  return (
    <section className="filters" aria-label="Filters">
      <div className="filter-row" role="group" aria-label="Source">
        <Link replace scroll={false} href={to({ ...filters, source: undefined })} className={chip(!filters.source)} aria-current={!filters.source ? "true" : undefined}>
          All
        </Link>
        {SOURCE_FILTERS.map((s) => (
          <Link key={s} replace scroll={false} href={to({ ...filters, source: filters.source === s ? undefined : s })} className={chip(filters.source === s)} aria-current={filters.source === s ? "true" : undefined}>
            {SOURCE_FILTER_LABEL[s]}
          </Link>
        ))}
        <Link replace scroll={false} href={to({ ...filters, archived: !filters.archived })} className={`${chip(filters.archived)} filter-end`} aria-current={filters.archived ? "true" : undefined}>
          Archived{archivedCount ? ` · ${archivedCount}` : ""}
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="filter-row" role="group" aria-label="Tags">
          {tags.map((t) => {
            const on = filters.tags.includes(t);
            const next = on ? filters.tags.filter((x) => x !== t) : [...filters.tags, t];
            return (
              <Link key={t} replace scroll={false} href={to({ ...filters, tags: next })} className={chip(on)} aria-current={on ? "true" : undefined}>
                {t}
              </Link>
            );
          })}
        </div>
      )}

      <div className="filter-row filter-moods">
        {MOOD_KEYS.map((key) => (
          <div key={key} className="filter-mood" role="group" aria-label={capitalise(key)}>
            <span className="filter-label mono">{capitalise(key)}</span>
            {MOOD_BUCKETS.map((b) => {
              const on = sameRange(filters.mood[key], b.range);
              const mood = { ...filters.mood };
              if (on) delete mood[key];
              else mood[key] = { ...b.range };
              return (
                <Link key={b.label} replace scroll={false} href={to({ ...filters, mood })} className={chip(on)} aria-current={on ? "true" : undefined}>
                  {b.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
