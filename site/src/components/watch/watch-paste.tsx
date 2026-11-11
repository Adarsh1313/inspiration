"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Link2 } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import type { WatchItem, WatchSource } from "@/lib/watch/notes";

type Preview = { url: string; source: WatchSource; title: string; author: string | null; thumb: string | null; warning: string | null };
type Existing = { id: string; title: string };
type Phase = "idle" | "loading" | "preview" | "saving";

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(text.trim());
}

/** Paste a YouTube or X link, check the preview, save. Saving hands the new item back so its notes can open. */
export function WatchPaste({ onSaved, onOpen }: { onSaved: (item: WatchItem) => void; onOpen: (id: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const request = useRef(0);

  function discard() {
    request.current++;
    setPhase("idle");
    setPreview(null);
    setError(null);
    setDuplicate(null);
    setUrl("");
    inputRef.current?.focus();
  }

  async function load(raw = url) {
    const value = raw.trim();
    if (!value) return;
    const mine = ++request.current;
    setPhase("loading");
    setError(null);
    setDuplicate(null);
    setPreview(null);
    try {
      const res = await fetch("/api/watch/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: value }) });
      const body = (await res.json()) as { preview?: Preview; duplicate?: Existing; error?: string };
      if (mine !== request.current) return;
      if (body.duplicate) {
        setPhase("idle");
        return onOpen(body.duplicate.id);
      }
      if (!res.ok || !body.preview) {
        setError(body.error ?? "Could not preview that link.");
        return setPhase("idle");
      }
      setPreview(body.preview);
      setPhase("preview");
    } catch {
      if (mine !== request.current) return;
      setError("Could not reach the server. Check your connection and try again.");
      setPhase("idle");
    }
  }

  async function save() {
    if (!preview || phase === "saving") return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/watch/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: preview.url, title: preview.title }) });
      const body = (await res.json()) as { id?: string; duplicate?: Existing; error?: string };
      if (res.status === 409 && body.duplicate) {
        discard();
        return onOpen(body.duplicate.id);
      }
      if (!res.ok || !body.id) {
        setError(body.error ?? "Could not save that link.");
        return setPhase("preview");
      }
      const item: WatchItem = {
        id: body.id, source_url: preview.url, source_type: preview.source, title: preview.title || preview.url, author: preview.author,
        duration_s: null, notes: "", rev: 0, created_at: new Date().toISOString(), thumb: preview.thumb,
      };
      discard();
      onSaved(item);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPhase("preview");
    }
  }

  function onPaste(e: ClipboardEvent<HTMLElement>) {
    const text = e.clipboardData.getData("text").trim();
    if (e.target === inputRef.current && looksLikeUrl(text)) {
      e.preventDefault();
      setUrl(text);
      void load(text);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void load();
    } else if (e.key === "Escape") discard();
  }

  // Enter saves and Esc discards while a preview is open.
  useEffect(() => {
    if (phase !== "preview") return;
    const onWindowKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "BUTTON" || t === inputRef.current) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") discard();
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  });

  const busy = phase === "loading" || phase === "saving";

  return (
    <section className="paste" onPaste={onPaste} aria-label="Add a video or post">
      <label className="paste-label" htmlFor="watch-url">Add a video or post</label>
      <div className="paste-row">
        <div className="paste-field">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
          <input
            id="watch-url"
            ref={inputRef}
            className="paste-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a YouTube or X link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onKey}
            disabled={phase === "saving"}
          />
        </div>
        <button type="button" className="btn bar-btn paste-go" disabled={busy || !url.trim()} onClick={() => void load()}>
          {phase === "loading" ? "Reading…" : "Preview"}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {duplicate && <p className="hint" role="status">Already saved: {duplicate.title}</p>}

      {preview && (phase === "preview" || phase === "saving") && (
        <article className="preview" aria-busy={phase === "saving"}>
          <div className="preview-poster">
            {preview.thumb ? (
              // Remote thumbnail; no Referer so hotlink checks don't blank it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" />
            ) : (
              <span className="preview-empty"><SourceIcon type={preview.source} /> No preview image</span>
            )}
          </div>
          <div className="preview-body">
            <div className="preview-meta"><SourceIcon type={preview.source} /></div>
            <h2 className="preview-title">{preview.title || preview.url}</h2>
            {preview.author && <p className="preview-author">{preview.author}</p>}
            {preview.warning && <p className="error" role="alert">{preview.warning} You can still save the link.</p>}
            <div className="row preview-actions">
              <button type="button" className="btn bar-btn" onClick={() => void save()} disabled={phase === "saving"}>
                {phase === "saving" ? "Saving…" : "Save"} <kbd className="mono kbd">Enter</kbd>
              </button>
              <button type="button" className="btn secondary bar-btn" onClick={discard} disabled={phase === "saving"}>
                Discard <kbd className="mono kbd">Esc</kbd>
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
