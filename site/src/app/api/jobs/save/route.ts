import { CaptureError, contentKey, jobKey } from "@hub/capture";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { supabaseCardStore } from "@/lib/cards-store";
import { MAX_IMAGE_BYTES, sniffImage } from "@/lib/image";
import { parseJobFields } from "@/lib/jobs";
import { findJobByKey, insertJob } from "@/lib/jobs-store";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 15;

type Payload = { url?: unknown; text?: unknown; company?: unknown; role?: unknown; location?: unknown; postedAt?: unknown };
const MAX_TEXT = 20_000;

/**
 * POST multipart: `payload` (JSON: url and/or text, plus the company, role, location and postedAt as edited on the preview)
 * and an optional `image` file. A posting needs a link, pasted text or a screenshot to be saved.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const raw = form?.get("payload");
  let payload: Payload | null = null;
  try {
    payload = typeof raw === "string" ? (JSON.parse(raw) as Payload) : null;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ error: "Paste a posting first." }, { status: 400 });

  const fields = parseJobFields(payload);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, MAX_TEXT) : "";

  let image: { bytes: Uint8Array; ext: string; mime: string } | undefined;
  const file = form?.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "That image is over 4 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF image." }, { status: 415 });
    image = { bytes, ...sniffed };
  }
  if (!url && !text && !image) return NextResponse.json({ error: "Add a link, the posting text or a screenshot." }, { status: 400 });

  try {
    const supabase = await serverClient();
    const link = url ? jobKey(url) : undefined;
    const key = link?.canonicalKey ?? (text ? contentKey(text) : contentKey(image!.bytes));

    const existing = await findJobByKey(supabase, key);
    if (existing) return NextResponse.json({ duplicate: existing }, { status: 409 });

    const screenshot = image ? await supabaseCardStore(supabase).uploadImage(image.bytes, image.ext, image.mime) : null;
    const saved = await insertJob(supabase, {
      source_url: link?.canonicalUrl ?? null,
      canonical_key: key,
      company: fields.value.company,
      role: fields.value.role,
      location: fields.value.location,
      posted_at: fields.value.postedAt,
      raw_text: text || null,
      screenshot,
    });
    if (!saved) {
      const raced = await findJobByKey(supabase, key);
      return NextResponse.json({ duplicate: raced ?? { id: "", label: "a saved posting" } }, { status: 409 });
    }
    revalidatePath("/", "layout");
    return NextResponse.json({ id: saved.id }, { status: 201 });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not save that posting. Try again." }, { status: 500 });
  }
}
