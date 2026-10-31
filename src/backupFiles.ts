// ============================================================
// backupFiles.ts — a backup that ALSO carries the photos, recordings and imported PDFs.
// A plain backup (.json) only holds the notes; the files live in this browser. When any note uses files, the backup
// becomes a .zip:  notes.json  +  files/manifest.json  +  files/images|pdfs|audio/<id>.
// Restoring puts the files back under the same ids, so every page finds its photo / recording / PDF again.
// Never overwrites a file that is already on the device.
// ============================================================
import { getImage, getImageName, getPdf, getPdfName, putImage, putPdf } from './attachStore';
import { getAudio, putAudio } from './audioStore';
import { collectRefs, emptyRefs } from './fileSweep';
import type { NotePage } from './notebookStore';
import { readZip } from './zipStore';

/** A backup this large is saved without files (the browser cannot hold it in memory to zip it). */
export const MAX_BACKUP_FILE_BYTES = 600 * 1024 * 1024;

type Kind = 'images' | 'pdfs' | 'audio';
interface ManifestEntry { kind: Kind; id: string; name: string; mime: string; durationSec?: number; bookmarks?: number[]; createdAt?: string }
export interface PackedFiles { entries: { name: string; data: Uint8Array }[]; count: number; tooBig: boolean }

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Read every file the notes point to. Missing files (added on another device) are simply left out. */
export async function packFiles(pages: NotePage[]): Promise<PackedFiles> {
  const refs = emptyRefs();
  collectRefs(pages, refs);
  const manifest: ManifestEntry[] = [];
  const entries: { name: string; data: Uint8Array }[] = [];
  let total = 0;
  const add = async (kind: Kind, id: string, blob: Blob, meta: Omit<ManifestEntry, 'kind' | 'id' | 'mime'>): Promise<boolean> => {
    total += blob.size;
    if (total > MAX_BACKUP_FILE_BYTES) return false;
    entries.push({ name: `files/${kind}/${id}`, data: new Uint8Array(await blob.arrayBuffer()) });
    manifest.push({ kind, id, mime: blob.type, ...meta });
    return true;
  };
  for (const id of refs.images) {
    const blob = await getImage(id).catch(() => null);
    if (blob && !(await add('images', id, blob, { name: (await getImageName(id)) ?? id }))) return { entries: [], count: 0, tooBig: true };
  }
  for (const id of refs.pdfs) {
    const blob = await getPdf(id).catch(() => null);
    if (blob && !(await add('pdfs', id, blob, { name: (await getPdfName(id)) ?? id }))) return { entries: [], count: 0, tooBig: true };
  }
  for (const id of refs.audio) {
    const clip = await getAudio(id).catch(() => null);
    if (clip && !(await add('audio', id, clip.blob, { name: id, durationSec: clip.meta.durationSec, bookmarks: clip.meta.bookmarks, createdAt: clip.meta.createdAt }))) {
      return { entries: [], count: 0, tooBig: true };
    }
  }
  entries.push({ name: 'files/manifest.json', data: enc.encode(JSON.stringify(manifest)) });
  return { entries, count: manifest.length, tooBig: false };
}

/** Is this file one of our "backup with files" zips? (Looks at the first bytes, not the name.) */
export const looksLikeZip = (bytes: Uint8Array): boolean => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

/** Split a backup zip into the notes text and the file entries; null when it is not a backup of ours. */
export function openBackupZip(bytes: Uint8Array): { notesJson: string; files: { name: string; data: Uint8Array }[] } | null {
  const all = readZip(bytes);
  if (!all) return null;
  const notes = all.find((e) => e.name === 'notes.json');
  if (!notes) return null;
  return { notesJson: dec.decode(notes.data), files: all.filter((e) => e.name.startsWith('files/')) };
}

/** Put the files back. Returns how many were restored (files already on this device are kept as they are). */
export async function restoreFiles(files: { name: string; data: Uint8Array }[]): Promise<number> {
  const manifestEntry = files.find((f) => f.name === 'files/manifest.json');
  if (!manifestEntry) return 0;
  let manifest: ManifestEntry[];
  try {
    const parsed: unknown = JSON.parse(dec.decode(manifestEntry.data));
    if (!Array.isArray(parsed)) return 0;
    manifest = parsed as ManifestEntry[];
  } catch {
    return 0;
  }
  const byName = new Map(files.map((f) => [f.name, f.data]));
  let restored = 0;
  for (const m of manifest) {
    if (!m || typeof m.id !== 'string' || !['images', 'pdfs', 'audio'].includes(m.kind)) continue;
    const data = byName.get(`files/${m.kind}/${m.id}`);
    if (!data) continue;
    const blob = new Blob([data as BlobPart], { type: typeof m.mime === 'string' ? m.mime : '' });
    const name = typeof m.name === 'string' ? m.name : m.id;
    try {
      if (m.kind === 'images') {
        if (await getImage(m.id)) continue;
        await putImage(m.id, blob, name);
      } else if (m.kind === 'pdfs') {
        if (await getPdf(m.id)) continue;
        await putPdf(m.id, blob, name);
      } else {
        if (await getAudio(m.id)) continue;
        await putAudio(m.id, blob, {
          durationSec: Number(m.durationSec) || 0,
          bookmarks: Array.isArray(m.bookmarks) ? m.bookmarks.filter((b) => typeof b === 'number') : [],
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
          mime: blob.type || undefined,
        });
      }
      restored += 1;
    } catch {
      /* storage full: keep going with the rest */
    }
  }
  return restored;
}
