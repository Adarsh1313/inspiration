import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Notepad" };

export default function Page() {
  return (
    <>
      <PageHeader title="Notepad" lede="One page of text that follows you from phone to laptop." />
      <div className="placeholder">The editor arrives in milestone 2.</div>
    </>
  );
}
