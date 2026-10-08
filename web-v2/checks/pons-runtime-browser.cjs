/* Pinned Playwright 1.56.1. Real public GETs first; adverse states are explicitly simulated. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.BINRAT_PREVIEW_URL || 'http://127.0.0.1:4188';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const output = path.resolve(process.env.BINRAT_PONS_OUTPUT || 'browser-artifacts/pons-runtime');
const source = 'https://binrat-read-plane-stability-candidate.pettevik.workers.dev';
const allowed = ['/api/status', '/api/launches/latest'];
fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 'binrat.pons-browser-proof/1', startedAt: new Date().toISOString(), checks: [], sources: [], measurements: [], errors: [], requests: [], verdict: 'BLOCKED', productionAuthorization: false };
report.sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
report.sourceDirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
const save = (name, value) => { const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const clone = value => structuredClone(value);
const tab = (page, name) => page.getByRole('tab', { name: new RegExp('\\b' + name + '\\b') });
const stamp = page => page.locator('.vl-lab-stamp b');
const caseButton = (page, id) => page.getByRole('button', { name: 'Open Case ' + id, exact: true });
async function check(name, evidence, fn) { await fn(); report.checks.push({ name, evidence, result: 'PASS' }); console.log('PASS ' + name); }
async function capture(page, name, fullPage = false) {
  const file = path.join(output, name + '.png'); fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage });
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth, width: innerWidth }));
  assert.ok(dimensions.document <= dimensions.width && dimensions.body <= dimensions.width, JSON.stringify(dimensions));
}
function record(page, label, simulated = false) {
  const errors = [], requests = [], bodies = {}, pending = [];
  page.on('pageerror', error => { const item = { label, simulated, type: 'pageerror', message: error.message }; errors.push(item); report.errors.push(item); });
  page.on('console', message => { if (message.type() === 'error') { const item = { label, simulated, type: 'console', message: message.text() }; errors.push(item); report.errors.push(item); } });
  page.on('requestfailed', request => report.errors.push({ label, simulated, type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('request', request => { const item = { label, simulated, method: request.method(), url: request.url() }; requests.push(item); report.requests.push(item); });
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith('/api/')) pending.push((async () => {
      let body; try { body = await response.json(); } catch { body = null; }
      bodies[pathname] = { httpStatus: response.status(), body, headers: await response.allHeaders() };
      save((simulated ? 'simulated/' : 'real/') + label + pathname.replaceAll('/', '-') + '.json', bodies[pathname]);
    })());
    if (response.status() >= 400) report.errors.push({ label, simulated, type: 'http', httpStatus: response.status(), url: response.url() });
  });
  return { errors, requests, bodies, pending };
}
async function ready(page) {
  await page.goto(base + '/?visual=lab&ponsPreview=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('.vl-utility')?.disabled);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
}
async function recheck(page) {
  const reply = page.waitForResponse(response => new URL(response.url()).pathname === '/api/launches/latest');
  await page.getByRole('button', { name: 'RECHECK', exact: true }).click();
  await (await reply).finished();
  await page.getByRole('button', { name: 'RECHECK', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.vl-utility').disabled);
}
async function main() {
  const { loadPonsPreview } = await import(pathToFileURL(path.resolve(__dirname, '../src/pons-readonly-preview.mjs')));
  const { canonicalSnapshotDigest } = await import(pathToFileURL(path.resolve(__dirname, '../../web/snapshot-contract.js')));
  const browser = await chromium.launch({ headless: true }); report.browser = browser.version();
  let transport, selectedId;
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [768, 1024]]) {
      const label = width + 'x' + height, context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        window.__ponsVitals = { cls: 0, lcp: 0 };
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__ponsVitals.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__ponsVitals.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const page = await context.newPage(), observed = record(page, label);
      await ready(page); await Promise.all(observed.pending);
      const feed = observed.bodies['/api/launches/latest'], status = observed.bodies['/api/status'];
      assert.equal(feed?.httpStatus, 200, 'real source unavailable: no fixture fallback'); assert.equal(status?.httpStatus, 200);
      for (const item of [feed, status]) {
        assert.equal(item.headers['x-binrat-preview-source'], source);
        assert.match(item.headers['x-binrat-source-sha'], /^[0-9a-f]{40}$/);
        assert.match(item.headers['x-binrat-build-id'], /^[0-9a-f]{64}$/);
      }
      assert.equal(feed.headers['x-binrat-source-sha'], status.headers['x-binrat-source-sha']);
      assert.equal(feed.headers['x-binrat-build-id'], status.headers['x-binrat-build-id']);
      const verified = await loadPonsPreview({ fetchImpl: async p => ({ ok: true, json: async () => p === '/api/status' ? status.body : feed.body }) });
      assert.ok(verified.cases.length, 'a healthy empty feed cannot prove a Case');
      if (!selectedId) { selectedId = verified.cases[0].id; transport = { feed: clone(feed.body), status: clone(status.body) }; }
      const selected = verified.cases.find(item => item.id === selectedId);
      assert.ok(selected, 'selected real Case left the bounded snapshot; no replacement allowed');
      await caseButton(page, selectedId).click(); await page.evaluate(() => scrollTo(0, 0));
      report.sources.push({ label, origin: source, releaseSha: feed.headers['x-binrat-source-sha'], buildId: feed.headers['x-binrat-build-id'], status: status.body, selected, historyCoverage: feed.body.historyCoverage, independentRpcExecutionVerified: false });
      await check(label + ': real Case and source-bound WHAT', 'REAL_PUBLIC_GET', async () => {
        assert.equal(await page.locator('#vl-case').getAttribute('data-case'), selectedId);
        const text = await page.getByRole('tabpanel').innerText();
        for (const value of [selected.token, selected.txHash, selected.reportedCreatorAddress, selected.block]) assert.ok(text.includes(value));
        assert.match(await stamp(page).innerText(), /PONS READ-ONLY · (FRESH_VERIFIED|STALE_VERIFIED)/);
        if (verified.freshness === 'STALE_VERIFIED') { assert.match(await stamp(page).innerText(), /STALE_VERIFIED/); assert.doesNotMatch(await page.locator('h1').innerText(), /FRESH/); }
        const button = await page.locator('.vl-case-intro .vl-primary').boundingBox();
        assert.ok(button && button.y >= 0 && button.y + button.height <= height, 'primary action outside first viewport');
        assert.deepEqual(await page.evaluate(() => [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src)), []);
        const overlaps = await page.evaluate(() => {
          const heading = document.querySelector('.vl-case-intro h1'), art = document.querySelector('.vl-case-art').getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(heading);
          return [...range.getClientRects()].filter(r => Math.min(r.right, art.right) - Math.max(r.left, art.left) > 1 && Math.min(r.bottom, art.bottom) - Math.max(r.top, art.top) > 1).length;
        }); assert.equal(overlaps, 0, 'heading overlaps illustration'); await noOverflow(page);
      });
      await capture(page, 'real/' + label + '-what'); await capture(page, 'real/' + label + '-what-full', true);
      await page.locator('.vl-discovery').screenshot({ path: path.join(output, 'real', label + '-finds.png') });
      report.measurements.push(await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], ...window.__ponsVitals, imageBytes: performance.getEntriesByType('resource').filter(r => /\.(webp|png)/.test(r.name)).reduce((n, r) => n + r.encodedBodySize, 0), blurLayers: [...document.querySelectorAll('.visual-lab *')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length })));
      await check(label + ': supported TRAIL, expanded RECEIPTS and truthful NEXT', 'REAL_PUBLIC_GET', async () => {
        await page.getByRole('button', { name: 'FOLLOW THE TRAIL →', exact: true }).click();
        assert.equal(await tab(page, 'TRAIL').getAttribute('aria-selected'), 'true');
        assert.match(await page.getByRole('tabpanel').innerText(), /unknown|not included/i);
        assert.equal(await page.locator('.vl-timeline').count(), 0);
        await capture(page, 'real/' + label + '-trail', true); await noOverflow(page);
        await page.getByRole('button', { name: 'CHECK RECEIPTS →', exact: true }).click();
        await page.locator('summary').click();
        const receipt = JSON.parse(await page.locator('.vl-receipt-body pre').innerText());
        assert.equal(receipt.launchId, selectedId); assert.equal(receipt.txHash, selected.txHash);
        assert.equal(receipt.checkpointBlock, status.body.checkpointBlock); assert.equal(receipt.checkpointBlockHash, status.body.checkpointBlockHash);
        assert.equal(receipt.feedDigest, status.body.feedDigest); assert.equal(receipt.chainId, 4663);
        assert.match(await page.getByRole('tabpanel').innerText(), /does not independently verify transaction execution from RPC/);
        await capture(page, 'real/' + label + '-receipts', true); await noOverflow(page);
        await page.getByRole('button', { name: 'REVIEW NEXT ACTIONS →', exact: true }).click();
        assert.match(await page.getByRole('tabpanel').innerText(), /WATCH IS NOT TRIPWIRE.*Tripwire is BUILDING; Sniffer is PROVING.*Working Rat is PLANNED/s);
        assert.equal(await page.getByRole('button', { name: /start watch|arm|employ|connect wallet|trade/i }).count(), 0);
        await capture(page, 'real/' + label + '-next', true); await noOverflow(page);
      });
      await check(label + ': keyboard stages and read-only network', 'REAL_PUBLIC_GET', async () => {
        await tab(page, 'NEXT').focus(); await page.keyboard.press('Home');
        assert.equal(await tab(page, 'WHAT').getAttribute('aria-selected'), 'true');
        await page.keyboard.press('ArrowRight'); assert.equal(await tab(page, 'TRAIL').getAttribute('aria-selected'), 'true');
        await page.keyboard.press('End'); assert.equal(await tab(page, 'NEXT').getAttribute('aria-selected'), 'true');
        for (const request of observed.requests) {
          assert.equal(request.method, 'GET'); assert.equal(new URL(request.url).origin, base);
          if (new URL(request.url).pathname.startsWith('/api/')) assert.ok(allowed.includes(new URL(request.url).pathname));
        }
        assert.deepEqual(observed.errors, []);
      });
      await context.close();
    }
    // All transports below are simulated controls derived from the saved real response.
    async function fixture() {
      const data = clone(transport), now = Date.now();
      data.status.state = 'FRESH_VERIFIED'; data.status.verifiedAtMs = now - 1000; data.status.runtimeUpdatedAtMs = now - 1000;
      data.status.freshnessValidUntilMs = now + 60000; data.status.lastSyncError = null;
      return data;
    }
    async function rebind(data) { data.feed.feedDigest = await canonicalSnapshotDigest(data.feed); data.status.feedDigest = data.feed.feedDigest; }
    async function simulated(name, mutate, inspect) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), observed = record(page, name, true), state = { data: await fixture(), unavailable: false };
      await mutate(state, page);
      await page.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname;
        assert.ok(allowed.includes(p)); assert.equal(route.request().method(), 'GET');
        await route.fulfill({ status: state.unavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(state.unavailable ? { error: 'SIMULATED_UPSTREAM_UNAVAILABLE' } : p === '/api/status' ? state.data.status : state.data.feed) });
      });
      try {
        await ready(page); await inspect(page, state); await noOverflow(page);
        assert.equal(observed.errors.filter(e => e.type === 'pageerror').length, 0);
        await capture(page, 'simulated/' + name, true);
        report.checks.push({ name, evidence: 'SIMULATED_ADVERSE_CONTROL', result: 'PASS' }); console.log('PASS simulated ' + name);
      } finally { await context.close(); }
    }
    const unavailable = async page => { assert.match(await stamp(page).innerText(), /UNAVAILABLE/); assert.equal(await page.locator('#vl-case').count(), 0); assert.match(await page.locator('.vl-discovery').innerText(), /Nothing was substituted/); };
    for (const name of ['wrong-chain', 'bad-digest', 'checkpoint-hash', 'no-snapshot', 'http-503', 'future-timestamp']) {
      await simulated(name, async state => {
        if (name === 'wrong-chain') state.data.feed.chainId = 5042;
        if (name === 'bad-digest') state.data.feed.launches[0].symbol = 'TAMPERED';
        if (name === 'checkpoint-hash') state.data.status.checkpointBlockHash = '0x' + 'f'.repeat(64);
        if (name === 'no-snapshot') { state.data.status.state = 'NO_VERIFIED_SNAPSHOT'; for (const key of ['checkpointBlock', 'checkpointBlockHash', 'feedDigest', 'verifiedAtMs', 'publicationVersion', 'freshnessValidUntilMs']) state.data.status[key] = null; }
        if (name === 'http-503') state.unavailable = true;
        if (name === 'future-timestamp') state.data.status.verifiedAtMs = Date.now() + 100000;
      }, unavailable);
    }
    for (const name of ['expired-freshness', 'verified-stale']) await simulated(name, async state => {
      if (name === 'expired-freshness') state.data.status.freshnessValidUntilMs = Date.now() - 1;
      else { state.data.status.state = 'STALE_VERIFIED'; state.data.status.lastSyncError = 'SIMULATED_SYNC_FAILED'; }
    }, async page => { assert.match(await stamp(page).innerText(), /STALE_VERIFIED/); assert.doesNotMatch(await page.locator('h1').innerText(), /FRESH/); assert.ok(await page.locator('#vl-case').count()); });
    await simulated('healthy-empty', async state => { state.data.feed.launches = []; await rebind(state.data); }, async page => {
      assert.match(await stamp(page).innerText(), /FRESH_VERIFIED/); assert.match(await page.locator('.vl-discovery').innerText(), /Verified empty feed/); assert.equal(await page.locator('#vl-case').count(), 0);
    });
    await simulated('missing-history-and-optional-data', async () => {}, async (page, state) => {
      await tab(page, 'TRAIL').click(); assert.match(await page.getByRole('tabpanel').innerText(), /partial index|not included/i);
      await tab(page, 'RECEIPTS').click(); await page.locator('summary').click(); assert.match(await page.getByRole('tabpanel').innerText(), /intelligence and replay are not loaded/);
      assert.equal(await page.locator('.vl-timeline').count(), 0);
      const transitions = await page.evaluate(() => [...document.querySelectorAll('.visual-lab *')].filter(e => getComputedStyle(e).animationName !== 'none' || getComputedStyle(e).transitionDuration.split(',').some(t => parseFloat(t) > 0)).length);
      assert.equal(transitions, 0, 'reduced-motion compliance');
    });
    await simulated('rapid-case-selection', async () => {}, async (page, state) => {
      assert.ok(state.data.feed.launches.length >= 3);
      for (const i of [2, 0, 1]) await caseButton(page, state.data.feed.launches[i].launchId).click();
      await tab(page, 'RECEIPTS').click(); await page.locator('summary').click();
      assert.equal(JSON.parse(await page.locator('pre').innerText()).launchId, state.data.feed.launches[1].launchId);
    });
    for (const explicit of [false, true]) await simulated('selected-case-disappears-' + (explicit ? 'explicit' : 'initial'), async () => {}, async (page, state) => {
      const id = state.data.feed.launches[0].launchId; if (explicit) await caseButton(page, id).click();
      state.data.feed.launches.shift(); state.data.feed.sourceCheckpoint = String(BigInt(state.data.feed.sourceCheckpoint) + 1n);
      state.data.status.checkpointBlock = state.data.feed.sourceCheckpoint; state.data.status.publicationVersion += 1; state.data.status.verifiedAtMs += 1;
      await rebind(state.data); await recheck(page);
      await page.locator('#vl-case').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#vl-case').count(), 0); assert.match(await page.locator('.vl-workspace').innerText(), /Selected Case unavailable.*No replacement/s);
    });
    await simulated('retained-snapshot-after-503', async () => {}, async (page, state) => {
      const id = await page.locator('#vl-case').getAttribute('data-case'); state.unavailable = true;
      await recheck(page); await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('#vl-case').getAttribute('data-case'), id); assert.match(await stamp(page).innerText(), /STALE_VERIFIED/);
      assert.match(await page.getByRole('alert').innerText(), /Last verified snapshot retained/);
    });
    await simulated('canonical-same-checkpoint-conflict', async () => {}, async (page, state) => {
      const id = await page.locator('#vl-case').getAttribute('data-case'); state.data.feed.launches[0].symbol = 'SIMULATED_CONFLICT'; await rebind(state.data);
      await recheck(page); await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('#vl-case').getAttribute('data-case'), id); assert.match(await page.getByRole('alert').innerText(), /CHECKPOINT_CONFLICT/);
      assert.match(await stamp(page).innerText(), /STALE_VERIFIED/); assert.doesNotMatch(await page.locator('#vl-case').innerText(), /SIMULATED_CONFLICT/);
    });
    await simulated('hidden-tab-expiry', async (state, page) => { await page.clock.install({ time: new Date() }); state.data.status.freshnessValidUntilMs = Date.now() + 10000; }, async page => {
      assert.match(await stamp(page).innerText(), /FRESH_VERIFIED/); await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
      await page.clock.fastForward(11000); assert.match(await stamp(page).innerText(), /STALE_VERIFIED/);
    });
    await simulated('resume-before-throttled-expiry-timer', async (state, page) => { await page.clock.install({ time: new Date() }); }, async page => {
      assert.match(await stamp(page).innerText(), /FRESH_VERIFIED/);
      await page.clock.setSystemTime(new Date(Date.now() + 70000));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.waitForFunction(() => document.querySelector('.vl-lab-stamp b').textContent.includes('STALE_VERIFIED'));
      assert.doesNotMatch(await page.locator('h1').innerText(), /FRESH/);
    });
    await simulated('missing-symbol-with-supported-name', async state => {
      state.data.feed.launches[0].name = 'SIMULATED_SUPPORTED_NAME'; state.data.feed.launches[0].symbol = ''; await rebind(state.data);
    }, async page => {
      assert.match(await page.getByRole('tabpanel').innerText(), /Token name: SIMULATED_SUPPORTED_NAME\. Symbol: Not provided/);
      assert.doesNotMatch(await page.getByRole('tabpanel').innerText(), /name and symbol are missing/);
    });
    // Extra width sanity checks use a saved real transport; they are not live screenshots.
    for (const width of [320, 360, 430, 1024]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1024 ? 900 : 844 } }), page = await context.newPage();
      await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(new URL(route.request().url()).pathname === '/api/status' ? transport.status : transport.feed) }));
      await ready(page); await noOverflow(page); await capture(page, 'simulated/width-' + width, true);
      report.checks.push({ name: width + 'px overflow sanity', evidence: 'RECORDED_SOURCE_REPLAY', result: 'PASS' }); await context.close();
    }
    report.verdict = 'PASS';
  } finally {
    report.completedAt = new Date().toISOString(); save('browser-proof.json', report); save('network-requests.json', report.requests); await browser.close();
  }
}
main().catch(error => { report.failure = error.stack; save('browser-proof.json', report); console.error(error); process.exitCode = 1; });
