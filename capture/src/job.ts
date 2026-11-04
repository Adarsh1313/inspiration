// Job postings: a preview from a link (schema.org JobPosting first, then page titles) or from pasted text.
import { createHash } from "node:crypto";
import { collapse, decodeEntities, parseMeta, truncate } from "./html";
import { fetchText, type HttpOptions } from "./http";
import { normalise } from "./normalise";
import { toError } from "./extractors";
import type { DraftError, ErrorCode } from "./types";

export type JobDraft = {
  /** Null when the posting came from pasted text or a screenshot alone. */
  canonicalUrl: string | null;
  canonicalKey: string;
  company: string | null;
  role: string;
  location: string | null;
  /** YYYY-MM-DD */
  postedAt: string | null;
  description: string;
  errors: DraftError[];
};

const MAX_FIELD = 200;

function clean(text: unknown, max = MAX_FIELD): string | null {
  if (typeof text !== "string") return null;
  const t = collapse(decodeEntities(text));
  return t ? truncate(t, max) : null;
}

/** `2026-03-04T10:00:00Z`, `2026-03-04` or `March 4, 2026` → `2026-03-04`. Anything unreadable → null. */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Prose dates parse in local time, so read them back in local time (toISOString would shift the day).
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The dedupe key. LinkedIn postings share one id across URL variants; other links use their normalised URL. */
export function jobKey(rawUrl: string): { canonicalUrl: string; canonicalKey: string } {
  const n = normalise(rawUrl);
  const url = new URL(n.canonicalUrl);
  const linkedin = /linkedin\.com$/.test(url.hostname) ? (url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/)?.[1] ?? url.searchParams.get("currentJobId")) : null;
  if (linkedin) return { canonicalUrl: `https://www.linkedin.com/jobs/view/${linkedin}`, canonicalKey: `job:linkedin:${linkedin}` };
  return { canonicalUrl: n.canonicalUrl, canonicalKey: `job:${n.canonicalKey}` };
}

/** A key for a posting that has no link: the same text or screenshot always gives the same key. */
export function contentKey(content: string | Uint8Array): string {
  return `job:text:${createHash("sha256").update(content).digest("hex").slice(0, 24)}`;
}

// ---------- schema.org JobPosting ----------

type Json = Record<string, unknown>;

function findJobPosting(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findJobPosting(item);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Json;
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
    return findJobPosting(obj["@graph"]);
  }
  return null;
}

function placeText(loc: unknown): string | null {
  if (Array.isArray(loc)) return loc.map(placeText).filter(Boolean).join(" / ") || null;
  if (!loc || typeof loc !== "object") return clean(loc);
  const address = (loc as Json).address;
  if (typeof address === "string") return clean(address);
  if (address && typeof address === "object") {
    const a = address as Json;
    const parts = [a.addressLocality, a.addressRegion, typeof a.addressCountry === "object" ? (a.addressCountry as Json)?.name : a.addressCountry]
      .map((p) => clean(p))
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}

/** Reads every ld+json block in the page and returns the first JobPosting as draft fields. */
export function parseJobPostingLd(html: string): Pick<JobDraft, "company" | "role" | "location" | "postedAt" | "description"> | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let json: unknown;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const job = findJobPosting(json);
    if (!job) continue;
    const org = job.hiringOrganization;
    const company = typeof org === "string" ? clean(org) : clean((org as Json | undefined)?.name);
    const remote = String(job.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE";
    const place = placeText(job.jobLocation);
    const description = clean(typeof job.description === "string" ? job.description.replace(/<[^>]*>/g, " ") : "", 400) ?? "";
    return {
      company,
      role: clean(job.title) ?? "",
      location: place ? (remote ? `${place} (remote)` : place) : remote ? "Remote" : null,
      postedAt: toIsoDate(job.datePosted),
      description,
    };
  }
  return null;
}

// ---------- page titles ----------

/** "Acme hiring Designer in Berlin | LinkedIn", "Designer at Acme", "Designer - Acme | Greenhouse". */
export function parseJobTitle(title: string): { company: string | null; role: string; location: string | null } | null {
  const t = collapse(title).replace(/\s*[|·]\s*(LinkedIn|Indeed|Glassdoor|Greenhouse|Lever|Ashby|Workable|Wellfound).*$/i, "");
  const hiring = t.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+(.+))?$/i);
  if (hiring) return { company: hiring[1].trim(), role: hiring[2].trim(), location: hiring[3]?.trim() ?? null };
  const at = t.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[-–—]\s+(.+))?$/i);
  if (at) return { company: at[2].trim(), role: at[1].trim(), location: at[3]?.trim() ?? null };
  const dash = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) return { company: dash[2].trim(), role: dash[1].trim(), location: null };
  return t ? { company: null, role: t, location: null } : null;
}

const WALL_TITLE = /^(sign up|log ?in|join linkedin|linkedin: log in|just a moment|attention required|access denied)/i;
const wallError = (code: ErrorCode): DraftError => ({ code, message: "That posting needs a login or blocked the preview. Paste the posting text or a screenshot instead." });

function blank(canonicalUrl: string | null, canonicalKey: string, errors: DraftError[] = []): JobDraft {
  return { canonicalUrl, canonicalKey, company: null, role: "", location: null, postedAt: null, description: "", errors };
}

/** Preview for a pasted posting link. Never throws for an unreachable page: the failure is in `errors`. Throws CaptureError only for an invalid or unsafe URL. */
export async function jobDraft(url: string, http: HttpOptions): Promise<JobDraft> {
  const { canonicalUrl, canonicalKey } = jobKey(url);
  let res;
  try {
    res = await fetchText(canonicalUrl, http);
  } catch (e) {
    return blank(canonicalUrl, canonicalKey, [toError(e)]);
  }
  const walled = /\/(authwall|login|signin|uas\/login)\b/i.test(new URL(res.url).pathname);
  if (res.status === 404 || res.status === 410) return blank(canonicalUrl, canonicalKey, [{ code: "not-found", message: "That posting was not found. It may have closed." }]);
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999 || walled) return blank(canonicalUrl, canonicalKey, [wallError(walled ? "authwall" : "blocked")]);
  if (res.status >= 400) return blank(canonicalUrl, canonicalKey, [{ code: "failed", message: `The site answered ${res.status}.` }]);

  const ld = parseJobPostingLd(res.text);
  const meta = parseMeta(res.text, res.url);
  if (!ld && meta.title && WALL_TITLE.test(meta.title)) return blank(canonicalUrl, canonicalKey, [wallError("authwall")]);

  const fromTitle = meta.title ? parseJobTitle(meta.title) : null;
  const out: JobDraft = {
    canonicalUrl,
    canonicalKey,
    company: ld?.company ?? fromTitle?.company ?? null,
    role: ld?.role || fromTitle?.role || "",
    location: ld?.location ?? fromTitle?.location ?? null,
    postedAt: ld?.postedAt ?? null,
    description: ld?.description || truncate(meta.description ?? "", 400),
    errors: [],
  };
  if (!out.role && !out.company) out.errors.push({ code: "failed", message: "Could not find job details on that page. Fill them in, or paste the posting text." });
  return out;
}

// ---------- pasted text ----------

const LABELS: Record<string, "company" | "role" | "location" | "postedAt"> = {
  company: "company",
  employer: "company",
  organisation: "company",
  organization: "company",
  role: "role",
  title: "role",
  position: "role",
  "job title": "role",
  location: "location",
  where: "location",
  posted: "postedAt",
  "date posted": "postedAt",
};

/** Best-effort fields from pasted posting text. Labelled lines (`Company: Acme`) win; otherwise the first line is the role. */
export function jobFromText(text: string, link?: { canonicalUrl: string; canonicalKey: string }): JobDraft {
  const lines = text.split(/\r?\n/).map((l) => collapse(l)).filter(Boolean);
  const found: Partial<Record<"company" | "role" | "location" | "postedAt", string>> = {};
  for (const line of lines.slice(0, 40)) {
    const m = line.match(/^([A-Za-z ]{3,16})\s*[:：]\s*(.+)$/);
    const field = m && LABELS[m[1].toLowerCase()];
    if (field && !found[field]) found[field] = m[2];
  }
  const first = lines[0] && lines[0].length <= 120 ? lines[0] : "";
  const fromFirst = first && !/[:：]/.test(first) ? parseJobTitle(first) : null;
  return {
    canonicalUrl: link?.canonicalUrl ?? null,
    canonicalKey: link?.canonicalKey ?? contentKey(text.trim()),
    company: clean(found.company) ?? fromFirst?.company ?? null,
    role: clean(found.role) ?? fromFirst?.role ?? "",
    location: clean(found.location) ?? fromFirst?.location ?? null,
    postedAt: toIsoDate(found.postedAt),
    description: truncate(collapse(text), 400),
    errors: [],
  };
}
