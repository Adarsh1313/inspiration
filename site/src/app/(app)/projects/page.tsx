import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ProjectsBoard } from "@/components/projects/board";
import { readProjects } from "@/lib/projects/store";
import { serverClient } from "@/lib/supabase";

export const metadata: Metadata = { title: "Active projects" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { projects, entries } = await readProjects(await serverClient()).catch(() => ({ projects: [], entries: [] }));
  return (
    <>
      <PageHeader title="Active projects" lede="One card per project. Dump ideas here, then turn them into issues." />
      <ProjectsBoard initialProjects={projects} initialEntries={entries} />
    </>
  );
}
