// Streak maths, kept pure (no storage, no React) so it can be unit-tested.
//
// Two rules that keep a streak from dying for the wrong reason:
//  1. Days are the learner's LOCAL calendar days. (Using the UTC date cut the day at
//     5:30 am in India, so a late-night or early-morning session landed on the wrong day.)
//  2. One rest day per week is forgiven: a single missed day does not break the streak
//     as long as the day before it was active and no other rest day was used within the
//     previous 7 days. Two missed days in a row still end it. Rest days are not counted
//     in the number — the streak is always "days you actually studied".

/** Local YYYY-MM-DD for `date` (not UTC). */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MIN_DAYS_BETWEEN_RESTS = 7;

/** Current streak ending today. `today` should already be in `activeDays` (see Dashboard). */
export function computeStreak(activeDays: Iterable<string>, today: Date = new Date()): number {
  const active = new Set(activeDays);
  const keyAt = (back: number) => localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back));

  let streak = 0;
  let lastRestAt: number | null = null; // how many days back the most recent forgiven day was
  for (let back = 0; ; back++) {
    if (active.has(keyAt(back))) {
      streak += 1;
      continue;
    }
    const restAvailable = lastRestAt === null || back - lastRestAt >= MIN_DAYS_BETWEEN_RESTS;
    // Forgive this single miss only if the streak actually continues on the other side of it.
    if (back > 0 && restAvailable && active.has(keyAt(back + 1))) {
      lastRestAt = back;
      continue;
    }
    break;
  }
  return streak;
}
