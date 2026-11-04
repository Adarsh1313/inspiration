// pnpm install:commands: copy /add-ref and /enrich-cards into ~/.claude/commands so they work from any project.
// Re-run after editing design-library/skill/commands/*.md.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cli, repoRoot } from "./env";

cli(async () => {
  const from = join(repoRoot, "design-library", "skill", "commands");
  const to = join(homedir(), ".claude", "commands");
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).filter((n) => n.endsWith(".md"))) {
    copyFileSync(join(from, name), join(to, name));
    console.log(`Installed /${name.replace(/\.md$/, "")} → ${join(to, name)}`);
  }
});
