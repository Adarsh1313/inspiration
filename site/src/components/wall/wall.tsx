"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { browserClient } from "@/lib/supabase-browser";
import { nextColour } from "@/lib/wall/colour";
import { NOTE_COLUMNS, WALL, type WallGroup, type WallNote } from "@/lib/wall/model";
import { NOTE_SIZE, clampToWall, freeSpot, snapIntoGroup, type Point } from "@/lib/wall/placement";
import { mulberry32 } from "@/lib/wall/rng";
import { WallNoteView } from "./wall-note";

export function Wall({ initialNotes, initialGroups }: { initialNotes: WallNote[]; initialGroups: WallGroup[] }) {
  const [notes, setNotes] = useState<WallNote[]>(initialNotes);
  const [groups] = useState<WallGroup[]>(initialGroups);
  const [newId, setNewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const rng = useRef<() => number>(() => 0.5);
  const editingCount = useRef(0);
  const ignoreNextClick = useRef(false);
  const lastPointer = useRef<string>("mouse");

  useEffect(() => {
    rng.current = mulberry32(Date.now());
  }, []);

  const patch = useCallback(async (id: string, changes: Partial<WallNote>) => {
    const before = notesRef.current.find((n) => n.id === id);
    if (!before) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
    const { error } = await browserClient().from("notes").update(changes).eq("id", id);
    if (error) {
      // Put back what was really saved.
      const reverted = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k as keyof WallNote]]));
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...reverted } : n)));
      setError("Could not save that change.");
    } else setError(null);
  }, []);

  const add = useCallback(async (at?: Point) => {
    const current = notesRef.current;
    const counts: Record<string, number> = {};
    for (const n of current) counts[n.colour] = (counts[n.colour] ?? 0) + 1;
    const recent = [...current].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n) => n.colour);
    const colour = nextColour(recent, counts, rng.current);
    const pos = at ? clampToWall(at, WALL) : freeSpot(current, WALL, rng.current);
    const rotation = Math.round((rng.current() * 8 - 4) * 10) / 10;
    const z = Math.max(0, ...current.map((n) => n.z)) + 1;

    const { data, error } = await browserClient()
      .from("notes")
      .insert({ text: "", colour, x: pos.x, y: pos.y, rotation, z })
      .select(NOTE_COLUMNS)
      .single();
    if (error || !data) return setError("Could not add a note.");
    setError(null);
    setNotes((prev) => [...prev, data as WallNote]);
    setNewId(data.id);
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await browserClient().from("notes").delete().eq("id", id);
    if (error) return setError("Could not delete that note.");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const moved = useCallback(
    (id: string, p: Point) => {
      const z = Math.max(0, ...notesRef.current.map((n) => n.z)) + 1;
      const frames = groupsRef.current.map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h }));
      void patch(id, { x: p.x, y: p.y, z, group_id: snapIntoGroup(p, frames) });
    },
    [patch],
  );

  const onEditing = useCallback((editing: boolean) => {
    editingCount.current = Math.max(0, editingCount.current + (editing ? 1 : -1));
  }, []);

  // N adds a note, unless you are already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) return;
      e.preventDefault();
      void add();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [add]);

  const ordered = useMemo(() => notes, [notes]);

  return (
    <>
      <div className="wall-head">
        <div>
          <PageHeader title="Thoughts" lede="A wall of sticky notes for loose ideas. Click empty space or press N to add one." />
        </div>
        <button type="button" className="btn bar-btn wall-add" onClick={() => void add()}>
          <Plus size={14} strokeWidth={1.5} /> New note <kbd className="mono kbd">N</kbd>
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="wall" aria-label="Thoughts wall">
        <div
          className="wall-canvas"
          style={{ width: WALL.width, height: WALL.height }}
          onPointerDown={(e) => {
            lastPointer.current = e.pointerType;
            // Clicking out of a note being edited only ends the edit; it does not add a note.
            ignoreNextClick.current = editingCount.current > 0;
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (ignoreNextClick.current || lastPointer.current === "touch") return;
            const r = e.currentTarget.getBoundingClientRect();
            void add({ x: e.clientX - r.left - NOTE_SIZE / 2, y: e.clientY - r.top - NOTE_SIZE / 2 });
          }}
        >
          {groups.map((g) => (
            <div key={g.id} className="wall-frame" style={{ left: g.x, top: g.y, width: g.w, height: g.h }}>
              <span className="wall-frame-label">{g.name}</span>
            </div>
          ))}
          {ordered.map((n) => (
            <WallNoteView key={n.id} note={n} isNew={n.id === newId} onPatch={patch} onDelete={remove} onMoved={moved} onEditing={onEditing} />
          ))}
          {notes.length === 0 && <p className="wall-hint">Click anywhere to add a note.</p>}
        </div>
      </div>
    </>
  );
}
