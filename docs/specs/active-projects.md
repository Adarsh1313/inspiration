# Spec: Active projects

Status: ready-for-agent
Adds a new page to the hub. Prior art: /notepad (sync), /thoughts (note colours), `/cluster-thoughts` (local CLI as the limited `hub_worker` role).

## Problem Statement

Adarsh works on about eight projects at once. Ideas for each one (fixes, page tweaks, features) come at random times and end up scattered across chats, notepad text and memory. Turning them into work means re-explaining context in each project's chat. He wants one place to brain-dump per project, and he wants agents to turn that dump into GitHub issues without the back-and-forth.

## Solution

A new `/projects` page, "Active projects", in the shared shell. It shows one sticky-note card per active project: 4 per row on desktop, 1 column on phone, all the same height.

- **Card:** the project name and a repo link at the top. Below that, today's editor. Below that, past days as collapsed rows ("11 Nov"). Content scrolls inside the card.
- **Editor:** plain text with Markdown list help. Typing `- ` or `1. ` and pressing Enter continues the list, and Tab indents. It autosaves and syncs phone to laptop within seconds, like /notepad.
- **Day blocks:** the editor is always "today" in IST. When the date changes, today's text becomes a collapsed dated block. An empty day leaves nothing behind.
- **Block ⋯ menu:** Edit, Copy, Download .md, Download .txt, Delete (one confirm).
- **Card ⋯ menu:** Download all, Set repo, Archive. Under the grid, "Archived (n)" opens a plain list with Restore. Cards can be dragged to reorder.
- **Ticketing:** in any project repo, Adarsh says "go look at Inspiration hub, create issues", or runs `/hub-tickets`.
  - The agent reads that project's unticketed text through the hub CLI and merges related bullets into issues. It creates them with `gh issue create --repo`, labels them `from-hub`, and prints a summary table.
  - The hub marks those blocks "Ticketed · 3 issues" with links. If today's text was ticketed, it locks into that block and the editor clears. Later text the same day becomes block 2 ("11 Nov · 2").
  - In the next message, Adarsh lists priorities and the agent adds `P1`/`P2`/`P3` labels, creating them if they're missing.
- **New projects:** a rule in global `~/.claude/CLAUDE.md` and a step in the project-setup skill register every new project's card through the hub CLI.

Seed cards in this order: Portfolio, AgentKanban, Resurface, TabDesk, LocalFlow, FamilyAtlas, Email Tracker, Inspiration. FamilyAtlas starts with no repo.

## User Stories

1. As Adarsh, I want a "Projects" item in the side nav with an active-project count, so that the page is one click away.
2. As Adarsh, I want all my active projects as equal-sized sticky cards, 4 per row, so that I see every project at a glance.
3. As Adarsh, I want each card in its own fixed colour from the thoughts-wall palette, flat with no tilt or tape, so that I can spot projects quickly while text stays readable.
4. As Adarsh, I want card content to scroll inside the card, so that one busy project doesn't stretch the grid.
5. As Adarsh, I want the cards stacked in one column on my phone, so that I can dump ideas on the go.
6. As Adarsh, I want to type straight into a project's card without opening anything, so that capturing a thought is instant.
7. As Adarsh, I want `- ` and `1. ` lists to continue on Enter, and Tab and Shift+Tab to indent and outdent, so that bullet dumps feel like Notion.
8. As Adarsh, I want an empty list item plus Enter to end the list, so that I can switch back to paragraphs.
9. As Adarsh, I want my text saved automatically, so that I never lose a thought.
10. As Adarsh, I want text typed on my phone to appear on my laptop within seconds, so that both devices show the same thing.
11. As Adarsh, I want an offline edit that conflicts with another device kept as a copy, not lost, so that sync never eats my text.
12. As Adarsh, I want today's text to turn into a collapsed block labelled with its date once the day ends in IST, so that each day's dump stays separate.
13. As Adarsh, I want days with no text to leave no block, so that the card doesn't fill with empty rows.
14. As Adarsh, I want to expand a past day's block to read it, so that I can look back.
15. As Adarsh, I want to edit a past day's block only from its ⋯ menu, so that I don't change history by accident.
16. As Adarsh, I want to copy a block's text, so that I can paste it into a chat.
17. As Adarsh, I want to download a block as .md or .txt, so that I can keep or share it as a file.
18. As Adarsh, I want to delete a block after one confirm, so that removal is deliberate.
19. As Adarsh, I want "Download all" on a card to export the project's whole history as one Markdown file, newest day first, so that I can hand everything to an agent at once.
20. As Adarsh, I want to set or change a project's GitHub repo from the card menu, so that projects created before their repo can be linked later.
21. As Adarsh, I want to archive a project, removing it from the grid without deleting its notes, so that the board only shows what I'm working on.
22. As Adarsh, I want an "Archived (n)" list with Restore, so that I can bring a project back.
23. As Adarsh, I want to drag cards to reorder them, so that my busiest projects sit top-left.
24. As Adarsh, I want extra projects beyond eight to flow onto a new row, so that the grid never breaks.
25. As Adarsh, I want to say "go look at Inspiration hub, create issues" inside a project repo, or run `/hub-tickets`, so that the agent finds my notes without me pasting them.
26. As Adarsh, I want `/hub-tickets` inside a repo to pick that project from its git remote, so that I don't name it.
27. As Adarsh, I want `/hub-tickets` run anywhere else to cover every project with new text, and `/hub-tickets <slug>` to target one, so that I can ticket everything in one chat.
28. As Adarsh, I want the agent to read only text that hasn't been ticketed yet, so that issues are never duplicated.
29. As Adarsh, I want the agent to merge related bullets into one issue, so that the tracker isn't flooded with tiny issues.
30. As Adarsh, I want each issue to have a one-line goal, my bullets quoted, inferred acceptance points and a footer naming the hub and date, so that any agent can pick it up cold.
31. As Adarsh, I want every created issue labelled `from-hub`, so that I can filter them.
32. As Adarsh, I want a summary table of what was created (number, title, size, link), so that I can decide priorities right away.
33. As Adarsh, I want to reply with priorities and have the agent add `P1`/`P2`/`P3` labels, creating them if they're missing, so that prioritising is one message.
34. As Adarsh, I want ticketed blocks to show "Ticketed · n issues" with links, so that I can see what's already been turned into work.
35. As Adarsh, I want today's text to lock into a ticketed block when ticketed and the editor to clear, so that new thoughts after that are clearly new.
36. As Adarsh, I want two blocks on the same date to show as "11 Nov · 1" and "11 Nov · 2", so that the ticketing boundary is visible.
37. As Adarsh, I want a project with no repo to be skipped by `/hub-tickets` with a note saying so, so that nothing fails silently.
38. As Adarsh, I want any new project I start to get a card automatically, so that the hub always lists my real projects.
39. As Adarsh, I want registration to be idempotent (a project with the same slug or repo isn't added twice), so that rerunning setup is safe.
40. As Adarsh, I want the agent's database role to be unable to edit or delete my text, so that a bad agent run can't destroy notes.
41. As Adarsh, I want the page to follow the hub's light motion rules (hover, expand, theme only) and respect reduced motion, so that it matches the rest of the site.
42. As Adarsh, I want the page private like the rest of the hub, so that project notes never leak.

## Implementation Decisions

**Schema (one new migration)**
- `projects`: id, slug (unique), name, repo (`owner/name`, nullable), colour (a thoughts-wall colour key), position (int, for ordering), archived_at (nullable), created_at. Seeded with the eight projects above. Each gets a distinct colour from the wall palette.
- `project_entries`: id, project_id, day (date, IST), seq (int, 1-based within project and day), text, rev (int, for compare-and-set sync), ticketed_at (nullable), issues (jsonb array of `{ number, title, url }`), created_at, updated_at. Unique on (project_id, day, seq).
- **The open entry** for a project is today's highest-seq entry with `ticketed_at` null. The editor binds to it. It is created on the first non-empty save, so empty days leave no rows.
- Any entry that isn't the open entry is a block: past days, or today's ticketed entries. Saving an entry that ends up empty deletes it.
- Single-user RLS like the existing tables, and realtime enabled on `project_entries` for sync.
- **`hub_worker` grants:**
  - select on both tables
  - insert on `projects` (slug, name, repo, colour, position)
  - update `projects.repo`
  - update `project_entries` (ticketed_at, issues) only
  - no grant on entry text and no deletes

**Day-blocks module (pure, new)**
- `todayIST(now)`: the IST date key.
- `cardView(entries, now)`: returns `{ open, blocks }`. Blocks are newest first, each with a label (`"11 Nov"`, or `"11 Nov · 2"` when a day has more than one), a ticketed flag and issue links.
- `nextSeq(entries, day)`: the seq to use when the editor needs a new entry after ticketing.
- `unticketed(entries)`: the entries with text and no `ticketed_at`, oldest first. This is what the agent reads.
- `continueList(text, caret)` and `indent(text, selection, dir)`: Enter and Tab behaviour for `- `, `* ` and `N. ` items, including ending a list on an empty item and renumbering.
- `toMarkdown(project, entries)`, `blockMarkdown(entry)` and `blockText(entry)`: export strings. Download filenames are `<slug>-<YYYY-MM-DD>.md` and `<slug>-all.md`.
- `projectForRemote(projects, remoteUrl)`: matches `https://github.com/o/n(.git)` and `git@github.com:o/n.git` to a project's repo, case-insensitively.
- `slugify(name)` and `pickColour(existing)`: for registration (least-used wall colour).

**Sync:** each card reuses the existing notepad-sync decisions (`onLoad` / `onRemote` / `onSaveResult`) against its open entry's rev, with compare-and-set saves. A conflict copy is kept as a separate entry, not dropped. If the date rolls over while the page is open, the next save creates a new open entry for the new day. The old text stays on the previous day.

**Page and components**
- The `/projects` route sits in the app shell. The nav item "Projects" shows the active count.
- Project card, day-block row (collapsible, with ⋯ menu), block editor (the same list-aware textarea for the open entry and for "Edit"), archived list, and drag-to-reorder by position.
- Server actions handle edit, delete, archive, restore, reorder, set repo and save. All styling uses `design/tokens.css` and the wall colour tokens. Body text is Geist Sans, and dates and counts are Geist Mono.

**Hub CLI (`pnpm --dir C:\Users\Adarsh\inspiration projects …`, as `hub_worker`, next to `cluster`)**
- `list`: JSON of active projects (slug, name, repo, count of unticketed entries).
- `new [slug | --remote <url>]`: JSON of unticketed entries per project (id, day, seq, text), using `unticketed`. With no argument, every project with new text.
- `ticket <entryId…> --issues '<json>'`: sets `ticketed_at` and `issues` on those entries. The open entry thereby locks, and the editor clears on its next realtime update.
- `add --name <n> [--repo o/n] [--slug s]`: idempotent registration. Returns the existing project if the slug or repo already exists.
- `set-repo <slug> <o/n>`.

**`/hub-tickets` (global Claude Code command, a sibling of `/cluster-thoughts`)**
- Steps: resolve the project (git remote, argument, or all) → `projects new` → skip projects with no repo and say so.
- Group bullets into issues. Each issue gets a goal, quoted bullets, acceptance points, and a footer: "From Inspiration hub · Active projects · <date>".
- Create the `from-hub` label if missing, then `gh issue create --repo <repo> --label from-hub`.
- `projects ticket <ids> --issues …` → print a summary table (#, title, size S/M/L, link).
- On a follow-up priority message, `gh issue edit --add-label P1|P2|P3`, creating those labels if missing.
- It creates issues without an approval step, and never edits or deletes hub text.

**New-project registration**
- A global `~/.claude/CLAUDE.md` rule: when starting a new project (or running project-setup), check the hub. If the project has no card, run `projects add` with its name and repo (if a remote exists).
- The project-setup skill gets the same step.

## Testing Decisions

- Tests check behaviour through the pure module's inputs and outputs only, with no Supabase, DOM or `gh`. Prior art: `notepad-sync.test.ts`, `wall/wall.test.ts`, `wall/tidy.test.ts` (Vitest, `pnpm test` in site).
- **Seam 1, the day-blocks module.** Covers:
  - the IST rollover around midnight (UTC 18:29 vs 18:31)
  - no block for empty days, block labels and seq suffixes, newest-first order
  - the open entry after ticketing (the next save goes to seq + 1)
  - `unticketed` ignoring ticketed and empty entries
  - list continuation, ending and renumbering
  - indent and outdent
  - export text and filenames
  - remote matching for https, ssh, `.git` and case variants
  - slugify and the least-used colour pick
- **Seam 2, sync.** It reuses `notepad-sync` as-is, so the existing tests cover it.
- UI, server actions, the CLI's I/O and the command are checked by hand in the browser and one real `/hub-tickets` run against a test repo.

## Out of Scope

- Working on issues automatically after prioritising. That stays the existing flow (new session → issue #N).
- Rich-text editing (headings, bold, checkboxes rendered).
- Reading or writing the hub from cloud agents (the CLI is local to this laptop).
- Syncing issue state (closed, merged) back into the hub.
- Priority stored in the hub. Priority lives only as GitHub labels.
- Deleting projects. Archive only.

## Further Notes

- FamilyAtlas has no GitHub repo yet. Its card works for dumping, and `/hub-tickets` skips it until a repo is set.
- Inspiration's own card points at this repo, so hub improvements can be dumped and ticketed here too.
- Run the slop-indicators card as the last check on the UI slice (project rule).

## Progress

- [x] **A. Board and editor**:
  - migration (both tables, seed, RLS, realtime)
  - the day-blocks module with tests
  - `/projects` page and nav item
  - cards in the 4-up grid, open-entry editor with list help, autosave and sync
  - collapsed day blocks
  - Done when dumping on the phone shows on the laptop and yesterday's text appears as a dated block.
- [x] **B. Menus and management**:
  - block ⋯ (Edit, Copy, .md, .txt, Delete)
  - card ⋯ (Download all, Set repo, Archive)
  - archived list with Restore
  - drag to reorder
- [x] **C. Ticketing**:
  - `hub_worker` grants
  - `projects list | new | ticket | set-repo` CLI
  - the global `/hub-tickets` command
  - "Ticketed · n issues" display and the same-day block split
  - Done when one real run creates issues in a repo and locks the block.
- [ ] **D. Registration**:
  - `projects add`
  - the global CLAUDE.md rule
  - the project-setup skill step
  - Done when setting up a fresh repo adds its card.
