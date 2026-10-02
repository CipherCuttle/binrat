import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Telegram Mini App accepts only known view deep links and preserves case priority', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/searchParams/);
  assert.match(app,/params\.get\('view'\)/);
  assert.match(app,/\['home','hot','launches','watches','about'\]\.includes\(requestedView\)/);
  assert.match(app,/if\(requestedCase\) await loadCase\(requestedCase\)/);
  assert.match(app,/else if\([^\n]+requestedView[^\n]+\) show\(requestedView\)/);
});

test('Mini App restores the canonical Hot Garbage language and keeps protocol jargon below the first layer', () => {
  const html=readFileSync(new URL('../web/app/index.html',import.meta.url),'utf8');
  assert.match(html,/He gets the scraps\./);
  assert.match(html,/You get the receipts/);
  assert.match(html,/HOT GARBAGE/);
  assert.match(html,/NEW DROPS/);
  assert.match(html,/RAT WATCH/);
  assert.match(html,/Memory beats prediction\. Receipts beat scores\./);
  assert.doesNotMatch(html,/FRESH GARBAGE/);
  assert.doesNotMatch(html,/>RATS</);
  assert.doesNotMatch(html,/LATEST LAUNCHES/);
  assert.doesNotMatch(html,/PRIVATE ATTENTION/);
});

test('Mini App loads HOT, NEW and WATCH independently instead of using the writeful bootstrap cliff', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/api\('\/api\/miniapp\/hot',\{\}\)/);
  assert.match(app,/api\('\/api\/miniapp\/latest',\{\}\)/);
  assert.match(app,/api\('\/api\/miniapp\/watches',\{\}\)/);
  assert.match(app,/Promise\.all\(\[loadHot\(\),loadLatest\(\),loadWatches\(\)\]\)/);
  assert.doesNotMatch(app,/api\('\/api\/miniapp\/bootstrap'/);
  assert.match(app,/Hot Garbage is unavailable right now/);
  assert.match(app,/New Drops are unavailable right now/);
  assert.match(app,/Rat Watch is unavailable right now\. Hot Garbage and New Drops can still work/);
  assert.match(app,/CACHE_MAX_AGE_MS=60\*60\*1000/);
  assert.match(app,/Showing the last verified snapshot from this device/);
  assert.match(app,/source-badge'\)\.textContent='STALE'/);
});

test('Hot Garbage is a transparent attention surface, not an opaque hype score', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/Same paws launched/);
  assert.match(app,/Rat memory:/);
  assert.match(app,/outcome receipt/);
  assert.match(app,/DIG/);
  assert.doesNotMatch(app,/hype score|safety score|smart money score|BUY|SELL/i);
});

test('Mini App progressively discloses real Rat Trap outcome memory before raw receipts', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/TRASH TRAIL/);
  assert.match(app,/RECEIPTS/);
  assert.match(app,/api\('\/api\/miniapp\/rat-trap',\{launchId:latest\.launchId\}\)/);
  assert.match(app,/ratTrap\.summary\?\.coverageText/);
  assert.match(app,/Highest supported sample:/);
  assert.match(app,/ratTrap\.summary\?\.canOfferRatWatch/);
  assert.match(app,/SEE RAT WATCH/);
  assert.match(app,/api\('\/api\/miniapp\/dig',\{deployer\}\)/);
  assert.doesNotMatch(app,/pons_outcome_receipts/);
  assert.doesNotMatch(app,/estimatedFdvQuoteRaw|quoteDecimals|totalSupply|quoteReserve|tokenReserve/);
  assert.doesNotMatch(app,/\/api\/miniapp\/(?:watch|unwatch)/);
});

test('Mini App Rat Watch presents recognizable context before protocol detail', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/watchLabels/);
  assert.match(app,/I'll squeak if these paws launch again/);
  assert.match(app,/WATCHED PAWS/);
  assert.doesNotMatch(app,/Future indexed launches after block/);
  assert.doesNotMatch(app,/\$\{watch\.chainId\} · \$\{watch\.policy\}/);
});

test('Mini App keeps raw receipt detail behind explicit user action', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  const digCall=app.indexOf("api('/api/miniapp/dig',{deployer})");
  const clickHandler=app.indexOf("receipts.addEventListener('click'");
  assert.ok(digCall>0);
  assert.ok(clickHandler>0);
  assert.ok(digCall<clickHandler || app.indexOf('openReceiptsForDeployer')<clickHandler);
  assert.match(app,/block hash/);
  assert.match(app,/fact \$\{ref\.factId\}/);
});

test('Mini App shell integrates Telegram BackButton without changing navigation history', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/BackButton\?\.onClick\?\.\(backView\)/);
  assert.match(app,/if\(state\.view==='home'\) back\.hide\(\)/);
  assert.match(app,/else back\.show\(\)/);
  assert.match(app,/state\.viewStack\.push\(previous\)/);
  assert.match(app,/const prior=state\.viewStack\.pop\(\) \|\| 'home'/);
  assert.match(app,/show\(prior,\{remember:false\}\)/);
  assert.doesNotMatch(app,/history\.pushState|history\.replaceState/);
});
