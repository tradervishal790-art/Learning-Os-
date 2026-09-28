// Usage: node scripts/hash-section-password.mjs <page> <password>
// Prints the hash line to paste into src/sectionPasswords.ts.
// SALT must match SECTION_PASSWORD_SALT in src/sectionPasswords.ts.
import { createHash } from 'node:crypto';

const SALT = 'learning-os-section-lock-v1';
const [page, password] = process.argv.slice(2);
if (!page || password === undefined) {
  console.error('Usage: node scripts/hash-section-password.mjs <page> <password>');
  process.exit(1);
}
const hash = createHash('sha256').update(`${SALT}:${page}:${password}`).digest('hex');
console.log(`  ${page}: '${hash}',`);
