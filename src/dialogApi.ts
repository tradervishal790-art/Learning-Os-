// ============================================================
// dialogApi.ts — in-app replacements for window.confirm / window.prompt / window.alert.
// Native boxes are blocked or silently auto-dismissed in in-app browsers (WhatsApp, Instagram) and
// installed PWAs, look out of place, and ignore the app's language. Call from anywhere:
//     if (!(await askConfirm('Delete this?', { danger: true }))) return;
//     const name = await askText('Folder name', '');   // null = cancelled
//     await showNotice('Storage is full.');
// <AppDialogHost /> (appDialogs.tsx) is mounted once in main.tsx and draws them. Where no host is mounted
// (unit tests, a render failure) these fall back to the browser's own boxes so a question is never lost.
// ============================================================

export type DialogReq =
  | { kind: 'confirm'; message: string; danger: boolean; confirmLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'text'; message: string; initial: string; resolve: (v: string | null) => void }
  | { kind: 'notice'; message: string; resolve: () => void };

let host: ((r: DialogReq) => void) | null = null;

/** Called by <AppDialogHost /> while it is mounted. */
export function registerDialogHost(h: ((r: DialogReq) => void) | null): void {
  host = h;
}

function nativeFallback(r: DialogReq): void {
  if (r.kind === 'confirm') r.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(r.message) : false);
  else if (r.kind === 'text') r.resolve(typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(r.message, r.initial) : null);
  else {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(r.message);
    r.resolve();
  }
}

function send(r: DialogReq): void {
  if (host) host(r);
  else nativeFallback(r);
}

/** In-app "are you sure?". Resolves true on confirm, false on cancel / Esc / tapping outside. */
export function askConfirm(message: string, opts: { danger?: boolean; confirmLabel?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => send({ kind: 'confirm', message, danger: !!opts.danger, confirmLabel: opts.confirmLabel, resolve }));
}

/** In-app text prompt. Resolves the typed text, or null when cancelled. */
export function askText(message: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => send({ kind: 'text', message, initial, resolve }));
}

/** In-app one-button message. Resolves when it is dismissed. */
export function showNotice(message: string): Promise<void> {
  return new Promise((resolve) => send({ kind: 'notice', message, resolve }));
}
