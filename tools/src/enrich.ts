// Backs /enrich-cards. No AI calls here: a Claude Code session reads the output of `list`,
// drafts the enrichments, and Adarsh approves them before `apply` writes them.
//   pnpm enrich list [--limit N] [--all]   cards missing summary, tags, mood or reuse notes, as JSON
//   pnpm enrich apply <file.json>          write approved enrichments (an array) straight to Supabase
import { readFileSync } from "node:fs";
import { validateEnrichment, type Enrichment } from "@hub/capture";
import type pg from "pg";
import { cli, connect } from "./env";

const TRANSCRIPT_CHARS = 6000;

async function list(client: pg.Client, limit: number, all: boolean): Promise<void> {
  const { rows } = await client.query(
    `select slug, title, kind, shelf, source_type, source_url, author, description, notes, summary, tags, mood, fits, stack, reuse,
            video_description, browse_notes, item_count, needs_review, status, media_status, left(transcript, $2) as transcript, poster_sm, preview, original
     from public.cards
     where status <> 'archived'
       and ($3 or summary is null or summary = '' or cardinality(tags) = 0 or mood = '{}'::jsonb or reuse is null or reuse = '')
     order by added_at limit $1`,
    [limit, TRANSCRIPT_CHARS, all],
  );
  console.log(JSON.stringify(rows, null, 2));
}

async function apply(client: pg.Client, file: string): Promise<void> {
  const items = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(items)) throw new Error("The file must hold a JSON array of enrichments.");

  const checked = items.map((item, i) => ({ i, result: validateEnrichment(item), raw: item as { slug?: string } }));
  const bad = checked.filter((c) => !c.result.ok);
  if (bad.length) {
    for (const b of bad) if (!b.result.ok) console.error(`#${b.i + 1} ${b.raw.slug ?? "(no slug)"}: ${b.result.errors.join("; ")}`);
    throw new Error("Nothing was written. Fix the entries above and run it again.");
  }

  let written = 0;
  for (const { result } of checked) {
    if (!result.ok) continue;
    if (await write(client, result.value)) written++;
    else console.warn(`No card with slug "${result.value.slug}".`);
  }
  console.log(`Enriched ${written} of ${items.length} cards. Run \`pnpm sync\` to refresh design-library/.`);
}

async function write(client: pg.Client, e: Enrichment): Promise<boolean> {
  const activate = e.activate ?? true;
  const { rowCount } = await client.query(
    `update public.cards set
       summary = $2, tags = $3, mood = $4::jsonb,
       fits = coalesce($5, fits), stack = coalesce($6, stack), reuse = coalesce($7, reuse),
       video_description = coalesce($8, video_description), kind = coalesce($9, kind), shelf = coalesce($10, shelf),
       browse_notes = coalesce($11, browse_notes), item_count = coalesce($12, item_count),
       needs_review = case when $13 then false else needs_review end,
       status = case when $13 and status = 'draft' then 'active' else status end,
       enriched_at = now()
     where slug = $1`,
    [e.slug, e.summary, e.tags, JSON.stringify(e.mood), e.fits ?? null, e.stack ?? null, e.reuse ?? null, e.video_description ?? null, e.kind ?? null, e.shelf ?? null, e.browse_notes ?? null, e.item_count ?? null, activate],
  );
  if (!rowCount) return false;
  if (e.related?.length) {
    await client.query(
      `update public.cards set related = (select array(select distinct unnest(related || coalesce((select array_agg(id) from public.cards where slug = any($2)), '{}')))) where slug = $1`,
      [e.slug, e.related],
    );
  }
  return true;
}

cli(async () => {
  const [command, arg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2);
  const client = await connect();
  try {
    if (command === "list") {
      const i = flags.indexOf("--limit");
      await list(client, i >= 0 ? Number(flags[i + 1]) || 20 : 20, flags.includes("--all"));
    } else if (command === "apply" && arg) await apply(client, arg);
    else throw new Error("Usage: pnpm enrich list [--limit N] [--all]  |  pnpm enrich apply <file.json>");
  } finally {
    await client.end();
  }
});
