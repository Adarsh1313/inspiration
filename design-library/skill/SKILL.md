---
name: design-library
description: Use before substantial design or frontend work (new project, page, component, hero, motion, redesign) to pick reference cards from Adarsh's private design library. Do NOT use for bug fixes, copy changes, small tweaks or backend work.
---

# design-library

Adarsh's private library of design references lives as a local mirror at `<hub repo>/design-library/`:

- `INDEX.md`: one line per active card, `slug | kind | mood | summary`. Mood is `v` variance, `m` motion, `d` density, each 1-10.
- `refs/<slug>/card.md`: frontmatter, summary, what to reuse, notes. Poster, preview and original clip sit beside it when captured.

Find the hub repo from `~/.claude/skills/design-library` (it is a link into it). Run `pnpm sync` there if the index looks stale.

## When this fires

Fire on: a new project, a new page, a new component, a hero or landing section, adding motion, a redesign.

Do not fire on: bug fixes, copy edits, renames, small style tweaks, backend or data work, config.

## Flow

### 1. New project, page or redesign: shortlist, then ask

1. Read `INDEX.md` only (about 1,500 tokens). Do not open card files yet.
2. Pick 2-3 cards that fit the request. Prefer a mix of kinds (one layout, one motion) over three of the same.
3. Show the shortlist: for each, `slug`, a link to the source, and one line on why it fits.
4. Ask 3-4 kickoff questions (audience, tone, what must be memorable, motion appetite). Wait for answers.
5. Open only the chosen cards' `card.md` files. Build from them.

Do not start building before Adarsh answers.

### 2. Smaller decisions inside a project: no questions

If the project's `design/DESIGN.md` has a "References" section, pick from those cards without asking and name the card you used ("Using `orbkit` for the hover easing"). If it has none, treat the task as step 1 only when it is substantial.

### 3. Record the choice

After Adarsh picks:

1. Write the chosen cards into the project's `design/DESIGN.md` under `## References`: one bullet per card with slug, source link and what you took from it.
2. Append the project to each card's `used_in`: `pnpm used-in <slug> <project-name>` in the hub repo.

### 4. Directory cards

A card with `kind: directory` has `browse_notes`. Browse the directory's site with the built-in browser, following those notes. When Adarsh picks an item, save it with `pnpm pick <slug> <url> "<one-line note>"` in the hub repo. Saved picks appear on the card page.

### 5. Exact rebuild

Use when Adarsh asks to rebuild a card's animation "exactly". "Exact" means the same timing and choreography (beats, start times, length, easing, stagger, loop), in the **target project's own colours and type**. It does not mean the same pixels or brand. Needs a card with an original **clip** (`refs/<slug>/original.mp4`, `.webm`, `.mov` or `.gif`). A card with only `original.png` has no motion to measure: run `pnpm capture:pending` then `pnpm sync` in the hub repo first, or tell Adarsh the clip is missing.

Run these in the hub repo (`pnpm rebuild ...`). Do not skip a step or write code before step 2 is done.

1. **Measure.** `pnpm rebuild frames <slug>` writes, in `refs/<slug>/`: `frames/f0001.png...` (one every 0.25 s, so `f0001` is t=0, `f0005` is t=1.0 s), `frames/contact-sheet.png` (6 per row, left to right, 0.25 s apart, so each row is 1.5 s), `frames/manifest.json` (size, length, sampled palette, beat start times) and `motion-spec.md` (a template).
2. **Write the motion spec.** Open the contact sheet, then the individual frames around each beat. Fill every `TODO` in `motion-spec.md`: what happens in plain words, a timing table (beat, start, duration, what moves, from-to, easing), easing per mover (judge it from how far things travel between frames: big steps early and small late is ease-out), stagger (delay and order), loop behaviour, and how the source colours map to the target project's tokens. Rerunning `frames` never overwrites a spec you have filled in (`--force` starts over).
3. **Build it** in the target project, from the spec only. Colours and type come from the project's `design/tokens.css`, never from the source. Motion follows my-motion.
4. **Render.** `pnpm rebuild render <page.html|url> --out <render.mp4> --seconds <source length + 0.5>` records the page in headless Chromium at 1280x720 (`--size WxH` to change it). The recording starts at page load, so start the animation on load, or trim a known lead-in with `--trim <seconds>`.
5. **Compare.** `pnpm rebuild compare <slug> <render.mp4>` compares how much changes over time, not colour. It prints MATCH, CLOSE or OFF, the lag in seconds, the beat start times for both and plain notes ("the rebuild runs 0.40 s late", "the source has 3 beats, the rebuild has 2"), and writes `compare/compare-sheet.png` (source on top, rebuild below). Look at that sheet too: the numbers say when, the picture says what.
6. **Fix and repeat** steps 3 to 5 until it says MATCH (it exits 0 only on MATCH). Change one thing per round, using the notes: lag means shift delays; a different length means durations or the loop point; a missing beat means the sequence is wrong; low correlation with matching beats means the easing differs.
7. **Report** the final verdict and which numbers you matched, and note anything the measurement can't see (for example hover states or anything off-screen).

Limits: MATCH means timing and choreography agree at 8 samples a second. It cannot tell two easings apart when the beats line up, so check easing by eye on the sheet. Source clips with camera cuts or a moving background will read as constant motion; say so rather than forcing a match.

### 6. Last step on every build: slop check

Run the "slop indicators" card (`slop-indicators`) as a checklist against what you built. Name every indicator you kept on purpose and why. Do not skip this step.

### 7. Adding a reference

When Adarsh pastes a link in chat to save as a reference, or runs `/add-ref <url>`, run `pnpm --dir <hub repo> capture:add "<url>"`. It saves a draft card and runs the local worker. Don't summarise or enrich it; `/enrich-cards` does that in one batch. `pnpm install:commands` copies the two commands into `~/.claude/commands`.

## Rules

- Never read the whole library. The index first, then at most 3 cards.
- Archived and draft cards are not in the index; ignore them.
- Cards are references, not templates: reuse the idea (timing, structure, feel), in the target project's own colours, type and tokens.
- Respect the project's own design system if it has one.
