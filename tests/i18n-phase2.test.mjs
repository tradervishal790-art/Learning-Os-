// Phase 2 (screens wired to useTranslation): every language of every wired section must be complete and safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const { translations } = await loadTs('src/i18n/translations.ts');

/** Sections wired in Phase 2. Add a name here when a screen is wired. */
const WIRED = ['recallCheck', 'dailyHabit', 'welcomeBack', 'pagePlaceholder', 'growthEdgesCard', 'reviewSession', 'shortsBank', 'breakFeed', 'dailyTest', 'testBuilder', 'liveJoin', 'liveHost', 'focusPlayer'];

const leaves = (obj, path = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [[`${path}${k}`, v]] : leaves(v, `${path}${k}.`)));
const placeholders = (s) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');
// product / technical names that stay in Latin letters inside Hindi text
const HINDI_LATIN_OK = new Set(['Learning', 'OS', 'Settings', 'PDF', 'UI', 'AI', 'MCQ', 'WhatsApp']);

for (const name of WIRED) {
  test(`i18n: "${name}" is complete in en / hi / hinglish, with the same {n} placeholders`, () => {
    const en = leaves(translations.en[name]);
    assert.ok(en.length > 0, 'section exists');
    for (const loc of ['hi', 'hinglish']) {
      const other = Object.fromEntries(leaves(translations[loc][name]));
      for (const [key, value] of en) {
        assert.ok(other[key] !== undefined && other[key].trim() !== '', `${loc}.${name}.${key} is missing or empty`);
        assert.equal(placeholders(other[key]), placeholders(value), `${loc}.${name}.${key}: placeholders differ from English`);
      }
    }
  });

  test(`i18n: "${name}" in Hindi is written in Devanagari (only product names stay Latin)`, () => {
    for (const [key, value] of leaves(translations.hi[name])) {
      const latin = (value.replace(/\{\d+\}/g, '').match(/[A-Za-z][A-Za-z'’]*/g) ?? []).filter((w) => !HINDI_LATIN_OK.has(w));
      assert.deepEqual(latin, [], `hi.${name}.${key} has English words: ${latin.join(', ')}`);
    }
  });
}
