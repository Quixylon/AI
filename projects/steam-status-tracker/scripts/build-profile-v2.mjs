import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const root = 'projects/steam-status-tracker/public/profile-v2';
const encoded = [1, 2, 3, 4]
  .map((index) => readFileSync(join(root, `payload-${index}.txt`), 'utf8').trim())
  .join('');

const html = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
writeFileSync(join(root, 'index.html'), html);
console.log(`Built profile-v2/index.html (${Buffer.byteLength(html)} bytes)`);
