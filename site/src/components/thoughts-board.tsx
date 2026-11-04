"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Pin, Plus, Trash2 } from "lucide-react";
import { browserClient } from "@/lib/supabase-browser";
import { NOTE_COLOURS, sortNotes, type Note } from "@/lib/notes";

const DEBOUNCE_MS = 500;

export function ThoughtsBoard({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initial);
  const [showArchived, setShowArchived] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(async (id: string, changes: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
    const { error } = await browserClient().from("notes").update(changes).eq("id", id);
    setError(error ? "Could not save that change." : null);
  }, []);

  const add = useCallback(async () => {
    const { data, error } = await browserClient().from("notes").insert({}).select().single();
    if (error || !data) return setError("Could not add a note.");
    setError(null);
    setShowArchived(false);
    setNotes((prev) => [data as Note, ...prev]);
    setFocusId(data.id);
  }, []);

  async function remove(id: string) {
    const { error } = await browserClient().from("notes").delete().eq("id", id);
    if (error) return setError("Could not delete that note.");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  // N adds a note, unless you are already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) return;
      e.preventDefault();
      void add();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [add]);

  const visible = sortNotes(notes.filter((n) => (showArchived ? n.status === "archived" : n.status === "active")));

  return (
    <>
      <div className="board-bar">
        <div className="row">
          <button type="button" className="btn bar-btn" onClick={() => void add()}>
            <Plus size={14} strokeWidth={1.5} /> New note <kbd className="mono kbd">N</kbd>
          </button>
          <button type="button" className="btn secondary bar-btn" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Archive size={14} strokeWidth={1.5} /> {showArchived ? "Back to notes" : "Archived"}
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      {visible.length === 0 ? (
        <div className="placeholder">{showArchived ? "Nothing archived." : "No notes yet. Press N to add one."}</div>
      ) : (
        <div className="board">
          {visible.map((note) => (
            <NoteCard key={note.id} note={note} autoFocus={note.id === focusId} patch={patch} remove={remove} />
          ))}
        </div>
      )}
    </>
  );
}

function NoteCard({
  note,
  autoFocus,
  patch,
  remove,
}: {
  note: Note;
  autoFocus: boolean;
  patch: (id: string, changes: Partial<Note>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState(note.text);
  const [tag, setTag] = useState(note.tag ?? "");
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) area.current?.focus();
  }, [autoFocus]);

  function typed(next: string) {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void patch(note.id, { text: next }), DEBOUNCE_MS);
  }

  return (
    <article className="note" data-colour={note.colour} data-pinned={note.pinned}>
      <textarea ref={area} className="note-text" value={text} onChange={(e) => typed(e.target.value)} placeholder="Write a thought…" aria-label="Note text" />
      <input
        className="note-tag mono"
        value={tag}
        placeholder="tag"
        aria-label="Tag"
        onChange={(e) => setTag(e.target.value)}
        onBlur={() => tag !== (note.tag ?? "") && void patch(note.id, { tag: tag.trim() || null })}
      />
      <div className="note-actions">
        <div className="swatches" role="group" aria-label="Colour">
          {NOTE_COLOURS.map((c) => (
            <button key={c} type="button" className="swatch" data-colour={c} aria-label={c} aria-pressed={note.colour === c} onClick={() => void patch(note.id, { colour: c })} />
          ))}
        </div>
        <div className="row">
          <button type="button" className="icon-btn" aria-label={note.pinned ? "Unpin" : "Pin"} aria-pressed={note.pinned} onClick={() => void patch(note.id, { pinned: !note.pinned })}>
            <Pin size={14} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" aria-label={note.status === "archived" ? "Restore" : "Archive"} onClick={() => void patch(note.id, { status: note.status === "archived" ? "active" : "archived" })}>
            {note.status === "archived" ? <ArchiveRestore size={14} strokeWidth={1.5} /> : <Archive size={14} strokeWidth={1.5} />}
          </button>
          {confirming ? (
            <button type="button" className="icon-btn danger" onClick={() => void remove(note.id)} onBlur={() => setConfirming(false)} autoFocus>
              Delete?
            </button>
          ) : (
            <button type="button" className="icon-btn" aria-label="Delete" onClick={() => setConfirming(true)}>
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
