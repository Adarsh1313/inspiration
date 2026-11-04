import type { SourceType } from "@hub/capture";
import { Globe } from "lucide-react";
import { GithubIcon, LinkedinIcon, XIcon, YoutubeIcon } from "./icons";
import { SOURCE_LABEL } from "@/lib/source-labels";

/** A plain glyph for where a reference came from. Sites, Reddit and video share the globe. */
export function SourceIcon({ type }: { type: SourceType }) {
  const label = SOURCE_LABEL[type];
  const glyph =
    type === "x-post" ? <XIcon /> : type === "github" ? <GithubIcon /> : type === "youtube" ? <YoutubeIcon /> : type === "linkedin" ? <LinkedinIcon /> : <Globe size={16} strokeWidth={1.5} aria-hidden />;
  return <span className="source-icon" role="img" aria-label={label} title={label}>{glyph}</span>;
}
