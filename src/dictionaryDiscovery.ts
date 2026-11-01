/** Deterministically select varied headwords without changing the dictionary dataset. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function selectDiscoveryWords(words: readonly string[], seed: string, limit = 5): string[] {
  const unique = [...new Set(words
    .filter((word): word is string => typeof word === 'string')
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[\\p{L}][\\p{L}'-]{0,39}$/u.test(word)))];
  if (unique.length === 0 || !Number.isFinite(limit) || limit <= 0) return [];

  const count = Math.min(Math.floor(limit), unique.length);
  const hash = hashSeed(seed || 'learning-os');
  const start = hash % unique.length;
  let step = unique.length === 1 ? 1 : 1 + ((hash >>> 8) % (unique.length - 1));
  while (unique.length > 1 && gcd(step, unique.length) !== 1) {
    step = (step % (unique.length - 1)) + 1;
  }

  return Array.from({ length: count }, (_, index) => unique[(start + index * step) % unique.length]);
}
