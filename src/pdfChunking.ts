/** Split a PDF into ordered chunks bounded by byte size and page count.
 * Passing maxPagesPerChunk=1 enables incremental page-at-a-time extraction. */
export async function splitPdfIntoChunks(
  bytes: Uint8Array,
  maxBytes: number,
  maxPages: number,
  maxPagesPerChunk = maxPages,
): Promise<Uint8Array[]> {
  const { PDFDocument } = await import('pdf-lib');
  let source;
  try { source = await PDFDocument.load(bytes); }
  catch { throw new Error('Could not open this PDF — it may be password-protected or damaged.'); }
  const pageCount = source.getPageCount();
  if (pageCount > maxPages) throw new Error(`This PDF has ${pageCount} pages — the limit is ${maxPages} per PDF. Split it and upload in parts.`);
  if (bytes.length <= maxBytes && pageCount <= maxPagesPerChunk) return [bytes];

  const pageSizes: number[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const one = await PDFDocument.create();
    const [page] = await one.copyPages(source, [index]);
    one.addPage(page);
    const size = (await one.save()).length;
    if (size > maxBytes) throw new Error(`Page ${index + 1} of this PDF is too large — try a lower-quality scan.`);
    pageSizes.push(size);
  }
  const groups: number[][] = [];
  let current: number[] = [];
  let currentBytes = 0;
  pageSizes.forEach((size, index) => {
    if (current.length > 0 && (currentBytes + size > maxBytes || current.length >= maxPagesPerChunk)) {
      groups.push(current); current = []; currentBytes = 0;
    }
    current.push(index); currentBytes += size;
  });
  if (current.length > 0) groups.push(current);
  const chunks: Uint8Array[] = [];
  for (const indices of groups) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(source, indices);
    pages.forEach((page) => out.addPage(page));
    chunks.push(await out.save());
  }
  return chunks;
}
