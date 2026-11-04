import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Card" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <PageHeader title={decodeURIComponent(slug)} lede="A single reference card." />
      <div className="placeholder">Card pages arrive in milestone 5.</div>
    </>
  );
}
