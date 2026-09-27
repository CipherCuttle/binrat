import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const key = process.env.REACTBITS_LICENSE_KEY;
if (!key) throw new Error('REACTBITS_LICENSE_KEY unavailable. Only the isolated branch push job may fetch paid source.');
const response = await fetch('https://pro.reactbits.dev/api/r/starter/grain-wave-css.json', {
  headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
});
if (!response.ok) throw new Error(`Official React Bits Starter registry: HTTP ${response.status}`);
const data = await response.json();
if (data.name !== 'grain-wave-css' || !Array.isArray(data.files) || data.files.length < 2) {
  throw new Error('Unexpected React Bits registry payload; refusing unknown component');
}
const tsx = data.files.find(f => String(f.path).endsWith('/grain-wave.tsx') || String(f.path) === 'grain-wave.tsx');
const css = data.files.find(f => String(f.path).endsWith('/grain-wave.css') || String(f.path) === 'grain-wave.css');
if (!tsx?.content || !css?.content) throw new Error('Official Grain Wave TSX and CSS not provided');
for (const [file,expected] of [
  [tsx,'fa62be0dfae9716154cbc97e5c0edd8f700fa9c00edaa386dc47cb4135799fea'],
  [css,'fc12d298fc219ade95431fdf64f54fb51632e5cc82f74a5c9cd7d076aaba1586']
]) {
  const observed=createHash('sha256').update(file.content).digest('hex');
  if (observed !== expected) throw new Error('The official component updated; inspect and intentionally repin before shipping');
}
const dest=resolve('src','premium-grain');
await mkdir(dest,{recursive:true});
await writeFile(resolve(dest,'grain-wave.tsx'),tsx.content,{mode:0o600});
await writeFile(resolve(dest,'grain-wave.css'),css.content,{mode:0o600});
// No paid component source, secret, or registry response is emitted to logs or git.
console.log('Official React Bits Grain Wave downloaded; fixed source hashes verified; local files excluded from git');
