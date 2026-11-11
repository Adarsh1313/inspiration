// Pure logic for the Active projects page and the hub CLI. No I/O: the page, server actions and CLI do that.
// Shared with tools/ by relative import, so keep imports relative.
import { WALL_COLOURS } from "../wall/colour";

export type Issue = { number: number; title: string; url: string };
export type Entry = {
  id: string;
  day: string; // YYYY-MM-DD, IST
  seq: number;
  text: string;
  rev: number;
  ticketed_at: string | null;
  issues: Issue[];
};
export type ProjectRef = { slug: string; name: string; repo: string | null };

export type Block = { entry: Entry; label: string; ticketed: boolean; issues: Issue[] };
export type CardView = { open: Entry | null; blocks: Block[] };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The IST calendar date (YYYY-MM-DD) for an instant. */
export function todayIST(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function hasText(e: Entry): boolean {
  return e.text.trim() !== "";
}

/** "2026-11-11" → "11 Nov". */
export function dayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function byNewest(a: Entry, b: Entry): number {
  return a.day === b.day ? b.seq - a.seq : a.day < b.day ? 1 : -1;
}

/** Today's highest-seq entry that has not been ticketed: the one the editor binds to. */
export function openEntry(entries: Entry[], now: Date): Entry | null {
  const today = todayIST(now);
  let open: Entry | null = null;
  for (const e of entries) {
    if (e.day === today && !e.ticketed_at && hasText(e) && (!open || e.seq > open.seq)) open = e;
  }
  return open;
}

/** The editor entry plus every other non-empty entry as a block, newest first. */
export function cardView(entries: Entry[], now: Date): CardView {
  const open = openEntry(entries, now);
  const perDay = new Map<string, number>();
  for (const e of entries) if (hasText(e)) perDay.set(e.day, (perDay.get(e.day) ?? 0) + 1);
  const blocks = entries
    .filter((e) => hasText(e) && e !== open)
    .sort(byNewest)
    .map((entry) => ({
      entry,
      label: (perDay.get(entry.day) ?? 1) > 1 || entry.seq > 1 ? `${dayLabel(entry.day)} · ${entry.seq}` : dayLabel(entry.day),
      ticketed: entry.ticketed_at !== null,
      issues: entry.issues,
    }));
  return { open, blocks };
}

/** The seq a new entry on `day` should use. */
export function nextSeq(entries: Entry[], day: string): number {
  return entries.reduce((max, e) => (e.day === day ? Math.max(max, e.seq) : max), 0) + 1;
}

/** Entries with text and no ticket, oldest first. This is what the agent reads. */
export function unticketed(entries: Entry[]): Entry[] {
  return entries
    .filter((e) => hasText(e) && !e.ticketed_at)
    .sort((a, b) => (a.day === b.day ? a.seq - b.seq : a.day < b.day ? -1 : 1));
}

// ---- Lists ----

const LIST_LINE = /^(\s*)([-*]|\d+\.)\s(.*)$/;

function lineBounds(text: string, caret: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", caret - 1) + 1;
  const nl = text.indexOf("\n", caret);
  return { start, end: nl === -1 ? text.length : nl };
}

/** Renumber the contiguous numbered siblings at `indent`, starting from `from` (line index), with `n` as the first number. */
function renumber(lines: string[], from: number, indent: string, n: number): void {
  for (let i = from; i < lines.length; i++) {
    const m = LIST_LINE.exec(lines[i]);
    if (!m) break;
    if (m[1].length < indent.length) break;
    if (m[1] !== indent) continue; // deeper item: leave it, keep scanning
    if (!/^\d+\.$/.test(m[2])) break;
    lines[i] = `${indent}${n}. ${m[3]}`;
    n++;
  }
}

/**
 * Enter pressed in a list item: start the next item, or end the list when the item is empty.
 * Returns null when the caret is not on a list item (let the browser handle Enter).
 */
export function continueList(text: string, caret: number): { text: string; caret: number } | null {
  const { start, end } = lineBounds(text, caret);
  const line = text.slice(start, end);
  const m = LIST_LINE.exec(line);
  if (!m) return null;
  const [, indent, marker, content] = m;
  const markerEnd = start + indent.length + marker.length + 1;
  if (caret < markerEnd) return null; // caret inside the marker: plain Enter

  if (content.trim() === "") {
    // Empty item: end the list by clearing the marker.
    return { text: text.slice(0, start) + text.slice(end), caret: start };
  }

  const numbered = /^\d+$/.test(marker.slice(0, -1)) && marker.endsWith(".");
  const nextMarker = numbered ? `${parseInt(marker, 10) + 1}.` : marker;
  const insert = `\n${indent}${nextMarker} `;
  let next = text.slice(0, caret) + insert + text.slice(caret);
  let nextCaret = caret + insert.length;

  if (numbered) {
    const lines = next.split("\n");
    const lineIndex = next.slice(0, nextCaret).split("\n").length - 1;
    renumber(lines, lineIndex, indent, parseInt(marker, 10) + 1);
    next = lines.join("\n");
    nextCaret = lines.slice(0, lineIndex).join("\n").length + 1 + indent.length + `${parseInt(marker, 10) + 1}. `.length;
  }
  return { text: next, caret: nextCaret };
}

/** Tab / Shift+Tab on the selected list lines. Returns null when none of them is a list item. */
export function indent(text: string, sel: { start: number; end: number }, dir: 1 | -1): { text: string; start: number; end: number } | null {
  const first = lineBounds(text, sel.start).start;
  const last = lineBounds(text, Math.max(sel.start, sel.end)).end;
  const lines = text.slice(first, last).split("\n");
  if (!lines.some((l) => LIST_LINE.test(l))) return null;

  let startShift = 0;
  let endShift = 0;
  const out = lines.map((line, i) => {
    const isList = LIST_LINE.test(line);
    let delta = 0;
    let next = line;
    if (isList && dir === 1) {
      next = "  " + line;
      delta = 2;
    } else if (isList && dir === -1) {
      const strip = /^ {1,2}/.exec(line)?.[0].length ?? 0;
      next = line.slice(strip);
      delta = -strip;
    }
    if (i === 0) startShift = delta;
    endShift += delta;
    return next;
  });
  return {
    text: text.slice(0, first) + out.join("\n") + text.slice(last),
    start: Math.max(first, sel.start + startShift),
    end: Math.max(first, sel.end + endShift),
  };
}

// ---- Export ----

/** "2026-11-11" or "2026-11-11 · 2" for an export heading. */
function heading(entry: Entry, multi: boolean): string {
  return multi || entry.seq > 1 ? `${entry.day} · ${entry.seq}` : entry.day;
}

function ticketLine(entry: Entry): string {
  if (!entry.ticketed_at) return "";
  const links = entry.issues.map((i) => `[#${i.number}](${i.url})`).join(", ");
  return `\n_Ticketed${links ? `: ${links}` : ""}_\n`;
}

export function blockMarkdown(entry: Entry): string {
  return `## ${heading(entry, false)}\n\n${entry.text.trim()}\n${ticketLine(entry)}`;
}

export function blockText(entry: Entry): string {
  return entry.text;
}

/** The whole history as one Markdown file, newest day first. */
export function toMarkdown(project: { name: string }, entries: Entry[]): string {
  const live = entries.filter(hasText).sort(byNewest);
  const perDay = new Map<string, number>();
  for (const e of live) perDay.set(e.day, (perDay.get(e.day) ?? 0) + 1);
  const body = live.map((e) => `## ${heading(e, (perDay.get(e.day) ?? 1) > 1)}\n\n${e.text.trim()}\n${ticketLine(e)}`);
  return [`# ${project.name}`, ...body].join("\n\n") + "\n";
}

export function blockFilename(slug: string, entry: Entry, ext: "md" | "txt"): string {
  return `${slug}-${entry.day}${entry.seq > 1 ? `-${entry.seq}` : ""}.${ext}`;
}

export function allFilename(slug: string): string {
  return `${slug}-all.md`;
}

// ---- Projects ----

/** `owner/name` from a GitHub remote URL (https or ssh, with or without .git) or a bare `owner/name`. Case is kept. */
export function parseRepo(input: string): string | null {
  const t = input.trim();
  const m = /^(?:.*github\.com[/:])?([^/\s:]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(t);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Match a git remote URL to a project's repo, case-insensitively. */
export function projectForRemote<P extends { repo: string | null }>(projects: P[], remoteUrl: string): P | null {
  if (!/github\.com/i.test(remoteUrl)) return null;
  const repo = parseRepo(remoteUrl)?.toLowerCase();
  return repo ? (projects.find((p) => p.repo?.toLowerCase() === repo) ?? null) : null;
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The wall colour used by the fewest existing projects; ties go to the earlier colour in the palette. */
export function pickColour(existing: string[]): string {
  let best: string = WALL_COLOURS[0];
  let bestCount = Infinity;
  for (const c of WALL_COLOURS) {
    const n = existing.filter((e) => e === c).length;
    if (n < bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}
