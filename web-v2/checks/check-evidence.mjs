import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url);
const files = [];
function collect(path) {
  for (const name of readdirSync(path)) {
    const target = join(path, name);
    if (statSync(target).isDirectory()) collect(target);
    else if (/\.(ts|tsx|css)$/.test(name)) files.push(target);
  }
}
collect(root.pathname);
const corpus = files.map((file) => readFileSync(file, 'utf8')).join('\n').toUpperCase();
for (const phrase of ['SAFE SCORE', 'RUG SCORE', 'RUG PROBABILITY', 'SCAM PROBABILITY', 'GOOD BUY', 'BUY_ELIGIBLE']) {
  if (corpus.includes(phrase)) throw new Error(`V2_CLAIM_BOUNDARY_VIOLATION:${phrase}`);
}
for (const phrase of ['OBSERVED', 'NOTED', 'UNKNOWN', 'COMPLETE', 'PARTIAL', 'UNVERIFIED', 'NOT_LAUNCHED']) {
  if (!corpus.includes(phrase)) throw new Error(`V2_EVIDENCE_SEMANTIC_MISSING:${phrase}`);
}
if (!corpus.includes('AN OBSERVED RECIPIENT ADDRESS IS NOT AUTOMATICALLY A HUMAN TRADER IDENTITY')) throw new Error('V2_IDENTITY_BOUNDARY_MISSING');
if (!corpus.includes('IT IS NOT A BUY/SELL RECOMMENDATION')) throw new Error('V2_RECOMMENDATION_BOUNDARY_MISSING');
if (!corpus.includes("'IDLE'") || !corpus.includes("'RECEIPT_VERIFIED'")) throw new Error('V2_RIVE_STATE_CONTRACT_MISSING');
console.log('BINRAT V2 evidence semantics: PASS');
