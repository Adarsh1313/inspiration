import { AppShell } from "@/components/app-shell";
import { NO_COUNTS } from "@/components/nav-items";
import { readNavCounts } from "@/lib/cards-store";
import { serverClient } from "@/lib/supabase";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Counts are a nicety: if the read fails the shell still renders with zeros.
  const counts = await readNavCounts(await serverClient()).catch(() => NO_COUNTS);
  return <AppShell counts={counts}>{children}</AppShell>;
}
