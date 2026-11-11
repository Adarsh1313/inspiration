"use client";

import { useCallback, useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase-browser";
import type { Project, ProjectEntry } from "@/lib/projects/store";
import { ProjectCard } from "./project-card";

const TICK_MS = 30_000;

type Change = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

export function ProjectsBoard({ initialProjects, initialEntries }: { initialProjects: Project[]; initialEntries: ProjectEntry[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [entries, setEntries] = useState(initialEntries);
  const [now, setNow] = useState(() => new Date());

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

  if (active.length === 0) return <p className="hint">No active projects yet.</p>;
  return (
    <div className="pgrid">
      {active.map((p) => (
        <ProjectCard key={p.id} project={p} entries={entries.filter((e) => e.project_id === p.id)} now={now} onEntry={upsertEntry} onGone={removeEntry} />
      ))}
    </div>
  );
}
