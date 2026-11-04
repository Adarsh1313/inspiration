// The motion spec an agent fills in from the frames before it writes any code.
import type { PaletteColour } from "./palette";

export type SpecInput = {
  slug: string;
  source: string;
  durationSeconds: number;
  width: number;
  height: number;
  intervalSeconds: number;
  frameCount: number;
  palette: PaletteColour[];
  /** Beat start times from the source's motion energy: a head start for the timing table. */
  onsets: number[];
};

/** Markdown template with the measured facts filled in and the judgement calls left as TODO. */
export function motionSpecTemplate(i: SpecInput): string {
  const rows = i.onsets.length
    ? i.onsets.map((t, n) => `| ${n + 1} | ${t.toFixed(2)} | TODO | TODO | TODO | TODO |`).join("\n")
    : "| 1 | TODO | TODO | TODO | TODO | TODO |";
  return `# Motion spec: ${i.slug}

Measured from \`${i.source}\` (${i.width}x${i.height}, ${i.durationSeconds.toFixed(2)} s, ${i.frameCount} frames every ${i.intervalSeconds} s). Fill every TODO by looking at the frames (open \`contact-sheet.png\`, then the frames around each beat). Do not write code until nothing says TODO.

## What happens
TODO: one sentence per beat, in order, in plain words.

## Timing
Beats found by the energy curve are a starting point. Correct them against the frames.

| Beat | Starts (s) | Duration (s) | What moves | From to | Easing |
| --- | --- | --- | --- | --- | --- |
${rows}

## Easing
TODO: for each moving thing, name the curve (ease-out, ease-in-out, spring, linear) and say how you decided. Look at how far it travels each 0.25 s frame: big steps early and small late is ease-out.

## Stagger
TODO: the delay between items that move in turn (seconds), and the order (left to right, centre out, random).

## Loop
TODO: does it loop, play once, or hold on the last frame? What is the last frame, and what resets?

## Sampled palette (the source's colours, for reference only)
${i.palette.map((c) => `- \`${c.hex}\` ${(c.share * 100).toFixed(1)}%`).join("\n") || "- none"}

The rebuild uses the target project's own colours and type from \`design/tokens.css\`. Map each source colour to the nearest token role (background, ink, accent) here:

TODO

## Done when
\`pnpm rebuild compare ${i.slug} <your render.mp4>\` says **match**: same beats, same start times, same length, the energy curves line up.
`;
}
