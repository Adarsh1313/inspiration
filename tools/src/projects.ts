// Backs /hub-tickets and new-project registration. Runs as the limited hub_worker role: it can read projects and
// entries, register projects, set a repo and mark entries ticketed. It cannot edit entry text or delete anything.
//   pnpm projects list                              active projects as JSON, with unticketed counts
//   pnpm projects new [slug | --remote <git-url>]   unticketed entries as JSON (no argument: every project with new text)
//   pnpm projects ticket <entryId...> --issues '[{"number":1,"title":"...","url":"..."}]'
//   pnpm projects add --name <n> [--repo o/n] [--slug s]   idempotent
//   pnpm projects set-repo <slug> <o/n>
import type pg from "pg";
import { parseRepo, pickColour, projectForRemote, slugify, unticketed, type Entry } from "../../site/src/lib/projects/day-blocks";
import { cli, connect } from "./env";
import { parseArgs, parseIssues, type Parsed } from "./projects-args";

type ProjectRow = { id: string; slug: string; name: string; repo: string | null; colour: string; position: number };
type EntryRow = Entry & { project_id: string };

async function activeProjects(client: pg.Client): Promise<ProjectRow[]> {
  const res = await client.query<ProjectRow>("select id, slug, name, repo, colour, position from public.projects where archived_at is null order by position, created_at");
  return res.rows;
}

async function entriesFor(client: pg.Client, projectIds: string[]): Promise<EntryRow[]> {
  const res = await client.query<EntryRow>(
    "select id, project_id, day::text as day, seq, text, rev, ticketed_at::text as ticketed_at, issues from public.project_entries where project_id = any($1::uuid[])",
    [projectIds],
  );
  return res.rows;
}

async function list(client: pg.Client): Promise<void> {
  const projects = await activeProjects(client);
  const entries = await entriesFor(client, projects.map((p) => p.id));
  console.log(JSON.stringify(projects.map((p) => ({
    slug: p.slug, name: p.name, repo: p.repo,
    unticketed: unticketed(entries.filter((e) => e.project_id === p.id)).length,
  })), null, 2));
}

async function fresh(client: pg.Client, args: Parsed): Promise<void> {
  const projects = await activeProjects(client);
  let chosen = projects;
  if (args.flags.remote) {
    const match = projectForRemote(projects, args.flags.remote);
    if (!match) throw new Error(`No hub project has the repo for ${args.flags.remote}. Add one with: pnpm projects add --name <name> --repo <owner/name>`);
    chosen = [match];
  } else if (args.positional[0]) {
    const match = projects.find((p) => p.slug === args.positional[0]);
    if (!match) throw new Error(`No active project with slug "${args.positional[0]}". Run: pnpm projects list`);
    chosen = [match];
  }
  const entries = await entriesFor(client, chosen.map((p) => p.id));
  const out = chosen
    .map((p) => ({
      slug: p.slug, name: p.name, repo: p.repo,
      skipped: p.repo ? undefined : "no repo set: add one from the card menu or `pnpm projects set-repo`",
      entries: unticketed(entries.filter((e) => e.project_id === p.id)).map((e) => ({ id: e.id, day: e.day, seq: e.seq, text: e.text })),
    }))
    .filter((p) => p.entries.length > 0 || chosen.length === 1);
  console.log(JSON.stringify(out, null, 2));
}

async function ticket(client: pg.Client, args: Parsed): Promise<void> {
  if (args.positional.length === 0 || !args.flags.issues) throw new Error("Usage: pnpm projects ticket <entryId...> --issues '<json>'");
  const issues = parseIssues(args.flags.issues);
  const res = await client.query("update public.project_entries set ticketed_at = now(), issues = $2::jsonb where id = any($1::uuid[]) and ticketed_at is null", [args.positional, JSON.stringify(issues)]);
  console.log(`Marked ${res.rowCount} entr${res.rowCount === 1 ? "y" : "ies"} as ticketed with ${issues.length} issue(s).`);
}

async function add(client: pg.Client, args: Parsed): Promise<void> {
  const name = args.flags.name?.trim();
  if (!name) throw new Error("Usage: pnpm projects add --name <name> [--repo owner/name] [--slug s]");
  const repo = args.flags.repo ? parseRepo(args.flags.repo) : null;
  if (args.flags.repo && !repo) throw new Error("--repo must look like owner/name.");
  const slug = slugify(args.flags.slug ?? name);
  if (!slug) throw new Error("Could not make a slug from that name.");

  const all = await client.query<ProjectRow>("select id, slug, name, repo, colour, position from public.projects");
  const existing = all.rows.find((p) => p.slug === slug || (repo && p.repo?.toLowerCase() === repo.toLowerCase()));
  if (existing) {
    console.log(JSON.stringify({ created: false, slug: existing.slug, name: existing.name, repo: existing.repo }));
    return;
  }
  const colour = pickColour(all.rows.map((p) => p.colour));
  const position = all.rows.reduce((m, p) => Math.max(m, p.position), -1) + 1;
  await client.query("insert into public.projects (slug, name, repo, colour, position) values ($1, $2, $3, $4, $5)", [slug, name, repo, colour, position]);
  console.log(JSON.stringify({ created: true, slug, name, repo }));
}

async function setRepo(client: pg.Client, args: Parsed): Promise<void> {
  const [slug, input] = args.positional;
  const repo = input ? parseRepo(input) : null;
  if (!slug || !repo) throw new Error("Usage: pnpm projects set-repo <slug> <owner/name>");
  const res = await client.query("update public.projects set repo = $2 where slug = $1", [slug, repo]);
  if (res.rowCount === 0) throw new Error(`No project with slug "${slug}".`);
  console.log(`${slug} → ${repo}`);
}

cli(async () => {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const client = await connect();
  try {
    if (command === "list") await list(client);
    else if (command === "new") await fresh(client, args);
    else if (command === "ticket") await ticket(client, args);
    else if (command === "add") await add(client, args);
    else if (command === "set-repo") await setRepo(client, args);
    else throw new Error("Usage: pnpm projects list | new | ticket | add | set-repo");
  } finally {
    await client.end();
  }
});
