import { useSyncExternalStore } from 'react';
import type { DashboardPageId } from './types';
import { SECTION_PASSWORD_HASHES } from './sectionPasswords';

// ============================================================
// sectionLock.ts
//
// Session-level unlock state for password-protected dashboard sections.
// Each protected section has its own password (see sectionPasswords.ts);
// unlocking one does not unlock the others. Unlocks live in
// sessionStorage, so they last until the tab is closed, the user taps
// "Lock", or signs out.
// ============================================================

export function isProtectedPage(page: DashboardPageId): boolean {
  return Boolean(SECTION_PASSWORD_HASHES[page]);
}

const KEY = 'learning_os_unlocked_sections';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readUnlocked(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function unlockSection(page: DashboardPageId): void {
  const current = readUnlocked();
  if (!current.includes(page)) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify([...current, page]));
    } catch {
      // sessionStorage unavailable — gate simply re-asks next time
    }
  }
  emit();
}

export function lockSections(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSectionUnlocked(page: DashboardPageId): boolean {
  return useSyncExternalStore(subscribe, () => readUnlocked().includes(page), () => false);
}

/** True if at least one section is currently unlocked (drives the sidebar Lock button). */
export function useAnySectionUnlocked(): boolean {
  return useSyncExternalStore(subscribe, () => readUnlocked().length > 0, () => false);
}
