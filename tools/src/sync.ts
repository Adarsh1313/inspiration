// pnpm sync: refresh design-library/ (INDEX.md + refs/<slug>/card.md) from Supabase.
// Needs HUB_DATABASE_URL (the limited hub_worker role) in .env.local at the repo root.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildMirror, type MirrorCard } from "./mirror";
import { copyMedia, type MediaCard } from "./mirror-media";
import { S3MediaStore, type MediaStore } from "./worker/media-store";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export async function sync(outDir = join(root, "design-library"), media: MediaStore | null = S3MediaStore.fromEnv()): Promise<number> {
  const url = process.env.HUB_DATABASE_URL;
  if (!url) throw new Error("HUB_DATABASE_URL is not set (see .env.example).");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let rows: (MirrorCard & MediaCard)[];
  try {
    ({ rows } = await client.query<MirrorCard & MediaCard>("select * from public.cards where status = 'active'"));
  } finally {
    await client.end();
  }

  const { files } = buildMirror(rows);
  mkdirSync(outDir, { recursive: true });

  // Drop card.md for cards that are no longer active; media files are left alone.
  const refs = join(outDir, "refs");
  if (existsSync(refs)) {
    for (const slug of readdirSync(refs)) {
      if (!files[`refs/${slug}/card.md`]) rmSync(join(refs, slug, "card.md"), { force: true });
    }
  }
  for (const [path, content] of Object.entries(files)) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  if (media) await copyMedia(rows, outDir, media);
  else if (rows.some((r) => r.poster_sm)) console.warn("HUB_S3_* is not set: posters and clips were not copied.");
  return rows.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  sync()
    .then((n) => console.log(`Synced ${n} active cards to design-library/`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
