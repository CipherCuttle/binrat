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

test('Mini App progressively discloses real Trash Trail outcome memory before raw receipts', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/DIG DEEPER/);
  assert.match(app,/TRASH TRAIL/);
  assert.match(app,/OPEN RECEIPTS/);
  assert.match(app,/api\('\/api\/miniapp\/trash-trail',\{launchId:latest\.launchId\}\)/);
  assert.match(app,/trashTrail\.summary\?\.coverageText/);
  assert.match(app,/Highest retained sample among 5m \/ 1h \/ 24h only/);
  assert.match(app,/trashTrail\.summary\?\.canOfferRatWatch/);
  assert.match(app,/observation\.horizonLabel/);
  assert.match(app,/observation\.valueText/);
  assert.match(app,/PERSISTED_TOKEN_IDENTITY/);
  assert.match(app,/SEE RAT WATCH/);
  assert.doesNotMatch(app,/Outcome context is not shown here yet/);
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

test('Mini App Trash Trail remains read-only and does not invent frontend valuation math', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/pons_outcome_receipts|pons_token_identity_receipts/);
  assert.doesNotMatch(app,/estimatedFdvQuoteRaw|quoteDecimals|totalSupply|quoteReserve|tokenReserve/);
  assert.doesNotMatch(app,/\/api\/miniapp\/(?:watch|unwatch)/);
});

test('Mini App shell integrates Telegram BackButton without changing backend state', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/BackButton\?\.onClick\?\.\(backView\)/);
  assert.match(app,/if\(state\.view==='home'\) back\.hide\(\)/);
  assert.match(app,/else back\.show\(\)/);
  assert.match(app,/state\.viewStack\.push\(previous\)/);
  assert.match(app,/const prior=state\.viewStack\.pop\(\) \|\| 'home'/);
  assert.match(app,/show\(prior,\{remember:false\}\)/);
  assert.doesNotMatch(app,/history\.pushState|history\.replaceState/);
});


test('public Mini App contract never exposes stale RAT TRAP naming', () => {
  const html=readFileSync(new URL('../web/app/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/RAT TRAP/);
  assert.doesNotMatch(app,/RAT TRAP|\/api\/miniapp\/rat-trap|\bratTrap\b/);
  assert.match(app,/\/api\/miniapp\/trash-trail/);
  assert.match(app,/\btrashTrail\b/);
});
