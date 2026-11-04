"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Lightbulb, Mail, Menu, NotebookPen, Palette, X, type LucideIcon } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { NAV_ITEMS, isActive } from "./nav-items";

const ICONS: Record<string, LucideIcon> = { design: Palette, jobs: Briefcase, email: Mail, thoughts: Lightbulb, notepad: NotebookPen };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
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
          <span className="version">v0.1.0</span>
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
            {NAV_ITEMS.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href} className={item.sub ? "sub" : undefined}>
                  <Link href={item.href} className="navlink" aria-current={isActive(pathname, item) ? "page" : undefined}>
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="label">{item.label}</span>
                    <span className="count">{item.count}</span>
                  </Link>
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
