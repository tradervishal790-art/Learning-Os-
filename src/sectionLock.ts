import { useSyncExternalStore } from 'react';
import { auth } from './firebase';
import type { DashboardPageId } from './types';

// ============================================================
// sectionLock.ts
//
// Password gate for dashboard sections. Every section EXCEPT Home
// ('dashboard') and Test ('test') asks the user to re-confirm their
// account password (Google accounts: Google popup) before opening.
//
// The password itself is the existing Firebase account password —
// nothing new is stored, and "forgot password" is the normal Firebase
// account flow, so a user can never be locked out of their own data.
//
// Unlock lives in sessionStorage (keyed by uid), so it lasts until the
// tab is closed / the user taps "Lock" / signs out — one confirmation
// opens every protected section for the session.
// ============================================================

export const PROTECTED_PAGES: DashboardPageId[] = [
  'roadmap',
  'revision',
  'videos',
  'mentor',
  'notes',
  'progress',
  'research',
  'dictionary',
];

export function isProtectedPage(page: DashboardPageId): boolean {
  return PROTECTED_PAGES.includes(page);
}

const KEY = 'learning_os_sections_unlocked_uid';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readUnlocked(): boolean {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    return sessionStorage.getItem(KEY) === uid;
  } catch {
    return false;
  }
}

export function unlockSections(): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    sessionStorage.setItem(KEY, uid);
  } catch {
    // sessionStorage unavailable — gate simply re-asks next time
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

export function useSectionsUnlocked(): boolean {
  return useSyncExternalStore(subscribe, readUnlocked, () => false);
}
