const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require('playwright');
const baseUrl = process.env.BINRAT_FRONTDOOR_URL ?? 'http://127.0.0.1:4173';
const artifactDir = 'browser-artifacts/frontdoor';
mkdirSync(artifactDir, { recursive: true });
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'phone', width: 430, height: 932 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-demo', width: 320, height: 844 },
  { name: 'phone-demo', width: 360, height: 844 },
  { name: 'tablet-demo', width: 768, height: 900 },
];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
      await page.goto(`${baseUrl}/?fixtures=1`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.body.dataset.readState === 'FIXTURE_DATA');
      assert.equal((await page.locator('#hero-title').innerText()).replace(/\s+/g, ' ').trim(), "YOU CAN'T WATCH ALL THIS SHIT. YOUR RATS CAN.");
      assert.equal(await page.locator('#dumpster-view').isVisible(), false);
      assert.match(await page.locator('.availability-strip').innerText(), /RAT ZERO · LIVE[\s\S]*TRIPWIRE · BUILDING[\s\S]*SNIFFER · NEXT/);
      assert.match(await page.locator('#home-freshness').innerText(), /FIXTURE.*NOT LIVE EVIDENCE/);
      assert.equal(await page.locator('[data-open-case]').count(), 3);
      assert.equal(await page.locator('#token-status').count(), 0);
      const primary = page.locator('.hero-actions a[href="#garbage"]');
      const primaryBox = await primary.boundingBox();
      assert.ok(primaryBox && primaryBox.height >= 44, 'primary touch target must be usable');
      assert.ok(primaryBox.y + primaryBox.height <= viewport.height, `first viewport must expose START DIGGING at ${viewport.width}`);
      const availability = await page.locator('.availability-strip').boundingBox();
      assert.ok(availability.y + availability.height <= viewport.height, `availability must not be buried at ${viewport.width}`);
      assert.ok(await primary.evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 16), 'primary CTA copy must be readable');
      let lastTop = 0;
      for (const selector of ['#fresh-proof', '#crew', '#how', '#working-rat', '#telegram']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.y > lastTop, `homepage order drift: ${selector}`);
        lastTop = box.y;
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `horizontal overflow at ${viewport.width}`);
      await page.screenshot({ path: `${artifactDir}/${viewport.name}-${viewport.width}x${viewport.height}.png` });
      await page.screenshot({ path: `${artifactDir}/${viewport.name}-full.png`, fullPage: true });
      await page.locator('[data-open-case]').first().click();
      await page.locator('#drawer.open').waitFor();
      assert.match(await page.locator('#drawer').innerText(), /NOT LIVE EVIDENCE/);
      assert.match(await page.locator('.case-next-step').innerText(), /TRIPWIRE · BUILDING[\s\S]*not available yet/);
      await page.locator('[data-crew-handoff]').click();
      await page.waitForFunction(() => !document.querySelector('#drawer').classList.contains('open'));
      await page.locator('#crew-selected[data-rat="tripwire"]').waitFor();
      assert.match(await page.locator('#crew-selected').innerText(), /BUILDING · NOT AVAILABLE YET/);
      assert.equal(await page.locator('#crew-selected a').count(), 0);
      assert.equal(await page.locator('.locked-slot').count(), 2);
      await page.locator('[data-select-rat="sniffer"]').click();
      assert.match(await page.locator('#crew-selected').innerText(), /NEXT · NOT AVAILABLE YET/);
      assert.equal(await page.locator('#crew-selected a').count(), 0);
      await page.locator('[data-select-rat="rat-zero"]').click();
      assert.equal(await page.locator('[data-select-rat="rat-zero"]').getAttribute('aria-pressed'), 'true');
      // The URL is still #crew-tripwire after manual selection; repeating that link must restore Tripwire.
      await page.locator('.crew-overview a[href="#crew-tripwire"]').click();
      assert.equal(await page.locator('#crew-selected').getAttribute('data-rat'), 'tripwire');
      await page.locator('[data-select-rat="rat-zero"]').click();
      await page.locator('#crew-selected a[href="#garbage"]').click();
      await page.waitForFunction(() => document.body.dataset.view === 'dumpster');
      assert.equal(await page.locator('#hero-title').isVisible(), false);
      assert.equal(await page.locator('#garbage').isVisible(), true);
      await page.locator('[data-bag-id]').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('#drawer.open').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-bag-id]').first().evaluate((element) => element === document.activeElement), true);
      await page.locator('.brand').click();
      await page.waitForFunction(() => document.body.dataset.view === 'home');
      assert.equal(await primary.isVisible(), true);
      if (viewport.width <= 760) await page.locator('.section-nav summary').click();
      const denLink = viewport.width <= 760 ? page.locator('.section-nav a[href="#den"]') : page.locator('.site-header > nav a[href="#den"]');
      await denLink.click();
      await page.locator('#den').waitFor();
      assert.match(await page.locator('#den').innerText(), /THE DEN · BUILDING[\s\S]*Persistent jobs are being built/);
      if (viewport.width <= 760) assert.equal(await page.locator('.section-nav').getAttribute('open'), null);
      assert.equal(await page.locator('.telegram-return a[href="https://t.me/BinratBot"]').count(), 1);
      assert.deepEqual(writes, [], 'browsing cannot create jobs or send writes');
      assert.deepEqual(errors, [], `page errors at ${viewport.width}`);
      await context.close();
    }
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/?fixtures=1#garbage`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#garbage').isVisible(), true);
    assert.equal(await page.locator('#hero-title').isVisible(), false);
    assert.equal(new URL(page.url()).hash, '#garbage');
    await page.close();
  } finally { await browser.close(); }
  console.log('BINRAT frontdoor journey browser smoke: PASS (7 viewports, Case/Crew/Den/discovery, no writes)');
})().catch((error) => { console.error(error); process.exit(1); });
