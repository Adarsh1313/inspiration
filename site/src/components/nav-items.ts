export type NavItem = { href: string; label: string; icon: "design" | "jobs" | "email" | "thoughts" | "notepad"; count: number; sub?: boolean };

// Counts are 0 until each area has data (wired in later milestones).
export const NAV_ITEMS: NavItem[] = [
  { href: "/design", label: "Design", icon: "design", count: 0 },
  { href: "/jobs", label: "Jobs", icon: "jobs", count: 0 },
  { href: "/jobs/cold-email", label: "Cold email", icon: "email", count: 0, sub: true },
  { href: "/thoughts", label: "Thoughts", icon: "thoughts", count: 0 },
  { href: "/notepad", label: "Notepad", icon: "notepad", count: 0 },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/jobs") return pathname === "/jobs";
  if (item.href === "/design") return pathname === "/design" || pathname.startsWith("/design/") || pathname.startsWith("/r/");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
