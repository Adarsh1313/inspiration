import { lookup } from "node:dns/promises";
import { CaptureError, KINDS, SHELVES, draft, normalise, saveCard, type SaveOverrides } from "@hub/capture";
import { NextResponse } from "next/server";
import { supabaseCardStore } from "@/lib/cards-store";
import { MAX_IMAGE_BYTES, sniffImage } from "@/lib/image";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 15;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

type Payload = { url?: unknown; title?: unknown; description?: unknown; shelf?: unknown; kind?: unknown };

function overridesFrom(p: Payload): SaveOverrides {
  const o: SaveOverrides = {};
  if (typeof p.title === "string" && p.title.trim()) o.title = p.title.slice(0, 200);
  if (typeof p.description === "string") o.description = p.description.slice(0, 2000);
  if (typeof p.shelf === "string" && (SHELVES as readonly string[]).includes(p.shelf)) o.shelf = p.shelf as SaveOverrides["shelf"];
  if (typeof p.kind === "string" && (KINDS as readonly string[]).includes(p.kind)) o.kind = p.kind as SaveOverrides["kind"];
  return o;
}

/**
 * POST multipart: `payload` (JSON: url, optional title/description/shelf/kind) and an optional `image` file.
 * Re-reads the link server-side (the client's preview is never trusted), then saves a draft card.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const raw = form?.get("payload");
  const payload = (typeof raw === "string" ? safeJson(raw) : null) as Payload | null;
  if (typeof payload?.url !== "string") return NextResponse.json({ error: "Paste a link first." }, { status: 400 });

  let image: { bytes: Uint8Array; ext: string; mime: string } | undefined;
  const file = form?.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "That image is over 4 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF image." }, { status: 415 });
    image = { bytes, ...sniffed };
  }

  try {
    // Check the normalised key first so a duplicate costs no network fetches.
    const store = supabaseCardStore(await serverClient());
    const existing = await store.findByKey(normalise(payload.url).canonicalKey);
    if (existing) return NextResponse.json({ duplicate: existing }, { status: 409 });

    const d = await draft(payload.url, { fetch, resolveHost });
    const result = await saveCard(store, { draft: d, overrides: overridesFrom(payload), image });
    if (!result.ok) return NextResponse.json({ duplicate: result.duplicate }, { status: 409 });
    return NextResponse.json({ slug: result.slug }, { status: 201 });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not save that card." }, { status: 500 });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
