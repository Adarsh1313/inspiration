---
description: Save a design reference link to the hub and fetch its media now
argument-hint: <url>
---

Add this reference to Adarsh's design hub: $ARGUMENTS

Run, from any project (the hub repo lives at `C:\Users\Adarsh\inspiration`):

```
pnpm --dir C:\Users\Adarsh\inspiration capture:add "$ARGUMENTS"
```

It runs the same pipeline as the paste bar on /design: it normalises the link, reads the preview, saves a draft card, then runs the local worker straight away (media download, posters, hover clip, mirror refresh).

Then report in one or two lines:
- the card slug and shelf it landed on, or "already saved" with the existing slug
- anything that failed (the command prints the reason; a failed step means the card needs a manual screenshot on /design)

Do not enrich the card here. Tell Adarsh to run `/enrich-cards` when he wants summaries, tags and mood filled in.

If the command says `HUB_DATABASE_URL is not set` or `Storage is not configured`, the repo's `.env.local` is missing those values (see `site/.env.example`). Say so and stop.
