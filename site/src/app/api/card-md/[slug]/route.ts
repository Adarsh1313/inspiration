import { cardMarkdown } from "@hub/capture";
import { readAgentCards } from "@/lib/cards-store";
import { serviceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/** Reached through the /r/<slug>.md rewrite. Returns the raw card markdown; drafts and archived cards are not served. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = (await readAgentCards(serviceClient())).find((c) => c.slug === slug && c.status === "active");
  if (!card) return new Response("Not found", { status: 404 });
  return new Response(cardMarkdown(card), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "private, no-store" } });
}
