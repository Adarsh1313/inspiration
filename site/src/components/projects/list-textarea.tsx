"use client";

import { forwardRef, useLayoutEffect, useRef } from "react";
import { continueList, indent } from "@/lib/projects/day-blocks";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (next: string) => void;
};

/** A plain textarea with Markdown list help: Enter continues `- `, `* ` and `1. ` items, Tab / Shift+Tab indent. */
export const ListTextarea = forwardRef<HTMLTextAreaElement, Props>(function ListTextarea({ value, onValueChange, onKeyDown, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current !== null && inner.current) {
      inner.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && el.selectionStart === el.selectionEnd) {
      const r = continueList(el.value, el.selectionStart);
      if (r) {
        e.preventDefault();
        caret.current = r.caret;
        onValueChange(r.text);
      }
    } else if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const r = indent(el.value, { start: el.selectionStart, end: el.selectionEnd }, e.shiftKey ? -1 : 1);
      if (r) {
        e.preventDefault();
        onValueChange(r.text);
        requestAnimationFrame(() => el.setSelectionRange(r.start, r.end));
      }
    }
  }

  return (
    <textarea
      {...rest}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
});
