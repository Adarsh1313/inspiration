export const SHELVES = [
  "landing-pages-portfolios",
  "motion-interactions",
  "agent-skills",
  "backgrounds-assets",
  "typography",
  "tools-directories",
  "talks-people",
  "anti-slop",
] as const;
export type Shelf = (typeof SHELVES)[number];

export const KINDS = [
  "layout",
  "animation",
  "micro-interaction",
  "component",
  "asset",
  "typography",
  "skill",
  "directory",
  "person",
  "talk",
] as const;
export type Kind = (typeof KINDS)[number];

export type SourceType = "x-post" | "github" | "reddit" | "youtube" | "site" | "video" | "linkedin";

export type CaptureStep = "download" | "poster" | "preview" | "transcript" | "screenshot";
/** Order a card's steps run in. */
export const STEP_ORDER: CaptureStep[] = ["download", "screenshot", "poster", "preview", "transcript"];

export type ErrorCode = "invalid-url" | "unsafe-url" | "timeout" | "oversize" | "blocked" | "authwall" | "not-found" | "failed";

export type DraftError = { code: ErrorCode; message: string };

export type Draft = {
  canonicalUrl: string;
  canonicalKey: string;
  sourceType: SourceType;
  title: string;
  author: string | null;
  description: string;
  posterUrl: string | null;
  mediaUrl: string | null;
  suggestedShelf: Shelf;
  kind: Kind;
  errors: DraftError[];
};

/** Thrown by the fetch layer. `status` is the HTTP status when there was one. */
export class CaptureError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CaptureError";
  }
}
