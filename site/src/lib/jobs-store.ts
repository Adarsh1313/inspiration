import type { SupabaseClient } from "@supabase/supabase-js";
import { signMedia } from "./cards-store";
import type { JobRow, JobStatus } from "./jobs";

type Row = Omit<JobRow, "screenshotUrl"> & { screenshot: string | null };

/** Every saved posting, newest first, with a signed URL for its screenshot if it has one. */
export async function readJobs(supabase: SupabaseClient): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("job_postings")
    .select("id,source_url,company,role,location,posted_at,status,created_at,screenshot")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const urls = await signMedia(supabase, rows.map((r) => r.screenshot));
  return rows.map(({ screenshot, ...r }) => ({ ...r, screenshotUrl: screenshot ? (urls.get(screenshot) ?? null) : null }));
}

export async function findJobByKey(supabase: SupabaseClient, key: string): Promise<{ id: string; label: string } | null> {
  const { data, error } = await supabase.from("job_postings").select("id,company,role").eq("canonical_key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id as string, label: [data.role, data.company].filter(Boolean).join(" at ") || "a saved posting" } : null;
}

export type NewJob = {
  source_url: string | null;
  canonical_key: string;
  company: string | null;
  role: string;
  location: string | null;
  posted_at: string | null;
  raw_text: string | null;
  screenshot: string | null;
};

/** Inserts a posting. Returns null when the canonical key is already taken. */
export async function insertJob(supabase: SupabaseClient, job: NewJob): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from("job_postings").insert(job).select("id").single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  return { id: data.id as string };
}

export async function updateJobStatus(supabase: SupabaseClient, id: string, status: JobStatus): Promise<boolean> {
  const { data, error } = await supabase.from("job_postings").update({ status }).eq("id", id).select("id");
  return !error && !!data?.length;
}

/** Removes the screenshot from Storage first, then the row. */
export async function removeJob(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data: job } = await supabase.from("job_postings").select("screenshot").eq("id", id).maybeSingle();
  if (!job) return false;
  if (job.screenshot) {
    const { error } = await supabase.storage.from("media").remove([job.screenshot as string]);
    if (error) return false;
  }
  const { error } = await supabase.from("job_postings").delete().eq("id", id);
  return !error;
}
