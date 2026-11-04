"use client";

import { useRef, useState } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";
import { deleteJob, setJobStatus } from "@/app/(app)/jobs/actions";
import { formatDate } from "@/lib/format";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobRow } from "@/lib/jobs";

/** One saved posting: what it is, where it stands, and a status you can change. */
export function JobCard({ job }: { job: JobRow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const hasDetails = !!job.screenshotUrl || !!job.raw_text;
  const posted = formatDate(job.posted_at);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    const result = await setJobStatus(job.id, status).catch(() => ({ ok: false as const, error: "That did not save. Try again." }));
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await deleteJob(job.id).catch(() => ({ ok: false as const, error: "Could not delete that posting." }));
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <li className="job" data-status={job.status}>
      {job.screenshotUrl && (
        <button type="button" className="job-shot" onClick={() => dialog.current?.showModal()} aria-label="View the screenshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.screenshotUrl} alt="" loading="lazy" />
        </button>
      )}
      <div className="job-main">
        <h2 className="job-role">{job.role || job.company || "Untitled posting"}</h2>
        <p className="job-meta">
          {[job.role ? job.company : null, job.location, posted && `Posted ${posted}`].filter(Boolean).join(" · ") || "No details"}
        </p>
        {hasDetails && (
          <button type="button" className="link job-details-btn" onClick={() => dialog.current?.showModal()}>
            {job.screenshotUrl ? "View screenshot" : "View posting text"}
          </button>
        )}
        {job.source_url && (
          <a className="link job-link" href={job.source_url} target="_blank" rel="noopener noreferrer">
            {job.source_url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
          </a>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="job-side">
        <label className="visually-hidden" htmlFor={`status-${job.id}`}>Status</label>
        <select id={`status-${job.id}`} className="input job-status" value={job.status} disabled={busy} onChange={(e) => void changeStatus(e.target.value)}>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
          ))}
        </select>
        {confirm ? (
          <span className="row">
            <button type="button" className="btn secondary bar-btn job-delete" disabled={busy} onClick={() => void remove()}>Delete</button>
            <button type="button" className="btn secondary bar-btn" disabled={busy} onClick={() => setConfirm(false)}>Keep</button>
          </span>
        ) : (
          <button type="button" className="icon-btn" aria-label="Delete this posting" disabled={busy} onClick={() => setConfirm(true)}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {hasDetails && (
        <dialog
          ref={dialog}
          className="lightbox"
          aria-label={`${job.role || job.company || "Posting"} details`}
          onClick={(e) => e.target === e.currentTarget && dialog.current?.close() /* a click on the backdrop */}
        >
          <div className="lightbox-body">
            <button type="button" className="icon-btn lightbox-close" aria-label="Close" onClick={() => dialog.current?.close()}>
              <X size={16} strokeWidth={1.5} />
            </button>
            {job.screenshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="lightbox-img" src={job.screenshotUrl} alt={`Screenshot of the ${job.role || "job"} posting`} />
            )}
            {job.raw_text && <pre className="lightbox-text">{job.raw_text}</pre>}
          </div>
        </dialog>
      )}
    </li>
  );
}
