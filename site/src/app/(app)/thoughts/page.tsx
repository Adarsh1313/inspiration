import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Thoughts" };

export default function Page() {
  return (
    <>
      <PageHeader title="Thoughts" lede="A board of sticky notes for loose ideas." />
      <div className="placeholder">The board arrives in milestone 6.</div>
    </>
  );
}
