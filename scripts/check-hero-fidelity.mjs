import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../web/hero-fidelity.css', import.meta.url), 'utf8');
const svg = readFileSync(new URL('../web/binrat-hero.svg', import.meta.url), 'utf8');
const receipt = readFileSync(new URL('../docs/HERO_ASSET.md', import.meta.url), 'utf8');

for (const marker of ['./binrat-hero.svg', './hero-fidelity.css', 'width="512"', 'height="512"']) {
  if (!html.includes(marker)) throw new Error(`HERO_FIDELITY_HTML_DRIFT:${marker}`);
}

if (!css.includes('image-rendering: auto')) throw new Error('HERO_FIDELITY_INTERPOLATION_MISSING');
if (css.includes('image-rendering: pixelated')) throw new Error('HERO_FIDELITY_PIXEL_FORCING_REINTRODUCED');

const match = svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
if (!match) throw new Error('HERO_FIDELITY_EMBEDDED_WEBP_MISSING');
const bytes = Buffer.from(match[1], 'base64');
if (bytes.length !== 30850) throw new Error(`HERO_FIDELITY_BYTE_SIZE_DRIFT:${bytes.length}`);
const digest = createHash('sha256').update(bytes).digest('hex');
const expected = 'f1cd98539d4eade13204904e0c707d81cf9de9be7451ee746e92b10189a2c648';
if (digest !== expected) throw new Error(`HERO_FIDELITY_DIGEST_DRIFT:${digest}`);

for (const marker of [
  '6f22821dfad44309638dd0d08b0dfba8b08d74f324abf89795188d4dbed275fe',
  expected,
  '56c437f8-98f9-4eae-887f-cfcc40c26dff.png'
]) {
  if (!receipt.includes(marker)) throw new Error(`HERO_FIDELITY_RECEIPT_DRIFT:${marker}`);
}

console.log('BINRAT hero fidelity invariants: PASS');
