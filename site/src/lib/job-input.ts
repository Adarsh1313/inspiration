// Server-side input handling shared by the two job routes. Kept apart from jobs.ts because it pulls in @hub/capture (node:crypto), which client components must not bundle.
import { contentKey, jobKey } from "@hub/capture";

export const MAX_TEXT = 20_000;

/** The link and pasted text from a request body, trimmed. Text is capped so a huge paste cannot be stored. */
export function readJobInput(body: { url?: unknown; text?: unknown } | null | undefined): { url: string; text: string } {
  return {
    url: typeof body?.url === "string" ? body.url.trim() : "",
    text: typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "",
  };
}

/** The dedupe key: the link when there is one, else the text, else the screenshot bytes. Throws CaptureError for a bad link. */
export function jobIdentity(input: { url: string; text: string; image?: Uint8Array }): { link?: { canonicalUrl: string; canonicalKey: string }; key: string } | null {
  const link = input.url ? jobKey(input.url) : undefined;
  if (link) return { link, key: link.canonicalKey };
  if (input.text) return { key: contentKey(input.text) };
  if (input.image) return { key: contentKey(input.image) };
  return null;
}
