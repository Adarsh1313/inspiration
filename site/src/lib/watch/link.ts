// Server-side: decide whether a pasted link can become a watch item.
import { normalise } from "@hub/capture";
import type { WatchSource } from "./notes";

export type AcceptedLink = { ok: true; url: string; key: string; source: WatchSource };
export type RefusedLink = { ok: false; message: string };

export const REFUSAL = "Paste a YouTube or X link.";

/** YouTube videos and X posts only. Profiles, other sites and junk are refused. */
export function acceptLink(raw: string): AcceptedLink | RefusedLink {
  let n;
  try {
    n = normalise(raw);
  } catch {
    return { ok: false, message: REFUSAL };
  }
  if (n.sourceType === "youtube") return { ok: true, url: n.canonicalUrl, key: n.canonicalKey, source: "youtube" };
  if (n.sourceType === "x-post" && n.canonicalKey.startsWith("x:")) return { ok: true, url: n.canonicalUrl, key: n.canonicalKey, source: "x-post" };
  return { ok: false, message: REFUSAL };
}
