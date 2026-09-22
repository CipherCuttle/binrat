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
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
if (app.includes('?? feed.bags[0]')) throw new Error('V2_BAG_ID_MUST_NOT_FALL_BACK');
for (const phrase of [
  'findBagAtCheckpoint(feed, route.id)',
  'NO MATCHING BAG IN THIS INDEX.',
  'radarShortlistCounts(radar)',
  'SYNTHETIC; NOT CHAIN RECEIPTS',
  'onKeyDown={onReplayKeyDown}',
  'replayStagesForBag(bag, mode)',
  'key={selected.observedRecipientAddress}',
  'key={requestedBag.id}',
]) {
  if (!app.includes(phrase)) throw new Error(`V2_EVIDENCE_INTEGRITY_MISSING:${phrase}`);
}
console.log('BINRAT V2 evidence semantics and integrity: PASS');
