"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { Draft, Shelf } from "@hub/capture";
import { ImagePlus, Link2 } from "lucide-react";
import { SHELF_OPTIONS, SOURCE_LABEL } from "@/lib/source-labels";

type Existing = { slug: string; title: string };
type Phase = "idle" | "loading" | "preview" | "saving";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(text.trim());
}

export function PasteBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shelf, setShelf] = useState<Shelf>("landing-pages-portfolios");
  const [editing, setEditing] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const previewedRaw = useRef("");
  const requestId = useRef(0);

  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl]);

  function discard() {
    requestId.current++; // drop any preview still loading
    setPhase("idle");
    setDraft(null);
    setEditing(false);
    setImage(null);
    setImageUrl(null);
    setError(null);
    setDuplicate(null);
    setUrl("");
    inputRef.current?.focus();
  }

  async function preview(raw = url) {
    const value = raw.trim();
    if (!value) return;
    setPhase("loading");
    setError(null);
    setDuplicate(null);
    setSaved(null);
    setDraft(null);
    previewedRaw.current = value;
    const mine = ++requestId.current;
    try {
      const res = await fetch("/api/capture/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: value }) });
      const body = (await res.json()) as { draft?: Draft; duplicate?: Existing; error?: string };
      if (mine !== requestId.current) return;
      if (body.duplicate) {
        setDuplicate(body.duplicate);
        return setPhase("idle");
      }
      if (!res.ok || !body.draft) {
        setError(body.error ?? "Could not preview that link.");
        return setPhase("idle");
      }
      setDraft(body.draft);
      setTitle(body.draft.title);
      setDescription(body.draft.description);
      setShelf(body.draft.suggestedShelf);
      setPhase("preview");
    } catch {
      if (mine !== requestId.current) return;
      setError("Could not reach the server. Check your connection and try again.");
      setPhase("idle");
    }
  }

  async function save() {
    if (!draft || phase === "saving") return;
    setPhase("saving");
    setError(null);
    const form = new FormData();
    form.set("payload", JSON.stringify({ url: draft.canonicalUrl, title, description, shelf }));
    if (image) form.set("image", image);
    try {
      const res = await fetch("/api/capture/save", { method: "POST", body: form });
      const body = (await res.json()) as { slug?: string; duplicate?: Existing; error?: string };
      if (res.status === 409 && body.duplicate) {
        setDuplicate(body.duplicate);
        return setPhase("preview");
      }
      if (!res.ok) {
        setError(body.error ?? "Could not save that card.");
        return setPhase("preview");
      }
      setSaved(title || draft.canonicalUrl);
      discard();
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPhase("preview");
    }
  }

  function takeImage(file: File | undefined | null): boolean {
    if (!file || !file.type.startsWith("image/")) return false;
    if (!draft) {
      setError("Paste a link first, then add the image.");
      return true;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is over 4 MB.");
      return true;
    }
    setError(null);
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
    return true;
  }

  function onPaste(e: ClipboardEvent<HTMLElement>) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      takeImage(file);
      return;
    }
    const text = e.clipboardData.getData("text").trim();
    if (e.target === inputRef.current && looksLikeUrl(text)) {
      e.preventDefault();
      setUrl(text);
      void preview(text);
    }
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (takeImage(e.dataTransfer.files[0])) return;
    const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
    if (looksLikeUrl(text)) {
      setUrl(text.trim());
      void preview(text);
    }
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (phase === "preview" && draft && url.trim() === previewedRaw.current) void save();
      else void preview();
    } else if (e.key === "Escape") discard();
  }

  // Enter saves and Esc discards while a preview is open, unless you are typing a description.
  useEffect(() => {
    if (phase !== "preview") return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.tagName === "BUTTON" || t === inputRef.current) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") discard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const busy = phase === "loading" || phase === "saving";
  const posterSrc = imageUrl ?? draft?.posterUrl ?? null;
  const isPrivateWall = draft?.errors.some((e) => e.code === "authwall" || e.code === "blocked");

  return (
    <section className="paste" onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} aria-label="Add a reference">
      <label className="paste-label" htmlFor="paste-url">Add a reference</label>
      <div className="paste-row">
        <div className="paste-field">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
          <input
            id="paste-url"
            ref={inputRef}
            className="paste-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a link, or drop an image"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onInputKey}
            disabled={phase === "saving"}
          />
        </div>
        <button type="button" className="btn bar-btn paste-go" disabled={busy || !url.trim()} onClick={() => void preview()}>
          {phase === "loading" ? "Reading…" : "Preview"}
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="hint" role="status">Saved “{saved}” as a draft. Media pending.</p>}
      {duplicate && (
        <p className="hint" role="status">
          Already saved: <a className="link" href={`/r/${duplicate.slug}`}>{duplicate.title || duplicate.slug}</a>
        </p>
      )}

      {draft && (phase === "preview" || phase === "saving") && (
        <article className="preview" aria-busy={phase === "saving"}>
          <div className="preview-poster">
            {posterSrc ? (
              // Remote poster from the fetched page; no Referer so hotlink checks don't blank it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterSrc} alt="" referrerPolicy="no-referrer" loading="lazy" />
            ) : (
              <span className="preview-empty"><ImagePlus size={20} strokeWidth={1.5} aria-hidden /> No preview yet</span>
            )}
          </div>
          <div className="preview-body">
            <div className="preview-meta">
              <span className="chip">{SOURCE_LABEL[draft.sourceType]}</span>
              {draft.mediaUrl && <span className="chip">Clip</span>}
              {image && <span className="chip">Your image</span>}
            </div>

            {editing ? (
              <>
                <input className="input" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                <textarea className="input preview-text" aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
              </>
            ) : (
              <>
                <h2 className="preview-title">{title || draft.canonicalUrl}</h2>
                {draft.author && <p className="preview-author">{draft.author}</p>}
                {description && <p className="preview-desc">{description}</p>}
              </>
            )}

            <div className="field preview-shelf">
              <label htmlFor="paste-shelf">Shelf</label>
              <select id="paste-shelf" className="input" value={shelf} onChange={(e) => setShelf(e.target.value as Shelf)}>
                {SHELF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {draft.errors.length > 0 && (
              <p className="error" role="alert">
                {draft.errors[0].message}{" "}
                {isPrivateWall || !draft.posterUrl ? "You can still save the link. Paste or drop a screenshot to use as the preview." : "You can still save the link."}
              </p>
            )}
            {duplicate && (
              <p className="hint" role="status">
                Already saved: <a className="link" href={`/r/${duplicate.slug}`}>{duplicate.title || duplicate.slug}</a>
              </p>
            )}

            <div className="row preview-actions">
              <button type="button" className="btn bar-btn" onClick={() => void save()} disabled={phase === "saving" || !!duplicate}>
                {phase === "saving" ? "Saving…" : "Save"} <kbd className="mono kbd">Enter</kbd>
              </button>
              <button type="button" className="btn secondary bar-btn" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
                {editing ? "Done editing" : "Edit before saving"}
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
