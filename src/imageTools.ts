export type ImageErrorCode = 'too-large' | 'not-image' | 'decode-failed' | 'unsupported';

export class ImageError extends Error {
  readonly code: ImageErrorCode;
  constructor(code: ImageErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ImageError';
    this.code = code;
    Object.setPrototypeOf(this, ImageError.prototype);
  }
}

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const SCAN_MAX_SIDE = 3000;

/* ---------- pure helpers ---------- */

export function fitWithin(w: number, h: number, maxSide: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0) || !(maxSide > 0)) return { width: 0, height: 0 };
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: Math.round(w), height: Math.round(h) };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export function rotatedSize(w: number, h: number, deg: 0 | 90 | 180 | 270): { width: number; height: number } {
  return deg === 90 || deg === 270 ? { width: h, height: w } : { width: w, height: h };
}

export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  if (i === 0) return `${Math.round(bytes)} B`;
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

/* ---------- header probe (so huge images are rejected BEFORE decoding) ---------- */

function probeDimensions(b: Uint8Array): { width: number; height: number } | null {
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { width: u32(16), height: u32(20) };
  }
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }
  if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) { // RIFF....WEBP
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tag === 'VP8X') {
      return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
    if (tag === 'VP8L') {
      return {
        width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      };
    }
    if (tag === 'VP8 ') {
      return { width: ((b[27] << 8) | b[26]) & 0x3fff, height: ((b[29] << 8) | b[28]) & 0x3fff };
    }
  }
  return null;
}

/* ---------- canvas plumbing ---------- */

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Surface {
  readonly width: number;
  readonly height: number;
  readonly ctx: Ctx2D;
  toBlob(mime: string, quality?: number): Promise<Blob>;
}

function createSurface(width: number, height: number, readback = false): Surface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined);
      if (ctx) {
        return { width: w, height: h, ctx, toBlob: (mime, quality) => canvas.convertToBlob({ type: mime, quality }) };
      }
    } catch {
      /* fall back to a DOM canvas */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new ImageError('unsupported', 'Canvas 2D is not available');
  return {
    width: w,
    height: h,
    ctx,
    toBlob: (mime, quality) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new ImageError('decode-failed', 'Could not encode the image'))),
          mime,
          quality,
        ),
      ),
  };
}

async function encode(s: Surface, mime: string, quality?: number): Promise<Blob> {
  let blob = await s.toBlob(mime, quality);
  if (blob.type !== mime && mime === 'image/webp') blob = await s.toBlob('image/jpeg', quality); // browser lacks WebP encoding
  if (blob.size === 0) throw new ImageError('decode-failed', 'Could not encode the image');
  return blob;
}

function fillWhite(s: Surface): void {
  s.ctx.fillStyle = '#ffffff';
  s.ctx.fillRect(0, 0, s.width, s.height);
}

/* ---------- decoding ---------- */

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

function decodeError(mime: string): ImageError {
  return /heic|heif|tiff?/i.test(mime)
    ? new ImageError('unsupported', 'This image format is not supported by the browser')
    : new ImageError('decode-failed', 'The image could not be decoded');
}

function checkPixels(w: number, h: number): void {
  if (w * h > MAX_PIXELS) throw new ImageError('too-large', 'Image has too many pixels');
}

async function decodeWithImgElement(blob: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
  } catch {
    URL.revokeObjectURL(url);
    throw decodeError(blob.type);
  }
  // Modern browsers apply EXIF orientation to <img> by default (image-orientation: from-image).
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw decodeError(blob.type);
  }
  try {
    checkPixels(width, height);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { source: img, width, height, release: () => { URL.revokeObjectURL(url); img.src = ''; } };
}

async function decodeImage(blob: Blob): Promise<Decoded> {
  const type = (blob.type || '').toLowerCase();
  if (type && !type.startsWith('image/')) throw new ImageError('not-image', 'The file is not an image');
  if (type.includes('svg')) throw new ImageError('unsupported', 'SVG images are not supported');
  if (blob.size > MAX_BYTES) throw new ImageError('too-large', `Image is larger than ${humanSize(MAX_BYTES)}`);
  if (blob.size === 0) throw new ImageError('decode-failed', 'The image is empty');

  const head = new Uint8Array(await blob.slice(0, 1 << 20).arrayBuffer());
  const dims = probeDimensions(head);
  if (!type && !dims) throw new ImageError('not-image', 'The file is not an image');
  if (dims) checkPixels(dims.width, dims.height);

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      try {
        checkPixels(bmp.width, bmp.height);
      } catch (e) {
        bmp.close();
        throw e;
      }
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch (e) {
      if (e instanceof ImageError) throw e;
      /* fall back to <img> */
    }
  }
  return decodeWithImgElement(blob);
}

/* ---------- public API ---------- */

export async function compressImage(
  file: File | Blob,
  opts?: { maxSide?: number; quality?: number; mime?: 'image/jpeg' | 'image/webp' },
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxSide = Math.min(8192, Math.max(16, opts?.maxSide ?? 1600));
  const quality = Math.min(1, Math.max(0.1, opts?.quality ?? 0.82));
  const mime = opts?.mime ?? 'image/jpeg';
  const d = await decodeImage(file);
  try {
    const size = fitWithin(d.width, d.height, maxSide);
    const s = createSurface(size.width, size.height);
    fillWhite(s);
    s.ctx.imageSmoothingEnabled = true;
    s.ctx.imageSmoothingQuality = 'high';
    s.ctx.drawImage(d.source, 0, 0, s.width, s.height);
    const blob = await encode(s, mime, quality);
    return { blob, width: s.width, height: s.height };
  } finally {
    d.release();
  }
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export async function cropRotateFlip(
  blob: Blob,
  o: { crop?: { x: number; y: number; w: number; h: number }; rotate?: 0 | 90 | 180 | 270; flipX?: boolean; flipY?: boolean },
): Promise<Blob> {
  const d = await decodeImage(blob);
  try {
    const sw = d.width;
    const sh = d.height;
    const c = o.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const cx = Math.min(sw - 1, Math.round(clamp01(c.x) * sw));
    const cy = Math.min(sh - 1, Math.round(clamp01(c.y) * sh));
    const cw = Math.max(1, Math.min(sw - cx, Math.round(clamp01(c.w) * sw)));
    const ch = Math.max(1, Math.min(sh - cy, Math.round(clamp01(c.h) * sh)));
    const rot = o.rotate ?? 0;
    const out = rotatedSize(cw, ch, rot);
    const type = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
    const s = createSurface(out.width, out.height);
    if (type === 'image/jpeg') fillWhite(s);

    // exact matrix: flip in image space first, then rotate about the centre
    const cos = rot === 0 ? 1 : rot === 180 ? -1 : 0;
    const sin = rot === 90 ? 1 : rot === 270 ? -1 : 0;
    const fx = o.flipX ? -1 : 1;
    const fy = o.flipY ? -1 : 1;
    s.ctx.setTransform(cos * fx, sin * fx, -sin * fy, cos * fy, out.width / 2, out.height / 2);
    s.ctx.drawImage(d.source, cx, cy, cw, ch, -cw / 2, -ch / 2, cw, ch);
    s.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return await encode(s, type, 0.92);
  } finally {
    d.release();
  }
}

export async function scanFilter(blob: Blob, mode: 'bw' | 'gray' | 'boost'): Promise<Blob> {
  const d = await decodeImage(blob);
  try {
    const size = fitWithin(d.width, d.height, SCAN_MAX_SIDE); // bounds memory of the integral image
    const s = createSurface(size.width, size.height, true);
    fillWhite(s);
    s.ctx.imageSmoothingQuality = 'high';
    s.ctx.drawImage(d.source, 0, 0, s.width, s.height);
    const img = s.ctx.getImageData(0, 0, s.width, s.height);
    const px = img.data;
    const w = s.width;
    const h = s.height;
    const luma = (i: number): number => Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);

    if (mode === 'gray') {
      for (let i = 0; i < px.length; i += 4) {
        const g = luma(i);
        px[i] = px[i + 1] = px[i + 2] = g;
      }
    } else if (mode === 'boost') {
      // per-channel linear stretch between the 1st and 85th luminance percentile: whitens paper, deepens ink, keeps colour
      const hist = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) hist[luma(i)]++;
      const total = w * h;
      const percentile = (p: number): number => {
        let acc = 0;
        for (let v = 0; v < 256; v++) {
          acc += hist[v];
          if (acc >= total * p) return v;
        }
        return 255;
      };
      const lo = percentile(0.01);
      const hi = Math.max(lo + 16, percentile(0.85));
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) lut[v] = Math.round(((v - lo) * 255) / (hi - lo));
      for (let i = 0; i < px.length; i += 4) {
        px[i] = lut[px[i]];
        px[i + 1] = lut[px[i + 1]];
        px[i + 2] = lut[px[i + 2]];
      }
    } else {
      // adaptive threshold (Bradley): a pixel is ink only if clearly darker than its LOCAL mean, so soft shadows stay white
      const gray = new Uint8Array(w * h);
      for (let p = 0, i = 0; p < gray.length; p++, i += 4) gray[p] = luma(i);
      const W = w + 1;
      const integral = new Float64Array(W * (h + 1));
      for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) {
          row += gray[y * w + x];
          integral[(y + 1) * W + x + 1] = integral[y * W + x + 1] + row;
        }
      }
      const r = Math.max(7, Math.round(Math.min(w, h) / 16));
      const T = 0.12;
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(h - 1, y + r);
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - r);
          const x1 = Math.min(w - 1, x + r);
          const area = (x1 - x0 + 1) * (y1 - y0 + 1);
          const sum = integral[(y1 + 1) * W + x1 + 1] - integral[y0 * W + x1 + 1] - integral[(y1 + 1) * W + x0] + integral[y0 * W + x0];
          const v = gray[y * w + x] < (sum / area) * (1 - T) ? 0 : 255;
          const i = (y * w + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = v;
        }
      }
    }
    s.ctx.putImageData(img, 0, 0);
    return await (mode === 'bw' ? encode(s, 'image/png') : encode(s, 'image/jpeg', 0.9));
  } finally {
    d.release();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => (typeof r.result === 'string' ? resolve(r.result) : reject(new Error('Could not read the file')));
    r.onerror = () => reject(r.error ?? new Error('Could not read the file'));
    r.readAsDataURL(blob);
  });
}
