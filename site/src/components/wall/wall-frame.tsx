"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Point } from "@/lib/wall/placement";
import { WALL, type WallGroup } from "@/lib/wall/model";

const MIN_W = 240;
const MIN_H = 200;
const DRAG_THRESHOLD = 4;

type Props = {
  group: WallGroup;
  /** Live offset while this frame or its notes are being moved by a drag. */
  offset: Point | null;
  autoFocus: boolean;
  /** While a tidy runs: how many label characters to show, and a key that restarts the outline trace. */
  typedChars?: number;
  traceKey?: number;
  onDragStart: (id: string) => void;
  onDrag: (id: string, dx: number, dy: number) => void;
  onDragEnd: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export function WallFrame({ group, offset, autoFocus, typedChars, traceKey, onDragStart, onDrag, onDragEnd, onResize, onRename, onDelete }: Props) {
  const [name, setName] = useState(group.name);
  const [size, setSize] = useState({ w: group.w, h: group.h });
  const [confirming, setConfirming] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setSize({ w: group.w, h: group.h }), [group.w, group.h]);
  useEffect(() => setName(group.name), [group.name]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  function bar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("input, button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function barMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) onDragStart(group.id);
    d.moved = true;
    onDrag(group.id, dx, dy);
  }

  function barUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) onDragEnd(group.id, e.clientX - d.x, e.clientY - d.y);
  }

  function grip(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }

  function gripMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = resize.current;
    if (!r) return;
    setSize({
      w: Math.min(Math.max(MIN_W, r.w + e.clientX - r.x), WALL.width - group.x),
      h: Math.min(Math.max(MIN_H, r.h + e.clientY - r.y), WALL.height - group.y),
    });
  }

  function gripUp() {
    if (!resize.current) return;
    resize.current = null;
    onResize(group.id, size.w, size.h);
  }

  const x = group.x + (offset?.x ?? 0);
  const y = group.y + (offset?.y ?? 0);
  const shown = typedChars === undefined ? name : name.slice(0, typedChars);

  return (
    <div className="wall-frame" data-moving={offset !== null} style={{ left: x, top: y, width: size.w, height: size.h }}>
      {traceKey !== undefined && (
        <svg key={traceKey} className="frame-trace" aria-hidden="true">
          <rect x="0" y="0" width="100%" height="100%" rx="12" pathLength="1" />
        </svg>
      )}
      <div className="wall-frame-bar" onPointerDown={bar} onPointerMove={barMove} onPointerUp={barUp}>
        {typedChars === undefined ? (
          <input
            ref={input}
            className="wall-frame-name"
            value={name}
            placeholder="Name this group"
            aria-label="Group name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== group.name && onRename(group.id, name.trim())}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <span className="wall-frame-name">{shown}</span>
        )}
        {confirming ? (
          <button type="button" className="icon-btn danger" onClick={() => onDelete(group.id)} onBlur={() => setConfirming(false)} autoFocus>
            Delete group?
          </button>
        ) : (
          <button type="button" className="icon-btn" aria-label="Delete group" onClick={() => setConfirming(true)}>
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <div className="wall-frame-grip" onPointerDown={grip} onPointerMove={gripMove} onPointerUp={gripUp} aria-label="Resize group" />
    </div>
  );
}
