"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { Menu } from "@/components/projects/menu";
import { wordCount } from "@/lib/notepad-sync";
import type { WatchItem } from "@/lib/watch/notes";

export function WatchCard({ item, onOpen, onDelete }: { item: WatchItem; onOpen: () => void; onDelete: () => Promise<string | null> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = wordCount(item.notes);

  async function remove() {
    const message = await onDelete();
    if (message) setError(message);
  }

  return (
    <article className="wcard">
      <button type="button" className="wcard-open" onClick={onOpen} aria-label={`Open notes for ${item.title}`}>
        <span className="wcard-thumb">
          {item.thumb ? (
            // Remote or signed thumbnail; no Referer so hotlink checks don't blank it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <ImageOff size={20} strokeWidth={1.5} aria-hidden />
          )}
        </span>
        <span className="wcard-body">
          <span className="wcard-title">{item.title}</span>
          <span className="wcard-meta">
            <SourceIcon type={item.source_type} />
            {item.author && <span className="wcard-author">{item.author}</span>}
            <span className="mono wcard-count">{words === 0 ? "No notes yet" : `${words} ${words === 1 ? "word" : "words"}`}</span>
          </span>
        </span>
      </button>
      <div className="wcard-menu">
        <Menu label={`${item.title} options`} items={[{ label: "Delete", danger: true, onSelect: () => setConfirming(true) }]} />
      </div>
      {confirming && (
        <div className="wcard-confirm" role="alertdialog" aria-label={`Delete ${item.title}`}>
          <p>Delete this item and its notes? This can't be undone.</p>
          <div className="row">
            <button type="button" className="btn danger bar-btn" onClick={() => void remove()}>Delete</button>
            <button type="button" className="btn secondary bar-btn" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </article>
  );
}
