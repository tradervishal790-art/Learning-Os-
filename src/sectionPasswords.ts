import type { DashboardPageId } from './types';

// ============================================================
// sectionPasswords.ts
//
// One password PER protected section. Only SHA-256 hashes are stored
// here (never the plain password), so the repo doesn't expose them.
//
// To set/change a password:
//   node scripts/hash-section-password.mjs <page> <new password>
// and paste the printed line over that page's line below.
// A page with no entry here is NOT protected.
//
// NOTE: this is a client-side gate — it keeps casual users out, but it
// cannot stop someone who inspects the browser code. Don't reuse a real
// password from anywhere else here.
// ============================================================

// Must match SALT in scripts/hash-section-password.mjs.
export const SECTION_PASSWORD_SALT = 'learning-os-section-lock-v1';

export const SECTION_PASSWORD_HASHES: Partial<Record<DashboardPageId, string>> = {
  roadmap: 'bf008a1081334819a5f5e7002f8bf3d559e4e574aa1285140a590102cc18b302',
  revision: 'eb32ac6a9d071d34b9dfcd2e05748f6eed517ede16726cdddd446c5f31d56e1e',
  notes: '7bdc5a55988ea770dd88abf46c1dc0aa180e1e99abf227346bb234b45a6786da',
  videos: '98a8ac690e87283b97f8d41326e9640bdcfcdb6b919992ac86bc8a777a66ffa9',
  mentor: 'fbfa9b072422a524d6f5d9fb72f8aa53592e62e2ad27bd16e6f300214eebda68',
  progress: '03ee05a7f4ca7b7a85058530acccbbe15c2206f0ddfb1b12abbf0db9465dbc8f',
  research: 'a386eb431574ffa2cbacc833ae2c090deaa7decffcdceff1c6913da564fdce45',
  dictionary: '61a550e822c50ab1153b479f6904da44ea82d7bd8622908737092417365c787a',
};

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySectionPassword(page: DashboardPageId, password: string): Promise<boolean> {
  const expected = SECTION_PASSWORD_HASHES[page];
  if (!expected) return true;
  const actual = await sha256Hex(`${SECTION_PASSWORD_SALT}:${page}:${password}`);
  return actual === expected;
}
