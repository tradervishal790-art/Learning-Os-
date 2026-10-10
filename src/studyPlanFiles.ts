// Turns the learner's chosen files into topics: optional PDF splitting (pdf-lib, on-device)
// and photo grouping. Stores every resulting file in IndexedDB.
import { PDFDocument } from 'pdf-lib';
import { putStudyFile, deleteStudyFile } from './studyFiles';
import { newId } from './studyPlanStore';

export interface NewTopicItem {
  title: string;
  kind: 'pdf' | 'images';
  fileKeys: string[];
}

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

export async function pdfPageCount(file: File): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function buildPdfTopics(file: File, parts: number): Promise<NewTopicItem[]> {
  const name = baseName(file.name);
  if (parts <= 1) {
    const key = newId();
    await putStudyFile(key, file);
    return [{ title: name, kind: 'pdf', fileKeys: [key] }];
  }
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const ranges = splitRanges(src.getPageCount(), parts);
  const items: NewTopicItem[] = [];
  const written: string[] = [];
  try {
    for (let i = 0; i < ranges.length; i++) {
      const [a, b] = ranges[i];
      const out = await PDFDocument.create();
      const idx = Array.from({ length: b - a + 1 }, (_, j) => a + j);
      const pages = await out.copyPages(src, idx);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const key = newId();
      await putStudyFile(key, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      written.push(key);
      items.push({ title: `${name} (pages ${a + 1}-${b + 1})`, kind: 'pdf', fileKeys: [key] });
    }
  } catch (e) {
    await Promise.all(written.map(deleteStudyFile));
    throw e;
  }
  return items;
}

/** mode 'each' = one topic per photo; a number = group all photos evenly into that many topics. */
export async function buildImageTopics(files: File[], mode: 'each' | number, label: string): Promise<NewTopicItem[]> {
  const groups: File[][] =
    mode === 'each'
      ? files.map((f) => [f])
      : splitRanges(files.length, mode).map(([a, b]) => files.slice(a, b + 1));
  const items: NewTopicItem[] = [];
  const written: string[] = [];
  try {
    for (let i = 0; i < groups.length; i++) {
      const keys: string[] = [];
      for (const f of groups[i]) {
        const key = newId();
        await putStudyFile(key, f);
        written.push(key);
        keys.push(key);
      }
      const title = mode === 'each' ? baseName(groups[i][0].name) : `${label} ${i + 1}`;
      items.push({ title, kind: 'images', fileKeys: keys });
    }
  } catch (e) {
    await Promise.all(written.map(deleteStudyFile));
    throw e;
  }
  return items;
}
