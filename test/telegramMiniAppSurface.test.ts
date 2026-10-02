import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Telegram Mini App accepts only known view deep links and preserves legacy receipt case priority', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/searchParams/);
  assert.match(app,/params\.get\('view'\)/);
  assert.match(app,/\['home','launches','rats','watches','about'\]\.includes\(requestedView\)/);
  assert.match(app,/if\(requestedCase\) await loadCase\(requestedCase\)/);
  assert.match(app,/else if\([^\n]+requestedView[^\n]+\) show\(requestedView\)/);
});

test('Mini App exposes Fresh Garbage and Rat Watch without leaking stale navigation language', () => {
  const html=readFileSync(new URL('../web/app/index.html',import.meta.url),'utf8');
  assert.match(html,/id="watches"/);
  assert.match(html,/data-view="watches"/);
  assert.match(html,/RAT WATCH/);
  assert.match(html,/FRESH GARBAGE/);
  assert.doesNotMatch(html,/>RATS</);
  assert.doesNotMatch(html,/REPEAT DEPLOYERS/);
  assert.doesNotMatch(html,/PRIVATE ATTENTION/);
});

test('Mini App uses one Case intelligence endpoint for WHY, Trash Trail, Replay and Watch handoffs', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/WHY THIS\?/);
  assert.match(app,/DIG DEEPER/);
  assert.match(app,/FOUND SOMETHING\./);
  assert.match(app,/renderCaseWhy/);
  assert.match(app,/renderCaseTrashTrail/);
  assert.match(app,/renderCaseReplay/);
  assert.match(app,/handoffFor\(caseModel,'WATCH_DEPLOYER'\)/);
  assert.match(app,/api\('\/api\/miniapp\/case-intelligence',\{launchId\}\)/);
  assert.match(app,/OPEN RECEIPTS/);
  assert.doesNotMatch(app,/\/api\/miniapp\/trash-trail/);
  assert.doesNotMatch(app,/\/api\/miniapp\/replay/);
});

test('Mini App fences a stale Case response instead of replacing the newest selected target', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/caseRequestId: 0/);
  assert.match(app,/const requestId=\+\+state\.caseRequestId/);
  assert.match(app,/if\(requestId!==state\.caseRequestId\) return/);
  assert.match(app,/if\(id!==\'case\'\) state\.caseRequestId\+=1/);
});

test('Mini App renders factual Case reasons before deeper surfaces', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/caseModel\.facts/);
  assert.match(app,/fact\.evidenceClass/);
  assert.match(app,/fact\.detail/);
  assert.match(app,/fact\.caveat/);
  assert.match(app,/Missing evidence stays missing/);
  assert.match(app,/CLAIM BOUNDARY/);
  assert.doesNotMatch(app,/score|win rate|BUY SIGNAL|SELL SIGNAL|SAFE WALLET/i);
});

test('Mini App renders server-projected Trash Trail values and never invents frontend valuation math', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/trashTrail\.summary\?\.coverageText/);
  assert.match(app,/Highest retained sample among 5m \/ 1h \/ 24h only/);
  assert.match(app,/observation\.horizonLabel/);
  assert.match(app,/observation\.valueText/);
  assert.match(app,/PERSISTED_TOKEN_IDENTITY/);
  assert.doesNotMatch(app,/pons_outcome_receipts|pons_token_identity_receipts|pons_funding_receipts/);
  assert.doesNotMatch(app,/estimatedFdvQuoteRaw|quoteDecimals|totalSupply|quoteReserve|tokenReserve/);
  assert.doesNotMatch(app,/\/api\/miniapp\/(?:watch|unwatch)/);
});

test('Mini App Replay shows point-in-time receipt states without doing valuation math', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/POINT-IN-TIME\./);
  assert.match(app,/KNOWABLE AS OF BLOCK/);
  assert.match(app,/receipt block/);
  assert.match(app,/Later receipts do not leak backward/);
  assert.match(app,/replay\.previousLaunches/);
  assert.match(app,/replay\.boundaries\?\.ingestionAudit/);
});

test('Mini App Rat Watch presents recognizable trail context before protocol identifiers', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/watchLabels/);
  assert.match(app,/I'll squeak if this exact deployer launches again/);
  assert.match(app,/Pons-reported deployer/);
  assert.doesNotMatch(app,/\$\{watch\.chainId\} · \$\{watch\.policy\}/);
  assert.doesNotMatch(app,/Future indexed launches after block/);
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
  assert.match(app,/TRASH TRAIL/);
});
