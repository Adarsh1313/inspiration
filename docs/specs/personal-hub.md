# Spec: Personal hub

Status: ready-for-agent
Sources: docs/prd.md (scope), docs/decisions.md (34 decisions, these override the PRD where they differ), docs/research/capture-pipeline.md (capture details), docs/seed-references.md (50 seed cards), design/DESIGN.md + design/tokens.css (visual system, fixed).

## Problem Statement

Adarsh collects design references (X posts with animation clips, GitHub repos and skills, Reddit threads, galleries and directories), job postings and quick thoughts. They are scattered across bookmarks, stars, notes and two devices. Coding agents can't browse bookmarks or watch videos, so when Adarsh asks for design work they fall back to generic output. Polish skills raise the floor but give no direction. Text typed on the phone doesn't reach the laptop. There's no single private place that holds all of it in one consistent layout and that agents can also read.

## Solution

A private hub site on Vercel, with Adarsh as the only user. It has one shared layout modelled on Hairline's figures page and these pages:

- **/design**, the reference library and the main page. Pasting a link (or an image) shows a preview right away and saves a draft card. A local worker on the laptop later downloads the media, makes a poster and a short hover clip, and refreshes a local mirror (`design-library/`: INDEX.md plus one folder per card). A `design-library` Claude Code skill reads the mirror, shortlists 2–3 cards for substantial design work, and asks before building. `/enrich-cards` fills summaries, tags and mood dials from a Claude Code session, at no API cost.
- **/jobs**, saved job postings with a status.
- **/jobs/cold-email**, a placeholder page.
- **/thoughts**, a sticky-note board.
- **/notepad**, a Notepad.js-style editor that syncs phone to laptop within seconds and installs as a PWA.

Agents given a hub URL can read cards with a read-only token through `llms.txt`, `.md` card routes and a JSON API.

## User Stories

### Shell and access
1. As Adarsh, I want the whole site behind a login, so that nothing I collect is public.
2. As Adarsh, I want to log in by typing a 6-digit code emailed to adarshbharathwaj13@gmail.com, so that login works inside the installed iPhone PWA where magic links break.
3. As Adarsh, I want any other email to be refused without sending a code, so that nobody else can get in.
4. As Adarsh, I want to stay logged in for 90 days on each device, so that I rarely see the login screen.
5. As Adarsh, I want a quiet top bar with `inspiration` and a mono `v0.1.0` tag on the left, so that I know which build I'm on.
6. As Adarsh, I want a theme toggle in the top bar that follows the system on my first visit and then remembers my choice, so that the hub suits the room.
7. As Adarsh, I want LinkedIn and GitHub icons in the top bar that link to my profiles, so that the hub doubles as a personal home.
8. As Adarsh, I want a left side nav with Design, Jobs (with Cold email nested under it), Thoughts and Notepad, so that every page is one click away.
9. As Adarsh, I want each side-nav item to show a Geist Mono item count, so that I can see how much is in each area at a glance.
10. As Adarsh, I want the active nav item on a soft filled pill, so that I always know where I am.
11. As Adarsh, I want the side nav to collapse into a top sheet on my phone, in the same order, so that the hub works one-handed.
12. As Adarsh, I want every page to open with a short serif heading and a one-paragraph intro, so that the hub reads like Hairline.
13. As Adarsh, I want robots.txt to disallow everything and every page to be noindex, so that search engines never list the hub.

### Adding a reference (paste bar)
14. As Adarsh, I want a paste bar at the top of /design, so that adding a reference is one paste.
15. As Adarsh, I want the source detected automatically (X post, GitHub repo, Reddit, YouTube, LinkedIn, website) and shown as a small chip, so that I never pick a type by hand.
16. As Adarsh, I want a preview card under the paste bar, before anything is saved, showing the poster or media, title, author and the fetched description, so that I can see what will be saved.
17. As Adarsh, I want Save, Edit before saving and Discard on the preview, with Enter to save and Esc to discard, so that adding stays fast.
18. As Adarsh, I want to choose the card's shelf on the preview, prefilled with a best guess from the source type, so that the card lands in the right group.
19. As Adarsh, I want to paste or drop an image, such as a screenshot of a post, as the card's preview while the link stays the source, so that walled or odd sources still get a picture.
20. As Adarsh, I want tracking parameters stripped and URL variants unified (twitter.com/fxtwitter/x.com, youtu.be/shorts/watch), so that the same reference never becomes two cards.
21. As Adarsh, I want a duplicate paste to show an inline "already saved" message with a link to the existing card, so that I don't add it twice.
22. As Adarsh, I want an unreachable or login-walled link to show an inline error but still let me save the link with a screenshot, so that nothing blocks capture.
23. As Adarsh, I want a saved draft to appear on /design straight away with a small "media pending" mark, so that I can see it was saved before the worker runs.
24. As Adarsh, I want to paste a link into the paste bar on my phone, so that I can capture from anywhere without a share sheet.
25. As Adarsh, I want `/add-ref <url>` in Claude Code from any project to run the same pipeline and the worker immediately, so that I can add references while coding.
26. As Adarsh, I want to paste a link into any Claude Code chat and have the agent run the same pipeline, so that there's no special syntax to remember.

### Media and the local worker
27. As Adarsh, I want a worker on my laptop to download each draft's media (X mp4, README GIF, site screenshot, Reddit video), so that every card gets a real preview.
28. As Adarsh, I want the worker to make a still poster at two sizes and a muted hover clip (H.264, 6 s or shorter, 1 MB or smaller), so that the gallery loads fast and plays on iPhone.
29. As Adarsh, I want the original clip kept, so that an animation can be rebuilt exactly later.
30. As Adarsh, I want the worker to run at logon and every 2 hours, and to exit immediately when there's nothing to do, so that it costs nothing when idle.
31. As Adarsh, I want `pnpm capture:pending` to run the worker by hand, so that I can fill cards right after pasting.
32. As Adarsh, I want a failed step to retry a few times and then mark the card "media failed" with the reason, so that I know which cards need a manual image.
33. As Adarsh, I want the worker to use its own limited database role, so that a leaked laptop key can't wipe the hub.
34. As Adarsh, I want transcripts fetched for YouTube talks, so that agents can read a talk's content.

### Browsing the gallery
35. As Adarsh, I want /design grouped into the 8 shelves, each with a heading and a mono "n of n" count, so that the library reads like Hairline.
36. As Adarsh, I want the Design side-nav item to expand into shelves with counts, each opening /design/<shelf>, so that I can browse one shelf at a time.
37. As Adarsh, I want source chips (X, GitHub, Site, YouTube) that filter within a shelf, so that I can narrow by source.
38. As Adarsh, I want each card to show its still poster, title and source icon, so that the grid is calm until I engage.
39. As Adarsh, I want hovering a card to play its clip muted and fade in the summary, so that I can scan motion without opening anything.
40. As Adarsh, I want the first tap on a phone to act like hover and the second tap to open the source, so that touch browsing works.
41. As Adarsh, I want clicking a card to open the source in a new tab, with a small icon that opens the card page, so that the common action is one click.
42. As Adarsh, I want reduced-motion settings to stop autoplay and show the still poster, so that the hub respects my system setting.
43. As Adarsh, I want filters for tags and mood dials (variance, motion, density) kept in the URL query, so that I can share a filtered view with an AI.
44. As Adarsh, I want directory cards to show a Directory badge and an item count when it's known, so that I can tell living collections from single references.
45. As Adarsh, I want posters to lazy-load and clips to load only on hover, so that the page's LCP stays under 2.5 s.

### Card page and card menu
46. As Adarsh, I want a card page at /r/<slug> with the full clip, summary, tags, mood dials, "what to reuse", fits, stack, source link, related cards and "used in" projects, so that one page has everything about a reference.
47. As Adarsh, I want directory card pages to show browse notes, the last-checked date and saved picks with their notes, so that I remember how to use the directory.
48. As Adarsh, I want a three-dot menu on each card with Pin to top, Copy card link, Open source, Archive and Delete, so that I can manage cards in place.
49. As Adarsh, I want archived cards hidden from the grid and from agents but kept under an Archived filter, so that archiving is reversible.
50. As Adarsh, I want Delete to ask once, then remove the card and its media, so that deletes are deliberate and complete.
51. As Adarsh, I want to edit a card's title, summary, shelf, tags and mood on its page, so that I can fix a draft without an agent.
52. As Adarsh, I want the slop-indicators card stored as plain text with a Copy button, so that I can paste the checklist anywhere.

### Enrichment without API spend
53. As Adarsh, I want `/enrich-cards` in Claude Code to find cards missing a summary, tags, mood or reuse notes, read their sources, and show all drafts in one table, so that I can approve them in a single pass on my subscription.
54. As Adarsh, I want approved enrichments written straight to Supabase and shown on the site without a redeploy, so that updates are instant.
55. As Adarsh, I want every card to describe its video in text, so that agents that can't watch video still understand it.

### Seed import
56. As Adarsh, I want a seed script to import the 50 cards in docs/seed-references.md through the normal pipeline, so that the library starts full.
57. As Adarsh, I want rows marked "confirm" (and the link with no URL) imported as drafts flagged for my review, so that guesses never pass as facts.
58. As Adarsh, I want @zzzzshawn imported as a `person` card related to Orbkit and Dotmatrix, so that people sit beside their work.

### Local mirror and agent skill
59. As Adarsh's coding agent, I want `design-library/INDEX.md` with one `slug | kind | mood | summary` line per active card (about 40 tokens each), so that I can shortlist under about 1,500 tokens.
60. As Adarsh's coding agent, I want `design-library/refs/<slug>/card.md` with frontmatter and notes next to the poster, preview and original clip, so that I can open only the cards I chose.
61. As Adarsh, I want the worker to refresh the mirror after every run and `pnpm sync` to refresh it on demand, so that agents always read current cards.
62. As Adarsh, I want the `design-library` skill installed globally for Claude Code through a symlink, so that every project can use it.
63. As Adarsh, I want the skill to fire only on substantial design or frontend work (new project, page, component, hero, motion, redesign) and never on bug fixes, copy, small tweaks or backend work, so that it doesn't waste context.
64. As Adarsh, I want the skill, for a new project, page or redesign, to show 2–3 shortlisted cards with one line on why, plus 3–4 kickoff questions, before building, so that I set the direction.
65. As Adarsh, I want the skill, for smaller decisions inside a project, to pick from the project's chosen cards without asking and name the card it used, so that small work stays fast.
66. As Adarsh, I want chosen cards written into the project's design/DESIGN.md and the project appended to each card's `used_in`, so that later sessions reuse them and I can see which references earn their place.
67. As Adarsh, I want the skill to run the slop-indicators check last on every build and name any indicator it kept on purpose, so that output avoids generic tells.
68. As Adarsh, I want a documented (not installed) Cursor rule in the skill folder, so that I can add Cursor later.
69. As Adarsh's coding agent, I want to browse a directory card's site with the built-in browser using its browse notes, record the chosen item, and save it as a pick, so that directories without code are still usable.

### Agent access by URL
70. As an agent given the hub URL and token, I want /llms.txt with a hub summary and one line and link per card, so that I can find the right card.
71. As an agent given a card URL and token, I want /r/<slug>.md to return the raw card markdown, so that I can read it without HTML.
72. As an agent, I want /r/<slug> to embed JSON-LD (CreativeWork / VideoObject), so that I can parse the card page.
73. As a script, I want /api/refs.json with query filters (shelf, kind, tag, status), so that tools can list cards.
74. As Adarsh, I want the token passed as a header or `?token=`, read-only, and rotated with `pnpm token:rotate`, so that sharing access is easy and revocable.
75. As Adarsh, I want requests with no token or a wrong one to get 401 on machine routes and a login redirect on pages, so that nothing leaks.

### Exact rebuild
76. As Adarsh's coding agent, I want to extract frames every 0.25 s from a card's original clip, plus a contact sheet and a sampled palette, so that I can measure the motion.
77. As Adarsh's coding agent, I want to write a short motion spec (timing, easing, stagger, loop) from the frames, so that the rebuild is grounded in data.
78. As Adarsh's coding agent, I want to render my rebuild to video and compare it frame by frame with the source until timing and choreography match in the target project's colours and type, so that "exact" means the same motion, not the same brand.

### Thoughts
79. As Adarsh, I want to press N on /thoughts to add a sticky note and type straight away, so that capturing an idea takes one keystroke.
80. As Adarsh, I want each note to have text, a colour, a created date and an optional tag, so that I can group ideas loosely.
81. As Adarsh, I want to pin, archive and delete notes, so that the board stays focused.

### Notepad
82. As Adarsh, I want /notepad to be one large, distraction-free text area with autosave, word count, copy all and download as .txt, so that it works like Notepad.js.
83. As Adarsh, I want text typed on my phone to appear on my laptop within seconds, so that the notepad bridges my devices.
84. As Adarsh, I want the notepad installable as a PWA on my phone's home screen, so that it opens like an app.
85. As Adarsh, I want offline typing kept as a local draft that syncs when I'm back online, so that I never lose text.
86. As Adarsh, I want an offline edit that conflicts with a newer server version kept as an archived copy, so that a conflict never loses words.
87. As Adarsh, I want "clear" to archive the current text before emptying the page, so that clearing is never destructive.

### Jobs and cold email
88. As Adarsh, I want the same paste bar on /jobs, with a preview showing company, role, location and posting date, so that saving a posting is one paste.
89. As Adarsh, I want to paste a posting's text or a screenshot when LinkedIn blocks fetching, so that walled postings can still be saved.
90. As Adarsh, I want saved postings listed as cards with a status (to apply, applied, interviewing, closed) that I can change, so that I can track applications.
91. As Adarsh, I want /jobs/cold-email to exist as a placeholder in the shell, so that the nav is complete before I detail it.

## Implementation Decisions

### Repo and stack
- Monorepo managed with pnpm workspaces. Top-level areas: the Next.js site (App Router, TypeScript, Vercel functions pinned to `bom1`), the capture package shared by the site and the worker, the local worker and its scripts, and `design-library/` (the generated mirror plus the skill). There's one GitHub repo, private `Adarsh1313/inspiration`, connected to Vercel, which auto-deploys `main`.
- Free tiers: Supabase Free in `ap-south-1` and Vercel Hobby. There are no paid AI calls anywhere in the runtime.
- Fonts come from the `geist` package: Serif for headings only, Sans for body and UI, Mono for counts and code. Styling uses design/tokens.css only, with no raw hex or px in components.

### Modules (deep modules, small interfaces)
- **Capture core** (shared, pure apart from injected `fetch`):
  - `normalise(url) → { canonicalUrl, canonicalKey, sourceType }` covers host allowlist detection, tracking-param stripping and variant unification. The X key is the status id and the YouTube key is the video id.
  - `draft(url, { fetch }) → Draft` returns `title, author, description, posterUrl, mediaUrl?, sourceType, suggestedShelf, kind, errors[]`.
  - Per-source extractors sit behind it, with layered fallbacks from the research:
    - X: FxTwitter JSON, then syndication, then oEmbed.
    - GitHub: repo API plus README, taking the first image or GIF.
    - YouTube: oEmbed plus thumbnail.
    - Reddit, LinkedIn and websites: Open Graph.
  - It has an SSRF guard, a 5 s timeout and a response size cap. It ports Resurface's oEmbed and handle logic, with a real HTML entity decoder.
- **Capture API** (site route): `POST` takes a URL or an image and returns a Draft preview without saving. A second call saves the card as `status: draft` and queues capture tasks. It rejects duplicates by `canonical_key` and returns the existing slug.
- **Worker** (local Node CLI):
  1. Claims queued capture tasks (`update … where status='queued' returning`, with a `locked_at` lease).
  2. Runs each step idempotently, keyed on `(card_id, step)`. The steps are download, poster, preview, transcript and screenshot.
  3. Uploads to Storage and updates the card's `media_status`.
  4. Refreshes the mirror at the end of the run.

  Its retry classification is ported from Resurface: 5xx, 408 and 429 retry; 401 is an auth error; other 4xx fail. Tools: yt-dlp (kept updated, with `--cookies-from-browser` only on failure), ffmpeg recipes from the research, Playwright with a persistent profile for screenshots, and the Reddit OAuth script app. It's launched by Windows Task Scheduler at logon and every 2 hours, and by hand with `pnpm capture:pending`. It authenticates as a limited Postgres role that can only read and update capture tasks and card media fields and write to the media bucket.
- **Mirror generator**: `buildMirror(cards) → file tree` writes INDEX.md (`slug | kind | mood | summary`, active cards only, pinned first) and `refs/<slug>/card.md` with frontmatter. Media files are copied from Storage. It's a pure function plus a thin writer, run by `pnpm sync` and by the worker.
- **Card store**: server-side data access for cards (list by shelf/filters, get by slug, update, pin, archive, delete with media cleanup), notes, notepad, and job postings. It's the only module that talks to Supabase from the site.
- **Access guard**: middleware that allows `/login` and robots, accepts the read-only token (header or `?token=`) only on machine routes, and otherwise needs a Supabase session for the allowed email. It sets the session cookie max-age to 90 days.
- **Notepad sync**: a client module that saves debounced (500 ms) to a single notepad row, subscribes to Realtime for remote changes, and keeps an offline draft in local storage. On reconnect, if the server version moved since the last sync, it archives the local draft as a copy. "Clear" archives first. It uses a service worker for PWA install and offline shell.
- **Skill package** (`design-library/skill`): SKILL.md (trigger rules, ask-gate, shortlist format, DESIGN.md write-back, `used_in` append, slop gate as last step, directory-card browsing, exact-rebuild workflow), the `/add-ref` and `/enrich-cards` commands, and a documented, uninstalled Cursor rule. It's symlinked to `~/.claude/skills/design-library`.

### Schema (Supabase Postgres)
- `cards`:
  - Identity and source: `id`, `slug` (unique), `canonical_key` (unique), `source_url`, `source_type` (x-post, github, reddit, youtube, site, video, linkedin).
  - Content: `title`, `author`, `summary`, `description`, `kind` (layout, animation, micro-interaction, component, asset, typography, skill, directory, person, talk), `shelf` (one of the 8 shelves), `tags` text[], `mood` jsonb (`{variance, motion, density}`, each 1–10, extensible), `fits` text[], `stack` text[], `reuse` text, `notes` markdown, `video_description` text, `transcript` text.
  - State: `status` (draft, active, archived), `media_status` (pending, ready, failed) and `media_error`, `needs_review` bool (for "confirm" rows), `pinned` bool.
  - Usage and links: `used_in` text[], `related` uuid[].
  - Directory fields: `browse_notes`, `last_checked`, `picks` jsonb (`[{url, note, saved_at}]`), `item_count`.
  - Media and dates: media paths (`poster_sm`, `poster_lg`, `preview`, `original`), `added_at`, `enriched_at`.
- `capture_tasks` holds the worker queue. It is deliberately not called "jobs", to avoid a clash with Jobs postings. Columns: `id`, `card_id`, `step`, `status` (queued, running, done, failed), `attempts`, `locked_at`, `last_error`, with unique `(card_id, step)`.
- `notes` (Thoughts): `id`, `text`, `colour`, `tag`, `pinned`, `status`, `created_at`.
- `notepad` holds a single row (`text`, `updated_at`, `rev`). `notepad_archive` holds `id`, `text`, `reason` (cleared, conflict) and `created_at`.
- `job_postings`: `id`, `source_url`, `canonical_key`, `company`, `role`, `location`, `posted_at`, `status` (to-apply, applied, interviewing, closed), `raw_text`, `screenshot`, `created_at`.
- RLS is on for every table. The authenticated policy allows only the allowed email. The worker role has column-scoped grants. Site server routes that serve the token use the service key server-side only.
- Storage has one private `media` bucket with immutable hashed object names, `cacheControl` set to one year, and batch signed URLs with a 1 h TTL generated server-side. The worker pre-renders posters at two sizes, because image transforms need Pro.

### Routes
`/login`, `/design`, `/design/[shelf]`, `/r/[slug]`, `/r/[slug].md`, `/jobs`, `/jobs/cold-email`, `/thoughts`, `/notepad`, `/llms.txt`, `/api/refs.json`, the capture API, `robots.txt`, the web manifest and the service worker. A root `/` redirects to `/design`.

### Interactions
- Motion follows DESIGN.md's light budget: hover colour and shadow, summary fade, filter reflow, the mobile nav sheet. There are no page transitions or staggered entrances. Implementation follows the my-motion and emil-design-eng skills.
- Paste bar keys: Enter saves and Esc discards. On /thoughts, N adds a note. Touch: the first tap acts as hover, the second opens the source.
- Errors stay inline under the input, with no error toasts.

## Testing Decisions

- A good test drives a module through its public interface with realistic input and asserts on observable output. It never asserts on internal calls or file layout that isn't part of the contract.
- **Seams (four):**
  1. **Capture core** is the main seam. Vitest runs `normalise` and `draft` against recorded HTTP fixtures, one set per source and fallback path, including failures (timeout, 403, authwall, oversize, SSRF attempt). This covers detection, dedupe keys and extraction without network access.
  2. **Worker media steps** run real ffmpeg on a tiny committed fixture video. The test asserts the poster exists at both sizes, the preview is H.264, 6 s or shorter and 1 MB or smaller, steps are idempotent on rerun, and retry classification is correct. The task store is an in-memory adapter behind the same interface the worker uses against Supabase.
  3. **Mirror generator** gets card rows and is checked for the INDEX.md line format, active-only filtering, pinned-first order, about 40 tokens per line, and a 30-card index under about 1,500 tokens.
  4. **End-to-end** Playwright smoke runs against `pnpm dev`, backed by a second free Supabase project `hub-test`, with a session minted through the admin API for the allowed email. It covers: all routes load behind login, an unauthenticated user is redirected, token routes return 401 without the token, paste → preview → save → draft visible, card menu archive and restore, and the notepad saving and reappearing in a second browser context.
- There is no prior art in the repo because it's greenfield. Resurface's retry classifier is the reference for worker retry tests.
- Each milestone is also verified by hand in the built-in browser at desktop and mobile widths in both themes, against DESIGN.md.

## Out of Scope

- AI API calls from the site or worker. Enrichment runs only through Claude Code sessions.
- Cold email structure (placeholder only), and Jobs fields beyond company, role, location, posting date and status, as well as links to the outreach-email skills.
- Share sheet, bot or browser-extension capture.
- Installing a Cursor rule (documented only).
- Custom domain, multi-user, comments or public portfolio mode.
- Automatic mood detection without confirmation.
- A settings page (the token rotates by script).
- Server-side image transforms and Vercel-hosted Chromium.

## Further Notes

- Decisions in docs/decisions.md override the PRD: `preview.mp4` instead of `preview.webm`, OTP instead of magic link, local-only Reddit, transcripts and screenshots.
- Risks: X endpoints break without notice (layered fallbacks, `yt-dlp -U`). The Supabase Free 1 GB storage limit applies, so watch original clip sizes. The 7-day inactivity pause is avoided by daily use. Scraping X is against its ToS, and this is personal use only.
- The seed row "AI design skills (landing-page skill)" has no URL. It's imported as a `needs_review` draft until Adarsh supplies one.
- Bump the version tag in the top bar at each milestone.

## Progress

- [ ] **1. Hub shell**: repo, GitHub + Vercel link, Supabase `hub` project, password login for the allowed email with 180-day sessions, access guard, robots, shared layout (top bar, side nav, mobile sheet, theme toggle, LinkedIn and GitHub icons), placeholder pages for all routes. Done when all routes load behind login on the Vercel URL.
  - Code done (shell, OTP login, guard + tests, placeholders, robots). Still manual: GitHub repo push, Supabase `hub` project + env vars, Vercel link.
- [x] **2. Notepad**: notepad sync, archive on clear and on conflict, word count, copy, download, PWA manifest and service worker. Done when phone typing shows on the laptop within seconds.
  - Code done and deployed on push. Needs your check: type on phone, see it on laptop; install to home screen.
- [x] **3. Card schema + mirror + skill**: `cards`, `capture_tasks` and RLS, the worker role, mirror generator with `pnpm sync`, `design-library` skill (trigger, ask-gate, DESIGN.md write-back, `used_in`, slop gate), and the global symlink.
- [x] **4a. Capture core + paste bar**: normalise, draft, extractors with fixtures, capture API, paste bar with preview, image paste or drop, duplicate and error states, draft cards with "media pending".
  - Code done and tested (capture core fixtures, saveCard, build passes). Not yet checked in the browser: log in and paste a link on /design.
- [ ] **4b. Local worker**: task claiming, media steps (yt-dlp, ffmpeg, Playwright, Reddit OAuth, transcripts), Storage upload, mirror refresh, Task Scheduler install script, `pnpm capture:pending`, `/add-ref`.
- [ ] **4c. Seed + enrichment**: seed script for the 50 cards (`needs_review` flags, @zzzzshawn as a person with related cards), and `/enrich-cards`. Done when all 50 seed cards are in.
- [ ] **5. Design gallery**: shelves with counts, side-nav shelf expansion, `/design/[shelf]`, source chips, grid with poster, hover clip and summary, touch behaviour, tag and mood filters in the URL, card page with JSON-LD, card menu (pin, copy, open, archive, delete), inline editing, Archived filter, directory badge, slop card Copy button.
- [x] **6. Thoughts**: `notes` table, board, N to add, colour, tag, pin, archive, delete.
- [ ] **7. Agent access**: read-only token, `pnpm token:rotate`, `/llms.txt`, `/r/[slug].md`, `/api/refs.json` with filters. Done when an agent given a card URL finds the right card (Flow D).
- [ ] **8. Exact rebuild**: frame extraction, contact sheet and palette, motion spec template, render-and-compare loop in the skill, proven on the pre-loader X animation.
- [ ] **9. Jobs + cold email**: `job_postings`, paste bar on /jobs with job preview, text and screenshot fallback, status list, cold email placeholder in the shell.
- [ ] **Polish**: review UI against my-motion and emil-design-eng, then `/impeccable polish`.
