// Shared setup for the CLI scripts: load .env.local from the repo root and open the worker's database connection.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const envFile = join(repoRoot, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Connects as the limited hub_worker role (HUB_DATABASE_URL). */
export async function connect(): Promise<pg.Client> {
  const url = process.env.HUB_DATABASE_URL;
  if (!url) throw new Error("HUB_DATABASE_URL is not set (see .env.example).");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Runs a CLI main(), printing a clean message instead of a stack on failure. */
export function cli(main: () => Promise<void>): void {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
