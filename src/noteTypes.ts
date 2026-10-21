// Types for the notebook "safety" tools (sync conflicts, backup, handwriting export).
import type { NotePage, NoteVideo } from './notebookStore';

/** A whole note as one value: title (from the index) + pages + the linked video, if any. */
export interface NoteSnapshot {
  id: string;
  title: string;
  pages: NotePage[];
  video?: NoteVideo;
  /** ISO */
  updatedAt: string;
}
