import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Cold email" };

export default function Page() {
  return (
    <>
      <PageHeader title="Cold email" lede="Outreach drafts and follow-ups. Details to come." />
      <div className="placeholder">Placeholder.</div>
    </>
  );
}
