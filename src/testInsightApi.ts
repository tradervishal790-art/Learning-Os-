// src/testInsightApi.ts
// The ONLY AI call in test analytics: sends the locally computed summary (numbers +
// findings, see testAnalytics.ts) and gets back ONE study suggestion. Runs only when
// the learner presses the button.
import { authFetch } from './apiFetch';
import type { InsightPayload } from './testAnalytics';

export async function fetchTestSuggestion(summary: InsightPayload, locale: string): Promise<string> {
  const response = await authFetch('/api/extract-questions?op=insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, locale }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Could not get a suggestion (${response.status})`);
  return String(data.suggestion ?? '');
}
