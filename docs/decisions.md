# Decisions (grilling log)

Input for `/to-spec`. Design is fixed in design/DESIGN.md. Research: docs/research/capture-pipeline.md.

## Round 1–2 (2026-11-04)
1. **Repo**: this repo is the hub. Top level `site/` (Next.js), `design-library/` (mirror + skill), `scripts/capture/`. Use pnpm. Skill symlinked to `~/.claude/skills/design-library`.
2. **Resurface**: port its oEmbed fetch, retry rules and job-claim pattern (see research). Build URL canonicalisation and dedupe from scratch.
3. **Capture split**: Vercel saves a draft (metadata + poster URL); the local Windows worker does media (yt-dlp, ffmpeg, Playwright, Reddit OAuth, transcripts).
4. **Supabase**: a new dedicated project `hub`, on the free tier.
5. **Login email**: adarshbharathwaj13@gmail.com only.
6. **Mark**: `inspiration` + `v0.1.0`, bumped per milestone.
7. **Notepad**: one running note; "clear" archives the old text.
8. **Thoughts and Notepad**: separate pages, no merge in v1.
9. **Mood dials**: variance, motion, density (1–10), stored as JSON so more can be added later.
10. **@zzzzshawn**: a card on Talks and people, `kind: person`, related to Orbkit and Dotmatrix.
11. **Worker trigger**: Windows Task Scheduler, not Realtime. Frequency is open (round 3).
12. **Draft cards**: show on /design immediately with a "media pending" mark.
13. **No AI API spend**: the draft uses the fetched title, description and preview. Summaries, tags and mood are filled later by a Claude Code session (round 3 confirms the mechanism).
14. **Region**: Supabase `ap-south-1`, Vercel functions `bom1`.
15. **Auth**: 90-day session; email OTP, kept simple to implement.
16. **Domain**: `*.vercel.app` for v1.
17. **`used_in`**: cards record the projects that used them, appended by the skill and shown on the card page.
18. **Phone capture**: through the PWA and the paste bar only; no share sheet or bot in v1.
19. **Exact rebuild**: same timing, easing, stagger and choreography, in the target project's colours and type.
20. **Tiers**: Supabase Free + Vercel Hobby. The worker pre-renders posters at 2 sizes.
21. **Worker credentials**: its own limited Postgres role, not the service-role key.
22. **Hover clip**: `preview.mp4` (H.264, ≤6 s, ≤1 MB), replacing the PRD's `preview.webm`.
23. **Reddit**: register an OAuth script app in milestone 4.

## Round 3 (2026-11-04)
24. **Worker schedule**: runs at logon, then every 2 h, and exits immediately when there are no jobs. Run by hand with `pnpm capture:pending` or `/add-ref`. Supabase Free has no request cap; the only free-tier risk is the 7-day inactivity pause, which daily use avoids.
25. **`/enrich-cards`**: a Claude Code command. It finds cards missing summary/tags/mood/reuse, reads each source, drafts them all in one table for approval, then writes straight to Supabase (no redeploy).
26. **Login**: 6-digit email OTP only (no magic link, so it works in the iOS PWA); 90-day session per device.
27. **Notepad sync**: last write wins, debounced 500 ms, with Realtime live updates. An offline edit that conflicts with a newer server version is kept as an archived copy.
28. **Mirror**: the worker refreshes `design-library/` at the end of every run, plus `pnpm sync` by hand.
29. **Cursor**: not installed. v1 supports Claude Code only; the Cursor rule is documented but not installed.
30. **Seed import**: a script reads docs/seed-references.md and runs the normal pipeline. Rows marked "confirm" stay as drafts; summaries come from `/enrich-cards`.
31. **Repo + deploy**: private `Adarsh1313/inspiration`, connected to Vercel, auto-deploys from `main`. Created in milestone 1.
32. **Top-bar links**: GitHub https://github.com/Adarsh1313, LinkedIn https://www.linkedin.com/in/adarsh-bharathwaj-942645203/

## Round 4 (2026-11-04)
33. **Agent token**: stored as a Vercel env var and rotated with `pnpm token:rotate`. No settings page in v1.
34. **Spec scope**: one spec covering all milestones 1–9. Jobs ships at PRD v1 scope: paste bar, preview (company, role, location, posting date), statuses to apply / applied / interviewing / closed, and a pasted-text or screenshot fallback for LinkedIn. Cold email is a placeholder page.
- Settled without asking: `kind` and `shelf` are separate fields (`kind` gains `person`). The `N` key adds a note on /thoughts.
