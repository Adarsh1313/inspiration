import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Design shelf" };

export default async function Page({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  return (
    <>
      <PageHeader title={decodeURIComponent(shelf)} lede="One shelf of the design library." />
      <div className="placeholder">Shelves arrive in milestone 5.</div>
    </>
  );
}
