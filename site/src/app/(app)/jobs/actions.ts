"use server";

import { revalidatePath } from "next/cache";
import { isJobStatus } from "@/lib/jobs";
import { removeJob, updateJobStatus } from "@/lib/jobs-store";
import { serverClient } from "@/lib/supabase";

export type JobActionResult = { ok: true } | { ok: false; error: string };

export async function setJobStatus(id: string, status: string): Promise<JobActionResult> {
  if (!isJobStatus(status)) return { ok: false, error: "Unknown status." };
  const done = await updateJobStatus(await serverClient(), id, status);
  if (!done) return { ok: false, error: "That did not save. Try again." };
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteJob(id: string): Promise<JobActionResult> {
  const done = await removeJob(await serverClient(), id);
  if (!done) return { ok: false, error: "Could not delete that posting." };
  revalidatePath("/", "layout");
  return { ok: true };
}
