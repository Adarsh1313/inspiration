// pnpm used-in <slug> <project>: append a project to a card's used_in (no duplicates).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [slug, project] = process.argv.slice(2);
if (!slug || !project) {
  console.error("Usage: pnpm used-in <slug> <project>");
  process.exit(1);
}
if (!process.env.HUB_DATABASE_URL) {
  console.error("HUB_DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.HUB_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rowCount } = await client.query(
    "update public.cards set used_in = array_append(used_in, $2) where slug = $1 and not ($2 = any(used_in))",
    [slug, project],
  );
  console.log(rowCount ? `Added ${project} to ${slug}.` : `No change (unknown card or already listed).`);
} finally {
  await client.end();
}
