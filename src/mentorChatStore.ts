// ============================================================
// mentorChatStore.ts
//
// Keeps the AI Mentor conversations on the device: the student can start a
// new chat, reopen an earlier one, or delete one. Deliberately LOCAL ONLY
// and per-user:
//   - Mentor replies are personalized (student profile goes into the
//     prompt), so they must never sit in a shared/CDN cache.
//   - Keyed by uid and wiped on sign-out, so a shared phone never shows
//     one student's chats to another.
// ============================================================

import { auth } from './firebase';

export interface StoredMentorMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  ui?: boolean; // content is an OpenUI card program
  timestamp: string; // ISO
}

export interface MentorChatMeta {
  id: string;
  title: string;
  updatedAt: string; // ISO
}

interface StoredChat extends MentorChatMeta {
  messages: StoredMentorMessage[];
}

interface ChatsFile {
  activeId: string | null;
  chats: StoredChat[];
}

const PREFIX = 'learning_os_mentor_chats_v2:';
const LEGACY_PREFIX = 'learning_os_mentor_chat_v1:'; // single-conversation format
const MAX_MESSAGES = 60;
const MAX_CHATS = 30;
const TITLE_MAX = 48;

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function isMessage(m: unknown): m is StoredMentorMessage {
  const o = m as StoredMentorMessage | null;
  return !!o && typeof o.id === 'string' && typeof o.content === 'string' && (o.role === 'user' || o.role === 'mentor');
}

function titleFrom(messages: StoredMentorMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content ?? '';
  const t = first.replace(/\s+/g, ' ').trim();
  return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 1) + '…' : t;
}

function readFile(): ChatsFile {
  const id = uid();
  if (!id) return { activeId: null, chats: [] };
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatsFile>;
      const chats = (Array.isArray(parsed.chats) ? parsed.chats : [])
        .filter((c): c is StoredChat => !!c && typeof c.id === 'string' && Array.isArray(c.messages))
        .map((c) => ({ ...c, messages: c.messages.filter(isMessage) }));
      return { activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null, chats };
    }
    // One-time migration: the old single conversation becomes the first saved chat.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_PREFIX + id) || '[]');
    const messages = Array.isArray(legacy) ? legacy.filter(isMessage) : [];
    if (messages.some((m) => m.role === 'user')) {
      const chat: StoredChat = {
        id: 'legacy',
        title: titleFrom(messages),
        updatedAt: messages[messages.length - 1]?.timestamp ?? new Date().toISOString(),
        messages,
      };
      return { activeId: chat.id, chats: [chat] };
    }
  } catch {
    // corrupt storage — start clean
  }
  return { activeId: null, chats: [] };
}

function writeFile(file: ChatsFile): void {
  const id = uid();
  if (!id) return;
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(file));
    localStorage.removeItem(LEGACY_PREFIX + id);
  } catch {
    // storage full / unavailable — chats just won't persist, non-critical
  }
}

export function newMentorChatId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The chat that was open last, or null when there is none (start a fresh one). */
export function loadActiveMentorChat(): { id: string; messages: StoredMentorMessage[] } | null {
  const file = readFile();
  const chat = file.chats.find((c) => c.id === file.activeId);
  return chat ? { id: chat.id, messages: chat.messages } : null;
}

export function loadMentorChatById(id: string): StoredMentorMessage[] {
  const chat = readFile().chats.find((c) => c.id === id);
  return chat ? chat.messages : [];
}

/** Saved chats, newest first. */
export function listMentorChats(): MentorChatMeta[] {
  return readFile()
    .chats.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Saves one chat and marks it as the open one. A chat with no student message yet is not
 * stored (opening "New chat" and leaving leaves no empty entry behind).
 */
export function saveMentorChat(id: string, messages: StoredMentorMessage[]): void {
  const file = readFile();
  const kept = messages.slice(-MAX_MESSAGES);
  if (!kept.some((m) => m.role === 'user')) return;
  const existing = file.chats.find((c) => c.id === id);
  const last = kept[kept.length - 1];
  const unchanged =
    !!existing &&
    existing.messages.length === kept.length &&
    existing.messages[existing.messages.length - 1]?.id === last.id;
  // Reopening a chat must not bump it to the top of the list.
  const updatedAt = unchanged ? existing.updatedAt : new Date().toISOString();
  const chat: StoredChat = { id, title: existing?.title || titleFrom(kept), updatedAt, messages: kept };
  const others = file.chats.filter((c) => c.id !== id);
  const chats = [chat, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CHATS);
  writeFile({ activeId: id, chats });
}

/** Marks which chat reopens next time; null = start a fresh one. */
export function setActiveMentorChat(id: string | null): void {
  const file = readFile();
  if (file.activeId !== id) writeFile({ ...file, activeId: id });
}

export function deleteMentorChat(id: string): void {
  const file = readFile();
  writeFile({ activeId: file.activeId === id ? null : file.activeId, chats: file.chats.filter((c) => c.id !== id) });
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
