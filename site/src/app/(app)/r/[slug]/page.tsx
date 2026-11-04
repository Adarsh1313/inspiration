import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CardEditor } from "@/components/card/card-editor";
import { CopyButton } from "@/components/copy-button";
import { SourceIcon } from "@/components/source-icon";
import { cardJsonLd, jsonLdScript } from "@/lib/agent-access";
import { readCardPage } from "@/lib/cards-store";
import { MOOD_KEYS } from "@/lib/gallery";
import { SHELF_LABEL, SOURCE_LABEL } from "@/lib/source-labels";
import { serverClient } from "@/lib/supabase";
import { serviceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

async function loadCard(slug: string) {
  const session = await serverClient();
  const { data } = await session.auth.getUser();
  // The proxy lets a read-only token reach this page without a session; reads then use the service client.
  const owner = !!data.user;
  const found = await readCardPage(owner ? session : serviceClient(), slug).catch(() => null);
  // A token holder sees only active cards, the same as /r/<slug>.md and llms.txt.
  const page = found && (owner || found.card.status === "active") ? found : null;
  return { page, owner };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await loadCard(decodeURIComponent(slug));
  return { title: page?.card.title || "Card" };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { page, owner } = await loadCard(decodeURIComponent(slug));
  if (!page) notFound();
  const { card, posterUrl, previewUrl, related } = page;

  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost"}`;
  const jsonLd = jsonLdScript(cardJsonLd(card, { baseUrl }));

  const isDirectory = card.kind === "directory";
  const checklistText = card.shelf === "anti-slop" || /slop/.test(card.slug) ? card.notes?.trim() : undefined;
  const checked = formatDate(card.last_checked);

  return (
    <article className="cardpage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/design">Design</Link>
        <span aria-hidden>/</span>
        <Link href={`/design/${card.shelf}`}>{SHELF_LABEL[card.shelf as keyof typeof SHELF_LABEL] ?? card.shelf}</Link>
      </nav>

      <h1 className="card-title">{card.title || card.slug}</h1>
      <div className="preview-meta">
        <span className="chip"><SourceIcon type={card.source_type as never} /> {SOURCE_LABEL[card.source_type as keyof typeof SOURCE_LABEL] ?? card.source_type}</span>
        <span className="chip chip-muted">{card.kind}</span>
        {isDirectory && <span className="chip">Directory{card.item_count ? ` · ${card.item_count} items` : ""}</span>}
        {card.status !== "active" && <span className="chip chip-muted">{card.status}</span>}
        {card.media_status === "pending" && <span className="chip chip-muted">Media pending</span>}
        {card.media_status === "failed" && <span className="chip chip-danger" title={card.media_error ?? undefined}>Media failed</span>}
        {card.needs_review && <span className="chip chip-muted">Needs review</span>}
      </div>
      {card.author && <p className="preview-author">{card.author}</p>}

      <div className="card-media">
        {previewUrl ? (
          <video src={previewUrl} poster={posterUrl ?? undefined} controls muted loop playsInline preload="none" />
        ) : posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" />
        ) : (
          <span className="preview-empty">No preview yet</span>
        )}
      </div>

      {card.summary && <p className="card-summary">{card.summary}</p>}
      {card.video_description && (
        <section className="card-section">
          <h2>What it looks like</h2>
          <p>{card.video_description}</p>
        </section>
      )}
      {card.reuse && (
        <section className="card-section">
          <h2>What to reuse</h2>
          <p>{card.reuse}</p>
        </section>
      )}

      {checklistText && (
        <section className="card-section">
          <h2>Checklist text</h2>
          <pre className="checklist">{checklistText}</pre>
          <CopyButton text={checklistText} label="Copy checklist" />
        </section>
      )}

      <dl className="facts">
        {MOOD_KEYS.some((k) => card.mood[k] != null) && (
          <div>
            <dt>Mood</dt>
            <dd>
              <ul className="dials">
                {MOOD_KEYS.filter((k) => card.mood[k] != null).map((k) => (
                  <li key={k} className="dial" style={{ "--dial": card.mood[k] } as React.CSSProperties}>
                    <span className="dial-name">{k}</span>
                    <span className="dial-bar" aria-hidden />
                    <span className="mono">{card.mood[k]}/10</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {card.tags.length > 0 && (
          <div>
            <dt>Tags</dt>
            <dd className="chips">
              {card.tags.map((t) => (
                <Link key={t} href={`/design?tag=${encodeURIComponent(t)}`} className="chip chip-btn chip-idle">{t}</Link>
              ))}
            </dd>
          </div>
        )}
        {card.fits.length > 0 && (
          <div>
            <dt>Fits</dt>
            <dd>{card.fits.join(", ")}</dd>
          </div>
        )}
        {card.stack.length > 0 && (
          <div>
            <dt>Stack</dt>
            <dd className="mono">{card.stack.join(", ")}</dd>
          </div>
        )}
        {card.used_in.length > 0 && (
          <div>
            <dt>Used in</dt>
            <dd>{card.used_in.join(", ")}</dd>
          </div>
        )}
        {card.source_url && (
          <div>
            <dt>Source</dt>
            <dd>
              <a className="link" href={card.source_url} target="_blank" rel="noopener noreferrer">
                {card.source_url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
              </a>
            </dd>
          </div>
        )}
      </dl>

      {isDirectory && (
        <section className="card-section">
          <h2>How to browse it</h2>
          {card.browse_notes ? <p>{card.browse_notes}</p> : <p className="hint">No browse notes yet.</p>}
          {checked && <p className="hint">Last checked {checked}.</p>}
          {card.picks.length > 0 && (
            <>
              <h3>Saved picks</h3>
              <ul className="picks">
                {card.picks.map((p) => (
                  <li key={p.url}>
                    <a className="link" href={p.url} target="_blank" rel="noopener noreferrer">{p.url.replace(/^https?:\/\/(www\.)?/, "")}</a>
                    {p.note ? <span className="hint"> · {p.note}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {card.notes && !checklistText && (
        <section className="card-section">
          <h2>Notes</h2>
          <p>{card.notes}</p>
        </section>
      )}

      {related.length > 0 && (
        <section className="card-section">
          <h2>Related</h2>
          <ul className="picks">
            {related.map((r) => (
              <li key={r.slug}><Link className="link" href={`/r/${r.slug}`}>{r.title || r.slug}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {owner && (
        <div className="card-actions">
          <CardEditor card={{ slug: card.slug, title: card.title, summary: card.summary, shelf: card.shelf, tags: card.tags, mood: card.mood }} />
        </div>
      )}
    </article>
  );
}
