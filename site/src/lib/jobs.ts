// Pure job helpers: statuses, the save payload check and the list filter.

export const JOB_STATUSES = ["to-apply", "applied", "interviewing", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  "to-apply": "To apply",
  applied: "Applied",
  interviewing: "Interviewing",
  closed: "Closed",
};

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

export type JobRow = {
  id: string;
  source_url: string | null;
  company: string | null;
  role: string;
  location: string | null;
  posted_at: string | null;
  status: JobStatus;
  raw_text: string | null;
  created_at: string;
  screenshotUrl: string | null;
};

export type JobFields = { company: string | null; role: string; location: string | null; postedAt: string | null };
export type JobFieldsResult = { ok: true; value: JobFields } | { ok: false; error: string };

const clip = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The editable fields from the preview. A posting needs at least a role or a company to be worth saving. */
export function parseJobFields(input: { company?: unknown; role?: unknown; location?: unknown; postedAt?: unknown }): JobFieldsResult {
  const company = clip(input.company, 200);
  const role = clip(input.role, 200) ?? "";
  const location = clip(input.location, 200);
  const postedRaw = clip(input.postedAt, 10);
  if (postedRaw && !/^\d{4}-\d{2}-\d{2}$/.test(postedRaw)) return { ok: false, error: "Use a posting date like 2026-03-04, or leave it blank." };
  if (!role && !company) return { ok: false, error: "Add a role or a company so you can find it later." };
  return { ok: true, value: { company, role, location, postedAt: postedRaw } };
}

/** `?status=applied` → that status; anything else → all. */
export function parseJobFilter(value: string | null | undefined): JobStatus | undefined {
  return isJobStatus(value) ? value : undefined;
}

export function countByStatus(rows: Pick<JobRow, "status">[]): Record<JobStatus, number> {
  const out = { "to-apply": 0, applied: 0, interviewing: 0, closed: 0 } as Record<JobStatus, number>;
  for (const r of rows) out[r.status]++;
  return out;
}
