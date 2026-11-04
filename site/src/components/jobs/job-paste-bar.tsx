"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { JobDraft } from "@hub/capture";
import { ImagePlus, Link2 } from "lucide-react";

type Phase = "idle" | "loading" | "preview" | "saving";
type Existing = { id: string; label: string };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(text.trim());
}

const BLANK: JobDraft = { canonicalUrl: null, canonicalKey: "", company: null, role: "", location: null, postedAt: null, description: "", errors: [] };

/** Paste a posting link, or its text, or a screenshot. The preview fields are always editable because postings are often only partly readable. */
export function JobPasteBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl]);

  function fill(d: JobDraft) {
    setDraft(d);
    setCompany(d.company ?? "");
    setRole(d.role);
    setLocation(d.location ?? "");
    setPostedAt(d.postedAt ?? "");
  }

  function discard() {
    requestId.current++;
    setPhase("idle");
    setDraft(null);
    setImage(null);
    setImageUrl(null);
    setError(null);
    setDuplicate(null);
    setUrl("");
    setText("");
    setShowText(false);
    inputRef.current?.focus();
  }

  async function preview(rawUrl = url, rawText = text) {
    const link = rawUrl.trim();
    const body = rawText.trim();
    if (!link && !body) return;
    setPhase("loading");
    setError(null);
    setDuplicate(null);
    setSaved(null);
    setDraft(null);
    const mine = ++requestId.current;
    try {
      const res = await fetch("/api/jobs/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link, text: body }) });
      const data = (await res.json()) as { draft?: JobDraft; duplicate?: Existing; error?: string };
      if (mine !== requestId.current) return;
      if (data.duplicate) {
        setDuplicate(data.duplicate);
        return setPhase("idle");
      }
      if (!res.ok || !data.draft) {
        setError(data.error ?? "Could not preview that posting.");
        return setPhase("idle");
      }
      fill(data.draft);
      if (data.draft.errors.length) setShowText(true);
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
    form.set("payload", JSON.stringify({ url: draft.canonicalUrl ?? "", text, company, role, location, postedAt }));
    if (image) form.set("image", image);
    try {
      const res = await fetch("/api/jobs/save", { method: "POST", body: form });
      const data = (await res.json()) as { id?: string; duplicate?: Existing; error?: string };
      if (res.status === 409 && data.duplicate) {
        setDuplicate(data.duplicate);
        return setPhase("preview");
      }
      if (!res.ok) {
        setError(data.error ?? "Could not save that posting.");
        return setPhase("preview");
      }
      setSaved([role, company].filter(Boolean).join(" at "));
      discard();
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPhase("preview");
    }
  }

  function takeImage(file: File | undefined | null): boolean {
    if (!file || !file.type.startsWith("image/")) return false;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is over 4 MB.");
      return true;
    }
    setError(null);
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
    if (!draft) {
      // A screenshot on its own is enough to start a posting: the fields are filled by hand.
      fill(BLANK);
      setPhase("preview");
    }
    return true;
  }

  function onPaste(e: ClipboardEvent<HTMLElement>) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      takeImage(file);
      return;
    }
    const pasted = e.clipboardData.getData("text").trim();
    if (e.target === inputRef.current && looksLikeUrl(pasted)) {
      e.preventDefault();
      setUrl(pasted);
      void preview(pasted, text);
    }
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (takeImage(e.dataTransfer.files[0])) return;
    const dropped = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
    if (looksLikeUrl(dropped)) {
      setUrl(dropped.trim());
      void preview(dropped, text);
    }
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void preview();
    } else if (e.key === "Escape") discard();
  }

  const busy = phase === "loading" || phase === "saving";
  const hasInput = !!url.trim() || !!text.trim();

  return (
    <section className="paste" onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} aria-label="Add a job posting">
      <label className="paste-label" htmlFor="job-url">Add a job posting</label>
      <div className="paste-row">
        <div className="paste-field">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
          <input
            id="job-url"
            ref={inputRef}
            className="paste-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a posting link, or drop a screenshot"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={onInputKey}
            disabled={phase === "saving"}
          />
        </div>
        <button type="button" className="btn bar-btn paste-go" disabled={busy || !hasInput} onClick={() => void preview()}>
          {phase === "loading" ? "Reading…" : "Preview"}
        </button>
      </div>

      <button type="button" className="btn secondary bar-btn job-text-toggle" aria-expanded={showText} onClick={() => setShowText((v) => !v)}>
        {showText ? "Hide posting text" : "Paste the posting text instead"}
      </button>
      {showText && (
        <textarea
          className="input preview-text"
          aria-label="Posting text"
          placeholder="Paste the posting here. Lines like “Company: Acme” are picked up."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={20000}
        />
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="hint" role="status">Saved {saved ? `“${saved}”` : "the posting"} as To apply.</p>}
      {duplicate && <p className="hint" role="status">Already saved: {duplicate.label}</p>}

      {draft && (phase === "preview" || phase === "saving") && (
        <article className="preview" aria-busy={phase === "saving"}>
          <div className="preview-poster">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" />
            ) : (
              <span className="preview-empty"><ImagePlus size={20} strokeWidth={1.5} aria-hidden /> Paste or drop a screenshot</span>
            )}
          </div>
          <div className="preview-body">
            <div className="job-fields">
              <div className="field">
                <label htmlFor="job-role">Role</label>
                <input id="job-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} maxLength={200} />
              </div>
              <div className="field">
                <label htmlFor="job-company">Company</label>
                <input id="job-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
              </div>
              <div className="field">
                <label htmlFor="job-location">Location</label>
                <input id="job-location" className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
              </div>
              <div className="field">
                <label htmlFor="job-posted">Posted</label>
                <input id="job-posted" className="input" type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
              </div>
            </div>
            {draft.description && <p className="preview-desc">{draft.description}</p>}

            {draft.errors.length > 0 && (
              <p className="error" role="alert">{draft.errors[0].message}</p>
            )}

            <div className="row preview-actions">
              <button type="button" className="btn bar-btn" onClick={() => void save()} disabled={phase === "saving" || !!duplicate}>
                {phase === "saving" ? "Saving…" : "Save"}
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
