import { lookup } from "node:dns/promises";
import { CaptureError, assertPublicUrl, draft } from "@hub/capture";
import { NextResponse } from "next/server";
import { supabaseCardStore } from "@/lib/cards-store";
import { MAX_IMAGE_BYTES, sniffImage } from "@/lib/image";
import { acceptLink } from "@/lib/watch/link";
import { findWatchByKey, insertWatchItem } from "@/lib/watch/store";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 15;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/** X image links expire, so those are copied into private storage. Only twimg.com hosts, only small real images. */
async function fetchXImage(url: string): Promise<{ bytes: Uint8Array; ext: string; mime: string } | null> {
  try {
    const u = assertPublicUrl(url);
    if (u.protocol !== "https:" || !(u.hostname === "twimg.com" || u.hostname.endsWith(".twimg.com"))) return null;
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return null;
    const sniffed = sniffImage(bytes);
    return sniffed ? { bytes, ...sniffed } : null;
  } catch {
    return null;
  }
}

/** POST { url, title? } → re-reads the link server-side (the preview is never trusted) and saves an item with empty notes. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown; title?: unknown } | null;
  if (typeof body?.url !== "string") return NextResponse.json({ error: "Paste a link first." }, { status: 400 });

  const link = acceptLink(body.url);
  if (!link.ok) return NextResponse.json({ error: link.message }, { status: 400 });

  try {
    const supabase = await serverClient();
    const existing = await findWatchByKey(supabase, link.key);
    if (existing) return NextResponse.json({ duplicate: existing }, { status: 409 });

    const d = await draft(link.url, { fetch, resolveHost });
    let thumbUrl: string | null = null;
    let thumbPath: string | null = null;
    if (link.source === "youtube") thumbUrl = d.posterUrl;
    else if (d.posterUrl) {
      const image = await fetchXImage(d.posterUrl);
      if (image) thumbPath = await supabaseCardStore(supabase).uploadImage(image.bytes, image.ext, image.mime);
    }

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : d.title || link.url;
    const result = await insertWatchItem(supabase, {
      source_url: link.url, canonical_key: link.key, source_type: link.source,
      title, author: d.author, thumb_url: thumbUrl, thumb_path: thumbPath,
    });
    if ("duplicate" in result) {
      const dup = await findWatchByKey(supabase, link.key);
      return NextResponse.json({ duplicate: dup }, { status: 409 });
    }
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not save that link." }, { status: 500 });
  }
}
