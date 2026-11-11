import { lookup } from "node:dns/promises";
import { CaptureError, draft } from "@hub/capture";
import { NextResponse } from "next/server";
import { acceptLink } from "@/lib/watch/link";
import { findWatchByKey } from "@/lib/watch/store";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 10;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/** POST { url } → a preview (nothing is saved), or the existing item if the link is already saved. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "Paste a link." }, { status: 400 });

  const link = acceptLink(body.url);
  if (!link.ok) return NextResponse.json({ error: link.message }, { status: 400 });

  try {
    const duplicate = await findWatchByKey(await serverClient(), link.key);
    if (duplicate) return NextResponse.json({ duplicate });
    const d = await draft(link.url, { fetch, resolveHost });
    return NextResponse.json({
      preview: { url: link.url, source: link.source, title: d.title, author: d.author, thumb: d.posterUrl, warning: d.errors[0]?.message ?? null },
    });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not preview that link." }, { status: 500 });
  }
}
