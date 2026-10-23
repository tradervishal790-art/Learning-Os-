// ============================================================
// mentorChatStore.ts
//
// Keeps the AI Mentor conversations on the device: one "active" chat plus a
// history of earlier chats (ChatGPT-style "New chat" + "History"). Deliberately
// LOCAL ONLY and per-user:
//   - Mentor replies are personalized (student profile goes into the
//     prompt), so they must never sit in a shared/CDN cache.
//   - Keyed by uid and wiped on sign-out, so a shared phone never shows
//     one student's chats to another.
//
// A chat is only stored once it has at least one message, so tapping
// "New chat" repeatedly never fills the history with empty entries.
// ============================================================

import { auth } from './firebase';

export interface StoredMentorMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: string; // ISO
  /** Reply is OpenUI Lang (interactive components), not plain text. */
  ui?: boolean;
}

export interface MentorChatSummary {
  id: string;
  title: string;
  updatedAt: string; // ISO
  messageCount: number;
}

interface StoredChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMentorMessage[];
}

interface StoreShape {
  activeId: string | null;
  chats: StoredChat[];
}

const LEGACY_PREFIX = 'learning_os_mentor_chat_v1:'; // single-chat format
const PREFIX = 'learning_os_mentor_chats_v2:';
const MAX_MESSAGES = 60;
const MAX_CHATS = 50;
const TITLE_LEN = 40;

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function isMessage(m: unknown): m is StoredMentorMessage {
  const x = m as StoredMentorMessage | null;
  return !!x && typeof x.id === 'string' && typeof x.content === 'string' && (x.role === 'user' || x.role === 'mentor');
}

function makeTitle(messages: StoredMentorMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content.replace(/\s+/g, ' ').trim() ?? '';
  return first.length > TITLE_LEN ? first.slice(0, TITLE_LEN).trimEnd() + '…' : first;
}

function read(): StoreShape {
  const id = uid();
  if (!id) return { activeId: null, chats: [] };
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.chats)) {
        const chats: StoredChat[] = parsed.chats
          .filter((c: StoredChat) => c && typeof c.id === 'string' && Array.isArray(c.messages))
          .map((c: StoredChat) => ({ ...c, messages: c.messages.filter(isMessage) }));
        return { activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null, chats };
      }
    }
    return migrateLegacy(id);
  } catch {
    return { activeId: null, chats: [] };
  }
}

/** One-time: the old single conversation becomes the first history entry (and stays active). */
function migrateLegacy(userId: string): StoreShape {
  const empty: StoreShape = { activeId: null, chats: [] };
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + userId);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    const messages = Array.isArray(parsed) ? parsed.filter(isMessage) : [];
    if (messages.length === 0) return empty;
    const last = messages[messages.length - 1].timestamp;
    const chat: StoredChat = {
      id: 'legacy-' + userId.slice(0, 6),
      title: makeTitle(messages),
      createdAt: messages[0].timestamp,
      updatedAt: last,
      messages,
    };
    const store: StoreShape = { activeId: chat.id, chats: [chat] };
    if (write(store)) localStorage.removeItem(LEGACY_PREFIX + userId);
    return store;
  } catch {
    return empty;
  }
}

function write(store: StoreShape): boolean {
  const id = uid();
  if (!id) return false;
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(store));
    return true;
  } catch {
    // storage full / unavailable — chats just won't persist, non-critical
    return false;
  }
}

export function newChatId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The chat the student was last in, or null when there is none to restore. */
export function getActiveChatId(): string | null {
  const { activeId, chats } = read();
  return activeId && chats.some((c) => c.id === activeId) ? activeId : null;
}

/** Marks which chat reopens next time. Pass null for a fresh, not-yet-saved chat. */
export function setActiveChatId(id: string | null): void {
  const store = read();
  if (store.activeId === id) return;
  store.activeId = id;
  write(store);
}

export function loadChat(id: string): StoredMentorMessage[] {
  return read().chats.find((c) => c.id === id)?.messages ?? [];
}

/** History list, newest first. */
export function listChats(): MentorChatSummary[] {
  return read()
    .chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, messageCount: c.messages.length }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Saves a chat's messages (and makes it the active one). No-op for an empty chat,
 * and doesn't bump the "last updated" time when nothing changed — so merely
 * opening an old chat from history doesn't reorder the list.
 */
export function saveChat(id: string, messages: StoredMentorMessage[]): void {
  if (messages.length === 0) return;
  const store = read();
  const trimmed = messages.slice(-MAX_MESSAGES);
  const existing = store.chats.find((c) => c.id === id);
  const now = new Date().toISOString();

  if (existing) {
    const same =
      existing.messages.length === trimmed.length &&
      existing.messages[existing.messages.length - 1]?.id === trimmed[trimmed.length - 1].id &&
      existing.messages[existing.messages.length - 1]?.content === trimmed[trimmed.length - 1].content;
    if (same && store.activeId === id) return;
    if (!same) {
      existing.messages = trimmed;
      existing.updatedAt = now;
      existing.title = makeTitle(trimmed) || existing.title;
    }
  } else {
    store.chats.push({ id, title: makeTitle(trimmed), createdAt: now, updatedAt: now, messages: trimmed });
  }

  store.activeId = id;
  store.chats = store.chats
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CHATS);
  write(store);
}

/** Adds one message to a stored chat (used when a reply lands after the student switched chats). */
export function appendToChat(id: string, message: StoredMentorMessage): void {
  const store = read();
  const chat = store.chats.find((c) => c.id === id);
  if (!chat) return; // chat was deleted while the reply was in flight — drop it
  chat.messages = [...chat.messages, message].slice(-MAX_MESSAGES);
  chat.updatedAt = new Date().toISOString();
  write(store);
}

export function deleteChat(id: string): void {
  const store = read();
  store.chats = store.chats.filter((c) => c.id !== id);
  if (store.activeId === id) store.activeId = null;
  write(store);
}

/** Removes every user's saved Mentor chats from this device (called on sign-out). */
export function clearAllMentorChats(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX) || k.startsWith(LEGACY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
