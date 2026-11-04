# Personal hub

Private, single-user hub on Vercel: design reference library (/design), jobs, cold email, thoughts, notepad. PRD: docs/prd.md. Seed cards: docs/seed-references.md.

## Stack
- Next.js (App Router, TypeScript) on Vercel
- Supabase: Postgres, Storage (private buckets), Auth (magic link, one allowed email)
- `geist` package: Geist Serif (headings only), Geist Sans (body/UI), Geist Mono (counts, code)
- Capture pipeline: one Node script using yt-dlp + ffmpeg, shared by `/add-ref` and an API route

## Commands
Filled in when milestone 1 scaffolds the app (dev, test, build, lint, sync).

## Folders
- docs/prd.md, docs/seed-references.md — source of truth for scope
- docs/specs/ — specs with a Progress checklist
- design/ — DESIGN.md + tokens.css (this project's own system)
- site/ — Next.js app (from milestone 1)
- design-library/ — local mirror: INDEX.md, refs/<slug>/, skill/ (from milestone 3)

## Project rules
- Every page shares one shell modelled on Hairline's /figures (MIT). Don't redesign the shell.
- No italic accent words in headings; run the slop-indicators card as the last check on UI work.
- Supabase is the source of truth; design-library/ is a generated mirror. Never hand-edit INDEX.md.
- Everything is private: robots disallow all; machine routes (llms.txt, .md, /api/refs.json) need the access token.
- Motion is light: hover, filter and theme transitions only. Always honour prefers-reduced-motion (no autoplay, show still).
- Clips load on hover only; posters lazy-load. LCP under 2.5 s.
