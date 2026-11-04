"use client";

import { useEffect, useRef, useState } from "react";
import { Pin, Trash2 } from "lucide-react";
import { WALL_COLOURS } from "@/lib/wall/colour";
import { clampToWall, type Point } from "@/lib/wall/placement";
import { WALL, type WallNote } from "@/lib/wall/model";

const DEBOUNCE_MS = 500;
const DRAG_THRESHOLD = 4;

export type Flight = { x: number; y: number; rotation: number; scale: number };

type Props = {
  note: WallNote;
  isNew: boolean;
  flight?: Flight;
  onPatch: (id: string, changes: Partial<WallNote>) => void;
  onDelete: (id: string) => void;
  onMoved: (id: string, p: Point) => void;
  onEditing: (editing: boolean) => void;
};

export function WallNoteView({ note, isNew, flight, onPatch, onDelete, onMoved, onEditing }: Props) {
  const [text, setText] = useState(note.text);
  const [pos, setPos] = useState<Point>({ x: note.x, y: note.y });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [confirming, setConfirming] = useState(false);

  const area = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsaved = useRef<string | null>(null);
  const patchRef = useRef(onPatch);
  patchRef.current = onPatch;

  useEffect(() => {
    if (editing) {
      onEditing(true);
      area.current?.focus();
    }
  }, [editing, onEditing]);

  // Flush text typed in the last debounce window if this note unmounts.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (unsaved.current !== null) patchRef.current(note.id, { text: unsaved.current });
    },
    [note.id],
  );

  function typed(next: string) {
    setText(next);
    unsaved.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      unsaved.current = null;
      onPatch(note.id, { text: next });
    }, DEBOUNCE_MS);
  }

  function endEditing() {
    setEditing(false);
    onEditing(false);
    if (unsaved.current !== null) {
      clearTimeout(timer.current);
      onPatch(note.id, { text: unsaved.current });
      unsaved.current = null;
    }
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (editing || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setPos(clampToWall({ x: d.origX + dx, y: d.origY + dy }, WALL));
  }

  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setDragging(false);
    if (d.moved) onMoved(note.id, pos);
    else setEditing(true); // a plain click edits the text
  }

  // Position comes from props except while this note is being dragged, so nothing blinks back after a drop or a tidy.
  const x = flight?.x ?? (dragging ? pos.x : note.x);
  const y = flight?.y ?? (dragging ? pos.y : note.y);
  const rotation = flight?.rotation ?? note.rotation;
  const scale = flight?.scale ?? 1;
  const lifted = dragging || (flight !== undefined && scale > 1);

  return (
    <div
      className="note"
      data-dragging={dragging}
      data-editing={editing}
      data-flying={flight !== undefined}
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        zIndex: (note.pinned ? 10000 : 0) + note.z + (dragging ? 100000 : 0),
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === "F2")) {
          e.preventDefault();
          setEditing(true);
        }
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
    >
      <div
        className={isNew ? "note-body is-new" : "note-body"}
        data-colour={note.colour}
        data-lifted={lifted}
        style={flight ? { transform: `scale(${scale})` } : undefined}
      >
        {note.pinned && <Pin className="note-pin-mark" size={12} strokeWidth={1.5} aria-label="Pinned" />}
        <textarea
          ref={area}
          className="note-text"
          value={text}
          readOnly={!editing}
          tabIndex={editing ? 0 : -1}
          onChange={(e) => typed(e.target.value)}
          onBlur={endEditing}
          placeholder={editing ? "Write a thought…" : ""}
          aria-label="Note text"
        />
        <div className="note-actions">
          <div className="swatches" role="group" aria-label="Colour">
            {WALL_COLOURS.map((c) => (
              <button key={c} type="button" className="swatch" data-colour={c} aria-label={c} aria-pressed={note.colour === c} onClick={() => onPatch(note.id, { colour: c })} />
            ))}
          </div>
          <div className="row">
            <button type="button" className="icon-btn" aria-label={note.pinned ? "Unpin" : "Pin"} aria-pressed={note.pinned} onClick={() => onPatch(note.id, { pinned: !note.pinned })}>
              <Pin size={14} strokeWidth={1.5} />
            </button>
            {confirming ? (
              <button type="button" className="icon-btn danger" onClick={() => onDelete(note.id)} onBlur={() => setConfirming(false)} autoFocus>
                Delete?
              </button>
            ) : (
              <button type="button" className="icon-btn" aria-label="Delete" onClick={() => setConfirming(true)}>
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
