// pnpm rebuild frames <slug|clip>             frames every 0.25 s, contact sheet, palette, motion spec template
// pnpm rebuild render <page.html|url> --out <render.mp4> [--seconds 4] [--size 1280x720] [--trim 0]
// pnpm rebuild compare <slug|clip> <render.mp4> timing and choreography check; exits 0 only on "match"
import { join } from "node:path";
import { cli, repoRoot } from "./env";
import { renderPage } from "./rebuild/media";
import { compareClips, measureClip, resolveSource } from "./rebuild/run";

const refsDir = join(repoRoot, "design-library", "refs");

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function positional(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (!["force"].includes(args[i].slice(2))) i++; // skip the flag's value
    } else out.push(args[i]);
  }
  return out;
}

const USAGE = `Usage:
  pnpm rebuild frames <slug|clip> [--force]
  pnpm rebuild render <page.html|url> --out <render.mp4> [--seconds 4] [--size 1280x720] [--trim 0]
  pnpm rebuild compare <slug|clip> <render.mp4>`;

cli(async () => {
  const [command, ...rest] = process.argv.slice(2);
  const args = positional(rest);

  if (command === "frames" && args[0]) {
    const r = await measureClip(resolveSource(args[0], refsDir), { force: rest.includes("--force") });
    console.log(`${r.frames} frames (every 0.25 s) in ${r.framesDir}`);
    console.log(`Contact sheet: ${r.contactSheet} (6 per row, left to right, 0.25 s apart)`);
    console.log(`Palette: ${r.palette.map((c) => `${c.hex} ${(c.share * 100).toFixed(0)}%`).join(", ")}`);
    console.log(`Beats start at: ${r.onsets.length ? r.onsets.map((t) => `${t.toFixed(2)} s`).join(", ") : "none found (a static clip?)"}`);
    console.log(r.specWritten ? `Motion spec to fill in: ${r.spec}` : `Kept your existing motion spec: ${r.spec} (use --force to start over)`);
    return;
  }

  if (command === "render" && args[0]) {
    const out = flag(rest, "out");
    if (!out) throw new Error("Pass --out <render.mp4>.\n" + USAGE);
    const [w, h] = (flag(rest, "size") ?? "1280x720").split("x").map(Number);
    if (!w || !h) throw new Error("--size looks like 1280x720.");
    const seconds = Number(flag(rest, "seconds") ?? 4);
    await renderPage(args[0], { seconds, width: w, height: h, output: out, trimSeconds: Number(flag(rest, "trim") ?? 0) });
    console.log(`Recorded ${seconds} s of ${args[0]} to ${out}`);
    return;
  }

  if (command === "compare" && args[0] && args[1]) {
    const r = await compareClips(resolveSource(args[0], refsDir), args[1]);
    console.log(`${r.verdict.toUpperCase()}: correlation ${r.correlation}, rebuild ${r.lagSeconds >= 0 ? "+" : ""}${r.lagSeconds} s from the source`);
    console.log(`Length: source ${r.durationSeconds.source} s, rebuild ${r.durationSeconds.rebuild} s`);
    console.log(`Beats: source ${JSON.stringify(r.onsets.source)} s, rebuild ${JSON.stringify(r.onsets.rebuild)} s (${r.onsets.matched} matched)`);
    for (const note of r.notes) console.log(`- ${note}`);
    console.log(`Side by side (source on top): ${r.sheet}`);
    if (r.verdict !== "match") process.exitCode = 1;
    return;
  }

  console.error(USAGE);
  process.exitCode = 1;
});
