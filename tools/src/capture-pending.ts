// pnpm capture:pending: run the local worker once. Exits straight away when nothing is queued.
// Runs from Windows Task Scheduler at logon and every 2 hours (see scripts/install-task.ps1).
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cli, connect, repoRoot } from "./env";
import { sync } from "./sync";
import { productionDeps, updateYtdlp } from "./worker/deps";
import { S3MediaStore } from "./worker/media-store";
import { runPending, type RunSummary } from "./worker/run";
import { PgTaskStore } from "./worker/tasks";

const workRoot = join(repoRoot, ".worker");
const DAY_MS = 24 * 60 * 60 * 1000;

const log = (m: string) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

/** yt-dlp breaks when X and YouTube change, so refresh it at most once a day, and only when there is work. */
async function maybeUpdateYtdlp(): Promise<void> {
  const marker = join(workRoot, "ytdlp-updated");
  if (existsSync(marker) && Date.now() - statSync(marker).mtimeMs < DAY_MS) return;
  await updateYtdlp(log);
  writeFileSync(marker, new Date().toISOString());
}

export async function capturePending(): Promise<RunSummary | null> {
  mkdirSync(workRoot, { recursive: true });
  const client = await connect();
  try {
    const { rows } = await client.query<{ n: string }>("select count(*) as n from public.capture_tasks where status = 'queued' or (status = 'running' and locked_at < now() - interval '30 minutes')");
    if (Number(rows[0].n) === 0) {
      log("Nothing to do.");
      return null;
    }

    const media = S3MediaStore.fromEnv();
    if (!media) throw new Error("Storage is not configured. Set HUB_S3_ENDPOINT, HUB_S3_REGION, HUB_S3_ACCESS_KEY_ID and HUB_S3_SECRET_ACCESS_KEY in .env.local.");
    await maybeUpdateYtdlp();

    const summary = await runPending(productionDeps({ tasks: new PgTaskStore(client), media, workDir: join(workRoot, "work"), log }));
    log(`Ran ${summary.claimed} steps on ${summary.cards} cards: ${summary.done} done, ${summary.failed} failed.`);

    const active = await sync(undefined, media);
    log(`Mirror refreshed (${active} active cards).`);
    return summary;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(async () => {
    await capturePending();
  });
}
