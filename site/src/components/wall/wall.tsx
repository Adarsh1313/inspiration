"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Frame, LayoutGrid, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { browserClient } from "@/lib/supabase-browser";
import { nextColour } from "@/lib/wall/colour";
import { prefersReducedMotion } from "@/lib/wall/motion";
import { NOTE_COLUMNS, WALL, type WallGroup, type WallNote } from "@/lib/wall/model";
import { NOTE_SIZE, clampToWall, freeSpot, snapIntoGroup, type Point } from "@/lib/wall/placement";
import { mulberry32 } from "@/lib/wall/rng";
import { flightAt, planDuration, planTidy, type FlightState } from "@/lib/wall/tidy";
import { WallFrame } from "./wall-frame";
import { WallNoteView } from "./wall-note";

const NEW_GROUP = { w: 596, h: 368 };
const TRACE_S = 0.5; // frame outline trace
const TYPE_CPS = 45; // label characters per second

export function Wall({ initialNotes, initialGroups }: { initialNotes: WallNote[]; initialGroups: WallGroup[] }) {
  const [notes, setNotes] = useState<WallNote[]>(initialNotes);
  const [groups, setGroups] = useState<WallGroup[]>(initialGroups);
  const [newId, setNewId] = useState<string | null>(null);
  const [newGroupId, setNewGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameDrag, setFrameDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [flights, setFlights] = useState<Record<string, FlightState> | null>(null);
  const [tidyTime, setTidyTime] = useState<number | null>(null);
  const [traceKey, setTraceKey] = useState(0);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const rng = useRef<() => number>(() => 0.5);
  const editingCount = useRef(0);
  const ignoreNextClick = useRef(false);
  const lastPointer = useRef<string>("mouse");
  const raf = useRef<number | undefined>(undefined);
  const busy = tidyTime !== null;

  useEffect(() => {
    rng.current = mulberry32(Date.now());
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const patch = useCallback(async (id: string, changes: Partial<WallNote>) => {
    const before = notesRef.current.find((n) => n.id === id);
    if (!before) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
    const { error } = await browserClient().from("notes").update(changes).eq("id", id);
    if (error) {
      const reverted = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k as keyof WallNote]]));
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...reverted } : n)));
      setError("Could not save that change.");
    } else setError(null);
  }, []);

  const patchGroup = useCallback(async (id: string, changes: Partial<WallGroup>) => {
    const before = groupsRef.current.find((g) => g.id === id);
    if (!before) return;
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...changes } : g)));
    const { error } = await browserClient().from("note_groups").update(changes).eq("id", id);
    if (error) {
      const reverted = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k as keyof WallGroup]]));
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...reverted } : g)));
      setError("Could not save that change.");
    } else setError(null);
  }, []);

  const frames = useCallback(() => groupsRef.current.map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h })), []);

  const add = useCallback(async (at?: Point) => {
    const current = notesRef.current;
    const counts: Record<string, number> = {};
    for (const n of current) counts[n.colour] = (counts[n.colour] ?? 0) + 1;
    const recent = [...current].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n) => n.colour);
    const colour = nextColour(recent, counts, rng.current);
    const pos = at ? clampToWall(at, WALL) : freeSpot(current, WALL, rng.current);
    const rotation = Math.round((rng.current() * 8 - 4) * 10) / 10;
    const z = Math.max(0, ...current.map((n) => n.z)) + 1;
    const group_id = snapIntoGroup(pos, frames());

    const { data, error } = await browserClient()
      .from("notes")
      .insert({ text: "", colour, x: pos.x, y: pos.y, rotation, z, group_id })
      .select(NOTE_COLUMNS)
      .single();
    if (error || !data) return setError("Could not add a note.");
    setError(null);
    setNotes((prev) => [...prev, data as WallNote]);
    setNewId(data.id);
  }, [frames]);

  const remove = useCallback(async (id: string) => {
    const { error } = await browserClient().from("notes").delete().eq("id", id);
    if (error) return setError("Could not delete that note.");
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const moved = useCallback(
    (id: string, p: Point) => {
      const z = Math.max(0, ...notesRef.current.map((n) => n.z)) + 1;
      void patch(id, { x: p.x, y: p.y, z, group_id: snapIntoGroup(p, frames()) });
    },
    [patch, frames],
  );

  /** After a frame changes size, notes whose centre is now inside (or outside) join (or leave) it. */
  const refreshMembership = useCallback(
    (nextFrames: { id: string; x: number; y: number; w: number; h: number }[]) => {
      for (const n of notesRef.current) {
        const g = snapIntoGroup(n, nextFrames);
        if (g !== n.group_id) void patch(n.id, { group_id: g });
      }
    },
    [patch],
  );

  const addGroup = useCallback(async () => {
    // First free spot for a frame, scanning the wall top-left to bottom-right.
    const existing = groupsRef.current;
    const clash = (x: number, y: number) =>
      existing.some((g) => x < g.x + g.w + 16 && x + NEW_GROUP.w + 16 > g.x && y < g.y + g.h + 16 && y + NEW_GROUP.h + 16 > g.y);
    let pos = { x: 40, y: 40 };
    search: for (let y = 40; y + NEW_GROUP.h <= WALL.height; y += 40)
      for (let x = 40; x + NEW_GROUP.w <= WALL.width; x += 40)
        if (!clash(x, y)) {
          pos = { x, y };
          break search;
        }
    const { data, error } = await browserClient().from("note_groups").insert({ name: "", ...pos, ...NEW_GROUP }).select("*").single();
    if (error || !data) return setError("Could not add a group.");
    setError(null);
    setGroups((prev) => [...prev, data as WallGroup]);
    setNewGroupId(data.id);
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    const { error } = await browserClient().from("note_groups").delete().eq("id", id);
    if (error) return setError("Could not delete that group.");
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setNotes((prev) => prev.map((n) => (n.group_id === id ? { ...n, group_id: null } : n)));
  }, []);

  const frameDragEnd = useCallback(
    (id: string, dx: number, dy: number) => {
      const g = groupsRef.current.find((f) => f.id === id);
      setFrameDrag(null);
      if (!g) return;
      // Keep the frame on the wall; its notes move by the same amount.
      const x = Math.min(Math.max(0, g.x + dx), WALL.width - g.w);
      const y = Math.min(Math.max(0, g.y + dy), WALL.height - g.h);
      const mx = x - g.x;
      const my = y - g.y;
      void patchGroup(id, { x, y });
      for (const n of notesRef.current.filter((n) => n.group_id === id)) {
        const p = clampToWall({ x: n.x + mx, y: n.y + my }, WALL);
        void patch(n.id, { x: p.x, y: p.y });
      }
    },
    [patch, patchGroup],
  );

  const resizeGroup = useCallback(
    async (id: string, w: number, h: number) => {
      await patchGroup(id, { w, h });
      refreshMembership(groupsRef.current.map((g) => ({ id: g.id, x: g.x, y: g.y, w: g.w, h: g.h })));
    },
    [patchGroup, refreshMembership],
  );

  const tidy = useCallback(() => {
    if (raf.current) return;
    const plan = planTidy(notesRef.current, groupsRef.current, rng.current);
    if (plan.flights.length === 0) return setError("Drop some notes inside a group first.");
    setError(null);

    const finish = () => {
      for (const g of plan.frames) void patchGroup(g.id, { h: g.h });
      for (const f of plan.flights) void patch(f.id, { x: f.to.x, y: f.to.y, rotation: f.to.rotation });
    };

    if (prefersReducedMotion()) return finish();

    const start = performance.now();
    const total = planDuration(plan);
    setTraceKey((k) => k + 1);
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= total) {
        raf.current = undefined;
        setFlights(null);
        setTidyTime(null);
        finish();
        return;
      }
      setFlights(Object.fromEntries(plan.flights.map((f) => [f.id, flightAt(f, t)])));
      setTidyTime(t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [patch, patchGroup]);

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

  const hasGrouped = notes.some((n) => n.group_id !== null);

  function offsetFor(n: WallNote): FlightState | undefined {
    const f = flights?.[n.id];
    if (f) return f;
    if (frameDrag && n.group_id === frameDrag.id) return { x: n.x + frameDrag.dx, y: n.y + frameDrag.dy, rotation: n.rotation, scale: 1 };
    return undefined;
  }

  return (
    <>
      <div className="wall-head">
        <div>
          <PageHeader title="Thoughts" lede="A wall of sticky notes for loose ideas. Click empty space or press N to add one." />
        </div>
        <div className="row wall-actions">
          <button type="button" className="btn secondary bar-btn" onClick={() => void addGroup()} disabled={busy}>
            <Frame size={14} strokeWidth={1.5} /> New group
          </button>
          <button type="button" className="btn secondary bar-btn" onClick={tidy} disabled={busy || !hasGrouped}>
            <LayoutGrid size={14} strokeWidth={1.5} /> Tidy
          </button>
          <button type="button" className="btn bar-btn wall-add" onClick={() => void add()} disabled={busy}>
            <Plus size={14} strokeWidth={1.5} /> New note <kbd className="mono kbd">N</kbd>
          </button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="wall" data-busy={busy} aria-label="Thoughts wall">
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
            <WallFrame
              key={g.id}
              group={g}
              offset={frameDrag?.id === g.id ? { x: frameDrag.dx, y: frameDrag.dy } : null}
              autoFocus={g.id === newGroupId}
              traceKey={busy ? traceKey : undefined}
              typedChars={tidyTime === null ? undefined : Math.max(0, Math.floor((tidyTime - TRACE_S) * TYPE_CPS))}
              onDragStart={(id) => setFrameDrag({ id, dx: 0, dy: 0 })}
              onDrag={(id, dx, dy) => setFrameDrag({ id, dx, dy })}
              onDragEnd={frameDragEnd}
              onResize={(id, w, h) => void resizeGroup(id, w, h)}
              onRename={(id, name) => void patchGroup(id, { name })}
              onDelete={(id) => void deleteGroup(id)}
            />
          ))}
          {notes.map((n) => (
            <WallNoteView key={n.id} note={n} isNew={n.id === newId} flight={offsetFor(n)} onPatch={patch} onDelete={remove} onMoved={moved} onEditing={onEditing} />
          ))}
          {notes.length === 0 && groups.length === 0 && <p className="wall-hint">Click anywhere to add a note.</p>}
        </div>
      </div>
    </>
  );
}
