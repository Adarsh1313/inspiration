# Cursor rule (documented, not installed)

To use the library in Cursor, create `.cursor/rules/design-library.mdc` in a project with this content:

```
---
description: Pick reference cards before substantial design or frontend work
alwaysApply: false
---

Before a new project, page, component, hero, motion or redesign (not bug fixes, copy, small tweaks or backend work):

1. Read <hub repo>/design-library/INDEX.md only.
2. Shortlist 2-3 cards with one line on why each fits, then ask 3-4 kickoff questions and wait.
3. Open only the chosen cards' refs/<slug>/card.md.
4. Write the chosen cards into design/DESIGN.md under "References".
5. Finish by checking the build against the slop-indicators card and name any indicator kept on purpose.
```

Replace `<hub repo>` with the absolute path to the hub checkout.
