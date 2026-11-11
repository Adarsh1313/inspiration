"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Pencil, X } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { ListTextarea } from "@/components/projects/list-textarea";
import { onLoad, onRemote, onSaveResult, wordCount, type LocalDraft } from "@/lib/notepad-sync";
import { browserClient } from "@/lib/supabase-browser";
import { linkifyTimestamps, withConflictCopy, type WatchItem } from "@/lib/watch/notes";

const DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

type Status = "saved" | "saving" | "offline" | "gone";
type Latest = { text: string; rev: number; dirty: boolean };

const draftKey = (id: string) => `watch-draft:${id}`;
function readDraft(id: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string, d: LocalDraft) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(d));
  } catch {}
}

/** A right-hand panel (full screen on phones) with the item's notes. A native modal dialog: Esc closes it and focus stays inside. */
export function WatchDrawer({ item, onClose, onNotes }: { item: WatchItem; onClose: () => void; onNotes: (id: string, notes: string, rev: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(item.notes);
  const [editing, setEditing] = useState(item.notes.trim() === "");
  const [status, setStatus] = useState<Status>("saved");
  const latest = useRef<Latest>({ text: item.notes, rev: item.rev, dirty: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const { id } = item;

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const set = useCallback((next: Latest) => {
    latest.current = next;
    setText(next.text);
    writeDraft(id, { text: next.text, baseRev: next.rev, dirty: next.dirty });
  }, [id]);

  const save = useCallback(async (): Promise<void> => {
    if (saving.current || !latest.current.dirty) return;
    if (!navigator.onLine) return setStatus("offline");
    saving.current = true;
    setStatus("saving");
    const sent = latest.current.text;
    const { data, error } = await browserClient().rpc("save_watch_notes", { p_id: id, p_text: sent, p_base_rev: latest.current.rev });
    saving.current = false;
    if (error) {
      setStatus("offline");
      retry.current = setTimeout(() => void save(), RETRY_MS);
      return;
    }
    const row = (data as { ok: boolean; new_text: string; new_rev: number }[] | null)?.[0];
    if (!row) return setStatus("gone"); // the item was deleted elsewhere

    const typedSince = latest.current.text !== sent;
    if (row.ok) {
      onNotes(id, sent, row.new_rev);
      if (typedSince) {
        set({ text: latest.current.text, rev: row.new_rev, dirty: true });
        return void save();
      }
      set({ text: sent, rev: row.new_rev, dirty: false });
      return setStatus("saved");
    }

    // Another device saved first: keep their notes and put ours below under a divider.
    const merged = onSaveResult(typedSince ? latest.current.text : sent, { ok: false, text: row.new_text, rev: row.new_rev });
    const combined = merged.archive ? withConflictCopy(merged.text, merged.archive) : merged.text;
    set({ text: combined, rev: merged.rev, dirty: combined !== merged.text });
    if (combined !== merged.text) return void save();
    onNotes(id, merged.text, merged.rev);
    setStatus("saved");
  }, [id, onNotes, set]);

  // Open the drawer: reconcile an offline draft with the stored notes.
  useEffect(() => {
    const local = readDraft(id);
    if (local?.dirty) {
      const s = onLoad(local, { text: item.notes, rev: item.rev });
      const combined = s.archive ? withConflictCopy(s.text, s.archive) : s.text;
      set({ text: combined, rev: s.rev, dirty: s.dirty || combined !== s.text });
      setEditing(true);
      void save();
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notes changed on another device.
  useEffect(() => {
    const next = onRemote(latest.current, { text: item.notes, rev: item.rev });
    if (next) set({ text: next.text, rev: next.rev, dirty: next.dirty });
  }, [item.notes, item.rev, set]);

  useEffect(() => {
    const online = () => void save();
    const offline = () => setStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      clearTimeout(timer.current);
      clearTimeout(retry.current);
    };
  }, [save]);

  function change(next: string) {
    set({ ...latest.current, text: next, dirty: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }

  // Leaving with unsaved typing: flush it.
  function close() {
    clearTimeout(timer.current);
    void save();
    onClose();
  }

  const words = wordCount(text);
  const statusLabel = status === "saving" ? "Saving…" : status === "offline" ? "Offline, kept on this device" : status === "gone" ? "This item was deleted" : "Saved";
  const parts = linkifyTimestamps(text, item.source_type, item.source_url, item.duration_s);

  return (
    <dialog
      ref={dialog}
      className="wdrawer"
      aria-label={`Notes for ${item.title}`}
      onClose={close}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
    >
      <div className="wdrawer-panel">
        <header className="wdrawer-head">
          <div className="wdrawer-title">
            <SourceIcon type={item.source_type} />
            <h2>{item.title}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close notes" onClick={() => dialog.current?.close()}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        <p className="wdrawer-meta">
          {item.author && <span>{item.author}</span>}
          <a className="link" href={item.source_url} target="_blank" rel="noopener noreferrer">
            Open original <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
          </a>
        </p>

        {editing ? (
          <ListTextarea
            className="wdrawer-area"
            value={text}
            onValueChange={change}
            placeholder="Write your notes…"
            aria-label="Notes"
            autoFocus
            spellCheck
          />
        ) : (
          <div className="wdrawer-read">
            <div className="wdrawer-read-text" onClick={(e) => !(e.target as HTMLElement).closest("a") && setEditing(true)}>
              {parts.map((p, i) =>
                p.type === "time" ? (
                  <a key={i} className="wtime mono" href={p.href} target="_blank" rel="noopener noreferrer">{p.text}</a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </div>
            <button type="button" className="btn secondary bar-btn" onClick={() => setEditing(true)}>
              <Pencil size={14} strokeWidth={1.5} /> Edit notes
            </button>
          </div>
        )}

        <footer className="wdrawer-foot mono" aria-live="polite">
          {words} {words === 1 ? "word" : "words"} · {statusLabel}
          {editing && text.trim() !== "" && (
            <button type="button" className="wdrawer-done" onClick={() => setEditing(false)}>Done</button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
