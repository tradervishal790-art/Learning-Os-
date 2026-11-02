import { putAudio } from './audioStore';
import { newAttachId } from './attachStore';
import { getIndex, loadNoteContent, saveNoteContent, type PageAttachment } from './notebookStore';
import type { RecordingResult } from './useAudioRecorder';

// ============================================================
// recordingGuard.ts — keeps a voice recording from being lost silently.
//  1. Every mounted <AudioRecorder> registers here, so the note editor can ask
//     "is something being recorded?" before Back / closing the tab.
//  2. If the recorder is torn down some other way (another tab, a crash of the
//     page tree), rescueRecording() writes the captured audio straight into the
//     note, so it is never thrown away without a trace.
// ============================================================

export interface RecorderHandle {
  /** Recording / paused, or stopped but not yet saved into the note. */
  busy(): boolean;
  /** Stop and store the clip in the note. Resolves false when saving failed. */
  saveAndStop(): Promise<boolean>;
  /** Throw the clip away. */
  discard(): void;
}

const handles = new Set<RecorderHandle>();

export function registerRecorder(h: RecorderHandle): () => void {
  handles.add(h);
  return () => {
    handles.delete(h);
  };
}

export const isRecordingBusy = (): boolean => [...handles].some((h) => h.busy());

export async function saveBusyRecordings(): Promise<boolean> {
  let ok = true;
  for (const h of [...handles]) if (h.busy() && !(await h.saveAndStop())) ok = false;
  return ok;
}

export function discardBusyRecordings(): void {
  for (const h of [...handles]) if (h.busy()) h.discard();
}

// ---- note writes in flight, so a rescue never reads a note while its autosave is still running ----
const writes = new Map<string, Promise<unknown>>();

export function trackNoteWrite(id: string, p: Promise<unknown>): void {
  const tracked = p.catch(() => false);
  writes.set(id, tracked);
  void tracked.then(() => {
    if (writes.get(id) === tracked) writes.delete(id);
  });
}

/** Store a clip that lost its recorder: audio file first, then a reference on the page it was recorded on. */
export async function rescueRecording(noteId: string, pageId: string, r: RecordingResult, name: string): Promise<boolean> {
  try {
    await (writes.get(noteId) ?? Promise.resolve());
    const attId = newAttachId('au');
    await putAudio(attId, r.blob, { mime: r.mime, durationSec: r.durationSec, bookmarks: r.bookmarks, createdAt: new Date().toISOString() });
    const content = await loadNoteContent(noteId);
    const meta = getIndex().notes.find((n) => n.id === noteId);
    if (!content || !meta || content.pages.length === 0) return false;
    const att: PageAttachment = { id: attId, kind: 'audio', name };
    const target = content.pages.some((p) => p.id === pageId) ? pageId : content.pages[content.pages.length - 1].id;
    const pages = content.pages.map((p) => (p.id === target ? { ...p, attachments: [...(p.attachments ?? []), att] } : p));
    return await saveNoteContent(noteId, meta.title, pages, content.video, { cloud: false });
  } catch {
    return false;
  }
}
