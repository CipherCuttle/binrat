/* Native pinned Playwright; compiled site and real same-origin public GETs only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const runner = createRequire(path.join(process.env.BINRAT_FRONTDOOR_TOOLS || '/tmp/binrat-v3-sprint-runner/node_modules', 'runner.cjs'));
assert.equal(runner('playwright/package.json').version, '1.56.1');
const { chromium } = runner('playwright');
const base = process.argv[2];
assert.ok(base && /^https:\/\/([a-z0-9-]+\.pettevik\.workers\.dev|binrat\.tech)$/.test(base), 'Explicit immutable preview or production origin required');
const out = path.resolve(process.argv[3] || '.artifacts/v3-live-browser');
fs.mkdirSync(out, { recursive: true });
const report = { provenance: 'REAL_SAME_ORIGIN_PUBLIC_API_COMPILED_V3', origin: base,
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), requests: [], errors: [], checks: [], viewports: [], verdict: 'FAIL' };
const tab = (page, name) => page.getByRole('tab', { name: new RegExp('\\b' + name + '\\b') });
async function check(name, run) { await run(); report.checks.push(name); console.log('PASS ' + name); }
async function capture(page, file) { await page.screenshot({ path: path.join(out, file + '.png') }); }
async function jsonGet(context, route) {
  const response = await context.request.get(base + route, { timeout: 20000 });
  assert.equal(response.status(), 200, route);
  return response.json();
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  try {
    for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'mobile'], [768, 1024, 'tablet'], [320, 800, 'narrow']]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: label === 'tablet' ? 'reduce' : 'no-preference' });
      await context.addInitScript(() => {
        window.__v3Metrics = { cls: 0, lcp: 0 };
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__v3Metrics.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { for (const e of list.getEntries()) window.__v3Metrics.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const page = await context.newPage();
      const publicResponses = [];
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('request', r => report.requests.push({ url: r.url(), method: r.method() }));
      page.on('response', async r => {
        if (new URL(r.url()).pathname.startsWith('/api/')) {
          try { publicResponses.push({ url: r.url(), status: r.status(), body: await r.json() }); } catch {}
        } else if (r.status() >= 400) report.errors.push('STATIC_HTTP_' + r.status() + ':' + r.url());
      });
      const started = Date.now();
      const html = await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(html.status(), 200);
      await page.locator('#vl-case').waitFor({ timeout: 20000 });
      const firstCaseMs = Date.now() - started;
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      const id = await page.locator('#vl-case').getAttribute('data-case');
      await check(label + ' fresh real Pons Case and responsive presentation', async () => {
        assert.match(id, /^[0-9a-f]{64}$/);
        assert.match(await page.locator('.vl-lab-stamp').innerText(), /FRESH_VERIFIED/);
        assert.match(await page.locator('.vl-live').innerText(), /SCOUT \/ LIVE/);
        assert.doesNotMatch(await page.locator('body').innerText(), /SYNTHETIC INVESTIGATION|ISOLATED CANDIDATE PREVIEW/);
        assert.ok(await page.locator('.vl-find').count() > 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 1);
        const cta = await page.locator('.vl-primary').boundingBox();
        assert.ok(cta && cta.x >= 0 && cta.x + cta.width <= width + 1 && cta.y + cta.height <= height, 'Primary CTA must be visible');
        assert.ok(await page.evaluate(() => document.fonts.check('12px "Geist Sans"') && document.fonts.check('12px "Geist Mono"')));
        if (label === 'tablet') assert.equal(await page.locator('.vl-primary').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      });
      await capture(page, label);
      if (label === 'desktop') {
        await check('real WHY → TRAIL → RECEIPTS → NEXT journey', async () => {
          assert.match(await page.getByRole('tabpanel').innerText(), /WHY HE BROUGHT IT/);
          await tab(page, 'TRAIL').click();
          await page.locator('.vl-source-trail li').first().waitFor({ timeout: 20000 });
          assert.ok(await page.locator('.vl-source-trail li').count() <= 4);
          await capture(page, 'trail');
          await tab(page, 'RECEIPTS').click();
          await page.locator('summary').click();
          const receipt = JSON.parse(await page.locator('pre').innerText());
          assert.equal(receipt.chainId, 4663); assert.equal(receipt.launchId, id);
          assert.match(receipt.checkpointBlockHash, /^0x[0-9a-f]{64}$/);
          assert.match(receipt.feedDigest, /^[0-9a-f]{64}$/);
          const source = publicResponses.find(r => r.url.endsWith('/api/launches/latest'))?.body;
          assert.ok(source && source.launches.some(l => l.launchId === id));
          assert.equal(receipt.feedDigest, source.feedDigest);
          assert.equal(receipt.checkpointBlock, source.sourceCheckpoint);
          const exactCase = await jsonGet(context, '/api/bag/' + id);
          const creator = await jsonGet(context, '/api/creator/' + receipt.reportedDeployer + '/summary');
          assert.equal(exactCase.chainId, 4663); assert.equal(exactCase.bag.id, id);
          assert.equal(creator.chainId, 4663); assert.equal(creator.reportedCreatorAddress, receipt.reportedDeployer);
          report.caseDemonstration = { caseUrl: base + '/?case=' + id, caseId: id, uiReceipt: receipt, exactCase, creator };
          await capture(page, 'receipts');
          await tab(page, 'NEXT').click();
          assert.match(await page.getByRole('tabpanel').innerText(), /UNAVAILABLE ON THIS SITE/);
          assert.match(await page.getByRole('tabpanel').innerText(), /\$BINRAT has not launched/);
          const telegram = await page.getByRole('link', { name: 'OPEN TELEGRAM RAT ↗', exact: true }).getAttribute('href');
          assert.equal(telegram, 'https://t.me/BinratBot');
          report.telegramUrl = telegram;
          assert.equal(await page.getByRole('button', { name: /watch|employ|stake|wallet|buy|trade/i }).count(), 0);
          await capture(page, 'next');
        });
      }
      const metrics = await page.evaluate(() => window.__v3Metrics);
      assert.ok(metrics.cls <= 0.1, label + ' CLS ' + metrics.cls);
      report.viewports.push({ width, height, label, firstCaseMs, ...metrics, apiResponses: publicResponses.map(r => ({ url: r.url, status: r.status, chainId: r.body.chainId })) });
      if (label === 'mobile') {
        await check('exact card selection, reload and Case deep link', async () => {
          const second = page.locator('.vl-find').nth(1);
          assert.ok(await second.count());
          const secondId = (await second.getAttribute('aria-label')).replace('Open Case ', '');
          await second.click(); assert.equal(await page.locator('#vl-case').getAttribute('data-case'), secondId);
          assert.equal(new URL(page.url()).searchParams.get('case'), secondId);
          for (const route of ['/?case=' + secondId, '/bag/' + secondId]) {
            await page.goto(base + route, { waitUntil: 'domcontentloaded' });
            await page.locator('#vl-case').waitFor({ timeout: 20000 });
            assert.equal(await page.locator('#vl-case').getAttribute('data-case'), secondId);
          }
          await page.goto(base + '/bag/' + 'f'.repeat(64), { waitUntil: 'networkidle' });
          assert.equal(await page.locator('#vl-case').count(), 0);
          assert.match(await page.getByRole('alert').innerText(), /No replacement Case/);
          await capture(page, 'unavailable-case');
          await page.goto(base + '/unknown-route', { waitUntil: 'networkidle' });
          assert.match(await page.locator('body').innerText(), /NOT IN THIS BUILD/);
        });
      }
      await context.close();
    }
    await check('live browser network uses same-origin GET and no runtime or asset errors', async () => {
      for (const request of report.requests) { assert.equal(request.method, 'GET'); assert.equal(new URL(request.url).origin, base); }
      assert.deepEqual(report.errors, []);
    });
    report.verdict = 'PASS';
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    report.completedAt = new Date().toISOString();
    await browser.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
