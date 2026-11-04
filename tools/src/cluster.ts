// Backs /cluster-thoughts. No AI calls here: a Claude Code session reads the output of `list`,
// proposes themes, and Adarsh approves them before `apply` writes the groups.
//   pnpm cluster list                  all notes and existing groups, as JSON
//   pnpm cluster apply <file.json>     [{ "name": "...", "noteIds": ["..."] }] -> create groups and assign notes
import { readFileSync } from "node:fs";
import type pg from "pg";
import { layoutFrames, validateClusters, type Rect } from "./cluster-plan";
import { cli, connect } from "./env";

async function list(client: pg.Client): Promise<void> {
  const notes = await client.query("select id, text, colour, pinned, group_id, created_at from public.notes order by created_at");
  const groups = await client.query("select id, name from public.note_groups order by created_at");
  console.log(JSON.stringify({ notes: notes.rows, groups: groups.rows }, null, 2));
}

async function apply(client: pg.Client, file: string): Promise<void> {
  const input = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const notes = await client.query<{ id: string }>("select id from public.notes");
  const checked = validateClusters(input, new Set(notes.rows.map((n) => n.id)));
  if (!checked.ok) {
    for (const e of checked.errors) console.error(e);
    throw new Error("Nothing was written. Fix the entries above and run it again.");
  }

  const existing = await client.query<{ id: string; name: string; x: number; y: number; w: number; h: number }>("select id, name, x, y, w, h from public.note_groups");
  const byName = new Map(existing.rows.map((g) => [g.name.trim().toLowerCase(), g]));
  const fresh = checked.value.filter((c) => !byName.has(c.name.toLowerCase()));

  const rects: Rect[] | null = layoutFrames(fresh.map((c) => c.noteIds.length), existing.rows);
  if (!rects) throw new Error("There is no room on the wall for that many new groups. Merge some themes and try again.");

  await client.query("begin");
  try {
    let created = 0;
    for (const c of checked.value) {
      let id = byName.get(c.name.toLowerCase())?.id;
      if (!id) {
        const r = rects[fresh.indexOf(c)];
        const res = await client.query<{ id: string }>("insert into public.note_groups (name, x, y, w, h) values ($1, $2, $3, $4, $5) returning id", [c.name, r.x, r.y, r.w, r.h]);
        id = res.rows[0].id;
        created++;
      }
      await client.query("update public.notes set group_id = $1 where id = any($2::uuid[])", [id, c.noteIds]);
    }
    await client.query("commit");
    const moved = checked.value.reduce((n, c) => n + c.noteIds.length, 0);
    console.log(`Created ${created} group(s) and assigned ${moved} note(s). Open /thoughts and press Tidy.`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}

cli(async () => {
  const [command, arg] = process.argv.slice(2);
  const client = await connect();
  try {
    if (command === "list") await list(client);
    else if (command === "apply" && arg) await apply(client, arg);
    else throw new Error("Usage: pnpm cluster list | pnpm cluster apply <file.json>");
  } finally {
    await client.end();
  }
});
