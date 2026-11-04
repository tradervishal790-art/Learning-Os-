// Shared invalidation signal for the Progress read model. Stores remain the
// source of truth; this event only asks mounted views to re-read their data.
export const PROGRESS_DATA_CHANGED = 'learning-os:progress-data-changed';

export function notifyProgressDataChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROGRESS_DATA_CHANGED));
}
