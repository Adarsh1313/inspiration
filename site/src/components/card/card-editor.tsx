"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { updateCard } from "@/app/(app)/design/actions";
import { SHELF_OPTIONS } from "@/lib/source-labels";

export type EditableCard = {
  slug: string;
  title: string;
  summary: string | null;
  shelf: string;
  tags: string[];
  mood: { variance?: number; motion?: number; density?: number };
};

/** Inline editor for the fields a draft usually needs fixed: title, summary, shelf, tags and mood. */
export function CardEditor({ card }: { card: EditableCard }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    setSaving(true);
    setError(null);
    const result = await updateCard(card.slug, {
      title: text("title"),
      summary: text("summary"),
      shelf: text("shelf"),
      tags: text("tags"),
      variance: text("variance"),
      motion: text("motion"),
      density: text("density"),
    }).catch(() => ({ ok: false as const, error: "That did not save. Try again." }));
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn secondary bar-btn" onClick={() => setOpen(true)}>
        <Pencil size={16} strokeWidth={1.5} aria-hidden /> Edit card
      </button>
    );
  }

  return (
    <form className="editor" onSubmit={(e) => void onSubmit(e)} aria-label="Edit card">
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input id="edit-title" name="title" className="input" defaultValue={card.title} maxLength={200} required />
      </div>
      <div className="field">
        <label htmlFor="edit-summary">Summary</label>
        <textarea id="edit-summary" name="summary" className="input preview-text" defaultValue={card.summary ?? ""} rows={4} maxLength={2000} />
      </div>
      <div className="field">
        <label htmlFor="edit-shelf">Shelf</label>
        <select id="edit-shelf" name="shelf" className="input" defaultValue={card.shelf}>
          {SHELF_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="edit-tags">Tags</label>
        <input id="edit-tags" name="tags" className="input" defaultValue={card.tags.join(", ")} placeholder="hover, easing, serif" />
      </div>
      <fieldset className="editor-moods">
        <legend>Mood dials, 1 to 10 (leave blank to clear)</legend>
        {(["variance", "motion", "density"] as const).map((k) => (
          <div key={k} className="field">
            <label htmlFor={`edit-${k}`}>{k[0].toUpperCase() + k.slice(1)}</label>
            <input id={`edit-${k}`} name={k} className="input" type="number" inputMode="numeric" min={1} max={10} step={1} defaultValue={card.mood[k] ?? ""} />
          </div>
        ))}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row preview-actions">
        <button type="submit" className="btn bar-btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn secondary bar-btn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
