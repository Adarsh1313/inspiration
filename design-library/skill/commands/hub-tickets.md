---
description: Turn Adarsh's per-project brain dump on the Inspiration hub into GitHub issues (also triggered by "go look at Inspiration hub, create issues")
argument-hint: [optional project slug]
---

Turn the notes Adarsh dumped on the hub's Active projects page into GitHub issues. You create the issues without an approval step. You never edit or delete hub text.

Hub repo: `C:\Users\Adarsh\inspiration`.

## 1. Find the notes

- Inside a git repo with no argument: `pnpm --dir C:\Users\Adarsh\inspiration projects new --remote "$(git remote get-url origin)"`
- With a slug (`$ARGUMENTS`): `pnpm --dir C:\Users\Adarsh\inspiration projects new <slug>`
- Anywhere else with no argument: `pnpm --dir C:\Users\Adarsh\inspiration projects new` (every project with new text).

It prints JSON: per project `slug`, `name`, `repo`, optional `skipped`, and `entries` (id, day, seq, text), oldest first. It only returns text that has not been ticketed.

- A project with `skipped` (no repo): say so in one line and leave it alone.
- Nothing new anywhere: say so and stop.
- If the git remote matches no hub project, tell Adarsh and offer `pnpm projects add --name <name> --repo <owner/name>`.

## 2. Group into issues

Read every bullet. Merge related bullets into one issue; do not make one issue per bullet. Each issue gets:

- A short title (imperative, under 70 characters).
- A body:
  - **Goal:** one line.
  - **From the notes:** Adarsh's bullets, quoted verbatim.
  - **Acceptance:** 2 to 4 checkable points you inferred.
  - Footer: `From Inspiration hub · Active projects · <YYYY-MM-DD>`

## 3. Create them

For each project, once:

```
gh label create from-hub --repo <owner/name> --color 0E8A16 --description "Created from the Inspiration hub"
```

(Ignore "already exists".) Then for each issue:

```
gh issue create --repo <owner/name> --label from-hub --title "<title>" --body-file <scratch file>
```

Write each body to a scratch file first so quoting is safe. Collect the issue number, title and URL that `gh` prints.

## 4. Mark the notes ticketed

Pass every entry id you read for that project and all of its created issues:

```
pnpm --dir C:\Users\Adarsh\inspiration projects ticket <entryId> <entryId> --issues '[{"number":12,"title":"...","url":"https://github.com/o/n/issues/12"}]'
```

If creating issues failed part-way, ticket only the entries whose bullets are fully covered by issues that exist, and tell Adarsh which bullets are not covered. Entries you leave unticketed are picked up on the next run. Do not mark entries ticketed if nothing was created.

## 5. Summarise

Print one table per project: `#`, title, size (S, M or L by your estimate of the work), link. Then ask Adarsh for priorities in one line, for example: "Reply with priorities, like `P1: 12, 14; P2: 13`."

## 6. Priorities (follow-up message)

When Adarsh replies with priorities, for each repo create the labels that are missing (`P1` red, `P2` orange, `P3` yellow) with `gh label create`, then `gh issue edit <n> --repo <owner/name> --add-label P1`. Confirm in one line.
