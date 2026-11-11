"use client";

import { useCallback, useEffect, useState } from "react";
import { reorderProjects, restoreProject } from "@/app/(app)/projects/actions";
import { browserClient } from "@/lib/supabase-browser";
import type { Project, ProjectEntry } from "@/lib/projects/store";
import { ProjectCard } from "./project-card";

const TICK_MS = 30_000;

type Change = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

export function ProjectsBoard({ initialProjects, initialEntries }: { initialProjects: Project[]; initialEntries: ProjectEntry[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [entries, setEntries] = useState(initialEntries);
  const [now, setNow] = useState(() => new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-evaluate "today" so a card rolls over at midnight IST while the page is open.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const upsertEntry = useCallback((e: ProjectEntry) => {
    setEntries((all) => {
      const old = all.find((x) => x.id === e.id);
      if (old && old.rev > e.rev) return all; // stale
      return old ? all.map((x) => (x.id === e.id ? e : x)) : [...all, e];
    });
  }, []);
  const removeEntry = useCallback((id: string) => setEntries((all) => all.filter((x) => x.id !== id)), []);
  const patchProject = useCallback((id: string, patch: Partial<Project>) => setProjects((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p))), []);

  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel("projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_entries" }, (p: Change) => {
        if (p.eventType === "DELETE") removeEntry(p.old.id as string);
        else upsertEntry(p.new as unknown as ProjectEntry);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (p: Change) => {
        if (p.eventType === "DELETE") return;
        const row = p.new as unknown as Project;
        setProjects((all) => (all.some((x) => x.id === row.id) ? all.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...all, row]));
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [upsertEntry, removeEntry]);

  const active = projects.filter((p) => !p.archived_at).sort((a, b) => a.position - b.position);
  const archived = projects.filter((p) => p.archived_at);

  async function applyOrder(ids: string[]) {
    setProjects((all) => all.map((p) => (ids.includes(p.id) ? { ...p, position: ids.indexOf(p.id) } : p)));
    const r = await reorderProjects(ids);
    setError(r.ok ? null : r.error);
  }

  function moveBefore(id: string, targetId: string) {
    if (id === targetId) return;
    const ids = active.map((p) => p.id).filter((x) => x !== id);
    ids.splice(ids.indexOf(targetId), 0, id);
    void applyOrder(ids);
  }

  function step(id: string, dir: -1 | 1) {
    const ids = active.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void applyOrder(ids);
  }

  async function restore(p: Project) {
    const r = await restoreProject(p.id);
    if (r.ok) patchProject(p.id, { archived_at: null, position: active.length });
    else setError(r.error);
  }

  return (
    <>
      {active.length === 0 ? (
        <p className="hint">No active projects yet.</p>
      ) : (
        <div className="pgrid">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              entries={entries.filter((e) => e.project_id === p.id)}
              now={now}
              onEntry={upsertEntry}
              onGone={removeEntry}
              onChange={(patch) => patchProject(p.id, patch)}
              drag={{
                dragging: dragId === p.id,
                onDragStart: () => setDragId(p.id),
                onDragEnd: () => setDragId(null),
                onDrop: () => {
                  if (dragId) moveBefore(dragId, p.id);
                  setDragId(null);
                },
                onMove: (dir) => step(p.id, dir),
              }}
            />
          ))}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {archived.length > 0 && (
        <details className="parchived">
          <summary>Archived <span className="mono">({archived.length})</span></summary>
          <ul>
            {archived.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button type="button" className="btn secondary bar-btn" onClick={() => void restore(p)}>Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
