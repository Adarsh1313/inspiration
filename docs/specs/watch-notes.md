# Spec: Watch notes

Status: ready-for-agent
Adds a new page to the hub. Prior art: the Design paste bar and capture preview (link in, preview card, save), /notepad (autosave and sync), Active projects (list-aware editor, `notepad-sync` decisions).

## Problem Statement

Adarsh watches a lot of YouTube and X content and takes notes while watching. Those notes end up scattered, with no connection to the video or post they came from. He wants one central place that keeps each video or post next to his notes on it.

## Solution

A new `/watch` page, "Watch notes", in the shared shell, with the heading "YouTube and X notes".

- **Paste bar:** the same paste-a-link bar as Design. It accepts YouTube and X links only. Anything else shows "Paste a YouTube or X link."
- **Preview then save:** pasting shows a preview card (thumbnail, title, author, source icon). Pressing Save creates the item with empty notes and opens its notes drawer straight away. A link that is already saved opens the existing item instead.
- **Grid:** items as cards, newest first. Each card shows the thumbnail, title, author, a YouTube or X icon and a note word count. A filter switches between All, YouTube and X. A card menu has Delete (one confirm).
- **Notes drawer:** clicking a card opens a panel on the right (a full-screen sheet on phone). It shows the title, a link out to the original, and a plain-text editor with list help (`- `, `1. `, Tab). It autosaves and syncs between devices within seconds, like /notepad.
- **Timestamps:** for YouTube items, a time like `12:34` or `1:02:03` in the notes shows as a link that opens the video at that moment in a new tab. There is no embedded player.
- **No AI:** no tags, summaries or enrichment.

## User Stories

1. As Adarsh, I want a "Watch notes" item in the side nav with an item count, so that the page is one click away.
2. As Adarsh, I want a paste bar at the top of the page, so that adding a video or post is one paste.
3. As Adarsh, I want YouTube links in any common form (watch, youtu.be, shorts, embed) accepted, so that I can paste whatever I copied.
4. As Adarsh, I want X and twitter.com post links accepted, so that I can save posts and threads I read.
5. As Adarsh, I want any other link refused with a clear message, so that the page only holds content I take notes on.
6. As Adarsh, I want a preview card with thumbnail, title and author before I save, so that I can confirm it is the right item.
7. As Adarsh, I want a failed preview to say what went wrong and still let me save with the link as the title where possible, so that a flaky fetch does not block me.
8. As Adarsh, I want saving to open the notes drawer straight away, so that I can start typing at once.
9. As Adarsh, I want pasting a link I already saved to open that item, so that I never get duplicates.
10. As Adarsh, I want tracking parameters and link variants treated as the same item, so that duplicates are caught reliably.
11. As Adarsh, I want items shown as cards, newest first, so that what I watched last is at the top.
12. As Adarsh, I want each card to show thumbnail, title, author, source icon and word count, so that I can tell items apart and see which already have notes.
13. As Adarsh, I want to filter by All, YouTube or X, so that I can look at one source.
14. As Adarsh, I want clicking a card to open a right-hand notes drawer, so that I can read and write notes without leaving the grid.
15. As Adarsh, I want the drawer to be a full-screen sheet on my phone, so that it is usable on a small screen.
16. As Adarsh, I want the drawer to show the title and a link to the original, so that I can open the video or post while I take notes.
17. As Adarsh, I want Esc, a close button and clicking the backdrop to close the drawer, so that it is easy to leave.
18. As Adarsh, I want `- ` and `1. ` lists to continue on Enter, and Tab and Shift+Tab to indent, so that note taking feels like Notion.
19. As Adarsh, I want an empty list item plus Enter to end the list, so that I can go back to paragraphs.
20. As Adarsh, I want my notes saved automatically with a visible Saved, Saving or Offline status, so that I never lose a thought.
21. As Adarsh, I want notes typed on my phone to appear on my laptop within seconds, so that both devices agree.
22. As Adarsh, I want an offline edit that clashes with another device kept as a copy, not lost, so that sync never eats my text.
23. As Adarsh, I want `12:34` and `1:02:03` in a YouTube item's notes to be links that open the video at that time, so that I can jump back to what I noted.
24. As Adarsh, I want those links only on YouTube items and only for times inside the video's length when known, so that a stray number like `3:45pm` does not become a link.
25. As Adarsh, I want to delete an item from a card menu after one confirm, so that removal is deliberate.
26. As Adarsh, I want the drawer to reopen on the same item from a link (`/watch?item=<id>`), so that I can share a place with myself across devices.
27. As Adarsh, I want an empty state that tells me to paste a link, so that the first visit makes sense.
28. As Adarsh, I want the page private like the rest of the hub, so that my notes never leak.
29. As Adarsh, I want the page to follow the hub's light motion rules (hover, drawer slide, theme only) and respect reduced motion, so that it matches the rest of the site.
30. As Adarsh, I want the cards, drawer and editor to use only the hub's design tokens, so that the page looks like it belongs.

## Implementation Decisions

**Schema (one new migration)**
- `watch_items`: id, `source_url` (canonical), `canonical_key` (unique, from the existing link normaliser), `source_type` (`youtube` or `x-post`), title, author (nullable), `thumb_url` (nullable, a remote image URL), `thumb_path` (nullable, an object in the private media bucket), `duration_s` (nullable), `notes` (text, default empty), `rev` (int, for compare-and-set sync), created_at, updated_at.
- **Thumbnails:** YouTube items use YouTube's own thumbnail URL directly, so nothing is stored. X items copy the image into the private media bucket, because X image links expire, and keep its path in `thumb_path`. Cards show whichever is set. Missing images show a neutral placeholder with the source icon.
- Single-user RLS like the other tables, and realtime enabled on `watch_items` for sync.
- A `save_watch_notes(id, text, base_rev)` function does the compare-and-set save, mirroring `save_notepad`. It returns ok, the stored text and rev.
- Deleting an item removes its row. For X items it also removes the stored image.
- No agent or CLI access in this version, so no `hub_worker` grants.

**Link handling (reuse, do not rebuild)**
- The existing link normaliser decides the canonical URL, the key and whether it is YouTube or X. The new page accepts only the `youtube` and `x-post` source types. X profile links (`x-user`) are refused, since there is nothing to note on.
- The existing preview endpoint already returns title, author and poster for these two sources and detects duplicates against cards. Watch notes gets its own preview and save routes that reuse the same capture drafting, but check duplicates against `watch_items`, not `cards`.
- The preview is fetched through the capture code's existing safety rules (no private network hosts). Failures use the existing capture error messages.

**Watch module (pure, new)**
- `acceptLink(url)`: runs the normaliser and returns the canonical key and source type, or a refusal message for unsupported links.
- `linkifyTimestamps(text, source, videoUrl, durationS)`: returns the text split into plain and timestamp parts. A timestamp is `m:ss`, `mm:ss` or `h:mm:ss` standing alone (not part of a longer number or inside a word). It becomes a link only for YouTube items, and only when the time is within `durationS` if that is known. The link is the video URL with `t=<seconds>`.
- `wordCount(text)`: reuses the existing helper.
- `filterItems(items, filter)` and `newestFirst(items)`.
- List help (`continueList`, `indent`) is reused from the Active projects module, not copied.

**Sync:** the drawer's editor reuses the existing notepad-sync decisions (`onLoad`, `onRemote`, `onSaveResult`) against the item's `rev`, with compare-and-set saves. A conflicting local copy is kept by appending it to the notes under a divider, so nothing is lost and no extra rows are needed.

**Page and components**
- The `/watch` route sits in the app shell. The nav item shows the item count.
- Paste bar and preview card (modelled on the Design paste bar, reduced to this flow), item grid with filter chips, item card, notes drawer with the editor and a timestamp-linked read view.
- **Notes display:** the drawer shows the editor while focused or empty, and a read view with timestamp links when not editing. Clicking the read view returns to editing.
- Styling uses `design/tokens.css` only. Body is Geist Sans and counts and times are Geist Mono. The drawer slides in only if reduced motion is off.
- The drawer is a native modal dialog, so Esc closes it and focus is trapped. The URL query `item=<id>` opens it on load.
- Server actions handle save, delete and the duplicate check.

## Testing Decisions

- **One seam:** the watch module's inputs and outputs, with no Supabase, DOM or network. A good test checks what the function returns for a given input, not how it gets there.
- Covers:
  - accepted and refused links (youtube.com, youtu.be, shorts, x.com, twitter.com, profile links, other sites)
  - timestamp detection (`0:05`, `12:34`, `1:02:03`, not `3:45pm`, not `12:345`, not inside a word)
  - the `t=` seconds in the generated link
  - links only on YouTube items and only within the known duration
  - filter and newest-first ordering
- Sync is covered by the existing `notepad-sync` tests, and list help by the Active projects tests.
- UI, routes and the migration are checked by hand in the browser: paste one real video, write notes, reload, and check that it syncs to a second tab.
- Prior art: `notepad-sync.test.ts`, `projects/day-blocks.test.ts`, `capture/src/normalise.test.ts`.

## Out of Scope

- Search across notes, tags, collections and any AI summary or enrichment.
- Embedded video player, transcripts and capturing the current play time.
- Links from other sites (podcasts, articles, TikTok).
- Agent or CLI access to the notes.
- Importing existing notes from elsewhere.
- Rich-text editing.
- Cloud agents reading the hub.

## Further Notes

- Supabase is on the free plan. Text is tiny: 1,000 items with notes is about 5 to 10 MB of the 500 MB database. Storing X thumbnails is the only part that adds up, and it stays small against 1 GB of storage.
- Run the slop-indicators card as the last check on the UI slice (project rule).
- Once done, push to `main` and check it on Vercel with one real video.

## Progress

- [ ] **A. Capture and grid**:
  - migration (table, RLS, realtime, save function)
  - the watch module with tests
  - `/watch` page and nav item
  - paste bar, preview card, save with duplicate check
  - item grid, empty state, All / YouTube / X filter
  - Done when one pasted video shows as a card after reload.
- [ ] **B. Notes drawer**:
  - right-hand drawer (full-screen sheet on phone), `?item=` link
  - list-aware editor with autosave and sync
  - read view with title, source link and word count
  - Done when notes typed on the phone show on the laptop within seconds.
- [ ] **C. Timestamps and housekeeping**:
  - timestamp links in the read view for YouTube items
  - card menu with Delete (one confirm) and stored X image removal
  - Done when `12:34` in a video's notes opens it at that time.
- [ ] **D. Ship**:
  - slop-indicators check
  - push to `main` and check on Vercel with one real video
