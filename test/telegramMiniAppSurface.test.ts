import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Telegram Mini App accepts only known view deep links and preserves case priority', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/searchParams/);
  assert.match(app,/params\.get\('view'\)/);
  assert.match(app,/\['home','launches','rats','watches','about'\]\.includes\(requestedView\)/);
  assert.match(app,/if\(requestedCase\) await loadCase\(requestedCase\)/);
  assert.match(app,/else if\([^\n]+requestedView[^\n]+\) show\(requestedView\)/);
});

test('Mini App exposes Rat Watch without leaking the internal RATS name into navigation', () => {
  const html=readFileSync(new URL('../web/app/index.html',import.meta.url),'utf8');
  assert.match(html,/id="watches"/);
  assert.match(html,/data-view="watches"/);
  assert.match(html,/RAT WATCH/);
  assert.match(html,/FRESH GARBAGE/);
  assert.doesNotMatch(html,/>RATS</);
  assert.doesNotMatch(html,/REPEAT DEPLOYERS/);
  assert.doesNotMatch(html,/PRIVATE ATTENTION/);
});

test('Mini App progressively discloses Trash Trail before raw receipts and keeps Rat Trap fail-closed', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/DIG DEEPER/);
  assert.match(app,/TRASH TRAIL/);
  assert.match(app,/OPEN RECEIPTS/);
  assert.match(app,/RAT TRAP/);
  assert.match(app,/Outcome context is not shown here yet/);
  assert.match(app,/No market-cap, ATH, lifespan or profitability claim is being made/);
  assert.match(app,/Not a verdict\. Human identity, intent, safety and future outcome stay unknown/);
  assert.doesNotMatch(app,/PONS 4663 · READY · block/);
  assert.match(app,/PROOF \/ HISTORICAL EVIDENCE/);
  assert.match(app,/I can't verify this receipt right now/);
  assert.doesNotMatch(app,/Receipt unavailable: \$\{error\.message\}/);
});

test('Mini App Rat Watch presents recognizable trail context before protocol identifiers', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/watchLabels/);
  assert.match(app,/I'll squeak if these paws launch again/);
  assert.match(app,/Pons-reported deployer/);
  assert.doesNotMatch(app,/\$\{watch\.chainId\} · \$\{watch\.policy\}/);
  assert.doesNotMatch(app,/Future indexed launches after block/);
});
