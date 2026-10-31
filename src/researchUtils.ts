export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchResponse {
  query: string;
  results: SerpResult[];
  grounded: boolean;
}

/** Reject malformed cached/API payloads before they reach the result renderer. */
export function normalizeResearchResponse(value: unknown, query: string): ResearchResponse | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { results?: unknown; grounded?: unknown };
  if (!Array.isArray(candidate.results)) return null;

  const results = candidate.results.flatMap((item): SerpResult[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { title?: unknown; url?: unknown; snippet?: unknown };
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    const snippet = typeof row.snippet === 'string' ? row.snippet.trim() : '';
    if (!title && !snippet) return [];
    return [{ title: title || 'Untitled result', url, snippet }];
  });

  return { query, results, grounded: candidate.grounded === true };
}

/** Only ordinary web URLs may become clickable external links. */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function displayResearchUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    return url.hostname.replace(/^www\\./, '') + path;
  } catch {
    return value;
  }
}
