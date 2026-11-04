# Personal hub — design system

Decided up front (not re-opened): the layout and brand are modelled on [Hairline /figures](https://hairline.lucasmarkes.com/figures) (MIT). Geist Serif for headings, Geist Sans for body, Geist Mono for counts, and light motion. Values live in `tokens.css`; components use tokens only.

## Feel
A quiet, near-monochrome reading room. The references are the colour, and the chrome stays out of the way: hairline borders, soft card shadows, lots of air, small type.

## Shell (every page)
- **Top bar** (`--topbar-h`, sticky, translucent `--topbar-bg` + backdrop blur): site name in Geist Sans medium plus a Geist Mono version tag on the left; theme toggle, LinkedIn and GitHub icons (`--ink-muted`, ink on hover) on the right.
- **Side nav** (`--sidenav-w`): Design, Jobs › Cold email, Thoughts, Notepad. Each row has an icon, a label and a Mono count right-aligned in `--ink-faint`. The active row sits on a `--pill` fill with `--radius-md`. On /design the Design row expands to list shelves with counts.
- **Content column** (`--content-max`, gutter `--gutter`, top padding `--space-8`): heading, a one-paragraph lede in `--ink-muted` (max `--prose-max`), then shelves.
- **Shelf**: a heading (Sans medium, `--text-md`) plus a Mono "n of n" in `--ink-faint`, then a grid (`auto-fill, minmax(--card-min, 1fr)`, gap `--space-4`). Shelves are separated by `--space-8`.
- **Mobile (<768px)**: the side nav becomes a top sheet opened from the top bar, in the same order. Shelves become a scrolling chip row, as on Hairline.

## Type
| Role | Face | Size | Weight |
| --- | --- | --- | --- |
| Page heading | Geist Serif | `--text-lg` | regular |
| Card page title | Geist Serif | `--text-xl` | regular |
| Shelf heading, card title | Geist Sans | `--text-md` / `--text-base` | medium |
| Body, lede, UI | Geist Sans | `--text-base` / `--text-sm` | regular |
| Counts, version tag, slugs, code | Geist Mono | `--text-xs` | regular |

There are no italic accent words in headings, and nothing is ALL CAPS except source chips if needed.

## Colour
- Near-white `--bg` / near-black dark `--bg`, ink in three steps (`--ink`, `--ink-muted`, `--ink-faint`), and hairline `--line`.
- **One accent** (`--accent`, a restrained blue), used only for focus rings, the primary button and the active input. Nav and selection use the neutral `--pill`, not the accent.
- `--danger` is used only for the delete confirm and inline errors.
- The theme follows the system on the first visit, then `data-theme` on `<html>` remembers the choice.

## Components
- **Card**: `--surface`, `--radius-lg`, `--shadow-card`, and a 4:3 poster on `--surface-sunken`. Below the poster sit the title and a source icon. Its states:
  - Hover: `--shadow-lift`, the clip plays, and the summary fades in over the bottom of the poster.
  - Menu: a three-dot button, top right, visible on hover or focus.
- **Paste bar**: label, wide input, primary button. It has a hairline border, and the accent shows only on focus and on the button. The preview card renders below it with Save, Edit and Discard.
- **Chips** (source filters, tags): `--radius-sm`, hairline border, `--text-xs`. The active chip has a `--pill` fill.
- **Buttons**: primary is accent fill with `--accent-ink`. Secondary is hairline border, transparent. Both use `--radius-md`.
- **Inline errors** sit under the input in `--danger`, `--text-sm`. There are no toasts for errors.

## Motion (light)
Owned by my-motion + Emil's rules; this is the budget, not the implementation.
- Allowed: hover colour/shadow (`--dur-fast`), summary fade and filter reflow (`--dur-base`, `--ease-out`), mobile nav sheet (`--dur-slow`, `--ease-drawer`), and the theme swap (no transition on colours, to avoid flashing).
- Not allowed: page transitions, staggered entrances, scroll-triggered reveals, parallax, or decorative loops.
- Reduced motion: durations drop to 0, clips don't autoplay, and the still poster shows.

## Icons
One stroke icon set at 1.5 stroke and 16px (Lucide or similar), coloured `--ink-muted`. Brand icons (X, GitHub, LinkedIn, YouTube) are simple glyphs, not coloured logos.

## Open questions
- Accent hue: the restrained blue is a placeholder; swap it in `tokens.css` if you have a preference.
- Site name and version tag for the top-left mark (PRD hub question).
