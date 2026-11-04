"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `text` to the clipboard and says so for a moment. */
export function CopyButton({ text, label = "Copy", className = "btn secondary bar-btn" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      // clipboard blocked: leave the label as it was
    }
  }

  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {done ? <Check size={16} strokeWidth={1.5} aria-hidden /> : <Copy size={16} strokeWidth={1.5} aria-hidden />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
