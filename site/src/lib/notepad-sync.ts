// Pure decisions for notepad sync. The component does the I/O.

export type LocalDraft = { text: string; baseRev: number; dirty: boolean };
export type Server = { text: string; rev: number };
export type NotepadState = { text: string; rev: number; dirty: boolean; archive?: string };

/** Open the page: reconcile an offline draft (if any) with the server row. */
export function onLoad(local: LocalDraft | null, server: Server): NotepadState {
  if (!local || !local.dirty) return { text: server.text, rev: server.rev, dirty: false };
  if (local.baseRev === server.rev) return { text: local.text, rev: server.rev, dirty: true };
  return adoptServer(local.text, server);
}

/** A realtime update arrived. Returns the new state, or null to ignore it. */
export function onRemote(current: { text: string; rev: number; dirty: boolean }, remote: Server): NotepadState | null {
  if (remote.rev <= current.rev) return null;
  if (current.dirty) return null; // the next save fails the rev check and archives our copy
  return { text: remote.text, rev: remote.rev, dirty: false };
}

/** Result of the compare-and-set save. */
export function onSaveResult(sent: string, result: { ok: boolean; text: string; rev: number }): NotepadState {
  if (result.ok) return { text: result.text, rev: result.rev, dirty: false };
  return adoptServer(sent, result);
}

function adoptServer(mine: string, server: Server): NotepadState {
  const state: NotepadState = { text: server.text, rev: server.rev, dirty: false };
  if (mine !== server.text) state.archive = mine;
  return state;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}
