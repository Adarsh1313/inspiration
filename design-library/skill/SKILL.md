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

A card with `kind: directory` has `browse_notes`. Browse the directory's site with the built-in browser, following those notes. When Adarsh picks an item, record its URL and a one-line note. Saved picks appear on the card page.

### 5. Exact rebuild

Handled in a later milestone (frame extraction, motion spec, render-and-compare). Until then, describe the motion from the card's text and preview.

### 6. Last step on every build: slop check

Run the "slop indicators" card (`slop-indicators`) as a checklist against what you built. Name every indicator you kept on purpose and why. Do not skip this step.

## Rules

- Never read the whole library. The index first, then at most 3 cards.
- Archived and draft cards are not in the index; ignore them.
- Cards are references, not templates: reuse the idea (timing, structure, feel), in the target project's own colours, type and tokens.
- Respect the project's own design system if it has one.
