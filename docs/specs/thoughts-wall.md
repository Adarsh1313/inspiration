# Spec: Thoughts wall

Status: ready-for-agent
Replaces the Thoughts UI from milestone 6 of docs/specs/personal-hub.md (the `notes` table and board are reworked).
Sources: docs/reference/thoughts-wall/whiteboard-sticky-clusters.mp4 (motion reference, 10 s) and prompt.txt (its detailed description). Take the ideology and the motion feel, not a one-to-one copy: no Pinfold branding, no toolbar clone, no fixed 1920x1080 stage.

## Problem Statement

/thoughts is a plain grid of coloured cards. Adarsh wants it to feel like a physical wall of sticky notes that is always there: notes sit where he puts them, new ones drop in with weight, and related notes can be gathered into labelled groups with a satisfying sort animation, like the reference video.

## Solution

/thoughts keeps the shared page header (serif heading and one-line intro), then shows a large framed wall below it.

- **The wall** is one large area filling the page width under the header, with a faint dotted grid. It scrolls inside the page if notes go past its edge. Notes keep their saved x, y and tilt.
- **New note:** left-click on empty wall space drops a note at that spot (it lands with a short drop-in and focuses the text). Also `N` (placed at a free spot near the centre) and a `+ New note` button at the top right of the header. On touch, only the button and `N`-equivalent button (no tap-to-add, so scrolling never adds notes).
- **Notes:** handwriting text (Kalam), a darker tape strip on top, slight tilt, soft curl shadow. A random colour per note that avoids repeating the last two colours and favours the least used on the wall. Actions on hover or focus: edit text in place, swatch row to change colour, pin, delete (one confirm). Drag to move; a dragged note lifts (scale and shadow grow) and settles on drop. Pinned notes stay above unpinned ones.
- **Persistence:** the wall is always as left. Notes exist until deleted. No archive and no tags.
- **Groups:** a group is a labelled, dashed frame on the wall (name, position, size). Notes dropped inside a frame belong to it, and the frame follows when dragged. A `Tidy` button flies every grouped note into tidy rows inside its frame (the video's sort), with the frames tracing in. Ungrouped notes stay put.
- **Auto-cluster:** `/cluster-thoughts` in Claude Code reads all notes, proposes themes with the notes in each, shows them in one table for approval, then writes groups to Supabase (no API spend, like `/enrich-cards`). The site then offers the same Tidy animation, and the new frames appear.

## User Stories

1. As Adarsh, I want the thoughts wall to always be there with my notes on it, so that it feels like a physical wall.
2. As Adarsh, I want to left-click empty wall space to drop a new note at that spot, so that placing an idea is one click.
3. As Adarsh, I want `N` and a top-right `+ New note` button to add a note too, so that I can add one without a mouse position (and on my phone).
4. As Adarsh, I want a new note to drop in with a short settle (scale 1.12 to 1.0, shadow tightening), so that it feels like it has weight.
5. As Adarsh, I want each new note to get a random colour that does not repeat the last two and favours colours least used on the wall, so that the wall is varied.
6. As Adarsh, I want to drag notes anywhere on the wall, with a lift while dragging and a settle on drop, so that arranging feels physical.
7. As Adarsh, I want to edit a note's text in place and see it in handwriting, so that it feels like writing.
8. As Adarsh, I want to change a note's colour from a small swatch row, so that I can override the random pick.
9. As Adarsh, I want to pin a note so that it stays on top of overlapping notes.
10. As Adarsh, I want to delete a note with one confirm, so that removal is deliberate. Notes are otherwise permanent.
11. As Adarsh, I want to create a labelled frame on the wall, rename, move, resize and delete it, so that I can group notes by hand.
12. As Adarsh, I want a note dropped inside a frame to belong to it and move with it, so that groups stay together.
13. As Adarsh, I want a `Tidy` button that flies grouped notes into rows inside their frames, so that the sort looks like the reference video.
14. As Adarsh, I want `/cluster-thoughts` to propose groups from my notes and let me approve them in one pass, so that I can cluster on my subscription with no API cost.
15. As Adarsh, I want reduced-motion settings to skip all flights and drops and just place things, so that the page respects my system setting.
16. As Adarsh, I want the wall and notes to load fast and stay readable at phone width (wall scrolls sideways and down, notes stay legible), so that the phone is usable.

## Implementation Decisions

- **Schema** (new migration on `notes`, plus a table):
  - `notes`: add `x`, `y` (numbers, wall pixels), `rotation` (degrees, -4 to 4, set at creation), `group_id` (nullable FK), `z` (int, for stacking; pinned sorts above). Drop `tag` and `status` use (keep columns, unused; archive is removed from the UI). Existing notes get a seeded x, y and rotation by the migration.
  - `note_groups`: `id`, `name`, `x`, `y`, `w`, `h`, `created_at`. RLS owner-only, same policy as `notes`. The worker role needs no access.
- **Modules (deep, pure where possible):**
  - **Colour picker**: `nextColour(recent, counts) -> colour`; never equals either of the last two unless only that many exist; weights toward least-used. Seeded RNG injectable for tests.
  - **Placement**: `freeSpot(notes, wall)`, `clampToWall`, `snapIntoGroup(note, groups)`.
  - **Tidy planner**: `planTidy(notes, groups) -> [{id, from, to, rotationTo, delay}]`: rows of four inside each frame (140 px pitch, as in the reference), list order, 32 ms stagger, seeded settled rotation within +/-1.5 degrees, quadratic flight with a seeded control point +/-120 px off the straight line.
  - **Motion curves**: `easeOutBack`, `easeInOutCubic`, quadratic Bezier point. Driven from `requestAnimationFrame` for the Tidy flight only; drops and lifts use transform + shadow transitions with the DESIGN.md tokens.
  - **Wall component** (client): pointer events for drag (no library), click-on-empty to add, hover action row, groups as frames.
- **Fonts and tokens:** add Kalam (400, 700) via `next/font/google` for note text only. Wall dot grid, tape strip, curl shadow and any new durations/easings are added to `design/tokens.css`; no raw hex or px in components. Keep the existing five note colours; add per-colour tape tone tokens. DESIGN.md gets a short "Thoughts wall" section.
- **Motion budget:** this page's drop-in, lift, Tidy flight, frame trace and label type-on are allowed here only; DESIGN.md's "no staggered entrances" is relaxed for the Tidy flight on user action. Everything else stays on the light budget. Reduced motion drops them all.
- **Claude Code command:** `/cluster-thoughts` in `design-library/skill/commands/`, same pattern as `/enrich-cards`: reads notes through the worker or owner path, proposes groups, applies on approval. Its database access needs a grant for the worker role on `notes` and `note_groups` (select, insert, update); decide the credential in the implementing session.

## Testing Decisions

- Vitest on the pure modules only, through their public functions: colour picker never repeats the last two and favours the least used, free-spot never overlaps and stays on the wall, snap-into-group picks the right frame, the tidy plan puts every grouped note in rows of four inside its frame, in list order, with a 32 ms stagger and a deterministic result for a fixed seed.
- Verify the interaction feel by hand in the built-in browser at desktop and phone width, light and dark, with reduced motion on and off. Check frames at a few moments of the Tidy flight against the reference video.
- No end-to-end test in this slice.

## Out of Scope

- Pan and zoom (infinite canvas), multiplayer, comments, vote dots, the summary card and connectors from the video.
- Archive and tags (removed).
- Server-side AI.

## Further Notes

- The reference video is 1280x720, 30 fps; prompt.txt describes it at 1920x1080 for a canvas build. Use its timings (0.85 s flight, 32 ms stagger, easings) as the starting point, then tune by eye.
- Bump the top-bar version tag when this ships.

## Progress

- [x] **A. Wall and notes**: migration (positions, groups table), wall layout under the page header, click-on-empty and `N` and top-right button to add, drop-in, drag with lift, in-place edit, colour swatches with the random picker, pin, delete, reduced motion, Kalam and tokens. Done when the wall persists and feels right on desktop and phone.
- [x] **B. Groups and Tidy**: frames (create, rename, move, resize, delete), note-to-group membership, the Tidy flight with frames tracing and labels typing.
- [x] **C. `/cluster-thoughts`**: the Claude Code command, group writes on approval, the new frames playing the Tidy animation.
