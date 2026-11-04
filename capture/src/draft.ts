import { extractGithub, extractOpenGraph, extractVideoFile, extractX, extractXProfile, extractYoutube, toError, type Extracted } from "./extractors";
import type { HttpOptions } from "./http";
import { normalise, type Normalised } from "./normalise";
import type { CaptureStep, Draft, Kind, Shelf, SourceType } from "./types";

export type DraftOptions = Omit<HttpOptions, "headers">;

const SKILL_HINT = /\b(skills?|claude-code|agent-skills?|agents?\.md)\b/i;

function isXProfile(n: Normalised): boolean {
  return n.canonicalKey.startsWith("x-user:");
}

/** Best guess at where a card belongs. The paste bar lets Adarsh change it. */
export function suggest(n: Normalised, e: Extracted): { shelf: Shelf; kind: Kind } {
  switch (n.sourceType) {
    case "x-post":
      if (isXProfile(n)) return { shelf: "talks-people", kind: "person" };
      return { shelf: "motion-interactions", kind: e.mediaUrl ? "animation" : "layout" };
    case "youtube":
      return { shelf: "talks-people", kind: "talk" };
    case "github":
      return SKILL_HINT.test(e.hints.join(" ")) ? { shelf: "agent-skills", kind: "skill" } : { shelf: "tools-directories", kind: "component" };
    case "video":
      return { shelf: "motion-interactions", kind: "animation" };
    case "reddit":
    case "linkedin":
    case "site":
      return { shelf: "landing-pages-portfolios", kind: "layout" };
  }
}

/** Which worker steps a new card needs. */
export function planSteps(sourceType: SourceType, d: Pick<Draft, "mediaUrl" | "kind">): CaptureStep[] {
  if (d.kind === "person") return ["poster"];
  switch (sourceType) {
    case "x-post":
    case "github":
    case "video":
      return d.mediaUrl ? ["download", "poster", "preview"] : ["poster"];
    case "reddit":
      return ["download", "poster", "preview"];
    case "youtube":
      return ["poster", "transcript"];
    case "site":
      return ["screenshot", "poster"];
    case "linkedin":
      return ["poster"];
  }
}

async function extract(n: Normalised, http: HttpOptions): Promise<Extracted> {
  switch (n.sourceType) {
    case "x-post":
      return isXProfile(n) ? extractXProfile(n, http) : extractX(n, http);
    case "github":
      return extractGithub(n, http);
    case "youtube":
      return extractYoutube(n, http);
    case "video":
      return extractVideoFile(n);
    default:
      return extractOpenGraph(n, http);
  }
}

/**
 * Preview for a pasted link. Never throws for a reachable-or-not link: failures
 * come back in `errors`, so a walled link can still be saved with a screenshot.
 * Throws CaptureError only when the URL itself is invalid or unsafe.
 */
export async function draft(url: string, opts: DraftOptions): Promise<Draft> {
  const n = normalise(url);
  let e: Extracted;
  try {
    e = await extract(n, opts);
  } catch (err) {
    e = { title: "", author: null, description: "", posterUrl: null, mediaUrl: null, hints: [], errors: [toError(err)] };
  }
  const { shelf, kind } = suggest(n, e);
  return {
    canonicalUrl: n.canonicalUrl,
    canonicalKey: n.canonicalKey,
    sourceType: n.sourceType,
    title: e.title,
    author: e.author,
    description: e.description,
    posterUrl: e.posterUrl,
    mediaUrl: e.mediaUrl,
    suggestedShelf: shelf,
    kind,
    errors: e.errors,
  };
}
