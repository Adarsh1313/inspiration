import { renderLlmsTxt } from "@/lib/agent-access";
import { readAgentCards } from "@/lib/cards-store";
import { originOf, serviceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cards = await readAgentCards(serviceClient());
  const queryToken = new URL(req.url).searchParams.get("token");
  const body = renderLlmsTxt(cards, { baseUrl: originOf(req), queryToken });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" } });
}
