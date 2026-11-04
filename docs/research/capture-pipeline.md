# Capture pipeline research (2026-11-04)

Inputs for milestone 4. Split decided: Vercel saves a draft (metadata + poster URL); the local Windows worker downloads media and runs ffmpeg.

## Port from Resurface (Adarsh1313/resurface)
| Piece | Where | Verdict |
| --- | --- | --- |
| X + YouTube oEmbed fetch, `cleanTitle`, `extractHandle`, 5 s timeout | `backend/src/routes/bookmarks.ts` ~44–125 | Port. Swap regex entity decoding for a real HTML decoder |
| YouTube id regex + thumbnail pattern | `extension/src/content.ts` | Adapt into the URL normaliser |
| Platform detection by hostname | `backend/src/routes/bookmarks.ts` ~75–80 | Adapt: exact host allowlist (current `includes()` matches `notx.com`) |
| Retry classification (5xx/408/429 retry, 401 auth, 4xx drop) + dedupe | `extension/src/shared.ts` | Adapt for worker retry policy |
| Single in-flight tick + row claims | `backend/src/workers/tick.ts` | Adapt for worker job claiming |
| X DOM scraping | `extension/src/content.ts` | Skip (text only, tied to X markup) |

Resurface has no URL canonicalisation or duplicate detection; build that new.

## URL normalisation
Lowercase host, drop `www.`/`m.`; strip `utm_*`, `fbclid`, `gclid`, `igshid`, `si`, `feature`, `ref`, `ref_src`, `s`, `t`, `mc_*`; drop fragment; sort params; strip trailing slash. X variants (twitter, fxtwitter, vxtwitter, fixupx) → `x.com/<user>/status/<id>`, dedupe key = status id. YouTube variants → `watch?v=<id>`, key = video id. Generic: prefer `rel=canonical` on the same registrable domain. Unique index on `canonical_key`, upsert.

## Per source
| Source | Vercel (draft) | Local worker |
| --- | --- | --- |
| X | FxTwitter JSON → syndication → oEmbed; save text, author, thumbnail, mp4 variant URL | Download mp4 (yt-dlp fallback, `--cookies-from-browser` only on failure); poster, clip, frames |
| GitHub | `GET /repos/{o}/{r}` + `/readme` raw; first gif/png/webp/mp4, resolve relative to raw.githubusercontent; fallback `opengraph.githubassets.com` | Download GIF/mp4 → poster + clip |
| Reddit | OG tags only (unauth `.json` returns 403 since May 2026) | OAuth script app; yt-dlp for `v.redd.it` |
| YouTube | oEmbed + `maxresdefault`/`hqdefault` thumbnail | Transcript via yt-dlp subs (cloud IPs blocked); optional clip |
| LinkedIn | OG tags; often authwall | Pasted text or screenshot fallback; never automate login |
| Website | `open-graph-scraper`, 5 s timeout, size cap, SSRF guard | Playwright screenshot (keep Chromium off Vercel: 10 s Hobby limit, flaky cold starts) |

## ffmpeg recipes (verify in M4)
- Poster: `ffmpeg -ss 1 -i in.mp4 -vf "thumbnail=60,scale=960:-2" -frames:v 1 -c:v libwebp -quality 80 poster.webp`
- Hover clip (H.264, Safari/iOS safe): `ffmpeg -t 6 -i in -an -vf "fps=24,scale='min(720,iw)':-2" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart preview.mp4`; re-encode if > 1 MB. Play with `muted playsinline loop`.
- Frames: `ffmpeg -i in -vf fps=4 frames/f_%04d.webp`; contact sheet `-vf "fps=4,scale=240:-1,tile=8x"`.

## Worker
Poll Supabase on start + on a schedule; claim with `update … where status='queued' returning` plus a `locked_at` lease; idempotent per `(card_id, step)`. Realtime misses events while the laptop sleeps.

## Storage
Private bucket; server-side batch `createSignedUrls` (1 h TTL); immutable hash filenames, `cacheControl: 31536000`. Image transforms need Supabase Pro, so the worker pre-renders posters at 2 sizes.

## Risks
X endpoints break without notice (layered fallbacks; `yt-dlp -U`). Reddit/YouTube block datacenter IPs. Worker credentials on the laptop. SSRF on the paste bar. LinkedIn automation can restrict the account. Scraping X is against its ToS; personal use only.

Sources: docs.fxembed.com, github.com/FxEmbed/FxEmbed, github.com/yt-dlp/yt-dlp/issues/9923, github.com/jdepoix/youtube-transcript-api/issues/593, supabase.com/docs/guides/storage/serving/image-transformations, vercel.com/templates/template/puppeteer-on-vercel.
