// ============================================================
// mentorChatStore.ts
//
// Keeps the AI Mentor conversation on the device so reopening the Mentor
// tab (or the app) restores the chat instead of starting blank — chat apps
// do the same. Deliberately LOCAL ONLY and per-user:
//   - Mentor replies are personalized (student profile goes into the
//     prompt), so they must never sit in a shared/CDN cache.
//   - Keyed by uid and wiped on sign-out, so a shared phone never shows
//     one student's chat to another.
// ============================================================

import { auth } from './firebase';

export interface StoredMentorMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: string; // ISO
}

const PREFIX = 'learning_os_mentor_chat_v1:';
const MAX_MESSAGES = 60;

function key(): string | null {
  const uid = auth.currentUser?.uid;
  return uid ? PREFIX + uid : null;
}

export function loadMentorChat(): StoredMentorMessage[] {
  const k = key();
  if (!k) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is StoredMentorMessage =>
        m && typeof m.id === 'string' && typeof m.content === 'string' && (m.role === 'user' || m.role === 'mentor')
    );
  } catch {
    return [];
  }
}

export function saveMentorChat(messages: StoredMentorMessage[]): void {
  const k = key();
  if (!k) return;
  try {
    localStorage.setItem(k, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    // storage full / unavailable — chat just won't persist, non-critical
  }
}

/** Removes every user's saved Mentor chat from this device (called on sign-out). */
export function clearAllMentorChats(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
