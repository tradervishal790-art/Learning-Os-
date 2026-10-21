// ============================================================
// backup.ts — "Backup all notes" file: build, read back, and plan an import. Pure: no storage, no React.
// Reading is strict: every field is checked, bad notes / pages / strokes are dropped and reported
// in `warnings`, sizes are clamped, and parseBackup never throws.
// A note's photos, recordings and imported PDFs are separate files on the device that added them;
// the backup keeps the references only (see `files` in the result so the UI can say so).
// ============================================================
import type { InkKind, InkStroke, NotePage, NoteVideo, PageAttachment, StudyStatus } from './notebookStore';
import type { NoteSnapshot } from './noteTypes';

export const BACKUP_VERSION = 1;
export const BACKUP_FORMAT = 'learning-os-notes';
/** Marker of the single-note JSON file made by the note's own Export dialog; it can be imported too. */
const SINGLE_NOTE_APP = 'learning-os-note';

/** A note plus the library fields that belong to it (tags, pin, study status …). */
export interface BackupNote extends NoteSnapshot {
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
  status?: StudyStatus;
  confidence?: number;
  examDate?: string;
}

export type BackupError = 'not-json' | 'wrong-format' | 'too-new';
export type ParseBackupResult =
  | { ok: true; notes: BackupNote[]; warnings: string[]; files: number }
  | { ok: false; error: BackupError };

const INK_KINDS: readonly string[] = ['ballpoint', 'fountain', 'felt', 'pencil', 'brush', 'calligraphy', 'fineliner', 'marker', 'dotted', 'highlighter'];
const MOMENT_KINDS: readonly string[] = ['confusing', 'important', 'revisit'];
const STATUSES: readonly string[] = ['not-started', 'learning', 'needs-revision', 'mastered'];
const LIMIT = {
  notes: 5000,
  pages: 2000,
  strokes: 20000,
  ptsValues: 150000,
  attachments: 200,
  moments: 2000,
  tags: 50,
  id: 200,
  title: 500,
  tag: 60,
  name: 300,
  text: 1_000_000,
  html: 2_000_000,
  moment: 2000,
  small: 50,
  warnings: 50,
} as const;
const EPOCH = '1970-01-01T00:00:00.000Z';
const COLOR_RE = /^(?:#[0-9a-fA-F]{6}|auto)$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function shortId(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= LIMIT.id ? v : null;
}
function str(v: unknown, max: number): string | null {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

class Warnings {
  private list: string[] = [];
  private extra = 0;
  add(msg: string): void {
    if (this.list.length < LIMIT.warnings) this.list.push(msg);
    else this.extra += 1;
  }
  get count(): number {
    return this.list.length + this.extra;
  }
  done(): string[] {
    return this.extra > 0 ? [...this.list, `…and ${this.extra} more warnings`] : this.list;
  }
}

function parseStroke(raw: unknown, where: string, w: Warnings): InkStroke | null {
  if (!isRecord(raw)) {
    w.add(`${where}: stroke dropped (not an object)`);
    return null;
  }
  const id = shortId(raw.id);
  if (id === null) {
    w.add(`${where}: stroke dropped (bad id)`);
    return null;
  }
  if (typeof raw.kind !== 'string' || !INK_KINDS.includes(raw.kind)) {
    w.add(`${where}: stroke ${id} dropped (unknown kind)`);
    return null;
  }
  if (typeof raw.color !== 'string' || !COLOR_RE.test(raw.color)) {
    w.add(`${where}: stroke ${id} dropped (bad colour)`);
    return null;
  }
  if (!isNum(raw.width) || raw.width <= 0 || raw.width > 500) {
    w.add(`${where}: stroke ${id} dropped (bad width)`);
    return null;
  }
  if (raw.sim !== undefined && typeof raw.sim !== 'boolean') {
    w.add(`${where}: stroke ${id} dropped (bad sim flag)`);
    return null;
  }
  if (raw.sm !== undefined && !isNum(raw.sm)) {
    w.add(`${where}: stroke ${id} dropped (bad smoothing)`);
    return null;
  }
  if (!Array.isArray(raw.pts)) {
    w.add(`${where}: stroke ${id} dropped (no points)`);
    return null;
  }
  const arr: unknown[] = raw.pts;
  let n = Math.min(arr.length, LIMIT.ptsValues);
  n -= n % 3;
  if (n < 3) {
    w.add(`${where}: stroke ${id} dropped (too few points)`);
    return null;
  }
  const pts: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (!isNum(v)) {
      w.add(`${where}: stroke ${id} dropped (non-numeric point)`);
      return null;
    }
    pts[i] = v;
  }
  if (arr.length > LIMIT.ptsValues) w.add(`${where}: stroke ${id} was shortened (too many points)`);
  return { id, kind: raw.kind as InkKind, color: raw.color, width: raw.width, pts, sim: raw.sim === true, sm: raw.sm ?? 0 };
}

function parseAttachments(raw: unknown, where: string, w: Warnings): PageAttachment[] {
  if (!Array.isArray(raw)) {
    w.add(`${where}: attachments ignored (not a list)`);
    return [];
  }
  const out: PageAttachment[] = [];
  for (const a of (raw as unknown[]).slice(0, LIMIT.attachments)) {
    const id = isRecord(a) ? shortId(a.id) : null;
    if (!isRecord(a) || id === null || (a.kind !== 'image' && a.kind !== 'audio')) {
      w.add(`${where}: an attachment was dropped (bad data)`);
      continue;
    }
    out.push({ id, kind: a.kind, name: str(a.name, LIMIT.name) ?? '' });
  }
  return out;
}

function parsePage(raw: unknown, where: string, w: Warnings): NotePage | null {
  if (!isRecord(raw)) {
    w.add(`${where}: page dropped (not an object)`);
    return null;
  }
  const id = shortId(raw.id);
  if (id === null) {
    w.add(`${where}: page dropped (bad id)`);
    return null;
  }
  if (typeof raw.text !== 'string') {
    w.add(`${where}: page ${id} dropped (text is not a string)`);
    return null;
  }
  let text = raw.text;
  if (text.length > LIMIT.text) {
    text = text.slice(0, LIMIT.text);
    w.add(`${where}: page ${id} text was shortened`);
  }
  const page: NotePage = { id, text };

  if (raw.html !== undefined) {
    if (typeof raw.html !== 'string') w.add(`${where}: page ${id} html ignored (not a string)`);
    else if (raw.html.length > LIMIT.html) w.add(`${where}: page ${id} html ignored (too large), text kept`);
    else page.html = raw.html;
  }
  if (raw.ink !== undefined) {
    if (!Array.isArray(raw.ink)) {
      w.add(`${where}: page ${id} ink ignored (not a list)`);
    } else {
      const rawInk: unknown[] = raw.ink;
      if (rawInk.length > LIMIT.strokes) w.add(`${where}: page ${id} has too many strokes, extra ones dropped`);
      const seen = new Set<string>();
      const ink: InkStroke[] = [];
      for (const r of rawInk.slice(0, LIMIT.strokes)) {
        const s = parseStroke(r, `${where} page ${id}`, w);
        if (!s) continue;
        if (seen.has(s.id)) {
          w.add(`${where}: page ${id} duplicate stroke id ${s.id} dropped`);
          continue;
        }
        seen.add(s.id);
        ink.push(s);
      }
      page.ink = ink;
    }
  }
  const template = str(raw.template, LIMIT.small);
  if (template !== null) page.template = template;
  const paper = str(raw.paper, LIMIT.small);
  if (paper !== null) page.paper = paper;
  if (typeof raw.bookmarked === 'boolean') page.bookmarked = raw.bookmarked;
  if (raw.attachments !== undefined) {
    const list = parseAttachments(raw.attachments, `${where} page ${id}`, w);
    if (list.length > 0) page.attachments = list;
  }
  if (raw.pdf !== undefined) {
    const p = raw.pdf;
    const fileId = isRecord(p) ? shortId(p.fileId) : null;
    if (isRecord(p) && fileId !== null && isNum(p.pageNumber) && Number.isInteger(p.pageNumber) && p.pageNumber >= 1 && p.pageNumber <= 100000) {
      page.pdf = { fileId, pageNumber: p.pageNumber, name: str(p.name, LIMIT.name) ?? '' };
    } else {
      w.add(`${where}: page ${id} PDF link ignored (bad data)`);
    }
  }
  return page;
}

function parseVideo(raw: unknown, where: string, w: Warnings): NoteVideo | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw) || typeof raw.videoId !== 'string' || !VIDEO_ID_RE.test(raw.videoId)) {
    w.add(`${where}: linked video ignored (bad data)`);
    return undefined;
  }
  const video: NoteVideo = { videoId: raw.videoId, moments: [] };
  if (isNum(raw.startAt) && raw.startAt >= 0 && raw.startAt <= 1_000_000) video.startAt = raw.startAt;
  const rawMoments: unknown[] = Array.isArray(raw.moments) ? (raw.moments as unknown[]) : [];
  for (const m of rawMoments.slice(0, LIMIT.moments)) {
    const id = isRecord(m) ? shortId(m.id) : null;
    if (!isRecord(m) || id === null || !isNum(m.seconds) || m.seconds < 0 || typeof m.kind !== 'string' || !MOMENT_KINDS.includes(m.kind)) {
      w.add(`${where}: a video moment was dropped (bad data)`);
      continue;
    }
    const createdAt = typeof m.createdAt === 'string' && Number.isFinite(Date.parse(m.createdAt)) ? m.createdAt : EPOCH;
    video.moments.push({ id, seconds: m.seconds, kind: m.kind as 'confusing' | 'important' | 'revisit', note: str(m.note, LIMIT.moment) ?? '', createdAt });
  }
  return video;
}

function parseNote(raw: unknown, where: string, w: Warnings, allowNoId: boolean): BackupNote | null {
  if (!isRecord(raw)) {
    w.add(`${where}: dropped (not an object)`);
    return null;
  }
  const id = allowNoId && raw.id === undefined ? '' : shortId(raw.id);
  if (id === null) {
    w.add(`${where}: dropped (missing or invalid id)`);
    return null;
  }
  if (!Array.isArray(raw.pages)) {
    w.add(`${where}: dropped (pages is not a list)`);
    return null;
  }
  let title = '';
  if (typeof raw.title === 'string') title = raw.title.slice(0, LIMIT.title);
  else w.add(`${where}: title missing, left empty`);

  let updatedAt = EPOCH;
  if (typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))) updatedAt = raw.updatedAt;
  else if (!allowNoId) w.add(`${where}: updatedAt missing or invalid, treated as very old`);

  const rawPages: unknown[] = raw.pages;
  if (rawPages.length > LIMIT.pages) w.add(`${where}: too many pages, extra ones dropped`);
  const seen = new Set<string>();
  const pages: NotePage[] = [];
  for (let i = 0; i < Math.min(rawPages.length, LIMIT.pages); i++) {
    const p = parsePage(rawPages[i], `${where}.pages[${i}]`, w);
    if (!p) continue;
    if (seen.has(p.id)) {
      w.add(`${where}.pages[${i}]: duplicate page id ${p.id} dropped`);
      continue;
    }
    seen.add(p.id);
    pages.push(p);
  }
  const note: BackupNote = { id, title, pages, updatedAt };
  const video = parseVideo(raw.video, where, w);
  if (video) note.video = video;

  if (Array.isArray(raw.tags)) {
    note.tags = (raw.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, LIMIT.tag)).filter(Boolean).slice(0, LIMIT.tags);
  }
  if (typeof raw.pinned === 'boolean') note.pinned = raw.pinned;
  if (typeof raw.favorite === 'boolean') note.favorite = raw.favorite;
  if (typeof raw.archived === 'boolean') note.archived = raw.archived;
  if (typeof raw.status === 'string' && STATUSES.includes(raw.status)) note.status = raw.status as StudyStatus;
  if (isNum(raw.confidence) && raw.confidence >= 1 && raw.confidence <= 5) note.confidence = Math.round(raw.confidence);
  if (typeof raw.examDate === 'string' && DATE_RE.test(raw.examDate)) note.examDate = raw.examDate;
  return note;
}

function countFiles(notes: BackupNote[]): number {
  let n = 0;
  for (const note of notes) {
    for (const p of note.pages) {
      n += p.attachments?.length ?? 0;
      if (p.pdf) n += 1;
    }
  }
  return n;
}

function parseUnsafe(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'wrong-format' };
  const w = new Warnings();

  // one note exported from the note's own Export dialog
  if (parsed.app === SINGLE_NOTE_APP) {
    if (isNum(parsed.version) && parsed.version > BACKUP_VERSION) return { ok: false, error: 'too-new' };
    const one = parseNote(parsed, 'note', w, true);
    if (!one) return { ok: false, error: 'wrong-format' };
    return { ok: true, notes: [one], warnings: w.done(), files: countFiles([one]) };
  }

  const version = parsed.version;
  if (version !== undefined) {
    if (!isNum(version)) return { ok: false, error: 'wrong-format' };
    if (version > BACKUP_VERSION) return { ok: false, error: 'too-new' };
  }
  if (parsed.format !== undefined && parsed.format !== BACKUP_FORMAT) return { ok: false, error: 'wrong-format' };
  if (!Array.isArray(parsed.notes)) return { ok: false, error: 'wrong-format' };

  const rawNotes: unknown[] = parsed.notes;
  if (rawNotes.length > LIMIT.notes) w.add(`Only the first ${LIMIT.notes} notes were read`);
  const byId = new Map<string, BackupNote>();
  for (let i = 0; i < Math.min(rawNotes.length, LIMIT.notes); i++) {
    const n = parseNote(rawNotes[i], `notes[${i}]`, w, false);
    if (!n) continue;
    const prev = byId.get(n.id);
    if (prev) {
      w.add(`notes[${i}]: duplicate note id ${n.id}, newest copy kept`);
      if (Date.parse(n.updatedAt) > Date.parse(prev.updatedAt)) byId.set(n.id, n);
      continue;
    }
    byId.set(n.id, n);
  }
  const notes = Array.from(byId.values());
  return { ok: true, notes, warnings: w.done(), files: countFiles(notes) };
}

/** Never throws. */
export function parseBackup(text: string): ParseBackupResult {
  try {
    return parseUnsafe(text);
  } catch {
    return { ok: false, error: 'wrong-format' };
  }
}

/** The text of a backup file. */
export function buildBackupJson(notes: BackupNote[]): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), notes });
}

/**
 * Same id: the incoming copy is newer -> toReplace; equal, older or unreadable time -> skipped (never destroy data).
 * Unknown id -> toCreate. A note with an empty id, or an id repeated inside `incoming`, gets a fresh id and is created.
 */
export function planImport(
  existing: { id: string; updatedAt: string }[],
  incoming: BackupNote[],
  newId: () => string
): { toCreate: BackupNote[]; toReplace: BackupNote[]; skipped: number } {
  const known = new Map<string, number>();
  for (const e of existing) known.set(e.id, Date.parse(e.updatedAt));
  const used = new Set<string>(known.keys());
  const seenIncoming = new Set<string>();
  const toCreate: BackupNote[] = [];
  const toReplace: BackupNote[] = [];
  let skipped = 0;

  const freshId = (): string => {
    let id = newId();
    for (let i = 0; i < 20 && (used.has(id) || seenIncoming.has(id)); i++) id = newId();
    return id;
  };

  for (const note of incoming) {
    if (!note.id || seenIncoming.has(note.id)) {
      const id = freshId();
      seenIncoming.add(id);
      toCreate.push({ ...note, id });
      continue;
    }
    seenIncoming.add(note.id);
    const ex = known.get(note.id);
    if (ex === undefined) {
      toCreate.push(note);
      continue;
    }
    const inc = Date.parse(note.updatedAt);
    if (Number.isFinite(inc) && Number.isFinite(ex) && inc > ex) toReplace.push(note);
    else skipped += 1;
  }
  return { toCreate, toReplace, skipped };
}
