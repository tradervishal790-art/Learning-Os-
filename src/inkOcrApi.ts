import { authFetch } from './apiFetch';

export interface InkOcrResult {
  text: string;
  confidence: 'high' | 'medium' | 'low';
}

/** Send a PNG (base64, no prefix) of selected handwriting to be read as typed text. */
export function recognizeHandwriting(pngBase64: string): Promise<InkOcrResult> {
  return readImage(pngBase64, 'image/png');
}

/** Send a picture from a note (JPEG, base64, no prefix): its writing is copied and what it shows is described in a few words. */
export function describePicture(jpegBase64: string): Promise<InkOcrResult> {
  return readImage(jpegBase64, 'image/jpeg', 'photo');
}

async function readImage(data: string, mimeType: string, kind?: 'photo'): Promise<InkOcrResult> {
  const response = await authFetch('/api/extract-questions?op=ink-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { mimeType, data }, ...(kind ? { kind } : {}) }),
  });
  if (!response.ok) {
    let message = '';
    try {
      message = (await response.json())?.error ?? '';
    } catch {
      // not JSON
    }
    throw new Error(message || `HTTP ${response.status}`);
  }
  const body = (await response.json()) as Partial<InkOcrResult>;
  return {
    text: typeof body.text === 'string' ? body.text : '',
    confidence: body.confidence === 'high' || body.confidence === 'medium' ? body.confidence : 'low',
  };
}
