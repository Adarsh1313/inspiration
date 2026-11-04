// pnpm pick <slug> <url> [note]: save a directory pick on a card.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [slug, url, note = ""] = process.argv.slice(2);
if (!slug || !url) {
  console.error("Usage: pnpm pick <slug> <url> [note]");
  process.exit(1);
}
if (!process.env.HUB_DATABASE_URL) {
  console.error("HUB_DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.HUB_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const pick = JSON.stringify({ url, note, saved_at: new Date().toISOString() });
  const { rowCount } = await client.query(
    "update public.cards set picks = picks || $2::jsonb, last_checked = now() where slug = $1 and kind = 'directory'",
    [slug, `[${pick}]`],
  );
  console.log(rowCount ? `Saved pick on ${slug}.` : "No change (unknown card, or it is not a directory).");
} finally {
  await client.end();
}
