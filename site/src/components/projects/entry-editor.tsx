"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase-browser";
import { todayIST, type Entry } from "@/lib/projects/day-blocks";
import { onLoad, onRemote, onSaveResult, type NotepadState } from "@/lib/notepad-sync";
import type { ProjectEntry } from "@/lib/projects/store";
import { ListTextarea } from "./list-textarea";

const DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

type Draft = { text: string; baseRev: number; dirty: boolean; entryId: string | null };
type Row = { ok: boolean; entry_id: string | null; new_seq: number; new_text: string; new_rev: number; ticketed: boolean; gone: boolean };
type Status = "saved" | "saving" | "offline";
type Latest = { text: string; rev: number; dirty: boolean; id: string | null };

const draftKey = (slug: string) => `project-draft:${slug}`;
function readDraft(slug: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(slug));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(slug: string, d: Draft) {
  try {
    localStorage.setItem(draftKey(slug), JSON.stringify(d));
  } catch {}
}

/** The plain-text editor bound to a project's open entry. Autosaves with compare-and-set and follows realtime updates. */
export function EntryEditor({
  projectId, slug, name, open, onEntry, onGone,
}: {
  projectId: string;
  slug: string;
  name: string;
  open: Entry | null;
  onEntry: (e: ProjectEntry) => void;
  onGone: (id: string) => void;
}) {
  const [text, setText] = useState(open?.text ?? "");
  const [status, setStatus] = useState<Status>("saved");
  const latest = useRef<Latest>({ text: open?.text ?? "", rev: open?.rev ?? 0, dirty: false, id: open?.id ?? null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);

  const set = useCallback((next: Latest) => {
    latest.current = next;
    setText(next.text);
    writeDraft(slug, { text: next.text, baseRev: next.rev, dirty: next.dirty, entryId: next.id });
  }, [slug]);

  const rpc = useCallback(async (id: string | null, body: string, rev: number): Promise<Row | null> => {
    const { data, error } = await browserClient().rpc("save_project_entry", {
      p_id: id, p_project: projectId, p_day: todayIST(new Date()), p_text: body, p_base_rev: rev,
    });
    const row = (data as Row[] | null)?.[0];
    return error || !row ? null : row;
  }, [projectId]);

  const publish = useCallback((row: Row, body: string) => {
    if (row.entry_id && !row.gone) {
      onEntry({ id: row.entry_id, project_id: projectId, day: todayIST(new Date()), seq: row.new_seq, text: body, rev: row.new_rev, ticketed_at: null, issues: [] });
    }
  }, [onEntry, projectId]);

  const save = useCallback(async (): Promise<void> => {
    if (saving.current || !latest.current.dirty) return;
    if (!navigator.onLine) return setStatus("offline");
    saving.current = true;
    setStatus("saving");
    const sent = latest.current.text;
    const sentId = latest.current.id;
    const row = await rpc(sentId, sent, latest.current.rev);
    saving.current = false;
    if (!row) {
      setStatus("offline");
      retry.current = setTimeout(() => void save(), RETRY_MS);
      return;
    }
    const typedSince = latest.current.text !== sent;

    if (row.ok) {
      const id = row.gone ? null : row.entry_id;
      const rev = row.gone ? 0 : row.new_rev;
      if (row.gone && sentId) onGone(sentId);
      publish(row, sent);
      if (typedSince) {
        set({ ...latest.current, rev, id, dirty: true });
        return void save();
      }
      set({ text: sent, rev, id, dirty: false });
      return setStatus("saved");
    }

    if (row.ticketed || row.gone) {
      // The entry was ticketed (or removed) elsewhere: this text starts a new entry.
      set({ ...latest.current, id: null, rev: 0, dirty: true });
      return void save();
    }

    // Someone else saved first. Adopt their version and keep ours as a separate entry.
    const merged: NotepadState = onSaveResult(typedSince ? latest.current.text : sent, { ok: false, text: row.new_text, rev: row.new_rev });
    publish(row, row.new_text);
    if (merged.archive) {
      set({ text: merged.archive, rev: 0, dirty: true, id: null });
      return void save();
    }
    set({ text: merged.text, rev: merged.rev, dirty: false, id: row.entry_id });
    setStatus("saved");
  }, [rpc, publish, onGone, set]);

  // Open the card: reconcile an offline draft with the server's open entry.
  useEffect(() => {
    const local = readDraft(slug);
    if (local?.dirty && local.entryId === (open?.id ?? null)) {
      const s = onLoad({ text: local.text, baseRev: local.baseRev, dirty: true }, { text: open?.text ?? "", rev: open?.rev ?? 0 });
      set({ text: s.text, rev: s.rev, dirty: s.dirty, id: open?.id ?? null });
    } else if (local?.dirty) {
      set({ text: local.text, rev: 0, dirty: true, id: null }); // orphaned draft: save it as a new entry
    }
    if (latest.current.dirty) void save();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the entry that other devices (or the agent) change.
  useEffect(() => {
    const cur = latest.current;
    if ((open?.id ?? null) !== cur.id) {
      if (!cur.dirty) set({ text: open?.text ?? "", rev: open?.rev ?? 0, dirty: false, id: open?.id ?? null });
      return;
    }
    if (open) {
      const next = onRemote(cur, { text: open.text, rev: open.rev });
      if (next) set({ text: next.text, rev: next.rev, dirty: next.dirty, id: cur.id });
    }
  }, [open, set]);

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

  return (
    <div className="pe">
      <ListTextarea
        className="pe-area"
        value={text}
        onValueChange={change}
        placeholder="Dump ideas…"
        aria-label={`${name} notes for today`}
        spellCheck
      />
      <span className="pe-status mono" aria-live="polite" data-status={status}>
        {status === "saving" ? "Saving…" : status === "offline" ? "Offline, kept on this device" : text.trim() ? "Saved" : ""}
      </span>
    </div>
  );
}
