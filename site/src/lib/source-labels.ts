import { SHELVES, type Shelf, type SourceType } from "@hub/capture";

export const SOURCE_LABEL: Record<SourceType, string> = {
  "x-post": "X",
  github: "GitHub",
  reddit: "Reddit",
  youtube: "YouTube",
  site: "Site",
  video: "Video",
  linkedin: "LinkedIn",
};

export const SHELF_LABEL: Record<Shelf, string> = {
  "landing-pages-portfolios": "Landing pages and portfolios",
  "motion-interactions": "Motion and interactions",
  "agent-skills": "Agent skills",
  "backgrounds-assets": "Backgrounds and assets",
  typography: "Typography",
  "tools-directories": "Tools and directories",
  "talks-people": "Talks and people",
  "anti-slop": "Anti-slop",
};

export const SHELF_OPTIONS = SHELVES.map((value) => ({ value, label: SHELF_LABEL[value] }));
