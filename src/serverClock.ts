// ============================================================
// serverClock.ts — notes sync decides "which copy is newer" by comparing timestamps, newest wins.
// Those timestamps came from the device clock, so a phone whose clock is a day (or year) ahead would
// overwrite every newer edit made on correctly-set devices. Now the stamp is the device clock corrected by
// how far it is from the server's clock (the HTTP `Date` header of our own site), measured once at start.
// ============================================================

let offsetMs = 0;

/** A clock error under this is ignored: the server `Date` header only has whole-second precision. */
export const IGNORE_BELOW_MS = 5_000;
/** A measurement that took longer than this is too imprecise to trust. */
export const MAX_ROUND_TRIP_MS = 4_000;

/** Pure: how many ms the device clock is BEHIND the server (negative = ahead); 0 when not trustworthy. */
export function computeOffset(serverDateHeader: string | null | undefined, sentAt: number, receivedAt: number): number {
  if (!serverDateHeader) return 0;
  const server = Date.parse(serverDateHeader);
  const rtt = receivedAt - sentAt;
  if (!Number.isFinite(server) || rtt < 0 || rtt > MAX_ROUND_TRIP_MS) return 0;
  // The header was truncated to the second (+500 ms on average) and was produced about half a round trip ago.
  const offset = server + 500 - (sentAt + rtt / 2);
  return Math.abs(offset) >= IGNORE_BELOW_MS ? Math.round(offset) : 0;
}

export function setClockOffset(ms: number): void {
  offsetMs = Number.isFinite(ms) ? ms : 0;
}
export const getClockOffset = (): number => offsetMs;

/** "Now", corrected for a wrong device clock. */
export const serverNow = (): number => Date.now() + offsetMs;
export const serverIso = (): string => new Date(serverNow()).toISOString();

let lastSync = 0;
/** Measure the offset against our own server. Never throws; offline simply keeps the old offset. */
export async function syncServerClock(force = false): Promise<void> {
  if (typeof fetch === 'undefined') return;
  if (!force && Date.now() - lastSync < 30 * 60_000) return;
  try {
    const sentAt = Date.now();
    const res = await fetch('/', { method: 'HEAD', cache: 'no-store' });
    const receivedAt = Date.now();
    lastSync = receivedAt;
    setClockOffset(computeOffset(res.headers.get('date'), sentAt, receivedAt));
  } catch {
    // offline: keep whatever offset we had
  }
}
