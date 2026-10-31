// ============================================================
// fileSweep.ts — frees the space of photos, recordings and PDFs that no note uses any more.
// Removing a photo, deleting a page or emptying the trash only removes the note's REFERENCE to the file (the file
// stays so Undo and old versions keep working). Without this clean-up those files would fill the device forever.
//
// Safety rules (a file the student can still reach is never deleted):
//   * a file counts as used if ANY note (trash included) or ANY saved version of a note still points to it;
//   * a file younger than 7 days is never touched (covers Undo, a page being written, a note still syncing in);
//   * if any note or its versions cannot be read, NOTHING is deleted.
// ============================================================
import { deleteImage, deletePdf, listImages, listPdfs } from './attachStore';
import { deleteAudio, listAudioMeta } from './audioStore';
import { getIndex, getNoteSnapshot, type NotePage } from './notebookStore';
import { getVersion, listVersions } from './noteVersions';

export const SWEEP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_KEY = 'learning_os_file_sweep_at';

export interface FileRefs {
  images: Set<string>;
  audio: Set<string>;
  pdfs: Set<string>;
}

export const emptyRefs = (): FileRefs => ({ images: new Set(), audio: new Set(), pdfs: new Set() });

export function collectRefs(pages: NotePage[], into: FileRefs): void {
  for (const p of pages) {
    for (const a of p.attachments ?? []) (a.kind === 'audio' ? into.audio : into.images).add(a.id);
    if (p.pdf) into.pdfs.add(p.pdf.fileId);
  }
}

/** Ids of files nobody uses and that are older than the grace period. An unreadable date means "keep". */
export function pickOrphans(files: { id: string; createdAt: string }[], used: Set<string>, now: number, grace = SWEEP_GRACE_MS): string[] {
  return files
    .filter((f) => {
      if (used.has(f.id)) return false;
      const made = Date.parse(f.createdAt);
      return Number.isFinite(made) && now - made > grace;
    })
    .map((f) => f.id);
}

/** Every file reference of every note and saved version, or null when something could not be read. */
async function allRefs(): Promise<FileRefs | null> {
  const refs = emptyRefs();
  for (const m of getIndex().notes) {
    const snap = await getNoteSnapshot(m.id).catch(() => null);
    if (!snap) return null;
    collectRefs(snap.pages, refs);
    const versions = await listVersions(m.id).catch(() => null);
    if (!versions) return null;
    for (const v of versions) {
      const data = await getVersion(v.key).catch(() => null);
      if (!data) return null;
      collectRefs(data.pages, refs);
    }
  }
  return refs;
}

export async function sweepOrphanFiles(now = Date.now()): Promise<{ removed: number; bytes: number } | null> {
  try {
    const refs = await allRefs();
    if (!refs) return null;
    const [images, pdfs, audio] = await Promise.all([listImages(), listPdfs(), listAudioMeta()]);
    let removed = 0;
    let bytes = 0;
    const size = new Map<string, number>([...images, ...pdfs].map((f) => [f.id, f.size]));
    for (const a of audio) size.set(a.id, a.size);
    for (const id of pickOrphans(images, refs.images, now)) { await deleteImage(id); removed += 1; bytes += size.get(id) ?? 0; }
    for (const id of pickOrphans(pdfs, refs.pdfs, now)) { await deletePdf(id); removed += 1; bytes += size.get(id) ?? 0; }
    for (const id of pickOrphans(audio, refs.audio, now)) { await deleteAudio(id); removed += 1; bytes += size.get(id) ?? 0; }
    return { removed, bytes };
  } catch {
    return null;
  }
}

/** At most once a day, when the browser is idle (called when the library opens). */
export function sweepOrphanFilesDaily(): void {
  try {
    const last = Number(window.localStorage.getItem(LAST_KEY) ?? 0);
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    const run = () => {
      window.localStorage.setItem(LAST_KEY, String(Date.now()));
      void sweepOrphanFiles();
    };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 15_000 });
    else setTimeout(run, 8_000);
  } catch {
    /* storage unavailable: skip */
  }
}
