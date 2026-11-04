import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Design" };

export default function Page() {
  return (
    <>
      <PageHeader title="Design" lede="A private library of design references: motion clips, layouts, components and the people behind them." />
      <div className="placeholder">Shelves arrive in milestone 5.</div>
    </>
  );
}
