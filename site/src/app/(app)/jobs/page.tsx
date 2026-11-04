import type { Metadata } from "next";
import Link from "next/link";
import { JobCard } from "@/components/jobs/job-card";
import { JobPasteBar } from "@/components/jobs/job-paste-bar";
import { PageHeader } from "@/components/page-header";
import { JOB_STATUSES, JOB_STATUS_LABEL, countByStatus, parseJobFilter } from "@/lib/jobs";
import { readJobs } from "@/lib/jobs-store";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = parseJobFilter(typeof sp.status === "string" ? sp.status : undefined);
  const jobs = await readJobs(await serverClient()).catch(() => null);

  const counts = jobs ? countByStatus(jobs) : null;
  const shown = jobs ? jobs.filter((j) => !status || j.status === status) : [];
  const chip = (on: boolean) => (on ? "chip chip-btn" : "chip chip-btn chip-idle");

  return (
    <>
      <PageHeader title="Jobs" lede="Saved job postings and where each application stands." />
      <JobPasteBar />

      {jobs && counts && (
        <div className="filters" role="group" aria-label="Status">
          <div className="filter-row">
            <Link replace scroll={false} href="/jobs" className={chip(!status)} aria-current={!status ? "true" : undefined}>
              All · {jobs.length}
            </Link>
            {JOB_STATUSES.map((s) => (
              <Link key={s} replace scroll={false} href={`/jobs?status=${s}`} className={chip(status === s)} aria-current={status === s ? "true" : undefined}>
                {JOB_STATUS_LABEL[s]} · {counts[s]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!jobs && <p className="error" role="alert">Could not load your postings. If this is the first run, apply migration 0008 in Supabase, then refresh.</p>}
      {jobs && shown.length === 0 && (
        <div className="placeholder">{status ? `Nothing marked ${JOB_STATUS_LABEL[status].toLowerCase()}.` : "No postings yet. Paste a link above."}</div>
      )}
      {shown.length > 0 && (
        <ul className="jobs" aria-label="Saved postings">
          {shown.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </ul>
      )}
    </>
  );
}
