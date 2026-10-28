import type { PageAttachment } from './notebookStore';
import { getImage, newAttachId, putImage } from './attachStore';
import { getAudio, putAudio } from './audioStore';

/**
 * Copy an attachment's file under a new id, so the copy (of a page or a whole note) owns its own file:
 * removing it later can never delete the original's. Returns the attachment unchanged when the file is
 * not on this device or cloning fails, so a storage/quota error never silently drops the attachment.
 */
export async function cloneAttachment(a: PageAttachment): Promise<PageAttachment | null> {
  try {
    if (a.kind === 'image') {
      const blob = await getImage(a.id);
      if (!blob) return a;
      const id = newAttachId('im');
      await putImage(id, blob, a.name);
      return { ...a, id };
    }
    const clip = await getAudio(a.id);
    if (!clip) return a;
    const id = newAttachId('au');
    await putAudio(id, clip.blob, { mime: clip.meta.mime, durationSec: clip.meta.durationSec, bookmarks: clip.meta.bookmarks, createdAt: clip.meta.createdAt });
    return { ...a, id };
  } catch {
    // Keep the original reference rather than silently losing the attachment from the copied note.
    // Attachment removal currently only removes the reference; it does not delete the underlying blob.
    return a;
  }
}
