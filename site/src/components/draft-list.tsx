import type { SourceType } from "@hub/capture";
import { SOURCE_LABEL } from "@/lib/source-labels";

export type CardSummary = {
  slug: string;
  title: string;
  source_type: SourceType;
  status: "draft" | "active" | "archived";
  media_status: "pending" | "ready" | "failed";
  media_error: string | null;
  needs_review: boolean;
  added_at: string;
};

/** Plain list of recent cards. The shelved gallery replaces this in milestone 5. */
export function DraftList({ cards }: { cards: CardSummary[] }) {
  if (cards.length === 0) return <div className="placeholder">Nothing saved yet. Paste a link above.</div>;
  return (
    <ul className="recent" aria-label="Recent cards">
      {cards.map((c) => (
        <li key={c.slug} className="recent-item">
          <a className="recent-title" href={`/r/${c.slug}`}>{c.title || c.slug}</a>
          <span className="chip">{SOURCE_LABEL[c.source_type]}</span>
          {c.status === "draft" && <span className="chip">Draft</span>}
          {c.media_status === "pending" && <span className="chip chip-muted">Media pending</span>}
          {c.media_status === "failed" && (
            <span className="chip chip-danger" title={c.media_error ?? undefined}>Media failed</span>
          )}
          {c.needs_review && <span className="chip chip-muted">Needs review</span>}
        </li>
      ))}
    </ul>
  );
}
