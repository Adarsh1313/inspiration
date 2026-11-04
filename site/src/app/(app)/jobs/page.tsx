import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Jobs" };

export default function Page() {
  return (
    <>
      <PageHeader title="Jobs" lede="Saved job postings and where each application stands." />
      <div className="placeholder">Postings arrive in milestone 9.</div>
    </>
  );
}
