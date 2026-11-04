// Validates the inline card editor's form. Pure, so the server action stays thin.
import type { Shelf } from "@hub/capture";
import { capitalise } from "./format";
import { MOOD_KEYS, isShelf, type MoodKey } from "./gallery";

export type CardEdit = {
  title: string;
  summary: string;
  shelf: Shelf;
  tags: string[];
  /** A dial left blank is `null`, which removes it from the card. */
  mood: Record<MoodKey, number | null>;
};

export type CardEditInput = { title?: string; summary?: string; shelf?: string; tags?: string; variance?: string; motion?: string; density?: string };

export type CardEditResult = { ok: true; value: CardEdit } | { ok: false; error: string };

const MAX_TAGS = 20;

export function parseCardEdit(input: CardEditInput): CardEditResult {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "A card needs a title." };
  if (title.length > 200) return { ok: false, error: "Keep the title under 200 characters." };

  const summary = (input.summary ?? "").trim();
  if (summary.length > 2000) return { ok: false, error: "Keep the summary under 2,000 characters." };

  const shelf = input.shelf ?? "";
  if (!isShelf(shelf)) return { ok: false, error: "Pick a shelf." };

  const tags = [...new Set((input.tags ?? "").split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return { ok: false, error: `Use at most ${MAX_TAGS} tags.` };
  if (tags.some((t) => t.length > 40)) return { ok: false, error: "Keep each tag under 40 characters." };

  const mood = {} as CardEdit["mood"];
  for (const key of MOOD_KEYS) {
    const raw = (input[key] ?? "").trim();
    if (raw === "") {
      mood[key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 10) return { ok: false, error: `${capitalise(key)} is a whole number from 1 to 10.` };
    mood[key] = n;
  }

  return { ok: true, value: { title, summary, shelf, tags, mood } };
}

/** Applies the edited dials to the stored mood, keeping any extra keys that were added later. */
export function mergeMood(existing: Record<string, unknown>, edit: CardEdit["mood"]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const key of MOOD_KEYS) {
    if (edit[key] == null) delete out[key];
    else out[key] = edit[key];
  }
  return out;
}
