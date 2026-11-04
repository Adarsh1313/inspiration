import { assertPublicUrl, assertResolvesPublic, type ResolveHost } from "./ssrf";
import { CaptureError } from "./types";

/** The slice of fetch the core needs. Tests pass a fake. */
export type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string>; redirect?: "manual" | "follow" }) => Promise<Response>;

export type HttpOptions = {
  fetch: FetchLike;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
};

export type HttpResult = { status: number; url: string; contentType: string; text: string };

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; HubCapture/0.1; personal use)";

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new CaptureError("oversize", "That page is too large to preview.");
  if (!res.body) return await res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CaptureError("oversize", "That page is too large to preview.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * GET a public URL with an SSRF check on every hop, a timeout and a size cap.
 * Non-2xx responses are returned, not thrown, so callers decide what a 403 means.
 */
export async function fetchText(rawUrl: string, opts: HttpOptions): Promise<HttpResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = assertPublicUrl(current);
      await assertResolvesPublic(url, opts.resolveHost);

      let res: Response;
      try {
        res = await opts.fetch(url.href, {
          signal: controller.signal,
          redirect: "manual",
          headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", ...opts.headers },
        });
      } catch (e) {
        if (e instanceof CaptureError) throw e;
        if (controller.signal.aborted) throw new CaptureError("timeout", "The site took too long to answer.");
        throw new CaptureError("failed", "Could not reach that address.");
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, url).href;
        continue;
      }
      const text = await readCapped(res, maxBytes).catch((e) => {
        if (e instanceof CaptureError) throw e;
        if (controller.signal.aborted) throw new CaptureError("timeout", "The site took too long to answer.");
        throw new CaptureError("failed", "Could not read that page.");
      });
      return { status: res.status, url: url.href, contentType: res.headers.get("content-type") ?? "", text };
    }
    throw new CaptureError("failed", "Too many redirects.");
  } finally {
    clearTimeout(timer);
  }
}

/** fetchText that requires a 2xx, mapping other statuses to CaptureError. */
export async function fetchOk(url: string, opts: HttpOptions): Promise<HttpResult> {
  const res = await fetchText(url, opts);
  if (res.status >= 200 && res.status < 300) return res;
  if (res.status === 404 || res.status === 410) throw new CaptureError("not-found", "That link was not found.", res.status);
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999) {
    throw new CaptureError("blocked", "That site blocked the preview.", res.status);
  }
  throw new CaptureError("failed", `The site answered ${res.status}.`, res.status);
}

export async function fetchJson<T>(url: string, opts: HttpOptions): Promise<T> {
  const res = await fetchOk(url, opts);
  try {
    return JSON.parse(res.text) as T;
  } catch {
    throw new CaptureError("failed", "The answer was not valid JSON.");
  }
}
