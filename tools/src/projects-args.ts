// Pure argument handling for the `projects` CLI.
import type { Issue } from "../../site/src/lib/projects/day-blocks";

export type Parsed = { positional: string[]; flags: Record<string, string> };

/** `--name x --repo o/n id1 id2` → positional [id1, id2], flags { name, repo }. Every flag takes a value. */
export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${a} needs a value.`);
      flags[a.slice(2)] = value;
      i++;
    } else positional.push(a);
  }
  return { positional, flags };
}

/** The `--issues` JSON: an array of { number, title, url }. */
export function parseIssues(json: string): Issue[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("--issues is not valid JSON.");
  }
  if (!Array.isArray(data)) throw new Error("--issues must be an array of { number, title, url }.");
  return data.map((raw, i) => {
    const r = raw as Partial<Issue>;
    if (!Number.isInteger(r.number) || typeof r.title !== "string" || typeof r.url !== "string") {
      throw new Error(`--issues[${i}] needs a number, title and url.`);
    }
    return { number: r.number as number, title: r.title, url: r.url };
  });
}
