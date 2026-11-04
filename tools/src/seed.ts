// pnpm seed [--offline] [--dry-run]: import the 50 cards in docs/seed-references.md through the normal pipeline.
// Safe to re-run: cards already saved are skipped. "Confirm" rows and the row with no link are flagged for review.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { draft, offlineDraft, parseSeed, saveCard, type Draft, type SeedCard } from "@hub/capture";
import type pg from "pg";
import { cli, connect, repoRoot } from "./env";
import { S3MediaStore } from "./worker/media-store";
import { PgCardStore } from "./worker/pg-card-store";

/** Person cards sit beside their work: @zzzzshawn ⇄ Orbkit and Dotmatrix. */
export const RELATIONS: Record<string, string[]> = {
  "x-user:zzzzshawn": ["site:orbkit.zzzzshawn.cloud", "site:dotmatrix.zzzzshawn.cloud"],
};

async function previewFor(seed: SeedCard, offline: boolean): Promise<Draft> {
  if (offline || !seed.url) return offlineDraft(seed);
  try {
    const d = await draft(seed.url, { fetch, timeoutMs: 8000 });
    return d.title ? d : { ...d, title: seed.title };
  } catch {
    return offlineDraft(seed);
  }
}

async function linkRelated(client: pg.Client): Promise<number> {
  let linked = 0;
  const idOf = async (key: string) => (await client.query<{ id: string }>("select id from public.cards where canonical_key = $1", [key])).rows[0]?.id;
  for (const [personKey, workKeys] of Object.entries(RELATIONS)) {
    const person = await idOf(personKey);
    const works = (await Promise.all(workKeys.map(idOf))).filter((x): x is string => !!x);
    if (!person || works.length === 0) continue;
    await client.query("update public.cards set related = (select array(select distinct unnest(related || $2::uuid[]))) where id = $1", [person, works]);
    for (const w of works) await client.query("update public.cards set related = (select array(select distinct unnest(related || $2::uuid[]))) where id = $1", [w, [person]]);
    linked += works.length;
  }
  return linked;
}

cli(async () => {
  const args = process.argv.slice(2);
  const offline = args.includes("--offline");
  const dry = args.includes("--dry-run");
  const seeds = parseSeed(readFileSync(join(repoRoot, "docs", "seed-references.md"), "utf8"));
  console.log(`${seeds.length} seed cards, ${seeds.filter((s) => s.needsReview).length} flagged for review.`);

  if (dry) {
    for (const s of seeds) console.log(`${s.needsReview ? "review " : "       "}${s.shelf.padEnd(26)} ${s.kind ?? "-".padEnd(9)} ${s.title}`);
    return;
  }

  const client = await connect();
  try {
    const store = new PgCardStore(client, S3MediaStore.fromEnv() ?? undefined);
    let added = 0;
    let existing = 0;
    for (const seed of seeds) {
      const preview = await previewFor(seed, offline);
      const result = await saveCard(store, {
        draft: preview,
        overrides: { title: seed.title, shelf: seed.shelf, kind: seed.kind ?? undefined },
        needsReview: seed.needsReview,
        notes: seed.note || undefined,
        mediaError: seed.url ? undefined : "No link yet. Add the URL, then run /add-ref.",
      });
      if (result.ok) {
        added++;
        console.log(`+ ${result.slug}${seed.needsReview ? "  (needs review)" : ""}`);
      } else {
        existing++;
      }
    }
    const related = await linkRelated(client);
    const { rows } = await client.query<{ n: string }>("select count(*) as n from public.cards where status <> 'archived'");
    console.log(`Added ${added}, already there ${existing}, linked ${related} related cards. Cards now: ${rows[0].n}.`);
  } finally {
    await client.end();
  }
});
