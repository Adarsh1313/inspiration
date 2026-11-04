"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Eraser } from "lucide-react";
import { browserClient } from "@/lib/supabase-browser";
import { onLoad, onRemote, onSaveResult, wordCount, type LocalDraft, type NotepadState, type Server } from "@/lib/notepad-sync";

const DRAFT_KEY = "notepad-draft";
const DEBOUNCE_MS = 500;

type Status = "saved" | "saving" | "offline";

function readDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
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

  const apply = useCallback((s: NotepadState) => {
    latest.current = { text: s.text, rev: s.rev, dirty: s.dirty };
    setText(s.text);
    writeDraft({ text: s.text, baseRev: s.rev, dirty: s.dirty });
    if (s.archive) void browserClient().from("notepad_archive").insert({ text: s.archive, reason: "conflict" });
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
    if (error || !row) return setStatus("offline");

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

  // On open: reconcile any offline draft with the server row.
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
  }, [initial, apply, save]);

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
    const online = () => void save();
    const offline = () => setStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [apply, save]);

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
    const { error } = await browserClient().from("notepad_archive").insert({ text: current, reason: "cleared" });
    if (error) return setStatus("offline");
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
