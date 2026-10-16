// src/pageTemplates.ts

export type PageTemplateId = 'blank' | 'ruled' | 'dotted' | 'grid' | 'cornell';

/** Spacing is in PAGE UNITS (the sheet is always 1000 units wide). */
export const PAGE_TEMPLATES: { id: PageTemplateId; spacing: number }[] = [
  { id: 'blank', spacing: 0 },
  { id: 'ruled', spacing: 40 },
  { id: 'dotted', spacing: 40 },
  { id: 'grid', spacing: 40 },
  { id: 'cornell', spacing: 40 },
];

/** `light` / `dark` are the CSS colours used in the light / dark app theme. */
export const PAPER_COLORS: { id: string; light: string; dark: string }[] = [
  { id: 'white', light: '#ffffff', dark: 'rgba(14, 16, 20, 0.85)' },
  { id: 'cream', light: '#fbf4e3', dark: '#2a2619' },
  { id: 'grey', light: '#eceef1', dark: '#25272b' },
  { id: 'blue', light: '#e8f1fb', dark: '#18222f' },
  // Dark-friendly papers: they stay dark even when the app is in light theme.
  { id: 'charcoal', light: '#2b2d31', dark: '#1f2124' },
  { id: 'navy', light: '#16233a', dark: '#0f1829' },
];

/** Papers that are dark in BOTH themes (used to pick readable line colours). */
const ALWAYS_DARK_PAPERS: ReadonlySet<string> = new Set(['charcoal', 'navy']);

/** For validating data coming from the cloud. */
export function isTemplateId(v: unknown): v is PageTemplateId {
  return typeof v === 'string' && PAGE_TEMPLATES.some((t) => t.id === v);
}

/** CSS colour for a paper id, or undefined for unknown/undefined ids. */
export function paperColor(id: string | undefined, dark: boolean): string | undefined {
  if (id === undefined) return undefined;
  const paper = PAPER_COLORS.find((p) => p.id === id);
  if (paper === undefined) return undefined;
  return dark ? paper.dark : paper.light;
}

/**
 * Whether the paper surface is dark, so ink should be light.
 * Unknown/undefined paper follows the app theme.
 */
export function paperIsDark(id: string | undefined, dark: boolean): boolean {
  if (id !== undefined && ALWAYS_DARK_PAPERS.has(id)) return true;
  return dark;
}

/** Spacing in page units for a template (0 for blank). */
export function templateSpacing(id: PageTemplateId): number {
  return PAGE_TEMPLATES.find((t) => t.id === id)?.spacing ?? 0;
}
