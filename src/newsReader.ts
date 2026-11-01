/** Accept only ordinary web article URLs before placing them in an embedded reader. */
export function safeArticleUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password && parsed.hostname ? parsed.href : null;
  } catch {
    return null;
  }
}
