// Pure motion analysis for the exact-rebuild loop. Frames in, numbers out; ffmpeg lives in media.ts.
//
// "Exact" means the same timing and choreography, not the same pixels: the rebuild uses the target
// project's colours and type. So clips are compared by how much changes over time (motion energy),
// which does not care what colour anything is.

/** Mean absolute change between each pair of consecutive grayscale frames, 0 to 1. Entry i is the change that arrives at frame i + 1. */
export function motionEnergy(frames: Uint8Array[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    const n = Math.min(a.length, b.length);
    let sum = 0;
    for (let p = 0; p < n; p++) sum += Math.abs(b[p] - a[p]);
    out.push(n ? sum / n / 255 : 0);
  }
  return out;
}

/** Scales a series so its largest value is 1. A flat series stays all zeros. */
export function normalise(series: number[]): number[] {
  const max = Math.max(0, ...series);
  return max < 1e-6 ? series.map(() => 0) : series.map((v) => v / max);
}

/** Times (seconds) where normalised energy rises through `threshold`: the start of each beat of the animation. */
export function onsets(normalised: number[], fps: number, threshold = 0.3): number[] {
  const out: number[] = [];
  for (let i = 0; i < normalised.length; i++) {
    if (normalised[i] >= threshold && (i === 0 || normalised[i - 1] < threshold)) out.push(round((i + 1) / fps));
  }
  return out;
}

function round(n: number, places = 3): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (da < 1e-12 || db < 1e-12) return da < 1e-12 && db < 1e-12 ? 1 : 0; // two static clips match; one static, one moving does not
  return num / Math.sqrt(da * db);
}

/** Correlation of two series when `b` is shifted by `lag` frames (positive: b happens later). */
export function correlationAtLag(a: number[], b: number[], lag: number): number {
  const start = Math.max(0, -lag);
  const end = Math.min(a.length, b.length - lag);
  if (end - start < 2) return 0;
  return pearson(a.slice(start, end), b.slice(start + lag, end + lag));
}

export type Verdict = "match" | "close" | "off";

export type MotionComparison = {
  verdict: Verdict;
  /** Best correlation of the two energy curves, -1 to 1. */
  correlation: number;
  /** Seconds the rebuild is late (positive) or early (negative) against the source, at the best match. */
  lagSeconds: number;
  durationSeconds: { source: number; rebuild: number };
  onsets: { source: number[]; rebuild: number[]; matched: number };
  /** What to change, in plain words. Empty when it matches. */
  notes: string[];
};

export type CompareOptions = { fps: number; maxLagSeconds?: number; onsetToleranceSeconds?: number };

/** How closely a rebuild's timing and choreography follow the source. Inputs are raw (un-normalised) energy series from motionEnergy. */
export function compareMotion(source: number[], rebuild: number[], { fps, maxLagSeconds = 1, onsetToleranceSeconds = 0.25 }: CompareOptions): MotionComparison {
  const a = normalise(source);
  const b = normalise(rebuild);

  const maxLag = Math.round(maxLagSeconds * fps);
  let bestLag = 0;
  let best = correlationAtLag(a, b, 0);
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const c = correlationAtLag(a, b, lag);
    if (c > best + 1e-9 || (Math.abs(c - best) <= 1e-9 && Math.abs(lag) < Math.abs(bestLag))) {
      best = c;
      bestLag = lag;
    }
  }
  const lagSeconds = round(bestLag / fps);

  const oa = onsets(a, fps);
  const ob = onsets(b, fps);
  const free = new Set(ob.keys());
  let matched = 0;
  for (const t of oa) {
    const hit = [...free].find((j) => Math.abs(ob[j] - t) <= onsetToleranceSeconds);
    if (hit != null) {
      free.delete(hit);
      matched++;
    }
  }

  const durSource = round((source.length + 1) / fps);
  const durRebuild = round((rebuild.length + 1) / fps);
  const durDiff = Math.abs(durSource - durRebuild);
  const frame = 1 / fps;

  const notes: string[] = [];
  if (Math.abs(lagSeconds) > frame + 1e-9) notes.push(`The rebuild runs ${Math.abs(lagSeconds).toFixed(2)} s ${lagSeconds > 0 ? "late" : "early"}. Shift its start or delays.`);
  if (durDiff > onsetToleranceSeconds) notes.push(`The rebuild is ${durDiff.toFixed(2)} s ${durRebuild > durSource ? "longer" : "shorter"} than the source (${durSource} s). Check durations and the loop point.`);
  if (oa.length !== ob.length) notes.push(`The source has ${oa.length} beat${oa.length === 1 ? "" : "s"}, the rebuild has ${ob.length}. Check the choreography (stagger and sequence).`);
  else if (matched < oa.length) notes.push(`${oa.length - matched} of ${oa.length} beats start at a different time. Compare the onset times.`);
  if (best < 0.9) notes.push(`The energy curves only correlate at ${best.toFixed(2)}. The easing or the order of movements differs.`);

  const aligned = Math.abs(lagSeconds) <= frame + 1e-9;
  const verdict: Verdict =
    best >= 0.9 && aligned && durDiff <= onsetToleranceSeconds && oa.length === ob.length && matched === oa.length
      ? "match"
      : best >= 0.75 && Math.abs(lagSeconds) <= 0.5 && durDiff <= 0.5
        ? "close"
        : "off";

  return {
    verdict,
    correlation: round(best),
    lagSeconds,
    durationSeconds: { source: durSource, rebuild: durRebuild },
    onsets: { source: oa, rebuild: ob, matched },
    notes: verdict === "match" ? [] : notes,
  };
}
