"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Lightbulb, Mail, Menu, KanbanSquare, NotebookPen, PlaySquare, Palette, X, type LucideIcon } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import type { NavCounts } from "@/lib/cards-store";
import { isActive, navItems, shelfItems, showsShelves } from "./nav-items";

const ICONS: Record<string, LucideIcon> = { design: Palette, jobs: Briefcase, email: Mail, thoughts: Lightbulb, notepad: NotebookPen, projects: KanbanSquare, watch: PlaySquare };

export function AppShell({ children, counts }: { children: React.ReactNode; counts: NavCounts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="icon-btn menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="sidenav" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={16} strokeWidth={1.5} /> : <Menu size={16} strokeWidth={1.5} />}
          </button>
          <Link href="/design" className="mark">inspiration</Link>
          <span className="version">v0.9.0</span>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <a className="icon-btn" href="https://www.linkedin.com/in/adarsh-bharathwaj-942645203/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <LinkedinIcon />
          </a>
          <a className="icon-btn" href="https://github.com/Adarsh1313" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <GithubIcon />
          </a>
        </div>
      </header>
      <div className="frame">
        <div className="sheet-scrim" data-open={open} onClick={() => setOpen(false)} />
        <nav id="sidenav" className="sidenav" data-open={open} aria-label="Primary">
          <ul className="navlist">
            {navItems(counts).map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href} className={item.sub ? "sub" : undefined}>
                  <Link href={item.href} className="navlink" aria-current={isActive(pathname, item) ? "page" : undefined}>
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="label">{item.label}</span>
                    <span className="count">{item.count}</span>
                  </Link>
                  {item.href === "/design" && showsShelves(pathname) && (
                    <ul className="shelf-nav" aria-label="Shelves">
                      {shelfItems(counts).map((s) => (
                        <li key={s.shelf}>
                          <Link href={s.href} className="navlink" aria-current={pathname === s.href ? "page" : undefined}>
                            <span className="label">{s.label}</span>
                            <span className="count">{s.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </>
  );
}
