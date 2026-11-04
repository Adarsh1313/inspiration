"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { FileText, MoreHorizontal, Pin } from "lucide-react";
import { deleteCard, setArchived, setPinned, type ActionResult } from "@/app/(app)/design/actions";
import type { GalleryCard } from "@/lib/gallery";
import { SOURCE_LABEL } from "@/lib/source-labels";
import { SourceIcon } from "../source-icon";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One reference in the grid: still poster, hover clip, summary fade, touch two-tap, and the three-dot menu. */
export function CardTile({ card, priority = false }: { card: GalleryCard; priority?: boolean }) {
  const [active, setActive] = useState(false); // hover, keyboard focus or first touch tap
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clipReady, setClipReady] = useState(false);
  const [clipRequested, setClipRequested] = useState(false);
  const viaPointer = useRef(false); // keyboard focus shows the summary but never starts a clip (no motion for keyboard navigation)
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pointerType = useRef("mouse");
  const archived = card.status === "archived";
  const href = card.source_url ?? `/r/${card.slug}`;
  const cardHref = `/r/${card.slug}`;

  // The clip loads on first hover and plays only while the card is active. Reduced motion keeps the still poster.
  useEffect(() => {
    if (active && viaPointer.current && card.previewUrl && !prefersReducedMotion()) setClipRequested(true);
  }, [active, card.previewUrl]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (active && viaPointer.current) void el.play().catch(() => {});
    else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active, clipRequested]);

  // A tap or press outside closes the touch "hover" and the menu.
  useEffect(() => {
    if (!active && !menuOpen) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      setActive(false);
      setMenuOpen(false);
      setConfirmDelete(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setConfirmDelete(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, menuOpen]);

  function onPointerDown(e: PointerEvent) {
    pointerType.current = e.pointerType;
  }

  function onMediaClick(e: MouseEvent) {
    // On touch the first tap acts like hover; the second opens the source.
    if (pointerType.current === "touch" && !active) {
      e.preventDefault();
      viaPointer.current = true;
      setActive(true);
    }
  }

  async function run(action: () => Promise<ActionResult>) {
    setBusy(true);
    setError(null);
    const result = await action().catch((): ActionResult => ({ ok: false, error: "That did not save. Try again." }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${cardHref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Could not copy. The browser blocked the clipboard.");
    }
  }

  return (
    <article
      ref={root}
      className="tile"
      data-active={active}
      data-menu-open={menuOpen}
      data-archived={archived}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        viaPointer.current = true;
        setActive(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || menuOpen) return;
        viaPointer.current = false;
        setActive(false);
      }}
      onFocus={() => setActive(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && !menuOpen && setActive(false)}
    >
      <a
        className="tile-media"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${card.title || card.slug} (opens the source)`}
        onPointerDown={onPointerDown}
        onClick={onMediaClick}
      >
        {card.posterUrl ? (
          // Signed Storage URL, already sized by the worker; no image transforms on the free tier.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tile-poster" src={card.posterUrl} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
        ) : (
          <span className="tile-empty">{card.media_status === "pending" ? "Media pending" : "No preview"}</span>
        )}
        {clipRequested && card.previewUrl && (
          <video ref={video} className="tile-clip" data-ready={clipReady} src={card.previewUrl} muted loop playsInline preload="auto" onPlaying={() => setClipReady(true)} />
        )}
        {card.summary && <span className="tile-summary">{card.summary}</span>}
      </a>

      {card.pinned && (
        <span className="tile-pin" role="img" aria-label="Pinned">
          <Pin size={12} strokeWidth={1.5} aria-hidden />
        </span>
      )}

      <button
        type="button"
        className="icon-btn tile-menu-btn"
        aria-label={`Actions for ${card.title || card.slug}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((v) => !v);
          setConfirmDelete(false);
          setError(null);
        }}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      {menuOpen && (
        <div className="tile-menu" role="menu" aria-label="Card actions">
          {confirmDelete ? (
            <div className="tile-confirm">
              <p>Delete this card and its media? This cannot be undone.</p>
              <div className="row">
                <button type="button" className="menu-item danger" role="menuitem" disabled={busy} onClick={() => void run(() => deleteCard(card.slug))}>
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <button type="button" className="menu-item" role="menuitem" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="menu-item" role="menuitem" disabled={busy} onClick={() => void run(() => setPinned(card.slug, !card.pinned))}>
                {card.pinned ? "Unpin" : "Pin to top"}
              </button>
              <button type="button" className="menu-item" role="menuitem" onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy card link"}
              </button>
              {card.source_url && (
                <a className="menu-item" role="menuitem" href={card.source_url} target="_blank" rel="noopener noreferrer">
                  Open source
                </a>
              )}
              <button type="button" className="menu-item" role="menuitem" disabled={busy} onClick={() => void run(() => setArchived(card.slug, !archived))}>
                {archived ? "Restore" : "Archive"}
              </button>
              <button type="button" className="menu-item danger" role="menuitem" disabled={busy} onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            </>
          )}
          {error && <p className="error tile-error" role="alert">{error}</p>}
        </div>
      )}

      <div className="tile-foot">
        <SourceIcon type={card.source_type} />
        <a className="tile-title" href={href} target="_blank" rel="noopener noreferrer" title={SOURCE_LABEL[card.source_type]} onPointerDown={onPointerDown} onClick={onMediaClick}>
          {card.title || card.slug}
        </a>
        <a className="icon-btn tile-open" href={cardHref} aria-label={`Open the card page for ${card.title || card.slug}`} title="Card page">
          <FileText size={16} strokeWidth={1.5} />
        </a>
      </div>

      {(card.kind === "directory" || card.status === "draft" || card.media_status !== "ready" || card.needs_review) && (
        <div className="tile-badges">
          {card.kind === "directory" && <span className="chip">Directory{card.item_count ? ` · ${card.item_count} items` : ""}</span>}
          {card.status === "draft" && <span className="chip chip-muted">Draft</span>}
          {card.media_status === "pending" && <span className="chip chip-muted">Media pending</span>}
          {card.media_status === "failed" && <span className="chip chip-danger" title={card.media_error ?? undefined}>Media failed</span>}
          {card.needs_review && <span className="chip chip-muted">Needs review</span>}
        </div>
      )}
    </article>
  );
}
