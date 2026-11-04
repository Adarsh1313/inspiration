---
description: Fill in summaries, tags, mood and reuse notes for design cards that lack them
argument-hint: [--limit N]
---

Enrich Adarsh's design cards from this Claude Code session. No API calls: you do the reading and writing, he approves once.

Hub repo: `C:\Users\Adarsh\inspiration`.

## 1. Find the cards

```
pnpm --dir C:\Users\Adarsh\inspiration enrich list $ARGUMENTS
```

It prints JSON for cards missing a summary, tags, mood or reuse notes (default 20; `--all` includes complete ones). If the list is empty, say so and stop.

## 2. Read each source

For every card, read what it actually is before writing anything:
- **site / directory**: open `source_url` (WebFetch, or the built-in browser if the page needs it). For `kind: directory`, use `browse_notes` if present; otherwise write short notes on how to browse it (filters, sections, what's worth opening).
- **github**: the README and repo description.
- **youtube**: use the `transcript` field. Summarise the talk's argument, not its title.
- **x-post / reddit**: the post text in `description`. For a clip, if `design-library/refs/<slug>/clip.mp4` exists, pull a few frames with `ffmpeg -i clip.mp4 -vf "fps=2,scale=480:-1,tile=4x" -frames:v 1 sheet.jpg` into the scratchpad and look at the sheet, so `video_description` says what happens on screen. If there is no clip, describe from the text and say so.
- **person**: what they make and where to see it. Set `related` to their work cards.
- Rows with `needs_review: true` need a real check: confirm what the link is, and fix `shelf` / `kind` if the guess was wrong. Say so in the table.

## 3. Draft all of them in ONE table

Show a single table, one row per card: slug, kind/shelf (mark changes), summary, tags, mood (variance / motion / density, 1 to 10), reuse note. Keep summaries to one sentence that works as an index line (first 110 characters matter most). Mood: variance = how experimental the layout is, motion = how much movement, density = how much is on screen. Tags are lowercase kebab-case, 3 to 6 each.

Ask Adarsh to approve, or to name rows to change. Do not write anything before he approves. Apply his edits and show only the changed rows.

## 4. Write the approved set

Write a JSON array to the scratchpad (not the repo), one object per card:

```json
{ "slug": "...", "summary": "...", "tags": ["..."], "mood": { "variance": 4, "motion": 8, "density": 3 },
  "fits": ["landing-page"], "stack": ["react", "gsap"], "reuse": "...", "video_description": "...",
  "kind": "animation", "shelf": "motion-interactions", "browse_notes": "...", "item_count": 170,
  "related": ["other-slug"], "activate": true }
```

Only `slug`, `summary`, `tags` and `mood` are required. Then:

```
pnpm --dir C:\Users\Adarsh\inspiration enrich apply <file>
pnpm --dir C:\Users\Adarsh\inspiration sync
```

`apply` validates everything first and writes nothing if any entry is bad. Approved cards become active and leave the review queue, so they show up on the site and in `design-library/INDEX.md` straight away.

Finish with: how many cards were enriched, and any card you could not read (blocked, login wall) so Adarsh can paste a screenshot.
