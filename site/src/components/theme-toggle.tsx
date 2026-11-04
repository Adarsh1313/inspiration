"use client";

import { SunMoon } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle theme">
      <SunMoon size={16} strokeWidth={1.5} />
    </button>
  );
}
