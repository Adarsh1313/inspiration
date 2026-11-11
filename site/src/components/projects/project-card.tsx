"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cardView, type Block } from "@/lib/projects/day-blocks";
import type { Project, ProjectEntry } from "@/lib/projects/store";
import { EntryEditor } from "./entry-editor";

export function ProjectCard({
  project, entries, now, onEntry, onGone,
}: {
  project: Project;
  entries: ProjectEntry[];
  now: Date;
  onEntry: (e: ProjectEntry) => void;
  onGone: (id: string) => void;
}) {
  const { open, blocks } = cardView(entries, now);
  return (
    <section className="pcard" data-colour={project.colour} aria-label={project.name}>
      <header className="pcard-head">
        <h2 className="pcard-name">{project.name}</h2>
        {project.repo ? (
          <a className="pcard-repo mono" href={`https://github.com/${project.repo}`} target="_blank" rel="noopener noreferrer">
            {project.repo} <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
          </a>
        ) : (
          <span className="pcard-repo mono">no repo yet</span>
        )}
      </header>
      <div className="pcard-body">
        <EntryEditor projectId={project.id} slug={project.slug} name={project.name} open={open} onEntry={onEntry} onGone={onGone} />
        {blocks.length > 0 && (
          <ul className="pblocks">
            {blocks.map((b) => (
              <BlockRow key={b.entry.id} block={b} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BlockRow({ block }: { block: Block }) {
  const [expanded, setExpanded] = useState(false);
  const { entry, label, ticketed, issues } = block;
  return (
    <li className="pblock" data-expanded={expanded}>
      <button type="button" className="pblock-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <ChevronRight size={14} strokeWidth={1.5} className="pblock-chevron" aria-hidden />
        <span className="mono">{label}</span>
        {ticketed && <span className="pblock-badge mono">Ticketed · {issues.length} {issues.length === 1 ? "issue" : "issues"}</span>}
      </button>
      {expanded && (
        <div className="pblock-body">
          <p className="pblock-text">{entry.text}</p>
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
