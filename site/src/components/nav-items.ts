import { SHELVES, type Shelf } from "@hub/capture";
import type { NavCounts } from "@/lib/cards-store";
import { SHELF_LABEL } from "@/lib/source-labels";

export type NavItem = { href: string; label: string; icon: "design" | "jobs" | "email" | "thoughts" | "notepad" | "projects" | "watch"; count: number; sub?: boolean };
export type ShelfItem = { href: string; label: string; count: number; shelf: Shelf };

export const NO_COUNTS: NavCounts = { design: 0, shelves: Object.fromEntries(SHELVES.map((s) => [s, 0])) as Record<Shelf, number>, jobs: 0, thoughts: 0, projects: 0, watch: 0 };

export function navItems(counts: NavCounts): NavItem[] {
  return [
    { href: "/design", label: "Design", icon: "design", count: counts.design },
    { href: "/jobs", label: "Jobs", icon: "jobs", count: counts.jobs },
    { href: "/jobs/cold-email", label: "Cold email", icon: "email", count: 0, sub: true },
    { href: "/projects", label: "Projects", icon: "projects", count: counts.projects },
    { href: "/watch", label: "Watch notes", icon: "watch", count: counts.watch },
    { href: "/thoughts", label: "Thoughts", icon: "thoughts", count: counts.thoughts },
    { href: "/notepad", label: "Notepad", icon: "notepad", count: 0 },
  ];
}

export function shelfItems(counts: NavCounts): ShelfItem[] {
  return SHELVES.map((shelf) => ({ shelf, href: `/design/${shelf}`, label: SHELF_LABEL[shelf], count: counts.shelves[shelf] }));
}

/** The Design row expands into shelves on /design and /design/<shelf>. */
export function showsShelves(pathname: string): boolean {
  return pathname === "/design" || pathname.startsWith("/design/");
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/jobs") return pathname === "/jobs";
  if (item.href === "/design") return pathname === "/design" || pathname.startsWith("/r/");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
