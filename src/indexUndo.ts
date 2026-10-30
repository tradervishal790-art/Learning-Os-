// ============================================================
// indexUndo.ts — "Undo" for the notes library that only reverts WHAT ONE ACTION CHANGED.
// The old Undo restored a snapshot of the whole library, so anything the student (or another device's
// sync) changed in the few seconds after the action was rolled back too.
// Pure functions, no browser APIs — see tests/index-undo.test.mjs.
// ============================================================

interface Row { id: string; updatedAt: string }
interface IndexLike<N extends Row, F extends Row> {
  notes: N[];
  folders: F[];
  deleted: Record<string, string>;
}

/** The rows an action touched, as they were BEFORE it. `null` = the action created that row. */
export interface IndexUndo<N extends Row, F extends Row> {
  notes: Record<string, N | null>;
  folders: Record<string, F | null>;
  /** ids the action added to the permanently-deleted list. */
  undelete: string[];
}

function diffRows<T extends Row>(before: T[], after: T[]): Record<string, T | null> {
  const out: Record<string, T | null> = {};
  const afterById = new Map(after.map((r) => [r.id, r]));
  const beforeIds = new Set<string>();
  for (const b of before) {
    beforeIds.add(b.id);
    const a = afterById.get(b.id);
    if (!a || JSON.stringify(a) !== JSON.stringify(b)) out[b.id] = b;
  }
  for (const a of after) if (!beforeIds.has(a.id)) out[a.id] = null;
  return out;
}

export function captureUndo<N extends Row, F extends Row>(before: IndexLike<N, F>, after: IndexLike<N, F>): IndexUndo<N, F> {
  return {
    notes: diffRows(before.notes, after.notes),
    folders: diffRows(before.folders, after.folders),
    undelete: Object.keys(after.deleted).filter((id) => !(id in before.deleted)),
  };
}

export function isEmptyUndo<N extends Row, F extends Row>(u: IndexUndo<N, F>): boolean {
  return Object.keys(u.notes).length === 0 && Object.keys(u.folders).length === 0 && u.undelete.length === 0;
}

function revert<T extends Row>(current: T[], changes: Record<string, T | null>, stamp: string): T[] {
  const ids = Object.keys(changes);
  if (ids.length === 0) return current;
  const next = current.filter((r) => !(r.id in changes)); // drop rows the action created, and the changed copies of the rest
  for (const id of ids) {
    const row = changes[id];
    if (row) next.push({ ...row, updatedAt: stamp }); // stamped "now" so the undo wins the newest-wins cloud merge
  }
  return next; // the library list is sorted by the screen, so row order here does not matter
}

/** Apply an undo to the CURRENT index; rows the action did not touch are left exactly as they are now. */
export function applyUndo<N extends Row, F extends Row, I extends IndexLike<N, F>>(current: I, u: IndexUndo<N, F>, stamp: string): I {
  const deleted = { ...current.deleted };
  for (const id of u.undelete) delete deleted[id];
  return { ...current, notes: revert(current.notes, u.notes, stamp), folders: revert(current.folders, u.folders, stamp), deleted };
}
