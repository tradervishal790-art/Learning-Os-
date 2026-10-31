/** Monotonic request tokens for UI flows where the newest learner choice must win. */
export function beginRequest(counter: { current: number }): number {
  counter.current += 1;
  return counter.current;
}

export function isLatestRequest(counter: { current: number }, requestId: number): boolean {
  return counter.current === requestId;
}

export function invalidateRequests(counter: { current: number }): void {
  counter.current += 1;
}
