import { PDFDocument } from 'pdf-lib';

export const A4 = { w: 595.28, h: 841.89 };

/** Packs JPEG pictures into an A4 PDF, one picture per page, top-aligned. Pure (tests/export-note-pdf.test.mjs). */
export async function buildPdfFromJpegs(jpegs: { bytes: Uint8Array; heightRatio: number }[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title || 'Note');
  doc.setProducer('Learning OS');
  for (const j of jpegs) {
    const page = doc.addPage([A4.w, A4.h]);
    const img = await doc.embedJpg(j.bytes);
    const h = Math.min(A4.h, A4.w * j.heightRatio);
    page.drawImage(img, { x: 0, y: A4.h - h, width: A4.w, height: h });
  }
  return doc.save();
}
