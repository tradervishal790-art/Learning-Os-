// Pure drag-and-drop maths for the page thumbnails (kept out of the component file so it is easy to test).

/**
 * Returns the insertion SLOT (0..rects.length) for a pointer at `y`.
 * Slot i means "drop line sits above item i"; slot rects.length means "after the last item".
 * Items are compared by their vertical midpoint. `rects` must be in list order.
 */
export function dropIndexFromY(rects: { top: number; height: number }[], y: number): number {
  const i = rects.findIndex((r) => y < r.top + r.height / 2);
  return i === -1 ? rects.length : i;
}

/** Converts an insertion slot into the final index in the new order (what onMove expects). */
export function moveTargetIndex(fromIndex: number, slot: number): number {
  return slot > fromIndex ? slot - 1 : slot;
}

