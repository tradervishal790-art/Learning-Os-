// experimentVariant.ts
//
// Assigns each user to 'control' (existing PlaylistBuilder logic, untouched)
// or 'personality_v1' (new personality-type teaching-process engine), once,
// sticky across sessions. This is the switch that keeps the two systems
// running in parallel without touching each other's code paths.

export type Variant = 'control' | 'personality_v1';

const VARIANT_KEY = 'learning_os_experiment_variant';

export function getOrAssignVariant(): Variant {
  const saved = localStorage.getItem(VARIANT_KEY);
  if (saved === 'control' || saved === 'personality_v1') return saved;

  const assigned: Variant = Math.random() < 0.5 ? 'control' : 'personality_v1';
  localStorage.setItem(VARIANT_KEY, assigned);
  return assigned;
}

// Escape hatch for manual testing — force a variant without clearing all storage.
export function forceVariant(variant: Variant): void {
  localStorage.setItem(VARIANT_KEY, variant);
}
