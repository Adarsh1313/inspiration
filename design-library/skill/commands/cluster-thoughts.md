---
description: Group Adarsh's thoughts-wall notes into themes (proposal first, nothing written until he approves)
argument-hint: [optional hint, e.g. "max 5 groups"]
---

Cluster the sticky notes on Adarsh's thoughts wall from this Claude Code session. No API calls: you read, propose, and he approves once.

Hub repo: `C:\Users\Adarsh\inspiration`.

## 1. Read the wall

```
pnpm --dir C:\Users\Adarsh\inspiration cluster list
```

It prints JSON: `notes` (id, text, colour, pinned, group_id) and `groups` (id, name). If there are fewer than 4 notes, say so and stop.

## 2. Propose themes

- Read every note's text. Group by what the note is about, not by how it is worded. Aim for 3 to 6 groups, 3 or more notes each, unless Adarsh's hint (`$ARGUMENTS`) says otherwise. At most 6 groups fit comfortably on the wall.
- Name each group in 2 to 4 plain words (a noun phrase, e.g. "Setup takes too long"). No emoji, no all caps.
- Notes already in a group stay with it unless they clearly belong elsewhere. If a proposed group has the same name as an existing group, the notes join that group.
- Notes that fit nowhere are left out (they stay loose on the wall). Do not force them in.
- Never edit, reword or delete a note.

## 3. Show ONE table and wait

Columns: group name, note count, the notes' first words (a short quote each). Below it, list the loose notes left out. Then ask one question: approve, or what to change. Do not write anything yet.

## 4. Apply on approval

Write the approved groups to a scratch JSON file as `[{ "name": "...", "noteIds": ["<id>", ...] }]` using the note ids from step 1, then:

```
pnpm --dir C:\Users\Adarsh\inspiration cluster apply <file.json>
```

It validates the file (unknown ids, a note in two groups, duplicate names), places the new frames on the wall and assigns the notes. If it reports errors, nothing was written: fix the file and run it again.

## 5. Finish

Tell Adarsh to open `/thoughts` and press **Tidy** to watch the notes fly into their groups. Notes keep their current positions until he does.
