import { lookup } from "node:dns/promises";
import { CaptureError, jobDraft, jobFromText } from "@hub/capture";
import { NextResponse } from "next/server";
import { jobIdentity, readJobInput } from "@/lib/job-input";
import { findJobByKey } from "@/lib/jobs-store";
import { serverClient } from "@/lib/supabase";

export const maxDuration = 10;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/** POST { url?, text? } → the preview JobDraft (nothing is saved), or the existing posting if it is a duplicate. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown; text?: unknown } | null;
  const { url, text } = readJobInput(body);
  if (!url && !text) return NextResponse.json({ error: "Paste a posting link, or the posting text." }, { status: 400 });

  try {
    const supabase = await serverClient();
    const link = jobIdentity({ url, text })?.link;
    // A link alone: check for a duplicate before fetching anything.
    if (link && !text) {
      const duplicate = await findJobByKey(supabase, link.canonicalKey);
      if (duplicate) return NextResponse.json({ duplicate });
    }
    const draft = text ? jobFromText(text, link) : await jobDraft(url, { fetch, resolveHost });
    const duplicate = await findJobByKey(supabase, draft.canonicalKey);
    if (duplicate) return NextResponse.json({ duplicate });
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not preview that posting." }, { status: 500 });
  }
}
