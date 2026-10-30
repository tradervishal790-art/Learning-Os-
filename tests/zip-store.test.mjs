// Several annotated PDFs are delivered as ONE valid zip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadTs } from './helpers.mjs';

test('zip: crc32 matches zlib and the archive passes a real unzip test', async () => {
  const { buildZip, crc32, uniqueNames } = await loadTs('src/zipStore.ts');
  const a = new TextEncoder().encode('%PDF-1.7 first file');
  const b = new Uint8Array(5000).map((_, i) => (i * 7) % 251);
  assert.equal(crc32(a), nodeCrc32(Buffer.from(a)));
  assert.deepEqual(uniqueNames(['x.pdf', 'X.pdf', 'y.pdf']), ['x.pdf', 'X (2).pdf', 'y.pdf']);
  const zip = buildZip([{ name: 'one-annotated.pdf', data: a }, { name: 'one-annotated.pdf', data: b }]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const file = join(dir, 't.zip');
  writeFileSync(file, zip);
  const out = execFileSync('python3', ['-c', `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(','.join(z.namelist())); print(len(z.read(z.namelist()[1])))`, file]).toString().trim().split('\n');
  assert.equal(out[0], 'one-annotated.pdf,one-annotated (2).pdf');
  assert.equal(out[1], '5000');
});
