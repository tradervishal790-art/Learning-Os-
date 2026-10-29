// ============================================================
// conflict.ts — sync conflicts (Part 10). Pure: no storage, no network, no React.
// A note is in conflict when it changed on this device AND on another device since the last sync.
// ============================================================
import type { InkStroke, NotePage, NoteVideo } from './notebookStore';
import type { NoteSnapshot } from './noteTypes';

export interface ConflictInfo {
  local: NoteSnapshot;
  remote: NoteSnapshot;
  /** The note as it was before the two devices split (from version history), when we have it. */
  base?: NoteSnapshot;
}

export type ConflictChoice =
  | { type: 'mine' }
  | { type: 'theirs' }
  | { type: 'merged'; pages: NotePage[]; video?: NoteVideo }
  | { type: 'both' };

/**
 * True when the local copy was edited after the last sync AND the remote changed after it too.
 * An unreadable timestamp means "cannot prove the other side is unchanged", so it counts as a conflict.
 */
export function hasConflict(localEditedAfterSync: boolean, remoteUpdatedAt: string, lastSyncedAt: string): boolean {
  if (!localEditedAfterSync) return false;
  const remote = Date.parse(remoteUpdatedAt);
  const synced = Date.parse(lastSyncedAt);
  if (Number.isNaN(remote) || Number.isNaN(synced)) return true;
  return remote > synced;
}

/**
 * A stroke's identity AND its look: moving, resizing, rotating or recolouring handwriting keeps the stroke id,
 * so the id alone would hide those edits from the conflict check and the other device's copy would win silently.
 */
function strokeFingerprint(s: InkStroke): string {
  let h = 0;
  for (let i = 0; i < s.pts.length; i++) h = (h * 31 + Math.round(s.pts[i] * 10)) | 0;
  return `${s.id}|${s.kind}|${s.color}|${s.width}|${s.pts.length}|${h}`;
}

/** Content signature of a page (ink by stroke id + look; photos by id + position on the page). */
function signature(p: NotePage): string {
  return JSON.stringify([
    p.text,
    p.html ?? '',
    p.template ?? '',
    p.paper ?? '',
    p.bookmarked === true,
    (p.ink ?? []).map(strokeFingerprint),
    (p.attachments ?? []).map((a) => [a.id, a.kind, a.x ?? null, a.y ?? null, a.w ?? null, a.ar ?? null]),
    p.pdf ? [p.pdf.fileId, p.pdf.pageNumber] : null,
  ]);
}

function indexPages(pages: NotePage[]): Map<string, NotePage> {
  const m = new Map<string, NotePage>();
  for (const p of pages) if (!m.has(p.id)) m.set(p.id, p);
  return m;
}

/** Same pages, same order, same content. */
export function pagesEqual(a: NotePage[], b: NotePage[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.id === b[i].id && signature(p) === signature(b[i]));
}

export function videoEqual(a: NoteVideo | undefined, b: NoteVideo | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Page-level three-way merge by page id. Page order follows this device; pages added on the other device are
 * inserted after the page that preceded them there.
 * - only one side changed a page (compared with base) -> that side wins
 * - both changed it differently, or one edited what the other deleted -> conflict; the edited copy stays in `merged`
 * - pages added on either side are kept; deleted on one side and untouched on the other -> deleted
 * - without a base, every page that exists on both sides but differs is a conflict;
 *   a page that exists on one side only counts as added (kept)
 */
export function mergePages(
  local: NoteSnapshot,
  remote: NoteSnapshot,
  base?: NoteSnapshot
): { merged: NotePage[]; conflictingPageIds: string[] } {
  const rMap = indexPages(remote.pages);
  const bMap = base ? indexPages(base.pages) : null;
  const conflicts: string[] = [];
  const addConflict = (id: string): void => {
    if (!conflicts.includes(id)) conflicts.push(id);
  };
  const result: NotePage[] = [];

  for (const lp of local.pages) {
    const rp = rMap.get(lp.id);
    const bp = bMap?.get(lp.id);
    if (!rp) {
      if (bp && signature(lp) === signature(bp)) continue; // deleted there, untouched here -> delete
      if (bp) addConflict(lp.id); // deleted there but edited here
      result.push(lp);
      continue;
    }
    if (signature(lp) === signature(rp)) {
      result.push(lp);
      continue;
    }
    if (!bp) {
      addConflict(lp.id); // differs and nothing to tell who changed it
      result.push(lp);
      continue;
    }
    const sb = signature(bp);
    if (signature(lp) === sb) result.push(rp); // only the other device changed it
    else if (signature(rp) === sb) result.push(lp); // only this device changed it
    else {
      addConflict(lp.id);
      result.push(lp);
    }
  }

  let insertAt = 0;
  for (const rp of remote.pages) {
    const idx = result.findIndex((p) => p.id === rp.id);
    if (idx >= 0) {
      insertAt = idx + 1;
      continue;
    }
    const bp = bMap?.get(rp.id);
    if (bp) {
      // it existed before the split and is gone here: deleted on this device
      if (signature(rp) === signature(bp)) continue; // untouched there -> stays deleted
      addConflict(rp.id); // edited there, deleted here: keep the edited copy, lose nothing
    }
    result.splice(insertAt, 0, rp);
    insertAt++;
  }
  return { merged: result, conflictingPageIds: conflicts };
}

/** The linked video + its moments follow the same rule as pages: one side changed -> that side; both -> conflict. */
export function mergeVideo(
  local: NoteSnapshot,
  remote: NoteSnapshot,
  base?: NoteSnapshot
): { video: NoteVideo | undefined; conflict: boolean } {
  if (videoEqual(local.video, remote.video)) return { video: local.video, conflict: false };
  if (!base) return { video: local.video, conflict: true };
  if (videoEqual(local.video, base.video)) return { video: remote.video, conflict: false };
  if (videoEqual(remote.video, base.video)) return { video: local.video, conflict: false };
  return { video: local.video, conflict: true };
}

/** True when "Merge" may be offered: nothing was edited on both devices. */
export function canMerge(local: NoteSnapshot, remote: NoteSnapshot, base?: NoteSnapshot): boolean {
  return mergePages(local, remote, base).conflictingPageIds.length === 0 && !mergeVideo(local, remote, base).conflict;
}

/** A deep copy of the other device's note as a NEW note: title "<title> (other device)", new note id, new page ids. */
export function keepBothCopy(remote: NoteSnapshot, newId: () => string): NoteSnapshot {
  const pages = remote.pages.map((p) => {
    const copy: NotePage = { ...p, id: newId() };
    if (p.ink) copy.ink = p.ink.map((s) => ({ ...s, pts: s.pts.slice() }));
    if (p.attachments) copy.attachments = p.attachments.map((a) => ({ ...a }));
    return copy;
  });
  const out: NoteSnapshot = { id: newId(), title: `${remote.title} (other device)`, pages, updatedAt: remote.updatedAt };
  if (remote.video) out.video = JSON.parse(JSON.stringify(remote.video)) as NoteVideo;
  return out;
}
