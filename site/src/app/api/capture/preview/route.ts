import { lookup } from "node:dns/promises";
import { CaptureError, draft, normalise } from "@hub/capture";
import { NextResponse } from "next/server";
import { supabaseCardStore } from "@/lib/cards-store";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 10;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/** POST { url } → the preview Draft (nothing is saved), plus the existing card if it is a duplicate. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "Paste a link." }, { status: 400 });

  try {
    const key = normalise(body.url).canonicalKey;
    const store = supabaseCardStore(await serverClient());
    const duplicate = await store.findByKey(key);
    if (duplicate) return NextResponse.json({ duplicate });
    return NextResponse.json({ draft: await draft(body.url, { fetch, resolveHost }) });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not preview that link." }, { status: 500 });
  }
}
