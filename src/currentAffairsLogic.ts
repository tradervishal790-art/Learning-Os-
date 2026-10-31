/** Validate that a cached news day belongs to the exact date and language requested. */
export function isCurrentAffairsCacheEntry(
  value: unknown,
  date: string,
  locale: string,
): value is { date: string; locale: string; points: unknown[]; quiz?: unknown[] } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { date?: unknown; locale?: unknown; points?: unknown; quiz?: unknown };
  return candidate.date === date
    && candidate.locale === locale
    && Array.isArray(candidate.points)
    && candidate.points.length > 0
    && (candidate.quiz === undefined || Array.isArray(candidate.quiz));
}
