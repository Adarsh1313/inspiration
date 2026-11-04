import { NextResponse } from "next/server";
import { filterRefs, parseRefsQuery, toRefSummary } from "@/lib/agent-access";
import { readAgentCards } from "@/lib/cards-store";
import { originOf, serviceClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/** GET /api/refs.json?shelf=&kind=&tag=&status= → { count, cards[] }. Active cards unless `status` says otherwise. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cards = filterRefs(await readAgentCards(serviceClient()), parseRefsQuery(url.searchParams));
  const ctx = { baseUrl: originOf(req), queryToken: url.searchParams.get("token") };
  return NextResponse.json({ count: cards.length, cards: cards.map((c) => toRefSummary(c, ctx)) }, { headers: { "cache-control": "private, no-store" } });
}
