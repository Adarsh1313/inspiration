// pnpm token:rotate: make a new read-only token for the machine routes (llms.txt, .md, /api/refs.json).
// Saves it to the repo's .env.local and the Vercel production env, then tells you to redeploy. Prints it once.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "./env";

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Replaces `KEY=...` in an env file's text, or appends it. */
export function setEnvLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, () => line);
  return text + (text === "" || text.endsWith("\n") ? "" : "\n") + line + "\n";
}

function vercel(args: string[], input?: string): { ok: boolean; out: string } {
  const r = spawnSync("vercel", args, { cwd: repoRoot, input, encoding: "utf8", shell: process.platform === "win32" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function main(): void {
  const token = newToken();

  const envFile = join(repoRoot, ".env.local");
  writeFileSync(envFile, setEnvLine(existsSync(envFile) ? readFileSync(envFile, "utf8") : "", "HUB_READ_TOKEN", token));
  console.log("Saved the new token to .env.local.");

  vercel(["env", "rm", "HUB_READ_TOKEN", "production", "--yes"]); // fine if it was not set yet
  const added = vercel(["env", "add", "HUB_READ_TOKEN", "production"], token + "\n");
  if (added.ok) console.log("Set HUB_READ_TOKEN on Vercel (production). Redeploy to apply it: push to main, or run `vercel --prod`.");
  else console.log(`Could not set it on Vercel (${added.out.split("\n").pop()}). Add HUB_READ_TOKEN in the Vercel dashboard, then redeploy.`);

  console.log(`\nNew read-only token (shown once):\n${token}\n\nThe old token stops working after the redeploy.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
