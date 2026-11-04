import { createHash } from "node:crypto";
import { DuplicateKeyError, type CardStore } from "./save-card";
import { serverClient } from "./supabase";

type Client = Awaited<ReturnType<typeof serverClient>>;

/** CardStore backed by Supabase, as the signed-in owner (RLS applies). */
export function supabaseCardStore(supabase: Client): CardStore {
  return {
    async findByKey(key) {
      const { data, error } = await supabase.from("cards").select("slug,title").eq("canonical_key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async slugsStartingWith(base) {
      const { data, error } = await supabase.from("cards").select("slug").like("slug", `${base}%`);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.slug as string));
    },
    async insertCard(row) {
      const { data, error } = await supabase.from("cards").insert(row).select("id").single();
      if (error) {
        if (error.code === "23505") throw new DuplicateKeyError(error.message.includes("canonical_key") ? "canonical_key" : "slug");
        throw new Error(error.message);
      }
      return { id: data.id as string };
    },
    async queueSteps(cardId, steps) {
      if (steps.length === 0) return;
      const { error } = await supabase.from("capture_tasks").insert(steps.map((step) => ({ card_id: cardId, step })));
      if (error) throw new Error(error.message);
    },
    async uploadImage(bytes, ext, mime) {
      const path = `refs/${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: true });
      if (error) throw new Error(error.message);
      return path;
    },
  };
}
