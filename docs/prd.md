# Personal hub — PRD

Nov 3, 2026 · @Gopal

## Summary

One private site on Vercel holds everything Adarsh collects: design references, job postings, cold emails, thoughts and a phone-to-laptop notepad, all in one shared layout. The design library is the first and most detailed page; the others are scoped here and detailed later.

**Problem.** About 20–30 references (X posts with mp4 animations, GitHub repos and skills, Reddit threads, other sites) are scattered across bookmarks, stars and notes. Agents can't browse those or watch videos, so they fall back to generic output. Polish skills (Impeccable, Emil's animation rules) raise the floor but don't supply direction.

**Solution.** Paste a link anywhere (Claude Code command, the gallery's input, or straight into a chat). The system identifies the source, saves the media, writes a card with a one-line summary, and publishes it to a gallery. Agents read a small index and open only the 2–3 cards that fit the task.

The 50 seed cards (your 27 links, with lists split into one card per site) are listed by shelf in Seed references.

## Hub shell

Every page uses one layout modelled on [Hairline's figures page](https://hairline.lucasmarkes.com/figures) (MIT licensed): a quiet top bar, a left side nav with counts, and a content column with a short heading and intro.

| Area | Requirement |
| --- | --- |
| Top bar, left | Site name + version tag, as Hairline does |
| Top bar, right | Dark/light toggle (follows system on first visit, remembers choice), LinkedIn icon, GitHub icon |
| Side nav | Design, Jobs, Cold email (nested under Jobs), Thoughts, Notepad; icon + label + item count, active item on a soft filled pill |
| Inside a page | On /design the side nav expands under Design to list its shelves with counts, as Hairline does; a shelf opens /design/\<shelf>. Source chips (X, GitHub, Site, YouTube) filter within a shelf |
| Content column | Heading line (no italic accent word, per the slop indicators), one-paragraph intro, then shelves (grouped sections with a small "n of n" count), as Hairline does |
| Mobile | Side nav collapses to a top sheet; same order |
| Typography | Geist Serif for headings only. Geist Sans for body and UI text: Vercel drew the two with the same cap height, x-height, stems and widths, so they share one baseline. Geist Mono for counts and code, like Hairline's "1 of 1". All three ship in the geist package |
| Colour | Near-white and near-black surfaces, hairline borders, one accent; all as CSS tokens for both themes |
| Auth | Whole site behind login (Supabase Auth, magic link, single allowed email) |

Routes:

| Route | Page | v1 scope |
| --- | --- | --- |
| `/design` | Design references | Full, as specified in this PRD |
| `/jobs` | LinkedIn job postings | Paste bar + saved postings; details later |
| `/jobs/cold-email` | Cold email tracker | Placeholder; details later |
| `/thoughts` | Sticky notes | Board of quick notes and project ideas |
| `/notepad` | Notepad | Notepad.js-style editor with sync |

## Paste bar and link preview

One shared paste bar sits at the top of `/design` and `/jobs`: paste any link and a preview card appears beneath it before anything is saved.

- Layout follows image 2 (label, wide input, action button), restyled to the hub: hairline border, no red, Geist type, the accent only on focus and the primary button.
- Auto-detects the source on paste (X post, GitHub repo, Reddit, YouTube, LinkedIn job, any website) and shows a small source chip; no manual type picker.
- Preview card shows what will be saved: poster or media, title, author, one-to-two-line draft summary, suggested tags.
- Actions on the preview: Save, Edit before saving, Discard. Enter saves; Esc discards.
- An image can also be pasted or dropped (e.g. a screenshot of a post) and becomes the card's preview, with the link kept as source.
- Errors stay inline: unreachable link, login-walled page (LinkedIn), duplicate of an existing card (offer to open it).

**Design card menu** (three dots, top right of each card): Pin to top, Copy card link, Open source, Archive, Delete. Archive hides the card from the grid and from agents, and it stays in an Archived filter. Delete asks once to confirm and removes the card and its media.

## Other pages

These share the shell and are scoped only as far as v1 needs; Adarsh will detail each later.

**`/jobs` — Job postings**

- Paste a LinkedIn (or any) job link; the preview shows company, role, location and posting date.
- LinkedIn often blocks logged-out fetching, so pasting the posting text or a screenshot is a supported fallback.
- Saved postings list as cards with a status (to apply, applied, interviewing, closed). Fields beyond that: later.
- Links to the existing `hr-job-outreach-email` and `founder-job-outreach-email` skills are a later step.

**`/jobs/cold-email` — Cold email tracker**

- Placeholder page in v1; structure decided later.

**`/thoughts` — Sticky notes**

- A board of short notes for project ideas and things to do; add with one keystroke, type, done.
- Each note: text, colour, created date, optional tag; pin, archive, delete.

**`/notepad` — Notepad**

- Modelled on [Notepad.js](https://notepad.js.org) (MIT licensed): one large distraction-free text area, autosave, word count, copy all, download as .txt, dark mode.
- One change from the original: notes sync through Supabase so text typed on the phone appears on the laptop within seconds. Notepad.js itself stores notes only in the browser.
- Installable as a PWA on the phone home screen, with an offline draft that syncs when back online.

## Goals and non-goals

**Goals**

- Adding a reference takes one paste and under a minute, from any of three entry points.
- Every reference has a playable preview, a one-to-two-line summary and a link to its source.
- Agents in Claude Code and Cursor use the library only on substantial design or frontend work, reading at most \~1,500 tokens before choosing cards.
- Animations from X posts can be rebuilt exactly, from a locally saved clip.
- The whole hub is private; an agent given a card URL can still read it with Adarsh's access token.

**Non-goals (v1)**

- Not a general bookmark manager; only design references.
- No accounts, comments or multi-user editing; Adarsh is the only editor.
- No automatic mood detection; mood and tags are set when a card is written, then confirmed by Adarsh.
- No replacement for Impeccable or Emil's skill; those stay as the polish layer.

## Core flows

The one user is Adarsh; the secondary users are his coding agents and any outside AI given the gallery URL.

**Flow A — Add a reference** (three entry points, one pipeline)

- `/add-ref <url>` in Claude Code or Cursor, from any project.
- Paste bar at the top of /design.
- Paste the link into any AI chat; the agent runs the same pipeline.

The pipeline:

1. Detect the source type from the URL (X post, GitHub repo, Reddit thread, website, video file).
2. Fetch content and media: download the X mp4, the repo's README and demo GIF, or a screenshot of the site.
3. Make a still poster frame and a short web clip from the media.
4. Draft the card: title, one-to-two-line summary, tags, mood dials, and what to reuse.
5. Show the draft to Adarsh to confirm or edit tags, then save it.
6. Save to Supabase; the card appears on /design at once and the local INDEX.md mirror refreshes on next sync.

**Flow B — Browse the gallery**

1. Grid of cards, each showing a still frame.
2. Hover plays the clip and shows the summary.
3. Click opens the source in a new tab; a secondary link opens the card's own page.
4. Filter by tag or mood dial.

**Flow C — Agent uses the library**

1. A task involving substantial design or frontend work triggers the skill.
2. The agent asks the kickoff questions if the work is new (see Agent integration).
3. It reads INDEX.md, shortlists 2–3 cards and states why.
4. It opens only those cards, then builds; Impeccable and Emil's rules apply as polish.

**Flow D — Reference by gallery link**

Adarsh gives an agent a gallery URL, either a card page or the whole site. The agent fetches it with the access token, finds the matching card via the page's structured data, and continues as in Flow C.

## Gallery site

The gallery is the /design page of the hub, server-rendered on Vercel behind login; each card page is plain HTML with structured data, so an agent holding the token can read it.

| Area | Requirement |
| --- | --- |
| Grid | Responsive masonry or uniform grid; card shows the still poster frame, title and source icon |
| Hover | Muted clip plays inline; one-to-two-line summary fades in over or under the frame |
| Touch | First tap = hover state, second tap = open source |
| Click | Opens the original source in a new tab; a small icon opens the card page (`/r/<slug>`) |
| Card page | Full clip, summary, tags, mood dials, "what to reuse" notes, source link, related cards |
| Filters | Tags and mood dials, kept in the URL query so a filtered view can be shared or given to an AI |
| Add box | Replaced by the shared paste bar (see Paste bar and link preview) |
| Motion | Hover and filter transitions follow `my-motion`; respects reduced motion (no autoplay, show still) |
| Performance | Poster images lazy-loaded; clips load only on hover; target LCP under 2.5 s |

**Shelves.** One card per site, never one card per list; a list someone posted becomes several cards that credit it as the source. Cards sit on shelves by what they are, Hairline-style: Landing pages and portfolios, Motion and interactions, Agent skills, Backgrounds and assets, Typography, Tools and directories, Talks and people, Anti-slop. A card has one shelf; its tags cover the rest.

## Data model

Supabase is the single source of truth (cards in Postgres, media in Storage), because pin, archive and delete happen in the UI. A sync command mirrors active cards to a local folder, so agents read files instead of calling the network.

```
design-library/
  INDEX.md              # one line per card, generated
  refs/<slug>/
    card.md             # frontmatter + notes
    clip.mp4            # original media (exact-rebuild source)
    preview.webm        # short web clip for hover
    poster.webp         # still frame
    frames/             # extracted on demand for rebuilds
  site/                 # Next.js gallery
  skill/SKILL.md        # agent skill
```

Card frontmatter fields:

| Field | Example | Notes |
| --- | --- | --- |
| slug | `magnetic-dock-hover` | URL and folder name |
| title | Magnetic dock hover | Short, descriptive |
| source\_url | https://x.com/... | Original link |
| source\_type | x-post | x-post, github, reddit, site, video |
| author | @handle | Credit shown on card |
| summary | Icons scale with cursor distance; springy, no overshoot | One to two lines, also the hover text |
| kind | micro-interaction | layout, animation, micro-interaction, component, asset, typography, skill, directory |
| tags | dock, hover, spring | Free tags |
| mood | variance 3, motion 8, density 4 | 1–10 dials for picking by mood |
| fits | playful consumer apps, portfolios | Projects or users it suits |
| stack | Framer Motion, React | Libraries seen or implied |
| reuse | Spring config, distance falloff | What to take from it |
| added | 2026-11-03 | Date added |

Two more fields are set from the card menu: `pinned` (true or false) and `status` (active or archived). Archived cards are left out of the local mirror.

**Directory cards.** Many references are living collections by one maker (Bencho, Recent, Land-book) with no repo or skill, and they keep growing. A `directory` card adds three fields: `browse_notes` (how the site is organised, e.g. Bencho tags each block by gesture and gives it its own page), `last_checked` (date), and `picks` (item-level links Adarsh or an agent saved from inside it, each with its own one-line note). The gallery shows a Directory badge and the item count when known.

INDEX.md line format: `slug | kind | mood | summary` — about 40 tokens per card, so 30 cards stay near 1,200 tokens.

## AI access

Your own agents read the local mirror (fast, free, offline); a URL works only with a personal access token, since the whole hub is private and nothing is indexed by search engines.

| Surface | What it serves | Who uses it |
| --- | --- | --- |
| `INDEX.md` (local mirror) | One line per active card | Claude Code, Cursor |
| `refs/<slug>/card.md` (local mirror) | Full card | Agents after shortlisting |
| `/llms.txt` (token) | Hub summary + one line and link per card | Agents given the hub URL |
| `/r/<slug>` (login or token) | Card page with JSON-LD (`CreativeWork` / `VideoObject`) | You, Flow D |
| `/r/<slug>.md` (token) | Raw card markdown | Agents given a card URL |
| `/api/refs.json` (token) | Cards as JSON, filterable by query | Sync command, scripts |
| `robots.txt` | Disallow all | Keeps the hub out of search |

The token is read-only and passed as a header or `?token=`; it can be rotated from settings. Every card describes its video in text, since agents can't watch it.

## Agent integration

A single `design-library` skill does the work; a three-line rule in each tool's always-on config only says when to use it and when to ask.

**Install (one library, two tools)**

- Claude Code: symlink `design-library/skill` to `~/.claude/skills/design-library` (global, every project).
- Cursor: a global rule pointing to the same `SKILL.md` and `INDEX.md` paths.
- `/add-ref` command lives in the same skill folder for both tools.

**Trigger**

- Fires on substantial design or frontend work: new project, new page or screen, new component, hero or landing, animation or motion work, redesign.
- Does not fire on bug fixes, copy changes, small style tweaks or backend work.

**Ask-gate**

- New project, new page or redesign: ask before building. Show the 2–3 shortlisted cards with one line on why, plus 3–4 quick questions (audience, mood dials, project weight, must-use reference).
- Smaller design decisions inside an existing project: pick from the project's chosen cards without asking, and name which card was used in the reply.
- The chosen cards are saved to the project's `design/DESIGN.md`, so later sessions reuse them instead of re-reading the library.

**Exact rebuild (animation cards)**

1. Extract frames from `clip.mp4` every 0.25 s, plus a contact sheet and sampled palette (motion2code / motiscope approach).
2. Measure timing, easing, stagger and loop from the frames; write a short motion spec.
3. Build with the project's stack (CSS, Framer Motion or GSAP).
4. Render the result to video and compare frame by frame with the source; iterate until it matches.

**Order with existing skills**: library sets direction → `design-grill` turns it into the project's design system → Impeccable and Emil's rules polish.

**Anti-slop gate.** The slop-indicators card is stored as plain text, not just a screenshot, with a Copy button, so it can be pasted anywhere. The skill runs it as the last check on every build and names any indicator it left in on purpose.

**Using a directory card.** There is no code to read, so the agent browses: it opens the site with the built-in browser, uses `browse_notes` to find items that fit the task, records the chosen item as a short screen recording, saves it as a pick, then follows the exact-rebuild steps above. A weekly scheduled task revisits each directory, notes what is new since `last_checked`, and lists it on the card.

## Architecture and stack

&#91;embedded content: system architecture · 3 entry points, 1 library, 2 consumers\]

All three entry points run the same pipeline into one repo; the gallery and the agent skill are both built from it, so they never drift apart.

| Layer | Choice | Why |
| --- | --- | --- |
| Site | Next.js, static generation, on Vercel | Server-rendered pages, geist font package; Vercel already connected |
| Content | Supabase Postgres: cards, jobs, notes, notepad text | UI edits and phone-to-laptop sync need a live database; already connected |
| Media storage | Supabase Storage, private buckets | Clips, posters and screenshots next to the data |
| Video processing | ffmpeg | Poster frame, web clip, frame extraction |
| X media download | yt-dlp | Handles video on X posts |
| Capture logic | One Node script, called by `/add-ref` and by a site API route | Same pipeline for every entry point |
| Machine-readable output | llms.txt, JSON-LD, `.md` routes, all behind the access token | Agents read the hub by URL |

## Milestones

Each milestone is usable on its own, so the library helps before the site exists.

1. **Hub shell.** Repo, Vercel deploy, Supabase Auth, shared layout, side nav, theme toggle, LinkedIn and GitHub icons, Geist Serif. Done when all five routes load behind login.
2. **Notepad.** Notepad.js-style editor with Supabase sync and PWA install. Done when text typed on the phone shows on the laptop within seconds.
3. **Design library + skill.** Card schema, local mirror and INDEX.md, `design-library` skill and the ask-gate rule in Claude Code and Cursor.
4. **Paste bar + capture pipeline.** Source detection, preview, media download, poster and clip, drafted card. Done when the 50 seed cards are in.
5. **Design gallery.** Grid, still frame + hover play + summary, click to source, card pages, filters, card menu (pin, copy, open, archive, delete).
6. **Thoughts.** Sticky-note board.
7. **Agent access.** Token, llms.txt, `.md` card routes, JSON API. Done when an agent given a card URL finds the right card (Flow D).
8. **Exact-rebuild workflow.** Frame extraction, motion spec, render-and-compare loop on one X animation.
9. **Jobs and cold email.** After Adarsh details them.

## Open questions to grill

- [ ] Look of the gallery itself: is it a showcase of your taste (designed with care) or a neutral grid that lets the references speak?
- [ ] Which mood dials matter to you? Start with variance, motion, density, or add others (warmth, playfulness, seriousness)?
- [ ] Are some references private (unreleased work, paid assets) and need to stay off the public site?
- [ ] Copyright: is it fine to host other people's clips publicly, or should the public site show only poster + link while full clips stay local?
- [ ] Does capture from phone matter later (share sheet or bot), or are three entry points enough?
- [ ] How strict is "exact rebuild": pixel and timing match, or same motion with your project's colours and type?
- [ ] Should cards record which projects used them, so the gallery shows where each reference ended up?
- [ ] Domain name and whether the gallery doubles as a public portfolio piece.

**Hub questions**

- [x] Decided: Geist Serif for headings, Geist Sans for body and UI, Geist Mono for counts.
- [x] Decided: no italic accent words; the slop indicators are kept as a copyable text checklist and a build gate.
- [ ] Site name and version tag for the top-left mark.
- [ ] Should Thoughts and Notepad merge (a note promoted to a sticky), or stay separate?
- [ ] Notepad: one running note like Notepad.js, or several named notes?
- [x] Decided: one card per site, grouped on shelves you can open.
- [ ] Jobs: which fields and statuses, and how cold emails link to a posting.
- [ ] Should the X-account entry (item 24) be a card, or a "people to watch" list?

## Sources

- [Your Code Style Skill Is Making Claude Worse](https://varunbhanot.substack.com/p/your-code-style-skill-is-making-claude) — skill vs always-on cost
- [VoltAgent/design-md](https://github.com/VoltAgent/design-md) — DESIGN.md format
- [mihaiserban/skills](https://github.com/mihaiserban/skills) — taste distiller
- [motion2code](https://github.com/lovisdotio/motion2code/wiki) — video to code
- [motiscope](https://github.com/KumarSashank/motiscope) — motion spec from recordings
- [taste-skill](https://x-cmd.com/install/taste-skill/) — mood dials
