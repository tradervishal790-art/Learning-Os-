// On-device PDF splitting (pdf-lib) + helpers for storing a box's files in IndexedDB.
import { PDFDocument } from 'pdf-lib';
import { putStudyFile, deleteStudyFile } from './studyFiles';
import { newId, type StudyFile } from './studyPlanStore';

export const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
const baseName = (n: string) => n.replace(/\.[^.]+$/, '');

/** Splits `total` pages into `parts` nearly-equal consecutive ranges, e.g. 50/4 -> 13,13,12,12. */
export function splitRanges(total: number, parts: number): [number, number][] {
  const k = Math.max(1, Math.min(parts, total));
  const base = Math.floor(total / k);
  const extra = total % k;
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push([start, start + size - 1]);
    start += size;
  }
  return out;
}

/** Stores the chosen photos/PDFs and returns them as box files. Cleans up if anything fails. */
export async function storeFiles(files: File[]): Promise<StudyFile[]> {
  const out: StudyFile[] = [];
  try {
    for (const f of files) {
      const key = newId();
      await putStudyFile(key, f);
      out.push({ key, name: f.name, kind: isPdf(f) ? 'pdf' : 'image' });
    }
  } catch (e) {
    await Promise.all(out.map((o) => deleteStudyFile(o.key)));
    throw e;
  }
  return out;
}

/** Splits one stored PDF into `parts` new stored PDFs (one StudyFile per part). Caller deletes the original. */
export async function splitPdfBlob(blob: Blob, name: string, parts: number): Promise<StudyFile[]> {
  const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const ranges = splitRanges(src.getPageCount(), parts);
  const out: StudyFile[] = [];
  try {
    for (const [a, b] of ranges) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, Array.from({ length: b - a + 1 }, (_, j) => a + j));
      pages.forEach((p) => doc.addPage(p));
      const bytes = await doc.save();
      const key = newId();
      await putStudyFile(key, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      out.push({ key, name: `${baseName(name)} (pages ${a + 1}-${b + 1}).pdf`, kind: 'pdf' });
    }
  } catch (e) {
    await Promise.all(out.map((o) => deleteStudyFile(o.key)));
    throw e;
  }
  return out;
}
