// pnpm capture:add <url> [--no-run]: the same pipeline as the paste bar, from the terminal. Backs /add-ref.
import { draft, saveCard } from "@hub/capture";
import { cli, connect } from "./env";
import { capturePending } from "./capture-pending";
import { S3MediaStore } from "./worker/media-store";
import { PgCardStore } from "./worker/pg-card-store";

cli(async () => {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) throw new Error("Usage: pnpm capture:add <url> [--no-run]");

  const preview = await draft(url, { fetch, timeoutMs: 10_000 });
  if (preview.errors.length) console.warn(`Preview problem: ${preview.errors[0].message}`);

  const client = await connect();
  let result;
  try {
    result = await saveCard(new PgCardStore(client, S3MediaStore.fromEnv() ?? undefined), { draft: preview });
  } finally {
    await client.end();
  }

  if (!result.ok) {
    console.log(`Already saved: ${result.duplicate.title || result.duplicate.slug} (/r/${result.duplicate.slug})`);
    return;
  }
  console.log(`Saved draft "${preview.title || preview.canonicalUrl}" as ${result.slug} on the ${preview.suggestedShelf} shelf.`);
  if (!args.includes("--no-run")) await capturePending();
});
