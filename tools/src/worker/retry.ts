// Retry policy, ported from Resurface: 5xx, 408 and 429 retry; 401 is an auth error; other 4xx fail.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message = `HTTP ${status}`,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** A tool (ffmpeg, yt-dlp...) exited badly or is not installed. Not retried: the same input fails the same way. */
export class ToolError extends Error {
  constructor(
    message: string,
    readonly missing = false,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

/** Nothing usable to make a preview from. The card needs a manual image. */
export class NoMediaError extends Error {
  constructor(message = "No preview image or clip could be found.") {
    super(message);
    this.name = "NoMediaError";
  }
}

export type Classification = "retry" | "auth" | "fail";

const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "EPIPE", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]);

export function classify(err: unknown): Classification {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") {
    if (status >= 500 || status === 408 || status === 429) return "retry";
    if (status === 401) return "auth";
    return "fail";
  }
  if (err instanceof ToolError || err instanceof NoMediaError) return "fail";
  const code = (err as { code?: unknown; cause?: { code?: unknown } })?.code ?? (err as { cause?: { code?: unknown } })?.cause?.code;
  if (typeof code === "string" && NETWORK_CODES.has(code)) return "retry";
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError" || /fetch failed|network|timed? ?out/i.test(err.message))) return "retry";
  return "fail";
}

export type Attempt<T> = { ok: true; value: T; attempts: number } | { ok: false; error: unknown; attempts: number; classification: Classification };

export type RetryOptions = {
  max?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs `fn` up to `max` times, retrying only errors classified "retry". */
export async function withRetry<T>(fn: () => Promise<T>, { max = 3, baseDelayMs = 2000, sleep = defaultSleep }: RetryOptions = {}): Promise<Attempt<T>> {
  for (let attempts = 1; ; attempts++) {
    try {
      return { ok: true, value: await fn(), attempts };
    } catch (error) {
      const classification = classify(error);
      if (classification !== "retry" || attempts >= max) return { ok: false, error, attempts, classification };
      await sleep(baseDelayMs * 2 ** (attempts - 1));
    }
  }
}

export function describeError(err: unknown, classification: Classification): string {
  const msg = err instanceof Error ? err.message : String(err);
  const text = classification === "auth" ? `Needs a login (401): ${msg}` : msg;
  return text.replace(/\s+/g, " ").slice(0, 300);
}
