"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Eraser } from "lucide-react";
import { browserClient } from "@/lib/supabase-browser";
import { onLoad, onRemote, onSaveResult, wordCount, type LocalDraft, type NotepadState, type Server } from "@/lib/notepad-sync";

const DRAFT_KEY = "notepad-draft";
const DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

type Status = "saved" | "saving" | "offline";

function readDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

const QUEUE_KEY = "notepad-archive-queue";
type Pending = { text: string; reason: "cleared" | "conflict" };

function readQueue(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}

function writeQueue(q: Pending[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

/** Archive a copy; if that fails, keep it on this device and retry later so words are never lost. */
async function archiveSafely(item: Pending): Promise<boolean> {
  const { error } = await browserClient().from("notepad_archive").insert(item);
  if (error) writeQueue([...readQueue(), item]);
  return !error;
}

async function flushQueue() {
  const queue = readQueue();
  if (!queue.length) return;
  writeQueue([]);
  for (const item of queue) await archiveSafely(item);
}

function writeDraft(draft: LocalDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

export function NotepadEditor({ initial }: { initial: Server | null }) {
  const [text, setText] = useState(initial?.text ?? "");
  const [status, setStatus] = useState<Status>("saved");
  const [copied, setCopied] = useState(false);

  // Latest values for async callbacks.
  const latest = useRef({ text: initial?.text ?? "", rev: initial?.rev ?? 0, dirty: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = useCallback((s: NotepadState) => {
    latest.current = { text: s.text, rev: s.rev, dirty: s.dirty };
    setText(s.text);
    writeDraft({ text: s.text, baseRev: s.rev, dirty: s.dirty });
    if (s.archive) void archiveSafely({ text: s.archive, reason: "conflict" });
  }, []);

  const save = useCallback(async () => {
    if (saving.current || !latest.current.dirty) return;
    if (!navigator.onLine) return setStatus("offline");
    saving.current = true;
    setStatus("saving");
    const sent = latest.current.text;
    const { data, error } = await browserClient().rpc("save_notepad", { p_text: sent, p_base_rev: latest.current.rev });
    saving.current = false;
    const row = data?.[0];
    if (error || !row) {
      setStatus("offline");
      retry.current = setTimeout(() => void save(), RETRY_MS);
      return;
    }

    const typedSince = latest.current.text !== sent;
    const result = { ok: row.ok, text: row.new_text, rev: row.new_rev };
    if (result.ok && typedSince) {
      // Saved, but there is newer typing: keep it dirty on the new rev.
      latest.current = { text: latest.current.text, rev: result.rev, dirty: true };
      writeDraft({ text: latest.current.text, baseRev: result.rev, dirty: true });
      return void save();
    }
    apply(onSaveResult(typedSince ? latest.current.text : sent, result));
    setStatus("saved");
  }, [apply]);

  // Fetch the current server row and reconcile it with any offline draft.
  // Also covers a page served from the offline cache with a stale row.
  const refresh = useCallback(async () => {
    const { data } = await browserClient().from("notepad").select("text, rev").eq("id", 1).maybeSingle();
    if (data) {
      apply(onLoad(readDraft(), data));
      if (latest.current.dirty) void save();
    }
  }, [apply, save]);

  useEffect(() => {
    if (initial) {
      apply(onLoad(readDraft(), initial));
      if (latest.current.dirty) void save();
    } else {
      const local = readDraft();
      if (local) {
        latest.current = { text: local.text, rev: local.baseRev, dirty: local.dirty };
        setText(local.text);
        setStatus("offline");
      }
    }
    void flushQueue();
    if (navigator.onLine) void refresh();
  }, [initial, apply, save, refresh]);

  // Realtime updates from other devices, and retry when back online.
  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel("notepad")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notepad" }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as { text: string; rev: number };
        const next = onRemote(latest.current, { text: row.text, rev: row.rev });
        if (next) apply(next);
      })
      .subscribe();
    const online = () => {
      void flushQueue();
      void refresh();
    };
    const offline = () => setStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [apply, save, refresh]);

  function change(next: string) {
    setText(next);
    latest.current = { ...latest.current, text: next, dirty: true };
    writeDraft({ text: next, baseRev: latest.current.rev, dirty: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }

  async function clear() {
    const current = latest.current.text;
    if (current.trim() === "") return;
    // Archive first so clearing is never destructive.
    const archived = await archiveSafely({ text: current, reason: "cleared" });
    if (!archived) setStatus("offline");
    change("");
    void save();
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "notepad.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const words = wordCount(text);
  const statusLabel = status === "saving" ? "Saving…" : status === "offline" ? "Offline, saved on this device" : "Saved";

  return (
    <div className="notepad">
      <textarea
        className="notepad-area"
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder="Start typing…"
        aria-label="Notepad"
        spellCheck
      />
      <div className="notepad-bar">
        <span className="mono" aria-live="polite">{words} {words === 1 ? "word" : "words"} · {statusLabel}</span>
        <div className="row">
          <button type="button" className="btn secondary bar-btn" onClick={copyAll}>
            <Copy size={14} strokeWidth={1.5} /> {copied ? "Copied" : "Copy all"}
          </button>
          <button type="button" className="btn secondary bar-btn" onClick={download}>
            <Download size={14} strokeWidth={1.5} /> Download .txt
          </button>
          <button type="button" className="btn secondary bar-btn" onClick={clear}>
            <Eraser size={14} strokeWidth={1.5} /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
