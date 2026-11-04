// Small shared formatters.

/** `2026-03-04` or a full ISO timestamp -> `4 Mar 2026`. Date-only values are read as local dates so the day never shifts. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10)) && iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
