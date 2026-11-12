"use client";

import { useState, useTransition } from "react";
import { ChevronRight, ExternalLink, GripVertical, Play } from "lucide-react";
import { archiveProject, deleteEntry, editEntry, setProjectLinks } from "@/app/(app)/projects/actions";
import { allFilename, blockFilename, blockMarkdown, blockText, cardView, toMarkdown, type Block } from "@/lib/projects/day-blocks";
import { copyText, downloadFile } from "@/lib/projects/download";
import type { Project, ProjectEntry } from "@/lib/projects/store";
import { EntryEditor } from "./entry-editor";
import { ListTextarea } from "./list-textarea";
import { Menu } from "./menu";

type DragProps = {
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (dir: -1 | 1) => void;
  dragging: boolean;
};

export function ProjectCard({
  project, entries, now, onEntry, onGone, onChange, drag,
}: {
  project: Project;
  entries: ProjectEntry[];
  now: Date;
  onEntry: (e: ProjectEntry) => void;
  onGone: (id: string) => void;
  onChange: (patch: Partial<Project>) => void;
  drag: DragProps;
}) {
  const { open, blocks } = cardView(entries, now);
  const [editingRepo, setEditingRepo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function archive() {
    const r = await archiveProject(project.id);
    if (r.ok) onChange({ archived_at: new Date().toISOString() });
    else setMessage(r.error);
  }

  return (
    <section
      className="pcard"
      data-colour={project.colour}
      data-dragging={drag.dragging}
      aria-label={project.name}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        drag.onDrop();
      }}
    >
      <header className="pcard-head">
        <div className="pcard-title">
          <span className="pcard-grip" draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", project.id); drag.onDragStart(); }} onDragEnd={drag.onDragEnd} aria-hidden>
            <GripVertical size={14} strokeWidth={1.5} />
          </span>
          <h2 className="pcard-name">{project.name}</h2>
          <Menu
            label={`${project.name} options`}
            items={[
              { label: "Download all", onSelect: () => downloadFile(allFilename(project.slug), toMarkdown(project, entries), "text/markdown"), disabled: entries.length === 0 },
              { label: "Edit links", onSelect: () => setEditingRepo(true) },
              { label: "Move earlier", onSelect: () => drag.onMove(-1) },
              { label: "Move later", onSelect: () => drag.onMove(1) },
              { label: "Archive", onSelect: () => void archive(), danger: true },
            ]}
          />
        </div>
        {editingRepo ? (
          <LinksForm
            project={project}
            onDone={(patch) => {
              setEditingRepo(false);
              if (patch) onChange(patch);
            }}
          />
        ) : (
          <>
            {project.repo ? (
              <a className="pcard-repo mono" href={`https://github.com/${project.repo}`} target="_blank" rel="noopener noreferrer">
                {project.repo} <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
              </a>
            ) : (
              <span className="pcard-repo mono">no repo yet</span>
            )}
            {project.local_url && (
              <a className="pcard-repo mono" href={project.local_url} target="_blank" rel="noopener noreferrer" title="Opens your local dev server">
                {project.local_url.replace(/^https?:\/\//, "")} <Play size={12} strokeWidth={1.5} aria-hidden />
              </a>
            )}
          </>
        )}
        {message && <p className="error" role="alert">{message}</p>}
      </header>
      <div className="pcard-body">
        <EntryEditor projectId={project.id} slug={project.slug} name={project.name} open={open} onEntry={onEntry} onGone={onGone} />
        {blocks.length > 0 && (
          <ul className="pblocks">
            {blocks.map((b) => (
              <BlockRow key={b.entry.id} block={b} slug={project.slug} onEntry={onEntry} onGone={onGone} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LinksForm({ project, onDone }: { project: Project; onDone: (patch?: Partial<Project>) => void }) {
  const [repo, setRepo] = useState(project.repo ?? "");
  const [local, setLocal] = useState(project.local_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await setProjectLinks(project.id, repo, local);
      if (r.ok) onDone({ repo: r.repo ?? null, local_url: r.local_url ?? null });
      else setError(r.error);
    });
  }

  return (
    <form className="pcard-repo-form" onSubmit={submit}>
      <input className="input mono" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="GitHub: owner/name" aria-label="GitHub repo" autoFocus onKeyDown={(e) => e.key === "Escape" && onDone()} />
      <input className="input mono" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local server: localhost:3000" aria-label="Local dev server" onKeyDown={(e) => e.key === "Escape" && onDone()} />
      <div className="row">
        <button type="submit" className="btn bar-btn" disabled={pending}>Save</button>
        <button type="button" className="btn secondary bar-btn" onClick={() => onDone()}>Cancel</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function BlockRow({ block, slug, onEntry, onGone }: { block: Block; slug: string; onEntry: (e: ProjectEntry) => void; onGone: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { entry, label, ticketed, issues } = block;

  async function save() {
    const r = await editEntry(entry.id, draft);
    if (!r.ok) return setError(r.error);
    onEntry({ ...(entry as ProjectEntry), text: draft, rev: entry.rev + 1 });
    setMode("view");
    setError(null);
  }

  async function remove() {
    const r = await deleteEntry(entry.id);
    if (r.ok) onGone(entry.id);
    else setError(r.error);
  }

  return (
    <li className="pblock" data-expanded={expanded}>
      <div className="pblock-row">
        <button type="button" className="pblock-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          <ChevronRight size={14} strokeWidth={1.5} className="pblock-chevron" aria-hidden />
          <span className="mono">{label}</span>
          {ticketed && <span className="pblock-badge mono">Ticketed · {issues.length} {issues.length === 1 ? "issue" : "issues"}</span>}
        </button>
        <Menu
          label={`${label} options`}
          items={[
            { label: "Edit", onSelect: () => { setDraft(entry.text); setMode("edit"); setExpanded(true); } },
            { label: copied ? "Copied" : "Copy", onSelect: () => void copyText(blockText(entry)).then((ok) => { setCopied(ok); setTimeout(() => setCopied(false), 1500); }) },
            { label: "Download .md", onSelect: () => downloadFile(blockFilename(slug, entry, "md"), blockMarkdown(entry), "text/markdown") },
            { label: "Download .txt", onSelect: () => downloadFile(blockFilename(slug, entry, "txt"), blockText(entry), "text/plain") },
            { label: "Delete", onSelect: () => { setMode("confirm"); setExpanded(true); }, danger: true },
          ]}
        />
      </div>
      {expanded && (
        <div className="pblock-body">
          {mode === "edit" ? (
            <>
              <ListTextarea className="pe-area pblock-edit" value={draft} onValueChange={setDraft} aria-label={`Edit ${label}`} autoFocus />
              <div className="row">
                <button type="button" className="btn bar-btn" onClick={() => void save()} disabled={draft.trim() === ""}>Save</button>
                <button type="button" className="btn secondary bar-btn" onClick={() => { setMode("view"); setError(null); }}>Cancel</button>
              </div>
            </>
          ) : (
            <p className="pblock-text">{entry.text}</p>
          )}
          {mode === "confirm" && (
            <div className="pblock-confirm" role="alertdialog" aria-label={`Delete ${label}`}>
              <p>Delete this block? This can't be undone.</p>
              <div className="row">
                <button type="button" className="btn bar-btn danger" onClick={() => void remove()}>Delete</button>
                <button type="button" className="btn secondary bar-btn" onClick={() => setMode("view")}>Cancel</button>
              </div>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {issues.length > 0 && (
            <ul className="pblock-issues">
              {issues.map((i) => (
                <li key={i.number}>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">#{i.number} {i.title}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
