interface Blueprint {
  role: string;
  goal: string;
  language: string;
  hours: number;
  style: {
    pace: number;
    practical: number;
    depth: number;
    structure: number;
    storytelling: number;
    languageComplexity: number;
  };
}

interface ExpandedQuery {
  queries: string[];
  searchHint: string;
}

const CACHE_KEY = 'learning_os_query_expansion_cache';

function readCache(): Record<string, ExpandedQuery> {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    return saved ? (JSON.parse(saved) as Record<string, ExpandedQuery>) : {};
  } catch {
    return {};
  }
}

function writeCache(data: Record<string, ExpandedQuery>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/** Cache key combines user input + a hash of the blueprint — same query with different learning styles = different cache entry. */
function makeCacheKey(userInput: string, blueprint: Blueprint): string {
  const styleHash = `${blueprint.style.pace}-${blueprint.style.practical}-${blueprint.style.depth}-${blueprint.goal}-${blueprint.language}`;
  return `${userInput.toLowerCase().trim()}::${styleHash}`;
}

export async function expandSearchQuery(
  userInput: string,
  blueprint: Blueprint
): Promise<ExpandedQuery | null> {
  const cache = readCache();
  const key = makeCacheKey(userInput, blueprint);
  if (cache[key]) return cache[key];

  try {
    const res = await fetch('/api/expand-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, blueprint }),
    });

    if (!res.ok) {
      console.warn(`[queryExpander] API failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as ExpandedQuery;
    cache[key] = data;
    writeCache(cache);
    return data;
  } catch (err) {
    console.warn(`[queryExpander] request failed: ${err}`);
    return null;
  }
}
