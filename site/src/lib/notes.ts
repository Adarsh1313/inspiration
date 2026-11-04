export const NOTE_COLOURS = ["yellow", "pink", "blue", "green", "grey"] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];

export type Note = {
  id: string;
  text: string;
  colour: string;
  tag: string | null;
  pinned: boolean;
  status: "active" | "archived";
  created_at: string;
};

/** Pinned first, then newest first. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
}
